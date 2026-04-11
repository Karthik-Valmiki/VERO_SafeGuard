import { useState, useEffect, useRef, useCallback } from "react"
import {
  Users, FileCheck, CircleDollarSign, Coins, Activity, Zap,
  ShieldAlert, CloudRain, AlertTriangle, Wifi, Shield, ChevronDown,
  ChevronRight, CheckCircle2, Clock, User, Bot, IndianRupee
} from "lucide-react"

// ── Trigger type metadata ─────────────────────────────────────────────────
const TRIGGER_META = {
  WEATHER:           { label: "Weather Event",    color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: CloudRain },
  AQI:               { label: "AQI Crisis",       color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle },
  PLATFORM_BLACKOUT: { label: "Platform Outage",  color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: Wifi },
  SOCIAL_DISRUPTION: { label: "Social Disruption",color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20",   icon: Shield },
  "—":               { label: "Event",            color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/20",   icon: Zap },
  UNKNOWN:           { label: "Event",            color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/20",   icon: Zap },
}

function getTriggerMeta(type) {
  return TRIGGER_META[type] || TRIGGER_META["UNKNOWN"]
}

const fmtCur = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0)

const fmtTime = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

const fmtDatetime = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
}

// ── Single payout row ─────────────────────────────────────────────────────
function PayoutRow({ payout, isNew }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-300
      ${isNew ? "bg-emerald-500/5 border-emerald-500/20 animate-pulse-once" : "bg-white/2 border-white/5 hover:bg-white/4"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
        ${payout.rider_type === "real" ? "bg-violet-500/15 border border-violet-500/25" : "bg-blue-500/10 border border-blue-500/20"}`}>
        {payout.rider_type === "real"
          ? <User className="w-3.5 h-3.5 text-violet-400" />
          : <Bot  className="w-3.5 h-3.5 text-blue-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{payout.rider_name}</p>
        <p className="text-[10px] text-gray-500 truncate font-mono">{payout.upi_id}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-gray-500">{fmtTime(payout.processed_at)}</span>
        <span className="text-sm font-bold font-mono text-emerald-400">+{fmtCur(payout.amount)}</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      </div>
    </div>
  )
}

// ── Event group card (expandable) ─────────────────────────────────────────
function EventGroup({ eventId, payouts, prevKnownIds, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const meta    = getTriggerMeta(payouts[0]?.metric_type)
  const Icon    = meta.icon
  const total   = payouts.reduce((s, p) => s + p.amount, 0)
  const realCt  = payouts.filter(p => p.rider_type === "real").length
  const mockCt  = payouts.filter(p => p.rider_type === "mock").length
  const zoneName = payouts[0]?.zone_name || "—"
  const latestAt = payouts[0]?.processed_at

  // New payouts since last render
  const newIds = new Set(payouts.filter(p => !prevKnownIds?.has(p.payout_id)).map(p => p.payout_id))

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${meta.border} ${meta.bg}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
            {newIds.size > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                +{newIds.size} NEW
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 truncate">{zoneName} · {fmtDatetime(latestAt)}</p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className="text-sm font-bold font-mono text-white">{fmtCur(total)}</p>
          <p className="text-[10px] text-gray-500">{payouts.length} payouts</p>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        }
      </button>

      {/* Meta pills */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        {realCt > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
            {realCt} real rider{realCt > 1 ? "s" : ""}
          </span>
        )}
        {mockCt > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
            {mockCt} simulated
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
          #{(eventId || "").slice(0, 8)}
        </span>
      </div>

      {/* Expandable payout list */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {payouts.map(p => (
            <PayoutRow key={p.payout_id} payout={p} isNew={newIds.has(p.payout_id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Ungrouped payouts (no event_id) ──────────────────────────────────────
function UngroupedSection({ payouts, prevKnownIds }) {
  const [expanded, setExpanded] = useState(true)
  if (!payouts.length) return null
  const newIds = new Set(payouts.filter(p => !prevKnownIds?.has(p.payout_id)).map(p => p.payout_id))
  return (
    <div className="rounded-2xl border border-white/5 bg-white/2 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-gray-500/10 border border-gray-500/20 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-gray-300">Other Payouts</p>
          <p className="text-[11px] text-gray-500">No event linked</p>
        </div>
        <p className="text-sm font-mono font-bold text-gray-400 mr-2">{payouts.length}</p>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          {payouts.map(p => (
            <PayoutRow key={p.payout_id} payout={p} isNew={newIds.has(p.payout_id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Live Execution Feed ───────────────────────────────────────────────────
function LiveExecutionFeed() {
  const [payouts,      setPayouts]     = useState([])
  const [prevIds,      setPrevIds]     = useState(new Set())
  const [loading,      setLoading]     = useState(true)
  const [lastRefresh,  setLastRefresh] = useState(null)
  const [newCount,     setNewCount]    = useState(0)
  const INTERVAL = 5000

  const fetchPayouts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res  = await fetch("/api/dashboards/admin/live-payouts?limit=150")
      const data = await res.json()
      const list = data.payouts || []
      setPayouts(prev => {
        const prevSet = new Set(prev.map(p => p.payout_id))
        const fresh   = list.filter(p => !prevSet.has(p.payout_id)).length
        if (fresh > 0) setNewCount(c => c + fresh)
        setPrevIds(prevSet)
        return list
      })
      setLastRefresh(new Date())
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchPayouts()
    const iv = setInterval(() => fetchPayouts(true), INTERVAL)
    return () => clearInterval(iv)
  }, [fetchPayouts])

  // Group by event_id
  const groups = {}
  const ungrouped = []
  for (const p of payouts) {
    if (p.event_id) {
      if (!groups[p.event_id]) groups[p.event_id] = []
      groups[p.event_id].push(p)
    } else {
      ungrouped.push(p)
    }
  }
  const groupEntries = Object.entries(groups).sort(
    ([, a], [, b]) => new Date(b[0].processed_at) - new Date(a[0].processed_at)
  )

  const totalPaid  = payouts.reduce((s, p) => s + p.amount, 0)
  const realCount  = payouts.filter(p => p.rider_type === "real").length
  const mockCount  = payouts.filter(p => p.rider_type === "mock").length

  const dismissNew = () => setNewCount(0)

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-dark-600 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold font-display">Live Execution Feed</h3>
          {newCount > 0 && (
            <button
              onClick={dismissNew}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              +{newCount} new
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-gray-500 font-mono">
            {lastRefresh ? `Updated ${fmtTime(lastRefresh.toISOString())}` : "Updating..."}
          </span>
        </div>
      </div>

      {/* Summary bar */}
      {payouts.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4 flex-shrink-0">
          {[
            { label: "Total Paid",    val: fmtCur(totalPaid),            color: "text-emerald-400" },
            { label: "Events",        val: groupEntries.length,           color: "text-violet-400" },
            { label: "Real Riders",   val: realCount,                     color: "text-violet-400" },
            { label: "Simulated",     val: mockCount,                     color: "text-blue-400" },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-dark-900 border border-dark-600 rounded-xl px-3 py-2 text-center">
              <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {loading && payouts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 gap-3">
            <Activity className="w-5 h-5 animate-spin text-emerald-500" />
            Loading live payouts...
          </div>
        ) : payouts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 border border-dashed border-dark-600 rounded-2xl p-12">
            <Zap className="w-10 h-10 mb-4 opacity-20" />
            <p className="font-medium text-white">Awaiting Executions</p>
            <p className="text-sm mt-2">Fire a trigger in the Simulator tab to see live payouts appear here.</p>
          </div>
        ) : (
          <>
            {groupEntries.map(([eid, pouts], idx) => (
              <EventGroup
                key={eid}
                eventId={eid}
                payouts={pouts}
                prevKnownIds={prevIds}
                defaultExpanded={idx === 0}
              />
            ))}
            <UngroupedSection payouts={ungrouped} prevKnownIds={prevIds} />
          </>
        )}
      </div>

      {/* Footer total */}
      {payouts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-600 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <IndianRupee className="w-3.5 h-3.5" />
            Showing last 150 payouts across {groupEntries.length} event{groupEntries.length !== 1 ? "s" : ""}
          </div>
          <p className="text-sm font-bold font-mono text-emerald-400">{fmtCur(totalPaid)}</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
export default function OverviewTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const res    = await fetch("/api/dashboards/admin/summary")
      const sumData = await res.json()
      setData(sumData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64 gap-3 text-gray-400">
      <Activity className="w-5 h-5 animate-spin" />
      Loading live enterprise telemetry...
    </div>
  )

  if (!data) return (
    <div className="p-8 text-rose-400">Failed to load backend data. Is the backend running?</div>
  )

  return (
    <div className="p-8 pb-24 overflow-y-auto h-full space-y-8">

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Network Riders", val: (data.total_riders || 0).toLocaleString(),           icon: Users,             color: "text-blue-400",    glow: "shadow-blue-500/10" },
          { label: "Active Policies",      val: (data.active_policies || 0).toLocaleString(),        icon: FileCheck,         color: "text-emerald-400", glow: "shadow-emerald-500/10" },
          { label: "Global Premium Pool",  val: fmtCur(data.premium_collected || 0),                 icon: Coins,             color: "text-amber-400",   glow: "shadow-amber-500/10" },
          { label: "Total Payouts Issued", val: fmtCur(data.payouts_issued || 0),                    icon: CircleDollarSign,  color: "text-rose-400",    glow: "shadow-rose-500/10" },
        ].map((k, i) => (
          <div key={i} className={`card !p-5 relative overflow-hidden group shadow-lg ${k.glow}`}>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <k.icon className={`w-32 h-32 ${k.color}`} />
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-dark-700/50 border border-dark-600 ${k.color}`}>
                <k.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">{k.label}</p>
                <p className="text-2xl font-bold font-mono tracking-tight">{k.val}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN DASHBOARD GRIDS ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Left Side: Integrity + Disruptions */}
        <div className="xl:col-span-1 space-y-6">

          {/* System Integrity */}
          <div className="card">
            <h3 className="text-lg font-bold font-display flex items-center gap-2 mb-5">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              System Integrity
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-dark-900 border border-dark-600 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-400">Global Loss Ratio</span>
                  <span className={`text-sm font-bold font-mono ${(data.loss_ratio || 0) > 1 ? "text-rose-400" : "text-emerald-400"}`}>
                    {(data.loss_ratio || 0).toFixed(3)}x
                  </span>
                </div>
                <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${(data.loss_ratio || 0) > 1 ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min((data.loss_ratio || 0) * 50, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[11px] text-gray-500">
                  <span>0.000 (Profitable)</span>
                  <span className={data.loss_ratio > 1 ? "text-rose-400 font-bold" : ""}>1.000 Cap</span>
                </div>
              </div>

              <div className="p-4 bg-dark-900 border border-dark-600 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Fraud Attempts Blocked</p>
                  <p className="text-xs text-gray-500 mt-0.5">By ML Anomaly Engine</p>
                </div>
                <p className="text-2xl font-bold font-mono text-rose-400">{data.fraud_blocked_total || 0}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-dark-900 border border-dark-600 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-1">Pending Policies</p>
                  <p className="text-lg font-bold font-mono text-amber-400">{(data.pending_policies || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-dark-900 border border-dark-600 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-1">Active Policies</p>
                  <p className="text-lg font-bold font-mono text-emerald-400">{(data.active_policies || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Disruptions */}
          <div className="card min-h-[280px] flex flex-col">
            <h3 className="text-lg font-bold font-display flex items-center gap-2 mb-5 text-rose-400 flex-shrink-0">
              <Activity className="w-5 h-5" />
              Active Disruptions
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
              {(!data.active_disruptions || data.active_disruptions.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 border border-dashed border-dark-600 rounded-xl p-8">
                  <span className="text-3xl mb-2">☀️</span>
                  <p className="font-medium text-white text-sm">All Systems Operational</p>
                  <p className="text-xs mt-1">No active disruptions detected.</p>
                </div>
              ) : data.active_disruptions.map((d, i) => (
                <div key={i} className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-rose-400 text-sm flex items-center gap-2">
                        {d.metric_type}
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.started_at ? new Date(d.started_at).toLocaleTimeString() : "—"}</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md">LIVE</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-dark-900/50 rounded-lg p-2 border border-dark-600">
                      <p className="text-[10px] text-gray-500 uppercase">Location</p>
                      <p className="text-xs font-medium text-white">{d.zone_name}</p>
                      <p className="text-[11px] text-brand-400">{d.city}</p>
                    </div>
                    <div className="bg-dark-900/50 rounded-lg p-2 border border-dark-600 text-right">
                      <p className="text-[10px] text-gray-500 uppercase">Impact</p>
                      <p className="text-xs font-medium text-white">{(d.riders_affected || 0).toLocaleString()} Riders</p>
                      <p className="text-[11px] text-rose-400 font-mono">{d.payouts_queued} Payouts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Live Execution Feed */}
        <div className="xl:col-span-2 min-h-[600px]">
          <LiveExecutionFeed />
        </div>

      </div>
    </div>
  )
}
