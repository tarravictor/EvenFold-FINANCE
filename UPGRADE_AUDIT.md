# EvenFold upgrade, October 3, 2026

## Architecture decision
Keep Supabase authentication and cloud finance records. No income UI. GitHub Pages remains the static host. Do not claim that data stays exclusively on a device. No banking credentials or account linking are introduced.

## First increment
- Optional Fold companion on the overview, with an accessible detail dialog and hide control.
- Mood uses the selected week's budget, not an assessment of the person's financial health.
- Growth uses currently recorded goal savings, with explicit PHP thresholds. Withdrawals can lower the displayed stage. No invented streak, bond, or discipline statistics.
- Weekly activity search matches merchant, category, and borrower.
- Ctrl/Cmd+K opens quick entry outside active dialogs.
- Deferred report import, 44px edit/delete targets, narrow-screen wrapping, focus rings, reduced motion, tabular money figures.

## Design direction
Keep the existing navigation and workflows. Forest/teal primary (#0F766E), gold companion accent (#EAB954), white surfaces, dark green text. Use 16px inputs, 44px controls, 8/12/16/24px spacing, and existing 640px/870px breakpoints. Companion is inline rather than another floating control competing with Add on mobile.

## Audit findings and remaining checks
1. Privacy notice still lacks a published administrator contact. Owner must provide a real address; do not invent one or claim legal compliance.
2. Auth tokens are persisted in localStorage. XSS prevention and a tested CSP remain important. No changes to authentication were made in this increment.
3. Source search found server-side secret-key references confined to the existing Edge Function, but a complete git-history secret scan was not performed.
4. Live RLS policies, account deletion behavior, and session revocation have not been verified in this increment.
5. Offline financial writes require account-scoped storage, conflict handling, sign-out cleanup, and an explicit sync state. Do not precache sensitive API responses.
6. Encrypted backup/import now includes strict versioned schema validation, a 5 MB import cap, AES-GCM, PBKDF2-SHA256 (600,000 iterations), preview, typed confirmation, and optimistic-version protection. Local encryption/validation checks passed; live restore and cross-device browser QA remain unverified. Passphrases are not uploaded or persisted by this feature.
7. Large lists still need pagination. Search currently covers the selected week only.
8. No Lighthouse or real-device audit has been completed. Build size alone does not establish performance or WCAG compliance.
9. Pet preference is session-only. No pet data is sent to a separate service; no analytics were added.
10. Full envelope budgets, multicurrency, recurring entries, and debt payoff tools remain future work, not shipped features.

## Verification
TypeScript and production Pages build passed. Main JS: approximately 112 KB gzip; CSS: 28 KB gzip. Export libraries are additional chunks, so total JS exceeds the brief's 150 KB target. Authenticated desktop/mobile visual QA remains required.

## Recommended roadmap
Latest increment: encrypted backup and restore UI under Reports; offline warning and an explicit no-queue save guard. This is not full offline/PWA support.
30 days: verify RLS and deletion/session behavior; publish privacy contact; browser tests at 320, 390, 768, 1440px; paginate activity; audit dependencies and history.
60 days: encrypted backups with validated restore; account-scoped IndexedDB; read-only offline shell and explicit connectivity UI; category budgets.
90 days: tested offline write reconciliation; optional persisted pet engagement; recurring entries; measured Lighthouse/accessibility remediation.
