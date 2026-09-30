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

-- Cada clínica usa como id el id de la cuenta titular; así se conservan
-- compatibles los datos existentes mientras el sistema se vuelve multi-clínica.
create table if not exists clinics (
  id uuid primary key references users(id) on delete cascade,
  name text not null,
  owner_user_id uuid not null unique references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists clinic_members (
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null unique references users(id) on delete cascade,
  role text not null check (role in ('owner', 'dentist', 'assistant', 'reception')),
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table if not exists clinic_invites (
  id uuid primary key,
  clinic_id uuid not null references clinics(id) on delete cascade,
  email text not null,
  role text not null check (role in ('dentist', 'assistant', 'reception')),
  code text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
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

create table if not exists treatment_payments (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  treatment_id uuid not null references treatments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists treatment_payments_owner_treatment_idx on treatment_payments (owner_id, treatment_id, payment_date desc);

-- Bitácora de auditoría. La aplicación solo agrega eventos; no expone una ruta para eliminarlos.
create table if not exists audit_events (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  actor_id uuid not null references users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_owner_created_idx on audit_events (owner_id, created_at desc);
