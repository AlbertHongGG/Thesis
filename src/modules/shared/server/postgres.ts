import { Pool } from 'pg';
import { ConfigurationError } from '@/domain/knowledge/errors';

const poolCache = new Map<string, Pool>();

function isLocalDatabase(connectionString: string) {
  return connectionString.includes('@127.0.0.1:') || connectionString.includes('@localhost:');
}

export function getPostgresPool(env: NodeJS.ProcessEnv = process.env) {
  const connectionString = env.SUPABASE_DB_URL ?? '';

  if (!connectionString.trim()) {
    throw new ConfigurationError('SUPABASE_DB_URL is required for transactional knowledge graph writes.');
  }

  const cachedPool = poolCache.get(connectionString);
  if (cachedPool) {
    return cachedPool;
  }

  const pool = new Pool({
    connectionString,
    ssl: isLocalDatabase(connectionString) ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  poolCache.set(connectionString, pool);
  return pool;
}
