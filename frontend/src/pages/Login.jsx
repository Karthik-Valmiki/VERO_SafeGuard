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
    if (!/^\+91\d{10}$/.test(phone)) return setError("Enter a valid 10-digit mobile number")
    if (!form.password) return setError("Enter your account password")
    setLoading(true); setError("")
    try {
      const res = await login({ phone_number: phone, password: form.password })
      saveRider(res.data)
      navigate("/dashboard")
    } catch (e) {
      setError(e.response?.data?.detail || "Authentication failed. Check your credentials.")
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-full px-5 bg-ink-900 text-ink-100 relative">
      {/* Top back navigation */}
      <div className="pt-4 pb-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100 transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center py-6">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <ShieldCheck size={20} className="text-accent-500" />
              <span className="font-semibold text-2xl tracking-tight text-ink-100">VERO SafeGuard</span>
            </div>
            <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
            <p className="text-ink-400 text-xs">Log in to view your coverage and real-time payouts</p>
          </div>

          <div className="card space-y-4">
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center pointer-events-none border-r border-ink-600 pr-3">
                <span className="text-ink-400 font-mono text-sm">+91</span>
              </div>
              <input
                className="input-field pl-16 font-mono text-sm tracking-wider placeholder:tracking-normal placeholder:font-sans"
                placeholder="10-digit number"
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

            {error && <p className="text-negative text-xs">{error}</p>}

            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>

            <p className="text-center text-xs text-ink-400 pt-1">
              New to VERO?{" "}
              <Link to="/register" className="text-accent-400 font-medium hover:text-accent-300 transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
