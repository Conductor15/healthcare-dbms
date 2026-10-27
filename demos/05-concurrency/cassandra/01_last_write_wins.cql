-- =====================================================================
-- T5-S6 (Cassandra)  No locks: every cell carries a write timestamp, the
-- highest timestamp wins ("last write wins"), regardless of arrival order.
-- Run: node demos/run.js demos/05-concurrency/cassandra/01_last_write_wins.cql
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS cc_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
CREATE TABLE IF NOT EXISTS cc_demo.latest_vitals (patient_id int PRIMARY KEY, heart_rate int, source text, note text);
TRUNCATE cc_demo.latest_vitals;

-- 1. Device B measured at t=3 and arrives first; device A measured at t=5 but its packet arrives later
INSERT INTO cc_demo.latest_vitals (patient_id, heart_rate, source) VALUES (1, 80, 'device B, measured t=3') USING TIMESTAMP 3000000;
INSERT INTO cc_demo.latest_vitals (patient_id, heart_rate, source) VALUES (1, 120, 'device A, measured t=5') USING TIMESTAMP 5000000;
SELECT patient_id, heart_rate, source, WRITETIME(heart_rate) AS ts FROM cc_demo.latest_vitals WHERE patient_id = 1;

-- 2. A retry of an OLD reading (t=1) arrives last: silently ignored, no error, no conflict reported
INSERT INTO cc_demo.latest_vitals (patient_id, heart_rate, source) VALUES (1, 60, 'stale retry, measured t=1') USING TIMESTAMP 1000000;
SELECT patient_id, heart_rate, source, WRITETIME(heart_rate) AS ts FROM cc_demo.latest_vitals WHERE patient_id = 1;

-- 3. Resolution is per CELL, not per row: two clients update different columns, both survive
UPDATE cc_demo.latest_vitals USING TIMESTAMP 7000000 SET heart_rate = 95 WHERE patient_id = 1;
UPDATE cc_demo.latest_vitals USING TIMESTAMP 6000000 SET note = 'nurse: patient resting' WHERE patient_id = 1;
SELECT patient_id, heart_rate, source, note, WRITETIME(heart_rate) AS hr_ts, WRITETIME(note) AS note_ts FROM cc_demo.latest_vitals WHERE patient_id = 1;

-- 4. Same timestamp tie: the larger VALUE wins (deterministic, but arbitrary for the business)
INSERT INTO cc_demo.latest_vitals (patient_id, heart_rate) VALUES (2, 70) USING TIMESTAMP 9000000;
INSERT INTO cc_demo.latest_vitals (patient_id, heart_rate) VALUES (2, 65) USING TIMESTAMP 9000000;
SELECT patient_id, heart_rate FROM cc_demo.latest_vitals WHERE patient_id = 2;
