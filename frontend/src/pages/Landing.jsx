import { useNavigate, Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { Shield, CloudRain, Wifi, AlertTriangle, ArrowRight } from "lucide-react"

// ── Typewriter hook ──────────────────────────────────────────────────────────
const PHRASES = [
  "you still get paid.",
  "VERO covers you.",
  "money hits your UPI.",
  "no forms. no waiting.",
]

function useTypewriter(phrases, speed = 60, pause = 1800) {
  const [display, setDisplay] = useState("")
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = phrases[phraseIdx]
    let timeout

    if (!deleting && display === current) {
      timeout = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && display === "") {
      setDeleting(false)
      setPhraseIdx(i => (i + 1) % phrases.length)
    } else {
      timeout = setTimeout(() => {
        setDisplay(prev =>
          deleting ? prev.slice(0, -1) : current.slice(0, prev.length + 1)
        )
      }, deleting ? speed / 2 : speed)
    }
    return () => clearTimeout(timeout)
  }, [display, deleting, phraseIdx, phrases, speed, pause])

  return display
}

const TRIGGERS = [
  { icon: CloudRain, label: "Heavy Rain", desc: "Roads unsafe. Orders dry up. You lose hours.", color: "text-blue-400", border: "border-blue-500/20" },
  { icon: AlertTriangle, label: "Toxic Air (AQI)", desc: "Every breath hurts. Delivery speed collapses.", color: "text-orange-400", border: "border-orange-500/20" },
  { icon: Wifi, label: "App Outage", desc: "Swiggy or Zomato down at 8pm. Zero orders possible.", color: "text-indigo-400", border: "border-indigo-500/20" },
  { icon: Shield, label: "Bandh & Shutdown", desc: "Announced overnight. Every restaurant shuts.", color: "text-rose-400", border: "border-rose-500/20" },
]

const HOW_STEPS = [
  { n: "1", title: "Sign up in 2 min", desc: "Phone OTP. Pick your city and platform." },
  { n: "2", title: "Pay ₹50–90 / week", desc: "Less than a meal. Priced to your zone's actual risk." },
  { n: "3", title: "Ride like normal", desc: "We watch for disruptions 24/7. You do nothing." },
  { n: "4", title: "Money hits your UPI", desc: "Disruption confirmed → payout every 30 min. No claim. No call." },
]

export default function Landing() {
  const navigate = useNavigate()
  const typed = useTypewriter(PHRASES)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("revealed") }),
      { threshold: 0.1 }
    )
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 text-white overflow-x-hidden relative">
      {/* Grid bg */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none" />
      {/* Purple glow top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand-600/20 blur-[80px] rounded-full pointer-events-none" />

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[88vh] px-6 text-center">
        {/* pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-medium mb-6 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          For Zomato &amp; Swiggy riders
        </div>

        {/* Big headline */}
        <h1 className="font-display text-4xl font-black leading-[1.1] tracking-tight mb-3 animate-fade-up">
          Bad day on the road?
        </h1>

        {/* Typewriter line */}
        <p className="text-xl font-semibold text-brand-400 mb-1 animate-fade-up min-h-[28px]" style={{ animationDelay: "0.1s" }}>
          {typed}
          <span className="inline-block w-0.5 h-[0.9em] bg-brand-500 ml-1 align-middle animate-pulse" />
        </p>

        <p className="text-gray-400 text-sm max-w-[280px] leading-relaxed mb-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          VERO pays instantly. No forms. No waiting.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <button
            onClick={() => navigate("/register")}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all shadow-[0_0_24px_rgba(139,92,246,0.35)] active:scale-[0.98]"
          >
            Get covered — ₹50/week
            <ArrowRight size={15} />
          </button>
          <Link
            to="/login"
            className="flex items-center justify-center w-full py-3.5 border border-dark-600 bg-dark-800/60 hover:bg-dark-700 text-gray-300 hover:text-white font-medium rounded-xl text-sm transition-all"
          >
            Log in to my account
          </Link>
        </div>

        {/* trust line */}
        <p className="mt-6 text-xs text-gray-600 animate-fade-up" style={{ animationDelay: "0.4s" }}>
          Weekly plan · Cancel anytime · Works on Zomato &amp; Swiggy
        </p>
      </section>

      {/* ── WHAT WE COVER ── */}
      <section className="px-5 pb-8 max-w-md mx-auto">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 reveal opacity-0">
          What we cover
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {TRIGGERS.map(({ icon: Icon, label, desc, color, border }, i) => (
            <div
              key={label}
              className={`bg-dark-800/70 border ${border} rounded-2xl p-4 reveal opacity-0`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <Icon size={18} className={`${color} mb-2`} />
              <p className="text-white text-xs font-semibold mb-1">{label}</p>
              <p className="text-gray-500 text-[11px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-5 pb-10 max-w-md mx-auto">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 reveal opacity-0">
          How it works
        </h2>
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-5 top-3 bottom-3 w-px bg-dark-600" />
          <div className="space-y-4">
            {HOW_STEPS.map(({ n, title, desc }, i) => (
              <div
                key={n}
                className="flex items-start gap-4 reveal opacity-0"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-dark-800 border border-brand-500/30 flex items-center justify-center z-10">
                  <span className="text-brand-400 font-bold text-sm">{n}</span>
                </div>
                <div className="pt-2">
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="px-5 pb-12 max-w-md mx-auto reveal opacity-0">
        <div className="bg-gradient-to-br from-brand-600/20 to-dark-800 border border-brand-500/20 rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-base mb-1">Start for ₹50 this week</p>
          <p className="text-gray-400 text-xs mb-4">Join riders already protected across Delhi, Mumbai &amp; Bengaluru</p>
          <button
            onClick={() => navigate("/register")}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all active:scale-[0.98]"
          >
            Create free account →
          </button>
        </div>
      </section>

      <footer className="border-t border-dark-700/50 py-4 text-center text-gray-700 text-xs">
        <span className="flex items-center justify-center gap-1.5 text-gray-500 font-semibold mb-0.5">
          <Shield size={12} className="text-brand-500" /> VERO
        </span>
        Parametric income protection for India's delivery workforce
      </footer>

      <style>{`
        .reveal { opacity:0; transform:translateY(20px); transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1); }
        .revealed { opacity:1 !important; transform:translateY(0) !important; }
      `}</style>
    </div>
  )
}
