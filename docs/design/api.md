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
| GET | `/slots?doctorId=&date=` | e (slot trống) | all | ⬜ |
| GET | `/appointments?date=&doctorId=&status=&page=` | e, f | all | ⬜ |
| POST | `/appointments` `{patientId, slotId, reason}` | a, **transaction + lock** | ADMIN, RECEPTIONIST | ⬜ |
| PATCH | `/appointments/:id/cancel` | c (transaction: huỷ + trả slot) | ADMIN, RECEPTIONIST | ⬜ |
| DELETE | `/appointments/:id` | b (chỉ lịch đã huỷ) | ADMIN | ⬜ |

## FR4 Khám & kê đơn (Hoàng, S3.4) + FR6 Chi tiết (S3.6)

| Method | Path | Query type | Quyền | Status |
|---|---|---|---|---|
| GET | `/medicines?q=` | d | all | ⬜ |
| POST | `/visits` | a, c, **transaction** | DOCTOR, ADMIN | ⬜ |
| GET | `/visits/:id` | **f** (join 8 bảng) | all | ⬜ |
| GET | `/patients/:id/visits` | f | all | ⬜ |
| PATCH | `/invoices/:id/pay` | c | ADMIN, RECEPTIONIST | ⬜ |

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
| POST | `/vitals` `{patientId, heartRate, systolicBp, diastolicBp, spo2, temperature, deviceId}` | Ghi Q1 + Q2 (+ Q3 nếu bất thường) | ⬜ |
| GET | `/vitals/:patientId?day=YYYY-MM-DD&limit=` | Q1 | ⬜ |
| GET | `/vitals/:patientId/latest` | Q2 | ⬜ |
| GET | `/vitals/:patientId/stream` | Server-Sent Events, đẩy bản ghi mới | ⬜ |
| GET | `/vitals/alerts?day=` | Q3 | ⬜ |
| POST | `/vitals/simulate` `{patientIds, seconds, ratePerSecond}` | Giả lập thiết bị | ⬜ |

## Nhật ký truy cập (Hoàng, S3.12): Cassandra

| Method | Path | Status |
|---|---|---|
| GET | `/access-logs?userId=&day=` (ADMIN) | ⬜ |

## DB Lab (bonus, S3.10–11), chỉ ADMIN

| Method | Path | Topic | Owner | Status |
|---|---|---|---|---|
| GET | `/lab/storage` | i: dung lượng bảng/partition 2 DB | Dương | ⬜ |
| POST | `/lab/explain` `{scenario}` | ii, iii: execution plan + IO/time (có/không index) | Dương | ⬜ |
| POST | `/lab/transaction` `{failAt}` | iv: chạy transaction đặt lịch, lỗi ở bước chọn → thấy ROLLBACK | Hoàng | ⬜ |
| POST | `/lab/double-booking` `{mode: naive\|locked\|lwt, requests: 50}` | v: N request đồng thời cùng 1 slot | Hoàng | ⬜ |
| POST | `/lab/backup` · GET `/lab/backups` · POST `/lab/restore` | vi: full/diff/log backup, point-in-time restore | Hoàng | ⬜ |
