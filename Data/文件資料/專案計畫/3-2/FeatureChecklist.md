# 功能覆蓋確認表（Feature Coverage Checklist）
企業級專案管理系統（Jira Lite）

---

## Authentication / Session
- [N/T] Email + Password 登入
- [N/T] HttpOnly Cookie（或等效）Session 維持登入狀態
- [N/T] 登出（清除 Session）
- [N/T] 未登入存取受保護路由的 401 處理（導向 /login 並保留 returnUrl）
- [N/T] Accept Invite（/invite/:token）token 驗證（有效期限/一次性/綁定 Organization）
- [N/T] Accept Invite 後加入 OrganizationMembership（建立或綁定既有 User）

## RBAC / Access Control（Platform / Organization / Project）
- [N/T] Platform Admin 權限（管理 Organization、查看平台 Audit Log）
- [N/T] Organization 角色（Org Admin / Org Member）權限隔離
- [N/T] Project 角色（Project Manager / Developer / Viewer）權限隔離
- [N/T] 角色不可跨 scope 推導（Platform/Org/Project 互不自動賦權）
- [N/T] Route Access Control（/platform/*、/orgs/:orgId*、/projects/:projectId*）
- [N/T] Navigation Visibility Rules（不該出現的導覽項不顯示）
- [N/T] 存在性策略（非 org/project 成員存取資源回 404）

## Multi-Tenant Data Isolation
- [N/T] 全部資料具備 organization_id（或等效 tenant key）
- [N/T] Cross-Organization 隔離（防 IDOR：不可用猜測 ID/Key 取得他組織資料）

## Organization（組織）
- [N/T] Platform Admin 建立 Organization（plan 預設 free、status 預設 active）
- [N/T] Platform Admin 變更 Organization plan（free/paid）
- [N/T] Platform Admin 設定 Organization status（active/suspended）
- [ ] Org Admin 編輯 Organization 基本資訊（不可變更 plan）
- [N/T] Organization suspended 的唯讀規則（寫入拒絕 + ORG_SUSPENDED；讀取可用）

## Organization Membership / Invite
- [N/T] Org Admin 寄送 OrganizationInvite（Email Invite）
- [N/T] Invite token 一次性（accepted_at 後不可再用）
- [N/T] 邀請加入後成為 OrganizationMembership
- [T] Org Admin 管理成員（啟用/停用/移除）

## Project（專案）
- [N/T] Org Admin 建立 Project（scrum/kanban）
- [N/T] Project.key 在 Organization 內唯一
- [T] Org Admin 將 Organization 成員加入 Project 並指派 ProjectMembership.project_role
- [N/T] Project archived 不可逆（不可恢復 active）
- [N/T] Project archived 後所有 Issue 寫入禁止（PROJECT_ARCHIVED）

## Issue（核心 Domain）
- [N/T] Issue Types（story/task/bug/epic）
- [N/T] Issue 欄位（title/description/priority/status/assignee/reporter/labels/due date/estimate）
- [N/T] Issue Key（例如 PROJ-123）生成與一致顯示
- [N/T] Issue 列表排序（created_at/updated_at）
- [N/T] Issue 建立
- [N/T] Issue 編輯（依角色與專案規則）
- [N/T] Issue 狀態轉換（依 Workflow 合法 Transition）
- [N/T] 非法狀態轉換拒絕（後端校驗）

## Workflow（可設定）
- [N/T] Project 擁有 Workflow（Status 集合 + Transition 集合）
- [T] Project Manager 編輯 Workflow（版本化與立即生效）
- [N/T] Issue 處於已不存在 Status 的一致策略（可顯示、禁止轉換、提示）

## Epic 關聯
- [T] Epic 與 Issue 的關聯新增
- [T] Epic 與 Issue 的關聯移除
- [T] Epic 關聯不改寫子 Issue 狀態

## Issue Comment
- [N/T] IssueComment 新增（Developer/Project Manager）
- [N/T] Viewer 不可留言
- [N/T] Project archived / Organization suspended 時留言禁止

## Scrum（Sprint）
- [N/T] Sprint（planned/active/closed）
- [N/T] Project Manager 建立 Sprint
- [N/T] Project Manager 啟動 Sprint
- [N/T] Project Manager 結束 Sprint
- [T] Issue 加入/移出 Sprint

## Kanban（Board）
- [N/T] Board 欄位（Columns）對應 Workflow Status
- [N/T] Board 上狀態轉換（僅合法 Transition）
- [T] Viewer 的 Board 唯讀

## Audit Log
- [N/T] 平台層 Audit Log（/platform/audit）
- [N/T] 組織層 Audit Log（/orgs/:orgId/audit）
- [N/T] AuditLog 欄位（actor_email、when、action、entity、before/after）
- [T] 稽核事件覆蓋（issue 建立/欄位變更/狀態轉換/epic link/邀請與成員變更/project archived/org suspended）
- [N/T] Audit Log 不可被一般使用者修改/刪除

## Pages（Page Inventory 覆蓋）
- [N/T] /login
- [N/T] /invite/:token
- [N/T] /orgs
- [T] /orgs/:orgId
- [N/T] /orgs/:orgId/members
- [N/T] /orgs/:orgId/projects
- [N/T] /platform/orgs
- [N/T] /audit
- [N/T] /projects/:projectId/board
- [N/T] /projects/:projectId/backlog（Scrum only）
- [N/T] /projects/:projectId/sprints（Scrum only）
- [T] /projects/:projectId/issues
- [N/T] /projects/:projectId/issues/:issueKey
- [N/T] /projects/:projectId/settings

## Security / Consistency
- [N/T] XSS 防護（Issue title/description/comment 轉義/清理）
- [N/T] CSRF 防護（cookie session 情境）
- [N/T] 伺服端校驗（Issue 狀態轉換不得只靠前端）
- [N/T] 並發更新策略（optimistic concurrency；衝突回 409 + CONFLICT）
