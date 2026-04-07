# 功能覆蓋確認表（Feature Coverage Checklist）
多角色論壇／社群平台（Multi-Role Forum & Community Platform）

## Authentication / Session
- [N/T] 註冊功能（`/register`）
- [N/T] 登入功能（Email + 密碼）
- [N/T] 登出功能（清除 session）
- [N/T] Session 維持與過期處理
- [N/T] returnTo 回跳機制（登入後返回原頁）
- [N/T] 停權帳號登入拒絕（is_banned）

## RBAC / 存取控制
- [N/T] 角色模型存在（Guest / User / Moderator / Admin）
- [N/T] Moderator 看板範圍（board scope）指派機制
- [N] `/threads/new` 路由存取控制
- [N/T] `/admin` 路由存取控制
- [N/T] hidden 內容可見性控制（Guest/User 不可見）
- [N/T] locked 主題操作限制（不可回覆、User 不可編輯主題）
- [N/T] 停用看板互動禁用規則（Like/Favorite/Reply/Report/New Thread）
- [N/T] 跨帳號資料隔離（不可操作他人內容）

## 核心實體與資料能力（Core Entities / CRUD）

### User
- [N/T] 帳號建立能力（註冊）
- [N/T] 帳號停權/解鎖能力（Admin）
- [N/T] 帳號角色與權限解析能力

### Board
- [N/T] 看板列表與瀏覽能力
- [N/T] 看板建立能力（Admin）
- [N/T] 看板編輯能力（Admin）
- [N/T] 看板停用/啟用能力（Admin）
- [N/T] 看板排序能力（sort_order）

### ModeratorAssignment
- [N/T] Moderator 指派能力（依看板）
- [N/T] Moderator 移除能力（依看板）

### Thread
- [N/T] 主題建立能力（含 board_id）
- [N/T] 主題草稿儲存能力（draft）
- [N/T] 主題發布能力（published）
- [N/T] 主題內容編輯能力（符合狀態規則）
- [ ] 主題刪除能力（僅 draft）
- [N/T] 主題列表瀏覽能力（看板頁）
- [N/T] 主題詳情瀏覽能力（主題頁）
- [N] 主題置頂切換能力（is_pinned）
- [N] 主題精華切換能力（is_featured）

### Post
- [N/T] 回覆新增能力
- [N/T] 回覆編輯能力（僅作者）
- [N/T] 回覆可見/隱藏狀態呈現能力
- [N] 回覆 lazy load 顯示能力

### Report
- [N/T] 檢舉建立能力（thread/post）
- [N/T] 檢舉唯一約束能力（同人同 target 不重複）
- [N/T] 檢舉受理能力（accepted）
- [N/T] 檢舉駁回能力（rejected）
- [N/T] 檢舉處理人與時間記錄能力（resolved_by/resolved_at）

### Like
- [N/T] Thread Like/Unlike 能力
- [N/T] Post Like/Unlike 能力
- [N/T] 一人一讚唯一約束能力

### Favorite
- [N/T] Thread Favorite/Unfavorite 能力
- [N/T] 一人一收藏唯一約束能力

### AuditLog
- [N/T] 敏感操作稽核記錄能力
- [N/T] 治理操作稽核記錄能力
- [N/T] 檢舉處理稽核記錄能力

## 商業狀態機（Business State Machine）
- [N/T] Thread 狀態集合存在（draft / published / hidden / locked）
- [N/T] Post 狀態集合存在（visible / hidden）
- [N/T] Report 狀態集合存在（pending / accepted / rejected）
- [N/T] Thread 合法轉換：draft -> published
- [N/T] Thread 合法轉換：published -> hidden
- [N/T] Thread 合法轉換：hidden -> published
- [N/T] Thread 合法轉換：published -> locked
- [N/T] Thread 合法轉換：locked -> published
- [ ] Thread 非法轉換拒絕能力（未定義轉換回應 400）

## 治理與不可變追溯（Governance / Immutability）
- [N/T] 看板內治理面板能力（Moderator/Admin）
- [N]/T Thread hide/restore 治理能力
- [N/T] Thread lock/unlock 治理能力
- [N/T] Post hide/restore 治理能力
- [N/T] 檢舉處理流程能力（pending -> accepted/rejected）
- [N/T] 治理結果與內容可見性同步能力
- [N/T] 稽核事件可追溯能力（who/when/what）

## 管理後台（Admin / Operations）
- [N/T] `/admin` 後台頁存在
- [N/T] 看板管理區塊存在（建立/編輯/停用/排序）
- [N/T] Moderator 指派管理區塊存在
- [N/T] 使用者停權/解鎖區塊存在
- [T] 全站檢舉檢視區塊存在
- [N/T] Audit Log 檢視區塊存在
- [ ] 系統設定擴充區塊存在

## 頁面與路由覆蓋（Page Inventory）
- [N/T] 首頁 `/`（看板列表）
- [N/T] 搜尋頁 `/search`
- [N/T] 看板頁 `/boards/:id`
- [N/T] 主題頁 `/threads/:id`
- [N] 新增主題頁 `/threads/new`
- [N/T] 登入頁 `/login`
- [N/T] 註冊頁 `/register`
- [N/T] 後台頁 `/admin`



## 一致性 / 安全 / 可靠性（Non-functional Coverage）
- [N/T] 列表與詳情資料一致性機制
- [N/T] 互動狀態前後端一致性機制（optimistic + 最終一致）
- [N/T] RBAC 後端強制驗證機制
- [N/T] board scope 驗證機制
- [N/T] CSRF 防護機制（cookie session）
- [N/T] IDOR 防護機制
- [N/T] 分頁（20/頁）機制
- [N/T] 搜尋索引或等效查詢效能機制
- [N/T] 重整後狀態復原機制（以後端資料為準）