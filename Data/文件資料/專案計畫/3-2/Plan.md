# 技術棧定義（Tech Stack）
企業級專案管理系統（Jira Lite）

---

## 1. 前端（Frontend）
- Framework: Next.js（React）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: Next.js App Router
- Date Handling: date-fns

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST
- Auth: HttpOnly Cookie Session（搭配 CSRF 防護）
- Validation: Zod（或等效 schema validation）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright（E2E）+ Vitest（Unit）
- Dev Tooling: ESLint + Prettier
