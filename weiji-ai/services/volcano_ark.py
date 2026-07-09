"""
味记 AI 服务 - 火山方舟（Ark）AI 模块

调用火山方舟豆包多模态模型实现食物识别与菜谱推荐，
调用豆包 Seedream 模型实现图像编辑/生成。
模型 endpoint/ID 由 config.Settings 提供（ARK_BASE_URL / ARK_MODEL_MULTIMODAL /
ARK_MODEL_SEEDREAM），默认值见 config.py，可在 .env 中覆盖。
作为首选 AI 能力，失败时由 main.py 降级到其他厂商兜底。
"""
import base64
import ipaddress
import json
import logging
import os
import uuid
from urllib.parse import urlparse

import httpx
import openai
from openai import AsyncOpenAI

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError

logger = logging.getLogger(__name__)

# 模型 endpoint/ID 由 config.settings 注入，默认值见 config.py，可在 .env 覆盖

# 模块级懒加载客户端单例
_client: AsyncOpenAI | None = None

# 豆包兜底统一置信度（标识来源为豆包）
_DOUBAO_CONFIDENCE = 0.9

# edit_image 下载生成图 URL 的域名白名单（火山系域名）
_ALLOWED_HOST_SUFFIXES = ('.volces.com', '.volcengine.com', '.bytedance.com')

_RECOGNIZE_PROMPT = """你是美食识别专家。请分析这张食物图片，只识别其中最主要的一道菜（若图中出现多种食物，选占画面主体、最突出的那一道），返回严格的 JSON 对象（不要 markdown 代码块、不要多余文字），格式如下：
{
  "dishName": "菜品中文名",
  "ingredients": [{"name": "食材名", "confidence": 0.9}],
  "cookingMethod": "烹饪方式（如炒/炖/蒸/炸）",
  "confidence": 0.9,
  "nutrition": {"calories": 520, "protein": 28.5, "fat": 18.2, "carbs": 62.0}
}
注意：必须直接返回单个菜品对象（顶层即为 dishName/ingredients/... 字段），严禁用 "dishes" 数组包裹或返回多道菜；confidence 统一返回 0.9；ingredients 至少列 2 项；nutrition 的数值要合理估算。"""

# 推荐菜谱 prompt 模板（{{ }} 经 str.format 渲染为 JSON 单花括号）
_RECOMMEND_PROMPT_TEMPLATE = """你是营养师和美食推荐专家。用户最近记录的菜品是「{dish_name}」，{recent_context}请基于这道菜推荐 3 道搭配合理的菜谱，要求营养均衡、口味搭配。

返回严格的 JSON 对象（不要 markdown 代码块），格式：
{{
  "recipes": [
    {{
      "id": "rec-001",
      "name": "菜名",
      "category": "分类（如家常菜/汤品/甜品）",
      "difficulty": "简单/中等/困难",
      "cookTime": "30分钟",
      "reason": "推荐理由（一句话）",
      "matchScore": 0.9
    }}
  ]
}}"""


def _get_client() -> AsyncOpenAI:
    """懒加载 AsyncOpenAI 客户端单例。调用前需确保 settings.volcano_ark_ready。"""
    global _client
    if _client is None:
        # 显式设置 timeout=30.0，覆盖 SDK 默认的 600s（10 分钟），
        # 避免网络抖动时 worker 与内存被长时间占用
        _client = AsyncOpenAI(
            api_key=settings.ARK_API_KEY,
            base_url=settings.ARK_BASE_URL,
            # 多模态识别/生成耗时长（实测纯文本对话即 ~7s，带图 + JSON 生成更长），
            # 超时由 settings.ARK_TIMEOUT 配置（默认 120s）。
            timeout=settings.ARK_TIMEOUT,
            # 失败立即降级，由 main.py 降级链兜底；SDK 默认 max_retries=2 会让单次
            # 请求卡在重试里数十秒，拖垮上游网关（cool-admin）导致 503。
            max_retries=0,
        )
    return _client


def _is_safe_url(url: str) -> bool:
    """校验 URL 是否在火山系域名白名单内且非内网/云元数据地址。"""
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ''
    except ValueError:
        return False
    if not host:
        return False
    # 拒绝内网/云元数据 IP（169.254.169.254 已被 is_link_local 覆盖）
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return False
    except ValueError:
        # 非 IP（域名），走后缀匹配
        pass
    return any(host.endswith(suf) or host == suf.lstrip('.') for suf in _ALLOWED_HOST_SUFFIXES)


def _handle_ark_api_error(e: Exception, action: str) -> None:
    """
    统一处理火山方舟 API 异常，转换为项目异常体系。

    Args:
        e: 捕获的原始异常
        action: 触发异常的操作描述（如 '识别菜品'、'生成推荐'、'图像编辑'）

    Raises:
        AiAuthError: API Key 无效
        AiQuotaError: 调用频率超限
        AiProviderError: 其他 API 错误
    """
    if isinstance(e, openai.AuthenticationError):
        raise AiAuthError('volcano_ark', 'API Key 无效') from e
    if isinstance(e, openai.RateLimitError):
        raise AiQuotaError('volcano_ark', '调用频率超限') from e
    if isinstance(e, openai.APIError):
        # 脱敏：仅保留异常类名，剔除 str(e) 中可能含的 RequestId/Host 等敏感信息
        raise AiProviderError('volcano_ark', f'{action}失败: {type(e).__name__}') from e
    raise AiProviderError('volcano_ark', f'{action}失败: {type(e).__name__}') from e


async def recognize_dish(image_url: str) -> dict:
    """
    调用豆包多模态模型识别菜品。

    Args:
        image_url: 食物图片的可访问 URL。

    Returns:
        识别结果字典，含 dishName / ingredients / cookingMethod / confidence / nutrition。
        confidence 统一覆盖为 0.9，标识来源为豆包。

    Raises:
        AiAuthError: ARK_API_KEY 未配置或无效。
        AiQuotaError: 调用频率超限。
        AiProviderError: API 错误、JSON 解析失败或其他未知错误。
    """
    if not settings.volcano_ark_ready:
        raise AiAuthError('volcano_ark', 'ARK_API_KEY 未配置')

    client = _get_client()

    try:
        response = await client.chat.completions.create(
            model=settings.ARK_MODEL_MULTIMODAL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": _RECOGNIZE_PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        _handle_ark_api_error(e, '识别菜品')

    try:
        if not response.choices:
            raise AiProviderError('volcano_ark', '豆包返回空 choices')
        message = response.choices[0].message
        content = message.content
    except (IndexError, AttributeError) as e:
        raise AiProviderError('volcano_ark', f'豆包响应解析失败: {e}')

    try:
        result = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        raise AiProviderError('volcano_ark', '响应格式错误，无法解析 JSON')

    # 契约归一化：模型偶发不守 prompt，返回 {dishes: [...]} 多菜数组。
    # 统一取第一道主菜，保证接口始终是单个菜品结构，避免前端结构漂移。
    dishes = result.get('dishes') if isinstance(result, dict) else None
    if isinstance(dishes, list) and dishes and isinstance(dishes[0], dict):
        result = dishes[0]

    # confidence 统一覆盖为 0.9（spec 要求，标识来自豆包）
    result["confidence"] = _DOUBAO_CONFIDENCE
    return result


async def recommend(dish_name: str, recent_records: list = None) -> list:
    """
    调用豆包多模态模型推荐搭配菜谱。

    Args:
        dish_name: 用户最近记录的菜品名。
        recent_records: 最近还记录过的菜品名列表（可选），用于丰富推荐上下文。

    Returns:
        长度为 3 的菜谱列表，每项为 dict，含 id / name / category /
        difficulty / cookTime / reason / matchScore 字段。

    Raises:
        AiAuthError: ARK_API_KEY 未配置或无效。
        AiQuotaError: 调用频率超限。
        AiProviderError: API 错误、响应非 JSON、格式不符合预期或其他未知错误。
    """
    if not settings.volcano_ark_ready:
        raise AiAuthError('volcano_ark', 'ARK_API_KEY 未配置')

    # 参数标准化：非 list 视为空，并切片取最近 10 条，避免 prompt token 爆炸
    if not isinstance(recent_records, list):
        recent_records = []
    recent_records = recent_records[-10:] if len(recent_records) > 10 else recent_records

    client = _get_client()

    if recent_records:
        recent_context = f"最近还记录过：{'、'.join(recent_records)}。"
    else:
        recent_context = ""

    prompt = _RECOMMEND_PROMPT_TEMPLATE.format(
        dish_name=dish_name, recent_context=recent_context
    )

    try:
        response = await client.chat.completions.create(
            model=settings.ARK_MODEL_MULTIMODAL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        _handle_ark_api_error(e, '生成推荐')

    try:
        if not response.choices:
            raise AiProviderError('volcano_ark', '豆包返回空 choices')
        content = response.choices[0].message.content
        data = json.loads(content)
    except (IndexError, AttributeError) as e:
        raise AiProviderError('volcano_ark', f'豆包响应解析失败: {e}')
    except (json.JSONDecodeError, TypeError):
        raise AiProviderError('volcano_ark', '响应格式错误，无法解析 JSON')

    recipes = data.get('recipes') if isinstance(data, dict) else None
    if not isinstance(recipes, list) or len(recipes) < 3:
        raise AiProviderError('volcano_ark', '响应格式不符合预期')

    return recipes


async def edit_image(image_url: str, prompt: str) -> str:
    """
    调用豆包 Seedream 模型编辑/生成图像。

    通过火山方舟官方 images/generations 端点（OpenAI 兼容）调用，在请求体 image
    字段传入原图进行编辑（图生图）。返回的临时 URL 下载后落盘到 static/ 目录，
    返回本地路径 /static/<filename>，规避火山临时 URL 数小时~1 天过期导致历史图
    404 的问题。

    Args:
        image_url: 原图的可访问 URL，作为编辑参考。
        prompt: 编辑指令，如「美化这张食物图片，增强色彩和清晰度」
            或「将这张食物图片转换为可爱贴纸风格」。

    Returns:
        落盘后图片的本地路径（如 /static/ai_xxxxxxxx.jpg）。

    Raises:
        AiAuthError: ARK_API_KEY 未配置或无效。
        AiQuotaError: 调用频率超限。
        AiProviderError: API 错误、响应解析失败、下载失败、落盘失败或其他未知错误。
    """
    if not settings.volcano_ark_ready:
        raise AiAuthError('volcano_ark', 'ARK_API_KEY 未配置')

    client = _get_client()

    try:
        # 走火山方舟官方 images/generations 端点（OpenAI 兼容）做图生图：
        # image 字段传原图进行编辑；火山扩展参数（response_format/size/watermark/
        # sequential_image_generation）经 extra_body 注入，规避 openai SDK 对原生
        # 参数的枚举校验。
        response = await client.images.generate(
            model=settings.ARK_MODEL_SEEDREAM,
            prompt=prompt,
            extra_body={
                "image": image_url,
                "response_format": "url",
                "size": "2K",
                "watermark": True,
                "sequential_image_generation": "disabled",
            },
        )
    except Exception as e:
        _handle_ark_api_error(e, '图像编辑')

    # 解析结构化响应：data[0] 为图片信息（含 url/b64_json）或错误信息（审核未通过等）
    try:
        if not response.data:
            raise AiProviderError('volcano_ark', '豆包返回空 data')
        image_item = response.data[0]
        # 单图生成失败时 data[0] 可能为错误信息对象（data.error.code/message）
        err = getattr(image_item, 'error', None)
        if err:
            err_code = getattr(err, 'code', '') or ''
            raise AiProviderError('volcano_ark', f'图片生成失败: {err_code}'.strip())
        new_image_url = getattr(image_item, 'url', None)
        b64_data = getattr(image_item, 'b64_json', None)
    except (IndexError, AttributeError) as e:
        raise AiProviderError('volcano_ark', f'豆包响应解析失败: {e}')

    image_bytes: bytes | None = None
    ext = 'jpg'

    if new_image_url:
        # SSRF 防护：仅允许火山系域名，拒绝内网/云元数据地址
        if not _is_safe_url(new_image_url):
            raise AiProviderError('volcano_ark', '生成图 URL 域名不在白名单')
        try:
            async with httpx.AsyncClient(timeout=30.0) as dl_client:
                dl_resp = await dl_client.get(new_image_url)
                dl_resp.raise_for_status()
                image_bytes = dl_resp.content
        except httpx.HTTPError as e:
            raise AiProviderError('volcano_ark', f'下载生成图片失败: {type(e).__name__}')
        # 依据响应 content-type 修正扩展名
        content_type = (dl_resp.headers.get('content-type') or '').lower()
        if 'png' in content_type:
            ext = 'png'
        elif 'webp' in content_type:
            ext = 'webp'
    elif b64_data:
        try:
            image_bytes = base64.b64decode(b64_data, validate=True)
        except (ValueError, base64.binascii.Error) as e:
            raise AiProviderError('volcano_ark', f'base64 解码失败: {type(e).__name__}')

    if image_bytes is None:
        raise AiProviderError('volcano_ark', '响应未包含图片数据（可能生成失败或审核未通过）')

    # 落盘到 static/ 目录，统一用 ai_ 前缀（不区分 edited/sticker，调用方不感知文件名）
    os.makedirs('static', exist_ok=True)
    filename = f"ai_{uuid.uuid4().hex}.{ext}"
    filepath = f"static/{filename}"
    try:
        with open(filepath, 'wb') as f:
            f.write(image_bytes)
    except OSError as e:
        raise AiProviderError('volcano_ark', f'图片落盘失败: {type(e).__name__}')

    return f"/static/{filename}"
