-- Topic ii: Indexing
-- S6: So sánh các loại index (Tuỳ chọn dùng SASI)
USE healthcare;

-- 1. Xoá index cũ
DROP INDEX IF EXISTS idx_vital_device;

-- 2. Tạo SASI (Storage-Attached Index) cho tìm kiếm chuỗi
CREATE CUSTOM INDEX idx_sasi_device ON vital_signs_by_patient_day (device_id) 
USING 'org.apache.cassandra.index.sasi.SASIIndex' 
WITH OPTIONS = {'mode': 'CONTAINS'};

-- 3. Truy vấn tìm LIKE (chỉ SASI hỗ trợ LIKE)
SELECT * FROM vital_signs_by_patient_day WHERE device_id LIKE '%001%';
