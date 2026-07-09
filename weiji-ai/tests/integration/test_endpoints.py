"""味记 AI 服务 - 端点集成测试（Task 8）。

依赖 Task 6 的 conftest.py：client fixture 提供 FastAPI TestClient，
autouse clean_env fixture 清空全部 12 个 AI 厂商环境变量并刷新 settings 单例，
确保每个测试运行在「无 key」环境，各端点走降级分支返回 mock 数据。
"""
import pytest
from fastapi.testclient import TestClient

import main as main_module

# conftest 的 clean_env 已确保无 key 环境


def test_health(client: TestClient):
    res = client.get('/health')
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'ok'
    assert data['service'] == 'weiji-ai'


def test_recognize_degrades_without_key(client: TestClient):
    # multipart 上传假图片
    res = client.post(
        '/ai/recognize',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    assert data['data'].get('dishName')
    assert '未配置' in data['message'] or '演示数据' in data['message']


def test_beautify_degrades_without_key(client: TestClient):
    res = client.post(
        '/ai/beautify',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    assert '/static/' in data['data']['beautifiedUrl']
    assert '/static/' in data['data']['originalUrl']
    # 降级 message 在 data 内（ok() 未传顶层 message）
    assert '未配置' in data['data']['message'] or '原图' in data['data']['message']


def test_recommend_degrades_without_key(client: TestClient):
    res = client.post('/ai/recommend', json={'dishName': '红烧牛肉面'})
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    assert 'recipes' in data['data']
    assert len(data['data']['recipes']) >= 1
    assert '未配置' in data['message'] or '示例' in data['message']


def test_voice_recognize_degrades_without_key(client: TestClient):
    res = client.post(
        '/ai/voice/recognize',
        files={'audio': ('test.wav', b'fake-audio', 'audio/wav')},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    assert data['data']['text'] == ''
    # 降级 message 在 data 内（ok() 未传顶层 message）
    assert '未配置' in data['data']['message'] or '不可用' in data['data']['message']


def test_sticker_degrades_without_key(client: TestClient):
    res = client.post(
        '/ai/sticker',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    # 无 key 时降级返回占位图，message 在 data 内
    assert data['data']['stickerUrl'] == 'assets/sticker-generated.png'
    assert '占位图' in data['data']['message']


def _force_tencent_ready(monkeypatch):
    """配置腾讯云 key 使 settings.tencent_ready 为 True，便于测审核分支。"""
    monkeypatch.setattr(main_module.settings, 'TENCENT_SECRET_ID', 'fake')
    monkeypatch.setattr(main_module.settings, 'TENCENT_SECRET_KEY', 'fake')


def test_beautify_blocks_non_compliant_image(client: TestClient, monkeypatch):
    _force_tencent_ready(monkeypatch)

    async def _block(_bytes):
        return False

    monkeypatch.setattr(main_module, 'tencent_check', _block)
    res = client.post(
        '/ai/beautify',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    data = res.json()
    assert data['code'] != 0
    assert '不合规' in data['message']


def test_sticker_blocks_non_compliant_image(client: TestClient, monkeypatch):
    _force_tencent_ready(monkeypatch)

    async def _block(_bytes):
        return False

    monkeypatch.setattr(main_module, 'tencent_check', _block)
    res = client.post(
        '/ai/sticker',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    data = res.json()
    assert data['code'] != 0
    assert '不合规' in data['message']


# ============================================================
# Task 2: CORS 白名单
# ============================================================
def test_cors_whitelisted_origin_echoed(client: TestClient):
    # 白名单 Origin 应在响应头回显 access-control-allow-origin
    res = client.get('/health', headers={'Origin': 'http://localhost:17900'})
    assert res.status_code == 200
    assert res.headers.get('access-control-allow-origin') == 'http://localhost:17900'


def test_cors_non_whitelisted_origin_not_echoed(client: TestClient):
    # 非白名单 Origin 不应回显
    res = client.get('/health', headers={'Origin': 'https://evil.example.com'})
    assert res.status_code == 200
    assert res.headers.get('access-control-allow-origin') != 'https://evil.example.com'


# ============================================================
# Task 13: /static 访问限制
# ============================================================
def test_static_no_referer_returns_403(client: TestClient):
    # 无 Referer 访问 /static 应被中间件拦截为 403
    res = client.get('/static/nonexistent.jpg')
    assert res.status_code == 403


def test_static_whitelisted_referer_passes_middleware(client: TestClient):
    # 白名单 Referer 不被中间件拦截（文件不存在返回 404，关键是未被 403 拦截）
    res = client.get(
        '/static/nonexistent.jpg',
        headers={'Referer': 'http://localhost:17900/'},
    )
    assert res.status_code != 403
