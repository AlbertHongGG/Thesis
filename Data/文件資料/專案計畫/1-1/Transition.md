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
stateDiagram-v2
    %% role: none
    [*] --> Entry.Init: enterSystem
    %% verify: public entry loads successfully, guest navigation state is active, and My Activities or Admin Panel links are not visible before authentication

    Entry.Init --> ActivityListPage.Init: continueAsGuest | navigate /activities
    %% verify: activities route loads successfully, list API returns only activities with status published or full, and guest view shows no member-only or admin-only actions

    Entry.Init --> AuthPage.Init: chooseLogin | navigate /auth
    %% verify: auth onboarding route loads successfully, email and password inputs are visible, and no token or session is created before form submission

    Entry.Init --> AuthPage.Init: chooseRegister | navigate /auth
    %% verify: auth onboarding route loads successfully, registration entry is available from the same authentication flow, and no member or admin identity is established before submission
```

## ② Page State Machine

### AuthPage
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> AuthPage.Init: enterPage
    %% verify: auth route initializes successfully, guest-only page state is kept, and no protected member or admin data is rendered

    AuthPage.Init --> AuthPage.Ready: showAuthForm
    %% verify: authentication UI renders email and password inputs, submit control is available, and no loading indicator is shown before submit

    AuthPage.Ready --> AuthFeature.Init: submitLogin | navigate AuthFeature
    %% verify: login request is sent exactly once per submit action, loading state is shown during the request, and return target is preserved when login came from a protected page

    AuthPage.Ready --> AuthFeature.Init: submitRegister | navigate AuthFeature
    %% verify: registration request is sent exactly once per submit action, loading state is shown during the request, and the UI does not allow the user to self-assign admin role
```

### ActivityListPage
```mermaid
stateDiagram-v2
    %% role: none
    %% base: ActivityListPage
    [*] --> ActivityListPage.Init: enterPage
    %% verify: activities route loads on desktop and mobile layouts without requiring login, and page initialization does not create user-specific registration data

    ActivityListPage.Init --> ActivityListPage.Ready: loadVisibleActivities
    %% verify: list API returns only published or full activities, each card shows title date location current registrations and capacity, and status text is rendered as 可報名 已報名 or 額滿 according to current user state

    ActivityListPage.Ready --> ActivityDetailPage.Init: openActivity | navigate /activities/:activityId
    %% verify: selected activity id is used in navigation and detail request, the target route matches the clicked activity, and the same activity card does not render duplicate open-detail actions

    ActivityListPage.Ready --> ActivityListPage.Member.Init: openMemberActions | navigate ActivityListPage.Member
    %% verify: authenticated member-capable view exposes My Activities entry and registered-state labels, while guest view does not expose member-only navigation

    ActivityListPage.Ready --> ActivityListPage.Admin.Init: openAdminActions | navigate ActivityListPage.Admin
    %% verify: admin-capable view exposes Admin Panel entry, and member accounts do not see admin-only navigation in the same activities list layout
```

### ActivityDetailPage
```mermaid
stateDiagram-v2
    %% role: none
    %% base: ActivityDetailPage
    [*] --> ActivityDetailPage.Init: enterPage
    %% verify: activity detail route starts with the requested activity id, page begins loading the referenced activity, and no registration mutation is executed during initialization

    ActivityDetailPage.Init --> ActivityDetailPage.Ready: loadActivity
    %% verify: detail API returns 200 for an existing visible activity, UI renders title description date location deadline capacity and status, and only one CTA area is shown on the page

    ActivityDetailPage.Init --> ActivityDetailPage.NotFound: loadMissingActivity
    %% verify: detail API returns 404 for a missing activity, not-found message is shown, and register or cancel controls are not rendered

    ActivityDetailPage.Ready --> ActivityListPage.Init: backToList | navigate /activities
    %% verify: navigation returns to the activities list route successfully, public activity visibility rules remain based on published or full status, and no stale detail-only action remains visible

    ActivityDetailPage.Ready --> AuthPage.Init: requireLoginForRegistration | navigate /auth
    %% verify: unauthenticated registration attempt is redirected to auth or receives 401, return target preserves the current activity detail route, and no registration row is created

    ActivityDetailPage.Ready --> ActivityDetailPage.Member.Init: openMemberDetailActions | navigate ActivityDetailPage.Member
    %% verify: authenticated member-capable detail view shows exactly one applicable state among register cancel or full indicator, and unavailable actions stay hidden according to status deadline event date and current registration
```

### MyActivitiesPage
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> MyActivitiesPage.Init: enterPage
    %% verify: my-activities route is addressable, access guard runs before member data is rendered, and guest state does not expose another user's registrations

    MyActivitiesPage.Init --> MyActivitiesPage.Ready: loadRegisteredActivities
    %% verify: my-activities API returns only the current user's active registrations, items are sorted by activity date, and each item shows 即將開始 or 已結束 according to activity date

    MyActivitiesPage.Init --> MyActivitiesPage.Forbidden: accessWithoutLogin
    %% verify: unauthenticated access is redirected to auth or returns 401, registered activity data is not rendered, and return target for /my-activities is preserved

    MyActivitiesPage.Ready --> ActivityDetailPage.Init: openRegisteredActivity | navigate /activities/:activityId
    %% verify: selected registered activity opens the matching detail route, current activity id is preserved, and registration status remains consistent with the user's registration record

    MyActivitiesPage.Ready --> ActivityListPage.Init: backToActivities | navigate /activities
    %% verify: navigation returns to the activities list route, member-specific registration list is not leaked into the public list view, and public visibility rules stay unchanged

    MyActivitiesPage.Forbidden --> AuthPage.Init: goToAuth | navigate /auth
    %% verify: auth onboarding opens with return target /my-activities, guest navigation remains active, and member-only or admin-only actions are still hidden before login
```

### AdminPanelPage
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> AdminPanelPage.Init: enterPage
    %% verify: admin route starts with an access check before management data is rendered, and no admin mutation control is available prior to authorization

    AdminPanelPage.Init --> AdminPanelPage.Ready: loadAdminPanel
    %% verify: admin request returns 200, management UI shows activity CRUD manual close registration registration list and CSV export actions, and these controls are visible only to admin

    AdminPanelPage.Init --> AdminPanelPage.Forbidden: accessWithoutAdmin
    %% verify: non-admin access returns 403, admin management data is hidden, and no create edit close archive or export action can be executed

    AdminPanelPage.Ready --> ActivityManagementFeature.Init: openActivityManagement | navigate ActivityManagementFeature
    %% verify: activity management workflow opens from admin panel with blank draft or selected activity context, and only one editor entry is exposed for the requested action

    AdminPanelPage.Ready --> RegistrationListFeature.Init: openRegistrationList | navigate RegistrationListFeature
    %% verify: registration list workflow opens for the selected activity, requested activity id is preserved, and only admin identity can access the underlying registration data

    AdminPanelPage.Ready --> ActivityListPage.Init: backToActivities | navigate /activities
    %% verify: leaving admin panel returns to the public activities list route, admin-only panel content is no longer displayed, and public list data remains limited to published or full activities

    AdminPanelPage.Forbidden --> ActivityListPage.Init: backToActivities | navigate /activities
    %% verify: forbidden admin access returns the user to activities list, 403-only state is cleared, and public route remains accessible according to current identity
```

## ③ Role-specific Page State

### ActivityListPage.Member
```mermaid
stateDiagram-v2
    %% role: Member|Admin
    %% extends: ActivityListPage
    [*] --> ActivityListPage.Member.Init: enterRoleView
    %% verify: member-capable activities list delta is entered from the base activities list, current page context remains /activities, and guest-only state is no longer active

    ActivityListPage.Member.Init --> ActivityListPage.Member.Ready: showMemberActions
    %% verify: My Activities entry is visible, registered badge is shown for activities already joined by the current user, and guest-only prompts are absent

    ActivityListPage.Member.Ready --> MyActivitiesPage.Init: openMyActivities | navigate /my-activities
    %% verify: authenticated user reaches only their own registrations page, no other user's registrations appear, and navigation target matches the member CTA

    ActivityListPage.Member.Ready --> ActivityListPage.Init: returnToBase | navigate /activities
    %% verify: returning to the base activities list preserves public activity visibility rules and does not render duplicate member-only CTA on the page
```

### ActivityListPage.Admin
```mermaid
stateDiagram-v2
    %% role: Admin
    %% extends: ActivityListPage
    [*] --> ActivityListPage.Admin.Init: enterRoleView
    %% verify: admin activities list delta is entered from the base activities list, current page context remains /activities, and admin identity is already established

    ActivityListPage.Admin.Init --> ActivityListPage.Admin.Ready: showAdminActions
    %% verify: Admin Panel entry is visible together with public activity content, and admin-only controls do not appear for member identities

    ActivityListPage.Admin.Ready --> AdminPanelPage.Init: openAdminPanel | navigate /admin
    %% verify: admin route opens successfully for admin identity, admin panel returns 200, and management actions become available only in this role-specific branch

    ActivityListPage.Admin.Ready --> ActivityListPage.Init: returnToBase | navigate /activities
    %% verify: returning to the base activities list keeps public cards intact and removes admin-only action emphasis from the current view
```

### ActivityDetailPage.Member
```mermaid
stateDiagram-v2
    %% role: Member|Admin
    %% extends: ActivityDetailPage
    [*] --> ActivityDetailPage.Member.Init: enterRoleView
    %% verify: authenticated activity detail delta is entered from the base detail page, current activity id is preserved, and guest-only registration redirect is no longer the active branch

    ActivityDetailPage.Member.Init --> ActivityDetailPage.Member.Ready: showAvailableRegistrationAction
    %% verify: exactly one applicable control is shown among register cancel registration or full indicator according to status deadline activity date and current registration record

    ActivityDetailPage.Member.Ready --> RegistrationFeature.Init: clickRegister | navigate RegistrationFeature
    %% verify: register action is available only when activity status is published, deadline has not passed, event has not ended, and the current user has no active registration for the same activity

    ActivityDetailPage.Member.Ready --> RegistrationFeature.Init: clickCancelRegistration | navigate RegistrationFeature
    %% verify: cancel action is available only when the current user has an active registration and both deadline and activity date still allow cancellation, and hidden otherwise

    ActivityDetailPage.Member.Ready --> ActivityDetailPage.Init: returnToBase | navigate /activities/:activityId
    %% verify: returning to the base detail page preserves the same activity id, detail data stays consistent, and no duplicate registration CTA is rendered
```

## ④ Feature / Function State Machine

### AuthFeature
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> AuthFeature.Init: enterFeature
    %% verify: auth workflow starts only from AuthPage submission, no identity token or session exists before completion, and return target context is available for protected-route recovery

    AuthFeature.Init --> AuthFeature.SubmittingLogin: submitLogin
    %% verify: login request is sent exactly once, loading indicator is shown during submission, and duplicate submit is blocked until the response completes

    AuthFeature.Init --> AuthFeature.SubmittingRegister: submitRegister
    %% verify: registration request is sent exactly once, loading indicator is shown during submission, and the request path does not allow assigning admin role from the client

    AuthFeature.SubmittingLogin --> AuthFeature.MemberDone: loginSucceededMember
    %% verify: auth API returns 200 with member identity, token or session is stored successfully, and member-only routes become accessible after completion

    AuthFeature.SubmittingLogin --> AuthFeature.AdminDone: loginSucceededAdmin
    %% verify: auth API returns 200 with admin identity, token or session is stored successfully, and admin-only routes become accessible after completion

    AuthFeature.SubmittingLogin --> AuthFeature.Failed: loginFailed
    %% verify: auth API returns 401, token or session is not created, error prompt is shown, and submit control becomes available again for retry

    AuthFeature.SubmittingRegister --> AuthFeature.MemberDone: registerSucceeded
    %% verify: account creation completes successfully, resulting identity is member rather than admin, and authenticated state is established for post-register navigation

    AuthFeature.Failed --> AuthPage.Init: retryAuth | navigate /auth
    %% verify: auth page reopens for another attempt, protected content is still hidden, and no stale authenticated navigation item appears before successful authentication

    AuthFeature.MemberDone --> ActivityListPage.Init: authSucceededToActivities | navigate /activities
    %% verify: member landing opens the activities list with authenticated UI, My Activities entry becomes visible, and public activity visibility remains limited to published or full

    AuthFeature.MemberDone --> MyActivitiesPage.Init: authSucceededReturnMyActivities | navigate /my-activities
    %% verify: protected member route opens after successful auth, only current user's registrations are returned, and return target is cleared after navigation completes

    AuthFeature.MemberDone --> ActivityDetailPage.Init: authSucceededReturnActivityDetail | navigate /activities/:activityId
    %% verify: original activity detail route is reopened after successful auth, current activity id is preserved, and member-capable registration CTA can now be evaluated against current registration state

    AuthFeature.AdminDone --> AdminPanelPage.Init: authSucceededReturnAdminPanel | navigate /admin
    %% verify: protected admin route opens after successful auth, admin panel returns 200, and admin mutation controls are visible only for admin identity

    AuthFeature.AdminDone --> ActivityListPage.Init: authSucceededToActivities | navigate /activities
    %% verify: authenticated admin can also land on the public activities list, Admin Panel entry becomes visible, and public activity visibility still remains limited to published or full
```

### RegistrationFeature
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> RegistrationFeature.Init: enterFeature
    %% verify: registration workflow starts from authenticated activity detail actions, current activity id and current user id are available, and no mutation has been committed yet

    RegistrationFeature.Init --> RegistrationFeature.SubmittingRegister: submitRegistration
    %% verify: registration API request is sent exactly once, duplicate click is blocked during submission, and request includes current user and activity identifiers

    RegistrationFeature.Init --> RegistrationFeature.SubmittingCancel: submitCancellation
    %% verify: cancellation API request is sent exactly once, duplicate click is blocked during submission, and request targets the current user's active registration for the activity

    RegistrationFeature.SubmittingRegister --> RegistrationFeature.Registered: registerSucceeded
    %% verify: registration API returns 200, transaction or atomic operation prevents oversell, exactly one active registration exists per user and activity, current registrations count increments by one, and activity status switches to full immediately when count reaches capacity

    RegistrationFeature.SubmittingRegister --> RegistrationFeature.Blocked: registerRejected
    %% verify: registration is rejected when activity status is not published, capacity is already full, deadline has passed, activity date has passed, or duplicate active registration exists, and current registrations count does not change

    RegistrationFeature.SubmittingCancel --> RegistrationFeature.Canceled: cancelSucceeded
    %% verify: cancellation API returns 200, target registration receives canceled_at, current registrations count decrements by one, and activity status returns from full to published when capacity becomes available

    RegistrationFeature.SubmittingCancel --> RegistrationFeature.Blocked: cancelRejected
    %% verify: cancellation is rejected when no active registration exists, deadline has passed, or activity date has passed, and current registrations count plus activity status stay unchanged

    RegistrationFeature.Registered --> ActivityDetailPage.Init: returnToDetailAfterRegister | navigate /activities/:activityId
    %% verify: detail page reloads the same activity, CTA changes from register to cancel or full indicator according to latest status, and displayed count matches persisted registration data

    RegistrationFeature.Registered --> ActivityListPage.Init: syncListAfterRegister | navigate /activities
    %% verify: activities list reflects updated registration badge and current registrations count for the same activity, and no duplicate active registration is shown for the current user

    RegistrationFeature.Canceled --> ActivityDetailPage.Init: returnToDetailAfterCancel | navigate /activities/:activityId
    %% verify: detail page reloads the same activity, cancel CTA disappears, register CTA reappears only when status is published and time rules still allow it, and displayed count matches persisted data

    RegistrationFeature.Canceled --> ActivityListPage.Init: syncListAfterCancel | navigate /activities
    %% verify: activities list reflects released capacity, registered badge is removed for the canceled activity, and public visibility still depends only on published or full status

    RegistrationFeature.Blocked --> ActivityDetailPage.Init: returnToDetailWithCurrentState | navigate /activities/:activityId
    %% verify: detail page shows unchanged registration availability state, no extra registration row is created or canceled, and count plus activity status remain consistent with server data
```

### ActivityManagementFeature
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> ActivityManagementFeature.Init: enterFeature
    %% verify: admin activity management workflow opens from admin panel, admin identity is required before any mutation, and selected activity context or blank draft context is preserved

    ActivityManagementFeature.Init --> ActivityManagementFeature.DraftSaved: createOrUpdateDraft
    %% verify: draft save API returns 200, title description date location deadline capacity and status fields are persisted, date is later than deadline, capacity is a positive integer, and create or update operation is recorded in the audit log

    ActivityManagementFeature.DraftSaved --> ActivityManagementFeature.Published: publishActivity
    %% verify: publish API returns 200, activity status becomes published, and the activity appears in the public list with title date location current registrations and capacity

    ActivityManagementFeature.Published --> ActivityManagementFeature.Full: reachCapacity
    %% verify: current registrations count equals capacity, activity status changes automatically to full, and both list and detail views stop offering register action

    ActivityManagementFeature.Full --> ActivityManagementFeature.Published: capacityReleased
    %% verify: after a valid cancellation releases one slot, activity status returns to published, list and detail views allow registration again, and counts stay consistent

    ActivityManagementFeature.Published --> ActivityManagementFeature.Closed: closeRegistration
    %% verify: close action API returns 200, activity status becomes closed, new registration requests are rejected, and existing registration records remain queryable to admin

    ActivityManagementFeature.Full --> ActivityManagementFeature.Closed: closeRegistration
    %% verify: close action API returns 200 from full state, activity status becomes closed, new registration requests remain rejected, and current registrations count is unchanged by the status change

    ActivityManagementFeature.Closed --> ActivityManagementFeature.Archived: archiveActivity
    %% verify: archive API returns 200, activity status becomes archived, and the activity is removed from the public activities list

    ActivityManagementFeature.DraftSaved --> ActivityManagementFeature.Archived: archiveActivity
    %% verify: archive API returns 200 for a draft activity, the activity stays hidden from the public list, and admin audit history still records the archive action

    ActivityManagementFeature.DraftSaved --> AdminPanelPage.Init: returnToAdminPanel | navigate /admin
    %% verify: admin panel reloads with the draft activity visible only in admin management data, and the public activities list still excludes the draft activity

    ActivityManagementFeature.Published --> AdminPanelPage.Init: returnToAdminPanel | navigate /admin
    %% verify: admin panel reloads with updated published status visible in management data, and admin-only controls remain available to the same admin identity

    ActivityManagementFeature.Closed --> AdminPanelPage.Init: returnToAdminPanel | navigate /admin
    %% verify: admin panel reloads with closed status shown in management data, and further registration-close action is no longer offered for the same activity

    ActivityManagementFeature.Archived --> AdminPanelPage.Init: returnToAdminPanel | navigate /admin
    %% verify: admin panel reloads with archived status reflected in management data, and the public activities list no longer contains the activity
```

### RegistrationListFeature
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> RegistrationListFeature.Init: enterFeature
    %% verify: registration list workflow opens only from admin panel with selected activity context, and non-admin identities cannot load this feature

    RegistrationListFeature.Init --> RegistrationListFeature.Ready: loadRegistrations
    %% verify: registrations API returns 200, rows include name email and registration time for the selected activity only, and no unrelated activity registrations are included

    RegistrationListFeature.Ready --> RegistrationListFeature.Exporting: exportCsv
    %% verify: export request is sent for the selected activity only, CSV generation starts from an admin-only action, and exported data source matches the currently viewed registration list

    RegistrationListFeature.Exporting --> RegistrationListFeature.Ready: exportCompleted
    %% verify: CSV file is generated successfully, exported columns include name email and registration time, and exported row count matches the current registration list for the activity

    RegistrationListFeature.Ready --> AdminPanelPage.Init: backToAdminPanel | navigate /admin
    %% verify: admin panel route reloads successfully, selected activity management context remains available for further actions, and registration list data is no longer shown outside admin context
```
