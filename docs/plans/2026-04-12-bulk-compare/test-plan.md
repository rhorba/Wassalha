# Bulk Compare — Test Plan

## Unit Tests

### 1. Zod schema validation — `BulkCompareRowSchema`
**File:** `src/lib/validations/__tests__/bulk-compare.test.ts`
**Covers:** valid rows, coercion of string numbers, missing required fields, mode fallback, max 50 rows
**Expected:** valid rows parse; invalid rows surface correct error messages

### 2. Zod schema validation — `BulkCompareRequestSchema`
**File:** same file
**Covers:** globalMode default, empty rows array, >50 rows rejected
**Expected:** defaults to "balanced"; rejects empty; rejects >50

### 3. API route handler — `POST /api/carriers/compare/bulk`
**File:** `src/lib/services/__tests__/bulk-compare-route.test.ts`
**Covers:** 401 unauthenticated, 400 invalid body, partial row failure returns inline error, successful rows return `bestCarrier`
**Expected:** correct HTTP status codes and response shapes
