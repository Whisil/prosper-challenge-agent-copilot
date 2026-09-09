import { History, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { AgentDraft } from "@/features/agent-graph/model/type"

interface DraftHistoryPanelProps {
  snapshots: AgentDraft[]
  currentRevision: number
  onRestore: (snapshot: AgentDraft) => void
  onClose: () => void
}

export function DraftHistoryPanel({ snapshots, currentRevision, onRestore, onClose }: DraftHistoryPanelProps) {
  return <section className="absolute right-5 top-[66px] z-50 w-[min(92vw,360px)] rounded-2xl border border-[#dfe6df] bg-white p-4 shadow-[0_18px_45px_rgba(31,48,40,0.18)]"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><History size={15} className="text-[#6f927a]" /><div><p className="text-xs font-bold text-[#334039]">Draft history</p><p className="text-[10px] text-[#929d95]">Local immutable snapshots</p></div></div><Button size="sm" variant="ghost" onClick={onClose} aria-label="Close draft history"><X size={13} /></Button></div>{snapshots.length === 0 ? <p className="mt-4 rounded-lg bg-[#f5f7f4] p-3 text-[11px] text-[#748077]">Save a draft to create the first revision.</p> : <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{snapshots.map((snapshot) => <div key={`${snapshot.config.id}-${snapshot.config.revision}`} className="flex items-center justify-between gap-2 rounded-xl border border-[#e8ede8] p-3"><div><p className="text-[11px] font-semibold text-[#4c5b52]">Revision {snapshot.config.revision}</p><p className="text-[10px] text-[#929d95]">{snapshot.config.nodes.length} nodes {snapshot.config.revision === currentRevision ? "· current" : ""}</p></div><Button size="sm" variant="ghost" onClick={() => onRestore(snapshot)} disabled={snapshot.config.revision === currentRevision}><RotateCcw size={12} /> Restore</Button></div>)}</div>}</section>
}
