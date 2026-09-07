import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: "sm" | "md"
}

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#526a5d]/40 disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-[#1f3028] text-white hover:bg-[#2d4438]",
        variant === "secondary" && "border border-[#dfe4df] bg-white text-[#37413c] hover:bg-[#f4f6f3]",
        variant === "ghost" && "text-[#66716b] hover:bg-[#eef1ed] hover:text-[#27312c]",
        variant === "outline" && "border border-[#bfcac1] bg-transparent text-[#37413c] hover:bg-white",
        className,
      )}
      {...props}
    />
  )
}
