USE HealthcareDB;
GO

SELECT name, physical_name, type_desc, size * 8 / 1024 AS size_mb 
FROM sys.database_files;
GO

SELECT allocated_page_file_id, allocated_page_page_id, page_type, page_type_desc
FROM sys.dm_db_database_page_allocations(DB_ID(), OBJECT_ID('dbo.patients'), NULL, NULL, 'DETAILED')
WHERE is_allocated = 1;
GO
