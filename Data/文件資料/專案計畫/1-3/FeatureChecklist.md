# 功能覆蓋確認表（Feature Coverage Checklist）

> 用途：快速確認「功能是否存在」（有入口/頁面/權限/資料流）。
> 注意：此清單不驗收細節（流程、錯誤訊息、邊界、資料一致性細節）—細節請用「人工驗收確認表」。

---

## Authentication / Session
- [N/T] 註冊功能（Email + 密碼 + 確認密碼）
- [N/T] 登入功能（Email + 密碼）
- [N/T] 登出功能（清除 Session/Token）
- [N/T] Session/Token 維持登入狀態（刷新頁面仍可判定登入狀態）
- [N/T] Session/Token 過期處理（受保護 API 401 時導向登入）

## Roles / Access Control
- [N/T] 角色：Guest（未登入）
- [N/T] 角色：User（已登入）
- [N/T] 路由存取控制：Guest 可進入 `/login`、`/register`
- [N/T] 路由存取控制：Guest 不可進入 `/transactions`、`/reports`、`/categories`（會導向登入）
- [N/T] 路由存取控制：User 進入 `/login`、`/register` 會自動導向 `/transactions`
- [N/T] 資料存取控制：User 只能存取自己的 Transaction/Category（避免 IDOR）
- [N/T] 導覽顯示規則：Guest 與 User 顯示不同導覽項目

## Core Entities（Data Model Existence）
- [N/T] User 資料模型存在（含 email/password_hash/created_at/updated_at）
- [N/T] Category 資料模型存在（含 user_id/name/type/is_active/is_default）
- [N/T] Transaction 資料模型存在（含 user_id/category_id/type/amount/date/note）
- [N/T] 預設類別機制存在（Category.user_id 為 Null 的共用類別）

## Transactions（帳務）
- [N/T] 帳務列表頁存在（`/transactions`）
- [N/T] 帳務列表依日期分組顯示（Daily Grouped List）
- [N/T] 每日統計顯示存在（當日總收入/當日總支出）
- [N/T] 新增帳務功能存在（表單 Modal）
- [T] 新增帳務功能正常 (類別檢查誤判)
- [N/T] 編輯帳務功能存在（表單 Modal）
- [N/T] 編輯帳務功能正常
- [N/T] 刪除帳務功能存在（二次確認）
- [N/T] 帳務欄位驗證存在（type/amount/category/date 必填、note 長度限制）
- [N/T] 類別選擇僅顯示 active 類別（新增/編輯帳務時）

## Categories（類別管理）
- [N/T] 類別管理頁存在（`/categories`）
- [N/T] 類別清單顯示存在（包含預設與自訂）
- [N/T] 新增自訂類別功能存在
- [N/T] 編輯類別名稱功能存在
- [T] 編輯類別名稱功能正常 (輸入功能異常)
- [N/T] 停用/啟用類別功能存在（is_active 切換）
- [N/T] 類別「同使用者內唯一」規則存在（name unique per user）
- [N/T] 類別不可刪除的限制存在（以功能入口限制或後端拒絕）
- [N/T] 停用類別不影響歷史帳務顯示（歷史資料保留）

## Reports（月報表）
- [N/T] 月報表頁存在（`/reports`）
- [N/T] 年份選擇器存在（至少當年與前 2 年）
- [N/T] 月份選擇器存在（1~12）
- [N/T] 預設顯示當前年月報表
- [N/T] 統計卡片存在（總收入/總支出/淨收支）

## Charts（圖表）
- [N/T] 支出類別圓餅圖存在（expense by category）
- [N/T] 每日收支長條圖存在（收入柱 + 支出柱）
- [T] 圓餅圖空資料提示存在（本月無支出）
- [T] 長條圖空資料提示存在（本月無資料）

## Export（CSV，選擇性）
- [N/T] 匯出 CSV 功能存在（在 `/reports`）
- [N/T] 匯出範圍限制存在（僅當前選擇月份）
- [N/T] 匯出檔名規則存在（`transactions_YYYY_MM.csv`）

## Consistency / Performance / Security
- [T] CRUD 後資料一致性機制存在（列表/日統計/月統計/圖表同步） (登入有資料沒有顯示的問題，需重整)
- [N/T] 匯出資料與畫面一致的約束存在（若有實作匯出）
- [N/T] CSRF 防護存在（以 Token 驗證等方式）
- [N/T] API 以 Token + user_id 驗證授權存在
