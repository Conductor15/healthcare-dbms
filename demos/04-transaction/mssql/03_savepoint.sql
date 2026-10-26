/* =====================================================================
   T4-S3  Savepoint: partial rollback inside a transaction
   Doctor prescribes 3 medicines; the 3rd is out of stock → roll back to
   the savepoint (drop only medicine 3), keep visit + medicines 1-2.
   Needs XACT_ABORT OFF: with ON, any error dooms the whole transaction
   (XACT_STATE() = -1) and a savepoint can no longer be used.
   The script ends with ROLLBACK so it can be re-run (the app would COMMIT).
   Run: node demos/run.js demos/04-transaction/mssql/03_savepoint.sql
   ===================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @visit INT, @rx INT;
BEGIN TRANSACTION;

INSERT dbo.visits (patient_id, doctor_id, symptoms, diagnosis)
VALUES (4, 6, N'Đau họng, sốt 38.5°C', N'Viêm họng cấp');
SET @visit = SCOPE_IDENTITY();
INSERT dbo.prescriptions (visit_id) VALUES (@visit);
SET @rx = SCOPE_IDENTITY();

-- medicine 1: Paracetamol
INSERT dbo.prescription_items VALUES (@rx, 1, 10, N'Uống khi sốt > 38.5°C', 1500);
UPDATE dbo.medicines SET stock_quantity = stock_quantity - 10 WHERE medicine_id = 1;
-- medicine 2: Cetirizine
INSERT dbo.prescription_items VALUES (@rx, 8, 7, N'Tối 1 viên', 1800);
UPDATE dbo.medicines SET stock_quantity = stock_quantity - 7 WHERE medicine_id = 8;
PRINT N'Thuốc 1, 2: OK';

SAVE TRANSACTION before_item3;
BEGIN TRY
    INSERT dbo.prescription_items VALUES (@rx, 9, 1000, N'Xịt khi khó thở', 85000);
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 1000 WHERE medicine_id = 9;  -- violates CHECK
END TRY
BEGIN CATCH
    PRINT CONCAT(N'Thuốc 3 lỗi: ', ERROR_MESSAGE());
    PRINT CONCAT(N'XACT_STATE() = ', XACT_STATE(), N' (1 = transaction vẫn commit được)');
    ROLLBACK TRANSACTION before_item3;
    PRINT N'→ ROLLBACK TRANSACTION before_item3: chỉ bỏ thuốc 3';
END CATCH;

PRINT CONCAT(N'@@TRANCOUNT = ', @@TRANCOUNT, N'; đơn thuốc còn lại:');
SELECT pi.medicine_id, m.name, pi.quantity, pi.dosage
FROM dbo.prescription_items pi JOIN dbo.medicines m ON m.medicine_id = pi.medicine_id
WHERE pi.prescription_id = @rx;

ROLLBACK TRANSACTION;  -- demo cleanup
PRINT N'(Demo kết thúc bằng ROLLBACK để chạy lại được; trong ứng dụng sẽ là COMMIT)';
