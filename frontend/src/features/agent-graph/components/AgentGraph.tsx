import { useCallback, useEffect, useMemo } from "react"
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Connection, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AgentNode } from "./AgentNode"
import { GraphToolbar } from "./GraphToolbar"
import { toFlowElements } from "../lib/flowAdapter"
import { NEW_TRANSITION_HANDLE, type AgentConfig } from "../model/type"
import type { XYPosition } from "@xyflow/react"

interface AgentGraphProps {
  config: AgentConfig
  layout: Record<string, XYPosition>
  selectedNodeName: string
  onSelectNode: (nodeName: string) => void
  onAddNode: () => void
  onMoveNode: (nodeName: string, position: XYPosition) => void
  onConnectTransition: (source: string, target: string, sourceHandle?: string | null) => void
}

function GraphContent({ config, layout, selectedNodeName, onSelectNode, onAddNode, onMoveNode, onConnectTransition }: AgentGraphProps) {
  const { fitView } = useReactFlow()
  const { nodes, edges } = useMemo(() => toFlowElements(config, layout), [config, layout])
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes)
  useEffect(() => setFlowNodes(nodes), [nodes, setFlowNodes])
  const selectedNodes = useMemo(() => flowNodes.map((node) => ({ ...node, selected: node.id === selectedNodeName })), [flowNodes, selectedNodeName])
  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => onSelectNode(node.id), [onSelectNode])
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.sourceHandle === NEW_TRANSITION_HANDLE) {
      onConnectTransition(connection.source, connection.target, connection.sourceHandle)
      return
    }
    if (connection.sourceHandle?.startsWith("transition:")) {
      onConnectTransition(connection.source, connection.target, connection.sourceHandle)
    }
  }, [onConnectTransition])

  return (
    <div className="relative h-full w-full canvas-grid">
      <GraphToolbar onFitView={() => fitView({ padding: 0.28, duration: 350 })} onAddNode={onAddNode} />
      <ReactFlow
        nodes={selectedNodes}
        edges={edges}
        nodeTypes={{ agentNode: AgentNode }}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => onMoveNode(node.id, node.position)}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} color="#d9ddd9" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#c4d4c7" maskColor="rgba(247,247,245,0.75)" />
      </ReactFlow>
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
