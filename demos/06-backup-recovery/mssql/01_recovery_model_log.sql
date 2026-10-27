/* =====================================================================
   T6-S1  Recovery model & why log backups matter
   FULL recovery keeps every log record until a LOG backup copies it out
   (log_reuse_wait = LOG_BACKUP); that is what makes point-in-time restore
   possible. SIMPLE truncates the log at each checkpoint: smaller log,
   but you can only restore to the last full/differential backup.
   Run: node demos/run.js demos/06-backup-recovery/mssql/01_recovery_model_log.sql
   ===================================================================== */
:on error exit
SET NOCOUNT ON;
EXEC master.dbo.xp_create_subdir N'/var/opt/mssql/backup';

-- A full backup starts the log chain (before it, FULL behaves like SIMPLE)
BACKUP DATABASE HealthcareDB TO DISK = '/var/opt/mssql/backup/t6_s1_full.bak'
    WITH INIT, FORMAT, COMPRESSION, CHECKSUM;
GO
SET NOCOUNT ON;

IF OBJECT_ID('dbo.lab_log_growth') IS NULL
    CREATE TABLE dbo.lab_log_growth (id INT IDENTITY PRIMARY KEY, payload NCHAR(400) NOT NULL);
TRUNCATE TABLE dbo.lab_log_growth;

PRINT N'--- 1. Ngay sau full backup';
SELECT d.recovery_model_desc, d.log_reuse_wait_desc,
       CAST(u.used_log_space_in_bytes / 1048576.0 AS DECIMAL(8,2)) AS log_used_mb,
       CAST(u.used_log_space_in_percent AS DECIMAL(5,1)) AS log_used_pct
FROM sys.databases d CROSS JOIN sys.dm_db_log_space_usage u WHERE d.database_id = DB_ID();

-- ~20 MB of changes (e.g. a busy day of updates)
INSERT dbo.lab_log_growth (payload)
SELECT TOP (20000) N'vital-sign batch' FROM sys.all_objects a CROSS JOIN sys.all_objects b;
UPDATE dbo.lab_log_growth SET payload = N'updated';
CHECKPOINT;

PRINT N'--- 2. Sau 20 000 insert + update + CHECKPOINT: log KHÔNG được giải phóng (chờ LOG_BACKUP)';
SELECT d.recovery_model_desc, d.log_reuse_wait_desc,
       CAST(u.used_log_space_in_bytes / 1048576.0 AS DECIMAL(8,2)) AS log_used_mb,
       CAST(u.used_log_space_in_percent AS DECIMAL(5,1)) AS log_used_pct
FROM sys.databases d CROSS JOIN sys.dm_db_log_space_usage u WHERE d.database_id = DB_ID();

BACKUP LOG HealthcareDB TO DISK = '/var/opt/mssql/backup/t6_s1_log.trn' WITH INIT, FORMAT, COMPRESSION, CHECKSUM;

PRINT N'--- 3. Sau BACKUP LOG: phần log đã sao lưu được tái sử dụng';
SELECT d.recovery_model_desc, d.log_reuse_wait_desc,
       CAST(u.used_log_space_in_bytes / 1048576.0 AS DECIMAL(8,2)) AS log_used_mb,
       CAST(u.used_log_space_in_percent AS DECIMAL(5,1)) AS log_used_pct
FROM sys.databases d CROSS JOIN sys.dm_db_log_space_usage u WHERE d.database_id = DB_ID();

TRUNCATE TABLE dbo.lab_log_growth;
