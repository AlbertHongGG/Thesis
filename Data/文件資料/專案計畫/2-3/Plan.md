# 技術棧定義（Tech Stack）
API 平台與金鑰管理系統

---

## 1. 前端（Frontend）
- Framework: Next.js（App Router）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: Next.js Routing（Route Guard 於 layout / middleware）
- Date Handling: date-fns

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS（Fastify adapter）
- Language: TypeScript
- API Style: REST (JSON)
- Auth: Web Session（httpOnly Cookie）+ API Key（Authorization: Bearer）
- Validation: Zod（DTO 驗證）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest + Playwright
- Dev Tooling: ESLint + Prettier
