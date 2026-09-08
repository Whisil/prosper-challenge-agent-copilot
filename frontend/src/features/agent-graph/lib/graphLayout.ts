import type { XYPosition } from "@xyflow/react"

export const NODE_X_POSITION = 230
export const NODE_START_Y = 40
export const NODE_VERTICAL_SPACING = 380

export function defaultNodePosition(index: number): XYPosition {
  return { x: NODE_X_POSITION, y: NODE_START_Y + index * NODE_VERTICAL_SPACING }
}
