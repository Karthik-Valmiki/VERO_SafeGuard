import { X, Shield } from "lucide-react"

/**
 * ConsentModal — DPDP 2023 Data Sharing Agreement bottom-sheet.
 * Triggered from step 3 (Platform DSA) via "Read full agreement" link.
 */
export default function ConsentModal({ platform, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-h-[80vh] flex flex-col bg-ink-900 border-t border-ink-600 rounded-t-2xl shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-ink-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-2 pb-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-ink-800 border border-ink-600 rounded-xl mt-0.5 text-accent-500">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-base font-semibold leading-tight text-ink-100">Data sharing agreement</h3>
              <p className="text-xs text-ink-400 mt-0.5">
                VERO × {platform} · DPDP 2023 Compliant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-800 transition-colors text-ink-400 hover:text-ink-100"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-px bg-ink-600/70 mx-6" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs text-ink-300 leading-relaxed custom-scrollbar">
          <DsaSection number="1" title="Parties involved">
            This agreement is between <b className="text-ink-100">VERO Income Protection Platform</b> ("VERO")
            and the registered delivery rider on <b className="text-ink-100">{platform}</b> ("Rider").
          </DsaSection>

          <DsaSection number="2" title="Platform telemetry shared">
            <p className="mb-2">
              {platform} shares the following telemetry with VERO <b className="text-ink-100">solely for parametric trigger validation</b>:
            </p>
            <ul className="space-y-1.5">
              {[
                "Delivery dispatch status (online/offline) during registered shift hours",
                "GPS zone presence telemetry for trigger zone-matching verification",
                "Aggregated order counts — zero individual order, customer, or restaurant data is collected",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </DsaSection>

          <DsaSection number="3" title="Purpose limitation (DPDP 2023 §4)">
            Data collected is used strictly to verify parametric disruption eligibility and compute your Reliability Score (R). Data is never sold, transferred to third parties, or utilized for targeted advertising.
          </DsaSection>

          <DsaSection number="4" title="Retention schedule">
            Shift delivery activity telemetry is retained for 90 days following conclusion of the policy period. Historical score computations are stored securely for premium customization.
          </DsaSection>

          <DsaSection number="5" title="Data principal rights">
            Under the Digital Personal Data Protection Act, 2023, you retain full rights to request summary reports of stored data, profile corrections, or complete erasure via account settings.
          </DsaSection>

          <DsaSection number="6" title="Grievance contact">
            DPDP Grievance Officer: <span className="text-accent-400 font-mono">privacy@vero-safeguard.in</span>.
          </DsaSection>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-600/80 shrink-0">
          <button onClick={onClose} className="btn-primary">
            I understand &amp; close
          </button>
        </div>
      </div>
    </div>
  )
}

function DsaSection({ number, title, children }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-ink-100 flex items-center gap-1.5">
        <span className="text-accent-400 font-mono">{number}.</span>
        <span>{title}</span>
      </h4>
      <div className="text-xs text-ink-400 leading-relaxed pl-3.5">
        {children}
      </div>
    </div>
  )
}
