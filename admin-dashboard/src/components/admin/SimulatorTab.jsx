import { useState, useEffect } from "react"
import { AlertTriangle, Play, CheckCircle, Activity, Crosshair } from "lucide-react"

// Maps UI-friendly names to backend metric_type values and schema fields
const TRIGGER_TYPES = [
  { id: "Heavy Rain",     metric: "WEATHER",            unit: "mm/hr",      thresholdMin: 35,  desc: "Monsoon flooding equivalent" },
  { id: "Hailstorm",      metric: "WEATHER",            unit: "alert",      thresholdMin: 1,   desc: "Instant severity confirmation" },
  { id: "Extreme Heat",   metric: "WEATHER",            unit: "°C",         thresholdMin: 40,  desc: "Sustained heatwave" },
  { id: "Toxic AQI",      metric: "AQI",                unit: "AQI",        thresholdMin: 300, desc: "Hazardous particulate levels" },
  { id: "Zomato Outage",  metric: "PLATFORM_BLACKOUT",  unit: "min",        thresholdMin: 45,  desc: "Must overlap peak hours (11am-2pm or 7pm-9pm)" },
  { id: "Swiggy Outage",  metric: "PLATFORM_BLACKOUT",  unit: "min",        thresholdMin: 45,  desc: "Must overlap peak hours (11am-2pm or 7pm-9pm)" },
  { id: "Bandh/Riot",     metric: "SOCIAL_DISRUPTION",  unit: "% conf",     thresholdMin: 75,  desc: "Civil disruption trigger (NLP confidence)" },
]

const PEAK_TIMES = ["11:00", "13:00"]  // mid of peak window — always valid

function getPlatform(triggerId) {
  if (triggerId === "Zomato Outage") return "zomato"
  if (triggerId === "Swiggy Outage") return "swiggy"
  return "zomato"
}

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
    fetch("/api/dashboards/admin/zones")
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

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold">Trigger Simulator</h2>
        <p className="text-gray-400 mt-1">Force environmental and platform disruptions to test the payout engine.</p>
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
              <label className="text-sm font-medium text-gray-400">Severity Value</label>
              <span className={`text-sm font-bold font-mono ${meetsThreshold ? 'text-emerald-400' : 'text-rose-400'}`}>
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

          <div className="p-4 bg-dark-900 border border-amber-500/20 rounded-xl">
            <h4 className="text-sm font-bold text-amber-400 mb-2">⚠ Rule Engine Note</h4>
            <p className="text-xs text-gray-500">
              Payouts fire only for riders with active policies &amp; verifiable zone activity logs. 
              Fraud detection runs automatically on every claim.
            </p>
          </div>

          <button
            onClick={fireSimulation}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 font-bold rounded-xl py-4 transition-all duration-300 ${
              loading
                ? 'bg-dark-700 text-gray-400 cursor-not-allowed'
                : meetsThreshold
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]'
                  : 'bg-dark-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {loading ? "PROCESSING ENGINE RULES..." : meetsThreshold ? "FIRE DISRUPTION TRIGGER" : "THRESHOLD NOT MET"}
          </button>
        </div>

        {/* Results */}
        <div className="card flex flex-col min-h-96">
          <div className="flex items-center gap-2 border-b border-dark-600 pb-4 mb-6">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold">Execution Output</h3>
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 p-8">
              <AlertTriangle className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">Awaiting engine execution.</p>
              <p className="text-sm mt-2">Results will show eligibility, fraud checks, and payout volumes.</p>
            </div>
          ) : result.error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <p className="font-bold mb-1">Engine Error</p>
              <p className="text-sm">{result.error}</p>
            </div>
          ) : (
            <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className={`p-4 rounded-xl border ${(result.status === "ACTIVE" || result.status === "ACTIVATED") ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center gap-3">
                  {(result.status === "ACTIVE" || result.status === "ACTIVATED")
                    ? <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    : <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />}
                  <div>
                    <h4 className={`font-bold ${(result.status === "ACTIVE" || result.status === "ACTIVATED") ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(result.status === "ACTIVE" || result.status === "ACTIVATED") ? "Trigger Active" : `Status: ${result.status}`}
                    </h4>
                    <p className="text-sm text-gray-400 mt-0.5">{result.message}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Riders Evaluated", val: result.riders_evaluated },
                  { label: "Payouts Queued", val: result.payouts_queued },
                  { label: "Fraud Skipped", val: result.skipped_fraud },
                  { label: "Intervals", val: result.interval_count },
                ].map((s, i) => (
                  <div key={i} className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                    <p className="text-2xl font-bold font-mono">{s.val}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Est. Payout (New Riders)</p>
                <p className="text-xl font-bold font-mono text-brand-400">{formatCurrency(result.estimated_payout_new)}</p>
                <p className="text-xs text-gray-500 mt-2 mb-1">Est. Payout (Returning)</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(result.estimated_payout_returning)}</p>
              </div>

              {result.mock_api_data && (
                <div>
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">External API Verification</h4>
                  <div className="bg-dark-900 border border-dark-600 rounded-xl p-4 overflow-auto max-h-48 custom-scrollbar">
                    <pre className="text-xs font-mono text-brand-300 whitespace-pre-wrap">
                      {JSON.stringify(result.mock_api_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
