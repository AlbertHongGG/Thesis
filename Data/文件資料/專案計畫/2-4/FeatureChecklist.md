# 功能覆蓋確認表（問卷／表單系統：動態邏輯）

## Authentication / Session
- [N/T] `/login` 登入功能
- [T] 登出功能
- [N/T] Session 建立與維持
- [N/T] 記名提交情境的 `return_to` 回跳機制
- [N/T] 記名提交情境的草稿答案保留機制

## RBAC / 存取控制
- [N/T] `/surveys*` 後台路由登入保護
- [N/T] Survey owner 邊界控制（僅 owner 可管理自己的 Survey）
- [N/T] Guest 可開啟 `/s/:slug` 的公開填答入口
- [N/T] `Survey.is_anonymous` 提交權限控制
- [N/T] Guest 導覽顯示規則（僅登入入口）
- [N/T] User/Admin 導覽顯示規則（我的問卷、登出）

## Survey 核心實體與管理功能
- [N/T] Survey 建立（Draft）
- [N/T] Survey 基本資訊維護（title、description、is_anonymous）
- [N/T] Survey `slug` 唯一且不可變
- [N/T] Survey Draft 結構編輯能力
- [N/T] Survey 結構鎖定能力（Published/Closed）
- [N] Survey 非結構欄位白名單更新能力（Published/Closed 僅 title、description）
- [ ] Survey 刪除限制（有 Response 禁止刪除）

## Question / Option 功能
- [N/T] Question 新增功能
- [N/T] Question 刪除功能
- [T] Question 排序（order）功能
- [N/T] Question 必填設定（is_required）功能
- [N/T] Question 題型設定（Single Choice / Multiple Choice / Text / Number / Rating / Matrix）
- [N/T] Option 管理功能（適用題型）
- [N/T] Option.value 同題唯一性約束

## RuleGroup / LogicRule 功能
- [N/T] RuleGroup 建立與管理功能
- [N/T] RuleGroup `action`（show/hide）功能
- [N/T] RuleGroup `group_operator`（AND/OR）功能
- [N/T] LogicRule 建立與管理功能
- [N/T] LogicRule `operator`（equals/not_equals/contains）功能
- [N/T] forward-only 規則驗證能力
- [N/T] cycle detection 規則驗證能力

## Survey 狀態機與結構穩定性
- [N/T] Survey 狀態集合（Draft / Published / Closed）
- [N/T] 合法狀態轉換（Draft -> Published）
- [N/T] 合法狀態轉換（Published -> Closed）
- [N/T] 非法狀態回退拒絕機制
- [N/T] 發佈時計算並寫入 `publish_hash` 功能
- [N/T] 發佈後結構不可變（Schema Stability）能力

## 動態邏輯引擎與非線性填答
- [N/T] 可見題目集合（Visible Questions）計算功能
- [N/T] 前端每次答案變更即時重算可見題目功能
- [N/T] show/hide 合併策略與 hide 優先規則
- [N/T] visible -> hidden 時草稿答案清除機制
- [N/T] 上一題回溯能力
- [N/T] 回溯後重算可見題目能力
- [N/T] required 僅對 visible 題目生效規則

## 回覆提交與不可變性
- [N/T] `/s/:slug` 填答提交功能
- [N/T] 匿名提交功能（`respondent_id=null`）
- [N/T] 記名提交功能（`respondent_id=User.id`）
- [N/T] 後端提交時可見題目重算能力（Server-side Recompute）
- [N/T] hidden 題目答案拒收能力
- [N/T] visible required 驗證能力
- [N/T] Answer.value 題型 schema 驗證能力
- [N] Answer.value 大小限制驗證能力
- [N/T] `response_hash` 計算與儲存功能
- [N/T] Response/Answer 僅新增不可修改能力

## 預覽與結果分析
- [N/T] `/surveys/:id/preview` 邏輯模擬功能
- [N/T] 預覽不建立 Response 的隔離能力
- [N/T] `/surveys/:id/results` 回收與彙總統計功能
- [N/T] 回覆資料匯出功能
- [N/T] 匯出資料與結果頁範圍一致能力

## 頁面與導覽覆蓋
- [N/T] `/surveys` 問卷列表頁
- [N/T] `/surveys/:id/edit` 問卷編輯頁
- [N/T] `/surveys/:id/preview` 問卷預覽頁
- [N/T] `/s/:slug` 問卷填答頁
- [N/T] `/surveys/:id/results` 結果分析頁
- [N/T] `/login` 登入頁

## Consistency / Auditability / Security
- [N/T] 前後端 Visible Questions 一致性能力
- [N/T] RuleGroup / LogicRule 前後端判斷一致性能力
- [N/T] 統計與原始 Response/Answer 一致性能力
