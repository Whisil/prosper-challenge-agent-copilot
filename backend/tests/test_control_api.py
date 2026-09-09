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


def test_mark_runtime_completed_is_idempotent_for_the_explicit_session():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": []}

    control_api.mark_runtime_completed("one", "Reached a terminal step.", "complete", "Complete")
    control_api.mark_runtime_completed("one")

    assert control_api._sessions["one"]["status"] == "completed"
    assert [event["kind"] for event in control_api._sessions["one"]["events"]] == ["ended"]
    assert control_api._sessions["one"]["events"][0]["payload"]["isTerminal"] is True
    assert control_api._sessions["one"]["events"][0]["nodeId"] == "complete"


def test_terminal_initial_node_entry_is_marked_as_terminal_evidence():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "starting", "events": []}

    control_api.mark_runtime_connected("handoff", "one", node_title="Handoff", is_terminal=True)

    event = control_api._sessions["one"]["events"][0]
    assert control_api._sessions["one"]["status"] == "connected"
    assert event["kind"] == "node_entered"
    assert event["payload"]["isTerminal"] is True


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

    calls = []

    class FakeCompletions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(control_api, "OpenAI", FakeClient)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.6-luna")

    proposal = control_api.create_copilot_proposal({
        "document": document,
        "baseVersion": "scheduler-v1",
        "source": {"kind": "guideline", "text": "Keep the current behavior unless a concrete safety issue is found."},
    })

    assert proposal["status"] == "draft"
    assert proposal["operations"] == []
    assert proposal["baseVersion"] == "scheduler-v1"
    assert calls[0]["model"] == "gpt-5.6-luna"
    assert "temperature" not in calls[0]
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[0]["response_format"]["json_schema"]["strict"] is True
    request_context = json.loads(calls[0]["messages"][1]["content"])
    assert request_context["reference_index"]["edges"]
    assert request_context["current_agent_document"] == document
    assert {item["op"] for item in request_context["contract"]["operations"]} == set(control_api.ALLOWED_OPERATION_FIELDS)
    assert request_context["contract"]["stable_reference_fields"]["edgeId"]


def test_proposal_schema_closes_objects_and_requires_non_null_references():
    assert control_api.COPILOT_PROPOSAL_RESPONSE_SCHEMA["additionalProperties"] is False
    assert all(branch["additionalProperties"] is False for branch in control_api.OPERATION_SCHEMA["anyOf"])
    assert control_api.OPERATION_SCHEMA["anyOf"][1]["properties"]["nodeId"] == {"type": "string"}
    assert control_api.OPERATION_SCHEMA["anyOf"][3]["properties"]["sourceNodeId"] == {"type": "string"}
    assert control_api.OPERATION_SCHEMA["anyOf"][4]["properties"]["edgeId"] == {"type": "string"}
    assert "maxItems" not in control_api.NODE_SCHEMA["properties"]["edges"]


def test_missing_copilot_model_is_actionable(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def missing_model():
        raise RuntimeError("OPENAI_MODEL is not configured. Set it in backend/.env and restart the backend.")

    monkeypatch.setattr(control_api, "copilot_model", missing_model)
    with pytest.raises(RuntimeError, match="OPENAI_MODEL is not configured"):
        control_api._model_json("system", {}, control_api.COPILOT_PROPOSAL_RESPONSE_SCHEMA)


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

    with pytest.raises(ValueError, match="missing required fields"):
        control_api._validate_copilot_proposal(
            document,
            {"source": {"kind": "guideline", "text": "Review this behavior."}, "baseVersion": "v1"},
            {"diagnosis": {"category": "policy", "explanation": "", "confidence": 2}, "operations": []},
        )


def test_preview_document_is_available_to_runtime_session():
    control_api._sessions.clear()
    document = {"name": "Preview", "initial_node": "greeting", "persona": "Be helpful.", "nodes": [{"name": "greeting", "task_messages": [{"role": "developer", "content": "Greet."}], "edges": []}]}
    control_api._sessions["preview"] = {"id": "preview", "document": document}

    assert control_api.get_test_session_document("preview") == document


def _strict_document():
    return {
        "version": 1,
        "id": "scheduler",
        "revision": 1,
        "name": "Scheduler",
        "initial_node": "greeting",
        "persona": "Be safe.",
        "voice_id": "voice",
        "model": "model",
        "nodes": [
            {"id": "greeting", "name": "greeting", "title": "Greeting", "type": "conversation", "end": False, "task_messages": [{"role": "developer", "content": "Greet."}], "edges": [{"id": "greeting_to_done", "function": "finish", "description": "Use when done.", "target": "done", "properties": {}, "required": [], "kind": "condition"}]},
            {"id": "done", "name": "done", "title": "Done", "type": "end", "end": True, "task_messages": [{"role": "developer", "content": "Close."}], "edges": []},
        ],
    }


def _proposal_request(document):
    return {"document": document, "baseVersion": "v1", "source": {"kind": "guideline", "text": "Review this behavior."}}


def test_feedback_proposal_accepts_valid_typed_operation():
    document = _strict_document()
    proposal = {"diagnosis": {"category": "prompt", "explanation": "Add a clearer greeting.", "confidence": 0.8}, "operations": [{"op": "update_node", "nodeId": "greeting", "patch": {"task_messages": [{"role": "developer", "content": "Greet and ask how you can help."}]}}], "assumptions": [], "questions": [], "risks": [], "tests": []}
    result = control_api._validate_copilot_proposal(document, _proposal_request(document), proposal)
    assert result["operations"][0]["nodeId"] == "greeting"


def test_proposal_rejects_display_title_as_edge_target():
    document = _strict_document()
    operation = {"op": "add_edge", "sourceNodeId": "greeting", "edge": {"id": "bad", "function": "bad", "description": "Use it.", "target": "Done", "properties": {}, "required": [], "kind": "condition"}}
    with pytest.raises(ValueError, match="exact runtime name"):
        control_api._validate_copilot_operations(document, [operation])


def test_proposal_rejects_missing_edge_reference_with_available_ids():
    document = _strict_document()

    with pytest.raises(ValueError, match=r"operations\[0\]\.edgeId.*greeting_to_done"):
        control_api._validate_copilot_operations(document, [{"op": "update_edge", "edgeId": None, "patch": {"target": "done"}}])

    with pytest.raises(ValueError, match=r"operations\[0\]\.edgeId 'None'.*greeting_to_done"):
        control_api._validate_copilot_operations(document, [{"op": "update_edge", "edgeId": "None", "patch": {"target": "done"}}])


def test_proposal_accepts_complete_edges_on_an_added_node():
    document = _strict_document()
    proposed = {
        "id": "verify_identity",
        "name": "verify_identity",
        "title": "Verify Identity",
        "type": "conversation",
        "end": False,
        "task_messages": [{"role": "developer", "content": "Verify the caller."}],
        "edges": [{"id": "identity_to_availability", "function": "continue_booking", "description": "Use after verification.", "target": "done", "properties": {}, "required": [], "kind": "condition"}],
    }

    result = control_api._apply_copilot_operations(document, [
        {"op": "add_node", "node": proposed},
        {"op": "update_edge", "edgeId": "greeting_to_done", "patch": {"target": "verify_identity"}},
    ])
    assert result["nodes"][-1]["edges"][0]["id"] == "identity_to_availability"


def test_proposal_rejects_the_same_edge_nested_and_explicitly_added():
    document = _strict_document()
    proposed = {
        "id": "verify_identity",
        "name": "verify_identity",
        "title": "Verify Identity",
        "type": "conversation",
        "end": False,
        "task_messages": [{"role": "developer", "content": "Verify the caller."}],
        "edges": [{"id": "identity_to_done", "function": "continue_booking", "description": "Use after verification.", "target": "done", "properties": {}, "required": [], "kind": "condition"}],
    }
    operations = [
        {"op": "add_node", "node": proposed},
        {"op": "add_edge", "sourceNodeId": "verify_identity", "edge": {"id": "identity_to_done", "function": "continue_booking", "description": "Use after verification.", "target": "done", "properties": {}, "required": [], "kind": "condition"}},
    ]

    with pytest.raises(ValueError, match=r"Duplicate edge ID 'identity_to_done'"):
        control_api._validate_copilot_operations(document, operations)


def test_proposal_can_insert_a_node_using_one_explicit_new_edge():
    document = _strict_document()
    verify_identity = {
        "id": "verify_identity",
        "name": "verify_identity",
        "title": "Verify Identity",
        "type": "conversation",
        "end": False,
        "task_messages": [{"role": "developer", "content": "Verify the caller before discussing appointments."}],
        "edges": [],
    }
    operations = [
        {"op": "add_node", "node": verify_identity},
        {"op": "add_edge", "sourceNodeId": "verify_identity", "edge": {"id": "identity_to_done", "function": "continue_after_verification", "description": "Use after successful verification.", "target": "done", "properties": {}, "required": [], "kind": "condition"}},
        {"op": "update_edge", "edgeId": "greeting_to_done", "patch": {"target": "verify_identity"}},
    ]

    result = control_api._apply_copilot_operations(document, operations)
    assert result["nodes"][0]["edges"][0]["target"] == "verify_identity"
    assert result["nodes"][-1]["edges"][0]["id"] == "identity_to_done"


def test_proposal_rejects_unknown_node_type_and_protected_entry():
    document = _strict_document()
    bad_node = {"id": "new", "name": "new", "title": "New", "type": "random", "end": False, "task_messages": [{"role": "developer", "content": "Do."}], "edges": []}
    with pytest.raises(ValueError, match="unsupported type"):
        control_api._validate_copilot_operations(document, [{"op": "add_node", "node": bad_node}])
    with pytest.raises(ValueError, match="protected entry"):
        control_api._validate_copilot_operations(document, [{"op": "remove_node", "nodeId": "greeting"}])


def test_proposal_rejects_required_label_without_exact_property_key():
    document = _strict_document()
    operation = {"op": "add_edge", "sourceNodeId": "greeting", "edge": {"id": "collect", "function": "collect", "description": "Collect it.", "target": "done", "properties": {"patient_name": {"type": "string", "description": "Patient name."}}, "required": ["Patient Name"], "kind": "condition"}}
    with pytest.raises(ValueError, match="exact property keys"):
        control_api._validate_copilot_operations(document, [operation])


def test_generate_agent_endpoint_is_removed():
    assert not hasattr(control_api, "generate_agent")


def test_review_call_accepts_structured_result(monkeypatch):
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
        "status": "needs_attention",
        "summary": "Verification was skipped.",
        "issues": [{"title": "Missing verification", "explanation": "The flow disclosed availability too early.", "severity": "high", "nodeId": "offer_times", "edgeId": None}],
        "recommendedAction": "propose_changes",
    })))])

    calls = []

    class FakeCompletions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(control_api, "OpenAI", FakeClient)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.6-luna")
    result = control_api.review_call({"document": json.loads((Path(__file__).parents[1] / "example_flow.json").read_text()), "baseVersion": "v1", "call": {"id": "call-1", "events": []}})

    assert result["status"] == "needs_attention"
    assert result["issues"][0]["nodeId"] == "offer_times"
    assert result["issues"][0]["edgeId"] is None
    assert calls[0]["model"] == "gpt-5.6-luna"
    assert "temperature" not in calls[0]
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[0]["response_format"]["json_schema"]["strict"] is True
    review_context = json.loads(calls[0]["messages"][1]["content"])
    assert review_context["current_agent_document"]["nodes"]
    assert review_context["reference_index"]["nodes"]
