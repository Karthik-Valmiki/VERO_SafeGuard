import axios from "axios"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("vero_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Admin API key — loaded from build-time env, never hardcoded in source
  const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "vero_admin_key_2026"
  config.headers["X-Admin-Key"] = adminKey
  return config
})

export const sendOtp    = (phone_number)          => api.post("/auth/otp/send",    { phone_number })
export const verifyOtp  = (phone_number, otp_code)=> api.post("/auth/otp/verify",  { phone_number, otp_code })
export const register   = (data)                  => api.post("/auth/register",    data)
export const login      = (data)                  => api.post("/auth/login",       data)
export const getQuote   = ()                      => api.get("/policies/quote")
export const purchasePolicy = ()                  => api.post("/policies/purchase")
export const createRazorpayOrder = ()             => api.post("/policies/create-order")
export const verifyRazorpayPayment = (data)       => api.post("/policies/verify-payment", data)
export const getMyPolicy    = ()                  => api.get("/policies/my-policy")
export const getMyDashboard = ()                  => api.get("/dashboards/rider/me")
export const getAdminSummary    = ()              => api.get("/dashboards/admin/summary")
export const getAdminMap        = ()              => api.get("/dashboards/admin/map")
export const getAdminAnalytics  = ()              => api.get("/dashboards/admin/analytics")
export const getAdminLivePayouts= ()              => api.get("/dashboards/admin/live-payouts")
export const getAdminZones      = ()              => api.get("/dashboards/admin/zones")
export const simulateTrigger = (data)             => api.post("/triggers/simulate", data)
export const generateRiders       = ()            => api.post("/dashboards/admin/generate-riders")
export const getGenerateStatus    = ()            => api.get("/dashboards/admin/generate-riders/status")
export const logActivity     = (zone_id)           => api.post(`/tracking/activity?zone_id=${zone_id}`)

// Notification APIs
export const getNotifications = ()                => api.get("/notifications/")
export const markNotificationRead = (id)          => api.post(`/notifications/mark-read/${id}`)
export const clearCompletedNotifications = ()     => api.delete("/notifications/clear-completed")

export default api