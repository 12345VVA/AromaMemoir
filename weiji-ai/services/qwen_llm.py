"""
味记 AI 服务 - 通义千问菜谱推荐模块

基于用户最近记录的菜品，调用通义千问（qwen-turbo，OpenAI 兼容协议）推荐 3 道搭配菜谱。
模块级懒加载 AsyncOpenAI 客户端单例，避免全局状态在导入期创建连接。

凭证降级：QWEN_API_KEY 缺失但 OPENAI_API_KEY 存在时，复用 OPENAI_API_KEY
并使用通义千问 OpenAI 兼容模式默认 base_url。
"""
import json

import openai
from openai import AsyncOpenAI

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError


# 模块级懒加载客户端单例
_client: AsyncOpenAI | None = None

# 推荐菜谱 prompt 模板（{{ }} 经 str.format 渲染为 JSON 单花括号）
_PROMPT_TEMPLATE = """你是营养师和美食推荐专家。用户最近记录的菜品是「{dish_name}」，{recent_context}请基于这道菜推荐 3 道搭配合理的菜谱，要求营养均衡、口味搭配。

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
    """懒加载 AsyncOpenAI 客户端单例。调用前需确保 settings.qwen_ready。"""
    global _client
    if _client is None:
        api_key = settings.QWEN_API_KEY or settings.OPENAI_API_KEY
        base_url = settings.QWEN_BASE_URL or 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        # 显式设置 timeout=20.0，覆盖 SDK 默认的 600s（10 分钟），
        # 避免网络抖动时 worker 与内存被长时间占用
        _client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=20.0)
    return _client


async def recommend(dish_name: str, recent_records: list = None) -> list:
    """
    调用通义千问推荐搭配菜谱。

    Args:
        dish_name: 用户最近记录的菜品名。
        recent_records: 最近还记录过的菜品名列表（可选），用于丰富推荐上下文。

    Returns:
        长度为 3 的菜谱列表，每项为 dict，含 id / name / category /
        difficulty / cookTime / reason / matchScore 字段。

    Raises:
        AiAuthError: QWEN_API_KEY 与 OPENAI_API_KEY 均未配置，或 API Key 无效。
        AiQuotaError: 调用频率超限。
        AiProviderError: API 错误、响应非 JSON、格式不符合预期或其他未知错误。
    """
    if not settings.qwen_ready:
        raise AiAuthError('qwen', 'QWEN_API_KEY 或 OPENAI_API_KEY 未配置')

    client = _get_client()

    if recent_records:
        recent_context = f"最近还记录过：{'、'.join(recent_records)}。"
    else:
        recent_context = ""

    prompt = _PROMPT_TEMPLATE.format(dish_name=dish_name, recent_context=recent_context)

    try:
        response = await client.chat.completions.create(
            model="qwen-turbo",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            timeout=20.0,
        )
    except openai.AuthenticationError:
        raise AiAuthError('qwen', 'API Key 无效')
    except openai.RateLimitError:
        raise AiQuotaError('qwen', '调用频率超限')
    except openai.APIError as e:
        raise AiProviderError('qwen', f'API 错误: {str(e)}')
    except Exception as e:
        raise AiProviderError('qwen', f'未知错误: {str(e)}')

    try:
        if not response.choices:
            raise AiProviderError('qwen', '通义千问返回空 choices')
        content = response.choices[0].message.content
        data = json.loads(content)
    except (IndexError, AttributeError) as e:
        raise AiProviderError('qwen', f'通义千问响应解析失败: {e}')
    except (json.JSONDecodeError, TypeError):
        raise AiProviderError('qwen', '响应非 JSON')

    recipes = data.get('recipes') if isinstance(data, dict) else None
    if not isinstance(recipes, list) or len(recipes) < 3:
        raise AiProviderError('qwen', '响应格式不符合预期')

    return recipes
