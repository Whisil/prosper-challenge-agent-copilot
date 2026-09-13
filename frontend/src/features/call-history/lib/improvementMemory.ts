import type { AgentDraft, AgentDocument, AgentNode, CallRecord, ImprovementRecord, AcceptedImprovementChange, CallReview, StoredAgent } from "@/features/agent-graph/model/type"
import type { GraphOperation } from "@/features/agent-graph/model/patch"

export const IMPROVEMENT_MEMORY_STORAGE_KEY = "prosper-improvement-memory-v1"
export const MAX_IMPROVEMENT_RECORDS = 20

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function agentIdForCall(call: CallRecord, agents: StoredAgent[]): string | undefined {
  if (call.agentId && agents.some((agent) => agent.id === call.agentId)) return call.agentId
  return agents.find((agent) => agent.draft.config.name === call.agentName)?.id
}

function decisionForReview(review: CallReview | undefined): ImprovementRecord["decision"] {
  if (!review) return "unreviewed"
  if (review.resolution === "resolved") return "accepted"
  if (review.status === "passed") return "no_change"
  return "unreviewed"
}

export function improvementRecordFromCall(call: CallRecord, agents: StoredAgent[]): ImprovementRecord | undefined {
  const agentId = agentIdForCall(call, agents)
  if (!agentId || (call.status !== "completed" && call.status !== "failed")) return undefined
  return {
    id: `improvement_${call.id}`,
    agentId,
    callId: call.id,
    draftVersion: call.draftVersion,
    createdAt: call.endedAt ?? call.startedAt,
    outcome: call.status,
    summary: call.review?.summary ?? `The call ${call.status === "failed" ? "failed" : "completed"} without an AI review.`,
    reviewStatus: call.reviewState === "pending" ? "pending" : call.review?.status ?? "unavailable",
    issues: clone(call.review?.issues ?? []),
    decision: decisionForReview(call.review),
  }
}

function parseStoredMemory(value: string | null): ImprovementRecord[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is ImprovementRecord => Boolean(
      record && typeof record === "object" &&
      typeof record.id === "string" && typeof record.agentId === "string" &&
      typeof record.callId === "string" && typeof record.draftVersion === "string" &&
      typeof record.summary === "string" && Array.isArray(record.issues) &&
      ["pending", "passed", "needs_attention", "unavailable"].includes(record.reviewStatus) &&
      ["unreviewed", "no_change", "accepted", "rejected"].includes(record.decision),
    ))
  } catch {
    return []
  }
}

export function saveImprovementMemory(records: ImprovementRecord[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(IMPROVEMENT_MEMORY_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_IMPROVEMENT_RECORDS)))
}

export function loadImprovementMemory(calls: CallRecord[], agents: StoredAgent[]): ImprovementRecord[] {
  if (typeof window === "undefined") return []
  const persisted = parseStoredMemory(window.localStorage.getItem(IMPROVEMENT_MEMORY_STORAGE_KEY))
  const byCall = new Map(persisted.map((record) => [record.callId, record]))
  for (const call of calls) {
    const derived = improvementRecordFromCall(call, agents)
    if (!derived) continue
    const previous = byCall.get(derived.callId)
    byCall.set(derived.callId, {
      ...derived,
      ...previous,
      agentId: derived.agentId,
      draftVersion: derived.draftVersion,
      outcome: derived.outcome,
      summary: derived.summary,
      reviewStatus: derived.reviewStatus,
      issues: derived.issues,
      decision: previous?.decision === "accepted" || previous?.decision === "rejected" ? previous.decision : derived.decision,
    })
  }
  const records = [...byCall.values()].filter((record) => agents.some((agent) => agent.id === record.agentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_IMPROVEMENT_RECORDS)
  saveImprovementMemory(records)
  return records
}

export function upsertImprovementRecord(record: ImprovementRecord): ImprovementRecord[] {
  if (typeof window === "undefined") return [record]
  const records = parseStoredMemory(window.localStorage.getItem(IMPROVEMENT_MEMORY_STORAGE_KEY))
  const next = [record, ...records.filter((current) => current.id !== record.id)].slice(0, MAX_IMPROVEMENT_RECORDS)
  saveImprovementMemory(next)
  return next
}

export function updateImprovementReview(call: CallRecord, agents: StoredAgent[], review: CallReview): ImprovementRecord[] {
  const next = improvementRecordFromCall({ ...call, review, reviewState: review.status === "unavailable" ? "unavailable" : "complete" }, agents)
  if (!next) return parseStoredMemory(typeof window === "undefined" ? null : window.localStorage.getItem(IMPROVEMENT_MEMORY_STORAGE_KEY))
  const current = parseStoredMemory(typeof window === "undefined" ? null : window.localStorage.getItem(IMPROVEMENT_MEMORY_STORAGE_KEY)).find((record) => record.callId === call.id)
  return upsertImprovementRecord({ ...next, ...current, reviewStatus: review.status, summary: review.summary, issues: clone(review.issues), decision: current?.decision === "accepted" || current?.decision === "rejected" ? current.decision : decisionForReview(review) })
}

export function historicalContextForAgent(records: ImprovementRecord[], agentId: string, excludeCallId?: string) {
  return { agentId, records: records.filter((record) => record.agentId === agentId && record.callId !== excludeCallId).slice(0, MAX_IMPROVEMENT_RECORDS).map((record) => clone(record)) }
}

function edgeById(document: AgentDocument, id: string): { source: AgentNode; edge: AgentNode["edges"][number] } | undefined {
  for (const source of document.nodes) {
    const edge = source.edges.find((candidate, index) => (candidate.id ?? `${source.name}-${candidate.function}-${index + 1}`) === id)
    if (edge) return { source, edge }
  }
  return undefined
}

export function acceptedChangesForOperations(operations: GraphOperation[], before: AgentDraft, after: AgentDraft): AcceptedImprovementChange[] {
  const changes: AcceptedImprovementChange[] = []
  for (const operation of operations) {
    if (operation.op === "add_node") {
      const id = operation.node.id ?? operation.node.name
      changes.push({ kind: "added_node", id })
      operation.node.edges.forEach((edge, index) => changes.push({ kind: "added_edge", id: edge.id ?? `${operation.node.name}-${edge.function}-${index + 1}` }))
    } else if (operation.op === "add_edge") {
      changes.push({ kind: "added_edge", id: operation.edge.id ?? `${operation.sourceNodeId}-${operation.edge.function}` })
    } else if (operation.op === "update_node") {
      changes.push({ kind: "updated_node", id: operation.nodeId })
    } else if (operation.op === "update_edge") {
      const previous = edgeById(before.config, operation.edgeId)?.edge
      const current = edgeById(after.config, operation.edgeId)?.edge
      changes.push({ kind: "updated_edge", id: operation.edgeId, beforeTarget: previous?.target, afterTarget: current?.target })
    }
  }
  return changes
}

export function updateImprovementDecision(
  call: CallRecord,
  agents: StoredAgent[],
  decision: ImprovementRecord["decision"],
  details: Partial<Pick<ImprovementRecord, "appliedVersion" | "affectedNodeIds" | "affectedEdgeIds" | "acceptedChanges" | "proposedChanges">> = {},
): ImprovementRecord[] {
  const current = improvementRecordFromCall(call, agents)
  if (!current) return []
  const stored = parseStoredMemory(typeof window === "undefined" ? null : window.localStorage.getItem(IMPROVEMENT_MEMORY_STORAGE_KEY)).find((record) => record.callId === call.id)
  return upsertImprovementRecord({ ...current, ...stored, decision, ...details })
}
