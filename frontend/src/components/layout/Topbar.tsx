import { AlertCircle, Check, ChevronDown, PhoneCall, Share2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { AgentValidationError } from "@/features/agent-graph/model/type"

interface TopbarProps {
  onTestCall: () => void
  isDirty: boolean
  validationErrors: AgentValidationError[]
}

export function Topbar({ onTestCall, isDirty, validationErrors }: TopbarProps) {
  const blockingErrors = validationErrors.filter((error) => error.severity === "error")
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e5e8e4] bg-white px-7">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[#202923]">Prosper Scheduler</h1>
            <ChevronDown size={15} className="text-[#8f9992]" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8f9992]">
            {blockingErrors.length > 0 ? <AlertCircle size={12} className="text-[#b17662]" /> : <Check size={12} className="text-[#5e876b]" />}
            {blockingErrors.length > 0 ? `${blockingErrors.length} validation error${blockingErrors.length === 1 ? "" : "s"}` : isDirty ? "Unsaved changes" : "Saved just now"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost">
          <Share2 size={14} />
          Share
        </Button>
        <Button size="sm" variant="primary" onClick={onTestCall}>
          <PhoneCall size={14} />
          Test call
        </Button>
      </div>
    </header>
  )
}
