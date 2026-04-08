import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Landing    from "./pages/Landing"
import Register   from "./pages/Register"
import Login      from "./pages/Login"
import Dashboard  from "./pages/Dashboard"
import Payment    from "./pages/Payment"
import Profile    from "./pages/Profile"
import Policy     from "./pages/Policy"
import Claims     from "./pages/Claims"
import Simulator  from "./pages/Simulator"
import Notifications from "./pages/Notifications"
import AdminDashboard from "./pages/AdminDashboard"
import PhoneFrame from "./components/PhoneFrame"

function PrivateRoute({ children }) {
  const { rider } = useAuth()
  return rider ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <PhoneFrame>
          <Routes>
            <Route path="/"           element={<Landing />} />
            <Route path="/register"   element={<Register />} />
            <Route path="/login"      element={<Login />} />
            <Route path="/payment"    element={<PrivateRoute><Payment /></PrivateRoute>} />
            <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/policy"     element={<PrivateRoute><Policy /></PrivateRoute>} />
            <Route path="/claims"     element={<PrivateRoute><Claims /></PrivateRoute>} />
            <Route path="/simulator"  element={<PrivateRoute><Simulator /></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
            <Route path="/profile"    element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/admin"      element={<AdminDashboard />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </PhoneFrame>
      </HashRouter>
    </AuthProvider>
  )
}
