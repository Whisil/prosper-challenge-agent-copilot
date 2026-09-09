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
