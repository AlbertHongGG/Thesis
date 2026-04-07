# 技術棧定義（Tech Stack）
客服工單系統

---

## 1. 前端（Frontend）
- Framework: React + Vite
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query
- Form / Validation: React Hook Form + Zod
- Routing: React Router
- （若 Spec 有圖表需求）Charts: Recharts
- （若 Spec 有日期處理需求）Date Handling: date-fns

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST
- Auth: JWT（Token-based session）
- Validation: Zod

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Vitest（FE）+ Jest（BE）
- Dev Tooling: ESLint + Prettier
