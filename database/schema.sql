-- Esquema de Odontia para PostgreSQL en Railway.
-- El servidor lo aplica automáticamente al iniciar; este archivo es una referencia.
create table if not exists users (
  id uuid primary key,
  full_name text not null,
  clinic_name text,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  allergies text,
  notes text,
  medical_history text,
  medications text,
  emergency_contact text,
  reason_for_visit text,
  created_at timestamptz not null default now()
);

create index if not exists patients_owner_name_idx on patients (owner_id, full_name);

create table if not exists appointments (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 10 and 240),
  appointment_type text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_owner_starts_idx on appointments (owner_id, starts_at);

create table if not exists treatments (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  treatment_name text not null,
  tooth text,
  status text not null default 'active' check (status in ('active', 'completed')),
  estimated_cost numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treatments_owner_patient_idx on treatments (owner_id, patient_id);

create table if not exists tooth_records (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  tooth_number text not null,
  status text not null default 'healthy' check (status in ('healthy', 'treatment', 'missing', 'watch')),
  notes text,
  updated_at timestamptz not null default now(),
  unique (owner_id, patient_id, tooth_number)
);

create table if not exists clinical_notes (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_date date not null default current_date,
  diagnosis text,
  procedure_done text not null,
  indications text,
  next_visit date,
  created_at timestamptz not null default now()
);

create index if not exists clinical_notes_owner_patient_idx on clinical_notes (owner_id, patient_id, visit_date desc);
