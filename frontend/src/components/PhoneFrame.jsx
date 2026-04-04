import React from "react"
import { useLocation } from "react-router-dom"
import BottomNav from "./BottomNav"

export default function PhoneFrame({ children }) {
  const location = useLocation()
  const showNav = !['/', '/login', '/register', '/payment', '/simulator', '/notifications'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-8 font-sans selection:bg-brand-500/30">
      {/* Outer ambient glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,#3b0764,transparent_70%)] pointer-events-none opacity-40" />
      
      {/* The Physical Device Frame */}
      <div className="relative w-full max-w-[430px] h-[880px] bg-[#050505] rounded-[3.5rem] border-[12px] border-[#1a1a1a] shadow-[0_0_80px_-20px_rgba(139,92,246,0.3),0_0_20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col ring-4 ring-white/5 ring-inset z-10 scale-[0.85] sm:scale-100 origin-center transition-transform duration-700 ease-out">
        
        {/* Status Bar simulation */}
        <div className="h-10 px-8 pt-4 flex justify-between items-center text-[10px] font-bold text-white/50 z-40">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l-12-18h24z"/></svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 20l-10.5-16h21z"/></svg>
            <div className="w-5 h-2.5 border border-white/30 rounded-sm p-[1px]"><div className="w-full h-full bg-white/70 rounded-px"/></div>
          </div>
        </div>

        {/* Actual Content Area */}
        <div className={`flex-1 overflow-y-auto no-scrollbar relative custom-scrollbar ${showNav ? 'pb-32' : 'pb-10'}`}>
          {children}
        </div>

        {/* Bottom Navigation */}
        {showNav && <BottomNav />}

        {/* Bottom Home Indicator */}
        <div className="h-6 flex justify-center items-end pb-2 bg-gradient-to-t from-black to-transparent pointer-events-none relative z-50">
          <div className="w-32 h-1 bg-white/20 rounded-full" />
        </div>
      </div>

      {/* Decorative floating elements */}
      <div className="fixed top-20 left-20 w-32 h-32 bg-brand-500/10 blur-[100px] rounded-full animate-pulse-slow" />
      <div className="fixed bottom-20 right-20 w-44 h-44 bg-cyan-500/5 blur-[120px] rounded-full animate-pulse-slow delay-700" />
    </div>
  )
}
