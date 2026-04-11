import { useState, useEffect } from "react"
import { ShieldAlert, ShieldCheck, Database, BrainCircuit, ScanSearch, Activity, Layers, Copy, Hash } from "lucide-react"

export default function FraudTab() {
  const [logData, setLogData] = useState(null)
  const [modelsData, setModelsData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [logs, models] = await Promise.all([
        fetch("/api/dashboards/admin/fraud-log").then(r => r.json()),
        fetch("/api/dashboards/admin/ml-models").then(r => r.json())
      ])
      setLogData(logs)
      setModelsData(models.models)
      setLoading(false)
    } catch(err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 gap-3 text-gray-400">
      <Activity className="w-5 h-5 animate-spin" />
      Syncing ML Threat Models...
    </div>
  )

  const totalChecks = logData?.summary?.total_passes + logData?.summary?.total_blocks || 0
  const blockRate = totalChecks ? ((logData.summary.total_blocks / totalChecks) * 100).toFixed(1) : 0

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-indigo-400" />
            Fraud Intelligence Engine
          </h2>
          <p className="text-gray-400 mt-1">Live model explainability and deterministic anomaly sweeps.</p>
        </div>
        <div className="flex items-center gap-4 bg-dark-900 border border-dark-600 px-6 py-3 rounded-2xl">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Block Rate</p>
            <p className={`text-xl font-mono font-bold ${blockRate > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>{blockRate}%</p>
          </div>
          <div className="w-px h-8 bg-dark-600"></div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">Total Sweeps</p>
            <p className="text-xl font-mono font-bold text-white">{totalChecks}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100%-8rem)]">
        
        {/* ML Model Transparency Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="card bg-dark-900/50 border-indigo-500/20 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2 pb-4 mb-4 border-b border-dark-600">
              <Layers className="w-4 h-4 text-indigo-400" />
              Active System Models
            </h3>
            
            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(modelsData || {}).map(([key, model]) => (
                <div key={key} className="bg-dark-900 border border-dark-600 hover:border-indigo-500/30 transition-colors rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-bold text-white capitalize">{key.replace('_', ' ')}</h4>
                  </div>
                  <p className="text-xs text-indigo-300 font-mono mb-3">{model.type}</p>
                  <p className="text-sm text-gray-400 mb-4 leading-relaxed">{model.purpose}</p>
                  
                  <div className="bg-[#111115] rounded-lg p-3 border border-dark-600/50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Input Vectors</p>
                    <div className="flex flex-wrap gap-1.5">
                      {model.features.map(f => (
                        <span key={f} className="text-[10px] font-mono bg-dark-700/50 px-2 py-1 rounded text-gray-300 border border-dark-600">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Fraud Check Logs */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="card flex-1 flex flex-col p-0 overflow-hidden">
            <div className="p-5 border-b border-dark-600 bg-dark-900/50 flex justify-between items-center">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <ScanSearch className="w-5 h-5 text-emerald-400" />
                Live Anomaly Telemetry
              </h3>
              <div className="flex items-center gap-3 text-xs font-bold bg-dark-900 py-1.5 px-3 rounded-lg border border-dark-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-400">{logData?.summary?.total_passes || 0} Passed</span>
                </div>
                <div className="w-px h-3 bg-dark-600"></div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span className="text-rose-400">{logData?.summary?.total_blocks || 0} Blocked</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-dark-900/20">
              {(!logData || logData.checks.length === 0) ? (
                <div className="flex flex-col items-center justify-center text-center h-full text-gray-500">
                  <ScanSearch className="w-8 h-8 mb-3 opacity-20" />
                  <p className="font-medium">Monitoring Pipeline Active</p>
                  <p className="text-sm mt-1">Awaiting trigger evaluation vectors.</p>
                </div>
              ) : logData.checks.map(check => {
                const isBlock = check.result === "BLOCK";
                return (
                  <div key={check.check_id} className={`rounded-xl border overflow-hidden transition-all ${isBlock ? 'bg-rose-950/20 border-rose-500/30 shadow-[0_0_15px_-5px_rgba(244,63,94,0.1)]' : 'bg-dark-900 border-dark-600 hover:border-emerald-500/30'}`}>
                    
                    {/* Log Header */}
                    <div className={`px-4 py-3 border-b flex justify-between items-center ${isBlock ? 'border-rose-500/20 bg-rose-500/5' : 'border-dark-600 bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        {isBlock ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        <div>
                          <h4 className="font-bold text-white text-sm">{check.rider_name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-gray-500 font-mono tracking-wider">{check.profile_id}</p>
                            <Copy className="w-3 h-3 text-gray-600 cursor-pointer hover:text-white transition-colors" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className={`text-xs font-mono font-bold ${isBlock ? 'text-rose-400' : 'text-emerald-400'}`}>
                            Anomaly Score: {check.anomaly_score.toFixed(4)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {new Date(check.checked_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <span className={`text-[10px] uppercase px-2.5 py-1 rounded-md font-bold tracking-widest ${isBlock ? 'bg-rose-500 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {check.result}
                        </span>
                      </div>
                    </div>

                    {/* Log Body */}
                    <div className="p-4 bg-black/20">
                      {!check.features.reason ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(check.features).map(([fKey, fData]) => (
                            <div key={fKey} className="bg-dark-900/50 p-2.5 rounded-lg border border-dark-600/50">
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 truncate">{fKey.replace(/_/g, ' ')}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-gray-300 font-mono truncate">{fData.detail || fData.value}</p>
                                {fData.status && (
                                  <span className={`text-[10px] font-bold ${fData.status === '✓' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fData.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm text-gray-400 bg-dark-900/50 p-3 rounded-lg border border-dark-600/50">
                          <Activity className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                          <p className="leading-relaxed"><span className="text-white font-medium">System Rule Execution:</span> {check.features.reason}</p>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
