# 任務 Spec：API 平台與金鑰管理系統
API Platform & Key Management System

---

## 1. 產品目標（Product Goal）
建立一個集中式 API 平台（含 Web 管理後台 + API Gateway/Proxy 能力），讓內部系統或第三方開發者可以在「安全、可控、可稽核」的前提下對外使用受保護的 API 服務。

### 1.1 核心價值
- 安全地對外開放能力（API 服務）
- 以角色與權限（RBAC + Scope）控制存取
- 以 Rate Limit 與有效期限控制濫用與風險
- 以完整 Log / 監控 / 稽核追溯每次 API 存取

### 1.2 系統必備能力（Must Have）
- 多角色存取控制（RBAC）：Guest / Developer / Admin
- 平台帳號登入：Email + 密碼
- Web Session（用於後台頁面存取），支援登出立即失效
- API 呼叫憑證：API Key（HTTP Header：`Authorization: Bearer {API_KEY}`）
- API Key 發放 / 撤銷 / 封鎖 / 立即失效
- Key 僅建立時顯示一次（平台只存 Hash；UI/API/Log 永不得回傳原文）
- Scope / Permission 管理（可對應 Service / Endpoint / Method）
- Rate Limit（至少支援每分鐘、每小時；可依 Key 與 Endpoint）
- 使用紀錄（Usage Log）與查詢（全站與每 Key）
- Key Rotation（建立新 Key → 切換 → 撤銷舊 Key），可追蹤 replaced_by_key_id
- 停用 / 封鎖能力（Key / 使用者；黑名單 IP 為選配）
- 全站稽核（Audit Log）：管理行為與敏感操作可追溯（who/when/what）

### 1.3 成功指標（Success Criteria）
- 受保護 API 呼叫在 Gateway 端能正確回應：401/403/429/5xx，且對應的 Usage/Audit（若適用）可被查詢。
- Key 建立後原文僅顯示一次，後續任何 UI/API/Log 不可取得 Key 原文（包含匯出/下載/除錯頁）。
- 管理後台頁面與路由對角色顯示/存取一致：
  - 不該出現的導航不顯示
  - 存取被拒時行為符合規範（未登入導向 /login；權限不足顯示 403）

### 1.4 系統邊界（Out of Scope）
- OAuth2 / OpenID Connect（可延伸但不納入本期）
- 計費 / 付費與配額計費模型
- 真實金流與收款

---

## 2. 使用者角色定義（Roles）
系統共有 3 種可見角色：Guest / Developer / Admin。

### 2.1 訪客（Guest）
- 權限
  - 僅可存取公開頁面（首頁、註冊、登入）
- 可執行行為
  - 查看平台介紹（/）
  - 註冊（/register）
  - 登入（/login）
- 限制
  - 不可查看 API 清單與文件
  - 不可申請/管理 API Key
  - 不可存取 /keys、/docs、/admin（嘗試進入時導向 /login）

### 2.2 開發者（Developer）
代表使用 API 的第三方或內部開發者（必須先完成註冊並登入）。
- 權限
  - 僅能管理「自己名下」的 API Key 與其設定
  - 可存取 API 文件（僅顯示啟用中的 API Service/Endpoint，並標示授權需求 Scope）
  - 可查看自己的 Usage Log 與統計
- 可執行行為
  - 建立 / 更新（name/scopes/expires_at/rate_limit）/ 撤銷 API Key
  - Key Rotation（建立新 Key → 切換 → 撤銷舊 Key）
  - 查看自己的 API 使用紀錄與基礎統計
- 限制
  - 不可存取他人 Key 與他人使用紀錄
  - 不可存取 /admin（需顯示 403）
  - 不可變更平台全域設定（Scope 定義、全站 Rate Limit 上限、API Service 定義等）

### 2.3 管理員（Admin）
- 權限
  - 全平台管理（API Service/Endpoint/Scope/Rate Limit 規則）
  - 監控與稽核（全站用量、錯誤、封鎖/停用、管理操作）
- 可執行行為
  - API Service CRUD（新增/編輯/停用）
  - Endpoint 設定（HTTP Method / Path / 啟用狀態）
  - Scope CRUD 與 Scope ↔ Endpoint 規則設定
  - 設定平台預設 / 上限 Rate Limit 規則
  - 封鎖/撤銷任意 Key、停用使用者
  - （選擇性）管理黑名單 IP
  - 查看全站使用與錯誤紀錄、查詢單一 Key/使用者的歷史

### 2.4 角色與狀態約束
- 角色不可自行切換：使用者的 role 由系統或 Admin 指派。
- Developer 註冊後預設 role=developer、status=active。
- 被停用的使用者（status=disabled）：
  - 不可登入（登入需明確失敗，不可建立新 session）
  - 任何既有 session 必須被視為無效（下一次請求需要重新登入且應被拒）
  - 其名下所有 active Key 必須立即視為不可用（Gateway 驗證階段即拒絕）

---

## 3. 使用者流程（User Flow）

### 3.1 Guest：註冊與登入
1. 進入首頁（/）查看平台介紹
2. 前往註冊（/register），以 Email + 密碼建立帳號
3. 註冊成功後前往登入（/login）
4. 登入成功後導向 API Key 管理（/keys）

### 3.2 Developer：API Key 申請流程
1. 登入平台（/login）
2. 進入 API Key 管理頁（/keys）
3. 點擊「建立 Key」
4. 輸入 Key 名稱
5. 選擇 API Service 與 Scope（可多選）
6. 設定有效期限（可選：不設定代表永不過期，或依平台規則限制）
7. 設定 Rate Limit（每分鐘 / 每小時；可選）
8. 系統產生 API Key（僅顯示一次，使用者需自行複製保存）
9. 開始呼叫 API（以 `Authorization: Bearer {API_KEY}`）

### 3.3 Developer：Key 輪替（Rotation）
1. 在（/keys）建立一把新 Key（Scope/期限/Rate Limit 設定完成）
2. 將應用程式改用新 Key
3. 驗證新 Key 呼叫 API 正常（成功/失敗情境皆可觀察）
4. 撤銷舊 Key（舊 Key 立即失效，後續呼叫應被拒絕）

### 3.4 Developer：查看使用紀錄與排查
1. 進入（/keys）選擇某把 Key
2. 查看該 Key 的 Usage Log（近期請求、Status Code、Response Time）
3. 依 Endpoint/時間範圍/Status Code 篩選（平台必須支援最少查詢條件）
4. 看到 401/403/429 時，依原因調整（Key 狀態/Scope/Rate Limit/期限）

### 3.5 Admin：平台管理與監控
1. 登入後進入管理後台（/admin）
2. 管理 API Service（新增/編輯/停用）
3. 管理 Endpoint（method/path、啟用狀態）
4. 定義 Scope 與存取規則（Scope 可對應 Service/Endpoint/Method）
5. 調整 Rate Limit 規則（平台預設/上限；必要時覆寫特定 Service/Endpoint）
6. 查看全站流量與錯誤統計（含 401/403/429/5xx）
7. 針對濫用：封鎖 Key / 停用使用者 /（選擇性）封鎖 IP
8. 透過 Audit Log 稽核誰在何時做了哪些敏感操作

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證（Authentication）
- 註冊（/register）
  - 以 Email + 密碼建立帳號
  - Email 必須唯一（不分大小寫視為同一 Email）
  - 密碼需以不可逆 Hash 儲存（不存明文）
  - 註冊成功後預設 role=developer、status=active
  - 註冊成功後不得自動登入（必須導向 /login）
- 登入（/login）
  - 以 Email + 密碼登入
  - disabled 使用者不可登入（回應需一致、不可建立 session）
  - 登入成功後建立 Web Session（用於 Web 後台頁面存取）
  - 更新使用者 last_login_at
- 登出
  - 登出會使 session 失效（UserSession.revoked_at 設定）
- Session 基本規則
  - Session 需有過期時間（expires_at）
  - 每次受保護頁面請求可更新 last_seen_at

### 4.2 授權與權限（Authorization / RBAC）
- Web 後台與管理功能必須受 RBAC 控制
- Developer
  - 僅能操作自己的 Key 與自己的 Usage Log
  - 不可存取 /admin（需顯示 403）
- Admin
  - 可管理全站資源與查詢全站紀錄
- 受保護頁面存取規則
  - 未登入：導向 /login（可帶 next 參數回跳原頁）
  - 權限不足：顯示 403（本系統採 403，而非 404 隱藏）
- 導覽可見性規則（必須與路由 guard 一致）
  - Guest：不得顯示 /keys、/docs、/admin
  - Developer：不得顯示 /admin
  - Admin：可顯示 /admin，亦可顯示 /keys、/docs

### 4.3 API Service / Endpoint 目錄管理（Admin）
- Admin 可建立/編輯/停用 API Service
- Admin 可在每個 Service 下管理 Endpoint：HTTP Method + Path + 啟用狀態
- Endpoint 必須能被 Scope 規則引用（以控制存取）
- Endpoint 的 method/path 必須可被 Gateway 用於路由與授權判斷（method + path + service）
- 唯一性與衝突
  - 同一 Service 下，Endpoint 的 (method, path) 不可重複

### 4.4 API Key 管理（Developer / Admin）

#### 4.4.1 API Key 欄位
- `key`：金鑰值（只在建立時顯示一次；平台僅存 Hash）
- `name`：Key 名稱（Developer 自訂，便於辨識）
- `scopes`：權限集合（多選）
- `expires_at`：過期時間（可選）
- `rate_limit`：請求上限（可選；至少支援每分鐘/每小時）
- `status`：`active` / `revoked` / `blocked`

#### 4.4.2 規則
- Key 僅在建立時顯示一次；之後不可再次查看原始 Key
- 系統僅儲存 Key 的 Hash；驗證時以雜湊比對
- Key 可隨時撤銷（revoked）；撤銷後立即失效
- Key 可被 Admin 封鎖（blocked）；封鎖後立即失效
- Key 到期後視為無效（回 401）
- 僅 status=active 的 Key 允許更新設定（name/scopes/expires_at/rate_limit）

#### 4.4.3 可操作行為
- Developer
  - 建立 Key
  - 更新 Key 設定（name/scopes/expires_at/rate_limit）：僅限 status=active 的 Key
  - 撤銷 Key：僅限自己名下
  - 查看 Key Usage Log（僅自己名下）
- Admin
  - 查詢任意使用者的 Key
  - 撤銷/封鎖任意 Key

### 4.5 Scope / Permission 管理（Admin）
- Scope 由 Admin 定義與管理
- Scope 可對應到：API Service、Endpoint、HTTP Method（透過 ApiScopeRule 對 Endpoint 授權）
- Scope 命名規則需一致且可讀（例如：`user:read`、`user:write`、`payment:read`）
- Scope 規則必須可判定某次請求是否允許（基於 service + method + path）
- 權限判定
  - 若請求對應到某 Endpoint，且 Key scopes 中不存在任何可 allow 該 Endpoint 的 ScopeRule，則回 403

### 4.6 Rate Limit
- Rate Limit 支援：每分鐘、每小時
- Rate Limit 可依：Key、Endpoint（至少 Key 層級必須有）
- 超過限制回傳：`429 Too Many Requests`
- 429 回應需可被 Usage Log 記錄，並可在（/keys）或（/admin）被查到
- Rate Limit 上限
  - 平台需定義全域預設與上限（Admin 可調整）
  - Developer 只能在上限範圍內設定自己的 Key

### 4.7 API 呼叫流程（Request Flow / Gateway）
對所有受保護 API 請求，平台在轉發到後端服務前必須執行：
1. 解析 `Authorization: Bearer {API_KEY}`
2. 驗證 API Key 是否存在且 Hash 比對成功
3. 檢查 Key 狀態（active / revoked / blocked）與過期時間
4. 檢查擁有者使用者狀態（User.status 必須為 active）
5. 判定目標 Endpoint（service + method + path）並確認 Endpoint.status=active
6. 驗證 Scope（Key scopes 是否允許目標 service/endpoint/method）
7. 檢查 Rate Limit（Key/Endpoint）
8. 轉發至對應後端服務（API Service）
9. 記錄請求與回應結果（Usage Log）

狀態碼規範
- 401：缺少/無效/過期/撤銷/封鎖 Key（或未登入存取 Web 受保護頁）
- 403：Scope 不足（或 Developer 進 /admin）
- 429：超過 Rate Limit
- 500：平台錯誤

### 4.8 使用紀錄（Usage Log）與分析
- 每次 API 呼叫需記錄以下資訊（至少）：
  - API Key ID
  - Endpoint（或 method + path）
  - HTTP Method
  - Status Code
  - Response Time
  - Timestamp
- Developer 可查看「自己的 Key」使用紀錄
- Admin 可查看全站使用與錯誤統計
- Log 寫入需為非同步，避免影響請求延遲
- Usage Log 查詢最少支援：時間範圍、Status Code、Endpoint（或 method+path）

### 4.9 Key Rotation
- Developer 可建立多把 Key（用於輪替）
- 建立新 Key 後，可在不影響舊 Key 的情況下並行測試
- 撤銷舊 Key 後，舊 Key 立即失效（回 401）
- 平台需保留舊 Key 的 Usage Log 與狀態（以供稽核）
- Rotation 關聯
  - 若新 Key 用於替換舊 Key，系統在舊 Key 記錄 `replaced_by_key_id`

### 4.10 停用 / 封鎖能力（Admin）
- Admin 可封鎖單一 Key（blocked）
- Admin 可撤銷 Key（revoked）
- Admin 可停用使用者帳號（disabled）：
  - 使該使用者所有 active Key 立即失效
  - 使該使用者既有 session 立即視為無效
- （選擇性）Admin 可維護黑名單 IP：被封鎖 IP 的受保護 API 請求可直接拒絕

### 4.11 稽核（Audit Log）
- 需記錄敏感操作（至少）：
  - Admin：API Service/Endpoint/Scope 的增刪改、Rate Limit 規則調整、封鎖/撤銷 Key、停用使用者、IP 黑名單變更
  - Developer：建立 Key、撤銷 Key、更新 Key（name/scopes/期限/Rate Limit）
- Audit Log 需包含 who/when/what（操作者、時間、操作類型、目標資源）

### 4.12 主要頁面需求（Page Requirements）

#### 4.12.1 資訊架構與導覽（Information Architecture & Navigation）
- Header/導航必須依「登入狀態」與「角色」顯示不同選項
- 禁止以「顯示但點了才導登入」取代「不該出現」：
  - Guest 狀態下不得顯示 /keys、/docs、/admin
  - Developer 狀態下不得顯示 /admin
- 全站共用 Layout 責任
  - Header 提供：登入/登出入口（依登入狀態）與主要頁面導覽
  - 各頁面自身 CTA（例如建立 Key）必須在頁面內提供，不與 Header 重複

#### 4.12.2 頁面清單（Page Inventory）
- 首頁（/）：平台介紹、能力與安全說明
- 註冊（/register）：建立 Developer 帳號
- 登入（/login）：Email + 密碼登入
- API Key 管理（/keys）：建立/撤銷/封鎖 Key、設定 Scope/期限/Rate Limit、查看使用紀錄
- API 文件（/docs）：查看 API Service/Endpoint 概覽與 Scope 需求
- 管理後台（/admin）：管理 Service/Endpoint/Scope/Rate Limit、封鎖/停用、全站監控與稽核
- 無權限頁（/403）：顯示無權限（Forbidden）
- Not Found（/404）：未知路由顯示 Not Found
- 平台錯誤頁（/500）：顯示平台錯誤與 Retry

#### 4.12.3 路由存取控制（Route Access Control）
- /：Guest ✅ / Developer ✅ / Admin ✅
- /register：Guest ✅ / Developer ❌（已登入導向 /keys）/ Admin ❌（已登入導向 /admin）
- /login：Guest ✅ / Developer ❌（已登入導向 /keys）/ Admin ❌（已登入導向 /admin）
- /keys：Guest ❌（導向 /login）/ Developer ✅ / Admin ✅
- /docs：Guest ❌（導向 /login）/ Developer ✅ / Admin ✅
- /admin：Guest ❌（導向 /login）/ Developer ❌（顯示 403）/ Admin ✅

#### 4.12.4 Page-level 狀態（每頁至少需支援）
- Loading：資料載入中（按鈕需避免重複送出）
- Empty：無資料（例如 /keys 尚未建立任何 Key、Usage Log 無紀錄）
- Error：顯示可理解的錯誤訊息與 Retry
- 403：顯示無權限頁面
- 404：未知路由顯示 Not Found（不取代權限不足的 403）
- 5xx：顯示平台錯誤頁與 Retry

---

## 5. 非功能需求（Non-functional Requirements）

### 5.1 安全性
- API Key 必須 Hash 儲存
- HTTPS only
- 最小權限原則：Scope 需精準對應 Endpoint/Method
- 敏感資訊保護：
  - API Key 原文不可在任何頁面二次顯示
  - Log（Usage/Audit）不得寫入 API Key 原文
- Web Session 安全
  - disabled 使用者的既有 session 必須立即視為無效
- 防止重放攻擊（至少：拒絕明顯異常重放；可延伸 request_id/時間戳與簽章）
- （選擇性）IP 白名單與黑名單

### 5.2 效能與可用性
- 驗證流程（Key 驗證 + Scope + Rate Limit）平均耗時 < 10ms（同一服務內目標）
- Log 寫入非同步，不阻塞 API 轉發
- 支援高併發（Rate Limit 與 Log 寫入不可成為單點瓶頸）

### 5.3 錯誤處理與一致性
- 狀態碼規範
  - 401：Key 無效/過期/撤銷/缺少（或未登入）
  - 403：Scope 不足（或 Developer 進 /admin）
  - 429：超過 Rate Limit
  - 500：平台錯誤
- Web UI 對應顯示
  - 401：導向 /login 或提示重新登入
  - 403：顯示無權限頁面
  - 429：顯示節流提示與重試建議
  - 5xx：顯示錯誤頁與重試
- 資料一致性
  - 撤銷/封鎖 Key 後，所有後續請求必須立即被拒絕
  - 停用使用者後，其名下所有 Key 必須不可再使用

---

## 6. 資料模型（Data Model）

### 6.1 User
- `id`：string (uuid)
- `email`：string（唯一）
- `password_hash`：string
- `role`：enum（`developer` / `admin`）
- `status`：enum（`active` / `disabled`）
- `created_at`：datetime
- `last_login_at`：datetime（可選）

### 6.2 ApiService
- `id`：string (uuid)
- `name`：string（唯一）
- `description`：string
- `status`：enum（`active` / `disabled`）
- `created_at`：datetime

### 6.3 ApiEndpoint
- `id`：string (uuid)
- `service_id`：FK → ApiService.id
- `method`：string（GET/POST/PUT/PATCH/DELETE）
- `path`：string（例如 `/users`）
- `description`：string（可選）
- `status`：enum（`active` / `disabled`）

### 6.4 ApiScope
- `id`：string (uuid)
- `name`：string（唯一；例如 `user:read`）
- `description`：string
- `created_at`：datetime

### 6.5 ApiScopeRule（Scope ↔ Endpoint 規則）
- `id`：string (uuid)
- `scope_id`：FK → ApiScope.id
- `endpoint_id`：FK → ApiEndpoint.id
- `effect`：enum（`allow`）

### 6.6 ApiKey
- `id`：string (uuid)
- `user_id`：FK → User.id
- `name`：string
- `hash`：string（Key hash）
- `status`：enum（`active` / `revoked` / `blocked`）
- `expires_at`：datetime（可選）
- `rate_limit_per_minute`：int（可選）
- `rate_limit_per_hour`：int（可選）
- `created_at`：datetime
- `revoked_at`：datetime（可選）
- `last_used_at`：datetime（可選）
- `replaced_by_key_id`：FK → ApiKey.id（可選，用於輪替追蹤）

### 6.7 ApiKeyScope（Key ↔ Scope 關聯）
- `api_key_id`：FK → ApiKey.id
- `scope_id`：FK → ApiScope.id

### 6.8 ApiUsageLog
- `id`：string (uuid)
- `api_key_id`：FK → ApiKey.id
- `endpoint_id`：FK → ApiEndpoint.id（可選；若解析不到可為空）
- `http_method`：string
- `path`：string
- `status_code`：int
- `response_time_ms`：int
- `timestamp`：datetime

### 6.9 BlockedIp（選擇性）
- `id`：string (uuid)
- `ip_or_cidr`：string
- `reason`：string
- `status`：enum（`active` / `inactive`）
- `created_at`：datetime

### 6.10 AuditLog
- `id`：string (uuid)
- `actor_user_id`：FK → User.id（可選；系統行為可為空）
- `actor_role`：enum（`developer` / `admin` / `system`）
- `action`：string（例如 `api_key.create`、`api_key.revoke`、`scope.update`）
- `target_type`：string（例如 `ApiKey`、`ApiService`）
- `target_id`：string（uuid，可選）
- `metadata_json`：text（可選）
- `created_at`：datetime

### 6.11 UserSession（Web Session，支援登出立即失效）
- `id`：string (uuid)
- `user_id`：FK → User.id
- `created_at`：datetime
- `expires_at`：datetime
- `revoked_at`：datetime（可選）
- `last_seen_at`：datetime（可選）

### 6.12 關聯（Relationships）
- User 1:N ApiKey
- ApiService 1:N ApiEndpoint
- ApiScope 1:N ApiScopeRule
- ApiEndpoint 1:N ApiScopeRule
- ApiKey M:N ApiScope（透過 ApiKeyScope）
- ApiKey 1:N ApiUsageLog
- User 1:N AuditLog（actor_user_id）
- User 1:N UserSession
