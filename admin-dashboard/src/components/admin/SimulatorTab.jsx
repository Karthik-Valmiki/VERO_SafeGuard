import { useState, useEffect } from "react"
import {
  AlertTriangle, Play, CheckCircle, Activity, Crosshair,
  Globe, Database, Zap, Monitor, ChevronDown, ChevronRight,
  Wifi, WifiOff
} from "lucide-react"

// Maps UI-friendly names to backend metric_type values and schema fields
const TRIGGER_TYPES = [
  { id: "Heavy Rain",    metric: "WEATHER",           unit: "mm/hr",   thresholdMin: 35,  desc: "Monsoon flooding — Open-Meteo LIVE data" },
  { id: "Hailstorm",    metric: "WEATHER",           unit: "alert",   thresholdMin: 1,   desc: "Instant severity confirmation via Open-Meteo" },
  { id: "Extreme Heat", metric: "WEATHER",           unit: "°C",      thresholdMin: 40,  desc: "Sustained heatwave — Open-Meteo temperature feed" },
  { id: "Toxic AQI",    metric: "AQI",               unit: "AQI",     thresholdMin: 300, desc: "Hazardous particulate — Open-Meteo Air Quality API" },
  { id: "Zomato Outage",metric: "PLATFORM_BLACKOUT", unit: "min",     thresholdMin: 45,  desc: "Must overlap peak hours (12pm–2:30pm or 7pm–10:30pm)" },
  { id: "Swiggy Outage",metric: "PLATFORM_BLACKOUT", unit: "min",     thresholdMin: 45,  desc: "Must overlap peak hours (12pm–2:30pm or 7pm–10:30pm)" },
  { id: "Bandh/Riot",   metric: "SOCIAL_DISRUPTION", unit: "% conf",  thresholdMin: 75,  desc: "GDELT Project LIVE news scan — civil disruption oracle" },
]

function getPlatform(triggerId) {
  if (triggerId === "Zomato Outage") return "zomato"
  if (triggerId === "Swiggy Outage") return "swiggy"
  return "zomato"
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LayerBadge({ number, label, icon: Icon, color, live }) {
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-dark-900/80 border border-current text-[10px] font-black">
        {number}
      </div>
      <Icon size={14} />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      {live !== undefined && (
        <span className={`ml-auto flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${live ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          {live ? <Wifi size={9} /> : <WifiOff size={9} />}
          {live ? "LIVE" : "SIMULATED"}
        </span>
      )}
    </div>
  )
}

function DataRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-dark-700/40 last:border-0">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${highlight || "text-gray-200"}`}>{value ?? "—"}</span>
    </div>
  )
}

function CollapsibleRaw({ data }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Raw provider payload
      </button>
      {open && (
        <div className="mt-1.5 bg-dark-950/60 border border-dark-600/40 rounded-lg p-3 overflow-auto max-h-48 custom-scrollbar">
          <pre className="text-[10px] font-mono text-cyan-300/70 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function ThresholdBar({ observed, threshold, unit, met }) {
  const pct = Math.min(100, (observed / (threshold * 2)) * 100)
  const thresholdPct = 50  // threshold is always at 50% of the bar
  return (
    <div>
      <div className="relative h-3 bg-dark-700 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full transition-all duration-700 ${met ? "bg-emerald-500" : "bg-rose-500"}`}
          style={{ width: `${pct}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/40"
          style={{ left: `${thresholdPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>0</span>
        <span className="text-gray-400">Threshold: {threshold} {unit}</span>
        <span>{threshold * 2} {unit}</span>
      </div>
    </div>
  )
}

// ── Layer renderers ───────────────────────────────────────────────────────────

function Layer1({ data }) {
  const live = data?.live
  return (
    <div className="bg-dark-900/60 border border-dark-600/50 rounded-xl p-4 space-y-3">
      <LayerBadge number="1" label="External API" icon={Globe} color="text-cyan-400" live={live} />
      <div className="space-y-0.5">
        <DataRow label="Provider"   value={data?.provider} />
        <DataRow label="Endpoint"   value={data?.endpoint} />
        {data?.lat && <DataRow label="Coordinates" value={`${data.lat}, ${data.lon}`} />}
        <DataRow label="Fetched at" value={data?.fetched_at?.slice(0, 19)?.replace("T", " ")} />
      </div>
      {data?.raw && <CollapsibleRaw data={data.raw} />}
    </div>
  )
}

function Layer2({ data, metricType }) {
  if (!data) return null
  const rows = Object.entries(data).map(([k, v]) => {
    const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    const display = Array.isArray(v) ? v.join(", ") : String(v ?? "—")
    return { label, display }
  })

  return (
    <div className="bg-dark-900/60 border border-dark-600/50 rounded-xl p-4 space-y-3">
      <LayerBadge number="2" label="Normalized Data" icon={Database} color="text-indigo-400" />
      <div className="space-y-0.5">
        {rows.map(({ label, display }) => (
          <DataRow key={label} label={label} value={display} />
        ))}
      </div>
    </div>
  )
}

function Layer3({ data, unit }) {
  if (!data) return null
  const met = data.threshold_met
  return (
    <div className={`border rounded-xl p-4 space-y-3 ${met ? "bg-emerald-500/5 border-emerald-500/30" : "bg-rose-500/5 border-rose-500/30"}`}>
      <LayerBadge
        number="3"
        label="Trigger Evaluation"
        icon={Zap}
        color={met ? "text-emerald-400" : "text-rose-400"}
      />

      {/* Verdict banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${met ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
        {met
          ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          : <AlertTriangle size={16} className="text-rose-400 shrink-0" />}
        <span className={`text-sm font-bold ${met ? "text-emerald-400" : "text-rose-400"}`}>
          {data.verdict}
        </span>
      </div>

      {/* Threshold bar */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
          <span>Observed: <b className={met ? "text-emerald-400" : "text-rose-400"}>{data.observed} {unit}</b></span>
          <span>Threshold: <b className="text-white">{data.threshold} {unit}</b></span>
        </div>
        <ThresholdBar
          observed={data.observed}
          threshold={data.threshold}
          unit={unit}
          met={met}
        />
      </div>

      <div className="space-y-0.5">
        <DataRow label="Rule"            value={data.rule} />
        {data.sustained_hours != null && <DataRow label="Sustained hours" value={`${data.sustained_hours}h`} />}
        <DataRow label="Confidence"      value={`${(data.confidence * 100).toFixed(0)}%`} highlight="text-brand-400" />
      </div>
    </div>
  )
}

function Layer4({ data }) {
  if (!data) return null
  return (
    <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4 space-y-3">
      <LayerBadge number="4" label="Simulation Override" icon={Monitor} color="text-amber-400" />
      <div className="space-y-0.5">
        <DataRow label="Type"           value={data.type} highlight="text-amber-400" />
        <DataRow label="Injected value" value={`${data.injected_value} ${data.unit}`} highlight="text-amber-400" />
        <DataRow label="Live API data"  value={data.live_api_data} highlight={data.live_api_data === "LIVE" ? "text-emerald-400" : "text-amber-400"} />
        <DataRow label="Reason"         value={data.reason} />
      </div>
      <p className="text-[10px] text-gray-500 bg-dark-900/40 rounded-lg px-3 py-2">{data.note}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SimulatorTab() {
  const [zonesData, setZonesData] = useState({})
  const [selectedCity, setSelectedCity] = useState("Mumbai")
  const [selectedZone, setSelectedZone] = useState("")
  const [selectedTrigger, setSelectedTrigger] = useState(TRIGGER_TYPES[0])
  const [thresholdVal, setThresholdVal] = useState(50)
  const [startTime, setStartTime] = useState(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  })
  const [endTime, setEndTime] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch("/api/dashboards/admin/zones", {
      headers: { "X-Admin-Key": import.meta.env.VITE_ADMIN_API_KEY || "vero_admin_key_2026" }
    })
      .then(res => res.json())
      .then(data => {
        setZonesData(data)
        const firstCity = Object.keys(data)[0] || "Mumbai"
        setSelectedCity(firstCity)
        if (data[firstCity]?.length > 0) setSelectedZone(data[firstCity][0].zone_id.toString())
      })
      .catch(err => console.error("Failed to load zones:", err))
  }, [])

  const handleCityChange = (e) => {
    const city = e.target.value
    setSelectedCity(city)
    if (zonesData[city]?.length > 0) setSelectedZone(zonesData[city][0].zone_id.toString())
  }

  const handleTriggerChange = (e) => {
    const t = TRIGGER_TYPES.find(x => x.id === e.target.value)
    setSelectedTrigger(t)
    setThresholdVal(t.thresholdMin + 5)
  }

  const fireSimulation = async () => {
    setLoading(true)
    setResult(null)

    const payload = {
      zone_id: parseInt(selectedZone),
      metric_type: selectedTrigger.metric,
      trigger_time: startTime,
      trigger_end_time: endTime,
      platform: getPlatform(selectedTrigger.id),
      event_metadata: {
        thresholdValue: Number(thresholdVal),
        unit: selectedTrigger.unit,
        hail: selectedTrigger.id === "Hailstorm",
        heat: selectedTrigger.id === "Extreme Heat",
        trigger_subtype: selectedTrigger.id,
      }
    }

    try {
      const res = await fetch("/api/triggers/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data.detail || "Backend returned an error" })
      } else {
        setResult(data)
      }
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0)

  const meetsThreshold = thresholdVal >= selectedTrigger.thresholdMin
  const pipeline = result?.mock_api_data

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold">Trigger Simulator</h2>
        <p className="text-gray-400 mt-1">
          Real-time parametric trigger engine — Open-Meteo · Air Quality API · GDELT Project.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="card space-y-6">
          <div className="flex items-center gap-2 border-b border-dark-600 pb-4">
            <Crosshair className="w-5 h-5 text-brand-400" />
            <h3 className="text-lg font-bold">Target Vector</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Target City</label>
              <select value={selectedCity} onChange={handleCityChange} className="input-field">
                {Object.keys(zonesData).map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Target Zone</label>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} className="input-field">
                {(zonesData[selectedCity] || []).map(z => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.zone_name} ({z.base_risk_multiplier}x)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Start Time (IST)</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-field w-full cursor-text" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">End Time (IST)</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input-field w-full cursor-text" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Disruption Type</label>
            <select value={selectedTrigger.id} onChange={handleTriggerChange} className="input-field">
              {TRIGGER_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">{selectedTrigger.desc}</p>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-400">Oracle Severity Value</label>
              <span className={`text-sm font-bold font-mono ${meetsThreshold ? "text-emerald-400" : "text-rose-400"}`}>
                {thresholdVal} {selectedTrigger.unit}
              </span>
            </div>
            <input
              type="range"
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              min="0"
              max={selectedTrigger.thresholdMin * 2}
              step="1"
              value={thresholdVal}
              onChange={(e) => setThresholdVal(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Trigger threshold: {selectedTrigger.thresholdMin} {selectedTrigger.unit}</span>
              <span>{meetsThreshold ? "✅ Condition met" : "❌ Below threshold"}</span>
            </div>
          </div>

          <div className="p-4 bg-dark-900 border border-cyan-500/15 rounded-xl">
            <h4 className="text-sm font-bold text-cyan-400 mb-2">🌐 Live Data Sources</h4>
            <div className="space-y-1 text-[11px] text-gray-400">
              <div className="flex gap-2"><span className="text-emerald-400">Weather/AQI</span><span>Open-Meteo.com — real lat/lon call, no API key</span></div>
              <div className="flex gap-2"><span className="text-emerald-400">Social</span><span>GDELT Project v2 — live news scan for bandh/curfew signals</span></div>
              <div className="flex gap-2"><span className="text-amber-400">Platform</span><span>Enriched simulation (DownDetector has no free public API)</span></div>
            </div>
          </div>

          <button
            onClick={fireSimulation}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 font-bold rounded-xl py-4 transition-all duration-300 ${
              loading
                ? "bg-dark-700 text-gray-400 cursor-not-allowed"
                : meetsThreshold
                  ? "bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]"
                  : "bg-dark-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {loading ? "FETCHING LIVE API DATA..." : meetsThreshold ? "FIRE DISRUPTION TRIGGER" : "THRESHOLD NOT MET"}
          </button>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-5 min-h-96">
          {!result ? (
            <div className="card flex-1 flex flex-col items-center justify-center text-center text-gray-500 p-8">
              <AlertTriangle className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">Awaiting engine execution.</p>
              <p className="text-sm mt-2 text-gray-600">
                Real API data will appear in the 4-layer pipeline below once triggered.
              </p>
            </div>
          ) : result.error ? (
            <div className="card p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <p className="font-bold mb-1">Engine Error</p>
              <p className="text-sm">{result.error}</p>
            </div>
          ) : (
            <>
              {/* Status + KPIs */}
              <div className="card space-y-5">
                <div className={`p-4 rounded-xl border ${(result.status === "ACTIVE" || result.status === "ACTIVATED") ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                  <div className="flex items-center gap-3">
                    {(result.status === "ACTIVE" || result.status === "ACTIVATED")
                      ? <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                      : <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />}
                    <div>
                      <h4 className={`font-bold ${(result.status === "ACTIVE" || result.status === "ACTIVATED") ? "text-emerald-400" : "text-amber-400"}`}>
                        {(result.status === "ACTIVE" || result.status === "ACTIVATED") ? "Trigger Active — Payouts Queued" : `Status: ${result.status}`}
                      </h4>
                      <p className="text-sm text-gray-400 mt-0.5">{result.message}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Riders Evaluated", val: result.riders_evaluated },
                    { label: "Payouts Queued",   val: result.payouts_queued },
                    { label: "Fraud Skipped",    val: result.skipped_fraud },
                    { label: "Intervals",        val: result.interval_count },
                  ].map((s, i) => (
                    <div key={i} className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                      <p className="text-2xl font-bold font-mono">{s.val}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Est. Payout (New Riders)</p>
                    <p className="text-xl font-bold font-mono text-brand-400">{formatCurrency(result.estimated_payout_new)}</p>
                  </div>
                  <div className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Est. Payout (Returning)</p>
                    <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(result.estimated_payout_returning)}</p>
                  </div>
                </div>
              </div>

              {/* 4-Layer Pipeline */}
              {pipeline && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Activity className="w-4 h-4 text-brand-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">API Data Pipeline</h4>
                    <div className="flex-1 h-px bg-dark-600 ml-2" />
                  </div>
                  <Layer1 data={pipeline.external_api} />
                  <Layer2 data={pipeline.normalized_data} metricType={result.metric_type} />
                  <Layer3 data={pipeline.trigger_evaluation} unit={selectedTrigger.unit} />
                  <Layer4 data={pipeline.simulation} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
