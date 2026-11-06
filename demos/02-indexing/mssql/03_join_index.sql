
USE HealthcareDB;
GO

SET STATISTICS IO ON;
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name='IX_visits_patient_id')
    DROP INDEX IX_visits_patient_id ON dbo.visits;

SELECT v.visit_id, v.visit_date, p.full_name AS patient_name, d.full_name AS doctor_name, v.diagnosis
FROM dbo.visits v
JOIN dbo.patients p ON v.patient_id = p.patient_id
JOIN dbo.doctors d ON v.doctor_id = d.doctor_id
WHERE v.patient_id = 100; 
GO

CREATE NONCLUSTERED INDEX IX_visits_patient_id ON dbo.visits(patient_id);
CREATE NONCLUSTERED INDEX IX_visits_doctor_id ON dbo.visits(doctor_id);
GO

SELECT v.visit_id, v.visit_date, p.full_name AS patient_name, d.full_name AS doctor_name, v.diagnosis
FROM dbo.visits v
JOIN dbo.patients p ON v.patient_id = p.patient_id
JOIN dbo.doctors d ON v.doctor_id = d.doctor_id
WHERE v.patient_id = 100;
GO
