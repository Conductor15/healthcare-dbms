# API contract (S1.5)

Base URL: `/api` · JSON · Header `Authorization: Bearer <token>` cho mọi endpoint trừ `/health`, `/auth/login`.

Lỗi luôn có dạng: `{ "error": "Thông báo tiếng Việt", "details": [ { "path": "fullName", "message": "..." } ] }`
Mã: `400` dữ liệu sai · `401` chưa đăng nhập · `403` sai quyền · `404` không thấy · `409` vi phạm ràng buộc / xung đột (double-booking, hết thuốc) · `500` lỗi server.

Danh sách có phân trang trả về: `{ "items": [...], "total": 1234, "page": 1, "pageSize": 20 }`.

Cột *Status*: ✅ đã có · ⬜ chưa làm.

## Hệ thống

| Method | Path | Mô tả | Quyền | Status |
|---|---|---|---|---|
| GET | `/health` | Trạng thái kết nối SQL Server + Cassandra | public | ✅ |
| POST | `/auth/login` | `{username, password}` → `{token, user}` | public | ✅ |
| GET | `/auth/me` | Thông tin user hiện tại | all | ✅ |

## Khoa phòng (module mẫu, S0.4)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/departments?q=` | d + g (đếm bác sĩ bằng subquery tương quan) | all | ✅ |
| GET | `/departments/:id` | d | all | ✅ |
| POST | `/departments` | a | ADMIN | ✅ |
| PUT | `/departments/:id` | c | ADMIN | ✅ |
| DELETE | `/departments/:id` | b (409 nếu còn bác sĩ) | ADMIN | ✅ |

## FR1 Bệnh nhân (Dương, S3.1) + FR5 Tìm kiếm (S3.5)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/patients?name=&page=&pageSize=` | d | all | ⬜ |
| GET | `/patients/search?name=&gender=&bloodType=&ageFrom=&ageTo=&departmentId=&doctorId=&visitedFrom=&visitedTo=` | e | all | ⬜ |
| GET | `/patients/:id` | d | all | ⬜ |
| POST | `/patients` | a | ADMIN, RECEPTIONIST | ⬜ |
| PUT | `/patients/:id` | c | ADMIN, RECEPTIONIST | ⬜ |
| DELETE | `/patients/:id` | b | ADMIN | ⬜ |

Body bệnh nhân: `{ fullName, dateOfBirth: "1990-05-20", gender: "M|F|O", phone, email, address, bloodType, medicalHistory }`

## FR2 Bác sĩ (Dương, S3.2)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/doctors?departmentId=&active=&q=` | e, f (join khoa) | all | ⬜ |
| GET/POST/PUT/DELETE | `/doctors[/:id]` | d, a, c, b | ADMIN | ⬜ |

## FR3 Lịch hẹn (Hoàng, S3.3)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/slots?doctorId=&date=` | e (slot trống) | all | ✅ |
| GET | `/appointments?date=&from=&to=&doctorId=&patientId=&status=&page=&pageSize=` | e, f (bác sĩ chỉ thấy lịch của mình) | all | ✅ |
| GET | `/appointments/:id` | d, f | all | ✅ |
| POST | `/appointments` `{patientId, slotId, reason}` | a, **transaction + UPDLOCK/HOLDLOCK**; 409 nếu slot đã đặt / bệnh nhân trùng giờ; 400 nếu slot đã qua | ADMIN, RECEPTIONIST | ✅ |
| PATCH | `/appointments/:id/cancel` | c (transaction: huỷ + trả slot) | ADMIN, RECEPTIONIST | ✅ |
| DELETE | `/appointments/:id` | b (chỉ lịch đã huỷ, ngược lại 409) | ADMIN | ✅ |

Tra cứu cho ô chọn (Hoàng):

| Method | Path | Mô tả | Status |
|---|---|---|---|
| GET | `/lookups/patients?q=` | 20 bệnh nhân khớp tên/SĐT | ✅ |
| GET | `/lookups/doctors?departmentId=` | Bác sĩ đang hoạt động + khoa + phí khám | ✅ |
| GET | `/lookups/users` | Danh sách tài khoản (ADMIN) | ✅ |

## FR4 Khám & kê đơn (Hoàng, S3.4) + FR6 Chi tiết (S3.6)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/medicines?q=` | d | all | ✅ |
| POST | `/visits` | a, c, **transaction**; 409 nếu thuốc không đủ (không ghi gì) | DOCTOR, ADMIN | ✅ |
| GET | `/visits?patientId=&doctorId=&from=&to=&page=&pageSize=` | e, f (bác sĩ chỉ thấy lượt khám của mình) | all | ✅ |
| GET | `/visits/:id` | **f** (1 câu join 10 bảng) | all | ✅ |
| PATCH | `/invoices/:id/pay` | c; 409 nếu đã thanh toán | ADMIN, RECEPTIONIST | ✅ |

Body `POST /visits`:
```json
{ "appointmentId": 12, "patientId": 3, "doctorId": 1,
  "symptoms": "Sốt, ho", "diagnosis": "Viêm họng cấp", "notes": "",
  "items": [ { "medicineId": 2, "quantity": 10, "dosage": "Sáng 1 viên, tối 1 viên" } ] }
```
Một transaction: insert `visits` → insert `prescriptions` + `prescription_items` → `UPDATE medicines SET stock_quantity -= …` (CHECK ≥ 0, hết thuốc thì ROLLBACK và trả 409) → insert `invoices` → `UPDATE appointments SET status='COMPLETED'`.

## FR7 Thống kê (Dương, S3.7) · FR8 Truy vấn nâng cao (S3.8)

| Method | Path | Query type | Status |
|---|---|---|---|
| GET | `/stats/summary` | h | ⬜ |
| GET | `/stats/visits-by-month?year=` | h | ⬜ |
| GET | `/stats/revenue-by-department?from=&to=` | h, f | ⬜ |
| GET | `/stats/top-medicines?limit=` | h | ⬜ |
| GET | `/insights/frequent-patients` | **g** | ⬜ |
| GET | `/insights/top-doctor-per-department` | g | ⬜ |
| GET | `/insights/never-prescribed-medicines` | g (`NOT EXISTS`) | ⬜ |
| GET | `/insights/inactive-patients?months=6` | g | ⬜ |

## FR9 Sinh hiệu (Hoàng, S3.9): Cassandra

| Method | Path | Mô tả | Status |
|---|---|---|---|
| POST | `/vitals` `{patientId, heartRate, systolicBp, diastolicBp, spo2, temperature, deviceId}` | Ghi Q1 + Q2 (+ Q3 nếu bất thường) bằng **logged batch** | ✅ |
| GET | `/vitals/:patientId?day=YYYY-MM-DD&limit=` | Q1 | ✅ |
| GET | `/vitals/latest?patientIds=1,2,3` | Q2 (`IN` trên partition key) | ✅ |
| GET | `/vitals/:patientId/stream?token=` | Server-Sent Events, đẩy bản ghi mới | ✅ |
| GET | `/vitals/alerts?day=` | Q3 | ✅ |
| GET · POST · DELETE | `/vitals/simulator` `{patientIds, intervalMs, durationSec}` | Trạng thái / bật / tắt trình giả lập thiết bị | ✅ |

## Nhật ký truy cập (Hoàng, S3.12): Cassandra

| Method | Path | Status |
|---|---|---|
| GET | `/access-logs?userId=&day=&limit=` (ADMIN) | ✅ |

## DB Lab (bonus, S3.10–11), chỉ ADMIN

| Method | Path | Topic | Owner | Status |
|---|---|---|---|---|
| GET | `/lab/storage` | i: dung lượng bảng/partition 2 DB | Dương | ⬜ |
| POST | `/lab/explain` `{scenario}` | ii, iii: execution plan + IO/time (có/không index) | Dương | ⬜ |
| POST | `/lab/transaction` `{dbms: mssql\|cassandra, failAt: 1-5, useBatch}` | iv: quy trình khám 5 bước, lỗi ở bước chọn → SQL Server ROLLBACK vs Cassandra dở dang | Hoàng | ✅ |
| GET | `/lab/concurrency/isolation-matrix` | v: 5 hiện tượng × 5 mức isolation (~16 s) | Hoàng | ✅ |
| POST | `/lab/concurrency/double-booking` `{mode, requests}` | v: mode `mssql-naive\|mssql-locked\|mssql-unique\|cassandra-naive\|cassandra-lwt` | Hoàng | ✅ |
| POST | `/lab/concurrency/deadlock` | v: tạo deadlock, xem khoá, victim, retry | Hoàng | ✅ |
| GET · POST | `/lab/backups` `{type: FULL\|DIFF\|LOG}` | vi: lịch sử backup (msdb), backup ngay | Hoàng | ✅ |
| POST | `/lab/backups/point-in-time-demo` | vi: sự cố UPDATE quên WHERE → restore bản sao STOPAT → sửa | Hoàng | ✅ |

Mỗi thời điểm chỉ chạy 1 thí nghiệm (409 nếu đang có thí nghiệm khác).
