# 人工驗收確認表（Manual QA Checklist）

## 測試範圍與前置條件
- [ ] 測試環境可同時開啟至少 2 個瀏覽器或 2 個獨立 session（用於多人協作與即時同步驗證）。
- [ ] 已準備 Visitor、User（Owner/Admin/Member/Viewer）測試帳號，且帳號狀態可正常登入/登出。
- [ ] 已建立至少 1 個 active 專案與 1 個 archived 專案供驗證唯讀規則。
- [ ] 已準備至少 1 個 Board、2 個 List、多筆 Task（含 open/in_progress/blocked/done/archived）測試資料。
- [ ] 已準備可觸發 WIP 限制場景（某 List 啟用 is_wip_limited=true 且設定 wip_limit）。
- [ ] 測試時間、時區、語系設定已固定，避免 due_date 與時間顯示判定誤差。
- [ ] 主要測試瀏覽器可穩定操作拖拉（DnD）與即時更新。
- [ ] 若有啟用返回路徑機制，測試前已清除舊 token/session，避免快取干擾 401 導向驗證。

## 角色與權限邊界（跨全站）
- [ ] Visitor 僅可進入 `/`、`/register`、`/login`，不可直接存取 `/projects` 與 `/projects/:projectId/*`。
- [ ] User 可進入 `/projects`，且僅能進入自己有 membership 的專案路由。
- [ ] Owner 可進入 `/projects/:projectId/settings`，Admin/Member/Viewer 存取該頁皆回 403。
- [ ] Viewer 在專案內僅可查看資料，不可看到新增 Task、新增 Comment、管理成員等寫入入口。
- [ ] Member 不可 override WIP；Owner/Admin 可 override 且必須留下 Activity Log。
- [ ] 非成員存取專案內頁面時顯示 403，且不外洩專案資料內容。
- [ ] 已登入但資源不存在時顯示 404，並提供返回 `/projects` 入口。

## 端到端主流程（對應 User Flow）

### Visitor 流程
- [ ] Visitor 進入 Landing 可看到登入與註冊入口，且不顯示任何專案導覽。
- [ ] Visitor 可從註冊頁完成註冊並成為 User。
- [ ] Visitor 可從登入頁成功登入後導向 `/projects`。

### User（建立專案）流程
- [ ] User 登入後可進入專案列表頁並看到建立專案入口。
- [ ] 建立專案時 `name` 必填；成功後新專案出現在列表且預設 `visibility=private`、`status=active`。
- [ ] 建立後可進入該專案看板頁 `/projects/:projectId/board`。

### Owner（邀請與成員管理）流程
- [ ] Owner 可在成員管理頁建立邀請並指定角色（admin/member/viewer）。
- [ ] 受邀 User 可在專案列表頁的邀請區接受或拒絕邀請（不需額外獨立頁面）。
- [ ] Owner/Admin 可調整成員角色；Owner 可移除成員。
- [ ] 若受邀 email 尚未註冊，系統流程符合規格（先註冊後接受，或以 email 綁定邀請後接受）。

### Owner/Admin（結構管理）流程
- [ ] Owner/Admin 可建立 Board。
- [ ] Owner/Admin 可在 Board 內建立 List 並重排 List 順序。
- [ ] Owner/Admin 可啟用/停用 List WIP 並設定有效上限。

### Member（任務協作）流程
- [ ] Member 可在 List 建立 Task，且 `title` 必填。
- [ ] Member 可編輯 Task 欄位（title/description/due_date/priority）。
- [ ] Member 可指派/取消指派專案成員。
- [ ] Member 可拖拉 Task 進行 List 內排序與跨 List 移動。
- [ ] Member 可將 Task 標記完成（status=done）。
- [ ] Member 可封存 Task（status=archived）。

### Comment 與即時同步流程
- [ ] Owner/Admin/Member 可在 Task 下新增留言。
- [ ] 同專案其他成員可即時看到新留言。
- [ ] 新留言建立後 Activity Log 會即時新增事件。

### 封存與唯讀流程
- [ ] Owner 可封存 Project，封存後整個專案範圍進入唯讀。
- [ ] 封存 Project 後新增/編輯/拖拉/指派/留言等寫入操作皆被拒絕並顯示唯讀提示。
- [ ] Owner/Admin 封存 Board 或 List 後，對應範圍內 Task 皆不可再寫入。

### 斷線重連與衝突處理流程
- [ ] 中斷連線後重連會觸發快照回補，Board/List/Task 排序與狀態回到伺服端權威結果。
- [ ] 本地未送出變更會逐筆重送；若衝突則回報最新版本並要求使用者重新套用。

## 功能需求驗收清單

### 認證與帳號（4.1）
- [ ] 註冊成功可建立 User 並可進入已登入狀態。
- [ ] 登入成功後可存取需授權 API，登出後原 session/token 失效。
- [ ] 未登入存取受保護資源回 401 並導向 `/login`（含返回路徑）。
- [ ] 註冊/登入失敗會顯示可理解錯誤，且不產生假登入狀態。
- [ ] 註冊/登入送出期間按鈕為 loading/disabled，防止重複提交。

### 專案管理（4.2）
- [ ] User 可建立專案且 `name` 必填。
- [ ] Project `visibility` 可設定為 `private/shared`，行為符合規格（shared 仍需 membership）。
- [ ] Owner 可封存 Project，封存後 Project.status 變為 `archived`。
- [ ] 已封存 Project 內所有寫入操作被拒絕，Activity Log 仍可查看。
- [ ] 封存 Project 動作有寫入 Activity Log。

### 成員與角色管理（4.3）
- [ ] Owner 可邀請成員並指定角色；接受後才建立 membership。
- [ ] Owner/Admin 可調整成員角色，變更結果立即反映在可見操作與導覽。
- [ ] Owner 可移除成員。
- [ ] 非成員不可被指派 Task；API 與 UI 都會拒絕。
- [ ] 成員被移除後，該成員在此專案所有 Task 指派被解除或標記失效，且有 Activity Log。
- [ ] Owner 轉移（若已實作）僅可轉給既有成員，且僅維持單一 Owner。

### Board / List（4.4）
- [ ] 可建立 Board 並調整 Board `order`。
- [ ] 可建立 List 並調整 List `order`。
- [ ] 可封存 Board 與 List，封存後對應範圍為唯讀。
- [ ] List 啟用 WIP 時 `wip_limit` 需為正整數；不合法值會被拒絕。
- [ ] WIP 計數僅計入該 List 中未 archived 的 Task。
- [ ] 封存 List 後 Task 不可拖入也不可拖出該 List。

### Task（4.5）
- [ ] 可建立 Task，且 `title` 必填。
- [ ] 可編輯 Task 基本欄位（title/description/due_date/priority）。
- [ ] 可拖拉 Task 進行跨 List 移動並更新 `list_id` 與 `position`。
- [ ] 可指派/取消指派多位成員（assignee_ids 多選）。
- [ ] 可標記完成（status=done）與封存（status=archived）。
- [ ] archived Task 不可再編輯/拖拉/指派。

#### Task 狀態機與限制（4.5.1）
- [ ] 系統存在完整狀態集合：open / in_progress / blocked / done / archived。
- [ ] 合法轉換集合可執行（open→in_progress|blocked|done|archived；in_progress→blocked|done|archived；blocked→in_progress|done|archived；done→archived）。
- [ ] archived 為終態，不可再轉換。
- [ ] done 不可轉回 in_progress/open/blocked，違規轉換被拒絕並有明確錯誤回饋。

#### 拖拉與排序一致性（4.5.2）
- [ ] 任何拖拉後，伺服端會產生權威排序並同步到所有成員端。
- [ ] 高頻拖拉下 `position` 順序仍穩定，無重複/跳號導致的顯示錯亂。
- [ ] 同步後看板排序與 API 快照一致。

#### WIP 限制與 override（4.5.3）
- [ ] 超過 WIP 時，Member 建立/拖入 Task 被拒絕且顯示可理解錯誤。
- [ ] 超過 WIP 時，Admin/Owner 可 override 並成功寫入。
- [ ] 每次 override 都有 Activity Log，包含事由與結果。

#### 多人協作衝突（4.5.4）
- [ ] 同一 Task 同時編輯時可觸發版本衝突檢測（version 或等效機制）。
- [ ] 衝突寫入被拒絕並回傳最新資料，不會覆寫伺服端較新版本。
- [ ] 同時拖拉時最終結果以伺服端重算排序為準，所有端一致。

### Comment（4.6）
- [ ] Owner/Admin/Member 可新增 Comment。
- [ ] Viewer 無法新增 Comment（UI 入口隱藏或禁用，API 也拒絕）。
- [ ] Comment 新增後同專案成員可即時看到。
- [ ] Comment 預設不提供編輯/刪除。

### Activity Log（4.7）
- [ ] Activity Log 為 append-only，不可編輯/刪除既有事件。
- [ ] Project/Board/List/Task/Comment/Membership 關鍵操作都有事件寫入。
- [ ] 拖拉重排、角色調整、WIP override、封存等都有可追溯事件。
- [ ] Activity Log 可依專案篩選並維持時間序可讀性。

### 即時同步（4.8）
- [ ] Task 狀態與排序變更可即時同步到所有成員。
- [ ] Comment 新增可即時顯示。
- [ ] Activity Log 新事件可即時顯示。
- [ ] 斷線重連後可回補快照並對齊伺服端權威狀態。

### 頁面需求與導覽（4.9）
- [ ] Page Inventory 中所有路由皆可正確顯示與導向（`/`、`/register`、`/login`、`/projects`、`/projects/:projectId/*`、`/401`、`/403`、`/404`、`/5xx`）。
- [ ] Task 詳情以 Board 頁附屬面板/彈窗開啟，不新增獨立 route。
- [ ] 導覽可見性符合角色規則（Visitor 與 User Header 差異、Owner 專案設定入口、Viewer 無寫入按鈕）。
- [ ] 專案列表頁包含專案清單、建立專案入口、邀請接受/拒絕入口。
- [ ] 看板頁包含 Board/List/Task 與拖拉操作。
- [ ] 成員管理頁、專案設定頁、Activity Log 頁、封存檢視頁皆符合責任定義。

## 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] 專案列表頁可驗證 Loading / Empty / Error / Retry。
- [ ] 看板頁可驗證 Loading / Empty / Error / Retry。
- [ ] Task 詳情面板可驗證 Loading / Error（含衝突提示）狀態。
- [ ] 成員管理頁可驗證 Loading / Error / Empty（若無成員異動資料）。
- [ ] Activity Log 頁可驗證 Loading / Empty / Error / Reconnecting。
- [ ] 封存檢視頁可驗證 Loading / Empty / Error。

## 錯誤碼與導向（401 / 403 / 404 / 5xx）
- [ ] 401：未登入請求受保護資源時導向 `/login`，且保留返回路徑。
- [ ] 403：已登入但無 membership 或無該功能權限時顯示 `/403`。
- [ ] 404：資源不存在時顯示 `/404`，可返回 `/projects`。
- [ ] 5xx：系統錯誤顯示 `/5xx` 或等效錯誤視圖，提供重試與安全返回。
- [ ] 錯誤頁不洩露敏感內部資訊。

## RWD / 可用性
- [ ] 桌機與平板皆可完成專案列表、看板、Task 詳情、成員管理、Activity Log 主要操作。
- [ ] 看板在窄寬度下仍可橫向捲動並維持可操作性。
- [ ] 重要提交流程在 loading 期間可防止連點重複提交。
- [ ] 空狀態與錯誤狀態文案具可理解性，並提供下一步入口。

## 非功能需求映射檢查
- [ ] RBAC 由伺服端強制，僅靠前端隱藏按鈕不足以通過驗收。
- [ ] 防止 IDOR：不可透過猜測 id 讀取他人專案、Task、Comment。
- [ ] Project/Task/Comment 欄位內容具 XSS 防護（輸入清理或輸出轉義）。
- [ ] 針對排序/拖拉等關鍵寫入具伺服端權威序列化策略。
- [ ] 可編輯實體具衝突檢測（version/ETag 等效）。
- [ ] Activity Log 可作為產品內稽核依據。

## 角色別驗收清單

### Guest（未登入）
- [ ] 可存取 Landing、註冊、登入。
- [ ] 不可存取 `/projects` 與專案內頁面。
- [ ] 嘗試存取受保護路徑時會觸發 401 導向登入。

### User（已登入通用）
- [ ] 可進入 `/projects` 並操作自己的專案清單。
- [ ] 可登出並使 session 失效。
- [ ] 僅可進入有 membership 的專案。

### Owner
- [ ] 可進行成員邀請、移除、角色調整。
- [ ] 可進入專案設定頁並封存專案。
- [ ] 可設定 WIP 並可 override WIP。

### Admin
- [ ] 可管理 Board/List 與成員角色調整。
- [ ] 不可執行專案封存（除非已成為 Owner）。
- [ ] 可 override WIP 並留下 Activity Log。

### Member
- [ ] 可建立/編輯/拖拉/指派/完成/封存 Task。
- [ ] 可新增 Comment。
- [ ] 不可管理成員角色、不可 override WIP、不可封存專案。

### Viewer
- [ ] 可查看 Board/List/Task/Comment/Activity Log。
- [ ] 不可新增/編輯/拖拉/指派/留言/封存任何實體。
- [ ] 導覽與頁面不顯示寫入操作入口。

## 跨帳號資料隔離
- [ ] 帳號 A 無法看到帳號 B 未加入之專案資料。
- [ ] 帳號 A 不可透過任意 projectId/taskId 直接讀取帳號 B 專案內容（應回 403/404）。
- [ ] 帳號被移除 membership 後，立即失去該專案資料存取權。

## 資料一致性檢查（功能影響面）
- [ ] 建立/編輯/封存 Project 後，專案列表與專案內導覽狀態一致。
- [ ] 建立/重排/封存 Board 或 List 後，看板顯示順序與伺服端快照一致。
- [ ] Task 拖拉、狀態變更、指派異動後，看板卡片、Task 詳情、Activity Log 三者一致。
- [ ] 成員角色變更後，導覽可見性、按鈕可用性、API 權限判定一致。
- [ ] WIP 觸發與 override 後，List 容量狀態、錯誤提示、Activity Log 記錄一致。
- [ ] 斷線重連後，最終 UI 狀態與伺服端權威快照一致（無重複、無遺失、無幽靈卡片）。
- [ ] 若產品另外提供統計或匯出能力（若已實作），其資料範圍需與相同篩選條件下的畫面資料一致。
