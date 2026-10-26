/* =====================================================================
   T6-S7  Automatic backup schedule with SQL Server Agent
   Full: Sunday 01:00 · Differential: daily 01:00 · Log: every 15 minutes
   (Agent is enabled in docker-compose: MSSQL_AGENT_ENABLED=true)
   Run: node demos/run.js demos/06-backup-recovery/mssql/04_agent_jobs.sql
   ===================================================================== */
:on error exit
SET NOCOUNT ON;
EXEC master.dbo.xp_create_subdir N'/var/opt/mssql/backup';

DECLARE @jobs TABLE (name SYSNAME, command NVARCHAR(MAX), freq_type INT, freq_interval INT,
                     subday_type INT, subday_interval INT);
INSERT @jobs VALUES
 (N'HC - Full backup (weekly)',
  N'BACKUP DATABASE HealthcareDB TO DISK = ''/var/opt/mssql/backup/hc_full_weekly.bak'' WITH INIT, COMPRESSION, CHECKSUM;',
  8, 1, 1, 0),        -- weekly, Sunday, once
 (N'HC - Differential backup (daily)',
  N'BACKUP DATABASE HealthcareDB TO DISK = ''/var/opt/mssql/backup/hc_diff_daily.bak'' WITH DIFFERENTIAL, INIT, COMPRESSION, CHECKSUM;',
  4, 1, 1, 0),        -- daily, once
 (N'HC - Log backup (15 min)',
  N'DECLARE @f NVARCHAR(200) = CONCAT(''/var/opt/mssql/backup/hc_log_'', FORMAT(SYSDATETIME(), ''yyyyMMdd_HHmm''), ''.trn'');
    BACKUP LOG HealthcareDB TO DISK = @f WITH COMPRESSION, CHECKSUM;',
  4, 1, 4, 15);       -- daily, every 15 minutes

DECLARE @name SYSNAME, @command NVARCHAR(MAX), @ft INT, @fi INT, @st INT, @si INT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM @jobs;
OPEN c;
FETCH NEXT FROM c INTO @name, @command, @ft, @fi, @st, @si;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @name)
        EXEC msdb.dbo.sp_delete_job @job_name = @name;
    EXEC msdb.dbo.sp_add_job @job_name = @name;
    EXEC msdb.dbo.sp_add_jobstep @job_name = @name, @step_name = N'backup', @subsystem = N'TSQL',
         @database_name = N'master', @command = @command;
    EXEC msdb.dbo.sp_add_jobschedule @job_name = @name, @name = @name, @freq_type = @ft, @freq_interval = @fi,
         @freq_subday_type = @st, @freq_subday_interval = @si, @freq_recurrence_factor = 1,
         @active_start_time = 10000;
    EXEC msdb.dbo.sp_add_jobserver @job_name = @name;
    FETCH NEXT FROM c INTO @name, @command, @ft, @fi, @st, @si;
END;
CLOSE c;

PRINT N'--- Chạy thử job log backup ngay';
EXEC msdb.dbo.sp_start_job @job_name = N'HC - Log backup (15 min)';
WAITFOR DELAY '00:00:05';

SELECT j.name AS job,
       CASE sc.freq_type WHEN 8 THEN N'Hằng tuần (CN)' WHEN 4 THEN N'Hằng ngày' END
       + CASE sc.freq_subday_type WHEN 4 THEN CONCAT(N', mỗi ', sc.freq_subday_interval, N' phút') ELSE N', 01:00' END
         AS schedule,
       (SELECT TOP (1) CASE h.run_status WHEN 1 THEN 'Succeeded' WHEN 0 THEN 'Failed' ELSE 'Other' END
        FROM msdb.dbo.sysjobhistory h WHERE h.job_id = j.job_id AND h.step_id = 0
        ORDER BY h.instance_id DESC) AS last_run
FROM msdb.dbo.sysjobs j
JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
JOIN msdb.dbo.sysschedules sc ON sc.schedule_id = js.schedule_id
WHERE j.name LIKE N'HC - %' ORDER BY j.name;
