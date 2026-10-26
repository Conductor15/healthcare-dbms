# Healthcare DBMS: SQL Server vs Cassandra

DBMS Assignment, HK261. Ứng dụng quản lý phòng khám đa khoa trên **SQL Server 2022** (hồ sơ, lịch hẹn, đơn thuốc, hoá đơn) và **Apache Cassandra 5.0** (sinh hiệu real-time, nhật ký truy cập), kèm demo so sánh 6 chủ đề DBMS.

| Tài liệu | |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Kế hoạch, phân công, timeline, input/output từng step |
| [docs/TRACKLOG.md](docs/TRACKLOG.md) | Nhật ký công việc |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Quy trình Git/PR, quy ước code |
| [docs/design/](docs/design/) | Yêu cầu, ERD, API contract |
| [demos/](demos/) | Demo 6 topic trên 2 DBMS |
| [docs/meetings/](docs/meetings/) | Biên bản họp |
| [report/](report/) | Báo cáo |

## Thành viên

| Thành viên | MSSV | GitHub | Phụ trách |
|---|---|---|---|
| Hoàng | | | Topic iv, v, vi · FR3, FR4, FR6, FR9 · hạ tầng |
| Dương | | | Topic i, ii, iii · FR1, FR2, FR5, FR7, FR8 · dữ liệu |

## Kiến trúc

```
React (Vite + Ant Design)  ──HTTP/JSON──▶  Node.js / Express REST API
   client/                                  server/src/modules/<feature>/
                                              routes → service → repository
                                                    │                │
                                              SQL Server 2022   Cassandra 5.0
```

## Chạy dự án

Yêu cầu: **Node.js ≥ 22**, **Docker Desktop** (cấp ≥ 4GB RAM), Git.

```bash
git clone <repo-url> && cd healthcare-dbms
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm install                   # cài cho cả server/ và client/

npm run db:up                 # khởi động SQL Server + Cassandra (lần đầu tải image ~2GB)
docker compose ps             # đợi cả 2 container "healthy" (Cassandra ~1 phút)
npm run db:init               # tạo DB + schema + dữ liệu mẫu (XOÁ dữ liệu cũ)

npm run dev                   # API :4000 + web :5173
```

Mở http://localhost:5173 và đăng nhập `admin / admin123` (hoặc `reception / reception123`, `doctor1 / doctor123`).
Kiểm tra kết nối DB: http://localhost:4000/api/health

| Lệnh | Tác dụng |
|---|---|
| `npm run db:up:cluster` | Thêm 2 node Cassandra (demo consistency/replication) |
| `npm run db:down` | Dừng container (giữ dữ liệu); `docker compose down -v` để xoá sạch |
| `npm run db:init -- mssql` | Chỉ tạo lại SQL Server (hoặc `cassandra`) |
| `npm run format` | Format code bằng Prettier |

## Cấu trúc thư mục

```
├── client/                React app
├── server/                Express API, scripts/db-init.js
├── database/mssql/        Schema + seed SQL Server (chạy theo thứ tự tên file)
├── database/cassandra/    Schema CQL
├── demos/0X-<topic>/      Script demo + kết quả của 6 topic
├── docs/                  Plan, tracklog, thiết kế, biên bản họp
├── report/                Báo cáo
└── docker-compose.yml
```
