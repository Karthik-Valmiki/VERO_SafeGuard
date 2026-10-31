import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard } from "../api"
import {
  IndianRupee, CheckCircle2, XCircle, CloudRain,
  Wifi, AlertTriangle, Shield, Loader2, TrendingUp,
  ChevronDown, Clock
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

// ── Trigger type metadata ─────────────────────────────────────────────────
const TRIGGER_META = {
  WEATHER: {
    label: "Weather disruption", icon: CloudRain,
  },
  AQI: {
    label: "AQI pollution crisis", icon: AlertTriangle,
  },
  PLATFORM_BLACKOUT: {
    label: "Platform outage", icon: Wifi,
  },
  SOCIAL_DISRUPTION: {
    label: "Bandh / curfew", icon: Shield,
  },
}

function getTriggerMeta(type) {
  return TRIGGER_META[type] || {
    label: type || "Payout",
    icon: TrendingUp,
  }
}

const fmtCur = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"

// ── Single payout card ────────────────────────────────────────────────────
function PayoutCard({ payout }) {
  const meta = getTriggerMeta(payout.trigger_type)
  const Icon = meta.icon
  const isOk = payout.status === "SUCCESS"

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-ink-800 border border-ink-600 transition-colors">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0 text-ink-300">
        <Icon size={16} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink-100 truncate">{meta.label}</p>
        <p className="text-[11px] text-ink-400 font-mono mt-0.5">
          {fmtDate(payout.processed_at)}
        </p>
      </div>

      {/* Amount & Status */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-mono font-semibold ${isOk ? "text-positive" : "text-negative"}`}>
          {isOk ? "+" : ""}{fmtCur(payout.amount)}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {isOk ? (
            <>
              <CheckCircle2 size={10} className="text-positive" />
              <span className="text-[10px] text-positive font-medium">Paid</span>
            </>
          ) : (
            <>
              <XCircle size={10} className="text-negative" />
              <span className="text-[10px] text-negative font-medium">Failed</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Payout history filter + list ──────────────────────────────────────────
function PayoutHistory({ payouts }) {
  const [filter, setFilter] = useState("all") // all | success | failed
  const SHOW_INIT = 5

  const filtered = filter === "all"
    ? payouts
    : payouts.filter(p => filter === "success" ? p.status === "SUCCESS" : p.status !== "SUCCESS")

  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? filtered : filtered.slice(0, SHOW_INIT)

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
            className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
              filter === val
                ? "bg-accent-500 border-accent-500 text-ink-950"
                : "border-ink-600 bg-ink-800 text-ink-400 hover:text-ink-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-ink-800 border border-ink-600 rounded-2xl p-8 text-center">
          <TrendingUp size={22} className="text-ink-400 mx-auto mb-2" />
          <p className="text-ink-400 text-xs">No {filter !== "all" ? filter : ""} payouts recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <PayoutCard key={p.payout_id} payout={p} />
          ))}
          {filtered.length > SHOW_INIT && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full text-center text-xs text-ink-400 hover:text-ink-200 py-2 flex items-center justify-center gap-1 transition-colors"
            >
              {showAll
                ? <><ChevronDown size={12} className="rotate-180" /> Show fewer</>
                : <><ChevronDown size={12} /> Show {filtered.length - SHOW_INIT} more</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}

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
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-ink-950/95 backdrop-blur-md border-b border-ink-600/70">
        <div className="flex items-center gap-2">
          <IndianRupee size={16} className="text-accent-500" />
          <span className="font-semibold text-sm text-ink-100">Claims &amp; payouts</span>
        </div>
        {dash?.policy?.status === "ACTIVE" && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-positive">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            Auto-claim active
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <SimulatorBanner />
        <div className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-4">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-ink-400" size={24} />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total received", value: fmtCur(total), color: "text-accent-400" },
                  { label: "Payouts count",  value: success, color: "text-ink-100" },
                  { label: "Cap left",       value: hasPol ? fmtCur(capRem) : "—", color: capRem < 200 ? "text-accent-400" : "text-positive" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-ink-800 border border-ink-600 rounded-xl p-3 text-center">
                    <p className="text-xs text-ink-400 mb-0.5">{label}</p>
                    <p className={`text-sm font-mono font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Policy status banner */}
              {hasPol ? (
                <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                    <p className="text-ink-100 text-xs font-semibold">
                      {policy.status === "ACTIVE" ? "Policy active" : "Activation pending"}
                    </p>
                  </div>
                  <p className="text-ink-400 text-xs leading-relaxed">
                    {policy.status === "ACTIVE"
                      ? "Environmental or platform disruption in your zone triggers automatic disbursements."
                      : "Activating shortly. Disbursements will begin automatically."}
                  </p>
                  {policy.status === "ACTIVE" && policy.expires_at && (
                    <p className="text-xs text-ink-400 flex items-center gap-1">
                      <Clock size={11} />
                      Expires: {fmtDate(policy.expires_at)}
                    </p>
                  )}
                  {/* Cap progress */}
                  {policy.status === "ACTIVE" && policy.remaining_cap != null && (
                    <div className="pt-1">
                      <div className="flex justify-between text-xs text-ink-400 mb-1.5 font-mono">
                        <span>Weekly cap used</span>
                        <span className="text-accent-400">{fmtCur(capRem)} left</span>
                      </div>
                      <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-500 rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.max(5, Math.min(100, (capRem / (capRem + total)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-ink-800 border border-ink-600 rounded-2xl p-5 text-center">
                  <Shield size={24} className="text-ink-400 mx-auto mb-2" />
                  <p className="text-ink-100 font-semibold text-sm mb-1">No active policy</p>
                  <p className="text-ink-400 text-xs mb-4">
                    Get weekly protection to receive automatic compensation when disruptions hit.
                  </p>
                  <button
                    onClick={() => navigate("/payment")}
                    className="btn-primary"
                  >
                    Activate protection
                  </button>
                </div>
              )}

              {/* Payout history */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <p className="text-xs font-medium text-ink-400">Payout history</p>
                  <button onClick={load} className="text-xs text-ink-400 hover:text-ink-200 transition-colors">
                    Refresh
                  </button>
                </div>
                <PayoutHistory payouts={payouts} />
              </div>

              {/* Explainer */}
              <div className="bg-ink-800 border border-ink-600 rounded-2xl p-4">
                <p className="text-xs font-semibold mb-2.5 text-ink-100">Zero-touch claims protocol</p>
                <div className="space-y-2">
                  {[
                    "VERO continuously audits independent weather & service telemetry",
                    "Validated disruption threshold initiates automatic payout trigger",
                    "Anti-fraud validation verifies your shift schedule in real-time",
                    "Disbursement credited to your verified UPI ID every 30 minutes",
                    "No forms, no receipts, no dispute calls required",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 size={13} className="text-accent-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-ink-400 leading-relaxed">{s}</p>
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
