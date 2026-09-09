import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { SuggestedFixState } from "../model/type"

interface SuggestedFixToastProps {
  state: SuggestedFixState
  onAccept: () => void
  onDeny: () => void
}

export function SuggestedFixToast({ state, onAccept, onDeny }: SuggestedFixToastProps) {
  if (state.status !== "ready" || !state.response) return null
  return <aside role="status" className="absolute bottom-5 left-1/2 z-50 w-[min(520px,calc(100%-40px))] -translate-x-1/2 rounded-xl border border-[#d7e3d8] bg-white p-3 shadow-[0_12px_34px_rgba(31,48,40,0.2)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#334039]">Problem found</p><p className="mt-1 text-[11px] leading-4 text-[#66746b]">{state.response.diagnosis}</p><ul className="mt-2 space-y-1 text-[10px] text-[#718078]">{state.response.changes.map((change) => <li key={change}>• {change}</li>)}</ul></div><span className="shrink-0 whitespace-nowrap rounded-full border border-[#e5b8ae] bg-[#fff7f4] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#b56154]">Not applied</span></div><div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="secondary" onClick={onDeny}><X size={12} /> Deny</Button><Button type="button" size="sm" variant="primary" onClick={onAccept}><Check size={12} /> Accept</Button></div></aside>
}
