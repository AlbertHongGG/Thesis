# 任務 Spec：企業級專案管理系統（Jira Lite）
Jira Lite（Multi-Tenant Project & Issue Tracking System）

---

## 1. 產品目標（Product Goal）
- 提供支援多組織（Multi-Tenant）、多專案的企業級專案管理系統，讓不同組織（Organization）的資料完全隔離。
- 支援 Scrum / Kanban 專案，並能完整追蹤 Issue 生命週期（建立、指派、狀態流轉、關聯、稽核）。
- 提供清楚且可驗證的 RBAC 權限控管：Platform / Organization / Project 三層作用域（Scope）彼此獨立且不可混用或互相推導。
- 系統必備能力：
  - 認證與 Session 管理（登入/登出/邀請加入）
  - 路由與資料的存取控制（401/403/404）與導覽可見性控管（該不出現的入口不可顯示）
  - Issue Workflow（可設定且可稽核）
  - 組織/專案唯讀狀態（Organization suspended / Project archived）
  - 稽核紀錄（Audit Log）可追溯 who/when/what（含 before/after）

---

## 2. 使用者角色定義（Roles）
> 角色分為三個作用域（Scope）：Platform、Organization、Project。Project 層級角色 ≠ Organization 層級角色，兩者不得互相推導。

> 名詞約定：
> - 「User（已登入使用者）」是登入狀態描述，不是 RBAC 角色；登入後仍需依 membership/role 才能存取 Organization/Project。
> - 一個人可同時擁有多個 scope 的角色（例如同時是某 Org 的 Org Admin、某 Project 的 Developer），但每個請求必須以目標資源的 scope 進行權限判斷。

### 2.1 Guest（未登入）
- 權限
  - 可存取：Login、Accept Invite（邀請連結）頁
- 可執行行為
  - 以 Email + 密碼登入
  - 透過邀請 token 完成加入 Organization（必要時設定密碼）
- 限制
  - 不可存取任何 Organization / Project / Issue 資料

### 2.2 Platform Admin（平台管理員，Platform Scope）
- 權限
  - 管理整個平台：建立/編輯 Organization、設定方案（Free/Paid）、停權/解除停權（suspended/active）
  - 檢視平台層級 Audit Log（含跨組織操作）
- 可執行行為
  - 建立 Organization 並指派初始 Org Admin（以 Email 指定）
  - 變更 Organization plan（Free/Paid）
  - 將 Organization 設為 suspended（停權）或解除停權
- 限制
  - 不能因為是 Platform Admin 就自動取得任一 Project 的 Project 角色；仍需以成員身份被加入該 Organization / Project 才能操作其內部資料

### 2.3 Org Admin（組織管理員，Organization Scope）
- 權限
  - 管理組織：成員、邀請、專案、組織內稽核查詢
  - 編輯 Organization 基本資訊（例如名稱），但不可變更 plan
- 可執行行為
  - 邀請使用者加入 Organization（Email Invite）
  - 管理 Organization 內成員（啟用/停用成員於本組織的存取、移除成員）
  - 建立/管理 Project（Scrum/Kanban）、指派 Project 角色
  - 檢視 Organization 內 Audit Log
- 限制
  - 不自動擁有任一 Project 的 Project Manager 權限；若要管理 Sprint/Issue，必須在該 Project 內被賦予相對應 Project 角色

### 2.4 Org Member（組織成員，Organization Scope）
- 權限
  - 可存取自己所屬 Organization 的內容（依是否同時為 Project 成員而定）
- 可執行行為
  - 進入 Organization Switch、Org Overview
  - 檢視 Org Projects（僅檢視；無建立/編輯入口）
- 限制
  - 不可邀請成員、不可管理成員、不可建立/編輯 Project、不可檢視 Org Audit Log

### 2.5 Project Manager（專案管理者，Project Scope）
- 權限
  - 管理專案：Sprint（Scrum 專案）、Issue、Workflow 設定、Issue 類型
- 可執行行為
  - 建立/編輯/指派/關閉 Issue
  - 設定專案 Workflow（Status/Transition）與 Issue Types（Story/Task/Bug/Epic）
  - Scrum 專案：建立 Sprint、啟動 Sprint、結束 Sprint、管理 Backlog
  - Kanban 專案：管理 Board 欄位（對應 Workflow Status）
- 限制
  - 不能跨 Project 或跨 Organization 操作資料

### 2.6 Developer（開發者，Project Scope）
- 權限
  - 編輯與處理 Issue（依 Project 設定的 Workflow 與權限）
- 可執行行為
  - 建立/編輯 Issue（若專案允許）
  - 變更 Issue 狀態（僅限 Workflow 允許的合法轉換）
  - 指派給自己或依規則變更 assignee（由專案設定決定）
  - 於 Issue 留言（Comment）
- 限制
  - 不可修改 Project 設定（Workflow/Issue Types/成員角色）

### 2.7 Viewer（唯讀者，Project Scope）
- 權限
  - 僅能查看 Project 與 Issue
- 可執行行為
  - 查看 Board / Backlog / Issue Detail
- 限制
  - 不可建立/編輯/轉換 Issue 狀態、不可留言

> 權限不足時：API 回傳 403；UI 必須 disabled/hidden（以本 Spec 的路由存取控制與導覽可見性規則為準）。

---

## 3. 使用者流程（User Flow）

### 3.1 Guest（未登入）流程
1. 進入 Login Page（/login）。
2. 輸入 Email/Password 登入。
3. 若收到邀請信：點擊邀請連結進入 Accept Invite Page（/invite/:token），完成加入 Organization 後再登入或自動登入（依系統設定）。

### 3.2 Platform Admin 流程
1. 登入後進入 Platform Organizations Page（/platform/orgs）。
2. 建立 Organization（名稱、初始 Org Admin Email、plan 預設 Free）。
3. 依需要切換 Organization plan（Free/Paid）。
4. 依需要將 Organization 設為 suspended 或解除停權。
5. 檢視 Platform Audit Log（/platform/audit）。

### 3.3 Org Admin 流程
1. 登入後進入 Organization Switch / Org Home（/orgs）。
2. 選擇 Organization 進入 Org Overview Page（/orgs/:orgId）。
3. 進入 Org Members Page（/orgs/:orgId/members）邀請成員（Email Invite）。
4. 進入 Org Projects Page（/orgs/:orgId/projects）建立 Project（Scrum/Kanban）。
5. 進入 Project Settings Page（/projects/:projectId/settings）指派 Project 角色（Project Manager/Developer/Viewer）。
6. 檢視 Org Audit Log（/orgs/:orgId/audit）。

### 3.4 Project Manager 流程
1. 進入 Project Board Page（/projects/:projectId/board）檢視 Issue。
2. 建立 Issue（Story/Task/Bug/Epic），設定 priority/status/assignee/labels/due date/estimate。
3. 依 Workflow 進行狀態流轉，並可檢視 Issue 的變更歷史與稽核。
4. Scrum 專案：進入 Backlog Page（/projects/:projectId/backlog）建立 Sprint，將 Issue 加入 Sprint。
5. Scrum 專案：進入 Sprints Page（/projects/:projectId/sprints）啟動/結束 Sprint。
6. 進入 Project Settings Page（/projects/:projectId/settings）設定 Issue Types 與 Workflow。

### 3.5 Developer 流程
1. 進入 Project Board / Backlog 檢視待辦。
2. 打開 Issue Detail Page（/projects/:projectId/issues/:issueKey）更新描述、labels、estimate、assignee（依權限）。
3. 依 Workflow 合法轉換 Issue Status（例如 To Do → In Progress → Done）。
4. 在 Issue 留言以更新進度。

### 3.6 Viewer 流程
1. 進入 Project Board / Backlog / Issue Detail 檢視資訊。
2. 無任何可編輯入口（按鈕 disabled/hidden）。

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證
- 登入方式：Email + Password。
- Session：以 HttpOnly Cookie（或等效機制）維持登入狀態；伺服端必須可在每個請求判斷目前使用者（user_id + email）。
- 登出：清除 Session。
- 密碼與帳號基本規則：
  - Email 必須唯一（對應 User.email）。
  - 密碼不得以明文保存（對應 password_hash）。
- 邀請加入（Email Invite）：
  - Org Admin 可寄送邀請至 Email。
  - Invite token 需具備：有效期限（expires_at）、一次性（accepted_at 後不可再用）、綁定 Organization（organization_id）。
  - Guest 透過 /invite/:token 接受邀請後，成為該 Organization 的成員（OrganizationMembership）。
  - 若邀請 Email 對應的 User 尚不存在：接受邀請時可建立帳號並設定密碼。
  - 若邀請 Email 對應的 User 已存在：接受邀請時必須以同一 Email 的帳號完成（若已登入但 Email 不同，需拒絕並提示）。
- 未登入存取受保護路由：API 回 401；UI 導向 /login（保留 return URL）。

### 4.2 Multi-Tenant 與資料隔離
- 所有資料都必須具備 organization_id（或等效 tenant key）；Project 與其下所有資料（Issue/Sprint/Workflow/AuditLog...）都必須可追溯回 organization_id。
- Cross-Organization 隔離：
  - 任一使用者不可透過猜測 ID/Key 取得他組織 Project/Issue（避免 IDOR）。
  - 一致的存在性策略（避免洩漏資源是否存在）：
    - 對「需要 membership 才能知道存在」的資源（/orgs/:orgId*、/projects/:projectId*、/projects/:projectId/issues/:issueKey），若使用者不是該 scope 成員：允許回 404（Not Found）。
    - 對「已確認是成員但權限不足」的行為（例如 Project 成員但非 Project Manager 嘗試改 Workflow）：回 403（Forbidden）。
- Project 層角色與 Org 層角色分離：
  - Org Admin 可以指派 Project 角色，但不等於自動擁有 Project Manager 權限。

### 4.3 Organization（組織）管理
- Organization 建立/編輯：
  - Platform Admin 可建立 Organization。
  - Org Admin 可編輯組織基本資訊（例如名稱），但不可變更 plan。
  - 建立 Organization 時：plan 預設 free；status 預設 active；created_by_user_id 為操作者。
  - 建立 Organization 時必須指定初始 Org Admin Email；該 Email 將在該 Organization 內成為 Org Admin（可透過邀請加入機制完成）。
- Organization 方案（Plan）：free / paid。
  - Platform Admin 可設定 plan。
- Organization 狀態（Status）：
  - active：可正常操作。
  - suspended：停權唯讀。
- suspended（停權唯讀）規則：
  - 組織內所有「寫入操作」必須被拒絕（API 403 + 明確錯誤碼 ORG_SUSPENDED）。
  - UI 必須將所有可寫入入口 disabled/hidden（建立/編輯/刪除/轉換狀態/邀請等）。
  - 仍可查看既有資料（read-only）。

### 4.4 Project（專案）管理
- Project 類型：scrum / kanban。
- Project 建立與成員：
  - Org Admin 可建立 Project。
  - Org Admin 可將 Organization 成員加入 Project 並指派 Project 角色（project_manager / developer / viewer）。
  - Project.key（例如 PROJ）需在 organization 範圍內唯一；Project.name 在 organization 範圍內可不唯一。
- Project 設定：
  - Issue Types：story / task / bug / epic（可對每個 Project 啟用/停用）。
  - Workflow：可設定 Status 與合法 Transition；Workflow 需可版本化並保留歷史。
- Project 狀態（Status）：
  - active：可正常操作。
  - archived：唯讀。
- 不可逆規則（Immutability）：
  - Project 一旦 archived，不可恢復為 active。
  - Project archived 後，所有 Issue 不可再編輯（包含欄位變更、狀態轉換、留言）。
  - archived 後的寫入拒絕：API 403 + 明確錯誤碼 PROJECT_ARCHIVED。

### 4.5 Issue 管理（核心 Domain）

#### 4.5.1 Issue 類型
- story
- task
- bug
- epic（可關聯其他 Issue）

#### 4.5.2 Issue 欄位
- Title（必填）
- Description（可為空）
- Priority（Low/Medium/High/Critical；固定 enum）
- Status（由 Project Workflow 定義）
- Assignee（可為空）
- Reporter（建立者；必填）
- Labels（多值）
- Due date（可為空）
- Estimate（可為空；Scrum 專案常用）

#### 4.5.3 Issue Key 與排序
- 每個 Project 需具備可讀的 Issue Key（例如 PROJ-123），於列表與詳情一致使用。
- Issue.issue_key 需在 project 範圍內唯一；序號遞增規則需在伺服端保證（避免並發產生重複）。
- Issue 列表需支援基本排序（至少依 created_at / updated_at）。

#### 4.5.4 Issue Workflow（可設定）
- 每個 Project 擁有一份有效（active）的 Workflow 定義：
  - Status 集合（例如：To Do / In Progress / Done；實際可配置）
  - Transition 集合（定義哪些狀態可轉到哪些狀態）
- Workflow 變更後：
  - 新的轉換規則立即生效。
  - 現有 Issue 若處於已不存在的 Status：需採一致策略
    - 策略：Issue 仍可顯示該 Status（以名稱或 key 顯示），但禁止再進行狀態轉換；UI 顯示明確提示需由 Project Manager 調整 Workflow；伺服端拒絕狀態轉換並回 403 + 錯誤碼 ISSUE_STATUS_DEPRECATED。
- 權限要求：
  - 只有 Project Manager 可編輯 Workflow。
  - Developer 僅能依合法 Transition 轉換狀態。
  - Viewer 不可轉換狀態。

#### 4.5.5 Epic 關聯
- Epic 可關聯多個 Issue。
- 被關聯的 Issue 仍保有自己的 Status 與欄位；Epic 關聯不應改寫子 Issue 的狀態。
- Epic 關聯新增/移除必須記錄稽核。

#### 4.5.6 留言（Comment）
- Developer 與 Project Manager 可於 Issue 留言；Viewer 不可留言。
- 任何留言行為在 Project archived 或 Organization suspended 時一律拒絕（403 + PROJECT_ARCHIVED / ORG_SUSPENDED）。

#### 4.5.7 稽核與歷史（Audit / Timeline）
- 需要記錄並可查詢的事件至少包含：
  - Issue 建立
  - 欄位變更（title/description/priority/status/assignee/labels/due date/estimate）
  - Issue 狀態轉換（含 from/to）
  - Epic 關聯新增/移除
  - Project archived
  - Organization suspended/unsuspended
  - 成員邀請/加入/移除、角色變更
- Audit Log 必須包含：who（user_id/email）、when（timestamp）、what（action + entity + before/after）。
- Audit Log 不可被一般使用者修改/刪除。

### 4.6 Scrum / Kanban（依 Project 類型）

#### 4.6.1 Scrum：Sprint
- Scrum Project 具備 Sprint：
  - Sprint 欄位：name、goal（可為空）、start_date、end_date、status（planned/active/closed）
- Project Manager 可：
  - 建立 Sprint
  - 啟動 Sprint（planned → active）
  - 結束 Sprint（active → closed）
  - 將 Issue 加入/移出 Sprint
- Developer/Viewer：
  - Developer 可更新 Sprint 中 Issue（依其 Issue 權限）。
  - Viewer 唯讀。
- 在 Project archived 或 Organization suspended 時，Sprint 與 Backlog 的任何寫入操作一律拒絕（403 + PROJECT_ARCHIVED / ORG_SUSPENDED）。

#### 4.6.2 Kanban：Board
- Kanban Project 以 Board 呈現 Issue，欄位（Columns）對應 Workflow Status。
- Developer/Project Manager 可在 Board 上變更 Issue 狀態（僅限合法 Transition）。
- Viewer 唯讀。
- Board 欄位變更（對應 Workflow Status 變更）僅 Project Manager 可操作。

### 4.7 主要頁面需求

#### 4.7.x 資訊架構與導覽（必填）

**Page Inventory（頁面清單）**
- Login Page：/login
- Accept Invite Page：/invite/:token
- Organization Switch Page：/orgs
- Org Overview Page：/orgs/:orgId
- Org Members Page：/orgs/:orgId/members
- Org Projects Page：/orgs/:orgId/projects
- Org Audit Log Page：/orgs/:orgId/audit
- Platform Organizations Page：/platform/orgs
- Platform Audit Log Page：/platform/audit
- Project Board Page：/projects/:projectId/board
- Project Backlog Page（Scrum only）：/projects/:projectId/backlog
- Project Sprints Page（Scrum only）：/projects/:projectId/sprints
- Project Issues List Page：/projects/:projectId/issues
- Issue Detail Page：/projects/:projectId/issues/:issueKey
- Project Settings Page：/projects/:projectId/settings

**Route Access Control（路由存取控制）**
- /login、/invite/:token：Guest 可進入；已登入可進入但應提供導回入口。
- /platform/*：僅 Platform Admin 可進入；不足回 403。
- /orgs 與 /orgs/:orgId*：需登入且為該 Organization 成員（Org Admin 或 Org Member）；不足採存在性策略回 404。
- /projects/:projectId*：需登入且為該 Project 成員；不足採存在性策略回 404。
- /projects/:projectId/settings：
  - Project Manager：可編輯 Workflow/Issue Types/Project Archive。
  - Org Admin：可做 Project 成員/角色管理（若整合於此頁）。
  - Developer/Viewer：不可編輯設定（回 403）。

**Navigation Visibility Rules（導覽可見性規則）**
- Guest：僅顯示 Login 入口；不顯示任何 Org/Project/Issue 導覽項。
- 已登入：顯示 Organization Switch（/orgs）。
- Organization 內：
  - 顯示 Org Overview。
  - Org Admin 顯示 Members / Projects / Audit。
  - Org Member 顯示 Projects（唯讀）且不顯示 Members / Audit。
- Project 內：
  - 顯示 Board、Issues。
  - Scrum 顯示 Backlog/Sprints。
  - Project Settings 僅對具權限者顯示（Project Manager、Org Admin（僅成員/角色區塊））。
- 禁止以「顯示但點了才導登入」取代「不該出現」的導覽項（除非該項為 Guest 可見）。

**Layout Responsibility（共用版面責任與 CTA 去重規則）**
- Header/Sidebar：負責顯示跨頁導覽（Org 切換、Project 切換、登出）。
- 頁面內 CTA：負責該頁核心操作（例如建立 Issue、建立 Project、邀請成員）。
- CTA 去重：同一動作不可同時在 Header 與頁面內容區重複出現兩個入口。

**Page-level 狀態（所有主要頁面都需具備）**
- Loading：第一次載入與切換 Organization/Project 時顯示。
- Empty：無資料時顯示（例如 Org 無專案、Project 無 Issue）。
- Error：API 失敗顯示錯誤訊息與 Retry。

**各頁面責任與主要 CTA（Page Responsibilities / Primary CTAs）**
- /login
  - 責任：輸入 Email/Password 建立 Session。
  - CTA：登入。
- /invite/:token
  - 責任：驗證 token、接受邀請並完成加入 Organization；必要時建立帳號與設定密碼。
  - CTA：接受邀請（必要時含設定密碼）。
- /orgs
  - 責任：列出使用者可切換的 Organizations（僅 active 或含 suspended 標示）；進入所選 Org。
  - CTA：切換 Organization。
- /orgs/:orgId
  - 責任：顯示 Organization Overview（狀態、方案、專案概覽）。
  - CTA：無（避免與 Projects/ Members 入口重複；主要導覽由 Sidebar）。
- /orgs/:orgId/members
  - 責任：成員清單、邀請、成員狀態管理。
  - CTA：邀請成員。
- /orgs/:orgId/projects
  - 責任：Project 清單、建立 Project、進入 Project。
  - CTA：建立 Project（Org Admin 才顯示）。
- /orgs/:orgId/audit
  - 責任：Organization 範圍 Audit Log 查詢。
  - CTA：無（以篩選/搜尋作為互動）。
- /platform/orgs
  - 責任：全平台 Organization 管理（建立、plan、suspended）。
  - CTA：建立 Organization。
- /platform/audit
  - 責任：平台層 Audit Log 查詢（含跨組織）。
  - CTA：無（以篩選/搜尋作為互動）。
- /projects/:projectId/board
  - 責任：Kanban/Scrum 的 Board 視圖；Issue 狀態流轉（合法轉換）。
  - CTA：建立 Issue（依專案設定與角色）。
- /projects/:projectId/backlog（Scrum only）
  - 責任：Backlog 與 Sprint 規劃；Issue 加入/移出 Sprint。
  - CTA：建立 Sprint（Project Manager）。
- /projects/:projectId/sprints（Scrum only）
  - 責任：Sprint 清單；啟動/結束 Sprint。
  - CTA：啟動 Sprint / 結束 Sprint（Project Manager）。
- /projects/:projectId/issues
  - 責任：Issue 列表、排序、進入 Issue 詳情。
  - CTA：建立 Issue（依專案設定與角色）。
- /projects/:projectId/issues/:issueKey
  - 責任：Issue 詳情（欄位編輯、狀態轉換、Epic 關聯、留言、Timeline/Audit 呈現）。
  - CTA：儲存變更、狀態轉換、新增留言（依角色）。
- /projects/:projectId/settings
  - 責任：Project 成員與角色管理（Org Admin/Project Manager）、Issue Types 設定、Workflow 設定、Project archive（不可逆）。
  - CTA：儲存 Workflow、儲存 Issue Types、Archive Project。

---

## 5. 非功能需求（Non-functional Requirements）
- RWD：桌機/平板/手機可用；Board/Backlog 在小螢幕需提供可操作的替代呈現。
- Loading / Error / Empty：所有列表/詳情/設定頁需一致處理。
- 錯誤處理與導向：
  - 401：導向 /login（並保留 return URL）。
    - return URL 需限制為站內路徑（避免導向到非本系統目的地）。
  - 403：顯示 Forbidden（且 UI 不提供可操作入口）。
  - 404：顯示 Not Found。
  - 5xx：顯示系統錯誤與重試。
- 安全：
  - 防止跨組織資料外洩（多租戶隔離、權限檢查、避免 IDOR）。
  - 防 XSS：Issue title/description/comment 等輸入需在呈現時轉義/清理。
  - CSRF 防護（若使用 cookie session）。
- 資料一致性：
  - Issue 狀態轉換需具備伺服端校驗（不得只靠前端）。
  - 並發更新：同一 Issue 同時編輯需有一致策略（採 optimistic concurrency：以 updated_at 或等效版本欄位檢查，衝突回 409 + 明確錯誤碼 CONFLICT）。
  - 寫入操作需防重送：提交期間 UI 必須 disable 主要提交 CTA；重試不應造成重複建立/重複寫入。
- 稽核：
  - Audit Log 不可被一般使用者修改/刪除。
  - 重要操作必須寫入稽核（見 4.5.7）。

---

## 6. 資料模型（Data Model）

### User
- id: string (PK)
- email: string (unique)
- password_hash: string
- display_name: string
- created_at: datetime
- last_login_at: datetime (nullable)

### PlatformRole
- user_id: string (FK → User)
- role: enum (platform_admin)

### Organization
- id: string (PK)
- name: string
- plan: enum (free | paid)
- status: enum (active | suspended)
- created_at: datetime
- created_by_user_id: string (FK → User)

### OrganizationMembership
- id: string (PK)
- organization_id: string (FK → Organization)
- user_id: string (FK → User)
- org_role: enum (org_admin | org_member)
- status: enum (active | removed)
- created_at: datetime

### OrganizationInvite
- id: string (PK)
- organization_id: string (FK → Organization)
- email: string
- token: string (unique)
- expires_at: datetime
- accepted_at: datetime (nullable)
- invited_by_user_id: string (FK → User)

### Project
- id: string (PK)
- organization_id: string (FK → Organization)
- key: string (unique within organization)
- name: string
- type: enum (scrum | kanban)
- status: enum (active | archived)
- created_at: datetime
- created_by_user_id: string (FK → User)

### ProjectMembership
- id: string (PK)
- project_id: string (FK → Project)
- user_id: string (FK → User)
- project_role: enum (project_manager | developer | viewer)
- created_at: datetime

### ProjectIssueType
- id: string (PK)
- project_id: string (FK → Project)
- type: enum (story | task | bug | epic)
- is_enabled: boolean

### Workflow
- id: string (PK)
- project_id: string (FK → Project)
- name: string
- version: int
- is_active: boolean
- created_at: datetime
- created_by_user_id: string (FK → User)

### WorkflowStatus
- id: string (PK)
- workflow_id: string (FK → Workflow)
- key: string (e.g., todo/in_progress/done)
- name: string (display)
- position: int

### WorkflowTransition
- id: string (PK)
- workflow_id: string (FK → Workflow)
- from_status_id: string (FK → WorkflowStatus)
- to_status_id: string (FK → WorkflowStatus)

### Sprint（Scrum only）
- id: string (PK)
- project_id: string (FK → Project)
- name: string
- goal: string (nullable)
- start_date: date (nullable)
- end_date: date (nullable)
- status: enum (planned | active | closed)

### Issue
- id: string (PK)
- project_id: string (FK → Project)
- issue_key: string (unique within project)
- type: enum (story | task | bug | epic)
- title: string
- description: string (nullable)
- priority: enum (low | medium | high | critical)
- status_id: string (FK → WorkflowStatus)
- reporter_user_id: string (FK → User)
- assignee_user_id: string (FK → User, nullable)
- due_date: date (nullable)
- estimate: number (nullable)
- created_at: datetime
- updated_at: datetime
- sprint_id: string (FK → Sprint, nullable)

### IssueLabel
- id: string (PK)
- issue_id: string (FK → Issue)
- label: string

### IssueEpicLink
- id: string (PK)
- epic_issue_id: string (FK → Issue)
- child_issue_id: string (FK → Issue)

### IssueComment
- id: string (PK)
- issue_id: string (FK → Issue)
- author_user_id: string (FK → User)
- body: string
- created_at: datetime

### AuditLog
- id: string (PK)
- organization_id: string (FK → Organization, nullable)
- project_id: string (FK → Project, nullable)
- actor_user_id: string (FK → User, nullable)
- actor_email: string
- action: string
- entity_type: string
- entity_id: string
- before_json: json (nullable)
- after_json: json (nullable)
- created_at: datetime

### 關聯
- Organization 1:N Project
- Organization 1:N OrganizationMembership / OrganizationInvite / AuditLog
- Project 1:N ProjectMembership / Issue / Sprint / Workflow / AuditLog
- Workflow 1:N WorkflowStatus / WorkflowTransition
- Issue N:1 Project / WorkflowStatus
- Issue 1:N IssueLabel / IssueComment
- Epic（Issue.type=epic）1:N IssueEpicLink（epic_issue_id）
