# Track log

Nhật ký công việc, **chỉ thêm, không sửa/xoá dòng cũ**. Đây là bằng chứng đóng góp cho mục *Teamwork* của report.

**Quy tắc:**
1. Mỗi khi xong một step (hoặc một phần đáng kể / bị chặn), thêm **1 dòng ở cuối bảng của chính mình**, trong cùng PR với kết quả.
2. Mỗi người ghi vào **bảng riêng** → hai PR song song không bao giờ conflict ở file này.
3. Cột *Output* phải trỏ tới thứ kiểm chứng được: đường dẫn file, số PR (`#12`), ảnh trong `results/`.
4. Status dùng cùng ký hiệu với [PLAN.md](PLAN.md): ⬜ 🟦 🟨 🟩 🟥.

Mẫu một dòng:

```
| 2026-10-30 | T4.3 | Demo ROLLBACK khi tạo hoá đơn lỗi | schema S1.2, data S1.4 | demos/04-transaction/mssql/01_atomicity.sql, results/t4-s1.png, #15 | 2.5h | 🟨 | — |
```

---

## Hoàng

| Ngày | Step | Việc đã làm | Input | Output | Thời gian | Status | Ghi chú / Blocker |
|---|---|---|---|---|---|---|---|
| 2026-10-26 | S0.1 | Khởi tạo repo, cấu trúc thư mục, README | Đề bài, phiếu chọn phương án | `README.md`, cây thư mục | 0.5h | 🟨 | Chờ tạo repo GitHub + mời Dương |
| 2026-10-26 | S0.2 | Docker Compose: SQL Server 2022 + Cassandra 5.0 (+ profile cluster 3 node) | — | `docker-compose.yml`, `.env.example` | 0.5h | 🟨 | Cần chạy thử trên máy Dương |
| 2026-10-26 | S0.3 | Quy trình Git: branch/commit/PR, template, CODEOWNERS | — | `CONTRIBUTING.md`, `.github/` | 0.5h | 🟨 | Bật branch protection sau khi push |
| 2026-10-26 | S1.1 | Bản nháp 9 FR + ma trận 8 query type | Phiếu chọn phương án | `docs/design/requirements.md` | 0.5h | 🟨 | Chốt ở kickoff |
| 2026-10-26 | S1.2 | ERD + schema SQL Server + seed | S1.1 | `docs/design/erd.md`, `database/mssql/*.sql` | 1h | 🟨 | Dương review |
| 2026-10-26 | S1.3 | Bản nháp schema Cassandra (giao Dương hoàn thiện) | S1.1 | `database/cassandra/01_schema.cql` | 0.5h | 🟦 | Dương làm tiếp |
| 2026-10-26 | S1.5 | API contract | S1.1 | `docs/design/api.md` | 0.5h | 🟨 | — |
| 2026-10-26 | S0.4 | Skeleton Express + React, auth JWT, module mẫu Khoa phòng, access log → Cassandra | S1.2, S1.5 | `server/`, `client/` | 2h | 🟨 | — |
| 2026-10-26 | S5.1 | Khung report 6 section + References | Rubric | `report/README.md` | 0.25h | 🟨 | — |
| 2026-10-26 | S0.2 | Sửa lỗi `db:init` timeout do Cassandra chưa khởi động xong: `db:up` dùng `--wait`, `db:init` tự retry kết nối Cassandra (≤3 phút) | Log lỗi `OperationTimedOutError` | `package.json`, `server/scripts/db-init.js` | 0.25h | 🟨 | Đã chạy E2E trên máy Hoàng: health 2 DB OK, CRUD khoa, 409 khi xoá khoa có bác sĩ, 403 với lễ tân, log ghi vào Cassandra |
| 2026-10-26 | S1.6 | Bench harness dùng chung: đo latency (min/avg/p50/p95, logical reads), throughput song song (gom lỗi theo mã), chạy file .sql, xuất CSV | — | `demos/_common/bench.js`, `example.js`, `README.md` | 1h | 🟨 | Đã chạy thử trên 2 DB; 30 insert trùng song song → 1 OK / 29 lỗi 2627 |
| 2026-10-26 | T4.1–T4.5 | Topic Transaction: lý thuyết, 9 kịch bản trên 2 DBMS (atomicity, XACT_ABORT, savepoint, WAL, modes / no-rollback, batch, LWT), đo torn read + chi phí transaction, so sánh & kết luận | Schema S1.2, bench S1.6 | `demos/04-transaction/` (5 .sql, 3 .cql, 2 benchmark, `results/`), `demos/run.js` | 3h | 🟨 | Phát hiện: READ COMMITTED vẫn có 0.15% torn read; batch Cassandra 5.2% |
| 2026-10-26 | T5.1–T5.5 | Topic Concurrency: ma trận 5 hiện tượng × 5 mức isolation, double-booking 50 request (5 cách), lock escalation, deadlock, last-write-wins, tunable consistency trên cluster 3 node | Schema S1.2, bench S1.6 | `demos/05-concurrency/`, `server/src/modules/lab/{lab.db,concurrency.lab}.js`, `demos/_common/{env,cluster}.js` | 3h | 🟨 | Ma trận khớp lý thuyết 25/25 ô; CL ONE bỏ sót dị ứng 3/5 lần. Lỗi dỡ cluster lần đầu (decommission bị từ chối, script vẫn xoá node) → đã sửa `--force` + dừng nếu lỗi, kiểm chứng lại 50/50 dòng |
| 2026-10-26 | T6.1–T6.5 | Topic Backup & recovery: recovery model, chuỗi full/diff/log + CHECKSUM, point-in-time restore song song, crash recovery kill -9 (redo/undo, commit log replay), snapshot + incremental, replication ≠ backup, Agent jobs | Schema S1.2 | `demos/06-backup-recovery/`, `docker-compose.yml` | 3h | 🟨 | Sự cố: volume backup thuộc root → BACKUP lỗi nhưng script vẫn chạy bước "sự cố" (giá thuốc về 0, đã khôi phục từ seed). Sửa: bỏ volume riêng, tách batch + `:on error exit` + chốt chặn kiểm tra full backup |
| 2026-10-26 | S3.3, S3.4, S3.6, S3.9, S3.11, S3.12 (API) | Backend: lịch hẹn (transaction + UPDLOCK), khám + kê đơn + hoá đơn (1 transaction, trừ kho atomic), chi tiết lượt khám (join 10 bảng), sinh hiệu Cassandra (logged batch, SSE, giả lập thiết bị), nhật ký truy cập, DB Lab iv–vi; 14 test E2E | S1.5, T4–T6 | `server/src/modules/{appointments,visits,medicines,lookups,vitals,access-logs,lab}/`, `server/test/hoang-features.e2e.test.js`, `docs/design/api.md` | 4h | 🟦 | 14/14 test pass (gồm 20 request đặt cùng slot → 1 thành công). PITR trong app có lưới an toàn khôi phục giá nếu lỗi giữa chừng (đã kiểm chứng khi STOPAT lỗi) |

## Dương

| Ngày | Step | Việc đã làm | Input | Output | Thời gian | Status | Ghi chú / Blocker |
|---|---|---|---|---|---|---|---|
