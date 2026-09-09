import { CURRENT_AGENT_DOCUMENT_VERSION, type AgentConfig, type AgentDocument, type AgentDraft, type AgentEdge, type AgentNode } from "../model/type"
import { defaultNodePosition } from "./graphLayout"
import { humanizeIdentifier, toIdentifier } from "./identifier"

function cloneEdge(edge: AgentEdge, source: string, index: number): AgentEdge {
  return {
    ...edge,
    id: edge.id ?? `${source}-${toIdentifier(edge.function) || "transition"}-${index + 1}`,
    kind: edge.kind ?? "condition",
    properties: { ...edge.properties },
    required: [...edge.required],
  }
}

function cloneNode(node: AgentNode): AgentNode {
  const id = node.id ?? node.name
  return {
    ...node,
    id,
    name: id,
    title: node.title ?? humanizeIdentifier(node.name),
    type: node.type ?? (node.end ? "end" : "conversation"),
    edges: node.edges.map((edge, edgeIndex) => cloneEdge(edge, id, edgeIndex)),
    task_messages: node.task_messages.map((message) => ({ ...message })),
    ...(node.type === "tool" && node.tool ? { tool: { ...node.tool } } : {}),
    ...(node.type === "branch" && node.branch ? { branch: { ...node.branch } } : {}),
    ...(node.type === "transfer" && node.transfer ? { transfer: { ...node.transfer } } : {}),
  }
}

export function runtimeConfigToDocument(config: AgentConfig): AgentDocument {
  return {
    ...config,
    version: CURRENT_AGENT_DOCUMENT_VERSION,
    id: toIdentifier(config.name) || "agent",
    revision: 1,
    nodes: config.nodes.map(cloneNode),
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
    layout: documentLayout(document),
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
  if (typeof candidate.version === "number" && typeof candidate.id === "string") return { ...candidate, revision: candidate.revision ?? 1 } as AgentDocument
  return runtimeConfigToDocument(candidate as AgentConfig)
}
