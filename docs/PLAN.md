# Kế hoạch dự án: DBMS Assignment HK261

> **Đây là file nguồn sự thật (single source of truth)** về phạm vi, phân công và tiến độ.
> - Đổi trạng thái step → sửa cột **Status** ở đây.
> - Việc đã làm, kết quả, vướng mắc → ghi vào [TRACKLOG.md](TRACKLOG.md).
> - Cả hai thay đổi nằm **trong cùng PR** với code/kết quả của step đó.

Status: ⬜ TODO · 🟦 DOING · 🟨 REVIEW (đang chờ PR) · 🟩 DONE · 🟥 BLOCKED

---

## 0. Tóm tắt

| Mục | Nội dung |
|---|---|
| Domain | Healthcare, hệ thống quản lý phòng khám đa khoa |
| DBMS so sánh | **Microsoft SQL Server 2022** (SQL) vs **Apache Cassandra 5.0** (NoSQL) |
| Ứng dụng | Web n-tier: React (Vite + Ant Design) → Node.js/Express REST API → SQL Server + Cassandra (*polyglot persistence*) |
| Thành viên | **Hoàng** (trưởng nhóm, nộp bài): topic iv, v, vi · **Dương**: topic i, ii, iii |
| Phạm vi | **6/6 topic** (đề yêu cầu 2, 4 topic còn lại tính bonus) · **9 FR** (đề yêu cầu 4) · đủ **8 loại query-update** · **DB Lab** trong app (bonus mức 2đ) |
| Mốc nội bộ | Code freeze **CN 15/11/2026** (hết tuần 46) · Report final **19/11** · Thuyết trình/nộp: tuần 47–50 theo lịch LMS |

> ⚠️ Đề ghi "Due date: Week 47, 48, 49, 50". Hoàng xác nhận với GV ngày nộp chính xác ở buổi kickoff (S0.5); plan này giả định hạn sớm nhất là tuần 47 (16/11).

---

## 1. Chiến lược đạt 10 điểm (map theo rubric)

| Tiêu chí (trọng số) | Điều kiện để vào band 8.5–10 | Cách nhóm đáp ứng | Step |
|---|---|---|---|
| Structure (10%) | Có cấu trúc tốt, có Introduction, Conclusion + self-assessment, References. **Không quá 7 section, không ít hơn 4** | Report đúng 6 section + References (xem [report/README.md](../report/README.md)) | S5.1 |
| Content (10%) | Đáp ứng >90% yêu cầu đề | Phụ lục "Ma trận truy vết yêu cầu": mỗi yêu cầu của đề → section/endpoint/script | S5.2, S5.3 |
| Presentation (10%) | Trình bày rõ, tự tin cả demo DBMS lẫn app | Mỗi người trình bày phần mình; demo live + video dự phòng; tập dượt 2 lần | S5.5–S5.7 |
| Teamwork (10%) | Báo cáo chi tiết đóng góp **+ ít nhất 1 biên bản họp** | Bảng đóng góp theo step ID, screenshot GitHub Insights, **≥ 6 biên bản** (họp 2 buổi/tuần) | S5.4, docs/meetings |
| Demonstration (30%) | **Tất cả topic** được demo **đúng** | Mỗi topic: script chạy lại được trên cả 2 DBMS, số liệu đo, bảng so sánh, kết luận cho bối cảnh Healthcare | Phase 2 |
| Application (30%) | >85% FR + query-update type chạy đúng, **GUI thân thiện, best practices** | 9 FR (gấp đôi yêu cầu), đủ 8 query type có truy vết, validation, thông báo lỗi tiếng Việt, phân trang, xác nhận khi xoá, kiến trúc phân lớp | Phase 3–4 |
| **Bonus (+2)** | "Additional work… **completely included in the application**" | 4 topic thêm + **DB Lab**: trang trong app cho chạy demo của cả 6 topic (xem plan/index, chạy transaction lỗi, mô phỏng double-booking, backup/restore) | S3.10, S3.11 |

**Ưu tiên khi thiếu thời gian (MoSCoW):**
- **Must:** topic chính của mỗi người (Dương: ii Indexing, Hoàng: iv Transaction) làm hoàn chỉnh; FR1, FR3, FR4, FR7 (đủ 8 query type); report + 1 biên bản.
- **Should:** 4 topic còn lại; đủ 9 FR.
- **Could:** DB Lab đầy đủ; Cassandra cluster 3 node; video demo.

---

## 2. Phân công tổng quan

| Hạng mục | Hoàng | Dương |
|---|---|---|
| Topic DBMS | iv Transaction · v Concurrency control · vi Backup & recovery | i Data storage & management · ii Indexing · iii Query processing |
| Hạ tầng | Repo, Docker, skeleton, auth, CI/quy trình | Bộ sinh dữ liệu lớn (dùng chung cho mọi benchmark) |
| Thiết kế | ERD + schema SQL Server, API contract | Data model Cassandra (đúng chủ đề storage) |
| Chức năng app | FR3 Lịch hẹn · FR4 Khám & kê đơn · FR6 Chi tiết lượt khám · FR9 Sinh hiệu (Cassandra) | FR1 Bệnh nhân · FR2 Bác sĩ · FR5 Tìm kiếm · FR7 Thống kê · FR8 Truy vấn nâng cao |
| DB Lab (bonus) | Panel Transaction / Concurrency / Backup | Panel Storage / Indexing / Query plan |
| Report | Intro, Background, phần topic iv–vi, Teamwork, Conclusion | Phần topic i–iii, Application (thiết kế DB, query) |
| Nộp bài | Đóng gói zip, nộp LMS | Review lần cuối |

Lý do chia FR như vậy: FR của Dương xoay quanh tìm kiếm, thống kê, truy vấn, khớp với Indexing/Query processing nên benchmark trong topic dùng luôn query thật của app. FR của Hoàng xoay quanh ghi dữ liệu nhiều bảng, khớp với Transaction/Concurrency.

---

## 3. Timeline

```mermaid
gantt
  title DBMS Assignment HK261 (Hoàng & Dương)
  dateFormat YYYY-MM-DD
  axisFormat %d/%m
  section Phase 0-1
  Setup + skeleton (Hoàng)           :p0, 2026-10-26, 3d
  Design: FR, ERD, CQL, API          :p1, 2026-10-27, 4d
  Data generator (Dương)             :p1b, 2026-10-29, 3d
  section Topic (Dương)
  i Storage                          :t1, 2026-10-29, 7d
  ii Indexing                        :t2, 2026-11-02, 8d
  iii Query processing               :t3, 2026-11-06, 7d
  section Topic (Hoàng)
  iv Transaction                     :t4, 2026-10-29, 7d
  v Concurrency                      :t5, 2026-11-02, 8d
  vi Backup & recovery               :t6, 2026-11-06, 7d
  section App
  FR (Dương)                         :a1, 2026-10-30, 11d
  FR (Hoàng)                        :a2, 2026-10-30, 11d
  DB Lab                             :a3, 2026-11-10, 4d
  Integration + test, freeze 15/11   :a4, 2026-11-11, 5d
  section Report & thuyết trình
  Report                             :r1, 2026-11-09, 11d
  Slides + video + rehearsal         :r2, 2026-11-17, 4d
```

| Tuần | Khoảng ngày | Mục tiêu cuối tuần |
|---|---|---|
| W44 | 26/10–01/11 | Repo + Docker chạy trên **cả 2 máy**; schema 2 DB chốt; dữ liệu lớn sinh được; topic i/iv xong phần SQL Server |
| W45 | 02/11–08/11 | Topic i/iv xong; ii/v xong phần SQL Server; FR1, FR2, FR3, FR4, FR5 chạy |
| W46 | 09/11–15/11 | 6 topic xong; 9 FR + DB Lab; test chéo; **code freeze 15/11** |
| W47 | 16/11–22/11 | Report PDF final, slides, video, tập dượt, nộp |

---

## 4. Chi tiết từng step

Mỗi step = 1 GitHub Issue (template "Step") + ≥1 PR. Tên branch chứa step ID, ví dụ `feat/S3.3-appointment-booking`.

### Phase 0: Setup (Hoàng)

| ID | Việc | Owner | Input | Output | Done khi | Hạn | Status |
|---|---|---|---|---|---|---|---|
| S0.1 | Khởi tạo repo, cấu trúc thư mục | Hoàng | Đề bài, phiếu chọn phương án | Repo GitHub (private), `README.md`, cây thư mục | Dương clone được | 26/10 | 🟨 |
| S0.2 | Môi trường Docker | Hoàng | — | `docker-compose.yml`, `.env.example` | `docker compose up -d` → 2 container *healthy* trên cả 2 máy | 27/10 | 🟨 |
| S0.3 | Quy trình Git & quy ước | Hoàng | — | `CONTRIBUTING.md`, `.github/` (PR/Issue template, CODEOWNERS), branch protection `main` | Rule bật trên GitHub, Dương đọc xong | 27/10 | 🟨 |
| S0.4 | Skeleton backend + frontend, module mẫu *Khoa phòng*, auth, access log | Hoàng | S1.2 | `server/`, `client/`, module `departments` | Đăng nhập được; CRUD khoa chạy end-to-end; `/api/health` báo 2 DB OK | 28/10 | 🟨 |
| S0.5 | Họp kickoff + biên bản #1 | Cả 2 | `PLAN.md` | `docs/meetings/2026-10-26-kickoff.md` | Chốt plan, deadline, topic chính, lịch họp | 26/10 | ⬜ |
| S0.6 | Onboard Dương | Dương | `README.md` | PR đầu tiên (ghi TRACKLOG) được merge | App chạy trên máy Dương | 28/10 | ⬜ |

### Phase 1: Thiết kế

| ID | Việc | Owner | Input | Output | Done khi | Hạn | Status |
|---|---|---|---|---|---|---|---|
| S1.1 | Chốt 9 FR + ma trận 8 query type | Cả 2 | Phiếu chọn phương án | `docs/design/requirements.md` | Mỗi query type map ≥1 endpoint cụ thể | 28/10 | 🟨 |
| S1.2 | ERD + schema SQL Server | Hoàng (Dương review) | S1.1 | `docs/design/erd.md`, `database/mssql/01_schema.sql`, `02_seed.sql` | `npm run db:init` chạy sạch | 28/10 | 🟨 |
| S1.3 | Data model Cassandra (query-first) | Dương (Hoàng review) | S1.1, bản nháp của Hoàng | `database/cassandra/01_schema.cql` + mục Cassandra trong `erd.md` | Mỗi bảng phục vụ ≥1 query, không query nào cần `ALLOW FILTERING` | 29/10 | 🟦 |
| S1.4 | Bộ sinh dữ liệu lớn | Dương | S1.2, S1.3 | `server/scripts/generate-data.js` (`npm run db:generate -- --scale=1`) | Scale 1 = 100k bệnh nhân, ~300k lượt khám, ≥5M bản ghi sinh hiệu; có tham số scale | 31/10 | ⬜ |
| S1.5 | API contract | Hoàng | S1.1 | `docs/design/api.md` | Mọi FR có endpoint + request/response mẫu | 29/10 | 🟨 |
| S1.6 | Bench harness dùng chung | Hoàng | — | `demos/_common/bench.js` (chạy query N lần trên 2 DB, xuất CSV: min/avg/p95) | 6 topic dùng chung một cách đo | 31/10 | 🟨 |

### Phase 2: Demo 6 topic (trên **cả hai** DBMS)

Mỗi topic đi qua 6 bước con giống nhau. Chi tiết kịch bản nằm trong `demos/<topic>/README.md`.

| Bước con | Việc | Input | Output |
|---|---|---|---|
| Tx.1 | Nghiên cứu lý thuyết trên 2 DBMS | Tài liệu chính thức, giáo trình | Mục "Lý thuyết" + References trong README topic |
| Tx.2 | Thiết kế kịch bản demo (bối cảnh Healthcare) | Tx.1, schema | Bảng kịch bản (mục tiêu, kỳ vọng) |
| Tx.3 | Hiện thực + chạy trên SQL Server | Tx.2, dữ liệu S1.4 | `demos/<topic>/mssql/*.sql`, kết quả trong `results/` |
| Tx.4 | Hiện thực + chạy trên Cassandra | Tx.2, dữ liệu S1.4 | `demos/<topic>/cassandra/*.cql` / `*.sh`, kết quả trong `results/` |
| Tx.5 | So sánh + kết luận | Tx.3, Tx.4 | Bảng so sánh, biểu đồ, kết luận "DBMS nào phù hợp cho Healthcare và vì sao" |
| Tx.6 | Viết section report | Tx.1–Tx.5 | `report/sections/03-<topic>.md` |

| ID | Topic | Owner | Tx.1 | Tx.2 | Tx.3 | Tx.4 | Tx.5 | Tx.6 | Status |
|---|---|---|---|---|---|---|---|---|---|
| T1 | i. Data storage & management | Dương | 30/10 | 30/10 | 01/11 | 03/11 | 04/11 | 05/11 | ⬜ |
| T2 | ii. Indexing *(topic chính)* | Dương | 02/11 | 03/11 | 05/11 | 07/11 | 08/11 | 09/11 | ⬜ |
| T3 | iii. Query processing | Dương | 06/11 | 07/11 | 09/11 | 10/11 | 11/11 | 12/11 | ⬜ |
| T4 | iv. Transaction *(topic chính)* | Hoàng | 30/10 | 30/10 | 01/11 | 03/11 | 04/11 | 05/11 | 🟨 T4.1–T4.5 |
| T5 | v. Concurrency control | Hoàng | 02/11 | 03/11 | 05/11 | 07/11 | 08/11 | 09/11 | 🟨 T5.1–T5.5 |
| T6 | vi. Data backup & recovery | Hoàng | 06/11 | 07/11 | 09/11 | 10/11 | 11/11 | 12/11 | 🟨 T6.1–T6.5 |

> Khi cập nhật, ghi step con dạng `T4.3` trong TRACKLOG/PR (= Topic iv, bước SQL Server).

### Phase 3: Ứng dụng

| ID | Việc | Owner | Query type | DBMS | Input | Output | Hạn | Status |
|---|---|---|---|---|---|---|---|---|
| S3.0 | Đăng nhập + phân quyền (ADMIN / RECEPTIONIST / DOCTOR) | Hoàng | — | SQL Server | S0.4 | `modules/auth`, trang Login | 28/10 | 🟨 |
| S3.1 | FR1 Quản lý hồ sơ bệnh nhân | Dương | a, b, c, d | SQL Server | S1.5 | `modules/patients`, `pages/patients` | 01/11 | ⬜ |
| S3.2 | FR2 Quản lý bác sĩ (khoa phòng đã có mẫu) | Dương | a, b, c | SQL Server | S0.4 | `modules/doctors`, `pages/doctors` | 03/11 | ⬜ |
| S3.3 | FR3 Đặt lịch / huỷ lịch hẹn (**transaction + chống double-booking**) | Hoàng | a, b, c, e | SQL Server | S1.5, T4, T5 | `modules/appointments`, `pages/appointments` | 03/11 | 🟨 |
| S3.4 | FR4 Khám bệnh + kê đơn + hoá đơn (**transaction nhiều bảng, trừ tồn kho**) | Hoàng | a, c | SQL Server | S3.3 | `modules/visits`, `pages/visits` | 06/11 | 🟨 |
| S3.5 | FR5 Tìm kiếm bệnh nhân đa điều kiện | Dương | e | SQL Server | S3.1, T2 | `GET /patients/search`, trang Tra cứu | 05/11 | ⬜ |
| S3.6 | FR6 Chi tiết lượt khám (join 10 bảng) | Hoàng | f | SQL Server | S3.4 | `GET /visits/:id`, drawer chi tiết | 07/11 | 🟨 |
| S3.7 | FR7 Dashboard thống kê | Dương | h | SQL Server | S1.4 | `modules/stats`, `pages/dashboard` (biểu đồ) | 08/11 | ⬜ |
| S3.8 | FR8 Truy vấn nâng cao | Dương | g | SQL Server | S1.4 | `modules/insights`, `pages/insights` | 10/11 | ⬜ |
| S3.9 | FR9 Sinh hiệu real-time (SSE) + cảnh báo bất thường | Hoàng | a, d | **Cassandra** | S1.3 | `modules/vitals`, `pages/vitals`, trình giả lập thiết bị | 10/11 | 🟨 |
| S3.10 | DB Lab: Storage / Index / Query plan | Dương | — | Cả 2 | T1–T3 | `modules/lab` (phần i–iii), `pages/db-lab` | 13/11 | ⬜ |
| S3.11 | DB Lab: Transaction / Concurrency / Backup | Hoàng | — | Cả 2 | T4–T6 | `modules/lab` (phần iv–vi) | 13/11 | 🟨 |
| S3.12 | Ghi access log mọi request vào Cassandra + trang xem log (ADMIN) | Hoàng | a, d | **Cassandra** | S0.4 | `middleware/access-log.js`, trang Nhật ký | 10/11 | 🟨 |

### Phase 4: Tích hợp & kiểm thử

| ID | Việc | Owner | Input | Output | Done khi | Hạn | Status |
|---|---|---|---|---|---|---|---|
| S4.1 | Checklist kiểm thử E2E: 9 FR × 8 query type | Hoàng | Phase 3 | `docs/testing/checklist.md` | Có cột người test + kết quả | 11/11 | 🟨 |
| S4.2 | **Test chéo**: Dương test FR của Hoàng và ngược lại | Cả 2 | S4.1 | Issue bug gắn nhãn `bug` | Không còn bug mức High | 14/11 | ⬜ |
| S4.3 | Hoàn thiện UX (empty state, loading, validation, responsive) | Theo owner FR | S4.2 | PR | Checklist UX trong S4.1 pass | 14/11 | ⬜ |
| S4.4 | Code freeze + tag `v1.0` + hướng dẫn cài đặt | Hoàng | S4.3 | Git tag, `README.md` | Cài mới từ đầu trên máy Dương chạy được | 15/11 | ⬜ |

### Phase 5: Report, thuyết trình, nộp bài

| ID | Việc | Owner | Input | Output | Hạn | Status |
|---|---|---|---|---|---|---|
| S5.1 | Khung report (6 section + References) | Hoàng | rubric | `report/README.md`, `report/sections/*` | 09/11 | 🟨 |
| S5.2 | Section topic (gộp từ Tx.6) | Theo topic | Phase 2 | `report/sections/03-*.md` | 14/11 | ⬜ |
| S5.3 | Section Application + ma trận truy vết yêu cầu | Dương (thiết kế DB, query) + Hoàng (kiến trúc, GUI) | Phase 3 | `report/sections/04-application.md` | 15/11 | ⬜ |
| S5.4 | Section Teamwork: bảng đóng góp, biên bản, GitHub Insights | Hoàng | TRACKLOG, meetings | `report/sections/05-teamwork.md` | 16/11 | ⬜ |
| S5.5 | Slides | Cả 2 (mỗi người phần mình) | Report | `report/slides.pdf` | 18/11 | ⬜ |
| S5.6 | Video demo dự phòng (app + 6 topic) | Cả 2 | v1.0 | Link video trong README | 19/11 | ⬜ |
| S5.7 | Tập dượt ×2 (bấm giờ) | Cả 2 | S5.5 | Biên bản họp tập dượt | 20/11 | ⬜ |
| S5.8 | Xuất PDF, đóng gói zip, nộp LMS | Hoàng | Tất cả | `GroupXX_DBMS.zip` (report.pdf, source, demos, slides) | Theo LMS | ⬜ |

---

## 5. Nhịp làm việc

- **Họp đồng bộ:** Thứ 2 và Thứ 5, 21:00, 20–30 phút (online). Ngay sau họp, người ghi biên bản (luân phiên) tạo file trong `docs/meetings/` theo [TEMPLATE](meetings/TEMPLATE.md) → PR.
- **Khi bắt đầu một step:** tạo Issue (template *Step*), đổi Status → 🟦, tạo branch.
- **Khi xong một step:** mở PR (template có sẵn ô Input/Output), trong PR có cập nhật PLAN (Status → 🟨) + thêm dòng TRACKLOG. Người kia review **trong 24h** → merge → Status 🟩.
- **Bị chặn > 1 ngày:** Status 🟥, ghi lý do vào TRACKLOG và nhắn ngay, không đợi đến buổi họp.
- **Không ai push thẳng lên `main`.**

---

## 6. Rủi ro & cách xử lý

| Rủi ro | Ảnh hưởng | Cách xử lý |
|---|---|---|
| 2 người gánh khối lượng của 4–5 người | Trễ hạn | MoSCoW ở mục 1; cắt *Could* trước, không cắt *Must* |
| Máy yếu RAM (SQL Server ~2GB + Cassandra ~1.5GB) | Docker chậm/crash | Heap Cassandra đã giới hạn 1GB; cluster 3 node chỉ bật khi demo (`--profile cluster`) |
| Merge conflict | Mất thời gian | Phân thư mục theo owner (CODEOWNERS); PR nhỏ; `git pull --rebase` mỗi ngày |
| Demo live lỗi khi thuyết trình | Mất điểm Presentation/Demo | Video dự phòng (S5.6); script demo idempotent, chạy lại được |
| Hạn nộp không rõ | Trễ | Hoàng xác nhận với GV ở S0.5 |
| Lệch môi trường giữa 2 máy | "Máy tao chạy được" | Mọi thứ chạy qua Docker + `npm run db:init`, không cài DB tay |
