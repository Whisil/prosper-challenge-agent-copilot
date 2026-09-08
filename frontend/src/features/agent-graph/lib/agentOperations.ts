import type { AgentConfig, AgentDraft, AgentEditorAction, AgentNode } from "../model/type"
import { defaultLayout } from "./flowAdapter"

function cloneNode(node: AgentNode): AgentNode {
  return {
    ...node,
    task_messages: node.task_messages.map((message) => ({ ...message })),
    edges: node.edges.map((edge) => ({
      ...edge,
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
  return {
    config: cloneAgentConfig(config),
    layout: Object.fromEntries(config.nodes.map((node, index) => [
      node.name,
      defaultLayout[node.name] ?? { x: 230, y: index * 195 },
    ])),
  }
}

function renameNode(draft: AgentDraft, oldName: string, newName: string): AgentDraft {
  if (!newName.trim() || draft.config.nodes.some((node) => node.name === newName && node.name !== oldName)) {
    return draft
  }

  const nodes = draft.config.nodes.map((node) => ({
    ...node,
    name: node.name === oldName ? newName : node.name,
    edges: node.edges.map((edge) => edge.target === oldName ? { ...edge, target: newName } : edge),
  }))

  return {
    config: {
      ...draft.config,
      initial_node: draft.config.initial_node === oldName ? newName : draft.config.initial_node,
      nodes,
    },
    layout: Object.fromEntries(Object.entries(draft.layout).map(([name, position]) => [
      name === oldName ? newName : name,
      position,
    ])),
  }
}

export function applyAgentAction(draft: AgentDraft, action: AgentEditorAction): AgentDraft {
  switch (action.type) {
    case "reset":
      return action.draft
    case "update_node": {
      const node = draft.config.nodes.find((candidate) => candidate.name === action.nodeName)
      if (!node) return draft
      if (action.patch.name && action.patch.name !== action.nodeName) {
        const renamed = renameNode(draft, action.nodeName, action.patch.name)
        if (renamed === draft) return draft
        const remainingPatch = { ...action.patch }
        delete remainingPatch.name
        return applyAgentAction(renamed, { type: "update_node", nodeName: action.patch.name, patch: remainingPatch })
      }
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((candidate) => candidate.name === action.nodeName ? { ...candidate, ...action.patch } : candidate),
        },
      }
    }
    case "add_node":
      if (draft.config.nodes.some((node) => node.name === action.node.name)) return draft
      return {
        config: { ...draft.config, nodes: [...draft.config.nodes, cloneNode(action.node)] },
        layout: { ...draft.layout, [action.node.name]: action.position },
      }
    case "delete_node":
      if (draft.config.initial_node === action.nodeName || !draft.config.nodes.some((node) => node.name === action.nodeName)) return draft
      return {
        config: {
          ...draft.config,
          nodes: draft.config.nodes
            .filter((node) => node.name !== action.nodeName)
            .map((node) => ({ ...node, edges: node.edges.filter((edge) => edge.target !== action.nodeName) })),
        },
        layout: Object.fromEntries(Object.entries(draft.layout).filter(([name]) => name !== action.nodeName)),
      }
    case "set_initial_node":
      if (!draft.config.nodes.some((node) => node.name === action.nodeName)) return draft
      return { ...draft, config: { ...draft.config, initial_node: action.nodeName } }
    case "add_edge": {
      const source = draft.config.nodes.find((node) => node.name === action.source)
      if (!source || source.edges.some((edge) => edge.function === action.edge.function)) return draft
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((node) => node.name === action.source ? { ...node, edges: [...node.edges, { ...action.edge }] } : node),
        },
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
    case "delete_edge":
      return {
        ...draft,
        config: {
          ...draft.config,
          nodes: draft.config.nodes.map((node) => node.name !== action.source ? node : {
            ...node,
            edges: node.edges.filter((edge) => edge.function !== action.functionName),
          }),
        },
      }
    case "move_node":
      return { ...draft, layout: { ...draft.layout, [action.nodeName]: action.position } }
  }
}
