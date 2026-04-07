# 技術棧定義（Tech Stack）
多使用者協作待辦系統（Trello Lite）

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
- Runtime / Framework: Node.js + Fastify
- Language: TypeScript
- API Style: REST
- Auth: Cookie-based session（短效 access token + refresh；401 導向登入）
- Validation: Zod

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest + Playwright
- Dev Tooling: ESLint + Prettier
