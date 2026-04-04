import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Bell, CheckCircle, Zap, Trash2, Loader2 } from "lucide-react"
import { getNotifications, clearCompletedNotifications } from "../api"

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      const response = await getNotifications()
      setNotifications(response.data || [])
    } catch (error) {
      console.error("Failed to load notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClearCompleted = async () => {
    try {
      await clearCompletedNotifications()
      await loadNotifications() // Reload notifications
    } catch (error) {
      console.error("Failed to clear notifications:", error)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const activeNotifications = notifications.filter(n => n.type === "active")
  const completedNotifications = notifications.filter(n => n.type === "completed")

  return (
    <div className="flex flex-col min-h-full bg-dark-900 text-white">
      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </button>
        <Bell size={15} className="text-brand-500" />
        <span className="font-semibold text-sm">Notifications</span>
        {completedNotifications.length > 0 && (
          <button onClick={handleClearCompleted} className="ml-auto flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400 transition-colors">
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell size={32} className="text-gray-700 mb-4" />
              <p className="text-gray-500 text-sm font-medium">No notifications yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Payout alerts and trigger completions will appear here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </p>
              
              {/* Active notifications first */}
              {activeNotifications.map(notification => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 border bg-brand-500/10 border-brand-500/30"
                >
                  <div className="mt-0.5 shrink-0 text-brand-400">
                    <Zap size={15} className="animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-400">
                      {notification.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Active in {notification.metadata?.zone_name || "Unknown Zone"}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Completed notifications */}
              {completedNotifications.map(notification => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 border bg-dark-800/60 border-dark-700/50"
                >
                  <div className="mt-0.5 shrink-0 text-green-400">
                    <CheckCircle size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">
                      {notification.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
