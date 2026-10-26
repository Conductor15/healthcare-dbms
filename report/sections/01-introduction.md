# 1. Introduction

> Bản nháp (Hoàng, S5.1). Ngôn ngữ cuối cùng của report (Việt/Anh) chốt ở buổi họp.

## 1.1 Bối cảnh

Một phòng khám đa khoa cần quản lý hai loại dữ liệu có tính chất trái ngược nhau:

- **Dữ liệu nghiệp vụ lâm sàng và tài chính**: hồ sơ bệnh nhân, bác sĩ, lịch hẹn, lượt khám, đơn thuốc, tồn kho, hoá đơn. Dữ liệu có quan hệ chặt, được nhiều người sửa đồng thời (lễ tân, bác sĩ, thu ngân). Đây là dữ liệu có giá trị pháp lý: không được mất, không được sai lệch.
- **Dữ liệu thiết bị và hệ thống**: chỉ số sinh hiệu do máy đo gửi liên tục (nhịp tim, huyết áp, SpO₂, nhiệt độ) và nhật ký truy cập. Dữ liệu chỉ ghi thêm, khối lượng lớn, đọc theo mẫu cố định (theo bệnh nhân và thời gian), cần ghi được kể cả khi một máy chủ gặp sự cố.

Câu hỏi của đề tài: **với từng loại dữ liệu, hệ quản trị nào phù hợp hơn: Microsoft SQL Server (quan hệ) hay Apache Cassandra (NoSQL wide-column)?** Câu trả lời dựa trên thực nghiệm, không dựa trên cảm tính.

## 1.2 Mục tiêu và phạm vi

| Mục tiêu | Phạm vi thực hiện |
|---|---|
| So sánh 2 DBMS theo các chủ đề của môn học | Cả **6/6 chủ đề** (đề yêu cầu tối thiểu 2 với nhóm 2 người): lưu trữ, chỉ mục, xử lý truy vấn, giao dịch, điều khiển đồng thời, sao lưu & phục hồi. Mỗi chủ đề có kịch bản trên **cả hai** DBMS, số đo, bảng so sánh và kết luận cho bối cảnh phòng khám |
| Xây dựng ứng dụng | Ứng dụng web n-tier với **9 chức năng** (đề yêu cầu 4), đủ **8 loại truy vấn/cập nhật**, dùng **cả hai** DBMS theo mô hình *polyglot persistence* |
| Đưa kết quả nghiên cứu vào ứng dụng | Trang **DB Lab** chạy các thí nghiệm ngay trong ứng dụng; các kỹ thuật rút ra (khoá chống đặt trùng lịch, transaction kê đơn, logged batch, point-in-time restore) được dùng trong chức năng thật |

## 1.3 Phân công tổng quan

| Thành viên | Chủ đề DBMS | Chức năng ứng dụng | Khác |
|---|---|---|---|
| Hoàng (trưởng nhóm) | iv. Transaction, v. Concurrency control, vi. Backup & recovery | FR3 Lịch hẹn, FR4 Khám & kê đơn, FR6 Chi tiết lượt khám, FR9 Sinh hiệu (Cassandra), nhật ký truy cập, DB Lab iv–vi | Hạ tầng, quy trình làm việc, kiểm thử |
| Dương | i. Data storage & management, ii. Indexing, iii. Query processing | FR1 Bệnh nhân, FR2 Bác sĩ, FR5 Tìm kiếm, FR7 Thống kê, FR8 Truy vấn nâng cao, DB Lab i–iii | Mô hình dữ liệu Cassandra, bộ sinh dữ liệu lớn |

Chi tiết đóng góp ở Section 5.

## 1.4 Cấu trúc báo cáo

Section 2 giới thiệu hai DBMS và môi trường thực nghiệm. Section 3 trình bày thực nghiệm và so sánh cho 6 chủ đề. Section 4 mô tả ứng dụng: yêu cầu, kiến trúc, thiết kế dữ liệu, hiện thực và trang DB Lab. Section 5 báo cáo cách làm việc nhóm. Section 6 kết luận và tự đánh giá theo tiêu chí chấm điểm.
