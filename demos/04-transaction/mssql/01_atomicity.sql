/* =====================================================================
   T4-S1  Atomicity: "khám bệnh" = 5 writes in ONE transaction
   Step 4 asks for 1000 Salbutamol (stock 60) → CK_medicines_stock fails
   → TRY/CATCH rolls back ALL earlier steps. Re-runnable: leaves no data.
   Run: node demos/run.js demos/04-transaction/mssql/01_atomicity.sql
   ===================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @before TABLE (visits INT, prescriptions INT, items INT, invoices INT, paracetamol INT, salbutamol INT);
INSERT @before
SELECT (SELECT COUNT(*) FROM dbo.visits), (SELECT COUNT(*) FROM dbo.prescriptions),
       (SELECT COUNT(*) FROM dbo.prescription_items), (SELECT COUNT(*) FROM dbo.invoices),
       (SELECT stock_quantity FROM dbo.medicines WHERE medicine_id = 1),
       (SELECT stock_quantity FROM dbo.medicines WHERE medicine_id = 9);

DECLARE @visit INT, @rx INT;
BEGIN TRY
    BEGIN TRANSACTION;

    INSERT dbo.visits (patient_id, doctor_id, symptoms, diagnosis)
    VALUES (7, 1, N'Ho, khó thở về đêm', N'Hen phế quản cấp');
    SET @visit = SCOPE_IDENTITY();
    PRINT CONCAT(N'1. INSERT visits            → visit_id = ', @visit);

    INSERT dbo.prescriptions (visit_id) VALUES (@visit);
    SET @rx = SCOPE_IDENTITY();
    PRINT CONCAT(N'2. INSERT prescriptions     → prescription_id = ', @rx);

    INSERT dbo.prescription_items (prescription_id, medicine_id, quantity, dosage, unit_price)
    VALUES (@rx, 1, 10, N'Sáng 1 viên, tối 1 viên', 1500),
           (@rx, 9, 1000, N'Xịt 2 nhát khi khó thở', 85000);
    PRINT N'3. INSERT prescription_items → 2 dòng';

    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 10 WHERE medicine_id = 1;
    PRINT N'4a. UPDATE tồn kho Paracetamol −10 → OK';
    UPDATE dbo.medicines SET stock_quantity = stock_quantity - 1000 WHERE medicine_id = 9;
    PRINT N'4b. (không in ra được: câu trên vi phạm CHECK)';

    INSERT dbo.invoices (visit_id, consultation_fee, medicine_total) VALUES (@visit, 200000, 85015000);
    PRINT N'5. (không bao giờ tới đây)';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    PRINT CONCAT(N'!! Lỗi ', ERROR_NUMBER(), N' tại bước 4b: ', ERROR_MESSAGE());
    PRINT CONCAT(N'   XACT_STATE() = ', XACT_STATE(), N' (−1 = transaction không thể commit)');
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT N'=> ROLLBACK: huỷ cả bước 1, 2, 3, 4a';
END CATCH;

PRINT N'';
PRINT N'Trước / sau: hoàn toàn giống nhau (atomicity)';
SELECT 'before' AS [state], * FROM @before
UNION ALL
SELECT 'after', (SELECT COUNT(*) FROM dbo.visits), (SELECT COUNT(*) FROM dbo.prescriptions),
       (SELECT COUNT(*) FROM dbo.prescription_items), (SELECT COUNT(*) FROM dbo.invoices),
       (SELECT stock_quantity FROM dbo.medicines WHERE medicine_id = 1),
       (SELECT stock_quantity FROM dbo.medicines WHERE medicine_id = 9);

PRINT N'Lưu ý: IDENTITY không rollback → lần insert visit kế tiếp sẽ nhảy số (gap).';
SELECT IDENT_CURRENT('dbo.visits') AS visits_identity_current;
