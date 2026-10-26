# Topic iv: Transaction

**Owner:** Hoàng · **Step:** T4 · **Status:** ⬜ · **Topic chính (bắt buộc)**

## 1. Lý thuyết (T4.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Phạm vi ACID | Đầy đủ, nhiều câu lệnh, nhiều bảng | Ghi **trong 1 partition** là atomic + isolated; không có transaction nhiều partition/bảng |
| Cú pháp | `BEGIN TRAN / COMMIT / ROLLBACK`, `SAVE TRAN`, `TRY…CATCH`, `XACT_ABORT` | `BEGIN BATCH … APPLY BATCH` (logged: atomic, **không** isolation); LWT `IF [NOT] EXISTS / IF cond` (Paxos) |
| Durability | Write-ahead log (`.ldf`), checkpoint | Commit log + replication |
| Chế độ | Autocommit, explicit, implicit | Mỗi câu lệnh độc lập |

## 2. Kịch bản (T4.2): bài toán thật của FR3/FR4

| ID | Mục tiêu | SQL Server | Cassandra | Kỳ vọng |
|---|---|---|---|---|
| S1 | **Atomicity**: khám bệnh = 5 thao tác | 1 transaction: insert visit → prescription → items → trừ kho → invoice; lỗi ở bước 4 (hết thuốc, vi phạm `CK_medicines_stock`) | Mô phỏng cùng nghiệp vụ bằng nhiều bảng, ghi tuần tự, lỗi giữa chừng | SQL Server: không còn dấu vết nào. Cassandra: dữ liệu dở dang |
| S2 | `XACT_ABORT` & `TRY…CATCH` | Cùng lỗi, so sánh `XACT_ABORT OFF` (câu lỗi bị bỏ, phần còn lại vẫn commit!) vs `ON` | — | Thấy được bẫy khi không bật XACT_ABORT |
| S3 | Savepoint | Kê đơn 3 thuốc, thuốc thứ 3 hết hàng → `ROLLBACK TRAN sp` chỉ bỏ thuốc đó | — | Đơn còn 2 thuốc |
| S4 | Logged vs unlogged batch | — | Ghi Q1 + Q2 + Q3 (sinh hiệu) bằng logged batch, kill node giữa chừng → batchlog replay | Logged: cuối cùng đủ cả 3 bảng |
| S5 | Batch **không** có isolation | — | Đọc giữa lúc batch đang áp dụng ở nhiều partition | Có thể thấy trạng thái một nửa |
| S6 | LWT = "transaction nhỏ" | — | `INSERT … IF NOT EXISTS`, `UPDATE … IF stock >= 10` | Đúng nhưng latency cao hơn ~4 lần (4 round-trip Paxos) |
| S7 | Durability | Commit rồi `docker kill hc-mssql` → khởi động lại → dữ liệu còn; xem log bằng `fn_dblog` | Write với CL=ONE, kill trước khi flush → commit log replay | Dữ liệu đã commit không mất |
| S8 | Chi phí transaction | 10k insert: autocommit vs 1 transaction lớn vs batch 1000 | 10k insert: đơn lẻ vs unlogged batch theo partition vs LWT | Throughput |

## 3. Kết quả (T4.3, T4.4)

## 4. So sánh & kết luận cho Healthcare (T4.5)

Gợi ý hướng kết luận: dữ liệu khám, đơn thuốc, hoá đơn, tồn kho **bắt buộc** ACID nhiều bảng nên chọn SQL Server. Sinh hiệu chỉ cần atomic trong 1 partition nên Cassandra đủ.
