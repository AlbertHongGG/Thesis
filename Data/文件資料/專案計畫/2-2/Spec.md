# 任務 Spec：SmartBooking 預約型服務平台
Online Appointment & Service Scheduling System

---

## 1. 產品目標（Product Goal）
- 系統要解決的核心問題：
  - 提供服務提供者（Provider）與消費者（User）之間的線上預約管理機制。
  - 解決人工排程衝突、時段名額無法即時同步、取消規則不清楚造成的糾紛。
  - 建立可追溯的預約狀態流轉，避免人工改單造成資料不一致。
  - 在高併發搶位情境下，仍能保證名額不會超賣（booked_count 不可超過 capacity）。
- 使用者在系統中要完成的關鍵行為：
  - Guest：瀏覽服務與可預約時段、進入註冊/登入流程、發起忘記密碼。
  - User：建立預約、查看/取消自己的預約、查看歷史紀錄。
  - Provider：管理自己的服務、管理時段與名額、查看預約名單、更新服務履約結果。
  - Admin：管理全站帳號狀態、管理服務可用狀態、檢視全站報表。
- 系統必備能力：
  - Email + Password 認證、JWT Session 驗證、登出流程、忘記密碼流程。
  - 角色權限控管（RBAC）：Guest / User / Provider / Admin。
  - 預約狀態機（PENDING → CONFIRMED → COMPLETED；PENDING/CONFIRMED → CANCELLED）。
  - 即時名額計算與交易一致性控制（建立/取消預約時需原子更新 booked_count）。
  - 取消截止時間規則判定（超過截止不可取消）。
  - 後台管理與稽核可追溯性（關鍵操作需保留審計紀錄）。
  - 資料隔離與防越權：使用者只能操作自己的 Booking；Provider 只能操作自己名下 Service/TimeSlot/Booking；Admin 才能跨全站管理。

---

## 2. 使用者角色定義（Roles）

### 2.1 訪客（Guest）
- 權限：
  - 可瀏覽公開服務清單與服務詳情。
  - 可查看公開可預約時段（僅可讀取）。
- 可執行行為：
  - 註冊帳號。
  - 登入帳號。
  - 發起忘記密碼流程。
- 限制：
  - 不可建立預約。
  - 不可查看個人預約紀錄。
  - 不可進入 Provider 控制台與 Admin 後台。

### 2.2 會員（User）
- 權限：
  - 可建立、查看、取消自己的預約。
  - 可查看自己的預約歷史（含已取消/已完成）。
- 可執行行為：
  - 在服務詳情頁選擇時段並送出預約。
  - 於取消截止時間前取消預約。
  - 在「我的預約」查詢各狀態預約。
- 限制：
  - 不可管理其他會員資料。
  - 不可建立或編輯服務與時段。
  - 不可存取 Admin 後台。

### 2.3 服務提供者（Provider）
- 權限：
  - 僅能管理自己建立的服務與其時段（provider_id 必須等於自己）。
  - 可查看自己服務的預約名單。
  - 可更新預約履約結果（完成/取消）。
- 可執行行為：
  - 新增/編輯/停用服務（停用語意，不做硬刪）。
  - 設定可預約時段與名額（capacity）。
  - 關閉時段供給（不做硬刪），避免已存在 Booking 的資料斷裂。
  - 標記服務完成，必要時標記預約取消（例如服務方原因）。
- 限制：
  - 不可管理其他 Provider 的服務。
  - 不可停用帳號。
  - 不可查看全站報表（僅可見自己的營運資訊，若後續有做）。
  - 不可替 User 建立預約（建立預約僅 User 自行發起）。

### 2.4 系統管理員（Admin）
- 權限：
  - 可管理所有帳號狀態。
  - 可管理所有服務狀態。
  - 可查看全站營運報表。
- 可執行行為：
  - 停用違規帳號（ACTIVE → SUSPENDED）。
  - 啟用/停用服務（ACTIVE/INACTIVE）。
  - 檢視全站預約與使用概況統計。
- 限制：
  - 不可刪除系統核心資料（僅可停用，不做硬刪）。

> 角色互斥規則：一般帳號不可同時為 User 與 Provider；註冊時需明確選擇身份。Admin 為系統授權角色，不由一般註冊流程取得。

---

## 3. 使用者流程（User Flow）

### 3.1 User 流程
1. 使用者註冊為 User 並登入。
2. 進入服務列表頁瀏覽可用服務。
3. 進入服務詳情頁查看時段、名額與取消截止規則。
4. 選擇可用時段並提交預約。
5. 系統檢查：JWT 身分、時段是否可預約、名額是否足夠、是否已過可預約邊界、使用者是否已對該時段建立過預約（避免重複）。
6. 交易建立預約成功，回傳 Booking 狀態（預設 PENDING；是否自動轉 CONFIRMED 由系統商業規則決定，但不得跳過合法轉移）。
7. User 在「我的預約」查看預約結果與狀態。
8. 如需取消，於取消截止時間前執行取消；系統原子釋放名額並記錄 cancelled_at。
9. User 登出；登出後再次進入受保護頁需重新登入。

### 3.2 Provider 流程
1. 註冊為 Provider 並登入。
2. 進入 Provider 控制台建立服務。
3. 為服務建立可預約時段並設定 capacity 與取消截止時間。
4. 查看每個時段的預約名單。
5. 依服務履行結果更新 Booking 狀態（例如標記 COMPLETED）。
6. 必要時：
   - 調整服務狀態（ACTIVE/INACTIVE）。
   - 關閉時段（不再開放新預約）。
7. Provider 登出。

### 3.3 Admin 流程
1. Admin 登入後台。
2. 查看會員列表與服務列表。
3. 停用違規帳號（ACTIVE → SUSPENDED）。
4. 調整服務狀態（ACTIVE/INACTIVE）。
5. 查看全站報表（預約量、取消率、服務活躍度）。
6. Admin 登出。

### 3.4 認證與找回密碼流程
1. Guest 於登入頁輸入 Email + Password。
2. 驗證成功取得 JWT 並導向對應角色首頁。
3. 驗證失敗顯示錯誤訊息並留在登入頁。
4. 若忘記密碼，於登入頁發起忘記密碼流程並提交 Email。
5. 系統寄送重設連結（一次性、有效期限）。
6. 使用者透過重設連結進入登入頁的「重設密碼模式」（同一路由 `/login`，以重設 token 進入表單），完成新密碼設定。
7. 重設成功後返回登入頁一般模式並重新登入。

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證
- Email + Password 註冊與登入：
  - 註冊時必須選擇身份為 User 或 Provider。
  - email 必須唯一。
  - 密碼只儲存雜湊（password_hash）。
- JWT 驗證：
  - Access Token 驗證受保護 API 與受保護頁面資料請求。
  - Token 必須驗簽與過期檢查。
  - 未授權請求回應 401。
  - 已登入但權限不足回應 403。
- 登出：
  - 使用者可在 Header 點擊登出。
  - 登出後，本機不得再視為已登入狀態；再次進入受保護路由需重新登入。
- 忘記密碼流程：
  - 提交 Email 產生 PasswordResetToken（token_hash）並寄送一次性連結。
  - 重設連結必須有有效期限（expires_at），且只能使用一次（used_at）。
  - 使用者提交新密碼後更新 password_hash，並將該 token 標記 used_at。
- 帳號狀態約束：
  - status = SUSPENDED：
    - 不可登入（登入必須拒絕）。
    - 不可建立預約。
    - 若已登入且狀態變更為 SUSPENDED，後續受保護請求應視為不可用並導向未授權處理。

### 4.2 核心資料管理（CRUD）
- Service CRUD（Provider）：
  - 建立服務（name、description、duration_minutes）。
  - 更新服務描述/時長/名稱。
  - 停用服務（ACTIVE → INACTIVE），停用後不得再提供新預約，但既有 Booking 必須可查。
  - 僅能操作 provider_id = 自己的服務。
- TimeSlot CRUD（Provider）：
  - 建立時段（start_time、end_time、capacity、cancel_deadline_at）。
  - 更新時段（時間範圍、capacity、cancel_deadline_at），但不得造成已存在 Booking 的資料不一致；若調降 capacity 小於 booked_count，必須拒絕更新。
  - 關閉時段（OPEN → CLOSED），關閉後不得建立新 Booking。
  - booked_count 由系統計算與交易更新，不可手動任意覆寫。
  - 同一 Service 的 TimeSlot 不可時間重疊（避免排程衝突）。
- Booking CRUD（User）：
  - 建立預約：User 選擇 timeslot 提交。
  - 查詢自己的預約：依狀態呈現（PENDING/CONFIRMED/CANCELLED/COMPLETED）。
  - 取消自己的預約：符合取消截止時間規則才可取消。
  - 禁止跨使用者存取他人 Booking（防止 IDOR）。
  - 同一 User 對同一 TimeSlot 只能有一筆有效 Booking（不允許重複建立）。
- User 管理（Admin）：
  - 查詢帳號清單。
  - 帳號狀態停用/啟用（ACTIVE/SUSPENDED）。
- Service 管理（Admin）：
  - 查詢服務清單。
  - 啟用/停用服務（ACTIVE/INACTIVE）。
- 稽核（AuditLog）：
  - 必須記錄關鍵操作：
    - Admin：帳號停用/啟用、服務啟用/停用。
    - Provider：服務建立/更新/停用、時段建立/更新/關閉、更新 Booking 狀態（完成/取消）。
    - User：建立 Booking、取消 Booking。
  - AuditLog 必須可追溯：actor_user_id、action、target_type、target_id、before_data/after_data、created_at。

### 4.3 狀態機 / 規則 / 限制
- Booking 狀態 enum：
  - PENDING → CONFIRMED → COMPLETED
  - PENDING → CANCELLED
  - CONFIRMED → CANCELLED
- 非法轉移必須拒絕：
  - COMPLETED 不可再取消。
  - CANCELLED 不可回復為 PENDING/CONFIRMED。
- 取消規則：
  - 取消截止時間以 TimeSlot.cancel_deadline_at 判定。
  - current_time > cancel_deadline_at：不可取消。
- 名額規則：
  - booked_count >= capacity：不可建立預約。
  - 若 TimeSlot.status = CLOSED 或其對應 Service.status = INACTIVE：不可建立預約。
- 交易一致性：
  - 建立預約：Booking 新增與 TimeSlot.booked_count +1 必須同交易完成。
  - 取消預約：Booking 狀態更新為 CANCELLED 與 TimeSlot.booked_count -1 必須同交易完成。
- 冪等性：
  - 重複取消同一筆已取消預約：
    - 必須回傳可辨識錯誤（不可再次扣減 booked_count）。
  - 建立預約的重複送出：
    - 若同一 user_id + timeslot_id 已有有效 Booking，必須拒絕重複建立。
- 併發控制：
  - 同一 TimeSlot 高併發搶位時，系統必須使用資料庫交易與鎖定/樂觀並發策略，確保 booked_count 不會超過 capacity。

### 4.4 主要頁面需求

#### 頁面清單（Page Inventory）
- 首頁 `/`
  - 用途：公開入口、導向服務瀏覽與登入註冊。
- 服務列表頁 `/services`
  - 用途：瀏覽可用服務、進入詳情。
- 服務詳情頁 `/services/:id`
  - 用途：查看服務內容、時段與名額；User 可預約。
- 我的預約 `/my-bookings`
  - 用途：User 查看與取消自己的預約。
- Provider 控制台 `/provider/dashboard`
  - 用途：Provider 管理服務、時段、預約名單。
- Admin 後台 `/admin`
  - 用途：Admin 管理帳號/服務與查看報表。
- 登入頁 `/login`
  - 用途：帳號登入、導向忘記密碼與重設密碼模式。
- 註冊頁 `/register`
  - 用途：建立 User 或 Provider 帳號。
- 401 頁 `/401`
  - 用途：未授權（未登入或 Token 無效）。
- 403 頁 `/403`
  - 用途：已登入但權限不足。
- 404 頁 `/404`
  - 用途：路由或資源不存在。
- 500 頁 `/500`
  - 用途：系統例外統一呈現。

#### 各頁面責任（Page Responsibilities）
- `/`
  - 顯示產品價值與導覽入口。
  - 提供「前往服務列表」主要 CTA。
- `/services`
  - 顯示服務卡片清單（名稱、時長、狀態摘要）。
  - 提供進入 `/services/:id` CTA。
- `/services/:id`
  - 顯示服務詳情、時段清單、剩餘名額（capacity - booked_count）與 cancel_deadline_at。
  - User 顯示預約 CTA；Guest 顯示登入引導；Provider/Admin 以只讀方式瀏覽（不得顯示預約 CTA）。
- `/my-bookings`
  - 依狀態呈現預約（PENDING/CONFIRMED/CANCELLED/COMPLETED）。
  - 提供可取消項目的取消 CTA。
- `/provider/dashboard`
  - 管理服務與時段（新增/編輯/停用/關閉）。
  - 檢視預約名單與更新履約狀態（COMPLETED/CANCELLED）。
- `/admin`
  - 帳號管理與服務狀態管理。
  - 顯示全站報表摘要（預約量、取消率、服務活躍度）。
- `/login`、`/register`
  - 處理身份取得流程與錯誤提示。
- `/401`、`/403`、`/404`、`/500`
  - 提供可返回頁面與可理解的錯誤訊息。

#### 主要 CTA 與互動（Primary CTAs / Interactions）
- `/`：前往服務列表、登入、註冊。
- `/services`：查看服務詳情。
- `/services/:id`：
  - User：立即預約。
  - Guest：前往登入。
- `/my-bookings`：取消預約。
- `/provider/dashboard`：新增服務、編輯服務、設定時段、關閉時段、標記完成、標記取消。
- `/admin`：停用帳號、調整服務狀態、切換報表區塊。
- `/login`：登入、前往註冊、忘記密碼、重設密碼。
- `/register`：註冊、前往登入。

#### Page-level 狀態（Loading / Error / Empty）
- `/services`
  - Loading：載入服務清單中。
  - Empty：無可用服務。
  - Error：清單讀取失敗。
- `/services/:id`
  - Loading：載入服務與時段。
  - Empty：該服務無可預約時段。
  - Error：服務不存在或讀取失敗。
- `/my-bookings`
  - Loading：載入我的預約。
  - Empty：目前無任何預約紀錄。
  - Error：讀取失敗或權限失效。
- `/provider/dashboard`
  - Loading：載入管理資料。
  - Empty：尚未建立任何服務。
  - Error：資料讀取失敗。
- `/admin`
  - Loading：載入帳號/服務/報表資料。
  - Empty：對應分頁無資料。
  - Error：後台資料讀取失敗。

#### 4.4.1 資訊架構與導覽

##### 路由存取控制（Route Access Control）
- `/`：Guest / User / Provider / Admin 可進入。
- `/services`：Guest / User / Provider / Admin 可進入。
- `/services/:id`：Guest / User / Provider / Admin 可進入。
- `/my-bookings`：僅 User。
  - 未登入：導向 `/login`（並保留 returnTo = `/my-bookings`）。
  - 非 User：導向 `/403`。
- `/provider/dashboard`：僅 Provider。
  - 未登入：導向 `/login`（並保留 returnTo = `/provider/dashboard`）。
  - 非 Provider：導向 `/403`。
- `/admin`：僅 Admin。
  - 未登入：導向 `/login`（並保留 returnTo = `/admin`）。
  - 非 Admin：導向 `/403`。
- `/login`、`/register`：Guest 可進入；已登入角色進入時導向其角色首頁。
- 任意不存在路由：導向 `/404`。
- 系統例外：導向 `/500`。

##### 導覽列 / Header 可見性規則（Navigation Visibility Rules）
- 未登入（Guest）：顯示「服務列表」「登入」「註冊」。
- User：顯示「服務列表」「我的預約」「登出」。
- Provider：顯示「服務列表」「Provider 控制台」「登出」。
- Admin：顯示「Admin 後台」「登出」。
- 禁止規則：
  - Header 不可顯示不屬於該角色的頁面入口。
  - 不允許「顯示後再點擊導登入」取代角色可見性控制。

##### 全站共用版面責任（Layout Responsibility）
- Header 負責全站主導覽、登入/登出入口。
- 頁面內容區負責該頁主操作（例如預約、取消、服務管理）。
- CTA 去重規則：
  - 若 Header 已提供「登入」入口，首頁內容區不重複放同功能主按鈕（可保留文字引導）。
  - 同一動作在同頁僅保留一個主要 CTA，避免重複觸發。

---

## 5. 非功能需求（Non-functional Requirements）
- 響應式設計（RWD）：支援手機與桌面。
- 效能：主要 API 平均回應時間 < 500ms（排除外部依賴異常情況）。
- 一致性：所有關鍵操作（建立/取消預約、狀態流轉）需使用 transaction。
- 錯誤處理：
  - 401：未登入或 Token 無效。
  - 403：權限不足。
  - 404：資源不存在。
  - 500：伺服器例外。
- 安全：
  - 密碼以不可逆雜湊儲存。
  - JWT 需驗簽與過期檢查。
  - 輸入資料需驗證與輸出轉義，防止 XSS。
- 併發控制：
  - 同一時段高併發搶位時，booked_count 不可超賣。
- 稽核：
  - 關鍵管理操作（帳號停用、服務狀態變更、預約狀態更新）需有審計紀錄。
- UI 一致性：
  - Loading / Error / Empty 呈現風格一致。
  - 全站不得重複顯示同一 CTA。

---

## 6. 資料模型（Data Model）

### User
- id (UUID)
- email (string, unique)
- password_hash (string)
- role (enum: USER / PROVIDER / ADMIN)
- status (enum: ACTIVE / SUSPENDED)
- created_at (datetime)

### Service
- id (UUID)
- provider_id (FK -> User.id)
- name (string)
- description (text)
- duration_minutes (int)
- status (enum: ACTIVE / INACTIVE)
- created_at (datetime)

### TimeSlot
- id (UUID)
- service_id (FK -> Service.id)
- start_time (datetime)
- end_time (datetime)
- capacity (int)
- booked_count (int)
- status (enum: OPEN / CLOSED)
- cancel_deadline_at (datetime)

### Booking
- id (UUID)
- user_id (FK -> User.id)
- timeslot_id (FK -> TimeSlot.id)
- status (enum: PENDING / CONFIRMED / CANCELLED / COMPLETED)
- created_at (datetime)
- cancelled_at (datetime, nullable)
- completed_at (datetime, nullable)

### PasswordResetToken
- id (UUID)
- user_id (FK -> User.id)
- token_hash (string)
- expires_at (datetime)
- used_at (datetime, nullable)
- created_at (datetime)

### AuditLog
- id (UUID)
- actor_user_id (FK -> User.id)
- action (string)
- target_type (string)
- target_id (UUID)
- before_data (json, nullable)
- after_data (json, nullable)
- created_at (datetime)

### 關聯
- User 1:N Service
- Service 1:N TimeSlot
- User 1:N Booking
- TimeSlot 1:N Booking
- User 1:N PasswordResetToken
- User 1:N AuditLog
