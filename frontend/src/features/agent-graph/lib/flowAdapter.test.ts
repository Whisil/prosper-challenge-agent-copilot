import { describe, expect, it } from "vitest"
import { exampleAgent } from "../data/exampleAgent"
import { NEW_TRANSITION_HANDLE } from "../model/type"
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
    expect(edges[0]).toMatchObject({ sourceHandle: NEW_TRANSITION_HANDLE, targetHandle: "target", data: { functionName: "choose_intent" } })
  })

  it("keeps terminal nodes without outgoing edges", () => {
    const { nodes, edges } = toFlowElements(exampleAgent)
    const terminalNode = nodes.find((node) => node.id === "confirm")

    expect(terminalNode?.data.node.end).toBe(true)
    expect(edges.some((edge) => edge.source === "confirm")).toBe(false)
  })

  it("keeps persisted layout positions and exposes a stable connection handle", () => {
    const { nodes } = toFlowElements(exampleAgent, { greeting: { x: 910, y: 120 } })

    expect(nodes.find((node) => node.id === "greeting")?.position).toEqual({ x: 910, y: 120 })
    expect(NEW_TRANSITION_HANDLE).toBe("new-transition")
  })

  it("spaces default nodes far enough apart for their cards", () => {
    const { nodes } = toFlowElements(exampleAgent)

    expect(nodes.map((node) => node.position.y)).toEqual([40, 420, 800, 1180])
  })

  it("marks nodes that contain validation issues", () => {
    const { nodes } = toFlowElements(exampleAgent, undefined, [{
      path: "nodes.offer_times.task_messages",
      message: "Add an instruction for this node.",
      severity: "error",
      location: { nodeName: "offer_times", field: "task_messages" },
    }])

    expect(nodes.find((node) => node.id === "offer_times")?.data.validationErrors).toHaveLength(1)
    expect(nodes.find((node) => node.id === "greeting")?.data.validationErrors).toHaveLength(0)
  })
})
