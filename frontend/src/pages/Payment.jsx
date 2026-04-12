import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { getQuote, getMyDashboard, createRazorpayOrder, verifyRazorpayPayment, purchasePolicy } from "../api"
import { Shield, CheckCircle, Loader2, Info, Zap, MapPin } from "lucide-react"

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    if (document.getElementById("razorpay-sdk")) {
      const check = setInterval(() => {
        if (window.Razorpay) { clearInterval(check); resolve(true) }
      }, 100)
      return
    }
    const s = document.createElement("script")
    s.id = "razorpay-sdk"
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function Payment() {
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(20)

  useEffect(() => {
    const load = async () => {
      try {
        const dRes = await getMyDashboard()
        const hasPolicy = ["ACTIVE", "PENDING"].includes(dRes.data?.policy?.status)
        if (hasPolicy) { navigate("/dashboard"); return }
        const qRes = await getQuote()
        setQuote(qRes.data)
      } catch (e) {
        if (e.response?.status === 401) navigate("/login")
        else setError("Unable to load quote. Check your connection.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [navigate])

  useEffect(() => {
    if (status !== "success") return
    if (countdown <= 0) { navigate("/dashboard"); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [status, countdown, navigate])

  const handlePay = useCallback(async () => {
    setStatus("paying")
    setError("")
    try {
      const orderRes = await createRazorpayOrder()
      const order = orderRes.data

      if (!order.razorpay_available || order.order_id === "mock_order_demo") {
        await purchasePolicy()
        setStatus("success")
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setError("Razorpay failed to load. Check your internet connection.")
        setStatus("idle")
        return
      }

      await new Promise((resolve, reject) => {
        new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: "VERO SafeGuard",
          description: `Weekly Income Protection — ${order.coverage_pct}% coverage · ${order.rider_name}`,
          order_id: order.order_id,
          prefill: { name: order.rider_name },
          theme: { color: "#7c3aed" },
          modal: { ondismiss: () => reject(new Error("dismissed")) },
          handler: async (response) => {
            try {
              await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
              resolve()
            } catch (err) {
              reject(err)
            }
          },
        }).open()
      })

      setStatus("success")
    } catch (e) {
      if (e.message === "dismissed") {
        setStatus("idle")
      } else {
        setError(e.response?.data?.detail || "Payment failed. Please try again.")
        setStatus("idle")
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-dark-900 overflow-hidden relative">
        <div className="absolute inset-0 bg-brand-500/5 animate-pulse" />
        <div className="z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-brand-500/10 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute -inset-4 bg-brand-500/20 blur-2xl rounded-full animate-pulse" />
            <div className="text-4xl font-display font-black text-brand-400 relative z-10">{countdown}s</div>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Activating...</h1>
          <p className="text-gray-400 text-center max-w-[280px] text-sm">
            Payment confirmed. Your 7-day protection will be live shortly.
          </p>
          <div className="mt-8 flex items-center gap-3 px-6 py-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest">
            <Loader2 className="animate-spin" size={14} />
            System Verification
          </div>
          <p className="mt-6 text-xs text-gray-500 text-center max-w-[300px]">
            <span className="text-brand-400 font-semibold">Demo Mode:</span> Activating in {countdown}s<br />
            <span className="text-gray-600">(Production: 24-hour fraud prevention window)</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-dark-900 flex flex-col text-white relative font-sans">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,#3b076444,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 bg-brand-500/20 rounded-2xl border border-brand-500/30">
            <Shield size={24} className="text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white">Confirm Coverage</h1>
        </div>
        <p className="text-gray-500 text-xs pl-0.5 opacity-70">Zone-based premium · Secured by Razorpay</p>
      </div>

      <div className="relative z-10 flex-1 px-6 pb-32 space-y-5 overflow-y-auto no-scrollbar pt-2">

        {/* Price card */}
        <div className="card !p-0 overflow-hidden bg-gradient-to-br from-dark-800/80 to-dark-900 border-white/5 shadow-2xl">
          <div className="p-6">
            <div className="flex justify-between items-start mb-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Weekly Premium</p>
              <div className="flex items-center gap-1 text-[11px] text-green-400 font-semibold">
                <MapPin size={11} />
                {quote?.zone_name || "—"}
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-gray-400 text-2xl font-display font-medium">₹</span>
              <h2 className="text-6xl font-display font-black text-white tracking-tighter">
                {quote ? quote.premium : "--"}
              </h2>
              <span className="text-gray-500 text-sm ml-1">/ week</span>
            </div>
            <div className="grid grid-cols-3 gap-3 py-4 border-t border-white/5">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Cap</p>
                <p className="text-lg font-display font-bold text-white">₹{quote?.weekly_cap || "0"}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Coverage</p>
                <p className="text-lg font-display font-bold text-brand-400">{quote?.coverage_pct}%</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Zone Risk</p>
                <p className="text-lg font-display font-bold text-yellow-400">{quote?.zone_risk_multiplier?.toFixed(2)}×</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-brand-500/5 rounded-xl border border-brand-500/10 mt-1">
              <Info size={13} className="text-brand-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-tight">
                Premium uses your <span className="text-white font-bold">zone's risk multiplier ({quote?.zone_risk_multiplier?.toFixed(2)}×)</span> — riders in lower-risk zones pay less for the same coverage.
              </p>
            </div>
          </div>
        </div>

        {/* What's covered */}
        <div className="space-y-2">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">What's covered</h3>
          <div className="space-y-2.5 bg-dark-800/50 border border-white/5 rounded-2xl p-4">
            {[
              ["Automated Disruption Coverage", "Weather, AQI, platform outages, bandhs"],
              ["Zero-Touch Claims", "No paperwork — payouts trigger automatically"],
              ["Instant UPI Payouts", "Compensation sent to your UPI in 30-min intervals"],
              ["7-Day Full Coverage", `168 hours · up to ₹${quote?.weekly_cap || "0"} weekly cap`],
            ].map(([title, desc], i, arr) => (
              <div key={title} className={`flex items-start gap-3 ${i < arr.length - 1 ? "pb-2.5 border-b border-white/5" : ""}`}>
                <CheckCircle size={15} className="text-brand-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-red-400 text-xs font-semibold">{error}</p>
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={handlePay}
            disabled={status !== "idle" || !quote}
            className="group relative w-full h-14 bg-brand-600 hover:bg-brand-500 disabled:bg-dark-800 text-white font-bold rounded-2xl transition-all duration-300 overflow-hidden active:scale-[0.98] shadow-[0_20px_50px_rgba(139,92,246,0.3)] disabled:shadow-none"
          >
            <div className="flex items-center justify-center gap-2.5 relative z-10 uppercase tracking-widest text-sm">
              {status === "paying" ? (
                <><Loader2 className="animate-spin" size={18} /> Opening Razorpay...</>
              ) : (
                <><Zap size={18} /> Pay ₹{quote?.premium} via Razorpay</>
              )}
            </div>
          </button>

          <div className="mt-4 flex flex-col items-center space-y-1.5 bg-brand-500/5 p-4 rounded-2xl border border-brand-500/10">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-400">
              <Shield size={11} className="text-brand-500 animate-pulse" />
              Instant 7-Day Protection
            </div>
            <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
              Activates in <span className="text-white">20 seconds</span> (demo).
              Production enforces a <span className="text-white">24-hour</span> fraud prevention window.
            </p>
            <p className="text-[10px] text-gray-600 text-center">
              Test card: <span className="text-gray-400 font-mono">4111 1111 1111 1111</span> · any future expiry · any CVV
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
