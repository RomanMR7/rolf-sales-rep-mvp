import { lookup } from 'node:dns/promises'
import { existsSync } from 'node:fs'
import { connect } from 'node:net'

import { createPrisma } from '../src/db'

const databaseUrl = Bun.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required for startup diagnostics.')
  process.exit(1)
}

let parsedUrl: URL
try {
  parsedUrl = new URL(databaseUrl)
} catch {
  console.error('DATABASE_URL is not a valid URL.')
  process.exit(1)
}

const host = parsedUrl.hostname
const port = Number(parsedUrl.port || '5432')
const databaseName = parsedUrl.pathname.replace(/^\//, '') || '(missing)'
const schemaName = parsedUrl.searchParams.get('schema') ?? '(missing)'

console.log(`Current directory: ${process.cwd()}`)
console.log(`Bun version: ${Bun.version}`)
console.log(`Node version from Bun runtime: ${process.version}`)
console.log(`backend/prisma/schema.prisma exists: ${existsSync('backend/prisma/schema.prisma') ? 'yes' : 'no'}`)
console.log(`backend/prisma.config.ts exists: ${existsSync('backend/prisma.config.ts') ? 'yes' : 'no'}`)
console.log(`Database hostname: ${host}`)
console.log(`Database port: ${port}`)
console.log(`Database name: ${databaseName}`)
console.log(`Database schema parameter: ${schemaName}`)

await checkDns(host)
await checkTcp(host, port)
await checkPrismaSelectOne(databaseUrl)

async function checkDns(hostname: string) {
  try {
    const addresses = await lookup(hostname, { all: true })
    const rendered = addresses.map((address) => `${address.address}/${address.family}`).join(', ')
    console.log(`DNS resolution for database hostname: ${rendered}`)
  } catch (error) {
    console.error(`DNS resolution for database hostname failed: ${formatError(error)}`)
    process.exit(1)
  }
}

async function checkTcp(hostname: string, targetPort: number) {
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host: hostname, port: targetPort })
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Timed out connecting to ${hostname}:${targetPort}`))
    }, 10_000)

    socket.once('connect', () => {
      clearTimeout(timeout)
      socket.end()
      console.log(`TCP connection to database ${hostname}:${targetPort}: ok`)
      resolve()
    })

    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  }).catch((error) => {
    console.error(`TCP connection to database failed: ${formatError(error)}`)
    process.exit(1)
  })
}

async function checkPrismaSelectOne(connectionString: string) {
  const prisma = createPrisma(connectionString)
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('Prisma SELECT 1 diagnostic: ok')
  } catch (error) {
    console.error(`Prisma SELECT 1 diagnostic failed: ${formatError(error)}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  return String(error)
}
