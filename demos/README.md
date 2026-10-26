# Demo 6 topic: SQL Server vs Cassandra

| # | Topic | Owner | Thư mục | Status |
|---|---|---|---|---|
| i | Data storage & management | Dương | [01-storage](01-storage/) | ⬜ |
| ii | Indexing *(topic chính của Dương)* | Dương | [02-indexing](02-indexing/) | ⬜ |
| iii | Query processing | Dương | [03-query-processing](03-query-processing/) | ⬜ |
| iv | Transaction *(topic chính của Hoàng)* | Hoàng | [04-transaction](04-transaction/) | 🟨 |
| v | Concurrency control | Hoàng | [05-concurrency](05-concurrency/) | ⬜ |
| vi | Data backup & recovery | Hoàng | [06-backup-recovery](06-backup-recovery/) | ⬜ |

## Cấu trúc mỗi topic

```
0X-<topic>/
├── README.md        ← lý thuyết, kịch bản, kết quả, so sánh, kết luận (nguồn cho report)
├── mssql/           ← NN_<kịch-bản>.sql   (chạy được lại từ đầu, có comment từng bước)
├── cassandra/       ← NN_<kịch-bản>.cql / .sh
└── results/         ← ảnh chụp, CSV số đo, execution plan (.sqlplan/.png)
```

## Quy tắc để demo "đúng" (tiêu chí 30%)

1. **Cùng một bài toán Healthcare trên cả 2 DBMS**, cùng dữ liệu (từ S1.4), cùng cách đo (S1.6).
2. Mỗi kịch bản có **kỳ vọng** viết trước và **kết quả thực** sau khi chạy; lệch thì giải thích.
3. Script phải **idempotent**: chạy lại từ đầu không lỗi (dọn dẹp ở đầu script).
4. Số đo chạy ≥ 5 lần, báo cáo trung bình / p95, ghi cấu hình máy.
5. Kết luận bám bối cảnh: *"Với dữ liệu X trong phòng khám, chọn DBMS Y vì…"*.

## Chạy script

```bash
# SQL Server: dùng SSMS / Azure Data Studio / VS Code mssql extension, kết nối 127.0.0.1,1433, user sa
# hoặc sqlcmd trong container (-I bật QUOTED_IDENTIFIER, cần cho filtered index):
docker exec -i hc-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Healthcare@2026" -C -I -d HealthcareDB < demos/04-transaction/mssql/01_atomicity.sql

# Cassandra
docker exec -i hc-cassandra cqlsh < demos/02-indexing/cassandra/01_secondary_index.cql
docker exec -it hc-cassandra nodetool tablestats healthcare
```
