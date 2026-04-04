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
    label: "Heavy Rain",
    val: "WEATHER", platform: null, icon: CloudRain,
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30",
    threshold: "Rainfall ≥ 35mm/hr · sustained 1hr",
    context: "Roads become unsafe. Delivery speed drops sharply.",
    inputType: "rainfall",
    unit: "mm/hr",
    minThreshold: 35,
  },
  {
    label: "Hailstorm",
    val: "WEATHER", platform: null, icon: Snowflake, forceHail: true,
    color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30",
    threshold: "Hail confirmed in zone · immediate trigger",
    context: "Hail makes riding physically dangerous — no minimum duration.",
    inputType: "boolean",
    unit: "confirmed",
    minThreshold: 1,
  },
  {
    label: "Extreme Heat",
    val: "WEATHER", platform: null, icon: Thermometer, forceHeat: true,
    color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30",
    threshold: "Temperature ≥ 40°C · sustained 2hrs",
    context: "Extreme heat causes heat exhaustion and cuts trip rates.",
    inputType: "temperature",
    unit: "°C",
    minThreshold: 40,
  },
  {
    label: "Toxic Air (AQI)",
    val: "AQI", platform: null, icon: AlertTriangle,
    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30",
    threshold: "AQI > 300 · sustained 2hrs during shift",
    context: "Hazardous air cuts trip completion rates significantly.",
    inputType: "aqi",
    unit: "AQI",
    minThreshold: 300,
  },
  {
    label: "Zomato Outage",
    val: "PLATFORM_BLACKOUT", platform: "zomato", icon: Wifi,
    color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30",
    threshold: "Platform down > 45min · during peak hours only",
    context: "Zero orders possible. Third-party verified — fraud-proof.",
    inputType: "outage_duration",
    unit: "minutes",
    minThreshold: 45,
  },
  {
    label: "Swiggy Outage",
    val: "PLATFORM_BLACKOUT", platform: "swiggy", icon: Wifi,
    color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30",
    threshold: "Platform down > 45min · during peak hours only",
    context: "Zero orders possible. Third-party verified — fraud-proof.",
    inputType: "outage_duration",
    unit: "minutes",
    minThreshold: 45,
  },
  {
    label: "Bandh / Curfew",
    val: "SOCIAL_DISRUPTION", platform: null, icon: Shield,
    color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30",
    threshold: "Oracle confidence > 75% · restaurant closure > 80% · GPS in zone",
    context: "Pre-armed night before. Confirmed day-of via 3 independent sources.",
    inputType: "confidence",
    unit: "%",
    minThreshold: 75,
  },
]

const API_SOURCE = {
  WEATHER:           "OpenWeatherMap + Tomorrow.io",
  AQI:               "IQAir / CPCB",
  PLATFORM_BLACKOUT: "DownDetector",
  SOCIAL_DISRUPTION: "NewsAPI.org + Twitter/X",
}

function ActiveTriggerCard({ notification }) {
  return (
    <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 size={13} className="text-brand-400 animate-spin" />
          <span className="text-xs font-bold text-brand-400">{notification.title}</span>
        </div>
        <span className="text-[9px] bg-brand-500/20 text-brand-400 border border-brand-500/30 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>
      </div>
      <p className="text-[11px] text-gray-400">{notification.message}</p>
      <p className="text-[10px] text-gray-500 mt-1">
        Zone: {notification.metadata?.zone_name || "Unknown"}
      </p>
    </div>
  )
}

export default function Simulator() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()

  const [dash, setDash]     = useState(null)
  const [quote, setQuote]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoneId, setZoneId] = useState("")
  const [queue, setQueue]   = useState([{ triggerIdx: 0, startTime: "19:00", endTime: "21:00", thresholdValue: 50 }])
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
    // Set up periodic refresh for notifications every 10 seconds
    const interval = setInterval(loadNotifications, 10000)
    return () => clearInterval(interval)
  }, [load, loadNotifications])

  if (!rider) { navigate("/login"); return null }

  const policy = dash?.policy
  const hasPol = policy?.status === "ACTIVE" || policy?.status === "PENDING"

  const addToQueue    = () => { if (queue.length < 3) setQueue(q => [...q, { triggerIdx: 0, startTime: "19:00", endTime: "21:00", thresholdValue: 50 }]) }
  const removeFromQueue = (i) => setQueue(q => q.filter((_, idx) => idx !== i))
  const updateQueue   = (i, field, val) => setQueue(q => q.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleFireAll = async () => {
    if (!zoneId) return
    setFiring(true)
    const fired = []

    for (const item of queue) {
      const opt = TRIGGER_OPTIONS[item.triggerIdx]
      if (item.endTime <= item.startTime) continue
      try {
        await logActivity(parseInt(zoneId))
        const meta = { thresholdValue: item.thresholdValue }
        if (opt.forceHail)  meta.hail = true
        if (opt.forceHeat)  meta.heat = true
        const res = await simulateTrigger({
          zone_id:          parseInt(zoneId),
          metric_type:      opt.val,
          trigger_time:     item.startTime,
          trigger_end_time: item.endTime,
          platform:         opt.platform || "zomato",
          event_metadata:   meta,
        })
        fired.push({ ...res.data, optMeta: opt })
      } catch (e) {
        fired.push({ error: e.response?.data?.detail || "Failed", optMeta: opt })
      }
    }

    // Multi-trigger resolution: highest payout wins, others suppressed
    const valid = fired.filter(r => !r.error)
    if (valid.length > 1) {
      const maxPayout = Math.max(...valid.map(r => parseFloat(r.estimated_payout_returning || 0)))
      valid.forEach(r => { r.isHighest = parseFloat(r.estimated_payout_returning || 0) === maxPayout })
    } else if (valid.length === 1) {
      valid[0].isHighest = true
    }

    setResults(fired)

    // Reload notifications to show any new active triggers
    await loadNotifications()

    setFiring(false)
  }

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </button>
        <Zap size={15} className="text-yellow-400" />
        <span className="font-semibold text-sm">Trigger Simulator</span>
        <span className="ml-auto badge bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px]">Demo</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto w-full px-4 pt-3 pb-8 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : (
            <>
              {/* No policy warning */}
              {!hasPol && (
                <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <Clock size={14} className="text-yellow-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-yellow-400 text-xs font-semibold">No active policy</p>
                    <p className="text-gray-500 text-[11px]">Triggers fire but payouts need an active policy.</p>
                  </div>
                  <button onClick={() => navigate("/payment")} className="text-brand-400 text-[11px] font-semibold shrink-0 flex items-center gap-0.5">
                    Activate <ChevronRight size={11} />
                  </button>
                </div>
              )}

              {/* Live running triggers from backend */}
              {notifications.filter(n => n.type === "active").length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1">Live triggers</p>
                  {notifications.filter(n => n.type === "active").map(notification => 
                    <ActiveTriggerCard key={notification.id} notification={notification} />
                  )}
                </div>
              )}

              {/* Completed triggers from backend */}
              {notifications.filter(n => n.type === "completed").length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Completed</p>
                    <button onClick={() => navigate("/notifications")} className="text-[10px] text-gray-600 hover:text-white">View all</button>
                  </div>
                  {notifications.filter(n => n.type === "completed").slice(0, 3).map(notification => (
                    <div key={notification.id} className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
                      <CheckCircle size={13} className="text-green-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[11px] text-green-400 font-semibold">{notification.title}</p>
                        <p className="text-[10px] text-gray-500">{notification.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Zone */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 px-1">Zone</p>
                <input className="input-field" placeholder="Zone ID e.g. 1" value={zoneId}
                  onChange={e => setZoneId(e.target.value)} />
                <p className="text-[10px] text-gray-600 mt-1 px-1">
                  Your zone: {quote?.zone_id || "—"} · {quote?.city || "—"} · Shift: {rider.shift_start?.slice(0,5) || "—"}–{rider.shift_end?.slice(0,5) || "—"}
                </p>
              </div>

              {/* Trigger queue */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Triggers to fire</p>
                  {queue.length < 3 && (
                    <button onClick={addToQueue} className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-semibold">
                      <Plus size={12} /> Add trigger
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {queue.map((item, i) => {
                    const opt    = TRIGGER_OPTIONS[item.triggerIdx]
                    const timeOk = item.endTime > item.startTime
                    return (
                      <div key={i} className={`${opt.bg} border ${opt.border} rounded-xl p-3 space-y-2.5`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${opt.color}`}>Trigger {i + 1}</span>
                          {queue.length > 1 && (
                            <button onClick={() => removeFromQueue(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                              <X size={13} />
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
                          <label className="text-[10px] text-gray-500 mb-1 block">
                            {opt.inputType === 'boolean' ? 'Confirmed' : `${opt.inputType.charAt(0).toUpperCase() + opt.inputType.slice(1)} (${opt.unit})`}
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
                              className="input-field text-xs py-2" 
                              type="number" 
                              min="0" 
                              step={opt.inputType === 'temperature' ? "1" : opt.inputType === 'confidence' ? "1" : "0.1"}
                              value={item.thresholdValue}
                              onChange={e => updateQueue(i, "thresholdValue", parseFloat(e.target.value) || 0)}
                              placeholder={`Min: ${opt.minThreshold}`}
                            />
                          )}
                          <p className={`text-[10px] mt-1 ${
                            item.thresholdValue >= opt.minThreshold ? "text-green-400" : "text-red-400"
                          }`}>
                            {item.thresholdValue >= opt.minThreshold 
                              ? `✓ Above threshold (≥${opt.minThreshold}${opt.unit})` 
                              : `✗ Below threshold (need ≥${opt.minThreshold}${opt.unit})`
                            }
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 mb-1 block">Start (IST)</label>
                            <input className="input-field text-xs py-2" type="time" value={item.startTime}
                              onChange={e => updateQueue(i, "startTime", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-1 block">End (IST)</label>
                            <input className={`input-field text-xs py-2 ${!timeOk ? "border-red-500/50" : ""}`} type="time" value={item.endTime}
                              onChange={e => updateQueue(i, "endTime", e.target.value)} />
                          </div>
                        </div>
                        {!timeOk && <p className="text-red-400 text-[10px]">End must be after start</p>}
                        <p className="text-[10px] text-gray-600">📡 {API_SOURCE[opt.val]}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Multi-trigger note */}
              {queue.length > 1 && (
                <div className="flex items-start gap-2 bg-dark-800/40 border border-dark-700/40 rounded-xl px-3 py-2.5">
                  <Zap size={12} className="text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-400">
                    Multiple triggers: <span className="text-white font-semibold">only the highest payout fires.</span> Others are cancelled per VERO policy.
                  </p>
                </div>
              )}

              {/* Fire button */}
              <button
                onClick={handleFireAll}
                disabled={firing || !zoneId || queue.some(q => q.endTime <= q.startTime || q.thresholdValue < TRIGGER_OPTIONS[q.triggerIdx].minThreshold)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-dark-700 disabled:text-gray-600 text-black font-bold rounded-xl text-sm transition-all active:scale-[0.98] shadow-[0_8px_24px_rgba(234,179,8,0.2)]"
              >
                {firing
                  ? <><Loader2 size={16} className="animate-spin" /> Firing {queue.length} trigger{queue.length > 1 ? "s" : ""}...</>
                  : <><Zap size={16} /> Fire {queue.length} Trigger{queue.length > 1 ? "s" : ""}</>
                }
              </button>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1">Results</p>
                  {results.map((r, i) => (
                    <div key={i} className={`rounded-xl p-3 border text-xs ${
                      r.error ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : r.isHighest ? "bg-brand-500/10 border-brand-500/20"
                        : "bg-dark-800/60 border-dark-700/50"
                    }`}>
                      {r.error ? (
                        <p>{r.optMeta.label}: {r.error}</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {r.isHighest
                              ? <CheckCircle size={13} className="text-brand-400" />
                              : <div className="w-3 h-3 rounded-full border border-gray-600" />
                            }
                            <span className={`font-semibold ${r.isHighest ? "text-white" : "text-gray-500"}`}>
                              {r.optMeta.label}
                              {r.isHighest
                                ? <span className="ml-2 text-[10px] text-brand-400 font-bold">PAYING OUT</span>
                                : <span className="ml-2 text-[10px] text-gray-600">cancelled — lower payout</span>
                              }
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: "Overlap",   value: `${r.overlap_hours}h` },
                              { label: "Intervals", value: `${r.interval_count}×` },
                              { label: "Est. payout", value: `₹${r.estimated_payout_returning}`, highlight: r.isHighest },
                            ].map(({ label, value, highlight }) => (
                              <div key={label} className="bg-dark-900/60 rounded-lg p-2">
                                <p className="text-[9px] text-gray-500 mb-0.5">{label}</p>
                                <p className={`font-semibold ${highlight ? "text-brand-400" : "text-white"}`}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {r.mock_api_data && (
                            <div className="bg-dark-900/60 border border-dark-700/40 rounded-lg p-2 space-y-0.5">
                              <p className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest mb-1">📡 {API_SOURCE[r.metric_type]}</p>
                              {r.metric_type === "WEATHER" && (
                                <>
                                  <p className="text-[10px] text-gray-400">Rainfall: <span className="text-white">{r.mock_api_data.rainfall_mm}mm/hr</span> · Wind: <span className="text-white">{r.mock_api_data.wind_kmh}km/hr</span></p>
                                  <p className="text-[10px] text-gray-400">Condition: <span className="text-white">{r.mock_api_data.condition}</span></p>
                                </>
                              )}
                              {r.metric_type === "AQI" && (
                                <p className="text-[10px] text-gray-400">AQI: <span className="text-red-400 font-bold">{r.mock_api_data.aqi}</span> · {r.mock_api_data.category}</p>
                              )}
                              {r.metric_type === "PLATFORM_BLACKOUT" && (
                                <p className="text-[10px] text-gray-400">Outage: <span className="text-white">{r.mock_api_data.outage_duration_min}min</span> · <span className="text-red-400">{r.mock_api_data.status}</span></p>
                              )}
                              {r.metric_type === "SOCIAL_DISRUPTION" && (
                                <p className="text-[10px] text-gray-400">Confidence: <span className="text-yellow-400 font-bold">{r.mock_api_data.confidence_pct}%</span> · Closure: <span className="text-white">{r.mock_api_data.restaurant_closure_pct}%</span></p>
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
