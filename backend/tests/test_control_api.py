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


def test_runtime_transcript_is_bounded_and_keeps_session_isolated():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": [], "transcript": []}
    control_api._sessions["two"] = {"id": "two", "status": "connected", "events": [], "transcript": []}

    control_api.record_runtime_transcript("user", "Hello", session_id="one", timestamp="2026-01-01T00:00:00Z")
    control_api.record_runtime_transcript("assistant", "Hi", session_id="one")
    control_api.record_runtime_transcript("user", "Wrong session", session_id="two")

    assert [turn["text"] for turn in control_api._sessions["one"]["transcript"]] == ["Hello", "Hi"]
    assert [turn["text"] for turn in control_api._sessions["two"]["transcript"]] == ["Wrong session"]

    control_api._sessions["one"]["transcript"] = []
    control_api.record_runtime_transcript("user", "x" * control_api.MAX_TRANSCRIPT_CHARS, session_id="one")
    control_api.record_runtime_transcript("user", "overflow", session_id="one")
    assert len(control_api._sessions["one"]["transcript"]) == 1
    assert len(control_api._sessions["one"]["transcript"][0]["text"]) == control_api.MAX_TRANSCRIPT_CHARS
    assert control_api._sessions["one"]["transcriptTruncated"] is True


def test_runtime_transcript_normalizes_pipecat_content_parts():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": [], "transcript": []}

    control_api.record_runtime_transcript("assistant", [{"text": "Tomorrow"}, {"content": " at 10."}], session_id="one")

    assert control_api._sessions["one"]["transcript"][0]["text"] == "Tomorrow at 10."


def test_runtime_transcript_uses_active_session_when_transport_has_no_session_id():
    control_api._sessions.clear()
    control_api._runtime_session_id = "one"
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": [], "transcript": []}

    control_api.record_runtime_transcript("user", "I want Wednesday.")

    assert control_api._sessions["one"]["transcript"][0]["text"] == "I want Wednesday."


def test_context_transcript_recovers_turns_without_duplicates():
    control_api._sessions.clear()
    control_api._runtime_session_id = "one"
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": [], "transcript": [{"role": "user", "text": "Hello"}]}

    control_api.record_runtime_context_transcript([
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "How can I help?"},
    ])
    control_api.record_runtime_context_transcript([
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "How can I help?"},
    ])

    assert [turn["text"] for turn in control_api._sessions["one"]["transcript"]] == ["Hello", "How can I help?"]


def test_mark_runtime_completed_is_idempotent_for_the_explicit_session():
    control_api._sessions.clear()
    control_api._sessions["one"] = {"id": "one", "status": "connected", "events": []}

    control_api.mark_runtime_completed("one", "Reached a terminal step.", "complete", "Complete")
    control_api.mark_runtime_completed("one")

    assert control_api._sessions["one"]["status"] == "completed"
    assert [event["kind"] for event in control_api._sessions["one"]["events"]] == ["ended"]
    assert control_api._sessions["one"]["events"][0]["payload"]["isTerminal"] is True
    assert control_api._sessions["one"]["events"][0]["nodeId"] == "complete"


def test_runtime_review_flags_a_successful_tool_without_a_success_transition():
    document = {
        "name": "Review", "initial_node": "tool", "persona": "Review.",
        "nodes": [
            {"id": "tool", "name": "tool", "title": "Book", "type": "tool", "task_messages": [{"role": "developer", "content": "Book."}], "tool": {"name": "book", "description": "Book", "confirmationRequired": False}, "edges": [{"id": "booking_to_complete", "function": "booking_success", "description": "Success.", "target": "done", "properties": {}, "required": [], "kind": "success"}]},
            {"id": "done", "name": "done", "title": "Done", "type": "end", "end": True, "task_messages": [{"role": "developer", "content": "Done."}], "edges": []},
        ],
    }
    issues = control_api._runtime_review_issues({"events": [{"kind": "tool_call", "nodeId": "tool", "payload": {"result": {"booked": True}}}, {"kind": "ended", "payload": {}}]}, document)

    assert issues[0]["resolutionType"] == "runtime_defect"
    assert issues[0]["edgeId"] == "booking_to_complete"


def test_runtime_defect_review_does_not_depend_on_the_ai_client(monkeypatch):
    document = {
        "name": "Review", "initial_node": "tool", "persona": "Review.",
        "nodes": [
            {"id": "tool", "name": "tool", "title": "Book", "type": "tool", "task_messages": [{"role": "developer", "content": "Book."}], "tool": {"name": "book", "description": "Book", "confirmationRequired": False}, "edges": [{"id": "booking_to_complete", "function": "booking_success", "description": "Success.", "target": "done", "properties": {}, "required": [], "kind": "success"}]},
            {"id": "done", "name": "done", "title": "Done", "type": "end", "end": True, "task_messages": [{"role": "developer", "content": "Done."}], "edges": []},
        ],
    }
    monkeypatch.setattr(control_api, "_model_json", lambda *args, **kwargs: pytest.fail("AI review should not run for a deterministic runtime defect"))

    review = control_api.review_call({"document": document, "baseVersion": "v1", "call": {"id": "call", "events": [{"kind": "tool_call", "nodeId": "tool", "payload": {"result": {"booked": True}}}, {"kind": "ended", "payload": {}}]}})

    assert review["recommendedAction"] == "report_development"
    assert review["issues"][0]["resolutionType"] == "runtime_defect"


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


def test_call_review_prompt_contains_transcript_checklist_and_validates_turn_references(monkeypatch):
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())
    call = {
        "id": "call-1",
        "status": "completed",
        "events": [],
        "transcript": [{"id": "turn-1", "role": "user", "text": "It is like water.", "timestamp": "2026-01-01T00:00:00Z"}],
    }
    model_payload = {
        "status": "needs_attention",
        "summary": "Verification was unclear.",
        "issues": [{
            "title": "Unclear verification",
            "explanation": "The caller did not provide the required value.",
            "severity": "high",
            "nodeId": "collect_details",
            "edgeId": None,
            "evidenceTurnIds": ["turn-1"],
            "observedBehavior": "The caller gave a nonsensical verification answer.",
            "expectedBehavior": "Ask for the exact verification information and stop if it is not provided.",
        }],
        "evidenceQuality": "trace_and_transcript",
        "recommendedAction": "propose_changes",
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

    review = control_api.review_call({"document": document, "baseVersion": "v1", "call": call})

    assert review["issues"][0]["evidenceTurnIds"] == ["turn-1"]
    assert "verification" in calls[0]["messages"][0]["content"].lower()
    request_context = json.loads(calls[0]["messages"][1]["content"])
    assert request_context["evidence"]["call"]["transcript"][0]["text"] == "It is like water."


def test_call_review_rejects_unknown_evidence_turn(monkeypatch):
    document = json.loads((Path(__file__).parents[1] / "example_flow.json").read_text())
    call = {"id": "call-1", "status": "completed", "events": [], "transcript": [{"id": "turn-1", "role": "user", "text": "Hello"}]}
    response = {"status": "needs_attention", "summary": "Issue", "issues": [{"title": "Issue", "explanation": "Evidence", "severity": "low", "nodeId": None, "edgeId": None, "evidenceTurnIds": ["missing"], "observedBehavior": "Observed", "expectedBehavior": "Expected"}], "evidenceQuality": "trace_and_transcript", "recommendedAction": "no_change"}

    monkeypatch.setattr(control_api, "_model_json", lambda *args, **kwargs: response)
    with pytest.raises(ValueError, match="evidenceTurnIds"):
        control_api.review_call({"document": document, "baseVersion": "v1", "call": call})


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


def test_historical_context_is_compact_and_limited_to_twenty_records():
    document = _strict_document()
    history = {
        "agentId": "scheduler",
        "records": [
            {
                "callId": f"call-{index}",
                "draftVersion": "scheduler-v1",
                "outcome": "completed",
                "summary": "A compact finding.",
                "reviewStatus": "needs_attention",
                "issues": [{"title": "Issue", "explanation": "Details", "severity": "high", "nodeId": "greeting"}],
                "decision": "accepted",
                "events": [{"kind": "node_entered", "message": "This must not be sent."}],
            }
            for index in range(25)
        ],
    }

    context = control_api._historical_context({"history": history}, document)

    assert context["agentId"] == "scheduler"
    assert len(context["records"]) == 20
    assert "events" not in context["records"][0]
    assert "current_agent_document" not in context["records"][0]
    assert context["records"][0]["issues"][0]["nodeId"] == "greeting"


def test_historical_context_ignores_records_for_another_agent():
    document = _strict_document()

    assert control_api._historical_context({"history": {"agentId": "another-agent", "records": [{"summary": "Other", "decision": "accepted"}]}}, document) is None


def test_accepted_edge_change_cannot_be_reversed_by_a_new_proposal():
    history = {
        "agentId": "scheduler",
        "records": [{
            "decision": "accepted",
            "acceptedChanges": [{"kind": "updated_edge", "id": "greeting_to_done", "beforeTarget": "done", "afterTarget": "verification"}],
        }],
    }

    with pytest.raises(ValueError, match="reverse an accepted change"):
        control_api._validate_historical_conflicts(
            [{"op": "update_edge", "edgeId": "greeting_to_done", "patch": {"target": "done"}}],
            history,
        )


def test_legitimate_change_on_an_accepted_edge_is_not_blocked():
    history = {
        "agentId": "scheduler",
        "records": [{
            "decision": "accepted",
            "acceptedChanges": [{"kind": "updated_edge", "id": "greeting_to_done", "beforeTarget": "done", "afterTarget": "verification"}],
        }],
    }

    control_api._validate_historical_conflicts(
        [{"op": "update_edge", "edgeId": "greeting_to_done", "patch": {"description": "Use after the caller is verified."}}],
        history,
    )


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


def test_trace_only_pass_is_reported_as_unavailable(monkeypatch):
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
        "status": "passed", "summary": "The path completed.", "issues": [], "recommendedAction": "no_change", "evidenceQuality": "trace_only",
    })))] )

    class FakeCompletions:
        def create(self, **kwargs):
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(control_api, "OpenAI", FakeClient)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.6-luna")
    result = control_api.review_call({"document": json.loads((Path(__file__).parents[1] / "example_flow.json").read_text()), "baseVersion": "v1", "call": {"id": "call-1", "events": []}})

    assert result["status"] == "unavailable"
    assert result["error"] == "Conversation transcript was not captured for this call."


def _suggested_fix_document():
    return {
        "version": 1,
        "id": "review-example",
        "revision": 1,
        "name": "Prosper Review Example",
        "initial_node": "caller_request",
        "persona": "Be concise.",
        "voice_id": "voice",
        "model": "model",
        "nodes": [
            {"id": "caller_request", "name": "caller_request", "title": "Caller Request", "type": "conversation", "end": False, "task_messages": [{"role": "developer", "content": "Ask what the caller needs."}], "edges": [{"id": "request_to_availability", "function": "book_appointment", "description": "Use for a booking request.", "target": "share_availability", "properties": {}, "required": [], "kind": "condition"}]},
            {"id": "share_availability", "name": "share_availability", "title": "Share Availability", "type": "conversation", "end": False, "task_messages": [{"role": "developer", "content": "Offer two appointment options."}], "edges": [{"id": "availability_to_complete", "function": "finish_booking", "description": "Use after the caller chooses.", "target": "booking_complete", "properties": {}, "required": [], "kind": "condition"}]},
            {"id": "booking_complete", "name": "booking_complete", "title": "Booking Complete", "type": "end", "end": True, "task_messages": [{"role": "developer", "content": "Confirm and end the call."}], "edges": []},
        ],
    }


def _suggested_fix_request(document, is_sample=False):
    return {
        "document": document,
        "baseVersion": "review-example-v1",
        "call": {"id": "sample-1", "isSample": is_sample, "events": []},
        "review": {"status": "needs_attention", "summary": "Availability was shared before verification.", "recommendedAction": "propose_changes", "issues": [], "reviewedAt": "2026-01-01T00:00:00Z"},
    }


def test_suggested_fix_prompt_contains_exact_references_and_strict_schema(monkeypatch):
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"diagnosis": "No safe change is justified.", "operations": [], "changes": ["Keep the current graph."]})))])
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
    document = _suggested_fix_document()

    result = control_api.create_suggested_fix(_suggested_fix_request(document))

    assert result["mode"] == "ai"
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[0]["response_format"]["json_schema"]["strict"] is True
    assert "temperature" not in calls[0]
    context = json.loads(calls[0]["messages"][1]["content"])
    assert context["current_agent_document"] == document
    assert {node["id"] for node in context["reference_index"]["nodes"]} == {"caller_request", "share_availability", "booking_complete"}
    assert context["reference_index"]["edges"][0]["id"] == "request_to_availability"
    assert {item["op"] for item in context["contract"]["operations"]} == {"add_node", "add_edge", "update_edge", "update_node"}
    assert context["contract"]["max_operations"] == 6


def test_suggested_fix_normalizes_nullable_strict_patch_fields(monkeypatch):
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
        "diagnosis": "Clarify the existing route.",
        "operations": [{"op": "update_edge", "edgeId": "request_to_availability", "patch": {"target": "share_availability", "description": None, "kind": None, "properties": None, "required": None}}],
        "changes": ["Keep the current target while the issue is reviewed."],
    })))])

    class FakeCompletions:
        def create(self, **kwargs):
            return response

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(control_api, "OpenAI", FakeClient)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.6-luna")

    result = control_api.create_suggested_fix(_suggested_fix_request(_suggested_fix_document()))

    assert result["operations"][0]["patch"] == {"target": "share_availability"}


def test_sample_suggested_fix_falls_back_to_actual_graph_ids(monkeypatch):
    monkeypatch.setattr(control_api, "_model_json", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("model unavailable")))
    document = _suggested_fix_document()

    result = control_api.create_suggested_fix(_suggested_fix_request(document, is_sample=True))

    assert result["mode"] == "sample_fallback"
    assert result["operations"][0]["node"]["id"] == "verify_identity"
    assert result["operations"][1] == {"op": "update_edge", "edgeId": "request_to_availability", "patch": {"target": "verify_identity"}}
    preview = control_api._apply_copilot_operations(document, result["operations"])
    assert preview["nodes"][0]["edges"][0]["target"] == "verify_identity"


def test_real_suggested_fix_rejects_unknown_edge_without_mutating(monkeypatch):
    response = {"diagnosis": "Change the route.", "operations": [{"op": "update_edge", "edgeId": "None", "patch": {"target": "share_availability"}}], "changes": ["Change the route."]}
    monkeypatch.setattr(control_api, "_model_json", lambda *args, **kwargs: response)
    document = _suggested_fix_document()

    with pytest.raises(RuntimeError, match="unknown"):
        control_api.create_suggested_fix(_suggested_fix_request(document))

    assert document["nodes"][0]["edges"][0]["target"] == "share_availability"
