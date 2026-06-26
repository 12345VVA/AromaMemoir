"""
味记 AI 服务 - 火山引擎图片美化模块

调用火山引擎视觉智能服务对图片进行增强/美化处理。
美化属于辅助功能（非关键路径）：当 key 未配置时抛 AiAuthError，
由上层（Task 8）决定降级策略；当 key 已配置但调用或签名失败时，
本模块会安全降级为返回原图字节流，并打印 WARNING 日志。
"""
import base64
import hashlib
import hmac
import json
import logging
import httpx
from config import settings
from exceptions import AiProviderError, AiAuthError

logger = logging.getLogger(__name__)

# 火山引擎视觉智能服务端点
VOLCANO_VISUAL_HOST = "visual.volcengineapi.com"
VOLCANO_VISUAL_ENDPOINT = "https://visual.volcengineapi.com"
# 图像处理接口路径
VOLCANO_IMAGE_ENHANCE_PATH = "/v1/visual/ImageEnhancement"
# 服务标识（用于签名 credential scope）
VOLCANO_SERVICE = "cv"
VOLCANO_REGION = "cn-north-1"


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _build_signed_headers(
    method: str,
    url: str,
    headers: dict,
    body: bytes,
) -> dict:
    """
    构造火山引擎 v4 签名请求头（AWS sigv4 风格）。

    参数:
        method: HTTP 方法（POST / GET）
        url: 完整请求 URL
        headers: 待签名的业务请求头（含 Host / Content-Type 等）
        body: 请求体字节流

    返回:
        包含 Authorization 的完整请求头 dict。

    说明:
        本实现按火山引擎文档约定的 v4 签名流程生成。若任一环节因
        key 缺失或参数异常无法完成，会抛出 AiAuthError。
    """
    ak = settings.VOLCANO_ACCESS_KEY
    sk = settings.VOLCANO_SECRET_KEY
    if not ak or not sk:
        raise AiAuthError(
            "volcano",
            "VOLCANO_ACCESS_KEY/SECRET_KEY 未配置",
        )

    from urllib.parse import urlparse

    parsed = urlparse(url)
    host = parsed.hostname or VOLCANO_VISUAL_HOST
    path = parsed.path or "/"
    query = parsed.query

    # 1. 规范请求 canonical request
    content_sha = _sha256_hex(body)
    canonical_headers = {
        "content-type": headers.get("content-type", "application/json"),
        "host": host,
        "x-content-sha256": content_sha,
    }
    canonical_headers_str = "".join(
        f"{k}:{canonical_headers[k].strip()}\n"
        for k in sorted(canonical_headers.keys())
    )
    signed_headers_str = ";".join(sorted(canonical_headers.keys()))

    canonical_request = "\n".join([
        method.upper(),
        path,
        query,
        canonical_headers_str,
        signed_headers_str,
        content_sha,
    ])

    # 2. 待签字符串 string to sign
    amz_date = headers.get("x-date") or headers.get("X-Date")
    if not amz_date:
        # 调用方应已放入 x-date；此处兜底不抛错，由调用前的失败捕获
        from datetime import datetime, timezone
        amz_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    date_short = amz_date[:8]
    credential_scope = f"{date_short}/{VOLCANO_REGION}/{VOLCANO_SERVICE}/request"
    string_to_sign = "\n".join([
        "HMAC-SHA256",
        amz_date,
        credential_scope,
        _sha256_hex(canonical_request.encode("utf-8")),
    ])

    # 3. 计算签名（派生 signing key）
    k_date = _hmac_sha256(sk.encode("utf-8"), date_short)
    k_region = _hmac_sha256(k_date, VOLCANO_REGION)
    k_service = _hmac_sha256(k_region, VOLCANO_SERVICE)
    k_signing = _hmac_sha256(k_service, "request")
    signature = hmac.new(
        k_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # 4. 组装 Authorization 头
    authorization = (
        f"HMAC-SHA256 Credential={ak}/{credential_scope}, "
        f"SignedHeaders={signed_headers_str}, Signature={signature}"
    )

    merged = dict(headers)
    merged.update({
        "Host": host,
        "x-content-sha256": content_sha,
        "Authorization": authorization,
    })
    return merged


async def beautify(image_bytes: bytes, style: str = "auto") -> bytes:
    """
    对图片字节流进行美化处理，返回美化后的图片字节流。

    参数:
        image_bytes: 原始图片字节流
        style: 美化风格，默认 "auto"（由服务端自动判定）

    返回:
        美化后的图片字节流。

    异常:
        AiAuthError: 当 VOLCANO_ACCESS_KEY / SECRET_KEY 未配置时抛出。
        其他瞬时错误（网络、签名失败等）会安全降级为返回原图。

    说明:
        美化是辅助功能，Task 8 上层会基于返回结果决定是否落盘静态文件。
        本函数签名稳定为 (image_bytes, style) -> bytes，保证 Task 8 可直接调用。
    """
    ak = settings.VOLCANO_ACCESS_KEY
    sk = settings.VOLCANO_SECRET_KEY
    if not ak or not sk:
        raise AiAuthError(
            "volcano",
            "VOLCANO_ACCESS_KEY/SECRET_KEY 未配置",
        )

    # 调用火山引擎视觉智能服务。为控制复杂度并保证非关键路径稳定，
    # 任何调用/签名异常都降级为返回原图字节流，并打印 WARNING。
    from datetime import datetime, timezone

    try:
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        payload = {
            "image_base64": image_b64,
            "style": style,
        }
        body = json.dumps(payload).encode("utf-8")

        amz_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        url = f"{VOLCANO_VISUAL_ENDPOINT}{VOLCANO_IMAGE_ENHANCE_PATH}"
        base_headers = {
            "Content-Type": "application/json",
            "x-date": amz_date,
        }

        signed_headers = _build_signed_headers(
            method="POST",
            url=url,
            headers=base_headers,
            body=body,
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, content=body, headers=signed_headers)
        if resp.status_code != 200:
            logger.warning(
                "火山引擎图片美化接口返回非 200: status=%s body=%s, 降级返回原图",
                resp.status_code,
                resp.text[:200],
            )
            return image_bytes

        data = resp.json()
        result_b64 = data.get("data", {}).get("image_base64") or data.get("image_base64")
        if not result_b64:
            logger.warning(
                "火山引擎图片美化响应缺少图像字段: keys=%s, 降级返回原图",
                list(data.keys()),
            )
            return image_bytes

        return base64.b64decode(result_b64)

    except AiAuthError:
        # 鉴权错误向上透传，让 Task 8 决定降级策略
        raise
    except Exception as exc:  # noqa: BLE001 - 非关键路径需宽口径兜底
        logger.warning(
            "火山引擎图片美化调用失败: %s, 降级返回原图", exc
        )
        return image_bytes
