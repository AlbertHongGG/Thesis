# 人工驗收確認表（Manual QA Checklist）
企業級專案管理系統（Jira Lite）

---

## 0. 環境與前置條件
- [ ] 準備至少 2 個 Organization（OrgA/OrgB），且各自至少 1 個 Project（含 scrum 與 kanban 各 1）
- [ ] 準備帳號：Guest（未登入）、Platform Admin、OrgA 的 Org Admin、OrgA 的 Org Member、OrgA Project 的 Project Manager、Developer、Viewer
- [ ] 準備「跨組織隔離」測試資料：OrgA 的 Project/Issue 與 OrgB 的 Project/Issue（含可辨識的 issue_key）
- [ ] 確認系統時區一致（用於 due date、created_at/updated_at 顯示一致）
- [ ] 於桌機/平板/手機（或模擬寬度）各跑一次核心流程（RWD）

---

## 1. 角色與權限邊界（總則）
- [ ] Guest 僅可進入 /login 與 /invite/:token；嘗試進入 /orgs 或 /projects/* 會被導向 /login（保留 returnUrl）
- [ ] 非 Platform Admin 直連 /platform/* 會顯示 Forbidden（API 403）
- [ ] 非 Organization 成員直連 /orgs/:orgId* 一律顯示 Not Found（API 404；存在性策略）
- [ ] 非 Project 成員直連 /projects/:projectId* 一律顯示 Not Found（API 404；存在性策略）
- [ ] 已是 Project 成員但角色不足（例如 Developer/Viewer 直連 /projects/:projectId/settings）會顯示 Forbidden（API 403）
- [ ] Org suspended 時，所有寫入操作一律被拒絕（API 403 + ORG_SUSPENDED），但讀取仍可用
- [ ] Project archived 後，所有 Issue 寫入（欄位變更/狀態轉換/留言/Epic 關聯）一律被拒絕（API 403 + PROJECT_ARCHIVED）且不可恢復

---

## 2. 端到端主流程（依 User Flow 覆蓋）

### 2.1 Guest（未登入）流程
- [ ] 進入 /login 顯示 Email/Password 與登入 CTA
- [ ] 以錯誤密碼登入：顯示錯誤訊息且仍停留在 /login（API 401）
- [ ] 以正確帳密登入：建立 session 並導向 /orgs（API 200 + HttpOnly Cookie）
- [ ] 點擊邀請連結進入 /invite/:token：顯示 token 驗證 loading，成功後可接受邀請
- [ ] 使用過期/已使用 token：顯示 token 無效/過期，且不可加入 Organization
- [ ] 接受邀請成功後：成為該 Organization 成員，並導向 /orgs 或導向 /login（依系統設定），且 token 不可再用

### 2.2 Platform Admin 流程
- [ ] 登入後可進入 /platform/orgs
- [ ] 建立 Organization（name + 初始 Org Admin Email）：建立成功且 plan 預設 free、status 預設 active
- [ ] 切換 Organization plan（free/paid）：儲存成功並於列表立即反映
- [ ] 將 Organization 設為 suspended：儲存成功並於列表立即反映
- [ ] 解除 suspended（設為 active）：儲存成功並於列表立即反映
- [ ] 進入 /platform/audit：可看到跨組織操作的 Audit Log（含 actor_email、action、entity、before/after）

### 2.3 Org Admin 流程
- [ ] 登入後進入 /orgs 顯示可切換的 organizations
- [ ] 選擇 OrgA 後進入 /orgs/:orgId 顯示 org overview（含 plan/status）
- [ ] 進入 /orgs/:orgId/members：可看到成員清單與邀請入口
- [ ] 發送邀請至 Email：邀請成功後該 Email 收到 token（或等效）並可在 /invite/:token 接受
- [ ] 管理成員（停用/移除）：操作成功後，被移除者再存取該 org 路由顯示 Not Found
- [ ] 進入 /orgs/:orgId/projects：可建立 project（scrum/kanban）
- [ ] 進入 /projects/:projectId/settings：可指派 Project 角色（Project Manager/Developer/Viewer）
- [ ] 進入 /orgs/:orgId/audit：可查詢 org 內 Audit Log

### 2.4 Project Manager 流程
- [ ] 進入 /projects/:projectId/board：可檢視 issue 並可建立 issue
- [ ] 建立 issue（含 type/priority/status/assignee/labels/due date/estimate）：建立成功後列表與詳情顯示一致，且 issue_key 格式正確（如 PROJ-123）
- [ ] 依 workflow 進行狀態轉換：僅允許合法 transition，且 timeline/audit 可追溯 from/to
- [ ] scrum project 進入 /projects/:projectId/backlog：可建立 sprint 並將 issue 加入 sprint
- [ ] scrum project 進入 /projects/:projectId/sprints：可啟動 sprint、結束 sprint
- [ ] 進入 /projects/:projectId/settings：可設定 issue types 與 workflow，且新規則立即生效

### 2.5 Developer 流程
- [ ] 進入 board/backlog 檢視待辦
- [ ] 進入 issue detail：可更新允許的欄位（依專案設定）並儲存
- [ ] 進行狀態轉換：僅允許合法 transition；非法轉換會被拒絕且狀態不變
- [ ] 在 issue 留言：留言成功後於 issue detail 立即可見

### 2.6 Viewer 流程
- [ ] 進入 board/backlog/issue detail：可檢視資訊
- [ ] 於上述頁面皆無任何可編輯入口（按鈕 hidden/disabled），且嘗試呼叫寫入 API 回 403

---

## 3. 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] 所有主要頁在首次載入時都顯示 Loading，載入完成後切換為 Ready
- [ ] 所有列表頁（/orgs、/orgs/:orgId/projects、/projects/:projectId/issues、/projects/:projectId/board、/projects/:projectId/backlog、/projects/:projectId/sprints、audit 頁）在無資料時顯示 Empty
- [ ] 模擬 API 5xx：頁面顯示 Error 與 Retry；點擊 Retry 後可成功載入並清除錯誤訊息
- [ ] 切換 Organization 或 Project 時顯示 Loading，且切換後資料不混用（不出現上一個 org/project 的資料）

---

## 4. 錯誤碼與導向（401/403/404/5xx）
- [ ] 未登入存取受保護頁：API 401，UI 導向 /login 並保留 returnUrl
- [ ] 已登入但非平台管理員存取 /platform/*：API 403，UI 顯示 Forbidden
- [ ] 已登入但非 org 成員存取 /orgs/:orgId*：API 404，UI 顯示 Not Found
- [ ] 已登入但非 project 成員存取 /projects/:projectId*：API 404，UI 顯示 Not Found
- [ ] 已是成員但角色不足的行為（例如 Viewer 嘗試留言）：API 403，UI 顯示 Forbidden 或禁用入口
- [ ] org suspended 的寫入：API 403 並包含錯誤碼 ORG_SUSPENDED，UI 明確顯示唯讀原因
- [ ] project archived 的寫入：API 403 並包含錯誤碼 PROJECT_ARCHIVED，UI 明確顯示唯讀原因

---

## 5. 帳號與認證（4.1）
- [ ] 登入成功後重新整理頁面仍維持登入狀態（session 仍有效）
- [ ] 登出後 session 被清除，重新整理不會回到已登入狀態
- [ ] 接受邀請後 token 一次性：同一 token 再次使用會失敗
- [ ] 接受邀請時 token 綁定 organization：不得用 token 加入其他 organization
- [ ] 若邀請 email 對應的 user 尚不存在：可在接受邀請時建立帳號並設定密碼
- [ ] 若已登入但 email 與邀請 email 不同：接受邀請會被拒絕且 UI 有明確提示

---

## 6. Multi-Tenant 與資料隔離（4.2）
- [ ] 在 OrgA 登入時，嘗試用 OrgB 的 projectId 進入 /projects/:projectId/board：顯示 Not Found（API 404）
- [ ] 在 OrgA 登入時，嘗試用 OrgB 的 issueKey（在 OrgB 的 project）進入 /projects/:projectId/issues/:issueKey：顯示 Not Found（API 404）
- [ ] 任一列表/API 回傳的資料都只屬於目前 organization/project（不得混入其他 org/project）
- [ ] Org Admin 只因為是 Org Admin 不會自動擁有任何 project_manager 權限（需被加入 Project 才能管理 Sprint/Issue）

---

## 7. Organization 管理（4.3）

### 7.1 Platform Admin（建立/plan/status）
- [ ] 建立 organization 成功後，可在 /platform/orgs 列表看到且 plan=free、status=active
- [ ] 變更 plan 成功後，刷新頁面仍一致
- [ ] 設為 suspended 後，該 org 內所有寫入入口都 disabled/hidden
- [ ] 解除 suspended 後，寫入入口恢復（依角色）

### 7.2 Org Admin（編輯基本資訊、成員、邀請、稽核）
- [ ] Org Admin 可編輯 organization 名稱（但不可變更 plan）
- [ ] Org Admin 發送邀請後，受邀者成功加入會出現在 members 清單
- [ ] Org Admin 停用/移除成員後，該成員立即失去 org 存取（Not Found）
- [ ] Org Admin 可在 /orgs/:orgId/audit 查詢 org 內 Audit Log

---

## 8. Project 管理（4.4）
- [ ] Org Admin 可建立 scrum project 與 kanban project
- [ ] Project.key 在同 organization 內唯一；重複 key 會建立失敗並顯示錯誤
- [ ] Org Admin 可將 org 成員加入 project 並指派 project_role（project_manager/developer/viewer）
- [ ] Project archived 後不可恢復為 active（UI 無入口且任何嘗試被拒絕）
- [ ] Project archived 後，Issue 的欄位變更/狀態轉換/留言/Epic 關聯操作全部失敗（403 + PROJECT_ARCHIVED）

---

## 9. Issue 管理（4.5）

### 9.1 Issue 建立與欄位驗證
- [ ] 建立 issue 時 title 為必填；缺少 title 會被拒絕並顯示錯誤
- [ ] priority 僅允許 Low/Medium/High/Critical；非法值會被拒絕
- [ ] reporter 必為建立者；建立成功後 issue detail 顯示正確 reporter
- [ ] labels 為多值；新增/移除後保存並於 detail 顯示一致
- [ ] due date/estimate 可為空；空值保存後不會出現錯誤顯示

### 9.2 Issue Key 與列表排序
- [ ] issue_key 於同 project 內唯一且格式為 <PROJECT_KEY>-<number>
- [ ] issues list 可依 created_at 排序，切換排序後結果一致
- [ ] issues list 可依 updated_at 排序，更新 issue 後排序結果合理變化

### 9.3 Workflow 與狀態轉換
- [ ] Developer/Project Manager 只能做 workflow 允許的合法轉換
- [ ] 非法狀態轉換會被拒絕並顯示錯誤，且 issue 狀態不變
- [ ] Viewer 無狀態轉換入口，且嘗試呼叫轉換 API 回 403
- [ ] Project Manager 修改 workflow 後，新規則立即生效（不需重新建立 issue）
- [ ] 若 issue 處於已不存在的 status：issue 仍可查看，但狀態轉換會被拒絕（403 + ISSUE_STATUS_DEPRECATED）且 UI 顯示提示

### 9.4 Epic 關聯
- [ ] 只有 type=epic 的 issue 可作為 epic_issue
- [ ] 新增 child issue 到 epic 後，child issue 的 status 不會被改寫
- [ ] 移除 epic link 後，關聯立即消失且不影響 child issue 欄位

### 9.5 留言（IssueComment）
- [ ] Developer/Project Manager 可新增留言，留言立即出現在 issue detail
- [ ] Viewer 無留言入口且呼叫留言 API 回 403
- [ ] 在 org suspended 或 project archived 時，留言會被拒絕（403 + ORG_SUSPENDED / PROJECT_ARCHIVED）

### 9.6 稽核與歷史（Audit / Timeline）
- [ ] Issue 建立會寫入 Audit Log（含 actor_email、entity、after_json）
- [ ] Issue 欄位變更會寫入 Audit Log（含 before_json/after_json）
- [ ] Issue 狀態轉換會寫入 Audit Log（含 from/to）
- [ ] Epic 關聯新增/移除會寫入 Audit Log
- [ ] Project archived、Organization suspended/unsuspended 會寫入 Audit Log
- [ ] 成員邀請/加入/移除、角色變更會寫入 Audit Log

---

## 10. Scrum / Kanban（4.6）

### 10.1 Scrum：Sprint
- [ ] scrum project 的 backlog/sprints 頁可正常載入並顯示 planned/active/closed
- [ ] Project Manager 可建立 sprint
- [ ] Project Manager 可啟動 sprint（planned → active）
- [ ] Project Manager 可結束 sprint（active → closed）
- [ ] Project Manager 可將 issue 加入/移出 sprint，且 issue detail/backlog 顯示一致
- [ ] Developer/Viewer 無 sprint 管理入口（或操作被拒絕）

### 10.2 Kanban：Board
- [ ] kanban project 的 board columns 對應 workflow statuses
- [ ] Developer/Project Manager 可進行合法的狀態轉換；非法轉換被拒絕
- [ ] Viewer 僅能檢視 board，不可轉換狀態

---

## 11. 導覽可見性與 CTA 去重（4.7）
- [ ] Guest 導覽只顯示 Login，不顯示 Org/Project/Platform 入口
- [ ] 已登入導覽顯示 /orgs
- [ ] Org Admin 在 org context 可看到 Members/Projects/Audit；Org Member 不可看到 Members/Audit
- [ ] Project context 導覽包含 Board/Issues；Scrum 額外包含 Backlog/Sprints；Settings 僅對有權限者顯示
- [ ] 同一動作不會在 Header/Sidebar 與頁面內容區同時出現兩個入口（例如建立 issue 只出現在頁面核心區）

---

## 12. 非功能需求（5）

### 12.1 RWD
- [ ] 手機寬度下 board/backlog 仍可操作（提供替代呈現），且關鍵操作入口不會消失
- [ ] 不同寬度下導覽不會誤顯示不該出現的項目

### 12.2 安全（XSS/CSRF/IDOR）
- [ ] issue title/description/comment 輸入包含可疑字元時，顯示時不會執行腳本（已轉義/清理）
- [ ] 使用 cookie session 時，跨站請求無法在未授權情況下成功寫入（CSRF 防護生效）
- [ ] 透過猜測 orgId/projectId/issueKey 無法取得他組織資料（均回 404 或拒絕）

### 12.3 資料一致性與並發更新
- [ ] 同一 issue 在兩個分頁同時編輯：後送出的更新會被偵測為衝突（API 409 + CONFLICT），且 UI 提示重新載入
- [ ] issue 更新後，issues list / board / issue detail 的顯示一致（title/status/updated_at）

### 12.4 稽核不可竄改
- [ ] 一般使用者無法修改/刪除 Audit Log（無 UI 入口；API 不存在（回 404）；若存在端點也必須回 403）
