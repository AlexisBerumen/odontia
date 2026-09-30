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
