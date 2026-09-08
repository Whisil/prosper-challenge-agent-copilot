import type { TextareaHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full resize-y rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-[11px] text-[#27312c] outline-none placeholder:text-[11px] placeholder:text-[#9aa39d] focus:border-[#91a697] focus:ring-2 focus:ring-[#91a697]/20",
        className,
      )}
      {...props}
    />
  )
}
