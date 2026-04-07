# 功能覆蓋確認表（Feature Coverage Checklist）

## Authentication / Session
- [N/T] 註冊功能（Visitor 成為 User）
- [N/T] 登入功能（建立有效 session）
- [T] 登出功能（session/token 失效）
- [N/T] 未登入受保護路由導向機制（401 導向 `/login` 並保留返回路徑）
- [N/T] Landing 對已登入使用者導向 `/projects` 的自動判斷

## RBAC / 存取控制
- [N/T] 系統層級角色區分（Visitor / User）
- [N/T] 專案角色區分（owner / admin / member / viewer）
- [N/T] 專案路由 membership 存取控制（僅成員可進入 `/projects/:projectId/*`）
- [N/T] 專案設定頁 Owner-only 存取控制（`/projects/:projectId/settings`）
- [N/T] 導覽可見性依角色控制（無權限入口不顯示）
- [N/T] 非成員資源拒絕機制（403）
- [N/T] 已登入但資源不存在處理（404）

## Project / Membership / Invitation
- [N/T] 專案建立功能
- [N/T] 專案 visibility 設定功能（private / shared）
- [T] 專案封存功能（status=archived）
- [N/T] 成員邀請功能（ProjectInvitation）
- [N/T] 邀請接受/拒絕功能
- [N/T] 成員角色調整功能
- [N/T] 成員移除功能
- [N/T] 受邀者註冊後接受邀請流程支持

## Board / List 結構管理
- [N/T] Board 建立功能
- [ ] Board 重排功能（order）
- [T] Board 封存功能
- [N/T] List 建立功能
- [T] List 重排功能（order）
- [T] List 封存功能
- [N/T] List WIP 限制設定功能（is_wip_limited / wip_limit）
- [T] 封存 Board/List 後範圍唯讀控制

## Task 核心能力
- [N/T] Task 建立功能
- [N/T] Task 編輯功能（title/description/due_date/priority）
- [N/T] Task 指派功能（assignee_ids 多選）
- [N/T] Task 取消指派功能
- [N/T] Task 拖拉排序功能（List 內重排）
- [N/T] Task 跨 List 移動功能（更新 list_id + position）
- [T] Task 完成功能（status=done）
- [T] Task 封存功能（status=archived）
- [T] archived Task 寫入限制功能（不可編輯/拖拉/指派）

## Task 狀態機與規則
- [T] Task 狀態集合存在（open / in_progress / blocked / done / archived）
- [T] Task 合法轉換規則存在
- [T] done 逆向轉換拒絕規則存在
- [T] archived 終態不可轉換規則存在
- [T] 非法狀態轉換拒絕回應功能（HTTP 400）

## WIP / 協作衝突 / 排序權威
- [N/T] WIP 超限拒絕功能（Member 建立/拖入被拒絕）
- [T] WIP override 功能（Owner/Admin）
- [T] override 事件記錄功能（Activity Log metadata）
- [T] 可編輯實體版本控制功能（Task version）
- [N] 併發編輯衝突回報功能（回傳最新版本）
- [N] 同時拖拉伺服端最終排序裁決功能（最後寫入為準 + 重算 position）
- [N/T] 伺服端權威排序廣播功能

## Comment / Timeline / Immutability
- [N/T] Task 留言新增功能（Owner/Admin/Member）
- [N/T] Viewer 留言限制功能
- [N/T] Comment 即時同步功能
- [N/T] Comment 不可編輯功能
- [N/T] Comment 不可刪除功能
- [N/T] Activity Log 事件時間軸展示功能
- [N/T] ActivityLog append-only 不可變性

## Activity Log / Observability
- [N/T] 關鍵操作寫入 Activity Log 功能（project/membership/invitation/board/list/task/comment）
- [N/T] 拖拉重排事件記錄功能
- [N/T] 角色調整事件記錄功能
- [N/T] 封存事件記錄功能
- [N/T] WIP override 事件記錄功能
- [N/T] Activity Log 專案篩選功能
- [N/T] Activity Log 即時更新功能

## Realtime Sync / Reconnect
- [N/T] Task 狀態即時同步功能
- [N/T] Task 排序即時同步功能
- [N/T] 留言即時同步功能
- [N/T] Activity Log 即時同步功能
- [T] 本地未送出變更重送機制
- [N/T] 重連後本地狀態與伺服端權威狀態對齊功能

## 頁面與導覽覆蓋
- [N/T] 產品介紹頁（`/`）
- [N/T] 註冊頁（`/register`）
- [N/T] 登入頁（`/login`）
- [N/T] 專案列表頁（`/projects`）
- [N/T] 專案總覽/看板頁（`/projects/:projectId/board`）
- [N/T] 任務詳情附屬面板/彈窗（Board 頁內）
- [N/T] 成員管理頁（`/projects/:projectId/members`）
- [T] 專案頁面能導向成員管理頁
- [N/T] 專案設定頁（`/projects/:projectId/settings`）
- [T] 專案頁面能導向專案設定頁
- [N/T] Activity Log 頁（`/projects/:projectId/activity`）
- [T] 專案頁面能導向 Activity Log 頁
- [N/T] 封存檢視頁（`/projects/:projectId/archived`）
- [T] 專案頁面能導向封存檢視頁

## Consistency / Security
- [N/T] 列表與詳情資料一致性機制
- [N/T] 權限變更後 UI 與 API 一致性機制
