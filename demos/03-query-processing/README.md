# Topic iii: Query processing

**Owner:** Dương · **Step:** T3 · **Status:** ⬜

## 1. Lý thuyết (T3.1)

| Khía cạnh | SQL Server | Cassandra |
|---|---|---|
| Các bước | Parse → Bind (algebrizer) → **Cost-based optimize** → Execution plan (cache) → Execute | Coordinator nhận query → tính token từ partition key → gửi tới replica theo consistency level → hợp nhất kết quả |
| Ngôn ngữ | T-SQL đầy đủ: join, subquery, CTE, window, aggregate | CQL hạn chế: không join, không subquery; aggregate chỉ hiệu quả trong 1 partition |
| Tối ưu | Statistics, cardinality estimation, join algorithms (nested loops / merge / hash), plan cache, parameter sniffing | Mô hình hoá theo truy vấn (query-first), prepared statement, token-aware routing |
| Quan sát | Estimated/actual plan, `STATISTICS IO/TIME`, `sys.dm_exec_query_stats`, Query Store | `TRACING ON`, `nodetool proxyhistograms` |

## 2. Kịch bản (T3.2)

| ID | Mục tiêu | SQL Server | Cassandra | Đo |
|---|---|---|---|---|
| S1 | Vòng đời 1 câu truy vấn | Query FR6 (join 8 bảng): estimated vs actual plan, giải thích từng operator | Query Q1 sinh hiệu: `TRACING ON`, đọc từng bước coordinator → replica → memtable/SSTable | Ảnh plan / trace có chú thích |
| S2 | 3 thuật toán join | Ép `OPTION (LOOP JOIN / MERGE JOIN / HASH JOIN)` trên `visits ⋈ patients` với dữ liệu nhỏ vs lớn | Join ở tầng ứng dụng (N+1 query) vs denormalize | Cost, thời gian |
| S3 | Statistics & ước lượng | Tắt auto-update stats, insert lệch phân bố → plan sai → `UPDATE STATISTICS` | — | Estimated vs actual rows |
| S4 | Viết lại truy vấn | Subquery (FR8) vs JOIN vs `EXISTS` vs CTE: cùng kết quả, plan khác? | — | Plan, thời gian |
| S5 | Plan cache & parameter sniffing | `sys.dm_exec_cached_plans`; procedure tìm lịch hẹn theo bác sĩ "đông" vs "vắng"; `OPTION (RECOMPILE)` | Prepared vs unprepared statement | Thời gian |
| S6 | 8 loại query của đề trên 2 DBMS | Chạy đủ a–h | Loại nào làm được trực tiếp, loại nào phải denormalize/làm ở app (f, g, h) | **Bảng khả năng** (nộp vào report) |
| S7 | Consistency level ảnh hưởng tốc độ đọc | — | Cluster 3 node: `CONSISTENCY ONE / QUORUM / ALL` | Latency p50/p95 |

## 3. Kết quả (T3.3, T3.4)

## 4. So sánh & kết luận cho Healthcare (T3.5)
