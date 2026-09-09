import type { AgentCollection, AgentConfig, AgentDraft, StoredAgent } from "../model/type"
import { createAgentDraft } from "./agentOperations"
import { loadStoredDraft } from "./draftPersistence"
import { defaultEdgeHandleLayout, edgeHandleKey } from "./agentDocument"

export const AGENT_COLLECTION_STORAGE_KEY = "prosper-agent-collection-v1"
function now() {
  return new Date().toISOString()
}

export function createAgentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `agent_${crypto.randomUUID()}`
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createStoredAgent(config: AgentConfig, id = createAgentId()): StoredAgent {
  const draft = createAgentDraft(config)
  draft.config.id = id
  return { id, draft, updatedAt: now() }
}

export function createAgentCollection(config: AgentConfig): AgentCollection {
  const agent = createStoredAgent(config)
  return { activeAgentId: agent.id, agents: [agent] }
}

function migrateStoredDraft(draft: AgentDraft): AgentDraft {
  const normalized = createAgentDraft(draft.config)
  normalized.config.id = draft.config.id
  normalized.config.revision = draft.config.revision
  normalized.config.version = draft.config.version
  normalized.layout = Object.fromEntries(normalized.config.nodes.map((node) => [node.name, draft.layout[node.name] ?? normalized.layout[node.name]]))
  normalized.edgeHandles = { ...normalized.edgeHandles, ...Object.fromEntries(Object.entries(draft.edgeHandles ?? {}).filter(([key]) => key in normalized.edgeHandles)) }
  return normalized
}

function isDraft(value: unknown): value is AgentDraft {
  return Boolean(value && typeof value === "object" && "config" in value && "layout" in value)
}

function isStoredAgent(value: unknown): value is StoredAgent {
  return Boolean(value && typeof value === "object" && typeof (value as StoredAgent).id === "string" && isDraft((value as StoredAgent).draft))
}

function parseCollection(value: unknown): AgentCollection | undefined {
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Partial<AgentCollection>
  if (!Array.isArray(candidate.agents) || !candidate.agents.every(isStoredAgent)) return undefined
  if (typeof candidate.activeAgentId !== "string" || !candidate.agents.some((agent) => agent.id === candidate.activeAgentId)) return undefined
  const collection = candidate as AgentCollection
  collection.agents = collection.agents.map((agent) => ({
    ...agent,
    draft: migrateStoredDraft(agent.draft),
  }))
  return collection
}

export function loadAgentCollection(): AgentCollection | undefined {
  if (typeof window === "undefined") return undefined
  const raw = window.localStorage.getItem(AGENT_COLLECTION_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = parseCollection(JSON.parse(raw))
      if (parsed) {
        saveAgentCollection(parsed)
        return parsed
      }
    } catch {
      window.localStorage.removeItem(AGENT_COLLECTION_STORAGE_KEY)
    }
  }
  const legacyDraft = loadStoredDraft()
  if (!legacyDraft) return undefined
  const id = legacyDraft.config.id || createAgentId()
  legacyDraft.config.id = id
  const edgeHandles = legacyDraft.edgeHandles ?? Object.fromEntries(legacyDraft.config.nodes.flatMap((node) => node.edges.map((edge, index) => [edgeHandleKey(node.name, edge, index), defaultEdgeHandleLayout()])))
  const collection = { activeAgentId: id, agents: [{ id, draft: { ...legacyDraft, edgeHandles }, updatedAt: now() }] }
  saveAgentCollection(collection)
  return collection
}

export function saveAgentCollection(collection: AgentCollection) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AGENT_COLLECTION_STORAGE_KEY, JSON.stringify(collection))
}

export function updateStoredAgent(collection: AgentCollection, agent: StoredAgent): AgentCollection {
  return {
    activeAgentId: collection.activeAgentId,
    agents: collection.agents.map((current) => current.id === agent.id ? agent : current),
  }
}
