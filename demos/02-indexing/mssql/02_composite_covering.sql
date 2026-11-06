
USE HealthcareDB;
GO

SET STATISTICS IO ON;
GO

-- 1. Truy vấn đa điều kiện FR5: Giới tính, nhóm máu và độ tuổi (năm sinh)

SELECT patient_id, full_name, phone, gender, blood_type, date_of_birth
FROM dbo.patients
WHERE gender = 'F' AND blood_type = 'O+' AND date_of_birth > '1990-01-01';
GO

CREATE NONCLUSTERED INDEX IX_patients_gender_blood_dob 
ON dbo.patients(gender, blood_type, date_of_birth)
INCLUDE (full_name, phone);
GO

SELECT patient_id, full_name, phone, gender, blood_type, date_of_birth
FROM dbo.patients
WHERE gender = 'F' AND blood_type = 'O+' AND date_of_birth > '1990-01-01';
GO
