"""
味记 AI 服务 - pytest 公共配置。

提供：
- client:  FastAPI TestClient（不占真实端口）
- clean_env: autouse fixture，确保每个测试运行在「无 AI 厂商 key」环境，
             并重新构造 Settings 替换全局单例，使 *__ready 返回 False。

注意：config.settings 是模块级单例，在 import 时已读取环境变量。
      monkeypatch.delenv 不会影响已构造的 settings 实例，且各 service 模块
      使用 `from config import settings`，导入时已把 settings 绑定到各自命名空间。
      因此 clean_env 在清空环境变量后，重新构造 Settings 实例，并 monkeypatch
      替换 config / main / 各 service 模块中的 settings 引用，确保 service 层
      读 `settings.baidu_ready` 等时拿到的是字段全 None 的新实例。
"""
import pytest
from fastapi.testclient import TestClient

import config
import main as main_module
import services.baidu_vision as bv
import services.openai_vision as ov
import services.tencent_moderation as tm
import services.qwen_llm as ql
import services.volcano_ark as va
import services.volcano_tos as vt
import services.xfyun_asr as xa


# 各 service 模块已 `from config import settings` 绑定的 settings 引用，
# 需逐一替换（运行时函数查找的是各自模块命名空间里的 settings）
_SERVICE_MODULES = [bv, ov, tm, ql, va, vt, xa]

# 所有需要在测试时清空的 AI 厂商凭证环境变量
_AI_ENV_KEYS = [
    'BAIDU_API_KEY', 'BAIDU_SECRET_KEY',
    'OPENAI_API_KEY',
    'QWEN_API_KEY', 'QWEN_BASE_URL',
    'VOLCANO_ACCESS_KEY', 'VOLCANO_SECRET_KEY',
    'ARK_API_KEY', 'ARK_BASE_URL', 'ARK_MODEL_MULTIMODAL', 'ARK_MODEL_SEEDREAM',
    'XFYUN_APP_ID', 'XFYUN_API_KEY', 'XFYUN_API_SECRET',
    'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY',
]


@pytest.fixture
def client():
    """FastAPI TestClient，不占真实端口"""
    return TestClient(main_module.app)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """确保测试时无 AI 厂商 key（模拟无 key 环境），并刷新 settings 单例。"""
    for key in _AI_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)

    # 环境变量已清空，重新构造 Settings：__post_init__ 读 os.environ，字段全 None，
    # 故所有 *_ready property 返回 False，service 层走降级分支。
    new_settings = config.Settings()

    # 替换全局单例
    monkeypatch.setattr(config, 'settings', new_settings)
    # 替换 main 模块已绑定的 settings 引用
    monkeypatch.setattr(main_module, 'settings', new_settings, raising=False)
    # 替换各 service 模块已 `from config import settings` 绑定的引用
    for module in _SERVICE_MODULES:
        monkeypatch.setattr(module, 'settings', new_settings, raising=False)

    yield
