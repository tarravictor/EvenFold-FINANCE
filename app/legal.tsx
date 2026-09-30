"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type LegalTopic = "privacy" | "terms" | null;

export function LegalDialog({ topic, onClose }: { topic: LegalTopic; onClose: () => void }) {
  return <Dialog open={topic !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="legal-dialog">
      <DialogHeader><DialogTitle>{topic === "privacy" ? "Privacy notice" : "Terms and conditions"}</DialogTitle><DialogDescription>EvenFold FINANCE · Last updated September 30, 2026</DialogDescription></DialogHeader>
      {topic === "privacy" ? <div className="legal-copy">
        <p>EvenFold FINANCE is a personal finance tracker developed by Victor Tarra &amp; Codex. This notice describes how the app handles your information in the context of the Philippines’ Data Privacy Act of 2012 (Republic Act No. 10173). It does not claim a certification of compliance.</p>
        <h3>What you provide</h3><p>Account registration may collect your email address and authentication details. You can enter expenses, budgets, goals, bills, names of borrowers or group members, split amounts, and payment statuses. Please tell people whose names you add when appropriate, and enter only what you need. A payment QR image is processed in your browser to create a downloadable JPG; the app does not upload or save that image.</p>
        <h3>Purpose and access</h3><p>The app uses your data to show your tracker, calculate balances and reports, and secure your account. Each signed-in account should be able to access only its own finance records. Hosting and database providers may process information to provide the service. We do not use your records for advertising or sell them.</p>
        <h3>Retention and your choices</h3><p>Finance records remain until you delete them or request account deletion. Download a report for your records before deleting data. You may request access, correction, deletion or a copy of your personal data, object to processing where applicable, and raise a privacy concern under RA 10173. Account deletion and a dedicated privacy contact must be confirmed before public launch.</p>
        <h3>Security and updates</h3><p>Use a strong password and keep your device secure. No online service can promise absolute security. If these practices materially change, the notice will be updated here with a new date.</p>
        <p className="legal-source">Learn about your rights at the <a href="https://privacy.gov.ph/data-subject-rights/" target="_blank" rel="noreferrer">National Privacy Commission</a> and read <a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noreferrer">RA 10173</a>.</p>
      </div> : <div className="legal-copy">
        <p>By using EvenFold FINANCE, you agree to use it for lawful personal record keeping and to provide accurate account information. You are responsible for access to your account and for the information you choose to enter about other people.</p>
        <h3>Financial records</h3><p>The app calculates totals and equal group shares from the amounts you enter. Check the figures before sending payment requests or making decisions. A bill marked paid does not automatically add an expense, and a split is tracked separately from spending. The app is a tracking tool, not a bank, payment processor, or financial adviser.</p>
        <h3>Exports and availability</h3><p>PDF and JPG reports and split images are generated for your convenience. Protect downloaded files and QR images when sharing them. Features may change or become unavailable; keep your own backup of records you need.</p>
        <h3>Acceptable use and changes</h3><p>Do not attempt to access another account or interfere with the service. These terms may be revised as the app evolves. Continued use after an updated version takes effect means you accept that version. If you disagree, stop using the app and request deletion of your account and records.</p>
      </div>}
    </DialogContent>
  </Dialog>;
}
