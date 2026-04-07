# 功能覆蓋確認表（Feature Coverage Checklist）
社團活動管理平台（Activity Management Platform）

---
N/T
## Authentication / Session
- [T] 使用 Email + 密碼註冊
- [N/T] 使用 Email + 密碼登入
- [T] 登出功能
- [N/T] 登入狀態存在（Token 或 Session）
- [N/T] 未登入限制：未登入不可報名活動
- [N/T] Session / Token 失效處理（未登入行為一致）

## Roles / Access Control
- [N/T] 角色定義：Member 與 Admin（role=member | admin）
- [N/T] 角色限制：同一帳號不可同時是 Member 與 Admin
- [N/T] 管理後台存取控制（僅 Admin 可進入）
- [N/T] 權限不足處理（403 顯示或導向）

## Activity（活動）
- [N/T] 活動資料欄位存在（title/description/date/location/deadline/capacity/status）
- [N/T] 活動規則存在（date 必須晚於 deadline）
- [N/T] 活動規則存在（capacity 必須為正整數）
- [N/T] 活動狀態集合存在（draft/published/full/closed/archived）

## Activity State Machine（狀態轉換）
- [N/T] 系統自動狀態：published -> full（額滿自動）
- [N/T] 名額釋放狀態：full -> published（取消後釋放且未額滿）
- [N/T] Admin 手動關閉：published -> closed
- [N/T] Admin 手動關閉：full -> closed
- [N/T] Admin 下架：closed -> archived

## Registration（報名）
- [N/T] 報名功能（建立 Registration）
- [T] 取消報名功能（canceled_at 可為空或有值）
- [N/T] 唯一性限制：同一使用者對同一活動只能報名一次
- [N/T] 報名限制：活動狀態非 published 不可報名
- [N/T] 名額控管與一致性（避免超賣）
- [N/T] 防重複提交（idempotent）

## Public Pages（前台頁面）
- [N/T] 活動列表頁（僅顯示 published / full）
- [N/T] 活動列表顯示：活動名稱/日期/地點/目前報名人數/名額上限
- [N/T] 活動列表顯示：報名狀態（可報名 / 已報名 / 額滿）
- [N/T] 活動詳情頁（顯示完整活動資訊）
- [N/T] 活動詳情依登入/報名狀態顯示報名/取消/額滿提示
- [T] 我的活動頁（僅顯示已報名活動）
- [N/T] 我的活動頁依活動 date 排序
- [N/T] 我的活動頁顯示狀態（即將開始 / 已結束）

## Admin Panel（管理後台）
- [N/T] 活動 CRUD（建立/編輯/下架）
- [N/T] 手動關閉活動報名
- [N/T] 查看活動報名名單（姓名 / Email / 報名時間）
- [N/T] 匯出報名名單為 CSV

## Non-functional（依 Spec）
- [N/T] RWD（支援桌機與手機）
- [T] 系統時間使用同一時區（可設定預設時區）
- [N/T] 重要操作紀錄（建立/修改/狀態變更）
- [T] 前後端資料同步一致（避免超賣與狀態不一致）
