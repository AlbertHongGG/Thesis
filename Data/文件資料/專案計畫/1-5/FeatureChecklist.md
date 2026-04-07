# 功能覆蓋確認表（Feature Coverage Checklist）
內部文件審核與簽核系統

---

## Authentication / Session
- [N/T] Email + Password 登入
- [N/T] 登入成功後依 role 導向（User/Admin → /documents；Reviewer → /reviews）
- [N/T] Token-based session（受保護 API 驗證 token）
- [N/T] token 無效/過期的 401 處理（前端清除 session 並導向 /login）
- [N/T] 登出（token 失效或用戶端清除，並回到 /login）

## RBAC / Route Access Control / Navigation
- [N/T] Guest 僅可存取 /login，其餘頁面 401 → 導向 /login
- [N/T] User 可存取 /documents 與 /documents/:id（限自己文件）
- [N/T] Reviewer 可存取 /reviews 與 /documents/:id（限有任務關聯文件）
- [N/T] Admin 可存取 /documents、/documents/:id、/admin/flows
- [N/T] Header 導覽依角色顯示（Guest：登入；User：文件/登出；Reviewer：待辦/登出；Admin：文件/流程模板/登出）
- [N/T] 403 Forbidden 對應頁面（User 禁止 /reviews、/admin/flows；Reviewer 禁止 /documents、/admin/flows）
- [N/T] 404 Not Found 用於防止 IDOR 與存在性洩漏（User/Reviewer 無權限的 /documents/:id）

## Pages（Page Inventory）
- [N/T] /login（登入頁）
- [N/T] /documents（文件列表，User/Admin）
- [N/T] /documents/:id（文件詳情，User/Reviewer/Admin 依可見範圍）
- [N/T] /reviews（審核待辦，Reviewer）
- [N/T] /admin/flows（流程模板管理，Admin）

## Core Entity: Document
- [N/T] 建立 Document（初始 status=Draft）
- [N/T] 文件列表顯示（title/status/updated_at）
- [N/T] 文件詳情顯示（title/status/current_version_id）
- [N/T] Draft 狀態的文件內容編輯（title/content）
- [N/T] 送出簽核（Draft → Submitted → In Review）
- [T] 退回後修改（Rejected → Draft）
- [N/T] 核准後只讀（Approved）
- [T] 封存（Approved → Archived，僅 Admin）
- [N/T] 文件可見性隔離（User 只能看 owner_id=自己；Admin 可看全部；Reviewer 只看任務關聯文件）

## Core Entity: DocumentVersion
- [N/T] 版本清單呈現（version_no 遞增）
- [N/T] Draft 版本可更新內容（content）
- [N/T] 送審建立鎖定版本（Draft → Submitted 時建立新的 DocumentVersion）
- [N/T] current_version_id 在各狀態下的指向規則（Draft/In Review/Rejected/Approved/Archived）
- [N/T] Rejected → Draft 建立新的 Draft 版本（以被退回版本內容為起點）

## Core Entity: Attachment
- [N/T] Draft 狀態新增附件（綁定 current_version_id）
- [N/T] 附件清單呈現（至少可辨識 filename/content_type/size_bytes）
- [N/T] 非 Draft 狀態禁止新增附件
- [N/T] 附件不可覆蓋替換（不可變性）

## Core Entities: ApprovalFlowTemplate / ApprovalFlowStep
- [N/T] 流程模板列表（含 is_active）
- [N/T] 建立流程模板（含步驟順序設定）
- [N/T] 編輯流程模板（步驟順序、mode、指派規則）
- [N/T] 停用流程模板（is_active=false）
- [N/T] 送審前置條件檢查：模板必須啟用、至少 1 個步驟、且每個步驟皆有 assignee
- [N/T] Serial / Parallel 兩種 mode 的存在與可配置

## Core Entity: ReviewTask
- [N/T] 送審後建立 ReviewTask（依 Serial/Parallel 與 assignee 規則）
- [N/T] Reviewer 待辦列表只顯示 Pending 任務
- [N/T] Reviewer 只能操作 assignee=自己 且 status=Pending 的任務
- [N/T] ReviewTask 狀態集合存在（Pending/Approved/Rejected/Cancelled）
- [N/T] Serial：僅當前步驟有 Pending 任務
- [N/T] Parallel：同一步驟多筆 Pending 任務需全數 Approved
- [N/T] 退回後其餘 Pending 任務自動 Cancelled
- [N/T] 同一任務只能被處理一次（防重複處理）

## Core Entity: ApprovalRecord（Append-only）
- [N/T] 同意時追加 ApprovalRecord(action=Approved)
- [N/T] 退回時追加 ApprovalRecord(action=Rejected, reason)
- [N/T] ApprovalRecord 在文件詳情可呈現
- [N/T] ApprovalRecord 不可編輯/不可刪除（不可變性）

## Core Entity: AuditLog（Append-only）
- [N/T] 送審寫入 AuditLog（Submit）
- [N/T] 建立任務與進入 In Review 寫入 AuditLog（CreateReviewTasks / EnterInReview）
- [N/T] 退回寫入 AuditLog（RejectDocument / CancelOtherTasks）
- [N/T] Rejected → Draft 寫入 AuditLog（ReopenAsDraft）
- [T] 封存寫入 AuditLog（ArchiveDocument）
- [N/T] AuditLog 在文件詳情可呈現並可追溯 who/when/what
- [N/T] AuditLog 不可編輯/不可刪除（不可變性）

## Business State Machine: Document Status
- [N/T] 狀態集合存在（Draft/Submitted/In Review/Rejected/Approved/Archived）
- [N/T] 合法狀態轉換集合存在（Draft→Submitted、Submitted→In Review、In Review→Rejected、In Review→Approved、Rejected→Draft、Approved→Archived）
- [N/T] 非法狀態轉換拒絕（HTTP 400）
- [N/T] 寫入型操作同時驗證角色/存取權限/當前狀態/前置條件

## Consistency / Security / Concurrency
- [N/T] /documents 列表與 /documents/:id 的 status/updated_at/current_version_id 一致性
- [N/T] 文件詳情中版本/附件/ReviewTask/ApprovalRecord/AuditLog 與同一份文件與正確版本一致
- [N/T] 防止 IDOR（他人文件不可被讀取/操作）
- [N] 狀態改變時前後端狀態一致 (登入頁面沒有跳轉)
