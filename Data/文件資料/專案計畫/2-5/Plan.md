# 技術棧定義（Tech Stack）
多角色論壇／社群平台（Multi-Role Forum & Community Platform）

---

## 1. 前端（Frontend）
- Framework: Next.js（App Router；支援路由守衛與錯誤頁）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query（Server State；支援 optimistic 更新與一致性回滾）
- Form / Validation: React Hook Form + Zod
- Routing: Next.js Routing（含 middleware/guard）
- （若 Spec 有圖表需求）Charts: 不需要（Spec 未要求）
- （若 Spec 有日期處理需求）Date Handling: Day.js（僅必要處理 created_at 顯示）

## 2. 後端（Backend）
- Runtime / Framework: Node.js + Next.js Route Handlers（同域 cookie session）
- Language: TypeScript
- API Style: REST（JSON）
- Auth: HttpOnly Cookie Session（可搭配 CSRF token）
- Validation: Zod（請求驗證 + RBAC/Scope 檢查）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright（E2E；覆蓋 RBAC、401/403/404/5xx）
- Dev Tooling: ESLint + Prettier（維持一致性）
