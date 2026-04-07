# 人工驗收確認表（Manual QA Checklist）
客服工單系統（Helpdesk / Ticket System）

## 環境與前置條件
- [ ] 準備至少 4 組測試帳號：Guest（未登入）、Customer、Agent、Admin（角色互斥；每個 User 僅能一個 role）
- [ ] 準備至少 1 組「已停用（is_active=false）」的帳號（用於驗證不可登入與 token 驗證拒絕）
- [ ] 準備測試資料：至少 5 筆工單，覆蓋所有狀態 `Open` / `In Progress` / `Waiting for Customer` / `Resolved` / `Closed`
- [ ] 準備測試資料：至少 2 筆「未指派」工單（assignee_id=null），至少 2 筆「已指派給某位 Agent」的工單
- [ ] 準備測試資料：至少 1 筆工單含 `is_internal=true` 的留言（用於驗證 Customer 不可見）
- [ ] 準備測試資料：至少 1 筆工單含多筆留言，確認時間軸依 created_at 正確排序
- [ ] 準備測試資料：至少 1 筆工單的 updated_at 會隨留言新增或狀態/指派變更而更新（用於一致性驗證）
- [ ] 確認測試瀏覽器至少包含桌機與手機尺寸（RWD 可用性驗證）
- [ ] 確認系統時間/時區一致（SLA 與 created_at/updated_at 顯示不應出現顯著錯誤）

## 角色與權限邊界（RBAC）
### Guest（未登入）
- [ ] 可進入 `/login`，且僅可見 Email/Password 表單與登入動作
- [ ] 可進入 `/register`，且僅可見 Email/Password/Password Confirm 表單與註冊動作
- [ ] 嘗試直接進入 `/tickets` 會被阻擋：收到 401 並導向 `/login`
- [ ] 嘗試直接進入 `/agent/tickets` 會被阻擋：收到 401 並導向 `/login`
- [ ] 嘗試直接進入 `/admin/dashboard` 會被阻擋：收到 401 並導向 `/login`
- [ ] Header 導覽僅顯示「登入」、「註冊」（不可出現其他角色導覽）

### Customer
- [ ] 登入後預設導向 `/tickets`
- [ ] 可進入 `/tickets` 並僅可見自己的工單
- [ ] 可進入 `/tickets/:id`（限自己的工單）
- [ ] 嘗試進入 `/agent/tickets` 顯示 403 Forbidden（不導向 `/login`）
- [ ] 嘗試進入 `/admin/dashboard` 顯示 403 Forbidden（不導向 `/login`）
- [ ] Header 導覽僅顯示「我的工單」、「登出」
- [ ] 導覽中不會顯示「工單工作台」、「管理後台」
- [ ] 嘗試以猜測 id（IDOR）讀取他人工單：不得看到內容；需得到 403 或 404（依策略）且 UI 對應顯示 Forbidden 或 Not Found

### Agent
- [ ] 登入後預設導向 `/agent/tickets`
- [ ] 可進入 `/agent/tickets` 並可見「未指派」與「指派給我」視圖切換
- [ ] 可進入 `/tickets/:id`（限未指派或 assignee_id=自己 的工單）
- [ ] 嘗試進入 `/admin/dashboard` 顯示 403 Forbidden
- [ ] Header 導覽僅顯示「工單工作台」、「登出」
- [ ] 導覽中不會顯示「管理後台」
- [ ] 嘗試讀取「已指派給其他 Agent」的工單詳情：不得看到內容；需得到 403 或 404（依策略）且 UI 對應顯示 Forbidden 或 Not Found

### Admin
- [ ] 登入後預設導向 `/admin/dashboard`
- [ ] 可進入 `/admin/dashboard` 並可見 SLA、狀態分佈、客服負載
- [ ] 可進入 `/agent/tickets`（本系統允許 Admin 進入以利監控/支援）
- [ ] 可進入 `/tickets/:id` 並可查看任意工單（含完整時間軸與處理資訊）
- [ ] Header 導覽顯示「管理後台」、「工單工作台」、「登出」

## 端到端主流程（User Flow）
### Customer 端到端流程
- [ ] Customer 登入後進入 `/tickets`，列表能成功載入（含 status、updated_at）
- [ ] 點擊「建立新工單」可開啟建立表單，包含 title/category/description
- [ ] 送出建立後建立成功：新工單狀態為 `Open`，列表刷新後可看到該筆工單
- [ ] 建立成功後，進入該工單詳情：留言時間軸中存在「初始描述」留言（不可修改/刪除）
- [ ] 當 Agent 回覆後，Customer 在列表與詳情可看到新留言（且詳情時間軸排序正確）
- [ ] 當工單狀態在 `In Progress` ↔ `Waiting for Customer` 往返時，Customer 僅在 `Waiting for Customer` 時能新增留言
- [ ] 當 Agent 將工單標記為 `Resolved` 後，Customer 在詳情可看到狀態為 `Resolved` 且可執行關閉動作
- [ ] Customer 將工單關閉後，狀態變為 `Closed` 且不可再回覆或變更狀態

### Agent 端到端流程
- [ ] Agent 登入後進入 `/agent/tickets`，可查看「未指派」工單列表
- [ ] 在「未指派」視圖對某筆 `Open` 工單執行接手成功：工單狀態變為 `In Progress` 且 assignee_id=自己
- [ ] 接手後，在「指派給我」視圖可看到該筆工單
- [ ] 進入 `/tickets/:id` 後可回覆工單（新增對客留言）且留言出現在時間軸
- [ ] Agent 將 `In Progress` 工單切換為 `Waiting for Customer`，Customer 才能在該狀態回覆
- [ ] Customer 回覆後，工單可回到 `In Progress`（由 Customer 觸發合法轉換）
- [ ] Agent 問題解決後將工單標記為 `Resolved`

### Admin 端到端流程
- [ ] Admin 登入後進入 `/admin/dashboard`，能看到 SLA、狀態分佈、客服負載
- [ ] Admin 可切換時間範圍（例如近 7 天/30 天），畫面會更新且 Loading/Empty/Error 狀態正確
- [ ] Admin 可從 dashboard 進入某筆工單詳情 `/tickets/:id`，查看時間軸與處理狀況
- [ ] Admin 對工單執行指派/重新指派成功：一次僅能有一位 assignee，UI 顯示更新
- [ ] Admin 執行允許的狀態強制變更（仍需符合合法轉換集合），成功後狀態更新
- [ ] Admin 可建立/停用客服人員帳號，並可設定使用者角色

## 功能驗收：帳號與認證（Authentication）
- [ ] 註冊：輸入合法 Email/Password/Password Confirm 可成功建立帳號
- [ ] 註冊：Email 已存在時註冊失敗，顯示明確欄位錯誤
- [ ] 註冊：Password Confirm 不一致時註冊失敗，顯示欄位錯誤
- [ ] 登入：合法帳密可成功取得 token 並導向正確角色首頁
- [ ] 登入：錯誤帳密時登入失敗（400/401），顯示明確錯誤訊息且不產生 token
- [ ] 登入：is_active=false 的帳號不可登入（顯示明確錯誤）
- [ ] token 驗證：token 無效/過期時，受保護頁面請求回 401 並導向 `/login`
- [ ] token 驗證：已登入但角色不符時，進入不允許頁面顯示 403 Forbidden（不導向 `/login`）
- [ ] 登出後 token 清除/失效並導向 `/login`，Header 回到 Guest 導覽
- [ ] 表單送出時有防重送：Submitting 時按鈕 disabled 且不會產生重複請求
- [ ] 密碼不會以明碼儲存或被任何 API/頁面回傳（不得在任何回應/畫面中看到 password_hash 或明碼）

## 功能驗收：工單（Ticket）
### 建立工單
- [ ] Customer 可建立新工單，title 必填且長度 ≤ 100 字
- [ ] Customer 建立工單時 category 必填且僅能選擇 `Account` / `Billing` / `Technical` / `Other`
- [ ] 建立成功後工單狀態固定為 `Open`
- [ ] 建立成功後同時建立一筆「初始描述」留言，且該留言不可被編輯或刪除
- [ ] 非 Customer 嘗試建立工單時必須失敗（403）且 UI 顯示權限不足
- [ ] 建立時欄位驗證失敗（例如 title 空）回 400 並顯示欄位錯誤

### 查看工單與可見範圍
- [ ] Customer 在 `/tickets` 只看得到 customer_id=自己的工單
- [ ] Agent 在 `/agent/tickets` 只看得到未指派或 assignee_id=自己的工單
- [ ] Admin 可看得到所有工單（列表與詳情一致）
- [ ] 工單列表每筆顯示 title、category、status、updated_at、assignee（若有）
- [ ] 工單詳情顯示 title、status、category、assignee、created_at、updated_at，且與列表資訊一致

### 列表互動與篩選
- [ ] `/tickets` 支援依 `status` 篩選，篩選後列表只顯示符合狀態的工單
- [ ] `/agent/tickets` 支援依 `status` 篩選，且篩選條件會作用在目前視圖（未指派/指派給我）
- [ ] `/agent/tickets` 可在「未指派」與「指派給我」兩個視圖切換，切換後資料範圍正確

### 不可變更欄位限制
- [ ] 建立後 title 不可修改（任何嘗試修改需被拒絕，API 應回 400/403）
- [ ] 建立後 category 不可修改（任何嘗試修改需被拒絕，API 應回 400/403）

## 功能驗收：工單留言（TicketMessage）
### 新增留言（對客留言）
- [ ] Agent 可在工單允許互動的狀態新增留言，成功後時間軸新增一筆留言（append-only）
- [ ] Customer 僅可在 `Waiting for Customer` 狀態新增留言；其他狀態送出需被拒絕（400 或 403）並顯示明確錯誤
- [ ] `Closed` 工單禁止新增任何留言（含內部備註），送出需被拒絕（400）並顯示明確錯誤
- [ ] 留言內容必填；空內容送出需被拒絕（400）並顯示欄位錯誤

### 內部備註（is_internal=true）
- [ ] Agent 可新增 is_internal=true 的內部備註，且該備註在 Agent/Admin 視角可見
- [ ] Customer 在任何情況都不可見 is_internal=true 的留言（同一張詳情頁以角色視角過濾）
- [ ] Customer 嘗試新增 is_internal=true 的留言必須失敗（403）

### 不可變性（append-only）
- [ ] 任何角色都找不到編輯留言的入口
- [ ] 任何角色都找不到刪除留言的入口
- [ ] 直接呼叫修改/刪除留言 API（若存在）必須被拒絕（400/403/404）

## 功能驗收：管理員客服帳號管理（Admin Users Management）
- [ ] Admin 可建立客服人員帳號（用於 Agent）
- [ ] Admin 可停用客服人員帳號（is_active=false）
- [ ] 已停用帳號不可登入；若已登入，下一次 token 驗證時會被拒絕（401 或 403，依策略）
- [ ] Admin 可設定使用者角色（Customer / Agent / Admin）且角色互斥
- [ ] 非 Admin 嘗試進入或操作帳號管理能力必須失敗（403）

## 功能驗收：狀態機 / 規則 / 限制（Ticket State Machine）
### 狀態集合與終態
- [ ] 工單狀態僅可能為 `Open` / `In Progress` / `Waiting for Customer` / `Resolved` / `Closed`
- [ ] `Closed` 為終態：禁止任何狀態變更與留言新增

### 合法狀態轉換（成功案例）
- [ ] `Open` → `In Progress`：由 Agent 成功執行，且同時寫入 assignee
- [ ] `Open` → `In Progress`：由 Admin 成功執行
- [ ] `In Progress` → `Waiting for Customer`：由 Agent 成功執行
- [ ] `Waiting for Customer` → `In Progress`：由 Customer 成功執行
- [ ] `In Progress` → `Resolved`：由 Agent 成功執行
- [ ] `Resolved` → `Closed`：由 Customer 成功執行
- [ ] `Resolved` → `Closed`：由 Admin 成功執行
- [ ] `Resolved` → `In Progress`：由 Agent 成功執行（重新開啟）
- [ ] `Resolved` → `In Progress`：由 Admin 成功執行（重新開啟）

### 非法狀態轉換（拒絕案例，HTTP 400）
- [ ] 任意不在合法集合內的狀態轉換都被拒絕且回 400（例如 `Open` → `Resolved`）
- [ ] Customer 嘗試執行 `In Progress` → `Resolved` 被拒絕（403 或 400）
- [ ] Agent 嘗試執行 `Waiting for Customer` → `In Progress` 被拒絕（403 或 400）
- [ ] 任何角色嘗試在 `Closed` 上做狀態變更都被拒絕（400）

### 狀態與操作約束
- [ ] Customer 只有在 `Waiting for Customer` 時看到回覆入口；其他狀態不顯示回覆 CTA
- [ ] Customer 只有在 `Resolved` 時看到「關閉」入口；其他狀態不顯示關閉 CTA
- [ ] Agent 只有在 `In Progress` 時能進行 `Waiting for Customer` 或 `Resolved` 的推進
- [ ] Admin 的強制狀態變更仍受合法轉換集合限制（不可任意跳狀態）

### 併發與一致性規則（狀態/指派變更交易性）
- [ ] 狀態變更成功時，Ticket 更新與 Audit Log 寫入在同一個交易中完成（不可只更新 Ticket）
- [ ] 指派變更成功時，Ticket 更新與 Audit Log 寫入在同一個交易中完成
- [ ] 更新時使用「當前狀態」做條件（例如帶上 status 作為條件）以避免競態導致非法狀態

## 功能驗收：頁面與導覽（Pages）
### `/login` 登入頁
- [ ] 初始渲染可見 Email/Password 欄位
- [ ] 送出登入時顯示 Loading（按鈕 disabled、顯示送出中）
- [ ] 登入成功後依 role 導向正確首頁（Customer→`/tickets`、Agent→`/agent/tickets`、Admin→`/admin/dashboard`）
- [ ] 登入失敗顯示 Error（帳密錯誤/停用/系統錯誤）且可重試

### `/register` 註冊頁
- [ ] 初始渲染可見 Email/Password/Password Confirm 欄位
- [ ] 送出註冊時顯示 Loading 並防重送
- [ ] 註冊成功後依策略導向角色首頁或要求再登入（但不得停留在無狀態）
- [ ] 註冊失敗顯示欄位錯誤（Email 已存在/驗證錯誤）且可重試

### `/tickets` 我的工單（Customer）
- [ ] 進入頁面會先做角色檢查：非 Customer 顯示 403 Forbidden
- [ ] 載入中顯示 Loading；成功後顯示列表
- [ ] 無資料時顯示 Empty（但仍能看到「建立新工單」入口）
- [ ] API 失敗時顯示 Error 與 Retry
- [ ] 點擊工單可導向 `/tickets/:id` 並開始載入詳情

### `/agent/tickets` 客服工作台（Agent；Admin 可讀）
- [ ] 進入頁面會先做角色檢查：Customer 顯示 403 Forbidden
- [ ] 載入中顯示 Loading；成功後顯示列表
- [ ] 無資料時顯示 Empty
- [ ] API 失敗時顯示 Error 與 Retry
- [ ] 可切換「未指派」與「指派給我」視圖
- [ ] 在未指派工單上可執行「接手」動作（成功後狀態與 assignee 更新）

### `/admin/dashboard` 管理後台（Admin）
- [ ] 進入頁面會先做角色檢查：非 Admin 顯示 403 Forbidden
- [ ] 載入中顯示 Loading；成功後顯示 SLA、狀態分佈、客服負載
- [ ] 無資料時顯示 Empty（例如資料範圍內無工單）
- [ ] API 失敗時顯示 Error 與 Retry
- [ ] 可切換時間範圍（例如近 7 天/30 天），切換時顯示 Loading 且結果更新

### `/tickets/:id` 工單詳情
- [ ] 載入中顯示 Loading；成功後顯示基本資訊與留言時間軸
- [ ] 權限不足時顯示 Forbidden（不顯示任何工單內容）
- [ ] 工單不存在時顯示 Not Found
- [ ] API 失敗時顯示 Error 與 Retry
- [ ] 送出留言時按鈕 disabled；成功後時間軸新增留言且不可變
- [ ] 送出狀態變更時顯示處理中；成功後 status 更新且 UI 一致
- [ ] 送出指派變更時顯示處理中；成功後 assignee 更新且 UI 一致

## 資料一致性（列表 / 詳情 / 統計）
- [ ] `/tickets` 列表中某筆工單的 status/assignee 與 `/tickets/:id` 詳情顯示一致
- [ ] 新增留言後：`/tickets/:id` 時間軸立即出現新留言，且 `/tickets` 列表該工單 updated_at 同步更新
- [ ] 工單狀態變更後：列表與詳情的 status 同步一致
- [ ] 指派變更後：列表與詳情的 assignee 同步一致
- [ ] `/admin/dashboard` 的狀態分佈總數，與同一時間範圍內 Admin 可見的工單總數一致
- [ ] 客服負載（每位 Agent 的進行中工單數）與實際工單資料一致（以同一範圍與定義計算）
- [ ] SLA 指標（首次回覆時間、解決時間）與工單留言/狀態資料的時間點一致（同一時間範圍）

## 全站狀態品質（Loading / Error / Empty / Retry / Forbidden / Not Found）
- [ ] 每個頁面在資料請求期間都有明確 Loading 狀態
- [ ] 每個頁面在 API 失敗時都有 Error 狀態，且提供 Retry
- [ ] `/tickets` 無工單時顯示 Empty，且仍可建立新工單
- [ ] `/agent/tickets` 無資料時顯示 Empty
- [ ] `/admin/dashboard` 無資料時顯示 Empty
- [ ] `/tickets/:id` 權限不足顯示 Forbidden；工單不存在顯示 Not Found

## 錯誤碼與導向（401/403/404/5xx）
- [ ] 未登入請求任何受保護 API 或頁面時回 401，前端導向 `/login`
- [ ] 已登入但角色不符的頁面顯示 403 Forbidden（不導向 `/login`）
- [ ] 讀取工單詳情不存在時回 404 並顯示 Not Found
- [ ] 後端 5xx 或網路錯誤時顯示 Error，且 Retry 會再次觸發請求

## 安全性（IDOR / XSS / Server-side validation）
- [ ] 嚴格驗證工單存取權限：Customer 無法讀取他人工單（防 IDOR）
- [ ] 狀態轉換規則完全由伺服器端驗證（不可僅靠前端隱藏按鈕）
- [ ] 留言內容在畫面輸出有安全處理（例如輸出轉義），避免 XSS
- [ ] 使用者在任何頁面或 API 回應中不會看到不應暴露的敏感欄位（例如 password_hash）

## 可觀測性 / 稽核（Audit Log）
- [ ] 建立工單時寫入 Audit Log（action=`TICKET_CREATED`）且包含 actor_id 與 entity_id
- [ ] 新增留言時寫入 Audit Log（action=`MESSAGE_CREATED`）且包含 is_internal 等必要 metadata
- [ ] 狀態變更時寫入 Audit Log（action=`STATUS_CHANGED`）且 metadata 包含前後 status
- [ ] 指派變更時寫入 Audit Log（action=`ASSIGNEE_CHANGED`）且 metadata 包含前後 assignee
- [ ] Audit Log 可追蹤 who / when / what（actor_id、created_at、action）
- [ ] Audit Log 與留言皆為 append-only，不提供刪除入口或可疑的覆寫行為

## UX 品質（表單、防重送、可理解的回饋）
- [ ] 建立工單/登入/註冊/留言送出/狀態變更/指派變更皆有防重送（Submitting 時 disabled）
- [ ] 失敗時錯誤訊息可理解且可重試（不使用模糊描述）

## RWD（桌機與手機可用）
- [ ] 桌機尺寸下：列表欄位（title/category/status/updated_at/assignee）可閱讀且不被截斷到不可辨識
- [ ] 手機尺寸下：`/tickets` 與 `/agent/tickets` 仍可完成主要操作（進入詳情、建立/接手）
- [ ] 手機尺寸下：`/tickets/:id` 留言時間軸可閱讀且輸入/送出操作可用
- [ ] 手機尺寸下：`/admin/dashboard` 的 SLA/狀態分佈/客服負載仍可閱讀（可換行或改為卡片呈現）

## 多人協作 / 併發（接手、狀態切換、指派）
- [ ] 兩位 Agent 同時接手同一筆未指派工單：僅一方成功，另一方得到明確失敗回應
- [ ] 在接手衝突時，失敗方 UI 會顯示「已被他人接手」或等價的明確錯誤
- [ ] 兩人同時變更同一筆工單狀態：後送出者會因當前狀態不符而失敗，並得到明確錯誤回饋
- [ ] 兩人同時指派同一筆工單：其中一方失敗（可回 409），並得到明確錯誤回饋
- [ ] 併發失敗後，頁面可透過刷新或 Retry 取得最新狀態，且列表/詳情一致
