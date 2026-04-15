import { useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Bell, CheckCircle2, Zap,
  CloudRain, AlertTriangle, Wifi, Shield, IndianRupee, MapPin
} from "lucide-react"
import { getNotifications } from "../api"

// ── Trigger type → icon + colour ─────────────────────────────────────────
const TRIGGER_META = {
  WEATHER:           { icon: CloudRain,     color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   label: "Weather Event" },
  AQI:               { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "AQI Crisis" },
  PLATFORM_BLACKOUT: { icon: Wifi,          color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", label: "Platform Outage" },
  SOCIAL_DISRUPTION: { icon: Shield,        color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20",   label: "Bandh / Curfew" },
}

function getMeta(type) {
  return TRIGGER_META[type] || {
    icon: Zap, color: "text-brand-400", bg: "bg-brand-500/10", border: "border-brand-500/20", label: "Disruption"
  }
}

const fmtCur = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0)

const fmtTime = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 1)  return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h ago`
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
}

// ── Active trigger card ───────────────────────────────────────────────────
function ActiveCard({ n }) {
  const meta = getMeta(n.metadata?.trigger_type)
  const Icon = meta.icon
  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`w-9 h-9 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon size={16} className={`${meta.color} animate-pulse`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              LIVE
            </span>
          </div>
          <p className="text-sm font-semibold text-white">{n.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{n.message}</p>
          {n.metadata?.zone_name && (
            <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
              <MapPin size={9} /> {n.metadata.zone_name}
            </p>
          )}
        </div>
        <p className="text-[10px] text-gray-500 flex-shrink-0 mt-0.5">{fmtTime(n.created_at)}</p>
      </div>
    </div>
  )
}

// ── Completed payout card ─────────────────────────────────────────────────
function CompletedCard({ n }) {
  const meta = getMeta(n.metadata?.trigger_type)
  const Icon = meta.icon
  const amount = n.metadata?.payout_amount
  return (
    <div className="rounded-2xl border border-dark-700/50 bg-dark-800/60 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle2 size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Icon size={11} className={meta.color} />
            <p className={`text-[10px] font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</p>
          </div>
          <p className="text-sm font-semibold text-white">{n.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{n.message}</p>
          {n.metadata?.zone_name && (
            <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
              <MapPin size={9} /> {n.metadata.zone_name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          {amount != null && (
            <div className="flex items-center gap-1 text-emerald-400">
              <IndianRupee size={11} />
              <span className="text-sm font-bold font-mono">{fmtCur(amount)}</span>
            </div>
          )}
          <p className="text-[10px] text-gray-500">{fmtTime(n.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await getNotifications()
      setNotifications(res.data || [])
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 10s so live trigger notifications update in real time
    const iv = setInterval(() => load(true), 10000)
    return () => clearInterval(iv)
  }, [load])

  const active    = notifications.filter(n => n.type === "active")
  const completed = notifications.filter(n => n.type === "completed")

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white transition-colors p-1">
          <ArrowLeft size={16} />
        </button>
        <Bell size={15} className="text-brand-500" />
        <span className="font-semibold text-sm">Notifications</span>
        {notifications.length > 0 && (
          <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
            {notifications.length}
          </span>
        )}
        {active.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            {active.length} LIVE
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-3">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Zap size={24} className="text-brand-500 animate-pulse" />
            </div>

          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell size={32} className="text-gray-700 mb-4" />
              <p className="text-gray-500 text-sm font-medium">No notifications yet</p>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                When a disruption triggers a payout in your zone,<br />it will appear here automatically.
              </p>
            </div>

          ) : (
            <>
              {/* Active disruptions */}
              {active.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1 font-semibold">
                    Active disruptions
                  </p>
                  {active.map(n => <ActiveCard key={n.id} n={n} />)}
                </div>
              )}

              {/* Completed payouts */}
              {completed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1 font-semibold mt-2">
                    Payout history
                  </p>
                  {completed.map(n => <CompletedCard key={n.id} n={n} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
