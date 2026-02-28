/**
 * Supabase リモートDB セットアップスクリプト
 * 全スキーマファイルを順番に実行する
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_URLS = [
  'postgresql://postgres.mjjkcyeopbiuirxiteub:q7tv3XpR5Tt049p1@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.mjjkcyeopbiuirxiteub:q7tv3XpR5Tt049p1@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.mjjkcyeopbiuirxiteub:q7tv3XpR5Tt049p1@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.mjjkcyeopbiuirxiteub:q7tv3XpR5Tt049p1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.mjjkcyeopbiuirxiteub:q7tv3XpR5Tt049p1@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
]

async function findWorkingConnection() {
  const { default: pg } = await import('pg')

  for (const url of DB_URLS) {
    const host = url.match(/@(.+?):/)?.[1] || 'unknown'
    console.log(`Testing: ${host}...`)
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
    try {
      await client.connect()
      const res = await client.query('SELECT current_database() as db')
      console.log(`[OK] Connected! Database: ${res.rows[0].db}`)
      await client.end()
      return url
    } catch (error) {
      console.log(`  -> Failed: ${error.message}`)
      try { await client.end() } catch {}
    }
  }
  return null
}

async function executeSQL(dbUrl, sql, label) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    await client.query(sql)
    console.log(`[OK] ${label}`)
  } catch (error) {
    console.error(`[ERROR] ${label}: ${error.message}`)
  } finally {
    await client.end()
  }
}

async function main() {
  console.log('=== OPEN CLAW Database Setup ===\n')
  console.log('Finding working connection...\n')

  const dbUrl = await findWorkingConnection()
  if (!dbUrl) {
    console.error('\nNo working connection found. Please check the database password and try again.')
    process.exit(1)
  }

  console.log('\nExecuting schemas...\n')

  const schemas = [
    { file: 'schemas/01_members.sql', label: '01: Members (会員テーブル)' },
    { file: 'schemas/02_referral_system.sql', label: '02: Referral System (紹介制度)' },
    { file: 'schemas/03_payment_gateway.sql', label: '03: Payment & Gateway (支払い・通信)' },
    { file: 'schemas/04_system_management.sql', label: '04: System Management (システム管理)' },
    { file: 'schemas/05_gateway_studio.sql', label: '05: Gateway Studio (Phase 5)' },
  ]

  for (const schema of schemas) {
    const filePath = join(__dirname, schema.file)
    try {
      const sql = readFileSync(filePath, 'utf-8')
      await executeSQL(dbUrl, sql, schema.label)
    } catch (error) {
      console.error(`[ERROR] Failed to read ${schema.file}: ${error.message}`)
    }
  }

  // Verify tables
  console.log('\nVerifying tables...')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
    console.log(`\nCreated tables (${res.rows.length}):`)
    res.rows.forEach(r => console.log(`  - ${r.tablename}`))
  } catch (e) {
    console.error('Verification failed:', e.message)
  } finally {
    await client.end()
  }

  console.log('\n=== Setup Complete ===')
}

main().catch(console.error)
