import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn() },
}))
vi.mock('@/lib/db/schema', () => ({
  feedback: {},
}))

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { POST } from '@/app/api/feedback/route'

type AuthResult = Awaited<ReturnType<typeof auth>>

const mockAuth = (userId: string | null) =>
  vi.mocked(auth).mockResolvedValue({ userId } as unknown as AuthResult)

const mockInsert = () => {
  const values = vi.fn().mockResolvedValue(undefined)
  vi.mocked(db.insert).mockReturnValue({ values } as ReturnType<typeof db.insert>)
  return values
}

const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth(null)
    const res = await POST(makeRequest({ message: 'Hello world this is feedback', page: '/dashboard' }))
    expect(res.status).toBe(401)
  })

  it('returns 422 when message is too short (< 10 chars)', async () => {
    mockAuth('user_123')
    const res = await POST(makeRequest({ message: 'short', page: '/dashboard' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when message is too long (> 500 chars)', async () => {
    mockAuth('user_123')
    const res = await POST(makeRequest({ message: 'x'.repeat(501), page: '/dashboard' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when page is missing', async () => {
    mockAuth('user_123')
    const res = await POST(makeRequest({ message: 'Valid feedback message here' }))
    expect(res.status).toBe(422)
  })

  it('returns 201 and inserts row on valid payload', async () => {
    mockAuth('user_123')
    const values = mockInsert()
    const res = await POST(makeRequest({ message: 'Valid feedback message here', page: '/dashboard' }))
    expect(res.status).toBe(201)
    const json = await res.json() as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(values).toHaveBeenCalledWith({
      userId: 'user_123',
      message: 'Valid feedback message here',
      page: '/dashboard',
    })
  })
})
