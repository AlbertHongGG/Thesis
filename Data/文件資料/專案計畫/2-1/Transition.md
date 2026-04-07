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
    %% verify: 進站後只顯示公開入口選項；Header 依未登入狀態僅可見課程列表、登入、註冊，不可出現我的課程、教師入口、管理後台入口。

    Entry.Init --> HomePage.Init : continueAsGuest | navigate /
    %% verify: 導向首頁成功且不要求 session；首頁以 Guest 視角呈現公開內容，沒有重複的登入或註冊 CTA。

    Entry.Init --> CoursesListPage.Init : browseCourses | navigate /courses
    %% verify: 導向 /courses 成功且課程列表 API 只回傳 published 課程；列表卡片顯示封面、標題、價格、分類。

    Entry.Init --> LoginPage.Init : chooseLogin | navigate /login
    %% verify: 導向 /login 成功並顯示 Email/Password 表單；頁面內不重複渲染 Header 已提供的登入入口。

    Entry.Init --> RegisterPage.Init : chooseRegister | navigate /register
    %% verify: 導向 /register 成功並顯示註冊表單；頁面內不重複渲染 Header 已提供的註冊入口。
```

---

## ② Home Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> HomePage.Init : enterPage
    %% verify: 進入首頁時 route 可被 Guest、Student、Instructor、Admin 存取；Header 只顯示各角色允許的導覽項目。

    HomePage.Init --> HomePage.Ready : showHome
    %% verify: 首頁內容完成載入後顯示公開入口與精選內容；主要 CTA 位於頁面主內容區而非重複出現在 Header。

    HomePage.Ready --> CoursesListPage.Init : browseCourses | navigate /courses
    %% verify: 點擊課程入口導向 /courses 成功；頁面維持公開瀏覽能力且不要求登入。

    HomePage.Ready --> LoginPage.Init : chooseLogin | navigate /login
    %% verify: Guest 點擊登入可進入登入頁；已登入使用者不應再看到第二顆登入按鈕或重複登入入口。

    HomePage.Ready --> RegisterPage.Init : chooseRegister | navigate /register
    %% verify: Guest 點擊註冊可進入註冊頁；已登入使用者不應再看到第二顆註冊按鈕。
```

## ③ Login Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> LoginPage.Init : enterPage
    %% verify: 進入 /login 成功並顯示登入表單；Guest Header 仍只顯示公開導覽，不出現受保護入口。

    LoginPage.Init --> LoginPage.Ready : showLoginForm
    %% verify: Email 與密碼欄位可輸入且套用前端驗證；提交按鈕可見但尚未送出時不為 disabled。

    LoginPage.Ready --> AuthLoginFeature.Idle : submitCredentials | navigate AuthLoginFeature
    %% verify: 送出登入後進入登入流程並顯示 loading；提交按鈕 disabled 以防重送，請求 payload 僅包含 Email 與密碼。

    LoginPage.Ready --> RegisterPage.Init : chooseRegister | navigate /register
    %% verify: 使用者可從登入頁切往註冊頁；切換後不殘留登入錯誤訊息且表單狀態正確重置。

    LoginPage.Ready --> CoursesListPage.Init : browseWithoutLogin | navigate /courses
    %% verify: 未登入使用者可離開登入頁改為瀏覽公開課程；/courses 仍只顯示 published 課程。
```

## ④ Register Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> RegisterPage.Init : enterPage
    %% verify: 進入 /register 成功並顯示 Email/Password 註冊表單；Guest Header 仍不出現受保護入口。

    RegisterPage.Init --> RegisterPage.Ready : showRegisterForm
    %% verify: 欄位顯示必填與格式提示；密碼長度限制在前端可見且尚未送出前按鈕可操作。

    RegisterPage.Ready --> AuthRegisterFeature.Idle : submitRegistration | navigate AuthRegisterFeature
    %% verify: 送出註冊後進入註冊流程並顯示 loading；提交按鈕 disabled 以避免重複建立帳號。

    RegisterPage.Ready --> LoginPage.Init : chooseLogin | navigate /login
    %% verify: 使用者可從註冊頁切往登入頁；切換後不保留註冊錯誤訊息且登入表單正常顯示。

    RegisterPage.Ready --> CoursesListPage.Init : browseWithoutRegister | navigate /courses
    %% verify: 未註冊使用者可直接改為瀏覽公開課程；不會建立任何 session 或暫存身分。
```

## ⑤ Courses List Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> CoursesListPage.Init : enterPage
    %% verify: 任何角色都可進入 /courses；Guest 不可在 Header 看到我的課程、教師入口、管理後台入口。

    CoursesListPage.Init --> CoursesListPage.Loading : loadCourses
    %% verify: 頁面進入後立即發送課程列表請求並顯示 loading；列表區不可同時殘留舊資料與新骨架。

    CoursesListPage.Loading --> CoursesListPage.Ready : coursesFound
    %% verify: 課程列表 API 回 200 且至少一筆資料；每筆課程顯示封面、標題、價格、分類，且僅包含 published 課程。

    CoursesListPage.Loading --> CoursesListPage.Empty : noCourses
    %% verify: 課程列表 API 回 200 且無資料時顯示明確空狀態；空狀態不是由 4xx 或 5xx 錯誤誤判而來。

    CoursesListPage.Loading --> CoursesListPage.Failed : loadFailed
    %% verify: 請求失敗時顯示可理解錯誤訊息與重試入口；頁面不把失敗情境誤顯示為空清單。

    CoursesListPage.Ready --> CourseDetailPage.Init : openCourse | navigate /courses/:courseId
    %% verify: 點擊課程卡導向對應課程詳情；課程詳情會重新讀取該 courseId 的資料而非只依賴列表快取。

    CoursesListPage.Ready --> HomePage.Init : goHome | navigate /
    %% verify: 從課程列表返回首頁成功；角色導覽可見性在回頁後保持正確。

    CoursesListPage.Empty --> CoursesListPage.Init : refreshList
    %% verify: 重新整理後重新發送列表請求；若資料恢復則可進入 Ready，否則維持 Empty 而非卡住。

    CoursesListPage.Failed --> CoursesListPage.Init : retryLoad
    %% verify: 點擊重試後再次發送列表請求；成功時錯誤訊息消失並顯示最新列表或空狀態。
```

## ⑥ Course Detail Page State Machine
```mermaid
%% role: none
stateDiagram-v2
    [*] --> CourseDetailPage.Init : enterPage
    %% verify: 進入課程詳情頁會依 courseId 讀取單一課程資料；路由本身可被公開存取，但資料可見性受課程狀態與身分限制。

    CourseDetailPage.Init --> CourseDetailPage.Loading : loadCourse
    %% verify: 顯示課程詳情骨架並發送課程詳情請求；購買或閱讀 CTA 在載入完成前不可操作。

    CourseDetailPage.Loading --> CourseDetailPage.OutlineVisible : courseVisible
    %% verify: API 回 200 並回傳 title、description、category、tags、price、cover image、status 與章節/單元大綱；未購買者只可見單元標題與順序，不可見內容與附件下載。

    CourseDetailPage.Loading --> CourseDetailPage.Unavailable : courseHidden
    %% verify: 非 published 且非作者或管理員時回 404 並顯示不可見狀態；不暴露課程存在性、價格或作者資訊。

    CourseDetailPage.Loading --> CourseDetailPage.Failed : loadFailed
    %% verify: 非權限型失敗時顯示錯誤訊息與重試入口；頁面不洩漏受保護內容。

    CourseDetailPage.OutlineVisible --> PurchaseCourseFeature.Idle : startPurchase | navigate PurchaseCourseFeature
    %% verify: 購買 CTA 只對已登入且尚未購買的 Student 或 Instructor 顯示；作者、管理員、已購買者或不可購買課程不會進入購買流程。

    CourseDetailPage.OutlineVisible --> CourseReaderPage.Init : openReader | navigate /my-courses/:courseId
    %% verify: 只有作者、已購買者或管理員看得到閱讀 CTA；導向閱讀頁後內容 API 仍再次驗證存取權限。

    CourseDetailPage.OutlineVisible --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 返回課程列表後仍維持既有搜尋或篩選上下文，或至少重新顯示 published 清單；導覽狀態不異常。

    CourseDetailPage.Unavailable --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 不可見課程返回列表後不顯示該隱藏課程；使用者不會取得隱藏課程的任何額外資訊。

    CourseDetailPage.Failed --> CourseDetailPage.Init : retryLoad
    %% verify: 重試後重新發送課程詳情請求；成功時顯示最新課程資料並移除錯誤訊息。
```

## ⑦ My Courses Page State Machine
```mermaid
%% role: Student|Instructor|Admin
stateDiagram-v2
    [*] --> MyCoursesPage.Init : enterPage
    %% verify: 進入 /my-courses 需要登入；Guest 不能直接取得已購買課程資料。

    MyCoursesPage.Init --> MyCoursesPage.Loading : loadPurchases
    %% verify: 發送我的課程請求並顯示 loading；列表區不應殘留上一位使用者的購買資料。

    MyCoursesPage.Loading --> MyCoursesPage.Ready : purchasesFound
    %% verify: API 回 200 並只回傳當前登入者已購買課程；每筆顯示封面、標題、講師、購買日期與完成單元數/總單元數。

    MyCoursesPage.Loading --> MyCoursesPage.Empty : noPurchases
    %% verify: API 回 200 且無已購買課程時顯示空狀態與前往課程列表入口；不是權限錯誤或失敗情境。

    MyCoursesPage.Loading --> MyCoursesPage.Forbidden : guestBlocked
    %% verify: 未登入存取時回 401 或導向登入策略一致；頁面不載入任何購買紀錄。

    MyCoursesPage.Loading --> MyCoursesPage.Failed : loadFailed
    %% verify: 請求失敗時顯示錯誤訊息與重試入口；不誤顯示空狀態。

    MyCoursesPage.Ready --> CourseReaderPage.Init : openOwnedCourse | navigate /my-courses/:courseId
    %% verify: 點擊課程後導向閱讀頁；後端再次確認當前使用者為購買者、作者或管理員後才提供內容。

    MyCoursesPage.Ready --> CoursesListPage.Init : browseMore | navigate /courses
    %% verify: 從我的課程前往公開課程列表成功；不影響既有購買資料或進度資料。

    MyCoursesPage.Empty --> CoursesListPage.Init : browseCourses | navigate /courses
    %% verify: 空狀態 CTA 導向 /courses 成功；公開課程列表正常顯示 published 課程。

    MyCoursesPage.Forbidden --> LoginPage.Init : requestSignIn | navigate /login
    %% verify: 被要求登入時導向 /login；登入成功後可再回到 /my-courses 並讀取當前使用者資料。

    MyCoursesPage.Failed --> MyCoursesPage.Init : retryLoad
    %% verify: 重試後重新讀取我的課程；成功時顯示最新進度與購買清單。
```

## ⑧ Course Reader Page State Machine
```mermaid
%% role: Student|Instructor|Admin
stateDiagram-v2
    [*] --> CourseReaderPage.Init : enterPage
    %% verify: 進入閱讀頁會依 courseId 請求章節、單元與內容；存取資格限定為作者、已購買者或管理員。

    CourseReaderPage.Init --> CourseReaderPage.Loading : loadReader
    %% verify: 閱讀頁在內容回來前顯示骨架；文字、圖片、PDF 下載入口在載入完成前不可見。

    CourseReaderPage.Loading --> CourseReaderPage.OutlineReady : accessGranted
    %% verify: 內容 API 回 200 並回傳章節、單元結構、內容型態與完成狀態；PDF 下載連結受保護且僅對有權限者可用。

    CourseReaderPage.Loading --> CourseReaderPage.Forbidden : accessBlocked
    %% verify: 非作者、非購買者且非管理員時回 403；頁面顯示無權限提示且不渲染任何課程內容。

    CourseReaderPage.Loading --> CourseReaderPage.Failed : loadFailed
    %% verify: 非權限型失敗時顯示錯誤訊息與重試入口；不把系統失敗誤顯示為 403。

    CourseReaderPage.OutlineReady --> CourseReaderPage.LessonReading : openLesson
    %% verify: 點擊單元後顯示對應文字、圖片或 PDF 內容；內容渲染採安全方式避免注入，且目前單元高亮正確。

    CourseReaderPage.OutlineReady --> CourseDetailPage.Init : viewCourseInfo | navigate /courses/:courseId
    %% verify: 從閱讀頁返回課程詳情後仍顯示正確的購買或閱讀狀態；不失去課程可見性規則。

    CourseReaderPage.LessonReading --> LessonCompletionFeature.Idle : markLessonComplete | navigate LessonCompletionFeature
    %% verify: 點擊完成單元後進入完成流程；操作期間按鈕 disabled，避免重複標記同一單元。

    CourseReaderPage.LessonReading --> MyCoursesPage.Init : backToLibrary | navigate /my-courses
    %% verify: 返回我的課程後清單中的進度會重新計算並顯示最新完成單元數。

    CourseReaderPage.Forbidden --> CourseDetailPage.Init : backToCourse | navigate /courses/:courseId
    %% verify: 無權限返回課程詳情後仍只顯示行銷資訊與鎖定提示；不洩漏任何單元內容或附件連結。

    CourseReaderPage.Failed --> CourseReaderPage.Init : retryLoad
    %% verify: 重試後重新發送閱讀資料請求；成功時恢復章節導覽與內容顯示。
```

## ⑨ Instructor Courses Page State Machine
```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> InstructorCoursesPage.Init : enterPage
    %% verify: 只有 Instructor 或 Admin 可進入教師課程管理；Student 或 Guest 不能取得本人課程清單。

    InstructorCoursesPage.Init --> InstructorCoursesPage.Loading : loadOwnCourses
    %% verify: 頁面顯示 loading 並發送本人課程清單請求；列表區不應殘留先前課程資料。

    InstructorCoursesPage.Loading --> InstructorCoursesPage.Ready : coursesFound
    %% verify: API 回 200 並只回傳該教師的課程或管理員可管理的課程；每筆顯示 draft、submitted、published、rejected、archived 狀態與對應可用操作。

    InstructorCoursesPage.Loading --> InstructorCoursesPage.Empty : noCourses
    %% verify: 無課程時顯示空狀態與建立課程入口；不因權限不足誤導成空清單。

    InstructorCoursesPage.Loading --> InstructorCoursesPage.Forbidden : roleBlocked
    %% verify: 非 Instructor 或 Admin 存取時回 403；Header 也不顯示教師課程管理入口且頁面不載入課程資料。

    InstructorCoursesPage.Loading --> InstructorCoursesPage.Failed : loadFailed
    %% verify: 請求失敗時顯示錯誤訊息與重試入口；不顯示不完整的課程狀態。

    InstructorCoursesPage.Ready --> NewCoursePage.Init : createCourse | navigate /instructor/courses/new
    %% verify: 建立課程 CTA 位於頁面主要內容區；導向新增頁後可開始建立 draft 課程。

    InstructorCoursesPage.Ready --> EditCoursePage.Init : editCourse | navigate /instructor/courses/:courseId/edit
    %% verify: 只能編輯自己的課程；若指定他人課程則後端回 404 以避免暴露存在性。

    InstructorCoursesPage.Ready --> CurriculumEditorPage.Init : manageCurriculum | navigate /instructor/courses/:courseId/curriculum
    %% verify: 只有作者或管理員可進入課綱管理；進入後可看到章節與單元排序資訊。

    InstructorCoursesPage.Ready --> SubmitCourseFeature.Idle : submitForReview | navigate SubmitCourseFeature
    %% verify: 提交審核入口僅對 draft 或 rejected 課程顯示；submitted、published、archived 課程不會進入此流程。

    InstructorCoursesPage.Ready --> CourseLifecycleFeature.Idle : togglePublishState | navigate CourseLifecycleFeature
    %% verify: 上下架入口僅對 published 或 archived 課程顯示；非法狀態轉換不會進入課程生命週期流程。

    InstructorCoursesPage.Ready --> CoursesListPage.Init : viewMarketplace | navigate /courses
    %% verify: 教師可從管理頁回到公開課程列表；教師導覽仍保留我的課程與教師入口，不顯示管理後台入口。

    InstructorCoursesPage.Empty --> NewCoursePage.Init : createFirstCourse | navigate /instructor/courses/new
    %% verify: 空狀態 CTA 可直接前往建立第一門課程；不需要額外跳轉頁。

    InstructorCoursesPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足返回公開課程列表後，頁面不暴露任何教師專屬操作或資料。

    InstructorCoursesPage.Failed --> InstructorCoursesPage.Init : retryLoad
    %% verify: 重試後重新讀取課程管理列表；成功時顯示最新課程狀態與操作。
```

## ⑩ New Course Page State Machine
```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> NewCoursePage.Init : enterPage
    %% verify: 只有 Instructor 或 Admin 可進入新增課程頁；頁面顯示標題、描述、分類、標籤、價格、封面等課程欄位。

    NewCoursePage.Init --> NewCoursePage.Ready : showDraftForm
    %% verify: 表單顯示必填提示與 price >= 0 驗證；尚未送出前資料不會寫入資料庫。

    NewCoursePage.Ready --> CreateCourseFeature.Idle : saveDraft | navigate CreateCourseFeature
    %% verify: 送出後進入建立草稿流程；按鈕 disabled 以防止重複建立多筆草稿。

    NewCoursePage.Ready --> InstructorCoursesPage.Init : cancelCreate | navigate /instructor/courses
    %% verify: 取消建立後返回教師課程列表；未送出的表單資料不應造成新課程紀錄。
```

## ⑪ Edit Course Page State Machine
```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> EditCoursePage.Init : enterPage
    %% verify: 進入編輯頁時會依 courseId 讀取課程資料；只有作者或管理員可看到該頁。

    EditCoursePage.Init --> EditCoursePage.Loading : loadEditableCourse
    %% verify: 編輯頁顯示 loading 並發送課程載入請求；表單在載入完成前不可編輯。

    EditCoursePage.Loading --> EditCoursePage.Ready : courseLoaded
    %% verify: API 回 200 並回傳課程基本欄位、分類、標籤、價格、封面與當前狀態；表單以現有資料正確預填。

    EditCoursePage.Loading --> EditCoursePage.Hidden : courseHidden
    %% verify: 非作者且非管理員存取時回 404；頁面不暴露課程標題、價格或審核狀態。

    EditCoursePage.Loading --> EditCoursePage.Failed : loadFailed
    %% verify: 非權限型失敗時顯示錯誤訊息與重試入口；不把失敗誤顯示為 404。

    EditCoursePage.Ready --> UpdateCourseFeature.Idle : saveCourse | navigate UpdateCourseFeature
    %% verify: 送出更新後進入課程更新流程；只有作者或管理員可提交，且按鈕 disabled 防重送。

    EditCoursePage.Ready --> CurriculumEditorPage.Init : editCurriculum | navigate /instructor/courses/:courseId/curriculum
    %% verify: 點擊課綱管理可前往章節或單元編輯頁；同一頁不重複出現相同課綱入口。

    EditCoursePage.Ready --> InstructorCoursesPage.Init : backToInstructorCourses | navigate /instructor/courses
    %% verify: 返回教師課程列表後仍顯示更新前或更新後的正確課程狀態，不出現重複資料列。

    EditCoursePage.Hidden --> InstructorCoursesPage.Init : backToInstructorCourses | navigate /instructor/courses
    %% verify: 隱藏狀態返回列表後不顯示無權限課程；列表只保留使用者可管理的課程。

    EditCoursePage.Failed --> EditCoursePage.Init : retryLoad
    %% verify: 重試後重新讀取課程資料；成功時表單預填與附件資訊恢復正確。
```

## ⑫ Curriculum Editor Page State Machine
```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> CurriculumEditorPage.Init : enterPage
    %% verify: 進入課綱管理頁時依 courseId 讀取章節與單元資料；只有作者或管理員可操作課綱。

    CurriculumEditorPage.Init --> CurriculumEditorPage.Loading : loadCurriculum
    %% verify: 顯示 loading 並發送章節與單元請求；排序操作在資料回來前不可使用。

    CurriculumEditorPage.Loading --> CurriculumEditorPage.Ready : curriculumLoaded
    %% verify: API 回 200 並回傳章節、單元、order 與內容型態；畫面可正確顯示文字、圖片、PDF 單元設定。

    CurriculumEditorPage.Loading --> CurriculumEditorPage.Hidden : courseHidden
    %% verify: 非作者且非管理員存取時回 404；不暴露課綱標題或內容型態資訊。

    CurriculumEditorPage.Loading --> CurriculumEditorPage.Failed : loadFailed
    %% verify: 非權限型失敗時顯示錯誤訊息與重試入口；不誤顯示為空課綱。

    CurriculumEditorPage.Ready --> CurriculumMutationFeature.Idle : saveCurriculum | navigate CurriculumMutationFeature
    %% verify: 儲存課綱時進入更新流程；章節與單元順序、內容型態與附件關聯將一併送出。

    CurriculumEditorPage.Ready --> EditCoursePage.Init : backToCourseForm | navigate /instructor/courses/:courseId/edit
    %% verify: 返回課程編輯頁後仍保留相同課程的基本資訊；不切換到其他課程。

    CurriculumEditorPage.Ready --> InstructorCoursesPage.Init : backToInstructorCourses | navigate /instructor/courses
    %% verify: 返回列表後可看到該課程仍屬於同一作者且狀態未被意外更改。

    CurriculumEditorPage.Hidden --> InstructorCoursesPage.Init : backToInstructorCourses | navigate /instructor/courses
    %% verify: 無權限返回後列表不顯示受保護課綱資訊；僅顯示可管理課程。

    CurriculumEditorPage.Failed --> CurriculumEditorPage.Init : retryLoad
    %% verify: 重試後重新讀取最新課綱；成功時章節與單元順序一致。
```

## ⑬ Admin Review Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminReviewPage.Init : enterPage
    %% verify: 只有 Admin 可進入待審清單；非 Admin 不可取得 submitted 課程資料。

    AdminReviewPage.Init --> AdminReviewPage.Loading : loadSubmittedCourses
    %% verify: 顯示 loading 並發送 submitted 課程清單請求；清單區不殘留舊資料。

    AdminReviewPage.Loading --> AdminReviewPage.Ready : submissionsFound
    %% verify: API 回 200 並只回傳 submitted 課程；每筆可見作者、狀態與審核入口。

    AdminReviewPage.Loading --> AdminReviewPage.Empty : noSubmissions
    %% verify: 無待審課程時顯示空狀態；不是由權限錯誤或系統失敗導致。

    AdminReviewPage.Loading --> AdminReviewPage.Forbidden : roleBlocked
    %% verify: 非 Admin 存取時回 403 並阻止資料載入；Header 也不應顯示管理後台入口。

    AdminReviewPage.Loading --> AdminReviewPage.Failed : loadFailed
    %% verify: 系統失敗時顯示錯誤訊息與重試入口；不誤顯示為空清單。

    AdminReviewPage.Ready --> ReviewDecisionFeature.Idle : reviewCourse | navigate ReviewDecisionFeature
    %% verify: 點擊審核會進入核准或駁回流程；submitted 課程才可進入此流程，且駁回需要理由。

    AdminReviewPage.Ready --> AdminCoursesPage.Init : openCourseManagement | navigate /admin/courses
    %% verify: 可切往課程管理頁；管理導覽在各後台頁面之間保持一致且不重複入口。

    AdminReviewPage.Ready --> AdminTaxonomyPage.Init : openTaxonomy | navigate /admin/taxonomy
    %% verify: 可切往分類與標籤管理頁；仍維持 Admin 身分與後台導覽。

    AdminReviewPage.Ready --> AdminUsersPage.Init : openUsers | navigate /admin/users
    %% verify: 可切往使用者管理頁；不遺失當前後台導覽狀態。

    AdminReviewPage.Ready --> AdminStatsPage.Init : openStats | navigate /admin/stats
    %% verify: 可切往統計頁；統計頁將顯示課程數量、購買數量、使用者數量。

    AdminReviewPage.Empty --> AdminCoursesPage.Init : openCourseManagement | navigate /admin/courses
    %% verify: 空狀態下仍可切往課程管理頁；不需要重新登入。

    AdminReviewPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足返回公開課程列表後，不保留任何後台資料或入口。

    AdminReviewPage.Failed --> AdminReviewPage.Init : retryLoad
    %% verify: 重試後重新讀取 submitted 清單；成功時顯示最新待審課程。
```

## ⑭ Admin Courses Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminCoursesPage.Init : enterPage
    %% verify: 只有 Admin 可進入課程管理頁；非 Admin 不可取得全站課程管理資料。

    AdminCoursesPage.Init --> AdminCoursesPage.Loading : loadManagedCourses
    %% verify: 顯示 loading 並讀取全站課程管理清單；舊資料不應殘留於列表中。

    AdminCoursesPage.Loading --> AdminCoursesPage.Ready : coursesLoaded
    %% verify: API 回 200 並顯示各狀態課程；Admin 可看到 published、archived 等狀態與對應切換入口。

    AdminCoursesPage.Loading --> AdminCoursesPage.Forbidden : roleBlocked
    %% verify: 非 Admin 存取時回 403；頁面不載入任何課程管理操作。

    AdminCoursesPage.Loading --> AdminCoursesPage.Failed : loadFailed
    %% verify: 系統失敗時顯示錯誤訊息與重試入口；不誤顯示為空資料。

    AdminCoursesPage.Ready --> CourseLifecycleFeature.Idle : changeCourseState | navigate CourseLifecycleFeature
    %% verify: Admin 只能對 published 與 archived 做上下架切換；切換後課程狀態與列表資料需一致更新。

    AdminCoursesPage.Ready --> AdminReviewPage.Init : openReviewQueue | navigate /admin/review
    %% verify: 可返回待審清單；submitted 課程數量與狀態更新需與審核結果一致。

    AdminCoursesPage.Ready --> AdminTaxonomyPage.Init : openTaxonomy | navigate /admin/taxonomy
    %% verify: 可切往分類與標籤管理頁；後台導覽仍一致且不重複入口。

    AdminCoursesPage.Ready --> AdminStatsPage.Init : openStats | navigate /admin/stats
    %% verify: 可切往統計頁；統計數據需反映最新課程狀態分布。

    AdminCoursesPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足時回到公開課程列表；不保留全站課程管理資料。

    AdminCoursesPage.Failed --> AdminCoursesPage.Init : retryLoad
    %% verify: 重試後重新讀取課程管理清單；成功時顯示最新狀態與可用操作。
```

## ⑮ Admin Taxonomy Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminTaxonomyPage.Init : enterPage
    %% verify: 只有 Admin 可進入分類與標籤管理頁；非 Admin 不可取得 taxonomy 資料。

    AdminTaxonomyPage.Init --> AdminTaxonomyPage.Loading : loadTaxonomy
    %% verify: 顯示 loading 並發送分類與標籤請求；畫面不殘留先前管理結果。

    AdminTaxonomyPage.Loading --> AdminTaxonomyPage.Ready : taxonomyLoaded
    %% verify: API 回 200 並回傳分類、標籤與 is_active 狀態；可管理新增、編輯、停用操作。

    AdminTaxonomyPage.Loading --> AdminTaxonomyPage.Forbidden : roleBlocked
    %% verify: 非 Admin 存取時回 403；頁面不顯示任何管理控制項。

    AdminTaxonomyPage.Loading --> AdminTaxonomyPage.Failed : loadFailed
    %% verify: 請求失敗時顯示錯誤訊息與重試入口；不誤顯示為空 taxonomy。

    AdminTaxonomyPage.Ready --> TaxonomyMutationFeature.Idle : manageTaxonomy | navigate TaxonomyMutationFeature
    %% verify: 進入 taxonomy 更新流程時只接受 Admin 操作；新增、編輯、停用需影響分類或標籤資料一致性。

    AdminTaxonomyPage.Ready --> AdminReviewPage.Init : openReviewQueue | navigate /admin/review
    %% verify: 可切回待審清單；後台導覽狀態維持一致。

    AdminTaxonomyPage.Ready --> AdminUsersPage.Init : openUsers | navigate /admin/users
    %% verify: 可切往使用者管理頁；不丟失管理後台身分與導覽。

    AdminTaxonomyPage.Ready --> AdminStatsPage.Init : openStats | navigate /admin/stats
    %% verify: 可切往統計頁；taxonomy 異動後的課程分類顯示可被後續頁面正確使用。

    AdminTaxonomyPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足返回公開課程列表後，不顯示 taxonomy 管理入口。

    AdminTaxonomyPage.Failed --> AdminTaxonomyPage.Init : retryLoad
    %% verify: 重試後重新讀取 taxonomy；成功時顯示最新 is_active 狀態。
```

## ⑯ Admin Users Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminUsersPage.Init : enterPage
    %% verify: 只有 Admin 可進入使用者管理頁；非 Admin 不可取得 email、角色、啟用狀態清單。

    AdminUsersPage.Init --> AdminUsersPage.Loading : loadUsers
    %% verify: 顯示 loading 並發送使用者列表請求；列表區不殘留舊使用者資料。

    AdminUsersPage.Loading --> AdminUsersPage.Ready : usersLoaded
    %% verify: API 回 200 並回傳 email、主要角色、is_active；頁面可呈現停用或啟用與角色調整入口。

    AdminUsersPage.Loading --> AdminUsersPage.Forbidden : roleBlocked
    %% verify: 非 Admin 存取時回 403；頁面不載入任何使用者資料。

    AdminUsersPage.Loading --> AdminUsersPage.Failed : loadFailed
    %% verify: 系統失敗時顯示錯誤訊息與重試入口；不誤顯示為空清單。

    AdminUsersPage.Ready --> UserManagementFeature.Idle : manageUserAccount | navigate UserManagementFeature
    %% verify: 進入使用者管理流程時只接受 Admin 操作；角色與啟用狀態變更需更新對應使用者資料。

    AdminUsersPage.Ready --> AdminReviewPage.Init : openReviewQueue | navigate /admin/review
    %% verify: 可切回待審清單；後台導覽保持一致。

    AdminUsersPage.Ready --> AdminTaxonomyPage.Init : openTaxonomy | navigate /admin/taxonomy
    %% verify: 可切往 taxonomy 管理；已載入的使用者資料不會錯置到其他頁面。

    AdminUsersPage.Ready --> AdminStatsPage.Init : openStats | navigate /admin/stats
    %% verify: 可切往統計頁；使用者數量統計應與最新使用者清單一致。

    AdminUsersPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足返回公開課程列表後，不保留使用者管理資料與後台入口。

    AdminUsersPage.Failed --> AdminUsersPage.Init : retryLoad
    %% verify: 重試後重新讀取使用者清單；成功時顯示最新角色與啟用狀態。
```

## ⑰ Admin Stats Page State Machine
```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> AdminStatsPage.Init : enterPage
    %% verify: 只有 Admin 可進入統計頁；非 Admin 不可取得平台統計資料。

    AdminStatsPage.Init --> AdminStatsPage.Loading : loadStats
    %% verify: 顯示 loading 並發送統計請求；畫面不殘留過期數據。

    AdminStatsPage.Loading --> AdminStatsPage.Ready : statsLoaded
    %% verify: API 回 200 並顯示課程數量、購買數量、使用者數量；統計值與其他管理頁資料一致。

    AdminStatsPage.Loading --> AdminStatsPage.Forbidden : roleBlocked
    %% verify: 非 Admin 存取時回 403；頁面不顯示任何平台統計數值。

    AdminStatsPage.Loading --> AdminStatsPage.Failed : loadFailed
    %% verify: 系統失敗時顯示錯誤訊息與重試入口；不誤顯示為零或空數據。

    AdminStatsPage.Ready --> AdminReviewPage.Init : openReviewQueue | navigate /admin/review
    %% verify: 可切回待審清單；統計頁離開後不影響待審資料載入。

    AdminStatsPage.Ready --> AdminCoursesPage.Init : openCourseManagement | navigate /admin/courses
    %% verify: 可切往課程管理頁；課程狀態統計需與管理清單相互對應。

    AdminStatsPage.Ready --> AdminUsersPage.Init : openUsers | navigate /admin/users
    %% verify: 可切往使用者管理頁；使用者數量統計應與使用者列表筆數一致。

    AdminStatsPage.Ready --> CoursesListPage.Init : openMarketplace | navigate /courses
    %% verify: Admin 可從後台切回公開課程列表；公開列表不顯示後台專屬控制項。

    AdminStatsPage.Forbidden --> CoursesListPage.Init : backToCourses | navigate /courses
    %% verify: 權限不足返回公開課程列表後，不保留任何統計數值或管理後台入口。

    AdminStatsPage.Failed --> AdminStatsPage.Init : retryLoad
    %% verify: 重試後重新讀取統計資料；成功時數值與最新資料庫狀態一致。
```

---

## ⑱ Auth Login Feature State Machine
Source Pages: LoginPage, MyCoursesPage, InstructorCoursesPage, AdminReviewPage

```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthLoginFeature.Idle : enterFeature
    %% verify: 進入登入功能後尚未送出請求；畫面可顯示送出中狀態但不建立 session。

    AuthLoginFeature.Idle --> AuthLoginFeature.Submitting : submitCredentials
    %% verify: 送出 Email 與密碼後發送登入 API；送出按鈕 disabled 並避免重複提交。

    AuthLoginFeature.Submitting --> AuthLoginFeature.StudentAuthenticated : studentAccepted
    %% verify: API 回 200 並建立 student session；Header 切換為 Student 導覽，顯示我的課程與登出，不顯示教師或管理後台入口。

    AuthLoginFeature.Submitting --> AuthLoginFeature.InstructorAuthenticated : instructorAccepted
    %% verify: API 回 200 並建立 instructor session；Header 顯示課程列表、我的課程、教師課程管理、登出，不顯示管理後台入口。

    AuthLoginFeature.Submitting --> AuthLoginFeature.AdminAuthenticated : adminAccepted
    %% verify: API 回 200 並建立 admin session；Header 顯示管理後台入口與登出，且可進入 /admin/*。

    AuthLoginFeature.Submitting --> AuthLoginFeature.Denied : credentialsRejected
    %% verify: API 回 401 時顯示明確登入失敗訊息；不建立 session，也不顯示任何受保護導覽項目。

    AuthLoginFeature.StudentAuthenticated --> CoursesListPage.Init : loginAsStudent | navigate /courses
    %% verify: 登入後導向公開課程列表成功；Student 導覽已生效且可再前往 /my-courses。

    AuthLoginFeature.InstructorAuthenticated --> InstructorCoursesPage.Init : loginAsInstructor | navigate /instructor/courses
    %% verify: 登入後導向教師課程管理頁成功；只有該教師可管理自己的課程。

    AuthLoginFeature.AdminAuthenticated --> AdminReviewPage.Init : loginAsAdmin | navigate /admin/review
    %% verify: 登入後導向待審清單成功；Admin 可取得 submitted 課程資料。

    AuthLoginFeature.Denied --> LoginPage.Init : retryLogin | navigate /login
    %% verify: 返回登入頁後保留失敗提示但不保留密碼；使用者可重新輸入並再次送出。
```

## ⑲ Auth Register Feature State Machine
Source Pages: RegisterPage

```mermaid
%% role: none
stateDiagram-v2
    [*] --> AuthRegisterFeature.Idle : enterFeature
    %% verify: 進入註冊功能後尚未建立帳號；不會自動產生 session 或主要角色升級。

    AuthRegisterFeature.Idle --> AuthRegisterFeature.Submitting : submitRegistration
    %% verify: 送出註冊資料後發送建立帳號請求；按鈕 disabled 防止重複送出。

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.Registered : registrationAccepted
    %% verify: API 回 201 並建立新 User；email 唯一、password_hash 已寫入，預設角色符合系統註冊規則且非 admin。

    AuthRegisterFeature.Submitting --> AuthRegisterFeature.Rejected : registrationRejected
    %% verify: API 回 400 時顯示欄位級錯誤，如 Email 已存在、格式錯誤或密碼過短；不建立任何新帳號。

    AuthRegisterFeature.Registered --> LoginPage.Init : proceedToLogin | navigate /login
    %% verify: 註冊成功後導向登入頁；使用者可用新帳號登入且仍未自動登入。

    AuthRegisterFeature.Rejected --> RegisterPage.Init : retryRegister | navigate /register
    %% verify: 返回註冊頁後保留必要錯誤提示；使用者可修正欄位後再次送出。
```

## ⑳ Purchase Course Feature State Machine
Source Pages: CourseDetailPage

```mermaid
%% role: Student|Instructor
stateDiagram-v2
    [*] --> PurchaseCourseFeature.Idle : enterFeature
    %% verify: 只有符合資格的 Student 或 Instructor 會進入購買流程；課程必須為 published 且尚未購買。

    PurchaseCourseFeature.Idle --> PurchaseCourseFeature.Submitting : confirmPurchase
    %% verify: 確認購買後發送購買請求；按鈕 disabled 並防止重複購買同一課程。

    PurchaseCourseFeature.Submitting --> PurchaseCourseFeature.Purchased : purchaseRecorded
    %% verify: API 回 201 或等價成功結果並建立 Purchase；user_id、course_id、created_at 正確寫入，課程取得永久存取權。

    PurchaseCourseFeature.Submitting --> PurchaseCourseFeature.AlreadyOwned : duplicatePurchaseBlocked
    %% verify: 若已購買同一課程則請求被阻擋並顯示已購買提示；不新增第二筆 Purchase。

    PurchaseCourseFeature.Submitting --> PurchaseCourseFeature.Blocked : courseNotPurchasable
    %% verify: 非 published、無權限角色或其他不可購買情境時請求被拒絕；不建立 Purchase，也不授予內容存取權。

    PurchaseCourseFeature.Purchased --> MyCoursesPage.Init : openOwnedLibrary | navigate /my-courses
    %% verify: 購買成功後我的課程清單立即包含新課程；進度初始為 0/總單元數。

    PurchaseCourseFeature.AlreadyOwned --> CourseDetailPage.Init : returnToCourse | navigate /courses/:courseId
    %% verify: 返回課程詳情後顯示已購買或進入閱讀 CTA；不再顯示可重複購買入口。

    PurchaseCourseFeature.Blocked --> CourseDetailPage.Init : returnToCourse | navigate /courses/:courseId
    %% verify: 返回課程詳情後仍維持原本權限與購買狀態；不會錯誤顯示已取得內容存取權。
```

## ㉑ Lesson Completion Feature State Machine
Source Pages: CourseReaderPage

```mermaid
%% role: Student|Instructor
stateDiagram-v2
    [*] --> LessonCompletionFeature.Idle : enterFeature
    %% verify: 只有可標記進度的已登入使用者會進入完成流程；未授權角色不應進入此功能。

    LessonCompletionFeature.Idle --> LessonCompletionFeature.Submitting : confirmLessonCompletion
    %% verify: 送出完成標記時發送 LessonProgress 更新請求；按鈕 disabled 並避免重複送出。

    LessonCompletionFeature.Submitting --> LessonCompletionFeature.Completed : progressRecorded
    %% verify: API 回 200 並將對應 LessonProgress.is_completed 設為 true，completed_at 更新，課程進度計數同步增加。

    LessonCompletionFeature.Submitting --> LessonCompletionFeature.Blocked : completionBlocked
    %% verify: 無權限或資料不一致時請求被拒絕；LessonProgress 不應被錯誤改寫為已完成。

    LessonCompletionFeature.Completed --> CourseReaderPage.Init : returnToReader | navigate /my-courses/:courseId
    %% verify: 返回閱讀頁後最新完成狀態已呈現；同一單元不會再被當成未完成。

    LessonCompletionFeature.Blocked --> CourseReaderPage.Init : returnToReader | navigate /my-courses/:courseId
    %% verify: 返回閱讀頁後顯示失敗訊息且完成狀態維持原值；進度總數不被誤增。
```

## ㉒ Create Course Feature State Machine
Source Pages: NewCoursePage

```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> CreateCourseFeature.Idle : enterFeature
    %% verify: 進入建立課程功能時尚未寫入資料；只有 Instructor 或 Admin 可操作。

    CreateCourseFeature.Idle --> CreateCourseFeature.Submitting : createDraft
    %% verify: 送出建立草稿請求時帶入 title、description、category、tags、price、cover image 等欄位；按鈕 disabled 防重送。

    CreateCourseFeature.Submitting --> CreateCourseFeature.DraftCreated : draftStored
    %% verify: API 回 201 並建立 Course，status=draft，instructor_id 正確綁定建立者，價格非負且資料欄位完整保存。

    CreateCourseFeature.Submitting --> CreateCourseFeature.Rejected : draftRejected
    %% verify: 驗證失敗時顯示欄位錯誤訊息；不建立半成品課程，也不產生錯誤狀態的 Course。

    CreateCourseFeature.DraftCreated --> EditCoursePage.Init : openCreatedCourse | navigate /instructor/courses/:courseId/edit
    %% verify: 建立成功後導向該新課程的編輯頁；courseId 正確且可繼續編輯基本資訊與課綱。

    CreateCourseFeature.Rejected --> NewCoursePage.Init : retryDraft | navigate /instructor/courses/new
    %% verify: 返回新增頁後保留必要錯誤提示；使用者可修正後再次建立草稿。
```

## ㉓ Update Course Feature State Machine
Source Pages: EditCoursePage

```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> UpdateCourseFeature.Idle : enterFeature
    %% verify: 進入課程更新功能時只有作者或管理員可送出；尚未更新資料庫內容。

    UpdateCourseFeature.Idle --> UpdateCourseFeature.Submitting : saveCourse
    %% verify: 送出更新請求時包含可編輯欄位；按鈕 disabled 並避免重複送出同一批修改。

    UpdateCourseFeature.Submitting --> UpdateCourseFeature.Saved : courseStored
    %% verify: API 回 200 並更新課程基本欄位與 updated_at；不會非法改變課程生命週期狀態。

    UpdateCourseFeature.Submitting --> UpdateCourseFeature.Rejected : saveRejected
    %% verify: 驗證失敗或權限不符時顯示錯誤訊息；既有課程資料維持原值且不產生部分寫入。

    UpdateCourseFeature.Saved --> EditCoursePage.Init : reopenEditor | navigate /instructor/courses/:courseId/edit
    %% verify: 返回編輯頁後表單顯示最新儲存內容；封面、分類、標籤與價格一致更新。

    UpdateCourseFeature.Rejected --> EditCoursePage.Init : retryEdit | navigate /instructor/courses/:courseId/edit
    %% verify: 返回編輯頁後保留必要錯誤提示；使用者可繼續修正並重新送出。
```

## ㉔ Curriculum Mutation Feature State Machine
Source Pages: CurriculumEditorPage

```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> CurriculumMutationFeature.Idle : enterFeature
    %% verify: 進入課綱更新功能時僅限作者或管理員；尚未變更章節與單元資料。

    CurriculumMutationFeature.Idle --> CurriculumMutationFeature.Submitting : saveCurriculum
    %% verify: 送出課綱更新時包含章節、單元、order、content_type 與對應內容欄位；按鈕 disabled 防止重複提交。

    CurriculumMutationFeature.Submitting --> CurriculumMutationFeature.Saved : curriculumStored
    %% verify: API 回 200 並正確保存 Section、Lesson 排序與內容型態；課程閱讀頁之後可依新順序顯示內容。

    CurriculumMutationFeature.Submitting --> CurriculumMutationFeature.Rejected : saveRejected
    %% verify: 驗證失敗時顯示錯誤訊息；Section、Lesson 與附件關聯保持更新前的一致性。

    CurriculumMutationFeature.Saved --> CurriculumEditorPage.Init : reopenCurriculum | navigate /instructor/courses/:courseId/curriculum
    %% verify: 返回課綱頁後顯示最新章節與單元順序；新增、編輯、刪除結果已反映在畫面上。

    CurriculumMutationFeature.Rejected --> CurriculumEditorPage.Init : retryCurriculum | navigate /instructor/courses/:courseId/curriculum
    %% verify: 返回課綱頁後保留必要錯誤提示；未成功的變更不應污染既有課綱資料。
```

## ㉕ Submit Course Feature State Machine
Source Pages: InstructorCoursesPage

```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> SubmitCourseFeature.Idle : enterFeature
    %% verify: 只有 draft 或 rejected 課程可進入送審流程；submitted、published、archived 課程不應進入此功能。

    SubmitCourseFeature.Idle --> SubmitCourseFeature.Submitting : submitCourse
    %% verify: 送出審核請求時按鈕 disabled 並發送狀態變更；請求對象必須是作者自己的課程或管理員可管理課程。

    SubmitCourseFeature.Submitting --> SubmitCourseFeature.Submitted : reviewQueued
    %% verify: API 回 200 並將課程狀態改為 submitted；待審清單可看到該課程且作者仍不可直接改回 draft。

    SubmitCourseFeature.Submitting --> SubmitCourseFeature.Blocked : submissionBlocked
    %% verify: 非法狀態轉換或權限不足時請求被拒絕；課程狀態維持原值且不進入待審清單。

    SubmitCourseFeature.Submitted --> InstructorCoursesPage.Init : returnWithSubmittedCourse | navigate /instructor/courses
    %% verify: 返回教師課程列表後該課程顯示 submitted；提交審核入口消失直到有新的合法狀態轉換。

    SubmitCourseFeature.Blocked --> InstructorCoursesPage.Init : returnWithDraftCourse | navigate /instructor/courses
    %% verify: 返回列表後課程仍維持 draft 或 rejected；畫面顯示阻擋原因且資料一致。
```

## ㉖ Course Lifecycle Feature State Machine
Source Pages: InstructorCoursesPage, AdminCoursesPage

```mermaid
%% role: Instructor|Admin
stateDiagram-v2
    [*] --> CourseLifecycleFeature.Idle : enterFeature
    %% verify: 只有 published 或 archived 課程可進入上下架流程；draft、submitted、rejected 不應進入此功能。

    CourseLifecycleFeature.Idle --> CourseLifecycleFeature.SubmittingArchive : archiveCourse
    %% verify: 發送下架請求時只允許作者或管理員操作；按鈕 disabled 並避免重複下架。

    CourseLifecycleFeature.Idle --> CourseLifecycleFeature.SubmittingPublish : republishCourse
    %% verify: 發送重新上架請求時只允許作者或管理員操作；按鈕 disabled 並避免重複上架。

    CourseLifecycleFeature.SubmittingArchive --> CourseLifecycleFeature.Archived : archiveStored
    %% verify: API 回 200 並將課程狀態改為 archived，同步更新 archived_at；公開課程列表不再顯示該課程。

    CourseLifecycleFeature.SubmittingArchive --> CourseLifecycleFeature.Blocked : archiveBlocked
    %% verify: 非法狀態轉換或權限不足時請求被拒絕；課程狀態與公開可見性維持原值。

    CourseLifecycleFeature.SubmittingPublish --> CourseLifecycleFeature.Published : publishStored
    %% verify: API 回 200 並將課程狀態改為 published；公開課程列表恢復顯示該課程，published_at 與狀態一致。

    CourseLifecycleFeature.SubmittingPublish --> CourseLifecycleFeature.Blocked : publishBlocked
    %% verify: 非法狀態轉換或權限不足時請求被拒絕；課程仍維持 archived 或原本狀態，不錯誤出現在公開列表。

    CourseLifecycleFeature.Archived --> InstructorCoursesPage.Init : returnAsInstructor | navigate /instructor/courses
    %% verify: 以教師視角返回列表後該課程顯示 archived；可用操作改為重新上架而非再次下架。

    CourseLifecycleFeature.Archived --> AdminCoursesPage.Init : returnAsAdmin | navigate /admin/courses
    %% verify: 以管理員視角返回列表後該課程顯示 archived；全站課程管理資料與公開可見性一致。

    CourseLifecycleFeature.Published --> InstructorCoursesPage.Init : returnAsInstructor | navigate /instructor/courses
    %% verify: 以教師視角返回列表後該課程顯示 published；可用操作改為下架，且公開課程列表可瀏覽。

    CourseLifecycleFeature.Published --> AdminCoursesPage.Init : returnAsAdmin | navigate /admin/courses
    %% verify: 以管理員視角返回列表後該課程顯示 published；全站管理與公開課程列表資料一致。

    CourseLifecycleFeature.Blocked --> InstructorCoursesPage.Init : returnBlockedInstructor | navigate /instructor/courses
    %% verify: 教師視角被阻擋返回列表後課程狀態保持原值；畫面顯示阻擋原因且無半成功狀態。

    CourseLifecycleFeature.Blocked --> AdminCoursesPage.Init : returnBlockedAdmin | navigate /admin/courses
    %% verify: 管理員視角被阻擋返回列表後課程狀態保持原值；全站資料不出現不一致更新。
```

## ㉗ Review Decision Feature State Machine
Source Pages: AdminReviewPage

```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> ReviewDecisionFeature.Idle : enterFeature
    %% verify: 只有 submitted 課程可進入審核決策流程；非 submitted 課程不應被核准或駁回。

    ReviewDecisionFeature.Idle --> ReviewDecisionFeature.Approving : approveCourse
    %% verify: 管理員選擇核准後發送審核請求；操作期間按鈕 disabled 並避免重複核准。

    ReviewDecisionFeature.Idle --> ReviewDecisionFeature.Rejecting : rejectCourse
    %% verify: 管理員選擇駁回後必填理由再送出；未提供理由不得完成駁回。

    ReviewDecisionFeature.Approving --> ReviewDecisionFeature.Approved : approvalStored
    %% verify: API 回 200 並將課程狀態由 submitted 改為 published；CourseReview 紀錄寫入 admin_id、decision、reason 或備註、created_at。

    ReviewDecisionFeature.Approving --> ReviewDecisionFeature.Blocked : approvalBlocked
    %% verify: 非 submitted 或權限不足時核准請求被拒絕；不建立錯誤的 CourseReview 紀錄。

    ReviewDecisionFeature.Rejecting --> ReviewDecisionFeature.Rejected : rejectionStored
    %% verify: API 回 200 並將課程狀態由 submitted 改為 rejected，rejected_reason 寫入，CourseReview 紀錄保存駁回理由。

    ReviewDecisionFeature.Rejecting --> ReviewDecisionFeature.Blocked : rejectionBlocked
    %% verify: 缺少駁回理由、非法狀態或權限不足時請求被拒絕；課程狀態與 rejected_reason 維持原值。

    ReviewDecisionFeature.Approved --> AdminReviewPage.Init : returnToQueue | navigate /admin/review
    %% verify: 返回待審清單後已核准課程不再出現在 submitted 清單；公開課程列表可見該課程。

    ReviewDecisionFeature.Rejected --> AdminReviewPage.Init : returnToQueue | navigate /admin/review
    %% verify: 返回待審清單後已駁回課程不再出現在 submitted 清單；教師列表中該課程顯示 rejected 並可再修正送審。

    ReviewDecisionFeature.Blocked --> AdminReviewPage.Init : returnToQueue | navigate /admin/review
    %% verify: 被阻擋後返回待審清單時資料維持原值；不出現重複或缺漏的 submitted 課程紀錄。
```

## ㉘ Taxonomy Mutation Feature State Machine
Source Pages: AdminTaxonomyPage

```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> TaxonomyMutationFeature.Idle : enterFeature
    %% verify: 只有 Admin 可進入 taxonomy 更新流程；尚未修改分類或標籤資料。

    TaxonomyMutationFeature.Idle --> TaxonomyMutationFeature.Submitting : saveTaxonomy
    %% verify: 送出新增、編輯或停用請求時按鈕 disabled；請求會攜帶 name 與 is_active 等必要欄位。

    TaxonomyMutationFeature.Submitting --> TaxonomyMutationFeature.Saved : taxonomyStored
    %% verify: API 回 200 或 201 並正確建立或更新分類或標籤；名稱唯一性與 is_active 狀態保存成功。

    TaxonomyMutationFeature.Submitting --> TaxonomyMutationFeature.Rejected : taxonomyRejected
    %% verify: 驗證失敗或名稱衝突時顯示錯誤訊息；不建立重複名稱或錯誤停用狀態。

    TaxonomyMutationFeature.Saved --> AdminTaxonomyPage.Init : returnToTaxonomy | navigate /admin/taxonomy
    %% verify: 返回 taxonomy 頁後可見最新分類或標籤與啟用狀態；課程編輯頁之後可使用更新後資料。

    TaxonomyMutationFeature.Rejected --> AdminTaxonomyPage.Init : returnToTaxonomy | navigate /admin/taxonomy
    %% verify: 返回 taxonomy 頁後保留必要錯誤提示；既有分類與標籤資料保持一致。
```

## ㉙ User Management Feature State Machine
Source Pages: AdminUsersPage

```mermaid
%% role: Admin
stateDiagram-v2
    [*] --> UserManagementFeature.Idle : enterFeature
    %% verify: 只有 Admin 可進入使用者管理流程；尚未修改任何使用者角色或啟用狀態。

    UserManagementFeature.Idle --> UserManagementFeature.SubmittingRoleChange : changePrimaryRole
    %% verify: 發送主要角色變更請求時只接受 student、instructor、admin 三種合法值；按鈕 disabled 防止重複送出。

    UserManagementFeature.Idle --> UserManagementFeature.SubmittingActivation : changeActivation
    %% verify: 發送啟用或停用請求時只更新指定使用者的 is_active；按鈕 disabled 防止重複送出。

    UserManagementFeature.SubmittingRoleChange --> UserManagementFeature.Saved : roleStored
    %% verify: API 回 200 並更新該使用者主要角色；後續 Header 與路由權限將依新角色生效。

    UserManagementFeature.SubmittingRoleChange --> UserManagementFeature.Rejected : roleRejected
    %% verify: 非法角色值或權限不足時請求被拒絕；使用者原角色維持不變。

    UserManagementFeature.SubmittingActivation --> UserManagementFeature.Saved : activationStored
    %% verify: API 回 200 並更新該使用者 is_active；被停用帳號之後無法正常登入受保護功能。

    UserManagementFeature.SubmittingActivation --> UserManagementFeature.Rejected : activationRejected
    %% verify: 權限不足或資料不一致時請求被拒絕；使用者啟用狀態維持原值。

    UserManagementFeature.Saved --> AdminUsersPage.Init : returnToUsers | navigate /admin/users
    %% verify: 返回使用者列表後顯示最新角色與啟用狀態；使用者數量統計與列表一致。

    UserManagementFeature.Rejected --> AdminUsersPage.Init : returnToUsers | navigate /admin/users
    %% verify: 返回使用者列表後顯示錯誤提示且資料維持更新前狀態；不出現部分更新。
```