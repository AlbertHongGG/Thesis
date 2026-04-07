# 任務 Spec：問卷／表單系統（動態邏輯）
Logic-driven Dynamic Survey/Form System

---

## 1. 產品目標（Product Goal）
- 建立一套可讓管理者建立「具備動態邏輯」的問卷／表單系統，讓受訪者依據回答內容看到不同的題目流程（非線性流程）。
- 同一份問卷（Survey）可多次對外發佈收集回覆（Response）。
- 支援多種題型（Single Choice / Multiple Choice / Text / Number / Rating / Matrix）。
- 動態邏輯引擎（Logic Engine）需在前後端一致：同一份草稿答案集合（draft answers）計算出的可見題目集合（Visible Questions）一致。
- 資料需可稽核且不可竄改：
  - 問卷結構一旦發佈後不可變（Schema Stability）。
  - 回覆一旦送出不得修改（Immutability）。
  - 以 publish_hash 與 response_hash 支援一致性與稽核。
- 提供管理者即時與彙總的結果分析與匯出。

核心能力（不可退讓）
- 動態邏輯引擎（logic-driven，非靜態表單）。
- 非線性流程（允許分支、跳過題目，仍可回上一題）。
- Schema Stability：問卷一旦 Published/Closed，其題目結構不可變更。
- Immutability：Response/Answer 一旦送出不可修改，且可稽核。
- 高 UX 容錯：即時驗證、可回上一題、清晰的 Loading / Error / Empty 狀態。

明確不包含
- 僅支援線性題序、無條件分支的靜態表單產生器。

名詞定義（Glossary）
- Survey：一份問卷，擁有狀態（Draft/Published/Closed）與題目結構。
- Question：問卷題目，具有題型、順序、是否必填等欄位。
- Option：選項，提供給 Single Choice / Multiple Choice / Matrix。
- RuleGroup：規則群組，對單一 target_question 進行 AND / OR 組合。
- LogicRule：規則群組中的單條規則，定義 source_question 條件與對 target_question 的 show/hide 動作。
- Response：一次提交（submit）的回覆主檔。
- Answer：Response 中對單一 Question 的答案（JSON）。
- 可見題目集合（Visible Questions）：在某個「草稿答案集合（draft answers）」下，經邏輯引擎計算後應顯示（可回答、需驗證）的題目集合。
- publish_hash：問卷結構在發佈瞬間的不可變識別（Survey canonical JSON 雜湊）。
- response_hash：提交 payload（canonical）計算出的不可竄改雜湊。

---

## 2. 使用者角色定義（Roles）

### 2.1 Guest / Respondent（訪客／受訪者）
- 權限
  - 僅可開啟並填寫「Published」且公開可填的問卷連結（/s/:slug）。
- 可執行行為
  - 開啟問卷連結並載入問卷結構。
  - 依動態流程作答（題目顯示/隱藏由邏輯引擎決定）。
  - 若 Survey.is_anonymous=true：可匿名送出回答。
- 限制
  - 不可查看結果分析。
  - 已送出後不可修改答案。
  - 若 Survey.is_anonymous=false：送出前必須先登入成為 User，否則提交回覆得到 401。

### 2.2 User（Authenticated User，登入使用者）
- 權限
  - 可登入／登出。
  - 擁有 Session，能依帳號權限存取後台。
- 可執行行為
  - 若 Survey.is_anonymous=false：可在 /s/:slug 以記名身分送出回答（respondent_id=User.id）。
- 限制
  - 是否具備管理者能力由「是否為 Survey.owner_user_id」決定；非擁有者不得存取他人後台。

### 2.3 Admin / Form Owner（管理者／問卷擁有者）
- 定位
  - 建立與管理自己建立的問卷（Survey Owner），其身分本質為已登入 User。
- 權限
  - 完整管理自己建立的 Survey（Draft 編輯、Published/Closed 操作、結果分析、匯出）。
- 可執行行為
  - 建立/編輯問卷（Draft）。
  - 新增題目、選項、設定動態邏輯規則。
  - 預覽問卷（以邏輯引擎模擬作答，不建立 Response）。
  - 發佈/關閉問卷。
  - 查看即時結果與統計、匯出回覆。
- 限制
  - 問卷發佈後不可修改「結構」。
  - 已有回答的問卷不可刪除；可 Closed（或封存顯示）但必須保留資料。

### 2.4 權限邊界與錯誤碼（RBAC Boundaries）
- 未登入存取後台（/surveys*）：401。
- 已登入但非擁有者存取他人 Survey 後台：403。
- slug 不存在或 Survey 不可填（Draft/Closed）：404（避免洩漏是否存在）。

---

## 3. 使用者流程（User Flow）

### 3.1 Admin / Form Owner 流程
1. 前往 /login 登入。
2. 登入後進入 /surveys（我的問卷）。
3. 建立新問卷（Draft）。
4. 進入 /surveys/:id/edit 新增題目、選項與邏輯規則。
5. 進入 /surveys/:id/preview 預覽問卷（以邏輯引擎模擬作答流程；不建立 Response）。
6. 發佈問卷（Draft -> Published），後端寫入 publish_hash。
7. 查看回收狀況與統計（/surveys/:id/results）。
8. 關閉問卷（Published -> Closed）。

### 3.2 Guest / Respondent（匿名填答）流程
1. 開啟問卷連結 /s/:slug。
2. 依序作答；每次回答變更即時重新計算可見題目並更新畫面。
3. 即時顯示驗證錯誤（required/格式）。
4. 可使用「上一題」回溯修正（重新套用動態邏輯）。
5. 完成後送出問卷（Survey.is_anonymous=true）。
6. 顯示完成頁（同一路由 UI state：Completion）。

### 3.3 User（記名填答）流程
1. 開啟問卷連結 /s/:slug。
2. 填答過程同 Guest（動態邏輯、即時驗證、上一題）。
3. 若 Survey.is_anonymous=false：送出前導向 /login 登入。
4. 登入成功後回到 /s/:slug，保留草稿答案並允許繼續填寫。
5. 送出問卷（respondent_id=User.id）。
6. 顯示完成頁（Completion）。

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證
- 提供 /login 登入頁。
- Route Guard：
  - /surveys* 必須為已登入狀態，否則 401。
  - /s/:slug 可由 Guest 開啟，但是否可提交依 Survey.is_anonymous 決定。
- 登入後需支援「返回原本頁面」：
  - 若在 /s/:slug 因記名提交被 401，完成登入後需回到同一 slug 並保留草稿答案。

### 4.2 核心資料管理（CRUD）

#### 4.2.1 Survey（管理者）
- Admin 可建立 Survey（Draft）。
- Admin 可在 Draft 狀態編輯 Survey：
  - 可編輯結構性內容：Questions / Options / RuleGroups / LogicRules。
  - 可設定 Survey.is_anonymous（是否匿名）。
- Published/Closed 狀態下，Survey 結構不可變；僅允許非結構更新白名單：Survey.title、Survey.description。
- Survey.slug 建立後固定不可變，且在系統內必須唯一。
- 刪除規則：
  - 若 Survey 已有任何 Response：禁止刪除。
  - 若 Survey 無 Response：是否提供刪除功能以產品決策為準；若提供也只能刪除 Draft。

#### 4.2.2 Question / Option（管理者）
- Draft 狀態下允許：新增/刪除/重排題目（order）、設定 required、設定題型與題目文案。
- 題型支援：Single Choice / Multiple Choice / Text / Number / Rating / Matrix。
- Option：
  - 只適用於 Single Choice / Multiple Choice / Matrix。
  - Option.value 必須在同一 Question 下唯一。

#### 4.2.3 RuleGroup / LogicRule（管理者）
- Admin 可針對每個 target_question 建立一或多個 RuleGroup。
- RuleGroup：action（show/hide）、group_operator（AND/OR）、rules（LogicRule 列表）。
- LogicRule：source_question_id、operator（equals/not_equals/contains）、value、target_question_id。

### 4.3 狀態機 / 規則 / 限制

#### 4.3.1 Survey 狀態機
- 狀態：Draft / Published / Closed。
- 合法轉換：
  - Draft -> Published（Admin 觸發）。
  - Published -> Closed（Admin 觸發）。
- 限制：
  - 狀態不可回退（Closed 不可再開啟）。

#### 4.3.2 Schema Stability（結構不可變）
- 當 Survey.status 為 Published 或 Closed：
  - 禁止修改 Question/Option/RuleGroup/LogicRule 的結構性欄位（type/order/is_required、選項集合、邏輯規則、id 對應關係等）。
  - 禁止新增/刪除 Question、Option、RuleGroup、LogicRule。
- Draft -> Published 時：
  - 後端以 Survey 結構 canonical JSON 計算 publish_hash 並寫入 Survey.publish_hash。
  - 後續所有 Response 必須記錄相同 publish_hash。

#### 4.3.3 動態邏輯引擎（Logic Engine）
目的：根據目前已填答案集合（draft answers）計算「可見題目集合（Visible Questions）」。

規則約束（保存 Draft 時即驗證）
1) 僅允許「往後題目」做邏輯控制
- 任一 LogicRule 的 target_question.order 必須 > source_question.order。

2) 不允許循環依賴
- 以 Question 為節點、任一 LogicRule（source -> target）為邊建圖，不可形成 cycle。
- 若偵測到 cycle：保存失敗，回傳可定位錯誤（包含 cycle path 的 question_id 序列）。

3) RuleGroup 內規則可用 AND/OR 聚合
- group_operator=AND：所有規則為 true，群組為 true。
- group_operator=OR：任一規則為 true，群組為 true。

4) 可見性合併策略（前後端一致）
- 基準：所有題目預設 visible = true。
- 對每個 target_question：
  - 若存在 action=hide 的 RuleGroup：只要任一 hide 群組條件成立，则 target_question = hidden（隱藏優先）。
  - 否則若存在 action=show 的 RuleGroup：
    - 只要任一 show 群組條件成立，则 target_question = visible。
    - 若所有 show 群組條件皆不成立，则 target_question = hidden。
  - 若同時存在 show 與 hide：hide 優先。

5) 題目可見性與答案一致
- 若題目變為 hidden：
  - 前端草稿答案需清除（或標記為無效且不送出）。
  - 後端提交時必須拒收 hidden 題目的答案。

operator 語意
- equals：source_question 的答案值（canonical）必須等於 value。
- not_equals：source_question 的答案值（canonical）必須不等於 value。
- contains：
  - 若答案為陣列：陣列包含 value。
  - 若答案為字串：字串包含 value。

計算時機
- /s/:slug 填答頁：
  - 載入 Survey 結構後建立本地 draft answers。
  - 每次任一答案變更即觸發重算 Visible Questions。
  - 重算後若有題目從 visible -> hidden，立即清除其草稿答案。

#### 4.3.4 「上一題」與非線性流程
- 前端需支持回上一題；回上一題後修改答案會重新計算可見題目集合。
- required 驗證僅針對最終 visible 的題目。
- 前端允許回到任何「已回答過且目前仍可見」的題目。

#### 4.3.5 提交一致性（Server-side Recompute）
提交 Response 時，後端必須：
1) 以該 Survey 的 publish_hash 對應之結構重算 Visible Questions。
2) 拒絕任何 hidden 題目的答案。
3) 對所有 visible 且 is_required=true 的題目做 required 驗證。
4) 對每個 Answer.value 做題型 JSON schema 驗證與大小限制。

### 4.4 主要頁面需求

#### 4.4.1 頁面清單（Page Inventory）
- 問卷列表：/surveys
- 問卷編輯：/surveys/:id/edit
- 問卷預覽：/surveys/:id/preview
- 問卷填答：/s/:slug
- 結果分析：/surveys/:id/results
- 登入：/login

#### 4.4.2 各頁面責任（Page Responsibilities）

/surveys（我的問卷）
- 顯示目前登入使用者擁有的 Surveys（含狀態 Draft/Published/Closed）。
- 主要操作：建立新 Survey（Draft）、進入編輯、進入預覽、進入結果、關閉問卷（若允許在列表操作）。
- Page-level 狀態：Loading / Error / Empty（尚無問卷）。

/surveys/:id/edit（編輯問卷）
- 僅 Draft 可編輯結構。
- 內容包含：Survey 基本資訊（title/description/is_anonymous）、Questions/Options 管理、RuleGroups/LogicRules 管理。
- 保存 Draft 時執行規則驗證：forward-only、cycle detection、資料完整性。
- 若 Survey 已 Published/Closed：
  - 結構編輯 UI 必須禁用；僅允許白名單欄位（title/description）更新。
- Page-level 狀態：Loading / Error / Empty（問卷不存在或不可存取）。

/surveys/:id/preview（預覽問卷）
- 用已保存的 Draft 結構在前端運行同一套 Logic Engine 模擬填答流程。
- 不建立 Response，不產生 response_hash。
- Page-level 狀態：Loading / Error / Empty（問卷無題目）。

/s/:slug（填答問卷）
- 逐題模式顯示當前題目，提供下一題/上一題。
- 每次答案變更即重算 Visible Questions，並即時反映顯示/隱藏。
- 驗證：required（僅 visible 題目）、題型格式（Text/Number/Rating/Matrix 等）。
- 提交：
  - Published 且可填才允許提交。
  - 記名填答要求登入；匿名填答不要求登入。
- UI 狀態：Loading / Error / Empty / Completion。

/surveys/:id/results（結果分析）
- 顯示即時回收狀況與彙總統計（例如：回覆數、各題分佈/加總，依題型呈現）。
- 僅 Admin（owner）可見。
- 需可匯出回覆資料（依 Response/Answer）。
- Page-level 狀態：Loading / Error / Empty（尚無回覆）。

/login（登入）
- 提供登入表單。
- 登入成功後導回：
  - 若存在 return_to（例如來自 /s/:slug 記名提交）：導回原頁。
  - 否則導到 /surveys。
- Page-level 狀態：Loading（提交中）/ Error（登入失敗訊息）。

#### 4.4.3 主要 CTA 與互動（Primary CTAs/Interactions）
- /surveys
  - CTA：建立新問卷、進入 edit / preview / results、關閉問卷。
- /surveys/:id/edit
  - CTA：新增題目、刪除題目、題目排序、題型選擇、設定 required、新增選項、編輯規則群組、保存草稿、發佈。
- /surveys/:id/preview
  - CTA：開始預覽、下一題/上一題、重設草稿答案。
- /s/:slug
  - CTA：下一題/上一題、送出。
- /surveys/:id/results
  - CTA：匯出、切換統計視圖（若有）。
- /login
  - CTA：登入。

#### 4.4.4 資訊架構與導覽（Information Architecture & Navigation）

頁面清單（Page Inventory）
- 以 4.4.1 為準。

路由存取控制（Route Access Control）
- /login：Guest/User/Admin 皆可進入。
- /s/:slug：Guest/User/Admin 皆可進入；但提交行為需依 Survey.is_anonymous 與登入狀態決定。
- /surveys、/surveys/:id/edit、/surveys/:id/preview、/surveys/:id/results：僅 User/Admin 可進入；若未登入：401。
- /surveys/:id/*：若已登入但非 owner：403。

導覽列/Header 規則（Navigation Visibility Rules）
- Guest Header：
  - 只顯示「登入」入口（導向 /login）。
  - 不顯示任何 /surveys* 的導覽入口。
- User/Admin Header：
  - 顯示「我的問卷」（/surveys）與「登出」。
  - 不顯示與自己無關的 Survey 管理入口（例如不可直接跳到他人的 /surveys/:id/*）。

全站共用元件責任（Layout Responsibility）
- Header/導航只放跨頁共用入口（登入/登出、我的問卷）。
- 各頁面自身 CTA（建立、保存、發佈、送出、匯出）只放在該頁主內容區，避免與 Header 重複。
- CTA 去重規則：若 Header 已顯示「登入」，/login 頁面內不再顯示第二個等價登入 CTA（可保留單一主要提交按鈕）。

---

## 5. 非功能需求（Non-functional Requirements）

### 5.1 資料一致性（Consistency）
- 前端顯示題目集合 必須等於 後端根據同一答案重算出的 Visible Questions。
- 邏輯規則判斷需前後一致（RuleGroup/LogicRule evaluation 不得分歧）。

### 5.2 安全性（Security）
- 防止偽造回答：
  - 僅允許對 Published 問卷建立 Response。
  - 伺服端重算可見性與 required、schema 驗證，禁止依前端聲稱。
- 回答 API 不可修改既有資料（Response/Answer immutable；只允許 create，不允許 update）。
- 防止惡意注入 JSON：
  - 對 Answer.value 做 schema 驗證與大小限制。
  - 對 Text 輸出做編碼（避免 XSS）。
- 權限邊界：
  - Admin 只能管理自己擁有的 Survey。
  - 未登入存取後台：401；非 owner：403。
- 基本濫用防護：對提交行為做最小限度的速率限制（以避免重複送出或簡單濫用），不得影響合法填答。

### 5.3 UX 狀態與可靠性（UX & Resilience）
- Loading：題目與規則載入中。
- Error：
  - 邏輯衝突（例如偵測到循環依賴）需可定位。
  - 驗證錯誤（required/格式）以 inline 顯示。
  - API 失敗（5xx）需顯示可重試，且保留草稿答案於前端。
- Empty：
  - 問卷無題目。
  - 問卷狀態非 Published（Draft/Closed）或 slug 不存在：404。
- Completion：提交成功後的完成狀態（同一路由 UI state）。
- RWD：支援桌機與手機基本可用（主要填答與管理流程可操作）。

### 5.4 稽核（Auditability）
- 每筆 Response 必須保存 publish_hash 與 response_hash。
- 後台結果頁必須能辨識該 Response 對應的 publish_hash（用於稽核與一致性追查）。

---

## 6. 資料模型（Data Model）

### 6.1 User
- id: UUID
- email: string（唯一）
- password_hash: string（或等價的認證憑證）
- created_at: datetime

### 6.2 Survey
- id: UUID
- owner_user_id: UUID（FK -> User.id）
- slug: string（唯一、建立後不可變）
- title: string（必填）
- description: text（選填）
- is_anonymous: boolean（必填）
- status: enum（Draft/Published/Closed，必填）
- publish_hash: string nullable（Draft 為 null，Published/Closed 必填）
- created_at: datetime（必填）

### 6.3 Question
- id: UUID
- survey_id: UUID（FK -> Survey.id）
- type: enum（Single Choice / Multiple Choice / Text / Number / Rating / Matrix）
- title: string
- is_required: boolean
- order: int

### 6.4 Option
- id: UUID
- question_id: UUID（FK -> Question.id）
- label: string
- value: string

### 6.5 RuleGroup
- id: UUID
- survey_id: UUID（FK -> Survey.id）
- target_question_id: UUID（FK -> Question.id）
- action: enum（show / hide）
- group_operator: enum（AND / OR）

### 6.6 LogicRule
- id: UUID
- rule_group_id: UUID（FK -> RuleGroup.id）
- source_question_id: UUID（FK -> Question.id）
- operator: enum（equals / not_equals / contains）
- value: string

### 6.7 Response
- id: UUID
- survey_id: UUID（FK -> Survey.id）
- respondent_id: UUID nullable（Survey.is_anonymous=true 必須為 null；false 必須為 User.id）
- publish_hash: string（必填）
- response_hash: string（必填）
- submitted_at: datetime

### 6.8 Answer
- id: UUID
- response_id: UUID（FK -> Response.id）
- question_id: UUID（FK -> Question.id）
- value: JSON

### 6.9 Answer.value JSON schema（摘要）
- Single Choice：string（Option.value）
- Multiple Choice：string[]（Option.value list）
- Text：string（長度限制）
- Number：number（範圍可選）
- Rating：number（整數，範圍可選）
- Matrix：object（key 為 row/column 的組合識別，value 為選擇結果；大小限制）

關聯與限制摘要
- Survey 1:N Question
- Question 1:N Option
- Survey 1:N RuleGroup；RuleGroup 1:N LogicRule
- Survey 1:N Response；Response 1:N Answer
- 不可變性：Response/Answer 只允許新增，不允許更新/刪除。
