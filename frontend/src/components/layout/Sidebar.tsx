import { Bot, ChevronLeft, ChevronRight, Clock3, Sparkles } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Workspace = "agents" | "history"

const navItems = [
  { label: "Agents", icon: Bot, workspace: "agents" as const },
  { label: "Call history", icon: Clock3, workspace: "history" as const },
]

interface SidebarProps {
  workspace: Workspace
  onWorkspaceChange: (workspace: Workspace) => void
}

export function Sidebar({ workspace, onWorkspaceChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-[#e5e8e4] bg-[#fbfcfa] py-4 transition-[width,padding]", collapsed ? "w-[72px] px-2" : "w-[224px] px-3")}>
      <div className={cn("relative flex h-12 items-center pb-8", collapsed ? "justify-center" : "justify-between gap-2 px-3")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1f3028] text-white">
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
        {navItems.map(({ label, icon: Icon, workspace: itemWorkspace }) => (
          <button
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              workspace === itemWorkspace ? "bg-[#e8eee9] text-[#1f3028]" : "text-[#7b857e] hover:bg-[#f0f3ef] hover:text-[#37413c]",
            )}
            key={label}
            type="button"
            onClick={() => onWorkspaceChange(itemWorkspace)}
            aria-label={label}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} strokeWidth={workspace === itemWorkspace ? 2.2 : 1.8} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
