# 功能覆蓋確認表（Feature Coverage Checklist）

> 用途：快速確認「功能是否存在」（有入口/頁面/權限/資料流）。
> 注意：此清單不驗收細節（流程、錯誤訊息、邊界、資料一致性細節）—那些屬於「人工驗收確認表」。

---

## Authentication / Session
- [T] Email + 密碼登入功能
- [N/T] 登出功能
- [N/T] Session/token 管理（登入後可維持登入狀態）
- [N/T] Session/token 失效處理（API 401 時導向登入頁並提示）

## Roles / Access Control
- [N/T] 角色：員工（Employee）
- [N/T] 角色：主管（Manager）
- [N/T] 路由存取控制：員工不可進入「待審核」
- [T] 路由存取控制：員工不可進入「日曆」
- [N/T] 路由存取控制：主管可進入「待審核」
- [N/T] 資料存取控制：員工只能存取自己的請假申請
- [N/T] 審核範圍控制：主管只能審核管理範圍（同部門/管理關係）內員工的請假申請

## Core Entities（Data Model Existence）
- [N/T] Department 資料存在（使用者有 department_id）
- [N/T] User 資料存在（含 role/department/manager 關係）
- [N/T] LeaveType 資料存在（含 annual_quota/carry_over/require_attachment/is_active）
- [N/T] LeaveRequest 資料存在（含日期、天數、原因、附件、狀態、審核欄位）
- [N/T] LeaveBalance 資料存在（每年每人每假別的 quota/used/reserved）
- [N/T] LeaveBalanceLedger 資料存在（reserve/release_reserve/deduct/refund）
- [N/T] LeaveApprovalLog 資料存在（submit/cancel/approve/reject）

## Leave Type（假別與政策）
- [N] 預設假別：年假 / 病假 / 事假 / 特休
- [N/T] 假別年度配額（annual_quota）可被用於額度計算
- [N/T] 假別附件需求（require_attachment）能影響送出規則

## Leave Request（請假申請）
- [N/T] 建立請假申請（草稿 draft）功能
- [T] 編輯請假草稿（draft 才可編輯）功能
- [N/T] 送出請假申請（submitted）功能
- [N/T] 撤回已送出申請（submitted → cancelled）功能
- [N/T] 請假天數由系統自動計算（工作日規則）功能
- [N/T] 附件上傳/關聯到請假申請功能（attachment_url）

## Business State Machine（LeaveRequest 狀態機）
- [N/T] 狀態集合存在：draft / submitted / approved / rejected / cancelled
- [N/T] 合法轉換存在：draft → submitted
- [N/T] 合法轉換存在：submitted → approved
- [N/T] 合法轉換存在：submitted → rejected
- [N/T] 合法轉換存在：submitted → cancelled
- [N/T] 非法轉換拒絕：非 submitted 不可審核
- [N/T] 非法轉換拒絕：approved/rejected 不可逆（不可改判/撤銷）

## Validation Rules（衝突/額度/日期/附件）
- [N/T] 日期驗證：結束日期不可早於開始日期
- [N/T] 衝突驗證：同一員工日期區間不可與 draft/submitted/approved 重疊
- [N/T] 額度驗證：Available 不足時不可送出 submitted
- [N/T] 附件驗證：require_attachment=true 時送出必須有附件

## Leave Balance（剩餘假期）
- [N/T] 額度顯示：Annual quota / Used / Reserved / Available
- [N/T] 額度公式存在：Available = quota - used - reserved
- [N/T] submitted 會預扣額度（Reserved 增加）
- [N/T] cancelled/rejected 會釋放預扣額度（Reserved 減少）
- [N/T] approved 會從預扣轉為已扣（Reserved 減少、Used 增加）
- [N/T] 額度流水寫入（LeaveBalanceLedger）功能

## Pages（主要頁面存在）
- [N/T] 登入頁
- [N/T] 我的請假列表（清單/篩選/排序）
- [N/T] 請假詳情頁
- [N/T] 剩餘假期頁
- [N/T] 待審核頁（主管）
- [N/T] 部門請假日曆頁（主管）

## Manager Approval（主管審核）
- [N/T] 待審核清單（submitted 且範圍內）
- [N/T] 核准請假（approve）功能
- [N/T] 駁回請假（reject）功能（含駁回原因）
- [N/T] 審核紀錄寫入（審核人/時間/決策/原因）
- [T] 可以查看員工的附件內容

## Department Calendar（部門日曆）
- [N/T] 月/週視圖顯示部門請假
- [N/T] 日曆至少顯示 approved 事件
- [N/T] 日曆可選擇顯示 submitted 事件並以「待審」標記
- [N/T] 從日曆事件可導向請假詳情（並受權限控管）

## Consistency / Security / Non-functional
- [N/T] 提交/審核/撤回的交易性一致性（狀態 + 額度 + ledger 不可部分成功）
- [N/T] 時區一致（以公司時區進行日期計算）
- [T] UI 版面沒有破版
