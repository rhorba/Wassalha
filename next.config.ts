import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// next-safe uses CJS module.exports — import via require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextSafe = require('next-safe') as (options?: {
  isDev?: boolean
  contentSecurityPolicy?: Record<string, string | string[]> | false
  frameOptions?: string | false
  referrerPolicy?: string | false
  xssProtection?: string | false
}) => { key: string; value: string }[]

const isDev = process.env.NODE_ENV !== 'production'

const securityHeaders = nextSafe({
  isDev,
  contentSecurityPolicy: isDev ? false : {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // required by Next.js inline scripts
      'https://accounts.clerk.dev',
      'https://*.clerk.accounts.dev',
      'https://js.stripe.com',
      'https://app.posthog.com',
      'https://us-assets.i.posthog.com',
    ],
    'connect-src': [
      "'self'",
      'https://*.clerk.dev',
      'https://*.clerk.com',
      'https://*.clerk.accounts.dev',
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.stripe.com',
      'https://app.posthog.com',
      'https://us.i.posthog.com',
      'https://us-assets.i.posthog.com',
      'https://*.sentry.io',
      'https://maps.googleapis.com',
    ],
    'frame-src': [
      "'self'",
      'https://accounts.clerk.dev',
      'https://js.stripe.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://img.clerk.com',
    ],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"], // Tailwind inline styles
    'worker-src': ["'self'", 'blob:'],
  },
})

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
