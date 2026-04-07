# 技術棧定義（Tech Stack）
金流前置模擬平台（非真的刷卡）

---

## 1. 前端（Frontend）
- Framework: React（Vite）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: React Router
- （若 Spec 有圖表需求）Charts: 無（Spec 未要求圖表）
- （若 Spec 有日期處理需求）Date Handling: dayjs

## 2. 後端（Backend）
- Runtime / Framework: Node.js（Fastify）
- Language: TypeScript
- API Style: REST + JSON
- Auth: Session Cookie（HttpOnly）+ Server-side Session Store（SQLite（本機單檔）透過 Prisma）
- Validation: Zod

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest（單元/整合）+ Playwright（E2E）
- Dev Tooling: ESLint + Prettier
