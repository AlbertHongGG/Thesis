# Thesis Editor

目前版本已切換到新的分層架構，不再以 page-level orchestration 或 monolithic ingest workflow 為核心。主要責任分佈如下：

- `src/domain/`: 知識庫、知識單位、關聯、操作紀錄等核心模型
- `src/modules/shared/server/`: server composition root、shared contracts、PostgreSQL transaction utilities
- `src/modules/ingest/server/`: ingest orchestration 與 stream DTO mapping
- `src/modules/knowledge/server/`: knowledge context、profile refresh、transactional graph persistence
- `src/modules/knowledge-base/server/`: knowledge base lifecycle 與 maintenance use cases
- `src/modules/graph/server/`: graph projection 與刪除邏輯
- `src/modules/search/server/`: semantic search orchestration
- `src/infrastructure/`: AI、parser、chunker、Supabase read-side adapters
- `src/modules/shared/client/` 與 `src/modules/workspace/ui/`: shared KB workspace state、app shell、workbench / graph screens
- `src/lib/client/`: 前端對 API 的唯一存取入口
- `src/lib/workbench/ingestQueue.ts`: 可跨頁面存活的 ingest queue runtime

`src/app/api/*` 現在只保留 controller 職責，真正的流程協調都在 `src/modules/*/server` 內完成。

## Getting Started

1. 準備環境變數

   依照你的 provider / model 設定 `.env`。

2. 安裝依賴

```bash
npm install
```

3. 啟動開發伺服器

```bash
npm run dev
```

4. 驗證專案

```bash
npm run build
npm run lint
npm run test
```

## AI Runtime Env

全域預設：

- `AI_PROVIDER`: `ollama` 或 `copilot`
- `AI_RUNTIME_MODEL`: 共用文字/視覺模型的簡寫預設
- `AI_TEXT_MODEL`: 全域文字模型
- `AI_VISION_MODEL`: 全域圖片分析模型
- `AI_EMBEDDING_MODEL`: 全域 embedding 模型
- `AI_RUNTIME_TIMEOUT_MS`: 全域 timeout

ingest 模組覆寫：

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

Prompt 定義仍位於 `src/features/ingest/prompts/`，但現在由 `src/infrastructure/prompts/IngestPromptCatalog.ts` 組裝後注入 `src/modules/ingest/server/`。調整 prompt 時，不需要修改 route 或 runtime。

## Supabase Schema

`npm run setup:supabase` 會套用：

- `supabase/rag_schema.sql`
- `supabase/add_vector_search.sql`

雖然檔名仍保留 `rag_schema.sql`，內容已經切換到新的正規化 schema：

- `knowledge_bases`
- `knowledge_profiles`
- `knowledge_sources`
- `knowledge_units`
- `knowledge_unit_relations`
- `knowledge_operations`
- `match_knowledge_units(...)`

`npm run test:supabase` 會檢查：

- Supabase HTTP API 是否可用
- PostgreSQL 是否可連線
- 上述 `knowledge_*` 資料表是否存在
- `match_knowledge_units(vector, uuid, double precision, integer, text[])` 是否存在

## Testing

目前已加入針對新架構核心服務的測試：

- `src/modules/graph/server/GraphApplicationService.test.ts`
- `src/modules/knowledge/server/ProfileSummarizationService.test.ts`
- `src/modules/knowledge-base/server/KnowledgeBaseApplicationService.test.ts`

後續新增 use case 時，優先補 `src/modules/*/server` 測試，而不是回到 page/component 層做流程堆疊測試。
