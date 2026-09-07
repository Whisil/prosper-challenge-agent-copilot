import { ChevronRight, CircleHelp, FileText, GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Separator } from "@/components/ui/Separator"
import type { AgentNode } from "../../agent-graph/model/type"

interface NodeInspectorProps {
  node: AgentNode
}

export function NodeInspector({ node }: NodeInspectorProps) {
  return (
    <section className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#e5e8e4] bg-[#fbfcfa]">
      <div className="border-b border-[#e5e8e4] px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa49d]">Selected node</p>
        <h2 className="mt-2 text-lg font-semibold capitalize tracking-tight text-[#253029]">{node.name.replaceAll("_", " ")}</h2>
        <Badge className={node.end ? "mt-3 bg-[#f3ece8] text-[#976c59]" : "mt-3 bg-[#e9f0ea] text-[#5e8068]"}>{node.end ? "Terminal" : "Conversation step"}</Badge>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#455249]"><FileText size={14} className="text-[#8b9b8f]" /> Instructions</div>
          <Card className="p-3.5"><p className="text-xs leading-5 text-[#68736c]">{node.task_messages[0]?.content}</p></Card>
        </div>
        <Separator />
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#455249]"><GitBranch size={14} className="text-[#8b9b8f]" /> Transitions</div>
          <div className="space-y-2">
            {node.edges.length > 0 ? node.edges.map((edge) => (
              <Card className="flex items-center justify-between p-3" key={edge.function}>
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#455249]">{edge.function}</p><p className="mt-1 truncate text-[11px] text-[#9aa49d]">Leads to {edge.target.replaceAll("_", " ")}</p></div>
                <ChevronRight size={14} className="shrink-0 text-[#a3ada5]" />
              </Card>
            )) : <p className="text-xs text-[#8f9992]">This node ends the conversation.</p>}
          </div>
        </div>
        <div className="rounded-xl bg-[#f0f3ef] p-3.5"><div className="flex gap-2"><CircleHelp size={15} className="mt-0.5 shrink-0 text-[#809487]" /><p className="text-[11px] leading-4 text-[#718078]">Node editing will be enabled in the next builder slice.</p></div></div>
      </div>
    </section>
  )
}
