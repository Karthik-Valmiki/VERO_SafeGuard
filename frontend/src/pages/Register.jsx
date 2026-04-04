import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { sendOtp, verifyOtp, register } from "../api"
import { ArrowLeft, Phone, ShieldCheck, User, CheckCircle } from "lucide-react"

const CITIES    = ["Bengaluru","Chennai","Mumbai","Delhi","Gurgaon","Hyderabad","Vizag","Pune","Kolkata","Ahmedabad"]
const PLATFORMS = ["Zomato","Swiggy"]
const STEP_LABELS = ["Phone","Verify","Details"]

// ── OTP Toast ─────────────────────────────────────────────────────────────────
function OtpToast({ otp, visible }) {
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[999] transition-all duration-500 ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
    }`}>
      <div className="flex items-center gap-3 bg-dark-800 border border-brand-500/40 rounded-2xl px-5 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Demo OTP</p>
          <p className="font-display text-xl font-bold text-brand-400 tracking-[0.3em]">{otp}</p>
        </div>
      </div>
    </div>
  )
}

export default function Register() {
  const { saveRider } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [toastVisible, setToastVisible] = useState(false)

  const [phone, setPhone] = useState("")
  const [otp, setOtp]     = useState("")
  const [form, setForm]   = useState({
    name: "", password: "", platform: "Zomato",
    city: "Mumbai", shift_start: "09:00", shift_end: "21:00", upi_id: "",
  })

  const err = (msg) => { setError(msg); setLoading(false) }

  const showToast = (code) => {
    setOtpCode(code); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 5000)
  }

  const handleSendOtp = async () => {
    let p = phone.trim()
    if (p && !p.startsWith("+")) p = "+91" + p
    if (!/^\+91\d{10}$/.test(p)) return err("Enter a valid 10-digit number")
    setPhone(p); setLoading(true); setError("")
    try {
      const res = await sendOtp(p)
      showToast(res.data.otp_code)
      setStep(1)
    } catch (e) { err(e.response?.data?.detail || "Failed to send OTP") }
    setLoading(false)
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return err("Enter the 6-digit OTP")
    setLoading(true); setError("")
    try {
      await verifyOtp(phone, otp); setStep(2)
    } catch (e) { err(e.response?.data?.detail || "Invalid OTP") }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!form.name || !form.password || !form.upi_id) return err("Fill all fields")
    if (form.password.length < 8) return err("Password must be at least 8 characters")
    setLoading(true); setError("")
    try {
      const res = await register({ ...form, phone_number: phone, otp_code: otp })
      saveRider(res.data); navigate("/dashboard")
    } catch (e) { err(e.response?.data?.detail || "Registration failed") }
    setLoading(false)
  }

  // Steps 0 & 1 are short — center them. Step 2 has many fields — scroll.
  const isShortStep = step < 2

  return (
    <div className={`flex flex-col min-h-full px-5 relative overflow-x-hidden ${isShortStep ? "overflow-y-hidden" : "overflow-y-auto"}`}>
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none" />

      <OtpToast otp={otpCode} visible={toastVisible} />

      {/* Back */}
      <div className="relative z-10 pt-4 pb-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
      </div>

      {/* Content — centered for short steps, top-aligned with padding for step 2 */}
      <div className={`relative z-10 w-full max-w-sm mx-auto ${isShortStep ? "flex-1 flex flex-col justify-center" : "py-4"}`}>

        {/* Logo + title */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-brand-500" />
            <span className="font-display text-2xl font-black tracking-tight">VERO</span>
          </div>
          <h1 className="text-lg font-bold mb-0.5">Create your account</h1>
          <p className="text-gray-500 text-xs">Get covered in under 2 minutes.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-5">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                i < step ? "bg-brand-500 text-black" : i === step ? "bg-brand-500 text-black" : "bg-dark-700 text-gray-600"
              }`}>
                {i < step ? <CheckCircle size={12} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium transition-colors ${i === step ? "text-white" : "text-gray-600"}`}>{label}</span>
              {i < 2 && <div className={`w-5 h-px mx-1 ${i < step ? "bg-brand-500" : "bg-dark-600"}`} />}
            </div>
          ))}
        </div>

        <div className="card space-y-3">

          {/* STEP 0 — Phone */}
          {step === 0 && (
            <>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-brand-500" />
                <p className="font-semibold text-sm">Enter your phone number</p>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none border-r border-dark-600/60 pr-3">
                  <span className="text-gray-400 font-bold text-sm">+91</span>
                </div>
                <input
                  className="input-field pl-16 tracking-[0.15em] font-bold placeholder:tracking-normal placeholder:font-normal"
                  placeholder="9876543210" type="tel" maxLength={10}
                  value={phone.replace("+91", "")}
                  onChange={e => setPhone("+91" + e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                />
              </div>
              <p className="text-[11px] text-gray-600">We'll send a 6-digit OTP to verify.</p>
              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
              <button className="btn-primary" onClick={handleSendOtp} disabled={loading}>
                {loading ? "Sending..." : "Send OTP →"}
              </button>
            </>
          )}

          {/* STEP 1 — OTP */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-brand-500" />
                <p className="font-semibold text-sm">Enter the OTP</p>
              </div>
              <p className="text-[11px] text-gray-500">Sent to {phone}. Check the notification above.</p>
              <input
                className="input-field text-center text-2xl tracking-[0.4em] font-bold"
                placeholder="------" maxLength={6} value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
              <button className="btn-primary" onClick={handleVerifyOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP →"}
              </button>
              <button className="btn-ghost text-xs py-2.5" onClick={() => { setStep(0); setError("") }}>
                ← Change number
              </button>
            </>
          )}

          {/* STEP 2 — Details */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2">
                <User size={14} className="text-brand-500" />
                <p className="font-semibold text-sm">Your details</p>
              </div>
              <input className="input-field" placeholder="Full name"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder="Password (min 8 chars)" type="password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <input className="input-field" placeholder="UPI ID  e.g. 9876543210@upi"
                value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-widest">Platform</label>
                  <select className="input-field" value={form.platform}
                    onChange={e => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-widest">City</label>
                  <select className="input-field" value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-widest">Shift start</label>
                  <input className="input-field" type="time" value={form.shift_start}
                    onChange={e => setForm({ ...form, shift_start: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-widest">Shift end</label>
                  <input className="input-field" type="time" value={form.shift_end}
                    onChange={e => setForm({ ...form, shift_end: e.target.value })} />
                </div>
              </div>
              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
              <button className="btn-primary" onClick={handleRegister} disabled={loading}>
                {loading ? "Creating account..." : "Create account →"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4 pb-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-500 hover:text-brand-400 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  )
}
