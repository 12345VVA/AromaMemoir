"""
味记 AI 服务 - 腾讯云图片内容审核

调用腾讯云内容安全 ImageModeration 接口审核图片合规性。
容错与安全平衡：
- key 缺失或网络瞬时异常 → 降级视为合规（返回 True），不阻塞主流程
- 鉴权失败（密钥/签名问题）→ 记录 error 并返回 False，避免静默放行
- 仅当接口明确返回 Suggestion=Pass/Review 时视为合规，Block 时拒绝
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import time
import datetime
import httpx
from config import settings
from exceptions import AiAuthError


logger = logging.getLogger(__name__)

# 腾讯云内容安全 ImageModeration 接口配置
_TENCENT_MODERATION_HOST = "ims.tencentcloudapi.com"
_TENCENT_MODERATION_ENDPOINT = f"https://{_TENCENT_MODERATION_HOST}"
_TENCENT_SERVICE = "ims"
_TENCENT_ACTION = "ImageModeration"
_TENCENT_VERSION = "2020-12-29"
_TENCENT_REGION = ""  # 全局服务，留空

# BizType 从环境变量读取；缺失或为 'default' 时记录 WARNING（'default' 通常非有效策略 ID）
_BIZ_TYPE = os.getenv('TENCENT_MODERATION_BIZ_TYPE', 'default')
if _BIZ_TYPE == 'default':
    logger.warning(
        "[AI 配置] TENCENT_MODERATION_BIZ_TYPE 未配置或为 'default'，"
        "请在腾讯云内容安全控制台创建审核策略后将其 BizType 写入环境变量。"
        "使用 'default' 可能导致审核接口调用失败。"
    )


def _build_signed_headers(payload: dict) -> dict:
    """
    构造腾讯云 TC3-HMAC-SHA256（v3 签名）请求头。

    参考：https://cloud.tencent.com/document/api/213/30654
    参考：https://cloud.tencent.com/document/api/1125/75404
    """
    secret_id = settings.TENCENT_SECRET_ID
    secret_key = settings.TENCENT_SECRET_KEY
    if not secret_id or not secret_key:
        raise AiAuthError('tencent', 'TENCENT_SECRET_ID/SECRET_KEY 缺失')

    host = _TENCENT_MODERATION_HOST
    service = _TENCENT_SERVICE
    action = _TENCENT_ACTION
    version = _TENCENT_VERSION

    timestamp = int(time.time())
    # 使用时区感知的 UTC，避免 datetime.utcnow() 在 3.12+ 的弃用警告
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    date_str = utc_now.strftime("%Y-%m-%d")

    # 请求体序列化（与发送时保持一致，确保签名哈希与实际 body 一致）
    payload_str = json.dumps(payload)
    payload_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

    # 1. 拼接规范请求 CanonicalRequest
    #    头部名小写并按字典序排列；x-tc-action 取小写形式
    canonical_headers = (
        "content-type:application/json; charset=utf-8\n"
        f"host:{host}\n"
        f"x-tc-action:{action.lower()}\n"
    )
    signed_headers = "content-type;host;x-tc-action"
    canonical_request = (
        "POST\n"
        "/\n"
        "\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    # 2. 拼接待签名串 StringToSign
    credential_scope = f"{date_str}/{service}/tc3_request"
    hashed_canonical_request = hashlib.sha256(
        canonical_request.encode("utf-8")
    ).hexdigest()
    string_to_sign = (
        "TC3-HMAC-SHA256\n"
        f"{timestamp}\n"
        f"{credential_scope}\n"
        f"{hashed_canonical_request}"
    )

    # 3. 计算签名 Signature（层层派生密钥）
    def _hmac_sha256(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac_sha256(("TC3" + secret_key).encode("utf-8"), date_str)
    secret_service = _hmac_sha256(secret_date, service)
    secret_signing = _hmac_sha256(secret_service, "tc3_request")
    signature = hmac.new(
        secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # 4. 构造 Authorization 头
    authorization = (
        "TC3-HMAC-SHA256 "
        f"Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    headers = {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Version": version,
        "X-TC-Timestamp": str(timestamp),
    }
    # 全局服务不传 region，避免空值头部干扰签名校验
    if _TENCENT_REGION:
        headers["X-TC-Region"] = _TENCENT_REGION
    return headers


async def check_image(image_bytes: bytes) -> bool:
    """
    审核图片内容合规性。

    返回值：
        True  = 合规（Suggestion=Pass/Review；或审核不可用/网络异常时降级视为合规）
        False = 违规（Suggestion=Block；或鉴权失败时拒绝，避免静默放行）

    容错与安全平衡：
        - key 缺失（not settings.tencent_ready）→ 直接返回 True（不阻塞主流程）
        - 鉴权异常（AiAuthError / API 返回 AuthFailure.*）→ 记录 error，返回 False
        - 网络瞬时异常（ConnectError/Timeout/NetworkError）→ 重试一次，仍失败返回 True
        - 其他异常 / Suggestion 字段缺失或未知 → 记录 warning，返回 True（容错优先）
        - 仅 Suggestion=Pass/Review 视为明确合规
    """
    if not settings.tencent_ready:
        return True

    file_content = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "BizType": _BIZ_TYPE,
        "FileUrl": None,
        "FileContent": file_content,
    }

    try:
        headers = _build_signed_headers(payload)
    except AiAuthError as e:
        logger.error("tencent moderation auth error: %s", e)
        return False

    # body 序列化方式与签名时一致（json.dumps 默认行为）
    body = json.dumps(payload)

    data = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _TENCENT_MODERATION_ENDPOINT,
                    content=body,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
            break
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
            if attempt == 0:
                logger.warning("tencent moderation network error, retrying: %s", e)
                continue
            logger.warning(
                "tencent moderation network error after retry, fail-open: %s", e
            )
            return True
        except Exception as e:
            logger.warning("tencent moderation request error, fail-open: %s", e)
            return True

    if data is None:
        return True

    response_data = data.get("Response") or {}
    error_info = response_data.get("Error")
    if error_info:
        error_code = error_info.get("Code", "")
        error_message = error_info.get("Message", "")
        if error_code.startswith("AuthFailure"):
            logger.error(
                "tencent moderation auth failure: code=%s message=%s",
                error_code, error_message,
            )
            return False
        logger.warning(
            "tencent moderation API error: code=%s message=%s, fail-open",
            error_code, error_message,
        )
        return True

    suggestion = response_data.get("Suggestion")
    if suggestion == "Block":
        return False
    if suggestion in ("Pass", "Review"):
        return True
    logger.warning(
        "tencent moderation unknown Suggestion: %s, fail-open", suggestion
    )
    return True
