import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { Background, Controls, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Connection, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AgentNode } from "./AgentNode"
import { GraphToolbar } from "./GraphToolbar"
import { NodeCreationDialog } from "./NodeCreationDialog"
import { toFlowElements } from "../lib/flowAdapter"
import { NEW_TRANSITION_HANDLE, type AgentConfig, type AgentValidationError, type ConnectionInteractionState, type FlowEdge, type NodeCreationInput, type NodeCreationKind, type TransitionReference } from "../model/type"
import type { XYPosition } from "@xyflow/react"

interface AgentGraphProps {
  config: AgentConfig
  layout: Record<string, XYPosition>
  selectedNodeName?: string
  onSelectNode: (nodeName: string) => void
  onCreateNode: (kind: NodeCreationKind, input: NodeCreationInput) => void
  onDeleteNode: (nodeName: string) => void
  onMoveNode: (nodeName: string, position: XYPosition) => void
  validationErrors: AgentValidationError[]
  onCreateTransition: (source: string, target: string) => void
  onSelectTransition: (transition: TransitionReference) => void
  connectionInteraction: ConnectionInteractionState
  onStartConnection: () => void
  onCancelConnection: () => void
  isDirty: boolean
  readOnly?: boolean
}

function GraphContent({ config, layout, selectedNodeName, onSelectNode, onCreateNode, onDeleteNode, onMoveNode, validationErrors, onCreateTransition, onSelectTransition, connectionInteraction, onStartConnection, onCancelConnection, isDirty, readOnly = false }: AgentGraphProps) {
  const { fitView } = useReactFlow()
  const [creationKind, setCreationKind] = useState<NodeCreationKind | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const { nodes, edges } = useMemo(() => toFlowElements(config, layout, validationErrors), [config, layout, validationErrors])
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes)
  useEffect(() => setFlowNodes(nodes), [nodes, setFlowNodes])
  const knownNodeIds = useRef(new Set(config.nodes.map((node) => node.name)))
  useEffect(() => {
    const previousIds = knownNodeIds.current
    const createdNode = config.nodes.find((node) => !previousIds.has(node.name))
    knownNodeIds.current = new Set(config.nodes.map((node) => node.name))
    if (!createdNode) return

    const frame = window.requestAnimationFrame(() => {
      void fitView({ nodes: [{ id: createdNode.name }], padding: 0.6, minZoom: 0.45, maxZoom: 1.1, duration: 350 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [config.nodes, fitView])
  const selectedNodes = useMemo(() => flowNodes.map((node) => ({ ...node, selected: node.id === selectedNodeName })), [flowNodes, selectedNodeName])
  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => onSelectNode(node.id), [onSelectNode])
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.sourceHandle !== NEW_TRANSITION_HANDLE && !connection.sourceHandle?.startsWith("connection-")) return
    onCreateTransition(connection.source, connection.target)
    setIsConnecting(false)
  }, [onCreateTransition])

  const onEdgeClick = useCallback((_: MouseEvent, edge: FlowEdge) => {
    const functionName = edge.data?.functionName
    if (functionName) onSelectTransition({ source: edge.source, functionName })
  }, [onSelectTransition])

  return (
    <div className="relative h-full w-full canvas-grid">
      <GraphToolbar onFitView={() => fitView({ padding: 0.28, duration: 350 })} onAddNode={setCreationKind} readOnly={readOnly} />
      {isDirty && <div className="absolute right-5 top-5 z-10 rounded-full border border-[#d6c99b] bg-[#fffaf0] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9b7b2f] shadow-sm">Unsaved</div>}
      {isConnecting && <div className="pointer-events-none absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full border border-[#c5d7c8] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#66806d] shadow-sm">Drop on a node to connect</div>}
      <ReactFlow
        nodes={selectedNodes}
        edges={edges}
        nodeTypes={{ agentNode: AgentNode }}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onBeforeDelete={readOnly ? undefined : ({ nodes: deletedNodes }) => Promise.resolve(deletedNodes.every((node) => node.id !== config.initial_node))}
        onNodesDelete={readOnly ? undefined : (deletedNodes) => deletedNodes.forEach((node) => onDeleteNode(node.id))}
        onNodeDragStop={readOnly ? undefined : (_, node) => onMoveNode(node.id, node.position)}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : () => { setIsConnecting(true); onStartConnection() }}
        onConnectEnd={readOnly ? undefined : () => { setIsConnecting(false); if (connectionInteraction.mode !== "idle") onCancelConnection() }}
        isValidConnection={(connection) => Boolean(connection.source && connection.target && (connection.sourceHandle === NEW_TRANSITION_HANDLE || connection.sourceHandle?.startsWith("connection-")) && connection.source !== connection.target)}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} color="#d9ddd9" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!readOnly && <NodeCreationDialog kind={creationKind} nodes={config.nodes} onCancel={() => setCreationKind(null)} onSubmit={(input) => { if (creationKind) onCreateNode(creationKind, input); setCreationKind(null) }} />}
    </div>
  )
}

export function AgentGraph(props: AgentGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphContent {...props} />
    </ReactFlowProvider>
  )
}
