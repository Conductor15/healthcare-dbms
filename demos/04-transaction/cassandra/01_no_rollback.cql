-- =====================================================================
-- T4-S1 (Cassandra)  Same "khám bệnh" workflow, no multi-table transaction
-- The app writes 3 tables with 3 separate statements and crashes after
-- statement 1. There is no BEGIN TRANSACTION / ROLLBACK in CQL, so the
-- partial write stays. Run: node demos/run.js demos/04-transaction/cassandra/01_no_rollback.cql
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
CREATE TABLE IF NOT EXISTS tx_demo.visits_by_patient (patient_id int, visit_id int, diagnosis text, PRIMARY KEY (patient_id, visit_id));
CREATE TABLE IF NOT EXISTS tx_demo.medicine_stock (medicine_id int PRIMARY KEY, name text, stock int);
CREATE TABLE IF NOT EXISTS tx_demo.invoices_by_visit (visit_id int PRIMARY KEY, patient_id int, total int);
TRUNCATE tx_demo.visits_by_patient;
TRUNCATE tx_demo.medicine_stock;
TRUNCATE tx_demo.invoices_by_visit;
INSERT INTO tx_demo.medicine_stock (medicine_id, name, stock) VALUES (9, 'Salbutamol', 60);

-- Statement 1: applied immediately and durably
INSERT INTO tx_demo.visits_by_patient (patient_id, visit_id, diagnosis) VALUES (7, 1001, 'Hen phe quan cap');
-- Statement 2: the app reads stock = 60 < 1000 requested, throws, never sends statements 2-3
--   UPDATE tx_demo.medicine_stock SET stock = ... ;
--   INSERT INTO tx_demo.invoices_by_visit ... ;

-- Try to undo statement 1: CQL has no ROLLBACK (Cassandra 5.0 → syntax error)
ROLLBACK;

-- Result: an orphan visit with no invoice, nothing to roll back
SELECT * FROM tx_demo.visits_by_patient;
SELECT * FROM tx_demo.medicine_stock;
SELECT * FROM tx_demo.invoices_by_visit;
