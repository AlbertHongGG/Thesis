---
name: transition-validation
description: 驗證並修正 `StateTranstionDiagram/data.json` 是否符合 `spec-hirarchy-to-json` skill 定義的 schema 與規則（不使用 Python）。
---

# transition-validation

此 agent skill 用來「驗證 + 自動修正」由 `StateTranstionDiagram` 產生出的資料集（`StateTranstionDiagram/data.json`），確保其符合本 repo 既有 skill `spec-hirarchy-to-json` 所定義的 schema 與硬性規則。

重點：
- 不可使用 Python。
- 不可呼叫 workspace 內任何 Python 產生器/腳本。
- 只針對 `data.json` 做 schema 與一致性驗證；能安全修正的就直接修正。
- 不輸出 JSON 內容到回覆，只回報結果摘要。

## Inputs (required)

必須直接讀取下列檔案（不得以貼上文字取代）：

- `StateTranstionDiagram/data.json`

若檔案不存在，需回報缺失路徑並停止。

## Execution (required)

使用 Node.js 執行 validator（本 repo 內附），完成驗證與修正。

- 入口：`tools/transition-validation/validate.mjs`

預設行為：
- 直接在原檔上修正（in-place overwrite）。
- 若發現「無法在不破壞資料集可用性前提下修正」的錯誤（例如重複 diagram/state id），則必須停止並回報。

## Validation rules (must match spec-hirarchy-to-json)

必須至少驗證並確保以下項目成立（對應 `spec-hirarchy-to-json` 的 schema 與規則）：

### Root

- `version` 必須為 `"2.0"`。
- 必填欄位存在：`system`, `version`, `generatedAt`, `inputs`, `spec`, `diagrams`, `hierarchy`, `meta`。

### Diagram

- 必填欄位存在：`id`, `name`, `level`, `parentDiagramId`, `roles`, `source`, `groups`, `states`, `transitions`, `connectors`, `meta`。
- `level` 必須為 `page | feature`（Entry 視為 `page`；不使用/不輸出 `global`）。
- `parentDiagramId` 必須為 null 或指向存在的 diagram。

### State

- `id` 必須全域唯一。
- `type` 必須為 `start | end | normal`。
- `tags` 必須至少包含 diagram level；若為角色圖（diagram.roles 非空），則 tags 必須包含該角色 id。
- `meta.diagramId` 必須等於所屬 diagram id。

### Transition

- `from` / `to` 必須指向同 diagram 內存在的 state。
- `intent` 必須存在：
  - 有 event => `intent.category=action`, `intent.summary=event`
  - 無 event => `intent.category=auto`, `intent.summary=auto`
- `roles` 必須等於所屬 diagram.roles（非角色圖必為空陣列）。

### Connector

- `type` 必須為 `contains | invokes`。
- `from.diagramId` / `to.diagramId` 必須指向存在的 diagram。
- `from.stateId` / `to.stateId` 若存在（非 null），必須指向存在的 state，且該 state 必須屬於各自的 diagram。

### Hierarchy

- `hierarchy.roots` / `hierarchy.childrenByDiagramId` 必須與 diagrams 的 `parentDiagramId` 一致且完整。

## Fix rules (required)

- 只能做「不破壞 consumer 可用性」的修正。
- 不更動任何既有 `id`（diagram/state/transition/connector）。
- 若遇到無法安全修正的資料問題，需停止並回報錯誤清單。
- 所有修正摘要寫入 `meta.validation.fixes[]`；所有無法修正的問題寫入 `meta.validation.issues[]`。

`meta.validation` 的建議格式：

```json
{
  "validation": {
    "issues": [{"path": "...", "message": "..."}],
    "fixes": [{"path": "...", "message": "..."}]
  }
}
```

## Response rules (required)

不得在回覆中輸出 JSON 內容，只能回報：

- 輸出檔案路徑（固定 `StateTranstionDiagram/data.json`）
- diagram 數量
- state 總數（所有 diagrams 加總）
- transition 總數（所有 diagrams 加總）
- issues 數量、fixes 數量
