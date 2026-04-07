# 任務 Spec：金流前置模擬平台（非真的刷卡）
Payment Flow Simulation Platform (Non-Real Payment)

---

## 1. 產品目標（Product Goal）
建立一個可完整模擬「建立訂單 → 進入付款 → 結果回傳（Return URL / Webhook）」的測試平台，用於前後端串接與 QA 驗證訂單狀態機、錯誤處理與延遲情境。此平台不得連任何真實銀行或金流商、不得處理對帳/清算/實際收款。

### 1.1 核心用途
- 前端/後端金流串接前的整合測試（不連任何真實金流）
- QA 測試各種付款成功/失敗/取消/逾時/延遲等情境
- 模擬第三方金流行為（同步回傳、Webhook、延遲）
- 驗證訂單狀態機與「終態不可再轉換」規則

### 1.2 系統必備能力（Must Have）
- 模擬付款流程：建立模擬訂單 → 產生付款頁 URL → 模擬使用者付款 → 結果回傳
- 多種付款結果：success / failed / cancelled / timeout / delayed_success
- 可設定延遲與錯誤模板（含錯誤碼與錯誤訊息；模板可覆寫）
- Webhook 模擬（Server-to-Server），支援延遲發送與手動重送
- 完整訂單狀態機 + 每次狀態轉換的不可變事件紀錄（OrderStateEvent）
- 操作紀錄（Audit Log）與可重播（Replay）：可用同一筆訂單設定重新觸發「回傳 / Webhook」流程，以復現問題

### 1.3 系統邊界（Out of Scope）
- 不進行真實刷卡、不得連任何銀行/真實金流商
- 不處理對帳、清算、實際收款
- 不保存任何真實卡號/持卡人資料等敏感資訊（本平台僅模擬）

---

## 2. 使用者角色定義（Roles）
> 角色不可切換：同一使用者帳號的 role 固定（由 Admin 指派或系統種子資料建立）。

### 2.1 訪客（Guest）
- 權限
  - 不可存取任何受保護頁面與 API
- 可執行行為
  - 僅能看到登入頁（/login）
- 限制
  - 嘗試存取其他頁面：一律導向 /login
  - 嘗試呼叫受保護 API：回 401

### 2.2 一般使用者（User（Developer））
代表串接金流的開發人員。
- 權限
  - 建立模擬訂單並測試付款與回傳
  - 設定每筆訂單的 callback_url 與（選填）webhook_url
  - 查看自己建立的訂單、付款結果、回傳內容、Webhook 送出紀錄
  - 手動重送該筆訂單的 Webhook
  - 對該筆訂單執行 Replay（重播）
- 限制
  - 不可修改系統全域規則（付款方式、情境模板、簽章策略等）
  - 不可刪除任何系統紀錄（Order、WebhookLog、AuditLog、OrderStateEvent、ReplayRun、ReturnLog）
  - 不可查看其他使用者建立的訂單（資料隔離；避免 IDOR）

### 2.3 管理員（Admin）
- 權限
  - 全系統管理（包含所有 User（Developer）權限）
  - 可查看所有訂單與所有操作紀錄
  - 管理付款方式（PaymentMethod）
  - 管理模擬情境模板（SimulationScenarioTemplate）
  - 系統參數設定（如：Session 有效期、Return URL 回傳方式預設、Webhook 簽章密鑰輪替策略、允許幣別）
- 限制
  - 無

---

## 3. 使用者流程（User Flow）

### 3.1 User（Developer）流程：建立與測試付款
1. 登入平台（/login）
2. 進入訂單列表（/orders），點擊「建立模擬訂單」進入 /orders/new
3. 填寫訂單資訊：amount、currency（預設 TWD）、callback_url、（選填）webhook_url
4. 選擇付款方式（信用卡（模擬）/ ATM（模擬）/ 超商代碼（模擬））
5. 選擇模擬情境（success / failed / cancelled / timeout / delayed_success），可設定延遲秒數、錯誤碼與錯誤訊息（以模板為預設，可覆寫）
6. 送出後建立訂單（status=created），系統產生付款頁 URL
   - 付款頁 URL：/pay/:order_no
   - 進入付款頁前會將訂單推進到 payment_pending（首次成功載入付款頁時觸發）
7. 開啟付款頁並執行「模擬使用者付款」
8. 系統依情境產生結果，更新訂單狀態到終態（paid / failed / cancelled / timeout）並寫入 completed_at
9. 系統導向 callback_url（Return URL），依訂單記錄的 return_method 以 Query String 或 POST Form 傳送結果資料；同時記錄 ReturnLog
10.（選擇性）若該訂單設定 webhook_url：系統在進入終態時發送 Webhook（可延遲）；同時記錄 WebhookLog
11. 回到訂單詳情（/orders/:id）查看：狀態、回傳內容、WebhookLog、狀態轉換歷史、操作紀錄

### 3.2 User（Developer）流程：Webhook 測試
1. 建立訂單時填入 webhook_url
2. 付款完成進入終態後，系統發送 Webhook（含 HMAC 簽章與 timestamp）
3. 在訂單詳情查看 Webhook Payload、headers、發送時間、成功/失敗結果
4. 需要時點擊「重送 Webhook」：重新送出相同 payload（業務欄位相同；會重新產生 timestamp 與簽章）；新增一筆 WebhookLog 與 AuditLog

### 3.3 User（Developer）流程：Replay（重播）
1. 在訂單詳情點擊「Replay」
2. 選擇重播範圍：webhook_only / full_flow
3. 系統以同一筆訂單設定再執行一次模擬（不得改變已是終態的訂單狀態），改以 ReplayRun 記錄一次重播結果
   - webhook_only：僅重送 Webhook（新 WebhookLog 會綁定 replay_run_id）
   - full_flow：重走「Return URL（以 UI 引導開啟 callback_url 帶 payload）→ Webhook」；新增 ReturnLog 與（若有）新 WebhookLog
4. 在訂單詳情查看 ReplayRun 結果與對應的回傳/Webhook 紀錄

### 3.4 Admin 流程
1. 登入後進入 /admin
2. 管理付款方式（新增/停用/排序/顯示名稱）
3. 建立/編輯模擬情境模板（例如：刷卡失敗、逾時、延遲後成功）
4. 查看全站訂單與操作紀錄（篩選：狀態、付款方式、情境、建立者、時間區間）
5. 進入任一訂單詳情查看 Return/Webhook/Audit/ReplayRun

---

## 4. 功能需求（Functional Requirements）

### 4.1 認證（Authentication）
- 登入方式：Email + 密碼
- 驗證方式：Session Cookie（建議）
  - 登入成功後設定 HttpOnly Cookie（例如 session_id），前端後續 API 自動帶入
  - Session 過期需重新登入（預設 8 小時；可由 Admin 設定）
  - 登出使 session 失效並清除 cookie
- 所有受保護 API 必須驗證身分：未登入回 401
- 登入/登出/過期事件需寫入 AuditLog
- 基本安全要求
  - 密碼需以不可逆雜湊儲存（password_hash）
  - 登入失敗需回傳可辨識的錯誤訊息但不得洩漏帳號是否存在

### 4.2 權限（RBAC / Access Control）
- 角色：Guest / User（Developer） / Admin

#### 4.2.1 Route Guard（前端）
- Guest 只能進 /login，其他一律導向 /login
- User（Developer）可進 /orders、/orders/new、/orders/:id、/pay/:order_no
- Admin 可進 /orders、/orders/new、/orders/:id、/pay/:order_no、/admin
- 已登入者進入 /login：導向 /orders（Admin 亦可從導覽進 /admin）

#### 4.2.2 API Guard（後端）
- 未登入：401
- 已登入但權限不足：403
- 資料隔離（避免 IDOR）
  - User（Developer）只能讀取/操作自己建立的訂單與其紀錄（ReturnLog/WebhookLog/OrderStateEvent/ReplayRun/AuditLog 中屬於該訂單的內容）
  - Admin 可讀取/操作全站資料

### 4.3 模擬訂單（Order）

#### 4.3.1 訂單欄位與規則
- order_no：系統產生，唯一，不可修改
- amount：正整數，必填
- currency：預設 TWD；若提供需為允許幣別清單之一（預設允許：TWD、USD、JPY；Admin 可調整）
- status：見狀態機
- callback_url：前端回傳 URL，必填（需為合法 URL，且必須為 http/https）
- return_method：query_string / post_form
  - 建立訂單時由系統預設帶入並在 UI 清楚顯示
  - 建立後不可變更
- webhook_url：Webhook URL，選填（需為合法 URL，且必須為 http/https）
- payment_method：信用卡（模擬）/ ATM（模擬）/ 超商代碼（模擬），必填（僅能選啟用中 PaymentMethod）
- simulation_scenario：success / failed / cancelled / timeout / delayed_success，必填
- delay_sec：延遲秒數（情境可提供預設，建立訂單時可覆寫），>= 0
- webhook_delay_sec：Webhook 延遲秒數（選填）；若無則沿用 delay_sec
- error_code / error_message：在 failed / timeout 情境可回傳（情境可提供預設，建立訂單時可覆寫）

#### 4.3.2 訂單狀態機（State Machine）
- 狀態集合
  - created
  - payment_pending
  - paid（終態）
  - failed（終態）
  - cancelled（終態）
  - timeout（終態）
- 合法轉換
  - created → payment_pending（首次成功載入 /pay/:order_no 時觸發 enter_payment_page）
  - payment_pending → paid（success / delayed_success 最終結果）
  - payment_pending → failed（failed）
  - payment_pending → cancelled（cancelled）
  - payment_pending → timeout（timeout）
- 終態不可再轉換
  - paid / failed / cancelled / timeout 進入後不可再改回非終態
  - Replay 不得改變訂單終態；重播結果以 ReplayRun 記錄
- 所有狀態轉換需記錄（不可刪除、不可改寫）
  - 記錄：from_status、to_status、trigger（create/enter_payment_page/pay/complete_timeout 等）、actor_type（system/user/admin）、occurred_at、meta（例如 error_code）
- 非法狀態轉換
  - 必須拒絕並回 400，且不得寫入 OrderStateEvent（避免污染不可變事件流）

#### 4.3.3 訂單列表與查詢
- 訂單列表分頁：每頁 20
- User（Developer）只看自己的訂單；Admin 看全部
- 支援基本篩選（至少）：status、payment_method、simulation_scenario、時間區間（created_at）

### 4.4 付款方式（PaymentMethod）
- 支援：信用卡（模擬）、ATM（模擬）、超商代碼（模擬）
- 僅影響流程與顯示，不涉及真實金流
- Admin 可管理：新增/停用/排序/顯示名稱
- User（Developer）在建立訂單時只能選擇「啟用中」的付款方式

### 4.5 模擬情境（Simulation Scenario）
- 類型：success / failed / cancelled / timeout / delayed_success
- 規則
  - 可設定 delay_sec
  - 可指定 error_code / error_message（主要用於 failed / timeout）
  - Admin 可維護情境模板（模板提供預設值；建立訂單時可覆寫）

### 4.6 付款頁（Payment Page / Simulated Checkout）
- 由系統提供付款頁 URL：/pay/:order_no
- 顯示：order_no、amount、currency、payment_method、simulation_scenario、delay_sec、（若有）error_code/error_message
- 操作
  - 觸發付款：依 simulation_scenario 進行延遲（delay_sec）後決定終態
  - 顯示結果：成功/失敗/取消/逾時，以及錯誤碼/訊息（若適用）
  - 可返回訂單詳情
- 完成付款後必須導向 callback_url，並同時寫入 ReturnLog

### 4.7 回傳（Return URL / callback_url）
- 付款完成後導向 callback_url
- 回傳方式
  - query_string：以 Query String 夾帶欄位導向
  - post_form：以瀏覽器 POST application/x-www-form-urlencoded 表單送出
  - 系統參數決定預設值；建立訂單時將預設值寫入訂單的 return_method
- 回傳資料需與 Webhook 一致（欄位一致、值一致）
- 回傳資料至少包含
  - order_no、status、amount、currency、completed_at、（若適用）error_code/error_message
- 系統需記錄回傳資料與導向/送出結果到 ReturnLog
  - 若導向/送出在瀏覽器端失敗（例如 URL 不可達），仍需記錄 success=false 與 error_message

### 4.8 Webhook 模擬
- 觸發條件：僅在訂單進入終態（paid/failed/cancelled/timeout）且 webhook_url 有值
- 發送時機
  - 允許延遲發送：使用 webhook_delay_sec，若為空則沿用 delay_sec
  - Webhook 發送需可非同步（避免阻塞主要回應）
- 支援手動重送（resend）
  - 重送會新增一筆 WebhookLog；payload（業務欄位）相同，但 timestamp 與 signature 會重新產生
- Webhook Payload（欄位需與 Return 一致）
  - order_no、status、amount、currency、completed_at、（若適用）error_code/error_message
- Webhook 簽章（HMAC）
  - Request Header 必須包含：timestamp、signature
  - signature = HMAC(secret, timestamp + "." + raw_body)
  - timestamp 需在 UI 顯示，並一併記錄在 WebhookLog
  - Admin 可設定簽章密鑰輪替策略（生效中 secret + 允許前一把 secret 的驗證期）

### 4.9 操作紀錄（Audit Log）
- 需記錄使用者與系統行為（不可刪除）
- 最少事件
  - 登入/登出、建立訂單、進入付款頁、觸發付款、狀態轉換、Return 回傳、Webhook 發送/重送、Replay 執行、Admin 管理操作
- 每筆紀錄至少包含
  - actor_type（user/admin/system）、action、target（order_no 等）、occurred_at、結果（success/fail）、錯誤資訊（若有）

### 4.10 Replay（重播）
- 目的：可復現問題，重跑一次回傳與 Webhook 行為
- 規則
  - Replay 不可改變訂單既有終態
  - Replay 需產生獨立的 ReplayRun 紀錄
  - webhook_only：只重送 Webhook（會重新產生 timestamp 與 signature）
  - full_flow：重送 Return（以 UI 引導開啟 callback_url 帶 payload；並記錄 ReturnLog）+（若有）重送 Webhook

### 4.11 主要頁面需求

#### 4.11.1 頁面清單（Page Inventory）
- 登入：/login
- 訂單列表：/orders
- 建立訂單：/orders/new
- 付款頁（模擬）：/pay/:order_no
- 訂單詳情：/orders/:id
- 管理後台：/admin

#### 4.11.2 路由存取控制（Route Access Control）
- /login
  - Guest：可進入
  - User（Developer）：可進入（已登入導向 /orders）
  - Admin：可進入（已登入導向 /orders，並可由導覽進 /admin）
- /orders
  - Guest：不可（導向 /login）
  - User（Developer）：可
  - Admin：可
- /orders/new
  - Guest：不可（導向 /login）
  - User（Developer）：可
  - Admin：可
- /pay/:order_no
  - Guest：不可（導向 /login）
  - User（Developer）：可
  - Admin：可
- /orders/:id
  - Guest：不可（導向 /login）
  - User（Developer）：可（僅限自己的訂單；非本人：403）
  - Admin：可
- /admin
  - Guest：不可（導向 /login）
  - User（Developer）：不可（顯示 403）
  - Admin：可

#### 4.11.3 導覽列/Header 規則（Navigation Visibility Rules）
- Guest：只顯示登入入口（不顯示 /orders、/admin 等連結）
- User（Developer）：顯示 /orders、/orders/new、登出；不顯示 /admin
- Admin：顯示 /orders、/orders/new、/admin、登出

#### 4.11.4 Page-level 狀態（Loading / Error / Empty）
- /login：登入中（Loading）、登入失敗（Error）
- /orders：列表載入中（Loading）、無資料（Empty）、載入失敗（Error，可重試）
- /orders/new：送出中（Loading）、欄位驗證錯誤（Error/400）、伺服器錯誤（Error/500，可重試）
- /pay/:order_no：載入中（Loading）、處理中/延遲倒數（Loading）、結果顯示（Ready）、非法存取（403）、查無訂單（404）
- /orders/:id：載入中（Loading）、查無訂單（404）、權限不足（403）、Webhook 重送/Replay 執行中（Loading）
- /admin：載入中（Loading）、權限不足（403）、管理操作失敗（Error，可重試）

---

## 5. 非功能需求（Non-functional Requirements）

### 5.1 效能
- 訂單列表分頁（每頁 20）
- Webhook 發送需可非同步

### 5.2 錯誤處理
- 400：參數錯誤（表單驗證失敗、非法狀態轉換、非法 delay_sec 等）
- 401：未登入
- 403：權限不足（包含 User（Developer）存取他人訂單）
- 404：資源不存在（訂單不存在等）
- 500：模擬系統錯誤

### 5.3 安全性
- Session Cookie（HttpOnly/SameSite）驗證
- Webhook 簽章（HMAC）
- 防止重放攻擊（timestamp；接收端可檢查容忍時間窗；平台需在 UI 顯示 timestamp）
- 敏感資訊最小化：回傳/紀錄不保存任何真實卡號類資訊

### 5.4 可觀測性（Observability）
- 每筆訂單完整流程紀錄（OrderStateEvent）
- Webhook 發送紀錄（成功/失敗、回應碼、回應內容摘要）
- 操作 AuditLog（who/when/what/result）

---

## 6. 資料模型（Data Model）

### 6.1 User
- id: string
- email: string（unique）
- password_hash: string
- role: enum（DB 只存 USER_DEVELOPER / ADMIN）
- created_at: datetime
- last_login_at: datetime（nullable）

### 6.2 Order
- id: string
- order_no: string（unique）
- user_id: string（FK → User.id；建立者）
- amount: int
- currency: string（default "TWD"）
- status: enum（created/payment_pending/paid/failed/cancelled/timeout）
- callback_url: string
- return_method: enum（query_string/post_form）
- webhook_url: string（nullable）
- payment_method_code: string（FK → PaymentMethod.code）
- simulation_scenario_type: enum（success/failed/cancelled/timeout/delayed_success）
- delay_sec: int（default 0）
- webhook_delay_sec: int（nullable）
- error_code: string（nullable）
- error_message: string（nullable）
- created_at: datetime
- updated_at: datetime
- completed_at: datetime（nullable）

### 6.3 PaymentMethod
- id: string
- code: string（unique，例如 "card"/"atm"/"cvs"）
- display_name: string
- enabled: boolean
- sort_order: int
- created_at: datetime
- updated_at: datetime

### 6.4 SimulationScenarioTemplate
- id: string
- type: enum（success/failed/cancelled/timeout/delayed_success）
- default_delay_sec: int
- default_error_code: string（nullable）
- default_error_message: string（nullable）
- enabled: boolean
- created_at: datetime
- updated_at: datetime

### 6.5 WebhookLog
- id: string
- order_id: string（FK → Order.id）
- replay_run_id: string（nullable；若為 replay 產生的 webhook）
- request_url: string
- request_headers: json
- payload: json
- sent_at: datetime
- response_status: int（nullable）
- response_body_excerpt: string（nullable）
- success: boolean

### 6.6 ReturnLog
- id: string
- order_id: string（FK → Order.id）
- replay_run_id: string（nullable；若為 replay 產生的 return）
- delivery_method: enum（query_string/post_form）
- callback_url: string
- payload: json
- dispatched_at: datetime
- success: boolean
- error_message: string（nullable）

### 6.7 OrderStateEvent
- id: string
- order_id: string（FK → Order.id）
- from_status: enum
- to_status: enum
- trigger: string
- actor_type: enum（user/admin/system）
- actor_user_id: string（nullable）
- occurred_at: datetime
- meta: json（nullable）

### 6.8 AuditLog
- id: string
- actor_type: enum（user/admin/system）
- actor_user_id: string（nullable）
- action: string
- target_type: string（例如 "order"/"payment_method"/"scenario_template"/"webhook"/"return"/"replay"/"auth"）
- target_id: string（nullable）
- occurred_at: datetime
- success: boolean
- error_message: string（nullable）
- meta: json（nullable）

### 6.9 ReplayRun
- id: string
- order_id: string（FK → Order.id）
- initiated_by_user_id: string（FK → User.id）
- scope: enum（webhook_only/full_flow）
- started_at: datetime
- finished_at: datetime（nullable）
- result_status: string（例如 "success"/"fail"）
- meta: json（nullable）

### 6.10 關聯
- User 1:N Order
- Order 1:N WebhookLog
- Order 1:N ReturnLog
- Order 1:N OrderStateEvent
- Order 1:N ReplayRun
- ReplayRun 1:N WebhookLog（透過 replay_run_id）
- ReplayRun 1:N ReturnLog（透過 replay_run_id）
