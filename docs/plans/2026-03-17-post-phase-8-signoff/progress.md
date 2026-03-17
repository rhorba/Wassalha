# Execution Progress

**Plan:** `docs/plans/2026-03-17-post-phase-8-signoff/plan.md`
**Last updated:** 2026-03-17

## Status

| Task | Title | Status |
|------|-------|--------|
| 1 | Document Clerk E2E test user setup | ✅ completed |
| 2 | Phase 8 manual smoke tests | ✅ completed |
| 3 | Phase 6 deferred smoke tests (S10 + S11) | ✅ completed |
| 4 | Phase 3 manual smoke tests | ✅ completed |
| 5 | Phase 4 manual smoke tests | ✅ completed |
| 6 | Phase 1 — formally log smoke tests | ✅ completed |
| 7 | Update README.md | ✅ completed |
| 8 | Update CLAUDE.md | ✅ completed |
| 9 | Final commit + push | ✅ completed |

---

## Manual Checklist — Do Before Beta Launch

All automated work is done. The following requires your manual action.

### Priority 1 — App works at all

- [ ] Set `DATABASE_URL` in `.env.local` (Neon.tech or Supabase → project → connection string)
- [ ] Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (dashboard.clerk.com → API Keys)
- [ ] Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (console.cloud.google.com → APIs → Maps JavaScript API → Credentials)
- [ ] Register Clerk webhook:
  - Clerk dashboard → Webhooks → Add endpoint → `https://your-domain.vercel.app/api/webhooks/clerk`
  - Subscribe to: `user.created`, `user.updated`, `user.deleted`
  - Copy signing secret → `CLERK_WEBHOOK_SECRET` in `.env.local`

### Priority 2 — Stripe billing (P6 S11 smoke test)

- [ ] Set `STRIPE_SECRET_KEY=sk_test_...` (dashboard.stripe.com → Test mode → Developers → API Keys → Reveal)
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (same page)
- [ ] Register Stripe webhook:
  - Stripe → Developers → Webhooks → Add endpoint → `https://your-domain.vercel.app/api/webhooks/stripe`
  - Subscribe to: `invoice.paid`
  - Copy signing secret → `STRIPE_WEBHOOK_SECRET`
  - For local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] **Run P6 S11**: sign in as admin → `/admin/billing` → "Générer facture" → verify toast + invoice appears in history
- [ ] **Run P6 S10**: find/create a retailer with 0 MAD pending → verify "Générer facture" button is disabled with tooltip

### Priority 3 — E2E tests (Playwright)

- [ ] Create Clerk test user — **retailer**:
  - Clerk dashboard → Users → Create user
  - Email: `retailer+clerk_test@yourdomain.com` (must end in `+clerk_test`)
  - No `publicMetadata.role`
- [ ] Create Clerk test user — **admin**:
  - Same, email: `admin+clerk_test@yourdomain.com`
  - Public metadata: `{"role":"admin"}`
- [ ] Set in `.env.local`: `E2E_RETAILER_EMAIL` + `E2E_ADMIN_EMAIL`
- [ ] Add both as GitHub repo secrets (Settings → Secrets → Actions)
- [ ] Run `pnpm test:e2e` and verify all 5 specs pass

### Priority 4 — Deploy to Vercel

- [ ] Run `vercel --prod`
- [ ] Set all env vars in Vercel dashboard → project → Settings → Environment Variables
- [ ] Verify Clerk + Stripe webhook URLs point to deployed domain (not localhost)

### Priority 5 — Phase 8 smoke tests (best run after deploy)

- [ ] **S1**: DevTools → Network → Response Headers → verify `Content-Security-Policy` present
- [ ] **S2**: `/dashboard` → feedback button visible bottom-right → click → popover opens
- [ ] **S3**: Feedback form → type 5 chars → submit → validation error shown
- [ ] **S4**: Feedback form → type valid message → submit → toast "Feedback sent!"
- [ ] **S8**: Browser console → inject script from unknown domain → CSP blocks it

### Priority 6 — Monitoring (before opening to beta users)

- [ ] **Sentry**:
  - sentry.io → Create project (Next.js) → copy DSN → `NEXT_PUBLIC_SENTRY_DSN`
  - sentry.io → Settings → Auth Tokens → Create → `SENTRY_AUTH_TOKEN`
  - Set `SENTRY_ORG` (your org slug) + `SENTRY_PROJECT` (e.g. `wassalha`)
- [ ] **PostHog**:
  - posthog.com → Create project → copy API key → `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] **Upstash** (rate limiting):
  - upstash.com → Create database → REST API tab → copy URL + token
  - Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  - After setting, re-run **P8 S6**: submit compare form 21× quickly → verify 429 response

### Priority 7 — GitHub CI secrets

Add these to GitHub repo → Settings → Secrets and variables → Actions:

- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `E2E_RETAILER_EMAIL`
- [ ] `E2E_ADMIN_EMAIL`
- [ ] `SENTRY_AUTH_TOKEN`
- [ ] `SENTRY_ORG`
- [ ] `SENTRY_PROJECT`

### Optional (for full feature parity)

- [ ] `RESEND_API_KEY` (resend.com → API Keys → free tier) — booking confirmation emails
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — real-time tracking
- [ ] `CRON_SECRET` — generate with `openssl rand -hex 32`, protects `/api/cron/tracking`
- [ ] `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_ID` — recipient SMS on booking
- [ ] Carrier API keys (Amana, CTM, Marocolis, Sendex) — Aramex mock works locally without keys
