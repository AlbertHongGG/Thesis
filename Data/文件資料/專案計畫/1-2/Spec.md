# 任務 Spec：公司內部請假系統
Leave Management System

---

## 1. 產品目標（Product Goal）
建立一個供公司內部員工與主管使用的請假管理系統，讓使用者能：

- 員工可建立/送出請假申請、查詢自己的請假紀錄與狀態、在審核前撤回
- 主管可檢視並審核（核准/駁回）所屬部門（或其管理範圍）員工的請假
- 系統可自動計算請假天數、即時計算剩餘假期額度，並避免日期衝突與超額

系統必備能力：

- 使用 Email + 密碼登入（含 session/token 管理）
- 角色權限控管（Employee / Manager）與資料範圍限制（部門/管理關係）
- 請假狀態流程（State Machine）與不可逆審核決策（approved/rejected）
- 日期與天數計算（含起迄日驗證、公司工作日規則）
- 額度扣抵一致性（submitted 預扣、approved 扣除、rejected/cancelled 釋放）
- 基本審核紀錄（時間、審核人、決策、駁回原因）

---

## 2. 使用者角色定義（Roles）

### 2.1 員工（Employee）
- 可建立請假申請（草稿/送出）
- 可查看自己的請假紀錄（清單/詳情/狀態）
- 可查看自己的剩餘假期天數（含預扣/已扣）
- 僅在 submitted 前可編輯（draft 可編輯；submitted 不可編輯）
- 可撤回 submitted 申請成 cancelled（撤回後釋放預扣額度）

限制：
- 不可查看他人請假內容
- 不可對已核准/已駁回狀態做任何變更

### 2.2 主管（Manager）
- 具備所有 Employee 權限（主管本身也會請假）
- 可查看待審核請假清單（僅限其可審核的員工範圍）
- 可對 submitted 申請進行核准/駁回（駁回必填原因）
- 可查看部門請假日曆（避免人力衝突；可顯示 submitted/approved，並以不同樣式標記）

限制：
- 僅能審核「所屬管理範圍」員工的請假（預設為同部門 + direct reports；若公司採用主管鏈，依 User.manager_id 關係判定）
- 已核准/已駁回屬不可逆決策，不可撤銷或改判（若需更正需走新流程：由員工另提新申請或由系統管理者以資料修正方式處理，非本系統一般流程）

---

## 3. 使用者流程（User Flow）

### 3.1 員工（Employee）流程
1. 登入系統
2. 進入「我的請假」列表
3. 新增請假申請 → 先存草稿（draft）或直接送出（submitted）
4. 系統自動計算請假天數與檢查：日期合法/衝突/額度是否足夠/附件需求
5. 送出後於詳情頁查看狀態（submitted / approved / rejected / cancelled）
6. submitted 狀態可撤回（cancelled）
7. 於「剩餘假期」頁查看各假別剩餘（含預扣/已扣）

### 3.2 主管（Manager）流程
1. 登入系統
2. 進入「待審核」清單
3. 開啟請假申請詳情並檢視資訊（假別、日期、天數、原因、附件、員工資訊）
4. 一鍵核准或駁回（駁回需填原因）
5. 系統更新申請狀態、寫入審核紀錄、同步更新額度（預扣→已扣 或 釋放）
6. 進入「部門日曆」檢視部門請假狀況（避免人力衝突）

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與權限
- 使用 Email + 密碼登入
- 使用者需具備部門（Department）屬性
- 系統需根據角色限制操作權限（Employee/Manager）
- 系統需根據資料範圍限制審核權（同部門/管理關係）
- API 需回傳正確錯誤碼：未登入 401、無權限 403、資料不存在 404

### 4.2 假別管理（Leave Type）
系統預設假別：

- 年假
- 病假
- 事假
- 特休

每種假別需設定：

- 年度配額（天）
- 是否可結轉（carry_over）與結轉規則（例如僅可結轉到次年 Q1；若公司未提供則先不啟用 UI，僅保留欄位）
- 是否需附件（例如病假證明）

備註：假別與配額屬公司政策設定，若未提供管理介面則由系統初始化資料（仍需可在 DB 層調整）。

### 4.3 請假申請（Leave Request）
請假欄位：

- 假別
- 開始日期
- 結束日期
- 請假天數（系統自動計算，不可手改）
- 原因（文字）
- 附件（選填，但若該假別 require_attachment=true 則送出時必填）

計算規則（可配置，預設如下）：

- 以公司「工作日」計算天數（預設排除週六週日；公司假日表可後續擴充）
- 天數可為 0.5 的半天（若公司不支援半天則關閉；MVP 可先不做半天，保留擴充點）

### 4.4 請假狀態（State Machine）
狀態定義：

- draft（草稿）
- submitted（已送出，待審）
- approved（已核准）
- rejected（已駁回）
- cancelled（已撤回）

狀態規則：

- 僅 draft 狀態可編輯
- 僅 submitted 狀態可審核
- approved / rejected 為不可逆狀態
- submitted 可由員工撤回為 cancelled

### 4.5 剩餘假期計算
- 系統需即時計算剩餘假期天數
- 已核准（approved）的請假會扣除額度
- 已送出但未審核（submitted）的請假需預扣額度（避免超請）
- cancelled / rejected 需釋放預扣額度

顯示規則（每個 LeaveType）：

- Annual quota（年度配額）
- Used（已扣：approved）
- Reserved（預扣：submitted）
- Available（可用：quota - used - reserved）

### 4.6 衝突與驗證規則
- 同一員工不可在同一日期區間重複請假（與 draft/submitted/approved 均視為衝突；cancelled/rejected 不算衝突）
- 剩餘天數不足不可送出申請（submitted 前需檢查 Available >= requested days）
- 結束日期不可早於開始日期
- require_attachment 的假別在送出時附件必填

### 4.7 員工請假紀錄頁（我的請假）
- 依日期排序（可依起始日或建立日排序，預設起始日 DESC）
- 顯示請假狀態（draft/submitted/approved/rejected/cancelled）
- 可依假別 / 狀態 / 日期區間篩選
- 支援進入詳情頁
- draft 支援「編輯 / 刪除（可選，若保留審核軌跡則不提供刪除）」

### 4.8 請假詳情頁
員工視角：

- 顯示請假申請完整資訊（假別、日期、天數、原因、附件、狀態、審核人、審核時間、駁回原因）
- draft：可編輯/送出
- submitted：可撤回
- approved/rejected/cancelled：僅可檢視

主管視角（審核者）：

- 顯示員工資訊（姓名、部門）與請假申請資訊
- submitted：可核准/駁回（駁回必填原因）
- approved/rejected：僅可檢視審核紀錄

### 4.9 主管審核後台（待審核）
- 待審核請假清單（僅 submitted 且審核範圍內）
- 一鍵核准 / 駁回（駁回需填寫原因）
- 支援排序/篩選（日期區間、假別、員工）

### 4.10 部門請假日曆
- 以月/週視圖顯示部門內請假
- 至少顯示 approved，並可選擇是否顯示 submitted（以「待審」標記）
- 支援點擊進入申請詳情（需遵守權限：主管可看其管理範圍；員工僅能看到自己的詳情）

---

## 5. 非功能需求（Non-functional Requirements）
- RWD（支援桌機與行動裝置）
- 表單驗證與錯誤提示（欄位層級 + 表單層級）
- 操作需顯示 loading 狀態（送出/撤回/審核）
- 基本審核紀錄（時間、審核人、決策、駁回原因）
- 安全性：密碼加密儲存、API 權限驗證、敏感資料最小化回傳
- 資料一致性：提交/審核/撤回需具備交易性，避免額度被重複預扣或釋放
- 時區一致：日期計算以公司時區為準（例如 Asia/Taipei）

---

## 6. 資料模型（Data Model）

### User
- id (uuid)
- name (string)
- email (string, unique)
- password_hash (string)
- role (employee | manager)
- department_id (fk)
- manager_id (fk -> User.id, nullable)
- created_at (datetime)
- updated_at (datetime)

### Department
- id (uuid)
- name (string, unique)

### LeaveType
- id (uuid)
- name (string, unique)
- annual_quota (number)
- carry_over (boolean)
- require_attachment (boolean)
- is_active (boolean)
- created_at (datetime)
- updated_at (datetime)

### LeaveRequest
- id (uuid)
- user_id (fk -> User.id)
- leave_type_id (fk -> LeaveType.id)
- start_date (date)
- end_date (date)
- days (number)
- reason (string)
- attachment_url (string, nullable)
- status (draft | submitted | approved | rejected | cancelled)
- approver_id (fk -> User.id, nullable)
- rejection_reason (string, nullable)
- submitted_at (datetime, nullable)
- decided_at (datetime, nullable)
- cancelled_at (datetime, nullable)
- created_at (datetime)
- updated_at (datetime)

### LeaveBalance
（每年每人每假別的額度）

- id (uuid)
- user_id (fk)
- leave_type_id (fk)
- year (int)
- quota (number)
- used_days (number)         
- reserved_days (number)     
- created_at (datetime)
- updated_at (datetime)

### LeaveBalanceLedger
（額度扣抵/預扣的流水，以利一致性與稽核）

- id (uuid)
- leave_balance_id (fk)
- leave_request_id (fk)
- type (reserve | release_reserve | deduct | refund)
- days (number)
- created_at (datetime)

### LeaveApprovalLog
- id (uuid)
- leave_request_id (fk)
- actor_id (fk -> User.id)
- action (submit | cancel | approve | reject)
- note (string, nullable)    
- created_at (datetime)

### 關聯
- Department 1:N User
- User (manager) 1:N User (direct reports)
- User 1:N LeaveRequest
- LeaveType 1:N LeaveRequest
- User 1:N LeaveBalance（依 year 與 leave_type 分組）
- LeaveBalance 1:N LeaveBalanceLedger
- LeaveRequest 1:N LeaveApprovalLog
