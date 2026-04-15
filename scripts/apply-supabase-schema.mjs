import fs from 'node:fs';
import process from 'node:process';
import pg from 'pg';
import { loadDotEnv } from './load-env.mjs';

loadDotEnv();

const SCHEMA_FILE_PATH = new URL('../supabase/rag_schema.sql', import.meta.url);
const VECTOR_SQL_FILE_PATH = new URL('../supabase/add_vector_search.sql', import.meta.url);

function printLine(status, label, detail) {
  console.log(`[${status}] ${label}: ${detail}`);
}

function buildClient() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? '';
  const isLocalDatabase = dbUrl.includes('@127.0.0.1:') || dbUrl.includes('@localhost:');

  return new pg.Client({
    connectionString: dbUrl,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

function attachClientErrorHandler(client, label) {
  client.on('error', error => {
    const message = error instanceof Error ? error.message : String(error);
    printLine('WARN', label, message);
  });
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? '';
  if (!dbUrl.trim()) {
    printLine('FAIL', '缺少環境變數', 'SUPABASE_DB_URL');
    process.exitCode = 1;
    return;
  }

  const schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf8');
  const vectorSql = fs.readFileSync(VECTOR_SQL_FILE_PATH, 'utf8');
  const client = buildClient();
  attachClientErrorHandler(client, '資料庫事件');

  try {
    await client.connect();
    printLine('OK', '資料庫連線', '已成功連線到目標資料庫');
    await client.query(schemaSql);
    printLine('OK', 'Schema 套用', 'rag_schema.sql 已成功執行，新 knowledge_* schema 已建立');
    await client.query(vectorSql);
    printLine('OK', '向量搜尋初始化', 'add_vector_search.sql 已成功執行，match_knowledge_units 已建立');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printLine('FAIL', 'Schema 套用', message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  printLine('FAIL', '未預期錯誤', message);
  process.exitCode = 1;
});