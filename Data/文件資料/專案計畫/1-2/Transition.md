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
    [*] --> Entry.Init
    %% verify: app entry is reachable from a cold start and no authenticated page content is rendered before identity is obtained

    Entry.Init --> LoginPage.Init: choose_login | navigate /login
    %% verify: Login page is shown as the only authentication entry, no employee or manager data is requested yet, and UI displays email/password fields
```

## ② Login Page
```mermaid
stateDiagram-v2
    %% role: none
    [*] --> LoginPage.Init
    %% verify: LoginPage.Init is the single entry state for login navigation and page chrome shows no employee-only or manager-only actions

    LoginPage.Init --> LoginPage.Ready: show_login_form
    %% verify: login form renders email and password inputs, submit button is enabled only when required fields are present, and no leave data is shown

    LoginPage.Ready --> AuthLoginFeature.Init: submit_credentials | navigate AuthLoginFeature
    %% verify: submitting sends email and password once, login button enters loading state to prevent double-submit, and credentials are passed only to the auth API
```

## ③ Auth Login Feature
Source Pages: LoginPage

```mermaid
stateDiagram-v2
    %% role: none
    [*] --> AuthLoginFeature.Init
    %% verify: AuthLoginFeature.Init is reachable only from LoginPage and starts with no persisted employee or manager leave data in feature state

    AuthLoginFeature.Init --> AuthLoginFeature.Submitting: start_login
    %% verify: POST /auth/login is issued once with email and password, loading indicator remains visible, and duplicate submits are blocked until a response returns

    AuthLoginFeature.Submitting --> AuthLoginFeature.EmployeeAuthenticated: login_success_employee
    %% verify: POST /auth/login returns 200, session or token is stored, response role=employee, and no manager-only permission is granted in client state

    AuthLoginFeature.Submitting --> AuthLoginFeature.ManagerAuthenticated: login_success_manager
    %% verify: POST /auth/login returns 200, session or token is stored, response role=manager, and manager approval scope metadata is available for later guarded pages

    AuthLoginFeature.Submitting --> AuthLoginFeature.Failed: login_failed
    %% verify: POST /auth/login returns 401 for invalid credentials or a failure response, error message is shown inline, password field is cleared or masked, and no session is stored

    AuthLoginFeature.Failed --> LoginPage.Init: back_to_login | navigate /login
    %% verify: Login page is restored with email retained when allowed, previous auth error remains visible until the next submit, and no protected page is entered

    AuthLoginFeature.EmployeeAuthenticated --> MyLeavePage.Init: login_done_employee | navigate /my-leaves
    %% verify: authenticated employee lands on My Leave page, GET my leave list returns only the employee's own requests, and manager-only navigation stays hidden

    AuthLoginFeature.ManagerAuthenticated --> MyLeavePage.Init: login_done_manager | navigate /my-leaves
    %% verify: authenticated manager lands on My Leave page, own leave list loads successfully, and manager-only navigation for pending approvals and department calendar is visible exactly once

    AuthLoginFeature.EmployeeAuthenticated --> LeaveRequestDetailPage.Init: login_return_detail | navigate /leave-requests/:id
    %% verify: when returnTo targets an owned request detail, GET /leave-requests/:id returns 200, detail data belongs to the authenticated employee, and unauthorized requests do not load

    AuthLoginFeature.EmployeeAuthenticated --> LeaveBalancePage.Init: login_return_balance | navigate /leave-balance
    %% verify: when returnTo targets Leave Balance, GET /leave-balance returns 200 and each leave type shows quota, used, reserved, and available values for the employee

    AuthLoginFeature.ManagerAuthenticated --> PendingApprovalsPage.Init: login_return_approvals | navigate /manager/approvals
    %% verify: when returnTo targets Pending Approvals, GET pending approvals returns 200 and only submitted requests inside the manager scope are returned

    AuthLoginFeature.ManagerAuthenticated --> DepartmentCalendarPage.Init: login_return_calendar | navigate /manager/calendar
    %% verify: when returnTo targets Department Calendar, GET calendar returns 200 with in-scope submitted or approved events only and employee-private out-of-scope events are not exposed
```

## ④ 我的請假頁（My Leave Page）Base
```mermaid
stateDiagram-v2
    %% role: none
    %% base: MyLeavePage
    [*] --> MyLeavePage.Init
    %% verify: MyLeavePage.Init is reachable from login success and back navigation from protected pages, and the page starts without stale filter or row-selection corruption

    MyLeavePage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo=/my-leaves is preserved, and no leave list data is rendered

    MyLeavePage.Init --> MyLeavePage.Ready: load_my_leaves
    %% verify: GET /leave-requests?mine=true returns 200, rows belong only to the current user, default sorting is start_date DESC or the configured default, and statuses show draft/submitted/approved/rejected/cancelled accurately

    MyLeavePage.Init --> MyLeavePage.Failed: load_failed
    %% verify: non-success list loading shows a recoverable failure state, previous rows are not displayed as if current, and retry remains available

    MyLeavePage.Ready --> MyLeavePage.Employee.Init: enter_employee_flow | navigate MyLeavePage.Employee
    %% verify: employee view exposes filters, create request, detail navigation, and leave balance navigation only; pending approvals and department calendar actions are hidden

    MyLeavePage.Ready --> MyLeavePage.Manager.Init: enter_manager_flow | navigate MyLeavePage.Manager
    %% verify: manager view includes all employee actions plus pending approvals and department calendar navigation, and no duplicate CTA is rendered for the same destination

    MyLeavePage.Failed --> MyLeavePage.Init: retry_load
    %% verify: retry triggers one new list request, successful retry restores the list, and failed retry stays in a recoverable failure state
```

## ⑤ 我的請假頁（My Leave Page）Employee Delta
```mermaid
stateDiagram-v2
    %% role: Employee
    %% extends: MyLeavePage
    [*] --> MyLeavePage.Employee.Init
    %% verify: Employee delta is entered only from MyLeavePage.Ready with role=employee and all visible requests still belong to the current employee

    MyLeavePage.Employee.Init --> MyLeavePage.Employee.Browsing: show_employee_actions
    %% verify: filter controls, request rows, status badges, and create-request CTA are visible, and no manager-only approval controls appear

    MyLeavePage.Employee.Browsing --> LeaveRequestDetailPage.Init: open_request | navigate /leave-requests/:id
    %% verify: selecting a row opens owned request detail, GET /leave-requests/:id returns 200 for the employee's own request, and other employees' requests remain inaccessible with 403 or 404

    MyLeavePage.Employee.Browsing --> LeaveRequestFormPage.Init: create_request | navigate /leave-requests/new
    %% verify: create action opens a blank leave request form with available leave types loaded, initial status implied as draft, and days field remains system-calculated and read-only

    MyLeavePage.Employee.Browsing --> LeaveBalancePage.Init: open_leave_balance | navigate /leave-balance
    %% verify: leave balance page opens successfully, each leave type shows quota, used, reserved, and available values, and available equals quota minus used minus reserved

    MyLeavePage.Employee.Browsing --> MyLeavePage.Init: refresh_my_leaves | navigate /my-leaves
    %% verify: refresh returns to MyLeavePage.Init, one list reload occurs, and current filter choices are preserved when supported by the UI
```

## ⑥ 我的請假頁（My Leave Page）Manager Delta
```mermaid
stateDiagram-v2
    %% role: Manager
    %% extends: MyLeavePage
    [*] --> MyLeavePage.Manager.Init
    %% verify: Manager delta is entered only from MyLeavePage.Ready with role=manager and the base list still contains only the manager's own leave requests

    MyLeavePage.Manager.Init --> MyLeavePage.Manager.Browsing: show_manager_actions
    %% verify: employee actions remain available to the manager, pending approvals and department calendar CTAs are visible, and each CTA appears only once

    MyLeavePage.Manager.Browsing --> LeaveRequestDetailPage.Init: open_own_request | navigate /leave-requests/:id
    %% verify: manager can still open their own leave detail through My Leave, GET /leave-requests/:id returns 200 for owned requests, and approver-only actions are not shown unless the request is in approver scope and submitted

    MyLeavePage.Manager.Browsing --> LeaveRequestFormPage.Init: create_request | navigate /leave-requests/new
    %% verify: manager can create their own leave request, form loads leave types and validation rules, and no subordinate employee data is editable from this flow

    MyLeavePage.Manager.Browsing --> LeaveBalancePage.Init: open_leave_balance | navigate /leave-balance
    %% verify: manager's own leave balances load successfully and values are scoped to the manager as an employee account, not to department totals

    MyLeavePage.Manager.Browsing --> PendingApprovalsPage.Init: open_pending_approvals | navigate /manager/approvals
    %% verify: pending approvals page loads only for managers, returned rows are status=submitted, and each row belongs to the manager's allowed department or direct-report scope

    MyLeavePage.Manager.Browsing --> DepartmentCalendarPage.Init: open_department_calendar | navigate /manager/calendar
    %% verify: department calendar loads manager-scope events only, approved events are shown, submitted events appear only when enabled, and status styling differentiates submitted versus approved

    MyLeavePage.Manager.Browsing --> MyLeavePage.Init: refresh_my_leaves | navigate /my-leaves
    %% verify: refresh returns to MyLeavePage.Init, own leave list reloads once, and manager-only menu visibility is preserved after reload
```

## ⑦ 請假詳情頁（Leave Request Detail Page）Base
```mermaid
stateDiagram-v2
    %% role: none
    %% base: LeaveRequestDetailPage
    [*] --> LeaveRequestDetailPage.Init
    %% verify: LeaveRequestDetailPage.Init is reachable from My Leave, Pending Approvals, and authenticated returnTo flows, and no stale detail data leaks from a previously viewed request

    LeaveRequestDetailPage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo stores the requested detail route, and request content is not rendered

    LeaveRequestDetailPage.Init --> LeaveRequestDetailPage.Ready: load_detail
    %% verify: GET /leave-requests/:id returns 200 only for the owner or an in-scope manager, UI shows leave type, dates, days, reason, attachment, status, and audit fields that exist for the current state

    LeaveRequestDetailPage.Init --> LeaveRequestDetailPage.Failed: load_denied_or_missing
    %% verify: 403 or 404 results in a safe failure state, sensitive leave details are not displayed, and the user is offered navigation back to an authorized page

    LeaveRequestDetailPage.Ready --> LeaveRequestDetailPage.Employee.Init: view_as_employee | navigate LeaveRequestDetailPage.Employee
    %% verify: owner view exposes only actions allowed to employees for the current status, and manager-only approve or reject controls remain hidden

    LeaveRequestDetailPage.Ready --> LeaveRequestDetailPage.Manager.Init: view_as_manager | navigate LeaveRequestDetailPage.Manager
    %% verify: approver view is entered only when the viewer is a manager with request scope, employee identity fields are visible, and approve or reject controls appear only for status=submitted

    LeaveRequestDetailPage.Failed --> MyLeavePage.Init: back_to_safe_page | navigate /my-leaves
    %% verify: safe navigation returns to My Leave without exposing forbidden request data, and the application remains usable after the failure state
```

## ⑧ 請假詳情頁（Leave Request Detail Page）Employee Delta
```mermaid
stateDiagram-v2
    %% role: Employee
    %% extends: LeaveRequestDetailPage
    [*] --> LeaveRequestDetailPage.Employee.Init
    %% verify: Employee delta is entered only for the request owner and all displayed fields remain scoped to that employee's own request

    LeaveRequestDetailPage.Employee.Init --> LeaveRequestDetailPage.Employee.Viewing: show_employee_detail_actions
    %% verify: draft shows edit and submit actions, submitted shows cancel action, approved or rejected or cancelled are view-only, and action buttons match the current status exactly

    LeaveRequestDetailPage.Employee.Viewing --> LeaveRequestFormPage.Init: edit_draft | navigate /leave-requests/:id/edit
    %% verify: edit is available only when status=draft, edit route opens the existing draft values, and submitted or terminal statuses cannot enter the edit form

    LeaveRequestDetailPage.Employee.Viewing --> LeaveRequestStatusFeature.Init: submit_request | navigate LeaveRequestStatusFeature
    %% verify: submit is available only when status=draft, submission must validate date order, overlap rules, available quota, and attachment requirement before any status change is committed

    LeaveRequestDetailPage.Employee.Viewing --> LeaveRequestStatusFeature.Init: cancel_submitted | navigate LeaveRequestStatusFeature
    %% verify: cancel is available only when status=submitted and viewer is owner, no approve or reject action is triggered, and the request remains unchanged until cancellation succeeds

    LeaveRequestDetailPage.Employee.Viewing --> MyLeavePage.Init: back_to_my_leaves | navigate /my-leaves
    %% verify: back navigation returns to My Leave and list-level filters or sort remain preserved when supported by the UI
```

## ⑨ 請假詳情頁（Leave Request Detail Page）Manager Delta
```mermaid
stateDiagram-v2
    %% role: Manager
    %% extends: LeaveRequestDetailPage
    [*] --> LeaveRequestDetailPage.Manager.Init
    %% verify: Manager delta is entered only for an in-scope manager and the page includes employee name, department, leave dates, days, reason, attachment, and current status

    LeaveRequestDetailPage.Manager.Init --> LeaveRequestDetailPage.Manager.Reviewing: show_manager_detail_actions
    %% verify: approve and reject actions appear only when status=submitted, approved or rejected requests show audit records only, and out-of-scope managers do not reach this view

    LeaveRequestDetailPage.Manager.Reviewing --> LeaveRequestStatusFeature.Init: approve_request | navigate LeaveRequestStatusFeature
    %% verify: approve action is allowed only for manager role with request scope and status=submitted, duplicate approval clicks are blocked, and irreversible decision rules are enforced

    LeaveRequestDetailPage.Manager.Reviewing --> LeaveRequestStatusFeature.Init: reject_request | navigate LeaveRequestStatusFeature
    %% verify: reject action requires a non-empty rejection reason before request submission, manager scope is revalidated server-side, and no status change occurs until rejection succeeds

    LeaveRequestDetailPage.Manager.Reviewing --> PendingApprovalsPage.Init: back_to_pending_approvals | navigate /manager/approvals
    %% verify: returning to pending approvals restores an authorized page, and recently decided items disappear from the submitted-only queue after reload
```

## ⑩ 請假表單頁（Leave Request Form Page）
```mermaid
stateDiagram-v2
    %% role: Employee|Manager
    [*] --> LeaveRequestFormPage.Init
    %% verify: LeaveRequestFormPage.Init is reachable from create-request or draft-edit actions only and no terminal-status request is editable through this page

    LeaveRequestFormPage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo stores the form route, and editable request data is not exposed

    LeaveRequestFormPage.Init --> LeaveRequestFormPage.Ready: load_form_context
    %% verify: leave types load successfully, existing draft values load when editing, days remains system-calculated and read-only, and attachment requirement metadata is available per leave type

    LeaveRequestFormPage.Init --> LeaveRequestFormPage.Failed: load_form_failed
    %% verify: form context failure shows a recoverable failure state, stale draft values are not treated as saved, and retry or safe back navigation remains available

    LeaveRequestFormPage.Ready --> LeaveRequestEditFeature.Init: open_form_editor | navigate LeaveRequestEditFeature
    %% verify: form editor receives current field values, supports create and draft-edit flows only, and all validation rules remain tied to the selected leave type and date range

    LeaveRequestFormPage.Ready --> MyLeavePage.Init: cancel_form | navigate /my-leaves
    %% verify: cancel leaves persisted data unchanged, no new request is created implicitly, and the user returns to My Leave safely

    LeaveRequestFormPage.Failed --> MyLeavePage.Init: back_to_my_leaves | navigate /my-leaves
    %% verify: safe navigation returns to My Leave without committing any form changes and the application remains usable after the form failure state
```

## ⑪ 請假表單編輯功能（Leave Request Edit Feature）
Source Pages: LeaveRequestFormPage

```mermaid
stateDiagram-v2
    %% role: Employee|Manager
    [*] --> LeaveRequestEditFeature.Init
    %% verify: LeaveRequestEditFeature.Init starts from the form page only and carries the current draft or new-request context without mutating server data yet

    LeaveRequestEditFeature.Init --> LeaveRequestEditFeature.Editing: enter_editor
    %% verify: editable fields include leave type, start date, end date, reason, and attachment; days preview is calculated by the system and cannot be manually typed over

    LeaveRequestEditFeature.Editing --> LeaveRequestEditFeature.AttachmentUpdating: update_attachment
    %% verify: attachment add or replace action updates only the attachment field, file upload progress or result is visible, and required-attachment leave types still enforce presence before submit

    LeaveRequestEditFeature.AttachmentUpdating --> LeaveRequestEditFeature.Editing: attachment_updated
    %% verify: uploaded attachment reference is reflected in the form, failed uploads do not mark attachment as present, and the user can continue editing other fields

    LeaveRequestEditFeature.Editing --> LeaveRequestEditFeature.SavingDraft: save_draft
    %% verify: saving draft sends current form values without changing status beyond draft, server recalculates days from company workday rules, and no quota reservation is created on draft save

    LeaveRequestEditFeature.SavingDraft --> LeaveRequestDetailPage.Init: draft_saved | navigate /leave-requests/:id
    %% verify: save draft API returns 200, request status remains draft, updated fields and recalculated days persist, and detail page reflects the latest saved values

    LeaveRequestEditFeature.SavingDraft --> LeaveRequestEditFeature.Editing: draft_save_failed
    %% verify: save failure leaves the user in edit mode, inline or form-level errors are shown, and unsaved local inputs remain available for correction

    LeaveRequestEditFeature.Editing --> LeaveRequestStatusFeature.Init: submit_request | navigate LeaveRequestStatusFeature
    %% verify: submit action leaves the form editor only after client-side required fields are present, server-side validation for dates, overlap, quota, and attachment is still required, and duplicate submit clicks are prevented

    LeaveRequestEditFeature.Editing --> LeaveRequestFormPage.Init: cancel_edit | navigate /leave-requests/new
    %% verify: cancel returns to the form page entry state, no unsaved edits are persisted, and the user can safely navigate away without altering stored draft data
```

## ⑫ 剩餘假期頁（Leave Balance Page）
```mermaid
stateDiagram-v2
    %% role: Employee|Manager
    [*] --> LeaveBalancePage.Init
    %% verify: LeaveBalancePage.Init is reachable from My Leave or authenticated returnTo and starts with no stale balance totals from another user

    LeaveBalancePage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo=/leave-balance is preserved, and no balance values are shown

    LeaveBalancePage.Init --> LeaveBalancePage.Ready: load_balances
    %% verify: GET /leave-balance returns 200, every leave type shows annual quota, used, reserved, and available, and available equals quota minus used minus reserved for each record

    LeaveBalancePage.Init --> LeaveBalancePage.Failed: load_balances_failed
    %% verify: balance load failure shows a recoverable failure state, stale totals are not displayed as current, and retry remains possible

    LeaveBalancePage.Ready --> MyLeavePage.Init: back_to_my_leaves | navigate /my-leaves
    %% verify: navigation returns to My Leave safely and no balance mutation occurs during the page change

    LeaveBalancePage.Ready --> LeaveBalancePage.Init: refresh_balances | navigate /leave-balance
    %% verify: refresh triggers exactly one new balance request and updated submitted, approved, rejected, or cancelled effects appear in quota totals after reload

    LeaveBalancePage.Failed --> LeaveBalancePage.Init: retry_load
    %% verify: retry reissues the balance request once and successful retry restores current balance values for the authenticated user
```

## ⑬ 待審核頁（Pending Approvals Page）
```mermaid
stateDiagram-v2
    %% role: Manager
    [*] --> PendingApprovalsPage.Init
    %% verify: PendingApprovalsPage.Init is reachable only from manager navigation or authorized returnTo and no approval data is shown before scope checks complete

    PendingApprovalsPage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo=/manager/approvals is preserved, and no pending-approval data is exposed

    PendingApprovalsPage.Init --> MyLeavePage.Init: forbid_non_manager | navigate /my-leaves
    %% verify: authenticated non-manager access is denied with 403 semantics, user is redirected to My Leave, and no manager-only approval queue is displayed

    PendingApprovalsPage.Init --> PendingApprovalsPage.Ready: load_pending_approvals
    %% verify: GET pending approvals returns 200, every row is status=submitted, rows are limited to the manager's department or direct-report scope, and sorting or filters are applied when configured

    PendingApprovalsPage.Init --> PendingApprovalsPage.Failed: load_pending_failed
    %% verify: loading failure shows a recoverable failure state, previously fetched subordinate data is not reused as fresh data, and retry remains available

    PendingApprovalsPage.Ready --> LeaveRequestDetailPage.Init: open_pending_request | navigate /leave-requests/:id
    %% verify: opening a row leads to request detail only for in-scope requests, detail API returns 200 for authorized managers, and out-of-scope records do not open

    PendingApprovalsPage.Ready --> DepartmentCalendarPage.Init: open_department_calendar | navigate /manager/calendar
    %% verify: manager can switch to department calendar, calendar data stays within the same approval scope, and submitted or approved status markers remain distinguishable

    PendingApprovalsPage.Ready --> MyLeavePage.Init: back_to_my_leaves | navigate /my-leaves
    %% verify: navigation returns to My Leave safely and the manager's own leave list remains separate from subordinate approval data

    PendingApprovalsPage.Failed --> PendingApprovalsPage.Init: retry_load
    %% verify: retry issues one new pending-approvals request and successful retry restores only current in-scope submitted items
```

## ⑭ 部門請假日曆頁（Department Calendar Page）
```mermaid
stateDiagram-v2
    %% role: Manager
    [*] --> DepartmentCalendarPage.Init
    %% verify: DepartmentCalendarPage.Init is reachable only from manager navigation or authorized returnTo and no department leave event is shown before scope validation completes

    DepartmentCalendarPage.Init --> LoginPage.Init: require_login | navigate /login
    %% verify: unauthenticated access redirects to Login page, API returns 401 or no session, returnTo=/manager/calendar is preserved, and no calendar event data is exposed

    DepartmentCalendarPage.Init --> MyLeavePage.Init: forbid_non_manager | navigate /my-leaves
    %% verify: authenticated non-manager access is denied with 403 semantics, user is redirected to My Leave, and manager-only calendar data stays hidden

    DepartmentCalendarPage.Init --> DepartmentCalendarPage.Ready: load_department_calendar
    %% verify: calendar API returns 200, events are limited to the manager's allowed department or direct-report scope, approved events are shown, and submitted events appear only when the product setting allows them with distinct styling

    DepartmentCalendarPage.Init --> DepartmentCalendarPage.Failed: load_calendar_failed
    %% verify: calendar loading failure shows a recoverable failure state, stale department events are not displayed as current, and retry remains available

    DepartmentCalendarPage.Ready --> LeaveRequestDetailPage.Init: open_calendar_request | navigate /leave-requests/:id
    %% verify: clicking a calendar event opens detail only when the manager has access, detail API returns 200 for authorized events, and out-of-scope event details remain inaccessible with 403 or 404

    DepartmentCalendarPage.Ready --> PendingApprovalsPage.Init: back_to_pending_approvals | navigate /manager/approvals
    %% verify: returning to pending approvals preserves manager-only access control and the submitted-only queue can be reloaded without mixing calendar-only state

    DepartmentCalendarPage.Ready --> MyLeavePage.Init: back_to_my_leaves | navigate /my-leaves
    %% verify: navigation returns to the manager's own My Leave page and no department event data remains visible after leaving the calendar

    DepartmentCalendarPage.Failed --> DepartmentCalendarPage.Init: retry_load
    %% verify: retry issues one new calendar request and successful retry restores the current in-scope department events
```

## ⑮ 請假狀態功能（Leave Request Status Feature）
Source Pages: LeaveRequestDetailPage.Employee, LeaveRequestDetailPage.Manager, LeaveRequestEditFeature

```mermaid
stateDiagram-v2
    %% role: Employee|Manager
    [*] --> LeaveRequestStatusFeature.Init
    %% verify: LeaveRequestStatusFeature.Init is entered only from a page or feature action that intends to submit, cancel, approve, or reject a single leave request

    LeaveRequestStatusFeature.Init --> LeaveRequestStatusFeature.Submitting: begin_submit
    %% verify: submit path applies only to draft requests, server validates end_date >= start_date, overlap against draft or submitted or approved requests for the same employee, available quota >= requested days, and required attachments are present

    LeaveRequestStatusFeature.Init --> LeaveRequestStatusFeature.Cancelling: begin_cancel
    %% verify: cancel path applies only to submitted requests owned by the current employee, approved or rejected requests are blocked, and request state is unchanged until cancellation succeeds

    LeaveRequestStatusFeature.Init --> LeaveRequestStatusFeature.Approving: begin_approve
    %% verify: approve path applies only to status=submitted and an in-scope manager, irreversible-decision rules are enforced, and repeated approval requests are rejected rather than double-processing

    LeaveRequestStatusFeature.Init --> LeaveRequestStatusFeature.Rejecting: begin_reject
    %% verify: reject path applies only to status=submitted and an in-scope manager, a non-empty rejection reason is required, and no partial decision is stored before validation passes

    LeaveRequestStatusFeature.Submitting --> LeaveBalanceSyncFeature.Init: submit_persisted | navigate LeaveBalanceSyncFeature
    %% verify: request status becomes submitted, submitted_at is set, approval log records action=submit, and balance synchronization starts for reserve processing in the same business flow

    LeaveRequestStatusFeature.Submitting --> LeaveRequestDetailPage.Init: submit_denied | navigate /leave-requests/:id
    %% verify: validation failure returns 409 or 422, status remains draft, submitted_at is not set, reserved_days is unchanged, and detail page shows actionable validation errors

    LeaveRequestStatusFeature.Cancelling --> LeaveBalanceSyncFeature.Init: cancel_persisted | navigate LeaveBalanceSyncFeature
    %% verify: request status becomes cancelled, cancelled_at is set, approval log records action=cancel, and balance synchronization starts for releasing reserved quota

    LeaveRequestStatusFeature.Cancelling --> LeaveRequestDetailPage.Init: cancel_denied | navigate /leave-requests/:id
    %% verify: denied cancellation returns 409 or 403, status remains submitted, cancelled_at stays empty, and reserved quota is not released

    LeaveRequestStatusFeature.Approving --> LeaveBalanceSyncFeature.Init: approve_persisted | navigate LeaveBalanceSyncFeature
    %% verify: request status becomes approved, approver_id and decided_at are set, approval log records action=approve, and balance synchronization starts for reserved-to-used conversion

    LeaveRequestStatusFeature.Approving --> LeaveRequestDetailPage.Init: approve_denied | navigate /leave-requests/:id
    %% verify: denied approval returns 403 or 409, request remains submitted, approver_id and decided_at remain unchanged, and no quota conversion occurs

    LeaveRequestStatusFeature.Rejecting --> LeaveBalanceSyncFeature.Init: reject_persisted | navigate LeaveBalanceSyncFeature
    %% verify: request status becomes rejected, rejection_reason and decided_at are set, approval log records action=reject, and balance synchronization starts for releasing reserved quota

    LeaveRequestStatusFeature.Rejecting --> LeaveRequestDetailPage.Init: reject_denied | navigate /leave-requests/:id
    %% verify: denied rejection returns 403, 409, or 422, request remains submitted, rejection_reason is not stored, and reserved quota is not released
```

## ⑯ 額度同步功能（Leave Balance Sync Feature）
Source Features: LeaveRequestStatusFeature

```mermaid
stateDiagram-v2
    %% role: Employee|Manager
    [*] --> LeaveBalanceSyncFeature.Init
    %% verify: LeaveBalanceSyncFeature.Init starts only after a persisted leave-request state change and operates on the matching user's LeaveBalance and ledger records for the correct year and leave type

    LeaveBalanceSyncFeature.Init --> LeaveBalanceSyncFeature.Reserving: sync_submit_reserve
    %% verify: submit synchronization prepares a reservation flow only for status=submitted and checks that available quota cannot become negative after reservation

    LeaveBalanceSyncFeature.Init --> LeaveBalanceSyncFeature.Releasing: sync_cancel_or_reject_release
    %% verify: cancel or reject synchronization prepares release flow only for previously reserved requests and does not alter used_days

    LeaveBalanceSyncFeature.Init --> LeaveBalanceSyncFeature.Deducting: sync_approve_deduct
    %% verify: approve synchronization prepares reserved-to-used conversion only for previously reserved requests and keeps total quota accounting consistent

    LeaveBalanceSyncFeature.Reserving --> LeaveRequestDetailPage.Init: reserve_success | navigate /leave-requests/:id
    %% verify: reserved_days increases by request.days, a reserve ledger entry is created, available decreases by the same amount, and detail page reload shows status=submitted with updated audit data

    LeaveBalanceSyncFeature.Reserving --> LeaveRequestDetailPage.Init: reserve_failed | navigate /leave-requests/:id
    %% verify: transaction rollback keeps reserved_days unchanged, no reserve ledger entry remains, request detail shows an actionable failure state, and inconsistent partial reservation is not visible

    LeaveBalanceSyncFeature.Releasing --> LeaveRequestDetailPage.Init: release_success | navigate /leave-requests/:id
    %% verify: reserved_days decreases by request.days, a release_reserve ledger entry is created, available increases accordingly, and detail page reload shows cancelled or rejected status with updated audit fields

    LeaveBalanceSyncFeature.Releasing --> LeaveRequestDetailPage.Init: release_failed | navigate /leave-requests/:id
    %% verify: transaction rollback keeps reserved_days unchanged, no duplicate release ledger entry remains, and detail page does not show a misleading completed cancellation or rejection effect on balances

    LeaveBalanceSyncFeature.Deducting --> LeaveRequestDetailPage.Init: deduct_success | navigate /leave-requests/:id
    %% verify: reserved_days decreases by request.days, used_days increases by request.days, a deduct ledger entry is created, available stays quota minus used minus reserved, and detail page reload shows approved status with approver and decision time

    LeaveBalanceSyncFeature.Deducting --> LeaveRequestDetailPage.Init: deduct_failed | navigate /leave-requests/:id
    %% verify: transaction rollback prevents partial reserved-to-used conversion, ledger remains consistent without orphan records, and detail page does not show approved balance effects unless the deduction truly completed
```