/* =====================================================================
   HealthcareDB: small reference seed                         Step S1.2
   Enough to click through the app. Large benchmark data comes from
   server/scripts/generate-data.js (S1.4). Users are seeded by db-init.js
   (passwords need bcrypt).
   ===================================================================== */

INSERT INTO dbo.departments (name, location, description) VALUES
 (N'Nội tổng quát',  N'Tầng 1 - Khu A', N'Khám và điều trị các bệnh nội khoa thường gặp'),
 (N'Nhi',            N'Tầng 2 - Khu A', N'Khám sức khoẻ trẻ em dưới 16 tuổi'),
 (N'Tim mạch',       N'Tầng 3 - Khu B', N'Tăng huyết áp, rối loạn nhịp, suy tim'),
 (N'Tai Mũi Họng',   N'Tầng 1 - Khu B', NULL),
 (N'Da liễu',        N'Tầng 2 - Khu B', NULL),
 (N'Sản phụ khoa',   N'Tầng 4 - Khu A', NULL);
GO

INSERT INTO dbo.doctors (full_name, department_id, specialization, phone, email, consultation_fee, hired_at) VALUES
 (N'Nguyễn Văn An',     1, N'Nội tổng quát',   '0901000001', 'an.nguyen@clinic.vn',    200000, '2018-03-01'),
 (N'Trần Thị Bình',     1, N'Nội tiết',        '0901000002', 'binh.tran@clinic.vn',    250000, '2019-07-15'),
 (N'Lê Hoàng Cường',    2, N'Nhi tổng quát',   '0901000003', 'cuong.le@clinic.vn',     200000, '2020-01-10'),
 (N'Phạm Minh Đức',     3, N'Tim mạch can thiệp','0901000004','duc.pham@clinic.vn',     350000, '2015-09-01'),
 (N'Võ Thị Hạnh',       3, N'Nhịp học',        '0901000005', 'hanh.vo@clinic.vn',      300000, '2021-02-20'),
 (N'Đặng Quốc Huy',     4, N'Tai Mũi Họng',    '0901000006', 'huy.dang@clinic.vn',     200000, '2017-05-05'),
 (N'Bùi Thu Lan',       5, N'Da liễu',         '0901000007', 'lan.bui@clinic.vn',      220000, '2022-08-01'),
 (N'Hồ Ngọc Mai',       6, N'Sản khoa',        '0901000008', 'mai.ho@clinic.vn',       280000, '2016-11-11');
GO

INSERT INTO dbo.medicines (name, unit, unit_price, stock_quantity) VALUES
 (N'Paracetamol 500mg',      N'viên',  1500, 5000),
 (N'Amoxicillin 500mg',      N'viên',  3000, 2000),
 (N'Ibuprofen 400mg',        N'viên',  2500, 1500),
 (N'Omeprazole 20mg',        N'viên',  4000, 1200),
 (N'Amlodipine 5mg',         N'viên',  3500, 1000),
 (N'Losartan 50mg',          N'viên',  5000,  800),
 (N'Metformin 850mg',        N'viên',  2000, 1500),
 (N'Cetirizine 10mg',        N'viên',  1800, 1000),
 (N'Salbutamol xịt 100mcg',  N'bình', 85000,   60),
 (N'Oresol',                 N'gói',   3000,  500),
 (N'Vitamin C 500mg',        N'viên',  1000, 3000),
 (N'Kem Hydrocortisone 1%',  N'tuýp', 35000,  100),
 (N'Siro ho Prospan',        N'chai', 95000,   80),
 (N'Atorvastatin 20mg',      N'viên',  6000,  900),
 (N'Thuốc nhỏ mũi NaCl 0.9%',N'lọ',    5000,  400);
GO

INSERT INTO dbo.patients (full_name, date_of_birth, gender, phone, email, address, blood_type, medical_history) VALUES
 (N'Nguyễn Thị Hoa',    '1985-04-12', 'F', '0912000001', 'hoa.nt@gmail.com',   N'Q.1, TP.HCM',       'O+',  N'Tăng huyết áp'),
 (N'Trần Văn Nam',      '1972-11-03', 'M', '0912000002', NULL,                 N'Q.3, TP.HCM',       'A+',  N'Đái tháo đường type 2'),
 (N'Lê Minh Khoa',      '2016-06-21', 'M', '0912000003', NULL,                 N'Thủ Đức, TP.HCM',   'B+',  NULL),
 (N'Phạm Thu Trang',    '1995-01-30', 'F', '0912000004', 'trang.pt@gmail.com', N'Q.7, TP.HCM',       'AB+', N'Dị ứng penicillin'),
 (N'Hoàng Đức Long',    '1960-09-09', 'M', '0912000005', NULL,                 N'Bình Thạnh, TP.HCM','O-',  N'Rung nhĩ'),
 (N'Vũ Ngọc Anh',       '2001-12-12', 'F', '0912000006', 'anh.vn@gmail.com',   N'Gò Vấp, TP.HCM',    'A-',  NULL),
 (N'Đỗ Quang Vinh',     '1990-07-07', 'M', '0912000007', NULL,                 N'Q.10, TP.HCM',      'B-',  N'Hen phế quản'),
 (N'Ngô Bảo Châu',      '2019-03-15', 'F', '0912000008', NULL,                 N'Q.5, TP.HCM',       'O+',  NULL),
 (N'Bùi Văn Tài',       '1955-05-25', 'M', '0912000009', NULL,                 N'Tân Bình, TP.HCM',  'A+',  N'Suy tim độ II'),
 (N'Lý Thanh Thảo',     '1998-08-18', 'F', '0912000010', 'thao.lt@gmail.com',  N'Q.Phú Nhuận, TP.HCM','AB-', NULL);
GO

-- 30-minute slots, 08:00-11:30 and 13:30-16:30, from 30 days ago to 14 days ahead, for every active doctor.
WITH days AS (
    SELECT TOP (45) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 31 AS offset_days
    FROM sys.all_objects
),
starts AS (
    SELECT CAST(t AS TIME(0)) AS start_time
    FROM (VALUES ('08:00'),('08:30'),('09:00'),('09:30'),('10:00'),('10:30'),('11:00'),
                 ('13:30'),('14:00'),('14:30'),('15:00'),('15:30'),('16:00')) AS v(t)
)
INSERT INTO dbo.time_slots (doctor_id, slot_date, start_time, end_time)
SELECT d.doctor_id,
       DATEADD(DAY, days.offset_days, CAST(GETDATE() AS DATE)),
       starts.start_time,
       DATEADD(MINUTE, 30, starts.start_time)
FROM dbo.doctors AS d
CROSS JOIN days
CROSS JOIN starts
WHERE d.is_active = 1;
GO
