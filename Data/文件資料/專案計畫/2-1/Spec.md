# 任務 Spec：線上課程平台（非影音串流）
Online Course Platform – Content-based, No Video Streaming

---

## 1. 產品目標（Product Goal）
- 建立一個提供「文字 / 圖片 / 檔案（PDF）型課程內容」的線上課程平台（不提供影音串流）。
- 讓學員可以瀏覽、購買課程並在購買後永久存取課程內容。
- 讓教師可以建立課程、編排章節/單元、設定價格並提交審核；課程核准後可上架並持續維護內容。
- 讓管理員可以審核課程、管理使用者、管理課程分類與標籤，並查看平台統計。
- 系統必備能力：
  - Email + 密碼登入（含註冊/登出）。
  - 角色權限（RBAC）與路由存取控制（Route Guard）。
  - 課程生命週期狀態機（draft/submitted/published/rejected/archived）與合法轉換限制。
  - 購買後存取控制：未購買者不可存取課程內容；作者/購買者/管理員的存取邊界清楚。
  - 後台審核流程：核准/駁回必填理由並留存紀錄。

---

## 2. 使用者角色定義（Roles）

### 2.1 學員（Student）
- 權限
  - 註冊 / 登入 / 登出。
  - 瀏覽課程列表與課程詳情（可見行銷資訊）。
  - 購買課程。
  - 存取「已購買課程」的章節/單元內容。
  - 查看「我的課程」與課程進度（完成單元數）。
- 限制
  - 未購買課程不可存取單元內容。
  - 不可建立/編輯/提交審核課程。

### 2.2 教師（Instructor）
- 權限
  - 具備 Student 所有權限。
  - 建立課程（草稿）、編輯課程基本資訊與價格。
  - 管理課程章節與單元（文字/圖片/PDF 附件）。
  - 提交課程審核。
  - 課程上架後維護內容（允許更新章節/單元）。
  - 課程上下架（archived/published 的切換）—限於自己的課程。
- 限制
  - 不可審核他人課程。
  - 不可管理全站分類/標籤/使用者。

### 2.3 管理員（Admin）
- 權限
  - 擁有所有權限。
  - 審核課程（核准 / 駁回）。
  - 可強制存取任何課程內容（即使未購買）。
  - 管理使用者（檢視、停用/啟用、設定主要角色）。
  - 管理課程分類與標籤。
  - 查看平台統計。
- 限制
  - 無。

> 角色互斥規則：一個帳號只能有一種主要角色（student / instructor / admin），由系統設定（可由管理員在後台調整）。

---

## 3. 使用者流程（User Flow）

### 3.1 學員（Student）流程
1. 瀏覽課程列表。
2. 查看課程詳情（包含：描述、分類、價格、封面、狀態、章節/單元大綱；未購買者僅可看到章節/單元標題，不可看到內容）。
3. 購買課程（完成後取得永久存取權）。
4. 進入「我的課程」，看到已購買課程清單。
5. 進入課程閱讀頁，依章節閱讀單元內容並標記完成，更新進度（完成單元數）。

### 3.2 教師（Instructor）流程
1. 建立課程（draft）。
2. 新增章節與單元，編排順序，填入內容（文字/圖片/PDF）。
3. 設定課程價格與封面圖片、分類/標籤等基本資訊。
4. 提交審核（draft → submitted）。
5. 課程上架後（published）維護內容；必要時下架（archived）或再次上架。

### 3.3 管理員（Admin）流程
1. 查看待審課程（submitted）。
2. 核准 / 駁回課程（駁回需填理由）。
3. 管理分類與標籤（建立/編輯/停用）。
4. 監控平台課程狀態與統計。

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證（Email + Password）
- 註冊
  - 使用 Email + 密碼註冊。
  - Email 必須唯一。
  - 密碼需符合最小長度要求（例如至少 8 碼；實作可再細化）。
- 登入
  - 使用 Email + 密碼登入。
  - 登入成功後建立 session（或 token-based session）。
- 登出
  - 可主動登出並清除 session。
- Session 失效
  - 若 session 失效，進入受保護頁面需導向登入（或顯示 401 對應 UI）。

### 4.2 角色權限（RBAC）與路由存取控制（Route Access Control）
- RBAC
  - 依角色（student / instructor / admin）限制可執行操作。
  - 後端 API 必須做權限驗證，前端 UI 需同步隱藏不該出現的入口。
- 受保護頁面
  - Student/Instructor：可存取「我的課程」與已購買課程內容。
  - Instructor：可存取教師課程管理相關頁面。
  - Admin：可存取管理後台頁面。
- 未購買課程不可存取內容
  - 未購買者嘗試存取課程閱讀/內容 API 時必須被拒絕（403 或 404，策略需一致；本系統採 403）。

### 4.3 課程（Course）

#### 4.3.1 課程欄位
- 標題（title）
- 描述（description）
- 分類（category）
- 標籤（tags）
- 價格（price）
- 封面圖片（cover image）
- 課程狀態（status）

#### 4.3.2 課程狀態機（State Machine）
狀態 enum：
- draft（草稿）
- submitted（待審）
- published（已上架）
- rejected（駁回）
- archived（下架）

合法轉換：
- draft → submitted（教師提交審核）
- submitted → published（管理員核准）
- submitted → rejected（管理員駁回，需理由）
- rejected → draft（教師修改後回到草稿，可再次提交）
- published → archived（教師或管理員下架）
- archived → published（教師或管理員重新上架）

非法轉換：
- 非作者不得變更課程狀態（管理員除外）。
- submitted 狀態下，教師不可直接回到 draft（需由駁回或維持待審）；教師若要修改需先撤回的能力未列入本 Spec，因此不提供。

#### 4.3.3 課程可見性規則（Marketing vs Content）
- 課程列表與課程詳情（行銷資訊）
  - 所有人（含未登入）可瀏覽 published 的課程。
  - draft/submitted/rejected/archived 的課程：
    - 作者（instructor）與管理員可瀏覽。
    - 其他人不可瀏覽（404 或 403；本系統採 404 以避免暴露存在性）。
- 課程內容（章節/單元內容）
  - 只有作者、購買者、管理員可存取單元內容。
  - 未購買者：可在課程詳情看到章節/單元「標題」與「順序」，但不可看到內容與附件下載。

### 4.4 章節與單元（Curriculum: Section / Lesson）
- 一門課程包含多個章節（Section）。
- 每個章節包含多個單元（Lesson）。
- 支援排序（order），並可由教師調整順序。
- 單元內容支援三種型態：
  - 文字
  - 圖片
  - 附件（PDF）
- 內容管理權限
  - 只有課程作者（instructor）與管理員可新增/編輯/刪除章節與單元。

### 4.5 課程購買（Purchase）
- Student/Instructor 可購買 published 的課程。
- 購買成功後永久存取（不支援退款）。
- 重複購買
  - 若已購買同一課程，再次購買應被阻擋並提示「已購買」。

### 4.6 存取控制（Access Control）
- 課程內容（課程閱讀頁與相關 API）存取條件：
  - 課程作者（instructor_id）
  - 或已購買者（Purchase 存在）
  - 或管理員（admin）
- 管理員可強制存取任何課程內容，不受購買限制。

### 4.7 我的課程（My Courses）
- 顯示已購買課程清單（含封面、標題、講師、購買日期）。
- 顯示課程進度：完成單元數 / 總單元數。
- 進度計算以「Lesson 完成標記」為準。

### 4.8 管理後台（Admin Panel）
- 課程審核
  - 顯示待審清單（submitted）。
  - 管理員可核准（submitted → published）或駁回（submitted → rejected）。
  - 駁回必填理由；核准可選填備註。
  - 審核動作需留存紀錄（誰、何時、決策、理由）。
- 課程上下架管理
  - 管理員可將 published 課程下架（→ archived），也可將 archived 重新上架（→ published）。
- 分類與標籤管理
  - 管理員可建立/編輯/停用分類。
  - 管理員可建立/編輯/停用標籤。
- 使用者管理
  - 管理員可檢視使用者列表（email、角色、狀態）。
  - 管理員可停用/啟用帳號。
  - 管理員可設定主要角色（student/instructor/admin）。
- 平台統計
  - 至少提供：課程數量（依狀態）、購買數量、使用者數量。

### 4.9 主要頁面需求

#### 4.9.1 資訊架構與導覽（必填）

Page Inventory（頁面清單）：
- 首頁（Home）: `/`
  - 用途：入口導覽與精選課程（可選）
- 登入（Login）: `/login`
- 註冊（Register）: `/register`
- 課程列表（Courses List）: `/courses`
- 課程詳情（Course Detail）: `/courses/:courseId`
- 我的課程（My Courses）: `/my-courses`
- 課程閱讀（Course Reader）: `/my-courses/:courseId`

- 教師課程列表（Instructor Courses）: `/instructor/courses`
- 教師新增課程（New Course）: `/instructor/courses/new`
- 教師編輯課程（Edit Course）: `/instructor/courses/:courseId/edit`
- 教師課綱管理（Curriculum Editor）: `/instructor/courses/:courseId/curriculum`

- 管理員待審清單（Admin Review Queue）: `/admin/review`
- 管理員課程管理（Admin Courses）: `/admin/courses`
- 管理員分類與標籤（Admin Taxonomy）: `/admin/taxonomy`
- 管理員使用者管理（Admin Users）: `/admin/users`
- 管理員統計（Admin Stats）: `/admin/stats`

- 錯誤頁
  - 403（Forbidden）: `/403`
  - 404（Not Found）: `/404`
  - 500（Server Error）: `/500`

Route Access Control（路由存取控制）：
- `/`, `/courses`, `/courses/:courseId`, `/login`, `/register`, `/404`, `/500`：Guest 可進入。
- `/my-courses`, `/my-courses/:courseId`：需登入（Student/Instructor/Admin）。
- `/instructor/*`：僅 Instructor 或 Admin 可進入；否則顯示 403。
- `/admin/*`：僅 Admin 可進入；否則顯示 403。
- 對於「存在但無權限」的資源（例如他人 draft 課程）：
  - 課程詳情：回 404（避免暴露）。
  - 課程內容：回 403（明確拒絕）。

Navigation Visibility Rules（導覽列/Header 規則）：
- Guest
  - 顯示：課程列表、登入、註冊。
  - 不顯示：我的課程、教師入口、管理後台入口。
- Student
  - 顯示：課程列表、我的課程、登出。
  - 不顯示：教師入口、管理後台入口。
- Instructor
  - 顯示：課程列表、我的課程、教師課程管理、登出。
  - 不顯示：管理後台入口。
- Admin
  - 顯示：課程列表、我的課程（可選：作為快速查看）、管理後台入口、登出。

Layout Responsibility（共用版面責任）：
- Header 僅提供「跨頁導覽入口」；頁面內主要 CTA（例如：購買、提交審核、核准/駁回）必須放在對應頁面主要內容區。
- 同一動作入口不得在 Header 與頁面內重複出現（例如 Header 已有登入/登出，頁面內不再額外放第二顆登入/登出按鈕）。

#### 4.9.2 Page Responsibilities（每頁責任）
- 課程列表 `/courses`
  - 顯示 published 課程清單（封面、標題、價格、分類）。
  - 支援基本搜尋/篩選（依分類/標籤；若未實作則僅顯示分類/標籤資訊，不提供篩選 UI）。
- 課程詳情 `/courses/:courseId`
  - 顯示課程描述、價格、講師、分類/標籤、章節/單元大綱。
  - 若未購買：顯示「購買」CTA；內容區顯示鎖定提示。
  - 若已購買/作者/管理員：顯示進入閱讀 CTA。
- 我的課程 `/my-courses`
  - 顯示已購買課程清單與進度。
- 課程閱讀 `/my-courses/:courseId`
  - 章節/單元導覽、單元內容顯示（文字/圖片/PDF 下載）。
  - 單元完成標記與進度更新。
- 教師課程管理 `/instructor/courses`
  - 顯示本人課程清單與狀態（draft/submitted/published/rejected/archived）。
  - 入口：建立課程、編輯、課綱管理、提交審核、上下架。
- 管理後台 `/admin/*`
  - 審核清單與審核操作。
  - 課程狀態管理、分類/標籤管理、使用者管理、統計。

#### 4.9.3 Page-level 狀態（Loading / Error / Empty）
- 所有主要頁面必須定義並呈現：
  - Loading：API 請求中，主要操作按鈕需 disable，避免重複送出。
  - Error：顯示可理解的錯誤訊息與重試入口。
  - Empty：空清單/無章節/無單元/無已購買課程等情境要有明確空狀態提示。

---

## 5. 非功能需求（Non-functional Requirements）
- RWD：支援手機/平板/桌機基本可用。
- 表單驗證：
  - 前端即時提示（必填、格式、數值範圍）。
  - 後端二次驗證並回傳可顯示的錯誤訊息。
- 權限錯誤處理：
  - 403：顯示無權限頁面（或對應 UI）。
  - 401：需登入時導向登入或提示重新登入。
  - 404：找不到資源。
- 操作回饋（loading / error）：
  - 提交/購買/審核等操作需有 loading、成功提示、失敗提示。
  - 重要操作需防重送（按鈕 disable + 後端 idempotency/檢查重複）。
- 安全性（最小集合）
  - 避免未授權內容被存取（課程內容與附件下載受保護）。
  - 基本輸入清理：文字內容顯示需避免注入（以安全方式渲染）。

---

## 6. 資料模型（Data Model）

### User
- id: string
- email: string (unique)
- password_hash: string
- role: "student" | "instructor" | "admin"
- is_active: boolean
- created_at: datetime
- updated_at: datetime

### CourseCategory
- id: string
- name: string (unique)
- is_active: boolean
- created_at: datetime
- updated_at: datetime

### Tag
- id: string
- name: string (unique)
- is_active: boolean
- created_at: datetime
- updated_at: datetime

### Course
- id: string
- instructor_id: string (FK -> User.id)
- category_id: string (FK -> CourseCategory.id)
- title: string
- description: string
- price: integer (>= 0)
- cover_image_url: string | null
- status: "draft" | "submitted" | "published" | "rejected" | "archived"
- rejected_reason: string | null
- created_at: datetime
- updated_at: datetime
- published_at: datetime | null
- archived_at: datetime | null

### CourseTag (Join)
- course_id: string (FK -> Course.id)
- tag_id: string (FK -> Tag.id)

### Section
- id: string
- course_id: string (FK -> Course.id)
- title: string
- order: integer
- created_at: datetime
- updated_at: datetime

### Lesson
- id: string
- section_id: string (FK -> Section.id)
- title: string
- order: integer
- content_type: "text" | "image" | "pdf"
- content_text: string | null
- content_image_url: string | null
- content_file_url: string | null
- content_file_name: string | null
- created_at: datetime
- updated_at: datetime

### Purchase
- id: string
- user_id: string (FK -> User.id)
- course_id: string (FK -> Course.id)
- created_at: datetime

### LessonProgress
- id: string
- user_id: string (FK -> User.id)
- lesson_id: string (FK -> Lesson.id)
- is_completed: boolean
- completed_at: datetime | null
- created_at: datetime
- updated_at: datetime

### CourseReview
- id: string
- course_id: string (FK -> Course.id)
- admin_id: string (FK -> User.id)
- decision: "published" | "rejected"
- reason: string | null
- created_at: datetime

---

### 關聯
- User(Instructor) 1:N Course
- Course 1:N Section
- Section 1:N Lesson
- User 1:N Purchase
- Course 1:N Purchase
- Course M:N Tag（透過 CourseTag）
- User 1:N LessonProgress
- Lesson 1:N LessonProgress
- Course 1:N CourseReview
- User(Admin) 1:N CourseReview
