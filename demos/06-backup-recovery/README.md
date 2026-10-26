# Topic vi: Data backup & recovery

**Owner:** Hoàng · **Step:** T6 · **Status:** ⬜

## 1. Lý thuyết (T6.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Loại backup | Full, differential, transaction log, copy-only, file/filegroup | `nodetool snapshot` (hard link SSTable), incremental backup, commit log archiving |
| Recovery model | SIMPLE / FULL / BULK_LOGGED | — |
| Point-in-time | Có (`RESTORE LOG … WITH STOPAT`) khi ở FULL | Không có sẵn, cần commit log archiving + replay |
| Crash recovery | ARIES: Analysis → Redo → Undo từ transaction log | Commit log replay vào memtable khi khởi động |
| Tính sẵn sàng | Always On AG, log shipping (ngoài phạm vi) | Replication RF=N, hinted handoff, read repair, `nodetool repair` |
| Đơn vị | Cả database | Từng node, từng bảng: phải snapshot **mọi node** |

## 2. Kịch bản (T6.2)

| ID | Mục tiêu | SQL Server | Cassandra | Đo / Kỳ vọng |
|---|---|---|---|---|
| S1 | Recovery models | So sánh kích thước log & khả năng restore ở SIMPLE vs FULL | — | Bảng so sánh |
| S2 | Chuỗi backup | Full (CN) → Differential (hằng ngày) → Log (mỗi 15 phút) với `CHECKSUM`, `COMPRESSION`; `RESTORE VERIFYONLY`; xem `msdb.dbo.backupset` | Snapshot mỗi node + bật `incremental_backups` | Dung lượng, thời gian |
| S3 | **Point-in-time restore** | Lễ tân lỡ `DELETE FROM appointments` lúc T → tail-log backup → restore full + diff + log `STOPAT = T - 1s` | Restore từ snapshot gần nhất → mất dữ liệu sau snapshot | SQL Server: RPO ≈ 0. Cassandra: RPO = khoảng cách snapshot |
| S4 | Crash recovery | Transaction lớn chưa commit + `docker kill` → khởi động → errorlog cho thấy redo/undo, dữ liệu chưa commit biến mất | Ghi nhiều rồi `docker kill` trước flush → commit log replay | Thời gian recovery |
| S5 | Restore Cassandra từ snapshot | — | Xoá bảng → copy SSTable từ snapshot → `nodetool refresh` (hoặc `sstableloader`) | Dữ liệu trở lại |
| S6 | Replication ≠ backup | — | Cluster 3 node, RF=3: mất 1 node vẫn phục vụ; nhưng `TRUNCATE` nhầm thì lan ra cả 3 replica | Hiểu khác biệt HA vs backup |
| S7 | Lịch backup tự động | SQL Server Agent job (container đã bật Agent) | cron + `nodetool snapshot` (script) | Script |

S2/S3 sẽ đưa vào app ở DB Lab (S3.11): `POST /api/lab/backup`, `POST /api/lab/restore`.

Lấy file backup ra máy (không commit vào git): `docker cp hc-mssql:/var/opt/mssql/backup ./backups`

## 3. Kết quả (T6.3, T6.4)

## 4. So sánh & kết luận cho Healthcare (T6.5)

Gợi ý tiêu chí: RPO/RTO yêu cầu cho hồ sơ bệnh án (pháp lý, không được mất) so với dữ liệu sinh hiệu (chấp nhận mất vài giây).
