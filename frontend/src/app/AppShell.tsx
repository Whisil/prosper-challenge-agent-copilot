import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { AgentGraph } from "@/features/agent-graph/components/AgentGraph"
import { useAgentGraph } from "@/features/agent-graph/hooks/useAgentGraph"
import { CopilotPanel } from "@/features/agent-copilot/components/CopilotPanel"
import { NodeInspector, NodeInspectorEmptyState } from "@/features/agent-inspector/components/NodeInspector"
import type { AgentValidationError } from "@/features/agent-graph/model/type"
import { downloadDraft, readDraftFile } from "@/features/agent-graph/lib/draftPersistence"
import { activateAgentDraft, createTestSession, getTestSession } from "@/lib/agentApi"
import type { TestSession } from "@/features/agent-graph/model/type"
import { TestSessionPanel } from "@/components/layout/TestSessionPanel"
import { SimulationPanel } from "@/components/layout/SimulationPanel"

export function AppShell() {
  const { agent, draft, draftVersion, selectedNode, selectedNodeName, selectNode, moveNode, updateNode, updateAgent, deleteNode, updateEdge, deleteEdge, createNode, createTransition, selectTransition, selectedTransition, connectionInteraction, startConnection, cancelConnection, validationErrors, isDirty, saveDraft, loadDraft, resetDraft, undo, redo, canUndo, canRedo } = useAgentGraph()
  const [testSession, setTestSession] = useState<TestSession>()
  const [simulationOpen, setSimulationOpen] = useState(false)
  const onTestCall = useCallback(async () => {
    if (validationErrors.some((error) => error.severity === "error")) {
      window.alert("Fix validation errors before starting a test call.")
      return
    }
    const url = import.meta.env.VITE_VOICE_CLIENT_URL || "http://localhost:7860/client"
    try {
      await activateAgentDraft(agent)
      const session = await createTestSession(draftVersion)
      setTestSession(session)
      const clientUrl = new URL(url)
      clientUrl.searchParams.set("session_id", session.id)
      window.open(clientUrl.toString(), "_blank", "noopener,noreferrer")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to prepare the active draft for a test call.")
    }
  }, [agent, draftVersion, validationErrors])
  useEffect(() => {
    if (!testSession || testSession.status === "completed" || testSession.status === "failed") return
    const timer = window.setInterval(() => {
      void getTestSession(testSession.id).then(setTestSession).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [testSession])
  const onSelectValidationError = useCallback((error: AgentValidationError) => {
    const nodeName = error.location?.nodeName
    if (nodeName && agent.nodes.some((node) => node.name === nodeName)) selectNode(nodeName)
  }, [agent.nodes, selectNode])
  const onImport = useCallback(async (file: File) => {
    try {
      loadDraft(await readDraftFile(file))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to import this draft.")
    }
  }, [loadDraft])

  return (
    <div className="relative flex h-screen min-h-[640px] overflow-hidden bg-[#f7f7f5]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar agentName={agent.name} persona={agent.persona} onUpdatePersona={(persona) => updateAgent({ persona })} onTestCall={onTestCall} isDirty={isDirty} validationErrors={validationErrors} onSelectValidationError={onSelectValidationError} onSave={saveDraft} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onExport={() => downloadDraft(draft)} onImport={onImport} onSimulate={() => setSimulationOpen(true)} onReset={resetDraft} />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1"><AgentGraph config={agent} layout={draft.layout} selectedNodeName={selectedNodeName} onSelectNode={selectNode} onCreateNode={createNode} onDeleteNode={deleteNode} onMoveNode={moveNode} onCreateTransition={createTransition} onSelectTransition={selectTransition} connectionInteraction={connectionInteraction} onStartConnection={startConnection} onCancelConnection={cancelConnection} validationErrors={validationErrors} isDirty={isDirty} /></div>
          <div className="flex w-[380px] shrink-0 flex-col">{selectedNode ? <NodeInspector node={selectedNode} initialNode={agent.initial_node} validationErrors={validationErrors} onUpdateNode={updateNode} onDeleteNode={deleteNode} onUpdateEdge={updateEdge} onDeleteEdge={deleteEdge} selectedTransition={selectedTransition} onSelectTransition={selectTransition} /> : <NodeInspectorEmptyState />}<CopilotPanel /></div>
        </div>
      </main>
      <TestSessionPanel session={testSession} />
      <SimulationPanel document={agent} open={simulationOpen} onClose={() => setSimulationOpen(false)} />
    </div>
  )
}
