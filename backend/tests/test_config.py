import pytest

from config import elevenlabs_tts_speed


def test_tts_speed_defaults_to_an_unhurried_voice(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_TTS_SPEED", raising=False)

    assert elevenlabs_tts_speed() == 0.92


@pytest.mark.parametrize("value", ["fast", "0.69", "1.21"])
def test_tts_speed_rejects_invalid_values(monkeypatch, value):
    monkeypatch.setenv("ELEVENLABS_TTS_SPEED", value)

    with pytest.raises(RuntimeError, match="ELEVENLABS_TTS_SPEED"):
        elevenlabs_tts_speed()
