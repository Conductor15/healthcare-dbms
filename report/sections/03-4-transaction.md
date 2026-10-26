# 3.4 Transaction

> Bản nháp (Hoàng, T4.6). Số liệu, script và output đầy đủ: `demos/04-transaction/`.

## 3.4.1 Cơ sở lý thuyết

Một transaction là một đơn vị công việc thoả **ACID**: *Atomicity* (tất cả hoặc không gì cả), *Consistency* (đưa CSDL từ trạng thái hợp lệ sang trạng thái hợp lệ), *Isolation* (các transaction đồng thời không thấy trạng thái dở dang của nhau), *Durability* (đã commit thì không mất kể cả khi sập máy).

**SQL Server** hỗ trợ transaction đầy đủ trên nhiều câu lệnh và nhiều bảng (`BEGIN TRAN … COMMIT/ROLLBACK`, savepoint `SAVE TRAN`, `TRY…CATCH`). Durability dựa trên *write-ahead logging*: bản ghi log (ảnh trước/sau của dữ liệu) được ghi xuống file `.ldf` trước khi `COMMIT` trả về; trang dữ liệu được ghi sau, ở checkpoint. Ba chế độ: autocommit (mặc định), implicit, explicit.

**Cassandra** không có transaction nhiều partition. Mỗi lần ghi trong *một* partition là atomic và isolated. `BATCH` dạng *logged* đảm bảo mọi câu trong batch *cuối cùng* đều được áp dụng (ghi vào batchlog trước), nhưng **không có isolation** và không có `ROLLBACK`. *Lightweight transaction* (LWT: `IF NOT EXISTS`, `IF <điều kiện>`) dùng giao thức Paxos để compare-and-set tuyến tính hoá trên **một** partition. Cột thường không hỗ trợ phép toán đọc-sửa-ghi như `stock = stock - 10`.

## 3.4.2 Thiết lập thí nghiệm

Nghiệp vụ dùng xuyên suốt là **"khám bệnh"**: một lượt khám ghi 5 bảng (`visits`, `prescriptions`, `prescription_items`, trừ `medicines.stock_quantity`, `invoices`). Ràng buộc `CK_medicines_stock CHECK (stock_quantity >= 0)` biến việc kê vượt tồn kho thành lỗi thật. Trên Cassandra, cùng nghiệp vụ được mô hình bằng các bảng phi chuẩn hoá trong keyspace `tx_demo`.

## 3.4.3 Kết quả

| # | Kịch bản | SQL Server | Cassandra |
|---|---|---|---|
| 1 | Lỗi ở bước 4/5 của quy trình khám | `XACT_STATE() = -1` → ROLLBACK; số dòng 4 bảng và tồn kho **trước = sau** | Câu 1 đã ghi vĩnh viễn, ứng dụng dừng → **lượt khám mồ côi** không có hoá đơn; `ROLLBACK` → `SyntaxException` |
| 2 | `XACT_ABORT OFF` (mặc định) | Lỗi chỉ huỷ **một câu**, transaction vẫn mở, `COMMIT` lưu **nửa transaction** (Paracetamol bị trừ, Salbutamol không). `ON` → rollback toàn bộ | — |
| 3 | Savepoint | Thuốc thứ 3 hết hàng → `ROLLBACK TRAN sp` chỉ bỏ thuốc 3, giữ thuốc 1–2. Chỉ dùng được khi `XACT_ABORT OFF` | — |
| 4 | Batch nhiều bảng | — | Áp dụng đủ 3 bảng; batch có 1 câu sai kiểu bị từ chối toàn bộ; batch có điều kiện **không được** trải nhiều bảng |
| 5 | LWT | — | `IF NOT EXISTS` lần 2: `[applied]=False`; `IF stock = 100` client thứ 2 thua |
| 6 | Log của 1 transaction (`fn_dblog`) | `LOP_BEGIN_XACT → LOP_MODIFY_COLUMNS ×2 → LOP_COMMIT_XACT` | — |
| 7 | Crash (kill -9) | Xem 3.6: dữ liệu đã commit được REDO, chưa commit bị UNDO | Commit log replay |

**Torn read**: 1 writer cập nhật 2 dòng *trong cùng một* transaction/batch, 4 reader đọc liên tục trong 4 giây và đếm số lần thấy 2 dòng lệch phiên bản:

| DBMS | Cách ghi / mức đọc | Lượt đọc | Torn read |
|---|---|---|---|
| SQL Server | READ UNCOMMITTED | 10 166 | 0.51% |
| SQL Server | READ COMMITTED (mặc định) | 3 360 | **0.15%** |
| SQL Server | REPEATABLE READ | 3 365 | 0 |
| SQL Server | SNAPSHOT | 11 165 | 0 |
| Cassandra | LOGGED batch | 13 351 | **5.22%** |
| Cassandra | UNLOGGED batch | 18 526 | 9.75% |

**Chi phí** ghi 2000 dòng:

| DBMS | Cách ghi | Dòng/s |
|---|---|---|
| SQL Server | Autocommit, 1 client (2000 lần flush log) | 152 |
| SQL Server | 1 transaction cho 2000 dòng | 1 169 (×7.7) |
| SQL Server | Autocommit, 16 client | 1 194 |
| Cassandra | INSERT đơn, 1 client / 16 client | 1 095 / 15 488 |
| Cassandra | UNLOGGED batch 50 dòng cùng partition | 30 200 |
| Cassandra | LWT `IF NOT EXISTS` | 581 (chậm ×1.9) |

## 3.4.4 Thảo luận

- Batch của Cassandra là **atomic nhưng không isolated**: 5% số lần đọc thấy trạng thái nửa vời.
- READ COMMITTED của SQL Server cũng không đảm bảo đọc nhất quán *nhiều dòng*, vì khoá S nhả sau từng dòng. Muốn nhất quán thì cần REPEATABLE READ (giữ khoá) hoặc SNAPSHOT (đọc phiên bản). SNAPSHOT vừa đúng vừa không chặn writer, nên đọc được nhiều gấp 3.3 lần.
- Chi phí chính của transaction SQL Server là flush log lúc commit; gom thao tác vào một transaction tăng tốc 7.7 lần.
- Cassandra ghi rất nhanh vì không có transaction. Khi cần đúng đắn (LWT) thì phải trả giá bằng các vòng Paxos.

## 3.4.5 Kết luận cho bối cảnh phòng khám

Khám bệnh, kê đơn, trừ kho, lập hoá đơn, đặt lịch là các nghiệp vụ **bắt buộc atomic trên nhiều bảng**, nên dùng SQL Server. Ứng dụng chạy chúng trong `withTransaction()` (luôn rollback khi có lỗi, tránh bẫy XACT_ABORT ở kịch bản 2). Dữ liệu sinh hiệu chỉ cần atomic trong một lần đo, và ứng dụng dùng *logged batch* để ghi 3 bảng phi chuẩn hoá của một lần đo trên Cassandra.
