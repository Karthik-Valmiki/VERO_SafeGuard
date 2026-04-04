import axios from "axios"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("vero_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const sendOtp    = (phone_number)          => api.post("/auth/otp/send",    { phone_number })
export const verifyOtp  = (phone_number, otp_code)=> api.post("/auth/otp/verify",  { phone_number, otp_code })
export const register   = (data)                  => api.post("/auth/register",    data)
export const login      = (data)                  => api.post("/auth/login",       data)
export const getQuote   = ()                      => api.get("/policies/quote")
export const purchasePolicy = ()                  => api.post("/policies/purchase")
export const getMyPolicy    = ()                  => api.get("/policies/my-policy")
export const getMyDashboard = ()                  => api.get("/dashboards/rider/me")
export const simulateTrigger = (data)             => api.post("/triggers/simulate", data)
export const logActivity     = (zone_id)           => api.post(`/tracking/activity?zone_id=${zone_id}`)

// Notification APIs
export const getNotifications = ()                => api.get("/notifications/")
export const markNotificationRead = (id)          => api.post(`/notifications/mark-read/${id}`)
export const clearCompletedNotifications = ()     => api.delete("/notifications/clear-completed")

export default api