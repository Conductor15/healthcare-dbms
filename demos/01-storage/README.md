# Topic i: Data storage & management

**Owner:** Dương · **Step:** T1 · **Status:** ⬜

## 1. Lý thuyết (T1.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Đơn vị lưu trữ | Page 8KB, extent 64KB; file `.mdf` (data), `.ldf` (log), filegroup | Commit log → memtable (RAM) → SSTable (bất biến trên đĩa) |
| Cấu trúc | B+ tree (clustered index = bảng), heap | LSM tree; partition → row → cell |
| Ghi / cập nhật | Cập nhật tại chỗ (in-place) trên page, ghi log trước (WAL) | Append-only; update = ghi bản mới; delete = **tombstone** |
| Dọn dẹp | Index rebuild/reorganize, shrink | Compaction (STCS / LCS / **TWCS**) |
| Phân tán | Partition bảng trên 1 máy (partition function/scheme) | Phân tán theo token của partition key trên ring, replication factor |
| Nén | Row / page compression, columnstore | Nén SSTable (LZ4 mặc định) |

References: (điền link tài liệu chính thức)

## 2. Kịch bản (T1.2)

| ID | Mục tiêu | SQL Server | Cassandra | Đo |
|---|---|---|---|---|
| S1 | Nhìn thấy cấu trúc lưu trữ vật lý | `sys.database_files`, `sys.dm_db_database_page_allocations`, `DBCC PAGE` trên bảng `patients` | `nodetool flush` → liệt kê `/var/lib/cassandra/data/healthcare/...`, `sstablemetadata`, `sstabledump` | Ảnh chụp cấu trúc |
| S2 | Ghi 1M bản ghi sinh hiệu | Bảng `vital_signs` rowstore → page compression → clustered columnstore | `vital_signs_by_patient_day` (LZ4) | Thời gian ghi, throughput (rows/s), dung lượng (`sp_spaceused` vs `nodetool tablestats`) |
| S3 | Phân vùng dữ liệu | Partition function theo tháng trên `visits`, `$PARTITION` | Partition key `(patient_id, day)`, `nodetool getendpoints` (cluster 3 node) | Phân bố rows/partition |
| S4 | Update/Delete và hệ quả lưu trữ | Update in-place, page split, fragmentation (`sys.dm_db_index_physical_stats`) | Update tạo version mới, delete tạo tombstone, đọc qua nhiều tombstone chậm, TTL, compaction | Dung lượng trước/sau, thời gian đọc |
| S5 | Compaction strategy cho time-series | — | STCS vs TWCS trên cùng dữ liệu sinh hiệu | Số SSTable, write amplification |

## 3. Kết quả (T1.3, T1.4)

## 4. So sánh & kết luận cho Healthcare (T1.5)
