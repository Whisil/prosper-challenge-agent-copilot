import type { AgentDraft, AgentEditorAction } from "../model/type"
import { applyAgentAction } from "./agentOperations"

export interface DraftHistory {
  past: AgentDraft[]
  present: AgentDraft
  future: AgentDraft[]
}

export type DraftHistoryAction =
  | { type: "apply"; action: AgentEditorAction }
  | { type: "replace"; draft: AgentDraft }
  | { type: "undo" }
  | { type: "redo" }

export function createDraftHistory(draft: AgentDraft): DraftHistory {
  return { past: [], present: draft, future: [] }
}

export function reduceDraftHistory(state: DraftHistory, action: DraftHistoryAction): DraftHistory {
  if (action.type === "undo") {
    const previous = state.past.at(-1)
    if (!previous) return state
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] }
  }
  if (action.type === "redo") {
    const next = state.future[0]
    if (!next) return state
    return { past: [...state.past, state.present], present: next, future: state.future.slice(1) }
  }

  const next = action.type === "replace" ? action.draft : applyAgentAction(state.present, action.action)
  if (next === state.present) return state
  return { past: [...state.past, state.present], present: next, future: [] }
}
