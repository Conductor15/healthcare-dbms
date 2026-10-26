-- =====================================================================
-- T4-S4 (Cassandra)  BATCH: the closest thing to a multi-table transaction
-- LOGGED batch (default): mutations are first written to the batchlog,
-- so they are eventually ALL applied (atomic), but other clients may see
-- them half-applied meanwhile (NO isolation) and there is no ROLLBACK.
-- Run: node demos/run.js demos/04-transaction/cassandra/02_batch.cql
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
CREATE TABLE IF NOT EXISTS tx_demo.visits_by_patient (patient_id int, visit_id int, diagnosis text, PRIMARY KEY (patient_id, visit_id));
CREATE TABLE IF NOT EXISTS tx_demo.medicine_stock (medicine_id int PRIMARY KEY, name text, stock int);
CREATE TABLE IF NOT EXISTS tx_demo.invoices_by_visit (visit_id int PRIMARY KEY, patient_id int, total int);
TRUNCATE tx_demo.visits_by_patient;
TRUNCATE tx_demo.medicine_stock;
TRUNCATE tx_demo.invoices_by_visit;
INSERT INTO tx_demo.medicine_stock (medicine_id, name, stock) VALUES (1, 'Paracetamol', 5000);

-- 1. Logged batch across 3 tables / 3 partitions: all-or-nothing
BEGIN BATCH
  INSERT INTO tx_demo.visits_by_patient (patient_id, visit_id, diagnosis) VALUES (4, 2001, 'Viem hong cap');
  UPDATE tx_demo.medicine_stock SET stock = 4990 WHERE medicine_id = 1;
  INSERT INTO tx_demo.invoices_by_visit (visit_id, patient_id, total) VALUES (2001, 4, 215000);
APPLY BATCH;
SELECT * FROM tx_demo.visits_by_patient;
SELECT * FROM tx_demo.medicine_stock;
SELECT * FROM tx_demo.invoices_by_visit;

-- 2. Note "stock = 4990": the app had to READ 5000 first. CQL cannot do stock = stock - 10
--    on a normal column (only on counter columns), so read-then-write races are possible (see LWT).
UPDATE tx_demo.medicine_stock SET stock = stock - 10 WHERE medicine_id = 1;

-- 3. A batch containing one invalid statement is rejected as a whole (validated before applying)
BEGIN BATCH
  INSERT INTO tx_demo.visits_by_patient (patient_id, visit_id, diagnosis) VALUES (4, 2002, 'Tai kham');
  INSERT INTO tx_demo.invoices_by_visit (visit_id, patient_id, total) VALUES (2002, 4, 'not-a-number');
APPLY BATCH;
SELECT * FROM tx_demo.visits_by_patient WHERE patient_id = 4;

-- 4. But there is no way to say "undo the batch if MY business rule fails" (e.g. stock < 0):
--    no conditions across partitions. Conditional (LWT) batches must target ONE partition:
BEGIN BATCH
  UPDATE tx_demo.medicine_stock SET stock = 4980 WHERE medicine_id = 1 IF stock = 4990;
  INSERT INTO tx_demo.invoices_by_visit (visit_id, patient_id, total) VALUES (2003, 4, 15000);
APPLY BATCH;
