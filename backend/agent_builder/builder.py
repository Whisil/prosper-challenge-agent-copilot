#
# AgentBuilder — loads a declarative agent (JSON / dict) and compiles its node
# graph into Pipecat Flows objects.
#
#   JSON  ->  AgentConfig (validated)  ->  Pipecat Flows NodeConfig graph
#
# This is the seam between "agent as data" (what the Phase 2 Composer produces)
# and "agent as a running conversation" (what bot.py executes). Keeping the
# compile + validation here means bot.py never touches the graph internals.
#

import json
from pathlib import Path
from typing import Union

from loguru import logger
from pipecat_flows import FlowManager, FlowsFunctionSchema, NodeConfig

from .schema import AgentConfig, Edge, Node


def _validate_edge_arguments(edge: Edge, args: dict) -> None:
    """Keep function-call arguments inside the transition's declared contract."""
    if not isinstance(args, dict):
        raise ValueError(f"Transition '{edge.function}' received invalid arguments.")
    for field in edge.required:
        if field not in args:
            raise ValueError(f"Transition '{edge.function}' requires '{field}'.")
    for name, value in args.items():
        prop = edge.properties.get(name)
        if not prop:
            raise ValueError(f"Transition '{edge.function}' received unsupported field '{name}'.")
        expected = prop.get("type")
        valid_type = {
            "string": isinstance(value, str),
            "number": isinstance(value, (int, float)) and not isinstance(value, bool),
            "integer": isinstance(value, int) and not isinstance(value, bool),
            "boolean": isinstance(value, bool),
        }.get(expected, False)
        if not valid_type:
            raise ValueError(f"Transition '{edge.function}' field '{name}' must be a {expected}.")
        if prop.get("enum") and value not in prop["enum"]:
            allowed = ", ".join(str(item) for item in prop["enum"])
            raise ValueError(f"Transition '{edge.function}' field '{name}' must be one of: {allowed}.")


def _confirmed(value: object) -> bool:
    return isinstance(value, str) and value.strip().lower() in {"yes", "y", "confirm", "confirmed", "i confirm"}


def _validate_runtime_guard(source_node: Node, target_node: Node, edge: Edge, state: dict, args: dict) -> None:
    state_with_arguments = {**state, **args}
    if target_node.type == "tool" and target_node.tool and target_node.tool.get("confirmationRequired"):
        confirmation = state_with_arguments.get("explicit_confirmation") or state_with_arguments.get("confirmation")
        if not _confirmed(confirmation):
            raise ValueError(f"The {target_node.tool.get('name', target_node.name)} action requires explicit confirmation before it can run.")
    if source_node.type == "tool" and edge.kind == "success":
        result = state.get("last_tool_result")
        if isinstance(result, dict) and any(result.get(key) is False for key in ("success", "booked", "available")):
            raise ValueError(f"The {source_node.tool.get('name', source_node.name) if source_node.tool else source_node.name} action reported failure and cannot use a success transition.")
    if source_node.type == "tool" and edge.kind == "failure":
        result = state.get("last_tool_result")
        if isinstance(result, dict) and any(result.get(key) is True for key in ("success", "booked", "available")):
            raise ValueError(f"The {source_node.tool.get('name', source_node.name) if source_node.tool else source_node.name} action reported success and cannot use a failure transition.")


class AgentBuilder:
    """Builds a runnable Pipecat Flows graph from a declarative AgentConfig."""

    def __init__(self, config: AgentConfig, runtime_session_id: str | None = None):
        self.config = config
        self.runtime_session_id = runtime_session_id
        self._nodes_by_name = {n.name: n for n in config.nodes}
        self._validate()

    # ---- loading -----------------------------------------------------------
    @classmethod
    def from_dict(cls, data: dict) -> "AgentBuilder":
        return cls(AgentConfig.from_dict(data))

    @classmethod
    def from_json(cls, path: Union[str, Path]) -> "AgentBuilder":
        data = json.loads(Path(path).read_text())
        return cls.from_dict(data)

    # ---- validation --------------------------------------------------------
    def _validate(self) -> None:
        if len(self._nodes_by_name) != len(self.config.nodes):
            raise ValueError("Agent node IDs must be unique.")
        node_ids = [node.id or node.name for node in self.config.nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("Agent stable node IDs must be unique.")
        names = set(self._nodes_by_name)
        if not names:
            raise ValueError("Agent has no nodes.")
        if self.config.initial_node not in names:
            raise ValueError(
                f"initial_node '{self.config.initial_node}' is not a defined node."
            )
        all_edge_ids: set[str] = set()
        for node in self.config.nodes:
            node_type = node.type or ("end" if node.end else "conversation")
            if node_type not in {"conversation", "tool", "transfer", "end"}:
                raise ValueError(f"Node '{node.name}' has unsupported type '{node_type}'.")
            if node_type in {"end", "transfer"} and node.edges:
                raise ValueError(f"Terminal node '{node.name}' cannot have outgoing edges.")
            if not node.task_messages or any(not isinstance(message, dict) or not isinstance(message.get("content"), str) or not message["content"].strip() for message in node.task_messages):
                raise ValueError(f"Node '{node.name}' needs non-empty task instructions.")
            if node_type == "tool" and (not node.tool or not isinstance(node.tool.get("name"), str) or not node.tool["name"].strip() or not isinstance(node.tool.get("description"), str) or not node.tool["description"].strip()):
                raise ValueError(f"Tool node '{node.name}' needs a name and description.")
            if node_type == "tool" and "confirmationRequired" not in node.tool:
                raise ValueError(f"Tool node '{node.name}' needs confirmation metadata.")
            if node_type == "transfer" and not (node.transfer or {}).get("reason"):
                raise ValueError(f"Transfer node '{node.name}' needs a handoff reason.")
            if node_type == "transfer" and not node.end:
                raise ValueError(f"Transfer node '{node.name}' must be terminal.")
            if node_type == "end" and not node.end:
                raise ValueError(f"End node '{node.name}' must be terminal.")
            edge_functions = set()
            edge_ids = set()
            for edge in node.edges:
                if edge.id:
                    if edge.id in edge_ids or edge.id in all_edge_ids:
                        raise ValueError(f"Duplicate edge ID '{edge.id}' in node '{node.name}'.")
                    edge_ids.add(edge.id)
                    all_edge_ids.add(edge.id)
                if edge.kind and edge.kind not in {"condition", "success", "failure"}:
                    raise ValueError(f"Edge '{edge.function}' in node '{node.name}' has an unsupported kind.")
                if edge.function in edge_functions:
                    raise ValueError(f"Duplicate edge function '{edge.function}' in node '{node.name}'.")
                edge_functions.add(edge.function)
                if edge.target not in names:
                    raise ValueError(
                        f"Edge '{edge.function}' in node '{node.name}' targets "
                        f"unknown node '{edge.target}'."
                    )
                if not isinstance(edge.properties, dict) or not isinstance(edge.required, list):
                    raise ValueError(f"Transition '{edge.function}' must define properties and required fields.")
                if any(not isinstance(name, str) or not name.strip() or not isinstance(prop, dict) or prop.get("type") not in {"string", "number", "integer", "boolean"} or not isinstance(prop.get("description"), str) or not prop["description"].strip() for name, prop in edge.properties.items()):
                    raise ValueError(f"Transition '{edge.function}' contains an invalid property definition.")
                if any(not isinstance(prop.get("enum"), list) or not prop["enum"] or not all(isinstance(value, str) for value in prop["enum"])
                       for prop in edge.properties.values() if isinstance(prop, dict) and "enum" in prop):
                    raise ValueError(f"Transition '{edge.function}' contains an invalid enum definition.")
                if any(not isinstance(name, str) or name not in edge.properties for name in edge.required):
                    raise ValueError(f"Transition '{edge.function}' required fields must match property keys.")

    # ---- compilation -------------------------------------------------------
    def build_initial_node(self) -> NodeConfig:
        """Return the entry NodeConfig; downstream nodes are built lazily on transition."""
        return self._make_node(self._nodes_by_name[self.config.initial_node])

    def _make_node(self, node: Node) -> NodeConfig:
        node_config: NodeConfig = {
            "name": node.name,
            "role_message": node.role_message or self.config.persona,
            "task_messages": node.task_messages,
            "functions": [self._make_edge_function(node, edge) for edge in node.edges],
        }
        if node.pre_actions:
            node_config["pre_actions"] = node.pre_actions
        # Explicit post_actions win; otherwise a terminal node ends the call.
        if node.post_actions:
            node_config["post_actions"] = node.post_actions
        elif node.end:
            node_config["post_actions"] = [{"type": "end_conversation"}]
        return node_config

    def _record_transition(self, source: Node, edge: Edge, target: Node, args: dict) -> None:
        from control_api import mark_runtime_completed, record_runtime_event

        record_runtime_event("transition", f"The caller moved from {source.title or source.name} to {target.title or target.name}.", session_id=self.runtime_session_id, node_id=source.id or source.name, edge_id=edge.id, sourceNodeId=source.id or source.name, edgeId=edge.id, target=edge.target, sourceTitle=source.title or source.name, transitionName=edge.function, targetNodeId=target.id or target.name, targetTitle=target.title or target.name, collectedFields=args)
        record_runtime_event("node_entered", f"The agent moved to {target.title or target.name}.", session_id=self.runtime_session_id, node_id=target.id or target.name, nodeTitle=target.title or target.name, nodeType=target.type or ("end" if target.end else "conversation"), isEntry=False, isTerminal=target.end, explanation=(target.task_messages[0].get("content", "") if target.task_messages and isinstance(target.task_messages[0], dict) else "The agent continued the workflow."))
        if target.type == "transfer":
            record_runtime_event("handoff", f"The caller was handed to staff: {target.transfer.get('reason', 'Transfer requested.') if target.transfer else 'Transfer requested.'}", session_id=self.runtime_session_id, node_id=target.id or target.name, nodeTitle=target.title or target.name, reason=target.transfer.get('reason') if target.transfer else None, mock=True)
        if target.end:
            mark_runtime_completed(self.runtime_session_id, f"The workflow reached {target.title or target.name}.", target.id or target.name, target.title or target.name, target.type or ("end" if target.end else "conversation"))

    def _make_edge_function(self, source_node: Node, edge: Edge) -> FlowsFunctionSchema:
        async def handler(args: dict, flow_manager: FlowManager):
            try:
                _validate_edge_arguments(edge, args)
                target_node = self._nodes_by_name[edge.target]
                _validate_runtime_guard(source_node, target_node, edge, flow_manager.state, args)
            except ValueError as error:
                try:
                    from control_api import record_runtime_event

                    record_runtime_event(
                        "validation_failed",
                        str(error),
                        session_id=self.runtime_session_id,
                        node_id=source_node.id or source_node.name,
                        edge_id=edge.id,
                        nodeTitle=source_node.title or source_node.name,
                    )
                except ImportError:
                    pass
                raise
            # Persist what the caller gave us so later nodes can use it.
            flow_manager.state.update(args)
            logger.info(f"[{edge.function}] -> {edge.target} | collected: {args}")
            self._record_transition(source_node, edge, target_node, args)
            if target_node.type == "tool":
                from control_api import mark_runtime_failed, record_runtime_event

                result = target_node.tool.get("mockResult") if target_node.tool else {}
                flow_manager.state["last_tool_result"] = result
                record_runtime_event("tool_call", f"The mock action {target_node.tool.get('name', target_node.name) if target_node.tool else target_node.name} ran.", session_id=self.runtime_session_id, node_id=target_node.id or target_node.name, nodeTitle=target_node.title or target_node.name, toolName=target_node.tool.get('name', target_node.name) if target_node.tool else target_node.name, mock=True, inputs=args, result=result)
                succeeded = not isinstance(result, dict) or not any(result.get(key) is False for key in ("success", "booked", "available"))
                outcome = next((candidate for candidate in target_node.edges if candidate.kind == ("success" if succeeded else "failure")), None)
                if not outcome:
                    message = f"The mock tool '{target_node.title or target_node.name}' returned {'success' if succeeded else 'failure'} without a matching transition."
                    record_runtime_event("runtime_defect", message, session_id=self.runtime_session_id, node_id=target_node.id or target_node.name)
                    mark_runtime_failed(self.runtime_session_id, message, target_node.id or target_node.name)
                    raise ValueError(message)
                target_node = self._nodes_by_name[outcome.target]
                self._record_transition(self._nodes_by_name[edge.target], outcome, target_node, {})
            next_node = self._make_node(target_node)
            return {"status": "success", **args}, next_node

        return FlowsFunctionSchema(
            name=edge.function,
            description=edge.description,
            properties=edge.properties,
            required=edge.required,
            handler=handler,
        )
