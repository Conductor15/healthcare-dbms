
USE HealthcareDB;
GO

SET STATISTICS IO ON;
SET STATISTICS TIME ON;
GO

DBCC FREEPROCCACHE; 
DBCC DROPCLEANBUFFERS;
SELECT patient_id, full_name, date_of_birth, phone 
FROM dbo.patients 
WHERE phone = '0901234567';
GO

CREATE NONCLUSTERED INDEX IX_patients_phone ON dbo.patients(phone);
GO

DBCC FREEPROCCACHE;
DBCC DROPCLEANBUFFERS;
SELECT patient_id, full_name, date_of_birth, phone 
FROM dbo.patients 
WHERE phone = '0901234567';
GO

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO
