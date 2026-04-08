import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard, getQuote } from "../api"
import {
  Shield, TrendingUp, CloudRain, Wifi, AlertTriangle,
  ArrowRight, RefreshCw, LogOut, MapPin, Clock, ChevronRight, Zap, BarChart2
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

const RISK_COLORS = {
  LOW: { bar: "bg-green-500", text: "text-green-400", label: "Low Risk" },
  MEDIUM: { bar: "bg-yellow-500", text: "text-yellow-400", label: "Moderate" },
  HIGH: { bar: "bg-red-500", text: "text-red-400", label: "High Risk" },
}
function getRiskLevel(m) {
  if (m >= 1.25) return "HIGH"
  if (m >= 1.1) return "MEDIUM"
  return "LOW"
}

function RiskForecastCard({ quote }) {
  if (!quote) return null
  const m = Number(quote.zone_risk_multiplier || 1)
  const level = getRiskLevel(m)
  const { bar, text, label } = RISK_COLORS[level]
  const pct = Math.min(100, ((m - 0.8) / 0.7) * 100)
  return (
    <div className="card !p-4 border-dark-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-brand-400" />
          <span className="text-sm font-semibold">Next Week Risk Forecast</span>
        </div>
        <span className={`text-xs font-bold ${text}`}>{label}</span>
      </div>
      <div className="h-2 bg-dark-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>Zone: {quote.city}</span>
        <span>Risk {m.toFixed(2)}×</span>
      </div>
      <p className="text-[11px] text-gray-500 mt-1.5">
        {level === "HIGH" && "⚠ Disruptions likely this week. Coverage recommended."}
        {level === "MEDIUM" && "Moderate disruption probability in your zone."}
        {level === "LOW" && "Conditions look stable. Stay protected anyway."}
      </p>
    </div>
  )
}

function UpsellBanner({ quote, onActivate }) {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600/30 via-dark-800 to-dark-900 border border-brand-500/30 p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-brand-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-brand-400">You're not covered</span>
          </div>
          <p className="text-white font-bold text-base mb-1">Protect your income today</p>
          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            One bad rain day can cost you ₹300–500. VERO pays you back automatically — no forms, no calls.
          </p>
          {quote && (
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Premium</p>
                <p className="text-2xl font-display font-black text-white">₹{quote.premium}</p>
              </div>
              <div className="w-px h-10 bg-dark-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Coverage</p>
                <p className="text-2xl font-display font-black text-brand-400">{quote.coverage_pct}%</p>
              </div>
              <div className="w-px h-10 bg-dark-600" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cap</p>
                <p className="text-2xl font-display font-black text-white">₹{quote.weekly_cap}</p>
              </div>
            </div>
          )}
          <button onClick={onActivate} className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_8px_24px_rgba(139,92,246,0.35)] active:scale-[0.98]">
            Activate Protection <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: CloudRain, text: "Rain & hailstorm" },
          { icon: Wifi, text: "App outages" },
          { icon: AlertTriangle, text: "AQI spikes" },
          { icon: Shield, text: "Bandh & curfew" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 bg-dark-800/60 border border-dark-700/50 rounded-xl px-3 py-2.5">
            <Icon size={13} className="text-brand-400 shrink-0" />
            <span className="text-xs text-gray-400">{text}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-gray-600">Weekly plan · Cancel anytime · Instant UPI payouts</p>
    </div>
  )
}

function ActivePolicyCard({ policy, onViewPolicy }) {
  const used = Number(policy.total_paid_out || 0)
  const cap = Number(policy.weekly_cap || 1)
  const pct = Math.min(100, (used / cap) * 100)
  return (
    <div className="card !p-4 border-brand-500/20 bg-gradient-to-br from-brand-500/5 to-dark-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Coverage Active</span>
        </div>
        <button onClick={onViewPolicy} className="text-[11px] text-brand-400 flex items-center gap-1 hover:text-brand-300">
          Details <ChevronRight size={11} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Coverage</p>
          <p className="text-lg font-display font-bold text-white">{Number(policy.coverage_pct || 0).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Premium</p>
          <p className="text-lg font-display font-bold text-white">₹{policy.premium_paid}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Cap left</p>
          <p className="text-lg font-display font-bold text-brand-400">₹{Number(policy.remaining_cap || 0).toFixed(0)}</p>
        </div>
      </div>
      <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>Used ₹{used.toFixed(0)}</span>
        <span>Cap ₹{cap.toFixed(0)}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [d, q] = await Promise.all([getMyDashboard(), getQuote()])
      setDash(d.data); setQuote(q.data)
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login") }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => { load() }, [load])

  if (!rider) { navigate("/login"); return null }

  const policy = dash?.policy
  const riderD = dash?.rider
  const hasPol = policy?.status === "ACTIVE" || policy?.status === "PENDING"
  const isPending = policy?.status === "PENDING"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      {/* NAV */}
      <nav className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-dark-700/50 bg-dark-900/95 backdrop-blur-md z-40">
        <span className="font-display text-lg font-black tracking-tight flex items-center gap-1.5">
          <Shield size={18} className="text-brand-500" /> VERO
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg text-[11px] font-bold hover:bg-red-500/20 transition-all">
            <BarChart2 size={12} /> Admin
          </button>
          <button onClick={() => navigate("/simulator")} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 rounded-lg text-[11px] font-bold hover:bg-yellow-500/20 transition-all">
            <Zap size={12} /> Simulate
          </button>
          <button onClick={() => load(true)} className="text-gray-600 hover:text-white transition-colors p-1.5">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { logout(); navigate("/") }} className="text-gray-600 hover:text-white transition-colors p-1.5">
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <SimulatorBanner />
        <div className="max-w-md mx-auto px-4 pt-3 pb-28 space-y-4">
          {loading ? (
            <div className="text-center py-20 text-gray-600 text-sm animate-pulse">Loading your dashboard...</div>
          ) : (
            <>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-gray-500 text-xs">{greeting} 👋</p>
                  <h1 className="font-display text-2xl font-bold mt-0.5">{riderD?.name || rider?.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <MapPin size={10} /> {riderD?.city || rider?.city}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-dark-600" />
                    <span className="text-[11px] text-gray-500">{riderD?.platform || rider?.platform}</span>
                    {!riderD?.is_new_user && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-dark-600" />
                        <span className="text-[11px] text-brand-400 font-medium">R={Number(riderD?.reliability_score || 0).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-dark-800 border border-brand-500/30 flex items-center justify-center">
                  <span className="text-lg font-black text-brand-400">{(riderD?.name || rider?.name || "R")[0]}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Tenure", value: `${riderD?.r_breakdown?.weeks_tracked || 0}w`, sub: "weeks active" },
                  { label: "R-Score", value: riderD?.is_new_user ? "—" : Number(riderD?.reliability_score || 0).toFixed(2), sub: "reliability" },
                  { label: "Shift", value: rider?.shift_start?.slice(0, 5) || "—", sub: "shift start" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-base font-display font-bold text-white">{value}</p>
                    <p className="text-[10px] text-gray-600">{sub}</p>
                  </div>
                ))}
              </div>

              {isPending && (
                <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <Clock size={15} className="text-yellow-400 shrink-0" />
                  <div>
                    <p className="text-yellow-400 text-xs font-semibold">Policy activating</p>
                    <p className="text-gray-500 text-[11px]">Your coverage will be live shortly.</p>
                  </div>
                </div>
              )}

              {hasPol
                ? <ActivePolicyCard policy={policy} onViewPolicy={() => navigate("/policy")} />
                : <UpsellBanner quote={quote} onActivate={() => navigate("/payment")} />
              }

              <RiskForecastCard quote={quote} />

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 px-1">Quick actions</p>
                <div className="space-y-2">
                  {[
                    { label: "View Policy Details", sub: hasPol ? "Active this week" : "No active policy", path: "/policy", icon: Shield },
                    { label: "Claims & Payouts", sub: "Your payout history", path: "/claims", icon: TrendingUp },
                  ].map(({ label, sub, path, icon: Icon }) => (
                    <button key={label} onClick={() => navigate(path)}
                      className="w-full flex items-center justify-between bg-dark-800/60 border border-dark-700/50 rounded-xl px-4 py-3 hover:border-dark-500 hover:bg-dark-800 transition-all group">
                      <div className="flex items-center gap-3">
                        <Icon size={15} className="text-brand-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-[11px] text-gray-500">{sub}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                    </button>
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
