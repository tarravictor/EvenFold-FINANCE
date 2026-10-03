# EvenFold Finance upgrade audit, October 3, 2026

## Architecture
GitHub Pages hosts the static app. Supabase Auth and a row of JSONB per user store cloud records; Row Level Security restricts each owner. All amounts are PHP. Income remains removed from the UI. No bank integration or analytics was introduced.

## Shipped in this upgrade
- Responsive design at 320, 390, 768, and 1440 pixels: 16px forms, 44px controls, scalable layout, focus rings, reduced-motion handling, dark mode, dedicated navigation, and a Settings view.
- Fold companion with distinct visual stages, budget-based mood, logging streak, optional play, and a cloud-saved purchase journal. No invented health score. It never dies.
- Monthly category limits, manual recurring expense schedules (posting requires explicit approval), and separate debt balances ordered by smallest balance or highest interest.
- Custom expense categories and manual USD/EUR/JPY/SGD/AUD conversion at entry. Original amount and conversion rate remain attached to each entry; totals and reports use PHP.
- Optional bill reminders use the Notification API when the app is open and permission was granted.
- Search, paginated entries, mobile gestures, and confirmations for edits and new finance records.
- Weekly, monthly, and yearly PDF/JPG reports. CSV import uses a worker, validates rows, and skips identical imports. CSV exports protect spreadsheet formula cells.
- PWA manifest and service worker for the static shell. Opt-in account-scoped IndexedDB snapshot for offline reading. Offline edits remain disabled. Sign-out clears the current account's snapshot.
- Encrypted JSON backup/restore with PBKDF2-SHA256 and AES-GCM, a 5 MB import limit, strict validation, confirmation, and version-checked replacement.
- Supabase table RLS and owner policies inspected. Excess TRUNCATE, REFERENCES, and TRIGGER permissions revoked from authenticated. Production dependency audit reports zero advisories after patched lockfile update.

## Verified
TypeScript and Pages production build pass. Synthetic browser tests navigate 12 screens at each of four viewport widths with no horizontal overflow or uncaught exceptions. At 390 pixels, browser tests save a category limit, create and post a recurring expense, add a custom category and manual USD rate, save a converted entry, export CSV, create an encrypted backup, reject a bad passphrase, preview restore, and reload offline with the snapshot. Local encryption validation includes corrupt-file and unknown-field rejection. Service worker excludes Supabase responses.

## Limits and owner tasks
- Real device testing and Lighthouse scores have not been measured. Main app JavaScript is approximately 142 KB gzip, CSS about 31 KB gzip; extra chunks load for CSV and reports. The original total-JS 150 KB target is not met.
- The live restore operation and account deletion were not exercised because they would overwrite or delete a real account. The tests use synthetic data and a mocked API.
- Offline snapshots are unencrypted in device IndexedDB. Use only on a trusted device. The browser-stored Auth session is also available to scripts in this origin. Cloud edits do not queue offline; this prevents silent conflicts.
- The privacy notice needs a real privacy contact address. Do not claim RA 10173 certification. The Supabase advisor reports leaked-password protection disabled; enable it in the project's Auth dashboard.
- Automatic bank CSV format mapping, native push notifications when the app is closed, and an automated debt payoff forecast are not shipped. Browser notifications work only while the app is open. USD/EUR/JPY/SGD/AUD conversion uses a user-entered rate; the app never fetches a live quote.
- A complete historic secret scan, live cross-account access test, and real-device accessibility audit remain outstanding.
