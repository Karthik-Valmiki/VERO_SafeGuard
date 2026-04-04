import { createContext, useContext, useState, useEffect, useRef } from "react"

const AuthContext = createContext(null)
const SimContext  = createContext(null)

// ── Simulator global state — persists across page navigation ─────────────────
export function SimProvider({ children }) {
  const [activeTriggers, setActiveTriggers] = useState([])   // running trigger jobs
  const [completedTriggers, setCompletedTriggers] = useState([])
  const timersRef = useRef([])

  const addTrigger = (triggerResult, optMeta) => {
    const id = triggerResult.event_id || Date.now().toString()
    const intervalCount = triggerResult.interval_count || 1
    const intervalMs    = 10_000  // 10s per interval (demo speed)
    const totalMs       = intervalCount * intervalMs

    const job = {
      id,
      label:        optMeta.label,
      color:        optMeta.color,
      bg:           optMeta.bg,
      metricType:   triggerResult.metric_type,
      intervalCount,
      elapsed:      0,          // intervals completed so far
      payoutNew:    triggerResult.estimated_payout_new,
      payoutTop:    triggerResult.estimated_payout_returning,
      startedAt:    Date.now(),
      totalMs,
      done:         false,
    }

    setActiveTriggers(prev => [...prev, job])

    // Tick every 10s
    const iv = setInterval(() => {
      setActiveTriggers(prev => prev.map(t => {
        if (t.id !== id) return t
        const elapsed = t.elapsed + 1
        if (elapsed >= intervalCount) {
          clearInterval(iv)
          setActiveTriggers(p => p.filter(x => x.id !== id))
          setCompletedTriggers(p => [...p, { ...t, elapsed: intervalCount, done: true }])
          return { ...t, elapsed: intervalCount, done: true }
        }
        return { ...t, elapsed }
      }))
    }, intervalMs)

    timersRef.current.push(iv)
  }

  const clearCompleted = () => setCompletedTriggers([])

  // Cleanup on unmount
  useEffect(() => () => timersRef.current.forEach(clearInterval), [])

  return (
    <SimContext.Provider value={{ activeTriggers, completedTriggers, addTrigger, clearCompleted }}>
      {children}
    </SimContext.Provider>
  )
}

export const useSim = () => useContext(SimContext)

// ── Auth ──────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [rider, setRider] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem("vero_rider")
    if (saved) setRider(JSON.parse(saved))
  }, [])

  const saveRider = (data) => {
    localStorage.setItem("vero_token", data.access_token)
    localStorage.setItem("vero_rider", JSON.stringify(data))
    setRider(data)
  }

  const logout = () => {
    localStorage.removeItem("vero_token")
    localStorage.removeItem("vero_rider")
    setRider(null)
  }

  return (
    <AuthContext.Provider value={{ rider, saveRider, logout }}>
      <SimProvider>
        {children}
      </SimProvider>
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
