# 任務 Spec：多商家電商平台（Marketplace）
Multi-vendor Marketplace Platform

---

## 1. 產品目標（Product Goal）
- 系統定位：平台型 Marketplace，提供多賣家商品展示、聚合結帳、按賣家拆單（SubOrder）工作流、金流收款與延遲結算、售後（取消/退款/糾紛）與稽核能力。
- 核心目標：
  - 讓訪客可瀏覽/搜尋/篩選商品；嘗試購買（加入購物車/結帳）時必須導向登入。
  - 讓買家可結帳建立 1 筆 Order + N 筆 SubOrder，完成付款並追蹤多商家拆單出貨/送達進度，能依規則申請取消/退款並完成評價。
  - 讓賣家可申請入駐並經平台審核後上架商品，處理自家 SubOrder 的出貨與售後，查詢結算。
  - 讓平台管理員可審核賣家、管理分類、介入糾紛與強制取消/退款、檢視營運數據，且重要操作需寫入 AuditLog。
- 必備能力：
  - 身分/權限：登入與 RBAC（Visitor/Buyer/Seller/Platform Admin），並且每個 API 與頁面都要檢查角色與資源擁有權。
  - 狀態機：SubOrder 必須依合法轉換前進；Order 狀態必須由 SubOrder 聚合計算。
  - 一致性：付款 callback 冪等、庫存扣減避免超賣、退款/取消/強制操作皆可稽核。
  - 體驗：主要頁面需有 Loading / Empty / Error 狀態；付款結果需清楚顯示成功/失敗/取消/重試。

---

## 2. 使用者角色定義（Roles）
### 2.1 Visitor（訪客 / Guest）
- 權限：未登入。
- 可執行行為：
  - 瀏覽商品列表（/）
  - 搜尋/篩選商品（/search）
  - 查看商品詳情（/products/:productId）
  - 嘗試加入購物車/結帳時：必須被導向 /login（不建立 Cart/Order/Payment）
- 限制：
  - 不可建立/查看訂單、付款、申請退款、評價
  - 不可存取任何 /seller/* 或 /admin/*

### 2.2 Buyer（買家）
- 權限：已登入，具備 Buyer 身分。
- 可執行行為：
  - 註冊/登入/登出
  - 操作自己的購物車（新增/調整/移除）
  - 結帳建立 Order + SubOrders
  - 付款並查看付款結果
  - 查看自己的訂單列表與訂單詳情、追蹤各 SubOrder 狀態
  - 依規則申請取消（付款前）或退款（付款後）
  - 對已 delivered 的交易商品建立 Review
- 限制（資料隔離）：
  - 只能讀寫自己的 Cart / Order / SubOrder / Payment / RefundRequest / Review

### 2.3 Seller（賣家 / 商家）
- 權限：已登入，具備 Seller 身分；Seller 身分由 SellerApplication 審核通過後取得。
- 可執行行為：
  - 申請成為賣家（/seller/apply）
  - 建立/編輯/上下架自家商品（/seller/products*）
  - 處理自家 SubOrder：出貨、取消（依狀態與規則）、售後（退款審核）
  - 查看自家結算資料（/seller/settlements*）
- 限制（資料隔離）：
  - 只能查看與操作自己的商品、SubOrder 與 Settlement
  - 不可修改平台抽成比例與拆帳規則

### 2.4 Platform Admin（平台管理員）
- 權限：已登入，具備管理員身分。
- 可執行行為：
  - 審核 SellerApplication
  - 管理 Category
  - 介入訂單糾紛與退款，必要時強制取消/退款
  - 檢視平台營運數據
- 限制：
  - 管理操作需具備稽核紀錄（AuditLog），包含審核、強制取消/退款、分類管理、結算操作。

### 2.5 權限錯誤處理（全站一致）
- 未登入存取需登入資源：回應 401，前端導向 /login
- 已登入但角色不符：回應 403，顯示 /403
- 資源不存在：回應 404，顯示 /404
- 系統例外：回應 5xx，顯示 /500

---

## 3. 使用者流程（User Flow）
### 3.1 Visitor（訪客 / Guest）流程
1. 進入商品列表（/）並瀏覽商品
2. 使用搜尋/篩選（/search）縮小範圍
3. 進入商品詳情（/products/:productId）
4. 點擊「加入購物車」或嘗試進入 /cart、/checkout 時：導向 /login

### 3.2 Buyer（買家）流程
1. 註冊（/signup）或登入（/login）
2. 瀏覽/搜尋商品，進入商品詳情，將 active 商品加入購物車
3. 進入購物車（/cart）調整數量/移除商品
4. 進入結帳（/checkout），系統檢查商品是否仍為 active 且庫存足夠
5. 建立訂單：建立 1 筆 Order（created）與 N 筆 SubOrder（pending_payment）
6. 建立 Payment（pending）並進入付款流程
7. 查看付款結果頁（/payment/result）：成功/失敗/取消，失敗可重試付款
8. 進入「我的訂單」（/orders）查看 Order 列表
9. 進入訂單詳情（/orders/:orderId）追蹤各 SubOrder 狀態
10. 進入子訂單詳情（/orders/:orderId/suborders/:subOrderId）查看子訂單與售後入口
11. 付款前取消：可取消 Order，Order cancelled、各 SubOrder cancelled
12. 付款後退款：對特定 SubOrder 申請退款（RefundRequest requested）→ 等待審核/處理 → 完成後 SubOrder refunded
13. SubOrder delivered 後：可建立評價（/reviews/new?productId=...）

### 3.3 Seller（賣家）流程
1. 已登入但尚未成為賣家：進入 /seller/apply 送出 SellerApplication（submitted）
2. 等待平台審核：approved 後取得 Seller 身分；rejected 可再次提交（以平台規則決定是否允許）
3. 進入商品管理（/seller/products）建立/編輯商品，設定 draft/active/inactive
4. 查看子訂單列表（/seller/orders），針對 paid 的 SubOrder 出貨（shipped）
5. 針對退款申請（refund_requested）進行同意或拒絕；必要時由管理員介入
6. 查看結算（/seller/settlements）與結算詳情（/seller/settlements/:settlementId）

### 3.4 Platform Admin（平台管理員）流程
1. 進入賣家申請審核（/admin/seller-applications）審核 submitted
2. 進入分類管理（/admin/categories）建立/調整分類 status
3. 進入訂單介入（/admin/orders）查詢並介入爭議訂單
4. 進入糾紛介入（/admin/disputes）處理 DisputeCase（open→resolved）
5. 進入退款處理（/admin/refunds）強制退款/核准/拒絕並寫 AuditLog
6. 進入營運數據（/admin/analytics）檢視平台整體數據

---

## 4. 功能需求（Functional Requirements）
### 4.1 帳號與認證（Authentication）
- 註冊（/signup）：建立使用者帳號。
- 登入（/login）：成功後建立登入狀態。
- 登出：清除登入狀態並回到公共頁。
- 會話失效：存取需登入資源時回 401 並導向 /login。

### 4.2 RBAC 與資源擁有權（Route + Resource Access Control）
- 任何受保護頁面（/cart、/checkout、/orders*、/seller/*、/admin/*）必須在前端路由層與後端 API 層都做權限檢查。
- Buyer：僅能操作自己的資源（Cart/Order/SubOrder/Payment/RefundRequest/Review）。
- Seller：僅能操作自己的 Product/SubOrder/Settlement。
- Platform Admin：可跨使用者/賣家查看並介入；所有管理操作必須寫 AuditLog。

### 4.3 商品瀏覽/搜尋/篩選（Public Catalog）
- 商品列表（/）：僅展示 status=active 且非 banned 的商品。
- 搜尋/篩選（/search）：依標題/描述關鍵字、分類、價格範圍等條件篩選（具體欄位可由產品決定，需一致）。
- 商品詳情（/products/:productId）：展示商品資訊、價格、庫存（或可購買狀態）、賣家資訊（最少 shop_name）。
- banned 商品：不可被展示與購買；若直接以 URL 存取，依平台策略回 404 或顯示不可用狀態（需一致）。

### 4.4 購物車（Cart）
- Buyer 可將商品加入購物車、調整數量、移除。
- 僅 active 商品可加入購物車；inactive/draft/banned 不可加入。
- 數量需符合庫存與最小值（>=1）。
- Visitor 嘗試加入購物車或進入 /cart：導向 /login。

### 4.5 結帳與建立訂單（Checkout: Order + SubOrders）
- /checkout 僅 Buyer 可進入；Visitor 必須導向 /login。
- 結帳檢查：
  - 商品仍為 active
  - 庫存足夠（建立 Order 前再次檢查）
  - 若部分賣家缺貨：必須提示並阻擋建立訂單或要求買家調整（策略需一致）
- 建立訂單：
  - 建立 1 筆 Order（status=created）
  - 依 seller_id 拆分建立 N 筆 SubOrder（status=pending_payment）
  - 計算 total_amount 與各 SubOrder subtotal

### 4.6 付款（Payment）與 callback 冪等
- 建立 Payment：payment_status=pending。
- 付款成功 callback（冪等）：
  - 以 transaction_id + order_id 作冪等鍵；重複回呼不得重複扣庫存或重複更新狀態。
  - Payment succeeded
  - Order paid
  - 各 SubOrder paid
  - 庫存扣減（需交易保證避免超賣）
- 付款失敗或取消：
  - Payment failed 或 cancelled
  - Order 保持 created（允許重試付款）
  - 各 SubOrder 保持 pending_payment
- 補償/補單：付款成功但訂單建立失敗時，必須具備補償機制（例如依 callback 事件重放建立缺失的 Order/SubOrder，或標記待人工/自動修復）。

### 4.7 出貨與完成（Fulfillment）
- Seller 僅可操作自家 SubOrder。
- Seller 對 paid 的 SubOrder 出貨：SubOrder shipped。
- Buyer 確認收貨或系統到期自動完成：SubOrder delivered。
- Order 狀態由 SubOrder 聚合計算（見 4.12 與 5.1）。

### 4.8 取消（付款前）與退款（付款後）
- 付款前取消：
  - Buyer 可取消 Order；系統將各 SubOrder 設為 cancelled，Order 設為 cancelled。
- 付款後退款（以 SubOrder 為主）：
  - Buyer 對特定 SubOrder 建立 RefundRequest（requested）。
  - Seller 審核同意或拒絕；必要時 Platform Admin 介入。
  - 支援部分退款（approved_amount < requested_amount）。
  - 同意後執行退款：RefundRequest refunded，SubOrder refunded（不可回退）。
  - 拒絕退款：RefundRequest rejected，SubOrder 恢復申請前狀態（需保存申請前狀態並寫 AuditLog）。

### 4.9 評價（Review）
- Buyer 僅能對已 delivered 的交易項目建立 Review。
- comment 必須防止 XSS（儲存與呈現需一致策略）。

### 4.10 賣家申請（SellerApplication）
- SellerApplication：submitted/approved/rejected。
- 僅 Platform Admin 可審核。
- 審核動作必須寫 AuditLog。

### 4.11 結算（Settlement）
- 平台先向 Buyer 收款，延遲結算給 Seller。
- 依 period 統計 seller 的 gross_amount，計算 platform_fee 與 net_amount。
- Settlement status：pending/settled；settled 不可修改。
- platform_fee 設定由平台管理；Seller 不可修改。

### 4.12 Order 與 SubOrder 狀態機與聚合規則
- Order 狀態 enum：created | paid | partially_shipped | completed | cancelled | refunded
- SubOrder 狀態 enum：pending_payment | paid | shipped | delivered | cancelled | refund_requested | refunded
- Order status 必須由 SubOrder 聚合計算，不可單獨任意修改。
- 建議聚合規則（需一致且可實作）：
  - 若所有 SubOrder cancelled → Order cancelled
  - 若所有 SubOrder refunded → Order refunded
  - 若所有 SubOrder delivered → Order completed
  - 若存在任一 SubOrder shipped 或 delivered 且仍存在任一 SubOrder paid 或 shipped → Order partially_shipped
  - 若所有 SubOrder 皆為 paid 且無 shipped/delivered → Order paid
  - 其他情況 → Order created（例如仍有 pending_payment）

### 4.13 SubOrder 合法狀態轉換（不可跳躍）
- pending_payment → paid（付款成功）
- paid → shipped（賣家出貨）
- shipped → delivered（送達/收貨）
- pending_payment → cancelled（付款前取消）
- paid / shipped / delivered → refund_requested（申請退款；平台可限制 delivered 後退款窗口）
- refund_requested → refunded（退款完成，不可回退）
- refund_requested → paid / shipped / delivered（拒絕退款後恢復原狀態；需保存申請前狀態並可稽核）

### 4.14 主要頁面需求（Pages）
#### 4.14.1 頁面清單（Page Inventory）
公共頁（Visitor / Buyer）
- /：商品列表
- /search：搜尋 / 篩選
- /products/:productId：商品詳情
- /login：登入
- /signup：註冊
- /cart：購物車（Visitor 進入時導向 /login）
- /checkout：結帳/付款（Visitor 進入時導向 /login）
- /payment/result：付款結果（成功/失敗/取消）
- /orders：我的訂單（Buyer）
- /orders/:orderId：訂單詳情（Buyer）
- /orders/:orderId/suborders/:subOrderId：子訂單詳情與售後（Buyer）
- /reviews/new?productId=...：新增評價（Buyer）

賣家頁（Seller）
- /seller/apply：申請成為賣家
- /seller/products：商品管理
- /seller/products/new：新增商品
- /seller/products/:productId/edit：編輯商品
- /seller/orders：子訂單列表
- /seller/orders/:subOrderId：子訂單處理（出貨/取消/售後）
- /seller/settlements：結算列表
- /seller/settlements/:settlementId：結算詳情

管理頁（Platform Admin）
- /admin/seller-applications：賣家申請審核
- /admin/categories：商品分類管理
- /admin/orders：訂單查詢與介入
- /admin/disputes：糾紛介入
- /admin/refunds：退款處理
- /admin/analytics：營運數據

全站錯誤頁
- /403：無權限
- /404：不存在
- /500：系統錯誤

#### 4.14.2 路由存取控制（Route Access Control）
- Visitor 可進入：/、/search、/products/:productId、/login、/signup、/403、/404、/500。
- Visitor 不可進入：/cart、/checkout、/payment/result、/orders*、/reviews/new、/seller/*、/admin/*；行為：導向 /login（受保護頁）或顯示 /403（已登入但角色不符）。
- Buyer 可進入：公共頁 + /cart、/checkout、/payment/result、/orders*、/reviews/new。
- Seller 可進入：公共頁 + /seller/*；不可進入 /admin/*。
- Platform Admin 可進入：公共頁 + /admin/*；必要時可查詢所有訂單/退款/糾紛。

#### 4.14.3 導覽列與可見性規則（Navigation Visibility Rules）
- Visitor Header：僅顯示「商品列表」「搜尋」「登入」「註冊」。不得顯示「購物車」「我的訂單」「賣家後台」「管理後台」。
- Buyer Header：顯示「商品列表」「搜尋」「購物車」「我的訂單」「登出」。
- Seller Header：顯示「商品列表」「搜尋」「賣家後台入口（商品/訂單/結算）」「登出」。
- Platform Admin Header：顯示「商品列表」「搜尋」「管理後台入口（申請/分類/訂單/糾紛/退款/數據）」「登出」。
- CTA 去重：同一頁面若 Header 已有「登入」入口，頁面內不再出現第二個相同主要入口；以提示文字或 disabled 行為取代。

#### 4.14.4 各頁面責任與 Page-level 狀態
- 每個頁面必須明確提供 Loading / Empty / Error 狀態與重試入口（若適用）。
- 商品列表（/）：
  - 主要區塊：商品卡片列表、基本篩選入口（可導向 /search）。
  - CTA：進入商品詳情。
- 搜尋（/search）：
  - 主要區塊：搜尋框、篩選條件、結果列表。
  - CTA：進入商品詳情。
- 商品詳情（/products/:productId）：
  - 主要區塊：商品資訊、價格、可購買狀態、加入購物車。
  - CTA：加入購物車（Visitor 需導向 /login）。
- 登入（/login）/註冊（/signup）：
  - 主要區塊：表單、錯誤提示、提交中狀態、成功後導回前頁或預設頁。
- 購物車（/cart）：
  - 主要區塊：商品項目列表、數量調整、移除、前往結帳。
- 結帳（/checkout）：
  - 主要區塊：訂單摘要、金額、付款入口；建立 Order/SubOrders 與 Payment。
- 付款結果（/payment/result）：
  - 主要區塊：成功/失敗/取消訊息、重試付款或前往訂單。
- 我的訂單（/orders）：
  - 主要區塊：Order 列表、狀態摘要、進入訂單詳情。
- 訂單詳情（/orders/:orderId）：
  - 主要區塊：Order 資訊、SubOrder 列表與各自狀態。
- 子訂單詳情與售後（/orders/:orderId/suborders/:subOrderId）：
  - 主要區塊：SubOrder 資訊、狀態、退款/售後入口。
- 新增評價（/reviews/new?productId=...）：
  - 主要區塊：rating、comment、提交；僅對 delivered 允許。
- 賣家申請（/seller/apply）：
  - 主要區塊：shop_name、文件（可選）、提交。
- 賣家商品管理（/seller/products*）：
  - 主要區塊：商品列表、建立/編輯、上下架、狀態管理。
- 賣家子訂單（/seller/orders*）：
  - 主要區塊：SubOrder 列表、出貨與售後處理入口。
- 結算（/seller/settlements*）：
  - 主要區塊：結算列表與詳情（gross/platform_fee/net/status）。
- 管理員頁（/admin/*）：
  - 主要區塊：各管理模組列表/詳情/操作入口；所有重要操作需寫 AuditLog。

---

## 5. 非功能需求（Non-functional Requirements）
- 安全與隱私：
  - 全面 RBAC 與資源擁有權檢查，防止越權（IDOR）。
  - Review comment 防 XSS：輸入/儲存/呈現策略一致。
- 一致性與併發：
  - 庫存扣減需具備交易保證，避免超賣（建立訂單前再檢查、付款成功後以鎖或原子更新扣減）。
  - Order 與 SubOrder 狀態一致，Order 由聚合規則計算。
- 冪等與補償：
  - Payment callback 需以 transaction_id + order_id 冪等。
  - 付款成功但訂單建立失敗需補償/補單機制。
- 可用性與體驗：
  - 所有列表/詳情頁提供 Loading / Empty / Error 狀態與重試。
  - 付款結果顯示成功/失敗/取消與可重試。
- 稽核：
  - 審核、強制取消/退款、分類管理、結算操作、重要狀態變更需寫 AuditLog。

---

## 6. 資料模型（Data Model）
> 欄位型別以邏輯型別描述；實作可依技術棧落地。

### 6.1 User（使用者）
- id
- email（或其他唯一登入識別）
- password_hash（或等價驗證資訊）
- roles[]：包含 buyer / seller / admin（實作可用關聯表或 enum 集合）
- created_at
- updated_at

### 6.2 Product（商品）
- id
- seller_id (FK → User)
- title
- description
- price
- stock
- category_id (FK → Category)
- status：draft | active | inactive | banned
- created_at
- updated_at

### 6.3 Category（商品分類）
- id
- name
- status：active | inactive
- created_at
- updated_at

### 6.4 Cart（購物車）
- buyer_id (PK/FK → User)
- updated_at

### 6.5 CartItem（購物車項目）
- id
- buyer_id (FK → User)
- product_id (FK → Product)
- quantity

### 6.6 Order（平台層訂單，聚合）
- id
- buyer_id (FK → User)
- total_amount
- status：created | paid | partially_shipped | completed | cancelled | refunded
- created_at
- updated_at

### 6.7 SubOrder（賣家層子訂單）
- id
- order_id (FK → Order)
- seller_id (FK → User)
- subtotal
- status：pending_payment | paid | shipped | delivered | cancelled | refund_requested | refunded
- refund_requested_prev_status（可選：保存申請前狀態，用於拒絕退款恢復）
- created_at
- updated_at

### 6.8 SubOrderItem（子訂單項目）
- id
- suborder_id (FK → SubOrder)
- product_id (FK → Product)
- unit_price_snapshot
- quantity

### 6.9 Payment（付款紀錄）
- id
- order_id (FK → Order)
- payment_method
- payment_status：pending | succeeded | failed | cancelled
- transaction_id
- callback_received_at（可選）
- created_at
- updated_at

### 6.10 RefundRequest（退款申請）
- id
- order_id (FK → Order)
- suborder_id（可選；以 SubOrder 為主）
- buyer_id (FK → User)
- reason
- requested_amount
- approved_amount（可選）
- status：requested | approved | rejected | refunded
- created_at
- updated_at

### 6.11 Settlement（結算）
- id
- seller_id (FK → User)
- period
- gross_amount
- platform_fee
- net_amount
- status：pending | settled
- created_at
- updated_at

### 6.12 Review（評價）
- id
- buyer_id (FK → User)
- product_id (FK → Product)
- rating
- comment
- created_at
- updated_at

### 6.13 SellerApplication（賣家申請）
- id
- user_id (FK → User)
- shop_name
- documents（可選）
- status：submitted | approved | rejected
- reviewed_by_admin_id（可選；FK → User）
- created_at
- updated_at

### 6.14 DisputeCase（訂單糾紛）
- id
- order_id (FK → Order)
- suborder_id（可選；FK → SubOrder）
- opened_by：buyer | seller | admin
- status：open | resolved
- resolution_note
- created_at
- updated_at

### 6.15 AuditLog（稽核紀錄）
- id
- actor_user_id (FK → User)
- actor_role
- action
- target_type
- target_id
- created_at
- metadata（可選）

### 6.16 關聯摘要
- User(買家) 1:1 Cart；Cart 1:N CartItem
- User(賣家) 1:N Product
- Category 1:N Product
- Order 1:N SubOrder
- SubOrder 1:N SubOrderItem
- Order 1:N Payment
- SubOrder 1:N RefundRequest（或 SubOrder 1:0..1 依產品策略）
- User(買家) 1:N Review；Product 1:N Review
- User 1:N SellerApplication
- Order/SubOrder 1:N DisputeCase
- 重要操作 1:N AuditLog（以 target_type/target_id 關聯）
