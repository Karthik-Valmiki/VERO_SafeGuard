import { createContext, useContext, useState } from "react"

const AdminContext = createContext(null)

const ADMIN_USER = "name@admin"
const ADMIN_PASS = "admin1234"

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("vero_admin") === "1"
  )

  const adminLogin = (username, password) => {
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      localStorage.setItem("vero_admin", "1")
      setIsAdmin(true)
      return true
    }
    return false
  }

  const adminLogout = () => {
    localStorage.removeItem("vero_admin")
    setIsAdmin(false)
  }

  return (
    <AdminContext.Provider value={{ isAdmin, adminLogin, adminLogout }}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
