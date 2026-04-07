# 功能覆蓋確認表（Feature Coverage Checklist）

SaaS 訂閱與計費管理平台（Subscription & Billing System）

---

## Authentication / Session

- [T] 註冊（含建立初始 Organization）
- [T] 登入
- [T] 登出

## Organization / RBAC

- [N/T] Organization 成員角色（END_USER / ORG_ADMIN）
- [N] 組織切換（多 Organization）

## Plans（資料驅動）

- [N/T] Plan 資料驅動（新增/調整不需改程式碼）
- [N/T] Plan 啟用/停用（is_active）
- [N/T] Plan pricing（依 billing_cycle）
- [N/T] Plan limits（json）
- [N/T] Plan features（json）

## Subscription / Billing 核心

- [N/T] Subscription 狀態集合（Trial/Active/PastDue/Suspended/Canceled/Expired）
- [N/T] Subscription 不可逆規則（Expired 不可恢復；Canceled 不可自動回 Active）
- [N/T] Upgrade（立即生效）
- [N/T] Upgrade Proration Invoice（Open）
- [N/T] Downgrade Pending Change（pending_plan_id/pending_effective_at，下期生效）
- [N] Cancel Subscription（Org Admin）
- [N] 每個 billing cycle 產生 recurring invoice
- [N/T] Invoice 狀態集合（Draft/Open/Paid/Failed/Voided）
- [N] InvoiceLineItem 類型（RECURRING/PRORATION/OVERAGE/TAX）
- [N/T] 付款成功/失敗處理（Paid/Failed + 訂閱狀態更新）
- [N/T] Grace period（PastDue→Suspended）

## Usage Metering / Limits

- [N/T] UsageMeter（API_CALLS/STORAGE_BYTES/USER_COUNT/PROJECT_COUNT）
- [N/T] UsageRecord 依 period 分段（period_start/period_end）
- [N] 依 billing cycle 邊界進行 usage reset（新 period）
- [T] 超量策略：Block
- [T] 超量策略：Throttle
- [ ] 超量策略：Overage billing（允許超量並按超量出帳）

## Feature Flag / Entitlement（SSOT）

- [N/T] 後端 entitlement 計算（SSOT，不允許 UI 自行 hard-code）
- [ ] entitlement 驅動 UI 可見性與可操作性一致（前後端一致）

## Admin Override

- [N/T] AdminOverride（forced_status=Suspended/Expired）
- [N/T] Override 優先權（覆蓋一般訂閱狀態於 entitlement）
- [N/T] Force Suspended（含 reason）
- [N/T] Force Expired（含 reason，不可逆）
- [N/T] Revoke Override（僅 Suspended）

## Admin Dashboard / Admin Pages

- [N/T] Admin Dashboard（MRR/Churn/風險概況）
- [N/T] Admin Plans（Create/Edit/Enable/Disable）
- [T] Admin Subscriptions（Search/Filter/View Details）
- [T] Admin Revenue Metrics（MRR/Churn）
- [T] Admin Usage Ranking（依 meter/期間）
- [ ] Admin Risk Accounts（PastDue/Suspended/即將超量 + override actions）
- [N/T] Admin Audit Log（查詢 who/when/what/why）

## Pages / UX States

- [N/T] /pricing
- [T] /signup
- [T] /login
- [N/T] /app
- [N/T] /app/subscription
- [N/T] /app/usage
- [N/T] /app/billing/invoices
- [N/T] /app/billing/payment-methods
- [N/T] /app/org/members
- [N/T] /admin
- [N/T] /admin/plans
- [T] /admin/subscriptions
- [T] /admin/metrics/revenue
- [T] /admin/metrics/usage
- [T] /admin/risk
- [N/T] /admin/audit
- [T] /403
- [N/T] /404
- [T] /5xx
- [N/T] Loading 狀態（主要頁面）
- [N/T] Error 狀態（主要頁面）
- [N/T] Empty 狀態（清單頁）

## Audit / Observability / Security / Reliability

- [N/T] AuditLog 寫入（Org Admin 管理操作）
- [N/T] AuditLog 寫入（Platform Admin 管理操作）
- [N] AuditLog 查詢/篩選（actor/role/org/action/time）
- [N/T] 付款回調冪等性（避免重複計費/重複狀態）
- [N/T] 用量累積冪等性（避免重複累積）
