# Topic iv: Transaction

**Owner:** Hoàng · **Step:** T4 · **Status:** 🟨 (T4.1–T4.5 xong, chờ review) · **Topic chính (bắt buộc)**

Môi trường: SQL Server 2022 (Developer, container), Cassandra 5.0.9 (1 node, container), Docker Desktop trên Windows 11, dữ liệu seed của `npm run db:init`.

## 1. Lý thuyết (T4.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Phạm vi ACID | Đầy đủ, nhiều câu lệnh, nhiều bảng | Ghi **trong 1 partition** là atomic + isolated; không có transaction nhiều partition/bảng |
| Cú pháp | `BEGIN TRAN / COMMIT / ROLLBACK`, `SAVE TRAN`, `TRY…CATCH`, `XACT_ABORT` | Không có `ROLLBACK`. `BEGIN BATCH … APPLY BATCH` (logged: atomic, **không** isolation); LWT `IF [NOT] EXISTS / IF <cond>` (Paxos, 1 partition) |
| Durability | Write-ahead log (`.ldf`): log record ghi đĩa trước khi COMMIT trả về; data page ghi sau ở checkpoint | Commit log (mặc định `periodic` 10s) + memtable + replication |
| Chế độ | Autocommit (mặc định), implicit, explicit | Mỗi câu lệnh độc lập |
| Phép toán đọc-sửa-ghi | `SET stock = stock - 10` atomic trong 1 câu | Cột thường **không** cho `stock = stock - 10` → phải đọc rồi ghi (race) hoặc dùng LWT / counter |

## 2. Kịch bản & kết quả (T4.2–T4.4)

Chạy lại: `node demos/run.js <file> --save` (script .sql/.cql) hoặc `node <file>.js` (benchmark). Output đầy đủ trong [`results/`](results/).

| ID | Mục tiêu | Script | Kết quả thực tế |
|---|---|---|---|
| S1 | **Atomicity**: khám bệnh = 5 thao tác, lỗi ở bước 4 | [mssql/01_atomicity.sql](mssql/01_atomicity.sql) | Lỗi 547 (CHECK tồn kho) → `XACT_STATE() = -1` → ROLLBACK. Bảng trước/sau **giống hệt nhau** (0 visit, tồn kho Paracetamol vẫn 5000). IDENTITY bị "tiêu" 1 số (không rollback) |
| S1' | Cùng nghiệp vụ trên Cassandra | [cassandra/01_no_rollback.cql](cassandra/01_no_rollback.cql) | Câu 1 đã ghi, ứng dụng dừng → còn **visit mồ côi không có hoá đơn**; `ROLLBACK` → `SyntaxException` |
| S2 | Bẫy `XACT_ABORT OFF` | [mssql/02_xact_abort.sql](mssql/02_xact_abort.sql) | OFF: sau lỗi `@@TRANCOUNT = 1`, COMMIT lưu **nửa transaction** (Paracetamol 5000→4990, Salbutamol không đổi). ON: tự rollback cả transaction, `@@TRANCOUNT = 0` |
| S3 | Savepoint | [mssql/03_savepoint.sql](mssql/03_savepoint.sql) | Thuốc 3 lỗi, `XACT_STATE() = 1` → `ROLLBACK TRAN before_item3` → đơn còn 2 thuốc. Savepoint **chỉ dùng được khi XACT_ABORT OFF** |
| S4 | Logged batch | [cassandra/02_batch.cql](cassandra/02_batch.cql) | Batch 3 bảng được áp dụng đủ. Batch chứa 1 câu sai kiểu → **cả batch bị từ chối**. `stock = stock - 10` → lỗi "non counter column". Batch có điều kiện **không được trải nhiều bảng** |
| S5 | Batch có **isolation** không? | [bench_isolation.js](bench_isolation.js) | Xem bảng S5 bên dưới |
| S6 | LWT | [cassandra/03_lwt.cql](cassandra/03_lwt.cql) | `IF NOT EXISTS` lần 2 → `[applied] False` + trả bản ghi hiện tại; `IF stock = 100` client thứ 2 thua, thấy `stock = 90`; `IF stock >= 1000` → False |
| S7 | Durability (cơ chế) | [mssql/04_log_records.sql](mssql/04_log_records.sql) | `fn_dblog`: `LOP_BEGIN_XACT → LOP_MODIFY_COLUMNS ×2 → LOP_COMMIT_XACT`. Thử crash thật: [06-backup-recovery/crash_recovery.js](../06-backup-recovery/crash_recovery.js) |
| S8 | Chi phí transaction | [bench_cost.js](bench_cost.js) | Xem bảng S8 bên dưới |
| S9 | Chế độ transaction | [mssql/05_modes.sql](mssql/05_modes.sql) | Autocommit `@@TRANCOUNT=0`; implicit tự mở transaction (giữ khoá!); `COMMIT` lồng chỉ giảm bộ đếm, `ROLLBACK` ngoài huỷ tất cả |

### S5: "Torn read": reader thấy ghi 2 dòng mới được một nửa (4 giây, 1 writer + 4 reader)

| DBMS | Cách ghi / mức đọc | Lượt ghi | Lượt đọc | Torn read |
|---|---|---|---|---|
| SQL Server | Transaction, đọc READ UNCOMMITTED | 526 | 10 166 | 52 (0.51%) |
| SQL Server | Transaction, đọc **READ COMMITTED** (mặc định) | 572 | 3 360 | **5 (0.15%)** |
| SQL Server | Transaction, đọc REPEATABLE READ | 581 | 3 365 | 0 |
| SQL Server | Transaction, đọc SNAPSHOT | 656 | 11 165 | 0 |
| Cassandra | LOGGED batch, đọc CL ONE | 2 607 | 13 351 | **697 (5.22%)** |
| Cassandra | UNLOGGED batch, đọc CL ONE | 4 876 | 18 526 | 1 807 (9.75%) |

Nhận xét:
- Batch Cassandra **atomic nhưng không isolated**: 5% lượt đọc thấy một dòng mới, một dòng cũ.
- Bất ngờ: READ COMMITTED của SQL Server cũng có torn read. Lý do: READ COMMITTED chỉ đảm bảo không đọc dữ liệu *chưa commit*, khoá S nhả ngay sau mỗi dòng, nên một câu SELECT có thể đọc dòng 1 trước transaction và dòng 2 sau transaction. Muốn đọc nhất quán nhiều dòng thì cần REPEATABLE READ (giữ khoá) hoặc SNAPSHOT (đọc phiên bản). SNAPSHOT vừa đúng vừa không chặn writer (11k lượt đọc so với 3k).

### S8: Chi phí ghi 2000 dòng

| DBMS | Kiểu | Thời gian (s) | Dòng/s |
|---|---|---|---|
| SQL Server | Autocommit, 1 client (mỗi dòng 1 commit = 1 lần flush log) | 13.12 | 152 |
| SQL Server | Autocommit, 16 client song song | 1.68 | 1 194 |
| SQL Server | **1 transaction** cho 2000 dòng, 1 client | 1.71 | 1 169 (**×7.7**) |
| Cassandra | INSERT đơn, 1 client | 1.83 | 1 095 |
| Cassandra | INSERT đơn, 16 client | 0.13 | 15 488 |
| Cassandra | UNLOGGED batch 50 dòng / 1 partition | 0.07 | 30 200 |
| Cassandra | LOGGED batch 2 partition | 1.10 | 1 812 |
| Cassandra | LWT `IF NOT EXISTS`, 1 client | 3.44 | 581 (chậm ×1.9 so với INSERT đơn) |

Nhận xét: chi phí lớn nhất của transaction SQL Server là **flush log khi commit**, nên gom nhiều thao tác vào một transaction nhanh hơn 7.7 lần. Cassandra ghi nhanh vì không có transaction; muốn đảm bảo đúng (LWT) thì phải trả giá bằng Paxos (×1.9 trên 1 node, nhiều hơn trên cluster vì thêm round-trip mạng).

> Số đo trên Docker Desktop/Windows, chỉ để so sánh tương đối giữa các cách làm, không phải hiệu năng tuyệt đối.

## 3. So sánh & kết luận cho Healthcare (T4.5)

| Tiêu chí | SQL Server | Cassandra |
|---|---|---|
| Atomic nhiều bảng | ✅ đầy đủ, có ROLLBACK, savepoint | ⚠️ chỉ logged batch (không điều kiện nghiệp vụ, không rollback) |
| Isolation | ✅ 4 mức + SNAPSHOT | ❌ chỉ trong 1 partition (S5: 5% torn read) |
| Ràng buộc nghiệp vụ (tồn kho ≥ 0) | ✅ CHECK + transaction | ⚠️ LWT trên 1 partition, chậm hơn |
| Thông lượng ghi | Trung bình, phụ thuộc số lần commit | ✅ rất cao (15k dòng/s chỉ với 16 client, 1 node) |

**Kết luận:** nghiệp vụ *khám bệnh – kê đơn – trừ kho – lập hoá đơn – đặt lịch* đòi hỏi nhiều bảng thay đổi cùng nhau hoặc không thay đổi gì. Thiếu atomicity sẽ có hoá đơn sai, tồn kho âm, lịch hẹn treo, nên **SQL Server** là lựa chọn bắt buộc cho phần này (ứng dụng: `POST /api/visits`, `POST /api/appointments` chạy trong `withTransaction`). **Cassandra** phù hợp cho dữ liệu sinh hiệu: mỗi bản ghi độc lập, chỉ cần ghi nhanh. Ứng dụng dùng *logged batch* để ghi 3 bảng phi chuẩn hoá của một lần đo, chấp nhận không có isolation.

## 4. Tham khảo

1. Microsoft Learn, "Transactions (Transact-SQL)", "SET XACT_ABORT", "SAVE TRANSACTION", "Transaction log architecture and management guide".
2. Apache Cassandra Documentation 5.0, "BATCH", "Lightweight transactions", "Storage engine: commit log".
3. A. Silberschatz, H. Korth, S. Sudarshan, *Database System Concepts*, 7th ed., ch. 17 (Transactions).
