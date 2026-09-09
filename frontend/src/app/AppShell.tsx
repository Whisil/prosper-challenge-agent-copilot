import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { AgentGraph } from "@/features/agent-graph/components/AgentGraph"
import { useAgentGraph } from "@/features/agent-graph/hooks/useAgentGraph"
import { CopilotPanel } from "@/features/agent-copilot/components/CopilotPanel"
import type { EvidenceSource } from "@/features/agent-copilot/model/type"
import { NodeInspector, NodeInspectorEmptyState } from "@/features/agent-inspector/components/NodeInspector"
import type { AgentDocument, AgentConfig, AgentValidationError, CallRecord, TestSession } from "@/features/agent-graph/model/type"
import { downloadDraft, readDraftFile } from "@/features/agent-graph/lib/draftPersistence"
import { activateAgentDraft, checkAgentApi, createTestSession, getTestSession } from "@/lib/agentApi"
import { CallHistoryWorkspace } from "@/features/call-history/components/CallHistoryWorkspace"
import { loadCallHistory, upsertCallRecord } from "@/features/call-history/lib/callHistoryStorage"
import { TestSessionPanel } from "@/components/layout/TestSessionPanel"
import { DraftHistoryPanel } from "@/components/layout/DraftHistoryPanel"

type Workspace = "agents" | "history"

export function AppShell() {
  const { agent, draft, draftVersion, hasStoredDraft, selectedNode, selectedNodeName, selectNode, moveNode, updateNode, updateAgent, deleteNode, updateEdge, deleteEdge, createNode, createTransition, selectTransition, selectedTransition, connectionInteraction, startConnection, cancelConnection, validationErrors, isDirty, saveDraft, loadDraft, resetDraft, createAgent, undo, redo, canUndo, canRedo, applyCopilotOperations, snapshots, restoreSnapshot } = useAgentGraph()
  const [workspace, setWorkspace] = useState<Workspace>("agents")
  const [testSession, setTestSession] = useState<TestSession>()
  const [callRecords, setCallRecords] = useState<CallRecord[]>(() => loadCallHistory())
  const [copilotSource, setCopilotSource] = useState<EvidenceSource>()
  const [copilotAutoAnalyze, setCopilotAutoAnalyze] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const recordSession = useCallback((session: TestSession, preview: boolean) => {
    const record: CallRecord = { ...session, title: preview ? "Copilot preview call" : `Test call · ${agent.name}`, isDemo: false }
    setCallRecords(upsertCallRecord(record))
  }, [agent.name])

  const startTestCall = useCallback(async (previewDocument?: AgentDocument, previewVersion?: string) => {
    if (!previewDocument && validationErrors.some((error) => error.severity === "error")) {
      window.alert("Fix validation errors before starting a test call.")
      return
    }
    const url = import.meta.env.VITE_VOICE_CLIENT_URL || "http://localhost:7860/client"
    const preview = Boolean(previewDocument)
    const version = previewVersion ?? draftVersion
    try {
      await checkAgentApi()
      if (!preview) await activateAgentDraft(agent)
      const session = await createTestSession(version, previewDocument)
      setTestSession(session)
      recordSession(session, preview)
      const clientUrl = new URL(url)
      clientUrl.searchParams.set("session_id", session.id)
      const opened = window.open(clientUrl.toString(), "_blank", "noopener,noreferrer")
      if (!opened) window.alert("The browser blocked the test-call window. Allow pop-ups for this app and try again.")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to prepare the test call.")
    }
  }, [agent, draftVersion, recordSession, validationErrors])

  useEffect(() => {
    if (!testSession || testSession.status === "completed" || testSession.status === "failed") return
    const timer = window.setInterval(() => {
      void getTestSession(testSession.id).then((next) => {
        setTestSession(next)
        recordSession(next, next.draftVersion.endsWith("-preview"))
      }).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [recordSession, testSession])

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
  const onCreateAgent = useCallback((config: AgentConfig, brief?: string) => {
    createAgent(config)
    setWorkspace("agents")
    setCopilotSource(brief ? { kind: "guideline", text: brief } : undefined)
    setCopilotAutoAnalyze(Boolean(brief))
  }, [createAgent])
  const onAnalyzeCall = useCallback((record: CallRecord, text: string) => {
    setCopilotSource({ kind: "call", traceId: record.id, text: text || record.feedback || "Review this call trace for issues and improvements.", call: { ...record, feedback: text || record.feedback } })
    setCopilotAutoAnalyze(false)
    setWorkspace("agents")
  }, [])

  return <div className="relative flex h-screen min-h-[640px] overflow-hidden bg-[#f7f7f5]"><Sidebar workspace={workspace} onWorkspaceChange={setWorkspace} /><main className="flex min-w-0 flex-1 flex-col"><Topbar agentName={agent.name} persona={agent.persona} onUpdatePersona={(persona) => updateAgent({ persona })} onTestCall={() => void startTestCall()} isDirty={isDirty} validationErrors={validationErrors} onSelectValidationError={onSelectValidationError} onSave={saveDraft} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onExport={() => downloadDraft(draft)} onImport={onImport} onCreateAgent={onCreateAgent} initialSetup={!hasStoredDraft} onReset={resetDraft} onOpenHistory={() => setHistoryOpen((open) => !open)} />{workspace === "history" ? <CallHistoryWorkspace records={callRecords} onRecordsChange={setCallRecords} onAnalyze={onAnalyzeCall} /> : <div className="flex min-h-0 flex-1"><div className="min-w-0 flex-1"><AgentGraph config={agent} layout={draft.layout} selectedNodeName={selectedNodeName} onSelectNode={selectNode} onCreateNode={createNode} onDeleteNode={deleteNode} onMoveNode={moveNode} onCreateTransition={createTransition} onSelectTransition={selectTransition} connectionInteraction={connectionInteraction} onStartConnection={startConnection} onCancelConnection={cancelConnection} validationErrors={validationErrors} isDirty={isDirty} /></div><div className="flex w-[380px] shrink-0 flex-col">{selectedNode ? <NodeInspector node={selectedNode} initialNode={agent.initial_node} validationErrors={validationErrors} onUpdateNode={updateNode} onDeleteNode={deleteNode} onUpdateEdge={updateEdge} onDeleteEdge={deleteEdge} selectedTransition={selectedTransition} onSelectTransition={selectTransition} /> : <NodeInspectorEmptyState />}<CopilotPanel document={agent} draftVersion={draftVersion} initialSource={copilotSource} autoAnalyze={copilotAutoAnalyze} onApplyOperations={applyCopilotOperations} onSave={saveDraft} onPreviewCall={(document, version) => void startTestCall(document, version)} /></div></div>}</main><TestSessionPanel session={testSession} />{historyOpen && <DraftHistoryPanel snapshots={snapshots} currentRevision={agent.revision} onRestore={(snapshot) => { restoreSnapshot(snapshot); setHistoryOpen(false) }} onClose={() => setHistoryOpen(false)} />}</div>
}
