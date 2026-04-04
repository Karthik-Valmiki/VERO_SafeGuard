import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getQuote, purchasePolicy, getMyDashboard } from "../api"
import { Shield, Smartphone, CheckCircle, ArrowRight, Loader2, Info, Zap, Handshake, Calendar } from "lucide-react"

export default function Payment() {
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [dash, setDash] = useState(null)
  const [status, setStatus] = useState("idle") // idle, paying, success
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const fetchQuote = async () => {
    setQuoteLoading(true)
    try {
      const qRes = await getQuote()
      setQuote(qRes.data)
      setError("")
    } catch (e) {
      setError("Unable to generate quote. Check your city settings.")
    } finally {
      setQuoteLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const dRes = await getMyDashboard()
        setDash(dRes.data)
        
        // If policy exists and we're not in activation flow, redirect immediately
        const hasPolicy = dRes.data?.policy?.status === "ACTIVE" || dRes.data?.policy?.status === "PENDING"
        if (hasPolicy && status !== "success" && status !== "paying") {
          navigate("/dashboard")
          return
        }
        
        // Only fetch quote if policy isn't already active/pending
        if (!hasPolicy) {
          await fetchQuote()
        }
      } catch (e) {
        if (e.response?.status === 401) {
          navigate("/login")
        } else {
          // Only show error if we have NO data at all
          if (!dash) setError("Connection glitch. Trying to reconnect...")
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePay = async () => {
    setStatus("paying")
    try {
      await new Promise(r => setTimeout(r, 2200)) // Realistic simulation
      await purchasePolicy()
      setStatus("success")
      // Navigation handled by the success screen countdown
    } catch (e) {
      setError("Payment failed. Please check your connection.")
      setStatus("idle")
    }
  }

  const [countdown, setCountdown] = useState(20)
  
  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setInterval(() => setCountdown(p => p - 1), 1000)
      return () => clearInterval(timer)
    }
    if (status === "success" && countdown === 0) {
      setTimeout(() => navigate("/dashboard"), 500)
    }
  }, [status, countdown, navigate])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    )
  }

  // SUCCESS SCREEN (ONBOARDING TIMER)
  if (status === "success") {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-dark-900 overflow-hidden relative">
        <div className="absolute inset-0 bg-brand-500/5 animate-pulse" />
        <div className="z-10 flex flex-col items-center animate-fade-up">
          <div className="w-24 h-24 bg-brand-500/10 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute -inset-4 bg-brand-500/20 blur-2xl rounded-full animate-pulse" />
            <div className="text-4xl font-display font-black text-brand-400 relative z-10">{countdown}s</div>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Activating...</h1>
          <p className="text-gray-400 text-center max-w-[280px] text-sm">
            Verification layers are processing. Your 7-day protection will be live soon.
          </p>
          <div className="mt-8 flex items-center gap-3 px-6 py-3 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-widest">
             <Loader2 className="animate-spin" size={14} />
             System Verification
          </div>
          <p className="mt-6 text-xs text-gray-500 text-center max-w-[300px]">
            <span className="text-brand-400 font-semibold">Demo Mode:</span> Activating in {countdown}s<br/>
            <span className="text-gray-600">(Production: 24-hour fraud prevention window)</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-dark-900 flex flex-col text-white relative font-sans">
      {/* Background Polish */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,#3b076444,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-1 animate-fade-up">
          <div className="p-2.5 bg-brand-500/20 rounded-2xl border border-brand-500/30">
            <Shield size={24} className="text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white">Confirm Coverage</h1>
        </div>
        <p className="text-gray-500 text-xs pl-0.5 opacity-70 animate-fade-up delay-100">Review your automated protection details</p>
      </div>

      <div className="relative z-10 flex-1 px-6 pb-32 space-y-6 overflow-y-auto no-scrollbar pt-4">
        
        {/* Main Price Card */}
        <div className="card !p-0 overflow-hidden bg-gradient-to-br from-dark-800/80 to-dark-900 border-white/5 shadow-2xl animate-fade-up delay-200">
          <div className="p-8">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Weekly Premium</p>
              <span className="badge bg-green-500/10 text-green-400 border-green-500/20">Lowest Risk</span>
            </div>
            
            <div className="flex items-baseline gap-1.5 mb-8">
              <span className="text-gray-400 text-2xl font-display font-medium">₹</span>
              <h2 className="text-6xl font-display font-black text-white tracking-tighter">
                {quote ? quote.premium : "--"}
              </h2>
              <span className="text-gray-500 text-sm ml-1">/ week</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-6 border-t border-white/5">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Protection Cap</p>
                <p className="text-xl font-display font-bold text-white">₹{quote?.weekly_cap || "0"}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Coverage</p>
                <p className="text-xl font-display font-bold text-brand-400">{quote?.coverage_pct}%</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-brand-500/5 rounded-xl border border-brand-500/10">
              <Info size={14} className="text-brand-400 shrink-0" />
              <p className="text-[10px] text-gray-400 leading-tight">
                Your premium is adjusted based on your <span className="text-white font-bold">Reliability Score (R)</span> and zone risk.
              </p>
            </div>
          </div>
        </div>

        {/* Coverage Policy Details */}
        <div className="space-y-4 animate-fade-up delay-300">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">Protection Policy</h3>
          
          <div className="space-y-3 bg-dark-800/50 border border-white/5 rounded-2xl p-5">
            <div className="flex items-start gap-3 pb-3 border-b border-white/5">
              <CheckCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">Automated Disruption Coverage</p>
                <p className="text-gray-400 text-xs mt-1">Protection against weather, AQI, platform outages, and social disruptions</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 pb-3 border-b border-white/5">
              <CheckCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">Zero-Touch Claims</p>
                <p className="text-gray-400 text-xs mt-1">No paperwork required - payouts triggered automatically via API</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 pb-3 border-b border-white/5">
              <CheckCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">Instant UPI Payouts</p>
                <p className="text-gray-400 text-xs mt-1">Compensation sent directly to your linked UPI within seconds</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">7-Day Full Coverage</p>
                <p className="text-gray-400 text-xs mt-1">168 hours of continuous protection with up to ₹{quote?.weekly_cap || "0"} weekly cap</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-3 animate-fade-up delay-400">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">Payment Method</h3>
          <div className="group relative overflow-hidden bg-brand-500/5 border-2 border-brand-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:bg-brand-500/10">
            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
              <Smartphone size={40} className="text-brand-400" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-dark-900 border border-brand-500/30 rounded-xl flex items-center justify-center text-brand-400">
                <Smartphone size={24} />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">UPI (Instant Activation)</p>
                <p className="text-brand-400/60 text-[10px] font-mono">shrih...@ybl</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-brand-500 flex items-center justify-center">
                <div className="w-3 h-3 bg-brand-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-red-400 text-xs font-semibold">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handlePay}
            disabled={status !== "idle" || !quote}
            className="group relative w-full h-16 bg-brand-600 hover:bg-brand-500 disabled:bg-dark-800 text-white font-bold rounded-2xl transition-all duration-500 overflow-hidden active:scale-[0.98] shadow-[0_20px_50px_rgba(139,92,246,0.3)] disabled:shadow-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            <div className="flex items-center justify-center gap-3 relative z-10 uppercase tracking-widest text-sm">
              {status === "paying" ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Activating Protection...
                </>
              ) : quoteLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Calculating Premium...
                </>
              ) : !quote ? (
                <>
                  <Shield size={20} />
                  Activate Protection
                </>
              ) : (
                <>
                  <Shield size={20} />
                  Activate Protection - ₹{quote.premium}
                </>
              )}
            </div>
          </button>

          <div className="mt-6 flex flex-col items-center space-y-2 opacity-100 backdrop-blur-sm bg-brand-500/5 p-4 rounded-2xl border border-brand-500/10">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-400">
              <Shield size={12} className="text-brand-500 animate-pulse" />
              Instant 7-Day Protection
            </div>
            <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed font-medium">
              Activates in <span className="text-white">20 seconds</span> (demo). 
              Covers you for <span className="text-white">full 168 hours</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
