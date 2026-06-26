"""
味记 AI 服务 - 腾讯云图片内容审核

调用腾讯云内容安全 ImageModeration 接口审核图片合规性。
容错优先：key 缺失或任何接口异常均视为合规（返回 True），仅当接口明确返回 Block 时返回 False。
不阻塞主流程是 spec 的核心要求。
"""
import base64
import hashlib
import hmac
import json
import time
import datetime
import httpx
from config import settings


# 腾讯云内容安全 ImageModeration 接口配置
_TENCENT_MODERATION_HOST = "ims.tencentcloudapi.com"
_TENCENT_MODERATION_ENDPOINT = f"https://{_TENCENT_MODERATION_HOST}"
_TENCENT_SERVICE = "ims"
_TENCENT_ACTION = "ImageModeration"
_TENCENT_VERSION = "2020-12-29"
_TENCENT_REGION = ""  # 全局服务，留空


def _build_signed_headers(payload: dict) -> dict:
    """
    构造腾讯云 TC3-HMAC-SHA256（v3 签名）请求头。

    参考：https://cloud.tencent.com/document/api/213/30654
    参考：https://cloud.tencent.com/document/api/1125/75404
    """
    secret_id = settings.TENCENT_SECRET_ID
    secret_key = settings.TENCENT_SECRET_KEY
    if not secret_id or not secret_key:
        raise ValueError("tencent secret id/key missing")

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
        True  = 合规（或审核不可用时降级视为合规，不阻塞主流程）
        False = 违规（接口明确返回 Block）

    容错优先原则：
        - key 缺失（not settings.tencent_ready）→ 直接返回 True
        - 任何接口异常 → 返回 True（避免误伤用户）
        - 只有接口明确返回 Block 时才返回 False
        - Pass / Review / 字段缺失 / 异常 → True
    """
    if not settings.tencent_ready:
        return True

    try:
        file_content = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "BizType": "default",
            "FileUrl": None,
            "FileContent": file_content,
        }
        headers = _build_signed_headers(payload)
        # body 序列化方式与签名时一致（json.dumps 默认行为）
        body = json.dumps(payload)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _TENCENT_MODERATION_ENDPOINT,
                content=body,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        suggestion = (data.get("Response") or {}).get("Suggestion")
        if suggestion == "Block":
            return False
        # Pass / Review / 字段缺失 → 视为合规
        return True
    except Exception:
        # 任何异常（网络、鉴权、解析等）均视为合规，不阻塞主流程
        return True
