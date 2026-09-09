import { Activity, CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { TestSession } from "@/features/agent-graph/model/type"

interface TestSessionPanelProps {
  session?: TestSession
  message?: string
  pendingUrl?: string
  onOpenPending?: () => void
  onDismissMessage?: () => void
  onDismiss?: () => void
}

export function TestSessionPanel({ session, message, pendingUrl, onOpenPending, onDismissMessage, onDismiss }: TestSessionPanelProps) {
  if (!session && !message) return null
  if (!session) return <aside className="absolute bottom-5 left-1/2 z-20 w-[min(440px,calc(100%-40px))] -translate-x-1/2 rounded-xl border border-[#e5d8ae] bg-white/95 p-3 text-[11px] text-[#765f2e] shadow-[0_12px_30px_rgba(31,48,40,0.14)] backdrop-blur"><div className="flex items-start justify-between gap-3"><p>{message}</p><Button type="button" size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" aria-label="Dismiss test-call notice" onClick={onDismissMessage}><X size={13} /></Button></div>{pendingUrl && <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={onOpenPending}>Open test call</Button>}</aside>
  const statusIcon = session.status === "connected" ? <Activity size={14} /> : session.status === "completed" ? <CheckCircle2 size={14} /> : session.status === "failed" ? <CircleAlert size={14} /> : <LoaderCircle className="animate-spin" size={14} />

  return <aside className="absolute bottom-5 left-1/2 z-20 w-[min(440px,calc(100%-40px))] -translate-x-1/2 rounded-xl border border-[#dfe7df] bg-white/95 p-3 shadow-[0_12px_30px_rgba(31,48,40,0.14)] backdrop-blur"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#455249]">{statusIcon} Test call · {session.draftVersion}</div><div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-[0.12em] text-[#8b968e]">{session.status}</span><Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Dismiss test call status" onClick={onDismiss}><X size={13} /></Button></div></div>{session.events.length > 0 && <div className="mt-2 space-y-1 border-t border-[#edf0ed] pt-2">{session.events.slice(-3).map((event, index) => <p className="truncate text-[10px] text-[#7b877e]" key={`${event.timestamp}-${index}`}>{event.message ?? event.kind}</p>)}</div>}</aside>
}
