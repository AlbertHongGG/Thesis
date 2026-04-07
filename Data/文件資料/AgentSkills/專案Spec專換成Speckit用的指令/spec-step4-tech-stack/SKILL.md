---
name: spec-step4-tech-stack
description: 依 Step 1 完整 Spec 明確定義前端、後端、資料庫技術棧。輸入僅為 step1-spec.md 的內容。
---

## 目標
根據 Step 1 完整 Spec，產出可落地的技術棧選型。必須同時明確定義：
- 前端技術棧
- 後端技術棧
- 資料庫技術棧（固定使用 SQLite + Prisma）

## 輸入定義（必須包含）
- 由 Step 1 產出的完整 Spec（/outputs/step1-spec.md）

## 輸出位置（必須寫檔）
- /outputs/step4-tech-stack.md
- 回覆中僅提供完成訊息與檔案連結

## 輸出格式（固定，僅此結構）

```markdown
# 技術棧定義（Tech Stack）
<產品名稱>

---

## 1. 前端（Frontend）
- Framework:
- Language:
- UI / Styling:
- State / Data Fetching:
- Form / Validation:
- Routing:
- （若 Spec 有圖表需求）Charts:
- （若 Spec 有日期處理需求）Date Handling:

## 2. 後端（Backend）
- Runtime / Framework:
- Language:
- API Style:
- Auth:
- Validation:

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing:
- Dev Tooling:
```

---

## 禁止輸出的內容（嚴格遵守）
- **禁止** 輸出「前端專案結構建議」或任何資料夾結構
- **禁止** 輸出「API 端點設計」或任何 API 路由清單
- **禁止** 輸出「Prisma Schema」或任何資料庫 schema
- **禁止** 輸出「環境變數」範例
- **禁止** 輸出「部署建議」或任何部署相關內容
- **禁止** 輸出任何程式碼區塊（除了上方固定格式的 markdown 結構）
- **禁止** 使用表格格式，僅使用列表（`- 項目: 值`）

---

## 規則
- 輸出**僅限於上方固定格式**，不可新增任何額外段落或結構。
- 每個項目僅填寫技術名稱與簡短說明（一行內），不可展開解釋。
- 輸出必須僅依 Step 1 Spec 推導，不可新增與 Spec 矛盾的需求。
- 資料庫技術必須固定為「SQLite + Prisma」。
- 輸出中必須「再三強調」只能使用 SQLite（本機單檔）：
	- `SQLite（本機單檔）` 字串在整份 step4-tech-stack.md 中至少出現 3 次。
	- 強調必須放在既有固定格式的條目文字中（不可新增段落/備註區塊）。
- 若 Spec 有強烈需求（如 SSR、離線、即時通知），需在技術棧中反映。
- 若 Spec 未要求特殊需求，採用穩定且常見的 Web 技術組合。
- 技術棧需可支持 Step 1 Spec 中定義的所有功能與流程。
