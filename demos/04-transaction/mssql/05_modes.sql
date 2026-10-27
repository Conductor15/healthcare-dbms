/* =====================================================================
   T4-S9  Transaction modes: autocommit vs implicit vs explicit
   Run: node demos/run.js demos/04-transaction/mssql/05_modes.sql
   ===================================================================== */
SET NOCOUNT ON;

PRINT N'1. Autocommit (mặc định): mỗi câu lệnh là 1 transaction, tự commit';
UPDATE dbo.medicines SET unit_price = unit_price WHERE medicine_id = 1;
PRINT CONCAT(N'   @@TRANCOUNT sau UPDATE = ', @@TRANCOUNT);

PRINT N'2. Implicit: câu lệnh đầu tiên tự MỞ transaction, phải COMMIT/ROLLBACK thủ công';
SET IMPLICIT_TRANSACTIONS ON;
UPDATE dbo.medicines SET unit_price = unit_price WHERE medicine_id = 1;
PRINT CONCAT(N'   @@TRANCOUNT sau UPDATE = ', @@TRANCOUNT, N' (đang giữ khoá cho tới khi kết thúc!)');
ROLLBACK;
SET IMPLICIT_TRANSACTIONS OFF;

PRINT N'3. Explicit: BEGIN TRAN ... COMMIT, có thể lồng nhau nhưng chỉ COMMIT ngoài cùng có tác dụng';
BEGIN TRAN;
    BEGIN TRAN;
        PRINT CONCAT(N'   @@TRANCOUNT lồng = ', @@TRANCOUNT);
    COMMIT;  -- only decrements the counter
    PRINT CONCAT(N'   sau COMMIT trong: @@TRANCOUNT = ', @@TRANCOUNT, N' (chưa có gì được ghi bền)');
ROLLBACK;    -- rolls back EVERYTHING, including the "committed" inner part
PRINT CONCAT(N'   sau ROLLBACK ngoài: @@TRANCOUNT = ', @@TRANCOUNT);
