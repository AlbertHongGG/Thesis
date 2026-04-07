# 任務 Spec：多使用者協作待辦系統（Trello Lite）
Multi-user Collaborative Task Board (Trello Lite)

---

## 1. 產品目標（Product Goal）
- 核心問題：讓多個專案、多個成員在同一個看板上協作任務，任務狀態、排序與內容在所有成員端保持一致，且所有關鍵操作可追溯。
- 關鍵行為：註冊/登入、建立專案、邀請/管理成員與角色、建立 Board/List/Task、拖拉排序、指派、留言、檢視 Activity Log、封存（使整個範圍唯讀）。
- 核心保證：
  - State Consistency：任務狀態與排序（list_id/position）在所有成員端一致，斷線重連後可回補。
  - RBAC：系統層級與專案內角色（Owner/Admin/Member/Viewer）權限一致且可驗證。
  - Auditability：所有關鍵操作皆寫入不可變更的 Activity Log（只能 append）。

---

## 2. 使用者角色定義（Roles）

### 2.1 系統層級角色

#### 2.1.1 Visitor
- 權限：可瀏覽 Landing、註冊、登入。
- 限制：不可存取任何專案資料；存取需登入的頁面/資源需導向登入。

#### 2.1.2 User
- 權限：可建立專案；可成為不同專案的成員並依專案角色操作；可查看自己所屬專案的 Activity Log。
- 限制：僅能存取自己有 membership 的專案；不得操作未授權的資源。

> 系統層級只區分 Visitor 與 User；專案內的可操作性由「專案角色」決定。

### 2.2 專案內角色（Project Roles）

#### 2.2.1 Owner
- 權限：專案全權（封存/刪除/管理成員、管理 Board/List、設定 WIP、允許 override WIP）。
- 限制：每個專案恆有且僅有 1 位 Owner；Owner 可轉移所有權（選配，若實作必寫入 Activity Log）。

#### 2.2.2 Admin
- 權限：管理專案結構（Board/List/成員）、設定 WIP，且可 override WIP（需寫 Activity Log）。
- 限制：不可封存專案（除非 Owner 授權為 Owner）。

#### 2.2.3 Member
- 權限：建立/編輯/拖拉/指派/完成/封存 Task；新增 Comment；查看 Activity Log。
- 限制：不得管理成員角色（除非被升為 Admin/Owner）；不得 override WIP。

#### 2.2.4 Viewer
- 權限：僅可查看 Board/List/Task/Comment/Activity Log。
- 限制：不得修改任何實體（包含拖拉、指派、留言、封存、WIP 設定）。

---

## 3. 使用者流程（User Flow）

### 3.1 Visitor 流程
1. 進入 Landing。
2. 進入註冊頁完成註冊，成為 User。
3. 或進入登入頁登入。

### 3.2 User（建立專案）流程
1. 登入後進入「專案列表頁」。
2. 建立專案（預設 visibility=private、status=active）。
3. 進入「專案總覽/看板頁」。

### 3.3 Owner（邀請與成員管理）流程
1. 在「成員管理頁」新增邀請，指定對方 email 與角色（Owner/Admin/Member/Viewer 其一；Owner 角色僅能轉移給既有成員）。
2. 受邀者（User）在「專案列表頁」看到邀請並接受/拒絕（以頁面內的邀請卡片或彈窗完成，不新增獨立頁面）。
3. Owner/Admin 可調整成員角色；Owner 可移除成員。

### 3.4 Owner/Admin（結構管理）流程
1. 在專案看板建立 Board。
2. 在 Board 內建立 List、重排 List。
3. 設定 List WIP 限制（可啟用/停用、設定上限）。

### 3.5 Member（任務協作）流程
1. 在某個 List 建立 Task。
2. 編輯 Task 內容（title/description/due_date/priority）。
3. 指派/取消指派成員（僅限專案成員）。
4. 拖拉 Task 在 List 內排序，或跨 List 移動（更新 list_id 與 position）。
5. 標記完成（status=done）。
6. 封存任務（status=archived）。

### 3.6 Comment 與即時同步流程
1. 任一可留言角色（Owner/Admin/Member）在 Task 下新增 Comment。
2. 所有同專案成員即時看到 Comment 更新。
3. Activity Log 亦即時 append。

### 3.7 封存與唯讀流程
1. Owner 封存 Project（status=archived）。
2. 專案下 Board/List/Task 皆變為唯讀；所有寫入操作被拒絕，並在 UI 顯示唯讀提示。
3. Owner/Admin 封存 Board 或 List 後，其範圍內 Task 亦唯讀。

### 3.8 斷線重連與衝突處理流程
1. 客戶端斷線後重新連線。
2. 客戶端向伺服器請求最新 Board 快照（包含 List/Task 及其排序）。
3. 若本地有未送出的變更：逐筆重送；遇到版本衝突則顯示最新版本並提示使用者重新套用。

---

## 4. 功能需求（Functional Requirements）

### 4.1 認證與帳號
- Visitor 可註冊/登入。
- User 可登出。
- 未登入存取需回 401；前端在頁面層導向登入頁。
- Session 管理：採用短效 access token + 可續期機制（或等效方案），並支援登出使 token 失效（至少伺服端可拒絕已登出的 refresh）。

### 4.2 專案管理（Project）
- User 可建立專案（name 必填）。
- Owner 可封存專案（Project.status=archived）。
- 專案可設定 visibility（private/shared）：
  - private：僅成員可見。
  - shared：仍需為成員才可存取資料，但可在組織內更容易被邀請/發現（不提供公開匿名瀏覽）。
- 封存專案後：
  - 所有 Board/List/Task/Comment 變為唯讀（禁止新增/編輯/拖拉/指派/留言/封存）。
  - Activity Log 仍可查看，且封存動作需寫入 Activity Log。

### 4.3 成員與角色管理（Project Membership）
- Owner 可邀請成員並設定角色。
- Owner/Admin 可調整成員角色。
- Owner 可移除成員。
- 邀請接受規則：
  - 受邀者必須是已註冊的 User，或先註冊後才能接受（兩者擇一；若允許先邀請後註冊，則邀請應以 email 綁定）。
  - 接受邀請後才建立 membership。
- 指派限制：非成員不得被指派任務；若成員被移除，需自動解除其在該專案內所有 Task 的指派（或將指派標記為失效），並寫 Activity Log。

### 4.4 Board / List
- Board：可建立 Board、重排 Board（order）、封存 Board（Board.status=archived）。
- List：可建立 List、重排 List（order）、封存 List（List.status=archived）。
- WIP：List 可設定 WIP 限制：
  - is_wip_limited=true 時，wip_limit 必須為正整數。
  - WIP 計數以「該 List 中未 archived 的 Task」為準。
- 封存 Board：其下 List/Task 全部唯讀。
- 封存 List：該 List 內 Task 全部唯讀；Task 不可再被拖出或拖入該 List。

### 4.5 Task
- 建立 Task、編輯內容（title 必填）。
- 拖拉任務於 List 間移動：更新 list_id 與 position，並同步給所有成員。
- 指派/取消指派成員（assignee_ids 可多選）。
- 標記完成（status=done）。
- 封存任務（status=archived）。

#### 4.5.1 Task 狀態機與限制
- 狀態集合：open | in_progress | blocked | done | archived。
- 合法轉換（最小集合）：
  - open → in_progress | blocked | done | archived
  - in_progress → blocked | done | archived
  - blocked → in_progress | done | archived
  - done → archived
  - archived：終態，不可再轉換
- 限制：
  - done 任務不可拖回 in_progress（亦不可轉回 open/blocked）。
  - archived 任務不可再編輯/拖拉/指派。

#### 4.5.2 拖拉與排序一致性
- 任何拖拉/重排都必須在伺服端產生「權威排序」並廣播給所有成員。
- position 計算需能在高頻拖拉下保持穩定（例如以可插入的排序鍵或等效算法）。

#### 4.5.3 WIP 限制與 override
- 當 List 超過 WIP 上限時：
  - Member 禁止拖入/建立（伺服端拒絕，回傳可顯示的錯誤）。
  - Admin/Owner 可 override，但必須在 Activity Log 記錄 override 事由與結果。

#### 4.5.4 多人協作衝突
- 同一 Task 同時編輯：需提供衝突檢測與最新版本回報。
  - 每個可編輯實體需具備 version（或 updated_at + If-Match 等效機制）。
  - 伺服端遇到版本不一致時拒絕寫入，回傳最新資料。
- 同時拖拉：伺服端以最後寫入為準並重新計算 position，廣播最終排序。

### 4.6 Comment
- 在 Task 下新增留言（Owner/Admin/Member）。
- Viewer 不可新增留言。
- 留言即時同步給所有成員。
- Comment 不提供編輯/刪除（避免與 Activity Log 目的衝突；若未實作此限制需在 Activity Log 記錄編輯/刪除）。

### 4.7 Activity Log（不可變）
- 所有關鍵操作都需寫入 Activity Log（append-only，不可修改/刪除）。
- 需涵蓋：Project/Board/List/Task/Comment/Membership 的建立、更新、封存、角色調整、WIP override、拖拉重排等。
- Activity Log 即時更新，並可依專案篩選。

### 4.8 即時同步（Realtime Sync）
- 任務狀態、排序、拖拉結果需即時同步。
- Comment 即時顯示。
- Activity Log 即時更新。
- 重連回補：重連後需取得最新快照，並將本地狀態對齊伺服端權威狀態。

### 4.9 主要頁面需求（含資訊架構與導覽）

#### 4.9.1 Page Inventory
- 產品介紹頁（Landing）：`/`
- 註冊頁：`/register`
- 登入頁：`/login`
- 專案列表頁：`/projects`
- 專案總覽/看板頁（Board + List + Task）：`/projects/:projectId/board`
- 任務詳情（側邊欄/彈窗）：（附屬於 Board 頁；以 `taskId` 開啟狀態識別，不新增獨立 route）
- 成員管理頁（Project Members）：`/projects/:projectId/members`
- 專案設定頁（Project Settings）：`/projects/:projectId/settings`
- Activity Log 頁：`/projects/:projectId/activity`
- 封存專案/封存任務檢視頁：`/projects/:projectId/archived`
- 401 未登入頁（導向登入）：`/401`
- 403 無權限頁：`/403`
- 404 找不到頁：`/404`
- 5xx 系統錯誤頁：`/5xx`

#### 4.9.2 Route Access Control
- Landing /register /login：Visitor 可進入；User 進入時可導向 `/projects`。
- `/projects`：僅 User；Visitor 存取需 401 並導向 `/login`。
- 專案內頁（`/projects/:projectId/*`）：僅該專案成員（Owner/Admin/Member/Viewer）。
  - 非成員：顯示 403。
  - 已登入但專案不存在：顯示 404。
- `/projects/:projectId/settings`：僅 Owner；其他成員存取顯示 403。

#### 4.9.3 Navigation Visibility Rules（導覽可見性）
- Visitor：Header 僅顯示「登入」「註冊」。
- User：Header 顯示「專案列表」「登出」。
- 專案內：Sidebar/Topbar 顯示「看板」「成員」「Activity」「封存檢視」；僅 Owner 顯示「專案設定」。
- 不顯示無權限入口（例如 Viewer 不應看到「新增 Task」「新增留言」「管理成員」按鈕）。

#### 4.9.4 Page Responsibilities（每頁責任與主要元件）
- 專案列表頁：專案清單、建立專案入口、邀請清單（接受/拒絕）。
- 看板頁：Board 切換、List 欄、Task 卡片、拖拉排序、開啟 Task 詳情面板。
- Task 詳情面板：顯示/編輯 Task 欄位、指派、留言串、狀態變更、封存（依權限顯示）。
- 成員管理頁：成員列表、邀請入口、角色調整、移除成員（依權限）。
- 專案設定頁：修改專案基本資訊、visibility、封存專案（Owner）。
- Activity Log 頁：事件串流、篩選（依實作）、即時更新。
- 封存檢視頁：列出 archived 的 Task（與 archived 的 Board/List，若提供），僅可檢視。

#### 4.9.5 Page-level 狀態
- 所有主要頁需支援 Loading / Empty / Error：
  - Loading：初次載入、切換專案或重連回補。
  - Empty：例如無專案、無 Board、無 List、無 Task、無 Activity。
  - Error：401/403/404/5xx 分流與可重試。

---

## 5. 非功能需求（Non-functional Requirements）
- RWD：桌機與平板可用；看板需支援橫向捲動。
- Loading / Error / Empty：每頁明確呈現；重要操作需有進度狀態與禁止重複提交。
- 錯誤處理：
  - 401：導向登入並保留返回路徑。
  - 403：顯示無權限與回到可存取頁面的入口。
  - 404：顯示找不到並提供返回專案列表。
  - 5xx：顯示系統錯誤與重試。
- 安全性：
  - RBAC 在伺服端強制；避免 IDOR（不得用猜測 id 讀取他人專案）。
  - Comment/Task/Project 欄位需防 XSS（輸入清理或輸出轉義）。
- 一致性與併發：
  - 所有寫入操作需在單一權威來源（伺服端）序列化同一資源的關鍵寫入（至少對排序/拖拉）。
  - 對可編輯實體提供衝突檢測（version/ETag）。
- 可觀測性（最小）：
  - Activity Log 作為產品內稽核；伺服端保留錯誤事件以利追查（若實作）。

---

## 6. 資料模型（Data Model）

### 6.1 User
- id (string/uuid)
- email (unique)
- password_hash
- display_name
- created_at

### 6.2 Project
- id
- name
- description (optional)
- owner_id (FK → User.id)
- visibility: private | shared
- status: active | archived
- created_at, updated_at

### 6.3 ProjectMembership
- id
- project_id (FK → Project.id)
- user_id (FK → User.id)
- role: owner | admin | member | viewer
- joined_at
- unique(project_id, user_id)

### 6.4 ProjectInvitation
- id
- project_id (FK)
- email
- invited_role: admin | member | viewer
- invited_by_user_id (FK → User.id)
- status: pending | accepted | rejected | revoked
- created_at, responded_at (optional)

### 6.5 Board
- id
- project_id (FK)
- name
- order (number)
- status: active | archived
- created_at, updated_at

### 6.6 List
- id
- board_id (FK)
- title
- order (number)
- status: active | archived
- is_wip_limited (boolean)
- wip_limit (int, optional)
- created_at, updated_at

### 6.7 Task
- id
- project_id (FK)
- board_id (FK)
- list_id (FK)
- title
- description (optional)
- due_date (optional)
- priority (optional; enum 或 int)
- position (string/number; 可插入排序鍵)
- status: open | in_progress | blocked | done | archived
- version (int; 用於衝突檢測)
- created_by_user_id (FK)
- created_at, updated_at

### 6.8 TaskAssignee（M:N）
- task_id (FK → Task.id)
- user_id (FK → User.id)
- assigned_at
- unique(task_id, user_id)

### 6.9 Comment
- id
- task_id (FK → Task.id)
- author_id (FK → User.id)
- content
- created_at

### 6.10 ActivityLog（Append-only）
- id
- project_id (FK → Project.id)
- actor_id (FK → User.id)
- entity_type: project | membership | invitation | board | list | task | comment
- entity_id (string)
- action (string; 例如 create/update/move/archive/assign/unassign/override_wip)
- timestamp
- metadata (json; 包含前後狀態、WIP override 理由、排序變更摘要等)

### 6.11 關聯與索引（最小）
- Project 1:N Board
- Board 1:N List
- List 1:N Task
- Task M:N User（TaskAssignee）
- Task 1:N Comment
- Project 1:N ActivityLog
- 索引建議：
  - ProjectMembership(project_id, user_id) unique
  - Task(list_id, position)
  - ActivityLog(project_id, timestamp desc)
