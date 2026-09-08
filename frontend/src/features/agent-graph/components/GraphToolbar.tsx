import { ArrowRightLeft, Flag, GitBranch, Maximize2, MessageSquareText, MousePointer2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { NodeCreationKind } from "../model/type"

interface GraphToolbarProps {
  onFitView: () => void
  onAddNode: (kind: NodeCreationKind) => void
}

export function GraphToolbar({ onFitView, onAddNode }: GraphToolbarProps) {
  return (
    <div className="absolute left-5 top-5 z-10 flex items-center gap-1 rounded-xl border border-[#e1e6e1] bg-white/95 p-1 shadow-[0_6px_18px_rgba(31,48,40,0.07)] backdrop-blur">
      <Button aria-label="Select tool" size="sm" variant="ghost" title="Select tool"><MousePointer2 size={14} /></Button>
      <Button aria-label="Fit graph" size="sm" variant="ghost" title="Fit graph" onClick={onFitView}><Maximize2 size={14} /></Button>
      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" variant="ghost" title="Add conversation node" onClick={() => onAddNode("conversation")}><MessageSquareText size={12} /> Conversation</Button>
      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" variant="ghost" title="Add tool node" onClick={() => onAddNode("tool")}><Wrench size={12} /> Tool</Button>
      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" variant="ghost" title="Add branch node" onClick={() => onAddNode("branch")}><GitBranch size={12} /> Branch</Button>
      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" variant="ghost" title="Add transfer node" onClick={() => onAddNode("transfer")}><ArrowRightLeft size={12} /> Transfer</Button>
      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" variant="ghost" title="Add end node" onClick={() => onAddNode("end")}><Flag size={12} /> End</Button>
    </div>
  )
}
