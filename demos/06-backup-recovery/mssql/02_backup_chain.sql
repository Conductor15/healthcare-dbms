/* =====================================================================
   T6-S2  Backup chain: FULL → DIFFERENTIAL → LOG, verified with CHECKSUM
   Typical clinic schedule: full weekly, differential nightly, log every 15 min
   (see 04_agent_jobs.sql). Files land in the container volume
   /var/opt/mssql/backup (copy out: docker cp hc-mssql:/var/opt/mssql/backup ./backups).
   Run: node demos/run.js demos/06-backup-recovery/mssql/02_backup_chain.sql
   ===================================================================== */
:on error exit
SET NOCOUNT ON;
EXEC master.dbo.xp_create_subdir N'/var/opt/mssql/backup';

BACKUP DATABASE HealthcareDB TO DISK = '/var/opt/mssql/backup/hc_full.bak'
    WITH INIT, FORMAT, COMPRESSION, CHECKSUM, NAME = N'T6 full';
GO
SET NOCOUNT ON;

INSERT dbo.patients (full_name, date_of_birth, gender) VALUES (N'T6 marker sau full', '2000-01-01', 'O');
BACKUP DATABASE HealthcareDB TO DISK = '/var/opt/mssql/backup/hc_diff.bak'
    WITH DIFFERENTIAL, INIT, FORMAT, COMPRESSION, CHECKSUM, NAME = N'T6 differential';

INSERT dbo.patients (full_name, date_of_birth, gender) VALUES (N'T6 marker sau diff', '2000-01-01', 'O');
BACKUP LOG HealthcareDB TO DISK = '/var/opt/mssql/backup/hc_log1.trn'
    WITH INIT, FORMAT, COMPRESSION, CHECKSUM, NAME = N'T6 log 1';

PRINT N'--- Kiểm tra tính toàn vẹn file backup (đọc lại toàn bộ, so CHECKSUM)';
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/hc_full.bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/hc_diff.bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK = '/var/opt/mssql/backup/hc_log1.trn' WITH CHECKSUM;

PRINT N'--- Lịch sử backup trong msdb: chuỗi LSN nối tiếp nhau';
SELECT TOP (3)
    CASE b.type WHEN 'D' THEN 'FULL' WHEN 'I' THEN 'DIFF' WHEN 'L' THEN 'LOG' END AS kind,
    b.name, CONVERT(VARCHAR(19), b.backup_finish_date, 120) AS finished,
    b.first_lsn, b.last_lsn, b.database_backup_lsn AS based_on_full_lsn,
    CAST(b.backup_size / 1048576.0 AS DECIMAL(8,2)) AS size_mb,
    CAST(b.compressed_backup_size / 1048576.0 AS DECIMAL(8,2)) AS compressed_mb,
    b.has_backup_checksums AS checksum, f.physical_device_name AS [file]
FROM msdb.dbo.backupset b
JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = b.media_set_id
WHERE b.database_name = 'HealthcareDB'
ORDER BY b.backup_set_id DESC;

DELETE dbo.patients WHERE full_name LIKE N'T6 marker%';
