/* =====================================================================
   T6-S3  Point-in-time recovery after "UPDATE without WHERE"
   A pharmacist sets every medicine price to 0 by accident. We restore a
   COPY of the database to the second before the accident (STOPAT) next to
   the live one, then repair only the damaged column. No downtime, and the
   legitimate change made after the last full backup is preserved.
   (Same flow as DB Lab → Backup: server/src/modules/lab/backup.lab.js)

   SAFETY: one step per batch + ":on error exit" → sqlcmd stops at the first
   failing batch, and step 2 refuses to run without a fresh full backup.
   Run: node demos/run.js demos/06-backup-recovery/mssql/03_point_in_time.sql
   ===================================================================== */
:on error exit
SET NOCOUNT ON;
EXEC master.dbo.xp_create_subdir N'/var/opt/mssql/backup';
PRINT N'--- 0. Full backup (ví dụ: bản backup đêm qua)';
BACKUP DATABASE HealthcareDB TO DISK = '/var/opt/mssql/backup/pitr_full.bak'
    WITH INIT, FORMAT, COMPRESSION, CHECKSUM;
GO

PRINT N'--- 1. Sáng nay: thay đổi hợp lệ SAU full backup (phải được giữ lại)';
UPDATE dbo.medicines SET unit_price = 1650 WHERE medicine_id = 1;   -- Paracetamol tăng giá 1500 → 1650
WAITFOR DELAY '00:00:01';
CREATE TABLE #pitr (stop_at DATETIME2(3));   -- session temp table survives across batches
INSERT #pitr VALUES (SYSDATETIME());
WAITFOR DELAY '00:00:01';
GO

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.backupset
               WHERE database_name = 'HealthcareDB' AND type = 'D'
                 AND backup_finish_date > DATEADD(MINUTE, -2, GETDATE()))
    THROW 50000, N'Không có full backup vừa tạo → dừng trước khi gây sự cố', 1;
PRINT N'--- 2. Sự cố: UPDATE quên WHERE';
UPDATE dbo.medicines SET unit_price = 0;
SELECT TOP (4) medicine_id, name, unit_price FROM dbo.medicines ORDER BY medicine_id;
GO

PRINT N'--- 3. Backup log (chứa cả thay đổi hợp lệ lẫn sự cố)';
BACKUP LOG HealthcareDB TO DISK = '/var/opt/mssql/backup/pitr_log.trn' WITH INIT, FORMAT, CHECKSUM;
GO

PRINT N'--- 4. Restore bản sao HealthcareDB_PITR: full + log, dừng tại thời điểm ngay trước sự cố';
DECLARE @stop_at NVARCHAR(30) = (SELECT CONVERT(NVARCHAR(30), stop_at, 121) FROM #pitr);
PRINT CONCAT(N'    STOPAT = ', @stop_at);
RESTORE DATABASE HealthcareDB_PITR FROM DISK = '/var/opt/mssql/backup/pitr_full.bak'
    WITH MOVE 'HealthcareDB'     TO '/var/opt/mssql/data/HealthcareDB_PITR.mdf',
         MOVE 'HealthcareDB_log' TO '/var/opt/mssql/data/HealthcareDB_PITR_log.ldf',
         NORECOVERY, REPLACE;
RESTORE LOG HealthcareDB_PITR FROM DISK = '/var/opt/mssql/backup/pitr_log.trn'
    WITH STOPAT = @stop_at, RECOVERY;
GO

PRINT N'--- 5. So sánh live vs bản khôi phục';
SELECT TOP (4) live.medicine_id, live.name, live.unit_price AS live_price, r.unit_price AS restored_price
FROM dbo.medicines live JOIN HealthcareDB_PITR.dbo.medicines r ON r.medicine_id = live.medicine_id
ORDER BY live.medicine_id;

PRINT N'--- 6. Sửa đúng cột bị hỏng từ bản khôi phục';
UPDATE live SET unit_price = r.unit_price
FROM dbo.medicines live JOIN HealthcareDB_PITR.dbo.medicines r ON r.medicine_id = live.medicine_id;
PRINT CONCAT(N'    Đã sửa ', @@ROWCOUNT, N' dòng. Paracetamol giữ giá mới 1650 (thay đổi hợp lệ sau full backup):');
SELECT TOP (4) medicine_id, name, unit_price FROM dbo.medicines ORDER BY medicine_id;
GO

DROP DATABASE HealthcareDB_PITR;
UPDATE dbo.medicines SET unit_price = 1500 WHERE medicine_id = 1;  -- reset demo so it can be re-run
GO
