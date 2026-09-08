import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { ReactNode } from "react"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: ReactNode
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-[60] max-w-64 rounded-lg bg-[#1f3028] px-3 py-2 text-[11px] leading-4 text-white shadow-lg">
            {content}
            <TooltipPrimitive.Arrow className="fill-[#1f3028]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export function InfoTooltip({ content, className }: { content: ReactNode; className?: string }) {
  return (
    <Tooltip content={content}>
      <button type="button" aria-label="More information" className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full text-[#9aa49d] hover:text-[#66846d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#91a697]/40", className)}>
        <CircleHelp size={13} />
      </button>
    </Tooltip>
  )
}
