import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { loadDotEnv } from './load-env.mjs';

const REQUIRED_ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'SUPABASE_DB_URL'];
const REQUIRED_TABLES = ['knowledge_bases', 'knowledge_profiles', 'rag_documents', 'rag_document_chunks'];

loadDotEnv();

function printLine(status, label, detail) {
  console.log(`[${status}] ${label}: ${detail}`);
}

function hasMissingEnv() {
  const missing = REQUIRED_ENV_NAMES.filter(name => !(process.env[name] ?? '').trim());

  if (missing.length === 0) {
    return false;
  }

  for (const name of missing) {
    printLine('FAIL', '缺少環境變數', name);
  }

  return true;
}

function buildPgClient() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? '';
  const isLocalDatabase = dbUrl.includes('@127.0.0.1:') || dbUrl.includes('@localhost:');

  return new pg.Client({
    connectionString: dbUrl,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

async function testHttpApi() {
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await client.from('rag_documents').select('id').limit(1);

  if (!error) {
    printLine('OK', 'HTTP API', '可透過 service role 讀取 rag_documents');
    return { apiReachable: true, schemaReady: true };
  }

  if (error.code === 'PGRST205') {
    printLine('WARN', 'HTTP API', 'API 可連通，但 rag_documents 尚未建立');
    return { apiReachable: true, schemaReady: false };
  }

  printLine('FAIL', 'HTTP API', error.message);
  return { apiReachable: false, schemaReady: false };
}

async function testDatabase() {
  const client = buildPgClient();

  try {
    await client.connect();
    printLine('OK', '資料庫連線', 'SUPABASE_DB_URL 可成功連線');

    const result = await client.query(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])
       order by table_name`,
      [REQUIRED_TABLES],
    );

    const functionResult = await client.query(
      `select oid::regprocedure::text as signature
       from pg_proc
       where proname = 'match_rag_chunks'
         and oid::regprocedure::text = 'match_rag_chunks(vector,uuid,double precision,integer,text[])'`,
    );

    const existingTables = new Set(result.rows.map(row => row.table_name));
    const missingTables = REQUIRED_TABLES.filter(tableName => !existingTables.has(tableName));

    if (missingTables.length === 0) {
      printLine('OK', '資料表', 'knowledge_bases、knowledge_profiles、rag_documents 與 rag_document_chunks 都存在');
    } else {
      printLine('WARN', '資料表', `缺少：${missingTables.join(', ')}`);
    }

    if ((functionResult.rowCount ?? 0) >= 1) {
      printLine('OK', '向量搜尋函式', 'KB-aware match_rag_chunks 已存在');
    } else {
      printLine('WARN', '向量搜尋函式', '缺少 KB-aware match_rag_chunks');
    }

    if (missingTables.length === 0 && (functionResult.rowCount ?? 0) >= 1) {
      return { dbReachable: true, schemaReady: true };
    }

    return { dbReachable: true, schemaReady: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printLine('FAIL', '資料庫連線', message);
    return { dbReachable: false, schemaReady: false };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  console.log('Supabase 連通測試');
  console.log(`URL: ${process.env.SUPABASE_URL ?? ''}`);
  console.log(`DB : ${process.env.SUPABASE_DB_URL ?? ''}`);

  if (hasMissingEnv()) {
    process.exitCode = 1;
    return;
  }

  const httpResult = await testHttpApi();
  const dbResult = await testDatabase();

  const allReady = httpResult.apiReachable && dbResult.dbReachable && httpResult.schemaReady && dbResult.schemaReady;

  if (allReady) {
    printLine('OK', '總結', '目前 Supabase API、資料庫連線與必要資料表都已就緒');
    return;
  }

  printLine('WARN', '總結', '目前設定尚未完全就緒，請依上方 FAIL / WARN 項目修正');
  process.exitCode = 1;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  printLine('FAIL', '未預期錯誤', message);
  process.exitCode = 1;
});