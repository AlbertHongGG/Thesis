# 功能覆蓋確認表（Feature Coverage Checklist）
API 平台與金鑰管理系統

## Authentication / Session
- [N/T] Email + 密碼註冊（Email 唯一）
- [N/T] 密碼不可逆雜湊儲存（不存明文）
- [N/T] 註冊後預設 role=developer、status=active
- [N/T] Email + 密碼登入
- [N/T] disabled 使用者不可登入
- [N/T] Web Session 建立與使用（受保護頁面存取）
- [N/T] 登出立即使 session 失效
- [N/T] Session 過期與撤銷處理

## RBAC / 存取控制
- [N/T] 角色：Guest / Developer / Admin
- [N] 路由存取控制（/、/register、/login、/keys、/docs、/admin）
- [N] 未登入存取受保護路由導向 /login（含 next）
- [N/T] 權限不足顯示 403（不以 404 取代）
- [N/T] 導覽可見性規則（Guest 不顯示 /keys,/docs,/admin；Developer 不顯示 /admin）
- [N/T] Developer 僅能存取自己名下 ApiKey 與 Usage Log
- [N/T] Admin 可存取 /admin 並具備全站管理能力

## API Service / Endpoint 目錄（Admin）
- [N/T] ApiService 新增
- [N/T] ApiService 編輯
- [N/T] ApiService 停用
- [N/T] ApiEndpoint 新增（method/path/status）
- [N/T] ApiEndpoint 編輯
- [N/T] ApiEndpoint 啟用/停用

## Scope / Permission（Admin）
- [N/T] ApiScope 新增
- [N/T] ApiScope 編輯
- [N/T] ApiScope ↔ ApiEndpoint 授權規則（ApiScopeRule allow）新增/移除
- [N/T] /docs 顯示 endpoint 的 scope 需求標示

## API Key 管理（Developer / Admin）
- [N/T] ApiKey 建立（name/scopes/expires_at/rate_limit）
- [N/T] API Key 原文僅建立時顯示一次（Show Once）
- [N/T] 平台僅保存 API Key hash（不保存原文）
- [N/T] ApiKey 更新設定（僅 active 可更新）
- [N/T] ApiKey 撤銷（revoked，立即失效）
- [N/T] ApiKey 封鎖（blocked，立即失效）
- [N/T] ApiKey 過期（expires_at）判定
- [N/T] Key Rotation（建立新 Key → 切換 → 撤銷舊 Key）
- [N/T] replaced_by_key_id 輪替追蹤（可選但已定義於資料模型）

## Rate Limit
- [N/T] Key 層級限流（每分鐘）
- [N/T] Key 層級限流（每小時）
- [N/T] 超限回 429 Too Many Requests

## Gateway / Proxy Request Flow
- [N/T] 解析 Authorization: Bearer {API_KEY}
- [N/T] API Key hash 比對驗證
- [N/T] Key 狀態與期限檢查（active/revoked/blocked/expired）
- [N/T] 擁有者 User.status 檢查（disabled 立即拒絕）
- [N/T] Endpoint 解析（service + method + path）與啟用狀態檢查
- [N/T] Scope 授權判定（不足回 403）
- [N/T] Rate limit 檢查（超限回 429）
- [T] 轉發至對應後端服務（ApiService）

## Usage Log / 分析
- [N/T] Usage Log 非同步寫入
- [N/T] Developer 查詢自己 key 的 Usage Log
- [N/T] Admin 查詢全站 Usage Log 與錯誤統計
- [N/T] Usage Log 查詢條件（時間範圍、Status Code、Endpoint 或 method+path）

## Audit Log / 稽核
- [N/T] Developer 敏感操作寫入 AuditLog（建立/更新/撤銷 Key）
- [N/T] Admin 查詢 AuditLog（who/when/what）

## Admin 封鎖 / 停用
- [N/T] Admin 停用使用者（User.status=disabled）
- [N/T] 停用使用者後既有 session 立即視為無效
- [N/T] 停用使用者後其名下所有 active key 立即不可用
