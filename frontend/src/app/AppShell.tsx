import { useCallback } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { AgentGraph } from "@/features/agent-graph/components/AgentGraph"
import { useAgentGraph } from "@/features/agent-graph/hooks/useAgentGraph"
import { CopilotPanel } from "@/features/agent-copilot/components/CopilotPanel"
import { NodeInspector } from "@/features/agent-inspector/components/NodeInspector"

export function AppShell() {
  const { agent, draft, selectedNode, selectedNodeName, selectNode, addNode, moveNode } = useAgentGraph()
  const onTestCall = useCallback(() => {
    const url = import.meta.env.VITE_VOICE_CLIENT_URL || "http://localhost:7860/client"
    window.open(url, "_blank", "noopener,noreferrer")
  }, [])

  return (
    <div className="flex h-screen min-h-[640px] overflow-hidden bg-[#f7f7f5]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar onTestCall={onTestCall} />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1"><AgentGraph config={agent} layout={draft.layout} selectedNodeName={selectedNodeName} onSelectNode={selectNode} onAddNode={addNode} onMoveNode={moveNode} /></div>
          <div className="flex w-[300px] shrink-0 flex-col"><NodeInspector node={selectedNode} /><CopilotPanel /></div>
        </div>
      </main>
    </div>
  )
}
