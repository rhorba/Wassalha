# Phase 7 — Test Plan

## Unit Tests

### 1. Zod validation — `UserProfilePatchSchema`
**File:** `src/lib/validations/__tests__/users.test.ts`
**Covers:** Partial schema accepts valid subsets; rejects bad phone; rejects short address; empty object passes (patch allows any subset).

### 2. Service layer — `getUserProfile` + `updateUserProfile`
**File:** `src/lib/services/__tests__/users.test.ts`
**Covers:** `getUserProfile` returns correct columns; `updateUserProfile` sets `updatedAt`; unknown userId returns undefined.

### 3. Hook — `useUserProfile` + `useUpdateUserProfile`
**File:** `src/hooks/__tests__/use-user-profile.test.ts`
**Covers:** Query fetches `/api/users/me`; mutation PATCHes and invalidates cache on success; throws on non-OK response.

## Integration Tests

### 4. `GET /api/users/me`
**File:** `src/app/api/users/me/__tests__/route.test.ts`
**Covers:** 401 when unauthenticated; 200 + profile data when authenticated; 404 when user not in DB.

### 5. `PATCH /api/users/me`
**File:** `src/app/api/users/me/__tests__/route.test.ts` (same file)
**Covers:** 401 unauthenticated; 422 with Zod issues on invalid phone; 200 + updated data on valid partial patch.
