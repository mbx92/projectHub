import pg from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../database/schema'

export { schema }
export type DB = NodePgDatabase<typeof schema>

// bigint (int8) & numeric dikembalikan sebagai number, bukan string.
pg.types.setTypeParser(20, v => Number(v))
pg.types.setTypeParser(1700, v => Number(v))
// kolom DATE tetap string YYYY-MM-DD (tanpa konversi zona waktu).
pg.types.setTypeParser(1082, v => v)

let _db: DB | null = null
let _pool: pg.Pool | null = null

export function useDB(): DB {
  if (!_db) {
    const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL belum diatur')
    _pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 })
    _db = drizzle(_pool, { schema })
  }
  return _db
}

export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
