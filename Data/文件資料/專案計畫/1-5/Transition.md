全體結構說明
[Entry State]
        ↓
[Page State Machine]
        ↓
[Role-specific Page State]
        ↓
[Feature / Function State Machine]
        ↓
[回到 Page 或跳轉其他 Page，或跳轉到其他 Feature]

以下將照這個層級排序。

---

## ① Entry State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> Entry.Init : enterSystem
    %% verify: 進站時只建立匿名入口狀態，不直接判定既有 User、Reviewer、Admin 身分，也不顯示受保護頁資料。

    Entry.Init --> LoginPage.Init : startLogin | navigate /login
    %% verify: 入口只導向 /login；未登入時 Header 僅可見「登入」，不得出現「文件」「待辦」「流程模板」或重複登入 CTA。
```

---

## ② /login Page
```mermaid
%% role: none
stateDiagram-v2
    [*] --> LoginPage.Init : enterPage
    %% verify: 進入 /login 時頁面建立登入入口狀態，未預載任何受保護資料，且不顯示文件列表、待辦列表或流程模板內容。

    LoginPage.Init --> LoginPage.Ready : showLoginForm
    %% verify: UI 顯示 Email 與 Password 欄位以及單一登入送出入口；Header 只顯示「登入」，同頁不得出現第二個登入按鈕。

    LoginPage.Ready --> AuthLoginFeature.Init : submitCredentials | navigate AuthLoginFeature
    %% verify: 送出登入時只發出一次認證請求並攜帶 Email/Password；送出按鈕進入 disabled 或 submitting 狀態以防重送。
```

## ③ /documents Page (User)
```mermaid
%% role: User
stateDiagram-v2
    [*] --> DocumentsUserPage.Init : enterPage
    %% verify: 進入 /documents 時需帶有效 token；若 token 無效則不載入列表並應回 401 後導向 /login。

    DocumentsUserPage.Init --> DocumentsUserPage.Ready : loadOwnDocuments [hasDocuments]
    %% verify: 文件列表 API 回 200 且只返回 owner_id 為目前 User 的文件；每列至少顯示 title、status、updated_at，且不包含他人文件。

    DocumentsUserPage.Init --> DocumentsUserPage.Empty : loadOwnDocuments [noDocuments]
    %% verify: 文件列表 API 回 200 且資料筆數為 0；畫面顯示 Empty 狀態與單一「建立文件」入口，不顯示過期列表資料。

    DocumentsUserPage.Init --> DocumentsUserPage.Failed : loadOwnDocumentsFailed
    %% verify: 讀取列表失敗時顯示 Error 狀態與 Retry；畫面不得殘留先前文件列，也不得把失敗當成 Empty。

    DocumentsUserPage.Failed --> DocumentsUserPage.Init : retryLoad
    %% verify: 點擊 Retry 會重新呼叫列表 API；成功後只會回到 Ready 或 Empty，且不會重複累積錯誤提示。

    DocumentsUserPage.Ready --> DocumentDetailUserPage.Init : openOwnedDocument | navigate /documents/:id
    %% verify: 只能從列表開啟屬於目前 User 的文件；詳情 API 對自己的 document_id 回 200，對他人文件不得被此頁列出。

    DocumentsUserPage.Ready --> CreateDocumentFeature.Init : clickCreateDocument | navigate CreateDocumentFeature
    %% verify: Ready 狀態只存在一個「建立文件」入口；點擊後進入建立流程並防止同一點擊送出兩次 create request。

    DocumentsUserPage.Ready --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 登出後 token 被清除或失效；重新存取 /documents API 回 401，並返回 /login。

    DocumentsUserPage.Empty --> CreateDocumentFeature.Init : clickCreateDocument | navigate CreateDocumentFeature
    %% verify: Empty 狀態仍提供單一「建立文件」入口；點擊後進入建立流程，不因 Empty 狀態隱藏建立能力。

    DocumentsUserPage.Empty --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從 Empty 狀態登出後會離開受保護頁；重新整理 /documents 不得再看到空列表，而是被導向 /login。
```

## ④ /documents Page (Admin)
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> DocumentsAdminPage.Init : enterPage
    %% verify: 只有 Admin 可進入此視角；若角色不是 Admin，/documents 不得暴露此管理視角資料與操作。

    DocumentsAdminPage.Init --> DocumentsAdminPage.Ready : loadAllDocuments [hasDocuments]
    %% verify: 文件列表 API 回 200 並可返回任意 owner 的文件；每列顯示 title、status、updated_at，且資料與詳情頁一致。

    DocumentsAdminPage.Init --> DocumentsAdminPage.Empty : loadAllDocuments [noDocuments]
    %% verify: 文件列表 API 回 200 且沒有任何文件；畫面顯示 Empty 與建立入口，不殘留舊列表資料。

    DocumentsAdminPage.Init --> DocumentsAdminPage.Failed : loadAllDocumentsFailed
    %% verify: 載入全部文件失敗時顯示 Error 與 Retry；畫面不應錯誤顯示 Empty 或部分成功資料。

    DocumentsAdminPage.Failed --> DocumentsAdminPage.Init : retryLoad
    %% verify: Retry 會重新要求全部文件列表；成功後資料筆數與伺服器返回一致，且錯誤提示被清除。

    DocumentsAdminPage.Ready --> DocumentDetailAdminPage.Init : openAnyDocument | navigate /documents/:id
    %% verify: Admin 可開啟任意文件詳情；詳情頁需回 200 並顯示文件、版本、附件、審核歷程與稽核事件。

    DocumentsAdminPage.Ready --> CreateDocumentFeature.Init : clickCreateDocument | navigate CreateDocumentFeature
    %% verify: Admin 也可建立新文件；列表頁只保留單一建立入口，點擊後進入 create flow 並防止重送。

    DocumentsAdminPage.Ready --> AdminFlowsPage.Init : goToFlowTemplates | navigate /admin/flows
    %% verify: Admin Header 可見且僅可見一個「流程模板」入口；導向 /admin/flows 時不需要額外角色切換。

    DocumentsAdminPage.Ready --> LoginPage.Init : clickLogout | navigate /login
    %% verify: Admin 登出後受保護 API 回 401，/documents 與 /admin/flows 都不能再被存取。

    DocumentsAdminPage.Empty --> CreateDocumentFeature.Init : clickCreateDocument | navigate CreateDocumentFeature
    %% verify: 沒有文件時仍可建立第一份文件；點擊 create 只送一次請求，且不因 Empty 狀態重複顯示 CTA。

    DocumentsAdminPage.Empty --> AdminFlowsPage.Init : goToFlowTemplates | navigate /admin/flows
    %% verify: 即使列表為空，Admin 仍可進入流程模板管理；頁面導覽不受文件數量影響。

    DocumentsAdminPage.Empty --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從空列表登出後返回 /login；重新整理原頁不再顯示 Admin 空列表內容。
```

## ⑤ /documents/:id Page (User)
```mermaid
%% role: User
stateDiagram-v2
    [*] --> DocumentDetailUserPage.Init : enterPage
    %% verify: 進入文件詳情時先以 document_id 載入資料；沒有有效 token 或不是 owner 的情況不得先渲染文件內容。

    DocumentDetailUserPage.Init --> DocumentDetailUserPage.DraftReady : loadOwnedDocument [status=Draft]
    %% verify: 詳情 API 回 200 且 status=Draft；UI 顯示 title、content、versions、attachments，並只顯示「編輯」「上傳附件」「送出簽核」這些 Draft 專屬 CTA。

    DocumentDetailUserPage.Init --> DocumentDetailUserPage.RejectedReady : loadOwnedDocument [status=Rejected]
    %% verify: 詳情 API 回 200 且 status=Rejected；畫面顯示退回結果與唯一本頁「退回後修改」入口，不顯示 Draft 編輯或 Reviewer/Admin CTA。

    DocumentDetailUserPage.Init --> DocumentDetailUserPage.Readonly : loadOwnedDocument [status=Submitted|In Review|Approved|Archived]
    %% verify: 詳情 API 回 200 且 current_version_id 指向目前可展示版本；畫面隱藏編輯、上傳附件、送出簽核與退回後修改入口，保持只讀。

    DocumentDetailUserPage.Init --> DocumentDetailUserPage.NotFound : loadOwnedDocumentNotFound
    %% verify: 他人文件或不存在的 document_id 應回 404；畫面顯示 Not Found，且不得透露文件 title、owner 或狀態。

    DocumentDetailUserPage.Init --> DocumentDetailUserPage.Failed : loadOwnedDocumentFailed
    %% verify: 詳情載入失敗時顯示 Error 與 Retry；不保留前一份文件的 versions、attachments 或審核紀錄。

    DocumentDetailUserPage.Failed --> DocumentDetailUserPage.Init : retryLoad
    %% verify: Retry 重新請求同一 document_id；成功後只會進入 DraftReady、RejectedReady、Readonly 或 NotFound 其中一種可觀測狀態。

    DocumentDetailUserPage.DraftReady --> EditDraftFeature.Init : clickEditDraft | navigate EditDraftFeature
    %% verify: 只有 status=Draft 才能進入編輯流程；點擊後不應存在第二個同功能入口，且 Reviewer/Admin 操作不會出現在此頁。

    DocumentDetailUserPage.DraftReady --> UploadAttachmentFeature.Init : clickUploadAttachment | navigate UploadAttachmentFeature
    %% verify: 只有 Draft 允許新增附件；點擊上傳會綁定目前 current_version_id，不允許覆寫既有附件內容。

    DocumentDetailUserPage.DraftReady --> SubmitDocumentFeature.Init : clickSubmitForReview | navigate SubmitDocumentFeature
    %% verify: 送出簽核入口僅在 Draft 顯示一次；點擊後進入送審流程，按鈕需防重送。

    DocumentDetailUserPage.DraftReady --> DocumentsUserPage.Init : backToDocuments | navigate /documents
    %% verify: 返回列表後該文件的 status、updated_at 應與詳情一致，且列表仍只包含目前 User 的文件。

    DocumentDetailUserPage.DraftReady --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從 Draft 詳情登出後，任何保存、上傳或送審 API 再次呼叫都應回 401，並導回 /login。

    DocumentDetailUserPage.RejectedReady --> ReopenRejectedDocumentFeature.Init : clickReopenAsDraft | navigate ReopenRejectedDocumentFeature
    %% verify: 只有 status=Rejected 顯示「退回後修改」；點擊後進入建立新 Draft 版本流程，而不是直接修改被退回的鎖定版本。

    DocumentDetailUserPage.RejectedReady --> DocumentsUserPage.Init : backToDocuments | navigate /documents
    %% verify: 返回列表時該文件仍顯示 Rejected；列表與詳情的 status、updated_at 需一致。

    DocumentDetailUserPage.RejectedReady --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 登出後不得再對 Rejected 文件執行 reopen；重新進站需先重新登入。

    DocumentDetailUserPage.Readonly --> DocumentsUserPage.Init : backToDocuments | navigate /documents
    %% verify: 從只讀詳情返回列表後，status 與 current_version_id 對應的展示資料保持一致，且列表不會錯誤顯示可編輯狀態。

    DocumentDetailUserPage.Readonly --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從只讀詳情登出後，重新整理 /documents/:id 應回 401 並導向 /login，不保留文件內容。

    DocumentDetailUserPage.NotFound --> DocumentsUserPage.Init : returnToDocuments | navigate /documents
    %% verify: 從 Not Found 返回列表後只看到自己的文件清單；不存在或未授權文件不會被補進列表。
```

## ⑥ /documents/:id Page (Reviewer)
```mermaid
%% role: Reviewer
stateDiagram-v2
    [*] --> DocumentDetailReviewerPage.Init : enterPage
    %% verify: Reviewer 進入詳情前需以文件與任務關聯檢查存取權；沒有任務關聯時不得顯示文件資料。

    DocumentDetailReviewerPage.Init --> DocumentDetailReviewerPage.PendingAction : loadAssignedDocument [hasOwnPendingTask]
    %% verify: 詳情 API 回 200 且至少存在一筆 assignee_id=目前 Reviewer、status=Pending 的 ReviewTask；畫面顯示「同意」「退回」與送審版本內容。

    DocumentDetailReviewerPage.Init --> DocumentDetailReviewerPage.Readonly : loadAssignedDocument [noOwnPendingTask]
    %% verify: 詳情 API 回 200 但目前 Reviewer 沒有 Pending 任務時，畫面可閱讀文件與歷程，但不顯示「同意」「退回」CTA。

    DocumentDetailReviewerPage.Init --> DocumentDetailReviewerPage.NotFound : loadAssignedDocumentNotFound
    %% verify: 若 Reviewer 與該文件沒有任何任務關聯或文件不存在，API 回 404；畫面顯示 Not Found，不洩漏文件存在性。

    DocumentDetailReviewerPage.Init --> DocumentDetailReviewerPage.Failed : loadAssignedDocumentFailed
    %% verify: 詳情載入失敗時顯示 Error 與 Retry；不保留前一筆任務對應文件內容。

    DocumentDetailReviewerPage.Failed --> DocumentDetailReviewerPage.Init : retryLoad
    %% verify: Retry 重新請求指派文件；成功後應正確回到 PendingAction、Readonly 或 NotFound，不重複堆疊錯誤提示。

    DocumentDetailReviewerPage.PendingAction --> ApproveReviewTaskFeature.Init : clickApproveTask | navigate ApproveReviewTaskFeature
    %% verify: 只有自己的 Pending 任務可進入同意流程；點擊後按鈕 disabled 防止同一任務重複同意。

    DocumentDetailReviewerPage.PendingAction --> RejectReviewTaskFeature.Init : clickRejectTask | navigate RejectReviewTaskFeature
    %% verify: 只有自己的 Pending 任務可進入退回流程；退回需要求輸入理由，且不允許處理他人任務。

    DocumentDetailReviewerPage.PendingAction --> ReviewsPage.Init : backToReviews | navigate /reviews
    %% verify: 返回待辦列表後只顯示目前 Reviewer 的 Pending 任務；不應出現已完成或已取消任務。

    DocumentDetailReviewerPage.PendingAction --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從待審詳情登出後，任何 approve/reject API 再次送出都應回 401 並導向 /login。

    DocumentDetailReviewerPage.Readonly --> ReviewsPage.Init : backToReviews | navigate /reviews
    %% verify: 返回 /reviews 後若目前沒有 Pending 任務，列表應顯示 Empty；已處理任務不得再出現在待辦。

    DocumentDetailReviewerPage.Readonly --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從只讀詳情登出後，重新進入 /reviews 需重新登入，且舊文件內容不應持續可見。

    DocumentDetailReviewerPage.NotFound --> ReviewsPage.Init : returnToReviews | navigate /reviews
    %% verify: 從 Not Found 返回待辦列表時，只顯示屬於目前 Reviewer 的 Pending 任務；不存在的文件不會暴露任何 metadata。
```

## ⑦ /documents/:id Page (Admin)
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> DocumentDetailAdminPage.Init : enterPage
    %% verify: Admin 進入詳情時可讀取任意文件，但仍需以 document_id 請求資料；不存在的文件不得產生假資料畫面。

    DocumentDetailAdminPage.Init --> DocumentDetailAdminPage.ApprovedReady : loadDocument [status=Approved]
    %% verify: 詳情 API 回 200 且 status=Approved；畫面顯示封存入口、版本、附件、ReviewTasks、ApprovalRecords、AuditLogs，且僅此狀態可封存。

    DocumentDetailAdminPage.Init --> DocumentDetailAdminPage.Readonly : loadDocument [status=Draft|Submitted|In Review|Rejected|Archived]
    %% verify: 詳情 API 回 200 且 status 不為 Approved；畫面維持只讀，不顯示封存 CTA，且不可編輯歷史資料。

    DocumentDetailAdminPage.Init --> DocumentDetailAdminPage.NotFound : loadDocumentNotFound
    %% verify: document_id 不存在時 API 回 404；畫面顯示 Not Found 且不洩漏任何文件欄位或審核紀錄。

    DocumentDetailAdminPage.Init --> DocumentDetailAdminPage.Failed : loadDocumentFailed
    %% verify: 載入失敗時顯示 Error 與 Retry；畫面不保留上一份文件資料或封存按鈕。

    DocumentDetailAdminPage.Failed --> DocumentDetailAdminPage.Init : retryLoad
    %% verify: Retry 重新載入同一文件；成功後顯示 ApprovedReady、Readonly 或 NotFound 的正確狀態，不重複累積錯誤訊息。

    DocumentDetailAdminPage.ApprovedReady --> ArchiveDocumentFeature.Init : clickArchiveDocument | navigate ArchiveDocumentFeature
    %% verify: 封存入口只在 Approved 狀態顯示一次；點擊後進入封存流程並防止重複送出封存操作。

    DocumentDetailAdminPage.ApprovedReady --> DocumentsAdminPage.Init : backToDocuments | navigate /documents
    %% verify: 返回列表後該文件顯示 Approved 狀態；列表與詳情的 status、updated_at 保持一致。

    DocumentDetailAdminPage.ApprovedReady --> AdminFlowsPage.Init : goToFlowTemplates | navigate /admin/flows
    %% verify: 從核准文件詳情切到流程模板管理時，不應丟失 Admin 角色導覽，且 /admin/flows 仍可正常載入。

    DocumentDetailAdminPage.ApprovedReady --> LoginPage.Init : clickLogout | navigate /login
    %% verify: Admin 登出後，/documents/:id 與 /admin/flows 的後續請求都回 401，並導向 /login。

    DocumentDetailAdminPage.Readonly --> DocumentsAdminPage.Init : backToDocuments | navigate /documents
    %% verify: 從只讀詳情返回列表後，文件狀態與詳情一致，且不錯誤顯示可封存狀態。

    DocumentDetailAdminPage.Readonly --> AdminFlowsPage.Init : goToFlowTemplates | navigate /admin/flows
    %% verify: 即使當前文件非 Approved，Admin 仍可切換到流程模板頁；不會額外顯示文件編輯入口。

    DocumentDetailAdminPage.Readonly --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從只讀詳情登出後，重新整理該頁應回 401 並返回 /login，不保留文件內容。

    DocumentDetailAdminPage.NotFound --> DocumentsAdminPage.Init : returnToDocuments | navigate /documents
    %% verify: 從 Not Found 返回文件列表後仍能看到其他存在文件；不存在的 id 不會出現在列表或快取中。
```

## ⑧ /reviews Page
```mermaid
%% role: Reviewer
stateDiagram-v2
    [*] --> ReviewsPage.Init : enterPage
    %% verify: 進入 /reviews 需有效 Reviewer 身分；User 或 Admin 不得看到待辦清單與此頁內容。

    ReviewsPage.Init --> ReviewsPage.Ready : loadPendingTasks [hasTasks]
    %% verify: 待辦 API 回 200 且只返回 assignee_id=目前 Reviewer、status=Pending 的任務；每筆任務可對應文件與 step_key。

    ReviewsPage.Init --> ReviewsPage.Empty : loadPendingTasks [noTasks]
    %% verify: 待辦 API 回 200 且沒有 Pending 任務；UI 顯示 Empty 狀態，不顯示過期任務資料。

    ReviewsPage.Init --> ReviewsPage.Failed : loadPendingTasksFailed
    %% verify: 待辦載入失敗時顯示 Error 與 Retry；畫面不得誤當作 Empty，也不得保留舊任務列。

    ReviewsPage.Failed --> ReviewsPage.Init : retryLoad
    %% verify: Retry 重新呼叫待辦 API；成功後任務數量與伺服器一致，並清除先前錯誤提示。

    ReviewsPage.Ready --> DocumentDetailReviewerPage.Init : openAssignedDocument | navigate /documents/:id
    %% verify: 點擊任務只能開啟該 Reviewer 被指派的文件；非本人任務不會出現在列表，也不應由此頁導向。

    ReviewsPage.Ready --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 登出後待辦 API 回 401；再次進入 /reviews 應先被導向 /login。

    ReviewsPage.Empty --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從空待辦頁登出後回到 /login；重新進站不得直接回到 Reviewer 空頁。
```

## ⑨ /admin/flows Page
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminFlowsPage.Init : enterPage
    %% verify: 進入 /admin/flows 需有效 Admin 身分；非 Admin 不得看到模板列表或管理入口。

    AdminFlowsPage.Init --> AdminFlowsPage.Ready : loadFlowTemplates [hasTemplates]
    %% verify: 模板列表 API 回 200 並返回 name、is_active、updated_at；UI 正確顯示啟用與停用狀態。

    AdminFlowsPage.Init --> AdminFlowsPage.Empty : loadFlowTemplates [noTemplates]
    %% verify: 模板列表 API 回 200 且無資料；畫面顯示 Empty 與單一建立入口，不殘留舊模板資料。

    AdminFlowsPage.Init --> AdminFlowsPage.Failed : loadFlowTemplatesFailed
    %% verify: 載入模板失敗時顯示 Error 與 Retry；不應顯示部分模板或錯誤的啟用狀態。

    AdminFlowsPage.Failed --> AdminFlowsPage.Init : retryLoad
    %% verify: Retry 重新拉取模板列表；成功後 Ready/Empty 與 API 回傳一致，錯誤提示清除。

    AdminFlowsPage.Ready --> ManageFlowTemplateFeature.Init : openTemplateEditor | navigate ManageFlowTemplateFeature
    %% verify: Ready 狀態中可從單一入口進入建立或編輯模板流程；非 Admin 不得觸發此流程。

    AdminFlowsPage.Ready --> DocumentsAdminPage.Init : goToDocuments | navigate /documents
    %% verify: 返回 /documents 後仍維持 Admin 視角，可見所有文件與「流程模板」導覽。

    AdminFlowsPage.Ready --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 登出後 /admin/flows API 回 401；重新整理此頁會被導向 /login。

    AdminFlowsPage.Empty --> ManageFlowTemplateFeature.Init : openTemplateEditor | navigate ManageFlowTemplateFeature
    %% verify: 沒有模板時仍可建立第一個流程模板；建立入口只顯示一次，不因 Empty 狀態重複出現。

    AdminFlowsPage.Empty --> DocumentsAdminPage.Init : goToDocuments | navigate /documents
    %% verify: 即使模板列表為空，仍可切回文件列表且維持 Admin 導覽與權限。

    AdminFlowsPage.Empty --> LoginPage.Init : clickLogout | navigate /login
    %% verify: 從空模板頁登出後回 /login；再次進入 /admin/flows 需重新登入為 Admin。
```

---

## ⑩ Feature: AuthLoginFeature
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthLoginFeature.Init : enterFeature
    %% verify: 進入登入功能時只處理認證流程，不預先建立文件、待辦或流程模板資料。

    AuthLoginFeature.Init --> AuthLoginFeature.Submitting : submitLogin
    %% verify: 認證請求送出一次並帶入 Email/Password；登入按鈕 disabled，避免重複提交。

    AuthLoginFeature.Submitting --> AuthLoginFeature.AuthenticatedUser : loginSucceeded [role=User]
    %% verify: API 回 200 並帶回有效 token 與 role=User；session 被保存，且後續 User 受保護 API 可通過授權。

    AuthLoginFeature.Submitting --> AuthLoginFeature.AuthenticatedReviewer : loginSucceeded [role=Reviewer]
    %% verify: API 回 200 並帶回有效 token 與 role=Reviewer；session 被保存，且 Reviewer 待辦 API 可被正常呼叫。

    AuthLoginFeature.Submitting --> AuthLoginFeature.AuthenticatedAdmin : loginSucceeded [role=Admin]
    %% verify: API 回 200 並帶回有效 token 與 role=Admin；session 被保存，且 Admin 可存取文件列表與流程模板 API。

    AuthLoginFeature.Submitting --> AuthLoginFeature.Failed : loginFailed
    %% verify: API 回 400 或 401 時不建立 session；畫面應保留在登入流程並顯示可理解的帳密錯誤訊息。

    AuthLoginFeature.AuthenticatedUser --> DocumentsUserPage.Init : loginDone | navigate /documents
    %% verify: 導向 /documents 後 Header 僅顯示「文件」「登出」；不得顯示「待辦」或「流程模板」。

    AuthLoginFeature.AuthenticatedReviewer --> ReviewsPage.Init : loginDone | navigate /reviews
    %% verify: 導向 /reviews 後 Header 僅顯示「待辦」「登出」；不得顯示「文件」或「流程模板」。

    AuthLoginFeature.AuthenticatedAdmin --> DocumentsAdminPage.Init : loginDone | navigate /documents
    %% verify: 導向 /documents 後 Header 顯示「文件」「流程模板」「登出」；Admin 可讀取全部文件。

    AuthLoginFeature.Failed --> LoginPage.Init : loginFailedReturn | navigate /login
    %% verify: 返回 /login 後表單可再次輸入；不保留已登入 session，也不導向任何受保護頁。
```

## ⑪ Feature: CreateDocumentFeature
Source Pages: DocumentsUserPage, DocumentsAdminPage

```mermaid
%% role: User|Admin
stateDiagram-v2
    [*] --> CreateDocumentFeature.Init : enterFeature
    %% verify: 進入建立文件流程時僅允許 User 或 Admin 觸發；Reviewer 不得具有此入口或 API 權限。

    CreateDocumentFeature.Init --> CreateDocumentFeature.Submitting : submitCreateDocument
    %% verify: 建立文件請求只送出一次；送出期間建立按鈕 disabled，避免產生重複 Draft 文件。

    CreateDocumentFeature.Submitting --> CreateDocumentFeature.CreatedForUser : createSucceeded [role=User]
    %% verify: API 回 200 並建立 Document.status=Draft、owner_id=目前 User、current_version_id 指向新 Draft 版本；資料可被 User 詳情頁讀取。

    CreateDocumentFeature.Submitting --> CreateDocumentFeature.CreatedForAdmin : createSucceeded [role=Admin]
    %% verify: API 回 200 並建立 Document.status=Draft、owner_id=目前 Admin、current_version_id 指向新 Draft 版本；Admin 可在詳情頁查看完整初始資料。

    CreateDocumentFeature.Submitting --> CreateDocumentFeature.Failed : createFailed
    %% verify: 建立失敗時不應留下半成品 Document 或 DocumentVersion；列表與資料庫都不增加新文件。

    CreateDocumentFeature.CreatedForUser --> DocumentDetailUserPage.Init : openCreatedDraft | navigate /documents/:id
    %% verify: 導向新文件詳情後 status=Draft；UI 顯示編輯、上傳附件、送出簽核入口，且 title/content 可後續填寫。

    CreateDocumentFeature.CreatedForAdmin --> DocumentDetailAdminPage.Init : openCreatedDraft | navigate /documents/:id
    %% verify: 導向新文件詳情後 status=Draft；Admin 可查看該草稿但不會看到 Reviewer 審核入口。

    CreateDocumentFeature.Failed --> DocumentsUserPage.Init : returnToUserDocuments | navigate /documents
    %% verify: 若失敗並返回 User 列表，列表筆數不變，且錯誤訊息可指出建立失敗原因。

    CreateDocumentFeature.Failed --> DocumentsAdminPage.Init : returnToAdminDocuments | navigate /documents
    %% verify: 若失敗並返回 Admin 列表，列表中不新增新文件，且錯誤訊息可被 Admin 讀取。
```

## ⑫ Feature: EditDraftFeature
```mermaid
%% role: User
stateDiagram-v2
    [*] --> EditDraftFeature.Init : enterFeature
    %% verify: 只有 owner 的 Draft 文件可進入編輯流程；Submitted、In Review、Approved、Archived 文件不得進入。

    EditDraftFeature.Init --> EditDraftFeature.Editing : openDraftEditor
    %% verify: 編輯器載入目前 Draft 的 title 與 content；畫面不應顯示只讀版本的鎖定標記。

    EditDraftFeature.Editing --> EditDraftFeature.Saving : submitDraftChanges
    %% verify: 保存請求送出時按鈕 disabled；請求只包含 Draft 可編輯欄位 title、content。

    EditDraftFeature.Saving --> EditDraftFeature.Completed : saveDraftSucceeded
    %% verify: API 回 200；Document 仍為 Draft，title/content 更新，updated_at 改變，current_version_id 仍指向目前 Draft 版本。

    EditDraftFeature.Saving --> EditDraftFeature.Failed : saveDraftFailed
    %% verify: 保存失敗時畫面顯示明確錯誤；資料庫中的 title/content 不變，且不建立新的鎖定版本。

    EditDraftFeature.Failed --> EditDraftFeature.Editing : retryEdit
    %% verify: 重試後可再次提交修改；錯誤提示被清除且編輯欄位保留目前輸入內容。

    EditDraftFeature.Completed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後可看到更新後的 title/content 與新的 updated_at；文件仍維持 Draft 並保留 Draft CTA。
```

## ⑬ Feature: UploadAttachmentFeature
```mermaid
%% role: User
stateDiagram-v2
    [*] --> UploadAttachmentFeature.Init : enterFeature
    %% verify: 只有 Draft 文件可進入附件上傳流程；非 Draft 狀態不得顯示或允許上傳入口。

    UploadAttachmentFeature.Init --> UploadAttachmentFeature.Uploading : submitAttachmentUpload
    %% verify: 上傳請求帶入檔名、content_type、size_bytes 與目前 current_version_id；上傳按鈕 disabled 以防重送。

    UploadAttachmentFeature.Uploading --> UploadAttachmentFeature.Completed : uploadSucceeded
    %% verify: API 回 200 並新增新的 Attachment record，document_version_id 綁定 current_version_id；既有附件 id 與內容不被覆寫。

    UploadAttachmentFeature.Uploading --> UploadAttachmentFeature.Failed : uploadFailed
    %% verify: 上傳失敗時不新增 Attachment record；畫面顯示具體錯誤，附件清單維持原狀。

    UploadAttachmentFeature.Failed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後文件仍為 Draft，附件清單不含失敗上傳檔案，且仍可再次嘗試上傳。

    UploadAttachmentFeature.Completed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後附件清單立即包含新附件，且附件對應的 document_version_id 等於目前 current_version_id。
```

## ⑭ Feature: SubmitDocumentFeature
```mermaid
%% role: User
stateDiagram-v2
    [*] --> SubmitDocumentFeature.Init : enterFeature
    %% verify: 只有 owner 的 Draft 文件可進入送審流程；Reviewer 與非 owner 不得觸發此功能。

    SubmitDocumentFeature.Init --> SubmitDocumentFeature.Validating : validateSubmission
    %% verify: 送審前檢查 title、content 非空，且已選定 is_active=true 的流程模板、至少 1 個 step、每個 step 都有 assignee；不符合則不得進入送出。

    SubmitDocumentFeature.Validating --> SubmitDocumentFeature.Submitting : createLockedVersionAndTasks
    %% verify: 驗證通過後開始同一筆送審交易；系統需建立 version_no 遞增的鎖定版本並準備建立首批 ReviewTask。

    SubmitDocumentFeature.Validating --> SubmitDocumentFeature.Failed : validationFailed
    %% verify: 驗證失敗時 API 回 400 並指出缺少欄位、未啟用模板或 assignee 不完整；文件維持 Draft，沒有新版本與任務。

    SubmitDocumentFeature.Submitting --> SubmitDocumentFeature.Completed : submitSucceeded
    %% verify: 送審成功後 Document 進入 In Review，current_version_id 指向送審鎖定版本，AuditLog 至少寫入 Submit、CreateReviewTasks、EnterInReview，且首批 Pending 任務已建立。

    SubmitDocumentFeature.Submitting --> SubmitDocumentFeature.Failed : submitFailed
    %% verify: 送審失敗時不得留下部分建立的 ReviewTask 或不一致狀態；Document 必須維持 Draft，current_version_id 不改到半成品版本。

    SubmitDocumentFeature.Failed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後仍顯示 Draft CTA，錯誤訊息可指出送審失敗原因，且沒有多餘 Pending 任務。

    SubmitDocumentFeature.Completed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後顯示 In Review 或只讀狀態；編輯、上傳附件、送出簽核入口消失，審核任務與鎖定版本可被查看。
```

## ⑮ Feature: ReopenRejectedDocumentFeature
```mermaid
%% role: User
stateDiagram-v2
    [*] --> ReopenRejectedDocumentFeature.Init : enterFeature
    %% verify: 只有 owner 對 status=Rejected 的文件可進入此流程；其他狀態不得顯示或允許「退回後修改」。

    ReopenRejectedDocumentFeature.Init --> ReopenRejectedDocumentFeature.CreatingDraft : createNewDraftVersion
    %% verify: 重新開啟時建立新的 Draft DocumentVersion，version_no 遞增，內容以被退回版本為起點；舊送審版本維持不可變。

    ReopenRejectedDocumentFeature.CreatingDraft --> ReopenRejectedDocumentFeature.Completed : reopenSucceeded
    %% verify: API 回 200；Document.status 變為 Draft，current_version_id 指向新 Draft 版本，AuditLog 寫入 ReopenAsDraft。

    ReopenRejectedDocumentFeature.CreatingDraft --> ReopenRejectedDocumentFeature.Failed : reopenFailed
    %% verify: 重開失敗時 Document 仍維持 Rejected；不建立新版本，也不更動既有附件與退回紀錄。

    ReopenRejectedDocumentFeature.Failed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後狀態仍是 Rejected，且頁面仍只顯示「退回後修改」入口與既有退回資訊。

    ReopenRejectedDocumentFeature.Completed --> DocumentDetailUserPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後狀態已是 Draft，current_version_id 指向新 Draft 版本，使用者可重新編輯與上傳新附件。
```

## ⑯ Feature: ApproveReviewTaskFeature
```mermaid
%% role: Reviewer
stateDiagram-v2
    [*] --> ApproveReviewTaskFeature.Init : enterFeature
    %% verify: 只有 assignee_id=目前 Reviewer 且 status=Pending 的 ReviewTask 可進入同意流程；其他任務不得進入。

    ApproveReviewTaskFeature.Init --> ApproveReviewTaskFeature.Submitting : submitApproval
    %% verify: 同意送出時按鈕 disabled；系統以交易或條件式更新確保同一筆 Pending 任務只能被處理一次。

    ApproveReviewTaskFeature.Submitting --> ApproveReviewTaskFeature.StepAdvanced : approveSucceeded [moreStepsOrApproversRemain]
    %% verify: API 回 200；目前 ReviewTask.status 變為 Approved 並寫入 acted_at 與 ApprovalRecord(action=Approved)，文件仍維持 In Review，且若流程需要會啟用下一步或保留其他 Pending 任務。

    ApproveReviewTaskFeature.Submitting --> ApproveReviewTaskFeature.DocumentApproved : approveSucceeded [finalApprovalReached]
    %% verify: API 回 200；最後必要同意完成後 Document.status 變為 Approved，AuditLog 寫入 ApproveTask 與 EnterApproved，列表與詳情狀態同步更新。

    ApproveReviewTaskFeature.Submitting --> ApproveReviewTaskFeature.Failed : approveFailed
    %% verify: 若任務已被他人處理或非本人任務，API 回 409 或 403；不得重複建立 ApprovalRecord，也不得錯誤改變文件狀態。

    ApproveReviewTaskFeature.StepAdvanced --> DocumentDetailReviewerPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後目前任務不再是 Pending；若仍有其他步驟或他人待辦，文件顯示 In Review 與更新後任務狀態。

    ApproveReviewTaskFeature.DocumentApproved --> DocumentDetailReviewerPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後文件顯示 Approved，Reviewer 不再看到同意或退回入口，審核紀錄包含最後一次 Approved。

    ApproveReviewTaskFeature.Failed --> DocumentDetailReviewerPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後若任務仍是 Pending 才能再次操作；若已非 Pending，畫面不得再顯示可重複提交的按鈕。
```

## ⑰ Feature: RejectReviewTaskFeature
```mermaid
%% role: Reviewer
stateDiagram-v2
    [*] --> RejectReviewTaskFeature.Init : enterFeature
    %% verify: 只有目前 Reviewer 自己的 Pending 任務可以進入退回流程；不屬於自己的任務不得打開退回表單。

    RejectReviewTaskFeature.Init --> RejectReviewTaskFeature.CollectingReason : openRejectForm
    %% verify: 打開退回表單時 UI 顯示必填理由欄位；空白理由不得被視為可送出狀態。

    RejectReviewTaskFeature.CollectingReason --> RejectReviewTaskFeature.Submitting : submitRejectReason
    %% verify: 送出退回理由時按鈕 disabled，理由內容會被安全顯示與儲存，避免 XSS 注入。

    RejectReviewTaskFeature.Submitting --> RejectReviewTaskFeature.Completed : rejectSucceeded
    %% verify: API 回 200；目前 ReviewTask.status=Rejected、acted_at 已寫入，新增 ApprovalRecord(action=Rejected, reason)，Document.status 變為 Rejected，其他 Pending 任務全部改為 Cancelled。

    RejectReviewTaskFeature.Submitting --> RejectReviewTaskFeature.Failed : rejectFailed
    %% verify: 若理由缺失、任務已被處理或權限不足，API 回 400、409 或 403；不得新增 ApprovalRecord，也不得改變 Document.status。

    RejectReviewTaskFeature.Failed --> RejectReviewTaskFeature.CollectingReason : retryReject
    %% verify: 返回理由表單後原輸入可保留供修正；只有在補齊合法理由後才可再次送出。

    RejectReviewTaskFeature.Completed --> DocumentDetailReviewerPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後文件顯示 Rejected，Reviewer 不再看到待處理按鈕，並可看到退回理由與其他任務已取消。
```

## ⑱ Feature: ManageFlowTemplateFeature
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> ManageFlowTemplateFeature.Init : enterFeature
    %% verify: 只有 Admin 可以進入流程模板管理功能；User 與 Reviewer 不得看到建立、編輯或停用入口。

    ManageFlowTemplateFeature.Init --> ManageFlowTemplateFeature.EditingTemplate : openCreateOrEditTemplate
    %% verify: 模板編輯器顯示 name、is_active、step_key、order_index、mode 與 assignee 規則欄位，供 Admin 建立或修改模板。

    ManageFlowTemplateFeature.EditingTemplate --> ManageFlowTemplateFeature.SavingTemplate : submitTemplateChanges
    %% verify: 儲存模板請求送出時按鈕 disabled；每個 step 都需有 step_key、order_index、mode，且 assignee 規則完整。

    ManageFlowTemplateFeature.EditingTemplate --> ManageFlowTemplateFeature.DeactivatingTemplate : deactivateTemplate
    %% verify: 停用流程模板請求只允許 Admin 送出；操作的是既有模板的 is_active 狀態，不是刪除模板。

    ManageFlowTemplateFeature.SavingTemplate --> ManageFlowTemplateFeature.Completed : saveTemplateSucceeded
    %% verify: API 回 200；模板 name、steps、mode、assignee 規則與 updated_at 被持久化，且後續送審只能選擇 is_active=true 的模板。

    ManageFlowTemplateFeature.SavingTemplate --> ManageFlowTemplateFeature.Failed : saveTemplateFailed
    %% verify: 儲存失敗時不應留下部分更新的 steps 或 assignee；畫面顯示錯誤並保持可修正狀態。

    ManageFlowTemplateFeature.DeactivatingTemplate --> ManageFlowTemplateFeature.Completed : deactivateTemplateSucceeded
    %% verify: API 回 200；模板仍存在但 is_active=false，之後送審前置條件不得再選用此模板。

    ManageFlowTemplateFeature.DeactivatingTemplate --> ManageFlowTemplateFeature.Failed : deactivateTemplateFailed
    %% verify: 停用失敗時模板維持原本 is_active 狀態與 steps 資料；畫面顯示具體錯誤原因。

    ManageFlowTemplateFeature.Failed --> ManageFlowTemplateFeature.EditingTemplate : retryTemplateChange
    %% verify: 返回編輯器後 Admin 可重新調整模板資料再送出；錯誤提示不應阻止再次編輯。

    ManageFlowTemplateFeature.Completed --> AdminFlowsPage.Init : returnToFlowTemplates | navigate /admin/flows
    %% verify: 返回模板列表後，name、is_active、updated_at 與剛完成操作的結果一致，且列表不會遺失其他模板資料。
```

## ⑲ Feature: ArchiveDocumentFeature
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> ArchiveDocumentFeature.Init : enterFeature
    %% verify: 只有 Admin 且文件 status=Approved 時可進入封存流程；其他角色或其他狀態不得觸發。

    ArchiveDocumentFeature.Init --> ArchiveDocumentFeature.Submitting : submitArchive
    %% verify: 封存請求只送出一次；按鈕 disabled，避免重複提交 Approved -> Archived 轉換。

    ArchiveDocumentFeature.Submitting --> ArchiveDocumentFeature.Completed : archiveSucceeded
    %% verify: API 回 200；Document.status 變為 Archived，AuditLog 新增 ArchiveDocument，文件與版本資料維持 append-only 不可刪改。

    ArchiveDocumentFeature.Submitting --> ArchiveDocumentFeature.Failed : archiveFailed
    %% verify: 若文件已非 Approved 或請求失敗，API 回 400 或 5xx；Document.status 維持原值，且不新增 ArchiveDocument 稽核事件。

    ArchiveDocumentFeature.Failed --> DocumentDetailAdminPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後若封存失敗，文件仍維持原狀態並保留或隱藏封存按鈕與實際狀態一致。

    ArchiveDocumentFeature.Completed --> DocumentDetailAdminPage.Init : returnToDocument | navigate /documents/:id
    %% verify: 返回詳情後文件顯示 Archived 且為只讀；封存入口消失，列表與詳情的 status、updated_at 一致。
```