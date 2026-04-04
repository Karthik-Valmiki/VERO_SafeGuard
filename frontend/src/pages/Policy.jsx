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
  { icon: CloudRain,     label: "Heavy Rain & Hailstorm",  desc: ">50mm/hr sustained 1hr" },
  { icon: AlertTriangle, label: "Toxic Air (AQI >300)",    desc: "Sustained 2hrs in your zone" },
  { icon: Wifi,          label: "Platform Outage",          desc: "Zomato/Swiggy down >45min peak" },
  { icon: Shield,        label: "Bandh & Civic Shutdown",  desc: "Pre-armed night before" },
]

function StatusBadge({ status }) {
  if (status === "ACTIVE")  return <span className="badge bg-green-500/15 text-green-400 border border-green-500/25"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Active</span>
  if (status === "PENDING") return <span className="badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"><Clock size={10} />Pending</span>
  return <span className="badge bg-dark-600 text-gray-500 border border-dark-500">No Policy</span>
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

  const handlePurchase = async () => {
    setBuying(true); setBuyMsg("")
    try {
      await purchasePolicy()
      setBuyMsg("✓ Policy purchased!")
      await load()
    } catch (e) {
      setBuyMsg(e.response?.data?.detail || "Purchase failed")
    }
    setBuying(false)
  }

  if (!rider) { navigate("/login"); return null }

  const policy = dash?.policy
  const riderD = dash?.rider
  const hasPol = policy?.status === "ACTIVE" || policy?.status === "PENDING"
  const used   = Number(policy?.total_paid_out || 0)
  const cap    = Number(policy?.weekly_cap || 1)
  const capPct = Math.min(100, (used / cap) * 100)

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-brand-500" />
          <span className="font-semibold text-sm">My Policy</span>
        </div>
        <button onClick={load} className="text-gray-600 hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
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
            {/* ── STATUS CARD ── */}
            <div className="card !p-5 border-dark-600">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Coverage Status</span>
                <StatusBadge status={policy?.status} />
              </div>

              {hasPol ? (
                <>
                  {/* Big numbers */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-dark-900/60 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Coverage</p>
                      <p className="text-xl font-display font-bold text-white">{Number(policy.coverage_pct || 0).toFixed(0)}%</p>
                    </div>
                    <div className="bg-dark-900/60 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Premium</p>
                      <p className="text-xl font-display font-bold text-brand-400">₹{policy.premium_paid}</p>
                    </div>
                    <div className="bg-dark-900/60 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Weekly cap</p>
                      <p className="text-xl font-display font-bold text-white">₹{policy.weekly_cap}</p>
                    </div>
                  </div>

                  {/* Cap usage bar */}
                  <div className="mb-1">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
                      <span>Cap used: ₹{used.toFixed(0)}</span>
                      <span>Remaining: ₹{Number(policy.remaining_cap || 0).toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${capPct}%` }} />
                    </div>
                  </div>

                  {policy.status === "PENDING" && (
                    <div className="flex items-center gap-2 mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
                      <Clock size={13} className="text-yellow-400 shrink-0" />
                      <p className="text-yellow-400 text-xs">Activating — coverage live shortly</p>
                    </div>
                  )}

                  {/* Policy meta */}
                  <div className="mt-4 pt-4 border-t border-dark-700/50 space-y-2">
                    {[
                      { label: "Rider",            value: riderD?.name || rider?.name },
                      { label: "Platform",         value: riderD?.platform || rider?.platform },
                      { label: "City",             value: riderD?.city || rider?.city },
                      { label: "Payout interval",  value: "Every 30 minutes" },
                      { label: "Claim process",    value: "Zero-touch (automatic)" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-white font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* No policy — quote + buy */
                <>
                  {quote && (
                    <div className="bg-dark-900/60 rounded-xl p-4 mb-4">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Your quote this week</p>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">Coverage</p>
                          <p className="text-xl font-display font-bold">{quote.coverage_pct}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">Premium</p>
                          <p className="text-xl font-display font-bold text-brand-400">₹{quote.premium}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">Weekly cap</p>
                          <p className="text-xl font-display font-bold">₹{quote.weekly_cap}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Info size={11} className="text-brand-400" />
                        {quote.city} · Zone risk {Number(quote.zone_risk_multiplier || 1).toFixed(2)}×
                        {!riderD?.is_new_user && (
                          <span className="text-brand-400 ml-1">· R={Number(riderD?.reliability_score || 0).toFixed(2)} applied</span>
                        )}
                      </div>
                    </div>
                  )}

                  {buyMsg && (
                    <div className={`p-3 rounded-xl text-xs mb-3 border ${buyMsg.startsWith("✓") ? "bg-brand-500/10 border-brand-500/20 text-brand-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                      {buyMsg}
                    </div>
                  )}

                  <button
                    onClick={() => navigate("/payment")}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_8px_24px_rgba(139,92,246,0.3)] active:scale-[0.98]"
                  >
                    Activate Protection
                    <ArrowRight size={15} />
                  </button>
                  <p className="text-center text-[11px] text-gray-600 mt-2">24-hour activation window applies</p>
                </>
              )}
            </div>

            {/* ── WHAT'S COVERED ── */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 px-1">What's covered</p>
              <div className="space-y-2">
                {COVERS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 bg-dark-800/60 border border-dark-700/50 rounded-xl px-4 py-3">
                    <Icon size={15} className="text-brand-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">{label}</p>
                      <p className="text-[11px] text-gray-500">{desc}</p>
                    </div>
                    <CheckCircle size={13} className="text-brand-400 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── HOW PAYOUTS WORK ── */}
            <div className="card !p-4 border-dark-600">
              <p className="text-xs font-semibold mb-3">How payouts work</p>
              <div className="space-y-2.5">
                {[
                  "Disruption confirmed by independent third-party data",
                  "Payout starts automatically — no claim needed",
                  "₹ sent to your UPI every 30 minutes while disruption lasts",
                  "Stops when conditions clear or weekly cap is reached",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-500/15 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-gray-400 leading-relaxed">{step}</p>
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
