"""
味记 AI 服务 - 火山引擎 TOS 对象存储模块

将用户上传的图片上传到 TOS 桶，返回可访问 URL。
豆包多模态模型要求传入图片 URL（不能直接传 base64），
因此调用豆包前先经本模块上传图片到 TOS 获取 URL。
"""
import asyncio
import logging
import uuid
from io import BytesIO

import tos

from config import settings
from exceptions import AiProviderError, AiAuthError

logger = logging.getLogger(__name__)

# 火山引擎 TOS 默认 endpoint（按 region 推导）
_DEFAULT_ENDPOINTS = {
    'cn-beijing': 'tos-cn-beijing.volces.com',
}


def _resolve_endpoint() -> str:
    """根据 settings 推导 TOS endpoint。"""
    if settings.TOS_ENDPOINT:
        return settings.TOS_ENDPOINT
    region = settings.TOS_REGION or 'cn-beijing'
    return _DEFAULT_ENDPOINTS.get(region, f'tos-{region}.volces.com')


async def upload_image(image_bytes: bytes, ext: str = 'jpg') -> str:
    """
    上传图片字节流到 TOS，返回可访问 URL。

    参数:
        image_bytes: 图片字节流
        ext: 图片扩展名（不含点），默认 'jpg'

    返回:
        上传成功后的可访问 URL，格式 https://<bucket>.<endpoint>/<key>，
        例如 https://ark-auto-2103850221-cn-beijing-default.tos-cn-beijing.volces.com/weiji-ai/xxx.jpg

    异常:
        AiAuthError: AK/SK 或 TOS_BUCKET 未配置时抛出
        AiProviderError: 上传失败（网络、权限、服务端错误等）时抛出

    说明:
        tos SDK 为同步接口，通过 asyncio.get_running_loop().run_in_executor
        包装为异步调用，避免阻塞事件循环。异常向上透传由 main.py 决定降级。
    """
    ak = settings.VOLCANO_ACCESS_KEY
    sk = settings.VOLCANO_SECRET_KEY
    bucket = settings.TOS_BUCKET
    if not ak or not sk or not bucket:
        raise AiAuthError(
            'volcano_tos',
            'VOLCANO_ACCESS_KEY/SECRET_KEY 或 TOS_BUCKET 未配置',
        )

    region = settings.TOS_REGION or 'cn-beijing'
    endpoint = _resolve_endpoint()
    # 用 uuid 生成对象 key，避免覆盖已有对象
    safe_ext = (ext or 'jpg').lstrip('.').lower() or 'jpg'
    key = f"weiji-ai/{uuid.uuid4().hex}.{safe_ext}"
    url = f"https://{bucket}.{endpoint}/{key}"

    def _do_upload() -> None:
        """同步执行 TOS 上传（在 executor 线程中调用）。"""
        client = tos.TosClientV2(ak, sk, endpoint, region)
        # 显式设置公共读 ACL，否则对象默认私有，
        # 豆包服务端拉取图片会 403 → 识别失败 → 整体降级
        # tos SDK 的 acl 参数要求传 ACLType 枚举，不能用字符串
        client.put_object(bucket, key, content=BytesIO(image_bytes), acl=tos.ACLType.ACL_Public_Read)

    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _do_upload)
    except Exception as exc:
        # 涵盖 tos.exceptions.TosClientError / TosServerError 及网络异常等
        logger.error("火山引擎 TOS 上传失败: key=%s, error=%s", key, exc)
        raise AiProviderError('volcano_tos', f'上传失败: {exc}') from exc

    logger.info("火山引擎 TOS 上传成功: key=%s", key)
    return url
