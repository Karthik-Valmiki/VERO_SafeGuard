import React, { useState, useEffect, useCallback } from "react"
import {
  Shield, MapPin, Phone, CreditCard, LogOut, ChevronRight,
  TrendingUp, Bell, HelpCircle, Star, Clock,
  Award, BadgeCheck, Flame, Lock, Wallet, Zap
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { getMyDashboard } from "../api"
import SimulatorBanner from "../components/SimulatorBanner"

function getTier(r, isNew) {
  if (isNew) return {
    name: "Starter", icon: Shield, color: "text-ink-400", bg: "bg-ink-700/60", border: "border-ink-600",
    disc: "0%", coverage: "40%", payout: "Standard",
    next: "Ride 3 weeks to unlock your personal score",
  }
  if (r >= 0.85) return {
    name: "Elite", icon: Flame, color: "text-accent-400", bg: "bg-ink-700/60", border: "border-ink-600",
    disc: "Up to 35%", coverage: "Up to 65%", payout: "Priority", next: null,
  }
  if (r >= 0.65) return {
    name: "Gold", icon: Award, color: "text-accent-400", bg: "bg-ink-700/60", border: "border-ink-600",
    disc: "Up to 25%", coverage: "Up to 60%", payout: "Fast",
    next: "Reach R ≥ 0.85 to unlock Elite",
  }
  if (r >= 0.45) return {
    name: "Silver", icon: BadgeCheck, color: "text-ink-300", bg: "bg-ink-700/60", border: "border-ink-600",
    disc: "Up to 15%", coverage: "Up to 55%", payout: "Standard",
    next: "Reach R ≥ 0.65 to unlock Gold",
  }
  return {
    name: "Bronze", icon: Shield, color: "text-ink-400", bg: "bg-ink-700/60", border: "border-ink-600",
    disc: "Up to 5%", coverage: "Up to 46%", payout: "Standard",
    next: "Reach R ≥ 0.45 to unlock Silver",
  }
}

function MiniBar({ value, color }) {
  return (
    <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden flex-1">
      <div className={`h-full ${color} rounded-full transition-[width] duration-500`} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  )
}

export default function Profile() {
  const { rider, logout } = useAuth()
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)

  const load = useCallback(async () => {
    try { const d = await getMyDashboard(); setDash(d.data) } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  if (!rider) return null

  const riderD  = dash?.rider
  const policy  = dash?.policy
  const payouts = dash?.payout_history || []
  const hasPol  = policy?.status === "ACTIVE" || policy?.status === "PENDING"
  const r       = Number(riderD?.reliability_score || 0)
  const isNew   = riderD?.is_new_user ?? true
  const weeks   = riderD?.r_breakdown?.weeks_tracked || 0
  const tier    = getTier(r, isNew)
  const TierIcon = tier.icon

  const totalReceived = payouts.filter(p => p.status === "SUCCESS").reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const premiumWkly   = hasPol ? Number(policy.premium || 0) : 0
  const premiumPaid   = premiumWkly * Math.max(1, weeks)
  const roi           = premiumPaid > 0 ? ((totalReceived / premiumPaid) * 100).toFixed(0) : null

  const phoneDisplay = rider.phone_number || rider.phone || riderD?.phone || "—"
  const upiDisplay   = riderD?.upi_id || rider.upi_id || "Unlinked"
  const shiftHours   = riderD?.shift_hours || {}
  const shiftStart   = shiftHours.start || rider.shift_start?.slice(0,5) || "—"
  const shiftEnd     = shiftHours.end   || rider.shift_end?.slice(0,5)   || "—"
  const cityDisplay  = riderD?.city     || rider.city     || "—"
  const zoneDisplay  = riderD?.zone     || "Unassigned zone"
  const platDisplay  = riderD?.platform || rider.platform || "—"

  const menuSections = [
    {
      title: "Rider details",
      items: [
        { icon: Phone,      label: "Phone number",    value: phoneDisplay },
        { icon: CreditCard, label: "Disbursement UPI", value: upiDisplay },
        { icon: MapPin,     label: "Operating zone",   value: `${cityDisplay} · ${zoneDisplay}` },
        { icon: Clock,      label: "Active shift",    value: `${shiftStart} – ${shiftEnd}` },
      ],
    },
    {
      title: "Coverage",
      items: [
        { icon: Shield,     label: "Policy",           value: hasPol ? `Active · ₹${Number(policy.premium || 0).toFixed(0)}/wk` : "No active policy", action: () => navigate("/policy") },
        { icon: TrendingUp, label: "Claims & payouts", value: `₹${totalReceived.toFixed(0)} received`, action: () => navigate("/claims") },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: Bell,       label: "Disruption alerts", value: "Real-time notifications", action: () => navigate("/notifications") },
        { icon: Star,       label: "Feedback",          value: "Share rider experience" },
        { icon: HelpCircle, label: "Documentation",     value: "Zero-touch claim guide" },
      ],
    },
  ]

  return (
    <div className="flex flex-col min-h-full bg-ink-900 text-ink-100">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <SimulatorBanner />
        <div className="px-4 py-5 pb-24 space-y-4">

          {/* Profile header */}
          <div className="flex items-center gap-4 bg-ink-800 border border-ink-600 rounded-2xl p-4">
            <div className="w-12 h-12 rounded-xl bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-accent-400">{rider.name?.[0] || "R"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-ink-100 truncate">{rider.name}</h2>
              <p className="text-xs text-ink-400 mt-0.5">{platDisplay} · {cityDisplay}</p>
              <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tier.bg} ${tier.color} border ${tier.border}`}>
                <TierIcon size={12} />
                <span>{tier.name} tier</span>
              </div>
            </div>
          </div>

          {/* Performance & tier details */}
          <div className="card space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TierIcon size={16} className={tier.color} />
                <span className="text-sm font-semibold text-ink-100">{tier.name} status</span>
              </div>
              {!isNew && <span className={`text-base font-mono font-semibold ${tier.color}`}>{r.toFixed(2)}</span>}
            </div>

            {!isNew && (
              <div className="space-y-2 pt-1">
                {riderD?.r_breakdown && [
                  { label: "Availability", value: riderD.r_breakdown.tu, color: "bg-accent-500" },
                  { label: "Efficiency",   value: riderD.r_breakdown.de, color: "bg-accent-400" },
                  { label: "Completion",   value: riderD.r_breakdown.cr, color: "bg-positive" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="text-xs text-ink-400 w-24 shrink-0">{label}</span>
                    <MiniBar value={value} color={color} />
                    <span className="text-xs font-mono text-ink-300 w-10 text-right">{(value * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-ink-600/60">
              {[
                { label: "Premium discount", value: tier.disc, icon: <Wallet size={15} className="mb-1 mx-auto text-ink-400" /> },
                { label: "Max coverage", value: tier.coverage, icon: <Shield size={15} className="mb-1 mx-auto text-ink-400" /> },
                { label: "Payout priority", value: tier.payout, icon: <Zap size={15} className="mb-1 mx-auto text-ink-400" /> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-ink-700/60 border border-ink-600 rounded-xl p-2.5 text-center">
                  {icon}
                  <p className={`text-xs font-mono font-semibold ${tier.color}`}>{value}</p>
                  <p className="text-[10px] text-ink-400 leading-tight mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {tier.next && (
              <div className="flex items-center gap-2 bg-ink-700/50 rounded-xl px-3 py-2 border border-ink-600/60">
                <Lock size={12} className="text-ink-400 shrink-0" />
                <p className="text-xs text-ink-400">{tier.next}</p>
              </div>
            )}
            {isNew && (
              <p className="text-xs text-ink-400 text-center">
                Score personalization unlocks after 3 tracked weeks
              </p>
            )}
          </div>

          {/* Financial summary */}
          <div className="card">
            <p className="text-xs text-ink-400 mb-3">Financial summary</p>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="bg-ink-700/60 border border-ink-600 rounded-xl p-3">
                <p className="text-xs text-ink-400 mb-0.5">Total recovered</p>
                <p className="text-lg font-mono font-semibold text-accent-400">₹{totalReceived.toFixed(0)}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">Automated payouts</p>
              </div>
              <div className="bg-ink-700/60 border border-ink-600 rounded-xl p-3">
                <p className="text-xs text-ink-400 mb-0.5">Premiums paid</p>
                <p className="text-lg font-mono font-semibold text-ink-100">₹{premiumPaid.toFixed(0)}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{weeks}w tracked</p>
              </div>
            </div>
            {roi !== null && totalReceived > 0 ? (
              <div className="flex items-center gap-2 bg-positive/10 border border-positive/20 rounded-xl px-3 py-2">
                <TrendingUp size={13} className="text-positive shrink-0" />
                <p className="text-xs text-positive font-medium">
                  Recovered {roi}% of paid premiums in payouts
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-400 text-center py-1">No claims needed — coverage standing by</p>
            )}
          </div>

          {/* Settings / navigation menu */}
          {menuSections.map(({ title, items }) => (
            <div key={title}>
              <p className="text-xs font-medium text-ink-400 mb-2 px-1">{title}</p>
              <div className="space-y-1.5">
                {items.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between bg-ink-800 border border-ink-600 rounded-xl px-4 py-3 transition-colors text-left ${
                      item.action ? "hover:border-ink-500 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={15} className="text-ink-400" />
                      <div>
                        <p className="text-xs font-medium text-ink-100">{item.label}</p>
                        <p className="text-xs text-ink-400 truncate max-w-[190px]">{item.value}</p>
                      </div>
                    </div>
                    {item.action && <ChevronRight size={14} className="text-ink-400" />}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Sign out */}
          <button
            onClick={() => { logout(); navigate("/") }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-negative/25 bg-negative/5 text-negative hover:bg-negative/10 active:scale-[0.98] transition-colors font-medium text-sm"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>

          <p className="text-center text-xs text-ink-400 font-mono pb-4">VERO SafeGuard · Parametric Protection</p>
        </div>
      </div>
    </div>
  )
}
