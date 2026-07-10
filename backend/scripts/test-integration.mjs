import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertTestDatabaseUrl,
  composeEnv,
  composeProjectName,
  defaultTestDatabaseUrl,
  postgresPortFromDatabaseUrl,
} from '../../scripts/repo-env.mjs'

const backendRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repositoryRoot = resolve(backendRoot, '..')
const databaseUrl = await resolveTestDatabaseUrl()
assertTestDatabaseUrl(databaseUrl)
const dockerEnv = composeEnv({
  POSTGRES_TEST_PORT: postgresPortFromDatabaseUrl(databaseUrl),
})
const composeArgs = ['compose', '-p', composeProjectName]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? backendRoot,
    env: options.env ?? process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function resolveTestDatabaseUrl() {
  const exampleDatabaseUrl = defaultTestDatabaseUrl('54330')
  if (process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL !== exampleDatabaseUrl) {
    return process.env.TEST_DATABASE_URL
  }

  return defaultTestDatabaseUrl(String(await findOpenPort()))
}

function findOpenPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') {
          resolvePort(address.port)
          return
        }

        reject(new Error('Could not allocate an open TCP port'))
      })
    })
  })
}

async function waitForComposePostgres(service, database, env) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [...composeArgs, 'exec', '-T', service, 'pg_isready', '-U', 'superuser', '-d', database],
      {
        cwd: repositoryRoot,
        env,
        stdio: 'ignore',
      },
    )

    if (result.status === 0) {
      return
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  }

  process.stderr.write(`Timed out waiting for Docker Compose service "${service}"\n`)
  process.exit(1)
}

const env = {
  ...dockerEnv,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
}

if (process.env.TEST_SKIP_DOCKER !== '1') {
  run('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], {
    cwd: repositoryRoot,
    env,
  })
  run('docker', [...composeArgs, 'up', '-d', 'postgres_test'], {
    cwd: repositoryRoot,
    env,
  })
  await waitForComposePostgres('postgres_test', 'rolf_sales_rep_mvp_test', env)
}

run('bun', ['run', 'prisma:generate'], { env })
run('bun', ['run', 'prisma:deploy'], { env })
run('bun', ['test', 'src/auth/auth.integration.test.ts'], { env })
