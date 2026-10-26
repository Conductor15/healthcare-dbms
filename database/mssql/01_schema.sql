/* =====================================================================
   HealthcareDB: schema (SQL Server 2022)                     Step S1.2
   Run by `npm run db:init` (batches separated by GO).
   Intentionally NO secondary indexes on FK / search columns:
   topic ii (Indexing) measures the before/after of adding them.
   ===================================================================== */

CREATE TABLE dbo.departments (
    department_id INT IDENTITY(1,1) CONSTRAINT PK_departments PRIMARY KEY,
    name          NVARCHAR(100) NOT NULL CONSTRAINT UQ_departments_name UNIQUE,
    location      NVARCHAR(100) NULL,
    description   NVARCHAR(500) NULL,
    created_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_departments_created_at DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.doctors (
    doctor_id        INT IDENTITY(1,1) CONSTRAINT PK_doctors PRIMARY KEY,
    full_name        NVARCHAR(100) NOT NULL,
    department_id    INT NOT NULL CONSTRAINT FK_doctors_departments REFERENCES dbo.departments(department_id),
    specialization   NVARCHAR(100) NULL,
    phone            VARCHAR(15)   NULL,
    email            VARCHAR(100)  NULL,
    consultation_fee DECIMAL(12,2) NOT NULL CONSTRAINT DF_doctors_fee DEFAULT 0
                                   CONSTRAINT CK_doctors_fee CHECK (consultation_fee >= 0),
    is_active        BIT           NOT NULL CONSTRAINT DF_doctors_active DEFAULT 1,
    hired_at         DATE          NULL
);
GO

CREATE TABLE dbo.patients (
    patient_id      INT IDENTITY(1,1) CONSTRAINT PK_patients PRIMARY KEY,
    full_name       NVARCHAR(100) NOT NULL,
    date_of_birth   DATE          NOT NULL,
    gender          CHAR(1)       NOT NULL CONSTRAINT CK_patients_gender CHECK (gender IN ('M','F','O')),
    phone           VARCHAR(15)   NULL,
    email           VARCHAR(100)  NULL,
    address         NVARCHAR(255) NULL,
    blood_type      VARCHAR(3)    NULL CONSTRAINT CK_patients_blood CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    medical_history NVARCHAR(MAX) NULL,
    created_at      DATETIME2(0)  NOT NULL CONSTRAINT DF_patients_created_at DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.users (
    user_id       INT IDENTITY(1,1) CONSTRAINT PK_users PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL CONSTRAINT UQ_users_username UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     NVARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('ADMIN','RECEPTIONIST','DOCTOR')),
    doctor_id     INT NULL CONSTRAINT FK_users_doctors REFERENCES dbo.doctors(doctor_id),
    is_active     BIT          NOT NULL CONSTRAINT DF_users_active DEFAULT 1,
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_users_doctor_role CHECK (role <> 'DOCTOR' OR doctor_id IS NOT NULL)
);
GO

CREATE TABLE dbo.time_slots (
    slot_id    INT IDENTITY(1,1) CONSTRAINT PK_time_slots PRIMARY KEY,
    doctor_id  INT     NOT NULL CONSTRAINT FK_time_slots_doctors REFERENCES dbo.doctors(doctor_id),
    slot_date  DATE    NOT NULL,
    start_time TIME(0) NOT NULL,
    end_time   TIME(0) NOT NULL,
    is_booked  BIT     NOT NULL CONSTRAINT DF_time_slots_booked DEFAULT 0,
    CONSTRAINT UQ_time_slots UNIQUE (doctor_id, slot_date, start_time),
    CONSTRAINT CK_time_slots_range CHECK (end_time > start_time)
);
GO

CREATE TABLE dbo.appointments (
    appointment_id INT IDENTITY(1,1) CONSTRAINT PK_appointments PRIMARY KEY,
    patient_id     INT NOT NULL CONSTRAINT FK_appointments_patients REFERENCES dbo.patients(patient_id),
    slot_id        INT NOT NULL CONSTRAINT FK_appointments_slots REFERENCES dbo.time_slots(slot_id),
    status         VARCHAR(20) NOT NULL CONSTRAINT DF_appointments_status DEFAULT 'SCHEDULED'
                   CONSTRAINT CK_appointments_status CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
    reason         NVARCHAR(255) NULL,
    created_by     INT NULL CONSTRAINT FK_appointments_users REFERENCES dbo.users(user_id),
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_appointments_created_at DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(0) NULL
);
GO

-- At most one non-cancelled appointment per slot: last line of defence against double-booking (topic v).
CREATE UNIQUE INDEX UX_appointments_active_slot
    ON dbo.appointments(slot_id)
    WHERE status IN ('SCHEDULED','COMPLETED','NO_SHOW');
GO

CREATE TABLE dbo.visits (
    visit_id       INT IDENTITY(1,1) CONSTRAINT PK_visits PRIMARY KEY,
    appointment_id INT NULL CONSTRAINT FK_visits_appointments REFERENCES dbo.appointments(appointment_id),
    patient_id     INT NOT NULL CONSTRAINT FK_visits_patients REFERENCES dbo.patients(patient_id),
    doctor_id      INT NOT NULL CONSTRAINT FK_visits_doctors REFERENCES dbo.doctors(doctor_id),
    visit_date     DATETIME2(0)  NOT NULL CONSTRAINT DF_visits_date DEFAULT SYSUTCDATETIME(),
    symptoms       NVARCHAR(500) NULL,
    diagnosis      NVARCHAR(500) NULL,
    notes          NVARCHAR(MAX) NULL
);
GO

-- Walk-in visits have no appointment; an appointment leads to at most one visit.
CREATE UNIQUE INDEX UX_visits_appointment ON dbo.visits(appointment_id) WHERE appointment_id IS NOT NULL;
GO

CREATE TABLE dbo.medicines (
    medicine_id    INT IDENTITY(1,1) CONSTRAINT PK_medicines PRIMARY KEY,
    name           NVARCHAR(150) NOT NULL CONSTRAINT UQ_medicines_name UNIQUE,
    unit           NVARCHAR(20)  NOT NULL,
    unit_price     DECIMAL(12,2) NOT NULL CONSTRAINT CK_medicines_price CHECK (unit_price >= 0),
    stock_quantity INT           NOT NULL CONSTRAINT DF_medicines_stock DEFAULT 0
                                 CONSTRAINT CK_medicines_stock CHECK (stock_quantity >= 0),
    row_version    ROWVERSION
);
GO

CREATE TABLE dbo.prescriptions (
    prescription_id INT IDENTITY(1,1) CONSTRAINT PK_prescriptions PRIMARY KEY,
    visit_id        INT NOT NULL CONSTRAINT FK_prescriptions_visits REFERENCES dbo.visits(visit_id)
                    CONSTRAINT UQ_prescriptions_visit UNIQUE,
    notes           NVARCHAR(500) NULL,
    created_at      DATETIME2(0)  NOT NULL CONSTRAINT DF_prescriptions_created_at DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.prescription_items (
    prescription_id INT NOT NULL CONSTRAINT FK_items_prescriptions REFERENCES dbo.prescriptions(prescription_id) ON DELETE CASCADE,
    medicine_id     INT NOT NULL CONSTRAINT FK_items_medicines REFERENCES dbo.medicines(medicine_id),
    quantity        INT NOT NULL CONSTRAINT CK_items_quantity CHECK (quantity > 0),
    dosage          NVARCHAR(200) NOT NULL,
    unit_price      DECIMAL(12,2) NOT NULL,  -- price at prescribing time
    CONSTRAINT PK_prescription_items PRIMARY KEY (prescription_id, medicine_id)
);
GO

CREATE TABLE dbo.invoices (
    invoice_id       INT IDENTITY(1,1) CONSTRAINT PK_invoices PRIMARY KEY,
    visit_id         INT NOT NULL CONSTRAINT FK_invoices_visits REFERENCES dbo.visits(visit_id)
                     CONSTRAINT UQ_invoices_visit UNIQUE,
    consultation_fee DECIMAL(12,2) NOT NULL,
    medicine_total   DECIMAL(12,2) NOT NULL CONSTRAINT DF_invoices_medicine_total DEFAULT 0,
    total_amount     AS (consultation_fee + medicine_total) PERSISTED,
    status           VARCHAR(10) NOT NULL CONSTRAINT DF_invoices_status DEFAULT 'UNPAID'
                     CONSTRAINT CK_invoices_status CHECK (status IN ('UNPAID','PAID','VOID')),
    issued_at        DATETIME2(0) NOT NULL CONSTRAINT DF_invoices_issued_at DEFAULT SYSUTCDATETIME(),
    paid_at          DATETIME2(0) NULL
);
GO
