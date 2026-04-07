# 人工驗收確認表（Manual QA Checklist）
金流前置模擬平台（非真的刷卡）

## 0. 環境 / 前置條件
- [ ] 已準備至少一組 User（Developer）帳號與一組 Admin 帳號（角色不可切換）
- [ ] 測試用 callback_url 已可接收 Query String 與 POST Form（能觀察收到的欄位與值）
- [ ] 測試用 webhook_url 已可接收 POST（能觀察 headers：timestamp/signature 與 raw body）
- [ ] 瀏覽器至少測：Chrome（桌機）與手機尺寸（RWD）
- [ ] 系統時間/時區一致（completed_at、sent_at、dispatched_at 顯示正確）

## 1. 角色與權限邊界（Route Guard / API Guard）

### 1.1 Guest
- [ ] Guest 只能存取 /login，直接輸入 /orders 會被導向 /login
- [ ] Guest 直接輸入 /orders/new 會被導向 /login
- [ ] Guest 直接輸入 /pay/:order_no 會被導向 /login
- [ ] Guest 直接輸入 /orders/:id 會被導向 /login
- [ ] Guest 直接輸入 /admin 會被導向 /login
- [ ] Guest 呼叫任一受保護 API 都回 401
- [ ] Guest Header 僅顯示登入入口（不顯示 /orders、/admin 等）

### 1.2 User（Developer）
- [ ] User（Developer）可進 /orders、/orders/new、/pay/:order_no、/orders/:id
- [ ] User（Developer）進 /admin 顯示 403（不導向 /login）
- [ ] User（Developer）呼叫 Admin 管理 API 回 403
- [ ] User（Developer）只能看到自己建立的訂單；列表中不會出現他人訂單
- [ ] User（Developer）嘗試進入他人 /orders/:id 會得到 403（且不洩漏訂單內容）
- [ ] User（Developer）Header 不顯示 /admin

### 1.3 Admin
- [ ] Admin 可進 /orders、/orders/new、/pay/:order_no、/orders/:id、/admin
- [ ] Admin 可查看全站訂單列表（可依建立者篩選）
- [ ] Admin 可查看任意訂單詳情（含 ReturnLog/WebhookLog/OrderStateEvent/ReplayRun/AuditLog）

## 2. 端到端主流程（User（Developer）：建立與測試付款）
- [ ] 進入 /login，使用 User（Developer）登入成功並導向 /orders
- [ ] /orders 點擊「建立模擬訂單」進入 /orders/new
- [ ] /orders/new 預設 currency= TWD 且 return_method 有顯示（建立後不可變更）
- [ ] amount 輸入正整數可送出
- [ ] callback_url 必填且必須為 http/https（非 http/https 會 400 並顯示欄位錯誤）
- [ ] webhook_url 選填且必須為 http/https（填入不合法會 400）
- [ ] payment_method 僅能選啟用中的付款方式
- [ ] simulation_scenario 可選 success/failed/cancelled/timeout/delayed_success
- [ ] delay_sec 可設 >=0（負數會 400）
- [ ] webhook_delay_sec 若填入需 >=0（負數會 400）；若空值則沿用 delay_sec
- [ ] failed/timeout 情境可填 error_code/error_message；送出後建立訂單 status=created
- [ ] 建立成功後可取得付款頁 URL /pay/:order_no
- [ ] 首次成功載入 /pay/:order_no 時訂單狀態會從 created 推進到 payment_pending（並可在訂單詳情看到狀態轉換事件）
- [ ] 在 /pay/:order_no 點擊「付款」後，會依 delay_sec 顯示處理中/倒數
- [ ] 情境 success 最終進入 paid，completed_at 有值
- [ ] 情境 delayed_success 最終進入 paid，completed_at 有值
- [ ] 情境 failed 最終進入 failed，completed_at 有值，且回傳包含 error_code/error_message（若有設定）
- [ ] 情境 cancelled 最終進入 cancelled，completed_at 有值
- [ ] 情境 timeout 最終進入 timeout，completed_at 有值，且回傳包含 error_code/error_message（若有設定）
- [ ] 完成付款後會導向 callback_url，且回傳方式依 return_method 為 query_string 或 post_form
- [ ] Return 回傳資料至少包含 order_no/status/amount/currency/completed_at
- [ ] 完成後回到 /orders/:id 可看到 ReturnLog 已新增，且 payload 與實際回傳一致
- [ ] 訂單進入終態後，終態不可再轉換（重整付款頁或再次嘗試付款不會改變終態）

## 3. Webhook 測試（User（Developer））
- [ ] 建立訂單時填入 webhook_url
- [ ] 訂單進入終態後會發送 Webhook（若設定 webhook_delay_sec，需依設定延遲）
- [ ] Webhook headers 包含 timestamp 與 signature
- [ ] signature 計算規則符合：HMAC(secret, timestamp + "." + raw_body)
- [ ] Webhook payload 欄位與 Return 一致（欄位一致、值一致）
- [ ] /orders/:id 可看到 WebhookLog：request_url、request_headers、payload、sent_at、success、response_status、response_body_excerpt
- [ ] Webhook 送出失敗時，WebhookLog.success=false 且有 response_status 或錯誤摘要（若可取得）
- [ ] 點擊「重送 Webhook」會新增一筆 WebhookLog
- [ ] 重送後 payload（業務欄位）相同，但 timestamp 與 signature 重新產生
- [ ] 重送會新增 AuditLog（可在訂單詳情或 Admin 檢視）

## 4. Replay（重播）
- [ ] 只有終態訂單可以執行 Replay（非終態不可執行或會提示）
- [ ] Replay 選擇 webhook_only：只新增 WebhookLog（帶 replay_run_id），不新增 ReturnLog
- [ ] Replay 選擇 full_flow：會新增 ReturnLog（帶 replay_run_id），且引導開啟 callback_url 帶 payload
- [ ] Replay full_flow 若 webhook_url 有值，會再新增 WebhookLog（帶 replay_run_id）
- [ ] Replay 期間不得改變訂單狀態（終態仍保持不變）
- [ ] /orders/:id 可看到 ReplayRun（started_at/finished_at/scope/result_status）與其對應的 ReturnLog/WebhookLog

## 5. 認證（Authentication）
- [ ] 未登入呼叫受保護 API 回 401
- [ ] 登入成功後 Session Cookie 為 HttpOnly，之後 API 會自動帶入
- [ ] 登入失敗顯示錯誤訊息，且不建立 session
- [ ] 登出後 session 失效且 cookie 清除，再呼叫受保護 API 回 401
- [ ] Session 過期後任一受保護頁面重新整理會導向 /login
- [ ] 登入/登出/過期事件都有寫入 AuditLog

## 6. 訂單列表與查詢
- [ ] /orders 預設每頁 20 筆
- [ ] User（Developer）只看到自己的訂單
- [ ] Admin 可看到全站訂單
- [ ] 篩選 status 可正確縮小結果
- [ ] 篩選 payment_method 可正確縮小結果
- [ ] 篩選 simulation_scenario 可正確縮小結果
- [ ] 篩選 created_at 時間區間可正確縮小結果

## 7. 狀態機與不可變事件（OrderStateEvent）
- [ ] created → payment_pending 僅會在首次成功載入付款頁時發生
- [ ] payment_pending → paid/failed/cancelled/timeout 只會由付款觸發
- [ ] 終態（paid/failed/cancelled/timeout）後不得再轉回非終態
- [ ] 每次合法狀態轉換都會新增一筆 OrderStateEvent（from/to/trigger/actor/timestamp/meta）
- [ ] 非法狀態轉換會回 400，且不會新增 OrderStateEvent

## 8. Return（callback_url）
- [ ] query_string 回傳時欄位完整且值正確
- [ ] post_form 回傳時為 application/x-www-form-urlencoded 且欄位完整
- [ ] Return 與 Webhook 的 payload 欄位集合一致、值一致
- [ ] ReturnLog 會記錄 delivery_method/callback_url/payload/dispatched_at/success

## 9. Admin 管理功能
- [ ] Admin 可新增/停用/排序/更新 PaymentMethod 顯示名稱
- [ ] 停用的 PaymentMethod 不會出現在 /orders/new 可選清單
- [ ] Admin 可建立/編輯 SimulationScenarioTemplate（default_delay_sec、default_error_code、default_error_message、enabled）
- [ ] User 建立訂單時模板預設會帶入，且可覆寫
- [ ] Admin 可查看全站 AuditLog（至少含登入/登出/建立訂單/付款/Return/Webhook/Replay/管理操作）

## 10. 全站頁面狀態（Loading / Error / Empty）
- [ ] /login：登入中（Loading）與登入失敗（Error）顯示正確
- [ ] /orders：載入中（Loading）、無資料（Empty）、載入失敗（Error，可重試）顯示正確
- [ ] /orders/new：送出中（Loading）、欄位錯誤（Error/400）、伺服器錯誤（Error/500）顯示正確
- [ ] /pay/:order_no：載入中（Loading）、處理中/倒數（Loading）、結果顯示（Ready）、403、404 顯示正確
- [ ] /orders/:id：載入中（Loading）、404、403、Webhook 重送/Replay 執行中（Loading）顯示正確
- [ ] /admin：載入中（Loading）、403、操作失敗（Error，可重試）顯示正確

## 11. 安全性與資料最小化
- [ ] Webhook timestamp 會在 UI 與 WebhookLog 中顯示且一致
- [ ] 任一回傳/紀錄不得包含任何真實卡號類資訊
- [ ] User（Developer）無法透過改 URL 或改參數查看他人訂單（避免 IDOR）

## 12. 可觀測性（Observability）
- [ ] 訂單詳情可檢視 OrderStateEvent 時間序與 meta（例如 error_code）
- [ ] 訂單詳情可檢視 WebhookLog 成功/失敗與回應摘要
- [ ] 訂單詳情可檢視 AuditLog（與該訂單相關）
- [ ] Admin 可檢視全站操作紀錄並能依時間區間查詢
