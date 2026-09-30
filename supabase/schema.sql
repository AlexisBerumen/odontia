-- Ejecuta este archivo en el SQL Editor de tu proyecto de Supabase.
-- Todas las tablas se asocian a un profesional para mantener los datos privados.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  clinic_name text,
  created_at timestamptz default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  allergies text,
  notes text,
  created_at timestamptz default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  appointment_type text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own patients" on public.patients for all using (auth.uid() = dentist_id) with check (auth.uid() = dentist_id);
create policy "own appointments" on public.appointments for all using (auth.uid() = dentist_id) with check (auth.uid() = dentist_id);
