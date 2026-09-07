import { useCallback, useMemo } from "react"
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { AgentNode } from "./AgentNode"
import { GraphToolbar } from "./GraphToolbar"
import { toFlowElements } from "../lib/flowAdapter"
import type { AgentConfig } from "../model/type"

interface AgentGraphProps {
  config: AgentConfig
  selectedNodeName: string
  onSelectNode: (nodeName: string) => void
}

function GraphContent({ config, selectedNodeName, onSelectNode }: AgentGraphProps) {
  const { fitView } = useReactFlow()
  const { nodes, edges } = useMemo(() => toFlowElements(config), [config])
  const selectedNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeName })), [nodes, selectedNodeName])
  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => onSelectNode(node.id), [onSelectNode])

  return (
    <div className="relative h-full w-full canvas-grid">
      <GraphToolbar onFitView={() => fitView({ padding: 0.28, duration: 350 })} />
      <ReactFlow
        nodes={selectedNodes}
        edges={edges}
        nodeTypes={{ agentNode: AgentNode }}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        nodesDraggable={false}
        nodesConnectable={false}
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
