# Yêu cầu chức năng & ma trận truy vết (S1.1)

Đề yêu cầu: tối thiểu **n = 2 × 2 = 4** FR (không tính login/logout) và đủ **8 loại query-update**. Nhóm làm **9 FR**.

## 1. Người dùng

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| ADMIN | Quản trị phòng khám | Toàn quyền: khoa, bác sĩ, thuốc, thống kê, DB Lab, nhật ký truy cập |
| RECEPTIONIST | Lễ tân | Bệnh nhân, lịch hẹn, thanh toán hoá đơn |
| DOCTOR | Bác sĩ | Xem lịch của mình, khám bệnh, kê đơn, xem sinh hiệu |

## 2. Chức năng (Functional Requirements)

| FR | Tên | Mô tả | Owner | Step | DBMS |
|---|---|---|---|---|---|
| FR1 | Quản lý hồ sơ bệnh nhân | Thêm/sửa/xoá/xem; tìm theo tên; phân trang | Dương | S3.1 | SQL Server |
| FR2 | Quản lý bác sĩ & khoa phòng | CRUD khoa (module mẫu) + CRUD bác sĩ, lọc theo khoa, ngừng hoạt động | Dương | S3.2 | SQL Server |
| FR3 | Đặt lịch & quản lý lịch hẹn | Xem slot trống theo bác sĩ/ngày, đặt lịch (**transaction**, **chống double-booking**), huỷ, xoá lịch đã huỷ | Hoàng | S3.3 | SQL Server |
| FR4 | Khám bệnh & kê đơn thuốc | Ghi nhận lượt khám, chẩn đoán, kê đơn; **1 transaction**: tạo visit + đơn + trừ tồn kho + tạo hoá đơn + đóng lịch hẹn; thanh toán hoá đơn | Hoàng | S3.4 | SQL Server |
| FR5 | Tìm kiếm bệnh nhân đa điều kiện | Tên, giới tính, nhóm máu, khoảng tuổi, khoa/bác sĩ đã khám, khoảng ngày | Dương | S3.5 | SQL Server |
| FR6 | Chi tiết lượt khám | Bệnh nhân + bác sĩ + khoa + chẩn đoán + đơn thuốc + hoá đơn (join nhiều bảng) | Hoàng | S3.6 | SQL Server |
| FR7 | Thống kê | Lượt khám/doanh thu theo tháng, theo khoa; top thuốc; biểu đồ | Dương | S3.7 | SQL Server |
| FR8 | Truy vấn nâng cao | Bệnh nhân khám nhiều hơn trung bình; bác sĩ đông bệnh nhân nhất mỗi khoa; thuốc chưa từng được kê; bệnh nhân chưa quay lại > 6 tháng | Dương | S3.8 | SQL Server |
| FR9 | Theo dõi sinh hiệu real-time | Thiết bị (giả lập) gửi nhịp tim/huyết áp/SpO₂/nhiệt độ; xem biểu đồ trực tiếp; cảnh báo bất thường theo ngày | Hoàng | S3.9 | **Cassandra** |
| (phụ) | Nhật ký truy cập | Mọi request API được ghi vào Cassandra; ADMIN xem log theo user/ngày | Hoàng | S3.12 | **Cassandra** |
| (bonus) | DB Lab | Chạy demo 6 topic ngay trong app | Cả 2 | S3.10–11 | Cả 2 |

## 3. Ma trận 8 loại query-update

Mỗi loại có ít nhất 1 điểm chạm chính (ghi vào report) và các điểm phụ.

| Loại | Điểm chạm chính | Endpoint | Câu truy vấn (tóm tắt) | Điểm phụ |
|---|---|---|---|---|
| a. Insert | FR1 thêm bệnh nhân | `POST /api/patients` | `INSERT INTO patients … OUTPUT INSERTED.*` | FR3 đặt lịch, FR9 ghi sinh hiệu (Cassandra) |
| b. Delete | FR3 xoá lịch hẹn đã huỷ | `DELETE /api/appointments/:id` | `DELETE FROM appointments WHERE appointment_id=@id AND status='CANCELLED'` | FR1 xoá bệnh nhân, FR2 xoá khoa |
| c. Update | FR3 huỷ lịch | `PATCH /api/appointments/:id/cancel` | `UPDATE appointments SET status='CANCELLED'…` + `UPDATE time_slots SET is_booked=0` | FR1 sửa bệnh nhân, FR4 trừ tồn kho |
| d. Query 1 điều kiện | FR1 tìm theo tên | `GET /api/patients?name=` | `WHERE full_name LIKE @name` | FR9 sinh hiệu theo bệnh nhân (Cassandra) |
| e. Query đa điều kiện | FR5 tìm kiếm | `GET /api/patients/search?…` | `WHERE gender=@g AND blood_type=@b AND date_of_birth BETWEEN … AND EXISTS(…)` | FR3 lọc lịch hẹn theo ngày + bác sĩ + trạng thái |
| f. Join | FR6 chi tiết lượt khám | `GET /api/visits/:id` | `visits ⋈ patients ⋈ doctors ⋈ departments ⋈ prescriptions ⋈ prescription_items ⋈ medicines ⋈ invoices` | FR3 danh sách lịch hẹn |
| g. Subquery | FR8 bệnh nhân khám nhiều hơn TB | `GET /api/insights/frequent-patients` | `HAVING COUNT(*) > (SELECT AVG(cnt) FROM (SELECT COUNT(*) cnt … GROUP BY patient_id) t)` | Danh sách khoa đếm bác sĩ (subquery tương quan), thuốc chưa kê (`NOT EXISTS`) |
| h. Aggregate | FR7 thống kê | `GET /api/stats/visits-by-month` | `COUNT(*)`, `SUM(total_amount)` `GROUP BY YEAR, MONTH, department` | FR8 |

## 4. Yêu cầu phi chức năng (ăn điểm "GUI user-friendly, best practices")

- Kiến trúc phân lớp (n-tier): React → REST API (routes → service → repository) → SQL Server / Cassandra.
- Validate dữ liệu ở cả client (Form rules) và server (zod); lỗi DB (trùng, khoá ngoại) được dịch thành thông báo tiếng Việt.
- Mọi query dùng tham số (chống SQL injection); mật khẩu băm bcrypt; JWT + phân quyền theo vai trò.
- Danh sách có phân trang, tìm kiếm, loading, empty state; thao tác xoá có xác nhận.
