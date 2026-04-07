# 技術棧定義（Tech Stack）

## 1. 前端（Frontend）
- Framework: React (Vite)
- Language: TypeScript
- UI / Styling: Tailwind CSS（搭配 Headless UI / Radix UI 元件）
- State / Data Fetching: TanStack Query（REST API caching + optimistic update）
- Form / Validation: React Hook Form + Zod（表單驗證、錯誤提示、狀態鎖定）
- Routing: React Router

補充（對應請假業務需求）：
- Date Utilities: date-fns（日期區間、格式化、公司時區顯示）
- Calendar UI: FullCalendar（部門請假日曆月/週視圖）
- File Upload: 前端以 multipart/form-data 上傳附件，並顯示上傳進度與失敗重試

## 2. 後端（Backend）
- Runtime / Framework: Node.js + NestJS
- Language: TypeScript
- API Style: REST (JSON)
- Auth: JWT（HttpOnly Cookie）+ bcrypt（密碼雜湊），並以 Guard 實作 role-based access
- Validation: class-validator + class-transformer（DTO 驗證）
- Logging: Pino（request id、審核動作、錯誤追蹤）

補充（對應一致性/不可逆審核/預扣額度）：
- Concurrency/Consistency: 以資料庫 transaction + 唯一/檢查約束確保「同區間衝突」與「預扣/扣抵一致性」
- File Storage（MVP）: 附件存於伺服器檔案系統（或以可替換介面抽象，後續可接 S3/Azure Blob）

## 3. 資料庫（Database）
- DB Engine: SQLite（本機單檔）
- ORM: Prisma
- Migrations: Prisma Migrate

建議資料庫策略（對應請假規則）：
- 使用 Prisma transaction 處理 submit/approve/reject/cancel 與 LeaveBalanceLedger 寫入
- 針對 LeaveRequest 建立必要索引（user_id, start_date, end_date, status）提升衝突檢查效能

## 4. 其他（Optional）
- Testing: Vitest + React Testing Library（前端）；Jest + Supertest（後端 API）
- Dev Tooling: ESLint + Prettier + Husky（pre-commit）
