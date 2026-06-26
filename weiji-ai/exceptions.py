"""
味记 AI 服务 - 异常体系

各 AI 厂商调用异常基类与细分异常，供 services/ 层抛出、main.py 层捕获并转统一响应。
"""


class AiProviderError(Exception):
    """AI 厂商调用异常基类"""

    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"[{provider}] {message}")


class AiAuthError(AiProviderError):
    """鉴权失败（key 缺失或无效）"""


class AiQuotaError(AiProviderError):
    """配额超限"""


class AiInvalidInputError(AiProviderError):
    """参数错误（如图片格式不支持）"""
