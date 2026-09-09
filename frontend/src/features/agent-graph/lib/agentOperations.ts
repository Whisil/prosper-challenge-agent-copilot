import type { AgentConfig, AgentDraft, AgentEdge, AgentEditorAction, AgentNode, AgentProperty, NodeCreationKind } from "../model/type"
import { defaultEdgeHandleLayout, documentToDraft, edgeHandleKey, runtimeConfigToDocument } from "./agentDocument"
import { humanizeIdentifier, toIdentifier } from "./identifier"

function cloneNode(node: AgentNode): AgentNode {
  const id = node.id ?? node.name
  return {
    ...node,
    id,
    name: id,
    title: node.title ?? humanizeIdentifier(node.name),
    type: node.type ?? (node.end ? "end" : "conversation"),
    end: node.type === "transfer" || node.type === "end" ? true : node.end,
    task_messages: node.task_messages.map((message) => ({ ...message })),
    edges: node.edges.map((edge, index) => ({
      ...edge,
      id: edge.id ?? `${id}-${toIdentifier(edge.function) || "transition"}-${index + 1}`,
      kind: edge.kind ?? "condition",
      properties: { ...edge.properties },
      required: [...edge.required],
    })),
  }
}

export function cloneAgentConfig(config: AgentConfig): AgentConfig {
  return {
    ...config,
    nodes: config.nodes.map(cloneNode),
  }
}

export function createAgentDraft(config: AgentConfig): AgentDraft {
  return documentToDraft(runtimeConfigToDocument(config))
}

export function getNextNodeName(nodes: AgentNode[], kind: NodeCreationKind) {
  const names = new Set(nodes.map((node) => node.name))
  const baseName = kind === "end" ? "new_terminal" : `new_${kind}`
  let index = nodes.length + 1
  let name = `${baseName}_${index}`
  while (names.has(name)) {
    index += 1
    name = `${baseName}_${index}`
  }
  return name
}

export function getNextTransitionName(edges: AgentEdge[]) {
  const names = new Set(edges.map((edge) => edge.function))
  let index = edges.length + 1
  let name = `new_transition_${index}`
  while (names.has(name)) {
    index += 1
    name = `new_transition_${index}`
  }
  return name
}

export function createCanvasTransition(source: AgentNode | undefined, target: AgentNode | undefined): AgentEdge | undefined {
  if (!source || !target || source.end || source.type === "end" || source.type === "transfer" || source.name === target.name) return undefined
  return { id: `${source.name}-${getNextTransitionName(source.edges)}-${target.name}`, kind: "condition", function: getNextTransitionName(source.edges), description: "", target: target.name, properties: {}, required: [] }
}

export function createDefaultAgentProperty(): AgentProperty {
  return { type: "string", description: "" }
}

export function renameAgentProperty(edge: AgentEdge, currentName: string, nextName: string): AgentEdge | undefined {
  const trimmedName = toIdentifier(nextName)
  if (!trimmedName || (trimmedName !== currentName && edge.properties[trimmedName])) return undefined
  if (trimmedName === currentName) return edge

  return {
    ...edge,
    properties: Object.fromEntries(Object.entries(edge.properties).map(([name, value]) => [name === currentName ? trimmedName : name, value])),
    required: edge.required.map((name) => name === currentName ? trimmedName : name),
  }
}

export function setAgentPropertyRequired(edge: AgentEdge, propertyName: string, required: boolean): AgentEdge {
  const nextRequired = required ? [...new Set([...edge.required, propertyName])] : edge.required.filter((name) => name !== propertyName)
  return { ...edge, required: nextRequired }
}

export function applyAgentAction(draft: AgentDraft, action: AgentEditorAction): AgentDraft {
  switch (action.type) {
    case "reset":
      return action.draft
    case "update_agent":
      return { ...draft, config: { ...draft.config, ...action.patch } }
    case "update_node": {
      const node = draft.config.nodes.find((candidate) => candidate.name === action.nodeName)
      if (!node) return draft
      const patch = { ...action.patch }
      if (patch.name !== undefined && patch.title === undefined) {
        patch.title = patch.name
        delete patch.name
      }
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((candidate) => candidate.name === action.nodeName ? { ...candidate, ...patch } : candidate),
        },
      }
    }
    case "add_node":
      if (draft.config.nodes.some((node) => node.name === action.node.name)) return draft
      return {
        config: { ...draft.config, nodes: [...draft.config.nodes, cloneNode(action.node)] },
        layout: { ...draft.layout, [action.node.name]: action.position },
        edgeHandles: draft.edgeHandles ?? {},
      }
    case "delete_node": {
      if (draft.config.initial_node === action.nodeName || !draft.config.nodes.some((node) => node.name === action.nodeName)) return draft
      const removedEdgeKeys = draft.config.nodes.flatMap((node) => node.edges.filter((edge) => edge.target === action.nodeName).map((edge, index) => edgeHandleKey(node.name, edge, index)))
      return {
        config: {
          ...draft.config,
          nodes: draft.config.nodes
            .filter((node) => node.name !== action.nodeName)
            .map((node) => ({ ...node, edges: node.edges.filter((edge) => edge.target !== action.nodeName) })),
        },
        layout: Object.fromEntries(Object.entries(draft.layout).filter(([name]) => name !== action.nodeName)),
        edgeHandles: Object.fromEntries(Object.entries(draft.edgeHandles ?? {}).filter(([key]) => !key.startsWith(`${action.nodeName}-`) && !removedEdgeKeys.includes(key))),
      }
    }
    case "set_initial_node":
      if (!draft.config.nodes.some((node) => node.name === action.nodeName)) return draft
      return { ...draft, config: { ...draft.config, initial_node: action.nodeName } }
    case "add_edge": {
      const source = draft.config.nodes.find((node) => node.name === action.source)
      if (!source || source.end || source.type === "end" || source.type === "transfer" || source.edges.some((edge) => edge.function === action.edge.function)) return draft
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((node) => node.name === action.source ? { ...node, edges: [...node.edges, { ...action.edge }] } : node),
        },
        edgeHandles: { ...(draft.edgeHandles ?? {}), [edgeHandleKey(action.source, action.edge)]: action.handles ?? defaultEdgeHandleLayout() },
      }
    }
    case "update_edge":
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((node) => node.name !== action.source ? node : {
            ...node,
            edges: node.edges.map((edge) => edge.function === action.functionName ? { ...edge, ...action.patch } : edge),
          }),
        },
      }
    case "delete_edge": {
      const sourceNode = draft.config.nodes.find((node) => node.name === action.source)
      const edge = sourceNode?.edges.find((candidate) => candidate.function === action.functionName)
      const key = edge ? edgeHandleKey(action.source, edge) : undefined
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((node) => node.name !== action.source ? node : {
            ...node,
            edges: node.edges.filter((edge) => edge.function !== action.functionName),
          }),
        },
        edgeHandles: key ? Object.fromEntries(Object.entries(draft.edgeHandles ?? {}).filter(([edgeKey]) => edgeKey !== key)) : (draft.edgeHandles ?? {}),
      }
    }
    case "move_node":
      return { ...draft, layout: { ...draft.layout, [action.nodeName]: action.position } }
  }
}
