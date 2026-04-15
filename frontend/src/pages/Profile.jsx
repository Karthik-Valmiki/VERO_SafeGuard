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
    name: "Starter", icon: Shield, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20",
    glow: "", disc: "0%", coverage: "40%", payout: "Standard",
    next: "Ride 3 weeks to unlock your score",
  }
  if (r >= 0.85) return {
    name: "Elite", icon: Flame, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30",
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.15)]",
    disc: "Up to 35%", coverage: "Up to 65%", payout: "Priority", next: null,
  }
  if (r >= 0.65) return {
    name: "Gold", icon: Award, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30",
    glow: "shadow-[0_0_24px_rgba(234,179,8,0.12)]",
    disc: "Up to 25%", coverage: "Up to 60%", payout: "Fast",
    next: "Reach R ≥ 0.85 to unlock Elite",
  }
  if (r >= 0.45) return {
    name: "Silver", icon: BadgeCheck, color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/25",
    glow: "", disc: "Up to 15%", coverage: "Up to 55%", payout: "Standard",
    next: "Reach R ≥ 0.65 to unlock Gold",
  }
  return {
    name: "Bronze", icon: Shield, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25",
    glow: "", disc: "Up to 5%", coverage: "Up to 46%", payout: "Standard",
    next: "Reach R ≥ 0.45 to unlock Silver",
  }
}

function MiniBar({ value, color }) {
  return (
    <div className="h-1 bg-dark-700 rounded-full overflow-hidden flex-1">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, value * 100)}%` }} />
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
  // Backend returns policy.premium (not premium_paid)
  const premiumWkly   = hasPol ? Number(policy.premium || 0) : 0
  const premiumPaid   = premiumWkly * Math.max(1, weeks)
  const roi           = premiumPaid > 0 ? ((totalReceived / premiumPaid) * 100).toFixed(0) : null

  const phoneDisplay = rider.phone_number || rider.phone || riderD?.phone || "—"
  const upiDisplay   = riderD?.upi_id || rider.upi_id || "Not linked"
  const shiftHours   = riderD?.shift_hours || {}
  const shiftStart   = shiftHours.start || rider.shift_start?.slice(0,5) || "—"
  const shiftEnd     = shiftHours.end   || rider.shift_end?.slice(0,5)   || "—"
  const cityDisplay  = riderD?.city     || rider.city     || "—"
  const zoneDisplay  = riderD?.zone     || "Unassigned Zone"
  const platDisplay  = riderD?.platform || rider.platform || "—"

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Phone,      label: "Phone",    value: phoneDisplay,                      color: "text-brand-400" },
        { icon: CreditCard, label: "UPI ID",   value: upiDisplay,                        color: "text-cyan-400" },
        { icon: MapPin,     label: "Zone",     value: `${cityDisplay} · ${zoneDisplay}`, color: "text-orange-400" },
        { icon: Clock,      label: "Shift",    value: `${shiftStart} – ${shiftEnd}`,     color: "text-purple-400" },
      ],
    },
    {
      title: "Coverage",
      items: [
        { icon: Shield,     label: "My Policy",        value: hasPol ? `Active · ₹${Number(policy.premium || 0).toFixed(0)}/wk` : "No active policy", color: "text-brand-400", action: () => navigate("/policy") },
        { icon: TrendingUp, label: "Claims & Payouts", value: `₹${totalReceived.toFixed(0)} received`,                             color: "text-green-400", action: () => navigate("/claims") },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: Bell,       label: "Notifications",    value: "Payout alerts & updates",  color: "text-yellow-400", action: () => navigate("/notifications") },
        { icon: Star,       label: "Rate VERO",        value: "Help us improve",           color: "text-pink-400" },
        { icon: HelpCircle, label: "Help & FAQ",       value: "How payouts work",          color: "text-gray-400" },
      ],
    },
  ]

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <SimulatorBanner />
        <div className="px-4 py-5 pb-28 space-y-4 animate-fade-up">

          {/* ── PROFILE HEADER ── */}
          <div className="flex items-center gap-4 bg-dark-800/60 border border-dark-700/50 rounded-2xl p-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600/40 to-dark-800 border border-brand-500/30 flex items-center justify-center">
                <span className="text-xl font-black text-brand-400">{rider.name?.[0] || "R"}</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-dark-900 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{rider.name}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">{platDisplay}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{cityDisplay} · {zoneDisplay}</p>
              <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}>
                <TierIcon size={10} />
                {tier.name} Rider
              </div>
            </div>
          </div>

          {/* ── PERFORMANCE & BENEFITS HUB ── */}
          <div className={`rounded-2xl border ${tier.border} ${tier.bg} ${tier.glow} p-4 space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TierIcon size={16} className={tier.color} />
                <span className="text-sm font-bold text-white">{tier.name} Status</span>
              </div>
              {!isNew && <span className={`text-lg font-display font-black ${tier.color}`}>{r.toFixed(2)}</span>}
            </div>

            {!isNew && (
              <div className="flex items-center gap-3">
                <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#1f2937" strokeWidth="5" />
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke={r >= 0.85 ? "#fbbf24" : r >= 0.65 ? "#eab308" : r >= 0.45 ? "#94a3b8" : "#f97316"}
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 22 * r} ${2 * Math.PI * 22}`}
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                    style={{ transition: "stroke-dasharray 0.8s ease" }}
                  />
                  <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">
                    {r.toFixed(2)}
                  </text>
                </svg>
                <div className="flex-1 space-y-1.5">
                  {riderD?.r_breakdown && [
                    { label: "Availability", value: riderD.r_breakdown.tu, color: "bg-cyan-500" },
                    { label: "Efficiency",   value: riderD.r_breakdown.de, color: "bg-indigo-500" },
                    { label: "Completion",   value: riderD.r_breakdown.cr, color: "bg-brand-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
                      <MiniBar value={value} color={color} />
                      <span className="text-[10px] text-white font-medium w-8 text-right">{(value * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Premium discount", value: tier.disc,     icon: <Wallet size={16} className="mb-1 mx-auto text-gray-400" /> },
                { label: "Max coverage",     value: tier.coverage, icon: <Shield size={16} className="mb-1 mx-auto text-gray-400" /> },
                { label: "Payout speed",     value: tier.payout,   icon: <Zap size={16} className="mb-1 mx-auto text-gray-400" /> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-dark-900/50 rounded-xl p-2.5 text-center">
                  {icon}
                  <p className={`text-xs font-bold ${tier.color}`}>{value}</p>
                  <p className="text-[9px] text-gray-600 leading-tight mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {tier.next && (
              <div className="flex items-center gap-2 bg-dark-900/40 rounded-xl px-3 py-2">
                <Lock size={11} className="text-gray-600 shrink-0" />
                <p className="text-[11px] text-gray-500">{tier.next}</p>
              </div>
            )}
            {isNew && (
              <p className="text-[11px] text-gray-500 text-center">
                Complete 3 weeks to unlock your personal score and tier benefits
              </p>
            )}
          </div>

          {/* ── VALUE SUMMARY ── */}
          <div className="bg-dark-800/60 border border-dark-700/50 rounded-2xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Your financial summary</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-dark-900/60 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Total secured</p>
                <p className="text-xl font-display font-black text-brand-400">₹{totalReceived.toFixed(0)}</p>
                <p className="text-[10px] text-gray-600">payouts received</p>
              </div>
              <div className="bg-dark-900/60 rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-1">Premiums paid</p>
                <p className="text-xl font-display font-black text-white">₹{premiumPaid.toFixed(0)}</p>
                <p className="text-[10px] text-gray-600">{weeks}w of coverage</p>
              </div>
            </div>
            {roi !== null && totalReceived > 0 ? (
              <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2">
                <TrendingUp size={13} className="text-brand-400 shrink-0" />
                <p className="text-[11px] text-brand-400 font-semibold">
                  You've recovered {roi}% of premiums paid in payouts
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-600 text-center">No payouts yet — your coverage is standing by</p>
            )}
          </div>

          {/* ── MENU SECTIONS ── */}
          {menuSections.map(({ title, items }) => (
            <div key={title}>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 px-1">{title}</p>
              <div className="space-y-1.5">
                {items.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between bg-dark-800/60 border border-dark-700/50 rounded-xl px-4 py-3 transition-all group ${
                      item.action ? "hover:border-dark-500 hover:bg-dark-800 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg bg-dark-900/60 ${item.color}`}>
                        <item.icon size={14} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white">{item.label}</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[170px]">{item.value}</p>
                      </div>
                    </div>
                    {item.action && <ChevronRight size={13} className="text-gray-600 group-hover:text-white transition-colors" />}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* ── LOGOUT ── */}
          <button
            onClick={() => { logout(); navigate("/") }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 active:scale-[0.98] transition-all font-semibold text-sm"
          >
            <LogOut size={16} /> Sign out
          </button>

          <p className="text-center text-[10px] text-gray-700 font-mono pb-4">VERO v1.0 · Parametric income protection</p>
        </div>
      </div>
    </div>
  )
}
