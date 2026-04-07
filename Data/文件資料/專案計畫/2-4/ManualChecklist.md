# 人工驗收確認表（問卷／表單系統：動態邏輯）

## 1. 環境與前置條件
- [ ] 準備三種帳號狀態：未登入（Guest）、一般登入（User）、問卷擁有者（Admin / Form Owner）。
- [ ] 準備至少 1 份 `Draft` 問卷、1 份 `Published` 問卷、1 份 `Closed` 問卷。
- [ ] 準備至少 1 份 `Published` 且 `is_anonymous=true` 的問卷（匿名填答測試）。
- [ ] 準備至少 1 份 `Published` 且 `is_anonymous=false` 的問卷（記名填答測試）。
- [ ] 問卷題型覆蓋 Single Choice / Multiple Choice / Text / Number / Rating / Matrix。
- [ ] 問卷規則覆蓋 `show`、`hide`、RuleGroup `AND`、RuleGroup `OR`。
- [ ] 準備可觸發 `visible -> hidden` 的題目組合，驗證草稿答案清除行為。
- [ ] 準備至少一份有 Response 的問卷與一份無 Response 的問卷（刪除/結果頁 Empty 驗證）。
- [ ] 測試環境可觀察 HTTP 狀態碼（401/403/404/5xx）與頁面導向行為。
- [ ] 使用桌機與手機版面進行同一流程驗證（填答與管理都可操作）。

## 2. 角色與權限邊界

### 2.1 Guest（未登入）
- [ ] Guest 可進入 `/login`。
- [ ] Guest 可進入 `/s/:slug`。
- [ ] Guest 存取 `/surveys` 或 `/surveys/:id/*` 會收到 401。
- [ ] Guest 在 `is_anonymous=true` 問卷可成功提交。
- [ ] Guest 在 `is_anonymous=false` 問卷提交時會收到 401 並導向 `/login`。

### 2.2 User（已登入，非 owner）
- [ ] User 可進入 `/surveys`（僅見自己可見內容，不可越權進入他人後台）。
- [ ] User 可在 `is_anonymous=false` 問卷以記名身分提交（`respondent_id=User.id`）。
- [ ] User 開啟他人 `/surveys/:id/edit` 會收到 403。
- [ ] User 開啟他人 `/surveys/:id/preview` 會收到 403。
- [ ] User 開啟他人 `/surveys/:id/results` 會收到 403。

### 2.3 Admin / Form Owner（問卷擁有者）
- [ ] Admin 可建立 Draft 問卷。
- [ ] Admin 可編輯 Draft 的 Questions / Options / RuleGroups / LogicRules。
- [ ] Admin 可預覽 Draft 並執行邏輯模擬（不建立 Response）。
- [ ] Admin 可將 Draft 發佈為 Published，並寫入 `publish_hash`。
- [ ] Admin 可關閉 Published 問卷為 Closed。
- [ ] Admin 可檢視 `/surveys/:id/results` 並匯出回覆資料。

### 2.4 跨帳號資料隔離（owner 邊界）
- [ ] 以非 owner 帳號直接存取他人 `/surveys/:id/edit`，回應為 403 且不顯示問卷內容。
- [ ] 以非 owner 帳號直接存取他人 `/surveys/:id/results`，回應為 403 且不顯示回覆統計。
- [ ] 非 owner 無法透過 UI 入口跳轉到他人 Survey 後台功能。

## 3. 端到端主流程（對應 User Flow）

### 3.1 Admin / Form Owner 主流程
- [ ] 可從 `/login` 成功登入。
- [ ] 登入後可進入 `/surveys` 並看到「我的問卷」。
- [ ] 可建立新 Survey，預設狀態為 `Draft`。
- [ ] 可進入 `/surveys/:id/edit` 完成題目、選項與規則設定並成功保存草稿。
- [ ] 可進入 `/surveys/:id/preview` 模擬填答，驗證邏輯顯示/隱藏正確且不建立 Response。
- [ ] 可將 Survey 從 `Draft -> Published`，並驗證 `publish_hash` 已寫入。
- [ ] 可進入 `/surveys/:id/results` 查看回收狀況與彙總統計。
- [ ] 可將 Survey 從 `Published -> Closed`。

### 3.2 Guest / Respondent（匿名填答）主流程
- [ ] Guest 可開啟 `/s/:slug` 並載入 `Published` 問卷。
- [ ] 每次回答變更都會即時重算可見題目集合並更新畫面。
- [ ] required/格式錯誤會即時顯示在對應題目。
- [ ] 可使用「上一題」回溯修正，修正後邏輯會重新套用。
- [ ] 在 `is_anonymous=true` 問卷可成功送出。
- [ ] 送出成功後顯示 Completion 狀態，且無修改既有回答的入口。

### 3.3 User（記名填答）主流程
- [ ] User 可開啟 `/s/:slug` 並完成填答。
- [ ] 在 `is_anonymous=false` 問卷，未登入提交會被導向 `/login`。
- [ ] 登入成功後會回到原本 `/s/:slug`（`return_to` 生效）。
- [ ] 回到填答頁後草稿答案仍保留。
- [ ] 可完成提交並寫入 `respondent_id=User.id`。
- [ ] 顯示 Completion 狀態且不允許修改已提交答案。

## 4. 功能需求驗收（依功能子節）

### 4.1 帳號與認證
- [ ] `/login` 成功登入後建立 Session，Header 切換為顯示「我的問卷」與「登出」。
- [ ] `/login` 失敗登入時顯示錯誤訊息，維持未登入狀態。
- [ ] 未登入直接存取 `/surveys*` 一律 401。
- [ ] 記名問卷提交遇 401 後，登入成功會回到原 slug 並保留草稿答案。
- [ ] `/s/:slug` 對 Guest 可開啟，但提交權限依 `is_anonymous` 控制。

### 4.2 核心資料管理（CRUD）

#### 4.2.1 Survey
- [ ] 可建立 Survey（`Draft`）成功。
- [ ] `Draft` 可編輯結構性內容（Questions / Options / RuleGroups / LogicRules）。
- [ ] `Published`/`Closed` 結構編輯被拒絕（僅允許 `title`、`description`）。
- [ ] `slug` 建立後不可變且系統內唯一。
- [ ] 有任何 Response 的 Survey 無法刪除。
- [ ] 無 Response 的 Draft（若產品有提供刪除）可刪除，且刪除後清單同步更新。

#### 4.2.2 Question / Option
- [ ] Draft 狀態可新增題目。
- [ ] Draft 狀態可刪除題目。
- [ ] Draft 狀態可重排題目 `order`。
- [ ] Draft 狀態可設定 `is_required`。
- [ ] 題型可正確設定為 Single Choice / Multiple Choice / Text / Number / Rating / Matrix。
- [ ] Option 僅在 Single Choice / Multiple Choice / Matrix 可編輯。
- [ ] 同一 Question 下 `Option.value` 重複時會被拒絕並顯示可定位錯誤。

#### 4.2.3 RuleGroup / LogicRule
- [ ] 可為同一 `target_question` 建立多個 RuleGroup。
- [ ] RuleGroup `action` 可設定 `show` 或 `hide`。
- [ ] RuleGroup `group_operator` 可設定 `AND` 或 `OR`。
- [ ] LogicRule 可設定 `source_question_id`、`operator`、`value`、`target_question_id`。
- [ ] 儲存 Draft 時會驗證 forward-only（`target.order > source.order`）。
- [ ] 儲存 Draft 時會做 cycle detection；若循環存在，回應含 cycle path 可定位修正。

### 4.3 狀態機 / 規則 / 限制

#### 4.3.1 Survey 狀態機
- [ ] Survey 只允許 `Draft -> Published`。
- [ ] Survey 只允許 `Published -> Closed`。
- [ ] `Closed` 不可回退為 `Published` 或 `Draft`。

#### 4.3.2 Schema Stability
- [ ] `Published` 或 `Closed` 時禁止新增/刪除 Question。
- [ ] `Published` 或 `Closed` 時禁止新增/刪除 Option。
- [ ] `Published` 或 `Closed` 時禁止新增/刪除 RuleGroup / LogicRule。
- [ ] `Published` 或 `Closed` 時禁止修改結構欄位（type/order/is_required、選項集合、規則與關聯）。
- [ ] 發佈瞬間會計算並寫入 `publish_hash`，後續回覆引用同一 `publish_hash`。

#### 4.3.3 動態邏輯引擎
- [ ] 任一答案變更都觸發可見題目重算。
- [ ] `hide` 規則成立時優先隱藏（即使 `show` 規則存在）。
- [ ] 若只有 `show` 規則且全不成立，目標題目為 hidden。
- [ ] 題目由 visible 轉 hidden 時，前端草稿答案會被清除或標記無效且不送出。
- [ ] `equals`、`not_equals`、`contains` 對應行為符合定義（含字串/陣列 contains）。

#### 4.3.4 上一題與非線性流程
- [ ] 可回到「已回答過且目前仍可見」的題目。
- [ ] 回上一題修改答案後，後續題目的可見性會重新計算。
- [ ] required 驗證僅作用於最終 visible 題目。

#### 4.3.5 提交一致性（Server-side Recompute）
- [ ] 提交時後端使用該 Survey `publish_hash` 對應結構重算可見題目。
- [ ] 後端拒收 hidden 題目的答案。
- [ ] 後端檢查 visible 且 `is_required=true` 題目必填。
- [ ] 後端檢查 `Answer.value` 的題型 schema 與大小限制。
- [ ] 成功提交時建立 Response/Answer，失敗提交不寫入任何 Response/Answer。

### 4.4 主要頁面需求

#### 4.4.1 `/surveys`
- [ ] 可顯示登入者擁有的 Surveys（含 Draft/Published/Closed）。
- [ ] 可建立新 Survey（Draft）。
- [ ] 可進入 edit / preview / results。
- [ ] Page-level `Loading / Error / Empty` 狀態可正確顯示。

#### 4.4.2 `/surveys/:id/edit`
- [ ] Draft 可完整編輯結構。
- [ ] `Published`/`Closed` 僅可改 `title`/`description`。
- [ ] 保存 Draft 會執行規則驗證（forward-only、cycle detection、資料完整性）。
- [ ] Page-level `Loading / Error / Empty` 狀態可正確顯示。

#### 4.4.3 `/surveys/:id/preview`
- [ ] 使用已保存結構執行前端邏輯模擬。
- [ ] 預覽過程不建立 Response，不產生 `response_hash`。
- [ ] Survey 無題目時顯示 Empty。
- [ ] Page-level `Loading / Error` 狀態可正確顯示。

#### 4.4.4 `/s/:slug`
- [ ] 顯示逐題模式與上一題/下一題互動。
- [ ] 每次答案變更都會即時重算可見題目。
- [ ] required 與題型格式驗證可在提交前提示。
- [ ] 只允許 `Published` 且可填的問卷提交。
- [ ] UI 狀態 `Loading / Error / Empty / Completion` 可正確呈現。

#### 4.4.5 `/surveys/:id/results`
- [ ] 只允許 owner 存取。
- [ ] 顯示即時回收狀況與彙總統計。
- [ ] 可匯出回覆資料。
- [ ] Page-level `Loading / Error / Empty` 狀態可正確顯示。

#### 4.4.6 `/login`
- [ ] 顯示登入表單並可提交。
- [ ] 成功登入後若有 `return_to` 導回原頁，否則導回 `/surveys`。
- [ ] 提交中顯示 Loading，登入失敗顯示 Error。

## 5. 資料一致性驗收
- [ ] 前端可見題目集合與後端重算結果一致。
- [ ] 同一份提交資料重送時，`response_hash` 計算規則一致且可稽核。
- [ ] 結果頁統計與 Response/Answer 原始資料一致。
- [ ] 匯出回覆資料集合與結果頁當前資料範圍一致。
- [ ] `Published` 後回覆所記錄 `publish_hash` 與問卷發佈版本一致。

## 6. 安全性驗收
- [ ] 僅 `Published` 問卷可建立 Response。
- [ ] 回答 API 不提供修改既有 Response/Answer 的能力。
- [ ] Text 題輸出有編碼處理，避免 XSS 注入。
- [ ] 非 owner 無法管理他人 Survey（403）。
- [ ] 提交行為具備最小限度速率限制，能降低重複送出濫用。

## 7. 全站狀態品質與錯誤碼

### 7.1 Loading / Error / Empty / Retry
- [ ] 各主要頁面在首次載入時顯示 Loading。
- [ ] API 失敗（5xx）時顯示 Error 並提供 Retry。
- [ ] Retry 成功後可回到 Ready/可操作狀態。
- [ ] `/surveys` 無資料時顯示 Empty。
- [ ] `/surveys/:id/results` 無回覆時顯示 Empty。
- [ ] `/surveys/:id/preview` 無題目時顯示 Empty。

### 7.2 錯誤碼與導向
- [ ] 未登入存取 `/surveys*` 回應 401，並導向或提示登入。
- [ ] 已登入非 owner 存取他人 Survey 後台回應 403。
- [ ] `/s/:slug` 對不存在 slug 或 Draft/Closed 問卷回應 404。
- [ ] 發生 5xx 時，填答頁會保留草稿答案並可重試。

## 8. 稽核與不可變性
- [ ] 每筆 Response 都保存 `publish_hash`。
- [ ] 每筆 Response 都保存 `response_hash`。
- [ ] 後台結果頁可辨識每筆回覆對應的 `publish_hash`。
- [ ] 已提交 Response/Answer 無編輯/刪除入口與 API。

## 9. RWD 與可用性
- [ ] 桌機版可完整執行 Admin 建立/編輯/發佈/查看結果流程。
- [ ] 手機版可完整執行 `/s/:slug` 填答與提交流程。
- [ ] 手機版「上一題/下一題/送出」操作不互相遮擋。
- [ ] 各頁錯誤訊息在手機版可讀且可重試操作。
- [ ] 完成頁（Completion）在桌機與手機都可清楚辨識提交成功。

## 10. 分角色測試收斂清單

### 10.1 Guest（可做 / 不可做）
- [ ] 可做：開啟 `/s/:slug` 並在匿名問卷提交。
- [ ] 可做：進入 `/login`。
- [ ] 不可做：進入 `/surveys`。
- [ ] 不可做：查看 `/surveys/:id/results`。

### 10.2 User（可做 / 不可做）
- [ ] 可做：登入後提交記名問卷。
- [ ] 可做：在 401 後登入並返回原問卷繼續提交。
- [ ] 不可做：編輯他人 Survey。
- [ ] 不可做：查看他人 Survey 結果。

### 10.3 Admin / Form Owner（可做 / 不可做）
- [ ] 可做：建立 Draft、編輯結構、預覽、發佈、關閉、查看結果、匯出。
- [ ] 可做：在 Published/Closed 僅更新 `title`/`description`。
- [ ] 不可做：在 Published/Closed 修改結構欄位與規則。
- [ ] 不可做：將 `Closed` 回退成 `Published` 或 `Draft`。
