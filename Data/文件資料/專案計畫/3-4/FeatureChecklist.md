# 功能覆蓋確認表（Feature Coverage Checklist）
金流前置模擬平台（非真的刷卡）

## Authentication / Session
- [N/T] Email + 密碼登入
- [N/T] Session Cookie（HttpOnly）驗證機制
- [N/T] 登出（session 失效 + cookie 清除）
- [N/T] Session 過期處理（過期後需重新登入）
- [ ] 登入/登出/過期事件寫入 AuditLog

## RBAC / Access Control
- [N/T] 角色：Guest / User（Developer） / Admin（角色不可切換）
- [N/T] Route Guard：Guest 只能進 /login
- [N/T] Route Guard：User（Developer）可進 /orders、/orders/new、/orders/:id、/pay/:order_no
- [N/T] Route Guard：Admin 可進 /orders、/orders/new、/orders/:id、/pay/:order_no、/admin
- [N/T] API Guard：未登入回 401
- [N/T] API Guard：權限不足回 403
- [N/T] 資料隔離：User（Developer）只能讀取/操作自己建立的訂單與其紀錄（避免 IDOR）
- [N] 導覽列可見性規則（Guest/User/Admin 顯示不同選項）

## Order（Simulated Order）
- [N/T] 建立訂單（amount/currency/callback_url/webhook_url/payment_method/simulation_scenario/delay_sec 等）
- [N/T] order_no 系統產生且唯一
- [N/T] currency 預設 TWD 且限制於允許清單
- [N/T] callback_url 必填且限制 http/https
- [N/T] webhook_url 選填且限制 http/https
- [N/T] return_method 於建立時決定且建立後不可變更
- [N/T] 訂單列表（分頁每頁 20）
- [T] 訂單列表篩選（status/payment_method/simulation_scenario/created_at 時間區間）
- [N/T] 訂單詳情頁可查看訂單與相關紀錄

## PaymentMethod
- [N/T] PaymentMethod 啟用/停用
- [T] PaymentMethod 排序
- [T] PaymentMethod 顯示名稱管理
- [N/T] 建立訂單時僅能選啟用中的 PaymentMethod

## SimulationScenarioTemplate
- [N/T] 情境模板管理（success/failed/cancelled/timeout/delayed_success）
- [N/T] 模板預設值（default_delay_sec/default_error_code/default_error_message）
- [N/T] 建立訂單時模板預設值帶入且可覆寫

## Payment Page（Simulated Checkout）
- [N/T] 付款頁 /pay/:order_no
- [N/T] 首次成功載入付款頁觸發 created → payment_pending
- [N/T] 付款操作觸發依 simulation_scenario 決定終態
- [N/T] delay_sec 延遲處理（含倒數/處理中狀態）
- [ ] 付款結果顯示（paid/failed/cancelled/timeout 與錯誤碼/訊息）

## Order State Machine & OrderStateEvent
- [N/T] 狀態集合：created/payment_pending/paid/failed/cancelled/timeout
- [N/T] 合法轉換：created→payment_pending
- [N/T] 合法轉換：payment_pending→paid
- [N/T] 合法轉換：payment_pending→failed
- [N/T] 合法轉換：payment_pending→cancelled
- [N/T] 合法轉換：payment_pending→timeout
- [N/T] 終態不可再轉換（paid/failed/cancelled/timeout 不可回到非終態）
- [N/T] 每次狀態轉換寫入不可變的 OrderStateEvent

## Return URL（callback_url）
- [N/T] Return 回傳方式：query_string
- [N/T] Return 回傳方式：post_form（application/x-www-form-urlencoded）
- [N/T] Return payload 欄位（order_no/status/amount/currency/completed_at + error_code/error_message 若適用）
- [N/T] ReturnLog 紀錄（payload、delivery_method、成功/失敗）

## Webhook
- [N/T] 訂單進入終態且 webhook_url 有值時觸發 Webhook
- [N/T] Webhook 延遲（webhook_delay_sec，或沿用 delay_sec）
- [N/T] Webhook 非同步發送（不阻塞主要回應）
- [N/T] Webhook headers：signature
- [N/T] HMAC 簽章規則：signature = HMAC(secret, timestamp + "." + raw_body)
- [T] Webhook payload 欄位與 Return 一致（欄位一致、值一致）
- [N/T] WebhookLog 紀錄（request_headers/payload/sent_at/response_status/response_body_excerpt/success）
- [N] Webhook 手動重送（重新產生 timestamp/signature，新增 WebhookLog 與 AuditLog）

## Replay
- [N/T] Replay 入口（訂單詳情）
- [N/T] Replay scope：webhook_only
- [N/T] Replay scope：full_flow
- [ ] ReplayRun 紀錄（started_at/finished_at/scope/result_status/meta）
- [N/T] Replay 不改變訂單終態（結果以 ReplayRun/ReturnLog/WebhookLog 紀錄）
- [N/T] Replay 的 WebhookLog/ReturnLog 可綁定 replay_run_id

## Audit / Observability
- [T] AuditLog 紀錄（login/logout/create_order/enter_payment_page/pay/return/webhook/replay/admin_manage 等）
- [N/T] User（Developer）可查看與自己訂單相關的操作/紀錄
- [ ] Admin 可查看全站操作/紀錄
- [N/T] 訂單詳情可檢視完整流程紀錄（OrderStateEvent、ReturnLog、WebhookLog、ReplayRun）

## Admin
- [N/T] /admin 管理後台頁面
- [N/T] Admin 可管理 PaymentMethod
- [N/T] Admin 可管理 SimulationScenarioTemplate
- [ ] Admin 可查看全站訂單與操作紀錄（含篩選條件）

## Security
- [N/T] Session Cookie 安全屬性（HttpOnly/SameSite）
- [N/T] 不保存任何真實卡號類敏感資訊
