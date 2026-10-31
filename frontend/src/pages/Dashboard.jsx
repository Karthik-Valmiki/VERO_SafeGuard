import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard, getQuote, logActivity } from "../api"
import {
  Shield, TrendingUp, CloudRain, Wifi, AlertTriangle,
  ArrowRight, RefreshCw, LogOut, MapPin, Clock, ChevronRight, Zap
} from "lucide-react"
import SimulatorBanner from "../components/SimulatorBanner"

const RISK_COLORS = {
  LOW: { bar: "bg-positive", text: "text-positive", label: "Low risk" },
  MEDIUM: { bar: "bg-accent-400", text: "text-accent-400", label: "Moderate risk" },
  HIGH: { bar: "bg-negative", text: "text-negative", label: "High risk" },
}

function getRiskLevel(m) {
  if (m >= 1.25) return "HIGH"
  if (m >= 1.1) return "MEDIUM"
  return "LOW"
}

function ZoneCard({ riderD, quote }) {
  if (!riderD) return null
  const zoneName = riderD.zone || "Zone unassigned"
  const city = riderD.city || "—"
  const isNew = riderD.is_new_user
  const m = Number(quote?.zone_risk_multiplier || 1)
  const level = getRiskLevel(m)

  const badgeClass = level === "HIGH"
    ? "bg-negative/10 border border-negative/25 text-negative"
    : level === "MEDIUM"
      ? "bg-accent-400/10 border border-accent-400/25 text-accent-400"
      : "bg-positive/10 border border-positive/25 text-positive"

  const valueClass = level === "HIGH"
    ? "text-negative"
    : level === "MEDIUM"
      ? "text-accent-400"
      : "text-positive"

  const label = RISK_COLORS[level].label

  return (
    <div className="bg-ink-800 border border-ink-600 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-ink-400" />
          <span className="text-xs font-medium text-ink-300">Delivery zone</span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
          {label}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-ink-100">{zoneName}</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {city}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400 mb-0.5">Risk multiplier</p>
          <p className={`text-base font-mono font-semibold ${valueClass}`}>{m.toFixed(2)}×</p>
        </div>
      </div>

      {isNew ? (
        <div className="mt-3 rounded-xl px-3 py-2.5 bg-ink-700/80 border border-ink-600">
          <p className="text-xs text-ink-300 leading-relaxed">
            <span className="font-medium text-ink-100">New rider:</span> City-level baseline pricing active. Zone risk scores calibrate after week two.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl px-3 py-2.5 bg-ink-700/80 border border-ink-600">
          <p className="text-xs text-ink-300 leading-relaxed">
            <span className="font-medium text-ink-100">Returning rider:</span> Coverage and rate personalized with your R-score.
          </p>
        </div>
      )}
    </div>
  )
}

function RiskForecastCard({ quote }) {
  if (!quote) return null
  const m = Number(quote.zone_risk_multiplier || 1)
  const level = getRiskLevel(m)
  const { bar, text, label } = RISK_COLORS[level]
  const pct = Math.min(100, ((m - 0.8) / 0.7) * 100)
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-ink-400" />
          <span className="text-sm font-medium text-ink-100">Next week risk forecast</span>
        </div>
        <span className={`text-xs font-medium ${text}`}>{label}</span>
      </div>
      <div className="h-2 bg-ink-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${bar} rounded-full transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-ink-400">
        <span>Zone: {quote.zone_name || quote.city}</span>
        <span className="font-mono">Risk {m.toFixed(2)}×</span>
      </div>
      <p className="text-xs text-ink-400 mt-2">
        {level === "HIGH" && "Disruptions probable this week. Active coverage recommended."}
        {level === "MEDIUM" && "Moderate disruption probability detected for your shift zone."}
        {level === "LOW" && "Atmospheric and platform conditions currently stable."}
      </p>
    </div>
  )
}

function UpsellBanner({ quote, onActivate }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-ink-800 border border-ink-600 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} className="text-accent-400" />
          <span className="text-xs font-medium text-accent-400">Not covered</span>
        </div>
        <p className="text-ink-100 font-semibold text-base mb-1">Protect this week's earnings</p>
        <p className="text-ink-400 text-xs mb-4 leading-relaxed">
          A single storm or app crash can cost ₹300–500 in lost income. VERO pays automatically to your UPI.
        </p>
        {quote && (
          <div className="flex items-center gap-4 mb-5 pt-1">
            <div>
              <p className="text-xs text-ink-400">Premium</p>
              <p className="text-xl font-mono font-semibold text-ink-100">₹{quote.premium}</p>
            </div>
            <div className="w-px h-8 bg-ink-600" />
            <div>
              <p className="text-xs text-ink-400">Coverage</p>
              <p className="text-xl font-mono font-semibold text-accent-400">{quote.coverage_pct}%</p>
            </div>
            <div className="w-px h-8 bg-ink-600" />
            <div>
              <p className="text-xs text-ink-400">Cap</p>
              <p className="text-xl font-mono font-semibold text-ink-100">₹{quote.weekly_cap}</p>
            </div>
          </div>
        )}
        <button onClick={onActivate} className="btn-primary">
          <span>Activate protection</span>
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: CloudRain, text: "Rain & hailstorm" },
          { icon: Wifi, text: "App outages" },
          { icon: AlertTriangle, text: "AQI pollution spikes" },
          { icon: Shield, text: "Bandh & civic shutdown" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 bg-ink-800 border border-ink-600 rounded-xl px-3 py-2.5">
            <Icon size={14} className="text-ink-400 shrink-0" />
            <span className="text-xs text-ink-300">{text}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-ink-400">Weekly coverage · Cancel anytime · Instant UPI payouts</p>
    </div>
  )
}

function ActivePolicyCard({ policy, onViewPolicy }) {
  const premiumAmt = Number(policy.premium || 0)
  const coveragePct = Number(policy.coverage_pct ?? Math.round((policy.coverage_ratio || 0) * 100))
  const weeklyCapAmt = Number(policy.weekly_cap || 0)
  const usedAmt = Number(policy.total_paid_out || 0)
  const remaining = Number(policy.remaining_cap ?? Math.max(0, weeklyCapAmt - usedAmt))
  const pct = weeklyCapAmt > 0 ? Math.min(100, (usedAmt / weeklyCapAmt) * 100) : 0
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Signature live dot */}
          <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
          <span className="text-sm font-medium text-ink-100">Coverage active</span>
        </div>
        <button onClick={onViewPolicy} className="text-xs text-accent-400 flex items-center gap-1 hover:text-accent-300 transition-colors">
          Details <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-xs text-ink-400 mb-0.5">Coverage</p>
          <p className="text-lg font-mono font-semibold text-ink-100">{coveragePct}%</p>
        </div>
        <div>
          <p className="text-xs text-ink-400 mb-0.5">Premium</p>
          <p className="text-lg font-mono font-semibold text-ink-100">₹{premiumAmt.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400 mb-0.5">Cap left</p>
          <p className="text-lg font-mono font-semibold text-accent-400">₹{remaining.toFixed(0)}</p>
        </div>
      </div>
      <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
        <div className="h-full bg-accent-500 rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-ink-400 mt-1.5 font-mono">
        <span>Used ₹{usedAmt.toFixed(0)}</span>
        <span>Cap ₹{weeklyCapAmt.toFixed(0)}</span>
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
  const [pinging, setPinging] = useState(false)

  const handlePing = async () => {
    if (!quote?.zone_id) return
    setPinging(true)
    try {
      await logActivity(quote.zone_id)
      alert("Location synced: telemetry logged for " + quote.city)
    } catch (e) {
      alert("Failed to ping location telemetry.")
    } finally {
      setPinging(false)
    }
  }

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
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      {/* Quiet top nav */}
      <nav className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-ink-600/70 bg-ink-950/95 backdrop-blur-md z-40">
        <span className="font-semibold text-base tracking-tight flex items-center gap-1.5 text-ink-100">
          <Shield size={16} className="text-accent-500" /> VERO SafeGuard
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} aria-label="Refresh data" className="text-ink-400 hover:text-ink-100 transition-colors p-1.5">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { logout(); navigate("/") }} aria-label="Log out" className="text-ink-400 hover:text-ink-100 transition-colors p-1.5">
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <SimulatorBanner />
        <div className="max-w-md mx-auto px-4 pt-3 pb-24 space-y-4">
          {loading ? (
            <div className="text-center py-20 text-ink-400 text-sm">Loading dashboard...</div>
          ) : (
            <>
              {/* Profile header */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-ink-400 text-xs">{greeting}</p>
                  <h1 className="font-semibold text-2xl text-ink-100 mt-0.5">{riderD?.name || rider?.name}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-ink-400 flex items-center gap-1">
                      <MapPin size={11} /> {riderD?.city || rider?.city}
                    </span>
                    {(riderD?.zone) && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-ink-600" />
                        <span className="text-xs text-ink-300 font-medium">{riderD.zone}</span>
                      </>
                    )}
                    <span className="w-1 h-1 rounded-full bg-ink-600" />
                    <span className="text-xs text-ink-400">{riderD?.platform || rider?.platform}</span>
                    {!riderD?.is_new_user && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-ink-600" />
                        <span className="text-xs font-mono text-accent-400">R={Number(riderD?.reliability_score || 0).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-ink-800 border border-ink-600 flex items-center justify-center">
                  <span className="text-base font-semibold text-accent-400">{(riderD?.name || rider?.name || "R")[0]}</span>
                </div>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Tenure", value: `${riderD?.r_breakdown?.weeks_tracked || 0}w`, sub: "weeks active" },
                  { label: "R-score", value: riderD?.is_new_user ? "—" : Number(riderD?.reliability_score || 0).toFixed(2), sub: "reliability" },
                  { label: "Shift", value: riderD?.shift_hours?.start || rider?.shift_start?.slice(0, 5) || "—", sub: "scheduled start" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-ink-800 border border-ink-600 rounded-xl p-3 text-center">
                    <p className="text-xs text-ink-400 mb-0.5">{label}</p>
                    <p className="text-base font-mono font-semibold text-ink-100">{value}</p>
                    <p className="text-[11px] text-ink-400">{sub}</p>
                  </div>
                ))}
              </div>

              <ZoneCard riderD={riderD} quote={quote} />

              {isPending && (
                <div className="flex items-center gap-3 bg-accent-400/10 border border-accent-400/20 rounded-xl px-4 py-3">
                  <Clock size={15} className="text-accent-400 shrink-0" />
                  <div>
                    <p className="text-accent-400 text-xs font-semibold">Policy activating</p>
                    <p className="text-ink-300 text-xs mt-0.5">Coverage will be live within the activation window.</p>
                  </div>
                </div>
              )}

              {hasPol
                ? <ActivePolicyCard policy={policy} riderD={riderD} onViewPolicy={() => navigate("/policy")} />
                : <UpsellBanner quote={quote} onActivate={() => navigate("/payment")} />
              }

              <RiskForecastCard quote={quote} />

              {/* Telemetry tracking */}
              <div className="bg-ink-800 border border-ink-600 rounded-2xl p-4">
                <p className="text-xs font-semibold mb-1 text-ink-100 flex items-center gap-2">
                  <MapPin size={14} className="text-ink-400" /> Telemetry verification
                </p>
                <p className="text-xs text-ink-400 mb-3">Sync GPS telemetry to validate payout eligibility during disruptions.</p>
                <button
                  onClick={handlePing}
                  disabled={pinging}
                  className="btn-ghost py-2.5 text-xs w-full"
                >
                  {pinging ? "Pinging..." : "Sync current coordinates"}
                </button>
              </div>

              {/* Actions */}
              <div>
                <p className="text-xs font-medium text-ink-400 mb-2 px-1">Quick actions</p>
                <div className="space-y-2">
                  {[
                    { label: "View policy details", sub: hasPol ? "Active this week" : "No active policy", path: "/policy", icon: Shield },
                    { label: "Claims & payouts", sub: "Payout transaction history", path: "/claims", icon: TrendingUp },
                  ].map(({ label, sub, path, icon: Icon }) => (
                    <button key={label} onClick={() => navigate(path)}
                      className="w-full flex items-center justify-between bg-ink-800 border border-ink-600 rounded-xl px-4 py-3 hover:border-ink-500 transition-colors group text-left">
                      <div className="flex items-center gap-3">
                        <Icon size={15} className="text-ink-400 group-hover:text-ink-200 transition-colors" />
                        <div>
                          <p className="text-sm font-medium text-ink-100">{label}</p>
                          <p className="text-xs text-ink-400">{sub}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-ink-400 group-hover:text-ink-100 transition-colors" />
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
