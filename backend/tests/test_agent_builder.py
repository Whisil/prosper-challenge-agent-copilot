import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from agent_builder import AgentBuilder
from agent_builder.builder import _validate_edge_arguments, _validate_runtime_guard
from agent_builder.schema import Edge, Node


EXAMPLE_PATH = Path(__file__).parents[1] / "example_flow.json"


def load_example():
    return json.loads(EXAMPLE_PATH.read_text())


def test_legacy_example_builds():
    builder = AgentBuilder.from_json(EXAMPLE_PATH)

    assert builder.config.initial_node == "greeting"
    assert builder.build_initial_node()["name"] == "greeting"


def test_every_runtime_node_includes_spoken_response_guidance():
    builder = AgentBuilder.from_json(EXAMPLE_PATH)

    messages = builder.build_initial_node()["task_messages"]

    assert messages[-1]["role"] == "developer"
    assert "Say times in plain words" in messages[-1]["content"]
    assert "2:00 PM" in messages[-1]["content"]


def test_versioned_document_uses_ids_and_types():
    document = load_example()
    document["version"] = 1
    document["id"] = "prosper_scheduler"
    document["revision"] = 2
    for node in document["nodes"]:
        node["id"] = node["name"]
        node["title"] = node["name"].replace("_", " ").title()
        node["type"] = "end" if node.get("end") else "conversation"
        for index, edge in enumerate(node.get("edges", [])):
            edge["id"] = f"{node['name']}-{index + 1}"
            edge["kind"] = "condition"

    builder = AgentBuilder.from_dict(document)

    assert builder.config.version == 1
    assert builder.config.nodes[-1].type == "end"


def test_invalid_target_is_rejected():
    document = load_example()
    document["nodes"][0]["edges"][0]["target"] = "missing"

    with pytest.raises(ValueError, match="unknown node"):
        AgentBuilder.from_dict(document)


def test_end_nodes_cannot_have_edges():
    document = load_example()
    document["nodes"][-1]["edges"] = [{"function": "restart", "description": "Restart", "target": "greeting"}]

    with pytest.raises(ValueError, match="Terminal node"):
        AgentBuilder.from_dict(document)


def test_transfer_nodes_are_terminal_and_branch_nodes_are_not_supported():
    document = load_example()
    document["nodes"][0]["type"] = "branch"
    document["nodes"][0]["branch"] = {"expression": "caller wants help"}
    with pytest.raises(ValueError, match="unsupported type"):
        AgentBuilder.from_dict(document)

    document = load_example()
    document["nodes"][-1]["type"] = "transfer"
    document["nodes"][-1]["end"] = True
    document["nodes"][-1]["transfer"] = {"reason": "Caller requested staff"}
    document["nodes"][-1]["edges"] = [{"function": "bad", "description": "Bad", "target": "greeting"}]
    with pytest.raises(ValueError, match="Terminal node"):
        AgentBuilder.from_dict(document)


def test_runtime_transition_arguments_enforce_required_types_and_enums():
    edge = Edge(function="select_time", description="Select an offered time.", target="done", properties={"slot": {"type": "string", "description": "Offered slot.", "enum": ["10 AM"]}}, required=["slot"])

    _validate_edge_arguments(edge, {"slot": "10 AM"})
    with pytest.raises(ValueError, match="requires 'slot'"):
        _validate_edge_arguments(edge, {})
    with pytest.raises(ValueError, match="must be one of"):
        _validate_edge_arguments(edge, {"slot": "4 PM"})


def test_confirmation_is_checked_using_the_current_transition_arguments():
    source = Node(name="confirm", type="conversation")
    target = Node(name="book", type="tool", tool={"name": "book", "description": "Book", "confirmationRequired": True})
    edge = Edge(function="book", description="Book after confirmation.", target="book", properties={"explicit_confirmation": {"type": "string", "description": "Confirmation."}}, required=["explicit_confirmation"])

    _validate_runtime_guard(source, target, edge, {}, {"explicit_confirmation": "yes"})
    with pytest.raises(ValueError, match="requires explicit confirmation"):
        _validate_runtime_guard(source, target, edge, {}, {"explicit_confirmation": "no"})


def _mock_tool_flow(with_success_edge: bool = True, result: dict | None = None):
    tool_edges = [
        {"id": "tool_to_done", "function": "tool_success", "description": "Use after success.", "target": "done", "properties": {}, "required": [], "kind": "success"},
        {"id": "tool_to_failure", "function": "tool_failure", "description": "Use after failure.", "target": "done", "properties": {}, "required": [], "kind": "failure"},
    ] if with_success_edge else []
    return {
        "name": "Tool flow", "initial_node": "start", "persona": "Be concise.",
        "nodes": [
            {"id": "start", "name": "start", "title": "Start", "type": "conversation", "task_messages": [{"role": "developer", "content": "Start."}], "edges": [{"id": "start_to_tool", "function": "run_tool", "description": "Run the tool.", "target": "tool", "properties": {}, "required": [], "kind": "condition"}]},
            {"id": "tool", "name": "tool", "title": "Tool", "type": "tool", "task_messages": [{"role": "developer", "content": "Run."}], "tool": {"name": "tool", "description": "Mock tool.", "confirmationRequired": False, "mockResult": result or {"booked": True}}, "edges": tool_edges},
            {"id": "done", "name": "done", "title": "Done", "type": "end", "end": True, "task_messages": [{"role": "developer", "content": "Done."}], "edges": []},
        ],
    }


def test_mock_tool_success_automatically_enters_the_success_target(monkeypatch):
    import control_api

    control_api._sessions.clear()
    control_api._sessions["session"] = {"id": "session", "status": "connected", "events": []}
    builder = AgentBuilder(AgentBuilder.from_dict(_mock_tool_flow()).config, runtime_session_id="session")
    start = builder.config.nodes[0]
    _result, next_node = asyncio.run(builder._make_edge_function(start, start.edges[0]).handler({}, SimpleNamespace(state={})))

    assert next_node["name"] == "done"
    assert [event["kind"] for event in control_api._sessions["session"]["events"]] == ["transition", "node_entered", "tool_call", "transition", "node_entered", "ended"]
    assert control_api._sessions["session"]["status"] == "completed"


def test_mock_tool_without_an_outcome_transition_fails_safely():
    import control_api

    control_api._sessions.clear()
    control_api._sessions["session"] = {"id": "session", "status": "connected", "events": []}
    builder = AgentBuilder(AgentBuilder.from_dict(_mock_tool_flow(False)).config, runtime_session_id="session")
    start = builder.config.nodes[0]

    with pytest.raises(ValueError, match="without a matching transition"):
        asyncio.run(builder._make_edge_function(start, start.edges[0]).handler({}, SimpleNamespace(state={})))

    assert control_api._sessions["session"]["status"] == "failed"
    assert control_api._sessions["session"]["events"][-1]["kind"] == "runtime_defect"


def test_mock_tool_failure_automatically_follows_its_failure_edge():
    import control_api

    control_api._sessions.clear()
    control_api._sessions["session"] = {"id": "session", "status": "connected", "events": []}
    builder = AgentBuilder(AgentBuilder.from_dict(_mock_tool_flow(result={"booked": False})).config, runtime_session_id="session")
    start = builder.config.nodes[0]
    _result, next_node = asyncio.run(builder._make_edge_function(start, start.edges[0]).handler({}, SimpleNamespace(state={})))

    assert next_node["name"] == "done"
    assert control_api._sessions["session"]["events"][3]["edgeId"] == "tool_to_failure"
