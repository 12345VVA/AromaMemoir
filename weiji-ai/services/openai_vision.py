"""
味记 AI 服务 - GPT-4o Vision 菜品识别兜底模块

百度 AI 置信度不足时，调用 OpenAI GPT-4o Vision 进行兜底识别。
模块级懒加载 AsyncOpenAI 客户端单例，避免全局状态在导入期创建连接。
"""
import base64
import json

import openai
from openai import AsyncOpenAI

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError


# 模块级懒加载客户端单例
_client: AsyncOpenAI | None = None

# GPT 兜底统一置信度（标识来源为 GPT）
_GPT_CONFIDENCE = 0.9

_PROMPT = """你是美食识别专家。请分析这张食物图片，返回严格的 JSON 对象（不要 markdown 代码块、不要多余文字），格式如下：
{
  "dishName": "菜品中文名",
  "ingredients": [{"name": "食材名", "confidence": 0.9}],
  "cookingMethod": "烹饪方式（如炒/炖/蒸/炸）",
  "confidence": 0.9,
  "nutrition": {"calories": 520, "protein": 28.5, "fat": 18.2, "carbs": 62.0}
}
注意：confidence 统一返回 0.9；ingredients 至少列 2 项；nutrition 的数值要合理估算。"""


def _get_client() -> AsyncOpenAI:
    """懒加载 AsyncOpenAI 客户端单例。调用前需确保 settings.openai_ready。"""
    global _client
    if _client is None:
        # 显式设置 timeout=20.0，覆盖 SDK 默认的 600s（10 分钟），
        # 避免网络抖动时 worker 与内存被长时间占用
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=20.0)
    return _client


async def recognize_dish(image_bytes: bytes) -> dict:
    """
    调用 GPT-4o Vision 识别菜品。

    Args:
        image_bytes: 图片二进制数据（JPEG）。

    Returns:
        识别结果字典，含 dishName / ingredients / cookingMethod / confidence / nutrition。
        confidence 统一覆盖为 0.9，标识来源为 GPT。

    Raises:
        AiAuthError: OPENAI_API_KEY 未配置或无效。
        AiQuotaError: 调用频率超限。
        AiProviderError: API 错误、JSON 解析失败或其他未知错误。
    """
    if not settings.openai_ready:
        raise AiAuthError('openai', 'OPENAI_API_KEY 未配置')

    client = _get_client()

    data_url = f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode()}"

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": _PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }],
            response_format={"type": "json_object"},
            timeout=20.0,
        )
    except openai.AuthenticationError:
        raise AiAuthError('openai', 'API Key 无效')
    except openai.RateLimitError:
        raise AiQuotaError('openai', '调用频率超限')
    except openai.APIError as e:
        raise AiProviderError('openai', f'API 错误: {str(e)}')
    except Exception as e:
        raise AiProviderError('openai', f'未知错误: {str(e)}')

    try:
        if not response.choices:
            raise AiProviderError('openai', 'OpenAI vision 返回空 choices')
        message = response.choices[0].message
        content = message.content
    except (IndexError, AttributeError) as e:
        raise AiProviderError('openai', f'OpenAI vision 响应解析失败: {e}')

    try:
        result = json.loads(content)
    except (json.JSONDecodeError, TypeError) as e:
        raise AiProviderError('openai', '响应格式错误，无法解析 JSON')

    # confidence 统一覆盖为 0.9（spec 要求，标识来自 GPT）
    result["confidence"] = _GPT_CONFIDENCE
    return result
