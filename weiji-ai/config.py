"""
味记 AI 服务 - 配置模块

从环境变量读取各 AI 厂商凭证，缺失时不抛错（降级返回 mock 数据）。
注意：凭证由用户在运行环境中通过环境变量注入，绝不硬编码、不写入 .env 提交到 git。
"""
import os
from dataclasses import dataclass
from typing import Optional


# ============================================================
# 厂商申请链接常量
# ============================================================
PROVIDER_URLS = {
    'baidu': 'https://console.bce.baidu.com/ai',
    'openai': 'https://platform.openai.com/',
    'qwen': 'https://dashscope.console.aliyun.com/',
    'volcano': 'https://console.volcengine.com/ai',
    'xfyun': 'https://www.xfyun.cn/',
    'tencent': 'https://console.cloud.tencent.com/cms',
}

# 通义千问复用 OPENAI_API_KEY 时的默认 base_url
QWEN_DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'


@dataclass
class Settings:
    """
    AI 服务运行配置。

    所有字段在导入时从 os.environ 读取；缺失时为 None，不抛异常，
    由各 *_ready 属性判定是否可用，未就绪的厂商降级返回 mock 数据。
    """
    # 百度 AI 菜品识别
    BAIDU_API_KEY: Optional[str] = None
    BAIDU_SECRET_KEY: Optional[str] = None
    # OpenAI（GPT-4o Vision 兜底 + 通义千问复用）
    OPENAI_API_KEY: Optional[str] = None
    # 通义千问（可选，QWEN_API_KEY 缺失则复用 OPENAI_API_KEY）
    QWEN_API_KEY: Optional[str] = None
    QWEN_BASE_URL: Optional[str] = None
    # 火山引擎图片美化
    VOLCANO_ACCESS_KEY: Optional[str] = None
    VOLCANO_SECRET_KEY: Optional[str] = None
    # 讯飞语音识别
    XFYUN_APP_ID: Optional[str] = None
    XFYUN_API_KEY: Optional[str] = None
    XFYUN_API_SECRET: Optional[str] = None
    # 腾讯云图片审核
    TENCENT_SECRET_ID: Optional[str] = None
    TENCENT_SECRET_KEY: Optional[str] = None

    def __post_init__(self) -> None:
        self.BAIDU_API_KEY = os.environ.get('BAIDU_API_KEY')
        self.BAIDU_SECRET_KEY = os.environ.get('BAIDU_SECRET_KEY')
        self.OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
        self.QWEN_API_KEY = os.environ.get('QWEN_API_KEY')
        self.QWEN_BASE_URL = os.environ.get('QWEN_BASE_URL')
        self.VOLCANO_ACCESS_KEY = os.environ.get('VOLCANO_ACCESS_KEY')
        self.VOLCANO_SECRET_KEY = os.environ.get('VOLCANO_SECRET_KEY')
        self.XFYUN_APP_ID = os.environ.get('XFYUN_APP_ID')
        self.XFYUN_API_KEY = os.environ.get('XFYUN_API_KEY')
        self.XFYUN_API_SECRET = os.environ.get('XFYUN_API_SECRET')
        self.TENCENT_SECRET_ID = os.environ.get('TENCENT_SECRET_ID')
        self.TENCENT_SECRET_KEY = os.environ.get('TENCENT_SECRET_KEY')

    # ------------------------------------------------------------
    # 各厂商就绪判断
    # ------------------------------------------------------------
    @property
    def baidu_ready(self) -> bool:
        """百度 AI：API_KEY 和 SECRET_KEY 都有"""
        return bool(self.BAIDU_API_KEY and self.BAIDU_SECRET_KEY)

    @property
    def openai_ready(self) -> bool:
        """OpenAI：OPENAI_API_KEY 有"""
        return bool(self.OPENAI_API_KEY)

    @property
    def qwen_ready(self) -> bool:
        """通义千问：QWEN_API_KEY 有，或复用 OPENAI_API_KEY"""
        return bool(self.QWEN_API_KEY or self.OPENAI_API_KEY)

    @property
    def volcano_ready(self) -> bool:
        """火山引擎：ACCESS_KEY 和 SECRET_KEY 都有"""
        return bool(self.VOLCANO_ACCESS_KEY and self.VOLCANO_SECRET_KEY)

    @property
    def xfyun_ready(self) -> bool:
        """讯飞：APP_ID、API_KEY、API_SECRET 都有"""
        return bool(
            self.XFYUN_APP_ID
            and self.XFYUN_API_KEY
            and self.XFYUN_API_SECRET
        )

    @property
    def tencent_ready(self) -> bool:
        """腾讯云：SECRET_ID 和 SECRET_KEY 都有"""
        return bool(self.TENCENT_SECRET_ID and self.TENCENT_SECRET_KEY)


# ============================================================
# 模块级单例：导入时构造
# ============================================================
settings = Settings()


def log_config_status() -> None:
    """
    打印各 AI 厂商配置状态。

    已配置 -> INFO；缺失 -> WARNING 并附申请链接与降级提示。
    绝不打印任何 key 值本身。
    """
    status_map = {
        'baidu': settings.baidu_ready,
        'openai': settings.openai_ready,
        'qwen': settings.qwen_ready,
        'volcano': settings.volcano_ready,
        'xfyun': settings.xfyun_ready,
        'tencent': settings.tencent_ready,
    }
    for provider, ready in status_map.items():
        url = PROVIDER_URLS[provider]
        if ready:
            print(f"INFO: [AI 配置] {provider} 已配置")
        else:
            print(
                f"WARNING: [AI 配置] {provider} 未配置，"
                f"申请链接：{url}，将降级返回 mock 数据"
            )
