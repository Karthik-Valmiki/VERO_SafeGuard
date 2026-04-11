import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth, AdminProvider, useAdmin } from "./context/AuthContext"
import Landing       from "./pages/Landing"
import Register      from "./pages/Register"
import Login         from "./pages/Login"
import Dashboard     from "./pages/Dashboard"
import Payment       from "./pages/Payment"
import Profile       from "./pages/Profile"
import Policy        from "./pages/Policy"
import Claims        from "./pages/Claims"
import Simulator     from "./pages/Simulator"
import Notifications from "./pages/Notifications"
import PhoneFrame    from "./components/PhoneFrame"

function PrivateRoute({ children }) {
  const { rider } = useAuth()
  return rider ? children : <Navigate to="/login" replace />
}

// Redirect embedded admin traffic to the standalone service on port 8080
function AdminRedirect() {
  window.location.href = `http://${window.location.hostname}:8080`;
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <HashRouter>
          <Routes>
            {/* Redirect old admin routes to new standalone service */}
            <Route path="/admin-login" element={<AdminRedirect />} />
            <Route path="/admin" element={<AdminRedirect />} />

            {/* Rider app — inside PhoneFrame */}
            <Route path="/*" element={
              <PhoneFrame>
                <Routes>
                  <Route path="/"              element={<Landing />} />
                  <Route path="/register"      element={<Register />} />
                  <Route path="/login"         element={<Login />} />
                  <Route path="/payment"       element={<PrivateRoute><Payment /></PrivateRoute>} />
                  <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/policy"        element={<PrivateRoute><Policy /></PrivateRoute>} />
                  <Route path="/claims"        element={<PrivateRoute><Claims /></PrivateRoute>} />
                  <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
                  <Route path="/profile"       element={<PrivateRoute><Profile /></PrivateRoute>} />
                  <Route path="*"              element={<Navigate to="/" replace />} />
                </Routes>
              </PhoneFrame>
            } />
          </Routes>
        </HashRouter>
      </AdminProvider>
    </AuthProvider>
  )
}
