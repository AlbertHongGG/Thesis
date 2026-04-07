---
name: spec-step5-manual-checklist
description: 依 Step 1 Spec（必要時參考 Step2/Step3）產出可人工勾選的功能驗收確認表，含流程與分角色測試項目。
---

## 目標
在「依 Spec 產生程式碼」後，提供一份可執行的人工驗收清單，讓使用者能逐項勾選確認：
- 功能是否符合 Spec
- 流程是否正確（含頁面導向與狀態）
- 不同身分（至少 Guest / User）各自要測什麼
- 資料一致性（列表 / 報表 / 圖表 / 匯出）是否一致

## 輸入定義（必須包含）
- Step 1 完整 Spec（/outputs/step1-spec.md）
- （可選）Step 2 分層 Diagrams（/outputs/step2-diagrams.md）
- （可選）Step 3 Verified Diagrams（/outputs/step3-verified-diagrams.md）

## 輸出位置（必須寫檔）
- /outputs/step5-manual-checklist.md
- 回覆中僅提供完成訊息與檔案連結

## 輸出格式（必須完整）
- 檔案不得包含「Step」標題行
- 所有可驗收項目必須使用 `- [ ]` 核取方塊
- 必須分角色段落（至少 Guest / User）
- 必須包含「端到端主流程」的 checklist（對應 Spec User Flow）
- 必須包含「資料一致性」相關 checklist（CRUD 後列表/報表/圖表/匯出一致）

## Checklist 覆蓋範圍（必須是「依 Spec 推導」，不可寫死）
Checklist 的章節與項目必須由 Step 1 Spec 自動推導，覆蓋範圍以「Spec 中出現的角色 / 流程 / 功能 / 非功能 / 資料模型」為準。

### 1) 永遠要產出的通用章節（Regardless of Spec）
以下章節不依賴特定領域功能，任何網站型產品都必須有（至少各 3~10 條可勾選項目）：
- 環境/前置條件（測試帳號、資料準備、時間/時區/語系、必要權限、測試瀏覽器）
- 角色與權限邊界（依 Spec 的 Roles；最少要有「未登入」與「已登入」兩種狀態，若 Spec 有更多角色必須全部列出）
- 端到端主流程（逐條對應 Step 1 的 User Flow，每個步驟至少 1 條 checkbox）
- 全站狀態品質（Loading / Error / Empty / Retry）
- 錯誤碼與導向（401/403/404/5xx 等；以 Step 1 Non-functional 或 Auth 規則為準）
- RWD / 可用性（若 Spec 有 RWD 或多裝置需求則必列；若未提及也至少驗證基本可用）

### 2) 依「功能需求」自動生成的章節（Functional Requirements Driven）
從 Step 1 的「功能需求」每一個子節（例如 4.1/4.2/4.3...）各生成一個對應章節，並在章節內至少涵蓋：
- 正向案例（happy path）
- 主要失敗案例（validation fail / 權限不足 / 查無資料 / 重複送出等）
- 資料一致性影響（若該功能會影響列表/統計/報表/快取/匯出等，必須逐項列出）

#### 2.1 Auth 類功能（若 Spec 有登入/註冊/登入狀態）
- 產出：註冊、登入、登出、session 失效、未登入導向、錯誤訊息與 loading。

#### 2.2 資料管理（CRUD）類功能（若 Spec 有任何 Entity/資料表）
以 Step 1 的資料模型（Data Model）為準，對每個 Entity（例如 <EntityA>/<EntityB>…）推導：
- 新增/編輯/刪除/查詢（若 Spec 不允許某操作則不要產生該操作的 checklist）
- 欄位驗證（必填、型別、範圍、唯一性、關聯 FK）
- 列表排序/分組/分頁/篩選（若 Spec 有描述）
- 危險操作保護（若 Spec 有「二次確認」或類似規則必列）

#### 2.3 報表 / 統計 / 圖表 類功能（若 Spec 有 report/aggregation/visualization）
- 不應寫死為「Charts」；應依 Spec 中出現的報表/統計維度（時間、類別、狀態等）產生驗收項目。
- 必須包含「統計與原始資料一致」的可檢查條件（例如加總、分組、篩選條件與範圍）。
- 若 Spec 有圖表：再產生「圖表資料序列與統計數值一致」與「空資料狀態」等項目。

#### 2.4 匯出 / 匯入 / 整合 類功能（若 Spec 有 export/import/integration）
- 不應寫死為任何特定格式；應依 Spec 的格式（CSV/PDF/JSON…）、範圍（當月/全部/條件式）、欄位定義、檔名規則產生驗收項目。
- 必須驗證匯出資料集合與畫面/統計一致（同一篩選條件與同一資料範圍）。

### 3) 依「非功能需求」補充的章節（Non-functional Requirements Driven）
從 Step 1 的 Non-functional Requirements 逐條映射成 checklist：
- 效能/一致性/安全（例如 XSS/CSRF/輸入轉義/敏感資訊遮罩）
- 可用性（RWD、空狀態、可理解的錯誤提示）
- 可靠性（重試、斷線、重整後狀態）

### 4) 多角色差異化（Role-based Coverage）
- 每個角色需有獨立小節（例：Guest / User / Admin / Staff…），各自列出「可做」與「不可做」的項目。
- 若系統只有單一使用者角色，仍需明確區分「未登入 vs 已登入」兩個視角。
- 若 Spec 提到資料隔離（每筆資料綁 user_id），需加入至少一組跨帳號驗證項目（看不到他人資料 / API 403/404）。

### 5) 生成規則（避免漏項）
- 每條 User Flow 步驟都要至少對應 1 條 checkbox。
- 每個功能子節至少要有：1 條正向 + 1 條失敗/邊界 + 1 條資料一致性/狀態回饋（若適用）。
- 若 Step 2/3 有提供 diagrams，應以 diagrams 做「覆蓋率加強」：
	- Page-level 的 loading/ready/error 必須在 checklist 中出現
	- 重要 transition（例如 submit/confirm/delete）必須各有對應 checkbox
	- 但不得要求 Spec 未提及的功能。

## 規則
- 僅依 Step 1 Spec 推導，不可新增與 Spec 矛盾的需求。
- 若 Step 1 沒有某功能（例如匯出是選填），Checklist 需標示「若已實作」再測。
- 每個項目要可被人類清楚判斷對錯，避免模糊字眼（例如「看起來正常」）。
- 禁止模板污染：Checklist 文字不得出現不在 Step 1 的領域名詞（例如 Transaction/Order/Cart/Chart/CSV/Category…），除非 Step 1 明確存在。
