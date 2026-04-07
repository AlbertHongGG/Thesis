# 技術棧定義（Tech Stack）
SmartBooking 預約型服務平台

---

## 1. 前端（Frontend）
- Framework: React（SPA）
- Language: TypeScript
- UI / Styling: Tailwind CSS
- State / Data Fetching: TanStack Query（Server State）
- Form / Validation: React Hook Form + Zod
- Routing: React Router
- （若 Spec 有日期處理需求）Date Handling: dayjs

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST（JSON）
- Auth: JWT（Access Token）
- Validation: Zod（或等價的 schema validation）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）（固定；只能使用 SQLite（本機單檔））
- ORM: Prisma（搭配 SQLite（本機單檔））
- Migrations: Prisma Migrate（SQLite（本機單檔））

## 4. 其他（Optional）
- Testing: Playwright（E2E）+ Vitest（Unit）
- Dev Tooling: ESLint + Prettier
