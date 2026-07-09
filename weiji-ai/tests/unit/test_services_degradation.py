import pytest
from exceptions import AiAuthError, AiProviderError
from services.baidu_vision import recognize_dish as baidu_recognize
from services.openai_vision import recognize_dish as openai_recognize
from services.tencent_moderation import check_image
from services.qwen_llm import recommend
from services.xfyun_asr import recognize


@pytest.mark.asyncio
async def test_baidu_key_missing_raises_auth_error():
    with pytest.raises(AiAuthError) as exc_info:
        await baidu_recognize(b'test')
    assert exc_info.value.provider == 'baidu'


@pytest.mark.asyncio
async def test_openai_key_missing_raises_auth_error():
    with pytest.raises(AiAuthError) as exc_info:
        await openai_recognize(b'test')
    assert exc_info.value.provider == 'openai'


async def test_tencent_key_missing_returns_true():
    # 容错优先，key 缺失返回 True（不抛错）
    result = await check_image(b'test')
    assert result is True


@pytest.mark.asyncio
async def test_qwen_key_missing_raises_auth_error():
    with pytest.raises(AiAuthError) as exc_info:
        await recommend('test')
    assert exc_info.value.provider == 'qwen'


@pytest.mark.asyncio
async def test_xfyun_key_missing_raises_auth_error():
    with pytest.raises(AiAuthError) as exc_info:
        await recognize(b'test')
    assert exc_info.value.provider == 'xfyun'
