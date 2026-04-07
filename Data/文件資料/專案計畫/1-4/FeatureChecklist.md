# 功能覆蓋確認表（Feature Coverage Checklist）
客服工單系統（Helpdesk / Ticket System）

## Authentication / Session
- [N/T] 註冊功能（Email + Password）
- [T] 登入功能（Email + Password）
- [N/T] 登出功能（token 清除/失效並回到 `/login`）
- [N/T] Token-based session（受保護 API 需驗證 token）
- [N/T] Token 無效/過期的 401 處理（前端導向 `/login`）
- [N/T] 停用帳號（is_active=false）不可登入/不可通過 token 驗證

## RBAC / 路由存取控制 / 導覽可見性
- [N/T] Guest 僅可進入 `/login` 與 `/register`
- [N/T] Customer 可進入 `/tickets` 與可見範圍內的 `/tickets/:id`
- [N/T] Agent 可進入 `/agent/tickets` 與可見範圍內的 `/tickets/:id`
- [N/T] Admin 可進入 `/admin/dashboard`、`/agent/tickets`、`/tickets/:id`
- [N/T] 已登入但角色不符頁面顯示 403 Forbidden
- [T] Header 導覽依角色顯示（Guest/Login/Register；Customer/我的工單；Agent/工單工作台；Admin/管理後台+工單工作台）
- [N/T] 不符合角色的導覽項目不顯示（非僅點擊後再阻擋）
- [N/T] 工單資料可見範圍控制（Customer 只看自己的；Agent 只看未指派或指派給自己；Admin 全部）
- [N/T] 防止 IDOR（不可透過猜測 `/tickets/:id` 看到不該看的工單）

## Pages / UI Entry Points
- [N/T] 登入頁 `/login`
- [N/T] 註冊頁 `/register`
- [N/T] 我的工單頁 `/tickets`
- [N/T] 客服工作台 `/agent/tickets`
- [N/T] 管理後台 `/admin/dashboard`
- [N/T] 工單詳情頁 `/tickets/:id`

## Tickets（工單）
- [N/T] Customer 建立新工單（title/category/description）
- [N/T] 工單欄位存在：title、category、status、customer_id、assignee_id、created_at、updated_at、closed_at
- [N/T] 工單建立後 status 固定為 `Open`
- [N/T] 工單列表顯示欄位：title、category、status、updated_at、assignee（若有）
- [N/T] 工單列表支援依 `status` 篩選
- [N/T] 工單詳情顯示基本資訊（title/status/category/assignee/created_at/updated_at）
- [N/T] title 與 category 建立後不可修改

## Agent Workbench（客服工作台）
- [N/T] 「未指派」工單視圖
- [N/T] 「指派給我」工單視圖
- [N/T] 工單接手功能（`Open` → `In Progress` 並寫入 assignee）
- [N/T] 工作台列表進入工單詳情入口

## Ticket Messages（留言 / 內部備註 / 不可變）
- [N/T] 工單建立時自動建立「初始描述」留言
- [N/T] 工單留言新增（append-only）
- [N/T] 留言不可編輯、不可刪除
- [N/T] 內部備註（is_internal=true）存在
- [N/T] 內部備註僅 Agent/Admin 可見
- [N/T] Customer 不可新增內部備註
- [N/T] `Closed` 工單禁止新增任何留言（含內部備註）

## Ticket State Machine（狀態機）
- [N/T] 狀態集合存在：`Open` / `In Progress` / `Waiting for Customer` / `Resolved` / `Closed`
- [N/T] `Closed` 終態限制（禁止留言與狀態變更）
- [N/T] 合法轉換存在：`Open` → `In Progress`
- [N/T] 合法轉換存在：`In Progress` → `Waiting for Customer`
- [T] 合法轉換存在：`Waiting for Customer` → `In Progress`
- [N/T] 合法轉換存在：`In Progress` → `Resolved`
- [N/T] 合法轉換存在：`Resolved` → `Closed`
- [N/T] 合法轉換存在：`Resolved` → `In Progress`
- [N/T] 非法轉換拒絕（HTTP 400）
- [N/T] 角色與狀態前置條件限制（Customer 僅在 `Waiting for Customer` 可回覆；僅在 `Resolved` 可關閉）

## Admin Dashboard（管理後台）
- [N/T] SLA 指標存在（首次回覆時間、解決時間的平均/分佈）
- [N/T] 狀態分佈存在（各 status 數量）
- [N/T] 客服負載存在（每位 Agent 的進行中工單數）
- [N/T] 時間範圍切換（例如近 7 天/30 天）
- [N/T] 從 dashboard 進入工單詳情入口

## Admin Users Management（客服帳號管理）
- [N/T] 建立客服人員帳號
- [T] 停用客服人員帳號
- [N/T] 設定使用者角色（Customer / Agent / Admin）

## Audit Log（稽核 / 可追蹤）
- [N/T] Audit Log entity 存在
- [N/T] 工單建立寫入 Audit Log（TICKET_CREATED）
- [N/T] 留言新增寫入 Audit Log（MESSAGE_CREATED）
- [N/T] 狀態變更寫入 Audit Log（STATUS_CHANGED）
- [N/T] 指派變更寫入 Audit Log（ASSIGNEE_CHANGED）
- [N/T] Audit Log 可追蹤 who/when/what（actor_id、created_at、action、metadata）

## Consistency / Security / Concurrency（非功能）
- [ ] 列表與詳情資料一致（status/assignee/updated_at）
- [N/T] 統計與工單資料一致（狀態分佈總數與可見工單總數、客服負載與實際資料）
- [N/T] 併發接手避免競態（同一筆未指派工單僅一位 Agent 接手成功）
- [N/T] 併發狀態/指派變更的衝突處理（後送出者明確失敗回饋）
- [N/T] 狀態變更與指派變更具交易性（Ticket 更新 + Audit Log 寫入同一交易）

## RWD
- [N/T] 桌機與手機皆可完成主要流程（列表、詳情、留言、狀態變更、接手、dashboard 檢視）
