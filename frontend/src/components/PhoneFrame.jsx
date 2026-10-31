import React from "react"
import { useLocation } from "react-router-dom"
import BottomNav from "./BottomNav"

export default function PhoneFrame({ children }) {
  const location = useLocation()
  const showNav = !['/', '/login', '/register', '/payment', '/simulator', '/notifications'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-2 sm:p-8 font-sans selection:bg-accent-500/20 selection:text-accent-400">
      {/* Device Frame */}
      <div className="relative w-full max-w-[420px] h-[860px] bg-ink-900 rounded-[2.5rem] border-[8px] border-[#181d2a] shadow-2xl shadow-black overflow-hidden flex flex-col z-10">
        
        {/* Status Bar simulation */}
        <div className="h-9 px-7 pt-3 flex justify-between items-center text-[11px] font-mono font-medium text-ink-400 z-40 bg-ink-900 select-none">
          <span>09:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l-12-18h24z"/></svg>
            <div className="w-5 h-2.5 border border-ink-500 rounded-sm p-[1px]">
              <div className="w-full h-full bg-ink-300 rounded-[1px]"/>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto no-scrollbar relative custom-scrollbar ${showNav ? 'pb-24' : 'pb-6'}`}>
          {children}
        </div>

        {/* Bottom Navigation */}
        {showNav && <BottomNav />}

        {/* Home Indicator */}
        <div className="h-5 flex justify-center items-end pb-1.5 bg-ink-900 pointer-events-none relative z-50">
          <div className="w-28 h-1 bg-ink-600 rounded-full" />
        </div>
      </div>
    </div>
  )
}
