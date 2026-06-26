"""
味记 AI 服务 - 讯飞语音识别模块 (Task 7)

调用科大讯飞"一句话识别"接口，将短音频转为文本。

依赖 Task 1 完成的 config.py（settings）与 exceptions.py。
Task 8 会在 main.py 的 recognize_voice 端点调用本模块。
"""
import base64
import hashlib
import hmac
import json
import time
from urllib.parse import quote

import httpx

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError


# 讯飞"一句话识别"端点。
# 说明：讯飞 IAT 官方主推 WebSocket（wss://iat-api.xfyun.cn/v2/iat），
#       本模块按 spec 用简化 REST 方式调用同一 host；若讯飞文档调整端点，改这里即可。
_ASR_HOST = "iat-api.xfyun.cn"
_ASR_PATH = "/v2/iat"


def _build_auth_url() -> str:
    """
    生成讯飞鉴权 URL（含 hmac-sha1 签名）。

    按讯飞文档：以 host + date + request-line 拼签名原文，用 api_secret 做
    hmac-sha1 后 base64，最终组装成带 authorization/date/host 查询参数的 https URL。

    Returns:
        完整 https URL 字符串。
    """
    # RFC1123 GMT 日期（讯飞要求）
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())

    # 签名原文：host\ndate\nGET request-line HTTP/1.1
    signature_origin = (
        f"host: {_ASR_HOST}\n"
        f"date: {date}\n"
        f"GET {_ASR_PATH} HTTP/1.1"
    )

    # hmac-sha1 签名 + base64
    signature_sha = base64.b64encode(
        hmac.new(
            settings.XFYUN_API_SECRET.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("utf-8")

    # authorization 原文 + base64
    authorization_origin = (
        f'api_key="{settings.XFYUN_API_KEY}", '
        f'algorithm="hmac-sha1", '
        f'headers="host date request-line", '
        f'signature="{signature_sha}"'
    )
    authorization = base64.b64encode(
        authorization_origin.encode("utf-8")
    ).decode("utf-8")

    # 拼装 URL（query 参数需 URL 编码，避免日期中的空格/逗号破坏 URL）
    url = (
        f"https://{_ASR_HOST}{_ASR_PATH}"
        f"?authorization={quote(authorization, safe='')}"
        f"&date={quote(date, safe='')}"
        f"&host={quote(_ASR_HOST, safe='')}"
    )
    return url


async def recognize(audio_bytes: bytes) -> str:
    """
    语音识别：将短音频（PCM/WAV/MP3）转为文本。

    Args:
        audio_bytes: 音频二进制数据。

    Returns:
        识别出的文本。

    Raises:
        AiAuthError: 讯飞 APP_ID/API_KEY/API_SECRET 未配置或鉴权失败。
        AiQuotaError: 讯飞配额超限。
        AiProviderError: 调用讯飞 ASR 失败（网络、解析等）。
    """
    # 1. key 缺失检查
    if not settings.xfyun_ready:
        raise AiAuthError(
            "xfyun",
            "XFYUN_APP_ID/API_KEY/API_SECRET 未配置",
        )

    # 2. 构建鉴权 URL
    try:
        url = _build_auth_url()
    except Exception as e:
        raise AiProviderError("xfyun", f"鉴权签名生成失败: {e}") from e

    # 3. 上传音频请求识别（简化 REST：base64 音频放入 JSON）
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    payload = {
        "common": {"app_id": settings.XFYUN_APP_ID},
        "audio": {"data": audio_b64},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        raise AiProviderError("xfyun", f"网络请求失败: {e}") from e

    if resp.status_code != 200:
        raise AiProviderError(
            "xfyun",
            f"讯飞 ASR HTTP 状态异常: {resp.status_code}",
        )

    # 4. 解析 JSON 结果
    try:
        data = json.loads(resp.text)
    except ValueError as e:
        raise AiProviderError("xfyun", f"响应非 JSON: {e}") from e

    code = data.get("code")
    # 讯飞常见错误码：112xx 鉴权失败；10043/10005 配额超限
    if code in (11200, 11201, 11202, 11206, 11207):
        raise AiAuthError("xfyun", f"鉴权失败: {data.get('message', '')}")
    if code in (10043, 10005):
        raise AiQuotaError("xfyun", f"配额超限: {data.get('message', '')}")
    if code not in (0, "0", None):
        raise AiProviderError(
            "xfyun",
            f"讯飞 ASR 错误码 {code}: {data.get('message', '')}",
        )

    text = data.get("data") or data.get("text") or ""
    if not text:
        raise AiProviderError("xfyun", "未识别到文本")
    return text
