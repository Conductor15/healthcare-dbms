# Quy trình làm việc chung (Hoàng & Dương)

Mục tiêu: hai người làm song song mà **không đạp code nhau**, và mọi đóng góp đều **có dấu vết** (cần cho điểm Teamwork).

## 1. Mô hình: GitHub Flow

```
main (được bảo vệ, luôn chạy được)
 ├── feat/S3.1-patients-crud      ← Dương
 ├── demo/T4.3-transaction-mssql  ← Hoàng
 └── docs/S5.2-report-indexing    ← Dương
```

- `main` **luôn chạy được**. Không ai push thẳng lên `main`.
- Mỗi step trong [PLAN.md](docs/PLAN.md) → 1 branch ngắn hạn (1–3 ngày) → 1 Pull Request → người kia review → **Squash and merge**.

## 2. Đặt tên

**Branch:** `<loại>/<stepID>-<mô-tả-ngắn>`

| Loại | Dùng cho | Ví dụ |
|---|---|---|
| `feat` | Chức năng app | `feat/S3.3-appointment-booking` |
| `fix` | Sửa bug | `fix/S4.2-patient-search-paging` |
| `demo` | Script/kết quả demo topic | `demo/T2.3-indexing-mssql` |
| `db` | Schema, seed, generator | `db/S1.4-data-generator` |
| `docs` | Plan, report, biên bản | `docs/meeting-2026-10-30` |
| `chore` | Cấu hình, tooling | `chore/S0.2-docker` |

**Commit:** [Conventional Commits](https://www.conventionalcommits.org/), kèm step ID:

```
feat(appointments): S3.3 book slot inside a SERIALIZABLE transaction
demo(indexing): T2.3 covering index for patient search, 41x fewer reads
docs(meeting): minutes 2026-10-30
```

## 3. Quy trình một step (copy làm theo)

```bash
# 0. Tạo Issue trên GitHub bằng template "Step", tự assign, đổi Status trong PLAN thành 🟦

# 1. Lấy main mới nhất, tạo branch
git switch main
git pull --rebase origin main
git switch -c feat/S3.1-patients-crud

# 2. Code + commit nhỏ, thường xuyên
git add -A
git commit -m "feat(patients): S3.1 list + create endpoints"

# 3. Mỗi ngày đồng bộ main để tránh conflict dồn cục
git fetch origin
git rebase origin/main            # conflict → sửa → git add <file> → git rebase --continue

# 4. Trước khi mở PR: cập nhật docs/PLAN.md (Status → 🟨) + thêm dòng docs/TRACKLOG.md
git push -u origin feat/S3.1-patients-crud
# 5. Mở PR trên GitHub; template tự hiện → điền Step ID, Input, Output, cách test, ảnh chụp
#    Ghi "Closes #<issue>" để issue tự đóng khi merge

# 6. Người kia review (≤ 24h) → Approve → Squash and merge → xoá branch
# 7. Cập nhật PLAN Status → 🟩 (có thể gộp vào PR kế tiếp)
```

> Lỡ push nhầm lên branch sau rebase: `git push --force-with-lease` (chỉ trên branch **của mình**, không bao giờ trên `main`).

## 4. Phân vùng sở hữu (tránh conflict)

| Đường dẫn | Owner | Ghi chú |
|---|---|---|
| `demos/01-storage`, `02-indexing`, `03-query-processing` | Dương | |
| `demos/04-transaction`, `05-concurrency`, `06-backup-recovery` | Hoàng | |
| `server/src/modules/{patients,doctors,stats,insights}`, `client/src/pages/{patients,doctors,dashboard,search,insights}` | Dương | |
| `server/src/modules/{auth,appointments,visits,vitals,access-logs}`, `client/src/pages/{appointments,visits,vitals}` | Hoàng | |
| `database/cassandra/` | Dương | Hoàng review |
| `database/mssql/`, `docker-compose.yml`, `server/src/{app.js,db,middleware}` | Hoàng | Dương review |
| **File dùng chung**: `server/src/app.js` (mount router), `client/src/routes.jsx` (menu), `docs/PLAN.md` | Cả 2 | Chỉ sửa **dòng của mình**; mỗi người thêm 1 dòng, không format lại cả file |

**Đổi schema** (`database/mssql/*.sql`) là thay đổi ảnh hưởng cả hai: mở PR riêng, ghi rõ trong PR, người kia chạy lại `npm run db:init` sau khi merge.

## 5. Review PR: checklist cho người review

- [ ] Kéo branch về chạy được (`git fetch && git switch <branch>` → `npm run dev`)
- [ ] Đúng phạm vi step, không sửa lan sang vùng của người khác
- [ ] Query dùng **tham số** (`request.input(...)` / prepared statement), không nối chuỗi SQL từ input người dùng
- [ ] Lỗi trả về thông báo tiếng Việt dễ hiểu, UI có loading/empty state
- [ ] PLAN + TRACKLOG đã cập nhật
- [ ] Demo: có script chạy lại được + ảnh/số liệu trong `results/`

## 6. Quy ước code

- Backend theo lớp: `*.routes.js` (HTTP) → `*.service.js` (nghiệp vụ, validate, transaction) → `*.repository.js` (SQL/CQL). Copy cấu trúc từ `server/src/modules/departments/`.
- Frontend: mỗi trang 1 thư mục trong `client/src/pages/`, gọi API qua `src/api/client.js`, khai báo menu trong `src/routes.jsx`. Copy mẫu từ `pages/departments/`.
- Định dạng: `npm run format` (Prettier) trước khi commit.
- Không commit `.env`, `node_modules/`, file backup `.bak`.

## 7. Thiết lập GitHub lần đầu (Hoàng làm 1 lần)

1. Tạo repo **private** `healthcare-dbms`, push code lên.
2. *Settings → Collaborators* → mời Dương (quyền Write).
3. *Settings → Branches → Add rule* cho `main`: ✅ Require a pull request before merging, ✅ Require approvals (1), ✅ Do not allow bypassing.
4. *Settings → General → Pull Requests*: chỉ bật **Allow squash merging**, bật **Automatically delete head branches**.
5. *Projects → New project → Board*: cột `Todo / Doing / Review / Done`, thêm Issue của từng step vào. Board này là bản trực quan của PLAN.md.
6. Tạo label: `topic-i` … `topic-vi`, `app`, `report`, `bug`, `blocked`.
7. Sửa `.github/CODEOWNERS`: thay `HOANG_GITHUB` và `DUONG_GITHUB` bằng username GitHub thật.
