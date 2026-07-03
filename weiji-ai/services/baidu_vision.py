"""
味记 AI 服务 - 百度 AI 菜品识别模块

封装百度 AI 平台 access_token 获取（带缓存）与菜品识别 v2 接口调用。
百度接口仅返回菜品名称与置信度，不返回食材/营养信息，留空由 GPT-4o 兜底补充。
"""
import base64
import time

import httpx

from config import settings
from exceptions import AiProviderError, AiAuthError, AiQuotaError


# access_token 缓存：避免每次调用都重新走 OAuth，提前 5 分钟刷新
_token_cache = {'token': None, 'expires_at': 0}


async def _get_access_token() -> str:
    """
    获取百度 AI 平台 access_token，带本地缓存。

    缓存有效（expires_at 晚于当前时间 + 5 分钟）时直接返回；
    否则发起 client_credentials OAuth 请求刷新并写入缓存。
    """
    # 缓存命中：剩余有效期 > 5 分钟
    if _token_cache['token'] and _token_cache['expires_at'] > time.time() + 300:
        return _token_cache['token']

    if not settings.baidu_ready:
        raise AiAuthError('baidu', 'BAIDU_API_KEY/SECRET_KEY 未配置')

    url = 'https://aip.baidubce.com/oauth/2.0/token'
    params = {
        'grant_type': 'client_credentials',
        'client_id': settings.BAIDU_API_KEY,
        'client_secret': settings.BAIDU_SECRET_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, params=params)
        resp.raise_for_status()
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError) as e:
        raise AiProviderError('baidu', f'OAuth 失败: {e}')

    if resp.status_code != 200:
        raise AiProviderError('baidu', f'获取 access_token 失败: {resp.status_code}')

    try:
        data = resp.json()
    except Exception as e:
        raise AiProviderError('baidu', f'OAuth 响应解析失败: {e}')
    token = data.get('access_token')
    expires_in = data.get('expires_in', 0)
    if not token:
        raise AiProviderError('baidu', 'OAuth 响应未返回 access_token')
    _token_cache['token'] = token
    # 提前 5 分钟刷新，避免临界过期
    _token_cache['expires_at'] = time.time() + expires_in - 300
    return token


async def recognize_dish(image_bytes: bytes) -> dict:
    """
    调用百度 AI 菜品识别 v2 接口，返回菜品信息 dict。

    返回格式与 main.py 现有 mock 对齐：
        {
            "dishName": "红烧牛肉面",
            "ingredients": [],        # 百度不返回，留空给 GPT-4o 兜底
            "cookingMethod": None,
            "confidence": 0.96,
            "nutrition": None,        # 百度不返回
        }

    异常：
        AiAuthError     key 未配置
        AiQuotaError    调用配额超限（百度 error_code 17/18）
        AiProviderError HTTP 非 200、网络异常、未识别到菜品等
    """
    token = await _get_access_token()

    url = 'https://aip.baidubce.com/rest/2.0/image-classify/v2/dish'
    data = {
        'access_token': token,
        'image': base64.b64encode(image_bytes).decode(),
        'top_num': 1,
        'BaiKeNum': 1,
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}

    try:
        resp = await httpx.AsyncClient().post(url, data=data, headers=headers)
    except (httpx.ConnectError, httpx.TimeoutException):
        raise AiProviderError('baidu', '网络连接失败')

    if resp.status_code != 200:
        raise AiProviderError('baidu', f'识别请求失败: {resp.status_code}')

    body = resp.json()

    # 配额超限：百度 error_code 17(日配额)/18(QPS) 均属配额类
    error_code = body.get('error_code')
    if error_code in (17, 18):
        raise AiQuotaError('baidu', '调用配额超限')

    result = body.get('result')
    if not result:
        raise AiProviderError('baidu', '未识别到菜品')

    item = result[0]
    name = item.get('name')
    probability = item.get('probability')
    if isinstance(probability, str):
        probability = float(probability)

    return {
        'dishName': name,
        'ingredients': [],        # 百度不返回食材信息，留空给 GPT-4o 兜底
        'cookingMethod': None,
        'confidence': probability,
        'nutrition': None,         # 百度不返回营养信息
    }
