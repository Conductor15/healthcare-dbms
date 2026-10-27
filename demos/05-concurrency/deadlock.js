// T5-S5  Deadlock: T1 locks medicine 1 then wants 2, T2 locks 2 then wants 1.
// Same code as the DB Lab page: server/src/modules/lab/concurrency.lab.js
// Run: node demos/05-concurrency/deadlock.js
import '../_common/env.js';
import { deadlock } from '../../server/src/modules/lab/concurrency.lab.js';
import { closeLabPool } from '../../server/src/modules/lab/lab.db.js';
import { report } from '../_common/bench.js';

const r = await deadlock();
console.log('\nKhoá đang giữ sau bước 1 (mỗi T đã update 1 dòng):');
await report(r.locksHeld);
console.log('Khoá khi T1 chờ dòng 2 (status WAIT):');
await report(r.locksWaiting, 'demos/05-concurrency/results/deadlock_locks_waiting.csv');
console.log(`Deadlock bị phát hiện sau ${r.detectedAfterMs} ms. Victim: ${r.victim}`);
console.log(`Thông báo: ${r.message}`);
console.log('Sau khi victim thử lại, tồn kho (mỗi thuốc bị trừ 2 lần):');
await report(r.finalStock, 'demos/05-concurrency/results/deadlock_final_stock.csv');
await closeLabPool();
