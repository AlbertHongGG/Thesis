# 功能覆蓋確認表（Feature Coverage Checklist）

多商家電商平台（Marketplace）

---

## Authentication / Session

- [N/T] 註冊（/signup）
- [N/T] 登入（/login）
- [N/T] 登出
- [N/T] 未登入存取受保護資源的 401 導向 /login

## RBAC / 存取控制

- [N/T] Visitor / Buyer / Seller / Platform Admin 角色分流
- [N/T] 路由存取控制（/cart、/checkout、/orders*、/seller/*、/admin/\*）
- [T] Buyer 僅能存取自己的 Cart/Order/SubOrder/Payment/RefundRequest/Review
- [N/T] Seller 僅能存取自己的 Product/SubOrder/Settlement
- [N/T] Platform Admin 可執行管理介入且操作可稽核
- [N/T] 導覽可見性規則（不同角色顯示不同入口）

## Catalog（商品瀏覽）

- [N/T] 商品列表（/）
- [N/T] 搜尋/篩選（/search）
- [N/T] 商品詳情（/products/:productId）
- [N/T] 僅展示與可購買 status=active 商品
- [N/T] banned 商品不可展示與購買

## Cart（購物車）

- [N/T] 加入購物車（Buyer）
- [N/T] 調整數量
- [N/T] 移除商品
- [N/T] Visitor 嘗試購物車/結帳導向登入

## Checkout / Order / SubOrders

- [N/T] 結帳頁（/checkout）
- [N/T] 建立 Order（聚合訂單）
- [N/T] 依 seller_id 拆分建立 N 筆 SubOrder
- [N/T] 建單前再次檢查商品狀態與庫存
- [N/T] 部分賣家缺貨的處理策略（提示/阻擋/調整）

## Payment

- [N/T] 建立 Payment（pending）
- [N/T] 付款結果頁（/payment/result）
- [N/T] 付款成功 callback 更新 Payment/Order/SubOrder
- [T] 付款失敗/取消可重試（Order 仍為 created）
- [N/T] callback 冪等（transaction_id + order_id）
- [ ] 付款成功但訂單建立失敗的補償/補單機制

## Fulfillment（出貨/送達）

- [N/T] Seller 出貨：SubOrder paid→shipped
- [T] Buyer 確認收貨或自動完成：SubOrder shipped→delivered
- [N/T] Order 狀態由 SubOrder 聚合計算（created/paid/partially_shipped/completed/cancelled/refunded）

## Cancellation / Refund

- [T] 付款前取消 Order（Order cancelled、SubOrder cancelled）
- [N/T] 付款後對 SubOrder 申請退款（RefundRequest requested、SubOrder refund_requested）
- [N/T] Seller 審核退款（同意/拒絕）
- [N/T] Platform Admin 介入退款/強制退款
- [T] 部分退款（approved_amount）
- [N/T] SubOrder refunded 終態不可回退
- [N/T] 退款拒絕後恢復申請前狀態（需可稽核）

## Reviews

- [T] 新增評價（/reviews/new?productId=...）
- [N/T] 僅 delivered 的交易可評價
- [N/T] Review comment 防 XSS

## Seller Onboarding

- [N/T] 申請成為賣家（/seller/apply）
- [N/T] 管理員審核 SellerApplication（submitted/approved/rejected）

## Seller Backoffice

- [N/T] 商品管理（/seller/products）
- [N/T] 新增商品（/seller/products/new）
- [N/T] 編輯商品（/seller/products/:productId/edit）
- [ ] 商品狀態管理（draft/active/inactive/banned）
- [N/T] 子訂單列表（/seller/orders）
- [N/T] 子訂單處理（/seller/orders/:subOrderId）
- [N/T] 結算列表（/seller/settlements）
- [N/T] 結算詳情（/seller/settlements/:settlementId）

## Admin Console

- [N/T] 賣家申請審核（/admin/seller-applications）
- [N/T] 商品分類管理（/admin/categories）
- [T] 訂單查詢與介入（/admin/orders）
- [N/T] 糾紛介入（/admin/disputes）
- [T] 退款處理（/admin/refunds）
- [T] 營運數據（/admin/analytics）

## Settlement

- [ ] 依 period 計算 seller 結算金額（gross/platform_fee/net）
- [ ] 結算狀態（pending/settled）與 settled 不可修改

## DisputeCase

- [ ] 建立/處理訂單糾紛（open/resolved）
- [N/T] 管理員介入並保存 resolution_note

## AuditLog

- [N/T] 審核（賣家申請）寫入 AuditLog
- [N/T] 分類管理寫入 AuditLog
- [T] 強制取消/退款寫入 AuditLog
- [N] 結算操作寫入 AuditLog
- [N/T] 重要狀態變更可被稽核追溯

## Error Pages

- [N/T] /403 無權限頁
- [N/T] /404 不存在頁
- [N/T] /500 系統錯誤頁
