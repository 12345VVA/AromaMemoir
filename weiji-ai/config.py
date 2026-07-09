"""
味记 AI 服务 - 配置模块

从环境变量读取各 AI 厂商凭证，缺失时不抛错（降级返回 mock 数据）。
注意：凭证由用户在运行环境中通过环境变量注入，绝不硬编码、不写入 .env 提交到 git。
"""
import os
from dataclasses import dataclass
from typing import Optional

# 测试环境：从 .env 加载密钥（生产环境从系统环境变量注入）
from dotenv import load_dotenv
_dotenv_loaded = load_dotenv()


# ============================================================
# 厂商申请链接常量
# ============================================================
PROVIDER_URLS = {
    'baidu': 'https://console.bce.baidu.com/ai',
    'openai': 'https://platform.openai.com/',
    'qwen': 'https://dashscope.console.aliyun.com/',
    'volcano': 'https://console.volcengine.com/ai',
    'volcano_ark': 'https://console.volcengine.com/ark',
    'volcano_tos': 'https://console.volcengine.com/tos',
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
    OPENAI_MODEL: Optional[str] = None
    # 通义千问（可选，QWEN_API_KEY 缺失则复用 OPENAI_API_KEY）
    QWEN_API_KEY: Optional[str] = None
    QWEN_BASE_URL: Optional[str] = None
    QWEN_MODEL: Optional[str] = None
    # 火山引擎图片美化
    VOLCANO_ACCESS_KEY: Optional[str] = None
    VOLCANO_SECRET_KEY: Optional[str] = None
    # 火山方舟 AI（首选能力）
    ARK_API_KEY: Optional[str] = None
    ARK_BASE_URL: Optional[str] = None
    ARK_MODEL_MULTIMODAL: Optional[str] = None
    ARK_MODEL_SEEDREAM: Optional[str] = None
    ARK_TIMEOUT: Optional[float] = None
    # 火山引擎 TOS 对象存储（图片中转）
    TOS_BUCKET: Optional[str] = None
    TOS_REGION: Optional[str] = None
    TOS_ENDPOINT: Optional[str] = None
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
        self.OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o')
        self.QWEN_API_KEY = os.environ.get('QWEN_API_KEY')
        self.QWEN_BASE_URL = os.environ.get('QWEN_BASE_URL')
        self.QWEN_MODEL = os.environ.get('QWEN_MODEL', 'qwen-turbo')
        self.VOLCANO_ACCESS_KEY = os.environ.get('VOLCANO_ACCESS_KEY')
        self.VOLCANO_SECRET_KEY = os.environ.get('VOLCANO_SECRET_KEY')
        self.ARK_API_KEY = os.environ.get('ARK_API_KEY')
        self.ARK_BASE_URL = os.environ.get(
            'ARK_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3'
        )
        self.ARK_MODEL_MULTIMODAL = os.environ.get(
            'ARK_MODEL_MULTIMODAL', 'ep-m-20260116220530-jzfsx'
        )
        self.ARK_MODEL_SEEDREAM = os.environ.get(
            'ARK_MODEL_SEEDREAM', 'ep-m-20260503112555-b4j8d'
        )
        # ark 请求超时秒数：多模态识别/生图耗时长，默认 120
        self.ARK_TIMEOUT = float(os.environ.get('ARK_TIMEOUT', '120'))
        self.TOS_BUCKET = os.environ.get('TOS_BUCKET', 'ark-auto-2103850221-cn-beijing-default')
        self.TOS_REGION = os.environ.get('TOS_REGION', 'cn-beijing')
        self.TOS_ENDPOINT = os.environ.get('TOS_ENDPOINT')  # 缺省由 tos 模块按 region 推导
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
    def volcano_ark_ready(self) -> bool:
        """火山方舟：ARK_API_KEY 有"""
        return bool(self.ARK_API_KEY)

    @property
    def tos_ready(self) -> bool:
        """TOS 对象存储：AK/SK + bucket 都有"""
        return bool(self.VOLCANO_ACCESS_KEY and self.VOLCANO_SECRET_KEY and self.TOS_BUCKET)

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
    if _dotenv_loaded:
        print("INFO: [AI 配置] 已从 .env 加载环境变量")
    else:
        print("INFO: [AI 配置] 未发现 .env，使用系统环境变量")

    status_map = {
        'volcano_ark': settings.volcano_ark_ready,
        'volcano_tos': settings.tos_ready,
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
