# 人工驗收確認表（Manual QA Checklist）
多角色論壇／社群平台（Multi-Role Forum & Community Platform）

## 環境與前置條件
- [ ] 已準備測試帳號：Guest（未登入）、User、Moderator（含至少一個被指派看板）、Admin。
- [ ] 已準備至少 2 個看板：1 個啟用（is_active=true）、1 個停用（is_active=false）。
- [ ] 已準備測試資料：draft/published/hidden/locked 主題各至少 1 筆；visible/hidden 回覆各至少 1 筆。
- [ ] 已準備檢舉資料：pending/accepted/rejected 各至少 1 筆，且含 thread 與 post 兩種 target_type。
- [ ] 已準備跨帳號資料：User A 與 User B 各自擁有主題與回覆，用於驗證資料隔離。
- [ ] 已確認測試環境使用一致時區與語系，避免 created_at 顯示偏差造成誤判。
- [ ] 已確認測試瀏覽器至少涵蓋桌面與行動版，並可重現基本路由與表單流程。
- [ ] 已確認可查看 API 狀態碼（401/403/404/5xx）與 UI 錯誤訊息，便於對照驗收結果。

## 角色與權限邊界

### Guest（未登入）
- [ ] 可進入 `/`、`/search`、`/boards/:id`、`/threads/:id` 並瀏覽公開且可見內容。
- [ ] 嘗試執行 `Like/Favorite/Reply/Report/New Thread` 時會導向 `/login`，且保留 returnTo。
- [ ] 不可進入 `/threads/new`，會被導向登入（401 流程）。
- [ ] 不可進入 `/admin`，會被導向登入（401 流程）。
- [ ] 看不到 hidden 內容，也不能透過搜尋結果間接看到 hidden 內容。

### User（已登入一般使用者）
- [ ] 可建立主題（草稿/發布）、回覆、Like/Favorite、檢舉可見內容。
- [ ] 僅可編輯/刪除自己的內容（且須符合狀態規則）。
- [ ] 不能使用治理操作（hide/restore、lock/unlock、pinned/featured）。
- [ ] 不可進入 `/admin`，顯示 403 權限不足。
- [ ] 在 locked 主題上不可新增回覆，且不可編輯該 locked 主題。

### Moderator（看板範圍）
- [ ] 僅在被指派看板可見治理面板與治理操作入口。
- [ ] 可在指派看板對 Thread/Post 執行 hide/restore、lock/unlock、pinned/featured。
- [ ] 可處理指派看板內的檢舉（accepted/rejected）並寫入處理者與時間。
- [ ] 不可治理未指派看板，應顯示 403 或無操作入口。
- [ ] 不可進入 `/admin`，顯示 403 權限不足。

### Admin（全站管理）
- [ ] 可進入 `/admin` 並使用看板管理、Moderator 指派、使用者停權/解鎖、檢舉與稽核檢視。
- [ ] 可在任何看板執行治理操作，包含 hidden/locked/pinned/featured 狀態調整。
- [ ] 可查看全站檢舉與 Audit Log，且關鍵欄位（actor/action/target/created_at）可讀。
- [ ] Admin 的敏感操作後，Audit Log 立即出現對應事件。

## 端到端主流程（對應 User Flow）

### 訪客流程
- [ ] 進入首頁 `/` 可看到看板列表，且排序符合 `sort_order`。
- [ ] 點擊看板 `/boards/:id` 可看到主題列表（含分頁行為）。
- [ ] 點擊主題 `/threads/:id` 可看到主題與回覆（回覆為 lazy load）。
- [ ] 在 `/search` 搜尋公開內容可得到結果，點擊可回到主題頁。
- [ ] 訪客觸發互動行為時導向 `/login`，登入成功後返回原頁（returnTo）。

### 一般使用者主流程（發表主題）
- [ ] 登入後進入 `/boards/:id`，可看到「新增主題」入口（啟用看板）。
- [ ] 進入 `/threads/new` 時正確帶入 `board_id`。
- [ ] 填寫 `title`、`content` 後可先存草稿（status=draft）。
- [ ] 將草稿發布後變為 published，且出現在對應看板主題列表。
- [ ] 發布完成後主題頁可被公開瀏覽（若未被治理隱藏）。

### 一般使用者次要流程（回覆與互動）
- [ ] 在非 locked 主題可成功新增回覆。
- [ ] 在 locked 主題送出回覆會被拒絕並顯示不可回覆提示。
- [ ] Like/Unlike（Thread/Post）可正確切換，並同步反映於 UI。
- [ ] Favorite/Unfavorite（Thread）可正確切換，並同步反映於 UI。

### 一般使用者次要流程（檢舉）
- [ ] 可對可見主題或回覆送出檢舉，建立 `pending` 狀態。
- [ ] 同一使用者對同一 target 重複檢舉會被拒絕（唯一約束生效）。
- [ ] 檢舉後可在治理端被 Moderator/Admin 處理並更新狀態。

### Moderator 流程（看板內治理）
- [ ] 進入被指派看板後可切換到治理面板（不新增路由）。
- [ ] 可查看 pending 優先的檢舉列表。
- [ ] 接受檢舉後，對應內容變 hidden 且 report 變 accepted。
- [ ] 駁回檢舉後，內容狀態維持不變且 report 變 rejected。
- [ ] 每次處置均寫入 `resolved_by`、`resolved_at` 與 Audit Log。

### Admin 流程
- [ ] 進入 `/admin` 後可管理看板（建立/編輯/停用/排序）。
- [ ] 可指派或移除 Moderator（board scope）。
- [ ] 可停權/解鎖使用者，且停權帳號不可登入。
- [ ] 可檢視全站 Report/Audit Log 並追溯重大操作。

## 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] `/` 在載入中顯示 Loading；無看板時顯示 Empty；失敗時顯示 Error 並可 Retry。
- [ ] `/search` 在無結果時顯示 Empty；API 失敗時顯示 Error。
- [ ] `/boards/:id` 無主題時顯示 Empty；載入失敗可 Retry。
- [ ] `/threads/:id` 可區分 Loading、404 Not Found、403 Forbidden 與一般 Error。
- [ ] `/threads/new` 載入看板資訊時可顯示 Loading；失敗時顯示 Error。
- [ ] `/admin` 可區分 Loading/Empty/Error，且錯誤可重試。

## 錯誤碼與導向
- [ ] 未登入執行受保護操作一律觸發 401 流程並導向 `/login`（含 returnTo）。
- [ ] 權限不足（例如 User 進 `/admin`、Moderator 管理非指派看板）顯示 403。
- [ ] 不存在的看板或主題顯示 404 Not Found。
- [ ] 伺服器錯誤顯示 5xx 通用錯誤並提供重試。
- [ ] 停權使用者登入時顯示明確錯誤訊息且不建立 session。

## RWD 與可用性
- [ ] 桌面與行動版均可完成核心流程（瀏覽、發文、回覆、檢舉、治理）。
- [ ] Header 導覽在各角色視角符合規範，不出現不該顯示的入口。
- [ ] CTA 去重規則正確：登入/註冊不重複顯示；新增主題僅在看板頁。
- [ ] 在窄螢幕下表單與列表仍可操作，不出現關鍵按鈕不可點擊或被遮擋。

## 功能需求驗收（Functional Requirements）

### 4.1 認證與帳號（Authentication）
- [ ] 註冊可建立新帳號，`email` 會先 trim 並轉小寫後再檢查唯一性。
- [ ] 密碼不足 8 碼時註冊被拒絕並顯示明確錯誤。
- [ ] 註冊成功後預設直接登入並導回 returnTo 或首頁。
- [ ] 登入成功會建立 session；登出會清除 session。
- [ ] 帳密錯誤時登入失敗並留在 `/login`。
- [ ] `is_banned=true` 帳號登入被拒絕且訊息明確。
- [ ] session 過期後再次操作受保護功能會要求重新登入。
- [ ] 同一帳號在不同頁面重整後，登入狀態與導覽顯示保持一致。

### 4.2 看板（Board）
- [ ] `is_active=true` 看板允許新增主題/回覆與互動行為。
- [ ] `is_active=false` 看板禁止 New Thread/Reply/Like/Favorite/Report，並顯示原因。
- [ ] 停用看板的既有內容仍可瀏覽（唯讀）。
- [ ] 停用看板上 Moderator/Admin 仍可執行治理操作。
- [ ] 看板頁明確標示目前看板為停用狀態。
- [ ] 看板停用後，列表與主題頁的可操作按鈕狀態同步更新。

### 4.3 主題（Thread）
- [ ] 作者可將草稿由 `draft -> published`。
- [ ] Moderator/Admin 可將主題 `published -> hidden` 與 `hidden -> published`。
- [ ] Moderator/Admin 可將主題 `published -> locked` 與 `locked -> published`。
- [ ] 非法轉換（如 hidden 直接 locked、published/locked 回 draft）會被 API 拒絕。
- [ ] `draft` 僅作者可見；`hidden` 僅 board scope Moderator 與 Admin 可見。
- [ ] 一般使用者不可編輯 locked 主題。
- [ ] 作者可刪除 draft；不可刪除 published/locked（依既定政策）。
- [ ] 主題狀態變更後，`/boards/:id` 列表與 `/threads/:id` 詳情顯示一致。

### 4.4 回覆（Post）
- [ ] 使用者可新增回覆到可回覆主題。
- [ ] 使用者僅可編輯自己的回覆。
- [ ] 回覆被 hidden 後，Guest/User 看不到；Moderator/Admin 仍可見。
- [ ] 主題 locked 時新增回覆會被拒絕。
- [ ] 回覆狀態改變後，主題頁回覆列表與可見性立即一致。

### 4.5 互動（Like / Favorite）
- [ ] Like 支援 Thread/Post，且同一使用者對同一 target 僅一筆。
- [ ] Favorite 僅支援 Thread，且同一使用者對同一 Thread 僅一筆。
- [ ] 連續重複點擊不會造成重複資料（前端防重 + 後端唯一約束）。
- [ ] optimistic 更新失敗時，UI 會回滾到後端最終狀態。
- [ ] 看板停用時 Like/Favorite 全部不可操作。
- [ ] 互動計數在列表與詳情頁呈現一致。

### 4.6 檢舉系統（Report）
- [ ] User 可對可見 Thread/Post 建立檢舉（pending）。
- [ ] 同一使用者不可對同一 target 重複檢舉。
- [ ] Moderator 只能處理其 board scope 的檢舉；超出範圍會被拒絕。
- [ ] Admin 可處理全站檢舉。
- [ ] accepted/rejected 處理後，`resolved_by` 與 `resolved_at` 必填且正確。
- [ ] 看板停用時不可新增新檢舉。
- [ ] 檢舉處理結果與內容可見性（hidden/維持原狀）保持一致。

### 4.7 主要頁面需求（Page Requirements）
- [ ] `/` 顯示看板列表，排序符合 `sort_order`，停用看板有清楚標示。
- [ ] `/search` 只搜尋公開可見內容，不帶出 hidden。
- [ ] `/boards/:id` 主題列表分頁每頁 20，且置頂排序優先規則正確。
- [ ] `/threads/:id` 回覆 lazy load 正常，治理按鈕僅對對應角色顯示。
- [ ] `/threads/new` 驗證 `board_id` 存在且 `is_active=true`。
- [ ] `/login` 成功回跳 returnTo，錯誤訊息區分帳密錯誤/停權/過期。
- [ ] `/register` 表單規則正確，成功後自動登入。
- [ ] `/admin` 僅 Admin 可進入且功能區塊完整可用。
- [ ] Header 導覽顯示規則符合 Guest/User/Moderator/Admin 定義。

## 非功能需求驗收（Non-functional Requirements）

### 效能
- [ ] 主題列表維持每頁 20 筆分頁，翻頁不破壞排序規則。
- [ ] 回覆 lazy load 能逐步載入且避免一次載入全部造成卡頓。
- [ ] 搜尋在既有資料量下可於合理時間回應，且分頁可正常操作。

### 安全性
- [ ] 密碼不以明文儲存，資料庫僅保存 `password_hash`。
- [ ] 每個受保護 API 均做 RBAC 與 board scope 驗證。
- [ ] 輸入/輸出可阻擋腳本注入，避免 XSS 顯示風險。
- [ ] cookie session 流程具備 CSRF 防護（token 或等效機制）。
- [ ] 以 id 直接存取他人資源時會被可見性/範圍檢查攔截（防 IDOR）。
- [ ] 治理與敏感操作皆可在 Audit Log 追溯。

### 狀態處理與可靠性
- [ ] Loading/Empty/Error 呈現在主要頁面一致且可理解。
- [ ] 網路失敗可重試，且重試後能正確回到 Ready/Empty。
- [ ] 互動與治理操作後，列表頁與詳情頁狀態同步，不出現前後矛盾。
- [ ] 頁面重整後會以後端資料恢復正確狀態。

## 資料模型與一致性驗收

### Entity 基礎存在與約束
- [ ] `User.email` 唯一約束生效。
- [ ] `ModeratorAssignment(board_id, user_id)` 唯一約束生效。
- [ ] `Like(user_id, target_type, target_id)` 唯一約束生效。
- [ ] `Favorite(user_id, thread_id)` 唯一約束生效。
- [ ] `Report(reporter_id, target_type, target_id)` 唯一約束生效。

### 關聯一致性
- [ ] `Thread.board_id`、`Thread.user_id`、`Post.thread_id`、`Post.user_id` 等 FK 關聯正確。
- [ ] 針對 `Like/Report` 的 `target_type + target_id`，應用層會驗證目標存在性與可見性。
- [ ] 任何狀態變更後，相關列表、詳情與搜尋結果不出現不一致。

### Audit Log 一致性
- [ ] 登入/登出、停權/解鎖有對應 Audit Log 事件。
- [ ] 看板建立/編輯/停用/排序、Moderator 指派/移除有對應 Audit Log 事件。
- [ ] Thread/Post 的 hide/restore、lock/unlock、pinned/featured 有對應 Audit Log 事件。
- [ ] Report 的 accepted/rejected（含備註）有對應 Audit Log 事件。

## 跨帳號與資料隔離（必測）
- [ ] User A 不能編輯或刪除 User B 的 Thread/Post。
- [ ] User A 不能看到 User B 的 hidden 內容。
- [ ] 非指派看板的 Moderator 不能處理該看板的檢舉。
- [ ] 以 API 直接請求他人敏感資源時，回應符合 403/404 規則且不洩漏資訊。

## 覆蓋確認（收尾）
- [ ] 已逐步完成 Guest/User/Moderator/Admin 四角色主要流程驗收。
- [ ] 已覆蓋所有主要路由：`/`、`/search`、`/boards/:id`、`/threads/:id`、`/threads/new`、`/login`、`/register`、`/admin`。
- [ ] 已覆蓋 401/403/404/5xx、Loading/Empty/Error/Retry。
- [ ] 已覆蓋 Thread/Post/Report 狀態規則與合法/非法轉換。
- [ ] 已覆蓋資料一致性與 Audit Log 可追溯性。