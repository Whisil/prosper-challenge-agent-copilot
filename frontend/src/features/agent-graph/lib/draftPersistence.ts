import type { XYPosition } from "@xyflow/react"
import type { AgentDocument, AgentDraft } from "../model/type"
import { documentLayout, parseAgentDocument } from "./agentDocument"

export const DRAFT_STORAGE_KEY = "prosper-agent-draft-v1"
export const DRAFT_SNAPSHOTS_KEY = "prosper-agent-draft-snapshots-v1"

export function serializeDraft(draft: AgentDraft): string {
  return JSON.stringify({ config: draft.config, layout: draft.layout }, null, 2)
}

export function parseDraft(value: unknown): AgentDraft {
  if (!value || typeof value !== "object") throw new Error("Draft must be a JSON object.")
  const candidate = value as { config?: unknown; layout?: Record<string, XYPosition> }
  const config = parseAgentDocument(candidate.config ?? value)
  const layout = candidate.layout && typeof candidate.layout === "object" ? candidate.layout : documentLayout(config)
  return { config, layout }
}

export function loadStoredDraft(): AgentDraft | undefined {
  if (typeof window === "undefined") return undefined
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
  if (!raw) return undefined
  try {
    return parseDraft(JSON.parse(raw))
  } catch {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    return undefined
  }
}

export function saveStoredDraft(draft: AgentDraft): void {
  if (typeof window === "undefined") return
  const serialized = serializeDraft(draft)
  window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized)
  const snapshots = loadStoredSnapshots().filter((snapshot) => snapshot.config.revision !== draft.config.revision)
  snapshots.unshift(draft)
  window.localStorage.setItem(DRAFT_SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(0, 20).map((snapshot) => JSON.parse(serializeDraft(snapshot)))))
}

export function loadStoredSnapshots(): AgentDraft[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(DRAFT_SNAPSHOTS_KEY)
  if (!raw) return []
  try {
    const values = JSON.parse(raw)
    return Array.isArray(values) ? values.map(parseDraft) : []
  } catch {
    return []
  }
}

export function clearStoredDraft(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    window.localStorage.removeItem(DRAFT_SNAPSHOTS_KEY)
  }
}

export function isAgentDocument(value: unknown): value is AgentDocument {
  return Boolean(value && typeof value === "object" && "version" in value && "nodes" in value)
}
