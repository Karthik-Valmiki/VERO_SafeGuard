import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard } from "../api"
import {
  IndianRupee, CheckCircle2, XCircle, CloudRain,
  Wifi, AlertTriangle, Shield, Loader2, TrendingUp,
  Snowflake, Thermometer, ChevronDown, ChevronRight,
  Clock, Filter
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

// ── Trigger type metadata ─────────────────────────────────────────────────
const TRIGGER_META = {
  WEATHER: {
    label: "Weather Event", icon: CloudRain,
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
  },
  AQI: {
    label: "AQI Crisis", icon: AlertTriangle,
    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20",
  },
  PLATFORM_BLACKOUT: {
    label: "Platform Outage", icon: Wifi,
    color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20",
  },
  SOCIAL_DISRUPTION: {
    label: "Bandh / Curfew", icon: Shield,
    color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20",
  },
}

function getTriggerMeta(type) {
  return TRIGGER_META[type] || {
    label: type || "Payout",
    icon: TrendingUp,
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
  }
}

const fmtCur   = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fmtDate  = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"
const timeAgo  = (iso) => {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Single payout card ────────────────────────────────────────────────────
function PayoutCard({ payout }) {
  const meta = getTriggerMeta(payout.trigger_type)
  const Icon = meta.icon
  const isOk = payout.status === "SUCCESS"

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all
      ${isOk ? `${meta.bg} ${meta.border}` : "bg-rose-500/5 border-rose-500/20"}`}>
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={meta.color} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
        <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">
          {fmtDate(payout.processed_at)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold font-mono ${isOk ? "text-emerald-400" : "text-rose-400"}`}>
          {isOk ? "+" : ""}{fmtCur(payout.amount)}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {isOk
            ? <CheckCircle2 size={10} className="text-emerald-400" />
            : <XCircle      size={10} className="text-rose-400" />
          }
          <span className={`text-[10px] font-semibold ${isOk ? "text-emerald-400" : "text-rose-400"}`}>
            {payout.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Payout history filter + list ──────────────────────────────────────────
function PayoutHistory({ payouts }) {
  const [filter, setFilter]     = useState("all") // all | success | failed
  const [expanded, setExpanded] = useState(true)
  const SHOW_INIT = 5

  const filtered = filter === "all"
    ? payouts
    : payouts.filter(p => filter === "success" ? p.status === "SUCCESS" : p.status !== "SUCCESS")

  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? filtered : filtered.slice(0, SHOW_INIT)

  const total   = payouts.filter(p => p.status === "SUCCESS").reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const success = payouts.filter(p => p.status === "SUCCESS").length
  const failed  = payouts.filter(p => p.status !== "SUCCESS").length

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {[
          { val: "all",     label: `All (${payouts.length})` },
          { val: "success", label: `Paid (${success})` },
          { val: "failed",  label: `Failed (${failed})` },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all
              ${filter === val
                ? "bg-brand-600 border-brand-500 text-white"
                : "border-dark-600 text-gray-500 hover:text-gray-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-dark-800/40 border border-dark-700/40 rounded-2xl p-8 text-center">
          <TrendingUp size={22} className="text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No {filter !== "all" ? filter : ""} payouts yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <PayoutCard key={p.payout_id} payout={p} />
          ))}
          {filtered.length > SHOW_INIT && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2 flex items-center justify-center gap-1 transition-colors"
            >
              {showAll
                ? <><ChevronDown size={12} className="rotate-180" /> Show less</>
                : <><ChevronDown size={12} /> Show {filtered.length - SHOW_INIT} more</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CLAIMS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Claims() {
  const { rider, logout } = useAuth()
  const navigate          = useNavigate()
  const [dash,    setDash]    = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getMyDashboard()
      setDash(d.data)
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login") }
    } finally {
      setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => { load() }, [load])
  // Auto-refresh every 15s when policy is active
  useEffect(() => {
    const pol = dash?.policy
    if (pol?.status === "ACTIVE") {
      const iv = setInterval(load, 15000)
      return () => clearInterval(iv)
    }
  }, [dash?.policy?.status, load])

  if (!rider) { navigate("/login"); return null }

  const payouts   = dash?.payout_history || []
  const total     = payouts.filter(p => p.status === "SUCCESS").reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const success   = payouts.filter(p => p.status === "SUCCESS").length
  const policy    = dash?.policy
  const hasPol    = policy?.status === "ACTIVE" || policy?.status === "PENDING"
  const capRem    = Number(policy?.remaining_cap || 0)

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <IndianRupee size={16} className="text-brand-500" />
        <span className="font-semibold text-sm">Claims & Payouts</span>
        {dash?.policy?.status === "ACTIVE" && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AUTO-CLAIM ACTIVE
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <SimulatorBanner />
        <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-5">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : (
            <>
              {/* ── SUMMARY CARDS ── */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total received",  value: fmtCur(total),              color: "text-brand-400" },
                  { label: "Payouts",         value: success,                    color: "text-white" },
                  { label: "Cap remaining",   value: hasPol ? fmtCur(capRem) : "—", color: capRem < 200 ? "text-amber-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-sm font-display font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── POLICY STATUS BANNER ── */}
              {hasPol ? (
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                    <p className="text-brand-400 text-xs font-bold uppercase tracking-wider">
                      {policy.status === "ACTIVE" ? "Policy Active" : "Activation Pending"}
                    </p>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    {policy.status === "ACTIVE"
                      ? "Disruptions in your zone will trigger automatic payouts. No action needed."
                      : `Activating soon. Payouts begin after activation.`}
                  </p>
                  {policy.status === "ACTIVE" && policy.expires_at && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock size={10} />
                      Expires: {fmtDate(policy.expires_at)}
                    </p>
                  )}
                  {/* Cap progress bar */}
                  {policy.status === "ACTIVE" && policy.remaining_cap != null && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Weekly cap used</span>
                        <span className="text-brand-400 font-mono">{fmtCur(capRem)} remaining</span>
                      </div>
                      <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(5, Math.min(100, (capRem / (capRem + total)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-2xl p-5 text-center">
                  <Shield size={26} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-white font-semibold text-sm mb-1">No active policy</p>
                  <p className="text-gray-500 text-xs mb-4">
                    Purchase a policy to receive automatic payouts when disruptions hit your zone.
                  </p>
                  <button
                    onClick={() => navigate("/payment")}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all active:scale-[0.98]"
                  >
                    Activate Protection
                  </button>
                </div>
              )}

              {/* ── PAYOUT HISTORY ── */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Payout History</p>
                  <button onClick={load} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                    Refresh
                  </button>
                </div>
                <PayoutHistory payouts={payouts} />
              </div>

              {/* ── HOW IT WORKS ── */}
              <div className="bg-dark-800/40 border border-dark-700/40 rounded-2xl p-4">
                <p className="text-xs font-semibold mb-3 text-gray-300">How zero-touch claims work</p>
                <div className="space-y-2">
                  {[
                    "VERO monitors your zone 24/7 via independent data APIs",
                    "Disruption confirmed → claim created automatically",
                    "ML fraud engine validates your activity in real-time",
                    "Payout sent to your UPI every 30 minutes during the event",
                    "No form to fill, no call to make, no waiting",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 size={11} className="text-brand-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-gray-500 leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
