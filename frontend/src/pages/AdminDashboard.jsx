import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { getAdminSummary, getAdminPredictive, getAdminZones } from "../api"
import {
  Shield, TrendingUp, Users, IndianRupee, RefreshCw, Zap,
  BarChart2, MapPin, Activity, ArrowLeft, CheckCircle,
  ChevronUp, ChevronDown, Lock, AlertOctagon, Eye, Clock
} from "lucide-react"

const RISK_COLOR = {
  HIGH: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  MEDIUM: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  LOW: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
}

const LR_STATUS = {
  HEALTHY: { text: "text-green-400", label: "Healthy", bg: "bg-green-500/10" },
  ELEVATED: { text: "text-red-400", label: "Elevated", bg: "bg-red-500/10" },
  LOW_UTILISATION: { text: "text-yellow-400", label: "Low Utilisation", bg: "bg-yellow-500/10" },
}

// ── Fraud detection layers — static definitions, always visible ──────────────
const FRAUD_LAYERS = [
  {
    icon: Clock,
    color: "text-brand-400",
    bg: "bg-brand-500/10",
    border: "border-brand-500/20",
    title: "24-Hour Activation Window",
    desc: "Every new policy waits 24 hours before coverage begins. A rider who reads tonight's bandh announcement and buys immediately cannot claim against it tomorrow. Eliminates last-minute opportunistic purchases entirely.",
    status: "ACTIVE",
  },
  {
    icon: Eye,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "Zone Activity Consistency Check",
    desc: "Payout eligibility requires a logged delivery attempt in the claimed zone within 30 minutes of the trigger. A rider who opens the app purely to collect a payout — without working — is ineligible.",
    status: "ACTIVE",
  },
  {
    icon: AlertOctagon,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    title: "Personal Loss Ratio Monitor",
    desc: "Each rider's total payouts ÷ total premiums is tracked continuously. When this ratio exceeds 1.8×, a compounding surcharge applies to the following week's premium — making sustained gaming progressively expensive until it becomes a net loss.",
    status: "ACTIVE",
  },
  {
    icon: Lock,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    title: "Third-Party Trigger Verification",
    desc: "No trigger fires from rider-submitted data. Every payout requires an independent third-party signal: OpenWeatherMap for weather, IQAir/CPCB for AQI, DownDetector for platform outages, NewsAPI for bandhs. A rider cannot manufacture any of these signals.",
    status: "ACTIVE",
  },
  {
    icon: Shield,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    title: "Cancellation Resets Eligibility",
    desc: "Cancelling and rejoining resets the rider to Week 1 status — restarting the 24-hour window and the reduced 40% coverage floor. Repeated cancel-and-rejoin cycling is progressively unattractive because reduced payouts compound across each restart.",
    status: "ACTIVE",
  },
  {
    icon: TrendingUp,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    title: "Reliability Score (R) Gating",
    desc: "New riders with no delivery history receive 40% coverage at the maximum 1.5× premium multiplier. A fraudster who joins to exploit a disruption has no R score history — the economics of fraud are unattractive before any detection logic fires.",
    status: "ACTIVE",
  },
]

function StatCard({ icon: Icon, label, value, color = "text-brand-400" }) {
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
    </div>
  )
}

function LossRatioGauge({ ratio, status }) {
  const pct = Math.min(100, ratio * 100)
  const { text, label, bg } = LR_STATUS[status] || LR_STATUS.HEALTHY
  const barColor = status === "HEALTHY" ? "bg-green-500" : status === "ELEVATED" ? "bg-red-500" : "bg-yellow-500"
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-brand-400" />
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Loss Ratio</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${text}`}>{label}</span>
      </div>
      <p className={`text-3xl font-display font-bold mb-3 ${text}`}>{(ratio * 100).toFixed(1)}%</p>
      <div className="h-2 bg-dark-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>Target: 40–60%</span>
        <span>Current: {(ratio * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

function WeeklyTrendBar({ trend }) {
  if (!trend?.length) return null
  const maxVal = Math.max(...trend.map(w => Math.max(w.payouts, w.premiums)), 1)
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={14} className="text-brand-400" />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Weekly Trend — Premiums vs Payouts</span>
      </div>
      <div className="flex items-end gap-3 h-20">
        {trend.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end h-14">
              <div className="flex-1 bg-brand-500/60 rounded-t" style={{ height: `${(w.premiums / maxVal) * 100}%` }} />
              <div className="flex-1 bg-red-500/60 rounded-t" style={{ height: `${(w.payouts / maxVal) * 100}%` }} />
            </div>
            <span className="text-[9px] text-gray-600">{w.week_label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-brand-500/60" /><span className="text-[10px] text-gray-500">Premiums</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-red-500/60" /><span className="text-[10px] text-gray-500">Payouts</span></div>
      </div>
    </div>
  )
}

function ZonePredictionTable({ zones }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? zones : zones.slice(0, 5)
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700/50">
        <MapPin size={14} className="text-brand-400" />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Zone Risk Forecast — Next Week</span>
      </div>
      <div className="divide-y divide-dark-700/30">
        {visible.map((z) => {
          const rc = RISK_COLOR[z.risk_label] || RISK_COLOR.LOW
          return (
            <div key={z.zone_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{z.zone_name}</p>
                <p className="text-[10px] text-gray-500">{z.city} · {z.active_policies} active policies</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">₹{z.expected_claims_next_week.toFixed(0)}</p>
                <p className="text-[10px] text-gray-500">est. claims</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.bg} ${rc.text} ${rc.border} border shrink-0`}>
                {z.risk_multiplier.toFixed(2)}×
              </span>
            </div>
          )
        })}
      </div>
      {zones.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-[11px] text-gray-500 hover:text-white border-t border-dark-700/50 transition-colors"
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {zones.length} zones</>}
        </button>
      )}
    </div>
  )
}

function ZonePremiumTable({ zones }) {
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700/50">
        <IndianRupee size={14} className="text-brand-400" />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Zone-Level Premium Multipliers</span>
      </div>
      <div className="divide-y divide-dark-700/30">
        {zones.map((z) => {
          const rc = RISK_COLOR[z.risk_multiplier >= 1.20 ? "HIGH" : z.risk_multiplier >= 1.10 ? "MEDIUM" : "LOW"]
          return (
            <div key={z.zone_id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{z.zone_name}</p>
                <p className="text-[10px] text-gray-500">{z.city}</p>
              </div>
              <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${rc.bg} ${rc.text}`}>
                {z.risk_multiplier.toFixed(2)}×
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-600 px-4 py-2.5 border-t border-dark-700/30">
        Riders in higher-risk zones pay proportionally more — same coverage, zone-accurate pricing.
      </p>
    </div>
  )
}

function FraudDetectionPanel() {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? FRAUD_LAYERS : FRAUD_LAYERS.slice(0, 3)
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/50">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-green-400" />
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Fraud Defence Layers</span>
        </div>
        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
          {FRAUD_LAYERS.length} ACTIVE
        </span>
      </div>

      <div className="divide-y divide-dark-700/30">
        {visible.map((layer) => {
          const Icon = layer.icon
          return (
            <div key={layer.title} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg ${layer.bg} border ${layer.border} flex items-center justify-center shrink-0`}>
                  <Icon size={12} className={layer.color} />
                </div>
                <p className="text-sm font-semibold text-white">{layer.title}</p>
                <span className="ml-auto text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full font-bold shrink-0">ON</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed pl-8">{layer.desc}</p>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1 py-2.5 text-[11px] text-gray-500 hover:text-white border-t border-dark-700/50 transition-colors"
      >
        {expanded
          ? <><ChevronUp size={12} /> Show less</>
          : <><ChevronDown size={12} /> Show all {FRAUD_LAYERS.length} defence layers</>
        }
      </button>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [predictive, setPredictive] = useState(null)
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [s, p, z] = await Promise.all([
        getAdminSummary(),
        getAdminPredictive(),
        getAdminZones(),
      ])
      setSummary(s.data)
      setPredictive(p.data)
      setZones(z.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error("Admin load failed", e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [load])

  const net = summary?.network
  const forecast = predictive?.network_forecast

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      <nav className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-dark-700/50 bg-dark-900/95 backdrop-blur-md z-40">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white transition-colors mr-1">
            <ArrowLeft size={16} />
          </button>
          <Shield size={16} className="text-brand-500" />
          <span className="font-display text-base font-black tracking-tight">VERO Admin</span>
          <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-bold ml-1">DEMO</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && <span className="text-[10px] text-gray-600">{lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={() => load(true)} className="text-gray-600 hover:text-white transition-colors p-1.5">
            <RefreshCw size={14} />
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-4 pb-10 space-y-5">
          {loading ? (
            <div className="text-center py-20 text-gray-600 text-sm animate-pulse">Loading admin data...</div>
          ) : (
            <>
              {/* Network health */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 px-1">Network Health</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={Users} label="Total Riders" value={net?.total_riders || 0} color="text-brand-400" />
                  <StatCard icon={Shield} label="Active Policies" value={net?.active_policies || 0} color="text-green-400" />
                  <StatCard icon={IndianRupee} label="Premiums Collected" value={`₹${(net?.total_premiums_collected || 0).toFixed(0)}`} color="text-brand-400" />
                  <StatCard icon={TrendingUp} label="Payouts Issued" value={`₹${(net?.total_payouts_issued || 0).toFixed(0)}`} color="text-yellow-400" />
                </div>
              </div>

              {/* Loss ratio */}
              <LossRatioGauge
                ratio={net?.loss_ratio || 0}
                status={
                  (net?.loss_ratio || 0) > 0.60 ? "ELEVATED"
                    : (net?.loss_ratio || 0) < 0.40 ? "LOW_UTILISATION"
                      : "HEALTHY"
                }
              />

              {/* Fraud defence — always visible, expandable */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 px-1">Fraud Defence</p>
                <FraudDetectionPanel />
              </div>

              {/* Predictive forecast */}
              {forecast && (
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Next Week Forecast</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Expected Claims</p>
                      <p className="text-xl font-display font-bold text-red-400">₹{forecast.total_expected_claims.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Expected Revenue</p>
                      <p className="text-xl font-display font-bold text-green-400">₹{forecast.total_expected_revenue.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700/40">
                    <span className="text-[11px] text-gray-500">Projected Loss Ratio</span>
                    <span className={`text-sm font-bold ${forecast.expected_loss_ratio > 0.60 ? "text-red-400"
                      : forecast.expected_loss_ratio < 0.40 ? "text-yellow-400"
                        : "text-green-400"
                      }`}>
                      {(forecast.expected_loss_ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    Formula: active policies × zone risk × trigger rate × avg payout per event
                  </p>
                </div>
              )}

              {/* Weekly trend */}
              {predictive?.weekly_trend && <WeeklyTrendBar trend={predictive.weekly_trend} />}

              {/* Active disruptions */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 px-1">
                  Live Disruptions ({summary?.active_disruptions?.length || 0})
                </p>
                {summary?.active_disruptions?.length > 0 ? (
                  <div className="space-y-2">
                    {summary.active_disruptions.map(e => (
                      <div key={e.event_id} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{e.type.replace("_", " ")}</p>
                          <p className="text-[10px] text-gray-500">Zone {e.zone_id} · {new Date(e.started_at).toLocaleTimeString()}</p>
                        </div>
                        <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">LIVE</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
                    <CheckCircle size={14} className="text-green-400" />
                    <p className="text-sm text-green-400">No active disruptions</p>
                  </div>
                )}
              </div>

              {/* Zone predictions */}
              {predictive?.zone_predictions?.length > 0 && (
                <ZonePredictionTable zones={predictive.zone_predictions} />
              )}

              {/* Zone premium multipliers */}
              {zones.length > 0 && <ZonePremiumTable zones={zones} />}

              {/* Recent payouts */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Payouts</p>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl divide-y divide-dark-700/30 overflow-hidden">
                  {summary?.recent_payouts?.length > 0 ? (
                    summary.recent_payouts.map(p => (
                      <div key={p.payout_id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">₹{parseFloat(p.amount).toFixed(2)}</p>
                          <p className="text-[10px] text-gray-500">
                            {p.processed_at ? new Date(p.processed_at).toLocaleString() : "—"}
                          </p>
                        </div>
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
                          {p.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600 text-sm px-4 py-4">No payouts yet. Fire a trigger from the Simulator.</p>
                  )}
                </div>
              </div>

              <p className="text-center text-[10px] text-gray-700 pb-2">
                Admin view · Demo only · No authentication required
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
