# 功能覆蓋確認表（Feature Coverage Checklist）

SmartBooking 預約型服務平台

---

## Authentication / Session

- [N/T] 註冊（Email + Password；身份選擇 User / Provider）
- [N/T] 登入（Email + Password）
- [N/T] 登出
- [N/T] JWT 驗證（Access Token 驗簽與過期檢查）
- [ ] 忘記密碼（PasswordResetToken：token_hash / expires_at / used_at 一次性）
- [T] 未登入受保護路由導向 `/login`（保留 returnTo）

## RBAC / 存取控制 / 導覽

- [N/T] 角色權限控管（Guest / User / Provider / Admin）
- [N/T] 路由存取控制（`/my-bookings` 僅 User）
- [N/T] 路由存取控制（`/provider/dashboard` 僅 Provider）
- [N/T] 路由存取控制（`/admin` 僅 Admin）
- [N/T] Header 可見性規則（依角色顯示入口）
- [N/T] 資料隔離（User 只能存取自己的 Booking）
- [N/T] 資料隔離（Provider 只能操作自己名下 Service / TimeSlot / Booking）

## Pages（Page Inventory）

- [N/T] 首頁（`/`）
- [N/T] 服務列表頁（`/services`）
- [N/T] 服務詳情頁（`/services/:id`）
- [N/T] 我的預約頁（`/my-bookings`）
- [N/T] Provider 控制台（`/provider/dashboard`）
- [N/T] Admin 後台（`/admin`）
- [N/T] 登入頁（`/login`）
- [N/T] 註冊頁（`/register`）
- [ ] 401 頁（`/401`）
- [T] 403 頁（`/403`）
- [T] 404 頁（`/404`）
- [ ] 500 頁（`/500`）

## Service（服務）

- [T] Service 清單瀏覽（名稱/時長/狀態摘要）
- [N/T] Service 詳情顯示（服務內容）
- [N/T] Provider 建立 Service（name / description / duration_minutes）
- [N/T] Provider 更新 Service（名稱/描述/時長）
- [N/T] Provider 停用 Service（ACTIVE → INACTIVE；停用後不可建立新預約）
- [N/T] Admin 啟用/停用 Service（ACTIVE / INACTIVE）

## TimeSlot（時段）

- [N] TimeSlot 清單顯示（start_time / end_time / capacity / booked_count / cancel_deadline_at / status）
- [N/T] Provider 建立 TimeSlot（start_time / end_time / capacity / cancel_deadline_at）
- [N/T] Provider 更新 TimeSlot（時間範圍 / capacity / cancel_deadline_at）
- [N/T] Provider 關閉 TimeSlot（OPEN → CLOSED）
- [N/T] 同一 Service 下 TimeSlot 不重疊規則
- [N/T] capacity / booked_count 規則與剩餘名額顯示（capacity - booked_count）
- [N/T] cancel_deadline_at 取消截止規則

## Booking（預約）

- [N/T] User 建立 Booking（選擇 TimeSlot 提交）
- [N/T] User 查詢自己的 Booking（依狀態：PENDING / CONFIRMED / CANCELLED / COMPLETED）
- [N/T] User 取消自己的 Booking（依 cancel_deadline_at）
- [N/T] Booking 狀態機（合法轉換集合存在）
- [N/T] Booking 狀態機（非法轉換拒絕）
- [N/T] 名額規則（booked_count >= capacity 不可建立預約）
- [N/T] 關閉/停用規則（TimeSlot.status=CLOSED 或 Service.status=INACTIVE 不可建立預約）
- [N/T] 冪等性（重複取消不重複扣減 booked_count）
- [N/T] 防重複建立（同一 user_id + timeslot_id 不可重複建立有效 Booking）
- [N/T] 交易一致性（建立 Booking 與 booked_count +1 原子一致）
- [N/T] 交易一致性（取消 Booking 與 booked_count -1 原子一致）
- [N/T] 併發控制（高併發搶位不超賣；booked_count 不超過 capacity）
- [N/T] Provider 更新 Booking 狀態（完成/取消；含 completed_at / cancelled_at）

## Admin / 後台

- [N/T] Admin 帳號狀態管理（ACTIVE / SUSPENDED）
- [N/T] SUSPENDED 帳號限制（不可登入、不可建立預約、受保護請求不可用）
- [N/T] Admin 報表摘要（預約量 / 取消率 / 服務活躍度）

## Audit / Security / UX States

- [N/T] AuditLog 記錄（actor_user_id / action / target_type / target_id / before_data / after_data / created_at）
- [N/T] 安全（密碼雜湊儲存）
- [N/T] Loading 狀態
- [N/T] Empty 狀態
