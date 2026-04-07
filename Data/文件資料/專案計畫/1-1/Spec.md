# 任務 Spec：社團活動管理平台
Activity Management Platform

---

## 1. 產品目標（Product Goal）
建立一個供社團成員與幹部使用的活動管理平台，讓使用者能：

- 瀏覽即將舉辦的活動
- 報名活動 / 取消報名活動
- 管理員可建立、管理活動並查看報名狀況

系統需具備以下能力：

- 使用者登入與身分驗證
- 角色權限控管
- 活動狀態管理（State Machine）
- 名額控管與一致性（避免超賣）
- 前後端資料一致性（含交易與防重複）

補充目標：
- 讓使用者可清楚看到報名狀態與可用名額
- 讓管理員可快速掌握活動與報名名單

---

## 2. 使用者角色定義（Roles）

### 2.1 一般使用者（Member）
- 可瀏覽活動清單（僅顯示可公開活動）
- 可查看活動詳情
- 可報名活動
- 可取消已報名活動（限截止前與活動未結束）
- 可查看自己已報名的活動

### 2.2 管理員（Admin）
- 具備所有 Member 權限
- 可建立 / 編輯 / 下架活動
- 可查看活動報名名單
- 可手動關閉活動報名
- 可匯出報名名單為 CSV

限制：
- 同一帳號不可同時是 Member 與 Admin
- 角色由系統設定，不可自行切換

---

## 3. 使用者流程（User Flow）

### 3.1 一般使用者流程
1. 註冊 / 登入
2. 進入活動列表頁
3. 查看活動詳情
4. 報名活動
5. 於「我的活動」頁查看已報名活動
6. 於報名截止前可取消報名

### 3.2 管理員流程
1. 登入系統
2. 進入管理後台
3. 建立活動
4. 設定活動資訊與名額
5. 發佈活動
6. 查看即時報名狀況
7. 關閉報名或下架活動

### 3.3 例外流程與錯誤處理
- 未登入使用者嘗試報名 -> 導向登入或回傳 401
- 權限不足嘗試進入管理頁 -> 403
- 活動不存在 -> 404
- 活動已截止或已結束 -> 禁止報名 / 取消

---

## 4. 功能需求（Functional Requirements）

### 4.1 帳號與認證
- 使用 Email + 密碼登入
- 密碼需使用安全雜湊（如 bcrypt / argon2）儲存
- 登入成功後發放可驗證身分的 Token 或 Session
- 未登入不可報名活動
- 權限不足者不可進入管理頁
- 需要具備登出功能

### 4.2 活動管理（Activity）
活動欄位：
- title
- description（多行文字）
- date
- location
- deadline
- capacity
- status

活動狀態（State Machine）：
- draft：草稿，僅管理員可見
- published：已發佈，可報名
- full：額滿（系統自動）
- closed：報名關閉
- archived：已下架

規則：
- date 必須晚於 deadline
- capacity 必須為正整數
- status 為 full 時不可再報名
- 管理員可將 published / full -> closed
- 管理員可將 closed / draft -> archived

### 4.3 報名系統（Registration）
- 同一使用者對同一活動只能報名一次
- 活動狀態非 published 時不可報名
- 報名人數達上限時：
  - 自動切換為 full
  - 不可再報名
- 取消報名後：
  - 名額即時釋放
  - 若未額滿可回到 published

一致性要求：
- 報名需使用交易或原子操作避免超賣
- 報名需防重複提交（idempotent）

### 4.4 活動列表頁（Activity List）
顯示範圍：
- published
- full

顯示資訊：
- 活動名稱
- 日期
- 地點
- 目前報名人數 / 名額上限
- 報名狀態（可報名 / 已報名 / 額滿）

### 4.5 活動詳情頁（Activity Detail）
- 顯示完整活動資訊
- 依使用者狀態顯示：
  - 報名按鈕
  - 取消報名按鈕
  - 已額滿提示

### 4.6 我的活動頁（My Activities）
- 僅顯示使用者已報名的活動
- 依活動日期排序
- 顯示狀態：
  - 即將開始
  - 已結束

### 4.7 管理後台（Admin Panel）
功能：
- 活動 CRUD
- 手動關閉報名
- 查看報名名單（姓名 / Email / 報名時間）
- 匯出報名名單為 CSV

---

## 5. 非功能需求（Non-functional Requirements）
- RWD（支援桌機與手機）
- 基本錯誤處理（401 / 403 / 404）
- 操作需有 loading 與錯誤提示
- 前後端資料需同步，避免超賣
- 系統時間以同一時區為準（可設定預設時區）
- 紀錄重要操作（建立 / 修改 / 狀態變更）

---

## 6. 資料模型（Conceptual Data Model）

User
- id
- name
- email
- role (member | admin)
- password_hash
- created_at

Activity
- id
- title
- description
- date
- location
- capacity
- status
- deadline
- created_by
- created_at
- updated_at

Registration
- id
- user_id
- activity_id
- created_at
- canceled_at (nullable)
