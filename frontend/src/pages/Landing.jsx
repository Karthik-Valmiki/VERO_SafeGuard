import { useNavigate, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { Shield, CloudRain, Wifi, AlertTriangle, ArrowRight } from "lucide-react"

// ── Typewriter hook ──────────────────────────────────────────────────────────
const PHRASES = [
  "you still get paid.",
  "VERO covers you.",
  "money hits your UPI.",
  "no forms, no waiting.",
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
  { icon: CloudRain, label: "Heavy rain", desc: "Roads unsafe. Orders dry up. You lose hours." },
  { icon: AlertTriangle, label: "Toxic air (AQI)", desc: "Unhealthy conditions. Delivery pace slows to a crawl." },
  { icon: Wifi, label: "App outage", desc: "Swiggy or Zomato down at peak dinner. Zero incoming orders." },
  { icon: Shield, label: "Bandh & shutdown", desc: "Local commercial curfew. Restaurants shutter doors." },
]

const HOW_STEPS = [
  { n: "01", title: "Sign up in 2 minutes", desc: "Phone OTP verification. Select your city and delivery platform." },
  { n: "02", title: "Pay ₹50–90 / week", desc: "Calibrated directly to your delivery zone's real-time risk profile." },
  { n: "03", title: "Ride normally", desc: "Continuous automated monitoring of environmental and platform disruption." },
  { n: "04", title: "Automated UPI credit", desc: "Disruption verified → automated payouts every 30 minutes without filing a claim." },
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
    <div className="min-h-screen bg-ink-900 text-ink-100 overflow-x-hidden relative flex flex-col">
      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 text-center max-w-lg mx-auto w-full pt-12 pb-8">
        <p className="text-xs font-medium text-ink-400 mb-4 animate-fade-in">
          For Zomato &amp; Swiggy riders
        </p>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.15] tracking-tight mb-3 animate-fade-up">
          Bad day on the road?
        </h1>

        {/* Dynamic line */}
        <div className="text-xl sm:text-2xl font-medium text-accent-400 mb-3 min-h-[32px] flex items-center justify-center">
          <span>{typed}</span>
          <span className="inline-block w-0.5 h-5 bg-accent-500 ml-1.5 opacity-80" />
        </div>

        <p className="text-ink-400 text-sm max-w-[320px] leading-relaxed mb-8">
          Automated income protection. Direct UPI compensation when disruptions stop work.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate("/register")}
            className="btn-primary"
          >
            <span>Get covered — from ₹50/wk</span>
            <ArrowRight size={15} />
          </button>
          <Link
            to="/login"
            className="btn-ghost"
          >
            Log in to my account
          </Link>
        </div>

        {/* Trust metadata */}
        <p className="mt-8 text-xs text-ink-400">
          Weekly policy · Zero forms · Instant UPI settlement
        </p>
      </section>

      {/* ── WHAT WE COVER ── */}
      <section className="px-5 pb-12 max-w-md mx-auto w-full">
        <h2 className="text-xs font-medium text-ink-400 mb-3 text-center">
          Covered disruptions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {TRIGGERS.map(({ icon: Icon, label, desc }, i) => (
            <div
              key={label}
              className="bg-ink-800 border border-ink-600 rounded-2xl p-4 reveal"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <Icon size={18} className="text-ink-300 mb-2.5" />
              <p className="text-ink-100 text-xs font-semibold mb-1">{label}</p>
              <p className="text-ink-400 text-[11px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-5 pb-12 max-w-md mx-auto w-full">
        <h2 className="text-xs font-medium text-ink-400 mb-4 text-center">
          How it works
        </h2>
        <div className="relative">
          {/* subtle line */}
          <div className="absolute left-5 top-4 bottom-4 w-px bg-ink-600" />
          <div className="space-y-4">
            {HOW_STEPS.map(({ n, title, desc }, i) => (
              <div
                key={n}
                className="flex items-start gap-4 reveal"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-ink-800 border border-ink-600 flex items-center justify-center z-10">
                  <span className="text-accent-400 font-mono font-medium text-xs">{n}</span>
                </div>
                <div className="pt-1.5">
                  <p className="text-ink-100 text-sm font-medium">{title}</p>
                  <p className="text-ink-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="px-5 pb-14 max-w-md mx-auto w-full reveal">
        <div className="bg-ink-800 border border-ink-600 rounded-2xl p-6 text-center">
          <p className="text-ink-100 font-semibold text-base mb-1">Start for ₹50 this week</p>
          <p className="text-ink-400 text-xs mb-5">Parametric coverage active across major metro delivery zones</p>
          <button
            onClick={() => navigate("/register")}
            className="btn-primary"
          >
            <span>Create account</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-ink-600/60 py-6 text-center text-ink-400 text-xs mt-auto">
        <div className="flex items-center justify-center gap-1.5 font-medium text-ink-300 mb-1">
          <Shield size={14} className="text-accent-500" />
          <span>VERO SafeGuard</span>
        </div>
        <p className="text-ink-400 text-[11px]">Parametric income protection for on-demand riders</p>
      </footer>

      <style>{`
        .reveal { opacity: 0; transform: translateY(12px); transition: opacity 0.4s ease, transform 0.4s ease; }
        .revealed { opacity: 1 !important; transform: translateY(0) !important; }
      `}</style>
    </div>
  )
}
