import pytest
from exceptions import AiProviderError, AiAuthError, AiQuotaError, AiInvalidInputError


def test_provider_error_construction():
    e = AiProviderError('baidu', 'some error')
    assert e.provider == 'baidu'
    assert e.message == 'some error'
    assert '[baidu]' in str(e)


def test_auth_error_is_subclass():
    assert issubclass(AiAuthError, AiProviderError)


def test_quota_error_construction():
    e = AiQuotaError('openai', 'rate limited')
    assert e.provider == 'openai'
    assert isinstance(e, AiProviderError)


def test_invalid_input_error():
    e = AiInvalidInputError('volcano', 'bad image')
    assert e.provider == 'volcano'
    assert isinstance(e, AiProviderError)
