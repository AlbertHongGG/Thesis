# 技術棧定義（Tech Stack）
SaaS 訂閱與計費管理平台（Subscription & Billing System）

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
- API Style: REST（JSON）
- Auth: Cookie-based Session（httpOnly）
- Validation: Zod（API request/response schema）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest（unit）+ Playwright（E2E）
- Dev Tooling: ESLint + Prettier
