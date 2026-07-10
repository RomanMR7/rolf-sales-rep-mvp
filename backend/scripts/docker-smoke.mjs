import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import {
  assertTestDatabaseUrl,
  composeEnv,
  composeProjectName,
  defaultPostgresTestPort,
  defaultTestDatabaseUrl,
  postgresPortFromDatabaseUrl,
  repositoryHash,
  repositoryRoot,
} from '../../scripts/repo-env.mjs'

const imageName = process.env.BACKEND_DOCKER_SMOKE_IMAGE ?? 'rolf-sales-rep-mvp-backend:smoke'
const containerName =
  process.env.BACKEND_DOCKER_SMOKE_CONTAINER ??
  `rolf-sales-rep-mvp-backend-smoke-${repositoryHash}-${process.pid}`
const hostPort = process.env.BACKEND_DOCKER_SMOKE_PORT ?? String(await findOpenPort())
const networkName = `${composeProjectName}_default`
const composeArgs = ['compose', '-p', composeProjectName]
const databaseUrlForHost = await resolveTestDatabaseUrl()
const databaseUrlForContainer =
  process.env.BACKEND_DOCKER_SMOKE_DATABASE_URL ??
  'postgresql://superuser:superpassword@postgres_test:5432/rolf_sales_rep_mvp_test?schema=public'
assertTestDatabaseUrl(databaseUrlForHost)
assertTestDatabaseUrl(databaseUrlForContainer, {
  allowEnvName: 'BACKEND_DOCKER_SMOKE_ALLOW_NON_TEST_DATABASE',
})
const dockerEnv = composeEnv({
  POSTGRES_TEST_PORT: postgresPortFromDatabaseUrl(databaseUrlForHost),
})
const expectedStartupLogs = [
  'Checking DATABASE_URL...',
  'Running startup diagnostics...',
  'node --version:',
  'Prisma CLI entrypoint exists: node_modules/prisma/build/index.js',
  'Prisma CLI version:',
  'Database hostname:',
  'DNS resolution for database hostname:',
  'TCP connection to database',
  'Prisma SELECT 1 diagnostic: ok',
  'Startup diagnostics completed.',
  'Running Prisma migrations...',
  'Prisma migrate deploy exit code: 0',
  'Prisma migrations completed.',
  'Running seed...',
  'Seed completed.',
  'Starting backend...',
]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
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
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port)
          return
        }

        reject(new Error('Could not allocate an open TCP port'))
      })
    })
  })
}

async function waitForComposePostgres() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        ...composeArgs,
        'exec',
        '-T',
        'postgres_test',
        'pg_isready',
        '-U',
        'superuser',
        '-d',
        'rolf_sales_rep_mvp_test',
      ],
      {
        cwd: repositoryRoot,
        env: dockerEnv,
        stdio: 'ignore',
      },
    )

    if (result.status === 0) {
      return
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  }

  process.stderr.write('Timed out waiting for postgres_test\n')
  process.exit(1)
}

async function waitForHealth() {
  const url = `http://127.0.0.1:${hostPort}/health`

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        process.stdout.write(`Backend Docker smoke passed: ${url}\n`)
        return
      }
    } catch {
      // Retry until the container finishes booting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000))
  }

  process.stderr.write(`Timed out waiting for ${url}\n`)
  run('docker', ['logs', containerName])
  process.exit(1)
}

async function smokeAuthApi() {
  const baseUrl = `http://127.0.0.1:${hostPort}`
  const email = `docker-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
    },
    body: JSON.stringify({
      email,
      password: 'password123',
      displayName: 'Docker Smoke',
    }),
  })

  if (register.status !== 201) {
    throw new Error(`Register failed with HTTP ${register.status}: ${await register.text()}`)
  }

  const registerBody = await register.json()
  if (!registerBody.accessToken || !registerBody.refreshToken) {
    throw new Error('Register response did not include mobile auth tokens')
  }

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${registerBody.accessToken}`,
    },
  })

  if (me.status !== 200) {
    throw new Error(`/me failed with HTTP ${me.status}: ${await me.text()}`)
  }

  process.stdout.write('Backend Docker DB-backed auth smoke passed\n')
}

run('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], { env: dockerEnv })
run('docker', [...composeArgs, 'up', '-d', 'postgres_test'], { env: dockerEnv })
await waitForComposePostgres()

run('docker', ['build', '-f', 'backend/Dockerfile', '-t', imageName, '.'])
spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })

function runBackendContainer() {
  run('docker', [
    'run',
    '--rm',
    '-d',
    '--name',
    containerName,
    '--network',
    networkName,
    '-p',
    `${hostPort}:3000`,
    '-e',
    'PORT=3000',
    '-e',
    `DATABASE_URL=${databaseUrlForContainer}`,
    '-e',
    'JWT_SECRET=docker-smoke-secret-at-least-thirty-two-characters',
    '-e',
    'CORS_ORIGINS=http://localhost:45174',
    '-e',
    'COOKIE_SECURE=false',
    imageName,
  ])
}

function assertStartupLogs() {
  const result = spawnSync('docker', ['logs', containerName], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  const logs = `${result.stdout}\n${result.stderr}`
  for (const expectedLog of expectedStartupLogs) {
    if (!logs.includes(expectedLog)) {
      process.stderr.write(`Backend Docker startup log did not include: ${expectedLog}\n`)
      process.stderr.write(logs)
      process.exit(1)
    }
  }

  process.stdout.write('Backend Docker startup logs smoke passed\n')
}

function assertMigrationFailureIsVisible() {
  const result = spawnSync('docker', [
    'run',
    '--rm',
    '--network',
    networkName,
    '-e',
    'PORT=3000',
    '-e',
    'DATABASE_URL=postgresql://superuser:wrong-password@postgres_test:5432/rolf_sales_rep_mvp_test?schema=public',
    '-e',
    'JWT_SECRET=docker-smoke-secret-at-least-thirty-two-characters',
    '-e',
    'CORS_ORIGINS=http://localhost:45174',
    '-e',
    'COOKIE_SECURE=false',
    imageName,
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  const logs = `${result.stdout}\n${result.stderr}`
  if (result.status === 0) {
    process.stderr.write('Expected backend Docker startup to fail with invalid database credentials.\n')
    process.stderr.write(logs)
    process.exit(1)
  }

  const expectedFailureLogs = [
    'Prisma SELECT 1 diagnostic failed:',
  ]
  for (const expectedLog of expectedFailureLogs) {
    if (!logs.includes(expectedLog)) {
      process.stderr.write(`Backend Docker failure log did not include: ${expectedLog}\n`)
      process.stderr.write(logs)
      process.exit(1)
    }
  }

  process.stdout.write('Backend Docker failure diagnostics smoke passed\n')
}

function assertMigrationWrapperFailureIsVisible() {
  const result = spawnSync('docker', [
    'run',
    '--rm',
    imageName,
    'sh',
    '-lc',
    [
      'set +e',
      'node node_modules/prisma/build/index.js migrate deploy --config backend/missing-prisma.config.ts --schema backend/prisma/schema.prisma 2>&1',
      'MIGRATION_EXIT_CODE=$?',
      'set -e',
      'echo "Prisma migrate deploy exit code: $MIGRATION_EXIT_CODE"',
      'if [ "$MIGRATION_EXIT_CODE" -eq 0 ]; then exit 1; fi',
    ].join('; '),
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  const logs = `${result.stdout}\n${result.stderr}`
  if (result.status !== 0) {
    process.stderr.write('Expected migration wrapper visibility check to finish after observing a non-zero migration exit.\n')
    process.stderr.write(logs)
    process.exit(result.status ?? 1)
  }

  for (const expectedLog of [
    'backend/missing-prisma.config.ts',
    'Prisma migrate deploy exit code:',
  ]) {
    if (!logs.includes(expectedLog)) {
      process.stderr.write(`Migration wrapper failure log did not include: ${expectedLog}\n`)
      process.stderr.write(logs)
      process.exit(1)
    }
  }

  process.stdout.write('Backend Docker migration failure visibility smoke passed\n')
}

try {
  runBackendContainer()
  await waitForHealth()
  assertStartupLogs()
  await smokeAuthApi()
  spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })

  process.stdout.write('Restarting backend Docker smoke container to verify idempotent startup\n')
  runBackendContainer()
  await waitForHealth()
  assertStartupLogs()
  process.stdout.write('Backend Docker idempotent restart smoke passed\n')

  assertMigrationFailureIsVisible()
  assertMigrationWrapperFailureIsVisible()
} finally {
  spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })
}
