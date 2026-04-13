# Thesis Editor

這個工作區現在採用和 `Transitor` 相同的 AI 邊界設計：

- `src/ai/runtime/` 只負責 AI runtime、provider 選擇與 env 解析
- `src/features/ingest/` 只負責 ingest 功能流程
- `src/features/ingest/prompts/` 是獨立 prompt 定義
- `src/app/api/ingest/route.ts` 是 thin controller，只負責接 request 與串流結果

功能邏輯不再理解 provider 細節，runtime 也不再把 provider/model metadata 外洩到前端 DTO、session persistence 或 Supabase 核心資料表。

## Getting Started

1. 準備 env

	將 `.env.example` 的內容複製到 `.env`，再依照你要用的 provider/model 調整。

2. 安裝依賴

```bash
npm install
```

3. 啟動開發伺服器

```bash
npm run dev
```

4. 驗證建置與 lint

```bash
npm run build
npm run lint
```

## AI Runtime Env

全域預設：

- `AI_PROVIDER`: `ollama` 或 `copilot`
- `AI_RUNTIME_MODEL`: 共用文字/視覺模型的簡寫預設
- `AI_TEXT_MODEL`: 全域文字模型
- `AI_VISION_MODEL`: 全域圖片分析模型
- `AI_EMBEDDING_MODEL`: 全域 embedding 模型
- `AI_RUNTIME_TIMEOUT_MS`: 全域 timeout

ingest 功能覆寫：

- `INGEST_AI_PROVIDER`
- `INGEST_AI_MODEL`
- `INGEST_TEXT_MODEL`
- `INGEST_VISION_MODEL`
- `INGEST_EMBEDDING_MODEL`
- `INGEST_TIMEOUT_MS`

provider 專屬設定：

- `OLLAMA_BASE_URL`
- `COPILOT_BASE_URL`
- `GITHUB_TOKEN`

## Prompt 調整

ingest prompt 已經從 workflow 拆開，位於：

- `src/features/ingest/prompts/chunk-analysis.ts`
- `src/features/ingest/prompts/document-summary.ts`
- `src/features/ingest/prompts/image-analysis.ts`

如果要調整 prompt，不需要修改 runtime 或 route；直接調整這三個 prompt 檔案檔頭的 prompt 常數即可。

## Supabase Schema

`npm run setup:supabase` 會一次套用：

- `supabase/rag_schema.sql`
- `supabase/add_vector_search.sql`

`npm run test:supabase` 會檢查：

- Supabase HTTP API 是否可用
- PostgreSQL 是否可連線
- `knowledge_bases`、`knowledge_profiles`、`rag_documents`、`rag_document_chunks` 是否存在
- `match_rag_chunks` RPC 是否存在
