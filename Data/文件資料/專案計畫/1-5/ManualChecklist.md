# 人工驗收確認表（Manual QA Checklist）
內部文件審核與簽核系統

---

## 環境 / 前置條件
- [ ] 準備測試帳號各 1（role=User / Reviewer / Admin），並確認三者 email 皆唯一
- [ ] 準備另一個 User 帳號（用於跨帳號資料隔離 / IDOR 測試）
- [ ] 準備至少 1 個啟用中的流程模板（ApprovalFlowTemplate.is_active=true），且至少 1 個步驟，且每個步驟都有 assignee
- [ ] 準備至少 1 個停用中的流程模板（is_active=false），用於驗證送審前置條件
- [ ] 測試瀏覽器至少包含 Chrome（或 Edge）
- [ ] 確認系統時間與時區一致（created_at/updated_at/acted_at 顯示不應出現明顯時差）
- [ ] 準備 1 份可用的附件檔案（任意小檔），以及 1 份超出限制情境用檔案（若系統有上傳限制則用於驗證錯誤）
- [ ] 準備測試資料：至少 2 份不同狀態文件（Draft / In Review / Rejected / Approved / Archived 盡量覆蓋）
- [ ] 確認各頁面路由存在：/login、/documents、/documents/:id、/reviews、/admin/flows

---

## 角色與權限邊界（RBAC / Route Access Control）

### Guest（未登入）
- [ ] 可進入 /login 並看到登入表單（Email/Password）
- [ ] 嘗試直接進入 /documents 會觸發 401 並導向 /login
- [ ] 嘗試直接進入 /documents/:id 會觸發 401 並導向 /login
- [ ] 嘗試直接進入 /reviews 會觸發 401 並導向 /login
- [ ] 嘗試直接進入 /admin/flows 會觸發 401 並導向 /login
- [ ] Header 僅顯示「登入」，不顯示「文件」「待辦」「流程模板」「登出」

### User（申請人）
- [ ] 登入成功後預設導向 /documents
- [ ] 可進入 /documents 與 /documents/:id（僅限自己建立的文件）
- [ ] 嘗試進入 /reviews 會顯示 403 Forbidden（或被路由阻擋），且不可看到任何待辦內容
- [ ] 嘗試進入 /admin/flows 會顯示 403 Forbidden（或被路由阻擋）
- [ ] Header 顯示「文件」「登出」，不顯示「待辦」「流程模板」
- [ ] 以 User 直接輸入他人文件的 /documents/:id 會回 404 Not Found（避免 IDOR）

### Reviewer（審核者）
- [ ] 登入成功後預設導向 /reviews
- [ ] 可進入 /reviews 並僅看到 assignee=自己 且 status=Pending 的任務
- [ ] 可進入 /documents/:id（限有被指派審核任務的文件）
- [ ] 嘗試進入 /documents 會顯示 403 Forbidden（或被路由阻擋），且不可看到全量文件列表
- [ ] 嘗試進入 /admin/flows 會顯示 403 Forbidden（或被路由阻擋）
- [ ] Header 顯示「待辦」「登出」，不顯示「文件」「流程模板」
- [ ] Reviewer 直接輸入與自己無任何任務關聯的 /documents/:id 會回 404 Not Found（避免文件存在性洩漏）

### Admin（管理員）
- [ ] 登入成功後預設導向 /documents
- [ ] 可進入 /documents 並看到所有文件（不限 owner）
- [ ] 可進入 /documents/:id 並查看任意文件詳情
- [ ] 可進入 /admin/flows 並管理流程模板
- [ ] Header 顯示「文件」「流程模板」「登出」

---

## 端到端主流程（對應 User Flow）

### User（申請人）主流程
- [ ] 登入後進入 /documents，列表成功載入（有 Loading 狀態，成功後轉為 Ready/Empty）
- [ ] 在 /documents 點擊「建立文件」會建立一份新文件，初始 status=Draft，列表可見新項
- [ ] 進入新文件 /documents/:id，確認可看到 title/status/current_version_id 與版本/附件/審核紀錄/稽核事件區塊
- [ ] 在 status=Draft 時可以編輯 title 與 content 並成功保存，updated_at 更新且列表與詳情一致
- [ ] 在 status=Draft 時可以上傳附件，上傳成功後附件清單立即出現新附件（綁定到 current_version_id 的 Draft 版本）
- [ ] 在 status=Draft 點擊「送出簽核」會進入送出中狀態（按鈕 disabled、防重送）
- [ ] 送審成功後文件 status 進入 In Review，且 current_version_id 指向送審鎖定版本
- [ ] 文件進入 In Review 後，User 端不再顯示「編輯」「上傳附件」「送出簽核」入口（只讀）
- [ ] 若文件被退回後進入 Rejected，User 在 /documents/:id 看到「退回後修改」入口
- [ ] 點擊「退回後修改」成功後文件進入 Draft，且 current_version_id 指向新的 Draft 版本（version_no 遞增）
- [ ] 在新 Draft 版本完成修改後可再次送審，成功後再次進入 In Review
- [ ] 所有必要同意完成後文件 status 進入 Approved，User 在詳情看到已核准狀態且仍為只讀

### Reviewer（審核者）主流程
- [ ] 登入後進入 /reviews，待辦列表成功載入（有 Loading 狀態，成功後 Ready/Empty）
- [ ] 點擊一筆待辦進入 /documents/:id，可看到送審版本內容與附件
- [ ] 若選擇「退回」，必須輸入退回理由；理由空值時不得送出
- [ ] 退回送出成功後文件 status 變為 Rejected，且其餘尚未完成任務被標記為 Cancelled
- [ ] 退回後回到 /reviews，該任務不再出現在 Pending 列表
- [ ] 若選擇「同意」，送出成功後該 ReviewTask.status 變為 Approved 且 acted_at 有值
- [ ] 若為最後一個必要同意，文件 status 由 In Review 變為 Approved
- [ ] 同意後回到 /reviews，已處理任務不再出現在 Pending 列表

### Admin（管理員）主流程
- [ ] 登入後進入 /documents，可開啟任意 /documents/:id 並看到完整審核歷程與稽核事件
- [ ] 進入 /admin/flows 可看到流程模板列表（含 is_active 狀態）
- [ ] 可建立流程模板（含步驟順序設定、mode、assignee 規則），建立後列表可見
- [ ] 可編輯既有流程模板，更新後 updated_at（或 UI 顯示的更新時間）同步變更
- [ ] 可停用流程模板（is_active=false），停用後不可再用於送審
- [ ] 對 status=Approved 文件執行「封存」成功後 status 變為 Archived，且寫入對應稽核事件

---

## 全站狀態品質（Loading / Error / Empty / Retry）

### /login
- [ ] /login 初次載入不顯示錯誤訊息，表單可輸入
- [ ] 送出登入後顯示 Submitting 狀態，按鈕 disabled
- [ ] 登入失敗時顯示明確錯誤（例如帳密錯誤），且可再次送出

### /documents
- [ ] 進入 /documents 會先顯示 Loading，成功後顯示列表
- [ ] 列表為空時顯示 Empty 狀態，且仍提供「建立文件」入口（角色允許時）
- [ ] API 失敗時顯示 Error 狀態並提供 Retry
- [ ] 點 Retry 會重新拉取資料，成功後恢復為 Ready/Empty

### /documents/:id
- [ ] 進入詳情先顯示 Loading，且不顯示上一份文件的殘留資料
- [ ] 取得詳情失敗（5xx/網路）顯示 Error 並提供 Retry
- [ ] 403 Forbidden 時顯示 Forbidden，且不提供寫入型操作入口
- [ ] 404 Not Found 時顯示 Not Found，且不提供任何操作入口
- [ ] 點 Retry 可重新拉取資料，成功後回到 Ready

### /reviews
- [ ] 進入 /reviews 顯示 Loading，成功後顯示 Pending 任務列表
- [ ] 無 Pending 時顯示 Empty 狀態
- [ ] API 失敗時顯示 Error 與 Retry；Retry 成功後回到 Ready/Empty

### /admin/flows
- [ ] 進入 /admin/flows 顯示 Loading，成功後顯示模板列表
- [ ] 無模板時顯示 Empty 與建立入口
- [ ] API 失敗時顯示 Error 與 Retry；Retry 成功後回到 Ready/Empty

---

## 錯誤碼與導向（401/403/404/5xx）
- [ ] token 無效/過期時，受保護 API 回 401
- [ ] 前端遇到 401：若在受保護頁面，會導向 /login
- [ ] 前端遇到 401：若為操作型 API（送審/同意/退回/封存），會顯示可理解錯誤後導向 /login
- [ ] User 進入 /reviews 與 /admin/flows 時，結果為 403 Forbidden（或被 route guard 阻擋），且不可看到頁面資料
- [ ] Reviewer 進入 /documents 與 /admin/flows 時，結果為 403 Forbidden（或被 route guard 阻擋）
- [ ] Reviewer 存取與自己無任務關聯的 /documents/:id 時，回 404 Not Found（避免洩漏存在性）
- [ ] User 存取他人 /documents/:id 時，回 404 Not Found（避免 IDOR）
- [ ] 後端回 5xx 時前端顯示 Error 狀態且可 Retry，不顯示半成品或過期資料

---

## RWD / 可用性
- [ ] 於小螢幕下仍可完成登入、查看列表、進入詳情、送審等主流程（不需橫向捲動才能操作主要按鈕）
- [ ] 表單欄位錯誤與系統錯誤提示清楚可讀，不被遮擋
- [ ] 重要操作（送出簽核/同意/退回/封存）在操作中狀態可明確辨識，且按鈕 disabled 防重送

---

## 功能需求驗收（依功能需求章節推導）

## 帳號與認證（Authentication）

### 登入（Email + Password）
- [ ] 使用正確帳密登入成功並取得有效 token
- [ ] 使用錯誤密碼登入失敗，錯誤訊息明確且不洩漏是否存在該 email
- [ ] Email 欄位為必要欄位；空值不得送出或送出後回明確錯誤
- [ ] Password 欄位為必要欄位；空值不得送出或送出後回明確錯誤
- [ ] 登入成功後依 role 導向：User/Admin → /documents；Reviewer → /reviews
- [ ] 登入成功後嘗試回到 /login 會被導回預設頁

### Token-based session
- [ ] token 有效時可正常呼叫受保護 API 並載入頁面資料
- [ ] token 過期/無效時任何受保護 API 回 401
- [ ] token 過期/無效時，前端清除 session 並導向 /login

### 登出
- [ ] 點擊「登出」後 token 失效（或用戶端清除）
- [ ] 登出後重新整理受保護頁面會回 401 並導向 /login

---

## 核心資料管理（Documents / Versions / Attachments / Review Tasks）

## 文件（Document）

### 建立（Create）
- [ ] User 可建立 Document，建立後 status=Draft 且 current_version_id 有值
- [ ] Admin 可建立 Document，建立後 status=Draft 且 current_version_id 有值
- [ ] 建立成功後列表立即出現新 Document，且 title/status/updated_at 顯示合理
- [ ] 建立失敗時 UI 顯示明確錯誤，且列表不出現半成品
- [ ] 建立成功會寫入對應稽核事件（可在文件詳情的 AuditLog 區塊觀察到新增事件）

### 讀取與可見性（Read & Visibility / IDOR）
- [ ] User 的 /documents 列表只包含 owner_id=自己 的文件
- [ ] Admin 的 /documents 列表包含全部文件
- [ ] Reviewer 不可進入 /documents（不得有全量列表入口）
- [ ] User 直接輸入他人 /documents/:id 顯示 Not Found
- [ ] Reviewer 直接輸入與自己無任務關聯的 /documents/:id 顯示 Not Found
- [ ] Reviewer 透過自己的 Pending 任務進入其文件詳情成功

### 編輯（Edit）
- [ ] 只有 status=Draft 才能編輯 title/content；非 Draft 不顯示編輯入口
- [ ] Draft 編輯保存成功後 updated_at 更新，且列表與詳情顯示一致
- [ ] title 必填；title 空值保存失敗並顯示明確錯誤
- [ ] title 長度超過 120 字保存失敗並顯示明確錯誤
- [ ] content 必填；content 空值保存失敗並顯示明確錯誤
- [ ] 非 owner 的 User 嘗試編輯（用他人文件 id）應被拒絕且不得成功寫入

### 送審後鎖定（Read-only after submit）
- [ ] 文件進入 In Review 後，User 端不可再編輯 title/content
- [ ] 文件進入 In Review 後，User 端不可再新增附件
- [ ] 文件進入 Approved 後，任何角色都不可編輯 title/content 或附件
- [ ] 文件進入 Archived 後，任何角色都不可編輯 title/content 或附件

### 封存（Archive）
- [ ] 只有 Admin 且 status=Approved 才能執行封存
- [ ] Admin 封存成功後 status 變為 Archived
- [ ] 非 Admin 嘗試封存會被拒絕
- [ ] 封存非法狀態（例如 Draft/In Review/Rejected）會被拒絕並回明確錯誤（HTTP 400）
- [ ] 封存成功會寫入對應稽核事件（AuditLog 可追溯 who/when/what）

---

## 文件版本（DocumentVersion）

### current_version_id 規則
- [ ] 文件為 Draft 時，current_version_id 指向目前 Draft 版本，且內容可反覆更新
- [ ] Draft → Submitted 時會建立一筆新的 DocumentVersion 作為送審鎖定版本（version_no 遞增）
- [ ] 文件進入 In Review 後，current_version_id 指向送審鎖定版本，且內容不可再修改
- [ ] 文件進入 Approved/Archived 後，current_version_id 仍指向該次送審鎖定版本
- [ ] 文件進入 Rejected 後，current_version_id 仍指向被退回的送審版本（只讀）

### Rejected → Draft（退回後修改）
- [ ] User 執行 Rejected → Draft 後，系統建立新的 Draft 版本（version_no 遞增）
- [ ] 新 Draft 版本的初始 content 以被退回版本內容為起點
- [ ] 新 Draft 版本建立後 current_version_id 立即切換到新 Draft 版本
- [ ] Rejected 狀態下未執行退回後修改前，不應出現可編輯 Draft 內容

---

## 附件（Attachment）

### 新增（僅 Draft）
- [ ] 只有 status=Draft 才顯示上傳附件入口
- [ ] 上傳成功會新增 Attachment record，且 document_version_id 綁定 current_version_id（Draft 版本）
- [ ] 上傳失敗時 UI 顯示明確錯誤且附件清單不新增項目

### 不可變性（不可編輯/覆蓋）
- [ ] 同一附件不可被覆蓋替換（同一附件 id 不允許內容被改寫）
- [ ] 文件進入 In Review/Approved/Archived 後，不可新增附件
- [ ] Rejected → Draft 後，新 Draft 版本的附件不應影響既有版本附件（既有版本附件仍保持只讀且不被修改）

---

## 簽核流程模板（ApprovalFlowTemplate / ApprovalFlowStep）

### 列表與基本操作
- [ ] 只有 Admin 可進入 /admin/flows
- [ ] /admin/flows 可看到模板列表（name/is_active/updated_at）
- [ ] 建立模板時 name 為必填
- [ ] 建立模板後可在列表看到新模板
- [ ] 編輯模板可調整步驟順序（越小越先）、mode（Serial/Parallel）、指派規則
- [ ] 停用模板後 is_active=false，且 UI 顯示停用狀態

### 指派規則與送審前置條件
- [ ] 若某啟用模板的任一步驟沒有任何 assignee，該模板不得用於送審
- [ ] 使用無 assignee 的模板送審時，送審失敗（HTTP 400）且 UI 顯示明確原因
- [ ] 使用停用模板送審時，送審失敗（HTTP 400）且 UI 顯示明確原因
- [ ] 使用無步驟的模板送審時，送審失敗（HTTP 400）且 UI 顯示明確原因

---

## 審核任務（ReviewTask）與審核紀錄（ApprovalRecord）

### 任務建立（送審後）
- [ ] Draft → Submitted 成功後會寫入 Submit 稽核事件
- [ ] Submitted → In Review（System）會建立 ReviewTask 並寫入 CreateReviewTasks/EnterInReview 稽核事件
- [ ] Serial：同時間只允許當前步驟存在 Pending 任務（只看到當前步驟的待辦）
- [ ] Parallel：同一步驟的多位 assignee 皆建立 Pending 任務，且需全數 Approved 才能前進

### Reviewer 可操作邊界
- [ ] Reviewer 只能操作 assignee_id=自己 且 status=Pending 的 ReviewTask
- [ ] Reviewer 嘗試操作非自己任務會被拒絕且不得改變任何狀態
- [ ] Reviewer 嘗試操作非 Pending 任務會被拒絕且不得重複產生 ApprovalRecord

### 同意（Approve）
- [ ] Reviewer 同意成功會把該 ReviewTask.status 設為 Approved 且寫入 acted_at
- [ ] 同意成功會新增 ApprovalRecord(action=Approved) 且可在文件詳情看到
- [ ] 若為最後一個必要同意，文件 status 由 In Review 變為 Approved
- [ ] 若不是最後必要同意，文件維持 In Review，並依 Serial/Parallel 規則建立或啟用下一步 Pending 任務

### 退回（Reject）
- [ ] Reviewer 退回前必須填寫退回理由；理由空值不得送出
- [ ] 退回理由在 UI 顯示時需安全顯示（避免 XSS）
- [ ] Reviewer 退回成功會把該 ReviewTask.status 設為 Rejected 且寫入 acted_at
- [ ] 退回成功會新增 ApprovalRecord(action=Rejected, reason)
- [ ] 退回成功會把文件 status 設為 Rejected
- [ ] 文件被退回後，其餘尚未完成的任務會被標記為 Cancelled

### 併發與防重送（同一任務只能處理一次）
- [ ] 在同一個 Pending 任務上連續快速點擊「同意」兩次，只有第一次成功；第二次回 409 Conflict
- [ ] 在同一個 Pending 任務上連續快速點擊「退回」兩次，只有第一次成功；第二次回 409 Conflict
- [ ] 發生 409 Conflict 時 UI 顯示明確錯誤，且不會產生重複的 ApprovalRecord
- [ ] 發生 409 Conflict 時不會產生重複的 AuditLog（同一動作不應重複被記錄）

---

## 文件狀態機（Document State Machine）

### 合法狀態轉換（正向）
- [ ] Draft → Submitted：User 送出簽核成功
- [ ] Submitted → In Review：系統建立任務後自動進入 In Review
- [ ] In Review → Rejected：Reviewer 退回成功
- [ ] In Review → Approved：所有必要同意完成後自動進入 Approved
- [ ] Rejected → Draft：User 退回後修改成功
- [ ] Approved → Archived：Admin 封存成功

### 非法轉換（必須拒絕，HTTP 400）
- [ ] 在非 Draft 狀態嘗試送出簽核會被拒絕（HTTP 400），且 UI 顯示「狀態不允許」類的明確訊息
- [ ] 在非 Draft 狀態嘗試編輯內容會被拒絕（HTTP 400 或 403），且不得改變資料
- [ ] 在非 Draft 狀態嘗試上傳附件會被拒絕
- [ ] 在非 In Review 狀態嘗試同意/退回會被拒絕
- [ ] 在非 Approved 狀態嘗試封存會被拒絕

### 送審前置條件（Draft → Submitted 的驗證）
- [ ] title 為空時送審失敗（HTTP 400），UI 顯示明確原因
- [ ] content 為空時送審失敗（HTTP 400），UI 顯示明確原因
- [ ] 未選定啟用模板時送審失敗（HTTP 400），UI 顯示明確原因
- [ ] 選定模板但模板無步驟時送審失敗（HTTP 400），UI 顯示明確原因
- [ ] 選定模板但任一步驟無 assignee 時送審失敗（HTTP 400），UI 顯示明確原因

---

## 主要頁面需求（Pages）

## /login
- [ ] 登入表單包含 Email/Password，且欄位可輸入
- [ ] 登入成功後依角色導向正確預設頁
- [ ] 登入失敗時維持在 /login，並顯示錯誤且可重試

## /documents（User / Admin）
- [ ] User 進入 /documents 只看到自己的文件
- [ ] Admin 進入 /documents 可看到所有文件
- [ ] 列表至少顯示 title/status/updated_at
- [ ] 點擊列表項目可進入對應 /documents/:id
- [ ] 列表與詳情的 status/updated_at 一致

## /documents/:id（User / Reviewer / Admin）
- [ ] 顯示文件 title/status/current_version_id
- [ ] 顯示版本清單（含 version_no）
- [ ] 顯示附件清單（filename/content_type/size_bytes 相關資訊至少可辨識）
- [ ] 顯示審核任務（ReviewTask）與其狀態
- [ ] 顯示審核紀錄（ApprovalRecord）與其 action/reason（若有）
- [ ] 顯示稽核事件（AuditLog）並可追溯 who/when/what

### /documents/:id（User 視角 CTA）
- [ ] status=Draft 時顯示：編輯/上傳附件/送出簽核
- [ ] status=Rejected 時顯示：退回後修改
- [ ] status=In Review/Approved/Archived 時不顯示任何寫入型 CTA（只讀）

### /documents/:id（Reviewer 視角 CTA）
- [ ] 只有存在「自己的 Pending 任務」時才顯示同意/退回
- [ ] 沒有自己的 Pending 任務時不顯示同意/退回

### /documents/:id（Admin 視角 CTA）
- [ ] status=Approved 時顯示：封存
- [ ] 非 Approved 不顯示封存

## /reviews（Reviewer）
- [ ] 僅顯示 assignee=自己 且 status=Pending 的任務
- [ ] 點擊任務可進入對應 /documents/:id
- [ ] 重新整理後已處理任務不再出現

## /admin/flows（Admin）
- [ ] 顯示流程模板列表（含啟用/停用狀態）
- [ ] 具備建立/編輯/停用入口，且更新後列表反映最新狀態

---

## 資料一致性（Consistency）
- [ ] /documents 列表中的 status 與 /documents/:id 詳情中的 status 一致
- [ ] /documents 列表中的 updated_at 與 /documents/:id 詳情中的 updated_at 一致
- [ ] /documents/:id 中 current_version_id 指向的版本內容與「目前顯示的內容」一致
- [ ] /documents/:id 中版本清單與 current_version_id 的 version_no 邏輯一致（version_no 遞增且不回退）
- [ ] 上傳附件後，附件清單立即出現且與 current_version_id（Draft 版本）一致
- [ ] 送審後，current_version_id 切到送審鎖定版本，且附件與版本關聯顯示正確
- [ ] Reviewer 同意/退回後，ReviewTask 狀態、ApprovalRecord、AuditLog 皆在同一文件詳情中一致呈現
- [ ] 任務被退回導致文件 Rejected 時，其他 ReviewTask 會變為 Cancelled，且 /reviews 的 Pending 列表同步移除

---

## 非功能需求驗收（Non-functional Requirements）

### 安全性（IDOR / 存取控制 / XSS）
- [ ] User 無法讀取他人文件詳情（/documents/:id 回 Not Found）
- [ ] Reviewer 無任務關聯時讀取文件詳情回 Not Found（避免存在性洩漏）
- [ ] Reviewer 無法操作他人 ReviewTask（應被拒絕且不得改變狀態）
- [ ] title/content 在 UI 顯示時需安全顯示（不可將 HTML/Script 以可執行方式呈現）
- [ ] 退回理由在 UI 顯示時需安全顯示（不可將 HTML/Script 以可執行方式呈現）

### 不可變性（Append-only）
- [ ] DocumentVersion 一旦成為送審鎖定版本後不可被修改（任何嘗試更新都被拒絕）
- [ ] Attachment 不可被覆蓋替換（同一附件不可被改寫內容）
- [ ] ApprovalRecord 不可編輯/不可刪除（僅追加）
- [ ] AuditLog 不可編輯/不可刪除（僅追加）

### 可觀測性（Auditability）
- [ ] 送審時會寫入 Submit 的稽核事件
- [ ] 建立任務與進入 In Review 會寫入 CreateReviewTasks / EnterInReview 的稽核事件
- [ ] 同意任務會寫入對應稽核事件（至少可追溯 actor/時間/目標）
- [ ] 退回文件會寫入 RejectDocument / CancelOtherTasks 的稽核事件
- [ ] Rejected → Draft 會寫入 ReopenAsDraft 的稽核事件
- [ ] Approved → Archived 會寫入 ArchiveDocument 的稽核事件
- [ ] 每筆稽核事件能追溯 who/when/what 並包含足夠 metadata（document_id/version_id/review_task_id/target_status）

### 併發一致性（Concurrency）
- [ ] 同一 ReviewTask 不可被處理兩次（第二次必回 409 Conflict）
- [ ] 發生競態/重複提交時，不會產生重複 ApprovalRecord
- [ ] 發生競態/重複提交時，不會產生重複 AuditLog
- [ ] 競態發生時 UI 顯示明確錯誤並維持資料一致（不呈現錯誤的已完成狀態）

### 全站 UX 與 UI 一致性
- [ ] 全站頁面都有 Loading / Error / Empty / Forbidden / Not Found 狀態（適用時）
- [ ] 寫入型操作（建立/保存/上傳/送審/同意/退回/封存）有防重送（按鈕 disabled、顯示進度）
- [ ] 錯誤提示具體可理解（例如「狀態不允許」「理由必填」「找不到資源」）
- [ ] 同一頁面同一動作入口不重複出現（例如詳情頁不重複放置相同 CTA）
- [ ] 相同概念的狀態呈現一致（例如 status badge 文案在列表與詳情一致）
