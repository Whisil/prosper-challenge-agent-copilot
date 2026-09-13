"""Backend configuration shared by the runtime and Copilot control API."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)


def copilot_model() -> str:
    model = os.getenv("OPENAI_MODEL", "").strip()
    if not model:
        raise RuntimeError("OPENAI_MODEL is not configured. Set it in backend/.env and restart the backend.")
    return model


def elevenlabs_tts_speed() -> float:
    """Return a deliberately unhurried voice speed within ElevenLabs' supported range."""
    raw_speed = os.getenv("ELEVENLABS_TTS_SPEED", "0.92").strip()
    try:
        speed = float(raw_speed)
    except ValueError as error:
        raise RuntimeError("ELEVENLABS_TTS_SPEED must be a number between 0.7 and 1.2.") from error
    if not 0.7 <= speed <= 1.2:
        raise RuntimeError("ELEVENLABS_TTS_SPEED must be between 0.7 and 1.2.")
    return speed
