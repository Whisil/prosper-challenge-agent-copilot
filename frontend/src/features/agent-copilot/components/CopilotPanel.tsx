import { AlertTriangle, ChevronDown, FileWarning, Play, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { FormField } from "@/components/ui/FormField"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import type { AgentDocument, AgentDraft, AgentValidationError, CallRecord } from "@/features/agent-graph/model/type"
import type { XYPosition } from "@xyflow/react"
import { createCopilotProposal } from "@/lib/agentApi"
import { applyGraphOperations } from "../lib/operationApplier"
import type { ChangeProposal, EvidenceSource, GraphOperation, OperationPreview } from "../model/type"

interface CopilotPanelProps {
  document: AgentDocument
  draft: AgentDraft
  draftVersion: string
  initialSource?: EvidenceSource
  autoAnalyze?: boolean
  onApplyOperations: (operations: GraphOperation[], acceptedIndices?: number[]) => { errors: AgentValidationError[] }
  onPreviewCall: (document: AgentDocument, draftVersion: string) => void
  onProposalLoadingChange: (loading: boolean) => void
  onPreviewChange: (document?: AgentDocument, layout?: Record<string, XYPosition>) => void
  onProposalErrorChange: (message?: string) => void
}

function makePreview(draft: AgentDraft, proposal: ChangeProposal, selected: number[]): OperationPreview {
  return applyGraphOperations(draft, proposal.operations, selected)
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function operationSummary(operation: GraphOperation) {
  switch (operation.op) {
    case "add_node": return `Add ${operation.node.title}`
    case "update_node": return `Update node ${humanize(operation.nodeId)}`
    case "remove_node": return `Remove node ${humanize(operation.nodeId)}`
    case "add_edge": return `Add transition to ${humanize(operation.edge.target)}`
    case "update_edge": return `Update transition ${humanize(operation.edgeId)}`
    case "remove_edge": return `Remove transition ${humanize(operation.edgeId)}`
    case "update_agent": return "Update the agent persona"
  }
}

export function CopilotPanel({ document, draft, draftVersion, initialSource, autoAnalyze = false, onApplyOperations, onPreviewCall, onProposalLoadingChange, onPreviewChange, onProposalErrorChange }: CopilotPanelProps) {
  const [sourceKind, setSourceKind] = useState<"guideline" | "call">(initialSource?.kind ?? "guideline")
  const [sourceText, setSourceText] = useState(initialSource?.text ?? "")
  const [sourceCall, setSourceCall] = useState<CallRecord | undefined>(initialSource?.kind === "call" ? initialSource.call : undefined)
  const [proposal, setProposal] = useState<ChangeProposal>()
  const [selected, setSelected] = useState<number[]>([])
  const [preview, setPreview] = useState<OperationPreview>()
  const [previewBaseVersion, setPreviewBaseVersion] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [loading, setLoading] = useState(false)
  const autoAnalyzedSource = useRef<string | undefined>(undefined)

  const clearPreview = useCallback(() => {
    setPreview(undefined)
    setPreviewBaseVersion(undefined)
    onPreviewChange(undefined)
  }, [onPreviewChange])

  useEffect(() => {
    if (!initialSource) return
    setSourceKind(initialSource.kind === "call" ? "call" : "guideline")
    setSourceText(initialSource.text)
    setSourceCall(initialSource.kind === "call" ? initialSource.call : undefined)
    setProposal(undefined)
    setNotice(undefined)
    onProposalErrorChange(undefined)
    clearPreview()
  }, [clearPreview, initialSource, onProposalErrorChange])

  const requestProposal = useCallback(async (source: EvidenceSource) => {
    if (!source.text.trim()) {
      setNotice("Add a guideline or requested change before asking Copilot to review it.")
      return
    }
    setLoading(true)
    onProposalLoadingChange(true)
    setNotice(undefined)
    onProposalErrorChange(undefined)
    clearPreview()
    try {
      const next = await createCopilotProposal({ document, baseVersion: draftVersion, source: { kind: source.kind, text: source.text.trim(), call: source.kind === "call" ? source.call : undefined } })
      const indices = next.operations.map((_operation, index) => index)
      const nextPreview = makePreview(draft, next, indices)
      setProposal(next)
      setSelected(indices)
      if (nextPreview.errors.some((error) => error.severity === "error")) {
        const message = nextPreview.errors.map((error) => error.message).join(" ")
        setNotice(`Copilot returned changes that cannot be safely previewed. ${message}`)
        onProposalErrorChange(message)
        return
      }
      setPreview(nextPreview)
      setPreviewBaseVersion(draftVersion)
      onPreviewChange(nextPreview.document, nextPreview.layout)
      if (next.operations.length === 0) setNotice("No safe change was recommended for this evidence.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Copilot could not create a suggestion."
      setNotice(message)
      onProposalErrorChange(message)
    } finally {
      setLoading(false)
      onProposalLoadingChange(false)
    }
  }, [clearPreview, document, draft, draftVersion, onPreviewChange, onProposalErrorChange, onProposalLoadingChange])

  useEffect(() => {
    if (!autoAnalyze || !initialSource) return
    const sourceKey = `${initialSource.kind}:${initialSource.kind === "call" ? initialSource.traceId : ""}:${initialSource.text}`
    if (autoAnalyzedSource.current === sourceKey) return
    autoAnalyzedSource.current = sourceKey
    void requestProposal(initialSource)
  }, [autoAnalyze, initialSource, requestProposal])

  const selectedOperations = useMemo(() => proposal?.operations.filter((_, index) => selected.includes(index)) ?? [], [proposal, selected])
  const analyze = () => {
    const source: EvidenceSource = sourceKind === "call"
      ? { kind: "call", traceId: sourceCall?.id ?? "current-call", text: sourceText, call: sourceCall }
      : { kind: "guideline", text: sourceText }
    void requestProposal(source)
  }
  const rebuildPreview = (indices: number[]) => {
    if (!proposal) return
    const next = makePreview(draft, proposal, indices)
    if (next.errors.some((error) => error.severity === "error")) {
      setNotice(next.errors.map((error) => error.message).join(" "))
      return
    }
    setPreview(next)
    setPreviewBaseVersion(draftVersion)
    onPreviewChange(next.document, next.layout)
  }
  const applySelected = () => {
    if (!proposal || selectedOperations.length === 0 || !preview || previewBaseVersion !== draftVersion) {
      setNotice("The selected changes need a valid preview before they can be applied.")
      return
    }
    const result = onApplyOperations(proposal.operations, selected)
    if (result.errors.some((error) => error.severity === "error")) {
      setNotice("The selected changes produced validation errors and were not applied.")
      return
    }
    setProposal({ ...proposal, status: "approved" })
    clearPreview()
    setNotice(`${selectedOperations.length} change${selectedOperations.length === 1 ? "" : "s"} applied to the local draft. Click Save to persist this revision.`)
  }

  return <section className="border-t border-[#e8ede8] bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#334039]">Evidence-to-Flow Copilot</p><p className="text-[10px] text-[#929d95]">Suggestions require your approval</p></div><Sparkles size={15} className="text-[#6f927a]" /></div><div className="mt-3 space-y-3"><FormField label="Evidence type" info="Use a guideline or an AI-reviewed completed call."><Select value={sourceKind} onValueChange={(value) => setSourceKind(value as typeof sourceKind)}><SelectTrigger aria-label="Evidence type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guideline">Guideline or requested change</SelectItem><SelectItem value="call">Call review</SelectItem></SelectContent></Select></FormField><FormField label={sourceKind === "guideline" ? "What should the agent do?" : "What should change in this call?"} info="Copilot proposes the smallest safe graph patch it can justify."><Textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Describe the policy, issue, or desired behavior..." className="min-h-20" /></FormField><Button className="w-full justify-center" size="sm" variant="primary" onClick={analyze} disabled={loading}>{loading ? "Preparing suggestion..." : <><Sparkles size={13} /> Generate suggestion</>}</Button>{sourceCall && <p className="rounded-lg bg-[#f4f7f4] p-2 text-[10px] text-[#68766d]">Using completed call: {sourceCall.title}</p>}{proposal && <div className="space-y-3 border-t border-[#edf0ed] pt-3"><div className="rounded-xl bg-[#f4f7f4] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7a31]">AI review</p><p className="mt-2 text-[11px] leading-4 text-[#4d5c53]">{proposal.diagnosis.explanation}</p><p className="mt-2 text-[10px] text-[#7e8c82]">Confidence {Math.round(proposal.diagnosis.confidence * 100)}% · {proposal.diagnosis.category}</p></div>{proposal.operations.length === 0 ? <p className="rounded-lg bg-[#f4f7f4] p-3 text-[11px] text-[#65746b]">No change recommended for this evidence.</p> : <><div className="rounded-lg border border-[#dfe9df] bg-[#f7faf7] p-3 text-[10px] text-[#617168]">Preview shows {preview?.document.nodes.length ?? document.nodes.length} steps and {preview?.document.nodes.reduce((count, node) => count + node.edges.length, 0) ?? 0} transitions. It has not changed the saved graph.</div><div className="rounded-lg border border-[#dfe9df] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">Changes ready to review</p><div className="mt-2 space-y-1">{proposal.operations.map((operation, index) => <label key={index} className="flex gap-2 rounded-md p-1 text-[10px] text-[#5d6b62]"><input type="checkbox" checked={selected.includes(index)} onChange={(event) => { const next = event.target.checked ? [...selected, index] : selected.filter((item) => item !== index); setSelected(next); rebuildPreview(next) }} /><span>{operationSummary(operation)}</span></label>)}</div></div><details open className="rounded-lg border border-[#e5ebe5] p-2"><summary className="flex cursor-pointer items-center justify-between text-[10px] font-semibold text-[#5d6b62]">Operation details <ChevronDown size={12} /></summary><div className="mt-2 space-y-1">{proposal.operations.map((operation, index) => <p key={index} className="rounded-lg bg-[#f7faf7] p-2 text-[10px] text-[#5d6b62]"><strong>{operation.op.replaceAll("_", " ")}</strong></p>)}</div></details><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={() => preview && onPreviewCall(preview.document, `${draftVersion}-preview`)} disabled={!preview || previewBaseVersion !== draftVersion}><Play size={12} /> Test preview</Button><Button size="sm" variant="primary" onClick={applySelected} disabled={selectedOperations.length === 0 || !preview || previewBaseVersion !== draftVersion}><FileWarning size={12} /> Apply changes</Button></div></>}<Button size="sm" variant="ghost" onClick={() => { setProposal(undefined); clearPreview(); onProposalErrorChange(undefined); setNotice("Suggestion discarded. The graph was not changed.") }}><X size={12} /> Discard suggestion</Button></div>}{notice && <p className="flex gap-2 rounded-lg bg-[#f1f5f0] p-2 text-[10px] text-[#65746b]"><AlertTriangle size={12} className="shrink-0" />{notice}</p>}</div></section>
}
