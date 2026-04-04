import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { login } from "../api"
import { ShieldCheck, ArrowLeft } from "lucide-react"

export default function Login() {
  const { saveRider } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]       = useState({ phone_number: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  const handleLogin = async () => {
    const phone = form.phone_number.trim()
    if (!/^\+91\d{10}$/.test(phone)) return setError("Enter a valid 10-digit number")
    if (!form.password) return setError("Enter your password")
    setLoading(true); setError("")
    try {
      const res = await login({ phone_number: phone, password: form.password })
      saveRider(res.data)
      navigate("/dashboard")
    } catch (e) {
      setError(e.response?.data?.detail || "Login failed. Check your credentials.")
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-full px-5 relative overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none" />

      {/* Back link — top */}
      <div className="relative z-10 pt-4 pb-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 mb-3">
              <ShieldCheck size={20} className="text-brand-500" />
              <span className="font-display text-2xl font-black tracking-tight">VERO</span>
            </div>
            <h1 className="text-xl font-bold mb-1">Welcome back</h1>
            <p className="text-gray-500 text-xs">Log in to check your coverage and payouts.</p>
          </div>

          <div className="card space-y-4">
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center pointer-events-none border-r border-dark-600/60 pr-3">
                <span className="text-gray-400 font-bold text-sm">+91</span>
              </div>
              <input
                className="input-field pl-16 tracking-[0.15em] font-bold placeholder:tracking-normal placeholder:font-normal"
                placeholder="9876543210"
                type="tel"
                maxLength={10}
                value={form.phone_number.replace("+91", "")}
                onChange={e => setForm({ ...form, phone_number: "+91" + e.target.value.replace(/\D/g, "") })}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            <input
              className="input-field"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />

            {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

            <button className="btn-primary py-3.5" onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : "Log in →"}
            </button>

            <p className="text-center text-xs text-gray-500">
              New here?{" "}
              <Link to="/register" className="text-brand-500 font-semibold hover:text-brand-400">Create account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
