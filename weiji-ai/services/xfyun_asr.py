"""
味记 AI 服务 - 讯飞语音识别模块 (Task 7 / Task 15)

调用科大讯飞"语音听写"IAT v2 接口，将短音频转为文本。

讯飞 IAT v2 仅提供 WebSocket（wss://）接口，不存在 REST 调用方式。
本模块使用 websockets 库实现完整的：握手鉴权 → 分帧上传 → 多帧接收 → 文本拼接 流程。

协议要点（参考 https://www.xfyun.cn/doc/asr/voicedictation/API.html）：
  - 端点：wss://iat-api.xfyun.cn/v2/iat
  - 鉴权：URL query 参数 authorization / date / host
  - 签名原文：host: <host>\ndate: <date>\nGET /v2/iat HTTP/1.1
  - 签名算法：HMAC-SHA256（用 API_SECRET），结果 base64 编码
  - 上行帧：common（首帧）+ business（首帧）+ data（每帧）
  - data.status：0=首帧 1=中间帧 2=末帧
  - 下行帧：data.ws[].cw[].w 为识别出的文字片段，data.status=2 表示识别完成

依赖 config.py（settings）与 exceptions.py。
main.py 的 recognize_voice 端点调用本模块的 recognize 函数。
"""
import asyncio
import base64
import hashlib
import hmac
import json
from email.utils import formatdate
from urllib.parse import quote

import websockets

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError


# 讯飞 IAT v2 WebSocket 端点
_ASR_HOST = "iat-api.xfyun.cn"
_ASR_PATH = "/v2/iat"

# 每帧音频字节数（讯飞推荐 1280 字节/帧，对应 40ms 的 16k16bit PCM）
_FRAME_SIZE = 1280

# 单次识别整体超时（秒）
_TIMEOUT = 30.0


def _build_auth_url() -> str:
    """
    生成讯飞 IAT v2 鉴权 wss URL。

    讯飞 WebSocket 鉴权流程：
      1. 取当前 GMT 时间作为 date（RFC1123 格式，必须英文）
      2. 签名原文 = "host: <host>\\ndate: <date>\\nGET <path> HTTP/1.1"
      3. 用 API_SECRET 做 HMAC-SHA256 签名原文，再 base64 编码得到 signature
      4. authorization 原文 = 'api_key="<API_KEY>", algorithm="hmac-sha256",
         headers="host date request-line", signature="<signature>"'
      5. authorization 整体再做一次 base64 编码
      6. 拼到 wss URL 的 query 参数：authorization / date / host

    Returns:
        完整 wss URL 字符串（含鉴权参数）。
    """
    # 用 email.utils.formatdate 生成 RFC1123 GMT 日期。
    # 不使用 time.strftime，因为它依赖系统 locale，在中文 locale 系统上会返回
    # "周一, 07 7月 2026 ..." 而非 "Mon, 07 Jul 2026 ..."，导致讯飞鉴权失败。
    date = formatdate(usegmt=True)

    # 签名原文：host\ndate\nGET request-line HTTP/1.1
    signature_origin = (
        f"host: {_ASR_HOST}\n"
        f"date: {date}\n"
        f"GET {_ASR_PATH} HTTP/1.1"
    )

    # HMAC-SHA256 签名 + base64
    signature_sha = base64.b64encode(
        hmac.new(
            settings.XFYUN_API_SECRET.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")

    # authorization 原文 + base64
    authorization_origin = (
        f'api_key="{settings.XFYUN_API_KEY}", '
        f'algorithm="hmac-sha256", '
        f'headers="host date request-line", '
        f'signature="{signature_sha}"'
    )
    authorization = base64.b64encode(
        authorization_origin.encode("utf-8")
    ).decode("utf-8")

    # 拼装 wss URL（query 参数需 URL 编码，避免日期中的空格/逗号破坏 URL）
    url = (
        f"wss://{_ASR_HOST}{_ASR_PATH}"
        f"?authorization={quote(authorization, safe='')}"
        f"&date={quote(date, safe='')}"
        f"&host={quote(_ASR_HOST, safe='')}"
    )
    return url


def _build_frame(status: int, audio_b64: str) -> str:
    """
    构造一帧讯飞 IAT 上行消息。

    讯飞 IAT v2 上行帧结构：
      - common：应用信息（仅首帧需要）
      - business：业务参数（仅首帧需要）
      - data：音频数据（每帧都需要）
        - status：0=首帧 1=中间帧 2=末帧
        - format / encoding：音频格式描述
        - audio：base64 编码的音频分片

    Args:
        status: 帧状态（0/1/2）。
        audio_b64: base64 编码的音频分片。

    Returns:
        JSON 字符串。
    """
    # 假设：音频为 16kHz 16bit PCM（format=audio/L16;rate=16000, encoding=raw）。
    # 若实际音频为 WAV/MP3 等带封装格式，需根据上传文件类型调整 format/encoding。
    frame: dict = {
        "data": {
            "status": status,
            "format": "audio/L16;rate=16000",
            "encoding": "raw",
            "audio": audio_b64,
        }
    }
    # common + business 仅在首帧（status=0）携带
    if status == 0:
        frame["common"] = {"app_id": settings.XFYUN_APP_ID}
        frame["business"] = {
            "language": "zh_CN",
            "domain": "iat",
            "accent": "mandarin",
        }
    return json.dumps(frame)


async def recognize(audio_bytes: bytes) -> str:
    """
    语音识别：将短音频转为文本（讯飞 IAT v2 WebSocket 协议）。

    协议流程：
      1. 建立到 wss://iat-api.xfyun.cn/v2/iat 的连接（URL 带鉴权参数）
      2. 按每帧 1280 字节切分音频，依次发送：
         - 第一帧 status=0（首帧，含 common + business 参数）
         - 中间帧 status=1
         - 最后帧 status=2（末帧，通知服务端音频结束）
      3. 接收服务端返回的 JSON 帧，拼接 data.ws[].cw[].w 得到完整文本
      4. 收到 code=0 且 data.status=2 时识别完成

    Args:
        audio_bytes: 音频二进制数据（推荐 16k16bit PCM）。

    Returns:
        识别出的文本。

    Raises:
        AiAuthError: 讯飞 APP_ID/API_KEY/API_SECRET 未配置或鉴权失败。
        AiQuotaError: 讯飞配额超限。
        AiProviderError: 调用讯飞 ASR 失败（网络、超时、服务端错误等）。
    """
    # 1. 密钥缺失检查
    if not settings.xfyun_ready:
        raise AiAuthError("xfyun", "讯飞 ASR 密钥未配置")

    # 2. 构建鉴权 URL
    try:
        url = _build_auth_url()
    except Exception as e:
        raise AiProviderError("xfyun", f"鉴权签名生成失败: {e}") from e

    # 3. 建立 WebSocket 连接并发送音频
    try:
        async with websockets.connect(
            url,
            open_timeout=_TIMEOUT,
            max_size=None,
            ping_interval=None,
        ) as ws:
            offset = 0
            total = len(audio_bytes)
            is_first = True

            # 按帧切分音频并逐帧发送
            while offset < total:
                chunk = audio_bytes[offset:offset + _FRAME_SIZE]
                offset += _FRAME_SIZE
                is_last = (offset >= total)
                audio_b64 = base64.b64encode(chunk).decode("utf-8")

                if is_first:
                    # 首帧：status=0，含 common + business 参数
                    await asyncio.wait_for(
                        ws.send(_build_frame(0, audio_b64)), timeout=_TIMEOUT
                    )
                    is_first = False
                    # 若首帧即末帧（音频 ≤ 1280 字节），补发空末帧通知服务端结束
                    if is_last:
                        await asyncio.wait_for(
                            ws.send(_build_frame(2, "")), timeout=_TIMEOUT
                        )
                elif is_last:
                    # 末帧：status=2
                    await asyncio.wait_for(
                        ws.send(_build_frame(2, audio_b64)), timeout=_TIMEOUT
                    )
                else:
                    # 中间帧：status=1
                    await asyncio.wait_for(
                        ws.send(_build_frame(1, audio_b64)), timeout=_TIMEOUT
                    )

            # 空音频兜底：连一帧都没发时，发首帧 + 空末帧
            if is_first:
                await asyncio.wait_for(
                    ws.send(_build_frame(0, "")), timeout=_TIMEOUT
                )
                await asyncio.wait_for(
                    ws.send(_build_frame(2, "")), timeout=_TIMEOUT
                )

            # 4. 接收响应帧并拼接文本
            text_parts: list = []
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=_TIMEOUT)
                except websockets.exceptions.ConnectionClosed:
                    # 连接被服务端关闭，结束接收
                    break

                try:
                    data = json.loads(raw)
                except (ValueError, TypeError) as e:
                    raise AiProviderError("xfyun", f"响应非 JSON: {e}") from e

                code = data.get("code")
                # 讯飞常见错误码：112xx 鉴权失败；10043/10005 配额超限
                if code in (11200, 11201, 11202, 11206, 11207):
                    raise AiAuthError(
                        "xfyun", f"鉴权失败: {data.get('message', '')}"
                    )
                if code in (10043, 10005):
                    raise AiQuotaError(
                        "xfyun", f"配额超限: {data.get('message', '')}"
                    )
                if code not in (0, "0", None):
                    raise AiProviderError(
                        "xfyun",
                        f"讯飞 ASR 错误码 {code}: {data.get('message', '')}",
                    )

                # 拼接识别文本：data.ws[].cw[].w
                payload = data.get("data")
                if isinstance(payload, dict):
                    for ws_item in payload.get("ws", []) or []:
                        for cw_item in ws_item.get("cw", []) or []:
                            w = cw_item.get("w")
                            if w:
                                text_parts.append(w)

                    # data.status == 2 表示最后一帧，识别完成
                    if payload.get("status") == 2:
                        break

    except AiAuthError:
        raise
    except AiQuotaError:
        raise
    except AiProviderError:
        raise
    except asyncio.TimeoutError as e:
        raise AiProviderError("xfyun", "讯飞 ASR 调用超时") from e
    except websockets.exceptions.InvalidHandshake as e:
        # WebSocket 握手失败（通常是鉴权失败，如签名错误返回非 101 状态）
        raise AiAuthError("xfyun", f"鉴权失败（WebSocket 握手）: {e}") from e
    except (OSError, websockets.exceptions.WebSocketException) as e:
        raise AiProviderError("xfyun", f"WebSocket 连接/通信失败: {e}") from e
    except Exception as e:
        raise AiProviderError("xfyun", f"讯飞 ASR 调用失败: {e}") from e

    text = "".join(text_parts).strip()
    if not text:
        raise AiProviderError("xfyun", "未识别到文本")
    return text
