# 人工驗收確認表（Manual QA Checklist）
API 平台與金鑰管理系統

## 1. 環境與前置條件
- [ ] 準備 3 組帳號：Guest（未登入狀態）、Developer（status=active）、Admin（status=active）
- [ ] 另外準備 1 組 disabled 使用者帳號（role=developer,status=disabled）
- [ ] 準備至少 1 個啟用中的 ApiService（status=active）與至少 1 個 ApiEndpoint（status=active）
- [ ] 準備至少 1 個 ApiScope 與對應的 ApiScopeRule（allow）指向某個 ApiEndpoint
- [ ] 確認所有環境皆使用 HTTPS（或本機以等效方式模擬 HTTPS only）
- [ ] 測試瀏覽器至少包含 Chrome（桌面）與手機尺寸（RWD）
- [ ] 確認測試期間系統時間/時區一致（影響 expires_at 與 Usage Log timestamp）

## 2. 角色與權限邊界（RBAC + Route Guard + Navigation Visibility）

### 2.1 Guest
- [ ] Header 僅顯示 /,/register,/login；不得顯示 /keys,/docs,/admin
- [ ] 直接輸入 /keys 會導向 /login（可帶 next）
- [ ] 直接輸入 /docs 會導向 /login（可帶 next）
- [ ] 直接輸入 /admin 會導向 /login（可帶 next）

### 2.2 Developer
- [ ] Header 顯示 /,/keys,/docs 與登出；不得顯示 /admin
- [ ] 直接輸入 /admin 顯示 403（不得顯示 404 取代）
- [ ] /keys 僅能看到自己名下的 ApiKey 清單
- [ ] /keys 無法存取或操作他人 ApiKey（包含透過 URL 或資料列 ID 嘗試）
- [ ] /keys 僅能查詢自己名下 ApiKey 的 Usage Log

### 2.3 Admin
- [ ] Header 顯示 /,/keys,/docs,/admin 與登出
- [ ] /admin 可存取並可看到 Service/Endpoint/Scope/Rate Limit/Usage/Audit 等管理入口
- [ ] /keys 可查詢任意使用者的 ApiKey（依系統 UI 設計）
- [ ] /keys 可撤銷/封鎖任意 ApiKey

## 3. 端到端主流程（逐條覆蓋 User Flow）

### 3.1 Guest：註冊與登入
- [ ] 進入 / 可看到平台介紹與安全說明
- [ ] 從 / 進入 /register 可看到註冊表單
- [ ] 在 /register 以新 Email + 密碼註冊成功後會導向 /login（不得自動登入）
- [ ] 在 /login 使用剛註冊帳號登入成功後導向 /keys

### 3.2 Developer：API Key 申請流程
- [ ] Developer 登入後可進入 /keys
- [ ] 在 /keys 點擊建立 Key 可看到建立表單（name/scopes/expires_at/rate_limit）
- [ ] 可選擇 API Service 與 Scope（可多選）且只能選到已存在的 scope
- [ ] expires_at 不設定時代表永不過期（或依平台規則顯示對應狀態）
- [ ] rate_limit_per_minute 與 rate_limit_per_hour 可設定且不得超過平台上限
- [ ] 建立成功後 UI 只顯示一次 API Key 原文，並要求使用者自行複製保存
- [ ] 關閉/刷新頁面後，系統任何 UI/API/Log 不可再次取得 API Key 原文
- [ ] 使用新 API Key 呼叫受保護 API，Authorization: Bearer {API_KEY} 可被 Gateway 正常處理

### 3.3 Developer：Key 輪替（Rotation）
- [ ] 在 /keys 建立一把新 Key（與舊 Key 並存）
- [ ] 使用新 Key 呼叫受保護 API 成功（或失敗時可在 Usage Log 觀察到對應狀態碼）
- [ ] 撤銷舊 Key 後，使用舊 Key 呼叫受保護 API 會被拒絕並回 401
- [ ] 撤銷舊 Key 不會刪除舊 Key 的 Usage Log（仍可查到歷史）

### 3.4 Developer：查看使用紀錄與排查
- [ ] 在 /keys 選擇某把 Key 可查看該 Key 的 Usage Log
- [ ] Usage Log 至少顯示：method/path/status_code/response_time_ms/timestamp
- [ ] Usage Log 查詢至少支援：時間範圍、Status Code、Endpoint（或 method+path）
- [ ] 看到 401/403/429 時，能對應回推原因（Key 狀態/Scope/Rate Limit/期限）並可調整設定後重試

### 3.5 Admin：平台管理與監控
- [ ] Admin 登入後進入 /admin
- [ ] 在 /admin 新增 ApiService 成功（name 唯一）
- [ ] 在某個 ApiService 下新增 ApiEndpoint（method/path/status）成功且 (method,path) 不重複
- [ ] 新增或更新 ApiScope 成功（name 唯一且可讀，如 user:read）
- [ ] 建立/更新 ApiScopeRule（allow）後，Gateway 授權結果會立即反映
- [ ] 調整平台 Rate Limit 預設/上限成功，Developer 設定超過上限會被拒絕
- [ ] 封鎖/撤銷某把 Key 後立即失效，後續 API 呼叫回 401
- [ ] 停用使用者後：不可登入、既有 session 立即無效、其名下所有 active Key 立即不可用
- [ ] 在 /admin 可查到全站 401/403/429/5xx 的用量或錯誤統計（來源為 Usage Log）
- [ ] 在 /admin 可透過 Audit Log 查到敏感操作的 who/when/what

## 4. 功能需求（Functional Requirements）驗收

### 4.1 帳號與認證（Authentication）
- [ ] /register：Email 必須唯一（不同大小寫視為同一 Email）
- [ ] /register：密碼不以明文儲存（不可在任何管理介面或日誌看到明文）
- [ ] /register：註冊成功後 role=developer 且 status=active
- [ ] /login：帳密正確可登入並建立 Web Session
- [ ] /login：帳密錯誤登入失敗並顯示可理解錯誤訊息
- [ ] /login：disabled 使用者登入失敗且不得建立 session
- [ ] 登出後 session 立即失效，回到受保護頁會導向 /login

### 4.2 授權與權限（Authorization / RBAC）
- [ ] 未登入進入 /keys 會導向 /login（可帶 next）
- [ ] 未登入進入 /docs 會導向 /login（可帶 next）
- [ ] 未登入進入 /admin 會導向 /login（可帶 next）
- [ ] Developer 進入 /admin 顯示 403（不得顯示 404 取代）
- [ ] 導覽可見性規則與路由存取一致（Guest/Developer 不出現不該出現的連結）

### 4.3 API Service / Endpoint 目錄管理（Admin）
- [ ] Admin 可新增 ApiService（name 唯一）
- [ ] Admin 可編輯 ApiService（description/status）
- [ ] Admin 停用 ApiService 後，/docs 不再顯示該服務
- [ ] Admin 可在 Service 下新增 ApiEndpoint（method/path/status）
- [ ] 同一 Service 下 ApiEndpoint 的 (method,path) 不可重複
- [ ] 停用 ApiEndpoint 後，/docs 不再顯示該 endpoint

### 4.4 API Key 管理（Developer / Admin）
- [ ] 建立 Key 後 UI 只顯示一次 API Key 原文
- [ ] 後續任何 UI/API/Log/匯出皆不可取得 API Key 原文
- [ ] Developer 只能建立/更新/撤銷自己名下 Key
- [ ] Admin 可撤銷任意 Key
- [ ] Admin 可封鎖任意 Key
- [ ] revoked/blocked/expired 的 Key 呼叫受保護 API 必回 401
- [ ] 只有 status=active 的 Key 可以更新設定（name/scopes/expires_at/rate_limit）

### 4.5 Scope / Permission 管理（Admin）
- [ ] Admin 可新增/編輯 ApiScope（name 唯一且符合命名規則）
- [ ] Admin 可設定 ApiScopeRule（scope ↔ endpoint allow）
- [ ] 若 Key scopes 不允許目標 endpoint，Gateway 回 403（並可在 Usage Log 查到 403）

### 4.6 Rate Limit
- [ ] Key 層級至少支援每分鐘與每小時限流
- [ ] 超過限制回 429 Too Many Requests
- [ ] 429 會被寫入 Usage Log，且可在 /keys 或 /admin 查到
- [ ] 平台有全域預設與上限；Developer 設定超過上限會被拒絕且不寫入變更

### 4.7 Gateway 受保護 API 請求流程
- [ ] 缺少 Authorization header 回 401
- [ ] Authorization 格式非 Bearer 回 401
- [ ] API Key 不存在或 hash 不符回 401
- [ ] Key status=revoked/blocked 回 401
- [ ] Key 過期（expires_at）回 401
- [ ] Key 擁有者 User.status=disabled 回 401
- [ ] Endpoint 找不到回 404
- [ ] Endpoint 停用回 401
- [ ] Scope 不足回 403
- [ ] Rate limit 超限回 429
- [ ] 轉發到後端服務成功時回應 2xx/4xx/5xx 會被正確透傳或映射（依平台規格）

### 4.8 Usage Log
- [ ] 每次 API 呼叫都會寫入 Usage Log（包含 401/403/429/5xx）
- [ ] Usage Log 至少包含 api_key_id、http_method、path、status_code、response_time_ms、timestamp
- [ ] Log 寫入為非同步，不應明顯增加 API 回應延遲
- [ ] Developer 只能查自己 key 的 log
- [ ] Admin 可查全站 log 與錯誤統計

### 4.9 Key Rotation
- [ ] Developer 可以同時擁有多把 Key，輪替期間新舊 key 可並行使用
- [ ] 撤銷舊 key 後立即失效且回 401
- [ ] 舊 key 的歷史 log 與狀態會被保留可查

### 4.10 停用 / 封鎖能力（Admin）
- [ ] 封鎖 Key（blocked）後立即失效且回 401
- [ ] 撤銷 Key（revoked）後立即失效且回 401
- [ ] 停用使用者後，其名下所有 active key 立即不可用
- [ ] 停用使用者後，其既有 session 立即視為無效
- [ ]（若已實作）被黑名單 IP 的受保護 API 請求會被直接拒絕

### 4.11 Audit Log
- [ ] Developer：建立 key 會寫入 Audit Log
- [ ] Developer：更新 key（name/scopes/期限/Rate Limit）會寫入 Audit Log
- [ ] Developer：撤銷 key 會寫入 Audit Log
- [ ] Admin：Service/Endpoint/Scope/Rate Limit 調整會寫入 Audit Log
- [ ] Admin：封鎖/撤銷 key、停用使用者、（若有）IP 黑名單變更會寫入 Audit Log
- [ ] Audit Log 至少包含 who/when/what（actor、時間、action、target）
- [ ] Audit Log 不包含 API Key 原文

### 4.12 主要頁面需求（Page Requirements）
- [ ] /：Guest/Developer/Admin 均可存取
- [ ] /register：Guest 可存取；已登入 Developer 會被導向 /keys；已登入 Admin 會被導向 /admin
- [ ] /login：Guest 可存取；已登入 Developer 會被導向 /keys；已登入 Admin 會被導向 /admin
- [ ] /keys：Guest 導向 /login；Developer/Admin 可存取
- [ ] /docs：Guest 導向 /login；Developer/Admin 可存取
- [ ] /admin：Guest 導向 /login；Developer 顯示 403；Admin 可存取
- [ ] 各頁面具備 Loading 狀態且防止重複送出
- [ ] /keys 在無 key 時顯示 Empty 狀態並提供建立入口
- [ ] 各頁面在 API 失敗時顯示可理解 Error 並提供 Retry
- [ ] /403 顯示 Forbidden；/404 顯示 Not Found；/500 顯示平台錯誤與 Retry

## 5. 非功能需求（Non-functional Requirements）

### 5.1 安全性
- [ ] 系統不在任何頁面/日誌/錯誤堆疊中輸出 API Key 原文
- [ ] HTTPS only（或測試環境有等效保護）
- [ ] Scope 授權遵循最小權限原則（不授權的 endpoint 必回 403）
- [ ] disabled 使用者的 session 與 key 立即失效

### 5.2 效能與可用性
- [ ] Gateway 的驗證流程不應成為瓶頸（連續請求時延遲不應明顯惡化）
- [ ] Usage Log 寫入為非同步，觀察到的 API 回應時間不應因 log 寫入而顯著變慢

### 5.3 錯誤處理與一致性
- [ ] 401/403/429/5xx 的 UI 呈現與導向符合規範（401 導向 /login；403 顯示無權限；429 顯示節流提示；5xx 顯示錯誤頁）
- [ ] 撤銷/封鎖 key 後，下一次請求立即被拒絕（不可延遲生效）
- [ ] 停用使用者後，下一次請求立即被拒絕（不可延遲生效）

## 6. 全站狀態品質（Loading / Empty / Error / Retry）
- [ ] /login 提交中按鈕 disabled 且不會重複送出
- [ ] /register 提交中按鈕 disabled 且不會重複送出
- [ ] /keys 建立 key 時提交中按鈕 disabled 且不會重複送出
- [ ] /docs 無啟用服務時顯示 Empty 狀態
- [ ] /admin 載入失敗時顯示 Error 並可 Retry
- [ ] /500 Retry 成功後可回到正常頁且錯誤提示清除

## 7. RWD / 可用性
- [ ] 手機尺寸下 Header/導覽仍符合角色可見性規則（不會露出 /admin 給 Developer 或 /keys 給 Guest）
- [ ] 表單欄位錯誤訊息可理解且指向具體欄位
- [ ] 危險操作（撤銷/封鎖）有明確確認流程且可取消
