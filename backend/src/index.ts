import { createApp } from './app'
import { createBackendRuntime } from './runtime'
import { ensureTelegramWebhook } from './telegram/webhookSetup'

const runtime = createBackendRuntime()
const app = createApp({ env: runtime.env, prisma: runtime.prisma })

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: runtime.env.PORT,
  fetch: app.fetch,
})

console.log(`Backend listening on ${server.url}`)

void ensureTelegramWebhook(runtime.env).catch((error: unknown) => {
  console.error('[telegram] Webhook auto-setup crashed', error instanceof Error ? error.message : String(error))
})

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true

  console.log(`Backend received ${signal}; shutting down`)
  await server.stop(true)
  await runtime.close()
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
