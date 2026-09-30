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
  const { rows } = await pool.query(`select p.id, p.full_name, p.phone, p.email, p.allergies, p.notes, p.created_at,
      count(a.id)::integer as appointment_count, max(a.starts_at) as last_appointment
    from patients p left join appointments a on a.patient_id = p.id and a.owner_id = p.owner_id
    where p.owner_id = $1 group by p.id order by p.full_name asc`, [req.user.sub]);
  res.json({ patients: rows.map(row => ({
    id: row.id, fullName: row.full_name, phone: row.phone, email: row.email, allergies: row.allergies,
    notes: row.notes, appointmentCount: row.appointment_count, lastAppointment: row.last_appointment,
  })) });
}));

app.post('/api/patients', requireUser, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const allergies = String(req.body.allergies || '').trim();
  const notes = String(req.body.notes || '').trim();
  if (fullName.length < 2 || (email && !emailPattern.test(email))) return res.status(400).json({ error: 'Agrega un nombre y, si aplica, un correo válido.' });
  const id = crypto.randomUUID();
  await pool.query('insert into patients (id, owner_id, full_name, phone, email, allergies, notes) values ($1, $2, $3, $4, $5, $6, $7)', [id, req.user.sub, fullName, phone || null, email || null, allergies || null, notes || null]);
  res.status(201).json({ id });
}));

app.patch('/api/patients/:id', requireUser, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const allergies = String(req.body.allergies || '').trim();
  const notes = String(req.body.notes || '').trim();
  if (fullName.length < 2 || (email && !emailPattern.test(email))) return res.status(400).json({ error: 'Agrega un nombre y, si aplica, un correo válido.' });
  const { rowCount } = await pool.query(`update patients set full_name = $1, phone = $2, email = $3, allergies = $4, notes = $5
    where id = $6 and owner_id = $7`, [fullName, phone || null, email || null, allergies || null, notes || null, req.params.id, req.user.sub]);
  if (!rowCount) return res.status(404).json({ error: 'Paciente no encontrado.' });
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
