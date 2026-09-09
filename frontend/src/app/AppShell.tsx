import { useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { TestSessionPanel } from "@/components/layout/TestSessionPanel"
import { DraftHistoryPanel } from "@/components/layout/DraftHistoryPanel"
import { AgentGraph } from "@/features/agent-graph/components/AgentGraph"
import { useAgentGraph } from "@/features/agent-graph/hooks/useAgentGraph"
import { CopilotPanel } from "@/features/agent-copilot/components/CopilotPanel"
import type { EvidenceSource } from "@/features/agent-copilot/model/type"
import { NodeInspector, NodeInspectorEmptyState } from "@/features/agent-inspector/components/NodeInspector"
import type { AgentConfig, AgentDocument, AgentValidationError, CallRecord, CallReview, TestSession } from "@/features/agent-graph/model/type"
import { activateAgentDraft, checkAgentApi, createTestSession, getTestSession, reviewCall } from "@/lib/agentApi"
import { CallHistoryWorkspace } from "@/features/call-history/components/CallHistoryWorkspace"
import { loadCallHistory, updateCallReview, upsertCallRecord } from "@/features/call-history/lib/callHistoryStorage"

type Workspace = "agents" | "history"

export function AppShell() {
  const { agent, draft, draftVersion, hasStoredDraft, agents, activeAgentId, selectedNode, selectedNodeName, selectNode, moveNode, updateNode, updateAgent, deleteNode, updateEdge, deleteEdge, createNode, createTransition, selectTransition, selectedTransition, connectionInteraction, startConnection, cancelConnection, validationErrors, isDirty, saveDraft, resetDraft, createAgent, selectAgent, undo, redo, canUndo, canRedo, applyCopilotOperations, snapshots, restoreSnapshot } = useAgentGraph()
  const [workspace, setWorkspace] = useState<Workspace>("agents")
  const [testSession, setTestSession] = useState<TestSession>()
  const [callRecords, setCallRecords] = useState<CallRecord[]>(() => loadCallHistory())
  const [copilotSource, setCopilotSource] = useState<EvidenceSource>()
  const [copilotAutoAnalyze, setCopilotAutoAnalyze] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const reviewedSessions = useRef(new Set<string>())
  const sessionDocuments = useRef(new Map<string, AgentDocument>())

  const recordSession = useCallback((session: TestSession, preview: boolean) => {
    const record: CallRecord = { ...session, title: preview ? "Copilot preview call" : `Test call · ${agent.name}`, isDemo: false }
    setCallRecords(upsertCallRecord(record))
    return record
  }, [agent.name])

  const reviewCompletedSession = useCallback(async (session: TestSession, preview: boolean) => {
    if (reviewedSessions.current.has(session.id)) return
    reviewedSessions.current.add(session.id)
    const record: CallRecord = { ...session, title: preview ? "Copilot preview call" : `Test call · ${agent.name}`, isDemo: false }
    const document = sessionDocuments.current.get(session.id) ?? agent
    let nextReview: CallReview
    try {
      nextReview = await reviewCall({ document, baseVersion: session.draftVersion, call: record })
    } catch (error) {
      nextReview = { status: "unavailable", summary: "The AI reviewer could not inspect this call yet.", issues: [], recommendedAction: "no_change", reviewedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Unknown review error." }
    }
    setCallRecords(updateCallReview(session.id, nextReview))
  }, [agent])

  const startTestCall = useCallback(async (previewDocument?: AgentDocument, previewVersion?: string) => {
    if (!previewDocument && validationErrors.some((error) => error.severity === "error")) {
      window.alert("Fix validation errors before starting a test call.")
      return
    }
    const url = import.meta.env.VITE_VOICE_CLIENT_URL || "http://localhost:7860/client"
    const preview = Boolean(previewDocument)
    const version = previewVersion ?? draftVersion
    const document = previewDocument ?? agent
    try {
      await checkAgentApi()
      if (!preview) await activateAgentDraft(agent)
      const session = await createTestSession(version, previewDocument)
      sessionDocuments.current.set(session.id, document)
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
        const preview = next.draftVersion.endsWith("-preview")
        recordSession(next, preview)
        if (next.status === "completed" || next.status === "failed") void reviewCompletedSession(next, preview)
      }).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [recordSession, reviewCompletedSession, testSession])

  const onSelectValidationError = useCallback((error: AgentValidationError) => {
    const nodeName = error.location?.nodeName
    if (nodeName && agent.nodes.some((node) => node.name === nodeName)) selectNode(nodeName)
  }, [agent.nodes, selectNode])

  const onCreateAgent = useCallback((config: AgentConfig) => {
    createAgent(config)
    setWorkspace("agents")
    setCopilotSource(undefined)
    setCopilotAutoAnalyze(false)
  }, [createAgent])

  const onProposeCallChanges = useCallback((record: CallRecord, review: CallReview) => {
    const issueText = [review.summary, ...review.issues.map((issue) => `${issue.title}: ${issue.explanation}`)].join("\n")
    setCopilotSource({ kind: "call", traceId: record.id, text: issueText, call: record })
    setCopilotAutoAnalyze(false)
    setWorkspace("agents")
  }, [])

  const onRetryReview = useCallback((record: CallRecord) => {
    reviewedSessions.current.delete(record.id)
    void reviewCompletedSession(record, Boolean(record.draftVersion.endsWith("-preview")))
  }, [reviewCompletedSession])

  return <div className="relative flex h-screen min-h-[640px] overflow-hidden bg-[#f7f7f5]"><Sidebar workspace={workspace} onWorkspaceChange={setWorkspace} /><main className="flex min-w-0 flex-1 flex-col"><Topbar agentName={agent.name} persona={agent.persona} agents={agents} activeAgentId={activeAgentId} onSelectAgent={selectAgent} onUpdatePersona={(persona) => updateAgent({ persona })} onTestCall={() => void startTestCall()} isDirty={isDirty} validationErrors={validationErrors} onSelectValidationError={onSelectValidationError} onSave={saveDraft} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onCreateAgent={onCreateAgent} initialSetup={!hasStoredDraft} onReset={resetDraft} onOpenHistory={() => setHistoryOpen((open) => !open)} />{workspace === "history" ? <CallHistoryWorkspace records={callRecords} onPropose={onProposeCallChanges} onRetryReview={onRetryReview} /> : <div className="flex min-h-0 flex-1"><div className="min-w-0 flex-1"><AgentGraph config={agent} layout={draft.layout} selectedNodeName={selectedNodeName} onSelectNode={selectNode} onCreateNode={createNode} onDeleteNode={deleteNode} onMoveNode={moveNode} onCreateTransition={createTransition} onSelectTransition={selectTransition} connectionInteraction={connectionInteraction} onStartConnection={startConnection} onCancelConnection={cancelConnection} validationErrors={validationErrors} isDirty={isDirty} /></div><div className="flex w-[380px] shrink-0 flex-col">{selectedNode ? <NodeInspector node={selectedNode} initialNode={agent.initial_node} validationErrors={validationErrors} onUpdateNode={updateNode} onDeleteNode={deleteNode} onUpdateEdge={updateEdge} onDeleteEdge={deleteEdge} selectedTransition={selectedTransition} onSelectTransition={selectTransition} /> : <NodeInspectorEmptyState />}<CopilotPanel document={agent} draftVersion={draftVersion} initialSource={copilotSource} autoAnalyze={copilotAutoAnalyze} onApplyOperations={applyCopilotOperations} onPreviewCall={(document, version) => void startTestCall(document, version)} /></div></div>}</main><TestSessionPanel session={testSession} />{historyOpen && <DraftHistoryPanel snapshots={snapshots} currentRevision={agent.revision} onRestore={(snapshot) => { restoreSnapshot(snapshot); setHistoryOpen(false) }} onClose={() => setHistoryOpen(false)} />}</div>
}
