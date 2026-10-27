# 3.6 Data backup and recovery

> Bản nháp (Hoàng, T6.6). Số liệu, script và output: `demos/06-backup-recovery/`. Point-in-time restore chạy được trong ứng dụng (DB Lab → vi).

## 3.6.1 Cơ sở lý thuyết

Cần phân biệt ba loại sự cố: **sập tiến trình/máy** (crash), **lỗi người dùng** (xoá/sửa nhầm) và **mất máy chủ**.

**SQL Server** khôi phục sau crash bằng thuật toán họ ARIES gồm ba pha trên transaction log: *Analysis*, *Redo* (làm lại các thay đổi đã commit nhưng chưa nằm trong file dữ liệu), *Undo* (huỷ thay đổi của transaction chưa commit dù đã bị ghi xuống đĩa). Sao lưu gồm full, differential, transaction log. Ở *FULL recovery model*, log được giữ tới khi được sao lưu, nhờ đó có thể khôi phục **tới một thời điểm bất kỳ** (`RESTORE LOG … WITH STOPAT`). `CHECKSUM` và `RESTORE VERIFYONLY` kiểm tra tính toàn vẹn của bản sao lưu.

**Cassandra** khôi phục sau crash bằng cách *replay commit log* vào memtable. Commit log mặc định đồng bộ định kỳ 10 s (`periodic`). Sao lưu là `nodetool snapshot`: hard link tới các SSTable bất biến nên tức thì. *Incremental backup* hard link thêm mọi SSTable mới được flush. Mọi thao tác thực hiện **trên từng node**. Replication (RF = N) mang lại tính sẵn sàng, nhưng không thay thế sao lưu.

## 3.6.2 Kết quả

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | FULL recovery, 20 000 insert/update + CHECKPOINT | `log_reuse_wait = LOG_BACKUP`, log dùng 28.5 MB (39.6%) và **không giải phóng** cho tới khi `BACKUP LOG` (còn 12.6 MB) |
| 2 | Chuỗi FULL → DIFF → LOG | 3 file đều *valid* qua `RESTORE VERIFYONLY … WITH CHECKSUM`; LSN nối tiếp; DIFF và LOG cùng `based_on_full_lsn`; nén 26.1 MB → 1.06 MB |
| 3 | **Point-in-time** sau `UPDATE medicines SET unit_price = 0` (quên WHERE) | Restore **bản sao** `HealthcareDB_PITR` từ full + log với `STOPAT` = 1 s trước sự cố, sửa 15 dòng từ bản sao; thay đổi hợp lệ sau full backup được giữ; DB chính không phải dừng. Trong app: ~1.4 s |
| 4 | kill -9 SQL Server | UPDATE chưa commit (đã bị CHECKPOINT ghi xuống đĩa) → **UNDO**; INSERT đã commit chỉ có trong log → **REDO**. Errorlog: *"2 transactions rolled forward … 1 transactions rolled back"* |
| 5 | kill -9 Cassandra | 500 dòng đã ack, **0 SSTable**; sau restart đủ 500 dòng: *"Log replay complete, 662 replayed mutations"* |
| 6 | Snapshot + incremental, rồi TRUNCATE | Import từ snapshot: 100/120 dòng (mất phần sau snapshot); import thêm incremental: 120/120. `auto_snapshot` cũng tự chụp trước TRUNCATE |
| 7 | Replication ≠ backup (3 node, RF = 3) | Mất 1 node vẫn đọc QUORUM được (HA); TRUNCATE bị từ chối khi thiếu node; TRUNCATE khi đủ node xoá **trên cả 3 bản sao**; chỉ snapshot từng node cứu được |
| 8 | Lịch tự động | SQL Server Agent: full hằng tuần, differential hằng ngày, log mỗi 15 phút |

## 3.6.3 So sánh

| Tiêu chí | SQL Server | Cassandra |
|---|---|---|
| RPO khi lỗi người dùng | ≈ 0 (point-in-time tới từng giây) | = khoảng cách snapshot (incremental thu hẹp) |
| Crash recovery | Redo/Undo tự động, không mất transaction đã commit | Replay commit log; có thể mất ~10 s khi **mất điện cả máy** (periodic sync) |
| Mất máy chủ | Cần thêm Always On / log shipping | Có sẵn qua replication |
| Phạm vi một bản sao lưu | Toàn DB, nhất quán tại một thời điểm | Từng node, từng bảng |
| Kiểm tra toàn vẹn | CHECKSUM, VERIFYONLY có sẵn | Phải tự làm |

## 3.6.4 Kết luận cho bối cảnh phòng khám

- Hồ sơ bệnh án, đơn thuốc, hoá đơn yêu cầu RPO ≈ 0 với cả crash lẫn lỗi người dùng, nên dùng SQL Server ở FULL recovery, log backup 15 phút và quy trình restore bản sao rồi sửa (kịch bản 3).
- Sinh hiệu trên Cassandra cần *luôn ghi được* hơn là khôi phục tới từng giây, nên dùng replication cho HA cùng snapshot hằng ngày và incremental backup.
- Bài học thực tế từ dự án: một script demo từng chạy tiếp sau khi BACKUP lỗi và làm hỏng giá thuốc. Nhóm đã bổ sung "dừng ở lỗi đầu tiên" và chốt chặn "phải có full backup mới" trước mọi bước nguy hiểm, và trong ứng dụng thêm cơ chế tự khôi phục nếu một bước bất kỳ lỗi.
