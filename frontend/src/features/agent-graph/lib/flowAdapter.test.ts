import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
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
  })

  it("keeps terminal nodes without outgoing edges", () => {
    const { nodes, edges } = toFlowElements(exampleAgent)
    const terminalNode = nodes.find((node) => node.id === "confirm")

    expect(terminalNode?.data.node.end).toBe(true)
    expect(edges.some((edge) => edge.source === "confirm")).toBe(false)
  })
})
