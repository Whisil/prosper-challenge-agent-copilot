import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import control_api


def test_runtime_events_use_the_explicit_session_id():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": []}
    control_api._sessions["two"] = {"id": "two", "status": "connected", "events": []}

    control_api.record_runtime_event("tool_call", "Tool used.", session_id="one")

    assert len(control_api._sessions["one"]["events"]) == 1
    assert control_api._sessions["two"]["events"] == []


def test_active_flow_path_uses_fallback_without_active_draft(tmp_path, monkeypatch):
    monkeypatch.setattr(control_api, "ACTIVE_DRAFT_PATH", tmp_path / "active_draft.json")
    fallback = tmp_path / "example_flow.json"

    assert control_api.active_flow_path(fallback) == fallback


def test_copilot_proposal_accepts_a_structured_no_change_response(monkeypatch):
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())
    model_payload = {
        "diagnosis": {"category": "policy", "explanation": "No change is needed.", "confidence": 0.9},
        "operations": [],
        "assumptions": [],
        "questions": [],
        "risks": [],
        "tests": [],
    }
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(model_payload)))])

    class FakeCompletions:
        def create(self, **kwargs):
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(control_api, "OpenAI", FakeClient)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    proposal = control_api.create_copilot_proposal({
        "document": document,
        "baseVersion": "scheduler-v1",
        "source": {"kind": "feedback", "text": "The call was clear enough."},
    })

    assert proposal["status"] == "draft"
    assert proposal["operations"] == []
    assert proposal["baseVersion"] == "scheduler-v1"


def test_copilot_rejects_protected_entry_node_operation():
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())

    with pytest.raises(ValueError, match="entry node"):
        control_api._validate_copilot_operations(document, [{"op": "remove_node", "nodeId": "greeting"}])


def test_copilot_rejects_unknown_operation():
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())

    with pytest.raises(ValueError, match="unsupported"):
        control_api._validate_copilot_operations(document, [{"op": "replace_document", "document": {}}])


def test_copilot_rejects_malformed_diagnosis():
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())

    with pytest.raises(ValueError, match="missing a diagnosis"):
        control_api._validate_copilot_proposal(
            document,
            {"source": {"kind": "feedback", "text": "Review this call."}, "baseVersion": "v1"},
            {"diagnosis": {"category": "policy", "explanation": "", "confidence": 2}, "operations": []},
        )


def test_preview_document_is_available_to_runtime_session():
    control_api._sessions.clear()
    document = {"name": "Preview", "initial_node": "greeting", "persona": "Be helpful.", "nodes": [{"name": "greeting", "task_messages": [{"role": "developer", "content": "Greet."}], "edges": []}]}
    control_api._sessions["preview"] = {"id": "preview", "document": document}

    assert control_api.get_test_session_document("preview") == document
