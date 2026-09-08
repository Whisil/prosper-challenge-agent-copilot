import json
from pathlib import Path

import pytest

from agent_builder import AgentBuilder


EXAMPLE_PATH = Path(__file__).parents[1] / "example_flow.json"


def load_example():
    return json.loads(EXAMPLE_PATH.read_text())


def test_legacy_example_builds():
    builder = AgentBuilder.from_json(EXAMPLE_PATH)

    assert builder.config.initial_node == "greeting"
    assert builder.build_initial_node()["name"] == "greeting"


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

    with pytest.raises(ValueError, match="End node"):
        AgentBuilder.from_dict(document)
