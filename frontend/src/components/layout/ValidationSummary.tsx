import { AlertCircle, Check, ChevronDown, TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import type { AgentValidationError } from "@/features/agent-graph/model/type"
import { groupValidationErrors, validationLocationLabel } from "@/features/agent-graph/lib/validationPresentation"

interface ValidationSummaryProps {
  errors: AgentValidationError[]
  isDirty: boolean
  onSelectError: (error: AgentValidationError) => void
  openRequest?: number
}

export function ValidationSummary({ errors, isDirty, onSelectError, openRequest }: ValidationSummaryProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
  const { errors: blockingErrors, warnings } = groupValidationErrors(errors)
  const hasIssues = blockingErrors.length > 0 || warnings.length > 0

  return (
    <div className="relative mt-1">
      <button type="button" className="flex items-center gap-1.5 text-[11px] text-[#8f9992] hover:text-[#526a5d]" onClick={() => hasIssues && setOpen((value) => !value)} aria-expanded={open} aria-label={hasIssues ? "Show validation issues" : "Validation status"}>
        {blockingErrors.length > 0 ? <AlertCircle size={12} className="text-[#b17662]" /> : warnings.length > 0 ? <TriangleAlert size={12} className="text-[#aa8b3e]" /> : <Check size={12} className="text-[#5e876b]" />}
        {blockingErrors.length > 0 && `${blockingErrors.length} validation error${blockingErrors.length === 1 ? "" : "s"}`}
        {blockingErrors.length > 0 && warnings.length > 0 && ", "}
        {warnings.length > 0 && `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
        {!hasIssues && (isDirty ? "Unsaved changes" : "Saved just now")}
        {hasIssues && <ChevronDown size={12} className={open ? "rotate-180" : undefined} />}
      </button>
      {open && <div className="absolute left-0 top-6 z-50 w-[360px] rounded-xl border border-[#dfe4df] bg-white p-2 shadow-[0_16px_35px_rgba(31,48,40,0.16)]">
        {!hasIssues && <p className="p-3 text-[11px] text-[#718078]">No validation issues in this draft.</p>}
        {blockingErrors.length > 0 && <ValidationGroup title="Errors" errors={blockingErrors} tone="error" onSelectError={(error) => { onSelectError(error); setOpen(false) }} />}
        {warnings.length > 0 && <ValidationGroup title="Warnings" errors={warnings} tone="warning" onSelectError={(error) => { onSelectError(error); setOpen(false) }} />}
      </div>}
    </div>
  )
}

function ValidationGroup({ title, errors, tone, onSelectError }: { title: string; errors: AgentValidationError[]; tone: "error" | "warning"; onSelectError: (error: AgentValidationError) => void }) {
  return <section className="space-y-1.5 p-2"><p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${tone === "error" ? "text-[#a16d5a]" : "text-[#aa8b3e]"}`}>{title}</p>{errors.map((error) => <button key={`${error.path}-${error.message}`} type="button" className="block w-full rounded-lg px-2 py-2 text-left hover:bg-[#f3f6f3]" onClick={() => onSelectError(error)}><p className="truncate text-[11px] font-semibold text-[#455249]">{validationLocationLabel(error)}</p><p className="mt-0.5 text-[10px] leading-4 text-[#8f9992]">{error.message}</p></button>)}</section>
}
