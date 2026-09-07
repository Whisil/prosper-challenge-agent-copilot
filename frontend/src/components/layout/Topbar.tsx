import { Check, ChevronDown, PhoneCall, Share2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface TopbarProps {
  onTestCall: () => void
}

export function Topbar({ onTestCall }: TopbarProps) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e5e8e4] bg-white px-7">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[#202923]">Prosper Scheduler</h1>
            <ChevronDown size={15} className="text-[#8f9992]" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8f9992]">
            <Check size={12} className="text-[#5e876b]" />
            Saved just now
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
