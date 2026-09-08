import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { NEW_TRANSITION_HANDLE, transitionHandleId } from "../model/type"
import { toFlowElements } from "./flowAdapter"

describe("toFlowElements", () => {
  it("maps every agent node and transition into React Flow elements", () => {
    const { nodes, edges } = toFlowElements(exampleAgent)

    expect(nodes).toHaveLength(exampleAgent.nodes.length)
    expect(edges).toHaveLength(3)
    expect(nodes.find((node) => node.id === exampleAgent.initial_node)?.data.isInitial).toBe(true)
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["greeting", "collect_details"],
      ["collect_details", "offer_times"],
      ["offer_times", "confirm"],
    ])
    expect(edges[0]).toMatchObject({ sourceHandle: "transition:choose_intent", targetHandle: "target" })
  })

  it("keeps terminal nodes without outgoing edges", () => {
    const { nodes, edges } = toFlowElements(exampleAgent)
    const terminalNode = nodes.find((node) => node.id === "confirm")

    expect(terminalNode?.data.node.end).toBe(true)
    expect(edges.some((edge) => edge.source === "confirm")).toBe(false)
  })

  it("keeps persisted layout positions and exposes stable transition handle ids", () => {
    const { nodes } = toFlowElements(exampleAgent, { greeting: { x: 910, y: 120 } })

    expect(nodes.find((node) => node.id === "greeting")?.position).toEqual({ x: 910, y: 120 })
    expect(transitionHandleId("choose_intent")).toBe("transition:choose_intent")
    expect(NEW_TRANSITION_HANDLE).toBe("new-transition")
  })
})
