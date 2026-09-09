import { AlertTriangle, CheckCircle2, Clock3, FileWarning, HelpCircle, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import type { CallRecord, CallReview } from "@/features/agent-graph/model/type"
import { summarizeTraceEvent } from "../lib/callHistoryStorage"

interface CallHistoryWorkspaceProps {
  records: CallRecord[]
  onPropose: (record: CallRecord, review: CallReview) => void
  onRetryReview: (record: CallRecord) => void
}

function ReviewStatus({ status, resolved = false }: { status: CallReview["status"]; resolved?: boolean }) {
  if (resolved) return <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f2e9] px-2 py-1 text-[10px] font-semibold text-[#4f7d5b]"><CheckCircle2 size={12} /> Resolved</span>
  if (status === "passed") return <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f2e9] px-2 py-1 text-[10px] font-semibold text-[#4f7d5b]"><CheckCircle2 size={12} /> Looks good</span>
  if (status === "needs_attention") return <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1e7] px-2 py-1 text-[10px] font-semibold text-[#a26347]"><AlertTriangle size={12} /> Needs attention</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f1] px-2 py-1 text-[10px] font-semibold text-[#7a867d]"><HelpCircle size={12} /> Review unavailable</span>
}

function formatDuration(record: CallRecord) {
  if (!record.endedAt) return "in progress"
  return `${Math.max(1, Math.round((Date.parse(record.endedAt) - Date.parse(record.startedAt)) / 1000))}s`
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function outcome(record: CallRecord) {
  if (record.status === "failed") return { label: "Call failed", tone: "text-[#a26347]" }
  if (record.events.some((event) => event.kind === "handoff")) return { label: "Handed to staff", tone: "text-[#a26347]" }
  if (record.status === "completed") return { label: "Completed", tone: "text-[#4f7d5b]" }
  return { label: "In progress", tone: "text-[#708078]" }
}

export function CallHistoryWorkspace({ records, onPropose, onRetryReview }: CallHistoryWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id)
  const selected = records.find((record) => record.id === selectedId)

  useEffect(() => {
    if (!selectedId || !records.some((record) => record.id === selectedId)) setSelectedId(records[0]?.id)
  }, [records, selectedId])

  return <div className="flex min-h-0 flex-1 bg-[#f7f8f6]"><aside className="w-[330px] shrink-0 overflow-y-auto border-r border-[#e3e8e3] bg-white p-4"><div className="flex items-center gap-2"><Clock3 size={15} className="text-[#6c8d76]" /><div><h2 className="text-sm font-semibold text-[#27332c]">Call history</h2><p className="text-[10px] text-[#929d95]">Completed calls and AI reviews</p></div></div><div className="mt-4 space-y-2">{records.map((record) => <button key={record.id} type="button" onClick={() => setSelectedId(record.id)} className={`w-full rounded-xl border p-3 text-left ${record.id === selectedId ? "border-[#9cb7a2] bg-[#eef4ee]" : "border-[#e5ebe5] hover:bg-[#f7faf7]"}`}><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold text-[#415047]">{record.title}</p>{record.isSample && <span className="rounded-full bg-[#f3ead2] px-1.5 py-0.5 text-[9px] text-[#947536]">SAMPLE</span>}</div><p className="mt-1 text-[10px] text-[#929d95]">{new Date(record.startedAt).toLocaleString()} · {record.status}</p><p className="mt-1 truncate text-[10px] text-[#718078]">{record.agentName ?? record.draftVersion}</p>{record.review && <div className="mt-2"><ReviewStatus status={record.review.status} resolved={record.review.resolution === "resolved"} /></div>}</button>)}</div></aside><main className="min-w-0 flex-1 overflow-y-auto p-6">{selected ? <div className="mx-auto max-w-3xl space-y-5"><header><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87958b]">Call detail</p><h2 className="mt-1 text-xl font-semibold text-[#27332c]">{selected.title}</h2><p className="mt-1 text-[11px] text-[#829087]">{selected.agentName ?? selected.draftVersion} · {formatDuration(selected)}</p></header><section className="grid gap-3 sm:grid-cols-4">{[["Outcome", outcome(selected).label], ["Path", `${selected.events.filter((event) => event.kind === "node_entered").length} steps`], ["Actions", `${selected.events.filter((event) => event.kind === "tool_call" || event.kind === "handoff").length} tool or handoff`], ["Review", selected.review?.resolution === "resolved" ? "Resolved" : selected.review?.status === "needs_attention" ? "Needs attention" : selected.review ? "Looks good" : selected.reviewState === "pending" ? "Reviewing" : "Unavailable"]].map(([label, value], index) => <div key={label} className="rounded-xl border border-[#e2e9e2] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#919c94]">{label}</p><p className={`mt-1 text-[11px] font-semibold ${index === 0 ? outcome(selected).tone : "text-[#4d5d53]"}`}>{value}</p></div>)}</section><section className="rounded-2xl border border-[#e2e9e2] bg-white p-4"><div className="flex items-center gap-2"><Clock3 size={15} className="text-[#76927d]" /><div><h3 className="text-xs font-semibold text-[#46554b]">What happened</h3><p className="text-[10px] text-[#8a968d]">A short explanation of each recorded runtime step.</p></div></div><div className="mt-4 space-y-3">{selected.events.length === 0 ? <p className="rounded-lg bg-[#f6f8f5] p-3 text-[11px] text-[#718078]">No runtime steps were recorded.</p> : selected.events.map((event, index) => { const summary = summarizeTraceEvent(event); return <div key={`${event.timestamp}-${index}`} className="flex gap-3"><div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef4ee] text-[#66856f]">{summary.tone === "warning" ? <AlertTriangle size={12} className="text-[#a56d4e]" /> : summary.tone === "pass" ? <CheckCircle2 size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#75927c]" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[11px] font-semibold text-[#46554b]">{summary.title}</p><time className="text-[10px] text-[#9aa49d]">{formatTime(event.timestamp)}</time></div><p className="mt-0.5 text-[11px] leading-4 text-[#718078]">{summary.detail}</p></div></div> })}</div></section><section className="rounded-2xl border border-[#e2e9e2] bg-white p-4"><div className="flex items-center gap-2"><Sparkles size={15} className="text-[#76927d]" /><div><h3 className="text-xs font-semibold text-[#46554b]">AI call review</h3><p className="text-[10px] text-[#8a968d]">The review starts after the workflow reaches an end or handoff step.</p></div></div>{selected.review ? <div className="mt-4 space-y-3"><ReviewStatus status={selected.review.status} resolved={selected.review.resolution === "resolved"} /><p className="text-[12px] leading-5 text-[#526159]">{selected.review.summary}</p>{selected.review.issues.map((issue) => <div key={`${issue.title}-${issue.nodeId ?? ""}`} className="rounded-xl border border-[#f0ded5] bg-[#fffaf7] p-3"><p className="text-[11px] font-semibold text-[#704e40]">{issue.title}</p><p className="mt-1 text-[11px] leading-4 text-[#856d63]">{issue.explanation}</p></div>)}{selected.review.status === "unavailable" ? <><p className="text-[10px] text-[#a26347]">{selected.review.error}</p><Button size="sm" variant="secondary" onClick={() => onRetryReview(selected)}>Retry AI review</Button></> : selected.review.resolution === "resolved" ? <p className="rounded-lg bg-[#f4f8f4] p-3 text-[11px] text-[#66816e]">This suggested fix was applied and the issue is resolved.</p> : selected.review.recommendedAction === "propose_changes" ? <Button size="sm" variant="primary" onClick={() => onPropose(selected, selected.review!)}><FileWarning size={13} /> Generate suggested fix</Button> : <p className="rounded-lg bg-[#f4f8f4] p-3 text-[11px] text-[#66816e]">No change recommended for this call.</p>}</div> : <div className="mt-4 rounded-lg bg-[#f6f8f5] p-3 text-[11px] text-[#718078]">{selected.reviewState === "pending" ? "Reviewing this call…" : "Review is unavailable for this call."}</div>}</section></div> : <div className="flex h-full items-center justify-center text-sm text-[#839087]">No call selected.</div>}</main></div>
}
