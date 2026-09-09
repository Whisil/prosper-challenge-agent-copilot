import { createSuggestedFix } from "@/lib/agentApi"
import type { SuggestedFixRequest } from "../model/type"

export function requestSuggestedFix(request: SuggestedFixRequest) {
  return createSuggestedFix(request)
}
