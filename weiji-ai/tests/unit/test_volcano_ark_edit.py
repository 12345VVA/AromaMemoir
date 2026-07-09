"""volcano_ark.edit_image 正向逻辑单测。

mock 掉 AsyncOpenAI 客户端与 httpx 下载，覆盖：
- key 缺失抛 AiAuthError
- url 返回 → 下载落盘 /static/ai_*
- b64_json 返回 → 解码落盘
- data[0] 为错误对象 → AiProviderError（如审核未通过）
- 生成图 URL 非火山系域名 → SSRF 白名单拦截

落盘隔离到 tmp_path（monkeypatch.chdir 自动恢复），避免污染仓库 static/。
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

import services.volcano_ark as va
from exceptions import AiAuthError, AiProviderError


# ============================================================
# helpers
# ============================================================
def _make_response(url=None, b64=None, error=None):
    """构造伪 images.generate 响应：data[0] 含 url / b64_json / error。"""
    item = MagicMock()
    item.url = url
    item.b64_json = b64
    item.error = error
    resp = MagicMock()
    resp.data = [item]
    return resp


def _mock_client(monkeypatch, response):
    """让 _get_client() 返回伪客户端，其 images.generate 返回 response。"""
    client = MagicMock()
    client.images.generate = AsyncMock(return_value=response)
    monkeypatch.setattr(va, '_get_client', lambda: client)


def _mock_download(monkeypatch, content=b'\xff\xd8img-bytes', content_type='image/jpeg'):
    """mock httpx.AsyncClient 的下载结果（url 路径用）。"""
    fake_resp = MagicMock()
    fake_resp.content = content
    fake_resp.headers = {'content-type': content_type}

    class _FakeAC:
        async def __aenter__(self_):
            return self_

        async def __aexit__(self_, *exc):
            return None

        async def get(self_, url):
            return fake_resp

    monkeypatch.setattr(va.httpx, 'AsyncClient', lambda **kw: _FakeAC())


def _enable_ark(monkeypatch):
    """让 settings.volcano_ark_ready 为 True（clean_env 已把 ARK_API_KEY 置空）。"""
    monkeypatch.setattr(va.settings, 'ARK_API_KEY', 'fake-key')


# ============================================================
# 测试
# ============================================================
@pytest.mark.asyncio
async def test_edit_image_key_missing_raises_auth_error(monkeypatch):
    monkeypatch.setattr(va.settings, 'ARK_API_KEY', None)
    with pytest.raises(AiAuthError):
        await va.edit_image('https://ark.volces.com/x.jpg', '美化')


@pytest.mark.asyncio
async def test_edit_image_url_path_persists(monkeypatch, tmp_path):
    _enable_ark(monkeypatch)
    monkeypatch.chdir(tmp_path)
    _mock_client(monkeypatch, _make_response(url='https://result.volces.com/out.jpg'))
    _mock_download(monkeypatch)

    result = await va.edit_image('https://ark.volces.com/in.jpg', '美化')

    assert result.startswith('/static/ai_') and result.endswith('.jpg')
    saved = list((tmp_path / 'static').glob('ai_*'))
    assert len(saved) == 1
    assert saved[0].stat().st_size > 0


@pytest.mark.asyncio
async def test_edit_image_b64_path_persists(monkeypatch, tmp_path):
    _enable_ark(monkeypatch)
    monkeypatch.chdir(tmp_path)
    _mock_client(monkeypatch, _make_response(b64='ZmFrZS1pbWFnZQ=='))  # b'fake-image'

    result = await va.edit_image('https://ark.volces.com/in.jpg', '美化')

    assert result.startswith('/static/ai_')
    saved = list((tmp_path / 'static').glob('ai_*'))
    assert len(saved) == 1
    assert saved[0].read_bytes() == b'fake-image'


@pytest.mark.asyncio
async def test_edit_image_error_object_raises(monkeypatch, tmp_path):
    _enable_ark(monkeypatch)
    monkeypatch.chdir(tmp_path)
    err = MagicMock()
    err.code = 'ContentFilterBlocked'
    _mock_client(monkeypatch, _make_response(error=err))

    with pytest.raises(AiProviderError) as exc:
        await va.edit_image('https://ark.volces.com/in.jpg', '美化')
    assert '图片生成失败' in str(exc.value)
    assert 'ContentFilterBlocked' in str(exc.value)


@pytest.mark.asyncio
async def test_edit_image_ssrf_url_blocked(monkeypatch, tmp_path):
    _enable_ark(monkeypatch)
    monkeypatch.chdir(tmp_path)
    _mock_client(monkeypatch, _make_response(url='https://evil.example.com/out.jpg'))

    with pytest.raises(AiProviderError) as exc:
        await va.edit_image('https://ark.volces.com/in.jpg', '美化')
    assert '白名单' in str(exc.value)
