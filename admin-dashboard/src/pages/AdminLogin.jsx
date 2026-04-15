import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAdmin } from "../context/AuthContext"
import { ShieldCheck } from "lucide-react"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { adminLogin } = useAdmin()
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    if (adminLogin(email, password)) {
      navigate("/")
    } else {
      alert("Invalid admin credentials (hint: name@admin / admin1234)")
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-16 h-16 bg-brand-500/20 rounded-2xl flex items-center justify-center border border-brand-500/30 mb-6">
          <ShieldCheck className="w-8 h-8 text-brand-400" />
        </div>
        <h2 className="text-center text-3xl font-display font-bold tracking-tight text-white">
          VERO Command Center
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Sign in with your admin credentials
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-dark-800/50 py-8 px-4 shadow-xl border border-dark-600 sm:rounded-2xl sm:px-10 backdrop-blur-xl">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Admin Email
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="admin@vero"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="admin1234"
                />
              </div>
            </div>

            <div>
              <button type="submit" className="btn-primary flex justify-center w-full">
                Enter Command Center
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
