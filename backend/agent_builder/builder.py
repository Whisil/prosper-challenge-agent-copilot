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
            if node_type == "tool" and not node.tool:
                raise ValueError(f"Tool node '{node.name}' needs a tool definition.")
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

    def _make_edge_function(self, source_node: Node, edge: Edge) -> FlowsFunctionSchema:
        async def handler(args: dict, flow_manager: FlowManager):
            # Persist what the caller gave us so later nodes can use it.
            flow_manager.state.update(args)
            logger.info(f"[{edge.function}] -> {edge.target} | collected: {args}")
            try:
                from control_api import mark_runtime_completed, record_runtime_event

                target_node = self._nodes_by_name[edge.target]
                record_runtime_event("transition", f"The caller moved from {source_node.title or source_node.name} to {target_node.title or target_node.name}.", session_id=self.runtime_session_id, node_id=source_node.id or source_node.name, edge_id=edge.id, sourceNodeId=source_node.id or source_node.name, edgeId=edge.id, target=edge.target, sourceTitle=source_node.title or source_node.name, transitionName=edge.function, targetNodeId=target_node.id or target_node.name, targetTitle=target_node.title or target_node.name, collectedFields=args)
                record_runtime_event("node_entered", f"The agent moved to {target_node.title or target_node.name}.", session_id=self.runtime_session_id, node_id=target_node.id or target_node.name, nodeTitle=target_node.title or target_node.name, nodeType=target_node.type or ("end" if target_node.end else "conversation"), isEntry=False, isTerminal=target_node.end, explanation=(target_node.task_messages[0].get("content", "") if target_node.task_messages and isinstance(target_node.task_messages[0], dict) else "The agent continued the workflow."))
                if target_node.type == "tool":
                    record_runtime_event("tool_call", f"The mock action {target_node.tool.get('name', target_node.name) if target_node.tool else target_node.name} ran.", session_id=self.runtime_session_id, node_id=target_node.id or target_node.name, nodeTitle=target_node.title or target_node.name, toolName=target_node.tool.get('name', target_node.name) if target_node.tool else target_node.name, mock=True, result=target_node.tool.get('mockResult') if target_node.tool else None)
                if target_node.type == "transfer":
                    record_runtime_event("handoff", f"The caller was handed to staff: {target_node.transfer.get('reason', 'Transfer requested.') if target_node.transfer else 'Transfer requested.'}", session_id=self.runtime_session_id, node_id=target_node.id or target_node.name, nodeTitle=target_node.title or target_node.name, reason=target_node.transfer.get('reason') if target_node.transfer else None, mock=True)
                if target_node.end:
                    mark_runtime_completed(self.runtime_session_id, f"The workflow reached {target_node.title or target_node.name}.", target_node.id or target_node.name, target_node.title or target_node.name)
            except ImportError:
                pass
            next_node = self._make_node(self._nodes_by_name[edge.target])
            return {"status": "success", **args}, next_node

        return FlowsFunctionSchema(
            name=edge.function,
            description=edge.description,
            properties=edge.properties,
            required=edge.required,
            handler=handler,
        )
