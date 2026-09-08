import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-[#dfe4df] bg-white px-3 text-[11px] text-[#27312c] outline-none placeholder:text-[11px] placeholder:text-[#9aa39d] focus:border-[#91a697] focus:ring-2 focus:ring-[#91a697]/20",
        className,
      )}
      {...props}
    />
  )
})
