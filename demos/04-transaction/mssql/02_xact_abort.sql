/* =====================================================================
   T4-S2  The XACT_ABORT trap
   With XACT_ABORT OFF (the default!) a constraint violation only kills
   that ONE statement: the transaction stays open and COMMIT saves half
   of the work. With XACT_ABORT ON the whole transaction is rolled back.
   Run: node demos/run.js demos/04-transaction/mssql/02_xact_abort.sql
   ===================================================================== */
SET NOCOUNT ON;
PRINT N'=== A. XACT_ABORT OFF (mặc định) ===';
SELECT medicine_id, name, stock_quantity FROM dbo.medicines WHERE medicine_id IN (1, 9);

SET XACT_ABORT OFF;
BEGIN TRANSACTION;
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 10   WHERE medicine_id = 1;  -- OK
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 1000 WHERE medicine_id = 9;  -- Msg 547, chỉ huỷ câu này
    PRINT CONCAT(N'Sau lỗi: @@TRANCOUNT = ', @@TRANCOUNT, N' → transaction VẪN MỞ');
COMMIT TRANSACTION;

PRINT N'Kết quả: Paracetamol bị trừ 10 nhưng Salbutamol không → dữ liệu nửa vời đã được COMMIT';
SELECT medicine_id, name, stock_quantity FROM dbo.medicines WHERE medicine_id IN (1, 9);

-- restore for re-runs
UPDATE dbo.medicines SET stock_quantity = stock_quantity + 10 WHERE medicine_id = 1;
GO

PRINT N'';
PRINT N'=== B. XACT_ABORT ON ===';
SET XACT_ABORT ON;
BEGIN TRANSACTION;
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 10   WHERE medicine_id = 1;
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 1000 WHERE medicine_id = 9;  -- huỷ cả batch + rollback
    PRINT N'(không in: batch đã bị dừng)';
COMMIT TRANSACTION;
GO

SET NOCOUNT ON;
PRINT CONCAT(N'@@TRANCOUNT = ', @@TRANCOUNT, N' → SQL Server đã tự ROLLBACK toàn bộ');
SELECT medicine_id, name, stock_quantity FROM dbo.medicines WHERE medicine_id IN (1, 9);
PRINT N'=> Bài học: luôn SET XACT_ABORT ON (hoặc TRY/CATCH + ROLLBACK). Ứng dụng của nhóm dùng withTransaction() rollback mọi lỗi.';
