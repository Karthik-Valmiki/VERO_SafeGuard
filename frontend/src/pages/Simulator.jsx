import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getMyDashboard, getQuote, simulateTrigger, logActivity, getNotifications } from "../api"
import {
  Zap, CloudRain, Wifi, AlertTriangle, Shield, Snowflake, Thermometer,
  ArrowLeft, CheckCircle, Clock, Loader2, ChevronRight, Plus, X
} from "lucide-react"

// ── Trigger definitions with manual threshold inputs ─────────────────────────────
const TRIGGER_OPTIONS = [
  {
    label: "Heavy rain",
    val: "WEATHER", platform: null, icon: CloudRain,
    color: "text-blue-400", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Rainfall ≥ 35mm/hr · sustained 1hr",
    context: "Roads become unsafe. Delivery speed drops sharply.",
    inputType: "rainfall",
    unit: "mm/hr",
    minThreshold: 35,
  },
  {
    label: "Hailstorm",
    val: "WEATHER", platform: null, icon: Snowflake, forceHail: true,
    color: "text-cyan-400", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Hail confirmed in zone · immediate trigger",
    context: "Hail makes riding physically dangerous.",
    inputType: "boolean",
    unit: "confirmed",
    minThreshold: 1,
  },
  {
    label: "Extreme heat",
    val: "WEATHER", platform: null, icon: Thermometer, forceHeat: true,
    color: "text-negative", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Temperature ≥ 40°C · sustained 2hrs",
    context: "Causes heat exhaustion and cuts order volume.",
    inputType: "temperature",
    unit: "°C",
    minThreshold: 40,
  },
  {
    label: "Toxic air (AQI)",
    val: "AQI", platform: null, icon: AlertTriangle,
    color: "text-accent-400", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "AQI > 300 · sustained 2hrs during shift",
    context: "Hazardous air cuts trip completion rates significantly.",
    inputType: "aqi",
    unit: "AQI",
    minThreshold: 300,
  },
  {
    label: "Zomato outage",
    val: "PLATFORM_BLACKOUT", platform: "zomato", icon: Wifi,
    color: "text-indigo-400", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Platform down > 45min · peak shift hours",
    context: "Zero dispatch possible.",
    inputType: "outage_duration",
    unit: "minutes",
    minThreshold: 45,
  },
  {
    label: "Swiggy outage",
    val: "PLATFORM_BLACKOUT", platform: "swiggy", icon: Wifi,
    color: "text-indigo-400", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Platform down > 45min · peak shift hours",
    context: "Zero dispatch possible.",
    inputType: "outage_duration",
    unit: "minutes",
    minThreshold: 45,
  },
  {
    label: "Bandh / curfew",
    val: "SOCIAL_DISRUPTION", platform: null, icon: Shield,
    color: "text-negative", bg: "bg-ink-700/60", border: "border-ink-600",
    threshold: "Oracle confidence > 75% · commercial closure > 80%",
    context: "Local civilian curfew or strike.",
    inputType: "confidence",
    unit: "%",
    minThreshold: 75,
  },
]

const API_SOURCE = {
  WEATHER:           "Open-Meteo Weather API",
  AQI:               "Open-Meteo Air Quality API",
  PLATFORM_BLACKOUT: "DownDetector Feed",
  SOCIAL_DISRUPTION: "GDELT Incident Stream",
}

function ActiveTriggerCard({ notification }) {
  return (
    <div className="bg-ink-800 border border-ink-600 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 size={13} className="text-accent-400 animate-spin" />
          <span className="text-xs font-semibold text-accent-400">{notification.title}</span>
        </div>
        <span className="text-[10px] bg-negative/10 text-negative border border-negative/25 px-1.5 py-0.5 rounded-full font-medium">Active</span>
      </div>
      <p className="text-xs text-ink-400">{notification.message}</p>
      <p className="text-[11px] text-ink-400 font-mono mt-1">
        Zone: {notification.metadata?.zone_name || "Unknown"}
      </p>
    </div>
  )
}

export default function Simulator() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()

  const [dash, setDash] = useState(null)
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoneId, setZoneId] = useState("")
  const [queue, setQueue] = useState([{ triggerIdx: 0, startTime: "19:00", endTime: "21:00", thresholdValue: 50 }])
  const [firing, setFiring] = useState(false)
  const [results, setResults] = useState([])
  const [notifications, setNotifications] = useState([])

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getNotifications()
      setNotifications(response.data || [])
    } catch (error) {
      console.error("Failed to load notifications:", error)
    }
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [d, q] = await Promise.all([getMyDashboard(), getQuote()])
      setDash(d.data); setQuote(q.data)
      if (q.data?.zone_id && !zoneId) setZoneId(String(q.data.zone_id))
      await loadNotifications()
    } catch (e) {
      if (e.response?.status === 401) { logout(); navigate("/login") }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [logout, navigate, zoneId, loadNotifications])

  useEffect(() => {
    load()
    const interval = setInterval(loadNotifications, 10000)
    return () => clearInterval(interval)
  }, [load, loadNotifications])

  if (!rider) { navigate("/login"); return null }

  const policy = dash?.policy
  const hasPol = policy?.status === "ACTIVE" || policy?.status === "PENDING"

  const addToQueue = () => { if (queue.length < 3) setQueue(q => [...q, { triggerIdx: 0, startTime: "19:00", endTime: "21:00", thresholdValue: 50 }]) }
  const removeFromQueue = (i) => setQueue(q => q.filter((_, idx) => idx !== i))
  const updateQueue = (i, field, val) => setQueue(q => q.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleFireAll = async () => {
    if (!zoneId) return
    setFiring(true)
    const fired = []

    for (const item of queue) {
      const opt = TRIGGER_OPTIONS[item.triggerIdx]
      if (item.endTime <= item.startTime) continue
      if (opt.label === "Extreme heat" && (item.startTime < "10:45" || item.endTime > "17:15")) {
        fired.push({ error: "Heat triggers restricted to 10:45 AM — 5:15 PM window", optMeta: opt })
        continue
      }
      try {
        await logActivity(parseInt(zoneId))
        const meta = { thresholdValue: item.thresholdValue }
        if (opt.forceHail) meta.hail = true
        if (opt.forceHeat) meta.heat = true
        const res = await simulateTrigger({
          zone_id: parseInt(zoneId),
          metric_type: opt.val,
          trigger_time: item.startTime,
          trigger_end_time: item.endTime,
          platform: opt.platform || "zomato",
          event_metadata: meta,
        })
        fired.push({ ...res.data, optMeta: opt })
      } catch (e) {
        fired.push({ error: e.response?.data?.detail || "Simulation failed", optMeta: opt })
      }
    }

    const valid = fired.filter(r => !r.error)
    if (valid.length > 1) {
      const maxPayout = Math.max(...valid.map(r => parseFloat(r.estimated_payout_returning || 0)))
      valid.forEach(r => { r.isHighest = parseFloat(r.estimated_payout_returning || 0) === maxPayout })
    } else if (valid.length === 1) {
      valid[0].isHighest = true
    }

    setResults(fired)
    await loadNotifications()
    setFiring(false)
  }

  return (
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-ink-950/95 backdrop-blur-md border-b border-ink-600/70">
        <button onClick={() => navigate(-1)} className="text-ink-400 hover:text-ink-100 transition-colors p-1">
          <ArrowLeft size={16} />
        </button>
        <Zap size={16} className="text-accent-500" />
        <span className="font-semibold text-sm text-ink-100">Trigger simulator</span>
        <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-800 border border-ink-600 text-accent-400">Sandbox</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto w-full px-4 pt-3 pb-8 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-ink-400">
              Loading simulator...
            </div>
          ) : (
            <>
              {!hasPol && (
                <div className="flex items-center gap-3 bg-accent-400/10 border border-accent-400/20 rounded-xl px-4 py-3">
                  <Clock size={15} className="text-accent-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-accent-400 text-xs font-semibold">No active policy</p>
                    <p className="text-ink-400 text-xs">Simulated triggers will fire telemetry, but real UPI disbursements require active policy coverage.</p>
                  </div>
                  <button onClick={() => navigate("/payment")} className="text-accent-400 text-xs font-medium shrink-0 flex items-center gap-0.5 hover:underline">
                    Activate <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Active triggers */}
              {notifications.filter(n => n.type === "active").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-ink-400 px-1">Active simulated triggers</p>
                  {notifications.filter(n => n.type === "active").map(notification =>
                    <ActiveTriggerCard key={notification.id} notification={notification} />
                  )}
                </div>
              )}

              {/* Zone selector */}
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1.5 px-1">Delivery zone</p>
                <input className="input-field font-mono text-sm" placeholder="Zone ID (e.g. 1)" value={zoneId}
                  onChange={e => setZoneId(e.target.value)} />
                <p className="text-xs text-ink-400 mt-1 px-1">
                  Active zone: {quote?.zone_id || "—"} · {quote?.city || "—"} · Shift: {rider.shift_start?.slice(0, 5) || "—"}–{rider.shift_end?.slice(0, 5) || "—"}
                </p>
              </div>

              {/* Trigger queue */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-medium text-ink-400">Triggers to evaluate</p>
                  {queue.length < 3 && (
                    <button onClick={addToQueue} className="flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 font-medium">
                      <Plus size={13} /> Add event
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {queue.map((item, i) => {
                    const opt = TRIGGER_OPTIONS[item.triggerIdx]
                    const timeOk = item.endTime > item.startTime
                    return (
                      <div key={i} className="bg-ink-800 border border-ink-600 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-100">Disruption {i + 1}</span>
                          {queue.length > 1 && (
                            <button onClick={() => removeFromQueue(i)} className="text-ink-400 hover:text-negative transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        <select className="input-field text-xs py-2" value={item.triggerIdx}
                          onChange={e => updateQueue(i, "triggerIdx", parseInt(e.target.value))}>
                          {TRIGGER_OPTIONS.map((t, ti) => (
                            <option key={ti} value={ti}>{t.label}</option>
                          ))}
                        </select>

                        {/* Threshold input */}
                        <div>
                          <label className="text-xs text-ink-400 mb-1 block">
                            {opt.inputType === 'boolean' ? 'Confirmed in zone' : `${opt.inputType.charAt(0).toUpperCase() + opt.inputType.slice(1)} (${opt.unit})`}
                          </label>
                          {opt.inputType === 'boolean' ? (
                            <select
                              className="input-field text-xs py-2"
                              value={item.thresholdValue >= 1 ? "1" : "0"}
                              onChange={e => updateQueue(i, "thresholdValue", parseInt(e.target.value))}
                            >
                              <option value="0">No</option>
                              <option value="1">Yes</option>
                            </select>
                          ) : (
                            <input
                              className="input-field font-mono text-xs py-2"
                              type="number"
                              min="0"
                              step={opt.inputType === 'temperature' ? "1" : opt.inputType === 'confidence' ? "1" : "0.1"}
                              value={item.thresholdValue}
                              onChange={e => updateQueue(i, "thresholdValue", parseFloat(e.target.value) || 0)}
                              placeholder={`Threshold: ≥${opt.minThreshold}`}
                            />
                          )}
                          <p className={`text-[11px] mt-1 ${item.thresholdValue >= opt.minThreshold ? "text-positive" : "text-negative"}`}>
                            {item.thresholdValue >= opt.minThreshold
                              ? `Above parametric trigger threshold (≥${opt.minThreshold} ${opt.unit})`
                              : `Below parametric trigger threshold (needs ≥${opt.minThreshold} ${opt.unit})`
                            }
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-ink-400 mb-1 block">Start (IST)</label>
                            <input className="input-field text-xs py-2" type="time" value={item.startTime}
                              onChange={e => updateQueue(i, "startTime", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs text-ink-400 mb-1 block">End (IST)</label>
                            <input className={`input-field text-xs py-2 ${!timeOk ? "border-negative" : ""}`} type="time" value={item.endTime}
                              onChange={e => updateQueue(i, "endTime", e.target.value)} />
                          </div>
                        </div>

                        {!timeOk && <p className="text-negative text-xs">End time must follow start time</p>}
                        <p className="text-[11px] text-ink-400">{API_SOURCE[opt.val]}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Fire button */}
              <button
                onClick={handleFireAll}
                disabled={firing || !zoneId || queue.some(q => {
                  const opt = TRIGGER_OPTIONS[q.triggerIdx];
                  if (q.endTime <= q.startTime) return true;
                  if (q.thresholdValue < opt.minThreshold) return true;
                  if (opt.label === "Extreme heat" && (q.startTime < "10:45" || q.endTime > "17:15")) return true;
                  return false;
                })}
                className="btn-primary py-3.5 w-full"
              >
                {firing
                  ? <><Loader2 size={16} className="animate-spin" /> Evaluating simulation...</>
                  : <><Zap size={16} /> Evaluate {queue.length} trigger{queue.length > 1 ? "s" : ""}</>
                }
              </button>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-ink-400 px-1">Simulation results</p>
                  {results.map((r, i) => (
                    <div key={i} className={`rounded-xl p-3.5 border text-xs ${
                      r.error ? "bg-negative/10 border-negative/25 text-negative"
                        : r.isHighest ? "bg-ink-800 border-accent-500/40"
                          : "bg-ink-800 border-ink-600 opacity-60"
                    }`}>
                      {r.error ? (
                        <p>{r.optMeta.label}: {r.error}</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {r.isHighest
                              ? <CheckCircle size={14} className="text-accent-400" />
                              : <div className="w-2.5 h-2.5 rounded-full border border-ink-500" />
                            }
                            <span className={`font-semibold ${r.isHighest ? "text-ink-100" : "text-ink-400"}`}>
                              {r.optMeta.label}
                              {r.isHighest
                                ? <span className="ml-2 text-xs font-mono font-medium text-accent-400">Trigger active</span>
                                : <span className="ml-2 text-[11px] text-ink-400">Suppressed by higher payout</span>
                              }
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 font-mono">
                            {[
                              { label: "Overlap", value: `${r.overlap_hours}h` },
                              { label: "Intervals", value: `${r.interval_count}×` },
                              { label: "Est. payout", value: `₹${r.estimated_payout_returning}`, highlight: r.isHighest },
                            ].map(({ label, value, highlight }) => (
                              <div key={label} className="bg-ink-700/70 border border-ink-600/60 rounded-lg p-2">
                                <p className="text-[10px] text-ink-400 mb-0.5">{label}</p>
                                <p className={`font-semibold ${highlight ? "text-accent-400" : "text-ink-100"}`}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {r.mock_api_data && (
                            <div className="bg-ink-700/50 border border-ink-600/50 rounded-lg p-2 space-y-0.5 text-xs text-ink-400">
                              <p className="text-[11px] font-medium text-ink-200 mb-1">{API_SOURCE[r.metric_type]}</p>
                              {r.metric_type === "WEATHER" && (
                                <p>Rainfall: <span className="text-ink-100 font-mono">{r.mock_api_data.rainfall_mm}mm/hr</span> · Wind: <span className="text-ink-100 font-mono">{r.mock_api_data.wind_kmh}km/hr</span></p>
                              )}
                              {r.metric_type === "AQI" && (
                                <p>AQI index: <span className="text-negative font-mono">{r.mock_api_data.aqi}</span> ({r.mock_api_data.category})</p>
                              )}
                              {r.metric_type === "PLATFORM_BLACKOUT" && (
                                <p>Outage duration: <span className="text-ink-100 font-mono">{r.mock_api_data.outage_duration_min}min</span></p>
                              )}
                              {r.metric_type === "SOCIAL_DISRUPTION" && (
                                <p>Confidence: <span className="text-accent-400 font-mono">{r.mock_api_data.confidence_pct}%</span> · Closure: <span className="text-ink-100 font-mono">{r.mock_api_data.restaurant_closure_pct}%</span></p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
