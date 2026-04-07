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

## ① Entry State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> Entry.Init : enterSite
    %% verify: 首次進站顯示公開入口流程，且不依賴既有 session 或 token 自動判定 User、Provider、Admin 身分。

    Entry.Init --> HomePage.Init : openHome | navigate /
    %% verify: 導向 `/` 並進入首頁初始化；Guest 導覽只允許公開入口，不顯示我的預約、Provider 控制台、Admin 後台或登出。

    Entry.Init --> ServicesListPage.Init : openServices | navigate /services
    %% verify: 導向 `/services` 並開始讀取公開服務清單；Guest 仍可讀取資料且不需要 JWT。

    Entry.Init --> LoginPage.Init : chooseLogin | navigate /login
    %% verify: 導向 `/login` 並顯示 Email、Password、忘記密碼入口；同頁不得重複出現第二個主要登入 CTA。

    Entry.Init --> RegisterPage.Init : chooseRegister | navigate /register
    %% verify: 導向 `/register` 並顯示註冊表單與 User 或 Provider 身分選擇；Admin 不得出現在註冊角色選項。

    Entry.Init --> MyBookingsPage.Init : openMyBookingsDirect | navigate /my-bookings
    %% verify: 導向 `/my-bookings` 後立即套用 User 專屬路由控管；未登入需導向登入流程並保留 returnTo，非 User 不得看到任何 booking 資料。

    Entry.Init --> ProviderDashboardPage.Init : openProviderDashboardDirect | navigate /provider/dashboard
    %% verify: 導向 `/provider/dashboard` 後立即套用 Provider 專屬路由控管；未登入需導向登入流程並保留 returnTo，非 Provider 不得看到管理資料。

    Entry.Init --> AdminPage.Init : openAdminDirect | navigate /admin
    %% verify: 導向 `/admin` 後立即套用 Admin 專屬路由控管；未登入需導向登入流程並保留 returnTo，非 Admin 不得看到全站管理資料。

    Entry.Init --> Entry.NotFound : openUnknownRoute | navigate /404
    %% verify: 未定義路由收斂到 not found 狀態；UI 需顯示路由不存在訊息並提供返回首頁或服務列表入口。

    Entry.NotFound --> HomePage.Init : goHome | navigate /
    %% verify: 從 not found 返回首頁時 URL 變回 `/` 且首頁可正常初始化。

    Entry.NotFound --> ServicesListPage.Init : goServices | navigate /services
    %% verify: 從 not found 返回服務列表時 URL 變為 `/services` 且公開服務清單重新載入。
```

## ② Page State Machine

### Home Page
Route: `/`
```mermaid
%% role: none
%% base: HomePage
stateDiagram-v2
    [*] --> HomePage.Init : enterPage
    %% verify: 進入 `/` 時進入首頁初始化流程，頁面內容區不應在 Header 已有登入入口時再重複放第二個主要登入 CTA。

    HomePage.Init --> HomePage.Ready : showHome
    %% verify: 首頁載入完成後顯示產品價值與前往服務列表主要 CTA；版面只保留一個主要服務瀏覽入口。

    HomePage.Ready --> ServicesListPage.Init : clickPrimaryServices | navigate /services
    %% verify: 點擊主要服務 CTA 導向 `/services`；服務列表頁開始載入並顯示一致的公開瀏覽導覽。

    HomePage.Ready --> LoginPage.Init : clickLogin | navigate /login
    %% verify: 點擊登入導向 `/login`；登入表單可用且首頁不殘留已登入專用導覽。

    HomePage.Ready --> RegisterPage.Init : clickRegister | navigate /register
    %% verify: 點擊註冊導向 `/register`；註冊頁提供 User 或 Provider 身分選擇且不提供 Admin 註冊。

    HomePage.Ready --> HomePage.Guest.Init : renderGuestView | navigate HomePage.Guest
    %% verify: Guest 視角 Header 只顯示服務列表、登入、註冊；不得顯示我的預約、Provider 控制台、Admin 後台或登出。

    HomePage.Ready --> HomePage.User.Init : renderUserView | navigate HomePage.User
    %% verify: User 視角 Header 顯示服務列表、我的預約、登出；不得顯示登入、註冊、Provider 控制台或 Admin 後台。

    HomePage.Ready --> HomePage.Provider.Init : renderProviderView | navigate HomePage.Provider
    %% verify: Provider 視角 Header 顯示服務列表、Provider 控制台、登出；不得顯示登入、註冊、我的預約或 Admin 後台。

    HomePage.Ready --> HomePage.Admin.Init : renderAdminView | navigate HomePage.Admin
    %% verify: Admin 視角 Header 顯示 Admin 後台、登出；不得顯示服務列表、我的預約、Provider 控制台、登入或註冊。
```

### Services List Page
Route: `/services`
```mermaid
%% role: none
%% base: ServicesListPage
stateDiagram-v2
    [*] --> ServicesListPage.Init : enterPage
    %% verify: 進入 `/services` 時開始讀取公開服務清單，Loading 呈現與其他頁一致且不需要登入。

    ServicesListPage.Init --> ServicesListPage.Ready : loadServices
    %% verify: 服務清單 API 回應成功且 UI 顯示名稱、時長、狀態摘要；只列出可公開瀏覽的服務資料。

    ServicesListPage.Init --> ServicesListPage.Empty : noServices
    %% verify: API 成功但無資料時顯示 Empty 狀態，不顯示錯誤訊息或殘留舊清單內容。

    ServicesListPage.Init --> ServicesListPage.Failed : loadFailed
    %% verify: 清單讀取失敗時收斂到 Failed 狀態並顯示一致的錯誤提示，不渲染不完整清單。

    ServicesListPage.Empty --> ServicesListPage.Init : retryLoad
    %% verify: Empty 狀態重試會重新請求服務清單 API 並回到初始化載入流程。

    ServicesListPage.Failed --> ServicesListPage.Init : retryLoad
    %% verify: Failed 狀態重試會重新請求服務清單 API，錯誤提示清空並重新載入。

    ServicesListPage.Ready --> HomePage.Init : goHome | navigate /
    %% verify: 從服務列表返回首頁時 URL 變為 `/` 且首頁內容正常呈現。

    ServicesListPage.Ready --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: 點擊服務卡片導向對應 `/services/:id`，詳情頁載入該服務與其時段資料，不串錯其他 service id。

    ServicesListPage.Ready --> ServicesListPage.Guest.Init : renderGuestView | navigate ServicesListPage.Guest
    %% verify: Guest 視角只保留公開導覽，不出現我的預約、Provider 控制台、Admin 後台或登出。

    ServicesListPage.Ready --> ServicesListPage.User.Init : renderUserView | navigate ServicesListPage.User
    %% verify: User 視角顯示我的預約與登出，且不顯示登入、註冊、Provider 控制台或 Admin 後台。

    ServicesListPage.Ready --> ServicesListPage.Provider.Init : renderProviderView | navigate ServicesListPage.Provider
    %% verify: Provider 視角顯示 Provider 控制台與登出，且不顯示登入、註冊、我的預約或 Admin 後台。

    ServicesListPage.Ready --> ServicesListPage.Admin.Init : renderAdminView | navigate ServicesListPage.Admin
    %% verify: Admin 視角顯示 Admin 後台與登出，且不顯示服務列表以外的不屬於 Admin 的導航入口。
```

### Service Detail Page
Route: `/services/:id`
```mermaid
%% role: none
%% base: ServiceDetailPage
stateDiagram-v2
    [*] --> ServiceDetailPage.Init : enterPage
    %% verify: 進入 `/services/:id` 時開始讀取服務詳情與時段；頁面不預先顯示預約 CTA，直到角色與資料完成判定。

    ServiceDetailPage.Init --> ServiceDetailPage.Ready : loadServiceDetail
    %% verify: API 回應成功時顯示服務名稱、描述、時長、時段、剩餘名額 `capacity - booked_count` 與 `cancel_deadline_at`。

    ServiceDetailPage.Init --> ServiceDetailPage.Empty : noOpenTimeSlots
    %% verify: 服務存在但無可預約時段時顯示 Empty 狀態，且不顯示立即預約 CTA。

    ServiceDetailPage.Init --> ServiceDetailPage.NotFound : serviceMissing
    %% verify: 服務不存在時顯示 not found 訊息，且不呈現任何服務資料或預約操作。

    ServiceDetailPage.Init --> ServiceDetailPage.Failed : loadFailed
    %% verify: 詳情讀取失敗時收斂到 Failed 狀態，UI 顯示一致錯誤提示並避免顯示不完整資料。

    ServiceDetailPage.Empty --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: 從 Empty 返回服務列表時 URL 變為 `/services` 且列表重新可瀏覽。

    ServiceDetailPage.NotFound --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: 從 not found 返回服務列表時不保留無效 `:id`，且清單可正常載入。

    ServiceDetailPage.Failed --> ServiceDetailPage.Init : retryLoad
    %% verify: 失敗重試會重新載入同一個 service id，不改變目前查詢目標。

    ServiceDetailPage.Ready --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: 從詳情返回列表時 URL 與頁面內容回到 `/services`，不殘留詳情頁資料。

    ServiceDetailPage.Ready --> HomePage.Init : goHome | navigate /
    %% verify: 從詳情返回首頁時 URL 變為 `/` 且首頁依目前身分呈現正確導覽。

    ServiceDetailPage.Ready --> ServiceDetailPage.Guest.Init : renderGuestView | navigate ServiceDetailPage.Guest
    %% verify: Guest 視角不得顯示立即預約 CTA，只能顯示登入或註冊引導。

    ServiceDetailPage.Ready --> ServiceDetailPage.User.Init : renderUserView | navigate ServiceDetailPage.User
    %% verify: User 視角顯示單一主要立即預約 CTA，不得在同頁重複出現等價預約入口。

    ServiceDetailPage.Ready --> ServiceDetailPage.Provider.Init : renderProviderView | navigate ServiceDetailPage.Provider
    %% verify: Provider 視角只讀瀏覽服務與時段資料，不顯示立即預約 CTA。

    ServiceDetailPage.Ready --> ServiceDetailPage.Admin.Init : renderAdminView | navigate ServiceDetailPage.Admin
    %% verify: Admin 視角只讀瀏覽服務與時段資料，不顯示立即預約 CTA。
```

### Login Page
Route: `/login`
```mermaid
%% role: none
stateDiagram-v2
    [*] --> LoginPage.Init : enterPage
    %% verify: 進入 `/login` 時進入登入頁初始化；頁面只有一組主要登入表單與忘記密碼入口。

    LoginPage.Init --> LoginPage.Ready : showLoginForm
    %% verify: 登入頁顯示 Email、Password 欄位、登入按鈕與忘記密碼入口；Guest 導覽不得出現受保護頁入口。

    LoginPage.Init --> HomePage.Init : redirectSignedInUser | navigate /
    %% verify: 已登入 User 再進入 `/login` 會被導回 `/`，避免重複顯示登入表單。

    LoginPage.Init --> ProviderDashboardPage.Init : redirectSignedInProvider | navigate /provider/dashboard
    %% verify: 已登入 Provider 再進入 `/login` 會被導向 `/provider/dashboard`，不得停留在登入頁。

    LoginPage.Init --> AdminPage.Init : redirectSignedInAdmin | navigate /admin
    %% verify: 已登入 Admin 再進入 `/login` 會被導向 `/admin`，不得停留在登入頁。

    LoginPage.Init --> ResetPasswordFeature.Init : enterResetModeWithToken | navigate ResetPasswordFeature
    %% verify: 帶有效 reset token 進入 `/login` 時切到重設密碼模式，表單改為新密碼設定而非一般登入。

    LoginPage.Ready --> AuthLoginFeature.Init : submitLogin | navigate AuthLoginFeature
    %% verify: 提交登入時送出 Email 與 Password 驗證，並進入登入功能流程；重複送出需被前端禁用或收斂。

    LoginPage.Ready --> RegisterPage.Init : goRegister | navigate /register
    %% verify: 從登入頁可導向註冊頁，且不丟失 Guest 導覽規則。

    LoginPage.Ready --> ForgotPasswordFeature.Init : openForgotPassword | navigate ForgotPasswordFeature
    %% verify: 點擊忘記密碼會進入忘記密碼功能流程，不需要先完成登入。

    LoginPage.Ready --> HomePage.Init : browseAsGuest | navigate /
    %% verify: 從登入頁返回首頁時仍維持 Guest 身分，不產生 JWT 或已登入 UI。
```

### Register Page
Route: `/register`
```mermaid
%% role: none
stateDiagram-v2
    [*] --> RegisterPage.Init : enterPage
    %% verify: 進入 `/register` 時初始化註冊頁，表單應提供 Email、Password 與角色選擇。

    RegisterPage.Init --> RegisterPage.Ready : showRegisterForm
    %% verify: 註冊頁顯示 User 或 Provider 身分選擇，email 必須唯一且不提供 Admin 註冊選項。

    RegisterPage.Init --> HomePage.Init : redirectSignedInUser | navigate /
    %% verify: 已登入 User 進入 `/register` 時導回 `/`，避免重複註冊流程。

    RegisterPage.Init --> ProviderDashboardPage.Init : redirectSignedInProvider | navigate /provider/dashboard
    %% verify: 已登入 Provider 進入 `/register` 時導回 `/provider/dashboard`。

    RegisterPage.Init --> AdminPage.Init : redirectSignedInAdmin | navigate /admin
    %% verify: 已登入 Admin 進入 `/register` 時導回 `/admin`。

    RegisterPage.Ready --> RegisterAccountFeature.Init : submitRegister | navigate RegisterAccountFeature
    %% verify: 提交註冊時送出 Email、Password 與角色；只允許 User 或 Provider，並進入註冊功能流程。

    RegisterPage.Ready --> LoginPage.Init : goLogin | navigate /login
    %% verify: 從註冊頁切換到登入頁時 URL 變為 `/login` 且登入表單可用。

    RegisterPage.Ready --> HomePage.Init : browseAsGuest | navigate /
    %% verify: 從註冊頁返回首頁時仍為 Guest，不出現已登入導覽。
```

### My Bookings Page
Route: `/my-bookings`
```mermaid
%% role: User
stateDiagram-v2
    [*] --> MyBookingsPage.Init : enterPage
    %% verify: 進入 `/my-bookings` 時先執行 User 路由控管，未通過前不得顯示任何 booking 清單。

    MyBookingsPage.Init --> LoginPage.Init : authRequired | navigate /login
    %% verify: 未登入存取 `/my-bookings` 時導向 `/login` 並保留 returnTo；不回傳任何 booking 資料。

    MyBookingsPage.Init --> MyBookingsPage.Forbidden : roleRejected
    %% verify: 已登入但角色非 User 時收斂到 Forbidden 狀態；UI 顯示權限不足且不顯示他人 booking。

    MyBookingsPage.Init --> MyBookingsPage.Ready : loadMyBookings
    %% verify: API 成功回傳 `user_id = 自己` 的 booking 清單，依 PENDING、CONFIRMED、CANCELLED、COMPLETED 呈現。

    MyBookingsPage.Init --> MyBookingsPage.Empty : noBookings
    %% verify: API 成功但無預約資料時顯示 Empty 狀態，且不顯示取消 CTA。

    MyBookingsPage.Init --> MyBookingsPage.Failed : loadFailed
    %% verify: 讀取失敗時顯示一致的錯誤狀態；401 或 403 情境不得顯示 booking 資料。

    MyBookingsPage.Forbidden --> HomePage.Init : goHome | navigate /
    %% verify: 權限不足返回首頁時導覽改為目前可用角色的首頁導覽，不保留 my-bookings 內容。

    MyBookingsPage.Empty --> ServicesListPage.Init : browseServices | navigate /services
    %% verify: 從 Empty 狀態前往服務列表時可繼續瀏覽服務並準備建立新預約。

    MyBookingsPage.Failed --> MyBookingsPage.Init : retryLoad
    %% verify: Failed 重試會重新拉取自己的 booking 清單，避免重複混入他人資料。

    MyBookingsPage.Ready --> BookingCancelFeature.Init : clickCancelBooking | navigate BookingCancelFeature
    %% verify: 只有 PENDING 或 CONFIRMED 且未超過 `cancel_deadline_at` 的預約可進入取消功能流程。

    MyBookingsPage.Ready --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: 從我的預約開啟服務詳情時導向對應服務頁，不暴露其他使用者 booking id。

    MyBookingsPage.Ready --> ServicesListPage.Init : browseServices | navigate /services
    %% verify: 從我的預約前往服務列表時維持 User 導覽，方便繼續瀏覽與預約。

    MyBookingsPage.Ready --> HomePage.Init : goHome | navigate /
    %% verify: 從我的預約返回首頁時仍維持 User 已登入狀態與正確 Header。
```

### Provider Dashboard Page
Route: `/provider/dashboard`
```mermaid
%% role: Provider
stateDiagram-v2
    [*] --> ProviderDashboardPage.Init : enterPage
    %% verify: 進入 `/provider/dashboard` 時先執行 Provider 路由控管，未通過前不得顯示服務、時段或預約名單。

    ProviderDashboardPage.Init --> LoginPage.Init : authRequired | navigate /login
    %% verify: 未登入存取 Provider 控制台時導向 `/login` 並保留 returnTo；不載入管理 API。

    ProviderDashboardPage.Init --> ProviderDashboardPage.Forbidden : roleRejected
    %% verify: 已登入但角色非 Provider 時收斂到 Forbidden 狀態；UI 不顯示任何管理資料。

    ProviderDashboardPage.Init --> ProviderDashboardPage.Ready : loadDashboard
    %% verify: API 成功回傳 provider_id 等於自己的服務、時段與預約摘要，不包含其他 Provider 資料。

    ProviderDashboardPage.Init --> ProviderDashboardPage.Empty : noServicesYet
    %% verify: 尚未建立任何服務時顯示 Empty 狀態並提供建立第一個服務入口。

    ProviderDashboardPage.Init --> ProviderDashboardPage.Failed : loadFailed
    %% verify: Dashboard 載入失敗時收斂到 Failed 狀態，不呈現不完整管理資料。

    ProviderDashboardPage.Forbidden --> HomePage.Init : goHome | navigate /
    %% verify: 權限不足返回首頁時不保留 Provider 管理資料或操作入口。

    ProviderDashboardPage.Empty --> ProviderServiceManageFeature.Init : createFirstService | navigate ProviderServiceManageFeature
    %% verify: 從 Empty 狀態進入服務管理功能時可建立第一個服務，且來源仍限定目前 Provider。

    ProviderDashboardPage.Empty --> ServicesListPage.Init : browseServices | navigate /services
    %% verify: Empty 狀態仍可返回公開服務列表瀏覽，不暴露管理操作給其他角色。

    ProviderDashboardPage.Failed --> ProviderDashboardPage.Init : retryLoad
    %% verify: Failed 重試會重新拉取目前 Provider 的管理資料，不重複送出先前修改。

    ProviderDashboardPage.Ready --> ProviderServiceManageFeature.Init : manageService | navigate ProviderServiceManageFeature
    %% verify: 進入服務管理功能時只允許操作 `provider_id = 自己` 的 Service。

    ProviderDashboardPage.Ready --> ProviderTimeSlotManageFeature.Init : manageTimeSlot | navigate ProviderTimeSlotManageFeature
    %% verify: 進入時段管理功能時只允許操作自己服務下的 TimeSlot，`booked_count` 仍由系統維護不可手動輸入。

    ProviderDashboardPage.Ready --> ProviderBookingStatusUpdateFeature.Init : updateBookingStatus | navigate ProviderBookingStatusUpdateFeature
    %% verify: 進入預約狀態更新功能時只可處理自己服務的 Booking，且後續轉移必須符合合法狀態機。

    ProviderDashboardPage.Ready --> ServicesListPage.Init : browseServices | navigate /services
    %% verify: Provider 可從控制台切回公開服務列表，但不應在列表頁看到 User 或 Admin 專屬導覽。

    ProviderDashboardPage.Ready --> HomePage.Guest.Init : logout | navigate /
    %% verify: 登出後 JWT 與前端登入狀態清除，回到首頁 Guest 視角且不再顯示 Provider 控制台或登出。
```

### Admin Page
Route: `/admin`
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminPage.Init : enterPage
    %% verify: 進入 `/admin` 時先執行 Admin 路由控管，未通過前不得顯示帳號、服務或報表資料。

    AdminPage.Init --> LoginPage.Init : authRequired | navigate /login
    %% verify: 未登入存取 Admin 後台時導向 `/login` 並保留 returnTo；不應請求後台資料。

    AdminPage.Init --> AdminPage.Forbidden : roleRejected
    %% verify: 已登入但角色非 Admin 時收斂到 Forbidden 狀態；UI 不顯示任何全站管理資料。

    AdminPage.Init --> AdminPage.Ready : loadAdmin
    %% verify: API 成功回傳帳號清單、服務清單與報表摘要，且只有 Admin 可取得這些資料。

    AdminPage.Init --> AdminPage.Empty : noAdminData
    %% verify: 對應資料為空時顯示 Empty 狀態，而不是顯示錯誤或殘留舊資料。

    AdminPage.Init --> AdminPage.Failed : loadFailed
    %% verify: 後台資料讀取失敗時收斂到 Failed 狀態，避免顯示不完整管理資訊。

    AdminPage.Forbidden --> HomePage.Init : goHome | navigate /
    %% verify: 權限不足返回首頁後，Header 不再顯示 Admin 後台或其他管理入口。

    AdminPage.Empty --> AdminReportViewFeature.Init : openReports | navigate AdminReportViewFeature
    %% verify: 即使目前無帳號或服務資料，仍可進入報表檢視流程並顯示空資料結果。

    AdminPage.Failed --> AdminPage.Init : retryLoad
    %% verify: Failed 重試會重新載入帳號、服務與報表摘要，不混入過期結果。

    AdminPage.Ready --> AdminUserStatusManageFeature.Init : manageUsers | navigate AdminUserStatusManageFeature
    %% verify: 進入帳號狀態管理功能時只允許 Admin 變更 ACTIVE 或 SUSPENDED，並需寫入 AuditLog。

    AdminPage.Ready --> AdminServiceStatusManageFeature.Init : manageServices | navigate AdminServiceStatusManageFeature
    %% verify: 進入服務狀態管理功能時只允許 Admin 調整 ACTIVE 或 INACTIVE，並需寫入 AuditLog。

    AdminPage.Ready --> AdminReportViewFeature.Init : viewReports | navigate AdminReportViewFeature
    %% verify: 進入報表檢視功能時可查看預約量、取消率、服務活躍度摘要，且只有 Admin 可見。

    AdminPage.Ready --> HomePage.Guest.Init : logout | navigate /
    %% verify: 登出後清除 JWT 與前端登入狀態，回到首頁 Guest 視角且不再顯示 Admin 後台或登出。
```

## ③ Role-specific Page State

### Home Page Delta: Guest
```mermaid
%% role: Guest
%% extends: HomePage
stateDiagram-v2
    [*] --> HomePage.Guest.Init : enterRoleState
    %% verify: Guest 角色進入首頁差異狀態時，Header 只顯示服務列表、登入、註冊。

    HomePage.Guest.Init --> ServicesListPage.Init : clickServices | navigate /services
    %% verify: Guest 可從首頁前往公開服務列表，不需要 JWT。

    HomePage.Guest.Init --> LoginPage.Init : clickLogin | navigate /login
    %% verify: Guest 點擊登入導向 `/login`，首頁不保留已登入導覽項。

    HomePage.Guest.Init --> RegisterPage.Init : clickRegister | navigate /register
    %% verify: Guest 點擊註冊導向 `/register`，且仍只可選擇 User 或 Provider 身分。
```

### Home Page Delta: User
```mermaid
%% role: User
%% extends: HomePage
stateDiagram-v2
    [*] --> HomePage.User.Init : enterRoleState
    %% verify: User 角色進入首頁差異狀態時，Header 顯示服務列表、我的預約、登出，且不顯示登入或註冊。

    HomePage.User.Init --> ServicesListPage.Init : clickServices | navigate /services
    %% verify: User 可從首頁前往服務列表並保留已登入狀態。

    HomePage.User.Init --> MyBookingsPage.Init : openMyBookings | navigate /my-bookings
    %% verify: User 點擊我的預約導向 `/my-bookings`，且只會載入自己的 booking。

    HomePage.User.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: User 登出後清除 JWT 並切回 Guest 首頁視角，不再顯示我的預約或登出。
```

### Home Page Delta: Provider
```mermaid
%% role: Provider
%% extends: HomePage
stateDiagram-v2
    [*] --> HomePage.Provider.Init : enterRoleState
    %% verify: Provider 角色進入首頁差異狀態時，Header 顯示服務列表、Provider 控制台、登出。

    HomePage.Provider.Init --> ServicesListPage.Init : clickServices | navigate /services
    %% verify: Provider 仍可瀏覽公開服務列表，且不顯示 User 專屬我的預約入口。

    HomePage.Provider.Init --> ProviderDashboardPage.Init : openProviderDashboard | navigate /provider/dashboard
    %% verify: Provider 可從首頁前往自己的控制台，後台資料僅限 provider_id 為自己。

    HomePage.Provider.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: Provider 登出後回到 Guest 首頁，不再顯示 Provider 控制台或登出。
```

### Home Page Delta: Admin
```mermaid
%% role: Admin
%% extends: HomePage
stateDiagram-v2
    [*] --> HomePage.Admin.Init : enterRoleState
    %% verify: Admin 角色進入首頁差異狀態時，Header 只顯示 Admin 後台與登出。

    HomePage.Admin.Init --> AdminPage.Init : openAdmin | navigate /admin
    %% verify: Admin 可從首頁直接前往後台，且後台資料只對 Admin 可見。

    HomePage.Admin.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: Admin 登出後回到 Guest 首頁，不再顯示任何管理導覽。
```

### Services List Page Delta: Guest
```mermaid
%% role: Guest
%% extends: ServicesListPage
stateDiagram-v2
    [*] --> ServicesListPage.Guest.Init : enterRoleState
    %% verify: Guest 角色下的服務列表只顯示公開導覽，不顯示我的預約、Provider 控制台、Admin 後台或登出。

    ServicesListPage.Guest.Init --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: Guest 可從列表前往服務詳情，但詳情頁只會顯示登入或註冊引導，不顯示立即預約 CTA。

    ServicesListPage.Guest.Init --> LoginPage.Init : clickLogin | navigate /login
    %% verify: Guest 可從列表直接前往登入頁，且列表頁不保留受保護頁入口。

    ServicesListPage.Guest.Init --> RegisterPage.Init : clickRegister | navigate /register
    %% verify: Guest 可從列表直接前往註冊頁，註冊流程仍只提供 User 或 Provider。
```

### Services List Page Delta: User
```mermaid
%% role: User
%% extends: ServicesListPage
stateDiagram-v2
    [*] --> ServicesListPage.User.Init : enterRoleState
    %% verify: User 角色下的服務列表顯示我的預約與登出，不顯示登入、註冊、Provider 控制台或 Admin 後台。

    ServicesListPage.User.Init --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: User 從列表進入詳情後可看到單一主要立即預約 CTA 與時段資訊。

    ServicesListPage.User.Init --> MyBookingsPage.Init : openMyBookings | navigate /my-bookings
    %% verify: User 可從列表前往我的預約，且只載入自己的 booking 清單。

    ServicesListPage.User.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: User 從列表登出後回到 Guest 首頁，不再顯示我的預約或登出。
```

### Services List Page Delta: Provider
```mermaid
%% role: Provider
%% extends: ServicesListPage
stateDiagram-v2
    [*] --> ServicesListPage.Provider.Init : enterRoleState
    %% verify: Provider 角色下的服務列表顯示 Provider 控制台與登出，不顯示我的預約、登入、註冊或 Admin 後台。

    ServicesListPage.Provider.Init --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: Provider 可從列表前往詳情頁，但詳情頁僅為只讀模式，不顯示立即預約 CTA。

    ServicesListPage.Provider.Init --> ProviderDashboardPage.Init : openProviderDashboard | navigate /provider/dashboard
    %% verify: Provider 可從列表前往自己的控制台，資料不得包含其他 Provider 的服務。

    ServicesListPage.Provider.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: Provider 從列表登出後回到 Guest 首頁，不再顯示 Provider 控制台或登出。
```

### Services List Page Delta: Admin
```mermaid
%% role: Admin
%% extends: ServicesListPage
stateDiagram-v2
    [*] --> ServicesListPage.Admin.Init : enterRoleState
    %% verify: Admin 角色下的服務列表顯示 Admin 後台與登出，不顯示登入、註冊、我的預約或 Provider 控制台。

    ServicesListPage.Admin.Init --> ServiceDetailPage.Init : openServiceDetail | navigate /services/:id
    %% verify: Admin 可從列表前往詳情頁，以只讀方式檢視服務與時段資料。

    ServicesListPage.Admin.Init --> AdminPage.Init : openAdmin | navigate /admin
    %% verify: Admin 可從列表直接返回後台，且資料維持 Admin 專屬可見性。

    ServicesListPage.Admin.Init --> HomePage.Guest.Init : logout | navigate /
    %% verify: Admin 從列表登出後回到 Guest 首頁，不再顯示任何管理導覽。
```

### Service Detail Page Delta: Guest
```mermaid
%% role: Guest
%% extends: ServiceDetailPage
stateDiagram-v2
    [*] --> ServiceDetailPage.Guest.Init : enterRoleState
    %% verify: Guest 角色下的服務詳情只顯示登入或註冊引導，不得顯示立即預約 CTA。

    ServiceDetailPage.Guest.Init --> LoginPage.Init : clickLoginToBook | navigate /login
    %% verify: Guest 從服務詳情點擊登入導向 `/login`，後續登入成功才可回到受保護流程。

    ServiceDetailPage.Guest.Init --> RegisterPage.Init : clickRegisterToBook | navigate /register
    %% verify: Guest 從服務詳情點擊註冊導向 `/register`，註冊後仍需走登入或既定回流流程。

    ServiceDetailPage.Guest.Init --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: Guest 可從詳情返回服務列表，不產生任何 booking 資料。
```

### Service Detail Page Delta: User
```mermaid
%% role: User
%% extends: ServiceDetailPage
stateDiagram-v2
    [*] --> ServiceDetailPage.User.Init : enterRoleState
    %% verify: User 角色下的服務詳情顯示單一主要立即預約 CTA、剩餘名額與取消截止時間。

    ServiceDetailPage.User.Init --> UserBookingCreateFeature.Init : clickBook | navigate UserBookingCreateFeature
    %% verify: User 點擊立即預約會進入建立預約流程，後續需檢查 JWT、時段狀態、名額、重複預約與邊界規則。

    ServiceDetailPage.User.Init --> MyBookingsPage.Init : openMyBookings | navigate /my-bookings
    %% verify: User 可從詳情前往我的預約，且不暴露其他使用者 booking。

    ServiceDetailPage.User.Init --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: User 可從詳情返回服務列表，已登入狀態與導覽保持正確。
```

### Service Detail Page Delta: Provider
```mermaid
%% role: Provider
%% extends: ServiceDetailPage
stateDiagram-v2
    [*] --> ServiceDetailPage.Provider.Init : enterRoleState
    %% verify: Provider 角色下的服務詳情為只讀視角，不顯示立即預約 CTA。

    ServiceDetailPage.Provider.Init --> ProviderDashboardPage.Init : openProviderDashboard | navigate /provider/dashboard
    %% verify: Provider 可從詳情返回自己的控制台，不應顯示或操作其他 Provider 的後台資料。

    ServiceDetailPage.Provider.Init --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: Provider 可從詳情返回服務列表並維持 Provider 導覽。
```

### Service Detail Page Delta: Admin
```mermaid
%% role: Admin
%% extends: ServiceDetailPage
stateDiagram-v2
    [*] --> ServiceDetailPage.Admin.Init : enterRoleState
    %% verify: Admin 角色下的服務詳情為只讀視角，不顯示立即預約 CTA。

    ServiceDetailPage.Admin.Init --> AdminPage.Init : openAdmin | navigate /admin
    %% verify: Admin 可從詳情返回後台，且後台資料仍維持 Admin 專屬權限。

    ServiceDetailPage.Admin.Init --> ServicesListPage.Init : backToServices | navigate /services
    %% verify: Admin 可從詳情返回服務列表並維持 Admin 導覽。
```

## ④ Feature / Function State Machine

### Auth Login Feature
Source Pages: LoginPage, MyBookingsPage, ProviderDashboardPage, AdminPage, ServiceDetailPage
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthLoginFeature.Init : enterFeature
    %% verify: 進入登入功能流程時承接來源頁與可選的 returnTo，不直接假設任何角色已登入。

    AuthLoginFeature.Init --> AuthLoginFeature.Submitting : submitCredentials
    %% verify: 送出登入資料時觸發認證 API，前端應防止重複提交並等待 JWT 驗證結果。

    AuthLoginFeature.Submitting --> AuthLoginFeature.UserDone : authenticatedAsUser
    %% verify: API 回應成功且角色為 USER，建立有效 JWT/session，帳號狀態必須是 ACTIVE，SUSPENDED 不得走此路徑。

    AuthLoginFeature.Submitting --> AuthLoginFeature.ProviderDone : authenticatedAsProvider
    %% verify: API 回應成功且角色為 PROVIDER，建立有效 JWT/session，帳號狀態必須是 ACTIVE。

    AuthLoginFeature.Submitting --> AuthLoginFeature.AdminDone : authenticatedAsAdmin
    %% verify: API 回應成功且角色為 ADMIN，建立有效 JWT/session，只有 Admin 可進入後台流程。

    AuthLoginFeature.Submitting --> AuthLoginFeature.Failed : credentialsRejected
    %% verify: API 回應登入失敗、token 驗簽失敗或帳號為 SUSPENDED 時收斂到 Failed，UI 顯示明確錯誤且不建立登入狀態。

    AuthLoginFeature.UserDone --> HomePage.Init : loginDoneHome | navigate /
    %% verify: 一般 User 登入成功後導向 `/`，首頁後續應切換為 User 導覽並顯示我的預約與登出。

    AuthLoginFeature.UserDone --> MyBookingsPage.Init : loginDoneReturnMyBookings | navigate /my-bookings
    %% verify: 若 returnTo 是 `/my-bookings`，登入成功後回到該頁並只載入自己的 booking 清單。

    AuthLoginFeature.ProviderDone --> ProviderDashboardPage.Init : loginDoneDashboard | navigate /provider/dashboard
    %% verify: Provider 登入成功後導向自己的控制台，管理資料僅限 provider_id 為自己。

    AuthLoginFeature.AdminDone --> AdminPage.Init : loginDoneAdmin | navigate /admin
    %% verify: Admin 登入成功後導向 `/admin`，僅此角色可看到全站帳號、服務與報表資料。

    AuthLoginFeature.Failed --> LoginPage.Init : backToLogin | navigate /login
    %% verify: 登入失敗返回登入頁時保留錯誤訊息並維持未登入狀態，不顯示受保護頁導覽。
```

### Register Account Feature
Source Pages: RegisterPage
```mermaid
%% role: none
stateDiagram-v2
    [*] --> RegisterAccountFeature.Init : enterFeature
    %% verify: 進入註冊功能流程時承接註冊頁輸入資料，只允許建立 User 或 Provider 帳號。

    RegisterAccountFeature.Init --> RegisterAccountFeature.Submitting : submitRegistration
    %% verify: 送出註冊資料時檢查 email 唯一性、密碼有效性與角色選擇，前端應避免重複送出。

    RegisterAccountFeature.Submitting --> RegisterAccountFeature.UserCreated : registerUserDone
    %% verify: 建立 User 成功時資料庫新增 `role = USER`、`status = ACTIVE` 的帳號並只儲存 `password_hash`。

    RegisterAccountFeature.Submitting --> RegisterAccountFeature.ProviderCreated : registerProviderDone
    %% verify: 建立 Provider 成功時資料庫新增 `role = PROVIDER`、`status = ACTIVE` 的帳號並只儲存 `password_hash`。

    RegisterAccountFeature.Submitting --> RegisterAccountFeature.Failed : registerRejected
    %% verify: email 重複或資料驗證失敗時收斂到 Failed，UI 顯示欄位錯誤且不建立帳號。

    RegisterAccountFeature.UserCreated --> LoginPage.Init : proceedToLogin | navigate /login
    %% verify: User 註冊成功後導回登入頁，提示可使用新帳號登入，但不自動授予 Admin 或 Provider 權限。

    RegisterAccountFeature.ProviderCreated --> LoginPage.Init : proceedToLogin | navigate /login
    %% verify: Provider 註冊成功後導回登入頁，後續登入後才可進入 Provider 控制台。

    RegisterAccountFeature.Failed --> RegisterPage.Init : backToRegister | navigate /register
    %% verify: 註冊失敗返回註冊頁時保留使用者輸入與錯誤提示，不切換成已登入狀態。
```

### Forgot Password Feature
Source Pages: LoginPage
```mermaid
%% role: none
stateDiagram-v2
    [*] --> ForgotPasswordFeature.Init : enterFeature
    %% verify: 進入忘記密碼流程時不要求使用者先登入，來源為登入頁。

    ForgotPasswordFeature.Init --> ForgotPasswordFeature.Submitting : submitResetEmail
    %% verify: 送出 Email 後建立一次性 PasswordResetToken，token 需有 `token_hash`、`expires_at` 與未使用狀態。

    ForgotPasswordFeature.Submitting --> ForgotPasswordFeature.Done : resetLinkIssued
    %% verify: 成功時系統寄送重設連結並維持 token 可用一次，UI 顯示已送出提示但不暴露 token 原文。

    ForgotPasswordFeature.Submitting --> ForgotPasswordFeature.Failed : resetLinkRejected
    %% verify: 輸入無效或寄送失敗時收斂到 Failed，UI 顯示可理解錯誤且不建立可用 token。

    ForgotPasswordFeature.Done --> LoginPage.Init : backToLogin | navigate /login
    %% verify: 完成後返回登入頁一般模式，使用者可等待信件再用連結進入重設模式。

    ForgotPasswordFeature.Failed --> LoginPage.Init : backToLogin | navigate /login
    %% verify: 失敗返回登入頁時保留未登入狀態與必要錯誤提示。
```

### Reset Password Feature
Source Pages: LoginPage
```mermaid
%% role: none
stateDiagram-v2
    [*] --> ResetPasswordFeature.Init : enterFeature
    %% verify: 進入重設密碼流程時必須帶有效且未使用的 reset token，並切換 `/login` 的重設密碼模式。

    ResetPasswordFeature.Init --> ResetPasswordFeature.Submitting : submitNewPassword
    %% verify: 送出新密碼時驗證 token 未過期、未使用，並準備更新 `password_hash`。

    ResetPasswordFeature.Submitting --> ResetPasswordFeature.Done : passwordResetDone
    %% verify: 成功時更新使用者 `password_hash` 並將 PasswordResetToken 標記 `used_at`，同一 token 不可再次使用。

    ResetPasswordFeature.Submitting --> ResetPasswordFeature.Failed : passwordResetRejected
    %% verify: token 過期、已使用或新密碼驗證失敗時收斂到 Failed，密碼不得被更新。

    ResetPasswordFeature.Done --> LoginPage.Init : backToLogin | navigate /login
    %% verify: 重設成功後返回登入頁一般模式，使用者需以新密碼重新登入。

    ResetPasswordFeature.Failed --> LoginPage.Init : backToLogin | navigate /login
    %% verify: 重設失敗返回登入頁時不建立登入狀態，並提示 token 或密碼問題。
```

### User Booking Create Feature
Source Pages: ServiceDetailPage
```mermaid
%% role: User
stateDiagram-v2
    [*] --> UserBookingCreateFeature.Init : enterFeature
    %% verify: 進入建立預約流程時來源必須是 User 視角的服務詳情頁，Guest、Provider、Admin 不得進入。

    UserBookingCreateFeature.Init --> UserBookingCreateFeature.Submitting : submitBooking
    %% verify: 送出預約時檢查 JWT、`timeslot_id`、Service 狀態、TimeSlot 狀態、預約邊界與重複預約條件。

    UserBookingCreateFeature.Submitting --> UserBookingCreateFeature.Done : bookingCreated
    %% verify: 建立成功時交易內同時新增 Booking、更新 `booked_count + 1`，且 `booked_count` 不得超過 `capacity`，狀態為合法初始值 `PENDING` 或商業規則允許的 `CONFIRMED`。

    UserBookingCreateFeature.Submitting --> UserBookingCreateFeature.Rejected : bookingRejected
    %% verify: TimeSlot 為 CLOSED、Service 為 INACTIVE、名額已滿、已超過可預約邊界、JWT 無效或同一 user 對同一 timeslot 已有有效 Booking 時必須拒絕且不得變動 `booked_count`。

    UserBookingCreateFeature.Done --> MyBookingsPage.Init : openMyBookings | navigate /my-bookings
    %% verify: 預約成功後前往我的預約可立即看到新 booking，狀態、建立時間與關聯 timeslot 正確。

    UserBookingCreateFeature.Done --> ServiceDetailPage.Init : backToServiceDetail | navigate /services/:id
    %% verify: 預約成功後返回詳情時剩餘名額同步更新為 `capacity - booked_count`，且不出現重複 booking 入口。

    UserBookingCreateFeature.Rejected --> ServiceDetailPage.Init : backToServiceDetail | navigate /services/:id
    %% verify: 預約失敗返回詳情時顯示明確原因，原本服務與時段資料仍一致，`booked_count` 未被錯誤增加。
```

### Booking Cancel Feature
Source Pages: MyBookingsPage
```mermaid
%% role: User
stateDiagram-v2
    [*] --> BookingCancelFeature.Init : enterFeature
    %% verify: 進入取消預約流程時來源必須是自己的 booking，其他使用者不得取消該筆資料。

    BookingCancelFeature.Init --> BookingCancelFeature.Submitting : submitCancel
    %% verify: 送出取消時檢查 JWT、booking 所屬 user、目前狀態與 `cancel_deadline_at`，前端避免重複提交。

    BookingCancelFeature.Submitting --> BookingCancelFeature.Done : cancelAccepted
    %% verify: 取消成功時交易內同時把 Booking 狀態更新為 `CANCELLED`、寫入 `cancelled_at`，並將對應 TimeSlot `booked_count - 1`。

    BookingCancelFeature.Submitting --> BookingCancelFeature.Rejected : cancelRejected
    %% verify: 已超過 `cancel_deadline_at`、Booking 已是 `CANCELLED` 或 `COMPLETED`、JWT 無效或非本人操作時必須拒絕，且 `booked_count` 不得扣減。

    BookingCancelFeature.Done --> MyBookingsPage.Init : returnMyBookings | navigate /my-bookings
    %% verify: 取消成功返回我的預約時該筆 Booking 顯示 `CANCELLED`，列表與剩餘可取消入口同步更新。

    BookingCancelFeature.Rejected --> MyBookingsPage.Init : returnMyBookings | navigate /my-bookings
    %% verify: 取消失敗返回我的預約時保留原狀態與錯誤訊息，不改變 booking 與名額資料。
```

### Provider Service Manage Feature
Source Pages: ProviderDashboardPage
```mermaid
%% role: Provider
stateDiagram-v2
    [*] --> ProviderServiceManageFeature.Init : enterFeature
    %% verify: 進入服務管理流程時來源必須是 Provider 控制台，且只處理目前 Provider 的服務資料。

    ProviderServiceManageFeature.Init --> ProviderServiceManageFeature.Submitting : submitServiceChange
    %% verify: 送出服務新增、編輯或停用時檢查 JWT 與 `provider_id = 自己`，提交欄位只包含 `name`、`description`、`duration_minutes`、`status` 等定義欄位。

    ProviderServiceManageFeature.Submitting --> ProviderServiceManageFeature.Done : serviceChangeSaved
    %% verify: 成功時建立或更新 Service，停用語意為 `ACTIVE -> INACTIVE` 而非硬刪除，並寫入 AuditLog 的 actor、target、before_data、after_data。

    ProviderServiceManageFeature.Submitting --> ProviderServiceManageFeature.Rejected : serviceChangeRejected
    %% verify: 越權操作他人 Service、資料驗證失敗或未授權時必須拒絕，且不得改動既有 Service 資料。

    ProviderServiceManageFeature.Done --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 成功返回控制台時服務列表反映最新名稱、描述、時長或狀態，且只顯示目前 Provider 的資料。

    ProviderServiceManageFeature.Rejected --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 失敗返回控制台時保留錯誤提示，不新增或錯改任何 Service。
```

### Provider TimeSlot Manage Feature
Source Pages: ProviderDashboardPage
```mermaid
%% role: Provider
stateDiagram-v2
    [*] --> ProviderTimeSlotManageFeature.Init : enterFeature
    %% verify: 進入時段管理流程時來源必須是 Provider 控制台，且只處理自己服務下的 TimeSlot。

    ProviderTimeSlotManageFeature.Init --> ProviderTimeSlotManageFeature.Submitting : submitTimeSlotChange
    %% verify: 送出時段新增、更新或關閉時檢查 `service_id` 歸屬、時間範圍、`capacity`、`cancel_deadline_at` 與同一 Service 時段不可重疊。

    ProviderTimeSlotManageFeature.Submitting --> ProviderTimeSlotManageFeature.Done : timeSlotChangeSaved
    %% verify: 成功時建立或更新 TimeSlot，關閉語意為 `OPEN -> CLOSED`，且 `booked_count` 只能由系統維護不得手動覆寫，同時寫入 AuditLog。

    ProviderTimeSlotManageFeature.Submitting --> ProviderTimeSlotManageFeature.Rejected : timeSlotChangeRejected
    %% verify: 若調降 `capacity` 小於 `booked_count`、時間重疊、越權修改他人 Service 或資料不合法時必須拒絕且不得改動 TimeSlot。

    ProviderTimeSlotManageFeature.Done --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 成功返回控制台時時段列表顯示新的時間、`capacity`、`cancel_deadline_at` 與狀態，且 `booked_count` 保持正確。

    ProviderTimeSlotManageFeature.Rejected --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 失敗返回控制台時保留原有時段資料與錯誤訊息，不產生不一致更新。
```

### Provider Booking Status Update Feature
Source Pages: ProviderDashboardPage
```mermaid
%% role: Provider
stateDiagram-v2
    [*] --> ProviderBookingStatusUpdateFeature.Init : enterFeature
    %% verify: 進入預約狀態更新流程時來源必須是 Provider 控制台，且 booking 必須屬於自己的服務。

    ProviderBookingStatusUpdateFeature.Init --> ProviderBookingStatusUpdateFeature.Submitting : submitBookingStatusChange
    %% verify: 送出狀態更新時檢查 JWT、booking 歸屬與合法狀態轉移，不允許 Provider 修改他人服務 booking。

    ProviderBookingStatusUpdateFeature.Submitting --> ProviderBookingStatusUpdateFeature.Done : bookingStatusUpdated
    %% verify: 成功時 Booking 僅能依規則由 `PENDING -> CONFIRMED -> COMPLETED` 或 `PENDING/CONFIRMED -> CANCELLED` 轉移，並寫入 AuditLog 與必要時間欄位。

    ProviderBookingStatusUpdateFeature.Submitting --> ProviderBookingStatusUpdateFeature.Rejected : bookingStatusRejected
    %% verify: 非法轉移如 `COMPLETED -> CANCELLED`、`CANCELLED -> PENDING`、越權操作或資料不合法時必須拒絕，且不改動 Booking 狀態。

    ProviderBookingStatusUpdateFeature.Done --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 成功返回控制台時預約名單顯示最新狀態，且只反映目前 Provider 服務下的 bookings。

    ProviderBookingStatusUpdateFeature.Rejected --> ProviderDashboardPage.Init : returnDashboard | navigate /provider/dashboard
    %% verify: 失敗返回控制台時保留原狀態與錯誤提示，不產生錯誤狀態更新。
```

### Admin User Status Manage Feature
Source Pages: AdminPage
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminUserStatusManageFeature.Init : enterFeature
    %% verify: 進入帳號狀態管理流程時來源必須是 Admin 後台，非 Admin 不得進入。

    AdminUserStatusManageFeature.Init --> AdminUserStatusManageFeature.Submitting : submitUserStatusChange
    %% verify: 送出帳號狀態異動時檢查 JWT 與 Admin 權限，目標狀態只允許 `ACTIVE` 或 `SUSPENDED`。

    AdminUserStatusManageFeature.Submitting --> AdminUserStatusManageFeature.Done : userStatusUpdated
    %% verify: 成功時更新 User `status`，若改為 `SUSPENDED` 則後續受保護請求需失效，並寫入 AuditLog。

    AdminUserStatusManageFeature.Submitting --> AdminUserStatusManageFeature.Rejected : userStatusRejected
    %% verify: 非 Admin、目標不存在或狀態值不合法時必須拒絕且不改動帳號資料。

    AdminUserStatusManageFeature.Done --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 成功返回後台時帳號列表顯示最新狀態，且被停用帳號無法再登入或建立預約。

    AdminUserStatusManageFeature.Rejected --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 失敗返回後台時保留原狀態與錯誤提示，不錯改任何帳號。
```

### Admin Service Status Manage Feature
Source Pages: AdminPage
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminServiceStatusManageFeature.Init : enterFeature
    %% verify: 進入服務狀態管理流程時來源必須是 Admin 後台，非 Admin 不得進入。

    AdminServiceStatusManageFeature.Init --> AdminServiceStatusManageFeature.Submitting : submitServiceStatusChange
    %% verify: 送出服務狀態異動時檢查 JWT 與 Admin 權限，目標狀態只允許 `ACTIVE` 或 `INACTIVE`。

    AdminServiceStatusManageFeature.Submitting --> AdminServiceStatusManageFeature.Done : serviceStatusUpdated
    %% verify: 成功時更新 Service 狀態並寫入 AuditLog；`INACTIVE` 服務不得再接受新 Booking，但既有 Booking 仍可查。

    AdminServiceStatusManageFeature.Submitting --> AdminServiceStatusManageFeature.Rejected : serviceStatusRejected
    %% verify: 非 Admin、目標不存在或狀態值不合法時必須拒絕且不改動 Service。

    AdminServiceStatusManageFeature.Done --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 成功返回後台時服務列表顯示最新 ACTIVE 或 INACTIVE 狀態，並影響後續可預約性。

    AdminServiceStatusManageFeature.Rejected --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 失敗返回後台時保留原有服務狀態與錯誤提示，不產生錯誤更新。
```

### Admin Report View Feature
Source Pages: AdminPage
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminReportViewFeature.Init : enterFeature
    %% verify: 進入報表檢視流程時來源必須是 Admin 後台，非 Admin 不得取得報表資料。

    AdminReportViewFeature.Init --> AdminReportViewFeature.Ready : loadReports
    %% verify: 報表 API 成功時顯示預約量、取消率、服務活躍度摘要，資料來源為全站統計。

    AdminReportViewFeature.Init --> AdminReportViewFeature.Empty : noReportData
    %% verify: 報表無資料時顯示 Empty 狀態，不顯示錯誤訊息或過期統計。

    AdminReportViewFeature.Init --> AdminReportViewFeature.Failed : loadFailed
    %% verify: 報表讀取失敗時收斂到 Failed 狀態，UI 顯示錯誤且不顯示不完整統計。

    AdminReportViewFeature.Ready --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 從 Ready 返回後台時仍保留 Admin 身分與後台導覽。

    AdminReportViewFeature.Empty --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 從 Empty 返回後台時保留 Admin 導覽，且可繼續切換其他管理功能。

    AdminReportViewFeature.Failed --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 從 Failed 返回後台時保留錯誤提示來源但不殘留不完整報表數據。
```