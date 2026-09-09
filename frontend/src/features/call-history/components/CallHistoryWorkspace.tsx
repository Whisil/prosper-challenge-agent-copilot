import { Clock3, FileWarning, MessageSquareText, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Textarea"
import type { CallRecord } from "@/features/agent-graph/model/type"
import { updateCallFeedback } from "../lib/callHistoryStorage"

interface CallHistoryWorkspaceProps {
  records: CallRecord[]
  onRecordsChange: (records: CallRecord[]) => void
  onAnalyze: (record: CallRecord, text: string) => void
}

export function CallHistoryWorkspace({ records, onRecordsChange, onAnalyze }: CallHistoryWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.id)
  const selected = records.find((record) => record.id === selectedId)
  const [feedback, setFeedback] = useState(selected?.feedback ?? "")

  const selectRecord = (record: CallRecord) => {
    setSelectedId(record.id)
    setFeedback(record.feedback ?? "")
  }
  const saveFeedback = () => {
    if (!selected) return
    onRecordsChange(updateCallFeedback(selected.id, feedback))
  }

  return <div className="flex min-h-0 flex-1 bg-[#f7f8f6]"><aside className="w-[300px] shrink-0 overflow-y-auto border-r border-[#e3e8e3] bg-white p-4"><div className="flex items-center gap-2"><Clock3 size={15} className="text-[#6c8d76]" /><div><h2 className="text-sm font-semibold text-[#27332c]">Call history</h2><p className="text-[10px] text-[#929d95]">Local test sessions and demo evidence</p></div></div><div className="mt-4 space-y-2">{records.map((record) => <button key={record.id} type="button" onClick={() => selectRecord(record)} className={`w-full rounded-xl border p-3 text-left ${record.id === selectedId ? "border-[#9cb7a2] bg-[#eef4ee]" : "border-[#e5ebe5] hover:bg-[#f7faf7]"}`}><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold text-[#415047]">{record.title}</p>{record.isDemo && <span className="rounded-full bg-[#f3ead2] px-1.5 py-0.5 text-[9px] text-[#947536]">DEMO</span>}</div><p className="mt-1 text-[10px] text-[#929d95]">{new Date(record.startedAt).toLocaleString()} · {record.status}</p><p className="mt-1 truncate text-[10px] text-[#718078]">{record.draftVersion}</p></button>)}</div></aside><main className="min-w-0 flex-1 overflow-y-auto p-6">{selected ? <div className="mx-auto max-w-2xl space-y-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87958b]">Call detail</p><h2 className="mt-1 text-xl font-semibold text-[#27332c]">{selected.title}</h2><p className="mt-1 text-[11px] text-[#829087]">Draft {selected.draftVersion} · {selected.status}</p></div><section className="rounded-2xl border border-[#e2e9e2] bg-white p-4"><div className="flex items-center gap-2"><MessageSquareText size={15} className="text-[#76927d]" /><h3 className="text-xs font-semibold text-[#46554b]">What happened</h3></div><div className="mt-3 space-y-2">{selected.events.map((event, index) => <div key={`${event.timestamp}-${index}`} className="rounded-lg bg-[#f6f8f5] p-2"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#849188]">{event.kind.replaceAll("_", " ")}</p><p className="mt-1 text-[11px] text-[#58675d]">{event.message ?? "Event recorded."}</p></div>)}</div></section><section className="rounded-2xl border border-[#e2e9e2] bg-white p-4"><div className="flex items-center gap-2"><FileWarning size={15} className="text-[#a47c42]" /><h3 className="text-xs font-semibold text-[#46554b]">Feedback for Copilot</h3></div><p className="mt-1 text-[10px] leading-4 text-[#89958d]">Describe what should improve. The trace and this note will be sent to the AI reviewer.</p><Textarea className="mt-3 min-h-24" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="e.g. The agent disclosed availability before verifying identity." /><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={saveFeedback}>Save feedback</Button><Button size="sm" variant="primary" onClick={() => { saveFeedback(); onAnalyze(selected, feedback) }}><Sparkles size={13} /> Analyze with Copilot</Button></div></section></div> : <div className="flex h-full items-center justify-center text-sm text-[#839087]">No call selected.</div>}</main></div>
}
