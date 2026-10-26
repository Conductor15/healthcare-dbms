# Topic ii: Indexing

**Owner:** Dương · **Step:** T2 · **Status:** ⬜ · **Topic chính (bắt buộc)**

## 1. Lý thuyết (T2.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Index chính | Clustered index (B+ tree, lá chứa dữ liệu) | Primary key = partition key (hash → token) + clustering columns (sắp xếp trong partition) |
| Index phụ | Nonclustered, composite, covering (`INCLUDE`), filtered, columnstore, unique | Secondary index (2i, cục bộ từng node), **SAI** (Storage-Attached Index, 5.0), materialized view |
| Truy vấn ngoài khoá | Optimizer tự chọn scan/seek | Bị từ chối, trừ khi có index hoặc `ALLOW FILTERING` (quét toàn cụm) |
| Chi phí | Chậm ghi, tốn dung lượng | 2i: truy vấn đi tới mọi node; MV: ghi chậm, có thể lệch |

## 2. Kịch bản (T2.2)

Dữ liệu: scale=1 từ S1.4 (100k bệnh nhân, ~300k lượt khám). Đo bằng `SET STATISTICS IO, TIME ON` + actual execution plan.

| ID | Mục tiêu | SQL Server | Cassandra | Đo |
|---|---|---|---|---|
| S1 | Không index vs có index | Tìm bệnh nhân theo `phone`: table scan → thêm nonclustered → index seek | Query theo `phone` trên bảng không có khoá đó → lỗi / `ALLOW FILTERING` | Logical reads, CPU/elapsed time, plan |
| S2 | Composite + covering index cho FR5 | `(gender, blood_type, date_of_birth) INCLUDE (full_name, phone)`; thứ tự cột ảnh hưởng ra sao | Thiết kế bảng `patients_by_blood_type` (denormalize) | Seek vs scan, key lookup biến mất |
| S3 | Index cho join | FK `visits.patient_id`, `visits.doctor_id` chưa có index → FR6/FR7 chậm → thêm index | Không có join → bảng theo truy vấn | Plan: hash join → nested loop + seek |
| S4 | Filtered & columnstore | `UX_appointments_active_slot` (filtered); nonclustered columnstore cho thống kê FR7 | — | Kích thước index, thời gian aggregate |
| S5 | Chi phí index khi ghi | Insert 100k dòng với 0 / 3 / 6 index | Ghi khi có 2i / SAI / MV | Throughput ghi |
| S6 | Các loại index của Cassandra | — | Cùng truy vấn "sinh hiệu có SpO₂ < 90": 2i vs SAI vs MV vs bảng riêng `vital_alerts_by_day`; `TRACING ON` | Latency, số node bị hỏi |

## 3. Kết quả (T2.3, T2.4)

## 4. So sánh & kết luận cho Healthcare (T2.5)
