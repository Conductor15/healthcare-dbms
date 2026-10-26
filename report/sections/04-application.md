# 4. Application

> Bản nháp. Hoàng viết 4.1, 4.2, 4.4 (phần FR3/4/6/9), 4.6; Dương viết 4.3, 4.5 và 4.4 (phần FR1/2/5/7/8).

## 4.1 Yêu cầu

**Người dùng:** Quản trị (ADMIN), Lễ tân (RECEPTIONIST), Bác sĩ (DOCTOR). Quyền chi tiết: `docs/design/requirements.md`.

| FR | Chức năng | DBMS | Loại query chính |
|---|---|---|---|
| FR1 | Quản lý hồ sơ bệnh nhân | SQL Server | a, b, c, d |
| FR2 | Quản lý bác sĩ & khoa phòng | SQL Server | a, b, c, g |
| FR3 | Đặt lịch & quản lý lịch hẹn | SQL Server | a, b, c, e, f + transaction + khoá |
| FR4 | Khám bệnh, kê đơn, hoá đơn | SQL Server | a, c + transaction 6 bước |
| FR5 | Tìm kiếm bệnh nhân đa điều kiện | SQL Server | e |
| FR6 | Chi tiết lượt khám | SQL Server | f (10 bảng) |
| FR7 | Thống kê | SQL Server | h |
| FR8 | Truy vấn nâng cao | SQL Server | g |
| FR9 | Theo dõi sinh hiệu real-time | **Cassandra** | a, d |
| (phụ) | Nhật ký truy cập | **Cassandra** | a, d |

Đề yêu cầu 2 × 2 = 4 chức năng; nhóm thực hiện 9. Ma trận đủ 8 loại truy vấn ở mục 4.5.

## 4.2 Kiến trúc và công nghệ

```
Trình duyệt ── React 19 + Ant Design 6 (Vite) ──HTTP/JSON, SSE──▶ Node.js 24 / Express 5
                                                                 routes → service → repository
                                                                     │ mssql (tedious)   │ cassandra-driver
                                                                 SQL Server 2022      Cassandra 5.0
```

- **N-tier, phân lớp rõ ràng:** *routes* (HTTP, validate bằng zod, phân quyền) → *service* (nghiệp vụ, transaction) → *repository* (duy nhất nơi viết SQL/CQL, luôn dùng tham số).
- **Polyglot persistence:** dữ liệu quan hệ và giao dịch trên SQL Server; dữ liệu ghi liên tục, đọc theo mẫu cố định trên Cassandra. Hai DB liên kết qua `patient_id`/`user_id`. Cách chia dựa trên kết luận của Section 3.
- **Bảo mật:** JWT, mật khẩu băm bcrypt, phân quyền theo vai trò ở cả API lẫn giao diện; token SSE không bị ghi vào log.
- **Môi trường:** Docker Compose (SQL Server + 1 hoặc 3 node Cassandra); `npm run db:init` tạo lại DB giống hệt nhau trên mọi máy.
- **Kiểm thử:** 14 test API end-to-end (`node:test`); kiểm thử giao diện bằng trình duyệt headless trên 9 luồng nghiệp vụ.

## 4.3 Thiết kế dữ liệu *(Dương)*

ERD SQL Server, mô hình Cassandra theo truy vấn (Q1–Q4): xem `docs/design/erd.md`.

## 4.4 Hiện thực và giao diện

### FR3: Đặt lịch (Hình 4-4-fr3-booking, 4-4-fr3-appointments)

Lễ tân chọn bệnh nhân → bác sĩ → ngày, hệ thống hiện **lưới khung giờ trống**. Giờ đã đặt hoặc đã qua bị khoá. Phía server, `POST /appointments` chạy trong **một transaction**:
1. Đọc khung giờ `WITH (UPDLOCK, HOLDLOCK)`, nên các yêu cầu đặt cùng giờ phải xếp hàng.
2. Kiểm tra: giờ chưa qua, bác sĩ còn hoạt động, bệnh nhân không có lịch khác cùng giờ.
3. Ghi lịch hẹn và đánh dấu khung giờ đã đặt.

Filtered UNIQUE index `UX_appointments_active_slot` là lớp chặn cuối. Nếu thua cuộc đua, người dùng nhận thông báo "vừa có người đặt" và lưới tự cập nhật. Huỷ lịch cũng là một transaction (đổi trạng thái và mở lại khung giờ). Bác sĩ chỉ thấy lịch của mình.

### FR4 + FR6: Khám bệnh và chi tiết lượt khám (Hình 4-4-fr4-visit-form, 4-4-fr6-visit-detail)

Từ lịch hẹn, bác sĩ bấm *Khám*, form có sẵn bệnh nhân và lý do khám. Bác sĩ nhập chẩn đoán và kê đơn (mỗi thuốc hiện tồn kho), form xem trước hoá đơn. `POST /visits` ghi trong **một transaction**:
1. Ghi lượt khám.
2. Ghi đơn thuốc.
3. Với mỗi thuốc: `UPDATE medicines SET stock_quantity = stock_quantity - @qty WHERE … AND stock_quantity >= @qty` (kiểm tra và trừ trong một câu, nên không bị lost update), rồi ghi dòng đơn thuốc với giá tại thời điểm kê.
4. Ghi hoá đơn.
5. Đóng lịch hẹn.

Thiếu thuốc ở bất kỳ bước nào thì **không ghi gì cả**, kèm thông báo nêu tên thuốc. Chi tiết lượt khám lấy bằng **một câu join 10 bảng**. Thu ngân bấm *Thanh toán* trên hoá đơn.

### FR9: Sinh hiệu (Hình 4-4-fr9-vitals)

Thiết bị (trình giả lập trong app) gửi chỉ số. Mỗi lần đo được ghi bằng **logged batch** vào 3 bảng Cassandra: lịch sử theo (bệnh nhân, ngày), giá trị mới nhất (`USING TIMESTAMP` = thời điểm đo), cảnh báo theo ngày nếu vượt ngưỡng. Trang theo dõi nhận dữ liệu **trực tiếp qua Server-Sent Events**, vẽ biểu đồ nhịp tim/SpO₂/huyết áp, tô đỏ chỉ số bất thường và liệt kê cảnh báo trong ngày.

### Nhật ký truy cập (Hình 4-4-access-logs)

Middleware ghi mỗi request API (bất đồng bộ, không làm chậm request) vào bảng `access_logs_by_user_day` (partition theo người dùng + ngày, TTL 90 ngày). Quản trị xem nhật ký theo người dùng và ngày.

### *(Dương: FR1, FR2, FR5, FR7, FR8)*

## 4.5 Ma trận 8 loại truy vấn *(Dương)*

## 4.6 DB Lab: đưa nghiên cứu vào ứng dụng (Hình 4-6-lab-*)

Trang DB Lab (chỉ ADMIN) chạy các thí nghiệm của Section 3 **bằng chính code dùng cho script demo** (`server/src/modules/lab/`), trên một connection pool riêng để thiết lập phiên (isolation, lock timeout) không ảnh hưởng ứng dụng. Mỗi thời điểm chỉ chạy một thí nghiệm.

| Tab | Thí nghiệm |
|---|---|
| iv. Transaction | Quy trình khám 5 bước, chọn bước gây lỗi; so sánh SQL Server (ROLLBACK, dữ liệu trước = sau) với Cassandra (dở dang / batch) |
| v. Concurrency | Ma trận hiện tượng × mức cô lập; đặt trùng lịch N request theo 5 cách; tạo deadlock và xem khoá |
| vi. Backup & recovery | Backup full/diff/log, lịch sử msdb; point-in-time restore sau sự cố "UPDATE quên WHERE" |
| i–iii *(Dương)* | Lưu trữ, chỉ mục, kế hoạch thực thi |
