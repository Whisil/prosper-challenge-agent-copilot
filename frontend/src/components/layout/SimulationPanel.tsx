import { Play, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { AgentDocument, TestSession } from "@/features/agent-graph/model/type"
import { simulateAgent, simulationScenarios, type SimulationScenarioId } from "@/features/agent-simulation/lib/simulateAgent"

interface SimulationPanelProps {
  document: AgentDocument
  open: boolean
  onClose: () => void
}

export function SimulationPanel({ document, open, onClose }: SimulationPanelProps) {
  const [scenario, setScenario] = useState<SimulationScenarioId>("normal-booking")
  const [result, setResult] = useState<Pick<TestSession, "status" | "events">>()
  if (!open) return null

  return <section className="absolute bottom-4 left-1/2 z-40 w-[min(92vw,620px)] -translate-x-1/2 rounded-2xl border border-[#dfe6df] bg-white p-4 shadow-[0_18px_45px_rgba(31,48,40,0.18)]">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#334039]">Simulate draft</p><p className="text-[10px] text-[#929d95]">Deterministic demo scenarios for {document.id}-v{document.revision}.</p></div><Button size="sm" variant="ghost" onClick={onClose} aria-label="Close simulator"><X size={14} /></Button></div>
    <div className="mt-3 flex flex-wrap gap-2">{simulationScenarios.map((item) => <button key={item.id} type="button" onClick={() => { setScenario(item.id); setResult(undefined) }} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${scenario === item.id ? "border-[#91a697] bg-[#e9f0ea] text-[#49634f]" : "border-[#e3e9e3] text-[#748077] hover:bg-[#f6f8f5]"}`}>{item.label}</button>)}</div>
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#f5f7f4] p-3"><p className="text-[11px] leading-4 text-[#68736c]">Runs without a live call or backend side effect. Use it to inspect the first draft path before testing audio.</p><Button size="sm" variant="primary" onClick={() => setResult(simulateAgent(document, scenario))}><Play size={13} /> Run scenario</Button></div>
    {result && <div className="mt-3 border-t border-[#edf0ed] pt-3"><p className="text-[11px] font-semibold text-[#455249]">{result.status === "completed" ? "Scenario completed" : "Scenario needs review"}</p><div className="mt-1 space-y-1">{result.events.map((event, index) => <p key={`${event.timestamp}-${index}`} className="text-[10px] text-[#8b968e]">{event.kind.replaceAll("_", " ")} — {event.message}</p>)}</div></div>}
  </section>
}
