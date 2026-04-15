/**
 * Register.jsx — DPDP 2023-compliant 5-phase onboarding
 *
 * Collects rider data before showing consent screens (DPDP §5 — purpose
 * limitation requires the data subject to understand what they're consenting to).
 *
 * Checkbox event isolation: onClick lives exclusively on the <button>, never on
 * a parent wrapper. A wrapper + child both firing onChange causes a double-toggle
 * that cancels itself — visually the checkbox appears stuck. The label text is
 * wired to onChange via a sibling <div> to avoid that bubbling path entirely.
 *
 * API surface:
 *   POST /auth/otp/send    — generates and surfaces OTP for demo mode
 *   POST /auth/otp/verify  — validates before any PII is written to DB
 *   POST /auth/upi/verify  — simulated NPCI penny-drop, returns KYC metadata
 *   POST /auth/register    — atomic: profile + zone assignment + activity seed
 */

import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { ShieldCheck, ArrowLeft, Eye, EyeOff, Loader, CheckCircle2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { sendOtp, verifyOtp, register, getZonesByCity, verifyUpi } from "../api"
import ConsentModal from "../components/ConsentModal"

// ── Config ────────────────────────────────────────────────────────────────────
const CITIES    = ["Bengaluru","Chennai","Mumbai","Delhi","Gurgaon","Hyderabad","Vizag","Pune","Kolkata","Ahmedabad"]
const PLATFORMS = ["Zomato","Swiggy"]
const STEP_LABELS = ["Phone","OTP","Details","Consent","UPI"]

// Renders a WAI-ARIA checkbox. Click handler is isolated to the button element only — see file header for why.
function Checkbox({ checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}       // ← ONLY here, no parent div onClick
      className={`
        w-5 h-5 rounded-[4px] border-2 flex-shrink-0 flex items-center justify-center
        transition-all duration-150
        ${checked
          ? "bg-brand-500 border-brand-500"
          : "bg-transparent border-dark-500 hover:border-brand-500/60"}
      `}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// Consent row: the outer wrapper is click-inert. Only the <Checkbox> button and the label <div> fire onChange independently, preventing event stacking.
function ConsentItem({ id, checked, onChange, label, desc, extra }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-dark-600/50 last:border-0">
      {/* Checkbox button — sole click handler */}
      <div className="pt-[1px]">
        <Checkbox checked={checked} onChange={onChange} />
      </div>
      {/* Clicking the text also toggles — separate sibling, no bubbling conflict */}
      <div className="flex-1 cursor-pointer select-none" onClick={onChange}>
        <p className="text-xs font-semibold text-gray-200 leading-snug">{label}</p>
        {desc && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>}
        {extra && (
          <div className="mt-1" onClick={e => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>
    </div>
  )
}

// Surfaces the demo OTP visually since there is no real SMS gateway in this environment.
function OtpToast({ code, visible }) {
  return (
    <div className={`
      fixed top-4 left-1/2 -translate-x-1/2 z-[999]
      transition-all duration-400
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}
    `}>
      <div className="flex items-center gap-3 bg-dark-800 border border-brand-500/40
                      rounded-2xl px-5 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse shrink-0" />
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Demo OTP</p>
          <p className="font-display text-xl font-bold text-brand-400 tracking-[0.3em]">{code}</p>
        </div>
      </div>
    </div>
  )
}

// Progress indicator — active dot expands to pill shape, completed dots dim to 40% opacity.
function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`
            rounded-full transition-all duration-300
            ${i === step ? "w-6 h-2 bg-brand-500" :
              i <  step  ? "w-2 h-2 bg-brand-500/40" :
                           "w-2 h-2 bg-dark-600"}
          `} />
        </div>
      ))}
    </div>
  )
}

// Inline SVG to avoid an image request. Colours (#E84D31, #1A237E) are NPCI brand spec.
function UpiLogo() {
  return (
    <div className="inline-flex items-center gap-2">
      <svg viewBox="0 0 54 22" width="54" height="22" fill="none">
        <path d="M4 11 L11 3 L18 11 L11 19Z" fill="#E84D31" />
        <path d="M14 11 L21 3 L28 11 L21 19Z" fill="#1A237E" />
        <text x="32" y="15.5" fill="#E84D31" fontSize="13" fontWeight="800"
              fontFamily="Arial, sans-serif" letterSpacing="0.5">UPI</text>
      </svg>
      <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">via NPCI</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Register() {
  const { saveRider } = useAuth()
  const navigate      = useNavigate()
  const [step, setStep] = useState(0)

  // Step 0 — phone
  const [phone, setPhone] = useState("")

  // Step 1 — OTP
  const [otp,          setOtp]          = useState("")
  const [otpCode,      setOtpCode]      = useState("")
  const [toastVisible, setToastVisible] = useState(false)

  // Step 2 — details
  const [form, setForm] = useState({
    name: "", password: "", platform: "Zomato",
    city: "Mumbai", zone_id: "", shift_start: "09:00", shift_end: "21:00",
  })
  const [showPass,     setShowPass]     = useState(false)
  const [zones,        setZones]        = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)

  // Step 3 — DPDP consent (all 5 must be true)
  const [gps, setGps] = useState({ zone: false, claims: false, oracle: false })
  const [dsa, setDsa] = useState({ data: false, read: false })
  const [showDsaModal, setShowDsaModal] = useState(false)
  const allConsented = [...Object.values(gps), ...Object.values(dsa)].every(Boolean)
  const remaining    = [...Object.values(gps), ...Object.values(dsa)].filter(v => !v).length

  // UPI identity — "number" mode pre-fills the verified mobile, "username" accepts a raw VPA.
  // verifiedUpi is the canonical value sent to /auth/register, locked after penny-drop.
  const [upiType,    setUpiType]    = useState("number")
  const [upiId,      setUpiId]      = useState("")
  const [upiPhone,   setUpiPhone]   = useState("")
  const [upiExt,     setUpiExt]     = useState("@paytm")
  const [upiKyc,     setUpiKyc]     = useState(null)
  const [upiAuth,    setUpiAuth]    = useState(false)
  const [upiLoading, setUpiLoading] = useState(false)
  const [verifiedUpi, setVerifiedUpi] = useState("")

  // Shared
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const setErr   = (m) => { setError(m); setLoading(false) }
  const clearErr = ()  => setError("")
  const back     = ()  => step > 0 ? (setStep(s => s - 1), clearErr()) : navigate("/")

  const showToast = (code) => {
    setOtpCode(code); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 5000)
  }

  const fetchZones = async (city) => {
    setZonesLoading(true)
    try { const r = await getZonesByCity(city); setZones(r.data.zones || []); setForm(f => ({ ...f, zone_id: "" })) }
    catch { setZones([]) }
    finally { setZonesLoading(false) }
  }

  // ── Step handlers ──────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const d = phone.replace(/\D/g, ""), p = `+91${d.slice(-10)}`
    if (!/^\+91\d{10}$/.test(p)) return setErr("Enter a valid 10-digit number")
    setPhone(p); setLoading(true); clearErr()
    try { const r = await sendOtp(p); showToast(r.data.otp_code); setStep(1) }
    catch (e) { setErr(e.response?.data?.detail || "Failed to send OTP") }
    finally   { setLoading(false) }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return setErr("Enter the 6-digit OTP")
    setLoading(true); clearErr()
    try { await verifyOtp(phone, otp); setStep(2) }
    catch (e) { setErr(e.response?.data?.detail || "Incorrect OTP") }
    finally   { setLoading(false) }
  }

  const handleDetailsNext = () => {
    if (!form.name.trim())        return setErr("Enter your full name")
    if (form.password.length < 8) return setErr("Password must be at least 8 characters")
    if (!form.zone_id)            return setErr("Select your delivery zone")
    clearErr(); setStep(3)
  }

  const handleConsentNext = () => {
    if (!allConsented) return setErr(`${remaining} permission${remaining > 1 ? "s" : ""} still unchecked`)
    clearErr(); setStep(4)
  }

  const handleVerifyUpi = async () => {
    const finalUpi = upiType === "number" 
      ? `${upiPhone || phone.replace(/\D/g, "").slice(-10)}${upiExt}` 
      : upiId.trim()

    if (upiType === "username" && (!finalUpi || !finalUpi.includes("@"))) return setErr("Enter a valid UPI ID (e.g. name@bank)")
    if (upiType === "number" && finalUpi.split("@")[0].length !== 10) return setErr("Enter a valid 10-digit mobile number")

    setUpiLoading(true); clearErr()
    try { const r = await verifyUpi(finalUpi); setUpiKyc(r.data); setUpiAuth(true); setVerifiedUpi(finalUpi) }
    catch (e) { setErr(e.response?.data?.detail || "UPI verification failed. Check the details.") }
    finally   { setUpiLoading(false) }
  }

  const handleRegister = async () => {
    if (!upiKyc)  return setErr("Verify your UPI ID first")
    if (!upiAuth) return setErr("Authorise payout access to continue")
    setLoading(true); clearErr()
    try {
      const r = await register({
        name: form.name.trim(), phone_number: phone, otp_code: otp,
        password: form.password, platform: form.platform, city: form.city,
        zone_id: parseInt(form.zone_id), shift_start: form.shift_start,
        shift_end: form.shift_end, upi_id: verifiedUpi,
      })
      saveRider(r.data); navigate("/dashboard")
    } catch (e) { setErr(e.response?.data?.detail || "Registration failed") }
    finally     { setLoading(false) }
  }

  // ── Layout — matches Login exactly ────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full px-5 relative overflow-hidden">

      {/* Grid background — identical to Login */}
      <div className="absolute inset-0 z-0
        bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)]
        bg-[size:24px_24px]
        [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_60%,transparent_100%)]
        pointer-events-none" />

      <OtpToast code={otpCode} visible={toastVisible} />
      {showDsaModal && <ConsentModal platform={form.platform} onClose={() => setShowDsaModal(false)} />}

      {/* Back link — identical position to Login */}
      <div className="relative z-10 pt-4 pb-2">
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors"
        >
          <ArrowLeft size={13} /> {step > 0 ? "Back" : "Back"}
        </button>
      </div>

      {/* Scroll wrapper for tall steps, centred wrapper for short ones */}
      <div className={`relative z-10 flex-1 flex flex-col py-2 ${step < 2 ? "items-center justify-center" : ""}`}>
        <div className="w-full max-w-sm mx-auto">

          {/* VERO logo — identical to Login header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 mb-2">
              <ShieldCheck size={20} className="text-brand-500" />
              <span className="font-display text-2xl font-black tracking-tight">VERO</span>
            </div>
            <StepDots step={step} />
          </div>

          {/* ── STEP 0: PHONE ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-bold mb-1">Create account</h1>
                <p className="text-gray-500 text-xs">Enter your mobile number to get started.</p>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none
                                border-r border-dark-600/60 pr-3 h-full">
                  <span className="text-gray-400 font-bold text-sm">+91</span>
                </div>
                <input
                  id="phone-input"
                  className="input-field pl-16 tracking-[0.15em] font-bold
                             placeholder:tracking-normal placeholder:font-normal"
                  placeholder="9876543210"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone.replace("+91", "").replace(/\D/g, "")}
                  onChange={e => setPhone("+91" + e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                  autoFocus
                />
              </div>

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button id="send-otp-btn" className="btn-primary py-3.5"
                      onClick={handleSendOtp} disabled={loading}>
                {loading ? "Sending…" : "Send OTP →"}
              </button>

              <p className="text-center text-xs text-gray-500">
                Already registered?{" "}
                <Link to="/login" className="text-brand-500 font-semibold hover:text-brand-400">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP 1: OTP — untouched per user request ─────────────── */}
          {step === 1 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-bold mb-1">Enter the OTP</h1>
                <p className="text-gray-500 text-xs">
                  Sent to <span className="text-gray-300 font-medium">{phone}</span>.
                  Check the notification above.
                </p>
              </div>

              <input
                id="otp-input"
                className="input-field text-center text-2xl tracking-[0.5em] font-bold py-3"
                placeholder="——————"
                maxLength={6}
                inputMode="numeric"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                autoFocus
              />

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button id="verify-otp-btn" className="btn-primary py-3.5"
                      onClick={handleVerifyOtp} disabled={loading}>
                {loading ? "Verifying…" : "Verify →"}
              </button>
            </div>
          )}

          {/* ── STEP 2: RIDER DETAILS ─────────────────────────────────── */}
          {step === 2 && (
            <div className="card space-y-3">
              <div>
                <h1 className="text-xl font-bold mb-1">Your details</h1>
                <p className="text-gray-500 text-xs">Used to personalise your coverage and premiums.</p>
              </div>

              <input
                id="name-input"
                className="input-field"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />

              <div className="relative">
                <input
                  id="password-input"
                  className="input-field pr-11"
                  type={showPass ? "text" : "password"}
                  placeholder="Password (min 8 characters)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Platform</label>
                  <select className="input-field" value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">City</label>
                  <select className="input-field" value={form.city}
                    onChange={e => { setForm(f => ({ ...f, city: e.target.value, zone_id: "" })); fetchZones(e.target.value) }}>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Delivery Zone</label>
                {zonesLoading ? (
                  <div className="input-field flex items-center gap-2 text-gray-500 text-xs">
                    <Loader size={12} className="animate-spin" /> Loading zones…
                  </div>
                ) : zones.length === 0 ? (
                  <button type="button" className="input-field text-left text-gray-500 text-sm w-full"
                    onClick={() => fetchZones(form.city)}>
                    Tap to load zones for {form.city} →
                  </button>
                ) : (
                  <select id="zone-select" className="input-field" value={form.zone_id}
                    onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}>
                    <option value="">Select zone</option>
                    {zones.map(z => (
                      <option key={z.zone_id} value={z.zone_id}>{z.zone_name} ({z.risk}×)</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Shift start</label>
                  <input className="input-field" type="time" value={form.shift_start}
                    onChange={e => setForm(f => ({ ...f, shift_start: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Shift end</label>
                  <input className="input-field" type="time" value={form.shift_end}
                    onChange={e => setForm(f => ({ ...f, shift_end: e.target.value }))} />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button id="details-next-btn" className="btn-primary py-3.5" onClick={handleDetailsNext}>
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 3: DPDP CONSENT ─────────────────────────────────── */}
          {step === 3 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-bold mb-1">Data permissions</h1>
                <p className="text-gray-500 text-xs">
                  Review and accept each item — all are revocable at any time via Settings.
                </p>
              </div>

              {/* GPS Section */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Location Access
                </p>
                <div className="space-y-0 divide-y divide-dark-600/50 border border-dark-600/40 rounded-xl px-3">
                  <ConsentItem
                    checked={gps.zone}
                    onChange={() => setGps(g => ({ ...g, zone: !g.zone }))}
                    label="Zone matching during active shift"
                    desc="GPS checked against disrupted area only while your shift is running."
                  />
                  <ConsentItem
                    checked={gps.claims}
                    onChange={() => setGps(g => ({ ...g, claims: !g.claims }))}
                    label="Used for claim verification only"
                    desc="Location is never stored beyond the claim window or used for advertising."
                  />
                  <ConsentItem
                    checked={gps.oracle}
                    onChange={() => setGps(g => ({ ...g, oracle: !g.oracle }))}
                    label="IRDAI-licensed oracle access"
                    desc="Zone coordinates shared with the parametric trigger oracle for payout calculation."
                  />
                </div>
              </div>

              {/* Platform Section */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Platform Data — {form.platform}
                </p>
                <div className="space-y-0 divide-y divide-dark-600/50 border border-dark-600/40 rounded-xl px-3">
                  <ConsentItem
                    checked={dsa.data}
                    onChange={() => setDsa(d => ({ ...d, data: !d.data }))}
                    label={`Share delivery activity from ${form.platform}`}
                    desc="Online/offline status and zone presence — used only to verify claim eligibility."
                  />
                  <ConsentItem
                    checked={dsa.read}
                    onChange={() => setDsa(d => ({ ...d, read: !d.read }))}
                    label="I have read the Data Sharing Agreement"
                    extra={
                      <button
                        onClick={() => setShowDsaModal(true)}
                        className="text-[11px] text-brand-400 hover:text-brand-300 font-medium
                                   underline underline-offset-2 transition-colors"
                      >
                        Read full agreement →
                      </button>
                    }
                  />
                </div>
              </div>

              <p className="text-[10px] text-gray-600 leading-relaxed">
                <span className="text-gray-500">Digital Personal Data Protection Act 2023</span> — all
                consents revocable anytime via Settings → Data &amp; Privacy.
              </p>

              {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

              <button
                id="consent-next-btn"
                className={`btn-primary py-3.5 ${!allConsented ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={handleConsentNext}
                disabled={!allConsented}
              >
                {allConsented ? "I Agree & Continue →" : `${remaining} item${remaining > 1 ? "s" : ""} remaining`}
              </button>
            </div>
          )}

          {/* ── STEP 4: UPI VERIFICATION ─────────────────────────────── */}
          {step === 4 && (
            <div className="card space-y-4">
              <div>
                <UpiLogo />
                <h1 className="text-xl font-bold mt-2 mb-1">Link your UPI ID</h1>
                <p className="text-gray-500 text-xs">
                  A ₹1 test debit confirms this account is yours — simulated in test mode, no real charge.
                </p>
              </div>

              {!upiKyc ? (
                <div className="space-y-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] p-0.5 rounded-2xl bg-dark-800/20">
                  <div className="flex bg-dark-600/40 p-1 rounded-xl">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-[11px] uppercase tracking-wide font-bold rounded-lg transition-all duration-200 ${upiType === "number" ? "bg-dark-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"}`}
                      onClick={() => { setUpiType("number"); clearErr() }}
                    >
                      Phone Number
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-[11px] uppercase tracking-wide font-bold rounded-lg transition-all duration-200 ${upiType === "username" ? "bg-dark-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"}`}
                      onClick={() => { setUpiType("username"); clearErr() }}
                    >
                      UPI ID
                    </button>
                  </div>

                  {upiType === "number" ? (
                    <div className="flex bg-dark-800 border border-dark-600/60 rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/50 transition-all">
                      <input
                        className="flex-1 bg-transparent px-4 py-3 outline-none text-white placeholder-gray-500 font-mono tracking-wider text-sm"
                        placeholder="Mobile Number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={upiPhone || phone.replace(/\D/g, "").slice(-10)}
                        onChange={e => { setUpiPhone(e.target.value.replace(/\D/g, "")); setUpiKyc(null) }}
                        onKeyDown={e => e.key === "Enter" && handleVerifyUpi()}
                      />
                      <select
                        className="bg-dark-700/50 border-l border-dark-600/60 px-2 sm:px-3 py-3 outline-none text-xs text-gray-300 font-medium cursor-pointer focus:bg-dark-600 transition-colors"
                        value={upiExt}
                        onChange={e => { setUpiExt(e.target.value); setUpiKyc(null) }}
                      >
                        <option value="@paytm">@paytm</option>
                        <option value="@ybl">@ybl</option>
                        <option value="@apl">@apl</option>
                        <option value="@okhdfcbank">@okhdfcbank</option>
                        <option value="@okaxis">@okaxis</option>
                        <option value="@upi">@upi</option>
                      </select>
                    </div>
                  ) : (
                    <input
                      id="upi-input"
                      className="input-field font-mono text-sm"
                      placeholder="e.g. name@okaxis"
                      value={upiId}
                      onChange={e => { setUpiId(e.target.value); setUpiKyc(null) }}
                      onKeyDown={e => e.key === "Enter" && handleVerifyUpi()}
                    />
                  )}

                  <p className="text-[10px] text-gray-500 leading-relaxed px-1">
                    Used to securely route automated payouts during active coverage.
                  </p>

                  {error && <p className="text-red-400 text-xs font-medium px-1">{error}</p>}
                  
                  <button
                    id="verify-upi-btn"
                    className="btn-primary py-3.5 w-full mt-2"
                    onClick={handleVerifyUpi}
                    disabled={upiLoading || (upiType === 'username' ? !upiId.trim() : false)}
                  >
                    {upiLoading
                      ? <span className="flex items-center justify-center gap-2">
                          <Loader size={14} className="animate-spin" /> Verifying identity…
                        </span>
                      : "Verify Account →"
                    }
                  </button>
                </div>
              ) : (
                <>
                  {/* Verified card */}
                  <div className="flex items-start gap-3 bg-emerald-500/8 border border-emerald-500/25
                                  rounded-xl px-4 py-3">
                    <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">{upiKyc.account_holder}</p>
                      <p className="text-xs text-gray-400">{upiKyc.bank}</p>
                      <p className="text-[11px] font-mono text-gray-500 mt-1">{upiKyc.upi_id}</p>
                      <p className="text-[10px] font-semibold text-emerald-500 mt-0.5 uppercase tracking-wide">
                        ₹1 test debit · auto-refunded · test mode
                      </p>
                    </div>
                  </div>

                  {/* Payout authorisation — single ConsentItem, fix applied */}
                  <div className="border border-dark-600/40 rounded-xl px-3">
                    <ConsentItem
                      id="upi-auth"
                      checked={upiAuth}
                      onChange={() => setUpiAuth(v => !v)}
                      label="Authorise automated income payouts"
                      desc="Allow VERO to credit earned income to this UPI ID during active disruptions."
                    />
                  </div>

                  <button
                    onClick={() => { setUpiId(""); setUpiKyc(null); setUpiAuth(false) }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Use a different UPI ID
                  </button>

                  {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

                  <button
                    id="register-btn"
                    className={`btn-primary py-3.5 ${!upiAuth ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={handleRegister}
                    disabled={loading || !upiAuth}
                  >
                    {loading ? "Creating account…" : "Create account (DPDP ✓) →"}
                  </button>
                </>
              )}
            </div>
          )}


        </div>
      </div>
    </div>
  )
}
