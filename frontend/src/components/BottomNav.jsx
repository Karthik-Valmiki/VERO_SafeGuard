import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Shield, IndianRupee, User } from 'lucide-react'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { label: 'Home',    icon: Home,         path: '/dashboard' },
    { label: 'Policy',  icon: Shield,       path: '/policy' },
    { label: 'Claims',  icon: IndianRupee,  path: '/claims' },
    { label: 'Profile', icon: User,         path: '/profile' },
  ]

  const hideOn = ['/', '/login', '/register', '/payment', '/simulator', '/notifications']
  if (hideOn.includes(location.pathname)) return null

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md bg-ink-950/95 backdrop-blur-md border border-ink-600 rounded-2xl flex items-center justify-around px-2 py-1.5 shadow-2xl shadow-black/80 z-50">
      {navItems.map((item) => {
        const active = location.pathname === item.path
        const Icon = item.icon
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-colors duration-150 ${
              active ? 'text-accent-400' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
            <span className="text-[11px] font-medium leading-none">
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
