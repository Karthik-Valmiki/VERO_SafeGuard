import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { AdminProvider, useAdmin } from "./context/AuthContext"
import AdminLogin from "./pages/AdminLogin"
import AdminPanel from "./pages/AdminPanel"

function AdminRoute({ children }) {
  const { isAdmin } = useAdmin()
  return isAdmin ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AdminProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AdminProvider>
  )
}
