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

## Dương

| Ngày | Step | Việc đã làm | Input | Output | Thời gian | Status | Ghi chú / Blocker |
|---|---|---|---|---|---|---|---|
