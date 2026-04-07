# 技術棧定義（Tech Stack）
線上課程平台（非影音串流）

---

## 1. 前端（Frontend）
- Framework: Next.js
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: Next.js App Router

## 2. 後端（Backend）
- Runtime / Framework: Next.js (Route Handlers)
- Language: TypeScript
- API Style: REST (JSON)
- Auth: Cookie-based session
- Validation: Zod

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright (E2E) + Vitest
- Dev Tooling: ESLint + Prettier
