import { Bot, History, LayoutGrid, Settings2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Agents", icon: Bot, active: true },
  { label: "Call history", icon: History },
  { label: "Templates", icon: LayoutGrid },
]

export function Sidebar() {
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-[#e5e8e4] bg-[#fbfcfa] px-3 py-4">
      <div className="flex items-center gap-2 px-3 pb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1f3028] text-white">
          <Sparkles size={16} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-[#1f3028]">prosper</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#96a099]">agent studio</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
              active ? "bg-[#e8eee9] text-[#1f3028]" : "text-[#7b857e] hover:bg-[#f0f3ef] hover:text-[#37413c]",
            )}
            key={label}
            type="button"
          >
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-[#edf0ed] pt-3">
        <button className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#7b857e] hover:bg-[#f0f3ef] hover:text-[#37413c]" type="button">
          <Settings2 size={16} />
          Settings
        </button>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f0f3ef] px-3 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b9c9bb] text-xs font-bold text-[#304237]">DG</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#37413c]">Deployment team</p>
            <p className="truncate text-[11px] text-[#8c968f]">Prosper workspace</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
