import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria. Conecta la base PostgreSQL de Railway al servicio web.');
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres. Configúrala en las variables de Railway.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
});

async function migrate() {
  await pool.query(`
    create table if not exists users (
      id uuid primary key, full_name text not null, clinic_name text, email text not null unique,
      password_hash text not null, created_at timestamptz not null default now()
    );
    create table if not exists patients (
      id uuid primary key, owner_id uuid not null references users(id) on delete cascade,
      full_name text not null, phone text, email text, birth_date date, allergies text, notes text,
      created_at timestamptz not null default now()
    );
    alter table patients add column if not exists medical_history text;
    alter table patients add column if not exists medications text;
    alter table patients add column if not exists emergency_contact text;
    alter table patients add column if not exists reason_for_visit text;
    create index if not exists patients_owner_name_idx on patients (owner_id, full_name);
    create table if not exists appointments (
      id uuid primary key, owner_id uuid not null references users(id) on delete cascade,
      patient_id uuid not null references patients(id) on delete cascade, starts_at timestamptz not null,
      duration_minutes integer not null default 30 check (duration_minutes between 10 and 240),
      appointment_type text not null, status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
      notes text, created_at timestamptz not null default now()
    );
    create index if not exists appointments_owner_starts_idx on appointments (owner_id, starts_at);
    create table if not exists treatments (
      id uuid primary key, owner_id uuid not null references users(id) on delete cascade,
      patient_id uuid not null references patients(id) on delete cascade, treatment_name text not null,
      tooth text, status text not null default 'active' check (status in ('active', 'completed')),
      estimated_cost numeric(12,2), notes text, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists treatments_owner_patient_idx on treatments (owner_id, patient_id);
    create table if not exists tooth_records (
      id uuid primary key, owner_id uuid not null references users(id) on delete cascade,
      patient_id uuid not null references patients(id) on delete cascade, tooth_number text not null,
      status text not null default 'healthy' check (status in ('healthy', 'treatment', 'missing', 'watch')),
      notes text, updated_at timestamptz not null default now(),
      unique (owner_id, patient_id, tooth_number)
    );
    create table if not exists clinical_notes (
      id uuid primary key, owner_id uuid not null references users(id) on delete cascade,
      patient_id uuid not null references patients(id) on delete cascade,
      visit_date date not null default current_date, diagnosis text, procedure_done text not null,
      indications text, next_visit date, created_at timestamptz not null default now()
    );
    create index if not exists clinical_notes_owner_patient_idx on clinical_notes (owner_id, patient_id, visit_date desc);
  `);
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
// Las respuestas de sesión y agenda no deben quedar en la caché del navegador.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const authAttempts = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);

function publicUser(row) { return { id: row.id, fullName: row.full_name, clinicName: row.clinic_name, email: row.email }; }
function issueToken(user) { return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: '7d', issuer: 'odontia' }); }
function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

function requireUser(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    console.warn('Sesión rechazada: no se recibió credencial.');
    return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  }
  try { req.user = jwt.verify(token, jwtSecret, { issuer: 'odontia' }); return next(); }
  catch (error) {
    console.warn('Sesión rechazada:', error.name, error.message);
    return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo.' });
  }
}

app.get('/api/health', asyncRoute(async (_req, res) => { await pool.query('select 1'); res.json({ ok: true }); }));

app.post('/api/auth/register', authAttempts, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const clinicName = String(req.body.clinicName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (fullName.length < 2 || !emailPattern.test(email) || password.length < 8) return res.status(400).json({ error: 'Completa tu nombre, un correo válido y una contraseña de al menos 8 caracteres.' });
  const user = { id: crypto.randomUUID(), fullName, clinicName: clinicName || null, email };
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query('insert into users (id, full_name, clinic_name, email, password_hash) values ($1, $2, $3, $4, $5)', [user.id, user.fullName, user.clinicName, user.email, passwordHash]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    throw error;
  }
  res.status(201).json({ token: issueToken(user), user });
}));

app.post('/api/auth/login', authAttempts, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query('select * from users where email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const safeUser = publicUser(user);
  res.json({ token: issueToken(safeUser), user: safeUser });
}));

app.get('/api/auth/me', requireUser, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('select id, full_name, clinic_name, email from users where id = $1', [req.user.sub]);
  if (!rows[0]) {
    console.warn('Sesión rechazada: la cuenta ya no existe.', { userId: req.user.sub });
    return res.status(401).json({ error: 'Cuenta no encontrada.' });
  }
  res.json({ user: publicUser(rows[0]) });
}));

app.get('/api/appointments', requireUser, asyncRoute(async (req, res) => {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const from = validDate(req.query.from) ? req.query.from : today;
  const to = validDate(req.query.to) ? req.query.to : from;
  if (to < from) return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  const { rows } = await pool.query(`select a.id, a.starts_at, a.duration_minutes, a.appointment_type, a.status, p.full_name as patient_name
    from appointments a join patients p on p.id = a.patient_id
    where a.owner_id = $1 and a.starts_at >= ($2::date at time zone 'America/Mexico_City')
      and a.starts_at < (($3::date + interval '1 day') at time zone 'America/Mexico_City')
    order by a.starts_at asc limit 250`, [req.user.sub, from, to]);
  const statuses = { pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Atendida', cancelled: 'Cancelada' };
  res.json({ appointments: rows.map(row => ({ id: row.id, startsAt: row.starts_at, time: new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }).format(new Date(row.starts_at)), patient: row.patient_name, type: row.appointment_type, duration: `${row.duration_minutes} min`, durationMinutes: row.duration_minutes, status: statuses[row.status], statusKey: row.status, initials: row.patient_name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() })) });
}));

app.get('/api/patients', requireUser, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`select p.id, p.full_name, p.phone, p.email, p.birth_date, p.allergies, p.notes, p.medical_history, p.medications, p.emergency_contact, p.reason_for_visit, p.created_at,
      count(a.id)::integer as appointment_count, max(a.starts_at) as last_appointment
    from patients p left join appointments a on a.patient_id = p.id and a.owner_id = p.owner_id
    where p.owner_id = $1 group by p.id order by p.full_name asc`, [req.user.sub]);
  res.json({ patients: rows.map(row => ({
    id: row.id, fullName: row.full_name, phone: row.phone, email: row.email, birthDate: row.birth_date, allergies: row.allergies, notes: row.notes,
    medicalHistory: row.medical_history, medications: row.medications, emergencyContact: row.emergency_contact, reasonForVisit: row.reason_for_visit, appointmentCount: row.appointment_count, lastAppointment: row.last_appointment,
  })) });
}));

app.post('/api/patients', requireUser, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const allergies = String(req.body.allergies || '').trim();
  const notes = String(req.body.notes || '').trim();
  const birthDate = String(req.body.birthDate || '').trim();
  const medicalHistory = String(req.body.medicalHistory || '').trim();
  const medications = String(req.body.medications || '').trim();
  const emergencyContact = String(req.body.emergencyContact || '').trim();
  const reasonForVisit = String(req.body.reasonForVisit || '').trim();
  if (fullName.length < 2 || (email && !emailPattern.test(email))) return res.status(400).json({ error: 'Agrega un nombre y, si aplica, un correo válido.' });
  const id = crypto.randomUUID();
  await pool.query(`insert into patients (id, owner_id, full_name, phone, email, birth_date, allergies, notes, medical_history, medications, emergency_contact, reason_for_visit)
    values ($1, $2, $3, $4, $5, nullif($6, '')::date, $7, $8, $9, $10, $11, $12)`, [id, req.user.sub, fullName, phone || null, email || null, birthDate, allergies || null, notes || null, medicalHistory || null, medications || null, emergencyContact || null, reasonForVisit || null]);
  res.status(201).json({ id });
}));

app.patch('/api/patients/:id', requireUser, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const allergies = String(req.body.allergies || '').trim();
  const notes = String(req.body.notes || '').trim();
  const birthDate = String(req.body.birthDate || '').trim();
  const medicalHistory = String(req.body.medicalHistory || '').trim();
  const medications = String(req.body.medications || '').trim();
  const emergencyContact = String(req.body.emergencyContact || '').trim();
  const reasonForVisit = String(req.body.reasonForVisit || '').trim();
  if (fullName.length < 2 || (email && !emailPattern.test(email))) return res.status(400).json({ error: 'Agrega un nombre y, si aplica, un correo válido.' });
  const { rowCount } = await pool.query(`update patients set full_name = $1, phone = $2, email = $3, birth_date = nullif($4, '')::date, allergies = $5, notes = $6,
    medical_history = $7, medications = $8, emergency_contact = $9, reason_for_visit = $10 where id = $11 and owner_id = $12`, [fullName, phone || null, email || null, birthDate, allergies || null, notes || null, medicalHistory || null, medications || null, emergencyContact || null, reasonForVisit || null, req.params.id, req.user.sub]);
  if (!rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
  res.json({ ok: true });
}));

app.get('/api/patients/:id/profile', requireUser, asyncRoute(async (req, res) => {
  const patient = await pool.query(`select id, full_name, phone, email, birth_date, allergies, notes, medical_history, medications, emergency_contact, reason_for_visit, created_at
    from patients where id = $1 and owner_id = $2`, [req.params.id, req.user.sub]);
  if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
  const [appointments, treatments, notes] = await Promise.all([
    pool.query(`select starts_at, appointment_type, status from appointments where owner_id = $1 and patient_id = $2 order by starts_at desc limit 30`, [req.user.sub, req.params.id]),
    pool.query(`select treatment_name, tooth, status, estimated_cost, notes, created_at from treatments where owner_id = $1 and patient_id = $2 order by created_at desc`, [req.user.sub, req.params.id]),
    pool.query(`select id, visit_date, diagnosis, procedure_done, indications, next_visit from clinical_notes where owner_id = $1 and patient_id = $2 order by visit_date desc, created_at desc`, [req.user.sub, req.params.id]),
  ]);
  res.json({ patient: patient.rows[0], appointments: appointments.rows, treatments: treatments.rows, clinicalNotes: notes.rows });
}));

app.post('/api/patients/:id/clinical-notes', requireUser, asyncRoute(async (req, res) => {
  const procedureDone = String(req.body.procedureDone || '').trim();
  const diagnosis = String(req.body.diagnosis || '').trim();
  const indications = String(req.body.indications || '').trim();
  const visitDate = String(req.body.visitDate || '').trim();
  const nextVisit = String(req.body.nextVisit || '').trim();
  if (procedureDone.length < 2 || (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) || (nextVisit && !/^\d{4}-\d{2}-\d{2}$/.test(nextVisit))) return res.status(400).json({ error: 'Registra el procedimiento y revisa las fechas.' });
  const patient = await pool.query('select 1 from patients where id = $1 and owner_id = $2', [req.params.id, req.user.sub]);
  if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
  await pool.query(`insert into clinical_notes (id, owner_id, patient_id, visit_date, diagnosis, procedure_done, indications, next_visit)
    values ($1, $2, $3, coalesce(nullif($4, '')::date, current_date), $5, $6, $7, nullif($8, '')::date)`, [crypto.randomUUID(), req.user.sub, req.params.id, visitDate, diagnosis || null, procedureDone, indications || null, nextVisit]);
  res.status(201).json({ ok: true });
}));

app.get('/api/treatments', requireUser, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`select t.id, t.treatment_name, t.tooth, t.status, t.estimated_cost, t.notes, t.created_at,
    p.full_name as patient_name from treatments t join patients p on p.id = t.patient_id
    where t.owner_id = $1 order by case when t.status = 'active' then 0 else 1 end, t.created_at desc`, [req.user.sub]);
  res.json({ treatments: rows.map(row => ({ id: row.id, name: row.treatment_name, tooth: row.tooth, status: row.status,
    estimatedCost: row.estimated_cost, notes: row.notes, createdAt: row.created_at, patientName: row.patient_name })) });
}));

app.post('/api/treatments', requireUser, asyncRoute(async (req, res) => {
  const patientId = String(req.body.patientId || '');
  const name = String(req.body.name || '').trim();
  const tooth = String(req.body.tooth || '').trim();
  const notes = String(req.body.notes || '').trim();
  const estimatedCost = req.body.estimatedCost === '' || req.body.estimatedCost == null ? null : Number(req.body.estimatedCost);
  if (!patientId || name.length < 2 || (estimatedCost !== null && (!Number.isFinite(estimatedCost) || estimatedCost < 0))) return res.status(400).json({ error: 'Selecciona un paciente y completa los datos del tratamiento.' });
  const exists = await pool.query('select 1 from patients where id = $1 and owner_id = $2', [patientId, req.user.sub]);
  if (!exists.rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
  await pool.query(`insert into treatments (id, owner_id, patient_id, treatment_name, tooth, estimated_cost, notes)
    values ($1, $2, $3, $4, $5, $6, $7)`, [crypto.randomUUID(), req.user.sub, patientId, name, tooth || null, estimatedCost, notes || null]);
  res.status(201).json({ ok: true });
}));

app.patch('/api/treatments/:id/status', requireUser, asyncRoute(async (req, res) => {
  const status = String(req.body.status || '');
  if (!['active', 'completed'].includes(status)) return res.status(400).json({ error: 'Estado no válido.' });
  const { rowCount } = await pool.query('update treatments set status = $1, updated_at = now() where id = $2 and owner_id = $3', [status, req.params.id, req.user.sub]);
  if (!rowCount) return res.status(404).json({ error: 'Tratamiento no encontrado.' });
  res.json({ ok: true });
}));

app.get('/api/odontogram', requireUser, asyncRoute(async (req, res) => {
  const patientId = String(req.query.patientId || '');
  if (!patientId) return res.status(400).json({ error: 'Selecciona un paciente.' });
  const { rows } = await pool.query(`select tooth_number, status, notes, updated_at from tooth_records
    where owner_id = $1 and patient_id = $2 order by tooth_number`, [req.user.sub, patientId]);
  res.json({ records: rows.map(row => ({ toothNumber: row.tooth_number, status: row.status, notes: row.notes, updatedAt: row.updated_at })) });
}));

app.put('/api/odontogram/:toothNumber', requireUser, asyncRoute(async (req, res) => {
  const patientId = String(req.body.patientId || '');
  const toothNumber = String(req.params.toothNumber || '');
  const status = String(req.body.status || 'healthy');
  const notes = String(req.body.notes || '').trim();
  if (!patientId || !/^(?:[1-4][1-8]|[5-8][1-5])$/.test(toothNumber) || !['healthy', 'treatment', 'missing', 'watch'].includes(status)) return res.status(400).json({ error: 'Datos de pieza dental no válidos.' });
  const patient = await pool.query('select 1 from patients where id = $1 and owner_id = $2', [patientId, req.user.sub]);
  if (!patient.rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
  await pool.query(`insert into tooth_records (id, owner_id, patient_id, tooth_number, status, notes)
    values ($1, $2, $3, $4, $5, $6)
    on conflict (owner_id, patient_id, tooth_number) do update set status = excluded.status, notes = excluded.notes, updated_at = now()`, [crypto.randomUUID(), req.user.sub, patientId, toothNumber, status, notes || null]);
  res.json({ ok: true });
}));

app.post('/api/appointments', requireUser, asyncRoute(async (req, res) => {
  const patientName = String(req.body.patientName || '').trim();
  const appointmentType = String(req.body.appointmentType || '').trim();
  const startsAt = new Date(req.body.startsAt);
  const duration = Number(req.body.durationMinutes || 30);
  if (patientName.length < 2 || appointmentType.length < 2 || Number.isNaN(startsAt.valueOf()) || duration < 10 || duration > 240) return res.status(400).json({ error: 'Revisa los datos de la cita.' });
  const conflict = await pool.query(`select 1 from appointments where owner_id = $1 and status <> 'cancelled'
    and starts_at < $2::timestamptz + ($3::int * interval '1 minute')
    and starts_at + (duration_minutes * interval '1 minute') > $2::timestamptz limit 1`, [req.user.sub, startsAt.toISOString(), duration]);
  if (conflict.rowCount) return res.status(409).json({ error: 'Ya existe una cita que ocupa ese horario.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const existing = await client.query('select id from patients where owner_id = $1 and lower(full_name) = lower($2) limit 1', [req.user.sub, patientName]);
    const patientId = existing.rows[0]?.id || crypto.randomUUID();
    if (!existing.rows[0]) await client.query('insert into patients (id, owner_id, full_name) values ($1, $2, $3)', [patientId, req.user.sub, patientName]);
    await client.query('insert into appointments (id, owner_id, patient_id, starts_at, duration_minutes, appointment_type) values ($1, $2, $3, $4, $5, $6)', [crypto.randomUUID(), req.user.sub, patientId, startsAt.toISOString(), duration, appointmentType]);
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  res.status(201).json({ ok: true });
}));

app.patch('/api/appointments/:id', requireUser, asyncRoute(async (req, res) => {
  const appointmentType = String(req.body.appointmentType || '').trim();
  const startsAt = new Date(req.body.startsAt);
  const duration = Number(req.body.durationMinutes || 30);
  const status = String(req.body.status || 'pending');
  if (appointmentType.length < 2 || Number.isNaN(startsAt.valueOf()) || duration < 10 || duration > 240 || !validStatuses.has(status)) return res.status(400).json({ error: 'Revisa los datos de la cita.' });
  if (status !== 'cancelled') {
    const conflict = await pool.query(`select 1 from appointments where owner_id = $1 and id <> $2 and status <> 'cancelled'
      and starts_at < $3::timestamptz + ($4::int * interval '1 minute')
      and starts_at + (duration_minutes * interval '1 minute') > $3::timestamptz limit 1`, [req.user.sub, req.params.id, startsAt.toISOString(), duration]);
    if (conflict.rowCount) return res.status(409).json({ error: 'Ya existe una cita que ocupa ese horario.' });
  }
  const { rowCount } = await pool.query(`update appointments set starts_at = $1, duration_minutes = $2, appointment_type = $3, status = $4
    where id = $5 and owner_id = $6`, [startsAt.toISOString(), duration, appointmentType, status, req.params.id, req.user.sub]);
  if (!rowCount) return res.status(404).json({ error: 'Cita no encontrada.' });
  res.json({ ok: true });
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(express.static(path.join(__dirname, 'dist'), { index: false, maxAge: '1h' }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Ocurrió un error inesperado.' }); });

migrate().then(() => app.listen(port, '0.0.0.0', () => console.log(`Odontia lista en puerto ${port}`))).catch(error => { console.error('No fue posible preparar la base de datos.', error); process.exit(1); });
