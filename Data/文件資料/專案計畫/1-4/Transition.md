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
    [*] --> Entry.Init: enterSystem
    %% verify: 首次進站僅提供 Guest 可見入口；畫面不得直接假設既有 session 或自動決定 Customer、Agent、Admin 身分

    Entry.Init --> LoginPage.Init: chooseLogin | navigate /login
    %% verify: 導向 /login 後 Header 僅顯示 登入、註冊；不得出現 我的工單、工單工作台、管理後台、登出

    Entry.Init --> RegisterPage.Init: chooseRegister | navigate /register
    %% verify: 導向 /register 後 Header 僅顯示 登入、註冊；註冊是取得非 Guest 身分的公開入口之一
```

## ② Login Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> LoginPage.Init: enterPage
    %% verify: 進入 /login 時顯示 Email、Password 欄位與登入 CTA；頁面內不得重複出現第二個登入主 CTA

    LoginPage.Init --> LoginPage.Ready: showLoginForm
    %% verify: Header 僅顯示 登入、註冊；登入表單可輸入且尚未送出時按鈕可點擊

    LoginPage.Init --> CustomerTicketsPage.Init: enterAuthenticatedCustomer | navigate /tickets
    %% verify: 已登入 Customer 進入 /login 時直接導向 /tickets；不得停留在登入頁

    LoginPage.Init --> AgentTicketsPage.Init: enterAuthenticatedAgent | navigate /agent/tickets
    %% verify: 已登入 Agent 進入 /login 時直接導向 /agent/tickets；Header 改為 工單工作台、登出

    LoginPage.Init --> AdminDashboardPage.Init: enterAuthenticatedAdmin | navigate /admin/dashboard
    %% verify: 已登入 Admin 進入 /login 時直接導向 /admin/dashboard；Header 顯示 管理後台、工單工作台、登出

    LoginPage.Ready --> AuthLoginFeature.Init: submitLogin | navigate AuthLoginFeature
    %% verify: 送出登入後按鈕 disabled 並顯示送出中；後續只接受 200 或 400、401 對應的成功或失敗收斂

    LoginPage.Ready --> RegisterPage.Init: chooseRegister | navigate /register
    %% verify: 從登入頁前往註冊頁時不建立 token；Guest 導覽維持只有 登入、註冊
```

## ③ Register Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> RegisterPage.Init: enterPage
    %% verify: 進入 /register 時顯示 Email、Password、Password Confirm 欄位與註冊 CTA；頁面內不得重複出現第二個註冊主 CTA

    RegisterPage.Init --> RegisterPage.Ready: showRegisterForm
    %% verify: Header 僅顯示 登入、註冊；表單可輸入且尚未送出時按鈕可點擊

    RegisterPage.Init --> CustomerTicketsPage.Init: enterAuthenticatedCustomer | navigate /tickets
    %% verify: 已登入 Customer 進入 /register 時直接導向 /tickets；不得停留在註冊頁

    RegisterPage.Ready --> AuthRegisterFeature.Init: submitRegister | navigate AuthRegisterFeature
    %% verify: 送出註冊後按鈕 disabled 並顯示送出中；後續只接受建立成功或欄位驗證失敗的收斂結果

    RegisterPage.Ready --> LoginPage.Init: chooseLogin | navigate /login
    %% verify: 從註冊頁切回 /login 時不建立帳號與 token；Guest 導覽維持只有 登入、註冊
```

## ④ Customer Tickets Page State Machine
```mermaid
%% role: Customer
stateDiagram-v2
    [*] --> CustomerTicketsPage.Init: enterPage
    %% verify: 進入 /tickets 前需驗證有效 token 與 Customer 身分；無 token 時走 401 導向 /login，非 Customer 時顯示 403

    CustomerTicketsPage.Init --> CustomerTicketsPage.Loading: loadOwnTickets
    %% verify: 進入頁面即請求自己的工單列表；Header 僅顯示 我的工單、登出，且 Header 不得重複提供 建立新工單 CTA

    CustomerTicketsPage.Loading --> CustomerTicketsPage.Ready: loadSuccessWithItems
    %% verify: 列表 API 回 200 且只包含 customer_id=自己 的工單；每筆顯示 title、category、status、updated_at、assignee

    CustomerTicketsPage.Loading --> CustomerTicketsPage.Empty: loadSuccessWithoutItems
    %% verify: 列表 API 回 200 且結果為空；頁面顯示 Empty 並保留 建立新工單 CTA

    CustomerTicketsPage.Loading --> CustomerTicketsPage.Failed: loadFailed
    %% verify: 列表請求失敗時顯示 Error 與 Retry；不得顯示其他人的工單殘留資料

    CustomerTicketsPage.Ready --> CustomerTicketsPage.Loading: changeStatusFilter
    %% verify: 依 status 篩選後重新請求列表；回傳結果只包含所選狀態，列表數量與同權限範圍的狀態統計一致

    CustomerTicketsPage.Ready --> CreateTicketFeature.Init: clickCreateTicket | navigate CreateTicketFeature
    %% verify: 建立新工單 CTA 只出現在頁面內；點擊後進入建立工單流程，不在 Header 重複呈現相同動作

    CustomerTicketsPage.Ready --> TicketDetailRoutePage.Init: openTicketDetail | navigate /tickets/:id
    %% verify: 點擊任一工單後進入 /tickets/:id；僅允許打開屬於自己的工單

    CustomerTicketsPage.Empty --> CreateTicketFeature.Init: clickCreateTicket | navigate CreateTicketFeature
    %% verify: Empty 狀態仍可建立新工單；不需要先有既有工單資料

    CustomerTicketsPage.Failed --> CustomerTicketsPage.Init: retryLoad
    %% verify: 點擊 Retry 會重新載入列表；先前錯誤訊息不應阻止再次請求

    CustomerTicketsPage.Ready --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後 token 被清除或失效；回到 /login 且 Header 回復為 登入、註冊

    CustomerTicketsPage.Empty --> LoginPage.Init: logout | navigate /login
    %% verify: 即使列表為空，登出後也不得停留在受保護頁面
```

## ⑤ Agent Tickets Page State Machine
```mermaid
%% role: Agent|Admin
stateDiagram-v2
    [*] --> AgentTicketsPage.Init: enterPage
    %% verify: 進入 /agent/tickets 前需驗證有效 token；Customer 進入時顯示 403，Agent 與 Admin 可進入

    AgentTicketsPage.Init --> AgentTicketsPage.Loading: loadWorkbenchTickets
    %% verify: 載入未指派與指派給我的清單；Agent 只看到未指派與 assignee_id=自己，Admin 可看到管理所需資料

    AgentTicketsPage.Loading --> AgentTicketsPage.Ready: loadSuccessWithItems
    %% verify: API 回 200 且每筆顯示 title、category、status、updated_at、assignee；視圖切換控制可見

    AgentTicketsPage.Loading --> AgentTicketsPage.Empty: loadSuccessWithoutItems
    %% verify: API 回 200 且結果為空；頁面顯示 Empty，仍可切換 未指派 與 指派給我 視圖

    AgentTicketsPage.Loading --> AgentTicketsPage.Failed: loadFailed
    %% verify: 請求失敗時顯示 Error 與 Retry；不得保留過期列表資料造成誤判

    AgentTicketsPage.Ready --> AgentTicketsPage.Loading: changeViewOrStatusFilter
    %% verify: 切換 未指派、指派給我 與 status 篩選後重新請求；結果集合需與目前視圖條件一致

    AgentTicketsPage.Ready --> AgentTakeTicketFeature.Init: takeUnassignedTicket | navigate AgentTakeTicketFeature
    %% verify: 只有未指派且 status=Open 的工單可接手；重複點擊前端需防重送

    AgentTicketsPage.Ready --> TicketDetailRoutePage.Init: openTicketDetail | navigate /tickets/:id
    %% verify: 點擊工單後進入詳情頁；Agent 只可開啟未指派或指派給自己的工單，Admin 可開啟所有工單

    AgentTicketsPage.Failed --> AgentTicketsPage.Init: retryLoad
    %% verify: Retry 會重新請求工作台資料；錯誤狀態不應阻塞後續操作

    AgentTicketsPage.Ready --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後 token 被清除或失效；重新進入受保護路由時應走 401 導向 /login

    AgentTicketsPage.Empty --> LoginPage.Init: logout | navigate /login
    %% verify: Empty 狀態登出後也需回到 /login，且 Header 不得殘留 工單工作台 或 管理後台
```

## ⑥ Admin Dashboard Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminDashboardPage.Init: enterPage
    %% verify: 進入 /admin/dashboard 前需驗證有效 token 與 Admin 身分；未登入導向 /login，非 Admin 顯示 403

    AdminDashboardPage.Init --> AdminDashboardPage.Loading: loadDashboard
    %% verify: 請求 SLA、狀態分佈、客服負載資料；Header 顯示 管理後台、工單工作台、登出，且不重複放置相同主 CTA

    AdminDashboardPage.Loading --> AdminDashboardPage.Ready: loadSuccessWithData
    %% verify: API 回 200 且顯示首次回覆時間、解決時間、各 status 數量、每位 Agent 的進行中工單數；統計與相同時間範圍資料一致

    AdminDashboardPage.Loading --> AdminDashboardPage.Empty: loadSuccessWithoutData
    %% verify: API 回 200 且無資料時顯示 Empty；時間範圍切換仍可操作

    AdminDashboardPage.Loading --> AdminDashboardPage.Failed: loadFailed
    %% verify: 請求失敗時顯示 Error 與 Retry；不得顯示混雜或過期統計值

    AdminDashboardPage.Ready --> AdminDashboardPage.Loading: changeTimeRange
    %% verify: 切換近 7 天或近 30 天後重新請求；畫面上的時間範圍標示與資料範圍一致

    AdminDashboardPage.Ready --> TicketDetailRoutePage.Init: openTicketDetail | navigate /tickets/:id
    %% verify: 從管理後台點選工單後進入詳情頁；Admin 可查看所有工單的時間軸與目前狀態

    AdminDashboardPage.Ready --> AdminUserManagementFeature.Init: manageAgentAccounts | navigate AdminUserManagementFeature
    %% verify: 從管理後台可進入客服帳號管理流程；僅 Admin 看得到這個入口

    AdminDashboardPage.Ready --> AgentTicketsPage.Init: openWorkbench | navigate /agent/tickets
    %% verify: Admin 可從管理後台前往 /agent/tickets 進行監控或支援；Customer 不可看到此導覽

    AdminDashboardPage.Failed --> AdminDashboardPage.Init: retryLoad
    %% verify: Retry 會重新請求統計資料；先前錯誤訊息不應阻止再次載入

    AdminDashboardPage.Ready --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後 token 被清除或失效；回到 /login 並移除所有 Admin 導覽項

    AdminDashboardPage.Empty --> LoginPage.Init: logout | navigate /login
    %% verify: 即使無資料，登出後也不得停留在 /admin/dashboard
```

## ⑦ Ticket Detail Route Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> TicketDetailRoutePage.Init: enterPage
    %% verify: 進入 /tickets/:id 時先做身份與可見範圍判定；不得在未驗證前顯示任何工單內容

    TicketDetailRoutePage.Init --> TicketDetailRoutePage.Loading: loadTicketDetail
    %% verify: 詳情 API 請求包含基本資訊與留言時間軸；Customer 不可看到 is_internal=true 留言

    TicketDetailRoutePage.Loading --> TicketDetailCustomerPage.Init: accessAsCustomer | navigate /tickets/:id
    %% verify: API 回 200 且 ticket.customer_id=當前 Customer；頁面只顯示屬於自己的工單內容

    TicketDetailRoutePage.Loading --> TicketDetailAgentPage.Init: accessAsAgent | navigate /tickets/:id
    %% verify: API 回 200 且工單未指派或 assignee_id=當前 Agent；Agent 視角可看到內部備註

    TicketDetailRoutePage.Loading --> TicketDetailAdminPage.Init: accessAsAdmin | navigate /tickets/:id
    %% verify: API 回 200 且 Admin 可查看完整工單內容、內部備註、指派資訊與狀態

    TicketDetailRoutePage.Loading --> LoginPage.Init: noToken | navigate /login
    %% verify: 無有效 token 時 API 回 401；前端清除 session 並導向 /login

    TicketDetailRoutePage.Loading --> TicketDetailRoutePage.Forbidden: forbidden
    %% verify: 已登入但不具可見權限時 API 回 403；UI 顯示 Forbidden 且不得洩漏工單標題、留言、指派資訊

    TicketDetailRoutePage.Loading --> TicketDetailRoutePage.NotFound: notFound
    %% verify: 工單不存在或策略採 404 時 UI 顯示 Not Found；不得顯示任何舊資料

    TicketDetailRoutePage.Loading --> TicketDetailRoutePage.Failed: loadFailed
    %% verify: 其他載入失敗時顯示 Error 與 Retry；不應留下半套詳情資料

    TicketDetailRoutePage.Failed --> TicketDetailRoutePage.Init: retryLoad
    %% verify: Retry 重新請求同一筆工單詳情；若權限或狀態已改變，結果需以最新伺服器狀態為準
```

## ⑧ Ticket Detail Page State Machine（Customer）
```mermaid
%% role: Customer
stateDiagram-v2
    [*] --> TicketDetailCustomerPage.Init: enterRolePage
    %% verify: Customer 視角只呈現自己的 ticket 資訊；留言時間軸不得出現內部備註

    TicketDetailCustomerPage.Init --> TicketDetailCustomerPage.Viewing: renderTicket
    %% verify: 顯示 title、status、category、assignee、created_at、updated_at 與公開留言時間軸；留言依 created_at 排序

    TicketDetailCustomerPage.Viewing --> CustomerReplyFeature.Init: submitReplyWhenWaitingForCustomer | navigate CustomerReplyFeature
    %% verify: 只有 status=Waiting for Customer 時可送出回覆；其他狀態不得顯示或啟用回覆送出入口

    TicketDetailCustomerPage.Viewing --> CustomerCloseTicketFeature.Init: closeWhenResolved | navigate CustomerCloseTicketFeature
    %% verify: 只有 status=Resolved 時可顯示 關閉工單 CTA；Closed 後不得再出現任何互動入口

    TicketDetailCustomerPage.Viewing --> CustomerTicketsPage.Init: backToList | navigate /tickets
    %% verify: 返回列表後仍只顯示自己的工單；詳情中的最新 status 與列表資料一致

    TicketDetailCustomerPage.Viewing --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後回到 /login；再次進入本詳情路由需重新驗證並走 401、登入流程
```

## ⑨ Ticket Detail Page State Machine（Agent）
```mermaid
%% role: Agent
stateDiagram-v2
    [*] --> TicketDetailAgentPage.Init: enterRolePage
    %% verify: Agent 視角只呈現未指派或指派給自己的 ticket；可見公開留言與內部備註

    TicketDetailAgentPage.Init --> TicketDetailAgentPage.Viewing: renderTicket
    %% verify: 顯示 title、status、category、assignee、created_at、updated_at 與完整可見時間軸；留言不可編輯或刪除

    TicketDetailAgentPage.Viewing --> AgentReplyFeature.Init: sendPublicReply | navigate AgentReplyFeature
    %% verify: Agent 可新增對客公開留言；Closed 工單不得顯示或啟用此入口

    TicketDetailAgentPage.Viewing --> AgentInternalNoteFeature.Init: addInternalNote | navigate AgentInternalNoteFeature
    %% verify: Agent 可新增內部備註；Customer 在任何畫面都不可見這筆 is_internal=true 留言

    TicketDetailAgentPage.Viewing --> AgentStatusChangeFeature.Init: changeStatus | navigate AgentStatusChangeFeature
    %% verify: Agent 只能執行 In Progress→Waiting for Customer、In Progress→Resolved、Resolved→In Progress；其他轉換需被阻擋

    TicketDetailAgentPage.Viewing --> AgentTicketsPage.Init: backToWorkbench | navigate /agent/tickets
    %% verify: 返回工作台後，剛才的 status、assignee、updated_at 需與詳情頁一致

    TicketDetailAgentPage.Viewing --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後回到 /login；Header 不得殘留 工單工作台 或 登出
```

## ⑩ Ticket Detail Page State Machine（Admin）
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> TicketDetailAdminPage.Init: enterRolePage
    %% verify: Admin 視角可查看所有 ticket 的基本資訊、完整留言時間軸、內部備註與指派資訊

    TicketDetailAdminPage.Init --> TicketDetailAdminPage.Viewing: renderTicket
    %% verify: 顯示 title、status、category、assignee、created_at、updated_at；資料需與列表與統計一致

    TicketDetailAdminPage.Viewing --> AdminAssignTicketFeature.Init: assignOrReassign | navigate AdminAssignTicketFeature
    %% verify: Admin 可指派或改派一位 Agent；同一時間只允許一位 assignee

    TicketDetailAdminPage.Viewing --> AdminStatusChangeFeature.Init: changeStatus | navigate AdminStatusChangeFeature
    %% verify: Admin 只能執行 Open→In Progress、Resolved→In Progress、Resolved→Closed；不得做未定義跳轉

    TicketDetailAdminPage.Viewing --> AdminDashboardPage.Init: backToDashboard | navigate /admin/dashboard
    %% verify: 返回管理後台後，若本工單影響統計，SLA、狀態分佈、客服負載需反映最新資料

    TicketDetailAdminPage.Viewing --> AgentTicketsPage.Init: openWorkbench | navigate /agent/tickets
    %% verify: Admin 可從詳情切回工作台；工作台與詳情頁的 assignee 與 status 顯示一致

    TicketDetailAdminPage.Viewing --> LoginPage.Init: logout | navigate /login
    %% verify: 登出後回到 /login；Header 不得再顯示 管理後台 或 工單工作台
```

## ⑪ Feature: AuthLoginFeature
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthLoginFeature.Init: enterFeature
    %% verify: 只有從登入頁提交表單才會進入此流程；尚未建立 token 前不得視為已登入

    AuthLoginFeature.Init --> AuthLoginFeature.Submitting: submitCredentials
    %% verify: 發送登入 API 時按鈕 disabled 並顯示送出中；避免重複送出相同帳密

    AuthLoginFeature.Submitting --> AuthLoginFeature.CustomerAuthenticated: loginSuccessAsCustomer
    %% verify: API 回 200 並回傳有效 token；使用者角色為 Customer，後續受保護 API 帶 token 可通過驗證

    AuthLoginFeature.Submitting --> AuthLoginFeature.AgentAuthenticated: loginSuccessAsAgent
    %% verify: API 回 200 並回傳有效 token；使用者角色為 Agent，Header 只顯示 工單工作台、登出

    AuthLoginFeature.Submitting --> AuthLoginFeature.AdminAuthenticated: loginSuccessAsAdmin
    %% verify: API 回 200 並回傳有效 token；使用者角色為 Admin，Header 顯示 管理後台、工單工作台、登出

    AuthLoginFeature.Submitting --> AuthLoginFeature.Failed: loginRejected
    %% verify: API 回 400 或 401 時顯示帳密錯誤或停用狀態訊息；不得建立 token

    AuthLoginFeature.CustomerAuthenticated --> CustomerTicketsPage.Init: goCustomerHome | navigate /tickets
    %% verify: 登入成功後導向 /tickets；列表只會載入自己的工單

    AuthLoginFeature.AgentAuthenticated --> AgentTicketsPage.Init: goAgentHome | navigate /agent/tickets
    %% verify: 登入成功後導向 /agent/tickets；只載入未指派與指派給自己的工單

    AuthLoginFeature.AdminAuthenticated --> AdminDashboardPage.Init: goAdminHome | navigate /admin/dashboard
    %% verify: 登入成功後導向 /admin/dashboard；可讀取管理統計資料

    AuthLoginFeature.Failed --> LoginPage.Init: backToLogin | navigate /login
    %% verify: 返回登入頁後保留錯誤回饋；使用者可重新輸入並再次送出
```

## ⑫ Feature: AuthRegisterFeature
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthRegisterFeature.Init: enterFeature
    %% verify: 只有從註冊頁提交表單才會進入此流程；尚未成功前不得建立帳號或 token

    AuthRegisterFeature.Init --> AuthRegisterFeature.Submitting: submitRegistration
    %% verify: 發送註冊 API 時按鈕 disabled 並顯示送出中；避免重複送出

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.CustomerRegistered: registerSuccess
    %% verify: API 回 200 並建立可用帳號；新帳號可進入 Customer 可存取的 /tickets

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.Failed: registerRejected
    %% verify: API 回 400 時顯示 Email 已存在或欄位驗證錯誤；不得建立重複帳號

    AuthRegisterFeature.CustomerRegistered --> CustomerTicketsPage.Init: goCustomerHome | navigate /tickets
    %% verify: 註冊成功後導向 /tickets；Header 顯示 我的工單、登出，不顯示 Agent、Admin 導覽

    AuthRegisterFeature.Failed --> RegisterPage.Init: backToRegister | navigate /register
    %% verify: 返回註冊頁後欄位錯誤可被修正並再次提交；頁面仍維持 Guest 導覽
```

## ⑬ Feature: CreateTicketFeature
```mermaid
%% role: Customer
stateDiagram-v2
    [*] --> CreateTicketFeature.Init: enterFeature
    %% verify: 只有 Customer 在 /tickets 可看到建立工單入口；非 Customer 不得進入此流程

    CreateTicketFeature.Init --> CreateTicketFeature.Editing: showForm
    %% verify: 表單包含 title、category、description；title 必填且長度不得超過 100 字，category 必須為 Account、Billing、Technical、Other 其一

    CreateTicketFeature.Editing --> CreateTicketFeature.Submitting: submitTicket
    %% verify: 送出時按鈕 disabled 並顯示送出中；避免重複建立同一筆工單

    CreateTicketFeature.Submitting --> CreateTicketFeature.Success: createSucceeded
    %% verify: API 回 200；新 ticket.status=Open、customer_id=當前使用者、assignee_id 為空，且同步建立一筆初始描述留言與 Audit Log

    CreateTicketFeature.Submitting --> CreateTicketFeature.ValidationFailed: validationRejected
    %% verify: API 回 400；欄位錯誤需逐項顯示在表單上，不得建立 ticket 或初始留言

    CreateTicketFeature.Submitting --> CreateTicketFeature.Forbidden: forbidden
    %% verify: 非 Customer 呼叫建立 API 時回 403；資料庫不得新增 ticket 與 TicketMessage

    CreateTicketFeature.Submitting --> CreateTicketFeature.Failed: createFailed
    %% verify: 其他失敗時顯示系統錯誤；不得留下半建立的 ticket 或遺漏的 Audit Log

    CreateTicketFeature.ValidationFailed --> CreateTicketFeature.Editing: fixFields
    %% verify: 修正欄位後可再次送出；原本可保留的輸入值不得無故遺失

    CreateTicketFeature.Success --> CustomerTicketsPage.Init: refreshList | navigate /tickets
    %% verify: 返回列表後可看到新工單；列表 updated_at、status 與詳情資料一致

    CreateTicketFeature.Forbidden --> CustomerTicketsPage.Init: backToList | navigate /tickets
    %% verify: 返回 /tickets 後不可出現新工單；頁面維持原本資料狀態

    CreateTicketFeature.Failed --> CustomerTicketsPage.Init: backToList | navigate /tickets
    %% verify: 返回 /tickets 後可重新嘗試建立；失敗不應污染現有列表資料
```

## ⑭ Feature: AgentTakeTicketFeature
```mermaid
%% role: Agent
stateDiagram-v2
    [*] --> AgentTakeTicketFeature.Init: enterFeature
    %% verify: 只有 Agent 從工作台的未指派 Open 工單可進入接手流程；一次操作只針對單一 ticket

    AgentTakeTicketFeature.Init --> AgentTakeTicketFeature.Submitting: submitTakeTicket
    %% verify: 接手請求會以當前 status 與 assignee 條件送出；前端按鈕 disabled 以避免重複提交

    AgentTakeTicketFeature.Submitting --> AgentTakeTicketFeature.Success: takeSucceeded
    %% verify: API 回 200；ticket 從 Open 變為 In Progress、assignee_id=當前 Agent，並寫入 STATUS_CHANGED 與 ASSIGNEE_CHANGED 對應 Audit Log

    AgentTakeTicketFeature.Submitting --> AgentTakeTicketFeature.Conflict: takeRejectedByConcurrency
    %% verify: 另一位 Agent 先接手時回傳明確失敗回應；ticket.status 與 assignee_id 不得被覆蓋

    AgentTakeTicketFeature.Submitting --> AgentTakeTicketFeature.Forbidden: forbidden
    %% verify: 非 Agent 或不可見工單接手時回 403；不得改變 ticket

    AgentTakeTicketFeature.Submitting --> AgentTakeTicketFeature.Failed: takeFailed
    %% verify: 其他失敗時顯示明確錯誤；前端不得誤顯示已接手成功

    AgentTakeTicketFeature.Success --> AgentTicketsPage.Init: refreshWorkbench | navigate /agent/tickets
    %% verify: 返回工作台後該工單出現在 指派給我 視圖，status=In Progress，updated_at 與詳情一致

    AgentTakeTicketFeature.Conflict --> AgentTicketsPage.Init: refreshWorkbench | navigate /agent/tickets
    %% verify: 返回工作台後顯示最新指派結果；未成功接手者不應在 指派給我 視圖看到該工單

    AgentTakeTicketFeature.Forbidden --> AgentTicketsPage.Init: backToWorkbench | navigate /agent/tickets
    %% verify: 返回工作台後資料維持原狀；錯誤訊息明確指出權限不足或工單不可見

    AgentTakeTicketFeature.Failed --> AgentTicketsPage.Init: backToWorkbench | navigate /agent/tickets
    %% verify: 返回工作台後可再次載入最新列表；失敗不應造成視圖與伺服器狀態不一致
```

## ⑮ Feature: CustomerReplyFeature
```mermaid
%% role: Customer
stateDiagram-v2
    [*] --> CustomerReplyFeature.Init: enterFeature
    %% verify: 只有 Customer 在 status=Waiting for Customer 的自己工單可進入回覆流程；Closed 工單不得進入

    CustomerReplyFeature.Init --> CustomerReplyFeature.Submitting: submitReply
    %% verify: 送出時按鈕 disabled 並顯示送出中；留言內容需經安全處理以避免 XSS

    CustomerReplyFeature.Submitting --> CustomerReplyFeature.Success: replySucceeded
    %% verify: API 回 200；新增 TicketMessage(role=Customer,is_internal=false)，ticket.status 變為 In Progress，updated_at 更新並寫入 MESSAGE_CREATED 與 STATUS_CHANGED Audit Log

    CustomerReplyFeature.Submitting --> CustomerReplyFeature.Forbidden: replyRejected
    %% verify: 非 Waiting for Customer、非本人 ticket 或 Closed 工單送出時回 400 或 403；不得新增留言

    CustomerReplyFeature.Submitting --> CustomerReplyFeature.Failed: replyFailed
    %% verify: 其他失敗時顯示明確錯誤；時間軸不得出現重複或半成功留言

    CustomerReplyFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後可看到新留言，status=In Progress，列表中的 updated_at 與詳情一致

    CustomerReplyFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後仍維持原狀態；Customer 不得看到任何內部備註

    CustomerReplyFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新嘗試送出；畫面資料需以伺服器最新狀態為準
```

## ⑯ Feature: CustomerCloseTicketFeature
```mermaid
%% role: Customer
stateDiagram-v2
    [*] --> CustomerCloseTicketFeature.Init: enterFeature
    %% verify: 只有 Customer 在 status=Resolved 的自己工單可進入關閉流程；其他狀態不得顯示此 CTA

    CustomerCloseTicketFeature.Init --> CustomerCloseTicketFeature.Submitting: submitClose
    %% verify: 送出關閉請求時按鈕 disabled 並顯示處理中；請求需帶入當前狀態條件避免競態

    CustomerCloseTicketFeature.Submitting --> CustomerCloseTicketFeature.Success: closeSucceeded
    %% verify: API 回 200；ticket.status=Closed、closed_at 有值，且寫入 STATUS_CHANGED Audit Log；Closed 後禁止新增留言與任何狀態變更

    CustomerCloseTicketFeature.Submitting --> CustomerCloseTicketFeature.Forbidden: closeRejected
    %% verify: 非本人 ticket、非 Resolved 或已 Closed 再次送出時回 400 或 403；closed_at 不得被錯誤覆蓋

    CustomerCloseTicketFeature.Submitting --> CustomerCloseTicketFeature.Failed: closeFailed
    %% verify: 其他失敗時顯示明確錯誤；前端不得誤顯示為已關閉

    CustomerCloseTicketFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後顯示 Closed，所有互動入口關閉，列表與詳情狀態一致

    CustomerCloseTicketFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後仍維持原本狀態；若仍為 Resolved，可依規則再次操作

    CustomerCloseTicketFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新載入最新資料；失敗不應產生部分關閉結果
```

## ⑰ Feature: AgentReplyFeature
```mermaid
%% role: Agent
stateDiagram-v2
    [*] --> AgentReplyFeature.Init: enterFeature
    %% verify: 只有 Agent 在可見範圍內的 ticket 可進入公開回覆流程；Closed 工單不得進入

    AgentReplyFeature.Init --> AgentReplyFeature.Submitting: submitPublicReply
    %% verify: 送出時按鈕 disabled 並顯示送出中；留言內容需安全處理以避免 XSS

    AgentReplyFeature.Submitting --> AgentReplyFeature.Success: replySucceeded
    %% verify: API 回 200；新增 TicketMessage(role=Agent,is_internal=false)，留言不可編輯刪除並寫入 MESSAGE_CREATED Audit Log

    AgentReplyFeature.Submitting --> AgentReplyFeature.Forbidden: replyRejected
    %% verify: 不可見工單或 Closed 工單送出時回 403 或 400；不得新增留言

    AgentReplyFeature.Submitting --> AgentReplyFeature.Failed: replyFailed
    %% verify: 其他失敗時顯示明確錯誤；時間軸不得出現重複公開留言

    AgentReplyFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後 Agent 與 Customer 都可看到該公開留言，updated_at 與列表資料同步

    AgentReplyFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後資料維持原狀；若因權限變更不可見，路由層應重新做可見性判定

    AgentReplyFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新嘗試送出；失敗不應改變 ticket.status
```

## ⑱ Feature: AgentInternalNoteFeature
```mermaid
%% role: Agent
stateDiagram-v2
    [*] --> AgentInternalNoteFeature.Init: enterFeature
    %% verify: 只有 Agent 在可見範圍內的 ticket 可進入內部備註流程；Customer 永遠不可見此入口

    AgentInternalNoteFeature.Init --> AgentInternalNoteFeature.Submitting: submitInternalNote
    %% verify: 送出時按鈕 disabled 並顯示送出中；請求必須帶 is_internal=true

    AgentInternalNoteFeature.Submitting --> AgentInternalNoteFeature.Success: noteSucceeded
    %% verify: API 回 200；新增 TicketMessage(role=Agent,is_internal=true) 並寫入 MESSAGE_CREATED Audit Log；Customer 詳情頁不得顯示此筆資料

    AgentInternalNoteFeature.Submitting --> AgentInternalNoteFeature.Forbidden: noteRejected
    %% verify: 不可見工單或 Closed 工單送出時回 403 或 400；不得新增內部備註

    AgentInternalNoteFeature.Submitting --> AgentInternalNoteFeature.Failed: noteFailed
    %% verify: 其他失敗時顯示明確錯誤；不得留下半成功資料

    AgentInternalNoteFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後 Agent 可看到新內部備註，Customer 重新載入同工單時仍不可見

    AgentInternalNoteFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後資料維持原狀；不得因錯誤暴露內部備註內容

    AgentInternalNoteFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新嘗試送出；失敗不應改變 status 或 assignee
```

## ⑲ Feature: AgentStatusChangeFeature
```mermaid
%% role: Agent
stateDiagram-v2
    [*] --> AgentStatusChangeFeature.Init: enterFeature
    %% verify: 只有 Agent 在可見範圍內的 ticket 可進入狀態變更流程；Closed 工單不得進入任何狀態變更

    AgentStatusChangeFeature.Init --> AgentStatusChangeFeature.SubmittingWaitingForCustomer: setWaitingForCustomer
    %% verify: 只有當前狀態為 In Progress 時才允許送出；請求需以目前 status 做條件避免非法轉換

    AgentStatusChangeFeature.Init --> AgentStatusChangeFeature.SubmittingResolved: setResolved
    %% verify: 只有當前狀態為 In Progress 時才允許送出；成功後 Customer 才可看到關閉工單 CTA

    AgentStatusChangeFeature.Init --> AgentStatusChangeFeature.SubmittingReopen: reopenToInProgress
    %% verify: 只有當前狀態為 Resolved 時才允許送出；Closed 工單不得重新開啟

    AgentStatusChangeFeature.SubmittingWaitingForCustomer --> AgentStatusChangeFeature.Success: setWaitingForCustomerSucceeded
    %% verify: API 回 200；ticket.status=Waiting for Customer，並寫入 STATUS_CHANGED Audit Log

    AgentStatusChangeFeature.SubmittingResolved --> AgentStatusChangeFeature.Success: setResolvedSucceeded
    %% verify: API 回 200；ticket.status=Resolved，列表與詳情需同步更新 status 與 updated_at

    AgentStatusChangeFeature.SubmittingReopen --> AgentStatusChangeFeature.Success: reopenSucceeded
    %% verify: API 回 200；ticket.status=In Progress，表示重新開啟處理並寫入 STATUS_CHANGED Audit Log

    AgentStatusChangeFeature.SubmittingWaitingForCustomer --> AgentStatusChangeFeature.Forbidden: waitingForCustomerRejected
    %% verify: 當前狀態不是 In Progress 或角色不符時回 400 或 403；不得改變 status

    AgentStatusChangeFeature.SubmittingResolved --> AgentStatusChangeFeature.Forbidden: resolvedRejected
    %% verify: 當前狀態不是 In Progress 或角色不符時回 400 或 403；不得改變 status

    AgentStatusChangeFeature.SubmittingReopen --> AgentStatusChangeFeature.Forbidden: reopenRejected
    %% verify: 當前狀態不是 Resolved、角色不符或工單已 Closed 時回 400 或 403；不得改變 status

    AgentStatusChangeFeature.SubmittingWaitingForCustomer --> AgentStatusChangeFeature.Failed: waitingForCustomerFailed
    %% verify: 其他失敗時顯示明確錯誤；不得出現前端顯示已切換但伺服器未更新的情況

    AgentStatusChangeFeature.SubmittingResolved --> AgentStatusChangeFeature.Failed: resolvedFailed
    %% verify: 其他失敗時顯示明確錯誤；列表與詳情資料不得失去一致性

    AgentStatusChangeFeature.SubmittingReopen --> AgentStatusChangeFeature.Failed: reopenFailed
    %% verify: 其他失敗時顯示明確錯誤；不得改壞現有 assignee 或 updated_at

    AgentStatusChangeFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後顯示最新 status；若切到 Waiting for Customer，Customer 回覆入口才會啟用

    AgentStatusChangeFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後仍維持原狀態；UI 不得誤顯示成功訊息

    AgentStatusChangeFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新載入最新狀態；失敗不應破壞時間軸與狀態一致性
```

## ⑳ Feature: AdminAssignTicketFeature
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminAssignTicketFeature.Init: enterFeature
    %% verify: 只有 Admin 可進入指派或改派流程；一次操作只允許設定一位 assignee

    AdminAssignTicketFeature.Init --> AdminAssignTicketFeature.Submitting: submitAssignment
    %% verify: 送出時需驗證目標 assignee 存在且角色為 Agent；前端按鈕 disabled 避免重複提交

    AdminAssignTicketFeature.Submitting --> AdminAssignTicketFeature.Success: assignmentSucceeded
    %% verify: API 回 200；ticket.assignee_id 更新為指定 Agent，並寫入 ASSIGNEE_CHANGED Audit Log，metadata 需保留前後 assignee

    AdminAssignTicketFeature.Submitting --> AdminAssignTicketFeature.Forbidden: assignmentRejected
    %% verify: 非 Admin、目標角色不符或工單不可操作時回 403 或 400；assignee_id 不得改變

    AdminAssignTicketFeature.Submitting --> AdminAssignTicketFeature.Failed: assignmentFailed
    %% verify: 其他失敗時顯示明確錯誤；不得出現詳情與列表 assignee 不一致

    AdminAssignTicketFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後顯示新的 assignee；若回到工作台，工單所屬 Agent 視圖需同步更新

    AdminAssignTicketFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後維持原 assignee；錯誤訊息需指出是權限或資料驗證失敗

    AdminAssignTicketFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新指派；失敗不應產生部分更新或遺漏 Audit Log
```

## ㉑ Feature: AdminStatusChangeFeature
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminStatusChangeFeature.Init: enterFeature
    %% verify: 只有 Admin 可進入此流程；可用操作僅限 Open→In Progress、Resolved→In Progress、Resolved→Closed

    AdminStatusChangeFeature.Init --> AdminStatusChangeFeature.SubmittingStart: setInProgressFromOpen
    %% verify: 只有當前狀態為 Open 時才允許送出；請求需以目前 status 做條件避免競態

    AdminStatusChangeFeature.Init --> AdminStatusChangeFeature.SubmittingReopen: setInProgressFromResolved
    %% verify: 只有當前狀態為 Resolved 時才允許重新開啟；不得對 Closed 工單送出

    AdminStatusChangeFeature.Init --> AdminStatusChangeFeature.SubmittingClose: setClosedFromResolved
    %% verify: 只有當前狀態為 Resolved 時才允許關閉；成功後 closed_at 必須寫入

    AdminStatusChangeFeature.SubmittingStart --> AdminStatusChangeFeature.Success: startSucceeded
    %% verify: API 回 200；ticket.status=In Progress 並寫入 STATUS_CHANGED Audit Log

    AdminStatusChangeFeature.SubmittingReopen --> AdminStatusChangeFeature.Success: reopenSucceeded
    %% verify: API 回 200；ticket.status=In Progress，closed_at 仍應為空且資料一致

    AdminStatusChangeFeature.SubmittingClose --> AdminStatusChangeFeature.Success: closeSucceeded
    %% verify: API 回 200；ticket.status=Closed、closed_at 有值，後續任何留言與狀態變更都需被拒絕

    AdminStatusChangeFeature.SubmittingStart --> AdminStatusChangeFeature.Forbidden: startRejected
    %% verify: 當前狀態不是 Open 或角色不符時回 400 或 403；status 不得被改動

    AdminStatusChangeFeature.SubmittingReopen --> AdminStatusChangeFeature.Forbidden: reopenRejected
    %% verify: 當前狀態不是 Resolved 或角色不符時回 400 或 403；status 不得被改動

    AdminStatusChangeFeature.SubmittingClose --> AdminStatusChangeFeature.Forbidden: closeRejected
    %% verify: 當前狀態不是 Resolved 或角色不符時回 400 或 403；closed_at 不得被錯誤填入

    AdminStatusChangeFeature.SubmittingStart --> AdminStatusChangeFeature.Failed: startFailed
    %% verify: 其他失敗時顯示明確錯誤；不得讓工作台與詳情顯示不同 status

    AdminStatusChangeFeature.SubmittingReopen --> AdminStatusChangeFeature.Failed: reopenFailed
    %% verify: 其他失敗時顯示明確錯誤；不得改壞現有 assignee 或 updated_at

    AdminStatusChangeFeature.SubmittingClose --> AdminStatusChangeFeature.Failed: closeFailed
    %% verify: 其他失敗時顯示明確錯誤；前端不得誤判為已 Closed

    AdminStatusChangeFeature.Success --> TicketDetailRoutePage.Init: refreshDetail | navigate /tickets/:id
    %% verify: 返回詳情後顯示最新 status；若關閉成功，所有互動入口必須消失

    AdminStatusChangeFeature.Forbidden --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後仍維持原狀態；不得顯示成功提示或錯誤更新後的統計

    AdminStatusChangeFeature.Failed --> TicketDetailRoutePage.Init: backToDetail | navigate /tickets/:id
    %% verify: 返回詳情後可重新載入最新資料；失敗不應破壞詳情、列表、統計一致性
```

## ㉒ Feature: AdminUserManagementFeature
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminUserManagementFeature.Init: enterFeature
    %% verify: 只有 Admin 可進入客服帳號管理流程；功能涵蓋建立、停用與角色設定

    AdminUserManagementFeature.Init --> AdminUserManagementFeature.SubmittingCreateAgent: createAgentAccount
    %% verify: 送出建立客服帳號時需驗證 email 唯一與資料完整；新帳號角色必須是 Agent 才符合客服帳號管理用途

    AdminUserManagementFeature.Init --> AdminUserManagementFeature.SubmittingDeactivate: deactivateAccount
    %% verify: 送出停用時需明確指定目標帳號；停用後該帳號下一次 token 驗證應被拒絕並回 401 或 403

    AdminUserManagementFeature.Init --> AdminUserManagementFeature.SubmittingChangeRole: changeUserRole
    %% verify: 送出角色變更時僅允許 Customer、Agent、Admin 三種互斥角色；更新後需反映在權限與導覽可見性

    AdminUserManagementFeature.SubmittingCreateAgent --> AdminUserManagementFeature.Success: createAgentSucceeded
    %% verify: API 回 200；新 Agent 帳號可登入 /agent/tickets，且資料庫不得以明碼保存密碼

    AdminUserManagementFeature.SubmittingDeactivate --> AdminUserManagementFeature.Success: deactivateSucceeded
    %% verify: API 回 200；目標帳號 is_active=false，既有 session 在下一次驗證時被拒絕，不得再繼續存取受保護頁

    AdminUserManagementFeature.SubmittingChangeRole --> AdminUserManagementFeature.Success: changeRoleSucceeded
    %% verify: API 回 200；新角色立即影響路由存取與 Header 導覽可見性，且每位使用者僅有一個 role

    AdminUserManagementFeature.SubmittingCreateAgent --> AdminUserManagementFeature.Failed: createAgentFailed
    %% verify: API 回 400 或其他失敗時顯示欄位或系統錯誤；不得建立半完成帳號

    AdminUserManagementFeature.SubmittingDeactivate --> AdminUserManagementFeature.Failed: deactivateFailed
    %% verify: 停用失敗時帳號狀態維持原值；不得發生畫面顯示已停用但實際仍可登入

    AdminUserManagementFeature.SubmittingChangeRole --> AdminUserManagementFeature.Failed: changeRoleFailed
    %% verify: 角色更新失敗時不得留下部分權限變更；導覽與路由權限需維持舊值

    AdminUserManagementFeature.Success --> AdminDashboardPage.Init: returnDashboard | navigate /admin/dashboard
    %% verify: 返回管理後台後可繼續檢視統計；若變更影響客服負載或可見使用者，畫面應以最新資料為準

    AdminUserManagementFeature.Failed --> AdminDashboardPage.Init: returnDashboard | navigate /admin/dashboard
    %% verify: 返回管理後台後可重新進入帳號管理；失敗不應破壞現有管理資料顯示
```