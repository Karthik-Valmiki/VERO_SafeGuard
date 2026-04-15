import { useState, useEffect, useRef, useCallback } from "react"
import { useAdmin } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import {
  LayoutDashboard, Zap, BarChart3, ShieldAlert, Map,
  LogOut, ShieldCheck, Bell, Activity, Users, FileCheck,
  IndianRupee, TrendingDown, RefreshCw, X, CheckCircle2,
  AlertTriangle, Loader2, Database, ChevronDown
} from "lucide-react"
import OverviewTab   from "../components/admin/OverviewTab"
import SimulatorTab  from "../components/admin/SimulatorTab"
import AnalyticsTab  from "../components/admin/AnalyticsTab"
import FraudTab      from "../components/admin/FraudTab"
import MapTab        from "../components/admin/MapTab"
import { generateRiders, getGenerateStatus } from "../api"

const TABS = [
  { id: "overview",   label: "Overview",          icon: LayoutDashboard },
  { id: "simulator",  label: "Trigger Simulator",  icon: Zap },
  { id: "analytics",  label: "Analytics",          icon: BarChart3 },
  { id: "fraud",      label: "Fraud Intelligence", icon: ShieldAlert },
  { id: "map",        label: "Command Map",         icon: Map },
]

// ── Countdown timer component ─────────────────────────────────────────────
function Countdown({ targetSeconds }) {
  const [remaining, setRemaining] = useState(targetSeconds)
  useEffect(() => {
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <span className="font-mono text-xs text-violet-400">
      {m > 0 ? `${m}m ` : ""}{s}s remaining
    </span>
  )
}

// ── Generate Riders Modal ─────────────────────────────────────────────────
function GenerateModal({ onClose, onDone }) {
  const [phase, setPhase]     = useState("confirm") // confirm | running | done | error
  const [genState, setGenState] = useState(null)
  const pollRef               = useRef(null)

  const startGeneration = async () => {
    setPhase("running")
    try {
      await generateRiders()
      // Start polling status
      pollRef.current = setInterval(async () => {
        try {
          const res = await getGenerateStatus()
          const s   = res.data
          setGenState(s)
          if (s.status === "done") {
            clearInterval(pollRef.current)
            setPhase("done")
            onDone()
          } else if (s.status === "error") {
            clearInterval(pollRef.current)
            setPhase("error")
          }
        } catch (_) {}
      }, 1500)
    } catch (err) {
      if (err.response?.status === 409) {
        // Already running — start polling
        pollRef.current = setInterval(async () => {
          try {
            const res = await getGenerateStatus()
            const s   = res.data
            setGenState(s)
            if (s.status === "done") {
              clearInterval(pollRef.current)
              setPhase("done")
              onDone()
            } else if (s.status === "error") {
              clearInterval(pollRef.current)
              setPhase("error")
            }
          } catch (_) {}
        }, 1500)
      } else {
        setGenState({ error: err.response?.data?.detail || err.message })
        setPhase("error")
      }
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const progress = genState?.progress ?? 0
  const message  = genState?.message  ?? "Initialising..."

  // Key phase labels for the progress bar steps
  const steps = [
    { label: "Clearing old data",     threshold: 15 },
    { label: "Building riders",       threshold: 60 },
    { label: "Inserting profiles",    threshold: 72 },
    { label: "Writing policies",      threshold: 82 },
    { label: "Logging telemetry",     threshold: 92 },
    { label: "Complete",              threshold: 100 },
  ]
  const currentStep = steps.findIndex(s => progress < s.threshold)
  const activeStep  = currentStep === -1 ? steps.length - 1 : currentStep

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-[#0f0f18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Database className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Simulate 8,000 Riders</h2>
              <p className="text-[11px] text-gray-500">Mock network generation engine</p>
            </div>
          </div>
          {phase !== "running" && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">

          {/* ── CONFIRM ── */}
          {phase === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
                <p className="font-bold text-amber-400 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Before you proceed
                </p>
                <ul className="text-gray-400 space-y-1 text-xs list-disc list-inside">
                  <li>All previous simulated riders will be <span className="text-rose-400 font-semibold">completely erased</span></li>
                  <li>All their policies, payouts, activity logs, and fraud logs will be deleted</li>
                  <li><span className="text-emerald-400 font-semibold">Real registered users are never affected</span></li>
                  <li>Fresh 8,000 riders will be generated with new telemetry data</li>
                  <li>This takes approximately <span className="text-violet-400 font-semibold">30–45 seconds</span></li>
                </ul>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { val: "~5,700",  label: "Active Policies",   color: "text-emerald-400" },
                  { val: "~2,300",  label: "Fraud / Inactive",  color: "text-rose-400" },
                  { val: "~25,000", label: "Activity Logs",     color: "text-blue-400" },
                ].map(({ val, label, color }) => (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <p className={`text-lg font-bold font-mono ${color}`}>{val}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startGeneration}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-500/20"
                >
                  Generate Now
                </button>
              </div>
            </div>
          )}

          {/* ── RUNNING ── */}
          {phase === "running" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-violet-300">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span className="font-medium">Generation in progress</span>
                </div>
                {genState?.started_at && <Countdown targetSeconds={42} />}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-400 truncate max-w-[80%]">{message}</span>
                  <span className="text-xs font-mono text-violet-400 ml-2">{progress}%</span>
                </div>
                <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-purple-400 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Step indicators */}
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const done    = idx < activeStep
                  const current = idx === activeStep
                  return (
                    <div key={step.label} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                        ${done    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" :
                          current ? "bg-violet-500/20 border border-violet-500/40 text-violet-400" :
                                    "bg-white/3 border border-white/10 text-gray-600"}`}>
                        {done ? <CheckCircle2 className="w-3 h-3" /> : idx + 1}
                      </div>
                      <span className={`text-xs ${
                        done    ? "text-gray-500 line-through" :
                        current ? "text-white font-medium" :
                                  "text-gray-600"
                      }`}>{step.label}</span>
                      {current && <Loader2 className="w-3 h-3 animate-spin text-violet-400 ml-auto" />}
                      {done    && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-gray-600 text-center">
                Do not close this window. Real users are fully protected.
              </p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-emerald-400">Generation Complete</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {genState?.message || "8,000 riders generated successfully."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: (genState?.generated || 0).toLocaleString(), label: "Riders",         color: "text-violet-400" },
                  { val: (genState?.active_policies || 0).toLocaleString(), label: "Active Policies", color: "text-emerald-400" },
                  { val: (genState?.activity_logs || 0).toLocaleString(), label: "Activity Logs",  color: "text-blue-400" },
                ].map(({ val, label, color }) => (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <p className={`text-base font-bold font-mono ${color}`}>{val}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all"
              >
                Close & Refresh
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="font-bold text-rose-400 flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Generation Failed
                </p>
                <p className="text-xs text-gray-400">{genState?.error || "Unknown error occurred."}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400">
                  Close
                </button>
                <button onClick={() => { setPhase("confirm"); setGenState(null) }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold">
                  Retry
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const [activeTab, setActiveTab]             = useState("overview")
  const [summary, setSummary]                 = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications]     = useState([])
  const [showGenModal, setShowGenModal]        = useState(false)
  const [genBadge, setGenBadge]               = useState(null) // null | 'running' | 'done'
  const { adminLogout }                        = useAdmin()
  const navigate                               = useNavigate()
  const notifRef                               = useRef(null)

  const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "vero_admin_key_2026"
  const adminHeaders = { "X-Admin-Key": adminKey }

  const fetchSummary = useCallback(() => {
    fetch("/api/dashboards/admin/summary", { headers: adminHeaders })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
    fetch("/api/dashboards/admin/notifications", { headers: adminHeaders })
      .then(r => r.json())
      .then(data => setNotifications(data.notifications || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSummary()
    const iv = setInterval(fetchSummary, 10000)
    return () => clearInterval(iv)
  }, [fetchSummary])

  // Close notifications when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const fmt    = (n) => new Intl.NumberFormat("en-IN").format(Math.round(n || 0))
  const fmtCur = (n) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0)}`

  const handleLogout = () => { adminLogout(); navigate("/login") }

  const handleGenDone = () => {
    setGenBadge("done")
    fetchSummary()
    setTimeout(() => setGenBadge(null), 8000)
  }

  const unreadNotifs = notifications.filter(n => n.payout_count > 0).length

  return (
    <>
      {showGenModal && (
        <GenerateModal
          onClose={() => setShowGenModal(false)}
          onDone={handleGenDone}
        />
      )}

      <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden font-sans">

        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 bg-[#0f0f18] border-r border-white/5 flex flex-col">

          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">VERO</p>
              <p className="text-[10px] text-violet-400 font-mono uppercase tracking-widest">Command Center</p>
            </div>
            <div className="ml-auto flex items-center gap-1 h-5 px-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400 font-bold">LIVE</span>
            </div>
          </div>

          {/* Mini KPI Strip */}
          {summary && (
            <div className="px-4 py-4 grid grid-cols-2 gap-2 border-b border-white/5">
              {[
                { icon: Users,        val: fmt(summary.total_riders),                                  label: "Riders",     color: "text-blue-400" },
                { icon: FileCheck,    val: fmt(summary.active_policies),                               label: "Policies",   color: "text-emerald-400" },
                { icon: IndianRupee,  val: fmtCur(summary.premium_collected),                         label: "Premium",    color: "text-amber-400" },
                { icon: TrendingDown, val: `${(summary.loss_ratio || 0).toFixed(2)}x`,                label: "Loss Ratio", color: summary.loss_ratio > 1 ? "text-rose-400" : "text-emerald-400" },
              ].map((k, i) => (
                <div key={i} className="bg-white/3 border border-white/5 rounded-lg p-2.5">
                  <k.icon className={`w-3.5 h-3.5 mb-1 ${k.color}`} />
                  <p className="text-xs font-bold font-mono leading-none">{k.val}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {TABS.map(tab => {
              const Icon   = tab.icon
              const active = activeTab === tab.id
              const hasAlert = tab.id === "fraud" && summary?.fraud_blocked_total > 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                    active
                      ? "bg-violet-600/20 text-violet-300 border border-violet-500/25"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-violet-400" : ""}`} />
                  {tab.label}
                  {hasAlert && (
                    <span className="ml-auto text-[10px] font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-500/20">
                      {summary.fraud_blocked_total}
                    </span>
                  )}
                  {tab.id === "simulator" && summary?.active_disruptions?.length > 0 && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Simulate Data Section */}
          <div className="p-3 border-t border-white/5">
            <button
              onClick={() => setShowGenModal(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl
                bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 hover:border-violet-500/40
                text-violet-300 text-xs font-bold transition-all group"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Generate 8k Riders
              </div>
              {genBadge === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ChevronDown className="w-3 h-3 rotate-[-90deg] text-violet-500 group-hover:text-violet-300 transition-colors" />
              )}
            </button>
          </div>

          {/* Admin Profile */}
          <div className="p-3 border-t border-white/5">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold">AD</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Admin</p>
                <p className="text-[11px] text-gray-500 truncate">vero@admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top Bar */}
          <header className="h-16 flex-shrink-0 bg-[#0f0f18]/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-6 relative z-40">
            <div>
              <h1 className="text-lg font-bold">{TABS.find(t => t.id === activeTab)?.label}</h1>
              <p className="text-xs text-gray-500">VERO SafeGuard • Parametric Insurance Network</p>
            </div>
            <div className="flex items-center gap-3">
              {summary?.active_disruptions?.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  {summary.active_disruptions.length} active event{summary.active_disruptions.length > 1 ? "s" : ""}
                </div>
              )}

              <button onClick={fetchSummary} title="Force Refresh"
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Notifications bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors relative"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifs > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-[#0f0f18]" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)]
                    bg-[#0f0f18] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 bg-white/3 flex justify-between items-center">
                      <h3 className="font-bold text-sm">Completed Triggers</h3>
                      <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                        {notifications.length}
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-500">
                          No completed triggers yet.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.event_id} className="px-4 py-3 border-b border-white/5 hover:bg-white/3 last:border-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold text-emerald-400">{n.metric_type}</p>
                              <span className="text-[10px] text-gray-500">
                                {n.ended_at ? new Date(n.ended_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-white">{n.zone_name}</p>
                            {n.payout_count > 0 && (
                              <p className="text-[11px] text-violet-400 mt-0.5">
                                {n.payout_count} payouts · ₹{n.total_paid?.toFixed(0)}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 font-mono px-3 py-1.5 bg-white/3 border border-white/5 rounded-lg">
                {new Date().toLocaleTimeString("en-IN", { hour12: false })} IST
              </div>
            </div>
          </header>

          {/* Tab Content */}
          <main className="flex-1 overflow-auto">
            {activeTab === "overview"  && <OverviewTab />}
            {activeTab === "simulator" && <SimulatorTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
            {activeTab === "fraud"     && <FraudTab />}
            {activeTab === "map"       && <MapTab />}
          </main>
        </div>
      </div>
    </>
  )
}
