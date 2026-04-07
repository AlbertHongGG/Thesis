# 技術棧定義（Tech Stack）
多商家電商平台（Marketplace）

---

## 1. 前端（Frontend）
- Framework: Next.js（App Router）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query（server state）
- Form / Validation: React Hook Form + Zod
- Routing: Next.js Route Handlers + App Router
- （若 Spec 有圖表需求）Charts: （未要求）
- （若 Spec 有日期處理需求）Date Handling: （未要求）

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST（JSON）
- Auth: Cookie-based session（HttpOnly）+ RBAC
- Validation: Zod（request validation）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；僅使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright（E2E）+ Vitest（FE）+ Jest（BE）
- Dev Tooling: ESLint + Prettier
