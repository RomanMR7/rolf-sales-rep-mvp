import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const localDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://superuser:superpassword@localhost:54329/rolf_sales_rep_mvp?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: localDatabaseUrl,
  },
})
