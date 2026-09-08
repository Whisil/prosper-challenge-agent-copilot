import { Handle, Position, useConnection, type NodeProps } from "@xyflow/react"
import { AlertCircle, ArrowRightLeft, CircleUserRound, Flag, GitBranch, MessageSquareText, PhoneOff, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { NEW_TRANSITION_HANDLE, type FlowNode } from "../model/type"
import { humanizeIdentifier } from "../lib/identifier"

export function AgentNode({ data, selected, dragging }: NodeProps<FlowNode>) {
  const { node, isInitial, validationErrors } = data
  const connection = useConnection()
  const nodeType = node.type ?? (node.end ? "end" : "conversation")
  const isTerminal = nodeType === "end" || Boolean(node.end)
  const nodeTypeLabel = nodeType === "end" ? "End" : nodeType === "tool" ? "Tool" : nodeType === "branch" ? "Branch" : nodeType === "transfer" ? "Transfer" : "Conversation"
  const isConnectionTarget = Boolean(connection.inProgress && connection.fromNode?.id !== node.name)
  const isInvalidConnectionTarget = Boolean(connection.inProgress && connection.fromNode?.id === node.name)
  const isConnectionSource = Boolean(connection.inProgress && connection.fromNode?.id === node.name)
  const hasErrors = validationErrors.some((error) => error.severity === "error")
  const hasWarnings = validationErrors.some((error) => error.severity === "warning")
  const description = node.task_messages[0]?.content ?? "No instructions yet."

  return (
    <div
      className={cn(
        "group relative w-[286px] overflow-visible rounded-xl border bg-white shadow-[0_8px_24px_rgba(31,48,40,0.08)] transition-[box-shadow,transform]",
        hasErrors ? "border-[#c9826d] shadow-[0_0_0_3px_rgba(201,130,109,0.18)]" : hasWarnings ? "border-[#c6a85c]" : selected ? "border-[#6d9078] shadow-[0_0_0_3px_rgba(109,144,120,0.16)]" : "border-[#e1e6e1]",
        dragging && "z-50 scale-[1.02] cursor-grabbing shadow-[0_24px_55px_rgba(31,48,40,0.28)]",
      )}
    >
      {([ ["top", Position.Top], ["right", Position.Right], ["bottom", Position.Bottom], ["left", Position.Left] ] as const).map(([side, position]) => { const handleId = side === "left" ? "target" : `target-${side}`; const connected = side === "left" && data.connectedTargetHandleIds.includes("target"); return <Handle key={`target-${side}`} id={handleId} className={cn("!z-10 !h-3.5 !w-3.5 !border-2 !border-white !bg-[#668c70] opacity-0 transition-[transform,box-shadow,opacity] group-hover:opacity-100", (connected || isConnectionTarget) && "!opacity-100", isConnectionTarget && "!h-4 !w-4 !bg-[#3f684b] !shadow-[0_0_0_5px_rgba(109,144,120,0.2)]", isInvalidConnectionTarget && "opacity-30")} position={position} type="target" /> })}
      {(hasErrors || hasWarnings) && <div className={cn("absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white", hasErrors ? "text-[#b66e59]" : "text-[#aa8b3e")} title={hasErrors ? "This node has validation errors" : "This node has validation warnings"}><AlertCircle size={14} /></div>}
      <div className="flex items-center gap-2 border-b border-[#eef1ee] px-4 py-3">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", isInitial ? "bg-[#e9f0ea] text-[#62816a]" : isTerminal ? "bg-[#f3ece8] text-[#a47663]" : "bg-[#f0f3ef] text-[#6d7f72]")}>
          {isInitial ? <Flag size={14} /> : nodeType === "end" ? <PhoneOff size={14} /> : nodeType === "tool" ? <Wrench size={14} /> : nodeType === "branch" ? <GitBranch size={14} /> : nodeType === "transfer" ? <ArrowRightLeft size={14} /> : <CircleUserRound size={15} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#27312c]">{node.title ?? humanizeIdentifier(node.name)}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a9a2]">{isInitial ? "Entry point" : nodeTypeLabel}</p>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <MessageSquareText size={14} className="mt-0.5 shrink-0 text-[#9aa69d]" />
          <p className="line-clamp-3 text-xs leading-5 text-[#78837b]">{description}</p>
        </div>
      </div>
      {!isTerminal && ([ ["top", Position.Top], ["right", Position.Right], ["bottom", Position.Bottom], ["left", Position.Left] ] as const).map(([side, position]) => { const handleId = side === "bottom" ? NEW_TRANSITION_HANDLE : `connection-${side}`; const connected = data.connectedSourceHandleIds.includes(NEW_TRANSITION_HANDLE); return <Handle key={`source-${side}`} id={handleId} aria-label="Connect this node" role="button" title="Drag this dot to connect this node to another node" className={cn("!z-20 !h-3.5 !w-3.5 !border-2 !border-white !bg-[#668c70] opacity-0 transition-[transform,box-shadow,opacity] group-hover:opacity-100", connected && side === "bottom" && "!opacity-100", isConnectionSource && "!opacity-100 !h-4 !w-4 !bg-[#3f684b] !shadow-[0_0_0_5px_rgba(109,144,120,0.2)]")} position={position} type="source" /> })}
    </div>
  )
}
