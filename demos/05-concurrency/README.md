# Topic v: Concurrency control

**Owner:** Hoàng · **Step:** T5 · **Status:** ⬜

## 1. Lý thuyết (T5.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Cơ chế chính | **Pessimistic locking** (S, X, U, IS, IX, SIX; row/page/table; lock escalation) + **MVCC** tuỳ chọn (SNAPSHOT, RCSI dùng version store trong tempdb) | Không khoá; mỗi cell có **timestamp**, **last-write-wins** |
| Isolation | READ UNCOMMITTED, READ COMMITTED (mặc định), REPEATABLE READ, SERIALIZABLE, SNAPSHOT, RCSI | Isolation trong 1 partition; LWT (Paxos) cho linearizable compare-and-set |
| Xử lý xung đột | Blocking, deadlock detection → chọn victim (lỗi 1205) | Ghi đè theo timestamp; LWT trả `[applied] = false` |
| Nhất quán | Strong | **Tunable**: `ONE / QUORUM / ALL`; strong khi R + W > RF |

## 2. Kịch bản (T5.2)

| ID | Mục tiêu | SQL Server | Cassandra | Kỳ vọng |
|---|---|---|---|---|
| S1 | **Lost update** tồn kho thuốc | 2 phiên đọc `stock=100` rồi cùng ghi `stock=100-10` → mất 10. Sửa bằng: `UPDATE … SET stock = stock - 10` / `UPDLOCK` / optimistic `row_version` | 2 client read-modify-write → mất; sửa bằng LWT `UPDATE … IF stock_quantity = 100` | Thấy lỗi, rồi thấy cách sửa |
| S2 | 4 hiện tượng × isolation level | Ma trận: dirty read, non-repeatable read, phantom, lost update × 6 mức (2 cửa sổ SSMS chạy song song) | — | Bảng ✓/✗ khớp lý thuyết |
| S3 | **Double-booking** (FR3) | 50 request đồng thời đặt cùng 1 slot: (a) check-then-insert ngây thơ, (b) `WITH (UPDLOCK, HOLDLOCK)`, (c) chỉ dựa vào unique filtered index | (a) `INSERT` thường, (b) `INSERT … IF NOT EXISTS` | Số lịch hẹn thành công: a > 1, các cách còn lại = 1 |
| S4 | Locks & blocking | Quan sát `sys.dm_tran_locks`, `sys.dm_os_waiting_tasks`; lock escalation khi update 10k dòng | — | Ảnh chụp lock |
| S5 | Deadlock | 2 transaction cập nhật `medicines` và `invoices` theo thứ tự ngược nhau → deadlock graph (Extended Events `system_health`) → retry | — | 1 bên là victim (1205), app tự retry |
| S6 | Last-write-wins | — | 2 client cập nhật cùng `latest_vitals_by_patient` với timestamp khác nhau (`USING TIMESTAMP`) | Bản có timestamp lớn hơn thắng, kể cả khi đến sau |
| S7 | Tunable consistency | — | Cluster 3 node (`npm run db:up:cluster`), keyspace RF=3: ghi CL=ONE, tắt node, đọc CL=ONE → dữ liệu cũ; QUORUM/QUORUM → luôn mới | Minh hoạ R + W > N |
| S8 | Hiệu năng dưới tải | Throughput đặt lịch ở READ COMMITTED vs SERIALIZABLE vs SNAPSHOT | Throughput write thường vs LWT | Bảng số đo |

S3 sẽ được đưa vào app ở DB Lab (S3.11): `POST /api/lab/double-booking`.

## 3. Kết quả (T5.3, T5.4)

## 4. So sánh & kết luận cho Healthcare (T5.5)
