import { useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Bell, CheckCircle2, Zap,
  CloudRain, AlertTriangle, Wifi, Shield, IndianRupee, MapPin
} from "lucide-react"
import { getNotifications } from "../api"

const TRIGGER_META = {
  WEATHER:           { icon: CloudRain,     label: "Weather disruption" },
  AQI:               { icon: AlertTriangle, label: "Air quality alert" },
  PLATFORM_BLACKOUT: { icon: Wifi,          label: "Platform outage" },
  SOCIAL_DISRUPTION: { icon: Shield,        label: "Civic curfew" },
}

function getMeta(type) {
  return TRIGGER_META[type] || {
    icon: Zap, label: "Disruption event"
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

function ActiveCard({ n }) {
  const meta = getMeta(n.metadata?.trigger_type)
  const Icon = meta.icon
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0 mt-0.5 text-accent-400">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold text-accent-400">{meta.label}</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-negative/10 text-negative border border-negative/25 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-negative animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm font-semibold text-ink-100">{n.title}</p>
          <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{n.message}</p>
          {n.metadata?.zone_name && (
            <p className="text-xs text-ink-400 mt-2 flex items-center gap-1">
              <MapPin size={11} /> {n.metadata.zone_name}
            </p>
          )}
        </div>
        <p className="text-[11px] text-ink-400 font-mono shrink-0 mt-0.5">{fmtTime(n.created_at)}</p>
      </div>
    </div>
  )
}

function CompletedCard({ n }) {
  const meta = getMeta(n.metadata?.trigger_type)
  const amount = n.metadata?.payout_amount
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0 mt-0.5 text-positive">
          <CheckCircle2 size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-400 mb-0.5">{meta.label}</p>
          <p className="text-sm font-semibold text-ink-100">{n.title}</p>
          <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{n.message}</p>
          {n.metadata?.zone_name && (
            <p className="text-xs text-ink-400 mt-2 flex items-center gap-1">
              <MapPin size={11} /> {n.metadata.zone_name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          {amount != null && (
            <span className="text-sm font-mono font-semibold text-positive">
              +{fmtCur(amount)}
            </span>
          )}
          <p className="text-[11px] text-ink-400 font-mono">{fmtTime(n.created_at)}</p>
        </div>
      </div>
    </div>
  )
}

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
    const iv = setInterval(() => load(true), 10000)
    return () => clearInterval(iv)
  }, [load])

  const active    = notifications.filter(n => n.type === "active")
  const completed = notifications.filter(n => n.type === "completed")

  return (
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-ink-950/95 backdrop-blur-md border-b border-ink-600/70">
        <button onClick={() => navigate(-1)} className="text-ink-400 hover:text-ink-100 transition-colors p-1">
          <ArrowLeft size={16} />
        </button>
        <Bell size={16} className="text-accent-500" />
        <span className="font-semibold text-sm text-ink-100">Disruption alerts</span>
        {notifications.length > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-ink-800 border border-ink-600 text-ink-300">
            {notifications.length}
          </span>
        )}
        {active.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-negative">
            <span className="w-1.5 h-1.5 rounded-full bg-negative animate-pulse" />
            {active.length} active
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-ink-400">
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell size={28} className="text-ink-500 mb-3" />
              <p className="text-ink-300 text-sm font-medium">No disruption alerts</p>
              <p className="text-ink-400 text-xs mt-1 max-w-[260px] leading-relaxed">
                When environmental or platform conditions trigger automatic compensation, notifications will appear here.
              </p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-400 font-medium px-1">Active disruptions</p>
                  {active.map(n => <ActiveCard key={n.id} n={n} />)}
                </div>
              )}

              {completed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-400 font-medium px-1">Disbursement history</p>
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
