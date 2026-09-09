import { CURRENT_AGENT_DOCUMENT_VERSION, type AgentConfig, type AgentDocument, type AgentDraft, type AgentEdge, type AgentNode, type AgentNodeType, type EdgeHandleLayout } from "../model/type"
import { defaultNodePosition } from "./graphLayout"
import { humanizeIdentifier, toIdentifier } from "./identifier"

function cloneEdge(edge: AgentEdge & { condition?: string; kind?: string }, source: string, index: number): AgentEdge {
  const current = { ...edge }
  delete current.condition
  return {
    ...current,
    id: current.id ?? `${source}-${toIdentifier(current.function) || "transition"}-${index + 1}`,
    kind: edge.kind === "success" || edge.kind === "failure" ? edge.kind : "condition",
    properties: { ...edge.properties },
    required: [...edge.required],
  }
}

function cloneNode(node: AgentNode & { branch?: { expression?: string } }): AgentNode {
  const current = { ...node }
  delete current.branch
  const id = node.id ?? node.name
  const type = node.type ?? (node.end ? "end" : "conversation")
  const taskMessages = node.task_messages.length > 0 && node.task_messages[0]?.content.trim()
    ? node.task_messages.map((message) => ({ ...message }))
    : [{ role: "developer", content: type === "transfer" ? `Hand off the caller. Reason: ${node.transfer?.reason ?? ""}. Context: ${node.transfer?.context ?? ""}` : "" }]
  return {
    ...current,
    id,
    name: id,
    title: node.title ?? humanizeIdentifier(node.name),
    type,
    end: type === "transfer" || type === "end" ? true : node.end,
    edges: node.edges.map((edge, edgeIndex) => cloneEdge(edge, id, edgeIndex)),
    task_messages: taskMessages,
    ...(node.type === "tool" && node.tool ? { tool: { ...node.tool } } : {}),
    ...(node.type === "transfer" && node.transfer ? { transfer: { ...node.transfer } } : {}),
  }
}

/**
 * Legacy drafts may contain Branch nodes and default/condition metadata. They
 * are intentionally removed at the editor boundary so the rest of the app
 * only ever sees the current, simpler graph contract.
 */
function migrateLegacyGraph(config: AgentConfig): AgentConfig {
  const rawNodes = config.nodes as Array<AgentNode & { branch?: unknown }>
  const removed = new Set(rawNodes.filter((node) => String(node.type) === "branch" || node.branch).map((node) => node.name))
  let nodes: AgentNode[] = rawNodes.filter((node) => !removed.has(node.name)).map((node) => {
    const type = node.type ?? (node.end ? "end" : "conversation")
    const terminal = type === "end" || type === "transfer" || Boolean(node.end)
    const cloned = cloneNode(node as AgentNode & { branch?: { expression?: string } })
    return {
      ...cloned,
      type: (String(type) === "branch" ? "conversation" : type) as AgentNodeType,
      end: type === "transfer" || type === "end" ? true : node.end,
      edges: terminal ? [] : cloned.edges
        .filter((edge) => !removed.has(edge.target))
        .map((edge) => ({ ...edge, kind: (edge.kind === "success" || edge.kind === "failure" ? edge.kind : "condition") as AgentEdge["kind"] })),
    }
  })

  const createFallbackNode = (): AgentNode => ({
      id: "start",
      name: "start",
      title: "Start",
      type: "conversation",
      end: false,
      task_messages: [{ role: "developer", content: "Welcome the caller and understand what they need." }],
      role_message: null,
      edges: [],
    })

  if (nodes.length === 0) nodes = [createFallbackNode()]

  const initialNode = nodes.find((node) => node.name === config.initial_node)
  const initialExists = Boolean(initialNode)
  const firstUsableNode = nodes.find((node) => node.type !== "end" && node.type !== "transfer" && !node.end)
  const initialIsUsable = initialNode && initialNode.type !== "end" && initialNode.type !== "transfer" && !initialNode.end
  if ((!initialExists || !initialIsUsable) && !firstUsableNode) nodes = [createFallbackNode()]
  const initial_node = initialIsUsable
    ? config.initial_node
    : (nodes.find((node) => node.type !== "end" && node.type !== "transfer" && !node.end) ?? nodes[0]).name
  return { ...config, initial_node, nodes }
}

export function edgeHandleKey(source: string, edge: AgentEdge, index = 0) {
  return edge.id ?? `${source}-${toIdentifier(edge.function) || "transition"}-${index + 1}`
}

export function defaultEdgeHandleLayout(): EdgeHandleLayout {
  return { source: "bottom", target: "left" }
}

export function runtimeConfigToDocument(config: AgentConfig): AgentDocument {
  const migrated = migrateLegacyGraph(config)
  return {
    ...migrated,
    version: CURRENT_AGENT_DOCUMENT_VERSION,
    id: toIdentifier(migrated.name) || "agent",
    revision: 1,
    nodes: migrated.nodes.map(cloneNode),
  }
}

export function documentToDraft(document: AgentDocument): AgentDraft {
  const normalized = runtimeConfigToDocument(document)
  return {
    config: {
      ...normalized,
      id: document.id,
      revision: document.revision,
      version: document.version,
    },
    layout: documentLayout(normalized),
    edgeHandles: Object.fromEntries(normalized.nodes.flatMap((node) => node.edges.map((edge, index) => [edgeHandleKey(node.name, edge, index), defaultEdgeHandleLayout()]))),
  }
}

export function documentToRuntimeConfig(document: AgentDocument): AgentConfig {
  return {
    name: document.name,
    initial_node: document.initial_node,
    persona: document.persona,
    voice_id: document.voice_id,
    model: document.model,
    nodes: document.nodes.map((node) => ({
      name: node.name,
      task_messages: node.task_messages,
      role_message: node.role_message,
      edges: node.edges.map((edge) => ({
        function: edge.function,
        description: edge.description,
        target: edge.target,
        properties: edge.properties,
        required: edge.required,
      })),
      pre_actions: node.pre_actions,
      post_actions: node.post_actions,
      end: node.type === "end" || node.end,
    })),
  }
}

export function documentLayout(document: AgentDocument) {
  return Object.fromEntries(document.nodes.map((node, index) => [node.name, defaultNodePosition(index)]))
}

export function parseAgentDocument(value: unknown): AgentDocument {
  if (!value || typeof value !== "object") throw new Error("Agent artifact must be a JSON object.")
  const candidate = value as Partial<AgentDocument> & AgentConfig
  if (!Array.isArray(candidate.nodes)) throw new Error("Agent artifact must contain a nodes array.")
  if (typeof candidate.name !== "string" || typeof candidate.initial_node !== "string") throw new Error("Agent artifact is missing its name or initial node.")
  if (typeof candidate.version === "number" && typeof candidate.id === "string") return runtimeConfigToDocument(candidate as AgentConfig)
  return runtimeConfigToDocument(candidate as AgentConfig)
}
