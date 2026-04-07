# 人工驗收確認表（Manual QA Checklist）
社團活動管理平台（Activity Management Platform）

---

## 環境 / 前置條件
- [ ] 準備至少 3 組測試帳號：1 組 Member、1 組 Admin、1 組未登入（Guest）視角
- [ ] 確認 Admin 與 Member 帳號「不可為同一帳號」（同一 email 不會同時擁有兩種角色）
- [ ] 準備至少 3 筆活動資料：1 筆 published（未額滿）、1 筆 published（接近額滿）、1 筆 full（已額滿）
- [ ] 準備至少 1 筆 draft 活動（僅 Admin 可見）與至少 1 筆 archived 活動（不應出現在活動列表）
- [ ] 測試時區設定為單一時區（以系統預設時區為準），並記錄「現在時間」以驗證 deadline / date 相關規則
- [ ] 至少使用 2 種瀏覽器驗證（桌機）與 1 種手機尺寸驗證（RWD）
- [ ] 事先確認資料庫可觀察（例如能查看 Activity / Registration / User 的資料變化）以利驗證一致性與名額

## 角色與權限邊界（Guest / Member / Admin）
- [ ] Guest 可瀏覽活動列表（僅 published / full）並可進入活動詳情
- [ ] Guest 嘗試報名活動會被導向登入或回傳 401（且 UI 有明確提示）
- [ ] Member 可瀏覽活動列表（僅 published / full）並可進入活動詳情
- [ ] Member 可進入「我的活動」頁並僅看到自己已報名的活動
- [ ] Member 嘗試進入管理後台會被拒絕（403），且 UI 有明確 Forbidden 提示或導向
- [ ] Admin 可進入管理後台並可執行活動管理與報名名單查看
- [ ] Admin 具備 Member 的所有能力（可瀏覽、詳情、報名/取消、我的活動）

## Guest（未登入）驗收項目
- [ ] Guest 可進入活動列表頁並僅看到 published / full 的活動
- [ ] Guest 可進入活動詳情頁並看到完整活動資訊（不包含任何管理功能入口）
- [ ] Guest 嘗試報名活動時會被導向登入或回傳 401（且不會產生 Registration）
- [ ] Guest 嘗試進入「我的活動」頁會被導向登入或回傳 401
- [ ] Guest 嘗試進入管理後台會被拒絕（403）

## User（Member）驗收項目
- [ ] User（Member）可瀏覽活動列表與活動詳情（僅 published / full）
- [ ] User（Member）可報名 published 且未額滿的活動，且成功後狀態顯示一致
- [ ] User（Member）可在「我的活動」頁看到自己已報名活動且依 date 排序
- [ ] User（Member）在 deadline 前且活動未結束時可取消報名，取消後名額即時釋放
- [ ] User（Member）嘗試進入管理後台會被拒絕（403），且 UI 有清楚提示

## Admin（管理員）驗收項目
- [ ] Admin 可進入管理後台並可建立/編輯/下架活動
- [ ] Admin 可手動關閉活動報名（published/full -> closed）
- [ ] Admin 可查看活動報名名單（姓名 / Email / 報名時間）且資料一致
- [ ] Admin 可匯出報名名單為 CSV，且匯出內容與畫面名單一致
- [ ] Admin 在前台也可完成報名/取消/我的活動等 Member 能力

## 端到端主流程（一般使用者 Member）
- [ ] 註冊後可使用 Email + 密碼登入成為 Member
- [ ] Member 登入成功後可進入活動列表頁並看到 published / full 的活動
- [ ] Member 從活動列表點擊某活動可進入活動詳情頁並看到完整資訊（title/description/date/location/deadline/capacity/status/目前報名人數）
- [ ] 對於 published 且未額滿的活動，Member 在活動詳情頁可看到「報名」按鈕
- [ ] Member 報名成功後：活動詳情頁顯示「已報名」狀態、列表顯示「已報名」，且目前報名人數即時更新
- [ ] Member 可進入「我的活動」頁看到剛報名的活動，且依活動 date 排序
- [ ] Member 在報名截止前且活動未結束時可取消報名成功，取消後名額即時釋放且狀態回復規則正確（若未額滿則可回到 published）

## 端到端主流程（管理員 Admin）
- [ ] Admin 使用 Email + 密碼登入後可進入管理後台
- [ ] Admin 在管理後台可建立新活動並先以 draft 保存（草稿）
- [ ] Admin 編輯活動欄位（title/description/date/location/deadline/capacity/status）可成功保存且資料一致
- [ ] Admin 發佈活動後狀態為 published，該活動會出現在活動列表（對所有人可見）
- [ ] Admin 可查看某活動的報名名單（姓名 / Email / 報名時間）且資料與 Registration 一致
- [ ] Admin 可手動關閉活動報名：published 或 full -> closed，關閉後前台不可再報名
- [ ] Admin 可下架活動：closed 或 draft -> archived，下架後活動不應出現在活動列表
- [ ] Admin 可匯出報名名單為 CSV，且匯出內容與畫面報名名單一致

## 例外流程與錯誤處理（401 / 403 / 404）
- [ ] 未登入（Guest）對活動執行報名請求時回傳 401 或被導向登入（且不會產生 Registration）
- [ ] 非 Admin（Guest/Member）嘗試進入管理後台時回傳 403（且 UI 有清楚提示）
- [ ] 以不存在的活動 id 進入活動詳情頁時回傳 404（且 UI 有清楚 Not Found 顯示）
- [ ] 活動已截止（deadline 已過）時，任何角色都不可再報名；UI 顯示不可報名原因且後端拒絕
- [ ] 活動已結束（date 已過）時，Member 不可取消報名；UI 顯示不可取消原因且後端拒絕

## 全站狀態品質（Loading / Error / Empty / Retry）
- [ ] 活動列表頁在載入資料時有 loading 狀態（不會顯示錯誤的舊資料）
- [ ] 活動列表頁在無資料時有 empty 狀態（可理解的文案）
- [ ] 活動列表頁在 API 失敗時有 error 狀態（可理解的錯誤提示）
- [ ] 活動詳情頁在載入資料時有 loading 狀態
- [ ] 活動詳情頁在 API 失敗時有 error 狀態，且不會誤顯示可報名/可取消
- [ ] 我的活動頁在無已報名活動時有 empty 狀態
- [ ] 管理後台（活動列表/編輯/報名名單）在載入與失敗時各有 loading / error 狀態

## 錯誤碼與導向（401 / 403 / 404 / 5xx）
- [ ] 401：未登入存取需要登入的操作（報名/取消/我的活動）時，行為一致（導向登入或顯示需要登入）
- [ ] 403：Member 存取管理後台相關 API/頁面時一律被拒絕
- [ ] 404：活動不存在時，活動詳情頁與相關 API 表現一致
- [ ] 5xx：後端發生錯誤時，前台顯示通用錯誤提示且不造成資料錯亂（例如不會顯示已報名但實際未建立）

---

## 帳號與認證（Email + 密碼 / Session 或 Token）
- [ ] 註冊：必填欄位（name/email/password）缺漏時會被拒絕並顯示明確訊息
- [ ] 註冊：email 重複時會被拒絕並顯示明確訊息
- [ ] 登入：使用正確 Email + 密碼可成功登入並取得登入狀態
- [ ] 登入：使用錯誤密碼會登入失敗且不會建立登入狀態
- [ ] 登出：登出後回到未登入狀態，且不可再使用原本登入狀態執行需要登入的操作
- [ ] 密碼儲存：資料庫中不會出現明文密碼（僅存在 password_hash）
- [ ] Session / Token 失效：登入狀態失效後，下一次需要登入的操作會被視為未登入（401 或導向）

## 活動管理（Activity：欄位與規則）
- [ ] Admin 建立活動時，title/description/date/location/deadline/capacity/status 可成功保存
- [ ] 規則：date 必須晚於 deadline；若 date <= deadline 會被拒絕並顯示明確訊息
- [ ] 規則：capacity 必須為正整數；若為 0 或負數或非整數會被拒絕
- [ ] 狀態可見性：draft 活動僅 Admin 可見；Member/Guest 在活動列表/詳情不可看到 draft
- [ ] 狀態可見性：archived 活動不會出現在活動列表（Member/Guest/Admin 前台列表皆不可見）
- [ ] Admin 可編輯活動資訊：編輯後在活動詳情與活動列表顯示資料一致
- [ ] Admin 可將 published -> closed；關閉後前台活動詳情不再顯示可報名入口
- [ ] Admin 可將 full -> closed；關閉後仍維持不可報名，且狀態顯示一致
- [ ] Admin 可將 closed -> archived 與 draft -> archived；下架後前台列表不顯示

## 報名系統（Registration：唯一性 / 名額 / 一致性 / 防重複）
- [ ] 同一 Member 對同一活動只能報名一次：重複報名會被拒絕，且 UI 不會顯示兩筆成功
- [ ] 活動狀態非 published 時不可報名（例如 draft/closed/archived/full）且 UI 有明確原因
- [ ] 額滿自動切換：報名人數達 capacity 後活動狀態會自動變為 full
- [ ] 額滿後不可報名：full 狀態時任何人不可再報名，且 UI 顯示額滿提示
- [ ] 取消報名：取消後 Registration 會有 canceled_at，且名額即時釋放
- [ ] 取消後狀態回復：若取消後未額滿，活動狀態可回到 published，並重新可報名
- [ ] 一致性（避免超賣）：在「最後 1 個名額」情境下，兩個不同 Member 同時送出報名，最多只會成功 1 人，且狀態/人數正確
- [ ] 防重複提交（idempotent）：同一 Member 對同一活動快速連點或重送相同報名請求，不會增加報名人數超過 1，且回應/畫面一致

## 活動列表頁（Activity List：顯示範圍與資訊）
- [ ] 顯示範圍僅包含 published 與 full；不會出現 draft/closed/archived
- [ ] 列表每筆活動顯示：活動名稱、日期、地點、目前報名人數/名額上限
- [ ] 列表每筆活動顯示：報名狀態（可報名 / 已報名 / 額滿）與實際狀態一致
- [ ] Member 已報名某活動後，回到列表該活動會顯示「已報名」

## 活動詳情頁（Activity Detail：完整資訊與按鈕顯示）
- [ ] 詳情頁顯示完整活動資訊：title/description/date/location/deadline/capacity/status
- [ ] 未登入（Guest）在詳情頁看到報名入口時，實際操作仍需登入（401 或導向）
- [ ] Member 未報名且可報名時顯示「報名」按鈕
- [ ] Member 已報名時顯示「取消報名」按鈕（僅在 deadline 前且活動未結束）
- [ ] 活動已額滿時顯示額滿提示，且不顯示可報名入口

## 我的活動頁（My Activities：資料範圍 / 排序 / 狀態）
- [ ] 僅顯示目前登入 Member 已報名的活動，不會顯示其他人的活動
- [ ] 依活動 date 排序結果正確且穩定
- [ ] 每筆活動顯示「即將開始 / 已結束」狀態，且判斷依同一時區與時間基準一致

## 管理後台（Admin Panel：CRUD / 名單 / 匯出）
- [ ] Admin 可在後台看到活動清單，且可建立/編輯/下架活動
- [ ] Admin 編輯既有活動後，前台活動列表與詳情頁顯示同步更新
- [ ] Admin 可手動關閉報名，關閉後 Registration 新增會被拒絕
- [ ] Admin 查看報名名單欄位完整：姓名 / Email / 報名時間
- [ ] 名單一致性：後台報名名單筆數與前台顯示的目前報名人數一致
- [ ] 匯出 CSV：檔案可下載且內容欄位/筆數與後台名單一致
- [ ] 匯出 CSV：在不同活動上匯出，檔案內容不會混入其他活動名單

---

## 非功能需求（RWD / 時區 / 操作紀錄 / 一致性）
- [ ] RWD：在手機尺寸下活動列表、活動詳情、我的活動、管理後台仍可操作且主要資訊不被遮擋
- [ ] 操作提示：所有會寫入資料的操作（報名/取消/建立/編輯/狀態變更）都有 loading 與成功/失敗提示
- [ ] 前後端一致性：任何寫入後，列表/詳情/我的活動/後台名單的顯示一致，不會出現短暫錯亂或需要手動重整才一致
- [ ] 單一時區：deadline 與 date 的比較與頁面顯示一致，不會因為不同頁面而出現時間差
- [ ] 重要操作紀錄：建立/修改/狀態變更等重要操作會被紀錄（可從伺服器日誌或資料庫紀錄確認 who/when/what）
