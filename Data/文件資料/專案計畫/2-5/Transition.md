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
    [*] --> Entry.Init : enterSystem
    %% verify: 首次進站不預設已有登入身分；入口只提供 Guest、登入、註冊三種起始選項，且不自動分流到 User/Admin 專屬頁面

    Entry.Init --> HomePage.Init : continueAsGuest | navigate /
    %% verify: 導向 / 並回傳首頁內容；Header 僅顯示「首頁/搜尋/登入/註冊」，不顯示「新增主題/我的主題/我的回覆/後台」且頁面內不重複第二組登入/註冊 CTA

    Entry.Init --> LoginPage.Init : chooseLogin | navigate /login
    %% verify: 導向 /login 並顯示 email/password 表單；尚未建立 session cookie；不暴露需要登入後才可見的頁面資料

    Entry.Init --> RegisterPage.Init : chooseRegister | navigate /register
    %% verify: 導向 /register 並顯示註冊表單；尚未建立 session cookie；登入與註冊入口只保留單一導向路徑而非重複按鈕
```

## ② Home Page
```mermaid
%% role: none
stateDiagram-v2
    [*] --> HomePage.Init : enterPage
    %% verify: 載入首頁時請求看板列表；頁面先進入首頁初始化流程，並以 sort_order 作為後續顯示排序依據

    HomePage.Init --> HomePage.Ready : showBoardList
    %% verify: boards API 回 200 且至少一筆資料；看板依 sort_order 排序；停用看板帶有不可互動標示但仍可點入唯讀瀏覽

    HomePage.Init --> HomePage.Empty : showNoBoards
    %% verify: boards API 回 200 且結果為空；顯示空狀態文案；仍保留 Header 的首頁/搜尋/登入/註冊導覽且不額外重複登入 CTA

    HomePage.Init --> HomePage.Failed : loadBoardsFailed
    %% verify: 載入看板失敗時顯示可重試錯誤狀態；不顯示過期或部分成功的列表資料

    HomePage.Ready --> BoardPage.Init : openBoard | navigate /boards/:id
    %% verify: 點擊看板卡導向正確 /boards/:id；存在的 board 回 200，不存在回 404；停用看板進入後為唯讀模式

    HomePage.Ready --> SearchPage.Init : openSearch | navigate /search
    %% verify: 導向 /search 並保留公開搜尋入口；Guest 仍只能搜尋 published 且非 hidden 的內容

    HomePage.Ready --> LoginPage.Init : openLogin | navigate /login
    %% verify: 僅在 Guest 導覽顯示登入入口；若 Header 已有登入按鈕，首頁內容區不重複產生第二個登入 CTA

    HomePage.Ready --> RegisterPage.Init : openRegister | navigate /register
    %% verify: 僅在 Guest 導覽顯示註冊入口；若 Header 已有註冊按鈕，首頁內容區不重複產生第二個註冊 CTA

    HomePage.Ready --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 僅已登入使用者可看到登出入口；觸發後會清除 session，Guest 不應看到此動作

    HomePage.Ready --> AdminPage.Init : openAdmin | navigate /admin
    %% verify: 只有 Admin 導覽可見後台入口；非 Admin 不顯示此入口，直接進入 /admin 會在後續頁面 guard 收斂為 401/403

    HomePage.Empty --> SearchPage.Init : openSearch | navigate /search
    %% verify: 無看板時仍可進入搜尋頁；搜尋頁僅顯示公開內容，不會因首頁空資料而失效

    HomePage.Empty --> LoginPage.Init : openLogin | navigate /login
    %% verify: 空列表狀態下登入入口仍可用；登入入口不重複出現在 Header 與頁面內容兩處

    HomePage.Empty --> RegisterPage.Init : openRegister | navigate /register
    %% verify: 空列表狀態下註冊入口仍可用；註冊入口不重複出現在 Header 與頁面內容兩處

    HomePage.Empty --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 已登入且沒有看板時仍可登出；登出成功後 Header 立即回到 Guest 導覽

    HomePage.Failed --> HomePage.Init : retryHome | navigate /
    %% verify: 點擊重試會重新呼叫 boards API；成功後進入 Ready/Empty，失敗時維持 Failed 而不產生重複列表項目
```

## ③ Search Page
```mermaid
%% role: none
stateDiagram-v2
    [*] --> SearchPage.Init : enterPage
    %% verify: 進入 /search 時顯示搜尋輸入與初始頁面；尚未顯示未經查詢的舊結果

    SearchPage.Init --> SearchPage.Ready : showSearchForm
    %% verify: 搜尋表單可輸入關鍵字；Header 仍符合角色導覽規則，Guest 不顯示新增主題或後台入口

    SearchPage.Ready --> SearchPage.Results : submitQueryWithMatches
    %% verify: search API 回 200 且有結果；結果只包含公開可見 thread 或其可見內容，不含 hidden thread/post

    SearchPage.Ready --> SearchPage.Empty : submitQueryNoMatch
    %% verify: search API 回 200 且無結果；顯示無結果狀態，不顯示 hidden 內容或不存在資源的殘留資訊

    SearchPage.Ready --> SearchPage.Failed : submitQueryFailed
    %% verify: 搜尋失敗時顯示錯誤與可重試控制；不保留誤導性的成功統計或部分資料

    SearchPage.Ready --> HomePage.Init : openHome | navigate /
    %% verify: 可返回首頁；返回後仍依角色顯示正確 Header 導覽，不額外複製登入/註冊 CTA

    SearchPage.Ready --> LoginPage.Init : openLogin | navigate /login
    %% verify: Guest 從搜尋頁登入時會保留 returnTo=/search；登入成功後可返回搜尋流程而非遺失目前頁面

    SearchPage.Ready --> RegisterPage.Init : openRegister | navigate /register
    %% verify: Guest 從搜尋頁註冊時可保留 returnTo=/search；註冊成功後導回搜尋頁或首頁，且不建立重複導覽入口

    SearchPage.Ready --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 已登入使用者可從搜尋頁登出；登出後 session 清除且回到 Guest 導覽

    SearchPage.Results --> ThreadPage.Init : openResultThread | navigate /threads/:id
    %% verify: 點擊搜尋結果會導向正確主題頁；若該 thread 在點擊前已變 hidden，應收斂為 403/404 而不洩漏 title 或內容

    SearchPage.Results --> SearchPage.Init : refineSearch | navigate /search
    %% verify: 調整關鍵字會回到搜尋輸入初始狀態；新查詢不沿用上一組結果排序或計數

    SearchPage.Empty --> SearchPage.Init : clearQuery | navigate /search
    %% verify: 清除查詢後回到可重新輸入的初始狀態；空結果提示消失且表單保持可用

    SearchPage.Failed --> SearchPage.Init : retrySearch | navigate /search
    %% verify: 重試會以相同查詢重新送出請求；成功回到 Results/Empty，失敗則繼續停在 Failed
```

## ④ Board Page Base
```mermaid
%% role: none
%% base: BoardPage
stateDiagram-v2
    [*] --> BoardPage.Init : enterPage
    %% verify: 進入 /boards/:id 會請求看板明細與主題列表；列表分頁為每頁 20 筆且 pinned 需優先排序

    BoardPage.Init --> BoardPage.Ready : showActiveBoard
    %% verify: board API 與 thread list API 回 200 且 board.is_active=true；主題列表僅顯示目前角色可見內容，pinned 優先於其他主題

    BoardPage.Init --> BoardPage.Empty : showActiveBoardEmpty
    %% verify: board 存在且啟用但目前無主題；顯示空狀態，若角色為 User 以上則可見新增主題 CTA

    BoardPage.Init --> BoardPage.ReadOnly : showInactiveBoard
    %% verify: board.is_active=false 時仍可瀏覽舊內容；Like/Favorite/Report/Reply/New Thread 入口必須禁用並顯示停用原因

    BoardPage.Init --> BoardPage.NotFound : boardMissing
    %% verify: 查無 board 時回 404；顯示 Not Found 且不顯示不存在看板的主題列表

    BoardPage.Init --> BoardPage.Forbidden : boardForbidden
    %% verify: 若存取被拒顯示 403 提示；不應將 Forbidden 誤導為空列表或一般錯誤

    BoardPage.Init --> BoardPage.Failed : loadBoardFailed
    %% verify: 載入失敗時顯示可重試錯誤狀態；不保留過期資料或部分治理資料

    BoardPage.Ready --> ThreadPage.Init : openThread | navigate /threads/:id
    %% verify: 點擊主題項目導向對應 /threads/:id；若目標 thread 已 hidden 且無權限，後續主題頁應收斂為 403/404

    BoardPage.Ready --> NewThreadPage.Init : openNewThread | navigate /threads/new
    %% verify: User/Moderator/Admin 才可進入發文頁；Guest 會在目標頁 guard 導向 /login，且 board_id 需正確帶入

    BoardPage.Ready --> SearchPage.Init : openSearch | navigate /search
    %% verify: 可從看板頁返回搜尋；當前 board 上下文不會污染公開搜尋結果

    BoardPage.Ready --> BoardPage.Moderator.Init : openGovernance | navigate BoardPage.Moderator
    %% verify: 僅 Moderator(該 board scope) 與 Admin 可進入治理差異圖；未指派 Moderator 不顯示治理面板入口

    BoardPage.Ready --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 已登入使用者可從看板頁登出；登出後 Header 回到 Guest 導覽且治理入口消失

    BoardPage.Empty --> NewThreadPage.Init : openNewThread | navigate /threads/new
    %% verify: 空看板下仍可由 User 以上發第一篇主題；停用看板則不應出現可送出的新增主題流程

    BoardPage.Empty --> SearchPage.Init : openSearch | navigate /search
    %% verify: 空看板可改走搜尋頁；搜尋結果仍只含公開可見內容

    BoardPage.Empty --> BoardPage.Moderator.Init : openGovernance | navigate BoardPage.Moderator
    %% verify: 空看板但有治理需求時，Moderator/Admin 仍可進入治理面板查看檢舉列表或空狀態

    BoardPage.ReadOnly --> ThreadPage.Init : openThread | navigate /threads/:id
    %% verify: 停用看板中的既有主題仍可唯讀開啟；後續主題頁不得允許新增回覆或互動

    BoardPage.ReadOnly --> BoardPage.Moderator.Init : openGovernance | navigate BoardPage.Moderator
    %% verify: 停用看板下 Moderator/Admin 仍可治理既有內容；治理按鈕保留且需標示看板停用狀態

    BoardPage.ReadOnly --> HomePage.Init : backHome | navigate /
    %% verify: 返回首頁後仍顯示停用看板標記；不會因返回而把停用看板誤顯示成可互動

    BoardPage.NotFound --> HomePage.Init : backHome | navigate /
    %% verify: 從 404 看板返回首頁後可正常瀏覽其他看板；不存在的 board_id 不會殘留在導覽狀態

    BoardPage.Forbidden --> HomePage.Init : backHome | navigate /
    %% verify: 從 403 狀態返回首頁後不會短暫顯示無權限看板內容；權限提示與首頁列表分離

    BoardPage.Failed --> BoardPage.Init : retryBoard | navigate /boards/:id
    %% verify: 重試會重新請求 board 與 thread list；成功後回到 Ready/Empty/ReadOnly，失敗時留在 Failed
```

## ⑤ Board Page Moderator Delta
此圖為 BoardPage 的治理差異圖，只描述 Moderator / Admin 在同一路由上的額外狀態。
```mermaid
%% role: Moderator|Admin
%% extends: BoardPage
stateDiagram-v2
    [*] --> BoardPage.Moderator.Init : enterRoleDelta
    %% verify: 只有具有 board scope 的 Moderator 與 Admin 可進入此差異圖；未指派者不得以 UI 或 API 進入治理面板

    BoardPage.Moderator.Init --> BoardPage.Moderator.PanelReady : showGovernancePanel
    %% verify: 顯示該看板治理面板與 pending 優先的檢舉列表；Moderator 可看到該板 hidden 內容的治理摘要，Guest/User 不可見

    BoardPage.Moderator.Init --> BoardPage.Moderator.PanelEmpty : showNoPendingReports
    %% verify: 當目前看板無待處理檢舉時顯示空狀態；空狀態仍保留快速治理入口，但不顯示不存在的報告項目

    BoardPage.Moderator.Init --> BoardPage.Moderator.Failed : loadGovernanceFailed
    %% verify: 載入治理資料失敗時顯示錯誤訊息與返回路徑；不顯示不完整的 report 清單

    BoardPage.Moderator.PanelReady --> ReportResolutionFeature.Init : reviewReport | navigate ReportResolutionFeature
    %% verify: 點擊檢舉項目可進入處理流程；帶入 target_type、target_id 與目前狀態 pending，並限制在同一 board scope

    BoardPage.Moderator.PanelReady --> ThreadStatusFeature.Init : changeThreadStatus | navigate ThreadStatusFeature
    %% verify: 可對看板內主題執行 hide/restore/lock/unlock；非法狀態轉換如 hidden 直接 lock 必須在後續 API 被拒絕

    BoardPage.Moderator.PanelReady --> PostModerationFeature.Init : changePostVisibility | navigate PostModerationFeature
    %% verify: 可對看板內回覆執行 hide/restore；目標回覆必須屬於本看板 thread，否則 API 回 403

    BoardPage.Moderator.PanelReady --> PinThreadFeature.Init : togglePinned | navigate PinThreadFeature
    %% verify: 可切換 is_pinned；此操作只影響看板內排序，不改變 thread.status

    BoardPage.Moderator.PanelReady --> FeatureThreadFeature.Init : toggleFeatured | navigate FeatureThreadFeature
    %% verify: 可切換 is_featured；此操作不改變 thread.status，且看板列表上的精華標記需同步更新

    BoardPage.Moderator.PanelReady --> BoardPage.Init : closeGovernance | navigate /boards/:id
    %% verify: 關閉治理面板後回到看板主列表；原本的分頁與排序上下文應保留

    BoardPage.Moderator.PanelEmpty --> BoardPage.Init : closeGovernance | navigate /boards/:id
    %% verify: 從空治理面板返回時不產生額外請求副作用；看板列表仍維持原排序與可見性

    BoardPage.Moderator.Failed --> BoardPage.Init : closeGovernance | navigate /boards/:id
    %% verify: 治理資料載入失敗後可安全回看板頁；不會殘留半開啟的治理 UI 元件
```

## ⑥ Thread Page Base
```mermaid
%% role: none
%% base: ThreadPage
stateDiagram-v2
    [*] --> ThreadPage.Init : enterPage
    %% verify: 進入 /threads/:id 會請求 thread detail 與首批 replies；頁面不應先顯示上一個主題的殘留資料

    ThreadPage.Init --> ThreadPage.Viewing : showThread
    %% verify: thread detail API 回 200 且目前角色有權查看；顯示 thread 標題、內容、狀態標籤與首批可見 replies

    ThreadPage.Init --> ThreadPage.Forbidden : hideRestrictedThread
    %% verify: 當 thread 為 hidden 且使用者非對應 board Moderator/Admin 時，回 403 或 404；不顯示 title/content 任何片段

    ThreadPage.Init --> ThreadPage.NotFound : threadMissing
    %% verify: 查無主題時回 404；不顯示空白內容頁或錯誤的 board breadcrumb

    ThreadPage.Init --> ThreadPage.Failed : loadThreadFailed
    %% verify: 載入主題失敗時顯示可重試錯誤；既有 replies 不得誤顯示為成功載入

    ThreadPage.Viewing --> BoardPage.Init : openBoard | navigate /boards/:id
    %% verify: 點擊 breadcrumb 返回原所屬看板；board_id 與 thread.board_id 必須一致

    ThreadPage.Viewing --> SearchPage.Init : openSearch | navigate /search
    %% verify: 可從主題頁切到搜尋頁；不會把 hidden 主題內容帶入公開搜尋頁

    ThreadPage.Viewing --> ThreadPage.Participant.Init : openParticipantActions | navigate ThreadPage.Participant
    %% verify: User 以上才需要顯示互動區；Guest 不顯示 Reply/Like/Favorite/Report 的可提交入口

    ThreadPage.Viewing --> ThreadPage.Moderator.Init : openModerationTools | navigate ThreadPage.Moderator
    %% verify: 只有對應 board 的 Moderator 與 Admin 可見治理工具；其他角色不顯示 hide/restore/lock/unlock/pinned/featured 入口

    ThreadPage.Viewing --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 已登入使用者可從主題頁登出；登出後回到 Guest 導覽且原本治理或互動工具消失

    ThreadPage.Forbidden --> HomePage.Init : backHome | navigate /
    %% verify: 從無權限主題返回首頁後不會短暫顯示 hidden 內容；首頁仍為公開看板列表

    ThreadPage.NotFound --> BoardPage.Init : backBoard | navigate /boards/:id
    %% verify: 從不存在主題返回看板頁時不會引用錯誤 thread 資料；看板頁可正常重新載入

    ThreadPage.Failed --> ThreadPage.Init : retryThread | navigate /threads/:id
    %% verify: 重試會重新取得 thread detail 與 replies；成功後回到 Viewing，失敗則維持 Failed
```

## ⑦ Thread Page Participant Delta
此圖為 ThreadPage 的參與差異圖，描述 User / Moderator / Admin 在同一主題頁上的互動狀態。
```mermaid
%% role: User|Moderator|Admin
%% extends: ThreadPage
stateDiagram-v2
    [*] --> ThreadPage.Participant.Init : enterRoleDelta
    %% verify: 只有已登入角色會進入互動差異圖；Guest 不應看到可送出的回覆、按讚、收藏、檢舉表單

    ThreadPage.Participant.Init --> ThreadPage.Participant.Ready : showInteractiveThread
    %% verify: board.is_active=true 且 thread 非 locked；Reply、Like、Favorite、Report 入口依規格顯示且僅出現一次

    ThreadPage.Participant.Init --> ThreadPage.Participant.Locked : showLockedThread
    %% verify: thread.status=locked 時顯示鎖定提示；回覆入口禁用或隱藏，但 Like/Favorite/Report 仍可依規格使用

    ThreadPage.Participant.Init --> ThreadPage.Participant.InactiveBoard : showInactiveBoardThread
    %% verify: board.is_active=false 時主題內容可唯讀顯示；Like/Favorite/Report/Reply 全部禁用並提供停用原因

    ThreadPage.Participant.Ready --> ReplyFeature.Init : submitReply | navigate ReplyFeature
    %% verify: 只有已登入且 board 啟用且 thread 非 locked 才可進入回覆流程；送出前需帶正確 thread_id

    ThreadPage.Participant.Ready --> LikeFeature.Init : toggleLike | navigate LikeFeature
    %% verify: 僅已登入且 board 啟用時可切換 Like；target_type 必須為 thread 或 post 且與畫面目標一致

    ThreadPage.Participant.Ready --> FavoriteFeature.Init : toggleFavorite | navigate FavoriteFeature
    %% verify: 僅已登入且 board 啟用時可切換 Favorite；Favorite 僅允許 thread 目標，不可對 post 進行收藏

    ThreadPage.Participant.Ready --> ReportSubmissionFeature.Init : submitReport | navigate ReportSubmissionFeature
    %% verify: 只有可見內容才有檢舉入口；同一使用者對同一 target 不可重複建立 report

    ThreadPage.Participant.Ready --> ThreadPage.Init : closeParticipantActions | navigate /threads/:id
    %% verify: 關閉互動區後回到主題基本檢視；已載入的回覆與互動計數保持一致

    ThreadPage.Participant.Locked --> LikeFeature.Init : toggleLike | navigate LikeFeature
    %% verify: 鎖定主題仍可切換 Like；Like API 成功不應改變 thread.status 或解鎖狀態

    ThreadPage.Participant.Locked --> FavoriteFeature.Init : toggleFavorite | navigate FavoriteFeature
    %% verify: 鎖定主題仍可切換 Favorite；收藏狀態更新後仍維持 locked 標籤與回覆禁用狀態

    ThreadPage.Participant.Locked --> ReportSubmissionFeature.Init : submitReport | navigate ReportSubmissionFeature
    %% verify: 鎖定主題仍可檢舉可見內容；report 建立後狀態為 pending，不會解除主題鎖定

    ThreadPage.Participant.Locked --> ThreadPage.Init : closeParticipantActions | navigate /threads/:id
    %% verify: 關閉鎖定狀態互動區後回到主題頁；鎖定提示仍保留且回覆區維持禁用

    ThreadPage.Participant.InactiveBoard --> ThreadPage.Init : closeParticipantActions | navigate /threads/:id
    %% verify: 關閉停用看板提示後回到主題頁唯讀檢視；互動區仍全部禁用且不產生任何操作 API
```

## ⑧ Thread Page Moderator Delta
此圖為 ThreadPage 的治理差異圖，只描述 Moderator / Admin 在同一路由上的治理狀態。
```mermaid
%% role: Moderator|Admin
%% extends: ThreadPage
stateDiagram-v2
    [*] --> ThreadPage.Moderator.Init : enterRoleDelta
    %% verify: 只有對應看板 Moderator 與 Admin 可進入主題治理差異圖；scope 不符者不顯示治理按鈕且 API 回 403

    ThreadPage.Moderator.Init --> ThreadPage.Moderator.ToolsReady : showModerationTools
    %% verify: 顯示 hide/restore、lock/unlock、pinned/featured、檢舉處理等治理工具；可查看 hidden 內容以利治理

    ThreadPage.Moderator.Init --> ThreadPage.Moderator.Failed : loadModerationFailed
    %% verify: 治理工具資料載入失敗時顯示錯誤；不應將部分成功資料誤視為完整可操作狀態

    ThreadPage.Moderator.ToolsReady --> ThreadStatusFeature.Init : changeThreadStatus | navigate ThreadStatusFeature
    %% verify: 進入主題狀態治理流程時帶入正確 thread.status；僅允許規格定義的轉換路徑

    ThreadPage.Moderator.ToolsReady --> PostModerationFeature.Init : changePostVisibility | navigate PostModerationFeature
    %% verify: 進入回覆治理流程時 target post 必須隸屬當前 thread；隱藏後 Guest/User 應立即不可見

    ThreadPage.Moderator.ToolsReady --> PinThreadFeature.Init : togglePinned | navigate PinThreadFeature
    %% verify: 進入置頂流程時維持原有 thread.status；排序影響僅發生在所屬看板列表

    ThreadPage.Moderator.ToolsReady --> FeatureThreadFeature.Init : toggleFeatured | navigate FeatureThreadFeature
    %% verify: 進入精華流程時維持原有 thread.status；精華標記需同步反映在看板列表與主題頁

    ThreadPage.Moderator.ToolsReady --> ReportResolutionFeature.Init : resolveReport | navigate ReportResolutionFeature
    %% verify: 進入檢舉處理流程時只載入屬於該看板或該主題的 report；resolved_by/resolved_at 需在完成後寫入

    ThreadPage.Moderator.ToolsReady --> ThreadPage.Init : closeModerationTools | navigate /threads/:id
    %% verify: 關閉治理工具後回到主題頁基本檢視；已完成的治理結果需即時反映在內容與狀態標籤

    ThreadPage.Moderator.Failed --> ThreadPage.Init : closeModerationTools | navigate /threads/:id
    %% verify: 從治理工具錯誤狀態返回主題頁時，不應留下半成功的 UI 標記或錯誤按鈕狀態
```

## ⑨ New Thread Page
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> NewThreadPage.Init : enterPage
    %% verify: 進入 /threads/new 時需要有效 board_id；頁面先檢查登入與看板狀態，Guest 不應直接看到可送出表單

    NewThreadPage.Init --> LoginPage.Init : requireLogin | navigate /login
    %% verify: 未登入進入發文頁時導向 /login 並保留 returnTo；不顯示可提交的編輯表單

    NewThreadPage.Init --> NewThreadPage.Ready : showComposer
    %% verify: 已登入且 board.is_active=true 時顯示標題與內容表單；title 為必填，並提供「存草稿/發布」兩個動作

    NewThreadPage.Init --> NewThreadPage.Forbidden : rejectInactiveBoard
    %% verify: board.is_active=false 或 board 不允許發文時顯示 403 提示；Draft/Publish API 也必須拒絕同樣條件

    NewThreadPage.Init --> NewThreadPage.Failed : loadComposerFailed
    %% verify: 載入發文頁必要資料失敗時顯示錯誤與可重試入口；不應提交半完成表單

    NewThreadPage.Ready --> ThreadCreateFeature.Init : submitThreadForm | navigate ThreadCreateFeature
    %% verify: 點擊存草稿或發布時帶入 board_id、title、content；前端按鈕應防重送，後端以最終狀態為準

    NewThreadPage.Ready --> BoardPage.Init : cancelCompose | navigate /boards/:id
    %% verify: 取消發文後返回原看板；未發布內容不出現在公開列表，已存草稿則維持作者可見資料

    NewThreadPage.Forbidden --> BoardPage.Init : backBoard | navigate /boards/:id
    %% verify: 從不可發文狀態返回看板頁後，看板仍為唯讀或禁用互動狀態，不會誤顯示可發文 CTA

    NewThreadPage.Failed --> NewThreadPage.Init : retryComposer | navigate /threads/new
    %% verify: 重試會重新讀取 board 與表單必要資料；成功時回到 Ready，失敗則維持 Failed
```

## ⑩ Login Page
```mermaid
%% role: none
stateDiagram-v2
    [*] --> LoginPage.Init : enterPage
    %% verify: 進入 /login 時顯示登入頁初始狀態；若帶有 returnTo，參數需被保留且尚未建立 session

    LoginPage.Init --> LoginPage.Ready : showLoginForm
    %% verify: 顯示 email/password 欄位；Header 維持 Guest 導覽，不顯示後台或新增主題入口

    LoginPage.Init --> LoginPage.Failed : loadLoginFailed
    %% verify: 登入頁資源載入失敗時顯示錯誤與重試；不顯示可送出的殘缺表單

    LoginPage.Ready --> AuthLoginFeature.Init : submitLogin | navigate AuthLoginFeature
    %% verify: 送出登入時帶入正規化 email 與 password；按鈕需暫時禁用避免重送

    LoginPage.Ready --> RegisterPage.Init : openRegister | navigate /register
    %% verify: 可從登入頁切換到註冊頁；若有 returnTo，後續註冊成功後也能回到原目標頁

    LoginPage.Ready --> HomePage.Init : continueGuest | navigate /
    %% verify: 使用者可放棄登入回首頁；回首頁後仍是 Guest 導覽且不殘留登入錯誤訊息

    LoginPage.Failed --> LoginPage.Init : retryLoginPage | navigate /login
    %% verify: 重試登入頁會重新載入表單資源；成功後回到 Ready 並可再次送出
```

## ⑪ Register Page
```mermaid
%% role: none
stateDiagram-v2
    [*] --> RegisterPage.Init : enterPage
    %% verify: 進入 /register 時顯示註冊頁初始狀態；如有 returnTo 需保留供成功後回跳

    RegisterPage.Init --> RegisterPage.Ready : showRegisterForm
    %% verify: 顯示 email/password 欄位與至少 8 碼提示；Guest 導覽不應顯示新增主題或後台

    RegisterPage.Init --> RegisterPage.Failed : loadRegisterFailed
    %% verify: 註冊頁載入失敗時顯示錯誤與重試；不應送出不完整的表單資源

    RegisterPage.Ready --> AuthRegisterFeature.Init : submitRegister | navigate AuthRegisterFeature
    %% verify: 送出註冊時帶入正規化 email 與至少 8 碼 password；按鈕需暫時禁用避免重送

    RegisterPage.Ready --> LoginPage.Init : openLogin | navigate /login
    %% verify: 可從註冊頁切回登入頁；若原先有 returnTo，不應在切換時遺失

    RegisterPage.Ready --> HomePage.Init : continueGuest | navigate /
    %% verify: 可放棄註冊回首頁；回首頁後仍為 Guest 導覽且不保留註冊表單錯誤

    RegisterPage.Failed --> RegisterPage.Init : retryRegisterPage | navigate /register
    %% verify: 重試註冊頁會重新載入表單資源；成功後回到 Ready 並可重新送出
```

## ⑫ Admin Page
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminPage.Init : enterPage
    %% verify: 進入 /admin 時先檢查 session 與 role；非 Admin 不應看到後台內容或敏感操作資料

    AdminPage.Init --> LoginPage.Init : requireLogin | navigate /login
    %% verify: 未登入進入後台時導向 /login 並保留 returnTo=/admin；不顯示任何後台列表內容

    AdminPage.Init --> AdminPage.Ready : showAdminConsole
    %% verify: role=admin 時載入看板管理、Moderator 指派、使用者停權、檢舉與 Audit Log 區塊；敏感操作需可追溯

    AdminPage.Init --> AdminPage.Empty : showEmptyAdminData
    %% verify: 後台資料回 200 但目前無看板、無檢舉或無審計紀錄時顯示空狀態；空狀態仍可進行第一個建立動作

    AdminPage.Init --> AdminPage.Forbidden : rejectNonAdmin
    %% verify: 已登入但 role 非 admin 時顯示 403；Header 不顯示後台入口且不反覆導回登入頁

    AdminPage.Init --> AdminPage.Failed : loadAdminFailed
    %% verify: 後台資料載入失敗時顯示錯誤與重試；不顯示部分成功的敏感資料

    AdminPage.Ready --> BoardManagementFeature.Init : manageBoards | navigate BoardManagementFeature
    %% verify: 可進入看板建立/編輯/停用/排序流程；只有 Admin 可以看到這組操作

    AdminPage.Ready --> ModeratorAssignmentFeature.Init : manageModerators | navigate ModeratorAssignmentFeature
    %% verify: 可進入 Moderator 指派流程；指派目標需綁定指定 board，不是全域角色欄位

    AdminPage.Ready --> UserAccessFeature.Init : manageUsers | navigate UserAccessFeature
    %% verify: 可進入使用者 ban/unban 流程；成功後登入權限應立即生效

    AdminPage.Ready --> AdminReviewFeature.Init : reviewReportsAndAudit | navigate AdminReviewFeature
    %% verify: 可進入全站檢舉與 Audit Log 檢視流程；內容需包含 actor、action、target 與時間

    AdminPage.Ready --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: Admin 可從後台登出；登出後後台入口從 Header 消失，直接重整 /admin 應回到登入保護流程

    AdminPage.Empty --> BoardManagementFeature.Init : createFirstBoard | navigate BoardManagementFeature
    %% verify: 當無看板資料時可直接進入建立看板流程；成功建立後首頁應能依 sort_order 顯示新看板

    AdminPage.Empty --> LogoutFeature.Init : chooseLogout | navigate LogoutFeature
    %% verify: 空後台狀態下仍可登出；session 清除後回到 Guest 首頁

    AdminPage.Forbidden --> HomePage.Init : backHome | navigate /
    %% verify: 從 403 後台返回首頁後不會殘留任何後台區塊或敏感資料快取

    AdminPage.Failed --> AdminPage.Init : retryAdmin | navigate /admin
    %% verify: 重試後台會重新請求所有必要資料；成功後回到 Ready/Empty，失敗時維持 Failed
```

## ⑬ Auth Login Feature
Source Pages: LoginPage，以及所有受保護路由的 returnTo 入口。
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthLoginFeature.Init : enterFeature
    %% verify: 進入登入功能時建立登入流程上下文；若有 returnTo，需保留原目標路由供成功後回跳

    AuthLoginFeature.Init --> AuthLoginFeature.Editing : showCredentialsForm
    %% verify: 顯示可編輯的登入表單；尚未發出驗證請求，錯誤訊息區維持可清空狀態

    AuthLoginFeature.Editing --> AuthLoginFeature.Submitting : submitCredentials
    %% verify: 送出登入請求時 email 需 trim 並轉小寫；按鈕禁用避免重送，並送往登入 API

    AuthLoginFeature.Submitting --> AuthLoginFeature.Done : authenticateSuccess
    %% verify: login API 回 200 並設定 HttpOnly session cookie；回傳使用者 role 與 is_banned=false，登入狀態可被後續頁面識別

    AuthLoginFeature.Submitting --> AuthLoginFeature.Failed : rejectCredentials
    %% verify: login API 回 400/401 時顯示明確帳密錯誤；不建立 session cookie 且不更新 Header 為已登入狀態

    AuthLoginFeature.Submitting --> AuthLoginFeature.Banned : rejectBannedUser
    %% verify: is_banned=true 時 login API 回 403 並顯示停權訊息；不建立 session cookie 且不可繞過登入限制

    AuthLoginFeature.Failed --> LoginPage.Init : retryLogin | navigate /login
    %% verify: 返回登入頁後保留原先 returnTo；錯誤訊息可重新顯示但不自動清除使用者輸入以外的上下文

    AuthLoginFeature.Banned --> LoginPage.Init : acknowledgeBan | navigate /login
    %% verify: 返回登入頁後保留「帳號已停權」訊息；重試登入仍會被拒絕直到 Admin 解除停權

    AuthLoginFeature.Done --> HomePage.Init : returnHome | navigate /
    %% verify: 無 returnTo 時回首頁；Header 依角色更新為 User/Moderator/Admin 導覽，Guest 導覽項消失

    AuthLoginFeature.Done --> SearchPage.Init : returnSearch | navigate /search
    %% verify: 若 returnTo=/search，登入成功後回到搜尋頁；原查詢上下文可重新建立且不顯示 Guest 專屬導覽

    AuthLoginFeature.Done --> BoardPage.Init : returnBoard | navigate /boards/:id
    %% verify: 若 returnTo 為看板頁，登入成功後回到原看板；User 以上在啟用看板可看到新增主題 CTA

    AuthLoginFeature.Done --> ThreadPage.Init : returnThread | navigate /threads/:id
    %% verify: 若 returnTo 為主題頁，登入成功後回到原主題；互動區依 board 狀態與 thread 鎖定狀態正確顯示

    AuthLoginFeature.Done --> NewThreadPage.Init : returnComposer | navigate /threads/new
    %% verify: 若 returnTo 為發文頁且 board 仍啟用，登入後回到發文表單；若 board 已停用則在後續頁面收斂為 Forbidden

    AuthLoginFeature.Done --> AdminPage.Init : returnAdmin | navigate /admin
    %% verify: 只有 admin 身分可成功進入 /admin；若登入者不是 admin，後續頁面必須收斂為 Forbidden 而非錯誤放行
```

## ⑭ Auth Register Feature
Source Pages: RegisterPage，以及所有允許 Guest 先進入後再完成註冊的公開頁。
```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthRegisterFeature.Init : enterFeature
    %% verify: 進入註冊功能時建立註冊流程上下文；若有 returnTo，需保留供成功後回跳

    AuthRegisterFeature.Init --> AuthRegisterFeature.Editing : showRegistrationForm
    %% verify: 顯示可編輯的註冊表單；email/password 欄位可輸入且尚未建立帳號

    AuthRegisterFeature.Editing --> AuthRegisterFeature.Submitting : submitRegistration
    %% verify: 送出註冊時 email 需 trim 並轉小寫，password 至少 8 碼；按鈕禁用避免重送

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.Done : createAccount
    %% verify: register API 回 200，建立唯一 email 的帳號並以 bcrypt 儲存密碼；同時建立 HttpOnly session cookie 直接登入

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.Failed : rejectRegistration
    %% verify: register API 回 400/409 時顯示格式錯誤或 Email 已被使用；不建立帳號、不建立 session cookie

    AuthRegisterFeature.Failed --> RegisterPage.Init : retryRegister | navigate /register
    %% verify: 返回註冊頁後可修正欄位重送；原 returnTo 仍被保留且錯誤訊息可重新顯示

    AuthRegisterFeature.Done --> HomePage.Init : returnHome | navigate /
    %% verify: 無 returnTo 時註冊成功後回首頁並呈現已登入導覽；Guest 導覽項消失

    AuthRegisterFeature.Done --> SearchPage.Init : returnSearch | navigate /search
    %% verify: 有 returnTo=/search 時註冊成功後回搜尋頁；Header 轉為已登入狀態且不重複顯示登入/註冊 CTA

    AuthRegisterFeature.Done --> BoardPage.Init : returnBoard | navigate /boards/:id
    %% verify: 有 returnTo 為看板頁時註冊成功後回原看板；若看板啟用則可使用新增主題 CTA

    AuthRegisterFeature.Done --> ThreadPage.Init : returnThread | navigate /threads/:id
    %% verify: 有 returnTo 為主題頁時註冊成功後回原主題；互動區會依目前 thread 與 board 規則正確顯示

    AuthRegisterFeature.Done --> NewThreadPage.Init : returnComposer | navigate /threads/new
    %% verify: 有 returnTo 為發文頁時註冊成功後回表單頁；board 若已停用則在後續頁面正確收斂為 Forbidden
```

## ⑮ Logout Feature
Source Pages: HomePage, SearchPage, BoardPage, ThreadPage, AdminPage。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> LogoutFeature.Init : enterFeature
    %% verify: 只有已登入角色可進入登出流程；Guest 不顯示登出入口且不應呼叫 logout API

    LogoutFeature.Init --> LogoutFeature.Submitting : requestLogout
    %% verify: 送出 logout API 時帶有效 session；前端可暫時禁用登出按鈕避免重複請求

    LogoutFeature.Submitting --> LogoutFeature.Done : clearSession
    %% verify: logout API 回 200 並清除 HttpOnly session cookie；目前使用者資訊與已登入導覽立即失效

    LogoutFeature.Done --> HomePage.Init : returnGuestHome | navigate /
    %% verify: 回到首頁後 Header 只顯示 Guest 導覽；後台、治理、我的內容與登出入口全部消失
```

## ⑯ Thread Create Feature
Source Pages: NewThreadPage。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> ThreadCreateFeature.Init : enterFeature
    %% verify: 進入發文功能時建立本次表單上下文；board_id 必須存在且對應有效看板

    ThreadCreateFeature.Init --> ThreadCreateFeature.Editing : openThreadForm
    %% verify: 顯示標題與內容編輯狀態；title 為必填，content 可為空，尚未建立 thread 記錄

    ThreadCreateFeature.Editing --> ThreadCreateFeature.DraftSaved : saveDraft
    %% verify: create thread API 回 200 且 thread.status=draft；草稿只對作者與治理角色可見，不出現在公開看板列表

    ThreadCreateFeature.Editing --> ThreadCreateFeature.Published : publishThread
    %% verify: publish API 回 200 且 thread.status=published；新主題出現在所屬看板列表並帶正確 board_id、user_id

    ThreadCreateFeature.Editing --> ThreadCreateFeature.Failed : rejectSubmission
    %% verify: 驗證失敗、board 停用或伺服器錯誤時顯示錯誤；表單內容保留且不產生重複 thread 記錄

    ThreadCreateFeature.DraftSaved --> ThreadCreateFeature.Editing : continueEditing
    %% verify: 繼續編輯草稿時載回既有 draft 內容；updated_at 會依保存更新且作者維持相同

    ThreadCreateFeature.DraftSaved --> ThreadCreateFeature.Published : publishSavedDraft
    %% verify: draft→published 為合法轉換；發布後 thread 從作者私有草稿變為公開可見主題

    ThreadCreateFeature.Failed --> NewThreadPage.Init : retryThreadForm | navigate /threads/new
    %% verify: 返回發文頁後保留 board_id 與輸入內容；使用者可修正後再次送出

    ThreadCreateFeature.Published --> ThreadPage.Init : openPublishedThread | navigate /threads/:id
    %% verify: 發布成功後導向新主題頁；主題 detail API 可立即讀到最新 title、content、status=published
```

## ⑰ Reply Feature
Source Pages: ThreadPage.Participant。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> ReplyFeature.Init : enterFeature
    %% verify: 進入回覆功能時帶入正確 thread_id；只有已登入且 thread 可回覆時才會顯示此流程

    ReplyFeature.Init --> ReplyFeature.Editing : openReplyEditor
    %% verify: 顯示可編輯回覆輸入框；既有主題內容保持可見，不建立新 post 記錄

    ReplyFeature.Editing --> ReplyFeature.Submitting : submitReply
    %% verify: 送出回覆時需帶 thread_id、content 與目前登入 user_id；按鈕禁用避免重送

    ReplyFeature.Submitting --> ReplyFeature.Done : createReply
    %% verify: create post API 回 200 且 post.status=visible；新回覆加入目前主題列表並屬於正確作者

    ReplyFeature.Submitting --> ReplyFeature.Failed : rejectReply
    %% verify: 若 thread 已 locked、board 已停用或內容驗證失敗，API 回 403/400；不建立 post 記錄且輸入內容保留

    ReplyFeature.Failed --> ThreadPage.Participant.Init : retryReply | navigate ThreadPage.Participant
    %% verify: 返回互動區後可再次編輯回覆；錯誤原因保持可見且未產生重複回覆

    ReplyFeature.Done --> ThreadPage.Init : returnThread | navigate /threads/:id
    %% verify: 回到主題頁後新回覆立即可見並與後端資料一致；reply count 或列表長度同步更新
```

## ⑱ Like Feature
Source Pages: ThreadPage.Participant。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> LikeFeature.Init : enterFeature
    %% verify: 進入 Like 功能時帶入 target_type 與 target_id；未登入或停用看板狀態不應進入此功能

    LikeFeature.Init --> LikeFeature.ReadyUnliked : showUnlikedState
    %% verify: API 回傳目前使用者對此目標尚未按讚；UI 顯示未按讚狀態與可操作按鈕

    LikeFeature.Init --> LikeFeature.ReadyLiked : showLikedState
    %% verify: API 回傳目前使用者已對此目標按讚；UI 顯示已按讚狀態與取消按讚操作

    LikeFeature.ReadyUnliked --> LikeFeature.DoneLiked : applyLike
    %% verify: like API 回 200 並建立 user_id+target_type+target_id 唯一記錄；重複點擊不得產生第二筆 like

    LikeFeature.ReadyLiked --> LikeFeature.DoneUnliked : removeLike
    %% verify: unlike API 回 200 並刪除既有 like 記錄；重複 unlike 需保持冪等而非報錯

    LikeFeature.DoneLiked --> ThreadPage.Participant.Init : returnLikedState | navigate ThreadPage.Participant
    %% verify: 返回互動區後按讚數與 is_liked=true 同步；畫面狀態以後端最終結果為準

    LikeFeature.DoneUnliked --> ThreadPage.Participant.Init : returnUnlikedState | navigate ThreadPage.Participant
    %% verify: 返回互動區後按讚數與 is_liked=false 同步；不應殘留 optimistic 更新造成的錯誤計數
```

## ⑲ Favorite Feature
Source Pages: ThreadPage.Participant。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> FavoriteFeature.Init : enterFeature
    %% verify: 進入 Favorite 功能時 target 必須是 thread；未登入或停用看板狀態不應進入此功能

    FavoriteFeature.Init --> FavoriteFeature.ReadyUnfavorited : showUnfavoritedState
    %% verify: API 回傳目前使用者尚未收藏此 thread；UI 顯示未收藏狀態

    FavoriteFeature.Init --> FavoriteFeature.ReadyFavorited : showFavoritedState
    %% verify: API 回傳目前使用者已收藏此 thread；UI 顯示已收藏狀態

    FavoriteFeature.ReadyUnfavorited --> FavoriteFeature.DoneFavorited : applyFavorite
    %% verify: favorite API 回 200 並建立 user_id+thread_id 唯一記錄；不可對同一 thread 建立重複 favorite

    FavoriteFeature.ReadyFavorited --> FavoriteFeature.DoneUnfavorited : removeFavorite
    %% verify: unfavorite API 回 200 並刪除既有 favorite；重複取消收藏需保持冪等

    FavoriteFeature.DoneFavorited --> ThreadPage.Participant.Init : returnFavoritedState | navigate ThreadPage.Participant
    %% verify: 返回互動區後 is_favorited=true 與收藏數狀態同步；其他 thread 不受影響

    FavoriteFeature.DoneUnfavorited --> ThreadPage.Participant.Init : returnUnfavoritedState | navigate ThreadPage.Participant
    %% verify: 返回互動區後 is_favorited=false 與收藏數狀態同步；不殘留舊的收藏標記
```

## ⑳ Report Submission Feature
Source Pages: ThreadPage.Participant。
```mermaid
%% role: User|Moderator|Admin
stateDiagram-v2
    [*] --> ReportSubmissionFeature.Init : enterFeature
    %% verify: 進入檢舉功能時只允許針對目前可見的 thread 或 post；Guest 與停用看板不應進入此功能

    ReportSubmissionFeature.Init --> ReportSubmissionFeature.Editing : openReportForm
    %% verify: 顯示 reason 欄位與 target 資訊；表單只對目前目標建立單一檢舉流程

    ReportSubmissionFeature.Editing --> ReportSubmissionFeature.Pending : submitReport
    %% verify: report API 回 200 且建立 status=pending 的報告；寫入 reporter_id、target_type、target_id、reason

    ReportSubmissionFeature.Editing --> ReportSubmissionFeature.Duplicate : blockDuplicateReport
    %% verify: 若 reporter_id+target_type+target_id 已存在，API 回重複檢舉錯誤；不建立第二筆 report

    ReportSubmissionFeature.Editing --> ReportSubmissionFeature.Failed : rejectReportSubmission
    %% verify: 驗證失敗或伺服器錯誤時顯示錯誤；不建立 report 且表單內容保留

    ReportSubmissionFeature.Pending --> ThreadPage.Init : returnThread | navigate /threads/:id
    %% verify: 回到主題頁後顯示已送出檢舉狀態；同一目標的檢舉入口需反映不可重複提交

    ReportSubmissionFeature.Duplicate --> ThreadPage.Participant.Init : acknowledgeDuplicate | navigate ThreadPage.Participant
    %% verify: 返回互動區後顯示已檢舉提示；畫面不再提供重複提交動作

    ReportSubmissionFeature.Failed --> ThreadPage.Participant.Init : retryReport | navigate ThreadPage.Participant
    %% verify: 返回互動區後可重新開啟檢舉表單；失敗不影響原內容顯示與其他互動狀態
```

## ㉑ Thread Status Feature
Source Pages: BoardPage.Moderator, ThreadPage.Moderator。
```mermaid
%% role: Moderator|Admin
stateDiagram-v2
    [*] --> ThreadStatusFeature.Init : enterFeature
    %% verify: 進入主題治理功能時帶入當前 thread.status 與所屬 board scope；只有 Moderator/Admin 可操作

    ThreadStatusFeature.Init --> ThreadStatusFeature.Published : inspectPublishedThread
    %% verify: 目標 thread.status=published；Guest/User 可見該主題，且目前可被治理為 hidden 或 locked

    ThreadStatusFeature.Init --> ThreadStatusFeature.Hidden : inspectHiddenThread
    %% verify: 目標 thread.status=hidden；只有對應 board Moderator 與 Admin 可見，搜尋結果不得帶出此主題

    ThreadStatusFeature.Init --> ThreadStatusFeature.Locked : inspectLockedThread
    %% verify: 目標 thread.status=locked；內容仍可見但新增回覆與作者編輯主題操作皆應被阻擋

    ThreadStatusFeature.Published --> ThreadStatusFeature.Hidden : hideThread
    %% verify: hide API 回 200 並將 thread.status 更新為 hidden；Guest/User 立即不可見，搜尋結果同步排除，Audit Log 記錄 thread.hide

    ThreadStatusFeature.Hidden --> ThreadStatusFeature.Published : restoreThread
    %% verify: restore API 回 200 並將 thread.status 更新為 published；公開列表與搜尋可再次看到此主題，Audit Log 記錄 thread.restore

    ThreadStatusFeature.Published --> ThreadStatusFeature.Locked : lockThread
    %% verify: lock API 回 200 並將 thread.status 更新為 locked；reply API 對一般使用者改回 403，Audit Log 記錄 thread.lock

    ThreadStatusFeature.Locked --> ThreadStatusFeature.Published : unlockThread
    %% verify: unlock API 回 200 並將 thread.status 更新為 published；回覆入口恢復可用，Audit Log 記錄 thread.unlock

    ThreadStatusFeature.Published --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後，該主題的最新狀態標籤已同步更新在治理列表與看板列表

    ThreadStatusFeature.Published --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後，主題頁狀態標籤與可用治理按鈕已同步反映最新 published 狀態

    ThreadStatusFeature.Hidden --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後 hidden 主題僅留在治理視角可見；一般列表視角不再向 Guest/User 顯示

    ThreadStatusFeature.Hidden --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後 hidden 標籤與恢復動作可見；一般互動入口對 Guest/User 不可見

    ThreadStatusFeature.Locked --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後 locked 標籤已同步；看板內仍可瀏覽但回覆受限

    ThreadStatusFeature.Locked --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後 locked 狀態已生效；主題頁回覆區維持禁用直到解鎖
```

## ㉒ Post Moderation Feature
Source Pages: BoardPage.Moderator, ThreadPage.Moderator。
```mermaid
%% role: Moderator|Admin
stateDiagram-v2
    [*] --> PostModerationFeature.Init : enterFeature
    %% verify: 進入回覆治理功能時帶入正確 post_id、thread_id 與 board scope；只有對應 Moderator/Admin 可操作

    PostModerationFeature.Init --> PostModerationFeature.Visible : inspectVisiblePost
    %% verify: 目標 post.status=visible；Guest/User 目前可在主題頁看到該回覆

    PostModerationFeature.Init --> PostModerationFeature.Hidden : inspectHiddenPost
    %% verify: 目標 post.status=hidden；Guest/User 不可見，只有 Moderator/Admin 可在治理視角查看

    PostModerationFeature.Visible --> PostModerationFeature.Hidden : hidePost
    %% verify: hide post API 回 200 並將 post.status 更新為 hidden；Guest/User 立即看不到該回覆，Audit Log 記錄 post.hide

    PostModerationFeature.Hidden --> PostModerationFeature.Visible : restorePost
    %% verify: restore post API 回 200 並將 post.status 更新為 visible；主題頁回覆列表重新可見，Audit Log 記錄 post.restore

    PostModerationFeature.Visible --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後，該回覆的可見性狀態已同步於治理列表

    PostModerationFeature.Visible --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後，該回覆仍處於 visible 並可再執行 hide 操作

    PostModerationFeature.Hidden --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後 hidden 回覆只在治理視角可見；一般使用者視角不可見

    PostModerationFeature.Hidden --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後 hidden 回覆保留 restore 入口；一般回覆列表不顯示該項目
```

## ㉓ Pin Thread Feature
Source Pages: BoardPage.Moderator, ThreadPage.Moderator。
```mermaid
%% role: Moderator|Admin
stateDiagram-v2
    [*] --> PinThreadFeature.Init : enterFeature
    %% verify: 進入置頂功能時帶入正確 thread_id 與 board_id；只有對應 Moderator/Admin 可操作

    PinThreadFeature.Init --> PinThreadFeature.Unpinned : inspectUnpinnedThread
    %% verify: 目前 thread.is_pinned=false；看板列表排序未置頂

    PinThreadFeature.Init --> PinThreadFeature.Pinned : inspectPinnedThread
    %% verify: 目前 thread.is_pinned=true；看板列表該主題優先顯示於一般主題之前

    PinThreadFeature.Unpinned --> PinThreadFeature.Pinned : pinThread
    %% verify: pin API 回 200 並將 is_pinned 更新為 true；僅影響排序，不改變 thread.status，Audit Log 記錄 thread.pin

    PinThreadFeature.Pinned --> PinThreadFeature.Unpinned : unpinThread
    %% verify: unpin API 回 200 並將 is_pinned 更新為 false；主題排序恢復一般規則，Audit Log 記錄 thread.unpin

    PinThreadFeature.Pinned --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後 pinned 標記與排序結果已同步顯示

    PinThreadFeature.Pinned --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後 pinned 標記已同步於主題頁，且不影響其他治理操作

    PinThreadFeature.Unpinned --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後主題已依一般排序顯示；置頂標記消失

    PinThreadFeature.Unpinned --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後 unpinned 狀態已同步；頁面不保留舊的置頂徽章
```

## ㉔ Feature Thread Feature
Source Pages: BoardPage.Moderator, ThreadPage.Moderator。
```mermaid
%% role: Moderator|Admin
stateDiagram-v2
    [*] --> FeatureThreadFeature.Init : enterFeature
    %% verify: 進入精華功能時帶入正確 thread_id 與 board scope；只有對應 Moderator/Admin 可操作

    FeatureThreadFeature.Init --> FeatureThreadFeature.Unfeatured : inspectUnfeaturedThread
    %% verify: 目前 thread.is_featured=false；看板與主題頁均不顯示精華標記

    FeatureThreadFeature.Init --> FeatureThreadFeature.Featured : inspectFeaturedThread
    %% verify: 目前 thread.is_featured=true；看板與主題頁均顯示精華標記

    FeatureThreadFeature.Unfeatured --> FeatureThreadFeature.Featured : featureThread
    %% verify: feature API 回 200 並將 is_featured 更新為 true；不改變 thread.status，Audit Log 記錄 thread.feature

    FeatureThreadFeature.Featured --> FeatureThreadFeature.Unfeatured : unfeatureThread
    %% verify: unfeature API 回 200 並將 is_featured 更新為 false；精華標記同步移除，Audit Log 記錄 thread.unfeature

    FeatureThreadFeature.Featured --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後精華標記已同步顯示於該主題

    FeatureThreadFeature.Featured --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後精華標記已同步顯示於主題頁且不影響回覆或狀態機

    FeatureThreadFeature.Unfeatured --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後精華標記消失；其他排序與狀態維持原規則

    FeatureThreadFeature.Unfeatured --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後主題頁不再顯示精華標記；資料與後端一致
```

## ㉕ Report Resolution Feature
Source Pages: BoardPage.Moderator, ThreadPage.Moderator, AdminReviewFeature。
```mermaid
%% role: Moderator|Admin
stateDiagram-v2
    [*] --> ReportResolutionFeature.Init : enterFeature
    %% verify: 進入檢舉處理功能時帶入正確 report_id 與 target 資訊；只有 Moderator/Admin 可操作，且 Moderator 受 board scope 限制

    ReportResolutionFeature.Init --> ReportResolutionFeature.Pending : openReport
    %% verify: 載入 pending 報告內容成功；顯示 reason、target_type、target_id、reporter 與目前狀態 pending

    ReportResolutionFeature.Init --> ReportResolutionFeature.Failed : loadReportFailed
    %% verify: 報告載入失敗時顯示錯誤；不顯示不完整的 target 資料或誤導性的處理按鈕

    ReportResolutionFeature.Pending --> ReportResolutionFeature.Accepted : acceptReport
    %% verify: accept API 回 200 並將 report.status=accepted，寫入 resolved_by/resolved_at；若 target 是 thread 或 post，對應內容依規格被 hidden，Audit Log 記錄 report.accept

    ReportResolutionFeature.Pending --> ReportResolutionFeature.Rejected : rejectReport
    %% verify: reject API 回 200 並將 report.status=rejected，寫入 resolved_by/resolved_at；內容狀態保持不變，Audit Log 記錄 report.reject

    ReportResolutionFeature.Accepted --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後該報告不再列為 pending；對應內容隱藏狀態已同步顯示

    ReportResolutionFeature.Accepted --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後報告狀態為 accepted，且 target 內容已依規格改為 hidden

    ReportResolutionFeature.Accepted --> AdminReviewFeature.Init : backAdminReview | navigate AdminReviewFeature
    %% verify: 回到後台檢舉檢視時該報告已顯示為 accepted，並可在 Audit Log 查到處理紀錄

    ReportResolutionFeature.Rejected --> BoardPage.Moderator.Init : backBoardGovernance | navigate BoardPage.Moderator
    %% verify: 回到看板治理面板後該報告不再列為 pending；target 內容保持原可見狀態

    ReportResolutionFeature.Rejected --> ThreadPage.Moderator.Init : backThreadGovernance | navigate ThreadPage.Moderator
    %% verify: 回到主題治理工具後報告狀態為 rejected，且 target 內容未被額外隱藏或修改

    ReportResolutionFeature.Rejected --> AdminReviewFeature.Init : backAdminReview | navigate AdminReviewFeature
    %% verify: 回到後台檢舉檢視時該報告已顯示為 rejected，並可在 Audit Log 查到處理紀錄

    ReportResolutionFeature.Failed --> BoardPage.Moderator.Init : closeReportResolution | navigate BoardPage.Moderator
    %% verify: 報告載入失敗時可返回治理面板；未成功載入前不得對 report 狀態或 target 內容做任何修改
```

## ㉖ Board Management Feature
Source Pages: AdminPage。
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> BoardManagementFeature.Init : enterFeature
    %% verify: 進入看板管理功能時只允許 Admin；載入現有 boards 與 sort_order 供管理使用

    BoardManagementFeature.Init --> BoardManagementFeature.Listing : openBoardManager
    %% verify: boards 管理列表載入成功；可查看 name、description、is_active、sort_order 並準備編輯

    BoardManagementFeature.Init --> BoardManagementFeature.Failed : loadBoardManagerFailed
    %% verify: 載入看板管理失敗時顯示錯誤與返回；不顯示不完整的管理列表

    BoardManagementFeature.Listing --> BoardManagementFeature.Editing : editBoard
    %% verify: 進入建立或編輯看板流程時可修改 name、description、is_active、sort_order；只有 Admin 可操作

    BoardManagementFeature.Editing --> BoardManagementFeature.Listing : saveBoard
    %% verify: board create/update API 回 200；變更後的欄位正確保存並立即反映於列表，Audit Log 記錄 board.create 或 board.update

    BoardManagementFeature.Listing --> BoardManagementFeature.Reordering : reorderBoards
    %% verify: 可調整多個看板的 sort_order；排序編輯模式啟用且不改變 board 其他欄位

    BoardManagementFeature.Reordering --> BoardManagementFeature.Listing : applyBoardOrder
    %% verify: 排序 API 回 200；首頁與管理列表都依新的 sort_order 顯示，Audit Log 記錄 board.reorder

    BoardManagementFeature.Listing --> BoardManagementFeature.Deactivating : deactivateBoard
    %% verify: 可對看板執行停用或重新啟用流程；只有 Admin 可操作且需帶正確 board_id

    BoardManagementFeature.Deactivating --> BoardManagementFeature.Listing : confirmBoardStatus
    %% verify: is_active 更新成功；停用後新增 Thread/Post 與互動被禁止，但既有內容可唯讀瀏覽，Audit Log 記錄 board.deactivate 或 board.activate

    BoardManagementFeature.Listing --> AdminPage.Init : closeBoardManager | navigate /admin
    %% verify: 關閉看板管理後回後台主頁；最新的 boards 狀態與排序已同步顯示

    BoardManagementFeature.Failed --> AdminPage.Init : closeBoardManager | navigate /admin
    %% verify: 載入失敗後返回後台主頁；不保留半成功的編輯狀態
```

## ㉗ Moderator Assignment Feature
Source Pages: AdminPage。
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> ModeratorAssignmentFeature.Init : enterFeature
    %% verify: 進入 Moderator 指派功能時只允許 Admin；需載入 board 與候選 user 資料

    ModeratorAssignmentFeature.Init --> ModeratorAssignmentFeature.Unassigned : reviewUnassignedUser
    %% verify: 顯示尚未被指派到指定看板的使用者；該使用者在該看板不應看到治理面板，治理 API 回 403

    ModeratorAssignmentFeature.Init --> ModeratorAssignmentFeature.Assigned : reviewAssignedModerator
    %% verify: 顯示已被指派到指定看板的 Moderator；該使用者在該看板可看到治理面板與治理工具

    ModeratorAssignmentFeature.Init --> ModeratorAssignmentFeature.Failed : loadAssignmentsFailed
    %% verify: 載入指派資料失敗時顯示錯誤；不顯示不完整的 board-user 關聯資料

    ModeratorAssignmentFeature.Unassigned --> ModeratorAssignmentFeature.Assigned : assignModerator
    %% verify: assign API 回 200 並建立 ModeratorAssignment；board_id+user_id 唯一約束生效，Audit Log 記錄 moderator.assign

    ModeratorAssignmentFeature.Assigned --> ModeratorAssignmentFeature.Unassigned : removeModerator
    %% verify: remove assignment API 回 200 並刪除或停用指派；該使用者立即失去該看板治理權限，Audit Log 記錄 moderator.remove

    ModeratorAssignmentFeature.Assigned --> AdminPage.Init : closeAssignmentManager | navigate /admin
    %% verify: 返回後台主頁後，該看板的 Moderator 清單已更新且與 API 資料一致

    ModeratorAssignmentFeature.Unassigned --> AdminPage.Init : closeAssignmentManager | navigate /admin
    %% verify: 返回後台主頁後，未指派清單狀態保留最新結果且未誤產生指派紀錄

    ModeratorAssignmentFeature.Failed --> AdminPage.Init : closeAssignmentManager | navigate /admin
    %% verify: 載入失敗後返回後台主頁；不應有任何指派資料被部分寫入
```

## ㉘ User Access Feature
Source Pages: AdminPage。
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> UserAccessFeature.Init : enterFeature
    %% verify: 進入使用者權限管理功能時只允許 Admin；需載入目標使用者目前 is_banned 狀態

    UserAccessFeature.Init --> UserAccessFeature.ActiveUser : reviewActiveUser
    %% verify: 目標使用者 is_banned=false；目前可登入且不顯示停權狀態

    UserAccessFeature.Init --> UserAccessFeature.BannedUser : reviewBannedUser
    %% verify: 目標使用者 is_banned=true；登入時應被拒絕並顯示明確停權訊息

    UserAccessFeature.Init --> UserAccessFeature.Failed : loadUserAccessFailed
    %% verify: 載入使用者資料失敗時顯示錯誤；不顯示不完整的使用者狀態資訊

    UserAccessFeature.ActiveUser --> UserAccessFeature.BannedUser : banUser
    %% verify: ban API 回 200 並將 is_banned 設為 true；後續登入 API 回 403，Audit Log 記錄 user.ban

    UserAccessFeature.BannedUser --> UserAccessFeature.ActiveUser : unbanUser
    %% verify: unban API 回 200 並將 is_banned 設為 false；後續可正常登入，Audit Log 記錄 user.unban

    UserAccessFeature.ActiveUser --> AdminPage.Init : closeUserAccess | navigate /admin
    %% verify: 返回後台主頁後，使用者狀態顯示為可登入；不殘留舊的停權標記

    UserAccessFeature.BannedUser --> AdminPage.Init : closeUserAccess | navigate /admin
    %% verify: 返回後台主頁後，使用者狀態顯示為停權中；登入保護規則已生效

    UserAccessFeature.Failed --> AdminPage.Init : closeUserAccess | navigate /admin
    %% verify: 載入失敗後返回後台主頁；不應誤改任何使用者狀態
```

## ㉙ Admin Review Feature
Source Pages: AdminPage。
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminReviewFeature.Init : enterFeature
    %% verify: 進入全站檢舉與審計檢視功能時只允許 Admin；需載入 reports 與 audit logs 相關資料

    AdminReviewFeature.Init --> AdminReviewFeature.ReportsView : openReports
    %% verify: 載入全站 reports 成功；可按 pending/accepted/rejected 檢視，且資料包含 target 與處理欄位

    AdminReviewFeature.Init --> AdminReviewFeature.AuditView : openAuditLog
    %% verify: 載入 Audit Log 成功；每筆紀錄包含 actor、action、target_type、target_id、metadata、created_at

    AdminReviewFeature.Init --> AdminReviewFeature.Empty : showNoReportsOrLogs
    %% verify: 當暫無 reports 與 audit logs 時顯示空狀態；不顯示不存在的紀錄列

    AdminReviewFeature.Init --> AdminReviewFeature.Failed : loadReviewFailed
    %% verify: 載入 reports 或 audit logs 失敗時顯示錯誤；不顯示部分成功的敏感資料

    AdminReviewFeature.ReportsView --> ReportResolutionFeature.Init : escalateOrResolveReport | navigate ReportResolutionFeature
    %% verify: Admin 可從全站檢舉列表進入處理流程；不受單一看板 scope 限制但仍需帶正確 report_id

    AdminReviewFeature.ReportsView --> AdminReviewFeature.AuditView : openAuditLog
    %% verify: 從檢舉檢視切到 Audit Log 時保留後台權限上下文；不遺失目前已處理的 report 狀態

    AdminReviewFeature.AuditView --> AdminReviewFeature.ReportsView : openReports
    %% verify: 從 Audit Log 切回 reports 時可重新看到最新的處理狀態；accepted/rejected 變更需已同步

    AdminReviewFeature.ReportsView --> AdminPage.Init : closeReviewCenter | navigate /admin
    %% verify: 關閉檢舉檢視後返回後台主頁；最新 report 狀態已同步在摘要區塊中

    AdminReviewFeature.AuditView --> AdminPage.Init : closeReviewCenter | navigate /admin
    %% verify: 關閉 Audit Log 檢視後返回後台主頁；不保留錯誤的篩選或頁面殘影

    AdminReviewFeature.Empty --> AdminPage.Init : closeReviewCenter | navigate /admin
    %% verify: 從空狀態返回後台主頁後仍可進行其他管理功能；不顯示虛構資料

    AdminReviewFeature.Failed --> AdminPage.Init : closeReviewCenter | navigate /admin
    %% verify: 載入失敗後返回後台主頁；不應誤認為沒有 reports 或 audit logs
```