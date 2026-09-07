import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[#e2e6e2] bg-white", className)} {...props} />
}
