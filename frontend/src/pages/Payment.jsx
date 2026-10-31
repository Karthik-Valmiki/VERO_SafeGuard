import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { getQuote, getMyDashboard, createRazorpayOrder, verifyRazorpayPayment, purchasePolicy } from "../api"
import { Shield, CheckCircle, Loader2, Info, Zap, MapPin, ArrowLeft } from "lucide-react"

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
        setError("Razorpay failed to load. Check your network connection.")
        setStatus("idle")
        return
      }

      await new Promise((resolve, reject) => {
        new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: "VERO SafeGuard",
          description: `Weekly coverage — ${order.coverage_pct}% · ${order.rider_name}`,
          order_id: order.order_id,
          prefill: { name: order.rider_name },
          theme: { color: "#e8a030" },
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
        setError(e.response?.data?.detail || "Payment transaction could not be completed.")
        setStatus("idle")
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-ink-900">
        <Loader2 className="animate-spin text-ink-400" size={28} />
      </div>
    )
  }

  // Activating / Success countdown state
  if (status === "success") {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-ink-900 text-ink-100 relative">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <div className="text-5xl font-mono font-semibold text-accent-400 mb-6">
            {countdown}s
          </div>
          <h1 className="text-2xl font-semibold text-ink-100 mb-2">Activating policy</h1>
          <p className="text-ink-400 text-xs max-w-[280px] leading-relaxed mb-6">
            Payment verified. Your 7-day parametric protection will be live within this countdown.
          </p>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-600 text-xs text-ink-300">
            <Loader2 className="animate-spin" size={13} />
            <span>Telemetry synchronizing</span>
          </div>

          <p className="mt-8 text-xs text-ink-400 max-w-[280px]">
            Demo mode active: fast-track activation in {countdown}s.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-ink-900 flex flex-col text-ink-100 relative">
      {/* Header */}
      <div className="px-5 pt-8 pb-3 border-b border-ink-600/70 bg-ink-950/95">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-accent-500" />
          <h1 className="text-xl font-semibold text-ink-100">Confirm policy purchase</h1>
        </div>
        <p className="text-xs text-ink-400 mt-1">Zone-calibrated premium · Powered by Razorpay</p>
      </div>

      <div className="flex-1 px-5 py-4 pb-24 space-y-4 overflow-y-auto max-w-md mx-auto w-full">
        {/* Pricing card */}
        <div className="card">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs text-ink-400">Weekly premium</p>
            <div className="flex items-center gap-1 text-xs text-positive font-medium">
              <MapPin size={11} />
              {quote?.zone_name || "—"}
            </div>
          </div>

          <div className="flex items-baseline gap-1 my-3">
            <span className="text-ink-400 text-xl font-mono">₹</span>
            <span className="text-5xl font-mono font-semibold text-ink-100 tracking-tight">
              {quote ? quote.premium : "--"}
            </span>
            <span className="text-ink-400 text-xs ml-1.5">/ week</span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-3 border-t border-ink-600/60 my-2">
            <div>
              <p className="text-xs text-ink-400 mb-0.5">Cap</p>
              <p className="text-base font-mono font-semibold text-ink-100">₹{quote?.weekly_cap || "0"}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-ink-400 mb-0.5">Coverage</p>
              <p className="text-base font-mono font-semibold text-accent-400">{quote?.coverage_pct}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400 mb-0.5">Zone risk</p>
              <p className="text-base font-mono font-semibold text-ink-100">{quote?.zone_risk_multiplier?.toFixed(2)}×</p>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 text-xs text-ink-400 border-t border-ink-600/60">
            <Info size={13} className="text-accent-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Premium based on your zone's risk multiplier ({quote?.zone_risk_multiplier?.toFixed(2)}×).
            </p>
          </div>
        </div>

        {/* Covered features */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-400 px-1">Included in coverage</p>
          <div className="bg-ink-800 border border-ink-600 rounded-2xl p-4 space-y-3">
            {[
              ["Automated disruption coverage", "Severe rain, toxic AQI spikes, app blackouts, civic bandhs"],
              ["Zero-touch claims", "No documentation — payouts trigger automatically"],
              ["Instant UPI disbursements", "Transferred directly in 30-minute intervals"],
              ["7-day active protection", `168 hours of coverage · up to ₹${quote?.weekly_cap || "0"} weekly cap`],
            ].map(([title, desc], i, arr) => (
              <div key={title} className={`flex items-start gap-2.5 ${i < arr.length - 1 ? "pb-3 border-b border-ink-600/50" : ""}`}>
                <CheckCircle size={14} className="text-positive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-ink-100">{title}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-negative/10 border border-negative/20 text-xs text-negative">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handlePay}
            disabled={status !== "idle" || !quote}
            className="btn-primary py-3.5"
          >
            {status === "paying" ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Pay ₹{quote?.premium} for 7 days</span>
              </>
            )}
          </button>

          <div className="mt-4 p-3.5 bg-ink-800 border border-ink-600 rounded-xl space-y-1">
            <p className="text-xs font-medium text-ink-300">
              Demo test environment
            </p>
            <p className="text-xs text-ink-400 leading-relaxed">
              Mock checkout enabled. Card: <span className="font-mono text-ink-200">4111 1111 1111 1111</span> with any future expiry date and CVV.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
