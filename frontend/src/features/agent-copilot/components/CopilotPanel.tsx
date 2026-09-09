import { AlertTriangle, FileWarning, Play, Sparkles, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { FormField } from "@/components/ui/FormField"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import type { AgentDocument, AgentValidationError, CallRecord } from "@/features/agent-graph/model/type"
import { createCopilotProposal } from "@/lib/agentApi"
import { applyGraphOperations } from "../lib/operationApplier"
import type { ChangeProposal, EvidenceSource, GraphOperation, OperationPreview } from "../model/type"

interface CopilotPanelProps {
  document: AgentDocument
  draftVersion: string
  initialSource?: EvidenceSource
  autoAnalyze?: boolean
  onApplyOperations: (operations: GraphOperation[], acceptedIndices?: number[]) => { errors: AgentValidationError[] }
  onSave: () => void
  onPreviewCall: (document: AgentDocument, draftVersion: string) => void
}

export function CopilotPanel({ document, draftVersion, initialSource, autoAnalyze = false, onApplyOperations, onSave, onPreviewCall }: CopilotPanelProps) {
  const [sourceKind, setSourceKind] = useState<"guideline" | "feedback" | "call">(initialSource?.kind ?? "guideline")
  const [sourceText, setSourceText] = useState(initialSource?.text ?? "")
  const [sourceCall, setSourceCall] = useState<CallRecord | undefined>(initialSource?.kind === "call" ? initialSource.call : undefined)
  const [proposal, setProposal] = useState<ChangeProposal>()
  const [selected, setSelected] = useState<number[]>([])
  const [preview, setPreview] = useState<OperationPreview>()
  const [notice, setNotice] = useState<string>()
  const [loading, setLoading] = useState(false)
  const autoAnalyzedSource = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!initialSource) return
    setSourceKind(initialSource.kind === "call" ? "call" : initialSource.kind)
    setSourceText(initialSource.text)
    setSourceCall(initialSource.kind === "call" ? initialSource.call : undefined)
    setProposal(undefined)
    setPreview(undefined)
    setNotice(undefined)
  }, [initialSource])

  const requestProposal = useCallback(async (source: EvidenceSource) => {
    if (!source.text.trim()) {
      setNotice("Add a guideline or feedback note before asking Copilot to review it.")
      return
    }
    setLoading(true)
    setNotice(undefined)
    try {
      const next = await createCopilotProposal({ document, baseVersion: draftVersion, source: { kind: source.kind, text: source.text.trim(), call: source.kind === "call" ? source.call : undefined } })
      setProposal(next)
      setSelected(next.operations.map((_operation: GraphOperation, index: number) => index))
      setPreview(undefined)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Copilot could not create a proposal.")
    } finally {
      setLoading(false)
    }
  }, [document, draftVersion])
  useEffect(() => {
    if (!autoAnalyze || !initialSource) return
    const sourceKey = `${initialSource.kind}:${initialSource.text}`
    if (autoAnalyzedSource.current === sourceKey) return
    autoAnalyzedSource.current = sourceKey
    void requestProposal(initialSource)
  }, [autoAnalyze, initialSource, requestProposal])

  const selectedOperations = useMemo(() => proposal?.operations.filter((_, index) => selected.includes(index)) ?? [], [proposal, selected])
  const analyze = () => {
    const source: EvidenceSource = sourceKind === "call"
      ? { kind: "call", traceId: sourceCall?.id ?? "current-call", text: sourceText, call: sourceCall }
      : { kind: sourceKind, text: sourceText }
    void requestProposal(source)
  }
  const buildPreview = () => {
    if (!proposal) return
    const next = applyGraphOperations({ config: document, layout: {} }, proposal.operations, selected)
    if (next.errors.some((error) => error.severity === "error")) {
      setNotice(next.errors.map((error) => error.message).join(" "))
      return
    }
    setPreview(next)
    setNotice("The proposal is valid as an immutable preview. You can test it before applying it.")
  }
  const applySelected = () => {
    if (!proposal || selectedOperations.length === 0) return
    const result = onApplyOperations(proposal.operations, selected)
    if (result.errors.some((error) => error.severity === "error")) {
      setNotice("The selected operations produced validation errors and were not applied.")
      return
    }
    setProposal({ ...proposal, status: "approved" })
    setNotice(`${selectedOperations.length} operation${selectedOperations.length === 1 ? "" : "s"} applied to the local draft.`)
  }

  return <section className="border-t border-[#e8ede8] bg-white p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#334039]">Evidence-to-Flow Copilot</p><p className="text-[10px] text-[#929d95]">AI proposals require review</p></div><Sparkles size={15} className="text-[#6f927a]" /></div><div className="mt-3 space-y-3"><FormField label="Evidence type" info="Tell Copilot whether you are providing a guideline, call feedback, or a selected call."><Select value={sourceKind} onValueChange={(value) => setSourceKind(value as typeof sourceKind)}><SelectTrigger aria-label="Evidence type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guideline">Guideline</SelectItem><SelectItem value="feedback">Feedback</SelectItem><SelectItem value="call">Call evidence</SelectItem></SelectContent></Select></FormField><FormField label={sourceKind === "guideline" ? "What should the agent do?" : "What should improve?"} info="Copilot uses this text together with the current graph. It will return no change when the evidence does not justify a safe patch."><Textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Describe the policy, issue, or desired behavior..." className="min-h-20" /></FormField><Button className="w-full justify-center" size="sm" variant="primary" onClick={analyze} disabled={loading}>{loading ? "Reviewing evidence..." : <><Sparkles size={13} /> Analyze with Copilot</>}</Button>{sourceCall && <p className="rounded-lg bg-[#f4f7f4] p-2 text-[10px] text-[#68766d]">Using call: {sourceCall.title}</p>}{proposal && <div className="space-y-3 border-t border-[#edf0ed] pt-3"><div className="rounded-xl bg-[#f4f7f4] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7a31]">Diagnosis</p><p className="mt-2 text-[11px] leading-4 text-[#4d5c53]">{proposal.diagnosis.explanation}</p><p className="mt-2 text-[10px] text-[#7e8c82]">Confidence {Math.round(proposal.diagnosis.confidence * 100)}% · {proposal.diagnosis.category}</p></div><div className="grid gap-2 text-[10px] text-[#68736c]"><p><strong>Assumption:</strong> {proposal.assumptions[0] ?? "None stated."}</p><p><strong>Question:</strong> {proposal.questions[0] ?? "None."}</p><p><strong>Risk:</strong> {proposal.risks[0]?.reason ?? "No additional risk stated."}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#758279]">Proposed changes</p>{proposal.operations.length === 0 ? <p className="mt-2 rounded-lg bg-[#f4f7f4] p-2 text-[10px] text-[#65746b]">No change recommended for this evidence.</p> : <div className="mt-1 space-y-1">{proposal.operations.map((operation, index) => <label key={index} className="flex gap-2 rounded-lg border border-[#e5ebe5] p-2 text-[10px] text-[#5d6b62]"><input type="checkbox" checked={selected.includes(index)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))} /><span><strong>{operation.op.replaceAll("_", " ")}</strong> {"nodeId" in operation ? operation.nodeId : "sourceNodeId" in operation ? operation.sourceNodeId : ""}</span></label>)}</div>}</div>{proposal.tests[0] && <div className="rounded-xl border border-[#e7ece7] bg-[#fafcf9] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#758279]">Regression test</p><p className="mt-1 text-[11px] font-semibold text-[#4d5c53]">{proposal.tests[0].name}</p><p className="mt-1 text-[10px] leading-4 text-[#7a887e]">{proposal.tests[0].expectedOutcome}</p>{proposal.tests[0].assertions.map((assertion) => <p key={assertion.id} className="mt-1 text-[10px] text-[#748077]">• {assertion.label}: {assertion.expected}</p>)}</div>}<div className="grid grid-cols-2 gap-2"><Button size="sm" variant="secondary" onClick={buildPreview} disabled={selectedOperations.length === 0}><FileWarning size={12} /> Preview</Button><Button size="sm" variant="secondary" onClick={() => preview && onPreviewCall(preview.document, `${draftVersion}-preview`)} disabled={!preview}><Play size={12} /> Test preview</Button></div>{preview && <div className="rounded-lg border border-[#dfe9df] bg-[#f7faf7] p-2 text-[10px] text-[#617168]">Preview contains {preview.document.nodes.length} nodes and {preview.document.nodes.reduce((count, node) => count + node.edges.length, 0)} transitions. It has not changed the active draft.</div>}<div className="grid grid-cols-2 gap-2"><Button size="sm" variant="primary" onClick={applySelected} disabled={selectedOperations.length === 0 || proposal.status === "rejected"}>Apply selected</Button><Button size="sm" variant="secondary" onClick={onSave} disabled={proposal.status !== "approved"}>Save revision</Button></div><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { setProposal({ ...proposal, status: "rejected" }); setNotice("Proposal rejected. The draft was not changed.") }} disabled={proposal.status === "rejected"}><X size={12} /> Reject</Button><Button size="sm" variant="ghost" onClick={() => { setProposal(undefined); setPreview(undefined) }}>Clear</Button></div></div>}{notice && <p className="flex gap-2 rounded-lg bg-[#f1f5f0] p-2 text-[10px] text-[#65746b]"><AlertTriangle size={12} className="shrink-0" />{notice}</p>}</div></section>
}
