---
name: spec-step6-feature-coverage-checklist
description: 依 Step 1 Spec 產出「簡易功能確認表（Feature Coverage Checklist）」用於快速比對 Spec 中定義的功能是否皆已實作。
---

## 目標
在 Step 5（Manual QA Checklist）之外，額外提供一份「更精簡、以功能為單位」的核對清單，讓使用者能快速勾選確認：
- Spec 中定義的功能是否都有出現在產品中（是否有 UI 入口/頁面/權限/資料流）
- 功能名稱與範圍是否與 Spec 一致（避免漏做或做錯）

此清單用途是「Coverage（覆蓋）」而不是「Acceptance（驗收）」：
- Step 6：確認功能存在（有入口、有權限、有資料）
- Step 5：驗收流程與細節（錯誤/狀態/一致性/邊界條件）

## 輸入定義（必須包含）
- Step 1 完整 Spec（/outputs/step1-spec.md）

（可選）
- Step 2 分層 Diagrams（/outputs/step2-diagrams.md）
- Step 3 Verified Diagrams（/outputs/step3-verified-diagrams.md）

## 輸出位置（必須寫檔）
- /outputs/step6-feature-coverage-checklist.md
- 回覆中僅提供完成訊息與檔案連結

## 輸出格式（必須完整）
- 檔案不得包含「Step」標題行
- 以 Markdown Checklist 為唯一驗收單位：每個功能一行 `- [ ] <功能名稱>`
- 允許用 Markdown 標題/分段（例如 `## Authentication`）做分類，但分類底下的每一項都必須是 `- [ ]`
- 禁止使用表格
- 每個項目必須是「功能級」而非「測試步驟級」
  - ✅ 正確：`- [ ] 登入功能`、`- [ ] 建立工單`、`- [ ] 工單狀態轉換（Open→In Progress…）`
  - ❌ 不要：`- [ ] 點擊登入按鈕會成功`（這是 Step 5 的範圍）

## 生成規則（從 Spec 推導，不可寫死）
請依 Step 1 Spec 的各段落自動推導並列出功能項目：

### A) Auth / Session（若 Spec 有登入/註冊）
- 註冊
- 登入
- 登出
- Session/token 失效處理（401 導向）

### B) RBAC / 存取控制（若 Spec 有多角色）
- 路由存取控制（各角色可進入頁面）
- 資料存取隔離（例如只能看自己的資料、避免 IDOR）
- 導覽顯示規則（不同角色顯示不同選項）

### C) Core Entities / CRUD（依 Data Model）
以 Step 1 的 Data Model 為準，對每個 Entity 推導其存在的功能（只列 Spec 允許的操作）：
- 清單/查詢
- 詳情
- 新增
- 編輯（若 Spec 允許）
- 刪除（若 Spec 允許）

### D) Business State Machine（若 Spec 有狀態機）
- 列出「狀態集合」存在
- 列出「合法轉換集合」存在（可用一條或分條列出）
- 列出「非法轉換拒絕（HTTP 400）」存在

### E) Communication / Timeline / Immutability（若 Spec 有歷史不可變）
- 留言/訊息（新增）
- 內部備註（若 Spec 有 is_internal）
- 歷史時間軸/事件紀錄呈現
- 不可變性（不可編輯/不可刪除）

### F) Admin / Operations（若 Spec 有 Admin）
- 指派/改派
- 強制狀態變更
- 管理後台統計/監控
- 帳號管理（建立/停用/角色）

### G) UX / Page States（永遠要有）
- Loading 狀態
- Error 狀態
- Empty 狀態
- Forbidden / Not Found 顯示

### H) Consistency / Observability / Security（依 Non-functional Requirements）
- 列表/詳情/統計一致性
- Audit Log 寫入（可追蹤 who/when/what）
- XSS 防護（若 Spec 有）

## 與 Step 5 的分工界線（避免重複）
- Step 6 只檢查「功能是否存在」：是否有入口/權限/資料
- Step 5 才檢查「功能是否正確」：流程、錯誤碼、狀態、邊界、資料一致性細節

## 規則
- 僅依 Step 1 Spec 推導，不可新增與 Spec 矛盾的功能
- 若 Spec 未提及匯出/匯入/報表等功能，不可自行加入
- 若 Step 2/3 有 diagrams，可用來確認是否漏列功能，但不得新增 Spec 沒有的功能
