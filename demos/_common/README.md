# Bench harness dùng chung (S1.6, Hoàng, ⬜)

Mục tiêu: 6 topic đo theo **cùng một cách** để số liệu so sánh được.

Dự kiến API:

```js
import { benchMssql, benchCassandra, writeCsv } from '../_common/bench.js';

const a = await benchMssql('FR5 search, no index', SQL, params, { runs: 20, warmup: 3 });
const b = await benchCassandra('Q1 vitals by patient-day', CQL, params, { runs: 20, warmup: 3 });
await writeCsv('demos/02-indexing/results/s1.csv', [a, b]); // name, runs, min, avg, p50, p95, max (ms)
```
