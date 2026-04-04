import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard } from "../api"
import {
  IndianRupee, CheckCircle, XCircle, CloudRain,
  Wifi, AlertTriangle, Shield, Loader2, TrendingUp
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

const TRIGGER_ICONS = {
  WEATHER:           { icon: CloudRain,     color: "text-blue-400",   bg: "bg-blue-500/10",   label: "Heavy Rain" },
  AQI:               { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", label: "AQI Crisis" },
  PLATFORM_BLACKOUT: { icon: Wifi,          color: "text-indigo-400", bg: "bg-indigo-500/10", label: "App Outage" },
  SOCIAL_DISRUPTION: { icon: Shield,        color: "text-rose-400",   bg: "bg-rose-500/10",   label: "Bandh" },
}

function TriggerIcon({ type }) {
  const t = TRIGGER_ICONS[type] || TRIGGER_ICONS.WEATHER
  const Icon = t.icon
  return (
    <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
      <Icon size={16} className={t.color} />
    </div>
  )
}

export default function Claims() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()

  const [dash, setDash]       = useState(null)
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

  if (!rider) { navigate("/login"); return null }

  const payouts = dash?.payout_history || []
  const total   = payouts.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const success = payouts.filter(p => p.status === "SUCCESS").length
  const policy  = dash?.policy
  const hasPol  = policy?.status === "ACTIVE" || policy?.status === "PENDING"

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <IndianRupee size={16} className="text-brand-500" />
        <span className="font-semibold text-sm">Claims & Payouts</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SimulatorBanner />
        <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : (
          <>
            {/* ── SUMMARY CARDS ── */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total received",  value: `₹${total.toFixed(0)}`, color: "text-brand-400" },
                { label: "Payouts",         value: success,                 color: "text-white" },
                { label: "Cap remaining",   value: hasPol ? `₹${Number(policy.remaining_cap || 0).toFixed(0)}` : "—", color: "text-green-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                  <p className={`text-base font-display font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── ACTIVE CLAIM NOTICE ── */}
            {hasPol && (
              <div className="flex items-center gap-3 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-brand-400 text-xs font-semibold">Policy active — zero-touch claims enabled</p>
                  <p className="text-gray-500 text-[11px]">Disruptions trigger payouts automatically. No action needed.</p>
                </div>
              </div>
            )}

            {/* ── NO POLICY GATE ── */}
            {!hasPol && (
              <div className="card !p-5 border-dark-600 text-center">
                <Shield size={28} className="text-gray-600 mx-auto mb-3" />
                <p className="text-white font-semibold text-sm mb-1">No active policy</p>
                <p className="text-gray-500 text-xs mb-4">Activate a policy to start receiving automatic payouts when disruptions hit your zone.</p>
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
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payout history</p>
                <p className="text-[11px] text-gray-600">{payouts.length} transactions</p>
              </div>

              {payouts.length === 0 ? (
                <div className="bg-dark-800/40 border border-dark-700/40 rounded-2xl p-8 text-center">
                  <TrendingUp size={24} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No payouts yet</p>
                  <p className="text-gray-600 text-xs mt-1">
                    {hasPol
                      ? "When a disruption hits your zone, payouts will appear here."
                      : "Activate a policy to start receiving payouts."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p) => {
                    const triggerType = p.trigger_type || "WEATHER"
                    const meta = TRIGGER_ICONS[triggerType] || TRIGGER_ICONS.WEATHER
                    return (
                      <div
                        key={p.payout_id}
                        className="flex items-center gap-3 bg-dark-800/60 border border-dark-700/50 rounded-xl px-4 py-3"
                      >
                        <TriggerIcon type={triggerType} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{meta.label}</p>
                          <p className="text-[11px] text-gray-500 font-mono truncate">
                            {new Date(p.processed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-brand-400">+₹{parseFloat(p.amount).toFixed(2)}</p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {p.status === "SUCCESS"
                              ? <CheckCircle size={10} className="text-green-400" />
                              : <XCircle size={10} className="text-red-400" />
                            }
                            <span className={`text-[10px] ${p.status === "SUCCESS" ? "text-green-400" : "text-red-400"}`}>
                              {p.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── HOW CLAIMS WORK ── */}
            <div className="bg-dark-800/40 border border-dark-700/40 rounded-2xl p-4">
              <p className="text-xs font-semibold mb-3 text-gray-300">How zero-touch claims work</p>
              <div className="space-y-2">
                {[
                  "VERO monitors your zone 24/7 via independent APIs",
                  "Disruption confirmed → claim created automatically",
                  "Payout sent to your UPI every 30 minutes",
                  "No form, no call, no waiting",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={12} className="text-brand-400 mt-0.5 shrink-0" />
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
