import { useState, useEffect, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from "recharts"
import {
  TrendingUp, CloudRain, Thermometer, Wind, RefreshCw, Loader2,
  AlertTriangle, CheckCircle2, Activity, MapPin, Zap
} from "lucide-react"

const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || "vero_admin_key_2026"
const HEADERS = { "X-Admin-Key": ADMIN_KEY }

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER_STYLE = {
  HIGH: { bar: "bg-rose-500", badge: "bg-rose-500/10 text-rose-400 border border-rose-500/25", glow: "shadow-rose-500/10" },
  MEDIUM: { bar: "bg-amber-500", badge: "bg-amber-500/10 text-amber-400 border border-amber-500/25", glow: "shadow-amber-500/10" },
  LOW: { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25", glow: "shadow-emerald-500/10" },
}

// ── Mini progress bar ────────────────────────────────────────────────────────
function ProbBar({ pct, tier }) {
  const { bar } = TIER_STYLE[tier] || TIER_STYLE.LOW
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Signal breakdown tooltip-row ────────────────────────────────────────────
function SignalRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
        </div>
        <span className="text-[10px] font-mono text-gray-400 w-8">{(value * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── Risk Forecast Card ───────────────────────────────────────────────────────
function ForecastCard({ zone, rank }) {
  const [expanded, setExpanded] = useState(false)
  const style = TIER_STYLE[zone.tier] || TIER_STYLE.LOW
  const isHigh = zone.tier === "HIGH"
  const isMed = zone.tier === "MEDIUM"

  return (
    <div
      className={`rounded-xl border transition-all duration-200 cursor-pointer
        ${isHigh ? "bg-rose-500/5 border-rose-500/15 hover:border-rose-500/30"
          : isMed ? "bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30"
            : "bg-white/2 border-white/5 hover:border-white/10"}
        ${style.glow}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="p-3.5">
        {/* Row 1: rank + zone + badge */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-600 w-4">{rank}.</span>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{zone.zone_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5 text-gray-600" />
                <p className="text-[10px] text-gray-500">{zone.city}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold font-mono text-white">
              {zone.probability_pct}%
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}>
              {zone.tier}
            </span>
          </div>
        </div>

        {/* Probability bar */}
        <ProbBar pct={zone.probability_pct} tier={zone.tier} />

        {/* Driver chips */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {zone.drivers.map((d, i) => (
            <span key={i} className="text-[9px] bg-white/4 border border-white/8 rounded-full px-2 py-0.5 text-gray-400 leading-tight">
              {d}
            </span>
          ))}
        </div>

        {/* Weather quick stats */}
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-center gap-1 text-[10px] text-blue-400">
            <CloudRain className="w-3 h-3" />
            <span>{zone.forecast_detail.max_rain_mm}mm</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-orange-400">
            <Thermometer className="w-3 h-3" />
            <span>{zone.forecast_detail.max_temp_c}°C</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Wind className="w-3 h-3" />
            <span>{zone.forecast_detail.max_wind_kmh}km/h</span>
          </div>
          {zone.forecast_detail.live_weather && (
            <span className="ml-auto text-[9px] text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
              live
            </span>
          )}
        </div>
      </div>

      {/* Expanded signal breakdown */}
      {expanded && (
        <div className="border-t border-white/6 px-3.5 py-3 space-y-1.5">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Signal Weights</p>
          <SignalRow label="Historical Frequency (45%)" value={zone.signals.historical_frequency} color="bg-violet-500" />
          <SignalRow label="Zone Risk Multiplier (30%)" value={zone.signals.zone_risk} color="bg-amber-500" />
          <SignalRow label="7-Day Weather Forecast (25%)" value={zone.signals.weather_forecast} color="bg-blue-500" />
          <p className="text-[9px] text-gray-600 pt-1">
            {zone.historical_events} trigger event{zone.historical_events !== 1 ? "s" : ""} in past 30 days
          </p>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS TAB
// ════════════════════════════════════════════════════════════════════════════
export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [fcMeta, setFcMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fcLoad, setFcLoad] = useState(true)
  const [fcError, setFcError] = useState(null)
  const [fcFilter, setFcFilter] = useState("ALL")  // ALL | HIGH | MEDIUM | LOW
  const [refreshing, setRefreshing] = useState(false)

  // Analytics data
  useEffect(() => {
    fetch("/api/dashboards/admin/analytics", { headers: HEADERS })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Risk forecast
  const loadForecast = useCallback(() => {
    setFcLoad(true)
    setFcError(null)
    fetch("/api/dashboards/admin/risk-forecast", { headers: HEADERS })
      .then(r => r.json())
      .then(d => {
        setForecast(d.forecast || [])
        setFcMeta({
          generated_at: d.generated_at,
          model_version: d.model_version,
          data_source: d.data_source,
          horizon: d.horizon,
        })
        setFcLoad(false)
      })
      .catch(e => {
        setFcError("Could not load forecast data")
        setFcLoad(false)
      })
  }, [])

  useEffect(() => { loadForecast() }, [loadForecast])

  const handleFcRefresh = () => {
    setRefreshing(true)
    loadForecast()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val)

  const filteredForecast = forecast
    ? (fcFilter === "ALL" ? forecast : forecast.filter(z => z.tier === fcFilter))
    : []

  const highCount = forecast ? forecast.filter(z => z.tier === "HIGH").length : 0
  const medCount = forecast ? forecast.filter(z => z.tier === "MEDIUM").length : 0
  const lowCount = forecast ? forecast.filter(z => z.tier === "LOW").length : 0

  return (
    <div className="p-6 pb-24 space-y-8">

      {/* ── PAGE HEADER ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold">Analytics & Predictive Intelligence</h2>
        <p className="text-gray-400 text-sm mt-1">
          Geospatial risk modeling, financial analytics, and next-week disruption forecasts
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
        RISK FORECAST SECTION
      ══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Next-Week Disruption Forecast
                <span className="text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  7 Day
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {fcMeta?.model_version || "3-signal composite model: history × zone_risk × weather"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fcMeta?.generated_at && (
              <span className="text-[10px] text-gray-600 font-mono">
                {new Date(fcMeta.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST
              </span>
            )}
            <button
              onClick={handleFcRefresh}
              disabled={fcLoad}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh forecast"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Data source strip */}
        {fcMeta && (
          <div className="px-6 py-2 border-b border-violet-500/8 flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-emerald-500" />
              {fcMeta.data_source}
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Zap className="w-2.5 h-2.5 text-violet-500" />
              Horizon: {fcMeta.horizon}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="p-6">

          {/* Tier summary KPIs */}
          {!fcLoad && forecast && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { tier: "HIGH", count: highCount, label: "High Risk Zones", color: "text-rose-400", bg: "bg-rose-500/8 border-rose-500/15" },
                { tier: "MEDIUM", count: medCount, label: "Medium Risk Zones", color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/15" },
                { tier: "LOW", count: lowCount, label: "Low Risk Zones", color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
              ].map(({ tier, count, label, color, bg }) => (
                <button
                  key={tier}
                  onClick={() => setFcFilter(f => f === tier ? "ALL" : tier)}
                  className={`rounded-xl border p-3 text-left transition-all duration-150 ${bg}
                    ${fcFilter === tier ? "ring-1 ring-white/20 scale-[1.02]" : "hover:scale-[1.01]"}`}
                >
                  <p className={`text-2xl font-bold font-mono ${color}`}>{count}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {fcLoad && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-500">Fetching 7-day forecasts from Open-Meteo...</p>
              <p className="text-[10px] text-gray-600">This calls live weather APIs for all 22 zones</p>
            </div>
          )}

          {/* Error state */}
          {fcError && !fcLoad && (
            <div className="flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <p className="text-sm text-rose-400">{fcError}</p>
              <button onClick={loadForecast} className="ml-auto text-xs text-rose-400 underline">Retry</button>
            </div>
          )}

          {/* Zone grid */}
          {!fcLoad && !fcError && filteredForecast.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredForecast.map((zone, i) => (
                <ForecastCard key={zone.zone_id} zone={zone} rank={i + 1} />
              ))}
            </div>
          )}

          {!fcLoad && !fcError && filteredForecast.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <p className="text-sm text-gray-400">No {fcFilter !== "ALL" ? fcFilter.toLowerCase() + " " : ""}risk zones found</p>
            </div>
          )}

          {/* Model methodology note */}
          <div className="mt-5 p-3 bg-white/2 border border-white/5 rounded-xl">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <span className="text-gray-400 font-semibold">Model:</span>{" "}
              Composite probability = Historical Frequency (45%) + Zone Risk Index (30%) + Open-Meteo 7-day Weather (25%).
              Rain ≥35mm/day or Temp ≥42°C = full weather signal. Click any card to expand signal breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FINANCIAL ANALYTICS
      ══════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center gap-2 p-6 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading financial data...
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Premium vs Payout Chart */}
            <div className="card">
              <h3 className="text-base font-bold mb-5">Premium vs Payout by City</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.city_stats} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis dataKey="city" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${v / 1000}k`} />
                    <Tooltip
                      cursor={{ fill: "#27272a" }}
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px" }}
                      formatter={v => formatCurrency(v)}
                    />
                    <Bar dataKey="premium" name="Premium" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="payout" name="Payout" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7-Day Payout Trend */}
            <div className="card">
              <h3 className="text-base font-bold mb-5">7-Day Payout Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekly_trend} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${v / 1000}k`} />
                    <Tooltip
                      cursor={{ stroke: "#3f3f46" }}
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px" }}
                      formatter={v => formatCurrency(v)}
                    />
                    <Line
                      type="monotone" dataKey="amount" name="Daily Payout"
                      stroke="#f43f5e" strokeWidth={2} dot={{ fill: "#f43f5e", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Zone Risk Actuarial Table */}
          <div className="card overflow-hidden p-0">
            <div className="p-5 border-b border-dark-600">
              <h3 className="text-base font-bold">Zone Risk Actuarial Table</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-900 border-b border-dark-600 text-gray-400">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Zone & City</th>
                    <th className="px-5 py-3.5 font-medium">Risk Multiplier</th>
                    <th className="px-5 py-3.5 font-medium">Riders</th>
                    <th className="px-5 py-3.5 font-medium">Active Policies</th>
                    <th className="px-5 py-3.5 font-medium">Triggers MTD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  {(data.zone_table || []).map((z, i) => (
                    <tr key={i} className="hover:bg-dark-800/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-white">{z.zone_name}</p>
                        <p className="text-xs text-brand-400">{z.city}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${z.risk_multiplier > 1.15
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                          {z.risk_multiplier}×
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">{z.total_riders}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">{z.active_policies}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-300">{z.trigger_events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
