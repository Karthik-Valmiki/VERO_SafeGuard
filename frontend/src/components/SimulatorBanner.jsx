import { useNavigate } from "react-router-dom"
import { useSim } from "../context/AuthContext"
import { Loader2 } from "lucide-react"

// Only shows ACTIVE (running) triggers in the top bar.
// Completed triggers are moved to the Notifications page in Profile.
export default function SimulatorBanner() {
  const { activeTriggers } = useSim()
  const navigate = useNavigate()

  if (activeTriggers.length === 0) return null

  return (
    <div className="px-3 pt-2 space-y-1.5">
      {activeTriggers.map(t => {
        const pct = Math.min(100, (t.elapsed / t.intervalCount) * 100)
        return (
          <button
            key={t.id}
            onClick={() => navigate("/simulator")}
            className={`w-full flex items-center gap-2.5 ${t.bg} border ${t.color.replace("text-","border-").replace("400","500/30")} rounded-xl px-3 py-2 text-left`}
          >
            <Loader2 size={13} className={`${t.color} animate-spin shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] font-bold ${t.color}`}>{t.label}</span>
                <span className="text-[10px] text-gray-500">{t.elapsed}/{t.intervalCount}</span>
              </div>
              <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${t.color.replace("text-","bg-")}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 shrink-0">tap</span>
          </button>
        )
      })}
    </div>
  )
}
