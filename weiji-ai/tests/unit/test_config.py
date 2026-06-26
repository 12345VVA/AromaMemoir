import pytest
import os
from config import Settings, log_config_status
import config


def test_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv('BAIDU_API_KEY', 'test_baidu_key')
    monkeypatch.setenv('BAIDU_SECRET_KEY', 'test_baidu_secret')
    s = Settings()
    assert s.BAIDU_API_KEY == 'test_baidu_key'
    assert s.BAIDU_SECRET_KEY == 'test_baidu_secret'


def test_baidu_ready_requires_both_keys(monkeypatch):
    # 两个都有才 True
    monkeypatch.setenv('BAIDU_API_KEY', 'k')
    monkeypatch.setenv('BAIDU_SECRET_KEY', 's')
    assert Settings().baidu_ready is True
    # 缺 SECRET_KEY → False
    monkeypatch.delenv('BAIDU_SECRET_KEY', raising=False)
    assert Settings().baidu_ready is False
    # 两个都缺 → False
    monkeypatch.delenv('BAIDU_API_KEY', raising=False)
    assert Settings().baidu_ready is False
    # 只有 SECRET_KEY，无 API_KEY → False
    monkeypatch.setenv('BAIDU_SECRET_KEY', 's')
    assert Settings().baidu_ready is False


def test_qwen_ready_either_qwen_or_openai(monkeypatch):
    # QWEN 有即 True
    monkeypatch.setenv('QWEN_API_KEY', 'q')
    assert Settings().qwen_ready is True
    # 复用 OPENAI 亦 True
    monkeypatch.delenv('QWEN_API_KEY', raising=False)
    monkeypatch.setenv('OPENAI_API_KEY', 'o')
    assert Settings().qwen_ready is True
    # 两个都有 → True
    monkeypatch.setenv('QWEN_API_KEY', 'q')
    assert Settings().qwen_ready is True
    # 都没有 → False
    monkeypatch.delenv('QWEN_API_KEY', raising=False)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    assert Settings().qwen_ready is False


def test_other_ready_properties(monkeypatch):
    # openai_ready
    monkeypatch.setenv('OPENAI_API_KEY', 'o')
    assert Settings().openai_ready is True
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    assert Settings().openai_ready is False

    # volcano_ready：两个都有
    monkeypatch.setenv('VOLCANO_ACCESS_KEY', 'ak')
    monkeypatch.setenv('VOLCANO_SECRET_KEY', 'sk')
    assert Settings().volcano_ready is True
    monkeypatch.delenv('VOLCANO_SECRET_KEY', raising=False)
    assert Settings().volcano_ready is False

    # xfyun_ready：三个都有
    monkeypatch.setenv('XFYUN_APP_ID', 'id')
    monkeypatch.setenv('XFYUN_API_KEY', 'k')
    monkeypatch.setenv('XFYUN_API_SECRET', 's')
    assert Settings().xfyun_ready is True
    monkeypatch.delenv('XFYUN_API_SECRET', raising=False)
    assert Settings().xfyun_ready is False

    # tencent_ready：两个都有
    monkeypatch.setenv('TENCENT_SECRET_ID', 'id')
    monkeypatch.setenv('TENCENT_SECRET_KEY', 'sk')
    assert Settings().tencent_ready is True
    monkeypatch.delenv('TENCENT_SECRET_KEY', raising=False)
    assert Settings().tencent_ready is False


def test_log_config_status_no_key_value(monkeypatch, capsys):
    # 设置带明显特征值的 key，验证日志输出绝不泄露 key 值本身
    monkeypatch.setenv('BAIDU_API_KEY', 'SECRET_BAIDU_KEY_VALUE_12345')
    monkeypatch.setenv('BAIDU_SECRET_KEY', 'SECRET_BAIDU_SECRET_VALUE_67890')
    # 重建 settings 单例使其读到刚设的 key（clean_env 已替换过，这里再替换一次）
    monkeypatch.setattr(config, 'settings', config.Settings())

    log_config_status()
    captured = capsys.readouterr()

    # 绝不打印任何 key 值
    assert 'SECRET_BAIDU_KEY_VALUE_12345' not in captured.out
    assert 'SECRET_BAIDU_SECRET_VALUE_67890' not in captured.out
    # 应包含 INFO（baidu 已配置）或 WARNING（其他未配置）
    assert 'INFO' in captured.out or 'WARNING' in captured.out
    # WARNING 行应包含申请链接（未配置厂商会打印 URL）
    assert 'http' in captured.out
