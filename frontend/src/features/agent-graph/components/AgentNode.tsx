import { Handle, Position, type NodeProps } from "@xyflow/react"
import { CircleUserRound, Flag, MessageSquareText, PhoneOff, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { NEW_TRANSITION_HANDLE, transitionHandleId, type FlowNode } from "../model/type"

export function AgentNode({ data, selected, dragging }: NodeProps<FlowNode>) {
  const { node, isInitial } = data
  const isTerminal = node.end
  const description = node.task_messages[0]?.content ?? "No instructions yet."

  return (
    <div
      className={cn(
        "relative w-[286px] overflow-visible rounded-xl border bg-white shadow-[0_8px_24px_rgba(31,48,40,0.08)] transition-[box-shadow,transform]",
        selected ? "border-[#6d9078] shadow-[0_0_0_3px_rgba(109,144,120,0.16)]" : "border-[#e1e6e1]",
        dragging && "z-50 scale-[1.02] cursor-grabbing shadow-[0_24px_55px_rgba(31,48,40,0.28)]",
      )}
    >
      <Handle id="target" className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#6d9078]" position={Position.Left} type="target" />
      <div className="flex items-center gap-2 border-b border-[#eef1ee] px-4 py-3">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", isInitial ? "bg-[#e9f0ea] text-[#62816a]" : isTerminal ? "bg-[#f3ece8] text-[#a47663]" : "bg-[#f0f3ef] text-[#6d7f72]")}>
          {isInitial ? <Flag size={14} /> : isTerminal ? <PhoneOff size={14} /> : <CircleUserRound size={15} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#27312c]">{node.name}</p>
          {(isInitial || isTerminal) && <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a9a2]">{isInitial ? "Entry point" : "Terminal"}</p>}
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <MessageSquareText size={14} className="mt-0.5 shrink-0 text-[#9aa69d]" />
          <p className="line-clamp-3 text-xs leading-5 text-[#78837b]">{description}</p>
        </div>
      </div>
      {!isTerminal && (
        <div className="border-t border-[#eef1ee] bg-[#fbfcfb] px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a9a2]">Transitions</p>
          <div className="mt-1 space-y-1">
            {node.edges.map((edge) => (
              <div className="relative rounded-md bg-[#edf2ee] px-2 py-1 text-[10px] font-semibold text-[#647168]" key={edge.function}>
                <Handle id={transitionHandleId(edge.function)} className="!right-[-9px] !h-2.5 !w-2.5 !border-2 !border-white !bg-[#6d9078]" position={Position.Right} type="source" />
                {edge.function}
              </div>
            ))}
            <div className="relative flex items-center gap-1 rounded-md border border-dashed border-[#c8d3ca] px-2 py-1 text-[10px] font-semibold text-[#829187]">
              <Handle id={NEW_TRANSITION_HANDLE} className="!right-[-9px] !h-2.5 !w-2.5 !border-2 !border-white !bg-[#91a697]" position={Position.Right} type="source" />
              <Plus size={10} /> Add transition
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
