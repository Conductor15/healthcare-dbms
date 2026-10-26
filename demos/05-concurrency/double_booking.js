// T5-S3  50 patients try to book the SAME appointment slot at the same moment.
// Same code as the DB Lab page: server/src/modules/lab/concurrency.lab.js
// Run: node demos/05-concurrency/double_booking.js [requests]
import '../_common/env.js';
import { closeCassandra } from '../../server/src/db/cassandra.js';
import { bookingModes, doubleBooking } from '../../server/src/modules/lab/concurrency.lab.js';
import { closeLabPool } from '../../server/src/modules/lab/lab.db.js';
import { report } from '../_common/bench.js';

const requests = Number(process.argv[2] ?? 50);
const results = [];
for (const mode of bookingModes) {
  const r = await doubleBooking(mode, requests);
  results.push({ ...r, errors: JSON.stringify(r.errors) });
}
await report(results, 'demos/05-concurrency/results/double_booking.csv');
await Promise.all([closeLabPool(), closeCassandra()]);
