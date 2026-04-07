# 技術棧定義（Tech Stack）
內部文件審核與簽核系統

---

## 1. 前端（Frontend）
- Framework: React（SPA）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: React Router

## 2. 後端（Backend）
- Runtime / Framework: Node.js + Fastify
- Language: TypeScript
- API Style: REST (JSON)
- Auth: JWT（token-based；建議 HttpOnly Cookie）
- Validation: Zod

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest + Playwright
- Dev Tooling: ESLint + Prettier
