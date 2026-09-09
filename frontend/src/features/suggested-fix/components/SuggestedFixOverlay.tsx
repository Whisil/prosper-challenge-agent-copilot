import { LoaderCircle, X } from "lucide-react"
import type { SuggestedFixState } from "../model/type"

interface SuggestedFixOverlayProps {
  state: SuggestedFixState
  onDismissError: () => void
}

export function SuggestedFixOverlay({ state, onDismissError }: SuggestedFixOverlayProps) {
  if (state.status === "loading") {
    return <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"><div className="flex items-center gap-2 rounded-xl bg-[#182019] px-4 py-3 text-xs font-semibold text-white shadow-xl"><LoaderCircle size={15} className="animate-spin" /> AI is generating fixes</div></div>
  }
  if (state.status === "ready" && state.response) {
    return <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#e5b8ae] bg-[#fff7f4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b56154] shadow-sm">Suggested changes · not applied</div>
  }
  if (state.status === "error" || state.status === "stale") {
    return <div role="alert" className="absolute left-1/2 top-5 z-40 w-[min(560px,calc(100%-48px))] -translate-x-1/2 rounded-xl border border-[#edcfc4] bg-white px-4 py-3 pr-10 text-[11px] leading-5 text-[#805b4c] shadow-lg"><button type="button" aria-label="Dismiss suggested fix error" title="Dismiss" onClick={onDismissError} className="absolute right-2 top-2 rounded p-1 text-[#9c705f] hover:bg-[#fff4ef]"><X size={14} /></button><strong>{state.status === "stale" ? "Suggested fix is stale." : "AI could not prepare a suggestion."}</strong><br />{state.error}</div>
  }
  return null
}
