/**
 * Register.jsx — DPDP 2023-compliant 5-phase onboarding
 *
 * Checkbox event isolation: onClick lives exclusively on the <button>, never on
 * a parent wrapper. The label text is wired to onChange via a sibling <div>.
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

function Checkbox({ checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`
        w-5 h-5 rounded-[4px] border-2 shrink-0 flex items-center justify-center
        transition-colors duration-150
        ${checked
          ? "bg-accent-500 border-accent-500 text-ink-950"
          : "bg-transparent border-ink-500 hover:border-accent-500"}
      `}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1.5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function ConsentItem({ id, checked, onChange, label, desc, extra }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-ink-600/50 last:border-0">
      <div className="pt-[1px]">
        <Checkbox checked={checked} onChange={onChange} />
      </div>
      <div className="flex-1 cursor-pointer select-none" onClick={onChange}>
        <p className="text-xs font-medium text-ink-100 leading-snug">{label}</p>
        {desc && <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{desc}</p>}
        {extra && (
          <div className="mt-1" onClick={e => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>
    </div>
  )
}

function OtpToast({ code, visible }) {
  return (
    <div className={`
      fixed top-4 left-1/2 -translate-x-1/2 z-[999]
      transition-opacity duration-200
      ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}
    `}>
      <div className="flex items-center gap-3 bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 shadow-2xl shadow-black/80">
        <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse shrink-0" />
        <div>
          <p className="text-xs text-ink-400">Demo verification OTP</p>
          <p className="font-mono text-lg font-semibold text-accent-400 tracking-widest">{code}</p>
        </div>
      </div>
    </div>
  )
}

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`
            rounded-full transition-all duration-200
            ${i === step ? "w-6 h-1.5 bg-accent-500" :
              i <  step  ? "w-2 h-1.5 bg-accent-500/40" :
                           "w-2 h-1.5 bg-ink-700"}
          `} />
        </div>
      ))}
    </div>
  )
}

function UpiLogo() {
  return (
    <div className="inline-flex items-center gap-2">
      <svg viewBox="0 0 54 22" width="50" height="20" fill="none">
        <path d="M4 11 L11 3 L18 11 L11 19Z" fill="#E84D31" />
        <path d="M14 11 L21 3 L28 11 L21 19Z" fill="#1A237E" />
        <text x="32" y="15.5" fill="#E84D31" fontSize="13" fontWeight="800"
              fontFamily="Arial, sans-serif" letterSpacing="0.5">UPI</text>
      </svg>
      <span className="text-[11px] text-ink-400 font-medium">via NPCI</span>
    </div>
  )
}

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

  // Step 3 — DPDP consent
  const [gps, setGps] = useState({ zone: false, claims: false, oracle: false })
  const [dsa, setDsa] = useState({ data: false, read: false })
  const [showDsaModal, setShowDsaModal] = useState(false)
  const allConsented = [...Object.values(gps), ...Object.values(dsa)].every(Boolean)
  const remaining    = [...Object.values(gps), ...Object.values(dsa)].filter(v => !v).length

  // Step 4 — UPI
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

  const handleSendOtp = async () => {
    const d = phone.replace(/\D/g, ""), p = `+91${d.slice(-10)}`
    if (!/^\+91\d{10}$/.test(p)) return setErr("Enter a valid 10-digit number")
    setPhone(p); setLoading(true); clearErr()
    try { const r = await sendOtp(p); showToast(r.data.otp_code); setStep(1) }
    catch (e) { setErr(e.response?.data?.detail || "Failed to transmit OTP") }
    finally   { setLoading(false) }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return setErr("Enter the 6-digit OTP code")
    setLoading(true); clearErr()
    try { await verifyOtp(phone, otp); setStep(2) }
    catch (e) { setErr(e.response?.data?.detail || "Incorrect OTP code") }
    finally   { setLoading(false) }
  }

  const handleDetailsNext = () => {
    if (!form.name.trim())        return setErr("Enter your full name")
    if (form.password.length < 8) return setErr("Password must contain at least 8 characters")
    if (!form.zone_id)            return setErr("Select your regular delivery zone")
    clearErr(); setStep(3)
  }

  const handleConsentNext = () => {
    if (!allConsented) return setErr(`${remaining} consent item${remaining > 1 ? "s" : ""} required`)
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
    catch (e) { setErr(e.response?.data?.detail || "UPI verification failed. Check the ID.") }
    finally   { setUpiLoading(false) }
  }

  const handleRegister = async () => {
    if (!upiKyc)  return setErr("Verify your UPI address first")
    if (!upiAuth) return setErr("Authorize payout disbursement access to complete registration")
    setLoading(true); clearErr()
    try {
      const r = await register({
        name: form.name.trim(), phone_number: phone, otp_code: otp,
        password: form.password, platform: form.platform, city: form.city,
        zone_id: parseInt(form.zone_id), shift_start: form.shift_start,
        shift_end: form.shift_end, upi_id: verifiedUpi,
      })
      saveRider(r.data); navigate("/dashboard")
    } catch (e) { setErr(e.response?.data?.detail || "Registration could not be completed") }
    finally     { setLoading(false) }
  }

  return (
    <div className="flex flex-col min-h-full px-5 bg-ink-900 text-ink-100 relative">
      <OtpToast code={otpCode} visible={toastVisible} />
      {showDsaModal && <ConsentModal platform={form.platform} onClose={() => setShowDsaModal(false)} />}

      {/* Top back navigation */}
      <div className="pt-4 pb-2">
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100 transition-colors"
        >
          <ArrowLeft size={13} /> {step > 0 ? "Back" : "Back to home"}
        </button>
      </div>

      <div className={`flex-1 flex flex-col py-2 ${step < 2 ? "items-center justify-center" : ""}`}>
        <div className="w-full max-w-sm mx-auto">
          {/* Logo & step indicator */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 mb-2">
              <ShieldCheck size={20} className="text-accent-500" />
              <span className="font-semibold text-2xl tracking-tight text-ink-100">VERO SafeGuard</span>
            </div>
            <StepDots step={step} />
          </div>

          {/* ── STEP 0: PHONE ── */}
          {step === 0 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-semibold mb-1">Create account</h1>
                <p className="text-ink-400 text-xs">Enter your mobile phone number to begin.</p>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none border-r border-ink-600 pr-3 h-full">
                  <span className="text-ink-400 font-mono text-sm">+91</span>
                </div>
                <input
                  id="phone-input"
                  className="input-field pl-16 font-mono text-sm tracking-wider placeholder:tracking-normal placeholder:font-sans"
                  placeholder="10-digit number"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone.replace("+91", "").replace(/\D/g, "")}
                  onChange={e => setPhone("+91" + e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                  autoFocus
                />
              </div>

              {error && <p className="text-negative text-xs">{error}</p>}

              <button id="send-otp-btn" className="btn-primary"
                      onClick={handleSendOtp} disabled={loading}>
                {loading ? "Sending..." : "Send verification code"}
              </button>

              <p className="text-center text-xs text-ink-400 pt-1">
                Already registered?{" "}
                <Link to="/login" className="text-accent-400 font-medium hover:text-accent-300 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP 1: OTP ── */}
          {step === 1 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-semibold mb-1">Enter verification code</h1>
                <p className="text-ink-400 text-xs">
                  Sent to <span className="text-ink-200 font-medium">{phone}</span>
                </p>
              </div>

              <input
                id="otp-input"
                className="input-field text-center text-2xl font-mono tracking-[0.4em] py-3 text-ink-100"
                placeholder="••••••"
                maxLength={6}
                inputMode="numeric"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                autoFocus
              />

              {error && <p className="text-negative text-xs">{error}</p>}

              <button id="verify-otp-btn" className="btn-primary"
                      onClick={handleVerifyOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify code"}
              </button>
            </div>
          )}

          {/* ── STEP 2: DETAILS ── */}
          {step === 2 && (
            <div className="card space-y-3.5">
              <div>
                <h1 className="text-xl font-semibold mb-1">Rider details</h1>
                <p className="text-ink-400 text-xs">Required to calibrate risk and coverage rates.</p>
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
                  placeholder="Password (minimum 8 characters)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 block mb-1">Platform</label>
                  <select className="input-field" value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-400 block mb-1">City</label>
                  <select className="input-field" value={form.city}
                    onChange={e => { setForm(f => ({ ...f, city: e.target.value, zone_id: "" })); fetchZones(e.target.value) }}>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 block mb-1">Delivery zone</label>
                {zonesLoading ? (
                  <div className="input-field flex items-center gap-2 text-ink-400 text-xs">
                    <Loader size={12} className="animate-spin" /> Loading zones...
                  </div>
                ) : zones.length === 0 ? (
                  <button type="button" className="input-field text-left text-ink-400 text-xs w-full"
                    onClick={() => fetchZones(form.city)}>
                    Tap to load zones for {form.city}
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
                  <label className="text-xs text-ink-400 block mb-1">Shift start</label>
                  <input className="input-field" type="time" value={form.shift_start}
                    onChange={e => setForm(f => ({ ...f, shift_start: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-ink-400 block mb-1">Shift end</label>
                  <input className="input-field" type="time" value={form.shift_end}
                    onChange={e => setForm(f => ({ ...f, shift_end: e.target.value }))} />
                </div>
              </div>

              {error && <p className="text-negative text-xs">{error}</p>}

              <button id="details-next-btn" className="btn-primary" onClick={handleDetailsNext}>
                Continue
              </button>
            </div>
          )}

          {/* ── STEP 3: CONSENT ── */}
          {step === 3 && (
            <div className="card space-y-4">
              <div>
                <h1 className="text-xl font-semibold mb-1">Data permissions</h1>
                <p className="text-ink-400 text-xs">
                  Required under DPDP 2023 for parametric trigger verification.
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-ink-300 mb-2">
                  Location telemetry
                </p>
                <div className="space-y-0 divide-y divide-ink-600/50 border border-ink-600 rounded-xl px-3 bg-ink-700/40">
                  <ConsentItem
                    checked={gps.zone}
                    onChange={() => setGps(g => ({ ...g, zone: !g.zone }))}
                    label="Zone matching during scheduled shift"
                    desc="Telemetry matched to disrupted zone perimeter during active shift hours."
                  />
                  <ConsentItem
                    checked={gps.claims}
                    onChange={() => setGps(g => ({ ...g, claims: !g.claims }))}
                    label="Disbursement validation only"
                    desc="Coordinates used solely to verify active presence during incident window."
                  />
                  <ConsentItem
                    checked={gps.oracle}
                    onChange={() => setGps(g => ({ ...g, oracle: !g.oracle }))}
                    label="Independent oracle verification"
                    desc="Zone coordinates matched to environmental oracle feeds."
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-ink-300 mb-2">
                  Platform integration — {form.platform}
                </p>
                <div className="space-y-0 divide-y divide-ink-600/50 border border-ink-600 rounded-xl px-3 bg-ink-700/40">
                  <ConsentItem
                    checked={dsa.data}
                    onChange={() => setDsa(d => ({ ...d, data: !d.data }))}
                    label={`Verify active order dispatch with ${form.platform}`}
                    desc="Confirm online/offline shift status to validate claim eligibility."
                  />
                  <ConsentItem
                    checked={dsa.read}
                    onChange={() => setDsa(d => ({ ...d, read: !d.read }))}
                    label="I have reviewed the Data Sharing Agreement"
                    extra={
                      <button
                        onClick={() => setShowDsaModal(true)}
                        className="text-xs text-accent-400 hover:text-accent-300 underline underline-offset-2"
                      >
                        Read full agreement
                      </button>
                    }
                  />
                </div>
              </div>

              {error && <p className="text-negative text-xs">{error}</p>}

              <button
                id="consent-next-btn"
                className={`btn-primary ${!allConsented ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={handleConsentNext}
                disabled={!allConsented}
              >
                {allConsented ? "Agree & continue" : `${remaining} permission${remaining > 1 ? "s" : ""} remaining`}
              </button>
            </div>
          )}

          {/* ── STEP 4: UPI VERIFICATION ── */}
          {step === 4 && (
            <div className="card space-y-4">
              <div>
                <UpiLogo />
                <h1 className="text-xl font-semibold mt-2 mb-1">Disbursement UPI account</h1>
                <p className="text-ink-400 text-xs">
                  Automated payouts are credited directly to this UPI address.
                </p>
              </div>

              {!upiKyc ? (
                <div className="space-y-3">
                  <div className="flex bg-ink-700 p-1 rounded-xl border border-ink-600">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${upiType === "number" ? "bg-ink-800 text-ink-100 shadow-sm" : "text-ink-400 hover:text-ink-200"}`}
                      onClick={() => { setUpiType("number"); clearErr() }}
                    >
                      Phone number
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${upiType === "username" ? "bg-ink-800 text-ink-100 shadow-sm" : "text-ink-400 hover:text-ink-200"}`}
                      onClick={() => { setUpiType("username"); clearErr() }}
                    >
                      UPI ID
                    </button>
                  </div>

                  {upiType === "number" ? (
                    <div className="flex bg-ink-700 border border-ink-600 rounded-xl overflow-hidden focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20">
                      <input
                        className="flex-1 bg-transparent px-4 py-3 outline-none text-ink-100 placeholder-ink-400 font-mono text-sm"
                        placeholder="10-digit number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={upiPhone || phone.replace(/\D/g, "").slice(-10)}
                        onChange={e => { setUpiPhone(e.target.value.replace(/\D/g, "")); setUpiKyc(null) }}
                        onKeyDown={e => e.key === "Enter" && handleVerifyUpi()}
                      />
                      <select
                        className="bg-ink-800 border-l border-ink-600 px-3 py-3 outline-none text-xs text-ink-300 font-medium cursor-pointer"
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

                  {error && <p className="text-negative text-xs">{error}</p>}
                  
                  <button
                    id="verify-upi-btn"
                    className="btn-primary w-full"
                    onClick={handleVerifyUpi}
                    disabled={upiLoading || (upiType === 'username' ? !upiId.trim() : false)}
                  >
                    {upiLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader size={14} className="animate-spin" /> Verifying account...
                      </span>
                    ) : "Verify account"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 bg-positive/10 border border-positive/25 rounded-xl px-4 py-3">
                    <CheckCircle2 size={16} className="text-positive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-ink-100">{upiKyc.account_holder}</p>
                      <p className="text-xs text-ink-300">{upiKyc.bank}</p>
                      <p className="text-xs font-mono text-ink-400 mt-0.5">{upiKyc.upi_id}</p>
                      <p className="text-[11px] font-medium text-positive mt-1">
                        Penny-drop verification confirmed (test mode)
                      </p>
                    </div>
                  </div>

                  <div className="border border-ink-600 rounded-xl px-3 bg-ink-700/40">
                    <ConsentItem
                      id="upi-auth"
                      checked={upiAuth}
                      onChange={() => setUpiAuth(v => !v)}
                      label="Authorize automated disbursement credits"
                      desc="Direct credits will be transferred to this verified UPI address upon validated disruption."
                    />
                  </div>

                  <button
                    onClick={() => { setUpiId(""); setUpiKyc(null); setUpiAuth(false) }}
                    className="text-xs text-ink-400 hover:text-ink-200 transition-colors"
                  >
                    Use a different UPI ID
                  </button>

                  {error && <p className="text-negative text-xs">{error}</p>}

                  <button
                    id="register-btn"
                    className={`btn-primary ${!upiAuth ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={handleRegister}
                    disabled={loading || !upiAuth}
                  >
                    {loading ? "Creating account..." : "Complete registration"}
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
