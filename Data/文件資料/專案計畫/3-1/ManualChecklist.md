# 人工驗收確認表（Manual QA Checklist）
多商家電商平台（Marketplace）

---

## 0. 環境與前置條件
- [ ] 準備 1 組 Visitor（未登入）測試情境（清除瀏覽器 session）
- [ ] 準備 1 組 Buyer 帳號可登入
- [ ] 準備 1 組 Seller 帳號可登入（具備 Seller 身分）
- [ ] 準備 1 組 Platform Admin 帳號可登入
- [ ] 準備至少 3 個商品：status=active / inactive / banned（各 1）且可分屬不同 seller_id
- [ ] active 商品庫存至少 5（可測量減庫存與不足）
- [ ] 準備至少 1 筆 Order 含 2 個 seller 的 SubOrder（可測部分出貨與聚合狀態）
- [ ] 準備至少 1 筆 SellerApplication（status=submitted）可供管理員審核
- [ ] 準備至少 1 筆 RefundRequest（status=requested）可供賣家/管理員處理

## 1. 全站通用（導覽、狀態、錯誤）
- [ ] Visitor Header 僅顯示公共頁與 /login、/signup，不顯示 /cart、/orders、/seller/*、/admin/*
- [ ] Buyer Header 顯示 /cart、/orders、登出，且不顯示 /admin/* 與賣家後台頁
- [ ] Seller Header 顯示 /seller/products、/seller/orders、/seller/settlements、登出，且不顯示 /admin/*
- [ ] Platform Admin Header 顯示 /admin/* 模組入口與登出
- [ ] 主要列表頁（/、/search、/orders、/seller/products、/seller/orders、/seller/settlements、/admin/* 列表）皆具備 Loading 狀態
- [ ] 主要列表頁在無資料時顯示 Empty 狀態（含可理解的文案與返回/建立入口，若適用）
- [ ] 主要列表/詳情頁在 API 失敗時顯示 Error 狀態且提供重試入口
- [ ] 401：未登入進入 /cart、/checkout、/orders*、/reviews/new、/seller/*、/admin/* 時會導向 /login
- [ ] 403：已登入但角色不符進入 /seller/* 或 /admin/* 時會顯示 /403
- [ ] 404：存取不存在資源（例如不存在的 productId/orderId/subOrderId）顯示 /404
- [ ] 5xx：系統例外時顯示 /500 或頁面 Error 狀態且可重試
- [ ] 同一頁面不會同時出現重複的主要入口（例如 Header 已有登入入口，頁面內不再出現第二個主要登入入口）

## 2. Visitor（訪客 / Guest）驗收
- [ ] 進入 / 可看到商品列表（僅展示 status=active 且非 banned）
- [ ] / 商品列表在無商品時顯示 Empty 狀態
- [ ] 進入 /search 可使用搜尋/篩選並看到結果（含 Loading→Ready/Empty）
- [ ] 進入 /products/:productId 可看到商品詳情（存在時）
- [ ] 直接以 URL 存取 banned 商品時不會被展示與購買（顯示不可用或導向 /404，策略一致）
- [ ] 在商品詳情點擊加入購物車會導向 /login，且不建立購物車項目
- [ ] 直接進入 /cart 會導向 /login
- [ ] 直接進入 /checkout 會導向 /login
- [ ] 直接進入 /orders 會導向 /login
- [ ] 直接進入 /seller/products 會導向 /login
- [ ] 直接進入 /admin/orders 會導向 /login

## 3. Buyer（買家）端到端主流程
- [ ] 可在 /signup 完成註冊，成功後導向 /login
- [ ] 可在 /login 登入成功，登入後 Header 依 Buyer 規則顯示
- [ ] 登入失敗時顯示可理解錯誤訊息且不建立登入狀態
- [ ] 登出後回到 Visitor 規則，且受保護頁再進入會導向 /login
- [ ] 在 /products/:productId（active 商品）加入購物車成功，/cart 內容更新
- [ ] 在 /products/:productId（inactive 或 banned 商品）無法加入購物車，顯示原因且購物車不變
- [ ] 在 /cart 可調整商品數量（>=1）並成功更新
- [ ] 在 /cart 將數量調整為不合法值會被阻擋或回報錯誤且不造成錯誤資料
- [ ] 在 /cart 可移除商品並成功更新列表
- [ ] 在 /cart 點擊前往 /checkout 可成功導覽
- [ ] 在 /checkout 建立 1 筆 Order（status=created）與 N 筆 SubOrder（status=pending_payment）
- [ ] /checkout 建單前會再次檢查商品仍為 active 且庫存足夠
- [ ] 若結帳時部分商品缺貨，系統會提示並阻擋建立訂單或要求調整（策略一致）
- [ ] /checkout 建立 Payment（payment_status=pending）並進入付款流程
- [ ] /payment/result 顯示付款成功結果時：Payment=succeeded、Order=paid、各 SubOrder=paid
- [ ] /payment/result 顯示付款失敗或取消時：Payment=failed/cancelled、Order 仍為 created、SubOrder 仍為 pending_payment，且提供重試付款入口
- [ ] 付款成功後庫存扣減正確且不會扣成負數
- [ ] 在 /orders 可看到自己的訂單列表
- [ ] 進入 /orders/:orderId 可看到該 Order 與 SubOrder 列表與狀態
- [ ] 進入 /orders/:orderId/suborders/:subOrderId 可看到子訂單詳情與售後入口（依狀態顯示）

## 4. Buyer（買家）取消、退款、評價
- [ ] 付款前取消：Order 取消後 Order=cancelled 且各 SubOrder=cancelled
- [ ] 付款前取消後不可再將該筆 SubOrder 透過付款 callback 更新為 paid
- [ ] 付款後對特定 SubOrder 申請退款可建立 RefundRequest（status=requested）且 SubOrder=refund_requested
- [ ] 退款申請可填寫 reason 與 requested_amount，並可支援 approved_amount（部分退款）
- [ ] 退款被同意並完成後：RefundRequest=refunded 且 SubOrder=refunded（不可回退）
- [ ] 退款被拒絕後：RefundRequest=rejected 且 SubOrder 恢復為申請前狀態（paid/shipped/delivered 之一）
- [ ] delivered 的 SubOrder 才能進入 /reviews/new?productId=... 建立 Review
- [ ] 未 delivered 的交易嘗試建立 Review 會被阻擋（403 或禁止狀態，策略一致）
- [ ] Review comment 內容顯示時不會執行腳本（XSS 防護有效）

## 5. Buyer（買家）資料隔離與越權防護
- [ ] Buyer 無法在 /orders/:orderId 讀取他人的 Order（回 404 或 403，策略一致）
- [ ] Buyer 無法在 /orders/:orderId/suborders/:subOrderId 讀取他人的 SubOrder（回 404 或 403，策略一致）
- [ ] Buyer 無法存取 /seller/orders 或 /admin/orders（顯示 /403）

## 6. Seller（賣家）入駐與商品管理
- [ ] 已登入但尚未成為 Seller 的使用者可在 /seller/apply 送出 SellerApplication（status=submitted）
- [ ] SellerApplication 已 submitted 時頁面顯示已提交狀態且不可重複送出（或依策略一致）
- [ ] Platform Admin 核准後，該使用者取得 Seller 身分並可進入 /seller/products
- [ ] 在 /seller/products 可看到僅屬於自己的商品列表
- [ ] 在 /seller/products/new 可建立商品（title/description/price/stock/category/status）
- [ ] 只有 status=active 的商品可被 Buyer 加入購物車與結帳
- [ ] banned 商品不會在公共頁展示與購買
- [ ] 在 /seller/products/:productId/edit 修改商品成功後資料會正確回填
- [ ] Seller 無法編輯他人商品（回 404 或 403，策略一致）

## 7. Seller（賣家）子訂單出貨與售後
- [ ] 在 /seller/orders 只看到 seller_id 為自己的 SubOrder
- [ ] 在 /seller/orders/:subOrderId 只可存取自己的 SubOrder（他人回 404 或 403）
- [ ] 針對 paid 的 SubOrder 可執行出貨，狀態轉為 shipped
- [ ] 針對非 paid 的 SubOrder 不可出貨，會顯示限制原因
- [ ] 針對 refund_requested 的 SubOrder 可同意或拒絕
- [ ] 同意退款並完成後 SubOrder=refunded（不可回退）
- [ ] 拒絕退款後 SubOrder 會恢復到申請前狀態且結果可追溯

## 8. Seller（賣家）結算
- [ ] 在 /seller/settlements 只看到自己的結算列表
- [ ] 在 /seller/settlements/:settlementId 只可存取自己的結算詳情
- [ ] 結算 status=settled 時不可被修改

## 9. Platform Admin（管理員）審核、分類、介入、數據
- [ ] 在 /admin/seller-applications 可看到 SellerApplication 列表並可 approve/reject
- [ ] approve/reject 後 SellerApplication 狀態更新且可追溯
- [ ] 在 /admin/categories 可建立分類並調整 status=active/inactive
- [ ] inactive 分類仍可被既有商品引用，但不可用於新商品指派（策略一致且可稽核）
- [ ] 在 /admin/orders 可查詢 Order 並可執行強制取消/退款（依規則）
- [ ] 在 /admin/disputes 可將 DisputeCase open→resolved 並保存 resolution_note
- [ ] 在 /admin/refunds 可處理 RefundRequest（approve/reject/force refund）且結果一致反映到 SubOrder/Order
- [ ] 在 /admin/analytics 可載入營運數據並具備 Loading/Error 狀態

## 10. 冪等、併發、一致性與補償
- [ ] Payment callback 重複回呼時，不會重複扣庫存且不會重複更新 Order/SubOrder
- [ ] Payment callback 冪等鍵以 transaction_id + order_id 生效（可用同 transaction_id 重送驗證）
- [ ] 付款成功後庫存扣減使用原子更新或等價方式避免超賣
- [ ] 若付款成功但訂單建立失敗，系統具備補償/補單機制或可被標記並可追蹤處理
- [ ] Order 狀態由 SubOrder 聚合計算，且在 SubOrder 狀態變更後會同步更新
- [ ] 部分 SubOrder shipped 時 Order=partially_shipped；全部 delivered 時 Order=completed；全部 refunded 時 Order=refunded；全部 cancelled 時 Order=cancelled

## 11. 稽核（AuditLog）
- [ ] Platform Admin 審核 SellerApplication 會寫入 AuditLog（包含 actor_role/action/target）
- [ ] Platform Admin 建立/調整 Category 會寫入 AuditLog
- [ ] Platform Admin 強制取消/退款會寫入 AuditLog
- [ ] 結算 settle 操作會寫入 AuditLog
- [ ] 退款拒絕後恢復原狀態的決策可被稽核（可追溯申請前狀態與操作者）

## 12. RWD 與可用性
- [ ] 主要公共頁（/、/search、/products/:productId）在常見螢幕寬度下可正常使用
- [ ] 表單頁（/login、/signup、/seller/apply、/seller/products/new、/seller/products/:productId/edit、/reviews/new）在常見螢幕寬度下可正常填寫與提交
- [ ] 列表頁在資料量較多時仍可操作（滾動/切換篩選）且 Loading 狀態不阻塞導覽
