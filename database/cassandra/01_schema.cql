-- =====================================================================
-- Cassandra keyspace `healthcare`: query-first model           Step S1.3
-- DRAFT by Hoàng; Dương owns refinement (topic i: storage).
-- Run by `npm run db:init` (statements split on ';', so no ';' inside
-- strings and keep comments on their own lines).
-- Single-node dev: RF=1. The 3-node demo keyspace (RF=3) lives in demos/.
-- =====================================================================

CREATE KEYSPACE IF NOT EXISTS healthcare
  WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};

-- Q1: vitals of patient X on day D, newest first.
-- Partition = (patient, day) keeps a partition bounded (~86k rows/day at 1 Hz).
CREATE TABLE IF NOT EXISTS healthcare.vital_signs_by_patient_day (
  patient_id   int,
  day          date,
  recorded_at  timestamp,
  heart_rate   smallint,
  systolic_bp  smallint,
  diastolic_bp smallint,
  spo2         smallint,
  temperature  float,
  device_id    text,
  PRIMARY KEY ((patient_id, day), recorded_at)
) WITH CLUSTERING ORDER BY (recorded_at DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_unit': 'DAYS', 'compaction_window_size': 1};

-- Q2: latest reading per patient (dashboard tiles). Upsert = overwrite.
CREATE TABLE IF NOT EXISTS healthcare.latest_vitals_by_patient (
  patient_id   int PRIMARY KEY,
  recorded_at  timestamp,
  heart_rate   smallint,
  systolic_bp  smallint,
  diastolic_bp smallint,
  spo2         smallint,
  temperature  float,
  device_id    text
);

-- Q3: abnormal readings on day D across all patients.
CREATE TABLE IF NOT EXISTS healthcare.vital_alerts_by_day (
  day          date,
  recorded_at  timestamp,
  patient_id   int,
  alert_type   text,
  detail       text,
  PRIMARY KEY ((day), recorded_at, patient_id)
) WITH CLUSTERING ORDER BY (recorded_at DESC, patient_id ASC);

-- Q4: API access log of user U on day D (written by server middleware).
CREATE TABLE IF NOT EXISTS healthcare.access_logs_by_user_day (
  user_id      int,
  day          date,
  ts           timeuuid,
  method       text,
  path         text,
  status_code  smallint,
  ip           text,
  PRIMARY KEY ((user_id, day), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
  AND default_time_to_live = 7776000;
