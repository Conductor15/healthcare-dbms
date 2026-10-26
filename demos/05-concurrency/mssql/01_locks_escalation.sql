/* =====================================================================
   T5-S4  Lock hierarchy and lock escalation (single session)
   Updating 100 rows takes 100 KEY X locks (+ intent locks IX on PAGE/OBJECT).
   Updating 10 000 rows: past ~5000 locks SQL Server escalates to ONE
   table lock (OBJECT X) to save memory, which blocks every other user.
   Run: node demos/run.js demos/05-concurrency/mssql/01_locks_escalation.sql
   ===================================================================== */
SET NOCOUNT ON;
IF OBJECT_ID('dbo.lab_escalation') IS NULL
BEGIN
    CREATE TABLE dbo.lab_escalation (id INT PRIMARY KEY, qty INT NOT NULL);
    INSERT dbo.lab_escalation (id, qty)
    SELECT TOP (10000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)), 100
    FROM sys.all_objects a CROSS JOIN sys.all_objects b;
END;

PRINT N'--- 1. UPDATE 100 dòng: khoá mức dòng (KEY)';
BEGIN TRAN;
    UPDATE dbo.lab_escalation SET qty = qty + 1 WHERE id <= 100;
    SELECT resource_type, request_mode, COUNT(*) AS locks
    FROM sys.dm_tran_locks
    WHERE request_session_id = @@SPID AND resource_database_id = DB_ID()
    GROUP BY resource_type, request_mode ORDER BY resource_type;
ROLLBACK;

PRINT N'--- 2. UPDATE 10 000 dòng: leo thang thành khoá cả bảng (OBJECT X)';
BEGIN TRAN;
    UPDATE dbo.lab_escalation SET qty = qty + 1;
    SELECT resource_type, request_mode, COUNT(*) AS locks
    FROM sys.dm_tran_locks
    WHERE request_session_id = @@SPID AND resource_database_id = DB_ID()
    GROUP BY resource_type, request_mode ORDER BY resource_type;
ROLLBACK;

PRINT N'--- 3. Tắt leo thang cho bảng (LOCK_ESCALATION = DISABLE) rồi chạy lại';
ALTER TABLE dbo.lab_escalation SET (LOCK_ESCALATION = DISABLE);
BEGIN TRAN;
    UPDATE dbo.lab_escalation SET qty = qty + 1;
    SELECT resource_type, request_mode, COUNT(*) AS locks
    FROM sys.dm_tran_locks
    WHERE request_session_id = @@SPID AND resource_database_id = DB_ID()
    GROUP BY resource_type, request_mode ORDER BY resource_type;
ROLLBACK;
ALTER TABLE dbo.lab_escalation SET (LOCK_ESCALATION = TABLE);
PRINT N'=> Đánh đổi: 10 000 khoá dòng tốn bộ nhớ lock manager nhưng các phiên khác vẫn làm việc được với dòng khác.';
