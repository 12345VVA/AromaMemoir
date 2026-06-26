"""味记 AI 服务 - 端点集成测试（Task 8）。

依赖 Task 6 的 conftest.py：client fixture 提供 FastAPI TestClient，
autouse clean_env fixture 清空全部 12 个 AI 厂商环境变量并刷新 settings 单例，
确保每个测试运行在「无 key」环境，各端点走降级分支返回 mock 数据。
"""
import pytest
from fastapi.testclient import TestClient

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


def test_sticker_returns_mock(client: TestClient):
    res = client.post(
        '/ai/sticker',
        files={'image': ('test.jpg', b'fake-image', 'image/jpeg')},
    )
    assert res.status_code == 200
    data = res.json()
    assert data['code'] == 0
    # sticker 始终返回 mock，message 在 data 内
    assert '开发中' in data['data']['message']
