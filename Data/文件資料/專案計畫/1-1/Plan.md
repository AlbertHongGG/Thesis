# 技術棧定義（Tech Stack）
社團活動管理平台（Activity Management Platform）

---

## 1. 前端（Frontend）
- Framework: React（Vite）
- Language: TypeScript
- UI / Styling: Tailwind CSS（RWD）
- State / Data Fetching: TanStack Query（Server State）
- Form / Validation: React Hook Form + Zod
- Routing: React Router
- （若 Spec 有圖表需求）Charts: N/A（Spec 未要求圖表）
- （若 Spec 有日期處理需求）Date Handling: Day.js（搭配單一時區顯示與比較）

## 2. 後端（Backend）
- Runtime / Framework: Node.js + Fastify
- Language: TypeScript
- API Style: REST（JSON）
- Auth: Session（HttpOnly Cookie）
- Validation: Zod（Request Validation）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest（單元）+ Playwright（E2E）
- Dev Tooling: ESLint + Prettier + Prisma Studio
