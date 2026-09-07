import { Handle, Position, type NodeProps } from "@xyflow/react"
import { CircleUserRound, Flag, MessageSquareText, PhoneOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FlowNode } from "../model/type"

export function AgentNode({ data, selected }: NodeProps<FlowNode>) {
  const { node, isInitial } = data
  const isTerminal = node.end
  const description = node.task_messages[0]?.content ?? "No instructions yet."

  return (
    <div
      className={cn(
        "relative w-[286px] overflow-hidden rounded-xl border bg-white shadow-[0_8px_24px_rgba(31,48,40,0.08)] transition-shadow",
        selected ? "border-[#6d9078] shadow-[0_0_0_3px_rgba(109,144,120,0.16)]" : "border-[#e1e6e1]",
      )}
    >
      {!isInitial && <Handle className="!h-2 !w-2 !border-2 !border-white !bg-[#98aa9c]" position={Position.Top} type="target" />}
      <div className="flex items-center gap-2 border-b border-[#eef1ee] px-4 py-3">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", isInitial ? "bg-[#e9f0ea] text-[#62816a]" : isTerminal ? "bg-[#f3ece8] text-[#a47663]" : "bg-[#f0f3ef] text-[#6d7f72]")}>
          {isInitial ? <Flag size={14} /> : isTerminal ? <PhoneOff size={14} /> : <CircleUserRound size={15} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#27312c]">{node.name.replaceAll("_", " ")}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a9a2]">{isInitial ? "Entry point" : isTerminal ? "Terminal step" : "Conversation step"}</p>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <MessageSquareText size={14} className="mt-0.5 shrink-0 text-[#9aa69d]" />
          <p className="line-clamp-3 text-xs leading-5 text-[#78837b]">{description}</p>
        </div>
      </div>
      {node.edges.length > 0 && (
        <div className="border-t border-[#eef1ee] bg-[#fbfcfb] px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a9a2]">Transitions</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {node.edges.map((edge) => <span className="rounded-md bg-[#edf2ee] px-2 py-1 text-[10px] font-semibold text-[#647168]" key={edge.function}>{edge.function}</span>)}
          </div>
        </div>
      )}
      {!isTerminal && <Handle className="!h-2 !w-2 !border-2 !border-white !bg-[#98aa9c]" position={Position.Bottom} type="source" />}
    </div>
  )
}
