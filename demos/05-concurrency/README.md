# Topic v: Concurrency control

**Owner:** Hoàng · **Step:** T5 · **Status:** 🟨 (T5.1–T5.5 xong, chờ review)

Môi trường: SQL Server 2022, Cassandra 5.0.9 (1 node; S7 dùng cluster 3 node `npm run db:up:cluster`), Docker Desktop / Windows 11.
Các thí nghiệm S1–S3, S5 dùng **chung code** với trang DB Lab của ứng dụng: [`server/src/modules/lab/concurrency.lab.js`](../../server/src/modules/lab/concurrency.lab.js).

## 1. Lý thuyết (T5.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Cơ chế chính | **Pessimistic locking** (S, U, X + intent IS/IX/SIX; mức KEY/PAGE/OBJECT; lock escalation) và tuỳ chọn **MVCC** (SNAPSHOT, RCSI dùng version store trong tempdb) | Không khoá. Mỗi cell mang **write timestamp**, **last-write-wins** |
| Isolation | READ UNCOMMITTED, READ COMMITTED (mặc định), REPEATABLE READ, SERIALIZABLE, SNAPSHOT | Isolation trong 1 partition; LWT (Paxos) cho compare-and-set tuyến tính hoá |
| Xử lý xung đột | Blocking; deadlock monitor chọn victim (lỗi 1205); SNAPSHOT phát hiện update conflict (3960) | Ghi đè theo timestamp, không báo lỗi; LWT trả `[applied] = false` |
| Nhất quán giữa bản sao | Một bản (strong) | **Tunable**: `ONE / QUORUM / ALL`; strong khi R + W > RF |

## 2. Kịch bản & kết quả (T5.2–T5.4)

| ID | Mục tiêu | Script | Kết quả |
|---|---|---|---|
| S1–S2 | 5 hiện tượng × 5 mức isolation | [isolation_matrix.js](isolation_matrix.js) | Bảng S2, khớp hoàn toàn lý thuyết |
| S3 | **Double-booking** (FR3): 50 bệnh nhân đặt 1 slot cùng lúc | [double_booking.js](double_booking.js) | Bảng S3 |
| S4 | Lock hierarchy & escalation | [mssql/01_locks_escalation.sql](mssql/01_locks_escalation.sql) | 100 dòng → 100 `KEY X` + `PAGE IX` + `OBJECT IX`. 10 000 dòng → **leo thang thành `OBJECT X`** (hiện 16 vì máy có ≥16 CPU, lock được chia partition). Tắt escalation → 10 000 `KEY X` |
| S5 | Deadlock | [deadlock.js](deadlock.js) | T1 giữ `KEY X` dòng 1, chờ (`WAIT`) dòng 2; T2 ngược lại. SQL Server phát hiện sau **~1.2 s**, chọn T2 làm victim (1205), T2 thử lại → tồn kho cuối đúng (100→98, 50→48) |
| S6 | Last-write-wins | [cassandra/01_last_write_wins.cql](cassandra/01_last_write_wins.cql) | Bản đo lúc t=5 thắng bản t=3 dù đến trước; **bản retry cũ (t=1) đến sau bị bỏ qua, không báo lỗi**; giải quyết theo từng *cell* (2 client sửa 2 cột khác nhau đều giữ được); hoà timestamp → giá trị lớn hơn thắng |
| S7 | Tunable consistency (3 node, RF=3) | [cluster_consistency.js](cluster_consistency.js) | Bảng S7 |

### S2: Ma trận hiện tượng × mức isolation (SQL Server)

✗ = hiện tượng **xảy ra**, ✓ = bị ngăn (kèm cơ chế ngăn).

| Hiện tượng | READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ | SERIALIZABLE | SNAPSHOT |
|---|---|---|---|---|---|
| Dirty read | ✗ đọc 999 chưa commit | ✓ bị chặn (khoá) | ✓ bị chặn | ✓ bị chặn | ✓ đọc bản đã commit (version) |
| Non-repeatable read | ✗ 100 → 101 | ✗ 100 → 101 | ✓ writer bị chặn | ✓ writer bị chặn | ✓ writer commit, reader vẫn thấy 100 |
| Phantom read | ✗ COUNT 2 → 3 | ✗ | ✗ | ✓ INSERT bị chặn (range lock) | ✓ reader không thấy dòng mới |
| Lost update (đọc rồi ghi) | ✗ tồn kho 90 (đúng 80) | ✗ | ✓ bên sau bị chặn → thử lại | ✓ | ✓ update conflict 3960 → thử lại |
| Lost update (`qty = qty - 10`) | ✓ 80 | ✓ 80 | ✓ | ✓ | ✓ |

Ba cơ chế điều khiển đồng thời hiện ra rõ ràng: **khoá** (bị chặn, lỗi 1222), **đa phiên bản** (SNAPSHOT đọc bản cũ, không chặn ai), **phát hiện xung đột** (3960). Dòng cuối cho thấy cách sửa lost update rẻ nhất là viết phép trừ *atomic* trong 1 câu UPDATE, cách app dùng khi trừ tồn kho (`visits.repository.js → dispense`).

### S3: 50 request đồng thời đặt CÙNG 1 khung giờ

| Cách làm | Báo "đặt thành công" | Bản ghi thực sự lưu | Lỗi |
|---|---|---|---|
| SQL Server: đọc `is_booked` rồi ghi, không khoá | **50** | **50 lịch hẹn cho 1 slot** | — |
| SQL Server: transaction + `WITH (UPDLOCK, HOLDLOCK)` | 1 | 1 | — (49 bên còn lại chờ khoá rồi thấy đã đặt) |
| SQL Server: chỉ dựa vào UNIQUE index | 1 | 1 | 49 × vi phạm UNIQUE (2627) |
| Cassandra: SELECT rồi INSERT | **50** | 1 (**âm thầm ghi đè**, người giữ slot là người ghi sau cùng) | — |
| Cassandra: `INSERT … IF NOT EXISTS` (LWT) | 1 | 1 | — (`[applied] = false`) |

Ứng dụng (FR3, `appointments.service.js → book`) dùng `UPDLOCK, HOLDLOCK` **và** filtered UNIQUE index làm lớp chặn cuối. Test E2E bắn 20 request cùng lúc qua API thật: đúng 1 thành công, 19 nhận 409.

### S7: Tunable consistency: hồ sơ dị ứng khi 1 node chết (RF = 3, tắt hinted handoff)

| Bước | Node điều phối | CL | Kết quả |
|---|---|---|---|
| 1. Ghi `none` khi 3 node sống | node 1 | ALL | OK |
| 2. Node 3 chết, ghi `penicillin` | node 1 | ALL | **Unavailable**: cần 3 replica, còn 2 |
| 3. Ghi `penicillin` | node 1 | QUORUM | OK (2/3) |
| 4. Node 3 sống lại (thiếu bản ghi), đọc ×5 | node 3 | ONE | `penicillin, penicillin, none, none, none`: **3/5 lần bỏ sót dị ứng** |
| 5. Đọc | node 3 | QUORUM | `penicillin` (R + W = 2 + 2 > 3) |
| 6. Đọc lại ×5 | node 3 | ONE | `penicillin` ×5: read repair ở bước 5 đã sửa node 3 |

## 3. So sánh & kết luận cho Healthcare (T5.5)

| Tiêu chí | SQL Server | Cassandra |
|---|---|---|
| Ngăn đặt trùng lịch / bán trùng thuốc | ✅ khoá + transaction + UNIQUE, nhiều lựa chọn | ⚠️ chỉ LWT trên 1 partition; cách thường **ghi đè âm thầm** |
| Đọc nhất quán | ✅ chọn được mức isolation; SNAPSHOT không chặn | ⚠️ phụ thuộc CL; `ONE` có thể trả dữ liệu cũ (S7) |
| Hiệu năng khi tranh chấp | Blocking, deadlock cần retry | ✅ không khoá, ghi song song cực nhanh |
| Khả dụng khi mất node | Một máy chủ (HA cần Always On) | ✅ vẫn phục vụ với QUORUM khi mất 1/3 node |

**Kết luận:**
- Các nghiệp vụ có tài nguyên giới hạn bị tranh giành (khung giờ khám, tồn kho thuốc, hoá đơn) cần điều khiển đồng thời chặt, và **SQL Server** làm tốt việc này: lịch hẹn dùng `UPDLOCK` cùng UNIQUE index, tồn kho dùng UPDATE atomic.
- Với dữ liệu sinh hiệu, mỗi bản ghi chỉ có một người ghi là thiết bị, nên last-write-wins là chấp nhận được. Ứng dụng còn ghi `USING TIMESTAMP` bằng thời điểm đo để gói tin đến muộn không đè số mới.
- Nếu dùng Cassandra cho dữ liệu lâm sàng quan trọng như dị ứng, phải đọc/ghi bằng **QUORUM**: S7 cho thấy CL `ONE` bỏ sót dị ứng 3/5 lần.

## 4. Tham khảo

1. Microsoft Learn, "Transaction locking and row versioning guide"; "SET TRANSACTION ISOLATION LEVEL"; "Deadlocks guide".
2. Apache Cassandra Documentation 5.0, "Dynamo: tunable consistency", "Lightweight transactions", "Hints", "Read repair".
3. H. Berenson et al., "A Critique of ANSI SQL Isolation Levels", SIGMOD 1995.
