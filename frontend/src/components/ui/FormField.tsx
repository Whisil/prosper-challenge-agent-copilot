import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { InfoTooltip } from "./Tooltip"

interface FormFieldProps {
  label: string
  description?: string
  info?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, description, info, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-[#455249]">{label}</span>
        {info && <InfoTooltip content={info} />}
      </div>
      {description && <p className="text-[10px] leading-4 text-[#929d95]">{description}</p>}
      {children}
      {error && <p className="text-[10px] leading-4 text-[#a16d5a]">{error}</p>}
    </div>
  )
}
