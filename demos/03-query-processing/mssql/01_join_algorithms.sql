
USE HealthcareDB;
GO

SET STATISTICS TIME ON;
GO

SELECT p.full_name, v.visit_date
FROM dbo.patients p
INNER LOOP JOIN dbo.visits v ON p.patient_id = v.patient_id;
GO

SELECT p.full_name, v.visit_date
FROM dbo.patients p
INNER MERGE JOIN dbo.visits v ON p.patient_id = v.patient_id;
GO

SELECT p.full_name, v.visit_date
FROM dbo.patients p
INNER HASH JOIN dbo.visits v ON p.patient_id = v.patient_id;
GO
