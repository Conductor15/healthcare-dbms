/* =====================================================================
   T4-S7a  Durability mechanism: write-ahead log records of ONE transaction
   fn_dblog (undocumented, read-only) shows what SQL Server writes to the
   .ldf BEFORE the data page: BEGIN_XACT → MODIFY_ROW / MODIFY_COLUMNS
   (before/after image, enough to redo or undo) → COMMIT_XACT. Crash test of durability: 06-backup-recovery/crash_recovery.js
   Run: node demos/run.js demos/04-transaction/mssql/04_log_records.sql
   ===================================================================== */
SET NOCOUNT ON;

BEGIN TRANSACTION t4_wal_demo;
    UPDATE dbo.medicines SET unit_price = unit_price + 100 WHERE medicine_id = 1;
    UPDATE dbo.medicines SET unit_price = unit_price - 100 WHERE medicine_id = 1;
COMMIT TRANSACTION;

DECLARE @xid NVARCHAR(30) = (
    SELECT TOP (1) [Transaction ID] FROM fn_dblog(NULL, NULL)
    WHERE [Transaction Name] = 't4_wal_demo' ORDER BY [Current LSN] DESC);

PRINT CONCAT(N'Log records của transaction ', @xid, N':');
SELECT [Current LSN], Operation, Context, AllocUnitName, [Log Record Length] AS bytes
FROM fn_dblog(NULL, NULL)
WHERE [Transaction ID] = @xid
ORDER BY [Current LSN];

PRINT N'=> COMMIT chỉ trả về khi LOP_COMMIT_XACT đã được ghi xuống đĩa (log flush). Data page ghi sau (checkpoint).';
