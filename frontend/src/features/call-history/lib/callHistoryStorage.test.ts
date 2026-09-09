import { describe, expect, it } from "vitest"
import { loadCallHistory, updateCallFeedback } from "./callHistoryStorage"

describe("call history storage", () => {
  it("starts with clearly labeled synthetic evidence", () => {
    expect(loadCallHistory().length).toBeGreaterThanOrEqual(2)
    expect(loadCallHistory().every((record) => record.isDemo)).toBe(true)
  })

  it("updates feedback on the selected record", () => {
    const records = loadCallHistory()
    expect(updateCallFeedback(records[0].id, "New feedback")[0].feedback).toBe("New feedback")
  })
})
