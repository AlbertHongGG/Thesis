# 技術棧定義（Tech Stack）
問卷／表單系統（動態邏輯）

---

## 1. 前端（Frontend）
- Framework: Next.js（React）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: Next.js App Router
- （若 Spec 有圖表需求）Charts: 無（以統計數值/列表呈現）
- （若 Spec 有日期處理需求）Date Handling: Day.js

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST JSON
- Auth: Cookie-based Session（登入後可用於 /surveys*）
- Validation: Zod（Request/Response schema）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright（E2E）+ Vitest（前端）+ Jest（後端）
- Dev Tooling: ESLint + Prettier
