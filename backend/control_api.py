"""Local-only draft activation and test-session control for the Phase 1 demo."""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from agent_builder import AgentBuilder

STATE_DIR = Path(os.getenv("PROSPER_STATE_DIR", Path(__file__).parent / ".local"))
ACTIVE_DRAFT_PATH = STATE_DIR / "active_draft.json"
CONTROL_PORT = int(os.getenv("PROSPER_CONTROL_PORT", "8000"))
_lock = threading.RLock()
_sessions: dict[str, dict[str, Any]] = {}
_server: ThreadingHTTPServer | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/health":
            _json_response(self, 200, {"status": "ok"})
            return
        if self.path == "/api/draft":
            if not ACTIVE_DRAFT_PATH.exists():
                _json_response(self, 200, {"active": False, "fallback": "example_flow.json"})
                return
            _json_response(self, 200, {"active": True, "draft": json.loads(ACTIVE_DRAFT_PATH.read_text())})
            return
        if self.path.startswith("/api/test-sessions/"):
            session_id = self.path.rsplit("/", 1)[-1]
            with _lock:
                session = _sessions.get(session_id)
            if not session:
                _json_response(self, 404, {"error": "Test session not found."})
                return
            _json_response(self, 200, session)
            return
        _json_response(self, 404, {"error": "Not found."})

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/draft":
                builder = AgentBuilder.from_dict(payload)
                STATE_DIR.mkdir(parents=True, exist_ok=True)
                ACTIVE_DRAFT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
                _json_response(self, 200, {"active": True, "version": payload.get("version", 1), "agent": builder.config.name})
                return
            if self.path == "/api/test-sessions":
                session_id = uuid.uuid4().hex
                session = {"id": session_id, "draftVersion": str(payload.get("draftVersion", "unknown")), "status": "starting", "startedAt": _now(), "events": []}
                with _lock:
                    _sessions[session_id] = session
                _json_response(self, 201, session)
                return
            _json_response(self, 404, {"error": "Not found."})
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            _json_response(self, 400, {"error": str(error)})


def start_control_server() -> None:
    global _server
    if _server is not None:
        return
    _server = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), ControlHandler)
    threading.Thread(target=_server.serve_forever, daemon=True, name="prosper-control-api").start()


def _latest_starting_session() -> dict[str, Any] | None:
    with _lock:
        candidates = [session for session in _sessions.values() if session["status"] == "starting"]
        return max(candidates, key=lambda session: session["startedAt"]) if candidates else None


def record_runtime_event(kind: str, message: str, **payload: Any) -> None:
    with _lock:
        session = _latest_starting_session() or next((item for item in _sessions.values() if item["status"] == "connected"), None)
        if not session:
            return
        session["events"].append({"timestamp": _now(), "kind": kind, "message": message, "payload": payload})


def mark_runtime_connected(node_id: str) -> None:
    with _lock:
        session = _latest_starting_session()
        if not session:
            return
        session["status"] = "connected"
        session["events"].append({"timestamp": _now(), "kind": "node_entered", "nodeId": node_id, "message": "Entered initial node."})


def mark_runtime_completed() -> None:
    with _lock:
        session = next((item for item in _sessions.values() if item["status"] == "connected"), None)
        if not session:
            return
        session["status"] = "completed"
        session["endedAt"] = _now()
        session["events"].append({"timestamp": _now(), "kind": "ended", "message": "Browser session ended."})


def active_flow_path(fallback: Path) -> Path:
    return ACTIVE_DRAFT_PATH if ACTIVE_DRAFT_PATH.exists() else fallback
