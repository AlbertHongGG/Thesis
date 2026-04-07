# 任務 Spec：客服工單系統
Helpdesk / Ticket System

---

## 1. 產品目標（Product Goal）
建立一套供「客戶（Customer）」、「客服人員（Agent）」與「管理員（Admin）」使用的客服工單系統，讓系統能：
- 接收並管理客戶提交的問題/需求（Ticket）
- 透過工單進行雙向溝通（留言往返，含內部備註）
- 以明確、不可逆（Closed 為終態）的狀態機管理處理流程，非法轉換一律拒絕
- 確保歷史紀錄不可竄改（留言、狀態變更、指派變更皆需保留完整紀錄）
- 提供客服人員高效率追蹤與處理工單（未指派/已指派、狀態分流）
- 提供管理員掌握整體服務品質與負載（SLA、狀態分佈、客服負載）

系統必備能力
- 多角色系統（RBAC）：Guest / Customer / Agent / Admin
- 工單狀態機（State Machine）：狀態轉換需嚴格驗證（含角色與前置條件）
- 歷史不可變性（Immutability）：留言與狀態/指派變更採 append-only
- 資料一致性：列表、詳情、統計數據需一致
- 可追蹤性（Auditability）：誰在什麼時間做了什麼操作（Audit Log）
- 全站 UX 品質：Loading / Error / Empty / Forbidden / Not Found 狀態完整
- 多人協作一致性：不可假設單一使用者或單一角色；需處理併發操作

---

## 2. 使用者角色定義（Roles）
### 2.1 訪客（Guest）
- 權限
  - 僅可存取登入頁、註冊頁
- 可執行行為
  - 註冊帳號
  - 登入系統
- 限制
  - 不可檢視或操作任何工單
  - 嘗試存取受保護頁面：
    - 未登入（無有效 token）→ 401 → 導向登入頁 `/login`
    - 已登入但角色不符 → 403 → 顯示 Forbidden

### 2.2 客戶（Customer）
- 權限
  - 僅可存取「自己建立的工單」
  - 可存取頁面：`/tickets`、`/tickets/:id`
- 可執行行為
  - 建立新工單
  - 查看自己的工單列表
  - 查看工單詳情（含完整留言時間軸、狀態、分類、指派資訊）
  - 在允許狀態下回覆工單（新增留言）
  - 關閉工單（Resolved → Closed）
  - 登出
- 限制
  - 不可查看他人工單（防止 IDOR）
  - 不可修改工單標題與分類（建立後）
  - 已 Closed 的工單不可再回覆
  - 不可新增內部備註（is_internal=true）

### 2.3 客服人員（Agent）
- 權限
  - 可查看未指派工單與被指派給自己的工單
  - 可存取頁面：`/agent/tickets`、`/tickets/:id`（限可見範圍）
- 可執行行為
  - 接手工單（Open → In Progress，並寫入 assignee）
  - 取消接手工單（取消 assignee；狀態依規則處理，見 4.3）
  - 回覆工單（新增對客留言）
  - 變更工單狀態（依合法轉換規則）
  - 新增內部備註（客戶不可見）
  - 登出
- 限制
  - 不可刪除任何工單或留言
  - 不可修改任何留言內容
  - 不可存取管理統計頁面 `/admin/dashboard`

### 2.4 管理員（Admin）
- 權限
  - 可存取所有工單與統計資料
  - 可存取頁面：`/admin/dashboard`、`/agent/tickets`、`/tickets/:id`
- 可執行行為
  - 指派/重新指派客服人員（一次僅能有一位 assignee）
  - 強制變更工單狀態（但仍需落在狀態機允許的轉換集合；不允許跳過規則做任意狀態）
  - 檢視系統統計（SLA、狀態分佈、客服負載）
  - 管理客服人員帳號（建立/停用/角色設定）
  - 登出
- 限制
  - 不可刪除歷史資料（僅可封存；封存不代表刪除資料）

> 角色為互斥：每個 User 僅能有一個 role（Customer / Agent / Admin）。

---

## 3. 使用者流程（User Flow）
### 3.1 客戶（Customer）流程
1. 登入後進入「我的工單列表」(`/tickets`)
2. 點擊「建立新工單」
3. 填寫標題、分類、描述後送出
4. 系統建立工單，狀態為 `Open`，並在留言時間軸建立「初始描述」留言（不可修改/刪除）
5. 客服回覆後，客戶在列表與詳情可看到新留言
6. 客戶與客服透過留言互動（狀態依規則在 `In Progress` ↔ `Waiting for Customer` 間往返）
7. 客服標記為 `Resolved`
8. 客戶確認後關閉工單（`Resolved` → `Closed`）

### 3.2 客服人員（Agent）流程
1. 登入後進入「工單工作台」(`/agent/tickets`)
2. 查看「未指派」與「指派給我」的工單
3. 接手工單（`Open` → `In Progress`，並成為 assignee）
4. 回覆客戶或要求補充資料（`In Progress` → `Waiting for Customer`）
5. 客戶回覆後工單回到 `In Progress`
6. 問題解決後標記為 `Resolved`

### 3.3 管理員（Admin）流程
1. 登入後進入「管理後台」(`/admin/dashboard`)
2. 檢視 SLA、狀態分佈、客服負載
3. 進入工單詳情（`/tickets/:id`）檢視時間軸與處理狀況
4. 視需要指派/重新指派客服、或在允許規則內強制變更狀態
5. 管理客服帳號（建立/停用/調整角色）

---

## 4. 功能需求（Functional Requirements）
### 4.1 帳號與認證（Authentication）
- Email + Password 註冊/登入
- 密碼需 hash 儲存（不可明碼）
- Token-based session
  - API 端需驗證 token；無效/過期回 401
  - 前端遇 401：導向 `/login`
- 登出：使 token 失效（或在用戶端清除）並回到 `/login`

### 4.2 核心資料管理（Tickets / Messages / Admin Users）
#### 4.2.1 工單（Ticket）
工單欄位
- `id`: UUID（PK）
- `title`: string（必填，≤ 100 字，建立後不可修改）
- `category`: enum（必填，建立後不可修改）
  - 值：`Account` / `Billing` / `Technical` / `Other`
- `status`: enum（必填）
  - 值：`Open` / `In Progress` / `Waiting for Customer` / `Resolved` / `Closed`
- `customer_id`: UUID（FK, 必填）
- `assignee_id`: UUID（FK, 選填）
- `created_at`: datetime（必填）
- `updated_at`: datetime（必填）
- `closed_at`: datetime（選填）

建立工單
- 僅 Customer 可建立
- 建立後狀態固定為 `Open`
- 建立時必須同時建立一筆 `TicketMessage` 作為「初始描述」（append-only）

查看工單
- Customer：只能查看 `customer_id = 自己` 的工單
- Agent：只能查看「未指派」或「assignee_id = 自己」的工單
- Admin：可查看所有工單

列表（/tickets, /agent/tickets）
- 必須支援依 `status` 篩選
- Agent 工作台必須支援「未指派」與「指派給我」的視圖切換
- 列表每筆工單需顯示：title、category、status、updated_at、assignee（若有）

指派工單
- Agent：可接手「未指派」工單（Open → In Progress）
- Admin：可指派/重新指派任意工單（一次僅能有一位 assignee）

#### 4.2.2 工單留言（Ticket Message）
留言欄位
- `id`: UUID（PK）
- `ticket_id`: UUID（FK, 必填）
- `author_id`: UUID（FK, 必填）
- `role`: enum（必填）：`Customer` / `Agent` / `Admin`
- `content`: text（必填）
- `is_internal`: boolean（必填）
- `created_at`: datetime（必填）

規則
- 留言不可編輯、不可刪除（append-only）
- `is_internal = true`：僅 Agent / Admin 可見
- `Closed` 工單禁止新增任何留言（含內部備註）
- Customer 的留言：只允許在 `Waiting for Customer` 狀態新增（見 4.3）

#### 4.2.3 管理員：客服帳號管理（Admin Users Management）
- Admin 可建立/停用客服人員帳號
- Admin 可設定使用者角色（Customer / Agent / Admin）
- 停用帳號不可登入；若已登入需在下一次 token 驗證時被拒絕（401/403，依策略）

### 4.3 狀態機 / 規則 / 限制（Ticket State Machine）
#### 4.3.1 狀態定義
- `Open`: 客戶剛建立，尚未處理
- `In Progress`: 客服已接手處理
- `Waiting for Customer`: 等待客戶回覆
- `Resolved`: 客服已解決，等待客戶確認
- `Closed`: 工單結束（不可再互動，終態）

#### 4.3.2 合法狀態轉換（非法一律拒絕 HTTP 400）
- `Open` → `In Progress`（Agent / Admin）
- `In Progress` → `Waiting for Customer`（Agent）
- `Waiting for Customer` → `In Progress`（Customer）
- `In Progress` → `Resolved`（Agent）
- `Resolved` → `Closed`（Customer / Admin）
- `Resolved` → `In Progress`（Agent / Admin）

#### 4.3.3 狀態與操作約束
- `Closed`：禁止新增留言、禁止任何狀態變更
- Customer
  - 僅可在 `Waiting for Customer` 新增留言（回覆）
  - 僅可在 `Resolved` 將工單關閉（Closed）
- Agent
  - 僅可在 `In Progress` → `Waiting for Customer`、`In Progress` → `Resolved` 進行狀態推進
  - 可在 `Resolved` → `In Progress` 重新開啟（例如客戶補充新問題）
- Admin
  - 可執行 `Open` → `In Progress`、`Resolved` → `In Progress`、`Resolved` → `Closed`

#### 4.3.4 併發與一致性規則
- 狀態變更與指派變更必須在單一交易中完成（更新 Ticket + 寫入 Audit Log）
- 更新時必須以「當前狀態」做條件（例如 `WHERE id=? AND status=?`），避免競態造成非法狀態
- 兩位 Agent 同時接手同一筆未指派工單：僅能有一方成功（另一方需得到明確失敗回應）

### 4.4 主要頁面需求（Pages）
#### 4.4.1 頁面清單（Page Inventory）
- 登入頁：`/login`
- 註冊頁：`/register`
- 我的工單：`/tickets`
- 工單詳情：`/tickets/:id`
- 客服工作台：`/agent/tickets`
- 管理後台：`/admin/dashboard`

#### 4.4.2 各頁面責任（Page Responsibilities）
登入頁（/login）
- 顯示：Email、Password 表單
- 互動：登入
- 狀態：Loading（送出中）、Error（帳密錯誤/停用/系統錯誤）

註冊頁（/register）
- 顯示：Email、Password、Password Confirm
- 互動：註冊
- 狀態：Loading、Error（Email 已存在/驗證錯誤/系統錯誤）

我的工單（/tickets，Customer）
- 顯示：自己的工單列表（含 status、updated_at）
- 互動：建立新工單、進入工單詳情、依狀態篩選
- 狀態：Loading / Empty（無工單）/ Error

工單詳情（/tickets/:id）
- 顯示：工單基本資訊（title、status、category、assignee、created_at/updated_at）
- 顯示：完整留言時間軸（含內部備註；Customer 不可見）
- 互動：
  - Customer：在允許狀態下回覆、在 Resolved 下關閉
  - Agent：回覆、要求補充（切到 Waiting for Customer）、標記 Resolved、必要時從 Resolved 重新開啟
  - Admin：指派/改派、在允許規則內強制狀態變更
- 狀態：Loading / Forbidden（角色不符或不具可見權限）/ Not Found（不存在或不可見策略採 404）/ Error

客服工作台（/agent/tickets，Agent；Admin 可讀）
- 顯示：未指派工單、指派給我的工單（兩個視圖）
- 互動：接手工單（Open → In Progress）、進入工單詳情、依狀態篩選
- 狀態：Loading / Empty / Error

管理後台（/admin/dashboard）
- 顯示：
  - SLA 指標（至少：首次回覆時間、解決時間的平均/分佈）
  - 狀態分佈（各 status 數量）
  - 客服負載（每位 Agent 的進行中工單數）
- 互動：切換時間範圍（例如近 7 天/30 天）
- 狀態：Loading / Empty（無資料）/ Error

#### 4.4.3 主要 CTA 與互動（Primary CTAs/Interactions）
- `/tickets`：主要 CTA 為「建立新工單」
- `/tickets/:id`：主要 CTA 依角色顯示（回覆/狀態變更/指派）
- `/agent/tickets`：主要 CTA 為「接手」與「進入詳情」
- `/admin/dashboard`：主要 CTA 為「時間範圍切換」與「進入工單詳情」

#### 4.4.4 資訊架構與導覽（必填）
路由存取控制（Route Access Control）
- `/login`：Guest 可進入；已登入者進入時導向該角色預設首頁
- `/register`：Guest 可進入；已登入者進入時導向該角色預設首頁
- `/tickets`：僅 Customer 可進入；未登入導向 `/login`；已登入但角色不符顯示 403
- `/tickets/:id`：Customer（僅自己的）、Agent（未指派或指派給自己）、Admin（全部）可進入；未登入導向 `/login`
- `/agent/tickets`：僅 Agent 可進入；Admin 可視需求存取（本系統允許 Admin 進入以利監控/支援）；未登入導向 `/login`；Customer 顯示 403
- `/admin/dashboard`：僅 Admin 可進入；未登入導向 `/login`；非 Admin 顯示 403

導覽可見性規則（Navigation Visibility Rules）
- Guest：僅顯示「登入」、「註冊」
- Customer：顯示「我的工單」、「登出」
- Agent：顯示「工單工作台」、「登出」
- Admin：顯示「管理後台」、「工單工作台」、「登出」
- 不符合角色的導覽項目必須「不顯示」（不可用「顯示但點了才導登入」取代）

共用版面責任（Layout Responsibility）
- Header 必須提供：產品名稱、角色可見的導覽項目、登出入口
- Page 內的主要 CTA（例如「建立新工單」）只在頁面內提供，避免與 Header 重複

---

## 5. 非功能需求（Non-functional Requirements）
- 資料一致性
  - 工單列表數量 = 狀態統計數量（以相同資料範圍/權限）
  - 詳情頁 status/assignee 與列表顯示一致
  - 新增留言後：詳情時間軸與列表 updated_at 同步
- 安全性
  - 嚴格驗證工單存取權限（防 IDOR）
  - 所有狀態轉換做伺服器端驗證（不可只靠前端隱藏按鈕）
  - 防 XSS：留言內容需安全處理（輸出轉義/限制允許的格式）
- 可觀測性/稽核
  - 所有狀態變更、指派變更、留言新增必須寫入 Audit Log
  - Audit Log 可追蹤 who / when / what（含前後狀態/指派）
- UX 品質
  - 全站 Loading / Error / Empty / Forbidden / Not Found 狀態完整
  - 表單送出需防重送（按鈕 disabled、顯示送出中狀態）
- RWD
  - 至少支援桌機與手機可用（列表與時間軸可閱讀/可操作）
- 多人協作/併發
  - 重要操作需避免競態（接手、狀態切換、指派）
  - 失敗時需提供明確錯誤回饋（例如：狀態已變更、已被他人接手）

---

## 6. 資料模型（Data Model）
### 6.1 User
- `id`: UUID（PK）
- `email`: string（unique）
- `password_hash`: string
- `role`: enum（`Customer` / `Agent` / `Admin`）
- `is_active`: boolean（用於停用帳號）
- `created_at`: datetime
- `updated_at`: datetime

### 6.2 Ticket
- `id`: UUID（PK）
- `title`: string
- `category`: enum（`Account` / `Billing` / `Technical` / `Other`）
- `status`: enum（`Open` / `In Progress` / `Waiting for Customer` / `Resolved` / `Closed`）
- `customer_id`: UUID（FK → User.id）
- `assignee_id`: UUID（FK → User.id, nullable）
- `created_at`: datetime
- `updated_at`: datetime
- `closed_at`: datetime（nullable）

### 6.3 TicketMessage
- `id`: UUID（PK）
- `ticket_id`: UUID（FK → Ticket.id）
- `author_id`: UUID（FK → User.id）
- `role`: enum（`Customer` / `Agent` / `Admin`）
- `content`: text
- `is_internal`: boolean
- `created_at`: datetime

### 6.4 AuditLog
- `id`: UUID（PK）
- `entity_type`: enum（`Ticket` / `TicketMessage`）
- `entity_id`: UUID
- `action`: enum（`TICKET_CREATED` / `MESSAGE_CREATED` / `STATUS_CHANGED` / `ASSIGNEE_CHANGED`）
- `actor_id`: UUID（FK → User.id）
- `metadata_json`: text（紀錄前後狀態、前後 assignee、is_internal 等）
- `created_at`: datetime

### 6.5 關聯（Relationships）
- User（Customer）1:N Ticket（customer_id）
- User（Agent）1:N Ticket（assignee_id，可為 null）
- Ticket 1:N TicketMessage
- User 1:N TicketMessage（author_id）
- User 1:N AuditLog（actor_id）

### 6.6 建議索引（Indexes）
- User.email unique index
- Ticket.customer_id index
- Ticket.assignee_id index
- Ticket.status index
- Ticket.updated_at index
- TicketMessage.ticket_id + created_at composite index
- AuditLog.entity_type + entity_id + created_at composite index
