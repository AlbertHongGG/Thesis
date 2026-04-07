# 人工驗收確認表（Manual QA Checklist）

> 範圍：公司內部請假系統（Leave Management System）
> 目的：逐項勾選確認流程正確、權限正確、狀態機正確、資料一致（LeaveBalance/Reserved/Used/Ledger）正確。

---

## 0. 環境 / 前置條件（Environment & Test Data Setup）
- [ ] 公司時區設定為 `Asia/Taipei`，並確認 UI 顯示日期/計算天數皆以此時區為準
- [ ] 準備至少 2 個部門：`Department A`、`Department B`
- [ ] 準備至少 4 個使用者（Email+密碼可登入，並能明確區分權限/資料範圍）：
- [ ] `Employee-A`（role=employee, department=Department A）
- [ ] `Employee-B`（role=employee, department=Department A）
- [ ] `Employee-C`（role=employee, department=Department B）
- [ ] `Manager-A`（role=manager, department=Department A；並設定為 Employee-A/Employee-B 的 `manager_id`）
- [ ] 每位使用者在當年度（year=今年）每個 `LeaveType` 皆有對應 `LeaveBalance` 資料（quota/used_days/reserved_days 初始值明確）
- [ ] 系統已初始化 4 種假別（LeaveType）：年假 / 病假 / 事假 / 特休，且皆為 `is_active=true`
- [ ] 至少設定 1 種假別 `require_attachment=true`（例如病假），並至少 1 種為 `require_attachment=false`
- [ ] 至少設定 1 種假別 annual_quota 較小（例如 1 天），用來測試「剩餘不足不可送出」
- [ ] 確認「半天 0.5」目前是否未啟用（MVP 可先不做半天）：UI 不應提供 0.5 天的輸入方式，且 API 不應接受不被支援的 0.5 請假天數
- [ ] 測試瀏覽器至少覆蓋：Chrome（桌機）與行動裝置尺寸（RWD）

---

## 1. 角色與權限邊界（Role & Access Boundary）

### 1.1 未登入（401）與導向
- [ ] 未登入直接開啟「我的請假」頁：應被導向登入頁，且 API 回應為 401
- [ ] 未登入直接開啟「請假詳情」頁：應被導向登入頁，且 API 回應為 401
- [ ] 未登入直接開啟「待審核」頁：應被導向登入頁，且 API 回應為 401
- [ ] 未登入直接開啟「部門日曆」頁：應被導向登入頁，且 API 回應為 401
- [ ] 未登入直接開啟「剩餘假期」頁：應被導向登入頁，且 API 回應為 401

### 1.2 已登入（Employee）權限邊界
- [ ] Employee 僅能看到/操作自己的 LeaveRequest：以 `Employee-A` 登入後，嘗試用 URL 直接開啟 `Employee-B` 的請假詳情：應回 403（或依系統設計收斂為 404，但需與規格「無權限 403、查無資料 404」一致）
- [ ] Employee 不可進入「待審核」：導覽不顯示入口；若直接輸入 URL，應回 403
- [ ] Employee 不可查看不在自己範圍內的部門請假（部門日曆若存在 Employee 入口）：若系統設計 Employee 可進入日曆，則 Employee 只能看到自己的事件，且點擊他人事件不得開啟詳情

### 1.3 已登入（Manager）權限邊界與審核範圍
- [ ] Manager 可進入「待審核」與「部門日曆」，且導覽入口可見
- [ ] Manager 僅能審核「管理範圍」內員工的 submitted 申請：以 `Manager-A` 嘗試開啟 `Employee-C（Department B）` 的請假詳情並審核：應回 403
- [ ] Manager 在待審核清單只看到 submitted 且範圍內的申請，不應看到 draft/approved/rejected/cancelled

---

## 2. 端到端主流程（End-to-End Main Flows）

### 2.1 員工（Employee）端到端流程（對應 User Flow 3.1）
- [ ] 以 `Employee-A` 登入系統（Email+密碼）成功後，進入「我的請假」列表
- [ ] 在「我的請假」列表點選「新增請假」進入建立流程
- [ ] 建立請假申請並選擇假別、開始日期、結束日期、原因（以及附件欄位若需要）
- [ ] 以「存草稿（draft）」方式儲存：成功後於「請假詳情」看到 status=draft，且 days 為系統計算值（不可手改）
- [ ] 從 draft 送出（submitted）：送出前系統檢查日期合法/衝突/額度/附件需求；送出成功後狀態為 submitted
- [ ] submitted 狀態在「請假詳情」可執行撤回：撤回成功後狀態變為 cancelled，且不可再審核
- [ ] 進入「剩餘假期」頁，確認各假別 quota/used/reserved/available 顯示正確（且與上述 draft/submit/cancel 的結果一致）

### 2.2 主管（Manager）端到端流程（對應 User Flow 3.2）
- [ ] 以 `Manager-A` 登入後進入「待審核」清單
- [ ] 待審核清單僅顯示 submitted 且為管理範圍內員工的申請
- [ ] 開啟一筆 submitted 申請詳情，能看到員工資訊（姓名、部門）與申請資訊（假別、日期、天數、原因、附件、狀態）
- [ ] 執行「核准 approve」：狀態變更為 approved，寫入審核紀錄（審核人/時間/決策），且額度更新（reserved→used）
- [ ] 對另一筆 submitted 執行「駁回 reject」：駁回原因必填，狀態變更為 rejected，寫入審核紀錄（含 reason），且釋放預扣額度
- [ ] 進入「部門日曆」檢視同部門請假狀況：能看到 approved（以及若有設計顯示 submitted 也需可識別）

---

## 3. 全站狀態品質（Loading / Error / Empty / Retry）

### 3.1 表單與動作的 Loading
- [ ] 登入送出時顯示 loading，並防止重複提交（按鈕 disabled 或等效機制）
- [ ] 送出請假（submit）時顯示 loading，並防止重複提交
- [ ] 撤回請假（cancel）時顯示 loading，並防止重複提交
- [ ] 主管核准/駁回時顯示 loading，並防止重複提交

### 3.2 清單/詳情頁的 Error / Retry
- [ ] 我的請假列表資料載入失敗時顯示 Error 狀態，且提供 Retry 入口
- [ ] 請假詳情載入失敗時：
- [ ] 403 時顯示 Forbidden（不可顯示他人資料）
- [ ] 404 時顯示 Not Found
- [ ] 其他錯誤顯示 Error 狀態並提供 Retry
- [ ] 待審核清單載入失敗時顯示 Error 狀態並提供 Retry
- [ ] 部門日曆載入失敗時顯示 Error 狀態並提供 Retry
- [ ] 剩餘假期載入失敗時顯示 Error 狀態並提供 Retry

### 3.3 Empty 狀態
- [ ] 我的請假列表在沒有任何資料時顯示 Empty 狀態（含引導新增請假入口）
- [ ] 待審核清單在沒有待審核資料時顯示 Empty 狀態（例如「目前沒有待審核」）
- [ ] 部門日曆在該週/月沒有任何事件時仍能正常呈現空日曆狀態

---

## 4. 錯誤碼與導向（401 / 403 / 404 / 5xx）
- [ ] 任一 API 回 401 時：前端應導向登入頁並顯示「session expired / 請重新登入」等可理解提示
- [ ] 403：應顯示 Forbidden（或導回允許頁），且不得透過「顯示入口但點了才擋」來取代 UI 隱藏規則
- [ ] 404：對不存在的 LeaveRequest id、或不存在的頁面路由顯示 Not Found
- [ ] 5xx：顯示 Error 狀態並提供 Retry；不得使 UI 停留在永遠 loading

---

## 5. 功能需求驗收（Functional Requirements Driven）

### 5.1 帳號與權限（對應 4.1）
- [ ] Email+密碼登入成功後可取得使用者資訊（含 role/department），並能進入「我的請假」
- [ ] 登入失敗（Email/密碼錯誤）應顯示明確錯誤訊息，且不清空已輸入 Email
- [ ] 系統依 role 限制操作：Employee 看不到「待審核」、Manager 看得到
- [ ] 系統依資料範圍限制審核權：Manager 只能審核管理範圍員工
- [ ] API 錯誤碼符合規格：未登入 401、無權限 403、資料不存在 404

### 5.2 假別管理（Leave Type）（對應 4.2）
- [ ] LeaveType 下拉選單至少包含：年假/病假/事假/特休，且僅顯示 `is_active=true`
- [ ] 每個 LeaveType 的年度配額可用於 LeaveBalance 計算與顯示
- [ ] `require_attachment=true` 的假別在送出（submitted）時必須要求附件
- [ ] carry_over 欄位存在於資料結構（若 UI 未提供結轉規則，UI 不應顯示不存在的功能入口）

### 5.3 請假申請（Leave Request）（對應 4.3）
- [ ] 建立請假時 days 由系統自動計算，且 UI 不提供手動輸入 days 的欄位（或欄位為唯讀）
- [ ] 工作日計算符合預設規則：排除週六週日（可用一筆跨週末的日期做驗證）
- [ ] 開始/結束日期、原因欄位的必填/格式驗證在欄位層級提示清楚
- [ ] 附件：
- [ ] 對 `require_attachment=false` 的假別，附件可不填仍可送出
- [ ] 對 `require_attachment=true` 的假別，未附附件不可送出，且提示訊息明確

### 5.4 請假狀態（State Machine）（對應 4.4）
- [ ] draft 可編輯（修改日期/假別/原因/附件）並能成功保存，且 updated_at 有更新
- [ ] submitted 不可編輯：在詳情頁不應出現編輯入口，且 API 也必須拒絕更新（回 403 或 409/422，需一致）
- [ ] 僅 submitted 可審核：若對 draft/approved/rejected/cancelled 發送審核 API，必須被拒絕
- [ ] approved / rejected 為不可逆：不得存在「改判/撤銷」入口，且 API 也必須拒絕
- [ ] submitted 可由員工撤回為 cancelled：撤回成功後不可再被審核

### 5.5 剩餘假期計算（對應 4.5）
- [ ] 「剩餘假期」頁每個 LeaveType 顯示：Annual quota / Used / Reserved / Available
- [ ] Available 計算正確：`available = quota - used - reserved`
- [ ] 送出 submitted 後：reserved_days 增加（以對應天數），Used 不變
- [ ] 撤回 cancelled 後：reserved_days 減少（釋放預扣），Available 回復
- [ ] 主管核准 approved 後：reserved_days 減少，used_days 增加（同一天數），Available 重新計算
- [ ] 主管駁回 rejected 後：reserved_days 減少（釋放），used_days 不增加
- [ ] LeaveBalanceLedger 會寫入對應流水：
- [ ] submit 會有 `reserve`
- [ ] cancel/reject 會有 `release_reserve`（或等效事件）
- [ ] approve 會有 `deduct`

### 5.6 衝突與驗證規則（對應 4.6）
- [ ] 同一員工在同一日期區間不可重複請假：
- [ ] 建立第二筆與已存在 draft/submitted/approved 重疊的請假，送出時必須被拒絕
- [ ] cancelled/rejected 不算衝突：先建立並駁回或撤回一筆，之後同區間再送出應可成功
- [ ] 剩餘天數不足不可送出：當 Available < requested days，送出必須被拒絕且顯示清楚提示
- [ ] 結束日期不可早於開始日期：欄位層級顯示錯誤並禁止送出
- [ ] require_attachment 的假別在送出時附件必填（同 5.3 驗證，但需覆蓋「送出時才檢查」的行為）

### 5.7 員工請假紀錄頁（我的請假）（對應 4.7）
- [ ] 預設排序符合規格：依起始日 DESC（或系統實作採建立日，需與 spec 選擇一致並固定）
- [ ] 清單每列顯示請假狀態（draft/submitted/approved/rejected/cancelled）
- [ ] 篩選功能可依：假別 / 狀態 / 日期區間 篩選，且結果符合條件
- [ ] 可從清單進入詳情頁，返回清單後保留篩選條件與排序
- [ ] draft 的「刪除」若已實作：刪除後清單不再出現該筆，且資料一致（不應殘留可審核/可扣抵的記錄）

### 5.8 請假詳情頁（對應 4.8）

#### 5.8.1 員工視角
- [ ] 詳情顯示完整資訊：假別/日期/天數/原因/附件/狀態/審核人/審核時間/駁回原因
- [ ] draft：可編輯/可送出
- [ ] submitted：可撤回（且撤回後狀態顯示 cancelled）
- [ ] approved/rejected/cancelled：僅可檢視，無可修改入口

#### 5.8.2 主管（審核者）視角
- [ ] 主管打開 submitted 詳情可看到員工資訊（姓名、部門）
- [ ] submitted：可核准/駁回（駁回原因必填）
- [ ] approved/rejected：僅可檢視審核紀錄，且不可改判

### 5.9 主管審核後台（待審核）（對應 4.9）
- [ ] 待審核清單僅顯示 submitted + 在管理範圍內的申請
- [ ] 一鍵核准：成功後該筆不再出現在待審核清單，且詳情狀態為 approved
- [ ] 一鍵駁回：必填原因；成功後該筆不再出現在待審核清單，且詳情狀態為 rejected 並顯示 reason
- [ ] 支援排序/篩選：日期區間、假別、員工，且結果符合條件

### 5.10 部門請假日曆（對應 4.10）
- [ ] 日曆提供月/週視圖
- [ ] 日曆至少顯示 approved 事件
- [ ] 若系統有提供顯示 submitted：submitted 應以「待審」或等效視覺標記區分於 approved
- [ ] 點擊日曆事件可進入申請詳情：
- [ ] Manager：可進入管理範圍內事件的詳情
- [ ] Employee：僅能進入自己的詳情；點擊他人事件不得看到詳情內容（403/404 或 UI 阻擋）

---

## 6. 非功能需求驗收（Non-functional Requirements Driven）（對應 5）
- [ ] RWD：主要頁面（登入/我的請假/詳情/待審核/部門日曆/剩餘假期）在手機尺寸可使用，不需橫向捲動才能操作核心功能
- [ ] 表單驗證：欄位層級 + 表單層級錯誤提示清楚可理解
- [ ] 操作 loading：送出/撤回/審核均呈現 loading，且防止重複送出
- [ ] 審核紀錄完整：approve/reject 均寫入 LeaveApprovalLog，包含 actor、action、created_at；reject 需包含 note（原因）
- [ ] 安全性：密碼以雜湊儲存（不可回傳明文），API 回傳敏感資料最小化（例如不回傳 password_hash）
- [ ] 權限驗證：所有敏感 API（請假詳情、審核、日曆）都有 server-side 權限檢查，非僅前端隱藏
- [ ] 資料一致性/交易性：
- [ ] submit/cancel/approve/reject 任一動作若失敗，LeaveRequest 狀態與 LeaveBalance/LeaveBalanceLedger 不可出現「部分成功」的不一致
- [ ] 在短時間內連續點擊送出/撤回/審核（或同一請求重送）不會導致 reserved/used 重複扣抵或釋放
- [ ] 時區一致：跨日/跨週末的天數計算與 UI 顯示一致，且不因使用者裝置時區不同而改變計算結果
