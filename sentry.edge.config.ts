import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://3a47c0b06fea8fa7b7055eacdbe6ae82@o4511060888256512.ingest.de.sentry.io/4511060895727696',
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
})
