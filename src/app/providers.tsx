'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

function PostHogInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (key) {
      posthog.init(key, {
        api_host: 'https://eu.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
      })
    }
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <PostHogInit>{children}</PostHogInit>
    </QueryClientProvider>
  )
}
