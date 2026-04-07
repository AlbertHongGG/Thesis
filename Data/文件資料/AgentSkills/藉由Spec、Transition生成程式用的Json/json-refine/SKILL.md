---
name: json-refine
description: 讀取既有的狀態圖資料集 data.json（由 `spec-hirarchy-to-json` 產生），並再次利用 `StateTranstionDiagram/spec.md` 與 `StateTranstionDiagram/transition.md` 進行補齊、修正與一致性校驗，輸出同 schema 的強化版 JSON（不改 UX/schema，只完善資料正確性與完整度）。
---

# json-refine

本 skills 會在「不改 schema、不破壞既有穩定 id」前提下，將既有 JSON 資料集再加工，使其更完整可用。

它與 `spec-hirarchy-to-json` 的輸出規範相同（同一套 schema、命名規則、禁止 runtime overlay），差別是：
- 以 `data.json` 作為 baseline（保留既有 id、保留既有未知欄位/自訂 meta）
- 重新解析 `spec.md` / `transition.md` 推導 expected dataset
- 將 expected 結果「merge 回 data.json」以補齊缺漏、修正錯誤；若 baseline 存在可證明不正確的資料，必須進行修改或刪減（並維持可追溯來源）

此 skills 為檔案驅動，必須讀取 workspace 內三份輸入檔。

## Inputs (required)

必須讀取下列檔案（不得以貼上文字取代）：

- `StateTranstionDiagram/spec.md`
- `StateTranstionDiagram/transition.md`
- `StateTranstionDiagram/data.json`

其中 `StateTranstionDiagram/data.json` 是既有資料集（通常是前一個 skills 產生的 `StateTranstionDiagram/<system>.json`，使用者可能複製/另存為 `data.json` 供此技能使用）。

若任一檔案不存在，需回報缺失路徑並停止。

## Execution (required)

agent 必須直接讀取並解析上述三份檔案，自行完成 merge 並寫出結果檔案，不可呼叫外部腳本或產生器。

### 輸出檔案路徑（required）

輸出檔案路徑固定為：

- `StateTranstionDiagram/data.json`

也就是覆寫第三個 input 檔案。

注意：不得改寫為其他檔名（除非 input 本身不存在，則必須停止並回報缺失）。

## Response rules (required)

不得在回覆中輸出 JSON 內容，只能回報：
- 輸出檔案路徑
- diagram 數量
- state 總數（所有 diagrams 加總）
- transition 總數（所有 diagrams 加總）

## Baseline preservation rules (required)

以 `data.json` 為 baseline，必須遵守：

- 任何既有物件的 `id` 不可變更（diagram/state/transition/connector）。
- 任何既有物件若含有 schema 未定義的欄位（例如 consumer 追加的 `meta.*` 或額外鍵），必須保留。
- `meta.source.raw` 等可追溯來源的文字若已存在：
  - 若可對應到 `transition.md` 的 Mermaid 行（或等價語意的行），不得覆蓋。
  - 若「明確錯誤」（例如完全找不到對應 Mermaid 行、或明顯對錯 diagram/錯誤 from-to/event），必須直接覆蓋修正為正確的 Mermaid 原始行（或最接近的 canonical raw）。
    - 覆蓋前必須把舊值存入 `meta.previousSourceRaw`（放在該物件 `meta` 內）。
- 只在「缺漏」或「可證明不一致/錯誤」時進行補齊/修正/刪減；避免無謂重排或重命名。

### Deletion & reduction rules (required)

此 skills 不只加工補齊；若發現錯誤必須改善，包含修改或刪減 baseline 內容。

安全準則（必須同時滿足）：
- 只刪除「可證明錯誤」或「會造成 dataset 不可用」的資料。
- 若只是「expected 沒出現」但無法證明錯誤，預設不刪除，改用標記 orphaned。

判定為「可證明錯誤」的常見情境（非完整清單）：
- 物件不符合本 skill 的硬性規則（State/Transition/Cross-diagram/Diagram rules），且無法在不更動既有 `id` 的前提下修正。
- transition 的 `from/to` 指向不存在 state，且該 state id 明顯不符合 State rules（無法推導出應有的 diagram/level/page/feature/role）。
- connector `type` 不在允許集合（`contains|invokes`），且無法合理修正。

刪減/刪除的可追溯要求：
- 任何刪除都必須留下審計痕跡於 root：`meta.refineLog`（陣列），每筆包含至少：`kind`, `id`, `action`, `reason`。
  - `action` 必須為 `delete|orphan|fix` 之一。
- 若不是刪除而是修正，需在該物件 `meta.changes`（陣列）追加修正摘要（不覆蓋既有內容）。
- 若需要覆蓋 `meta.source.raw`，必須先把舊值存入 `meta.previousSourceRaw`。

## Parsing expectations (required)

`transition.md` 必須符合以下結構：
- 以 `##` 開頭的段落標題（標題文字可自由命名；可包含任何前綴，例如 `①`/`②`）
- 每一段落內含一個 Mermaid 區塊且以 `stateDiagram-v2` 開頭
- Diagram 類型必須可被推導成三類之一：`global | page | feature`。
  - 最穩定做法（建議）：在 Mermaid 內使用一行註解明確標註類型：
    - `%% diagram: global`
    - `%% diagram: page`
    - `%% diagram: feature`
  - 若未標註，允許以標題做保守推導（見「Diagram rules / Diagram type inference」）。
- `%% verify:` 行必須附著在其上一條 transition；若該段尚未出現 transition，則附著在最近一次出現的 state
  - 這些驗證項目會寫入該 transition 的 `validations` 欄位

若解析結果沒有任何 diagram，或段落缺失 Mermaid 區塊，需提示使用者修正 Markdown 結構後再執行。

## spec.md 的用途（required）

`spec.md` 是 `transition.md` 的需求來源與上下文，用途是讓 agent 在補齊/修正時能「更完整」地生成資料集。

具體來說，轉換時應使用 `spec.md` 來：
- 統一命名與語意（角色命名、功能命名、事件命名）。
- 補足合理缺漏：例如 spec 明確描述的流程狀態，但 `transition.md` 有引用卻未明確宣告為 state（應補 state 並標示 `meta.synthetic=true`）。
- 校驗一致性：若 `transition.md` 與 `spec.md` 明顯矛盾，採「最保守」策略：
  - 不臆造與 spec 衝突的轉移
  - 允許保留 baseline 既有資料，但需在該物件 `meta.conflicts`（陣列）留下可追溯訊息

輸出 JSON 中關於 `spec` 的規則：
- `spec.raw` 預設為 `null`
- `spec.summary` 只保留最小必要摘要（見「Spec extraction rules」）

## Output schema (required)

輸出必須維持與 `spec-hirarchy-to-json` 相同 schema（version 2.0），至少包含：

- Root: `system`, `version`, `generatedAt`, `inputs`, `spec`, `diagrams`, `hierarchy`, `meta`
- Diagram: `id`, `name`, `level`, `parentDiagramId`, `roles`, `source`, `groups`, `states`, `transitions`, `connectors`, `meta`
- State: `id`, `label`, `type`, `groupId`, `tags`, `meta`
- Transition: `id`, `from`, `to`, `event`, `roles`, `validations`, `intent`, `meta`
- Connector: `id`, `type`, `from`, `to`, `meta`

不得新增會破壞 consumer 的 root-level schema（例如新增 `megaGraph`、`index` 等），但可以在既有的 `meta` 物件內加欄位。

## Merge algorithm (required)

### 1) 讀取與基本驗證
- 讀取 `data.json` 並確認可解析為 JSON。
- 若 `version` 非 `2.0`：不得嘗試升級；需停止並回報版本不支援。
- `system` 以 baseline `data.json.system` 為準（不得改）。

### 2) 重新推導 expected dataset
以 `spec.md` + `transition.md` 重新建立 expected diagrams/states/transitions/connectors/hierarchy。
推導規則必須與 `spec-hirarchy-to-json` 一致（見下述規則章節）。

### 3) Merge 回 baseline
- 以 `diagram.id` 做對齊。
  - expected 有、baseline 沒有：新增 diagram。
  - baseline 有、expected 沒有：
    - 若可證明錯誤：允許刪除（並記錄於 `meta.refineLog`）。
    - 否則保留 diagram，但在 `diagram.meta.orphaned=true` 並保留原因文字 `diagram.meta.orphanedReason`。
- diagram 內：
  - states 以 `state.id` 對齊；transitions 以 `transition.id` 對齊；connectors 以 `connector.id` 對齊。
  - baseline 的未知欄位保留。
  - expected 的標準欄位補齊 baseline 的缺漏。

### 4) 補齊與一致性修正
必須處理下列常見缺漏：
- transition `from/to` 引用到不存在的 state：
  - 補該 state，`label` 使用最後一段（state id 的 label），`meta.synthetic=true`。
- 缺少 `intent`：
  - 有 `event` => `intent.category="action"`, `intent.summary=event`
  - 無 `event` => `intent.category="auto"`, `intent.summary="auto"`
- `%% verify:` 缺失：
  - 以 `transition.md` 重新附著到正確的 transition/state。
- `hierarchy`：
  - 必須與 diagrams 的 `parentDiagramId` 一致，且 roots/childrenByDiagramId 完整。

也必須處理下列「可證明錯誤」的修正/刪減（依 Deletion rules 決定 fix/orphan/delete）：
- 不符合 State rules 的 state（例如 `id` 格式錯誤、level/page/feature/role 無法推導）。
- 不符合 Transition rules 的 transition（例如 `id` 不符合格式、或其 `from/to` 無法對應同 diagram 的 state）。
- 違反 Cross-diagram rules 的 transition（跨 diagram state-to-state）：
  - 必須改為 connector 或刪除該 transition（依是否能在不改 id 的前提下修正）。
- connector 與 Diagram parent 規則矛盾且無法修正者。

## Diagram rules (must match spec-hirarchy-to-json)

層級定義：
- `global`: 所有頁面的導航層級。
- `page`: 單一頁面的導航層級，可導航到其他頁面或功能。
- `feature`: 單一功能的導航層級，可導航到其他頁面或功能。

### Diagram type inference

推導順序（越上面優先級越高）：

1) Mermaid directive（建議且最穩定）
- 若 Mermaid block 中存在 `%% diagram: <type>`，其中 `<type>` 為 `global|page|feature`，則直接採用。

2) Title heuristics（未標註時的保守推導）
- 若標題包含 `Feature:`（不分大小寫）則視為 `feature`。
- 否則若標題包含 `Global`（不分大小寫）則視為 `global`。
- 否則預設為 `page`。

### Diagram id rules

- Global
  - `level=global`
  - `id=global_app`

- Page
  - `level=page`
  - `roles=[]`（若此章節是某角色視角的 page，則 roles 填該角色 id，見下一節）
  - `id=page_<pageId>`，其中 `<pageId>` 必須穩定可重現，建議推導規則：
    1. 取章節標題原文。
    2. 移除編號前綴與裝飾符號（例如 `①`、`②`、`1.`、`( )` 之類）。
    3. 若結尾含 `Page`，可移除 `Page` 後再生成 id。
    4. ASCII-safe 正規化：轉小寫、非 `[a-z0-9]` 轉底線、連續底線壓縮、trim。
    5. 若結果為空，退回使用 `page_<order>`（order 為章節出現序）。

- Role-specific Page（視角/角色子圖）
  - `level=page`
  - `roles=[role_id]`
    - `Member` -> `member`
    - `Admin` -> `admin`
    - `Guest` -> `guest`
  - `id=page_<basePageId>_<roleId>`，例如 `page_activity_detail_guest`。

- Feature
  - `level=feature`
  - `id=feature_<featureId>`（建議 snake_case）

父子關係：
- Global 無 parent：`global_app.parentDiagramId=null`
- 所有 Page diagram 的 parent 預設為 Global：`page_*.parentDiagramId=global_app`
- Role-specific Page diagram 的 parent 必須為其 base page（去掉角色後的 page id）
- Feature diagram 的 parent 預設為 Global：`feature_*.parentDiagramId=global_app`

## State rules (must match spec-hirarchy-to-json)

- State id 必須為全域唯一且可重現：
  - `global.<StateLabel>`
  - `page.<PageName>.<StateLabel>`
  - `page.<PageName>.<role>.<StateLabel>`
  - `feature.<FeatureName>.<StateLabel>`
- `type`：`[*] --> X` 則 X 為 `start`，`X --> [*]` 則 X 為 `end`，其餘為 `normal`。
- `tags` 必須包含 diagram 層級，若有角色則加上角色 id。

## Transition rules (must match spec-hirarchy-to-json)

- transition id 格式：`t.<diagramId>.<zeroPaddedSequence>`。
- `event` 為 `:` 後的標籤。
- `validations` 為所有 `%% verify:` 內容。
- `roles` 需繼承該 diagram 的角色設定。

## Cross-diagram rules (must match spec-hirarchy-to-json)

- `transitions` 必須保持在 diagram 內，不可跨 diagram；跨 diagram 關係只能用 `connectors`。

## Connector rules (must match spec-hirarchy-to-json)

- connector `type` 必須為 `contains | invokes`。
- `from.diagramId` / `to.diagramId` 必須指向存在的 diagram。
- `from.stateId` / `to.stateId`：
  - 允許為 `null`（例如純結構關係的 `contains`）。
  - 若非 null，必須指向存在的 state，且該 state 必須屬於各自的 diagram。

語意：
- `contains`：只表達階層（parent/child），`from.stateId=null`、`to.stateId=null`。
- `invokes`：表達跨 diagram 的 state-to-state 連結；若能從 Mermaid transition 推導，必須補齊兩端 stateId。

## Spec extraction rules (required)

從 `spec.md` 萃取以下「最小必要摘要」：
- `productName`: 第一個 `#` 標題文字（需去除 `任務 Spec：` 等前綴）
- `goals`: 取自「產品目標」/「Product Goal」區塊的 bullet
- `roles`: 解析角色名稱並轉成 id（`member`、`admin` 或 snake_case）

若欄位缺失，輸出空陣列（不可省略欄位）。

## Runtime overlay semantics

不得在輸出 JSON 中包含 runtime overlay 或 coverage counters。

## Failure handling

- `data.json` 無法解析：停止並回報 JSON parse error。
- `version` 不支援：停止並回報。
- `transition.md` 結構不合法（無 diagrams/缺 mermaid block）：停止並回報。
- merge 後仍有必填欄位缺失：停止並回報缺失位置與對應 input 來源。
