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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] bg-dark-900/60 backdrop-blur-2xl border border-white/8 rounded-3xl flex items-center justify-around px-1 py-1 shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 ring-1 ring-white/5">
      {navItems.map((item) => {
        const active = location.pathname === item.path
        const Icon = item.icon
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-4 rounded-2xl transition-all duration-300 ${
              active ? 'text-brand-400 bg-brand-500/10' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div className={`relative transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
              {active && <div className="absolute -inset-2 bg-brand-500/15 blur-md rounded-full -z-10" />}
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="relative z-10" />
            </div>
            <span className={`text-[9px] font-bold tracking-widest uppercase transition-all ${active ? 'opacity-100' : 'opacity-50'}`}>
              {item.label}
            </span>
            <div className={`w-1 h-1 rounded-full bg-brand-400 transition-all duration-300 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
          </button>
        )
      })}
    </div>
  )
}
