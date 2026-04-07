---
name: spec-flow-orchestrator
description: 將使用者輸入的 spec 依序完成 Step1 完整 Spec、Step2 分層 Diagram、Step3 加入 verify、Step4 技術棧定義、Step5 人工驗收確認表、Step6 功能覆蓋確認表，並以同一回覆輸出六段結果。
---

## 目標
接收使用者 spec，先進行**主動發想補齊**（Step 1），再依序產出六份檔案。
- Step 2 必須基於 Step 1
- Step 3 必須基於 Step 1 與已完成寫檔的 Step 2
- Step 4 必須基於 Step 1
- Step 5 必須基於 Step 1（必要時可參考 Step 2/3 的流程與 verify）
- Step 6 必須基於 Step 1（可選擇參考 Step 2/3 以避免漏列功能，但不得新增 Spec 沒有的功能）

其中 Step 2 與 Step 3 的執行順序是硬性要求：
- 必須先完整生成並寫入 `/outputs/step2-diagrams.md`
- 再以該份 Step 2 檔案為唯一 diagram 來源生成 `/outputs/step3-verified-diagrams.md`
- Step 3 不得自行重畫圖；若發現圖有問題，必須先回頭修正 Step 2 再生成 Step 3

1) Step 1 完整 Spec
2) Step 2 分層 Transition Diagrams
3) Step 3 含 verify 的 Transition Diagrams
4) Step 4 技術棧定義（Frontend / Backend / Database）
5) Step 5 人工驗收確認表（Manual QA Checklist）
6) Step 6 簡易功能確認表（Feature Coverage Checklist）：用於快速核對 Spec 功能是否都有被實作

## 輸出位置（必須寫檔）
- /outputs/step1-spec.md
- /outputs/step2-diagrams.md
- /outputs/step3-verified-diagrams.md
- /outputs/step4-tech-stack.md
- /outputs/step5-manual-checklist.md
- /outputs/step6-feature-coverage-checklist.md
- 回覆中僅提供完成訊息與檔案連結

## 必須遵守
- 嚴格依序輸出六段內容，不可省略。
- 若輸入不完整，需補齊合理內容，避免矛盾。
- Step 2、Step 3 必須使用 Mermaid `stateDiagram-v2`。
- Step 2：每個 Mermaid block 第一行必須包含 `%% role: ...`（若非特定角色視角，使用 `%% role: none`）。
- Step 2：只產出 diagrams，不得包含任何 `%% verify:`。
- Step 3 每個 transition 必須加 `%% verify:`。
- Step 3：必須完整保留 Step 2 的 diagram 標題、排序、Mermaid block 結構與 transition，只能新增 verify 與必要空行。
- Step 4 必須固定使用 SQLite + Prisma 作為資料庫技術。
- Step 5 必須是可人工勾選的 checklist（使用 `- [ ]`），且必須分角色（至少 Guest / User）列出測試流程與項目。
- Step 6 必須是「功能級」的 checklist（使用 `- [ ] <功能名稱>`），用於確認功能存在（Coverage），不是測試步驟。

## 品質門檻（Quality Gates，必須達成）
- 不得「為了走完更多步驟」而降低 Step 1 深度：Step 1 是單一事實來源（SSOT），其完整性優先於篇幅。
- Step 2/3/5/6 僅能引用 Step 1 出現的名詞（角色/頁面/Entity/狀態/規則）；不得混入其他專案常見名詞或範例領域（例如 Transaction/Order/Cart/CSV/Chart 等），除非 Step 1 明確存在。
- Step 2 與 Step 3：
	- 必須覆蓋 Step 1 的每個頁面（Page Inventory）與全站錯誤/權限處理（401/403/404/5xx）。
	- 不得新增 Step 1 沒有的頁面或功能。
	- 圖的標題/命名/層級順序必須一致（Step 3 完全跟隨 Step 2）。
- Step 5：
	- 必須逐條覆蓋 Step 1 的 User Flow（每一步至少 1 個 checkbox）。
	- 必須逐條覆蓋 Step 1 的 Functional Requirements 子節（每子節至少：正向 + 失敗/邊界 + 一致性/狀態回饋，若適用）。
	- 必須覆蓋 Step 1 的 Non-functional Requirements（一致性/安全/XSS/稽核/併發等，若存在）。
- Step 6：只列「功能存在」，不得寫成測試步驟，也不得新增 Spec 未提及能力。

## 輸出前自我檢查（必做，寫檔前先完成）
- 一致性：角色名稱、頁面路徑、狀態 enum、轉換規則在 Step 1/2/3/5/6 完全一致。
- 覆蓋率：
	- Step 2/3：Page Inventory 全覆蓋 + 全站錯誤/權限 1 張。
	- Step 5：User Flow 全覆蓋 + 401/403/404/5xx + Loading/Error/Empty 全覆蓋。
	- Step 6：涵蓋 Auth/RBAC/Entities/StateMachine/Immutability/Audit/UXStates（若 Step 1 有）。
- Step 2 格式：每個 Mermaid block 第一行都有 `%% role: ...`（非特定角色視角需為 `%% role: none`）。
- Step 2 / Step 3 邊界：Step 2 不含 verify；Step 3 與 Step 2 的 diagrams 骨架完全一致，只額外加入 verify。
- 防模板污染：全文搜尋並排除不在 Step 1 的領域名詞（例：Transaction/Cart/Order/CSV/Chart/Category…）。
- 具體性：verify 與 checklist 項目不得出現「應該正常/大致/看起來」等不可驗證措辭。

## 輸出格式（固定）

### 檔案內容格式
- step1-spec.md 內必須含有完整 Spec（1~6 段落），不得包含「Step」標題行
- step2-diagrams.md 內必須含有完整分層 diagram（不含 verify），不得包含「Step」標題行
- step3-verified-diagrams.md 內必須含有完整分層 diagram（含 verify），且檔案開頭必須包含「全體結構說明」段落，transition 區塊之間需空一行，不得包含「Step」標題行
- step4-tech-stack.md 內必須含有技術棧定義（Frontend / Backend / Database），不得包含「Step」標題行
- step5-manual-checklist.md 內必須含有人工驗收確認表（含流程與測試項目），且必須使用 `- [ ]` 核取方塊，不得包含「Step」標題行
- step6-feature-coverage-checklist.md 內必須含有「功能覆蓋確認表」，每個功能一行 `- [ ]`，可用 `##` 分段分類，但分類下每一項都必須是 `- [ ]`，不得包含「Step」標題行

## 注意
- Step 2 與 Step 3 的分層順序必須一致。
- Step 3 的 verify 需可檢查（API 回應 / UI 顯示 / 權限 / 資料一致性）。
- 任何新增的 state/transition 必須可追溯到 Step 1 或為補齊必要流程而新增。
- Step 1 必須主動補上該類型網站應有的功能/角色/流程，不僅是修正輸入。
- Step 5 應覆蓋：Auth、RBAC/權限邊界、核心資料操作（依 Data Model）、狀態機/規則、資料一致性、Loading/Error/Empty、錯誤碼導向（401/403/404/5xx）、RWD。
- Step 6 應覆蓋：Auth/Session、RBAC/存取控制、核心 Entities/CRUD、狀態機（狀態+合法轉換+非法拒絕）、留言/歷史不可變、Admin/Operations（若有）、全站頁面狀態、Non-functional（Consistency/Audit/XSS 等）。
