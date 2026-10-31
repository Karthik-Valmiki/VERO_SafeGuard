import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard, getQuote, purchasePolicy } from "../api"
import {
  Shield, CheckCircle, Clock, ArrowRight, Loader2,
  CloudRain, Wifi, AlertTriangle, RefreshCw, Info
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

const COVERS = [
  { icon: CloudRain,     label: "Heavy rain & hailstorm", desc: ">50mm/hr sustained for 1 hour" },
  { icon: AlertTriangle, label: "Severe air quality (AQI >300)", desc: "Sustained 2 hours in delivery zone" },
  { icon: Wifi,          label: "Platform outage", desc: "Zomato or Swiggy down >45 min peak" },
  { icon: Shield,        label: "Bandh & civic shutdown", desc: "Declared local zone commercial shutdown" },
]

function StatusBadge({ status }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-positive/10 text-positive border border-positive/25">
        <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
        Active
      </span>
    )
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-400/10 text-accent-400 border border-accent-400/25">
        <Clock size={11} />
        Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ink-700 text-ink-400 border border-ink-600">
      Inactive
    </span>
  )
}

export default function Policy() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()

  const [dash, setDash]       = useState(null)
  const [quote, setQuote]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying]   = useState(false)
  const [buyMsg, setBuyMsg]   = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, q] = await Promise.all([getMyDashboard(), getQuote()])
      setDash(d.data)
      setQuote(q.data)
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login") }
    } finally {
      setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => { load() }, [load])

  if (!rider) { navigate("/login"); return null }

  const policy = dash?.policy
  const riderD = dash?.rider
  const hasPol = policy?.status === "ACTIVE" || policy?.status === "PENDING"
  const used   = Number(policy?.total_paid_out || 0)
  const cap    = Number(policy?.weekly_cap || parseFloat(policy?.premium || 0) * 10 || 1)
  const capPct = Math.min(100, (used / cap) * 100)

  return (
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-ink-950/95 backdrop-blur-md border-b border-ink-600/70">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-accent-500" />
          <span className="font-semibold text-sm text-ink-100">Policy management</span>
        </div>
        <button onClick={load} aria-label="Refresh policy status" className="text-ink-400 hover:text-ink-100 transition-colors">
          <RefreshCw size={14} />
        </button>
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
              {/* Coverage status card */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-ink-100">Coverage status</span>
                  <StatusBadge status={policy?.status} />
                </div>

                {hasPol ? (
                  <>
                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      <div className="bg-ink-700/70 border border-ink-600 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-400 mb-0.5">Coverage</p>
                        <p className="text-lg font-mono font-semibold text-ink-100">{Number(policy.coverage_pct || 0).toFixed(0)}%</p>
                      </div>
                      <div className="bg-ink-700/70 border border-ink-600 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-400 mb-0.5">Premium</p>
                        <p className="text-lg font-mono font-semibold text-accent-400">₹{Number(policy.premium || 0).toFixed(0)}</p>
                      </div>
                      <div className="bg-ink-700/70 border border-ink-600 rounded-xl p-3 text-center">
                        <p className="text-xs text-ink-400 mb-0.5">Weekly cap</p>
                        <p className="text-lg font-mono font-semibold text-ink-100">₹{Number(policy.weekly_cap || 0).toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Cap usage */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-ink-400 mb-1.5 font-mono">
                        <span>Cap utilized: ₹{used.toFixed(0)}</span>
                        <span>Remaining: ₹{Number(policy.remaining_cap || 0).toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-500 rounded-full transition-[width] duration-500" style={{ width: `${capPct}%` }} />
                      </div>
                    </div>

                    {policy.status === "PENDING" && (
                      <div className="flex items-center gap-2 mt-3 bg-accent-400/10 border border-accent-400/20 rounded-xl px-3 py-2.5">
                        <Clock size={13} className="text-accent-400 shrink-0" />
                        <p className="text-accent-400 text-xs">Activation pending — live within window</p>
                      </div>
                    )}

                    {/* Policy metadata */}
                    <div className="mt-4 pt-4 border-t border-ink-600 space-y-2">
                      {[
                        { label: "Policy holder",     value: riderD?.name || rider?.name },
                        { label: "Platform",          value: riderD?.platform || rider?.platform },
                        { label: "Operating city",    value: riderD?.city || rider?.city },
                        { label: "Payout interval",   value: "Every 30 minutes" },
                        { label: "Claim protocol",    value: "Zero-touch (automated)" },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-ink-400">{label}</span>
                          <span className="text-ink-100 font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {quote && (
                      <div className="bg-ink-700/70 border border-ink-600 rounded-xl p-4 mb-4">
                        <p className="text-xs text-ink-400 mb-3">Weekly policy quote</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="text-center">
                            <p className="text-xs text-ink-400 mb-0.5">Coverage</p>
                            <p className="text-lg font-mono font-semibold text-ink-100">{quote.coverage_pct}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-ink-400 mb-0.5">Premium</p>
                            <p className="text-lg font-mono font-semibold text-accent-400">₹{quote.premium}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-ink-400 mb-0.5">Weekly cap</p>
                            <p className="text-lg font-mono font-semibold text-ink-100">₹{quote.weekly_cap}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-ink-400 pt-1 border-t border-ink-600/60">
                          <Info size={12} className="text-accent-500 shrink-0" />
                          <span>{quote.city} zone risk: {Number(quote.zone_risk_multiplier || 1).toFixed(2)}×</span>
                        </div>
                      </div>
                    )}

                    {buyMsg && (
                      <div className={`p-3 rounded-xl text-xs mb-3 border ${buyMsg.startsWith("✓") ? "bg-positive/10 border-positive/20 text-positive" : "bg-negative/10 border-negative/20 text-negative"}`}>
                        {buyMsg}
                      </div>
                    )}

                    <button
                      onClick={() => navigate("/payment")}
                      className="btn-primary"
                    >
                      <span>Activate protection</span>
                      <ArrowRight size={15} />
                    </button>
                    <p className="text-center text-xs text-ink-400 mt-2">Immediate verification · Zero paperwork</p>
                  </>
                )}
              </div>

              {/* Covered triggers */}
              <div>
                <p className="text-xs font-medium text-ink-400 mb-2 px-1">Covered disruptions</p>
                <div className="space-y-2">
                  {COVERS.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-center gap-3 bg-ink-800 border border-ink-600 rounded-xl px-4 py-3">
                      <Icon size={16} className="text-ink-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink-100">{label}</p>
                        <p className="text-xs text-ink-400 truncate">{desc}</p>
                      </div>
                      <CheckCircle size={14} className="text-positive shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="card">
                <p className="text-xs font-semibold text-ink-100 mb-3">Disbursement mechanics</p>
                <div className="space-y-2.5">
                  {[
                    "Environmental/platform telemetry verified by independent data feeds",
                    "Automated disbursement initialized without requiring a claim",
                    "Direct UPI credits distributed in 30-minute intervals",
                    "Disbursement concludes when conditions normalize or weekly cap is reached",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-md bg-ink-700 border border-ink-600 text-accent-400 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-ink-300 leading-relaxed">{step}</p>
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
