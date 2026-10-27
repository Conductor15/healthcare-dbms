# Topic vi: Data backup & recovery

**Owner:** Hoàng · **Step:** T6 · **Status:** 🟨 (T6.1–T6.5 xong, chờ review)

Môi trường: SQL Server 2022 (FULL recovery, Agent bật), Cassandra 5.0.9 (1 node; S6 dùng cluster 3 node), Docker Desktop / Windows 11.
Luồng point-in-time restore cũng có trong ứng dụng (DB Lab): [`server/src/modules/lab/backup.lab.js`](../../server/src/modules/lab/backup.lab.js).

> ⚠️ Các script ở đây cố tình gây "sự cố" (UPDATE quên WHERE, TRUNCATE, kill -9). Mỗi script SQL tách từng bước thành một batch, có `:on error exit` và có chốt chặn kiểm tra "đã có full backup vừa tạo" ngay trước bước phá dữ liệu. Bản trong app còn có thêm lưới an toàn: giữ giá gốc trong bộ nhớ và ghi lại nếu có bước nào lỗi.

## 1. Lý thuyết (T6.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Loại backup | Full, differential, transaction log, copy-only, file/filegroup | `nodetool snapshot` (hard link SSTable), incremental backup, commit log archiving |
| Recovery model | SIMPLE / FULL / BULK_LOGGED | — |
| Point-in-time | Có: `RESTORE LOG … WITH STOPAT` (FULL recovery) | Không có sẵn; cần commit log archiving + replay |
| Crash recovery | ARIES: Analysis → **Redo** → **Undo** từ transaction log | **Commit log replay** vào memtable khi khởi động |
| Tính sẵn sàng | Always On AG, log shipping (ngoài phạm vi) | Replication RF=N, hinted handoff, read repair, `nodetool repair` |
| Phạm vi một bản backup | Cả database, nhất quán tại 1 thời điểm | Từng node, từng bảng; phải snapshot **mọi node** |

## 2. Kịch bản & kết quả (T6.2–T6.4)

| ID | Mục tiêu | Script | Kết quả thực tế |
|---|---|---|---|
| S1 | Recovery model & log | [mssql/01_recovery_model_log.sql](mssql/01_recovery_model_log.sql) | Sau 20 000 insert/update + CHECKPOINT: `log_reuse_wait = LOG_BACKUP`, log dùng **28.5 MB (39.6%)** vì FULL giữ log chờ backup. Sau `BACKUP LOG`: còn 12.6 MB, `NOTHING` |
| S2 | Chuỗi FULL → DIFF → LOG | [mssql/02_backup_chain.sql](mssql/02_backup_chain.sql) | 3 file đều `RESTORE VERIFYONLY … WITH CHECKSUM` → *valid*. msdb cho thấy LSN nối tiếp; DIFF và LOG cùng `based_on_full_lsn`. Nén: full 26.1 MB → **1.06 MB** |
| S3 | **Point-in-time restore** sau `UPDATE` quên `WHERE` | [mssql/03_point_in_time.sql](mssql/03_point_in_time.sql) | Restore bản sao `HealthcareDB_PITR` với `STOPAT` = 1 giây trước sự cố, sửa lại **15 dòng** từ bản sao. Thay đổi hợp lệ sau full backup (Paracetamol 1500 → 1650) **được giữ**. DB chính không phải dừng. Trong app: toàn bộ luồng mất ~1.4 s |
| S4 | **Crash recovery** (kill -9) | [crash_recovery.js](crash_recovery.js) | Bảng S4 |
| S5 | Snapshot + incremental backup Cassandra | [snapshot_restore.js](snapshot_restore.js) | Bảng S5 |
| S6 | Replication ≠ backup (3 node) | [replication_vs_backup.js](replication_vs_backup.js) | Bảng S6 |
| S7 | Lịch backup tự động | [mssql/04_agent_jobs.sql](mssql/04_agent_jobs.sql) | 3 job Agent: full hằng tuần (CN 01:00), diff hằng ngày (01:00), log mỗi 15 phút; chạy thử job log → *Succeeded* |

### S4: kill -9 giữa lúc đang làm việc

| DBMS | Trạng thái trước crash | Sau khởi động lại |
|---|---|---|
| SQL Server | Transaction chưa commit đặt `qty = 0` cho 5000 dòng, **đã bị CHECKPOINT ghi xuống file dữ liệu**; 1 INSERT đã commit nhưng **chỉ nằm trong log** | `qty = 100` (**UNDO**), dòng "committed after checkpoint" còn (**REDO**). Errorlog: *"2 transactions rolled forward… 1 transactions rolled back in database 'HealthcareDB'"* |
| Cassandra | 500 dòng đã ack, **0 SSTable** trên đĩa (chỉ ở memtable + commit log) | `COUNT(*) = 500`. Log: *"Replaying …/CommitLog-7-….log"*, *"Log replay complete, 662 replayed mutations"* |

> Commit log Cassandra mặc định `periodic` 10 s: kill tiến trình không mất dữ liệu (OS vẫn giữ page cache), nhưng **mất điện cả máy** có thể mất tới ~10 s ghi gần nhất. Muốn tránh thì dùng `commitlog_sync: batch`/`group`, chậm hơn. SQL Server flush log trước khi COMMIT trả về nên không có khoảng hở này.

### S5: Cassandra snapshot + incremental backup

| Bước | Kết quả |
|---|---|
| 100 bản ghi, flush, `nodetool snapshot -t daily` | Tức thì (hard link, không copy), 1 SSTable |
| Bật `enablebackup`, ghi thêm 20 bản ghi, flush | 120 dòng; `backups/` có 1 SSTable mới |
| Sự cố: `TRUNCATE` | 0 dòng; `auto_snapshot` tự tạo `truncated-…` |
| `nodetool import --copy-data` từ snapshot `daily` | **100 dòng**: mất 20 bản ghi sau snapshot (RPO = khoảng cách 2 lần snapshot) |
| Import thêm từ `backups/` | **120 dòng** |

### S6: Replication không phải là backup (3 node, RF = 3)

| Bước | Kết quả |
|---|---|
| 3 hồ sơ dị ứng, ghi CL ALL | 3 dòng |
| Node 2 chết → đọc QUORUM | 3 dòng: **high availability** |
| `TRUNCATE` khi node 2 chết | Bị từ chối: TRUNCATE cần **tất cả** replica sống |
| `nodetool snapshot` trên từng node, rồi lỡ `TRUNCATE` | **0 dòng trên cả 3 node**: replication nhân bản luôn cả lỗi |
| `nodetool import` từ snapshot trên từng node | 3 dòng |

## 3. So sánh & kết luận cho Healthcare (T6.5)

| Tiêu chí | SQL Server | Cassandra |
|---|---|---|
| RPO khi lỗi người dùng (xoá/sửa nhầm) | ✅ ~0: point-in-time tới từng giây (S3) | ⚠️ = khoảng cách snapshot; incremental backup thu hẹp nhưng không tới từng giây |
| RTO | Restore bản sao ~1 s với DB nhỏ; tăng theo kích thước | Import SSTable nhanh nhưng phải làm **trên từng node** |
| Crash recovery | ✅ Redo/Undo tự động, không mất transaction đã commit | ✅ Commit log replay; rủi ro ~10 s khi mất điện cả máy (periodic sync) |
| Tính sẵn sàng khi mất máy | Cần thêm Always On | ✅ Có sẵn qua replication |
| Kiểm tra toàn vẹn backup | ✅ CHECKSUM + `RESTORE VERIFYONLY` | ⚠️ tự viết script |

**Kết luận:**
- Hồ sơ bệnh án, đơn thuốc, hoá đơn là dữ liệu pháp lý, mất dữ liệu đã commit hoặc sửa nhầm là không chấp nhận được. **SQL Server** với FULL recovery, log backup 15 phút và point-in-time restore đáp ứng RPO ≈ 0.
- Dữ liệu sinh hiệu trên **Cassandra** chủ yếu cần *luôn ghi được* (replication, HA), và chấp nhận mất vài giây khi có sự cố nghiêm trọng. Snapshot hằng ngày kèm incremental backup là đủ.
- Thí nghiệm cũng nhắc lại: **replication không thay thế backup**.

## 4. Tham khảo

1. Microsoft Learn, "Back up and restore of SQL Server databases", "Restore a SQL Server database to a point in time (full recovery model)", "Recovery models", "Database checkpoints".
2. C. Mohan et al., "ARIES: A Transaction Recovery Method…", ACM TODS 17(1), 1992.
3. Apache Cassandra Documentation 5.0, "Backups (snapshots, incremental backups)", "nodetool import", "Commit log".
