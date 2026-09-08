import { Maximize2, MousePointer2, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface GraphToolbarProps {
  onFitView: () => void
  onAddNode: () => void
}

export function GraphToolbar({ onFitView, onAddNode }: GraphToolbarProps) {
  return (
    <div className="absolute left-5 top-5 z-10 flex items-center gap-1 rounded-xl border border-[#e1e6e1] bg-white/95 p-1 shadow-[0_6px_18px_rgba(31,48,40,0.07)] backdrop-blur">
      <Button size="sm" variant="ghost" title="Select tool"><MousePointer2 size={14} /></Button>
      <Button size="sm" variant="ghost" title="Fit graph" onClick={onFitView}><Maximize2 size={14} /></Button>
      <Button size="sm" variant="ghost" title="Add node" onClick={onAddNode}><Plus size={14} /></Button>
    </div>
  )
}
