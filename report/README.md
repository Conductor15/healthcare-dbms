# Report: khung & phân công (S5.1)

Rubric *Structure*: không quá 7 section, không ít hơn 4; **bắt buộc** có Introduction, Conclusion + self-assessment, References. Khung dưới đây gồm **6 section + References**.

| # | Section | File | Người viết | Nội dung chính |
|---|---|---|---|---|
| 1 | Introduction | `sections/01-introduction.md` | Hoàng | Bối cảnh phòng khám, mục tiêu, phạm vi (6 topic, 9 FR), phân công tổng quan, cấu trúc report |
| 2 | Background & Environment | `sections/02-background.md` | Hoàng (SQL Server), Dương (Cassandra) | Tổng quan 2 DBMS: kiến trúc, mô hình dữ liệu; môi trường thực nghiệm (Docker, cấu hình máy, bộ dữ liệu) |
| 3 | DBMS Demonstrations & Comparison | `sections/03-1-storage.md` … `03-6-backup-recovery.md` | Theo owner topic | Mỗi topic: lý thuyết → kịch bản → kết quả (ảnh, bảng số) → so sánh → kết luận cho Healthcare. Cuối section: **bảng tổng hợp 6 topic → DBMS phù hợp** |
| 4 | Application | `sections/04-application.md` | Dương (4.3 thiết kế DB, 4.5 query) + Hoàng (4.1, 4.2, 4.4, 4.6) | 4.1 Yêu cầu (FR, người dùng) · 4.2 Kiến trúc n-tier + công nghệ · 4.3 Thiết kế dữ liệu 2 DBMS · 4.4 Hiện thực + GUI · 4.5 Ma trận 8 query type · 4.6 DB Lab (bonus) |
| 5 | Teamwork | `sections/05-teamwork.md` | Hoàng | Bảng phân công + % đóng góp theo step, quy trình GitHub (ảnh Insights/PR), tóm tắt các buổi họp |
| 6 | Conclusion & Self-assessment | `sections/06-conclusion.md` | Cả 2 | Kết luận DBMS nào cho phần nào của bài toán; tự đánh giá theo **từng tiêu chí rubric**; hạn chế, hướng phát triển |
| — | References | `sections/99-references.md` | Cả 2 | IEEE style; ghi nguồn mọi tài liệu tái sử dụng (đề cho phép nhưng bắt buộc trích dẫn) |
| — | Appendix | `sections/A-appendix.md` | Hoàng | A. Biên bản họp · B. Ma trận truy vết yêu cầu đề → section · C. Hướng dẫn cài đặt |

Quy ước: ảnh để trong `report/figures/`, đặt tên `<section>-<mô-tả>.png`; trích dẫn dạng `[n]`.
