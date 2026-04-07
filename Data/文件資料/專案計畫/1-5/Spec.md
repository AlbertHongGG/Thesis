# 任務 Spec：內部文件審核與簽核系統
Internal Document Review & Approval System

---

## 1. 產品目標（Product Goal）
建立一套供公司內部使用的「文件審核與簽核系統」，讓使用者能以明確且可稽核的流程完成：
- 建立文件草稿、上傳附件、版本化
- 送出文件進入簽核流程（依流程模板產生審核任務）
- 審核者依任務進行同意/退回，並留下理由
- 以嚴格狀態機管理文件生命週期（非法轉換一律拒絕）
- 以 append-only 的審核紀錄與稽核事件，確保歷史不可竄改

系統必備能力
- 多角色系統（RBAC）：Guest / User / Reviewer / Admin
- 文件狀態機（State Machine）：狀態轉換需嚴格驗證（含角色與前置條件）
- 版本不可變性（Immutability）：送審版本與該版本附件不可被覆寫
- 可追蹤性（Auditability）：誰在什麼時間做了什麼操作（Audit Log）
- 權限與資料隔離：防止 IDOR（他人文件不可被讀取/操作）
- 全站 UX 品質：Loading / Error / Empty / Forbidden / Not Found 狀態完整
- 多人協作一致性：需處理併發審核（同一任務不可重複處理）

---

## 2. 使用者角色定義（Roles）
### 2.1 訪客（Guest）
- 權限
  - 僅可存取登入頁
- 可執行行為
  - 登入系統
- 限制
  - 不可存取任何受保護頁面
  - 嘗試存取受保護頁面：未登入（無有效 token）→ 401 → 導向 `/login`

### 2.2 一般使用者（User / 申請人）
- 權限
  - 僅可存取「自己建立的文件」
  - 可存取頁面：`/documents`、`/documents/:id`
- 可執行行為
  - 建立文件草稿
  - 編輯文件草稿（僅 Draft）
  - 上傳附件（僅 Draft；附件綁定到版本）
  - 送出文件進入簽核流程
  - 查看文件詳情（含版本、附件、審核紀錄與稽核事件）
  - 對被退回的文件進行修改並重新送審
  - 登出
- 限制
  - 不可查看他人文件（防止 IDOR）
  - 文件進入 Submitted / In Review / Approved / Archived 後不可再編輯內容或附件
  - 不可執行審核同意/退回

### 2.3 審核者（Reviewer）
- 權限
  - 可存取「指派給自己之審核任務」及其對應文件詳情
  - 可存取頁面：`/reviews`、`/documents/:id`（限可見範圍）
- 可執行行為
  - 檢視待審核任務列表
  - 在文件詳情中對自己的待辦執行「同意」或「退回」
  - 填寫退回理由（必填）
  - 登出
- 限制
  - 不可瀏覽 `/documents` 全量列表（避免暴露非關聯文件）
  - 不可編輯文件內容或附件
  - 不可處理不屬於自己的審核任務

### 2.4 管理員（Admin）
- 權限
  - 可存取所有文件與流程模板
  - 可存取頁面：`/documents`、`/documents/:id`、`/admin/flows`
- 可執行行為
  - 管理簽核流程模板（建立/編輯/停用）
  - 檢視任意文件詳情與審核歷程
  - 封存已核准文件（Approved → Archived）
  - 登出
- 限制
  - 不可刪除歷史資料（文件版本、審核紀錄、稽核事件皆不可刪除）

> 角色為互斥：每個 User 僅能有一個 role（User / Reviewer / Admin）。

---

## 3. 使用者流程（User Flow）
### 3.1 User（申請人）流程
1. 登入後進入文件列表（`/documents`）
2. 點擊「建立文件」建立一份 Draft
3. 在文件詳情（`/documents/:id`）編輯標題與內容
4. 視需要上傳附件（附件僅屬於 Draft 版本）
5. 點擊「送出簽核」
6. 系統鎖定本次送審版本並建立審核任務，文件進入 In Review
7. 若審核被退回，文件進入 Rejected；User 執行「退回後修改」使文件回到 Draft（建立新的 Draft 版本）
8. 修改完成後可再次「送出簽核」
9. 審核全數同意後文件進入 Approved

### 3.2 Reviewer（審核者）流程
1. 登入後進入審核待辦（`/reviews`）
2. 點擊一筆待辦進入文件詳情（`/documents/:id`）
3. 檢視送審版本內容與附件
4. 選擇「同意」或「退回」
5. 若退回則必填退回理由；送出後文件進入 Rejected，未完成的其他任務作廢
6. 若同意，任務標記為已同意；若為最後一個必要同意，文件進入 Approved

### 3.3 Admin（管理員）流程
1. 登入後進入文件列表（`/documents`）
2. 可查看任意文件詳情與審核歷程
3. 進入流程模板管理（`/admin/flows`）
4. 建立或調整流程模板（串簽/併簽、步驟與指派規則）
5. 對已核准文件執行封存（Approved → Archived）

---

## 4. 功能需求（Functional Requirements）
### 4.1 帳號與認證（Authentication）
- Email + Password 登入
  - Email 需唯一
  - 密碼需 hash 儲存（不可明碼）
- Token-based session
  - API 端需驗證 token；無效/過期回 401
  - 前端遇 401：
    - 若目前在受保護頁面：導向 `/login`
    - 若為操作型 API（例如送審/同意/退回）：顯示可理解的錯誤訊息，並導向 `/login`
- 登出
  - 使 token 失效（例如 server-side token blacklist / session revocation）或在用戶端清除
  - 登出後回到 `/login`
- 登入成功後導向
  - User / Admin：預設導向 `/documents`
  - Reviewer：預設導向 `/reviews`

### 4.2 核心資料管理（Documents / Versions / Attachments / Review Tasks）
#### 4.2.1 文件（Document）
文件欄位（最低需求）
- `id`: UUID（PK）
- `title`: string（必填，≤ 120 字）
- `status`: enum（必填）：`Draft` / `Submitted` / `In Review` / `Rejected` / `Approved` / `Archived`
- `owner_id`: FK（必填，建立者）
- `current_version_id`: FK（必填，指向目前版本）
- `created_at`: datetime（必填）
- `updated_at`: datetime（必填）

可見性與隔離
- User 只能讀取/操作 `owner_id=自己` 的 Document
- Reviewer 只能讀取「有被指派審核任務」之 Document
- Admin 可讀取所有 Document

文件可操作行為與限制
- 建立：User/Admin 可建立 Document，初始 `status=Draft`，同時建立一筆 Draft 版本作為 `current_version_id`
- 編輯：僅當 `status=Draft` 且操作者為 owner（或 Admin）時允許更新 title/content
- 送審後鎖定：文件進入 `Submitted` / `In Review` / `Approved` / `Archived` 後，文件內容與附件皆不可再被修改
- 封存：僅 Admin 可將 `Approved` 封存為 `Archived`

#### 4.2.2 文件版本（DocumentVersion）
版本欄位
- `id`: UUID（PK）
- `document_id`: FK（必填）
- `version_no`: int（必填，遞增）
- `content`: text（必填）
- `created_at`: datetime（必填）

規則
- `current_version_id` 永遠指向「目前可被展示的版本」：
  - `Draft`：指向目前 Draft 版本（可反覆更新內容）
  - `In Review` / `Approved` / `Archived`：指向本次送審的鎖定版本
  - `Rejected`：仍指向被退回的送審版本（只讀）
- 每次送出簽核必須鎖定一個版本（該版本不可再修改）
  - 系統在 `Draft -> Submitted` 時建立一筆新的 DocumentVersion（`version_no` + 1）作為「送審鎖定版本」
  - 文件進入 `In Review` 後，`current_version_id` 必須指向該送審版本
- Rejected 後再次修改
  - User 執行 `Rejected -> Draft` 時，系統建立一筆新的 Draft 版本（`version_no` + 1），內容以被退回版本的內容為起點

#### 4.2.3 附件（Attachment）
附件欄位
- `id`: UUID（PK）
- `document_version_id`: FK（必填，綁定到版本）
- `filename`: string（必填）
- `content_type`: string（必填）
- `size_bytes`: int（必填）
- `storage_key`: string（必填）
- `created_at`: datetime（必填）

規則
- 附件不可編輯/覆蓋替換（同一附件 id 不允許內容被改寫）
- 只有 `Draft` 狀態允許新增附件，且必須綁定到 `current_version_id`（Draft 版本）
- 文件進入非 Draft 後不可再新增附件
- Rejected -> Draft 後，新 Draft 版本的附件處理方式：
  - 系統不會修改既有版本的附件
  - 使用者可於新 Draft 版本重新上傳附件（新增新的 Attachment records 綁定新版本）

#### 4.2.4 簽核流程模板（ApprovalFlowTemplate / ApprovalFlowStep）
模板欄位
- `ApprovalFlowTemplate`
  - `id`: UUID
  - `name`: string（必填）
  - `is_active`: boolean（必填）
  - `created_at`: datetime
  - `updated_at`: datetime
- `ApprovalFlowStep`
  - `id`: UUID
  - `template_id`: FK(ApprovalFlowTemplate)
  - `step_key`: string（必填，用於步驟識別；同一 template 下唯一）
  - `order_index`: int（必填；越小越先）
  - `mode`: `Serial` / `Parallel`

指派規則（最低需求）
- 每個 step 必須能對應到「一或多位 Reviewer」作為審核者（assignee）
- 若某 step 沒有任何 assignee，則該 template 不得用於送審（送審前置條件驗證失敗，HTTP 400）
- Template 的建立/編輯/停用只允許 Admin

#### 4.2.5 審核任務（ReviewTask）
任務欄位
- `id`: UUID（PK）
- `document_id`: FK（必填）
- `document_version_id`: FK（必填，本次送審版本）
- `assignee_id`: FK（必填，審核者）
- `step_key`: string（必填，用於同一流程模板中的步驟識別）
- `mode`: enum（必填）：`Serial` / `Parallel`
- `status`: enum（必填）：`Pending` / `Approved` / `Rejected` / `Cancelled`
- `acted_at`: datetime（選填）
- `created_at`: datetime（必填）

規則
- `Pending` 任務只能被處理一次（同意/退回其一）
  - 重複提交必須拒絕（建議回 409 Conflict，且不得產生重複 ApprovalRecord/AuditLog）
- Reviewer 僅可操作：`assignee_id=自己` 且 `status=Pending` 的任務
- 若任務被退回導致文件 Rejected，其餘尚未完成的任務需標記為 `Cancelled`
- `Serial` 與 `Parallel` 行為
  - Serial：同時間只允許「當前 step」存在 `Pending` 任務
  - Parallel：同一 step 可同時存在多筆 `Pending` 任務，需全數 `Approved` 才能進入下一步或完成

### 4.3 文件狀態機（Document State Machine）
#### 4.3.1 狀態定義
- `Draft`：草稿，可編輯內容與附件
- `Submitted`：已送出，系統準備建立任務（短暫中介狀態）
- `In Review`：審核中，等待任務完成
- `Rejected`：本次送審被退回
- `Approved`：本次送審全數同意
- `Archived`：已封存（只讀）

#### 4.3.2 合法狀態轉換
- `Draft` → `Submitted`（User）
- `Submitted` → `In Review`（System）
- `In Review` → `Rejected`（Reviewer）
- `In Review` → `Approved`（System）
- `Rejected` → `Draft`（User）
- `Approved` → `Archived`（Admin）

非法轉換處理
- ⚠️ 非法轉換一律拒絕（HTTP 400）
- 任何寫入型操作（編輯/上傳附件/送審/同意/退回/封存）皆需同時驗證：角色、存取權限、當前狀態、前置條件

#### 4.3.3 送審與審核規則
送審前置條件（至少）
- `title` 與 `content` 不可為空
- 必須選定一個啟用中的流程模板（ApprovalFlowTemplate.is_active=true）
- 該模板的 steps 必須完整（至少 1 個 step）且每個 step 皆有 assignee

送審處理（Draft -> Submitted -> In Review）
- Draft -> Submitted（User 行為）
  - 建立「送審鎖定版本」DocumentVersion（version_no 遞增）
  - 將文件 status 設為 `Submitted`
  - 寫入 AuditLog：Submit
- Submitted -> In Review（System 行為，需同一交易/一致性處理）
  - 依流程模板建立 ReviewTask：
    - Serial：僅建立或啟用第一個 step 的 Pending 任務
    - Parallel：第一個 step 的多位 assignee 皆建立 Pending 任務
  - 將文件 status 設為 `In Review`
  - 寫入 AuditLog：CreateReviewTasks / EnterInReview

審核處理（In Review -> Rejected / Approved）
- Reviewer 退回（In Review -> Rejected）
  - 前置條件：對應 ReviewTask 必須是 `Pending` 且 assignee=自己
  - 退回理由必填
  - 寫入 ApprovalRecord（action=Rejected）
  - 將文件 status 設為 `Rejected`
  - 取消其餘 Pending 任務（標記為 `Cancelled`）
  - 寫入 AuditLog：RejectDocument / CancelOtherTasks
- Reviewer 同意（ReviewTask Pending -> Approved；文件可能維持 In Review 或進入 Approved）
  - 前置條件：對應 ReviewTask 必須是 `Pending` 且 assignee=自己
  - 寫入 ApprovalRecord（action=Approved）
  - 若同一步驟已全數 Approved：
    - Serial：啟用下一步任務（下一步 Pending）；若無下一步則文件 `In Review -> Approved`
    - Parallel：同上（完成該 step 後再看是否有下一步或完成）
  - 若為最後一個必要同意：System 將文件 `In Review -> Approved`
  - 寫入 AuditLog：ApproveTask / (EnterApproved 若完成)

Rejected 後再送審（Rejected -> Draft -> Submitted）
- User 執行 Rejected -> Draft
  - 建立新的 Draft DocumentVersion（version_no 遞增），內容以被退回版本為起點
  - 將文件 status 設為 `Draft`
  - 寫入 AuditLog：ReopenAsDraft

封存（Approved -> Archived）
- Admin 封存
  - 將文件 status 設為 `Archived`
  - 寫入 AuditLog：ArchiveDocument

### 4.4 主要頁面需求（Pages）
#### 4.4.1 頁面清單（Page Inventory）
- 登入頁：`/login`（Guest）
- 文件列表：`/documents`（User / Admin）
- 文件詳情：`/documents/:id`（User / Reviewer / Admin，依可見範圍）
- 審核待辦：`/reviews`（Reviewer）
- 流程模板管理：`/admin/flows`（Admin）

#### 4.4.2 各頁面責任（Page Responsibilities）
- `/login`
  - 顯示登入表單（Email/Password）
  - 送出後依角色導向預設首頁
  - Page-level 狀態：Submitting / Error
- `/documents`
  - 顯示可見文件列表（User：自己的；Admin：全部）
  - 入口：建立文件
  - 顯示欄位至少包含：title、status、updated_at
  - Page-level 狀態：Loading / Error / Empty
- `/documents/:id`
  - 顯示文件資訊、版本清單、附件清單、審核流程與紀錄（ReviewTasks/ApprovalRecords/AuditLogs）
  - User CTA：
    - 編輯（僅 Draft）
    - 上傳附件（僅 Draft）
    - 送出簽核（僅 Draft）
    - 退回後修改（僅 Rejected）
  - Reviewer CTA：
    - 同意/退回（僅對自己的 Pending 任務）
    - 退回理由（必填）
  - Admin CTA：
    - 封存（僅 Approved）
  - Page-level 狀態：Loading / Error / Forbidden / Not Found
- `/reviews`
  - 顯示 Reviewer 的待辦任務列表（僅 Pending）
  - 入口：點擊任務開啟文件詳情
  - Page-level 狀態：Loading / Error / Empty
- `/admin/flows`
  - 顯示流程模板列表（含啟用/停用狀態）
  - 入口：建立/編輯/停用流程模板（含步驟順序、mode、指派規則）
  - Page-level 狀態：Loading / Error / Empty

#### 4.4.3 資訊架構與導覽（必填）
路由存取控制（Route Access Control）
- Guest
  - 允許：`/login`
  - 拒絕：其餘全部（401 → 導向 `/login`）
- User
  - 允許：`/documents`、`/documents/:id`
  - 拒絕：`/reviews`（403 Forbidden）、`/admin/flows`（403 Forbidden）
- Reviewer
  - 允許：`/reviews`、`/documents/:id`（限有任務關聯）
  - 拒絕：`/documents`（403 Forbidden）、`/admin/flows`（403 Forbidden）
- Admin
  - 允許：`/documents`、`/documents/:id`、`/admin/flows`

導覽列/Header 規則（Navigation Visibility Rules）
- Guest：只顯示「登入」
- User：顯示「文件」與「登出」
- Reviewer：顯示「待辦」與「登出」
- Admin：顯示「文件」「流程模板」與「登出」

全站共用 Layout 責任（Layout Responsibility）
- Header 提供角色對應導覽與登出入口
- 文件建立/送審/審核動作入口放在頁面內，不放在 Header（避免跨頁誤觸）
- UI 一致性：同一頁面同一動作入口不可重複出現

---

## 5. 非功能需求（Non-functional Requirements）
- 資料一致性
  - 文件列表與文件詳情的 `status` / `updated_at` / `current_version_id` 必須一致
  - 文件詳情內的版本、附件、ReviewTask、ApprovalRecord、AuditLog 需對應同一份文件與正確版本
- 安全性
  - 嚴格驗證文件與任務存取權限，防止 IDOR
  - Reviewer 存取文件詳情時，若無任何任務關聯，應以 Not Found 回應（避免文件存在性洩漏）
  - 內容（title/content）與退回理由需安全顯示（防 XSS）
- 不可變性
  - DocumentVersion、Attachment、ApprovalRecord、AuditLog 皆採 append-only：不可編輯、不可刪除
- 可觀測性
  - 所有關鍵事件需寫入 Audit Log（who/when/what），且 metadata 需足以稽核（例如 document_id、version_id、review_task_id、target_status）
- 併發一致性
  - 同一筆 ReviewTask 只能被處理一次：需以資料庫交易與條件式更新確保原子性
  - 重複提交/競態：回明確失敗（409 Conflict），且不得產生重複紀錄
- 全站 UX
  - 全站必備狀態：Loading / Error / Empty / Forbidden / Not Found
  - 送出操作需防重送（按鈕 disabled、顯示進度）
  - 錯誤需可理解（顯示具體原因，例如「狀態不允許」「理由必填」「找不到資源」）
- UI 一致性
  - 相同動作入口不可在同一頁面重複出現
  - 同一角色在不同頁面對同一概念的狀態呈現需一致（例如狀態 badge 文案一致）

---

## 6. 資料模型（Data Model）
### User
- `id`: UUID
- `email`: unique
- `password_hash`: string
- `role`: User / Reviewer / Admin
- `created_at`: datetime

### Document
- `id`: UUID
- `title`: string
- `status`: Draft / Submitted / In Review / Rejected / Approved / Archived
- `owner_id`: FK(User)
- `current_version_id`: FK(DocumentVersion)
- `created_at`: datetime
- `updated_at`: datetime

### DocumentVersion
- `id`: UUID
- `document_id`: FK(Document)
- `version_no`: int
- `content`: text
- `created_at`: datetime

### Attachment
- `id`: UUID
- `document_version_id`: FK(DocumentVersion)
- `filename`: string
- `content_type`: string
- `size_bytes`: int
- `storage_key`: string
- `created_at`: datetime

### ApprovalFlowTemplate
- `id`: UUID
- `name`: string
- `is_active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

### ApprovalFlowStep
- `id`: UUID
- `template_id`: FK(ApprovalFlowTemplate)
- `step_key`: string
- `order_index`: int
- `mode`: Serial / Parallel

### ReviewTask
- `id`: UUID
- `document_id`: FK(Document)
- `document_version_id`: FK(DocumentVersion)
- `assignee_id`: FK(User)
- `step_key`: string
- `mode`: Serial / Parallel
- `status`: Pending / Approved / Rejected / Cancelled
- `acted_at`: datetime?
- `created_at`: datetime

### ApprovalRecord（Append-only）
- `id`: UUID
- `document_id`: FK(Document)
- `document_version_id`: FK(DocumentVersion)
- `review_task_id`: FK(ReviewTask)
- `actor_id`: FK(User)
- `action`: Approved / Rejected
- `reason`: text?
- `created_at`: datetime

### AuditLog（Append-only）
- `id`: UUID
- `actor_id`: FK(User)
- `action`: string
- `entity_type`: string
- `entity_id`: UUID
- `metadata_json`: text
- `created_at`: datetime

### 關聯（摘要）
- User 1:N Document（owner_id）
- Document 1:N DocumentVersion
- DocumentVersion 1:N Attachment
- ApprovalFlowTemplate 1:N ApprovalFlowStep
- Document 1:N ReviewTask
- ReviewTask 1:N ApprovalRecord（同一 ReviewTask 理論上最多 1 筆，依規則僅能處理一次）
- Document 1:N ApprovalRecord
- User 1:N AuditLog
