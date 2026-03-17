import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

const FeedbackSchema = z.object({
  message: z.string().min(10, 'Message too short').max(500, 'Message too long'),
  page: z.string().min(1),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  await db.insert(feedback).values({
    userId,
    message: parsed.data.message,
    page: parsed.data.page,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
