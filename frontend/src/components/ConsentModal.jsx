import { X, Shield, ExternalLink } from "lucide-react"

/**
 * ConsentModal — DPDP 2023 Data Sharing Agreement bottom-sheet.
 * Triggered from step 3 (Platform DSA) via "Read full DSA →" link.
 * Tap outside or press "Close" to dismiss.
 */
export default function ConsentModal({ platform, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-h-[80vh] flex flex-col
                      bg-[#0f0f0f] border-t border-white/8 rounded-t-3xl
                      shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8)]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-2 pb-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-500/10 rounded-xl mt-0.5">
              <Shield size={16} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Data Sharing Agreement</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                VERO × {platform} · DSA v1.0 · April 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="h-px bg-white/5 mx-6" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">

          <DsaSection number="1" title="Parties">
            This agreement is between{" "}
            <b className="text-gray-200">VERO Income Protection Platform</b> ("VERO")
            and you — a registered delivery partner on{" "}
            <b className="text-gray-200">{platform}</b> ("You").
          </DsaSection>

          <DsaSection number="2" title="Data Shared by Platform">
            <p className="mb-2">
              {platform} shares the following data with VERO{" "}
              <b className="text-gray-300">solely for parametric claim processing</b>:
            </p>
            <ul className="space-y-1.5">
              {[
                "Delivery activity status (online/offline) during registered shift hours",
                "GPS zone presence data for trigger zone-match verification",
                "Order completion count — aggregate only, no individual order detail",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-1 h-1 rounded-full bg-brand-500/70 mt-2 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </DsaSection>

          <DsaSection number="3" title="Purpose Limitation (DPDP 2023 §4)">
            All shared data is used exclusively for: (a) verifying parametric trigger eligibility,
            (b) fraud anomaly detection, and (c) generating your Reliability Score (R).
            Data is <b className="text-gray-300">never sold</b> or shared with any third party
            beyond IRDAI-licensed parametric oracles.
          </DsaSection>

          <DsaSection number="4" title="Data Retention">
            Delivery activity data is retained for{" "}
            <b className="text-gray-200">90 days</b>.
            R-score computation history is retained for{" "}
            <b className="text-gray-200">2 years</b>{" "}
            for premium personalisation. Full deletion can be requested at any time via
            Settings → Data &amp; Privacy.
          </DsaSection>

          <DsaSection number="5" title="Your Rights (DPDP 2023 §12–14)">
            <ul className="space-y-1.5">
              {[
                ["Right to access", "Request a copy of all data held about you"],
                ["Right to correction", "Update any inaccurate profile data"],
                ["Right to erasure", "Request deletion of all personal data"],
                ["Right to withdraw consent", "Suspension applied within 24 hours; policy coverage paused until restored"],
              ].map(([right, detail], i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-1 h-1 rounded-full bg-cyan-500/70 mt-2 shrink-0" />
                  <span>
                    <b className="text-gray-300">{right}</b> — {detail}
                  </span>
                </li>
              ))}
            </ul>
          </DsaSection>

          <DsaSection number="6" title="Grievance Officer">
            For data-related complaints contact:{" "}
            <span className="text-brand-400 font-medium">privacy@vero-insurance.in</span>.{" "}
            Response guaranteed within 30 days per DPDP 2023 §13(6).
          </DsaSection>

          <p className="text-[10px] text-gray-600 pt-3 border-t border-white/5 leading-relaxed">
            This DSA is governed by the Digital Personal Data Protection Act, 2023 (India)
            and IRDAI Privacy Guidelines 2025. Effective April 2026.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button onClick={onClose} className="btn-primary">
            Close &amp; Accept
          </button>
        </div>
      </div>
    </div>
  )
}

/** Clean numbered section inside DSA */
function DsaSection({ number, title, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-brand-500/70">{number}</span>
        <h4 className="text-xs font-bold text-white">{title}</h4>
      </div>
      <div className="text-[11px] text-gray-400 leading-relaxed pl-4">
        {children}
      </div>
    </div>
  )
}
