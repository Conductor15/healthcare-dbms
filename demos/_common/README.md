# Bench harness dùng chung (S1.6, Hoàng)

Mục tiêu: 6 topic đo theo **cùng một cách** để số liệu so sánh được và đưa thẳng vào report.

Chạy thử: `node demos/_common/example.js` (cần `npm run db:up` + `npm run db:init` trước).

## API

| Hàm | Dùng cho | Trả về |
|---|---|---|
| `benchMssql(name, query, params, { runs, warmup, cold })` | Đo latency 1 câu T-SQL. Tự bật `SET STATISTICS IO` và cộng **logical reads** | `{ db, name, runs, min, avg, p50, p95, max, rows, logicalReads }` (ms) |
| `benchCassandra(name, cql, params, { runs, warmup, consistency })` | Đo latency 1 câu CQL (prepared) | `{ db, name, runs, min, avg, p50, p95, max, rows }` |
| `throughput(db, name, total, task, { concurrency })` | Chạy `task(i)` `total` lần, tối đa `concurrency` song song: bulk insert, double-booking… | `{ total, ok, failed, errors, seconds, opsPerSec }`; `errors` gom theo mã lỗi, ví dụ `{"SQL 2627": 29}` |
| `execMssqlFile(path)` | Chạy file `.sql` setup của demo (tách theo `GO`) | — |
| `report(results, csvPath?)` | In bảng ra console, ghi CSV vào `results/` | — |
| `mssql()`, `cql()`, `close()` | Lấy pool/client dùng chung, đóng kết nối cuối script | |

- `params` SQL Server: `{ q: 'abc' }` (tự suy kiểu) hoặc `{ q: [sql.NVarChar(100), 'abc'] }` (kiểu tường minh, nên dùng khi so sánh plan).
- `cold: true` chạy `CHECKPOINT; DBCC DROPCLEANBUFFERS` trước mỗi lần đo, tức đo cả đọc đĩa. Mặc định là *warm cache*.

## Mẫu một script demo

```js
// demos/02-indexing/bench_s1_phone.js  → node demos/02-indexing/bench_s1_phone.js
import { benchMssql, close, execMssqlFile, mssql, report, sql } from '../_common/bench.js';

const q = 'SELECT patient_id, full_name FROM dbo.patients WHERE phone = @phone';
const params = { phone: [sql.VarChar(15), '0912000005'] };
const pool = await mssql();

await pool.request().query('DROP INDEX IF EXISTS IX_patients_phone ON dbo.patients');
const before = await benchMssql('S1 phone: no index', q, params, { runs: 20 });

await pool.request().query('CREATE INDEX IX_patients_phone ON dbo.patients(phone)');
const after = await benchMssql('S1 phone: nonclustered index', q, params, { runs: 20 });

await report([before, after], 'demos/02-indexing/results/s1_phone.csv');
await close();
```

## Quy ước khi báo cáo số liệu

- Mặc định `runs: 20, warmup: 2`; báo cáo **p50 và p95**, không chỉ avg.
- Ghi cấu hình máy (CPU, RAM cấp cho Docker) và scale dữ liệu vào README của topic.
- Thời gian đo ở phía client nên **bao gồm round-trip mạng** (localhost), như nhau cho cả 2 DBMS.
- File CSV commit vào `demos/<topic>/results/`; biểu đồ vẽ từ CSV.
