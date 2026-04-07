# 功能覆蓋確認表
線上課程平台（非影音串流）

## Authentication / Session
- [N/T] Email + Password 註冊功能
- [N/T] Email 唯一性約束功能
- [N/T] 密碼最小長度驗證功能
- [N/T] Email + Password 登入功能
- [N/T] 登出功能
- [N/T] Session 建立與維持功能
- [N/T] Session 失效處理（401 對應）功能

## RBAC / 存取控制
- [N/T] 角色模型（student / instructor / admin）功能
- [N/T] Guest 導覽可見性規則功能
- [N/T] Student 導覽可見性規則功能
- [N/T] Instructor 導覽可見性規則功能
- [N/T] Admin 導覽可見性規則功能
- [N/T] 路由層存取控制（`/my-courses`）功能
- [N/T] 路由層存取控制（`/instructor/*`）功能
- [N/T] 路由層存取控制（`/admin/*`）功能
- [N/T] 課程詳情可見性策略（非公開課程 404）功能
- [N/T] 課程內容可見性策略（未授權 403）功能

## Course / Curriculum 能力
- [N/T] 課程建立（draft）功能
- [N/T] 課程基本資訊編輯功能（title/description/category/tags/price/cover）
- [N/T] 課程列表瀏覽功能（published）
- [N/T] 課程詳情瀏覽功能（行銷資訊）
- [N/T] 課程章節管理功能
- [N/T] 課程單元管理功能
- [N/T] 章節排序管理功能
- [N] 單元排序管理功能
- [N/T] 單元內容型態（text）功能
- [T] 單元內容型態（image）功能
- [T] 單元內容型態（pdf）功能
- [N/T] 課綱維護功能（Instructor/Admin）

## Purchase / Learning
- [N/T] 已上架課程購買功能
- [T] 重複購買阻擋功能
- [N/T] 我的課程清單功能
- [N/T] 我的課程進度顯示功能
- [N/T] 課程閱讀頁功能
- [N/T] 單元完成標記功能
- [N/T] 完成進度累計功能

## Business State Machine
- [N/T] 課程狀態集合存在（draft/submitted/published/rejected/archived）
- [N/T] 合法轉換：draft -> submitted
- [N/T] 合法轉換：submitted -> published
- [N/T] 合法轉換：submitted -> rejected
- [N/T] 合法轉換：rejected -> draft
- [N/T] 合法轉換：published -> archived
- [N/T] 合法轉換：archived -> published
- [N/T] 非法狀態轉換拒絕（HTTP 400）功能
- [N/T] 駁回理由必填規則功能

## Admin / Operations
- [N/T] 待審課程清單功能（submitted）
- [N/T] 課程核准功能
- [N/T] 課程駁回功能
- [N/T] 課程審核紀錄功能（who/when/decision/reason）
- [N/T] 課程上下架管理功能
- [T] 分類管理功能（新增/編輯/停用）
- [T] 標籤管理功能（新增/編輯/停用）
- [T] 使用者列表管理功能
- [T] 使用者角色調整功能
- [T] 使用者啟用/停用功能
- [T] 平台統計功能（課程狀態數/購買數/使用者數）

## Information Architecture / Pages
- [N/T] 首頁（`/`）存在
- [N/T] 登入頁（`/login`）存在
- [N/T] 註冊頁（`/register`）存在
- [N/T] 課程列表頁（`/courses`）存在
- [N/T] 課程詳情頁（`/courses/:courseId`）存在
- [N/T] 我的課程頁（`/my-courses`）存在
- [N/T] 課程閱讀頁（`/my-courses/:courseId`）存在
- [N/T] 教師課程列表頁（`/instructor/courses`）存在
- [N/T] 教師新增課程頁（`/instructor/courses/new`）存在
- [N/T] 教師編輯課程頁（`/instructor/courses/:courseId/edit`）存在
- [N/T] 教師課綱管理頁（`/instructor/courses/:courseId/curriculum`）存在
- [N/T] 管理員待審頁（`/admin/review`）存在
- [ ] 管理員課程管理頁（`/admin/courses`）存在
- [T] 管理員分類與標籤頁（`/admin/taxonomy`）存在
- [T] 管理員使用者管理頁（`/admin/users`）存在
- [T] 管理員統計頁（`/admin/stats`）存在

## Consistency / Security / Observability
- [N/T] 課程列表與詳情資料一致性機制
- [N/T] 課綱編輯與閱讀內容一致性機制
- [T] 購買狀態與閱讀權限一致性機制
- [N/T] 進度資料一致性機制（LessonProgress -> My Courses）
- [N/T] 審核與管理操作可追蹤紀錄機制
- [N/T] RWD 基本可用性支持
