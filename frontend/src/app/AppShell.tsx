import { useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { TestSessionPanel } from "@/components/layout/TestSessionPanel"
import { AgentGraph } from "@/features/agent-graph/components/AgentGraph"
import { useAgentGraph } from "@/features/agent-graph/hooks/useAgentGraph"
import { CopilotPanel } from "@/features/agent-copilot/components/CopilotPanel"
import { NodeInspector, NodeInspectorEmptyState } from "@/features/agent-inspector/components/NodeInspector"
import type { AgentConfig, AgentDocument, AgentValidationError, CallRecord, CallReview, TestSession } from "@/features/agent-graph/model/type"
import { activateAgentDraft, checkAgentApi, completeTestSession, createTestSession, getTestSession, reviewCall } from "@/lib/agentApi"
import { CallHistoryWorkspace } from "@/features/call-history/components/CallHistoryWorkspace"
import { completedFromTerminalEvidence, hasTerminalEvidence, loadCallHistory, resolveCallReview, updateCallReview, upsertCallRecord } from "@/features/call-history/lib/callHistoryStorage"
import { useSuggestedFixFlow } from "@/features/suggested-fix/hooks/useSuggestedFixFlow"
import { SuggestedFixOverlay } from "@/features/suggested-fix/components/SuggestedFixOverlay"
import { SuggestedFixToast } from "@/features/suggested-fix/components/SuggestedFixToast"
import { validateAgentConfig } from "@/features/agent-graph/lib/validateAgent"

type Workspace = "agents" | "history"

export function AppShell() {
  const { agent, draft, draftVersion, agents, activeAgentId, selectedNode, selectedNodeName, selectNode, moveNode, updateNode, updateAgent, deleteNode, updateEdge, deleteEdge, createNode, createTransition, selectTransition, selectedTransition, connectionInteraction, startConnection, cancelConnection, validationErrors, isDirty, saveDraft, commitSuggestedFix, createAgent, deleteAgent, selectAgent, undo, redo, canUndo, canRedo, applyCopilotOperations } = useAgentGraph()
  const [workspace, setWorkspace] = useState<Workspace>("agents")
  const [testSession, setTestSession] = useState<TestSession>()
  const [callRecords, setCallRecords] = useState<CallRecord[]>(() => loadCallHistory())
  const [pendingSuggestedFix, setPendingSuggestedFix] = useState<{ record: CallRecord; review: CallReview }>()
  const [testCallNotice, setTestCallNotice] = useState<string>()
  const [pendingClientUrl, setPendingClientUrl] = useState<string>()
  const reviewedSessions = useRef(new Set<string>())
  const sessionDocuments = useRef(new Map<string, AgentDocument>())
  const reconcilingTerminalSessions = useRef(new Set<string>())
  const [sessionPanelDismissed, setSessionPanelDismissed] = useState(false)
  const { state: suggestedFixState, start: startSuggestedFix, accept: acceptSuggestedFix, deny: denySuggestedFix, clear: clearSuggestedFix, movePreviewNode } = useSuggestedFixFlow({ activeAgentId, draft, draftVersion, commitSuggestedFix, onAccepted: (callId) => setCallRecords(resolveCallReview(callId)) })

  const recordSession = useCallback((session: TestSession, preview: boolean) => {
    const record: CallRecord = { ...session, title: preview ? "Copilot preview call" : `Test call · ${agent.name}`, agentName: agent.name, reviewState: session.status === "completed" || session.status === "failed" ? "pending" : undefined }
    setCallRecords(upsertCallRecord(record))
    return record
  }, [agent.name])

  const reviewCompletedSession = useCallback(async (session: TestSession, preview: boolean) => {
    if (reviewedSessions.current.has(session.id)) return
    reviewedSessions.current.add(session.id)
    const record: CallRecord = { ...session, title: preview ? "Copilot preview call" : `Test call · ${agent.name}`, agentName: agent.name, reviewState: "pending" }
    setCallRecords(upsertCallRecord(record))
    const document = sessionDocuments.current.get(session.id) ?? agent
    let nextReview: CallReview
    try {
      nextReview = await reviewCall({ document, baseVersion: session.draftVersion, call: record })
    } catch (error) {
      nextReview = { status: "unavailable", summary: "The AI reviewer could not inspect this call.", issues: [], recommendedAction: "no_change", reviewedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Unknown review error." }
    }
    setCallRecords(updateCallReview(session.id, nextReview))
  }, [agent])

  const finalizeSession = useCallback((session: TestSession) => {
    const preview = session.draftVersion.endsWith("-preview")
    recordSession(session, preview)
    void reviewCompletedSession(session, preview)
    setTestSession(undefined)
  }, [recordSession, reviewCompletedSession])

  const handleSessionUpdate = useCallback((session: TestSession) => {
    if (session.status === "completed" || session.status === "failed") {
      finalizeSession(session)
      return
    }
    if (hasTerminalEvidence(session)) {
      if (!reconcilingTerminalSessions.current.has(session.id)) {
        reconcilingTerminalSessions.current.add(session.id)
        void completeTestSession(session.id).then(finalizeSession).catch(() => finalizeSession(completedFromTerminalEvidence(session)))
      }
      return
    }
    setTestSession(session)
  }, [finalizeSession])

  const startTestCall = useCallback(async (previewDocument?: AgentDocument, previewVersion?: string) => {
    if (suggestedFixState.status === "loading" || suggestedFixState.status === "ready" || suggestedFixState.status === "stale") {
      setTestCallNotice("Apply or deny the suggested fix before starting a new test call.")
      return
    }
    if (!previewDocument && validationErrors.some((error) => error.severity === "error")) {
      setTestCallNotice("Fix validation errors before starting a test call.")
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
      setSessionPanelDismissed(false)
      handleSessionUpdate(session)
      const clientUrl = new URL(url)
      clientUrl.searchParams.set("session_id", session.id)
      const opened = window.open(clientUrl.toString(), "_blank")
      if (!opened) {
        setPendingClientUrl(clientUrl.toString())
        setTestCallNotice("Your browser blocked the test-call window. Use Open test call below.")
      } else {
        setPendingClientUrl(undefined)
        setTestCallNotice(undefined)
      }
    } catch (error) {
      setTestCallNotice(error instanceof Error ? error.message : "Unable to prepare the test call.")
    }
  }, [agent, draftVersion, handleSessionUpdate, suggestedFixState.status, validationErrors])

  const openPendingTestCall = useCallback(() => {
    if (!pendingClientUrl) return
    const opened = window.open(pendingClientUrl, "_blank")
    if (opened) {
      setPendingClientUrl(undefined)
      setTestCallNotice(undefined)
    } else setTestCallNotice("The browser still blocked the test-call window. Allow pop-ups for this app and try again.")
  }, [pendingClientUrl])

  useEffect(() => {
    if (!testSession || testSession.status === "completed" || testSession.status === "failed") return
    const timer = window.setInterval(() => {
      void getTestSession(testSession.id).then(handleSessionUpdate).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [handleSessionUpdate, testSession])

  const onSelectValidationError = useCallback((error: AgentValidationError) => {
    const nodeName = error.location?.nodeName
    if (nodeName && agent.nodes.some((node) => node.name === nodeName)) selectNode(nodeName)
  }, [agent.nodes, selectNode])

  const onCreateAgent = useCallback((config: AgentConfig) => {
    createAgent(config)
    setWorkspace("agents")
    clearSuggestedFix()
  }, [clearSuggestedFix, createAgent])

  const onDeleteAgent = useCallback(() => {
    if (deleteAgent()) clearSuggestedFix()
  }, [clearSuggestedFix, deleteAgent])

  const onRetryReview = useCallback((record: CallRecord) => {
    reviewedSessions.current.delete(record.id)
    void reviewCompletedSession(record, Boolean(record.draftVersion.endsWith("-preview")))
  }, [reviewCompletedSession])

  const onProposeReviewedCall = useCallback((record: CallRecord, review: CallReview) => {
    const matchingAgent = agents.find((candidate) => candidate.draft.config.name === record.agentName)
    if (matchingAgent && matchingAgent.id !== activeAgentId) {
      selectAgent(matchingAgent.id)
      setPendingSuggestedFix({ record, review })
    } else {
      void startSuggestedFix(record, review)
    }
    setWorkspace("agents")
  }, [activeAgentId, agents, selectAgent, startSuggestedFix])

  useEffect(() => {
    if (!pendingSuggestedFix || pendingSuggestedFix.record.agentName !== agent.name) return
    const pending = pendingSuggestedFix
    setPendingSuggestedFix(undefined)
    void startSuggestedFix(pending.record, pending.review)
  }, [agent.name, pendingSuggestedFix, startSuggestedFix])

  const suggestedPreview = suggestedFixState.previewDraft
  const graphDraft = suggestedPreview ?? draft
  const graphValidationErrors = suggestedPreview ? validateAgentConfig(suggestedPreview.config) : validationErrors
  const suggestedNodeNames = suggestedFixState.response?.operations.filter((operation) => operation.op === "add_node").map((operation) => operation.node.name) ?? []
  return <div className="relative flex h-screen min-h-[640px] overflow-hidden bg-[#f7f7f5]"><Sidebar workspace={workspace} onWorkspaceChange={setWorkspace} /><main className="flex min-w-0 flex-1 flex-col"><Topbar agentName={agent.name} persona={agent.persona} agents={agents} activeAgentId={activeAgentId} onSelectAgent={selectAgent} onUpdatePersona={(persona) => updateAgent({ persona })} onDeleteAgent={onDeleteAgent} canDeleteAgent={agents.length > 1} onTestCall={() => void startTestCall()} testCallDisabled={suggestedFixState.status === "loading" || suggestedFixState.status === "ready" || suggestedFixState.status === "stale"} isDirty={isDirty} validationErrors={validationErrors} onSelectValidationError={onSelectValidationError} onSave={saveDraft} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} onCreateAgent={onCreateAgent} /><div className={workspace === "history" ? "flex min-h-0 flex-1" : "hidden"}><CallHistoryWorkspace records={callRecords} onPropose={onProposeReviewedCall} onRetryReview={onRetryReview} /></div><div className={workspace === "history" ? "hidden" : "flex min-h-0 flex-1"}><div className="relative min-w-0 flex-1"><AgentGraph config={graphDraft.config} layout={graphDraft.layout} edgeHandles={graphDraft.edgeHandles} selectedNodeName={selectedNodeName} onSelectNode={selectNode} onCreateNode={createNode} onDeleteNode={deleteNode} onMoveNode={suggestedPreview ? movePreviewNode : moveNode} movableNodeNames={suggestedNodeNames} allowPreviewLayoutEdit={Boolean(suggestedPreview)} onCreateTransition={createTransition} onSelectTransition={selectTransition} connectionInteraction={connectionInteraction} onStartConnection={startConnection} onCancelConnection={cancelConnection} validationErrors={graphValidationErrors} isDirty={isDirty} readOnly={Boolean(suggestedPreview)} /><SuggestedFixOverlay state={suggestedFixState} onDismissError={clearSuggestedFix} /><SuggestedFixToast state={suggestedFixState} onAccept={() => void acceptSuggestedFix()} onDeny={denySuggestedFix} /></div><div className="flex w-[380px] shrink-0 flex-col">{selectedNode && !suggestedPreview ? <NodeInspector node={selectedNode} initialNode={agent.initial_node} validationErrors={validationErrors} onUpdateNode={updateNode} onDeleteNode={deleteNode} onUpdateEdge={updateEdge} onDeleteEdge={deleteEdge} selectedTransition={selectedTransition} onSelectTransition={selectTransition} /> : <NodeInspectorEmptyState />}{!suggestedPreview && <CopilotPanel document={agent} draft={draft} draftVersion={draftVersion} onApplyOperations={applyCopilotOperations} onPreviewCall={(document, version) => void startTestCall(document, version)} onProposalLoadingChange={() => undefined} onPreviewChange={() => undefined} onProposalErrorChange={() => undefined} />}</div></div></main><TestSessionPanel session={sessionPanelDismissed ? undefined : testSession} message={testCallNotice} pendingUrl={pendingClientUrl} onOpenPending={openPendingTestCall} onDismiss={() => setSessionPanelDismissed(true)} onDismissMessage={() => { setTestCallNotice(undefined); setPendingClientUrl(undefined) }} /></div>
}
