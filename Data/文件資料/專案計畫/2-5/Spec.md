# 任務 Spec：多角色論壇／社群平台（Multi-Role Forum & Community Platform）
可治理、可擴充的多看板論壇／社群系統（RBAC + Board Scope）

---

## 1. 產品目標（Product Goal）
建立一個支援多角色、可治理、可成長的論壇／社群平台，核心目標：
- 內容發表與討論：使用者可在看板中建立主題、回覆、互動。
- 社群治理：透過角色與權限（RBAC + 看板範圍），確保討論品質與秩序。
- 內容可控性：檢舉、隱藏、鎖文、精華等管理機制，並保留操作可追溯性。
- 可擴充結構：支援多看板（Board）與主題（Thread）結構，未來可擴充更多互動與治理能力。

系統必備能力（必做）：
- 使用者認證與身分識別（Email + 密碼）。
- 多角色權限控管（RBAC；Moderator 由看板指派而非全域角色欄位）。
- 看板（Board）與主題（Thread）結構。
- 發文／回文／編輯／刪除。
- 內容狀態機（Thread: draft/published/hidden/locked；Post: visible/hidden）。
- 檢舉與審核流程（Report: pending/accepted/rejected）。
- 基本社群互動（Like、Favorite）。
- 前後端資料一致性與操作可追溯性（Audit Log）。

---

## 2. 使用者角色定義（Roles）

### 2.1 訪客（Guest）
- 權限：僅能瀏覽「公開且可見」內容。
- 可執行行為：
  - 瀏覽看板列表。
  - 瀏覽看板內主題列表。
  - 瀏覽主題與回覆（僅可見內容）。
  - 搜尋公開內容。
  - 前往登入 / 註冊頁。
- 限制：
  - 不可發文、回文、互動（Like/Favorite）。
  - 不可檢舉內容。
  - 不可查看 hidden 內容。

### 2.2 一般使用者（User）
- 權限：基本社群互動權限。
- 可執行行為：
  - 建立主題（Thread）：可先存草稿、再發布。
  - 回覆主題（Post）。
  - 編輯 / 刪除「自己的」內容（Thread/Post；受狀態與規則限制）。
  - Like/Unlike（Thread/Post）。
  - Favorite/Unfavorite（Thread）。
  - 檢舉他人內容（Report）。
  - 查看自己的發文紀錄（我的主題／我的回覆）。
- 限制：
  - 不可管理他人內容（無隱藏/鎖定/精華/置頂）。
  - 不可存取管理後台（/admin）。
  - 不可對 locked 的主題新增回覆。
  - locked 的主題：一般使用者不可編輯該主題內容（也不可透過 API 繞過）。

### 2.3 看板管理員（Moderator）
- 角色綁定：單一或多個看板（Board scope），由 Admin 指派。
- 權限：管理被指派看板內的內容與檢舉。
- 可執行行為（僅限指派看板範圍內）：
  - 隱藏 / 恢復主題與回覆（Thread/Post）。
  - 鎖定 / 解鎖主題（Thread）。
  - 精華（featured）/ 取消精華。
  - 置頂（pinned）/ 取消置頂（僅影響看板內排序）。
  - 處理檢舉（accepted/rejected），記錄處理者與時間。
- 限制：
  - 僅能管理被指派的看板。
  - 不可變更系統設定。
  - 不可管理使用者帳號（ban/unban）。

### 2.4 系統管理員（Admin）
- 權限：全站最高權限。
- 可執行行為：
  - 建立 / 編輯 / 停用看板（Board），含排序。
  - 指派 / 移除 Moderator（針對指定看板）。
  - 停權 / 解鎖使用者（ban/unban）。
  - 查看全站檢舉與操作紀錄（Report/Audit Log）。
  - 系統設定管理（以可擴充方式保留設定表/欄位）。
- 限制：
  - 無內容限制（仍需符合稽核要求；所有敏感操作必寫入 Audit Log）。

---

## 3. 使用者流程（User Flow）

### 3.1 訪客流程
1. 進入首頁（/），看到看板列表。
2. 點擊看板（/boards/:id）→ 瀏覽主題列表（分頁）。
3. 點擊主題（/threads/:id）→ 瀏覽主題內容與回覆（回覆 lazy load）。
4. 使用搜尋（/search）查找公開內容。
5. 嘗試互動（Like/Favorite/Reply/Report/New Thread）時：導向登入頁（/login），登入後返回原頁（returnTo）。

### 3.2 一般使用者流程
主要流程：發表主題
1. 登入後進入看板（/boards/:id）。
2. 點擊「新增主題」→ /threads/new（帶入 board_id）。
3. 填寫標題與內容。
4. 可選：先存為草稿（draft），稍後再發布。
5. 發布成功（published），主題顯示於看板列表（/boards/:id）。

次要流程：回覆與互動
1. 進入主題頁（/threads/:id）。
2. 輸入回覆內容並送出（若主題 locked，顯示不可回覆提示）。
3. Like/Unlike（Thread/Post）。
4. Favorite/Unfavorite（Thread）。

次要流程：檢舉內容
1. 在主題或回覆上點擊檢舉按鈕。
2. 選擇檢舉原因並送出。
3. 系統記錄檢舉，狀態為 pending，等待 Moderator/Admin 處理。
4. 同一使用者對同一內容不可重複檢舉。

### 3.3 Moderator 流程（看板內）
1. 進入被指派管理的看板（/boards/:id）。
2. 切換到「檢舉/治理」區塊（同頁內治理面板，不新增路由）。
3. 查看該看板的檢舉列表（pending 優先）。
4. 檢視被檢舉內容（可看見 hidden 內容）。
5. 選擇處置：
   - 接受檢舉：隱藏對應 Thread 或 Post，並將 Report 標記 accepted。
   - 駁回檢舉：維持內容狀態不變，將 Report 標記 rejected。
6. 系統記錄處理結果（處理者、時間、備註可選），並寫入 Audit Log。

### 3.4 Admin 流程
1. 進入後台（/admin）。
2. 管理看板結構（建立/編輯/停用、排序）。
3. 指派/移除 Moderator（對應看板）。
4. 處理重大檢舉或帳號問題（停權、解鎖、查看審計）。

---

## 4. 功能需求（Functional Requirements）

### 4.1 認證與帳號（Authentication）
- Email + 密碼登入。
- Email 必須唯一（儲存前需正規化：trim、轉小寫）。
- 密碼至少 8 碼。
- 密碼儲存：bcrypt hash。
- Session 驗證：
  - 前端以 HttpOnly cookie session（或等效方式）維持登入狀態。
  - Session 過期需重新登入。
  - 登入成功後需支援 returnTo 回跳原頁。
- 登出：清除 session，回到來源頁或首頁。
- 停權帳號不可登入：
  - 登入時若 is_banned=true，拒絕並回傳明確錯誤訊息。
- 註冊：
  - 訪客可於 /register 建立帳號。
  - 成功後預設直接登入並導回 returnTo 或首頁。

### 4.2 看板（Board）
欄位：name、description、is_active、sort_order。

規則：
- 停用看板（is_active=false）不可新增內容（不可新增 Thread/Post）。
- 舊內容仍可瀏覽（唯讀）。
- 停用看板的互動（Like/Favorite/Report/Reply/New Thread）皆不可用並提示原因。
- Moderator/Admin 的治理操作（hide/restore、lock/unlock、pinned/featured）仍可執行（便於處理既有內容），但 UI 必須明確標示看板為停用狀態。

### 4.3 主題（Thread）
欄位：title、content、status（draft/published/hidden/locked）、is_pinned、is_featured。

可見性與規則：
- draft：作者可見；Moderator/Admin 可因治理目的查看（預設不在公開列表顯示）。
- published：所有人可見（但若看板停用，仍為唯讀）。
- hidden：僅 Moderator（其看板範圍）與 Admin 可見；Guest/User 不可見，也不可被搜尋結果帶出。
- locked：
  - 內容可見（若非 hidden）。
  - 不可新增回覆。
  - 一般使用者不可編輯該主題內容。

狀態機與合法轉換：
- draft → published：作者發布。
- published → hidden：Moderator（board scope）或 Admin。
- hidden → published：Moderator（board scope）或 Admin（恢復）。
- published → locked：Moderator（board scope）或 Admin。
- locked → published：Moderator（board scope）或 Admin（解鎖）。
- 禁止轉換：
  - hidden 狀態下不可直接 locked（需先恢復或以治理操作同時恢復再鎖定；具體以產品決策為準，但 API 必須拒絕未定義轉換）。
  - published/locked 不可回到 draft。

編輯與刪除規則：
- 作者可編輯自己的 Thread（draft 或 published；locked 不可編輯）。
- 作者可刪除自己的 Thread：
  - draft 可刪除。
  - published/locked 的刪除政策：預設允許刪除自己的 published，但若需保留討論串完整性可改為「僅能刪除 draft」；本產品預設採「僅能刪除 draft」以避免刪除造成討論斷裂（如需支援刪除 published，需在資料模型與 UI 增加 deleted 狀態與顯示規則）。

版本保存（選擇性）：
- 若啟用 Thread 版本保存，需可追溯每次修改（actor、時間、變更前後摘要）。

### 4.4 回覆（Post）
欄位：content、status（visible/hidden）。

規則：
- 只能編輯自己的回覆。
- 被隱藏後對 Guest/User 不可見；Moderator（board scope）與 Admin 可見。
- 若主題 locked：不可新增回覆。

### 4.5 互動（Like / Favorite）
- Like：使用者可對 Thread 或 Post 按讚/取消讚。
- 一人一讚：同一使用者對同一 target（thread/post）僅能存在 1 筆 Like（DB 唯一約束 + API 冪等）。
- Favorite：僅限 Thread（Favorite(thread_id)）。
- 取消操作需即時同步 UI：
  - 前端可 optimistic 更新，但必須以後端最終狀態為準。
  - 需避免重複點擊造成錯誤（UI 禁用/去抖 + 後端唯一約束）。
- 看板停用時：Like/Favorite 一律不可操作。

### 4.6 檢舉系統（Report）
欄位：target_type（thread/post）、reason、status（pending/accepted/rejected）、resolved_by、resolved_at。

規則：
- 同一使用者對同一內容不可重複檢舉（reporter_id + target_type + target_id 唯一）。
- 檢舉只允許針對「可見內容」發起（Guest 不可；User 對 hidden 不可見內容無入口）。
- 處理結果需記錄處理者與時間（resolved_by、resolved_at），並可選填備註。
- Moderator 僅能處理其看板範圍內內容的檢舉；Admin 可處理全站。
- 看板停用時：Report 不可操作（避免停用看板仍產生新治理事件）。

### 4.7 主要頁面需求（Page Requirements）

頁面清單與 URL（Page Inventory）：
- 首頁（看板列表）：/
- 搜尋頁（公開內容）：/search
- 看板頁（主題列表 + 治理面板（對 Mod/Admin 顯示））：/boards/:id
- 主題頁（內容 + 回覆 + 互動/檢舉）：/threads/:id
- 新增主題（含草稿/發布）：/threads/new
- 登入：/login
- 註冊：/register
- 後台：/admin

各頁面責任（Page Responsibilities）：
- /（看板列表）
  - 顯示啟用/停用看板（停用需明確標示不可互動）。
  - 依 sort_order 排序。
  - CTA：進入看板。
  - Page-level 狀態：Loading / Empty（無看板）/ Error（可重試）。
- /search（公開搜尋）
  - 搜尋範圍（Guest/User）：僅 published 且非 hidden 的 Thread 與其可見 Post（可選；若只搜尋 Thread 需明確）。
  - 支援關鍵字查詢、分頁（同列表規則）。
  - 搜尋結果點擊可導到 /threads/:id。
  - Page-level 狀態：Loading / Empty（無結果）/ Error。
- /boards/:id（看板頁）
  - 顯示看板資訊與主題列表（分頁 20/頁）。
  - 列表排序：pinned 置頂優先，其餘依時間或規則排序（需固定）。
  - CTA（User+）：新增主題（/threads/new?board_id=...）；看板停用時顯示 disabled 與原因。
  - Moderation Panel（僅 Mod/Admin 顯示）：檢舉列表、快速治理操作入口。
  - Page-level 狀態：Loading / Empty（無主題）/ Error。
- /threads/:id（主題頁）
  - 顯示 Thread 內容（含狀態標籤：draft/hidden/locked 等適當可見）。
  - 回覆列表 lazy load（載入更多 / 捲動載入）。
  - CTA：Reply（User+ 且 thread 非 locked 且 board active）、Like、Favorite、Report（User+；board active；且 content 可見）。
  - Moderator/Admin：可見治理按鈕（hide/restore、lock/unlock、pinned/featured）。
  - Page-level 狀態：Loading / 404 Not Found / 403 Forbidden（無權）/ Error。
- /threads/new（新增主題）
  - 僅 User/Moderator/Admin 可進入。
  - 表單：title（必填）、content。
  - CTA：存草稿、發布。
  - 規則：board_id 必須存在且 board 必須 is_active=true。
  - Page-level 狀態：Loading（若需載入 board 資訊）/ Error。
- /login（登入）
  - 表單：email/password。
  - 成功：回跳 returnTo 或首頁。
  - 錯誤：顯示明確訊息（帳密錯誤、已停權、session 過期需重登）。
- /register（註冊）
  - 表單：email/password（至少 8 碼）。
  - 成功：預設直接登入。
- /admin（後台）
  - 僅 Admin 可進入。
  - 功能區塊：看板管理（CRUD/排序/停用）、Moderator 指派、使用者停權/解鎖、全站 Report/Audit Log 檢視、系統設定（可擴充）。
  - Page-level 狀態：Loading / Empty（列表為空）/ Error。

路由存取控制（Route Access Control）：
- /threads/new：Guest ❌ / User ✅ / Mod ✅ / Admin ✅
- /admin：Guest ❌ / User ❌ / Mod ❌ / Admin ✅
- /、/search、/boards/:id、/threads/:id：Guest ✅ / User ✅ / Mod ✅ / Admin ✅（內容可見性仍受 hidden/board scope/ban 等規則影響）

導覽列/Header 規則（Navigation Visibility Rules）：
- Guest：顯示「首頁 / 搜尋 / 登入 / 註冊」，不顯示「新增主題 / 我的主題 / 我的回覆 / 後台」。
- User：顯示「首頁 / 搜尋 / 新增主題（需在看板頁或帶入 board_id）/ 我的主題 / 我的回覆 / 登出」，不顯示「後台」。
- Moderator：同 User，並在其被指派看板頁顯示「治理面板」區塊；不顯示「後台」。
- Admin：顯示「首頁 / 搜尋 / 後台 / 登出」，可在看板頁看到治理面板。
- 禁止以「顯示但點了才導登入」取代不該出現的導覽項（除非該項屬於互動 CTA 且規格明確要求可導登入；本產品以不顯示為預設）。

全站共用元件責任（Layout Responsibility / CTA 去重規則）：
- Header 負責：全站導覽入口（/、/search、/login、/register、/admin、logout）。
- Page 負責：與頁面主任務強相關的 CTA（例如看板頁的「新增主題」、主題頁的「回覆/檢舉/互動」）。
- 去重：
  - 若 Header 已顯示登入/註冊，頁面內不再重複顯示第二組登入/註冊 CTA。
  - 「新增主題」不放在全站 Header（避免缺 board_id），僅在 /boards/:id 顯示。

全站錯誤與權限處理（必備）：
- 401（未登入）：需要登入的行為（發文/回覆/互動/檢舉/後台）一律導向 /login（含 returnTo）。
- 403（權限不足）：顯示明確提示（例如：無權管理該看板、已停權、看板停用不可操作）。
- 404（資源不存在）：看板/主題不存在時顯示 Not Found。
- 5xx（伺服器錯誤）：顯示通用錯誤頁並可重試。

---

## 5. 非功能需求（Non-functional Requirements）

### 5.1 效能
- 主題列表分頁：每頁 20。
- 回覆 lazy load：初次載入部分回覆，支援載入更多。
- 搜尋需支援索引（資料庫索引或等效方式）。

### 5.2 安全性
- 密碼 Hash：bcrypt。
- RBAC 驗證：每個需要權限的 API 都必須在後端做角色與範圍檢查（含 Moderator board scope）。
- 防 XSS：展示層需防止腳本注入（內容渲染需轉義/白名單）。
- 防 CSRF：採 cookie session 時需具備 CSRF token（或等效機制）。
- 防 IDOR：對 thread/post/report 等資源存取需驗證可見性與範圍，避免只靠 id 存取。
- 行為紀錄（Audit Log）：對治理與敏感操作記錄可追溯。

### 5.3 狀態處理（UX States）
- Loading / Empty / Error 標準化。
- 權限不足需顯示明確提示。
- UI 與後端資料一致：
  - Like/Favorite 狀態切換避免重複點擊造成錯誤（去抖/鎖按鈕/後端唯一約束）。
  - Moderation 操作後，列表與內容頁狀態需即時反映。
- 可靠性：網路失敗需可重試；重整頁面後狀態需可復原（以後端資料為準）。

---

## 6. 資料模型（Data Model）

### 6.1 User
- id：PK
- email：Unique
- password_hash
- role：user / admin
- is_banned：Boolean
- created_at / updated_at

說明：Moderator 為「看板指派」而非 User.role。

### 6.2 Board
- id：PK
- name
- description
- is_active
- sort_order
- created_at / updated_at

### 6.3 ModeratorAssignment（看板管理員指派）
- id：PK
- board_id：FK
- user_id：FK
- created_at

約束：board_id + user_id 唯一。

### 6.4 Thread
- id：PK
- board_id：FK
- user_id：FK（作者）
- title
- content
- status：draft / published / hidden / locked
- is_pinned：Boolean
- is_featured：Boolean
- created_at / updated_at

### 6.5 Post
- id：PK
- thread_id：FK
- user_id：FK（作者）
- content
- status：visible / hidden
- created_at / updated_at

### 6.6 Report
- id：PK
- reporter_id：FK（User）
- target_type：thread / post
- target_id
- reason
- status：pending / accepted / rejected
- resolved_by：FK（User，可為 Moderator 或 Admin）
- resolved_at
- created_at / updated_at

約束：reporter_id + target_type + target_id 唯一。

### 6.7 Like
- id：PK
- user_id：FK
- target_type：thread / post
- target_id
- created_at

約束：user_id + target_type + target_id 唯一。

### 6.8 Favorite
- id：PK
- user_id：FK
- thread_id：FK
- created_at

約束：user_id + thread_id 唯一。

### 6.9 AuditLog（操作紀錄）
- id：PK
- actor_id：FK（User，可為 null 表示系統）
- action：字串 enum（例如：auth.login、auth.logout、board.create、thread.hide、report.accept 等）
- target_type：board / thread / post / report / user
- target_id
- metadata：JSON（可選；原因、舊值/新值摘要、board_id、target_type 等）
- ip / user_agent（可選）
- created_at

必記錄事件（至少）：
- 登入/登出、停權/解鎖
- 看板建立/編輯/停用、排序調整、Moderator 指派/移除
- Thread/Post 的隱藏/恢復、鎖定/解鎖、精華/置頂切換
- Report 的受理/駁回（含備註）

關聯與一致性約束（摘要）：
- Thread.board_id → Board.id；Thread.user_id → User.id
- Post.thread_id → Thread.id；Post.user_id → User.id
- Favorite.thread_id → Thread.id；Like/Report 以 target_type + target_id 指向 Thread 或 Post（需由應用層保證存在性與可見性）
- 所有「唯一約束」必須在 DB 層落實，API 必須以冪等方式處理重複請求
