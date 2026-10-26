-- =====================================================================
-- T4-S6 (Cassandra)  Lightweight transactions (LWT, Paxos)
-- Compare-and-set on ONE partition: linearizable, but ~4 round trips.
-- This is how Cassandra does "trừ tồn kho chỉ khi còn đủ".
-- Run: node demos/run.js demos/04-transaction/cassandra/03_lwt.cql
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
CREATE TABLE IF NOT EXISTS tx_demo.medicine_stock (medicine_id int PRIMARY KEY, name text, stock int);
TRUNCATE tx_demo.medicine_stock;

-- 1. INSERT ... IF NOT EXISTS: second insert is NOT applied, current row is returned
INSERT INTO tx_demo.medicine_stock (medicine_id, name, stock) VALUES (1, 'Paracetamol', 100) IF NOT EXISTS;
INSERT INTO tx_demo.medicine_stock (medicine_id, name, stock) VALUES (1, 'Paracetamol', 999) IF NOT EXISTS;

-- 2. Optimistic "read 100, write 90 only if still 100"
UPDATE tx_demo.medicine_stock SET stock = 90 WHERE medicine_id = 1 IF stock = 100;
-- a second client that also read 100 loses: [applied] = False, sees stock = 90, must re-read and retry
UPDATE tx_demo.medicine_stock SET stock = 90 WHERE medicine_id = 1 IF stock = 100;

-- 3. Business rule "only dispense if enough stock"
UPDATE tx_demo.medicine_stock SET stock = 0 WHERE medicine_id = 1 IF stock >= 1000;

SELECT * FROM tx_demo.medicine_stock;
