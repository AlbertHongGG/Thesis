# 人工驗收確認表（Manual QA Checklist）
SmartBooking 預約型服務平台

---

## 0. 環境 / 前置條件
- [ ] 準備 4 種測試身分：Guest（未登入）、User（status=ACTIVE）、Provider（status=ACTIVE）、Admin（status=ACTIVE）
- [ ] 另準備 1 個 User（status=SUSPENDED）用於驗證登入/預約限制
- [ ] 準備至少 1 個 Service（status=ACTIVE）與其 TimeSlot（status=OPEN、capacity>=2、cancel_deadline_at 在未來）
- [ ] 準備至少 1 個 Service（status=INACTIVE）用於驗證不可建立新預約
- [ ] 準備至少 1 個 TimeSlot（status=CLOSED）用於驗證不可建立新預約
- [ ] 準備至少 1 個 TimeSlot（booked_count 已接近 capacity）用於驗證名額不足與併發搶位
- [ ] 確認測試環境時間基準與 UI 顯示時區一致（影響 cancel_deadline_at 判定）
- [ ] 測試至少包含手機與桌面尺寸（驗證 RWD）

## 1. 角色與權限邊界（RBAC / Route Access Control / Header Visibility）

### 1.1 Guest（未登入）
- [ ] 可進入 `/` 並看到公開入口與導向 `/services` 的主要 CTA
- [ ] 可進入 `/services` 並瀏覽服務清單
- [ ] 可進入 `/services/:id` 並只讀查看服務與時段（不顯示「立即預約」）
- [ ] 嘗試進入 `/my-bookings` 會導向 `/login`，且保留 returnTo=`/my-bookings`
- [ ] 嘗試進入 `/provider/dashboard` 會導向 `/login`，且保留 returnTo=`/provider/dashboard`
- [ ] 嘗試進入 `/admin` 會導向 `/login`，且保留 returnTo=`/admin`
- [ ] Header 只顯示「服務列表」「登入」「註冊」，不顯示「我的預約」「Provider 控制台」「Admin 後台」「登出」

### 1.2 User（已登入）
- [ ] 可進入 `/services/:id` 並看到「立即預約」入口
- [ ] 可進入 `/my-bookings` 並只看到自己的 Booking（不可看到他人資料）
- [ ] 嘗試進入 `/provider/dashboard` 會導向 `/403`
- [ ] 嘗試進入 `/admin` 會導向 `/403`
- [ ] Header 顯示「服務列表」「我的預約」「登出」，不顯示「登入」「註冊」「Provider 控制台」「Admin 後台」

### 1.3 Provider（已登入）
- [ ] 可進入 `/provider/dashboard` 並只看到自己名下 Service/TimeSlot/Booking
- [ ] 嘗試進入 `/my-bookings` 會導向 `/403`
- [ ] 嘗試進入 `/admin` 會導向 `/403`
- [ ] 進入 `/services/:id` 為只讀瀏覽（不顯示「立即預約」）
- [ ] Header 顯示「服務列表」「Provider 控制台」「登出」，不顯示「登入」「註冊」「我的預約」「Admin 後台」

### 1.4 Admin（已登入）
- [ ] 可進入 `/admin` 並可看到帳號列表、服務列表與報表摘要
- [ ] 嘗試進入 `/my-bookings` 會導向 `/403`
- [ ] 嘗試進入 `/provider/dashboard` 會導向 `/403`
- [ ] 進入 `/services`、`/services/:id` 可只讀瀏覽（不顯示「立即預約」）
- [ ] Header 顯示「Admin 後台」「登出」，不顯示「服務列表」「我的預約」「Provider 控制台」「登入」「註冊」

## 2. 端到端主流程（對應 Spec 第 3 章 User Flow）

### 2.1 User 流程（3.1）
- [ ] 註冊為 User 並登入成功（取得 JWT，並導向 `/services`）
- [ ] 在 `/services` 可瀏覽服務並進入 `/services/:id`
- [ ] 在 `/services/:id` 可查看時段、剩餘名額（capacity - booked_count）與 cancel_deadline_at
- [ ] 選擇可用時段並提交預約（建立 Booking 成功）
- [ ] 建立預約時系統會檢查：JWT 身分、TimeSlot.status=OPEN、Service.status=ACTIVE、booked_count < capacity、避免同一 user_id + timeslot_id 重複建立
- [ ] 建立預約成功後可在 `/my-bookings` 看到該筆 Booking 且狀態正確（預設 PENDING；不得跳過合法轉移）
- [ ] 在取消截止時間前取消預約成功（Booking.status=CANCELLED、cancelled_at 有值、booked_count -1）
- [ ] 超過 cancel_deadline_at 時取消會被拒絕（Booking 狀態不變、booked_count 不變）
- [ ] 登出後再次進入 `/my-bookings` 會導向 `/login`

### 2.2 Provider 流程（3.2）
- [ ] 註冊為 Provider 並登入成功（導向 `/provider/dashboard`）
- [ ] 在 `/provider/dashboard` 建立 Service 成功（name/description/duration_minutes）
- [ ] 為該 Service 建立 TimeSlot 成功（start_time/end_time/capacity/cancel_deadline_at、status=OPEN）
- [ ] 同一 Service 下建立 TimeSlot 不可時間重疊（重疊必須被拒絕）
- [ ] 查看每個 TimeSlot 的預約名單（只包含自己的服務）
- [ ] 更新 Booking 狀態為 COMPLETED 成功（completed_at 有值）
- [ ] 將 Service 設為 INACTIVE 或 TimeSlot 設為 CLOSED 後，不再允許建立新 Booking
- [ ] Provider 登出後再次進入 `/provider/dashboard` 會導向 `/login`

### 2.3 Admin 流程（3.3）
- [ ] Admin 登入後可進入 `/admin`
- [ ] 可查看帳號列表與服務列表
- [ ] 可將帳號狀態由 ACTIVE → SUSPENDED，且該帳號後續不可登入
- [ ] 可將服務狀態切換 ACTIVE/INACTIVE，且 INACTIVE 服務不可建立新預約
- [ ] 可查看報表摘要（預約量、取消率、服務活躍度）
- [ ] Admin 登出後再次進入 `/admin` 會導向 `/login`

### 2.4 認證與找回密碼流程（3.4）
- [ ] Guest 可在 `/login` 以 Email + Password 登入（成功導向對應角色首頁）
- [ ] 登入失敗時留在 `/login` 並顯示可理解的錯誤訊息
- [ ] 在 `/login` 發起忘記密碼並提交 Email 後，UI 回應不洩漏該 Email 是否存在
- [ ] 透過重設連結進入 `/login` 的「重設密碼模式」可設定新密碼
- [ ] 重設連結有有效期限（expires_at），過期必須失敗
- [ ] 重設連結僅可使用一次（used_at），二次使用必須失敗
- [ ] 重設成功後回到 `/login` 一般模式並可用新密碼登入

## 3. 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] `/services` 在載入時顯示 Loading；成功顯示清單；無資料顯示 Empty；失敗顯示 Error 並可 Retry
- [ ] `/services/:id` 在載入時顯示 Loading；無時段顯示 Empty；服務不存在或失敗顯示 Error 並可返回 `/services`
- [ ] `/my-bookings` 在載入時顯示 Loading；無資料顯示 Empty；失敗顯示 Error 並可 Retry
- [ ] `/provider/dashboard` 在載入時顯示 Loading；尚未建立任何服務顯示 Empty；失敗顯示 Error 並可 Retry
- [ ] `/admin` 在載入時顯示 Loading；對應分頁無資料顯示 Empty；失敗顯示 Error 並可 Retry
- [ ] `/401`、`/403`、`/404`、`/500` 皆提供可返回頁面入口且訊息可理解

## 4. 錯誤碼與導向（401 / 403 / 404 / 500）
- [ ] 未登入存取受保護頁（`/my-bookings`、`/provider/dashboard`、`/admin`）會導向 `/login`（並保留 returnTo）
- [ ] Token 無效或過期時，受保護頁會導向 `/401`
- [ ] 已登入但角色不符時，受保護頁會導向 `/403`
- [ ] 任意不存在路由會導向 `/404`
- [ ] 系統例外（伺服器錯誤）會導向 `/500`

## 5. 功能需求驗收：4.1 帳號與認證
- [ ] 註冊時必須選擇身份為 User 或 Provider（互斥且必選）
- [ ] email 必須唯一：使用已存在 email 註冊會失敗並顯示可理解的錯誤
- [ ] 密碼只儲存雜湊（驗證方式：不可在任何 UI 或回應中看到明文密碼）
- [ ] JWT 會用於受保護 API 與資料載入；移除/過期後不可再取得受保護資料
- [ ] 未授權請求回應 401；已登入但權限不足回應 403（UI 與導向符合）
- [ ] 登出會清除本機登入狀態；登出後進入受保護頁需重新登入
- [ ] 忘記密碼：提交 Email 會產生一次性 token（token_hash）、有 expires_at、可標記 used_at
- [ ] status=SUSPENDED 的帳號不可登入（登入必須被拒絕並顯示錯誤）
- [ ] status=SUSPENDED 的帳號不可建立預約（建立預約必須被拒絕）
- [ ] 若已登入且帳號狀態變更為 SUSPENDED，後續受保護請求會被視為不可用並導向未授權處理

## 6. 功能需求驗收：4.2 核心資料管理（CRUD）

### 6.1 Service CRUD（Provider）
- [ ] Provider 可建立 Service（name/description/duration_minutes）且建立後可在自己的管理清單看到
- [ ] Provider 可更新自己 Service 的名稱/描述/時長，更新後資料一致
- [ ] Provider 停用 Service（ACTIVE → INACTIVE）後：不得建立新預約，但既有 Booking 仍可查
- [ ] Provider 不可操作其他 Provider 的 Service（越權必須失敗且不洩漏資料）
- [ ] 建立/更新/停用 Service 會寫入 AuditLog（actor=Provider、target=Service、before/after）

### 6.2 TimeSlot CRUD（Provider）
- [ ] Provider 可建立 TimeSlot（start_time/end_time/capacity/cancel_deadline_at）且 status=OPEN
- [ ] Provider 可更新 TimeSlot（時間範圍、capacity、cancel_deadline_at）且不造成資料不一致
- [ ] 調降 capacity 小於 booked_count 必須被拒絕（TimeSlot 與 Booking 不得被破壞）
- [ ] Provider 可關閉 TimeSlot（OPEN → CLOSED），關閉後不可建立新 Booking
- [ ] booked_count 由系統計算與交易更新，不可被手動覆寫（UI 不提供、API 也不接受）
- [ ] 同一 Service 下 TimeSlot 不可時間重疊（重疊必須被拒絕）
- [ ] 建立/更新/關閉 TimeSlot 會寫入 AuditLog（actor=Provider、target=TimeSlot）

### 6.3 Booking CRUD（User）
- [ ] User 可對 TimeSlot 建立 Booking（成功後出現在 `/my-bookings`）
- [ ] booked_count >= capacity 時建立 Booking 必須失敗（booked_count 不可超過 capacity）
- [ ] TimeSlot.status=CLOSED 或 Service.status=INACTIVE 時建立 Booking 必須失敗
- [ ] 同一 User 對同一 TimeSlot 不可重複建立有效 Booking（重複送出必須被拒絕）
- [ ] User 只能查詢自己的 Booking，嘗試存取他人 Booking 必須被拒絕（防止 IDOR）
- [ ] 取消截止時間前取消 Booking 成功（Booking.status=CANCELLED、cancelled_at 有值、booked_count -1）
- [ ] 超過 cancel_deadline_at 取消必須失敗（Booking 狀態不變、booked_count 不變）
- [ ] 重複取消同一筆已取消 Booking：回應可辨識錯誤且不得再次扣減 booked_count
- [ ] 建立 Booking 與 booked_count +1 需同交易完成；取消 Booking 與 booked_count -1 需同交易完成（資料一致）
- [ ] 建立/取消 Booking 會寫入 AuditLog（actor=User、target=Booking）

### 6.4 User 管理（Admin）
- [ ] Admin 可查詢帳號清單
- [ ] Admin 可切換帳號狀態 ACTIVE/SUSPENDED，且 UI 立即反映
- [ ] 被設為 SUSPENDED 的帳號不可登入且不可建立預約
- [ ] 帳號狀態變更會寫入 AuditLog（actor=Admin、target=User、before/after）

### 6.5 Service 管理（Admin）
- [ ] Admin 可查詢服務清單
- [ ] Admin 可切換 Service 狀態 ACTIVE/INACTIVE，且 UI 立即反映
- [ ] INACTIVE 的服務不可建立新預約
- [ ] 服務狀態變更會寫入 AuditLog（actor=Admin、target=Service、before/after）

## 7. 功能需求驗收：4.3 狀態機 / 規則 / 限制
- [ ] Booking 狀態集合存在：PENDING / CONFIRMED / CANCELLED / COMPLETED
- [ ] 合法轉換存在：PENDING → CONFIRMED → COMPLETED
- [ ] 合法轉換存在：PENDING → CANCELLED、CONFIRMED → CANCELLED
- [ ] 非法轉移必須拒絕：COMPLETED 不可再取消
- [ ] 非法轉移必須拒絕：CANCELLED 不可回復為 PENDING/CONFIRMED
- [ ] 取消規則以 TimeSlot.cancel_deadline_at 判定（current_time > cancel_deadline_at 不可取消）
- [ ] 名額規則存在：booked_count >= capacity 不可建立預約
- [ ] 關閉/停用規則存在：TimeSlot.status=CLOSED 或 Service.status=INACTIVE 不可建立預約
- [ ] 冪等性存在：重複取消不重複扣減 booked_count；重複送出不重複建立
- [ ] 併發控制存在：高併發搶位時仍不會超賣（booked_count 不超過 capacity）

## 8. 功能需求驗收：4.4 主要頁面需求 / 資訊架構與導覽
- [ ] Page Inventory 所有頁面皆存在：`/`、`/services`、`/services/:id`、`/my-bookings`、`/provider/dashboard`、`/admin`、`/login`、`/register`、`/401`、`/403`、`/404`、`/500`
- [ ] `/` 提供「前往服務列表」主要 CTA，並遵守 CTA 去重規則
- [ ] `/services` 可進入 `/services/:id`
- [ ] `/services/:id` 會顯示剩餘名額與 cancel_deadline_at；Guest 不顯示預約 CTA；User 顯示預約 CTA；Provider/Admin 只讀
- [ ] `/my-bookings` 依狀態呈現預約並提供可取消項目的取消 CTA
- [ ] `/provider/dashboard` 提供新增/編輯/停用服務、設定/關閉時段、更新 Booking 狀態（完成/取消）入口
- [ ] `/admin` 提供帳號狀態管理、服務狀態管理、報表摘要入口
- [ ] Header 可見性規則完全符合角色：Guest / User / Provider / Admin
- [ ] Header 不會顯示不屬於該角色的頁面入口（不得「顯示後再導登入」）
- [ ] 同一動作在同頁僅保留一個主要 CTA（避免重複觸發）

## 9. 非功能需求驗收（對應 Spec 第 5 章）
- [ ] RWD：手機與桌面皆可用且主要功能不被遮擋
- [ ] 效能：主要 API 平均回應時間可達 < 500ms（排除外部依賴異常情況）
- [ ] 一致性：建立/取消預約、狀態流轉使用 transaction，資料不會不一致
- [ ] 安全：密碼以不可逆雜湊儲存；JWT 驗簽與過期檢查有效
- [ ] 安全：輸入資料驗證與輸出轉義有效（可避免 XSS）
- [ ] 併發控制：同一時段高併發搶位不會超賣（booked_count 不超過 capacity）
- [ ] 稽核：關鍵操作皆有 AuditLog，可追溯 who/when/what（含 before/after）
- [ ] UI 一致性：Loading / Error / Empty 呈現風格一致
- [ ] UI 一致性：全站不得重複顯示同一 CTA（符合 CTA 去重規則）
