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

# 分層 Transition Diagrams（含 Verify）
個人記帳＋月報表網站

---

## ① Entry State Machine

```mermaid
stateDiagram-v2
    %% role: none
    [*] --> Entry.Init: enterSystem
    %% verify: 進站後提供公開入口並準備進入登入流程；Header 僅顯示 Logo、登入、註冊；Header 不顯示帳務列表、月報表、類別管理、登出

    Entry.Init --> LoginPage.Init: openLogin | navigate /login
    %% verify: URL 變更為 /login；登入頁顯示 Email、密碼、登入送出按鈕與註冊連結；Header 只有一個登入連結，頁面內只有表單送出按鈕而沒有第二個導覽型登入入口
```

---

## ② Login Page State Machine

例外回接：依 Step 1 的登入頁定義，登入驗證失敗後需留在登入頁並顯示錯誤，因此允許 AuthLoginFeature 回接到 LoginPage.Failed。

```mermaid
stateDiagram-v2
    %% role: Guest|User
    [*] --> LoginPage.Init: enterPage
    %% verify: 進入 /login 時顯示登入頁框架；Guest 只看到 Logo、登入、註冊；已登入使用者若進入此頁會套用自動導向規則

    LoginPage.Init --> LoginPage.Ready: showLoginForm
    %% verify: Email 與密碼輸入框可見；登入按鈕可點擊；註冊連結可點擊；Header 仍不顯示受保護頁導覽

    LoginPage.Init --> TransactionsPage.Init: redirectAuthenticatedUser | navigate /transactions
    %% verify: 已登入使用者進入 /login 時直接導向 /transactions；Header 顯示帳務列表、月報表、類別管理、登出；登入與註冊連結隱藏

    LoginPage.Ready --> RegisterPage.Init: clickRegisterLink | navigate /register
    %% verify: URL 變更為 /register；登入頁未送出任何登入請求；註冊頁表單為初始狀態

    LoginPage.Ready --> AuthLoginFeature.Init: submitLogin | navigate AuthLoginFeature
    %% verify: 點擊登入後進入登入功能流程；頁面只存在單一登入送出動作；不會在 Header 額外出現第二個登入 CTA

    LoginPage.Failed --> LoginPage.Ready: editCredentials
    %% verify: 錯誤訊息在重新輸入後可被覆蓋；Email 欄位保留已輸入內容；登入按鈕恢復可點擊
```

---

## ③ Register Page State Machine

例外回接：依 Step 1 的註冊頁定義，註冊驗證失敗後需留在註冊頁並顯示錯誤，因此允許 AuthRegisterFeature 回接到 RegisterPage.Failed。

```mermaid
stateDiagram-v2
    %% role: Guest|User
    [*] --> RegisterPage.Init: enterPage
    %% verify: 進入 /register 時顯示註冊頁框架；Guest 僅看到公開導覽；已登入使用者若進入此頁會套用自動導向規則

    RegisterPage.Init --> RegisterPage.Ready: showRegisterForm
    %% verify: Email、密碼、確認密碼輸入框可見；註冊按鈕可點擊；登入連結可點擊；Header 不顯示受保護頁導覽

    RegisterPage.Init --> TransactionsPage.Init: redirectAuthenticatedUser | navigate /transactions
    %% verify: 已登入使用者進入 /register 時直接導向 /transactions；Header 顯示使用者導覽；登入與註冊連結隱藏

    RegisterPage.Ready --> LoginPage.Init: clickLoginLink | navigate /login
    %% verify: URL 變更為 /login；註冊流程未送出；登入頁表單為初始狀態

    RegisterPage.Ready --> AuthRegisterFeature.Init: submitRegister | navigate AuthRegisterFeature
    %% verify: 點擊註冊後進入註冊功能流程；頁面內只有單一註冊送出按鈕；Header 沒有重複的註冊 CTA

    RegisterPage.Failed --> RegisterPage.Ready: editRegistrationForm
    %% verify: 更正輸入後可再次送出；錯誤訊息依新驗證結果更新；表單欄位保留尚未修正的值
```

---

## ④ Transactions Page State Machine

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> TransactionsPage.Init: enterPage
    %% verify: 進入 /transactions 時檢查登入狀態並準備載入帳務列表；Header 顯示帳務列表、月報表、類別管理、登出；Header 不顯示登入與註冊

    TransactionsPage.Init --> LoginPage.Init: authRequired | navigate /login
    %% verify: 未登入或 Session/Token 過期時導向 /login；保留 returnTo=/transactions；401 時清除無效 Session/Token；Guest 不可看到受保護導覽

    TransactionsPage.Init --> TransactionsPage.Ready: loadTransactionsDone
    %% verify: 帳務列表 API 回傳 200 且有資料；列表依日期分組且最新日期在最上方；每個日期區塊顯示當日總收入與總支出；同日帳務依時間倒序；新增帳務按鈕只出現在本頁而不出現在 Header

    TransactionsPage.Init --> TransactionsPage.Empty: loadTransactionsEmpty
    %% verify: 帳務列表 API 回傳 200 且無資料；顯示空狀態提示與新增帳務入口；Header 仍只顯示使用者導覽；頁面沒有重複的新增帳務 CTA

    TransactionsPage.Init --> TransactionsPage.Failed: loadTransactionsFailed
    %% verify: 帳務列表 API 回傳 5xx 或非授權外的失敗時顯示錯誤訊息與重試按鈕；既有日期分組與統計不顯示過期資料

    TransactionsPage.Ready --> ReportsPage.Init: clickReportsNav | navigate /reports
    %% verify: URL 變更為 /reports；開始載入所選年月報表；Header 導覽維持使用者狀態

    TransactionsPage.Ready --> CategoriesPage.Init: clickCategoriesNav | navigate /categories
    %% verify: URL 變更為 /categories；開始載入類別清單；Header 導覽維持使用者狀態

    TransactionsPage.Ready --> TransactionFormFeature.Init: clickAddTransaction | navigate TransactionFormFeature
    %% verify: 開啟新增帳務 Modal；表單類別選項僅包含 is_active=true 且符合帳務類型的類別；Modal 開啟前列表資料不變

    TransactionsPage.Ready --> TransactionFormFeature.Init: clickEditTransaction | navigate TransactionFormFeature
    %% verify: 開啟編輯帳務 Modal；表單預填 type、amount、category_id、date、note；仍僅能編輯自己的帳務資料

    TransactionsPage.Ready --> TransactionDeleteFeature.Init: clickDeleteTransaction | navigate TransactionDeleteFeature
    %% verify: 開啟刪除確認流程；顯示帳務摘要；尚未確認前列表、每日統計與月報表資料均不變

    TransactionsPage.Ready --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；準備清除 Session/Token；登出入口只在 Header 右側出現一次

    TransactionsPage.Ready --> TransactionsPage.Ready: loadMoreTransactions
    %% verify: 載入下一頁 30 筆或更多帳務時，新資料追加到正確日期分組；日統計仍與列表資料一致；舊資料順序不被破壞

    TransactionsPage.Empty --> ReportsPage.Init: clickReportsNav | navigate /reports
    %% verify: 即使沒有帳務資料仍可前往報表頁；URL 變更為 /reports；報表頁依資料量決定顯示 Empty 或 Ready

    TransactionsPage.Empty --> CategoriesPage.Init: clickCategoriesNav | navigate /categories
    %% verify: URL 變更為 /categories；類別管理頁可正常載入；使用者導覽不變

    TransactionsPage.Empty --> TransactionFormFeature.Init: clickAddTransaction | navigate TransactionFormFeature
    %% verify: 從空狀態開啟新增帳務 Modal；表單初始值為空白；類別選項只顯示可用類別

    TransactionsPage.Empty --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；空狀態畫面在登出後不可再存取

    TransactionsPage.Failed --> TransactionsPage.Init: retryLoad
    %% verify: 點擊重試後重新發送帳務列表 API；Loading、Ready、Empty 或 Failed 依最新回應更新；不會重複新增任何帳務項目
```

---

## ⑤ Reports Page State Machine

例外回接：依 Step 1 的月報表頁定義，匯出 CSV 完成或失敗後仍停留在目前報表畫面，因此允許 CsvExportFeature 回接到 ReportsPage.Ready。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> ReportsPage.Init: enterPage
    %% verify: 進入 /reports 時檢查登入狀態並準備載入當前年月資料；Header 顯示使用者導覽；匯出 CSV 按鈕只會在本頁出現而不會出現在 Header

    ReportsPage.Init --> LoginPage.Init: authRequired | navigate /login
    %% verify: 未登入或 Session/Token 過期時導向 /login；保留 returnTo=/reports；Guest 不可看到月報表導覽項

    ReportsPage.Init --> ReportsPage.Ready: loadReportDone
    %% verify: 報表 API 回傳 200 且有資料；統計卡片顯示總收入、總支出、淨收支；圓餅圖只統計 expense 類型；長條圖以有資料的日期顯示收入與支出；統計、圖表與帳務列表資料來源一致

    ReportsPage.Init --> ReportsPage.Empty: loadReportEmpty
    %% verify: 報表 API 回傳 200 且所選年月無帳務；統計卡片顯示 0；圓餅圖顯示「本月無支出」；長條圖顯示「本月無資料」；匯出 CSV 按鈕 disabled

    ReportsPage.Init --> ReportsPage.Failed: loadReportFailed
    %% verify: 報表 API 回傳 5xx 或其他失敗時顯示錯誤訊息與重試按鈕；不顯示不一致的舊統計數字

    ReportsPage.Ready --> ReportsPage.Init: changeYearOrMonth
    %% verify: 年份選單至少可選當年與前 2 年；月份可選 1 到 12 月；切換後重新載入指定年月資料；統計卡片、圓餅圖、長條圖與 CSV 匯出範圍同步切換

    ReportsPage.Ready --> TransactionsPage.Init: clickTransactionsNav | navigate /transactions
    %% verify: URL 變更為 /transactions；帳務列表依最新資料載入；Header 導覽維持使用者狀態

    ReportsPage.Ready --> CategoriesPage.Init: clickCategoriesNav | navigate /categories
    %% verify: URL 變更為 /categories；類別管理頁載入成功；使用者導覽不變

    ReportsPage.Ready --> CsvExportFeature.Init: clickExportCsv | navigate CsvExportFeature
    %% verify: 只在有資料時可進入匯出流程；匯出範圍固定為目前選擇月份；頁面上不存在第二個重複的匯出 CSV 入口

    ReportsPage.Ready --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；登出前保留目前選擇的年月狀態僅於前端記憶，不再允許後續 API 存取

    ReportsPage.Empty --> ReportsPage.Init: changeYearOrMonth
    %% verify: 切換到其他年月後重新查詢；若有資料則進入 Ready；若仍無資料則維持 Empty；統計與圖表文案同步更新

    ReportsPage.Empty --> TransactionsPage.Init: clickTransactionsNav | navigate /transactions
    %% verify: URL 變更為 /transactions；可回到帳務列表頁繼續新增或檢視帳務

    ReportsPage.Empty --> CategoriesPage.Init: clickCategoriesNav | navigate /categories
    %% verify: URL 變更為 /categories；可前往管理類別；Header 導覽維持使用者狀態

    ReportsPage.Empty --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；匯出按鈕 disabled 狀態不會影響登出成功

    ReportsPage.Failed --> ReportsPage.Init: retryLoad
    %% verify: 點擊重試後重新發送報表 API；若成功則統計卡片、圖表與匯出能力依最新資料更新；若再次失敗則維持 Failed 並顯示最新錯誤
```

---

## ⑥ Categories Page State Machine

例外回接：依 Step 1 的類別管理頁定義，新增/編輯/停用/啟用操作完成後需回到目前類別管理畫面，因此允許 CategoryFormFeature 與 CategoryToggleFeature 回接到 CategoriesPage.Ready 或 CategoriesPage.Empty。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> CategoriesPage.Init: enterPage
    %% verify: 進入 /categories 時檢查登入狀態並準備載入類別清單；Header 顯示使用者導覽；頁面內提供新增、編輯、停用或啟用入口

    CategoriesPage.Init --> LoginPage.Init: authRequired | navigate /login
    %% verify: 未登入或 Session/Token 過期時導向 /login；保留 returnTo=/categories；Guest 不可看到類別管理導覽項

    CategoriesPage.Init --> CategoriesPage.Ready: loadCategoriesDone
    %% verify: 類別 API 回傳 200 且存在自訂類別；列表同時顯示預設類別與自訂類別；每個類別顯示名稱、狀態、類型；預設類別不可刪除

    CategoriesPage.Init --> CategoriesPage.Empty: loadCustomCategoriesEmpty
    %% verify: 類別 API 回傳 200 且沒有自訂類別；頁面仍顯示預設類別；可從空自訂類別狀態新增第一個自訂類別

    CategoriesPage.Init --> CategoriesPage.Failed: loadCategoriesFailed
    %% verify: 類別 API 回傳 5xx 或其他失敗時顯示錯誤訊息與重試按鈕；不顯示不一致的舊類別狀態

    CategoriesPage.Ready --> TransactionsPage.Init: clickTransactionsNav | navigate /transactions
    %% verify: URL 變更為 /transactions；帳務列表頁載入成功；Header 導覽維持使用者狀態

    CategoriesPage.Ready --> ReportsPage.Init: clickReportsNav | navigate /reports
    %% verify: URL 變更為 /reports；月報表頁載入成功；Header 導覽維持使用者狀態

    CategoriesPage.Ready --> CategoryFormFeature.Init: clickAddCategory | navigate CategoryFormFeature
    %% verify: 開啟新增類別 Modal；名稱為空；type 可選 income、expense、both；新增入口只在頁面內容區出現

    CategoriesPage.Ready --> CategoryFormFeature.Init: clickEditCategory | navigate CategoryFormFeature
    %% verify: 開啟編輯類別 Modal；預填名稱與 type；仍只能操作自己的類別資料

    CategoriesPage.Ready --> CategoryToggleFeature.Init: clickToggleCategoryStatus | navigate CategoryToggleFeature
    %% verify: 開啟停用或啟用流程；若為停用需顯示歷史資料保留的提示；尚未確認前類別狀態不變

    CategoriesPage.Ready --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；登出入口只在 Header 右側出現一次

    CategoriesPage.Empty --> TransactionsPage.Init: clickTransactionsNav | navigate /transactions
    %% verify: URL 變更為 /transactions；使用者可回到帳務列表頁

    CategoriesPage.Empty --> ReportsPage.Init: clickReportsNav | navigate /reports
    %% verify: URL 變更為 /reports；使用者可前往月報表頁

    CategoriesPage.Empty --> CategoryFormFeature.Init: clickAddCategory | navigate CategoryFormFeature
    %% verify: 從無自訂類別狀態開啟新增類別 Modal；表單為初始值；預設類別區塊仍保留可見

    CategoriesPage.Empty --> LogoutFeature.Init: clickLogout | navigate LogoutFeature
    %% verify: 觸發登出流程；空狀態畫面在登出後不可再存取

    CategoriesPage.Failed --> CategoriesPage.Init: retryLoad
    %% verify: 點擊重試後重新發送類別 API；若成功則 Ready 或 Empty 依資料量更新；若再次失敗則維持 Failed 並顯示最新錯誤
```

---

## ⑦ Feature: AuthLoginFeature

例外回接：依 Step 1 的登入頁定義，登入表單驗證失敗或登入被拒絕時需回到 LoginPage.Failed，而不是重新進入 LoginPage.Init。

```mermaid
stateDiagram-v2
    %% role: Guest|User
    [*] --> AuthLoginFeature.Init: enterFeature
    %% verify: 由登入頁送出登入表單後進入登入功能流程；登入按鈕進入 loading 前不可重複送出

    AuthLoginFeature.Init --> AuthLoginFeature.Validating: validateCredentials
    %% verify: 檢查 Email 格式與密碼是否輸入；前端驗證尚未送出 API；表單欄位值保留供錯誤顯示使用

    AuthLoginFeature.Validating --> AuthLoginFeature.Submitting: validationPassed
    %% verify: Email 格式正確且密碼不為空；登入按鈕 disabled；開始送出登入 API

    AuthLoginFeature.Validating --> LoginPage.Failed: validationRejected | navigate /login
    %% verify: Email 格式錯誤或密碼空白時不呼叫 API；登入頁顯示對應錯誤訊息；Email 欄位保留原值；Header 維持 Guest 導覽

    AuthLoginFeature.Submitting --> TransactionsPage.Init: loginSucceededDefault | navigate /transactions
    %% verify: 登入 API 回傳 200 且未帶 returnTo 時導向 /transactions；Session/Token 儲存成功；Header 立即切換為帳務列表、月報表、類別管理、登出

    AuthLoginFeature.Submitting --> ReportsPage.Init: loginSucceededReturnReports | navigate /reports
    %% verify: 原先因未登入被導向登入且 returnTo=/reports 時，登入 API 回傳 200 後回到 /reports；報表頁重新以目前使用者資料載入

    AuthLoginFeature.Submitting --> CategoriesPage.Init: loginSucceededReturnCategories | navigate /categories
    %% verify: 原先因未登入被導向登入且 returnTo=/categories 時，登入 API 回傳 200 後回到 /categories；類別頁重新以目前使用者資料載入

    AuthLoginFeature.Submitting --> LoginPage.Failed: loginRejected | navigate /login
    %% verify: 登入 API 回傳 401 時顯示帳號或密碼錯誤；回傳 5xx 時顯示伺服器錯誤；Token 不寫入；Header 仍只顯示公開導覽
```

---

## ⑧ Feature: AuthRegisterFeature

例外回接：依 Step 1 的註冊頁定義，註冊驗證失敗或註冊被拒絕時需回到 RegisterPage.Failed，而不是重新進入 RegisterPage.Init。

```mermaid
stateDiagram-v2
    %% role: Guest|User
    [*] --> AuthRegisterFeature.Init: enterFeature
    %% verify: 由註冊頁送出註冊表單後進入註冊功能流程；註冊按鈕進入 loading 前不可重複送出

    AuthRegisterFeature.Init --> AuthRegisterFeature.Validating: validateRegistrationForm
    %% verify: 檢查 Email 格式、密碼至少 8 字元、確認密碼一致；尚未送出 API；表單值保留供錯誤訊息使用

    AuthRegisterFeature.Validating --> AuthRegisterFeature.Submitting: validationPassed
    %% verify: 所有欄位通過驗證；註冊按鈕 disabled；開始送出註冊 API

    AuthRegisterFeature.Validating --> RegisterPage.Failed: validationRejected | navigate /register
    %% verify: Email 格式錯誤、密碼不足 8 字元或確認密碼不符時不呼叫 API；註冊頁顯示對應錯誤訊息；Header 維持 Guest 導覽

    AuthRegisterFeature.Submitting --> TransactionsPage.Init: registerSucceededAutoLogin | navigate /transactions
    %% verify: 註冊 API 回傳 201 且自動登入成功；Session/Token 儲存成功；導向 /transactions；Header 立即切換為使用者導覽

    AuthRegisterFeature.Submitting --> RegisterPage.Failed: registerRejected | navigate /register
    %% verify: 註冊 API 回傳 409 時顯示 Email 已存在；回傳 400 時顯示欄位驗證錯誤；回傳 5xx 時顯示伺服器錯誤；不建立登入 Session/Token
```

---

## ⑨ Feature: LogoutFeature

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> LogoutFeature.Init: enterFeature
    %% verify: 由任一使用者頁面的 Header 登出入口進入登出流程；登出按鈕在流程完成前不可重複觸發

    LogoutFeature.Init --> LogoutFeature.ClearingSession: clearSession
    %% verify: Session/Token 從 Cookie 或 localStorage 清除；後續受保護 API 請求不再帶有效憑證

    LogoutFeature.ClearingSession --> LoginPage.Init: logoutSucceeded | navigate /login
    %% verify: URL 變更為 /login；Header 只顯示 Logo、登入、註冊；帳務列表、月報表、類別管理、登出 全部隱藏；重新整理後仍不可存取先前的受保護資料
```

---

## ⑩ Feature: TransactionFormFeature

例外回接：依 Step 1 的帳務列表頁定義，新增或編輯帳務使用 Modal，取消或送出後要回到目前的帳務列表狀態，因此允許回接到 TransactionsPage.Ready 或 TransactionsPage.Empty。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> TransactionFormFeature.Init: enterFeature
    %% verify: 由帳務列表頁進入新增或編輯帳務 Modal；新增時欄位為空；編輯時預填 type、amount、category_id、date、note

    TransactionFormFeature.Init --> TransactionFormFeature.Editing: openTransactionForm
    %% verify: Modal 可見；type 僅可選 income 或 expense；category 下拉只顯示 is_active=true 且符合 type 的類別；note 最多 200 字

    TransactionFormFeature.Editing --> TransactionFormFeature.Validating: submitTransactionForm
    %% verify: 送出前檢查 amount 為正整數、date 為 YYYY-MM-DD、category_id 為可用類別；送出按鈕 disabled 以避免重複提交

    TransactionFormFeature.Validating --> TransactionFormFeature.Editing: validationRejected
    %% verify: 欄位驗證失敗時顯示對應錯誤訊息；不呼叫 API；使用者輸入值保留；列表、日統計、月報表與圖表資料不變

    TransactionFormFeature.Validating --> TransactionFormFeature.Submitting: validationPassed
    %% verify: 所有必填欄位通過驗證；新增時準備送出 POST；編輯時準備送出 PUT；帳務仍自動綁定目前 user_id

    TransactionFormFeature.Submitting --> TransactionsPage.Ready: saveSucceeded | navigate /transactions
    %% verify: API 回傳 200 或 201；新增帳務會出現在正確日期分組；編輯後若日期變更則移到新日期分組；當日總收入、當日總支出、月統計、圓餅圖、長條圖與匯出資料全部同步更新；使用者僅能寫入自己的帳務

    TransactionFormFeature.Submitting --> TransactionFormFeature.Editing: saveRejected
    %% verify: API 回傳 400 時顯示欄位錯誤；回傳 403 或 404 時顯示無權限或資料不存在；回傳 5xx 時顯示伺服器錯誤；Modal 保持開啟且表單值保留

    TransactionFormFeature.Editing --> TransactionsPage.Ready: cancelFromReady | navigate /transactions
    %% verify: 從已有資料的列表取消時關閉 Modal 並回到原列表；帳務列表、日統計、月報表與圖表完全不變

    TransactionFormFeature.Editing --> TransactionsPage.Empty: cancelFromEmpty | navigate /transactions
    %% verify: 從空狀態新增流程取消時關閉 Modal 並回到空狀態；畫面仍顯示新增第一筆帳務提示
```

---

## ⑪ Feature: TransactionDeleteFeature

例外回接：依 Step 1 的帳務列表頁定義，刪除確認使用 Modal，取消或刪除後需回到目前列表狀態，因此允許回接到 TransactionsPage.Ready 或 TransactionsPage.Empty。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> TransactionDeleteFeature.Init: enterFeature
    %% verify: 由帳務列表頁的刪除入口進入刪除確認流程；Modal 顯示該筆帳務的日期、類別、金額摘要

    TransactionDeleteFeature.Init --> TransactionDeleteFeature.Confirming: showDeleteConfirm
    %% verify: 刪除確認 Modal 可見；需要二次確認；尚未確認前帳務列表與統計資料不變

    TransactionDeleteFeature.Confirming --> TransactionDeleteFeature.Deleting: confirmDelete
    %% verify: 使用者明確點擊確認後才送出 DELETE；確認按鈕進入 loading；避免重複刪除同一筆資料

    TransactionDeleteFeature.Deleting --> TransactionsPage.Ready: deleteSucceededKeepList | navigate /transactions
    %% verify: DELETE API 回傳 200 且該日期或整體列表仍有其他帳務；被刪除帳務從列表移除；對應日期的總收入或總支出重新計算；月統計、圖表與 CSV 匯出資料同步更新；不得刪除其他使用者資料

    TransactionDeleteFeature.Deleting --> TransactionsPage.Empty: deleteSucceededLastItem | navigate /transactions
    %% verify: DELETE API 回傳 200 且刪除後已無任何帳務；列表切換為 Empty；空狀態提示可見；月報表同月份統計與圖表同步為空資料表現

    TransactionDeleteFeature.Deleting --> TransactionDeleteFeature.Confirming: deleteRejected
    %% verify: API 回傳 403、404 或 5xx 時顯示對應錯誤訊息；帳務資料保持不變；使用者可再次確認或取消

    TransactionDeleteFeature.Confirming --> TransactionsPage.Ready: cancelDelete | navigate /transactions
    %% verify: 取消刪除後關閉 Modal 並回到原列表；帳務、日統計、月統計與圖表完全不變
```

---

## ⑫ Feature: CategoryFormFeature

例外回接：依 Step 1 的類別管理頁定義，新增或編輯類別使用 Modal，取消或送出後要回到目前的類別管理狀態，因此允許回接到 CategoriesPage.Ready 或 CategoriesPage.Empty。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> CategoryFormFeature.Init: enterFeature
    %% verify: 由類別管理頁進入新增或編輯類別 Modal；新增時名稱為空；編輯時預填名稱與 type

    CategoryFormFeature.Init --> CategoryFormFeature.Editing: openCategoryForm
    %% verify: Modal 可見；name 最多 20 字；type 僅可選 income、expense、both；預設類別可被停用但不可被刪除

    CategoryFormFeature.Editing --> CategoryFormFeature.Validating: submitCategoryForm
    %% verify: 送出前檢查名稱必填且長度不超過 20；同一使用者下名稱需唯一；送出按鈕 disabled 以避免重複提交

    CategoryFormFeature.Validating --> CategoryFormFeature.Editing: validationRejected
    %% verify: 名稱為空、名稱過長或前端偵測重複時顯示錯誤訊息；不呼叫 API；原輸入值保留

    CategoryFormFeature.Validating --> CategoryFormFeature.Submitting: validationPassed
    %% verify: 欄位通過驗證後開始送出 POST 或 PUT；新類別或更新類別都綁定目前 user_id 或系統預設類別規則

    CategoryFormFeature.Submitting --> CategoriesPage.Ready: saveSucceeded | navigate /categories
    %% verify: API 回傳 200 或 201；新增成功時新類別出現在列表；編輯成功時列表名稱立即更新；帳務表單中的類別選項同步使用最新名稱；歷史帳務與類別關聯保持一致

    CategoryFormFeature.Submitting --> CategoryFormFeature.Editing: saveRejected
    %% verify: API 回傳 409 時顯示同使用者名稱重複；回傳 400 時顯示欄位錯誤；回傳 5xx 時顯示伺服器錯誤；Modal 保持開啟且輸入值保留

    CategoryFormFeature.Editing --> CategoriesPage.Ready: cancelFromReady | navigate /categories
    %% verify: 從已有自訂類別狀態取消時關閉 Modal 並回到列表；類別資料與帳務表單選項完全不變

    CategoryFormFeature.Editing --> CategoriesPage.Empty: cancelFromEmpty | navigate /categories
    %% verify: 從無自訂類別狀態取消新增時關閉 Modal 並回到 Empty；預設類別區塊仍可見；自訂類別仍為空
```

---

## ⑬ Feature: CategoryToggleFeature

例外回接：依 Step 1 的類別管理頁定義，停用或啟用類別完成後需回到目前的類別管理畫面，因此允許回接到 CategoriesPage.Ready。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> CategoryToggleFeature.Init: enterFeature
    %% verify: 由類別管理頁進入停用或啟用流程；目標類別屬於目前使用者或為可管理的預設類別；仍不提供刪除功能

    CategoryToggleFeature.Init --> CategoryToggleFeature.Confirming: showToggleConfirm
    %% verify: 停用時顯示「停用後不可用於新帳務，但歷史資料保留」提示；啟用時顯示狀態變更確認；尚未確認前 is_active 不變

    CategoryToggleFeature.Confirming --> CategoryToggleFeature.Submitting: confirmToggle
    %% verify: 使用者確認後送出更新 is_active 的 API；按鈕進入 loading；避免重複提交

    CategoryToggleFeature.Submitting --> CategoriesPage.Ready: toggleSucceeded | navigate /categories
    %% verify: API 回傳 200；停用後 is_active=false 且帳務新增/編輯表單不再顯示該類別；啟用後 is_active=true 且帳務表單可再次選取；歷史帳務保留原類別名稱與關聯資料

    CategoryToggleFeature.Submitting --> CategoryToggleFeature.Confirming: toggleRejected
    %% verify: API 回傳 403、404 或 5xx 時顯示錯誤訊息；類別狀態不變；帳務表單可用類別集合不變

    CategoryToggleFeature.Confirming --> CategoriesPage.Ready: cancelToggle | navigate /categories
    %% verify: 取消後關閉確認提示並回到類別列表；類別狀態與歷史帳務資料完全不變
```

---

## ⑭ Feature: CsvExportFeature

例外回接：依 Step 1 的月報表頁定義，匯出完成或失敗後需留在目前報表頁，因此允許回接到 ReportsPage.Ready。

```mermaid
stateDiagram-v2
    %% role: User
    [*] --> CsvExportFeature.Init: enterFeature
    %% verify: 由月報表頁的匯出 CSV 按鈕進入匯出流程；只有在目前月份有帳務資料時才可進入此流程

    CsvExportFeature.Init --> CsvExportFeature.Exporting: exportCurrentMonth
    %% verify: 送出 CSV 匯出請求時帶入目前選擇的年月；匯出按鈕進入 loading；匯出範圍固定為畫面上所選月份

    CsvExportFeature.Exporting --> ReportsPage.Ready: exportSucceeded | navigate /reports
    %% verify: 匯出 API 回傳 200 並觸發檔案下載；檔名格式為 transactions_YYYY_MM.csv；CSV 欄位為日期、類型、類別、金額、備註；匯出內容與目前報表、圖表與帳務列表資料一致

    CsvExportFeature.Exporting --> ReportsPage.Ready: exportRejected | navigate /reports
    %% verify: 匯出 API 回傳 5xx 或其他失敗時顯示錯誤訊息；畫面仍停留在相同月份的報表頁；統計卡片與圖表資料不變
```
