# Future Sprints Design — Post-W8 Features
**Date:** 2026-03-18
**Scope:** notifications table + audit_logs table + Web Push status alerts
**Mapbox:** Dropped — not needed.

---

## Overview

Three features delivered as one sprint. The `notifications` table is a shared dependency — it logs every outbound notification (email, WhatsApp, web_push) and is written to by all three notification services.

```
notifications table ──► updated email.ts
                    ──► updated whatsapp.ts
                    ──► new web-push.ts ──► cron/tracking trigger
push_subscriptions  ──► new /api/push/* routes ──► useWebPush hook ──► bell toggle UI

audit_logs table    ──► new audit.ts service ──► inline at carrier/invoice/role/shipment write sites
                    ──► new admin/audit-logs RSC page
```

---

## Schema & Migrations (migration 0008)

### `notifications` — `src/lib/db/schema/notifications.ts`

```ts
pgEnum("notification_channel", ["email", "whatsapp", "web_push"])
pgEnum("notification_status",  ["sent", "failed"])

notifications {
  id:         uuid        PK  defaultRandom()
  shipmentId: uuid        NOT NULL  FK → shipments (cascade delete)
  channel:    notification_channel  NOT NULL
  status:     notification_status   NOT NULL
  createdAt:  timestamp   NOT NULL  defaultNow()
}
```

### `audit_logs` — `src/lib/db/schema/audit-logs.ts`

```ts
audit_logs {
  id:         uuid  PK  defaultRandom()
  actorId:    text  NOT NULL   -- Clerk user ID
  actorRole:  text  NOT NULL   -- "admin" | "retailer"
  action:     text  NOT NULL   -- see action registry below
  targetType: text  NOT NULL   -- "carrier" | "invoice" | "user" | "shipment"
  targetId:   text  NOT NULL   -- UUID or Clerk user ID
  createdAt:  timestamp NOT NULL defaultNow()
}
```

**Action registry:**
| action | targetType | trigger site |
|---|---|---|
| `carrier.create` | `carrier` | `POST /api/carriers` |
| `carrier.update` | `carrier` | `PUT /api/carriers/[id]` |
| `carrier.delete` | `carrier` | `DELETE /api/carriers/[id]` |
| `invoice.generate` | `invoice` | `POST /api/billing/invoices` |
| `role.change` | `user` | `webhooks/clerk/route.ts` |
| `shipment.cancel` | `shipment` | future cancel endpoint |
| `status.override` | `shipment` | future admin override |

### `push_subscriptions` — `src/lib/db/schema/push-subscriptions.ts`

```ts
push_subscriptions {
  id:        uuid  PK  defaultRandom()
  userId:    text  NOT NULL  FK → users (cascade delete)
  endpoint:  text  NOT NULL  UNIQUE
  p256dh:    text  NOT NULL
  auth:      text  NOT NULL
  createdAt: timestamp NOT NULL defaultNow()
}
```

`endpoint` unique constraint prevents duplicate subscriptions per browser.

---

## Environment Variables

```bash
VAPID_PUBLIC_KEY=...       # server-side signing
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@wassalha.ma
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # browser subscription
```

Generate once: `npx web-push generate-vapid-keys`

---

## API Layer

### New routes — `/api/push/`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/push/vapid-public-key` | user | Returns `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `POST` | `/api/push/subscribe` | user | Upserts `push_subscriptions` row |
| `DELETE` | `/api/push/subscribe` | user | Removes subscription by `endpoint` |

### New service — `src/lib/notifications/web-push.ts`

```ts
sendWebPushToUser(userId: string, payload: { title: string; body: string }): Promise<void>
```

- Queries `push_subscriptions` where `userId = userId`
- Calls `webpush.sendNotification()` for each subscription (parallel)
- On 410 Gone response from browser: auto-deletes stale subscription
- Inserts `notifications` row per send: `{ shipmentId, channel: "web_push", status: "sent" | "failed" }`
- Never throws — fire-and-forget, errors logged to console only

### New service — `src/lib/services/audit.ts`

```ts
logAuditEvent(params: {
  actorId:    string;
  actorRole:  string;
  action:     string;
  targetType: string;
  targetId:   string;
}): Promise<void>
```

- Inserts one `audit_logs` row
- Fire-and-forget — wrapped in try/catch, never propagates errors to caller
- Called inline at every admin write site (see action registry above)

### Updated services

**`src/lib/notifications/email.ts`**
After Resend API call → insert `notifications` row:
```ts
{ shipmentId, channel: "email", status: res.ok ? "sent" : "failed" }
```

**`src/lib/notifications/whatsapp.ts`**
After Graph API call → insert `notifications` row:
```ts
{ shipmentId, channel: "whatsapp", status: res.ok ? "sent" : "failed" }
```

### Push trigger in cron

`src/app/api/cron/tracking/route.ts` — after `pollActiveShipments` writes status changes:
- For each shipment whose status changed: call `sendWebPushToUser(shipment.userId, { title, body })`
- Title: `"Colis mis à jour"`, body: `"Votre envoi vers {city} est maintenant {status}"`

---

## Frontend

### Service Worker — `public/sw.js`

```js
self.addEventListener("push", (event) => {
  const { title, body } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
    })
  );
});
```

Static file — no build step, registered once on mount.

### Hook — `src/hooks/use-web-push.ts`

```ts
useWebPush(): {
  supported:   boolean;   // navigator.serviceWorker + PushManager available
  permission:  NotificationPermission;
  subscribed:  boolean;
  subscribe:   () => Promise<void>;
  unsubscribe: () => Promise<void>;
}
```

- `subscribe()`: requests permission → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })` → `POST /api/push/subscribe`
- `unsubscribe()`: `subscription.unsubscribe()` → `DELETE /api/push/subscribe`
- `subscribed` derived from `PushManager.getSubscription()` — no localStorage needed

### UI — Bell toggle in dashboard sidebar

**Location:** `src/app/(app)/(dashboard)/layout.tsx`

- `shadcn/ui` `Toggle` component (already available)
- Bell icon (`lucide-react`) + label "Notifications"
- Hidden entirely if `!supported`
- On first enable: `sonner` toast — *"Vous serez notifié des mises à jour de vos envois"*
- Toggled off: calls `unsubscribe()`

### Admin audit log page — `src/app/(app)/(dashboard)/admin/audit-logs/page.tsx`

- RSC (Server Component) — no TanStack hook, direct `db.select()` latest 100 rows ordered by `createdAt desc`
- `shadcn/ui` `Table` — columns: `Date | Acteur | Action | Cible`
- RBAC: `auth().sessionClaims?.publicMetadata.role === "admin"` check, else redirect `/dashboard`
- Linked from admin sidebar nav

---

## File Checklist

**New files:**
- `src/lib/db/schema/notifications.ts`
- `src/lib/db/schema/audit-logs.ts`
- `src/lib/db/schema/push-subscriptions.ts`
- `src/lib/db/schema/index.ts` — re-export 3 new schemas
- `src/lib/notifications/web-push.ts`
- `src/lib/services/audit.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/vapid-public-key/route.ts`
- `src/hooks/use-web-push.ts`
- `public/sw.js`
- `src/app/(app)/(dashboard)/admin/audit-logs/page.tsx`

**Modified files:**
- `src/lib/notifications/email.ts` — add notifications insert
- `src/lib/notifications/whatsapp.ts` — add notifications insert
- `src/app/api/cron/tracking/route.ts` — add web push trigger after status changes
- `src/app/api/carriers/route.ts` + `[id]/route.ts` — add `logAuditEvent` calls
- `src/app/api/billing/invoices/route.ts` — add `logAuditEvent` call
- `src/app/api/webhooks/clerk/route.ts` — add `logAuditEvent` on role sync
- `src/app/(app)/(dashboard)/layout.tsx` — add bell toggle
- `src/lib/db/schema/index.ts` — re-export new schemas
- `.env.example` — add VAPID vars
- `drizzle.config.ts` — no change needed (picks up schema/index.ts automatically)

**Migration:**
- `src/lib/db/migrations/0008_notifications_audit_push.sql` — generated via `pnpm db:generate`

---

## npm dependency

```bash
pnpm add web-push
pnpm add -D @types/web-push
```
