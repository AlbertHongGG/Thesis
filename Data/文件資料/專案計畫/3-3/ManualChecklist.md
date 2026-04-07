# 人工驗收確認表（Manual QA Checklist）
SaaS 訂閱與計費管理平台（Subscription & Billing System）

---

## 0. 前置條件（環境/測試資料）
- [ ] 準備至少 2 個使用者帳號（A、B），並可分別加入不同 Organization 以驗證資料隔離。
- [ ] 準備至少 1 個 Organization，且存在 End User 與 Org Admin 兩種成員角色。
- [ ] 準備至少 1 個 Platform Admin 帳號（is_platform_admin=true）。
- [ ] 準備至少 2 個 is_active=true 的 Plan（不同 features/limits/price/billing_cycle），並至少 1 個 is_active=false 的 Plan 用於驗證不可選取。
- [ ] 準備 subscription 狀態測試資料：Trial、Active、PastDue（含 grace_period_end_at）、Suspended、Canceled、Expired（可透過 Admin Override/測試資料設定）。
- [ ] 準備 invoice 測試資料：Draft、Open、Paid、Failed、Voided（至少各 1 筆）。
- [ ] 準備 usage 測試資料：API_CALLS、STORAGE_BYTES、USER_COUNT、PROJECT_COUNT（至少 1 個 period 內有累積，並可模擬超量）。

---

## 1. 角色與權限邊界（Route + API 強制）

### Guest（未登入）
- [ ] 造訪 /pricing 回應 200 並顯示方案/週期/價格/功能差異。
- [ ] 造訪 /login 回應 200 並顯示登入表單。
- [ ] 造訪 /signup 回應 200 並顯示註冊表單。
- [ ] 直接輸入 /app 任一路徑會導向 /login（或符合 401 規則）。
- [ ] 直接輸入 /admin 任一路徑會顯示 403（或導向 /403）。

### End User（已登入，非 Org Admin）
- [ ] 可進入 /app、/app/subscription、/app/usage、/app/billing/invoices 並能載入資料。
- [ ] 不可進入 /app/billing/payment-methods（顯示 403 或導向 /403）。
- [ ] 不可進入 /app/org/members（顯示 403 或導向 /403）。
- [ ] 在 /app/subscription 不得出現可操作的 Upgrade/Downgrade/Cancel（需隱藏或 disabled 並提供原因）。
- [ ] 任意嘗試呼叫 Org Admin 專用 API 會回應 403（不可僅靠 UI 隱藏）。

### Org Admin（已登入，具 Org Admin 角色）
- [ ] 可進入 /app/billing/payment-methods 並能新增/更新/移除付款方式。
- [ ] 可進入 /app/org/members 並能邀請/移除/變更成員角色。
- [ ] 在 /app/subscription 可執行 Upgrade（立即）、Downgrade（下期生效）、Cancel。

### Platform Admin（已登入，is_platform_admin=true）
- [ ] 可進入 /admin、/admin/plans、/admin/subscriptions、/admin/metrics/revenue、/admin/metrics/usage、/admin/risk、/admin/audit。
- [ ] 非 Platform Admin 嘗試進入 /admin/** 必須回應 403（或導向 /403）。
- [ ] 所有 Platform Admin 管理操作完成後都能在 /admin/audit 查到 who/when/what/why。

---

## 2. 端到端主流程（依 User Flow）

### Guest 流程
- [ ] 進入 /pricing 可查看方案、週期、價格、功能差異。
- [ ] 在 /pricing 點擊「Sign Up」可導向 /signup。
- [ ] 在 /pricing 點擊「Login」可導向 /login。
- [ ] 完成註冊（含建立初始 Organization）後導向 /app 並能看到訂閱摘要。

### End User 流程
- [ ] 登入後導向 /app 並顯示訂閱摘要（status/plan/billing cycle）。
- [ ] 從 /app 進入 /app/usage 可查看本期用量、limits、reset 時間與超量策略提示。
- [ ] 從 /app 進入 /app/billing/invoices 可查看 invoice 清單與付款結果（Paid/Failed）。
- [ ] End User 在 /app/subscription 僅能查看，不可操作升降級/付款方式管理入口。

### Org Admin 流程
- [ ] 登入後導向 /app，並可進入 /app/subscription。
- [ ] 升級：選擇新方案/週期 → 確認 → 立即生效 → 產生 proration invoice（Open）→ 付款成功後保持/回到 Active 並立即開放新 features。
- [ ] 降級：選擇新方案/週期 → 確認 → 建立 pending change → 顯示即將失效 features/limits 與生效日期 → 到下一個 billing cycle 自動切換。
- [ ] 進入 /app/billing/payment-methods 可新增或更新付款方式。
- [ ] 進入 /app/org/members 可邀請成員、移除成員、調整角色。
- [ ] 付款失敗：invoice 付款失敗 → subscription 進入 PastDue（grace period）→ grace period 到期仍未付清 → 進入 Suspended。

### Platform Admin 流程
- [ ] 登入後可進入 /admin 並查看全平台概況。
- [ ] 在 /admin/plans 可建立/編輯/啟用/停用 Plan（價格、billing cycle、limits、features）。
- [ ] 在 /admin/subscriptions 可搜尋組織訂閱並查看狀態與歷史。
- [ ] 在 /admin/risk 可查看即將超量、PastDue、Suspended 清單。
- [ ] 在 /admin/risk 可對違規帳號 Force Suspended，對刪帳帳號 Force Expired。
- [ ] 在 /admin/audit 可查詢 audit log，且每筆管理行為都可追溯 who/when/what/why。

---

## 3. 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] /app、/app/subscription、/app/usage、/app/billing/invoices、/admin 各頁在載入中會顯示 Loading 且避免重複送出。
- [ ] 各清單頁（invoices、payment methods、members、admin plans、admin subscriptions、admin risk、admin audit）在無資料時顯示 Empty state，文案可理解。
- [ ] 各主要頁在 API 失敗時顯示 Error state 與 retry，retry 會重新拉取且不重複副作用。
- [ ] 重要狀態（PastDue/Suspended/Canceled/Expired）在 UI 明確標示並提供下一步指引。

---

## 4. 錯誤碼與導向（401 / 403 / 404 / 5xx）
- [ ] 未登入呼叫 /app/** 相關 API 回應 401，前端導向 /login。
- [ ] 權限不足呼叫 Org Admin 或 Platform Admin 相關 API 回應 403，前端顯示 /403。
- [ ] 不存在資源（例如查詢不存在 invoice_id）回應 404，前端顯示 /404（不洩漏敏感資訊）。
- [ ] 伺服器錯誤回應 5xx，前端顯示 /5xx 並提供 retry。

---

## 5. 功能需求驗收（對應 Functional Requirements）

### 5.1 帳號與認證（對應 4.1）
- [ ] 註冊成功後能建立 session，並導向 /app。
- [ ] 註冊失敗（欄位驗證）會顯示欄位級錯誤且不建立半套資料。
- [ ] 登入成功後能進入 /app 並載入資料。
- [ ] 登入失敗（錯誤帳密）顯示可理解錯誤且不建立 session。
- [ ] 登出後 session 失效，重新造訪 /app/** 會導向 /login（或符合 401 規則）。
- [ ] Platform Admin 權限判斷在後端強制：非 Platform Admin 存取 /admin/** 或相關 API 必為 403。

### 5.2 組織與成員（RBAC）（對應 4.2）
- [ ] 使用者可屬於多個 Organization 時，Header 可切換 Organization，切換後資料範圍同步切換。
- [ ] Org Admin 可邀請成員，邀請後成員出現在 /app/org/members。
- [ ] Org Admin 可移除成員或將成員狀態標記為 REMOVED。
- [ ] Org Admin 可變更成員角色（END_USER ↔ ORG_ADMIN），且導覽可見性與可操作行為立即更新。
- [ ] End User 嘗試邀請/移除/變更角色會被拒絕（UI 隱藏 + API 403）。
- [ ] 資料隔離：使用者 A 不可讀取/操作使用者 B 所屬 Organization 的 subscription/usage/invoices/members/payment methods（API 403/404 依規則）。

### 5.3 Plan 資料驅動（對應 4.3）
- [ ] /pricing 顯示的 Plan 與 /admin/plans 管理的資料一致（不需改程式碼即可新增/調整）。
- [ ] 停用的 Plan（is_active=false）不會出現在 upgrade/downgrade 的可選清單。
- [ ] 編輯 Plan 的 features/limits 後，entitlement 與 UI 顯示會一致更新（不出現 UI/Backend 不一致）。

### 5.4 訂閱與計費核心規則（對應 4.4）

#### 5.4.1 Subscription 狀態機（Trial/Active/PastDue/Suspended/Canceled/Expired）
- [ ] subscription.status=Trial 時 UI 顯示試用狀態與 trial_end_at（若有）。
- [ ] invoice 付款失敗後 subscription 轉為 PastDue，並顯示 grace_period_end_at 與提示。
- [ ] PastDue 在寬限期內付款成功可回到 Active，entitlement 立即恢復。
- [ ] grace period 到期仍未付清會轉為 Suspended，UI 顯示停權提示與下一步。
- [ ] Suspended 付清後可回到 Active。
- [ ] Canceled 不可自動回到 Active（若要再使用，需走重新訂閱流程或建立新 subscription）。
- [ ] Expired 不可恢復：任何操作不得使 Expired 回到其他狀態。

#### 5.4.2 Upgrade（立即生效 + proration invoice）
- [ ] Org Admin 在 /app/subscription 觸發升級後，subscription.plan 立即切換。
- [ ] 升級會產生 proration invoice（status=Open，含 PRORATION line item），金額與期間資訊可查看。
- [ ] proration invoice 付款成功後 invoice 變 Paid，訂閱維持/成為 Active。
- [ ] proration invoice 付款失敗後 invoice 變 Failed，subscription 進 PastDue 並顯示提示。
- [ ] 升級後 entitlement 立即更新，UI 與 Backend 的可用功能一致。

#### 5.4.3 Downgrade（下期生效 + pending change）
- [ ] Org Admin 觸發降級後不會立即切換 plan，會建立 pending_plan_id 與 pending_effective_at。
- [ ] UI 顯示將失效的 features/limits 與生效日期（pending_effective_at）。
- [ ] 若目前用量/配置超過新方案限制，UI 明確提示需要調整。
- [ ] 到下一個 billing cycle 自動切換至 pending_plan_id，並依超量策略（Block/Throttle/Overage）處理。

#### 5.4.4 Usage Metering（API_CALLS/STORAGE_BYTES/USER_COUNT/PROJECT_COUNT）
- [ ] /app/usage 顯示各 meter 本期 value 與 period_start/period_end。
- [ ] 用量累積為冪等：重送相同事件不會重複累積。
- [ ] period 邊界到達後會開新 period，舊 period 不再累積，新 period 從 0 開始。
- [ ] 超量策略提示與實際行為一致（Block/Throttle/Overage）。

#### 5.4.5 Entitlement（單一事實來源）
- [ ] UI 顯示的 features/limits 與後端 entitlement 輸出一致（UI 不可 hard-code）。
- [ ] subscription.status 變更（Active/PastDue/Suspended/Canceled/Expired）會立即反映 entitlement 與 UI。
- [ ] Admin override（forced Suspended/Expired）優先於一般訂閱狀態，且 UI/Backend 一致。

#### 5.4.6 Invoice 與付款（Draft/Open/Paid/Failed/Voided）
- [ ] 每個 billing cycle 會產生 recurring invoice（狀態與期間正確）。
- [ ] invoice 狀態轉換正確：Draft→Open→Paid/Failed，且 Voided 不可再付款。
- [ ] 付款回調冪等：同一事件重送不會重複計費或重複寫入狀態轉換。

### 5.5 Admin Override（對應 4.5）
- [ ] Platform Admin Force Suspended 必須填 reason，且立即影響 entitlement。
- [ ] Force Suspended 後可 revoke（revoked_at 設定），解除後 entitlement 回到依 subscription+plan+usage 計算。
- [ ] Platform Admin Force Expired 必須填 reason，且不可逆：不得透過 revoke 或其他操作回到可用狀態。
- [ ] 每次 override 操作都能在 /admin/audit 查到完整紀錄（who/when/what/why）。

### 5.6 管理後台（對應 4.6）
- [ ] /admin/plans 可 Create/Edit/Enable/Disable Plan，且資料驅動立即生效。
- [ ] /admin/subscriptions 可搜尋/篩選訂閱並查看狀態與歷史。
- [ ] /admin/metrics/revenue 可切換時間範圍並更新 MRR/Churn。
- [ ] /admin/metrics/usage 可切換 meter/期間並更新使用量排行。
- [ ] /admin/risk 顯示 PastDue/Suspended/即將超量清單，且可執行 Force Suspended/Force Expired。
- [ ] /admin/audit 可用 actor/role/org/action/時間範圍查詢，並可查看 payload。

---

## 6. 非功能需求驗收（對應 Non-functional Requirements）

### 一致性
- [ ] 任一方案/訂閱/用量變更後，/app 的摘要、/app/subscription、/app/usage、/app/billing/invoices 顯示一致。
- [ ] entitlement 作為 SSOT：同一功能在不同頁面的可用性判斷一致。

### 安全（RBAC + 資料隔離）
- [ ] End User 嘗試呼叫 Org Admin 管理 API（payment methods/members/subscription manage）回應 403。
- [ ] 非 Platform Admin 嘗試呼叫 Admin API 回應 403。
- [ ] 跨 Organization 資料存取一律被拒絕（API 403/404 依規則），避免透過猜測 id 讀取他人資料。

### 可靠性與併發（冪等 + 競態）
- [ ] 重要寫入操作（升級/降級/取消/新增付款方式/成員管理/override）在 Loading 期間不可重複送出。
- [ ] 付款回調事件重送不會產生重複 invoice 或重複狀態轉換。
- [ ] 用量累積事件重送不會重複累積。
- [ ] 同時發生付款事件與管理操作時，最終 subscription 狀態可預期且可追溯。

### 可用性（RWD + 重要狀態提示）
- [ ] 主要頁面在桌機與行動裝置可用且不破版。
- [ ] PastDue/Suspended/Canceled/Expired 狀態在 UI 有明確標示與下一步指引。

### 稽核與可觀測性（Audit Log）
- [ ] Org Admin 的管理操作（升級/降級/取消/付款方式管理/成員管理）都會寫入 Audit Log。
- [ ] Platform Admin 的管理操作（Plan CRUD/Override/查詢與風險操作）都會寫入 Audit Log。
- [ ] Audit Log 至少包含 actor_user_id、actor_role_context、organization_id（若適用）、action、target_type/target_id、payload、created_at。
