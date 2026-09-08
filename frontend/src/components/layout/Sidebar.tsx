import { Bot, ChevronLeft, ChevronRight, History, Sparkles } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Agents", icon: Bot, active: true },
  { label: "Call insights", icon: History, active: false, planned: true },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-[#e5e8e4] bg-[#fbfcfa] py-4 transition-[width,padding]", collapsed ? "w-[72px] px-2" : "w-[224px] px-3")}>
      <div className={cn("relative flex items-center pb-8", collapsed ? "justify-center" : "justify-between gap-2 px-3")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1f3028] text-white">
          <Sparkles size={16} />
        </div>
        {!collapsed && <div>
          <p className="text-sm font-bold tracking-tight text-[#1f3028]">prosper</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#96a099]">agent studio</p>
        </div>}
        <button type="button" className={cn("flex h-7 w-7 items-center justify-center rounded-lg border border-[#dfe4df] bg-white text-[#647168] shadow-[0_2px_6px_rgba(31,48,40,0.06)] hover:border-[#bfcac1] hover:bg-[#f0f3ef] hover:text-[#37413c]", collapsed && "absolute left-[52px]")} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon, active, planned }) => (
          <button
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active ? "bg-[#e8eee9] text-[#1f3028]" : planned ? "cursor-not-allowed text-[#a4aca6]" : "text-[#7b857e] hover:bg-[#f0f3ef] hover:text-[#37413c]",
            )}
            key={label}
            type="button"
            disabled={planned}
            aria-label={label}
            aria-disabled={planned || undefined}
            title={collapsed ? `${label}${planned ? " — coming soon" : ""}` : planned ? "Coming soon" : undefined}
          >
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
            {!collapsed && <span className="flex items-center gap-2">{label}{planned && <span className="rounded-full bg-[#eef1ee] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#9aa49d]">Soon</span>}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
