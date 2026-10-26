# 5. Teamwork

> Khung (Hoàng, S5.4). Hoàn thiện ở tuần 47 từ `docs/TRACKLOG.md`, `docs/meetings/` và GitHub Insights.

## 5.1 Phân công và đóng góp

| Hạng mục | Hoàng | Dương |
|---|---|---|
| Chủ đề DBMS | iv, v, vi | i, ii, iii |
| Chức năng ứng dụng | FR3, FR4, FR6, FR9, nhật ký truy cập | FR1, FR2, FR5, FR7, FR8 |
| DB Lab | Tab iv–vi | Tab i–iii |
| Hạ tầng & quy trình | Docker, skeleton, auth, quy trình Git, bộ đo hiệu năng, kiểm thử | Mô hình Cassandra, bộ sinh dữ liệu lớn |
| Report | 1, 3.4–3.6, 4.1/4.2/4.4/4.6, 5 | 2 (Cassandra), 3.1–3.3, 4.3/4.5/4.4 |
| **Tỉ lệ đóng góp tự đánh giá** | __ % | __ % |

Bảng chi tiết theo step (ngày, việc, input, output, thời gian): Phụ lục / `docs/TRACKLOG.md`.

## 5.2 Quy trình làm việc

- **Kế hoạch:** `docs/PLAN.md`. Mỗi step có ID, owner, input, output, điều kiện hoàn thành, hạn và trạng thái.
- **GitHub Flow:** mỗi step là một branch, một Pull Request, người kia review rồi squash merge; `main` được bảo vệ. Commit và branch đều mang step ID để truy vết.
- **Họp:** thứ 2 và thứ 5 hằng tuần, có biên bản sau mỗi buổi (Phụ lục A).
- *(Chèn ảnh: GitHub Insights → Contributors, danh sách PR đã merge, Projects board)*

## 5.3 Các buổi họp

| # | Ngày | Nội dung chính | Biên bản |
|---|---|---|---|
| 1 | 26/10/2026 | Kickoff: chốt DBMS, phân công, timeline, quy trình | `docs/meetings/2026-10-26-kickoff.md` |

## 5.4 Khó khăn và cách xử lý

| Khó khăn | Cách xử lý |
|---|---|
| 2 người làm khối lượng của nhóm 4–5 người | Ưu tiên MoSCoW, phân vùng sở hữu thư mục để làm song song không xung đột |
| Script demo gây hỏng dữ liệu khi một bước lỗi (backup) | Dừng ở lỗi đầu tiên, chốt chặn trước bước nguy hiểm, lưới an toàn trong app (Section 3.6) |
| Gỡ cluster Cassandra sai cách làm mất dữ liệu dev | Script gỡ dùng `decommission --force`, dừng nếu lỗi, đã kiểm chứng giữ đủ dữ liệu |
