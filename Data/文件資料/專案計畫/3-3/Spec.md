# 任務 Spec：SaaS 訂閱與計費管理平台（Subscription & Billing System）
中央訂閱、計費、用量、Feature Flag 與權限（Entitlement）管理平台

---

## 1. 產品目標（Product Goal）
- 作為 SaaS 產品的「單一事實來源（SSOT）」：訂閱狀態、計費、用量、功能開關、實際權限（Entitlement）由後端統一計算並輸出。
- 支援多方案（Plan）與多計費週期（Monthly / Yearly），且方案資料為資料驅動：新增/調整方案不需改程式碼。
- 支援用量計費（Usage-based）與超量策略（Block / Throttle / Overage billing），用量與訂閱解耦並可依 billing cycle reset。
- 支援 Feature Flag / 功能開關與限制（limits），透過 entitlement 計算保證 UI 與 Backend 判斷一致。
- 支援帳單（Invoice）全流程：每個 billing cycle 出帳、付款成功/失敗、寬限期、停權與恢復（受不可逆規則限制）。
- 支援平台管理員（Platform Admin）操作：方案管理、強制停權/刪帳（Admin Override）、全平台營收/風險監控，且所有操作必須寫入 Audit Log。

---

## 2. 使用者角色定義（Roles）

### 2.1 Guest（未登入訪客）
- 權限
  - 可瀏覽公開方案/價格資訊。
  - 可註冊/登入。
- 可執行行為
  - 查看 Pricing（方案與價格）。
  - 註冊帳號、登入。
- 限制
  - 不可進入任何需要登入的頁面（導向登入或顯示 401/403 規則依路由設定）。

### 2.2 End User（一般使用者）
- 權限
  - 可在所屬組織（Organization）範圍內查看訂閱狀態、方案資訊、使用量、帳單與付款紀錄。
  - 可使用 entitlement 允許的功能。
- 可執行行為
  - 查看目前方案、訂閱狀態（Trial/Active/PastDue/Suspended/Canceled/Expired）。
  - 查看使用量（API calls、儲存空間、使用者數、專案數）。
  - 查看 invoice 清單與付款結果（Paid/Failed）。
  - 若具備 Org Admin 權限，才可執行「升級/降級」與「付款方式管理」。
- 限制
  - 不可管理組織成員與付款方式（除非同時是 Org Admin）。

### 2.3 Org Admin（組織管理者）
- 權限
  - 管理組織訂閱（升級/降級/取消）。
  - 管理付款方式。
  - 管理組織成員（新增/移除/角色調整）。
- 可執行行為
  - 立即升級方案（Upgrade，含 proration invoice）。
  - 安排降級（Downgrade，下期生效）。
  - 設定/更新/移除付款方式。
  - 邀請成員、移除成員、設定成員角色。
- 限制
  - 不可建立/編輯 Plan 定義。
  - 不可查看全平台營收統計。

### 2.4 Platform Admin（平台管理員）
- 權限
  - 建立/編輯/啟用/停用方案（Plan），設定價格、週期、limits 與 features。
  - 強制停權：強制 Suspended（違規），強制 Expired（刪帳）。
  - 查看全平台營收、MRR/Churn、使用量排行、風險帳號。
  - 查看歷史訂閱與帳單，查詢 audit log。
- 可執行行為
  - 透過 Admin Dashboard 管理方案、訂閱、帳單、風險與營收。
  - 執行 Admin Override（會覆蓋一般訂閱狀態）。
- 限制
  - 所有管理操作必須寫入 Audit Log，且需可追溯 who/when/what/why。

> 角色互斥與切換規則：
> - 同一個登入使用者可同時具備「End User」與「Org Admin」身分（以組織成員角色決定）。
> - Platform Admin 為獨立權限；具備 Platform Admin 的帳號可存取 /admin 路由，但不代表擁有任意組織的 Org Admin 權限。

---

## 3. 使用者流程（User Flow）

### 3.1 Guest 流程
1. 進入 Pricing（查看方案/週期/價格/功能差異）。
2. 選擇註冊或登入。
3. 註冊成功後進入 App Dashboard（若建立組織/工作區為必要步驟，則先完成建立）。

### 3.2 End User 流程
1. 登入後進入 App Dashboard。
2. 查看目前訂閱狀態與方案摘要（含 billing cycle）。
3. 進入 Usage 查看本期用量與 limits（若超量，顯示 Block/Throttle/Overage 的對應提示）。
4. 進入 Billing/Invoices 查看 invoice 清單與付款結果。
5. 若使用者不是 Org Admin：
   - 在 Subscription 頁僅能查看；升級/降級/付款方式管理入口需隱藏或 disabled 並提供原因。

### 3.3 Org Admin 流程
1. 登入後進入 App Dashboard。
2. 進入 Subscription：
   - 升級：選擇新方案/週期 → 確認 → 立即生效 → 產生 proration invoice（Open）→ 付款成功後保持 Active 並立即開放新 features。
   - 降級：選擇新方案/週期 → 確認 → 建立「下期生效」的 pending change → 顯示「即將失效」的 features/limits → 到下一個 billing cycle 自動切換。
3. 進入 Payment Methods：新增或更新付款方式。
4. 進入 Members：邀請成員、移除成員、調整角色。
5. 付款失敗處理：若 invoice 付款失敗 → Subscription 進入 PastDue（grace period）→ grace period 到期仍未付清 → 進入 Suspended。

### 3.4 Platform Admin 流程
1. 登入後進入 Admin Dashboard。
2. 方案管理：建立/編輯 Plan（價格、billing cycle、limits、features）並啟用/停用。
3. 訂閱總覽：搜尋組織訂閱，查看目前狀態與歷史。
4. 風險監控：查看即將超量、付款失敗（PastDue）與已 Suspended 的帳號。
5. 強制停權：對違規帳號強制 Suspended；對刪帳帳號強制 Expired。
6. 稽核：查詢 audit log，確認所有管理行為可追溯。

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證
- 提供註冊、登入/登出與 session 管理。
- Route guard：未登入不可進入 /app 與 /admin。
- Platform Admin 需要額外的權限判斷（不可僅依 UI 隱藏）。
- 多組織（0..N）情境：Header 需支援組織切換（若使用者屬於多個組織），切換後所有資料（subscription/usage/invoices/members/payment methods）皆以選定 organization 為範圍。

### 4.2 組織與成員（RBAC）
- Organization
  - 使用者可屬於 0..N 個組織（至少需支援 1 個）。
  - 每個 Organization 有成員列表與成員角色（End User / Org Admin）。
- 成員管理
  - Org Admin 可邀請/移除成員、調整成員角色。
  - End User 不可執行管理動作。
- 權限強制
  - 所有讀寫都必須以 organization_id 做資料隔離。
  - 防止越權（IDOR）：不可透過猜測 id 讀取/修改非所屬組織資料。

### 4.3 方案（Plan）資料驅動
- Plan 不可 hard-code；新增/調整 Plan 不需修改程式碼。
- Plan 支援：
  - name（Free/Pro/Enterprise...）
  - billingCycle（monthly/yearly）
  - price（依 billingCycle）
  - limits（maxUsers/maxProjects/apiQuota/儲存空間等）
  - features（advancedAnalytics/exportData/prioritySupport 等 boolean）
- Feature 可動態開關；limits 與 features 必須為資料驅動。
- Plan 啟用/停用：停用後不得被新訂閱選取；既有訂閱的呈現規則需明確（可保留已綁定 plan 的讀取，但不可再被選為 upgrade/downgrade 目標）。

### 4.4 訂閱（Subscription）與計費（Billing）核心規則

#### 4.4.1 Subscription 狀態機（核心）
- 狀態集合：Trial / Active / PastDue / Suspended / Canceled / Expired
- 狀態語意
  - Trial：限時試用
  - Active：正常使用
  - PastDue：付款失敗（寬限期）
  - Suspended：功能受限
  - Canceled：使用者主動取消
  - Expired：完全停止服務
- 不可逆規則
  - Expired 不可恢復（不得回到任何可用狀態）
  - Canceled 不可自動回到 Active（若要再使用，必須建立新 subscription 或重新訂閱流程）
- 狀態轉換一致性
  - 狀態轉換必須可追溯（Audit Log + 訂閱欄位時間戳）。
  - 同一時間多事件（例如付款回調與管理操作）必須避免競態，結果需可預期且可重播。

#### 4.4.2 升級 / 降級（高風險區）
- Upgrade（升級）
  - 立即生效：訂閱的 plan 立即切換。
  - 新功能立即開放（entitlement 立即更新）。
  - 需產生補差額帳單（Proration）：產生一筆 proration invoice（Open）。
  - 付款成功後維持 Active；若付款失敗則依付款規則進入 PastDue。
- Downgrade（降級）
  - 延後到下一個 billing cycle 生效（建立 pending change）。
  - 降級後將失效的功能需標記為「即將失效」，並在 UI 顯示生效日期。
  - 若目前使用量或配置超過新方案限制：
    - 必須提示使用者調整（例如超出 maxUsers/maxProjects）。
    - 到生效日仍超量時，依超量策略處理（Block/Throttle/Overage 以 plan 設定為準）。

#### 4.4.3 使用量追蹤（Usage Metering）
- 計量類型：API calls / 儲存空間 / 使用者數 / 專案數
- 行為規則
  - 即時累積使用量（以事件或計數寫入 usage record）。
  - Usage 與 Subscription 為獨立概念，但 entitlement 計算會同時參考兩者。
  - Usage reset 時機：依 subscription 的 billing cycle 邊界進行 reset（或建立新 period）。
  - 超量策略（依 plan 或 meter 設定）
    - Block：直接阻擋並提供可理解的錯誤訊息
    - Throttle：限制速率並提示
    - Overage billing（Enterprise）：允許超量並按超量出帳

#### 4.4.4 Feature Flag / Entitlement（核心）
- Entitlement 計算為 Backend 單一事實來源，不允許散落在 UI 各處自行判斷。
- entitlement 規則（概念）
  - Admin override 優先級：若 Platform Admin 對帳號設了強制 Suspended/Expired，則 entitlement 必須以 override 為準。
  - subscription.status 為 Active 才能正常使用；Trial 可依產品策略視為可用但需標示試用到期日；PastDue/Suspended/Canceled/Expired 需依規則降級功能或封鎖。
  - plan.features[feature] 必須為 true。
  - usage 必須在 limits 內（或符合超量策略）。
- UI 一致性
  - UI 顯示的可用功能、限制、CTA（Upgrade/Downgrade/Payment）必須完全依 entitlement 與角色輸出決定。

#### 4.4.5 Invoice 與付款
- Invoice 狀態集合：Draft / Open / Paid / Failed / Voided
- 出帳規則
  - 每個 billing cycle 產生一筆 recurring invoice。
  - Upgrade 會產生 proration invoice（Open）。
  - 付款失敗 → subscription 進入 PastDue。
  - 超過 grace period 仍未付清 → subscription 進入 Suspended。
- 冪等性
  - 付款回調與 invoice 狀態更新必須冪等：同一筆事件重送不得重複計費/重複寫入。

### 4.5 強制停權（Admin Override）
- Platform Admin 可對指定組織：
  - 強制 Suspended（違規）
  - 強制 Expired（刪帳）
- Override 規則
  - Admin override 優先於使用者訂閱狀態。
  - 所有 override 操作必須記錄 Audit Log（含理由）。
  - forced_status=Expired 具不可逆性：revoked_at 不得使 Expired 回到任何可用狀態。

### 4.6 管理後台（Admin Dashboard）
- 方案管理（Plan CRUD）
- 訂閱總覽（狀態、週期、近期 invoice、付款失敗）
- MRR / Churn（統計）
- 使用量排行（依 meter 與期間）
- 風險帳號（即將超量 / PastDue / Suspended）
- 稽核查詢（Audit Log 查詢）

### 4.7 主要頁面需求

#### 4.7.1 頁面清單（Page Inventory）
- Pricing（公開）：/pricing
  - 用途：展示方案、週期、價格、功能差異
- Sign Up：/signup
  - 用途：註冊並建立初始組織
- Login：/login
  - 用途：登入並建立 session

- App Dashboard：/app
  - 用途：訂閱摘要（狀態、方案、週期）、本期用量摘要、近期 invoice、風險提示（PastDue/即將超量）
- Subscription：/app/subscription
  - 用途：查看方案與狀態；Org Admin 可升級/降級/取消
- Usage：/app/usage
  - 用途：查看各 meter 用量、limits、reset 時間與超量策略提示
- Invoices：/app/billing/invoices
  - 用途：查看 invoice 清單（狀態、期間、金額）、付款結果
- Payment Methods：/app/billing/payment-methods
  - 用途：Org Admin 管理付款方式
- Members：/app/org/members
  - 用途：Org Admin 管理成員

- Admin Dashboard：/admin
  - 用途：全平台總覽（MRR/Churn/風險概況）
- Admin Plans：/admin/plans
  - 用途：Plan 管理（資料驅動）
- Admin Subscriptions：/admin/subscriptions
  - 用途：訂閱總覽與查詢
- Admin Revenue Metrics：/admin/metrics/revenue
  - 用途：MRR/Churn 與營收統計
- Admin Usage Ranking：/admin/metrics/usage
  - 用途：使用量排行
- Admin Risk Accounts：/admin/risk
  - 用途：風險帳號（即將超量/付款失敗/停權）
- Admin Audit Log：/admin/audit
  - 用途：稽核紀錄查詢（who/when/what/why）

- Forbidden：/403
- Not Found：/404
- Server Error：/5xx

#### 4.7.2 各頁面責任（Page Responsibilities）
- /app/subscription
  - 顯示：目前 plan、billing cycle、subscription.status、下次出帳日、pending downgrade（若有）。
  - Org Admin 操作：Upgrade（立即）、Downgrade（下期）、Cancel。
- /app/usage
  - 顯示：各 meter 本期用量、limits、reset 時間、超量策略（Block/Throttle/Overage）。
- /app/billing/invoices
  - 顯示：invoice 清單（Draft/Open/Paid/Failed/Voided）、每筆金額與期間、付款結果。
- /app/billing/payment-methods
  - 顯示：付款方式列表與 default 設定；僅 Org Admin 可新增/更新/移除。
- /app/org/members
  - 顯示：成員列表、角色、狀態；僅 Org Admin 可邀請/移除/變更角色。
- /admin/plans
  - 顯示：plan 列表；建立/編輯 plan 的 price、billing cycle、limits、features。
- /admin/risk
  - 顯示：PastDue、Suspended、即將超量帳號；可導向訂閱詳情與執行 override。
- /admin/audit
  - 顯示：可依 actor/role/org/action/時間範圍查詢；能查看 who/when/what/why。

#### 4.7.3 主要 CTA 與互動（Primary CTAs/Interactions）
- Guest
  - /pricing：CTA「Sign Up」「Login」
- App
  - /app/subscription：CTA「Upgrade」「Downgrade」「Cancel」（僅 Org Admin 可見/可用）
  - /app/billing/payment-methods：CTA「Add/Update Payment Method」（僅 Org Admin 可見/可用）
  - /app/org/members：CTA「Invite Member」「Remove Member」「Change Role」（僅 Org Admin 可見/可用）
- Admin
  - /admin/plans：CTA「Create Plan」「Edit Plan」「Disable/Enable Plan」
  - /admin/subscriptions：CTA「Search / Filter」「View Details」
  - /admin/risk：CTA「Force Suspended」「Force Expired」（僅 Platform Admin）

#### 4.7.4 Page-level 狀態（Loading / Error / Empty）
- 所有主要頁面需定義：
  - Loading：資料載入中（不可重複送出動作）
  - Error：顯示可理解錯誤訊息與 retry
  - Empty：清單頁在無資料時顯示 empty state（例如無 invoice、無成員）

#### 4.7.5 資訊架構與導覽（必填）
- 路由存取控制（Route Access Control）
  - /pricing、/login、/signup：Guest 可進入；已登入亦可進入（但可導向 /app）。
  - /app/**：需登入；Guest 進入導向 /login（或顯示 401 規則）。
  - /app/billing/payment-methods、/app/org/members、/app/subscription 的管理動作：需 Org Admin；非 Org Admin 顯示 403（或 UI 隱藏 + API 403）。
  - /admin/**：需 Platform Admin；非 Platform Admin 顯示 403。
- 導覽列/Header 規則（Navigation Visibility Rules）
  - Guest Header：Pricing、Login、Sign Up；不得出現 App 或 Admin 導覽。
  - Auth Header（End User/Org Admin）：Dashboard、Subscription、Usage、Invoices；Payment Methods、Members 只在 Org Admin 顯示。
  - Platform Admin Header：Admin Dashboard、Plans、Subscriptions、Revenue Metrics、Usage Ranking、Risk Accounts、Audit Log。
- 全站共用元件責任（Layout Responsibility）
  - Header 負責：登入/登出入口、組織切換（若支援多組織）、主要導覽。
  - Page 負責：該頁面主要 CTA（如 upgrade/downgrade、invite member）；避免與 Header 重複呈現相同 CTA。

---

## 5. 非功能需求（Non-functional Requirements）
- 一致性（最重要）
  - Feature、Usage、Billing、Subscription 必須同步；entitlement 由後端統一計算並輸出。
  - 不允許 UI 與 Backend 判斷不一致；UI 不可自行 hard-code features/limits。
- 安全
  - RBAC 必須在後端強制；所有敏感操作需權限驗證。
  - 防止越權讀取（同組織資料隔離、避免透過猜測 id 取得他人資料）。
- 錯誤處理
  - 401：未登入；導向 /login。
  - 403：已登入但無權限；顯示 Access Denied。
  - 404：資源不存在。
  - 5xx：伺服器錯誤；可重試並回報。
- 可靠性與併發
  - 付款回調/用量累積需具備冪等性（避免重複計費/重複累積）。
  - 訂閱狀態轉換需防止競態（同時間多個付款事件或管理操作）。
- 可擴充性
  - 支援未來 add-on（附加功能/附加用量包）。
  - 支援地區定價（region-based pricing）。
  - 支援稅率計算（tax calculation）。
- 可用性
  - RWD：桌機與行動裝置可用。
  - Loading / Error / Empty 一致。
  - 重要狀態（PastDue/Suspended/Canceled/Expired）需在 UI 清楚標示並提供下一步指引。
- 稽核與可觀測性
  - Audit Log：記錄 who/when/what/why；涵蓋 Platform Admin 與 Org Admin 的管理操作。
  - 重要狀態變更（subscription status、invoice paid/failed、override）需可追溯。

---

## 6. 資料模型（Data Model）

### User
- id: string
- email: string（unique）
- password_hash: string
- is_platform_admin: boolean
- created_at: datetime
- last_login_at: datetime?

### Organization
- id: string
- name: string
- created_at: datetime

### OrganizationMember
- id: string
- organization_id: string (FK)
- user_id: string (FK)
- role: enum（END_USER | ORG_ADMIN）
- status: enum（ACTIVE | REMOVED）
- created_at: datetime

### Plan
- id: string
- name: string
- billing_cycle: enum（monthly | yearly）
- price_cents: number
- currency: string
- is_active: boolean
- limits: json（maxUsers/maxProjects/apiQuota/storageBytes...）
- features: json（advancedAnalytics/exportData/prioritySupport...）
- created_at: datetime
- updated_at: datetime

### Subscription
- id: string
- organization_id: string (FK)
- plan_id: string (FK)
- status: enum（Trial | Active | PastDue | Suspended | Canceled | Expired）
- billing_cycle: enum（monthly | yearly）
- current_period_start: datetime
- current_period_end: datetime
- trial_end_at: datetime?
- canceled_at: datetime?
- expired_at: datetime?
- pending_plan_id: string?（下期生效的降級目標 plan）
- pending_effective_at: datetime?
- grace_period_end_at: datetime?
- created_at: datetime
- updated_at: datetime

### UsageMeter
- id: string
- code: enum（API_CALLS | STORAGE_BYTES | USER_COUNT | PROJECT_COUNT）
- name: string
- unit: string

### UsageRecord
- id: string
- organization_id: string (FK)
- subscription_id: string (FK)
- meter_code: enum（同 UsageMeter.code）
- period_start: datetime
- period_end: datetime
- value: number
- updated_at: datetime

### Invoice
- id: string
- organization_id: string (FK)
- subscription_id: string (FK)
- status: enum（Draft | Open | Paid | Failed | Voided）
- billing_period_start: datetime
- billing_period_end: datetime
- total_cents: number
- currency: string
- due_at: datetime?
- paid_at: datetime?
- failed_at: datetime?
- created_at: datetime

### InvoiceLineItem
- id: string
- invoice_id: string (FK)
- type: enum（RECURRING | PRORATION | OVERAGE | TAX）
- description: string
- amount_cents: number
- quantity: number?
- meter_code: enum?（overage 時使用）

### PaymentMethod
- id: string
- organization_id: string (FK)
- provider: string
- provider_payment_method_ref: string（token/reference）
- is_default: boolean
- created_at: datetime

### AdminOverride
- id: string
- organization_id: string (FK)
- forced_status: enum（NONE | Suspended | Expired）
- reason: string
- created_by_user_id: string (FK)
- created_at: datetime
- revoked_at: datetime?

### AuditLog
- id: string
- actor_user_id: string (FK)
- actor_role_context: enum（GUEST | END_USER | ORG_ADMIN | PLATFORM_ADMIN）
- organization_id: string?
- action: string
- target_type: string
- target_id: string?
- payload: json
- created_at: datetime

### 關聯
- Organization 1:N OrganizationMember
- User 1:N OrganizationMember
- Organization 1:1 Subscription（至少 1 個 active 或歷史 subscription 記錄；實作上可允許多筆但需定義當前有效）
- Subscription 1:N Invoice
- Invoice 1:N InvoiceLineItem
- Organization 1:N PaymentMethod
- Organization 1:N UsageRecord（以 subscription period 分段）
- Organization 1:N AuditLog
