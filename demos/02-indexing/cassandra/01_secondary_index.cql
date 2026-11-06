-- Topic ii: Indexing
-- S1: Không index vs có index trên Cassandra
USE healthcare;

-- 1. Thử truy vấn thiết bị trên bảng sinh hiệu (Lỗi nếu không có ALLOW FILTERING)
-- Cassandra từ chối quét toàn cụm để tìm vì rất tốn chi phí.
-- LỖI: SELECT * FROM vital_signs_by_patient_day WHERE device_id = 'DEV-001';

-- 2. Ép quét toàn cụm (RẤT CHẬM trên dữ liệu lớn)
SELECT * FROM vital_signs_by_patient_day WHERE device_id = 'DEV-001' ALLOW FILTERING;

-- 3. Tạo Secondary Index (2i)
CREATE INDEX IF NOT EXISTS idx_vital_device ON vital_signs_by_patient_day(device_id);

-- 4. Truy vấn lại (thành công mà không cần ALLOW FILTERING)
SELECT * FROM vital_signs_by_patient_day WHERE device_id = 'DEV-001';
