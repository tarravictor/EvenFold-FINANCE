# EvenFold FINANCE: Supabase + GitHub Pages

This repository has a static React build (`pnpm build:pages`) for GitHub Pages. The current Sites app continues to use its private D1 database; its records are **not** copied to Supabase by this build. The previous sample records have been removed from the server source. Exclude the Sites-only API and metadata from the public deployment repository, or publish only a clean deployment branch.

1. Create a dedicated Supabase project in the preferred organization and region. Apply `supabase/migrations/20260930000000_evenfold_finance.sql` there. Check that RLS is enabled and test access with two different authenticated users.
2. In Supabase Auth, enable email/password signup, require email confirmation, set the Site URL to the final Pages URL, and allow that URL as a redirect URL. Set up a working email sender before broad public signup. The signup, sign-in, and token refresh forms use Supabase Auth; use only a *publishable* key in the client.
3. Create a dedicated GitHub repository. Add the project files after excluding `.openai`, `.sites-runtime`, generated archives, and `app/api/finance/route.ts`. Configure Pages source as **GitHub Actions**. Add repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Add `VITE_PRIVACY_CONTACT` after the operator approves the email address; registration remains closed without it. Their values appear in the compiled public JavaScript, by design.
4. Push to `main`; the workflow builds `pages-dist` and deploys it. GitHub project Pages uses the repository name as its base path. Test account confirmation, sign-in/out, two-account isolation, all tracker actions, and exports on the published URL.
5. Before enabling registration, provide the privacy contact and confirm the account deletion process and legal terms. Review privacy obligations with qualified counsel. The on-screen privacy notice currently marks account deletion and contact as pending.

Existing D1 account records need a deliberate, private migration with the account owner's consent and a reliable identity mapping. Do not place an export in Git history or a Pages artifact.
