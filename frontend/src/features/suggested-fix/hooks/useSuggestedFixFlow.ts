import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentDraft, AgentValidationError, CallRecord, CallReview } from "@/features/agent-graph/model/type"
import { applyGraphOperations } from "@/features/agent-graph/lib/graphPatch"
import { validateAgentConfig } from "@/features/agent-graph/lib/validateAgent"
import { requestSuggestedFix } from "../lib/suggestedFixApi"
import type { SuggestedFixRequest, SuggestedFixState } from "../model/type"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface UseSuggestedFixFlowOptions {
  activeAgentId: string
  draft: AgentDraft
  draftVersion: string
  commitSuggestedFix: (preview: AgentDraft, expectedAgentId: string, expectedVersion: string) => AgentValidationError[]
  onAccepted?: (callId: string) => void
}

export function useSuggestedFixFlow({ activeAgentId, draft, draftVersion, commitSuggestedFix, onAccepted }: UseSuggestedFixFlowOptions) {
  const [state, setState] = useState<SuggestedFixState>({ status: "idle" })
  const requestKey = useRef<string | undefined>(undefined)
  const requestNumber = useRef(0)

  useEffect(() => {
    if (state.status !== "ready" || !state.source) return
    const draftChanged = state.originalDraft ? JSON.stringify(state.originalDraft) !== JSON.stringify(draft) : false
    if (state.source.baseVersion !== draftVersion || state.source.document.id !== draft.config.id || draftChanged) {
      setState((current) => ({ ...current, status: "stale", error: "The graph changed while this suggestion was being reviewed. Generate a new suggestion." }))
    }
  }, [draft, draftVersion, state.originalDraft, state.source, state.status])

  const clear = useCallback(() => {
    requestNumber.current += 1
    requestKey.current = undefined
    setState({ status: "idle" })
  }, [])

  const start = useCallback(async (record: CallRecord, review: CallReview) => {
    const key = `${record.id}:${activeAgentId}:${draftVersion}`
    if (requestKey.current === key && state.status !== "error") return
    requestKey.current = key
    const requestId = ++requestNumber.current
    const originalDraft = clone(draft)
    const request: SuggestedFixRequest = { document: clone(draft.config), baseVersion: draftVersion, call: record, review }
    setState({ status: "loading", source: request, originalDraft })
    try {
      const response = await requestSuggestedFix(request)
      if (requestId !== requestNumber.current) return
      const preview = applyGraphOperations(originalDraft, response.operations)
      const errors = [...preview.errors, ...validateAgentConfig(preview.document).filter((error) => error.severity === "error")]
      if (errors.some((error) => error.severity === "error")) {
        setState({ status: "error", source: request, originalDraft, response, error: errors.map((error) => error.message).join(" ") })
        return
      }
      setState({
        status: "ready",
        source: request,
        originalDraft,
        response,
        previewDraft: { config: preview.document, layout: preview.layout, edgeHandles: preview.edgeHandles },
      })
    } catch (error) {
      if (requestId !== requestNumber.current) return
      setState({ status: "error", source: request, originalDraft, error: error instanceof Error ? error.message : "The suggested fix could not be prepared." })
    }
  }, [activeAgentId, draft, draftVersion, state.status])

  const accept = useCallback(() => {
    if (state.status !== "ready" || !state.previewDraft || !state.source) return { ok: false, error: "No suggested fix is ready." }
    if (state.source.baseVersion !== draftVersion || (state.originalDraft && JSON.stringify(state.originalDraft) !== JSON.stringify(draft))) {
      setState((current) => ({ ...current, status: "stale", error: "The graph changed while this suggestion was being reviewed. Generate a new suggestion." }))
      return { ok: false, error: "The suggestion is stale." }
    }
    const errors = commitSuggestedFix(state.previewDraft, activeAgentId, state.source.baseVersion)
    if (errors.some((error) => error.severity === "error")) {
      setState((current) => ({ ...current, status: "stale", error: errors.map((error) => error.message).join(" ") }))
      return { ok: false, error: errors.map((error) => error.message).join(" ") }
    }
    onAccepted(state.source.call.id)
    clear()
    return { ok: true }
  }, [activeAgentId, clear, commitSuggestedFix, draft, draftVersion, onAccepted, state])

  const deny = useCallback(() => {
    clear()
  }, [clear])

  const movePreviewNode = useCallback((nodeName: string, position: { x: number; y: number }) => {
    setState((current) => current.status === "ready" && current.previewDraft
      ? { ...current, previewDraft: { ...current.previewDraft, layout: { ...current.previewDraft.layout, [nodeName]: position } } }
      : current)
  }, [])

  return { state, start, accept, deny, clear, movePreviewNode }
}
