# W9 Test Plan — notifications + audit_logs + Web Push

## Automated Tests

### Unit tests
| # | Name | File | Covers |
|---|------|------|--------|
| U1 | `logAuditEvent` inserts a row | `src/lib/services/__tests__/audit.test.ts` | Happy path insert |
| U2 | `logAuditEvent` never throws on DB error | same | Fire-and-forget safety |
| U3 | `sendWebPushToUser` skips when VAPID keys absent | `src/lib/notifications/__tests__/web-push.test.ts` | Early return guard |
| U4 | `sendWebPushToUser` removes stale 410 subscription | same | Stale sub cleanup |

### API route tests
| # | Name | File | Covers |
|---|------|------|--------|
| A1 | `GET /api/push/vapid-public-key` returns 401 when unauthenticated | `src/app/api/push/__tests__/push.test.ts` | Auth guard |
| A2 | `GET /api/push/vapid-public-key` returns 503 when key missing | same | Missing env graceful |
| A3 | `GET /api/push/vapid-public-key` returns 200 with key | same | Happy path |
| A4 | `POST /api/push/subscribe` returns 401 when unauthenticated | same | Auth guard |
| A5 | `POST /api/push/subscribe` returns 400 on invalid body | same | Zod validation |
| A6 | `POST /api/push/subscribe` returns 200 on valid body | same | Happy path upsert |
| A7 | `DELETE /api/push/subscribe` returns 401 when unauthenticated | same | Auth guard |
| A8 | `DELETE /api/push/subscribe` returns 200 on valid endpoint | same | Happy path delete |

## Manual-only smoke tests — ⏳ Deferred to next session

Require: `pnpm dev` running. S5–S10 also require VAPID keys in `.env.local`.

**Setup before running:**
```bash
npx web-push generate-vapid-keys
# Add to .env.local: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

| # | Test | Expected | Status |
|---|------|----------|--------|
| S1 | `/admin/audit-logs` as admin | Table renders | ⏳ |
| S2 | `/admin/audit-logs` as retailer | Redirects to `/dashboard` | ⏳ |
| S3 | Create a carrier in admin UI | Row with `carrier.create` in audit logs | ⏳ |
| S4 | Generate invoice in billing | Row with `invoice.generate` in audit logs | ⏳ |
| S5 | Click bell toggle in Chrome desktop | Browser permission prompt | ⏳ (VAPID) |
| S6 | Grant permission | Toast shown, DB row in `push_subscriptions` | ⏳ (VAPID) |
| S7 | Toggle off | DB row deleted, bell reverts | ⏳ (VAPID) |
| S8 | VAPID keys absent | Bell hidden (unsupported path) | ⏳ (VAPID) |
| S9 | Book a shipment | `notifications` row `channel=email` in DB | ⏳ |
| S10 | Cron poll with status change | `notifications` row `channel=web_push` in DB | ⏳ (VAPID) |
