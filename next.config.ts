import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const isDev = process.env.NODE_ENV !== 'production'

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.clerk.dev https://*.clerk.accounts.dev https://js.stripe.com https://eu-assets.i.posthog.com",
  "connect-src 'self' https://*.clerk.dev https://*.clerk.com https://*.clerk.accounts.dev https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.sentry.io https://maps.googleapis.com",
  "frame-src 'self' https://accounts.clerk.dev https://*.clerk.accounts.dev https://js.stripe.com",
  "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://img.clerk.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(isDev ? [] : [{ key: 'Content-Security-Policy', value: cspDirectives }]),
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: false,
})
