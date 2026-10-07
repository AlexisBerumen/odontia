import './style.css';
import './patients.css';
import './agenda.css';
import './treatments.css';
import './odontogram.css';
import './tooth-icons.css';
import './profile.css';
import './context-nav.css';
import './payments.css';
import './payment-history.css';
import './audit.css';
import './team.css';
import './mobile.css';
import './reminders.css';

let token = localStorage.getItem('odontia-token');
let user;
let appointments = [];
let patients = [];
let editingPatient = null;
let patientProfile = null;
let treatments = [];
let editingTreatment = null;
let paymentTreatment = null;
let treatmentPayments = [];
let editingPayment = null;
let odontogramRecords = [];
let odontogramPatientId = '';
let selectedTooth = '11';
let agendaAppointments = [];
let editingAppointment = null;
let creatingFromAgenda = false;
let auditEvents = [];
let teamData = null;
let filter = 'Todas';
const today = new Date();
let agendaStart = mondayOf(today);
const isoToday = today.toISOString().slice(0, 10);
const dateText = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
const esc = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const initials = name => name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
function dateValue(date) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); const get = type => parts.find(part => part.type === type).value; return `${get('year')}-${get('month')}-${get('day')}`; }
function mondayOf(date) { const copy = new Date(date); const shift = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - shift); copy.setHours(12,0,0,0); return copy; }
function addDays(date, days) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
const icon = name => ({
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
  users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 5.8M17 14c2.4.4 4 2.4 4 5"/></svg>',
  tooth:'<svg viewBox="0 0 24 24"><path d="M7.2 3.7C9 3 10.1 4.2 12 4.2s3-1.2 4.8-.5c2.8 1.1 3.1 4.4 1.5 7.2-1.3 2.3-1.4 6.9-3.2 8.9-.9 1-1.9.4-2.1-.6L12 14l-.9 5.2c-.2 1-1.2 1.6-2.1.6-1.8-2-1.9-6.6-3.2-8.9-1.6-2.8-1.4-6.1 1.4-7.2Z"/></svg>',
  chart:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M5 12h14M12 5v14"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  bell:'<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  chevron:'<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  message:'<svg viewBox="0 0 24 24"><path d="M21 11.5a8 8 0 0 1-8.5 8 9.4 9.4 0 0 1-3.8-.8L3 20.5l1.7-5.2A7.6 7.6 0 0 1 4 11.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 8Z"/></svg>'
}[name] || '');

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, cache:'no-store', headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No fue posible completar la operación.');
  return body;
}

function authPage() {
  document.querySelector('#app').innerHTML = `<main class="auth-page"><section class="auth-card"><a class="brand auth-brand"><span class="brand-mark">O</span><span>odontia</span></a><div id="auth-copy"><p class="eyebrow">GESTIÓN DENTAL EN LÍNEA</p><h1>Tu consultorio,<br/>siempre contigo.</h1><p>Crea tu cuenta para guardar y consultar tu agenda desde cualquier dispositivo.</p></div><form id="auth-form"><label id="name-label">Nombre completo<input required name="fullName" autocomplete="name" placeholder="Dra. Andrea López"/></label><label id="clinic-label">Nombre del consultorio <em>(opcional)</em><input name="clinicName" placeholder="Clínica Sonrisa"/></label><label>Correo electrónico<input required type="email" name="email" autocomplete="email" placeholder="tu@consultorio.com"/></label><label>Contraseña<input required type="password" name="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"/></label><p class="form-error" id="form-error"></p><button class="save-appointment" id="auth-submit">Crear cuenta</button></form><p class="auth-switch" id="switch-line">¿Ya tienes una cuenta? <button id="mode-toggle">Inicia sesión</button></p></section><aside class="auth-aside"><div><span class="auth-tooth">${icon('tooth')}</span><h2>Una agenda clara.<br/>Un mejor cuidado.</h2><p>Odontia te ayuda a dedicar más tiempo a tus pacientes.</p></div></aside></main>`;
  let register = true;
  const form = document.querySelector('#auth-form');
  document.querySelector('#clinic-label').insertAdjacentHTML('afterend', '<label id="invite-label">Código de invitación <em>(solo personal)</em><input name="inviteCode" autocomplete="off" placeholder="Ej. A1B2C3D4"/></label>');
  const setMode = () => {
    document.querySelector('#name-label').hidden = !register; document.querySelector('#clinic-label').hidden = !register;
    document.querySelector('#invite-label').hidden = !register;
    document.querySelector('#auth-submit').textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    document.querySelector('#switch-line').innerHTML = register ? '¿Ya tienes una cuenta? <button id="mode-toggle">Inicia sesión</button>' : '¿Aún no tienes cuenta? <button id="mode-toggle">Crear cuenta</button>';
    form.password.autocomplete = register ? 'new-password' : 'current-password';
    document.querySelector('#mode-toggle').onclick = () => { register = !register; setMode(); };
  };
  document.querySelector('#mode-toggle').onclick = () => { register = false; setMode(); };
  form.onsubmit = async event => {
    event.preventDefault(); const submit = document.querySelector('#auth-submit'); const error = document.querySelector('#form-error'); error.textContent = ''; submit.disabled = true;
    try { const payload = Object.fromEntries(new FormData(form)); const data = await api(register ? '/api/auth/register' : '/api/auth/login', { method:'POST', body:JSON.stringify(payload) }); token = data.token; localStorage.setItem('odontia-token', token); user = (await api('/api/auth/me')).user; await loadDashboard(); }
    catch (err) { error.textContent = err.message; submit.disabled = false; }
  };
}

const nav = (label, name, active = false) => {
  const displayLabel = label === 'Reportes' ? 'Bitácora' : label;
  return `<button class="nav-item ${active ? 'active' : ''}" data-section="${label}">${icon(name)}<span>${displayLabel}</span></button>`;
};
const auditLabels = {
  'patient.created':'Expediente creado', 'patient.created_from_appointment':'Paciente creado al agendar', 'patient.updated':'Expediente actualizado',
  'clinical_note.created':'Evolución clínica registrada', 'treatment.created':'Tratamiento creado', 'treatment.updated':'Tratamiento actualizado',
  'treatment.status_updated':'Estado de tratamiento actualizado', 'payment.created':'Abono registrado', 'payment.updated':'Abono corregido',
  'odontogram.created':'Pieza registrada en odontograma', 'odontogram.updated':'Pieza actualizada en odontograma',
  'appointment.created':'Cita creada', 'appointment.updated':'Cita actualizada', 'appointment.reminder_marked':'Recordatorio de WhatsApp marcado como enviado', 'team.invite_created':'Invitación de equipo creada',
};
const statusLabels = {
  active:'Activo', completed:'Finalizado', pending:'Pendiente', confirmed:'Confirmada', cancelled:'Cancelada',
  healthy:'Sano', treatment:'En tratamiento', watch:'Vigilar', missing:'Ausente',
};
function auditDetail(event) {
  const data = event.details || {};
  if (Array.isArray(data.fields) && data.fields.length) return `Campos modificados: ${data.fields.join(', ')}.`;
  if (event.action === 'payment.created') return `Monto registrado: ${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(data.amount || 0))}.`;
  if (event.action === 'payment.updated') return `Monto corregido de ${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(data.previousAmount || 0))} a ${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(data.newAmount || 0))}.`;
  if (data.previousStatus || data.newStatus) return `Estado: ${statusLabels[data.previousStatus] || data.previousStatus || 'Sin registro'} → ${statusLabels[data.newStatus] || data.newStatus || 'Sin registro'}.`;
  if (data.procedure) return 'Se añadió una evolución al expediente.';
  return 'Registro de seguridad.';
}
function auditPage() {
  const date = value => new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users')}${nav('Tratamientos','tooth')}${nav('Bitácora','chart',true)}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="agenda-title-small">Seguridad</div><div class="header-actions"><button class="new-appointment audit-refresh" id="audit-refresh">Actualizar</button></div></header><div class="content audit-content"><div class="page-heading"><div><p class="eyebrow">HUELLA DE SEGURIDAD</p><h1>Bitácora de cambios</h1><p>Consulta quién registró o corrigió información. Los eventos no se pueden editar desde Odontia.</p></div></div><section class="panel audit-list">${auditEvents.map(event => `<article class="audit-event"><div class="audit-mark">${icon('chart')}</div><div class="audit-main"><strong>${esc(auditLabels[event.action] || 'Cambio registrado')}</strong><span>${esc(event.entityName || 'Sin referencia')}</span><p>${esc(auditDetail(event))}</p></div><div class="audit-meta"><b>${esc(event.actorName)}</b><time>${date(event.createdAt)}</time></div></article>`).join('') || '<p class="empty">Todavía no hay cambios registrados. Los nuevos movimientos aparecerán aquí.</p>'}</section></div></main></div>`;
  document.querySelector('#audit-refresh').onclick = loadAudit;
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section === 'Tratamientos') loadTreatments(); });
}
async function loadAudit() { auditEvents = (await api('/api/audit-events')).events; auditPage(); }
const roleNames = { owner:'Titular', dentist:'Odontólogo/a', assistant:'Asistente clínico/a', reception:'Recepción' };
function settingsPage() {
  if (user.role !== 'owner') {
    document.querySelector('#app').innerHTML = '<main class="access-message"><h1>Configuración</h1><p>Solo la persona titular de la clínica puede administrar el equipo.</p></main>';
    return;
  }
  const members = teamData.members.map(member => `<article class="team-row"><div><strong>${esc(member.fullName)}</strong><span>${esc(member.email)}</span></div><b>${esc(roleNames[member.role])}</b></article>`).join('');
  const invites = teamData.invites.map(invite => `<article class="invite-row"><div><strong>${esc(invite.email)}</strong><span>${esc(roleNames[invite.role])} · código vigente 7 días</span></div><code>${esc(invite.code)}</code></article>`).join('');
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users')}${nav('Tratamientos','tooth')}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings',true)}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(teamData.clinic.name)}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="agenda-title-small">Configuración</div></header><div class="content team-content"><div class="page-heading"><div><p class="eyebrow">CLÍNICA Y SEGURIDAD</p><h1>Equipo de ${esc(teamData.clinic.name)}</h1><p>Cada persona usa su propia cuenta. Sus acciones quedan registradas en la Bitácora.</p></div></div><div class="team-grid"><section class="panel team-panel"><h2>Miembros</h2><div class="team-list">${members}</div></section><section class="panel invite-panel"><p class="eyebrow">NUEVA INVITACIÓN</p><h2>Invitar integrante</h2><p>Comparte el código con la persona invitada; deberá registrarse con este mismo correo.</p><form id="team-invite-form"><label>Correo<input required type="email" name="email" placeholder="asistente@correo.com"/></label><label>Rol<select name="role"><option value="dentist">Odontólogo/a</option><option value="assistant">Asistente clínico/a</option><option value="reception">Recepción</option></select></label><p class="form-error" id="team-error"></p><button class="save-appointment">Crear invitación</button></form></section></div><section class="panel invitations-panel"><h2>Invitaciones pendientes</h2><div class="invite-list">${invites || '<p class="empty">No hay invitaciones pendientes.</p>'}</div></section></div></main></div>`;
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('#team-invite-form').onsubmit = async event => {
    event.preventDefault();
    const error = document.querySelector('#team-error'); const button = event.currentTarget.querySelector('button');
    error.textContent = ''; button.disabled = true;
    try { const result = await api('/api/team/invites', { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); toast(`Invitación creada. Código: ${result.code}`); await loadSettings(); }
    catch (err) { error.textContent = err.message; button.disabled = false; }
  };
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section === 'Tratamientos') loadTreatments(); else if (button.dataset.section === 'Reportes') loadAudit(); });
}
async function loadSettings() { teamData = await api('/api/team'); settingsPage(); }
document.addEventListener('click', event => {
  const section = event.target.closest('[data-section]');
  if (!['Reportes', 'Configuración'].includes(section?.dataset.section)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  (section.dataset.section === 'Reportes' ? loadAudit() : loadSettings()).catch(error => toast(error.message));
}, true);
function card(a, index) { return `<article class="appointment-card"><time>${esc(a.time)}</time><div class="appointment-line"></div><div class="avatar ${['aqua','purple','orange','blue'][index % 4]}">${esc(a.initials)}</div><div class="appointment-info"><strong>${esc(a.patient)}</strong><span>${esc(a.type)} <i>•</i> ${esc(a.duration)}</span></div><span class="status ${a.status === 'Confirmada' ? 'confirmed' : 'pending'}">${esc(a.status)}</span></article>`; }
function schedule() {
  const shown = filter === 'Todas' ? appointments : appointments.filter(item => item.status === filter);
  return `<section class="schedule panel"><div class="section-heading"><div><h2>Citas de hoy</h2><p>${esc(dateText)}</p></div></div><div class="filters">${['Todas','Confirmada','Pendiente'].map(name => `<button class="filter ${filter === name ? 'selected' : ''}" data-filter="${name}">${name === 'Todas' ? 'Todas' : `${name}s`} <b>${name === 'Todas' ? appointments.length : appointments.filter(item => item.status === name).length}</b></button>`).join('')}</div><div class="appointment-list">${shown.map(card).join('') || '<p class="empty">Aún no hay citas. Crea la primera con “Nueva cita”.</p>'}</div></section>`;
}
function modal() { return `<div class="modal-backdrop" id="modal"><form class="modal"><button type="button" class="modal-close" id="close-modal">×</button><p class="eyebrow">NUEVA CITA</p><h2>Agenda una consulta</h2><label>Paciente<input required name="patientName" placeholder="Nombre completo"/></label><div class="form-row"><label>Fecha<input required name="date" type="date" value="${isoToday}"/></label><label>Hora<input required name="time" type="time" value="09:00"/></label></div><label>Tipo de cita<select name="appointmentType"><option>Limpieza dental</option><option>Valoración · primera cita</option><option>Revisión de tratamiento</option><option>Ajuste de ortodoncia</option></select></label><p class="form-error" id="appointment-error"></p><button class="save-appointment">Guardar cita</button></form></div>`; }
function dashboard() {
  const firstName = esc(user.fullName.split(' ')[0]); const first = appointments[0];
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid',true)}${nav('Agenda','calendar')}${nav('Pacientes','users')}${nav('Tratamientos','tooth')}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="search">${icon('search')}<input id="search" placeholder="Buscar una cita de hoy…"/></div><div class="header-actions"><button class="icon-button notification" aria-label="Notificaciones">${icon('bell')}<i></i></button><button class="new-appointment" id="open-modal">${icon('plus')} Nueva cita</button></div></header><div class="content"><div class="welcome"><div><p class="eyebrow">${esc(dateText.toUpperCase())}</p><h1>Buenos días, ${firstName} <span>👋</span></h1><p>Esto es lo que tienes programado para hoy.</p></div><div class="mini-calendar"><b>AGENDA EN LÍNEA</b><div class="calendar-days"><span>✓</span><span>✓</span><span>✓</span><span>✓</span><span>✓</span><span>✓</span><span>✓</span><strong class="today">${today.getDate()}</strong></div></div></div><section class="metrics"><article><div class="metric-icon teal">${icon('calendar')}</div><p>Citas para hoy</p><strong>${appointments.length}</strong><span class="up">Agenda sincronizada</span></article><article><div class="metric-icon violet">${icon('users')}</div><p>Pacientes en agenda</p><strong>${new Set(appointments.map(item => item.patient)).size}</strong><span>En tu cuenta</span></article><article><div class="metric-icon amber">${icon('tooth')}</div><p>Tratamientos activos</p><strong>—</strong><span>Próximamente</span></article><article><div class="metric-icon blue">${icon('chart')}</div><p>Ingresos del mes</p><strong>—</strong><span>Próximamente</span></article></section><div class="dashboard-grid">${schedule()}<aside class="right-column"><section class="panel next-patient"><div class="section-heading"><div><h2>Próximo paciente</h2><p>${first ? `A las ${esc(first.time)}` : 'Agenda tu primera cita'}</p></div></div>${first ? `<div class="patient-feature"><div class="avatar aqua large">${esc(first.initials)}</div><div><h3>${esc(first.patient)}</h3><p>${esc(first.type)}</p></div></div>` : '<p class="empty">Tu agenda está lista para comenzar.</p>'}<button class="outline-button" id="open-modal-2">Agregar una cita ${icon('chevron')}</button></section><section class="panel reminder"><div class="reminder-top"><span class="whatsapp">${icon('message')}</span></div><h3>Recordatorios inteligentes</h3><p>Podrás confirmar citas automáticamente cuando conectemos WhatsApp.</p><button id="reminder">Próximamente</button></section></aside></div></div></main></div>${modal()}`;
  bindDashboard();
}
function patientModal() { return `<div class="modal-backdrop" id="patient-modal"><form class="modal patient-modal"><button type="button" class="modal-close" id="close-patient-modal">×</button><p class="eyebrow">NUEVO PACIENTE</p><h2>Crear expediente</h2><label>Nombre completo<input required name="fullName" placeholder="Nombre completo"/></label><div class="form-row"><label>Teléfono<input name="phone" type="tel" placeholder="55 1234 5678"/></label><label>Fecha de nacimiento<input name="birthDate" type="date"/></label></div><label>Correo<input name="email" type="email" placeholder="correo@ejemplo.com"/></label><label>Motivo de consulta<input name="reasonForVisit" placeholder="Ej. dolor, revisión, estética"/></label><label>Alergias o consideraciones<textarea name="allergies" placeholder="Ej. alergia a penicilina"></textarea></label><label>Antecedentes médicos<textarea name="medicalHistory" placeholder="Enfermedades, cirugías o condiciones relevantes"></textarea></label><label>Medicamentos actuales<textarea name="medications" placeholder="Medicamentos y dosis, si aplica"></textarea></label><label>Contacto de emergencia<input name="emergencyContact" placeholder="Nombre y teléfono"/></label><label>Notas clínicas iniciales<textarea name="notes" placeholder="Observaciones relevantes"></textarea></label><p class="form-error" id="patient-error"></p><button class="save-appointment">Guardar paciente</button></form></div>`; }
function patientRow(patient) { return `<article class="patient-row"><div class="avatar purple">${esc(initials(patient.fullName))}</div><div class="patient-name"><strong>${esc(patient.fullName)}</strong><span>${esc(patient.phone || patient.email || 'Sin datos de contacto')}</span></div><div class="patient-detail"><span>Visitas</span><strong>${patient.appointmentCount}</strong></div><div class="patient-detail"><span>Alertas</span><strong>${esc(patient.allergies || 'Ninguna')}</strong></div><button class="edit-patient" data-profile-patient="${esc(patient.id)}">Expediente</button><button class="edit-patient" data-edit-patient="${esc(patient.id)}">Editar</button></article>`; }
function patientsPage() {
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users',true)}${nav('Tratamientos','tooth')}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="search">${icon('search')}<input id="patient-search" placeholder="Buscar paciente…"/></div><div class="header-actions"><button class="new-appointment" id="open-patient-modal">${icon('plus')} Nuevo paciente</button></div></header><div class="content patient-content"><div class="page-heading"><div><p class="eyebrow">EXPEDIENTES CLÍNICOS</p><h1>Pacientes</h1><p>${patients.length} paciente${patients.length === 1 ? '' : 's'} registrado${patients.length === 1 ? '' : 's'} en tu consultorio.</p></div></div><section class="panel patient-list"><div class="patient-list-head"><span>Paciente</span><span>Visitas</span><span>Alertas médicas</span></div><div id="patient-rows">${patients.map(patientRow).join('') || '<p class="empty">Aún no hay pacientes. Crea el primer expediente.</p>'}</div></section></div></main></div>${patientModal()}`;
  const open = () => { editingPatient = null; const form = document.querySelector('.patient-modal'); form.reset(); document.querySelector('#patient-modal .eyebrow').textContent = 'NUEVO PACIENTE'; document.querySelector('#patient-modal h2').textContent = 'Crear expediente'; form.querySelector('.save-appointment').textContent = 'Guardar paciente'; document.querySelector('#patient-modal').classList.add('visible'); };
  document.querySelector('#open-patient-modal').onclick = open;
  document.querySelector('#close-patient-modal').onclick = () => document.querySelector('#patient-modal').classList.remove('visible');
  document.querySelector('#patient-modal').onclick = event => { if (event.target.id === 'patient-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#patient-search').oninput = event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('.patient-row').forEach(row => row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section === 'Tratamientos') loadTreatments(); else if (button.dataset.section !== 'Pacientes') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadPatients() { patients = (await api('/api/patients')).patients; patientsPage(); }
function clinicalNoteModal() { return `<div class="modal-backdrop" id="clinical-note-modal"><form class="modal clinical-note-modal"><button type="button" class="modal-close" id="close-clinical-note-modal">×</button><p class="eyebrow">NUEVA EVOLUCIÓN</p><h2>Registrar atención</h2><div class="form-row"><label>Fecha<input type="date" name="visitDate" value="${isoToday}"/></label><label>Próxima cita<input type="date" name="nextVisit"/></label></div><label>Diagnóstico<textarea name="diagnosis" placeholder="Hallazgos y diagnóstico clínico"></textarea></label><label>Procedimiento realizado<textarea required name="procedureDone" placeholder="Tratamiento o procedimiento realizado"></textarea></label><label>Indicaciones<textarea name="indications" placeholder="Medicamentos, cuidados y recomendaciones"></textarea></label><p class="form-error" id="clinical-note-error"></p><button class="save-appointment">Guardar evolución</button></form></div>`; }
function patientProfilePage() {
  const data = patientProfile; const patient = data.patient;
  const text = value => esc(value || 'Sin registro');
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><div class="sidebar-bottom"><button class="nav-item" id="back-patients">${icon('chevron')}<span>Volver a pacientes</span></button><div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div></div></div></aside><main><header class="topbar"><div class="agenda-title-small">Expediente clínico</div><div class="header-actions"><button class="new-appointment" id="open-clinical-note">${icon('plus')} Registrar atención</button></div></header><div class="content profile-content"><div class="profile-hero"><div class="avatar purple profile-avatar">${esc(initials(patient.full_name))}</div><div><p class="eyebrow">EXPEDIENTE CLÍNICO</p><h1>${esc(patient.full_name)}</h1><p>${text(patient.phone)} · ${text(patient.email)}</p></div><div class="profile-stats"><span>${data.appointments.length} citas</span><span>${data.treatments.length} tratamientos</span></div></div><div class="profile-grid"><section class="panel medical-summary"><h2>Historia médica</h2><dl><div><dt>Motivo de consulta</dt><dd>${text(patient.reason_for_visit)}</dd></div><div><dt>Alergias</dt><dd class="alert-text">${text(patient.allergies)}</dd></div><div><dt>Antecedentes</dt><dd>${text(patient.medical_history)}</dd></div><div><dt>Medicamentos</dt><dd>${text(patient.medications)}</dd></div><div><dt>Contacto de emergencia</dt><dd>${text(patient.emergency_contact)}</dd></div></dl></section><section class="panel clinical-timeline"><div class="section-heading"><div><h2>Evolución clínica</h2><p>Atenciones registradas</p></div></div>${data.clinicalNotes.map(note => `<article class="timeline-note"><time>${new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(note.visit_date))}</time><div><strong>${esc(note.procedure_done)}</strong><p><b>Dx:</b> ${text(note.diagnosis)}</p><p>${text(note.indications)}</p>${note.next_visit ? `<small>Próxima revisión: ${new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(note.next_visit))}</small>` : ''}</div></article>`).join('') || '<p class="empty">Aún no hay evoluciones registradas.</p>'}</section></div><div class="profile-grid lower"><section class="panel"><h2>Plan de tratamiento</h2>${data.treatments.map(treatment => `<div class="profile-treatment"><strong>${esc(treatment.treatment_name)}</strong><span>${esc(treatment.tooth || 'Sin pieza')} · ${treatment.status === 'completed' ? 'Finalizado' : 'Activo'}</span></div>`).join('') || '<p class="empty">No hay tratamientos registrados.</p>'}</section><section class="panel"><h2>Últimas citas</h2>${data.appointments.slice(0,5).map(appointment => `<div class="profile-treatment"><strong>${esc(appointment.appointment_type)}</strong><span>${new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(appointment.starts_at))}</span></div>`).join('') || '<p class="empty">No hay citas registradas.</p>'}</section></div></div></main></div>${clinicalNoteModal()}`;
  document.querySelector('#back-patients').remove();
  document.querySelector('.profile-content').insertAdjacentHTML('afterbegin', `<button class="context-back" id="back-patients">${icon('chevron')} Volver a pacientes</button>`);
  document.querySelector('#back-patients').onclick = loadPatients;
  document.querySelector('#open-clinical-note').onclick = () => document.querySelector('#clinical-note-modal').classList.add('visible');
  document.querySelector('#close-clinical-note-modal').onclick = () => document.querySelector('#clinical-note-modal').classList.remove('visible');
  document.querySelector('#clinical-note-modal').onclick = event => { if (event.target.id === 'clinical-note-modal') event.currentTarget.classList.remove('visible'); };
}
async function loadPatientProfile(id) { patientProfile = await api(`/api/patients/${id}/profile`); patientProfilePage(); }
function treatmentModal() { return `<div class="modal-backdrop" id="treatment-modal"><form class="modal treatment-modal"><button type="button" class="modal-close" id="close-treatment-modal">×</button><p class="eyebrow" id="treatment-modal-label">NUEVO TRATAMIENTO</p><h2 id="treatment-modal-title">Agregar al historial</h2><label>Paciente<select required name="patientId"><option value="">Selecciona un paciente</option>${patients.map(patient => `<option value="${esc(patient.id)}">${esc(patient.fullName)}</option>`).join('')}</select></label><label>Tratamiento<input required name="name" placeholder="Ej. Restauración con resina"/></label><div class="form-row"><label>Pieza dental<input name="tooth" placeholder="Ej. 16"/></label><label>Costo total<input name="estimatedCost" type="number" min="0" step="0.01" placeholder="$0.00"/></label></div><label>Estado<select name="status"><option value="active">Activo</option><option value="completed">Finalizado</option></select></label><label>Notas<textarea name="notes" placeholder="Diagnóstico, materiales o indicaciones"></textarea></label><p class="form-error" id="treatment-error"></p><button class="save-appointment">Guardar tratamiento</button></form></div>`; }
function paymentModal() { return `<div class="modal-backdrop" id="payment-modal"><form class="modal payment-modal"><button type="button" class="modal-close" id="close-payment-modal">×</button><p class="eyebrow">REGISTRAR ABONO</p><h2 id="payment-title">Abono al tratamiento</h2><label>Monto<input required name="amount" type="number" min="0.01" step="0.01" placeholder="$0.00"/></label><div class="form-row"><label>Fecha<input name="paymentDate" type="date" value="${isoToday}"/></label><label>Método<select name="paymentMethod"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label></div><label>Nota<input name="notes" placeholder="Ej. anticipo"/></label><p class="form-error" id="payment-error"></p><button class="save-appointment">Registrar abono</button></form></div>`; }
function paymentListModal() { return `<div class="modal-backdrop" id="payment-list-modal"><section class="modal payment-list-modal"><button type="button" class="modal-close" id="close-payment-list-modal">×</button><p class="eyebrow">HISTORIAL DE ABONOS</p><h2 id="payment-list-title">Abonos</h2><div id="payment-list"></div></section></div>`; }
function treatmentCard(treatment) { const total = Number(treatment.estimatedCost || 0); const paid = Number(treatment.paidAmount || 0); const balance = Math.max(total - paid, 0); const money = value => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(value); const complete = treatment.status === 'completed'; return `<article class="treatment-card"><div class="treatment-card-top"><div><span class="tooth-badge">${esc(treatment.tooth || '—')}</span><span class="status ${complete ? 'confirmed' : 'pending'}">${complete ? 'Finalizado' : 'Activo'}</span></div><button class="treatment-status" data-treatment-id="${esc(treatment.id)}" data-treatment-status="${complete ? 'active' : 'completed'}">${complete ? 'Reabrir' : 'Finalizar'}</button></div><h3>${esc(treatment.name)}</h3><p class="treatment-patient">${esc(treatment.patientName)}</p><p class="treatment-notes">${esc(treatment.notes || 'Sin notas clínicas adicionales.')}</p><div class="payment-summary"><span>Total <b>${total ? money(total) : '—'}</b></span><span>Abonado <b>${money(paid)}</b></span><strong class="${balance === 0 && total ? 'paid' : ''}">${total ? (balance === 0 ? 'Liquidado' : `Saldo ${money(balance)}`) : 'Sin costo'}</strong></div><footer><button class="card-action" data-edit-treatment="${esc(treatment.id)}">Editar</button><button class="card-action" data-payment-treatment="${esc(treatment.id)}" ${!total || balance === 0 ? 'disabled' : ''}>Abono</button><button class="card-action" data-view-payments="${esc(treatment.id)}">Historial (${treatment.paymentCount || 0})</button></footer></article>`; }
function treatmentsPage() {
  const active = treatments.filter(treatment => treatment.status === 'active').length;
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users')}${nav('Tratamientos','tooth',true)}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="agenda-title-small">Historial clínico</div><div class="header-actions"><button class="new-appointment" id="open-treatment-modal">${icon('plus')} Nuevo tratamiento</button></div></header><div class="content treatment-content"><div class="page-heading"><div><p class="eyebrow">HISTORIAL CLÍNICO</p><h1>Tratamientos</h1><p>${active} tratamiento${active === 1 ? '' : 's'} activo${active === 1 ? '' : 's'}.</p></div></div><div class="treatment-grid">${treatments.map(treatmentCard).join('') || '<section class="panel empty-treatment"><span>🦷</span><h2>Aún no hay tratamientos</h2><p>Registra el diagnóstico y plan de cada paciente para construir su historial.</p></section>'}</div></div></main></div>${treatmentModal()}`;
  document.querySelector('#app').insertAdjacentHTML('beforeend', paymentModal());
  document.querySelector('#app').insertAdjacentHTML('beforeend', paymentListModal());
  document.querySelector('#open-treatment-modal').insertAdjacentHTML('beforebegin', '<button class="odontogram-launch" id="open-odontogram">Odontograma</button>');
  document.querySelector('#open-odontogram').onclick = loadOdontogram;
  document.querySelector('#open-treatment-modal').onclick = () => { if (!patients.length) return toast('Primero registra un paciente.'); editingTreatment = null; const form = document.querySelector('.treatment-modal'); form.reset(); document.querySelector('#treatment-modal-label').textContent = 'NUEVO TRATAMIENTO'; document.querySelector('#treatment-modal-title').textContent = 'Agregar al historial'; form.querySelector('.save-appointment').textContent = 'Guardar tratamiento'; document.querySelector('#treatment-modal').classList.add('visible'); };
  document.querySelector('#close-treatment-modal').onclick = () => document.querySelector('#treatment-modal').classList.remove('visible');
  document.querySelector('#treatment-modal').onclick = event => { if (event.target.id === 'treatment-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#close-payment-modal').onclick = () => document.querySelector('#payment-modal').classList.remove('visible');
  document.querySelector('#payment-modal').onclick = event => { if (event.target.id === 'payment-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#close-payment-list-modal').onclick = () => document.querySelector('#payment-list-modal').classList.remove('visible');
  document.querySelector('#payment-list-modal').onclick = event => { if (event.target.id === 'payment-list-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section !== 'Tratamientos') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadTreatments() { const [treatmentData, patientData] = await Promise.all([api('/api/treatments'), api('/api/patients')]); treatments = treatmentData.treatments; patients = patientData.patients; treatmentsPage(); }
function toothButton(tooth) { const record = odontogramRecords.find(item => item.toothNumber === tooth); const status = record?.status || 'healthy'; return `<button class="tooth ${status} ${selectedTooth === tooth ? 'selected-tooth' : ''}" data-tooth="${tooth}"><span class="tooth-symbol">${icon('tooth')}</span><b>${tooth}</b></button>`; }
function odontogramPage() {
  const selectedRecord = odontogramRecords.find(item => item.toothNumber === selectedTooth) || { status:'healthy', notes:'' };
  const patient = patients.find(item => item.id === odontogramPatientId);
  const quadrants = [['18','17','16','15','14','13','12','11'],['21','22','23','24','25','26','27','28'],['48','47','46','45','44','43','42','41'],['31','32','33','34','35','36','37','38']];
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users')}${nav('Tratamientos','tooth',true)}${nav('Reportes','chart')}</nav><div class="sidebar-bottom"><button class="nav-item" id="back-treatments">${icon('chevron')}<span>Volver a tratamientos</span></button><div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div></div></div></aside><main><header class="topbar"><div class="agenda-title-small">Odontograma</div></header><div class="content odontogram-content"><div class="page-heading"><div><p class="eyebrow">EXPEDIENTE DENTAL</p><h1>Odontograma</h1><p>Registra el estado de cada pieza dental del paciente.</p></div></div><label class="patient-picker">Paciente<select id="odontogram-patient">${patients.map(item => `<option value="${esc(item.id)}" ${item.id === odontogramPatientId ? 'selected' : ''}>${esc(item.fullName)}</option>`).join('')}</select></label>${patient ? `<div class="odontogram-layout"><section class="odontogram-board panel"><div class="arch upper">${quadrants[0].map(toothButton).join('')}<i></i>${quadrants[1].map(toothButton).join('')}</div><div class="mouth-divider"><span>MAXILAR</span><span>MANDÍBULA</span></div><div class="arch lower">${quadrants[2].map(toothButton).join('')}<i></i>${quadrants[3].map(toothButton).join('')}</div><div class="legend"><span><i class="healthy"></i>Sano</span><span><i class="treatment"></i>En tratamiento</span><span><i class="watch"></i>Vigilar</span><span><i class="missing"></i>Ausente</span></div></section><aside class="panel tooth-detail"><p class="eyebrow">PIEZA SELECCIONADA</p><h2>Pieza ${selectedTooth}</h2><form class="odontogram-form"><label>Estado<select name="status"><option value="healthy" ${selectedRecord.status === 'healthy' ? 'selected' : ''}>Sano</option><option value="treatment" ${selectedRecord.status === 'treatment' ? 'selected' : ''}>En tratamiento</option><option value="watch" ${selectedRecord.status === 'watch' ? 'selected' : ''}>Vigilar</option><option value="missing" ${selectedRecord.status === 'missing' ? 'selected' : ''}>Ausente</option></select></label><label>Notas clínicas<textarea name="notes" placeholder="Diagnóstico, tratamiento o evolución">${esc(selectedRecord.notes || '')}</textarea></label><p class="form-error" id="tooth-error"></p><button class="save-appointment">Guardar pieza</button></form></aside></div>` : '<section class="panel empty-treatment"><h2>Registra un paciente primero</h2></section>'}</div></main></div>`;
  document.querySelector('#back-treatments').remove();
  document.querySelector('.odontogram-content .page-heading').insertAdjacentHTML('beforebegin', `<button class="context-back" id="back-treatments">${icon('chevron')} Volver a tratamientos</button>`);
  document.querySelector('#back-treatments').onclick = loadTreatments;
  const picker = document.querySelector('#odontogram-patient');
  if (picker) picker.onchange = event => { odontogramPatientId = event.target.value; selectedTooth = '11'; loadOdontogram(); };
  document.querySelectorAll('[data-tooth]').forEach(button => button.onclick = () => { selectedTooth = button.dataset.tooth; odontogramPage(); });
}
async function loadOdontogram() { if (!odontogramPatientId) odontogramPatientId = patients[0]?.id || ''; if (!odontogramPatientId) return odontogramPage(); odontogramRecords = (await api(`/api/odontogram?patientId=${odontogramPatientId}`)).records; odontogramPage(); }
function agendaModal() { return `<div class="modal-backdrop" id="agenda-modal"><form class="modal agenda-modal"><button type="button" class="modal-close" id="close-agenda-modal">×</button><p class="eyebrow">EDITAR CITA</p><h2>Detalles de la cita</h2><label>Paciente<input disabled name="patientName"/></label><div class="form-row"><label>Fecha<input required name="date" type="date"/></label><label>Hora<input required name="time" type="time"/></label></div><label>Tipo de cita<select name="appointmentType"><option>Limpieza dental</option><option>Valoración · primera cita</option><option>Revisión de tratamiento</option><option>Ajuste de ortodoncia</option></select></label><div class="form-row"><label>Duración<select name="durationMinutes"><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label><label>Estado<select name="status"><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Atendida</option><option value="cancelled">Cancelada</option></select></label></div><p class="form-error" id="agenda-error"></p><button class="save-appointment">Guardar cambios</button></form></div>`; }
function agendaCard(appointment) { return `<button class="agenda-card status-${esc(appointment.statusKey)}" data-edit-appointment="${esc(appointment.id)}"><b>${esc(appointment.time)}</b><span>${esc(appointment.patient)}</span><small>${esc(appointment.type)}</small></button>`; }
function reminderMessage(appointment) {
  const patientName = appointment.patient.split(/\s+/)[0];
  const date = new Intl.DateTimeFormat('es-MX', { weekday:'long', day:'numeric', month:'long', timeZone:'America/Mexico_City' }).format(new Date(appointment.startsAt));
  return `Hola, ${patientName}. Te recordamos tu cita en ${user.clinicName || 'Odontia'} el ${date} a las ${appointment.time}. ¿Nos confirmas tu asistencia? Gracias.`;
}
function reminderPanel() {
  return `<section class="whatsapp-reminder" id="whatsapp-reminder" hidden><div class="whatsapp-reminder-heading"><span>${icon('message')}</span><div><p class="eyebrow">RECORDATORIO MANUAL</p><h3>Enviar por WhatsApp</h3></div></div><p class="whatsapp-help" id="whatsapp-help"></p><textarea id="whatsapp-message" rows="4" aria-label="Mensaje de recordatorio"></textarea><div class="whatsapp-actions"><button type="button" class="whatsapp-open" id="open-whatsapp">${icon('message')} Abrir WhatsApp</button><button type="button" class="whatsapp-mark" id="mark-whatsapp-sent">Marcar enviado</button></div><p class="reminder-status" id="reminder-status"></p></section>`;
}
function agendaPage() {
  const days = Array.from({ length:7 }, (_, index) => addDays(agendaStart, index));
  const monthText = new Intl.DateTimeFormat('es-MX', { month:'long', year:'numeric' }).format(agendaStart);
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar',true)}${nav('Pacientes','users')}${nav('Tratamientos','tooth')}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="agenda-title-small">Agenda semanal</div><div class="header-actions"><button class="new-appointment" id="agenda-new">${icon('plus')} Nueva cita</button></div></header><div class="content agenda-content"><div class="page-heading"><div><p class="eyebrow">CALENDARIO</p><h1>Agenda</h1><p>Organiza las consultas y actualiza su estado.</p></div><div class="week-controls"><button id="previous-week">‹</button><strong>${esc(monthText)}</strong><button id="next-week">›</button><button class="today-button" id="today-week">Hoy</button></div></div><section class="week-grid">${days.map(day => { const key = dateValue(day); const isToday = key === dateValue(today); const items = agendaAppointments.filter(appointment => dateValue(new Date(appointment.startsAt)) === key); return `<article class="week-day ${isToday ? 'today-column' : ''}"><header><span>${new Intl.DateTimeFormat('es-MX',{weekday:'short'}).format(day).replace('.','')}</span><strong>${day.getDate()}</strong></header><div class="week-items">${items.map(agendaCard).join('') || '<span class="empty-slot">—</span>'}</div></article>`; }).join('')}</section></div></main></div>${agendaModal()}${modal()}`;
  document.querySelector('#previous-week').onclick = () => { agendaStart = addDays(agendaStart, -7); loadAgenda(); };
  document.querySelector('#next-week').onclick = () => { agendaStart = addDays(agendaStart, 7); loadAgenda(); };
  document.querySelector('#today-week').onclick = () => { agendaStart = mondayOf(today); loadAgenda(); };
  document.querySelector('#agenda-new').onclick = () => { editingAppointment = null; creatingFromAgenda = true; document.querySelector('#modal').classList.add('visible'); };
  document.querySelector('#close-modal').onclick = () => document.querySelector('#modal').classList.remove('visible');
  document.querySelector('#modal').onclick = event => { if (event.target.id === 'modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#close-agenda-modal').onclick = () => document.querySelector('#agenda-modal').classList.remove('visible');
  document.querySelector('#agenda-modal').onclick = event => { if (event.target.id === 'agenda-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section === 'Tratamientos') loadTreatments(); else if (button.dataset.section !== 'Agenda') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadAgenda() { const from = dateValue(agendaStart); const to = dateValue(addDays(agendaStart, 6)); agendaAppointments = (await api(`/api/appointments?from=${from}&to=${to}`)).appointments; agendaPage(); }
function bindDashboard() {
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; dashboard(); });
  const open = () => { creatingFromAgenda = false; document.querySelector('#modal').classList.add('visible'); }; document.querySelector('#open-modal').onclick = open; document.querySelector('#open-modal-2').onclick = open; document.querySelector('#close-modal').onclick = () => document.querySelector('#modal').classList.remove('visible');
  document.querySelector('#modal').onclick = event => { if (event.target.id === 'modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#search').oninput = event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('.appointment-card').forEach(element => element.style.display = element.textContent.toLowerCase().includes(query) ? '' : 'none'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section === 'Tratamientos') loadTreatments(); else if (button.dataset.section !== 'Inicio') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadDashboard() { appointments = (await api('/api/appointments')).appointments; dashboard(); }
document.addEventListener('submit', async event => {
  if (!event.target.matches('.modal:not(.patient-modal):not(.treatment-modal):not(.clinical-note-modal):not(.payment-modal)')) return;
  event.preventDefault();
  const form = event.target;
  const isEditing = event.target.matches('.agenda-modal') && editingAppointment;
  const error = document.querySelector(isEditing ? '#agenda-error' : '#appointment-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    const values = Object.fromEntries(new FormData(form));
    await api(isEditing ? `/api/appointments/${editingAppointment.id}` : '/api/appointments', { method:isEditing ? 'PATCH' : 'POST', body:JSON.stringify({ patientName:values.patientName, appointmentType:values.appointmentType, startsAt:`${values.date}T${values.time}:00-06:00`, durationMinutes:Number(values.durationMinutes || 30), ...(isEditing ? { status:values.status } : {}) }) });
    toast(isEditing ? 'Cita actualizada correctamente' : 'Cita guardada en tu agenda');
    editingAppointment = null;
    if (isEditing || creatingFromAgenda) { creatingFromAgenda = false; await loadAgenda(); } else await loadDashboard();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Guardar cita';
  }
});
document.addEventListener('submit', async event => {
  if (!event.target.matches('.patient-modal')) return;
  event.preventDefault();
  const form = event.target;
  const error = document.querySelector('#patient-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    const values = Object.fromEntries(new FormData(form));
    await api(editingPatient ? `/api/patients/${editingPatient.id}` : '/api/patients', { method:editingPatient ? 'PATCH' : 'POST', body:JSON.stringify(values) });
    toast(editingPatient ? 'Expediente actualizado correctamente' : 'Paciente registrado correctamente');
    editingPatient = null;
    await loadPatients();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Guardar paciente';
  }
});
document.addEventListener('submit', async event => {
  if (!event.target.matches('.clinical-note-modal')) return;
  event.preventDefault();
  const form = event.target;
  const error = document.querySelector('#clinical-note-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    await api(`/api/patients/${patientProfile.patient.id}/clinical-notes`, { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(form))) });
    toast('Evolución clínica registrada');
    await loadPatientProfile(patientProfile.patient.id);
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Guardar evolución';
  }
});
document.addEventListener('submit', async event => {
  if (!event.target.matches('.treatment-modal')) return;
  event.preventDefault();
  const form = event.target;
  const error = document.querySelector('#treatment-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    await api(editingTreatment ? `/api/treatments/${editingTreatment.id}` : '/api/treatments', { method:editingTreatment ? 'PATCH' : 'POST', body:JSON.stringify(Object.fromEntries(new FormData(form))) });
    toast(editingTreatment ? 'Tratamiento actualizado' : 'Tratamiento agregado al historial');
    editingTreatment = null;
    await loadTreatments();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Guardar tratamiento';
  }
});
document.addEventListener('submit', async event => {
  if (!event.target.matches('.payment-modal')) return;
  event.preventDefault();
  const form = event.target;
  const error = document.querySelector('#payment-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Registrando…';
  try {
    await api(editingPayment ? `/api/payments/${editingPayment.id}` : `/api/treatments/${paymentTreatment.id}/payments`, { method:editingPayment ? 'PATCH' : 'POST', body:JSON.stringify(Object.fromEntries(new FormData(form))) });
    toast(editingPayment ? 'Abono actualizado correctamente' : 'Abono registrado correctamente');
    paymentTreatment = null;
    editingPayment = null;
    await loadTreatments();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Registrar abono';
  }
});
document.addEventListener('submit', async event => {
  if (!event.target.matches('.odontogram-form')) return;
  event.preventDefault();
  const form = event.target;
  const error = document.querySelector('#tooth-error');
  const button = form.querySelector('.save-appointment');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    const values = Object.fromEntries(new FormData(form));
    await api(`/api/odontogram/${selectedTooth}`, { method:'PUT', body:JSON.stringify({ patientId:odontogramPatientId, ...values }) });
    toast(`Pieza ${selectedTooth} actualizada`);
    await loadOdontogram();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Guardar pieza';
  }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-patient]');
  if (!button) return;
  editingPatient = patients.find(patient => patient.id === button.dataset.editPatient);
  if (!editingPatient) return;
  const modal = document.querySelector('#patient-modal');
  const form = modal.querySelector('.patient-modal');
  form.fullName.value = editingPatient.fullName || '';
  form.phone.value = editingPatient.phone || '';
  form.email.value = editingPatient.email || '';
  form.birthDate.value = editingPatient.birthDate || '';
  form.allergies.value = editingPatient.allergies || '';
  form.medicalHistory.value = editingPatient.medicalHistory || '';
  form.medications.value = editingPatient.medications || '';
  form.emergencyContact.value = editingPatient.emergencyContact || '';
  form.reasonForVisit.value = editingPatient.reasonForVisit || '';
  form.notes.value = editingPatient.notes || '';
  modal.querySelector('.eyebrow').textContent = 'EDITAR PACIENTE';
  modal.querySelector('h2').textContent = 'Actualizar expediente';
  form.querySelector('.save-appointment').textContent = 'Guardar cambios';
  modal.classList.add('visible');
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-view-payments]');
  if (!button) return;
  paymentTreatment = treatments.find(treatment => treatment.id === button.dataset.viewPayments);
  if (!paymentTreatment) return;
  try {
    treatmentPayments = (await api(`/api/treatments/${paymentTreatment.id}/payments`)).payments;
    const money = value => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);
    document.querySelector('#payment-list-title').textContent = `Abonos · ${paymentTreatment.name}`;
    document.querySelector('#payment-list').innerHTML = treatmentPayments.map(payment => `<article class="payment-row"><div><strong>${money(payment.amount)}</strong><span>${new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(payment.paymentDate))} · ${esc(payment.paymentMethod || 'Sin método')}</span><small>${esc(payment.notes || '')}</small></div><button class="card-action" data-edit-payment="${esc(payment.id)}">Editar</button></article>`).join('') || '<p class="empty">Aún no hay abonos registrados.</p>';
    document.querySelector('#payment-list-modal').classList.add('visible');
  } catch (err) { toast(err.message); }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-payment]');
  if (!button) return;
  editingPayment = treatmentPayments.find(payment => payment.id === button.dataset.editPayment);
  if (!editingPayment) return;
  const modal = document.querySelector('#payment-modal');
  const form = modal.querySelector('.payment-modal');
  form.amount.value = editingPayment.amount;
  form.paymentDate.value = editingPayment.paymentDate;
  form.paymentMethod.value = editingPayment.paymentMethod || 'Efectivo';
  form.notes.value = editingPayment.notes || '';
  modal.querySelector('.eyebrow').textContent = 'EDITAR ABONO';
  modal.querySelector('#payment-title').textContent = `Editar abono · ${paymentTreatment.name}`;
  form.querySelector('.save-appointment').textContent = 'Guardar cambios';
  document.querySelector('#payment-list-modal').classList.remove('visible');
  modal.classList.add('visible');
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-profile-patient]');
  if (button) loadPatientProfile(button.dataset.profilePatient);
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-treatment-id]');
  if (!button) return;
  button.disabled = true;
  try {
    await api(`/api/treatments/${button.dataset.treatmentId}/status`, { method:'PATCH', body:JSON.stringify({ status:button.dataset.treatmentStatus }) });
    toast(button.dataset.treatmentStatus === 'completed' ? 'Tratamiento marcado como finalizado' : 'Tratamiento reabierto');
    await loadTreatments();
  } catch (err) { toast(err.message); button.disabled = false; }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-treatment]');
  if (!button) return;
  editingTreatment = treatments.find(treatment => treatment.id === button.dataset.editTreatment);
  if (!editingTreatment) return;
  const modal = document.querySelector('#treatment-modal');
  const form = modal.querySelector('.treatment-modal');
  form.patientId.value = editingTreatment.patientId;
  form.name.value = editingTreatment.name;
  form.tooth.value = editingTreatment.tooth || '';
  form.estimatedCost.value = editingTreatment.estimatedCost || '';
  form.status.value = editingTreatment.status;
  form.notes.value = editingTreatment.notes || '';
  document.querySelector('#treatment-modal-label').textContent = 'EDITAR TRATAMIENTO';
  document.querySelector('#treatment-modal-title').textContent = 'Actualizar tratamiento';
  form.querySelector('.save-appointment').textContent = 'Guardar cambios';
  modal.classList.add('visible');
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-payment-treatment]');
  if (!button || button.disabled) return;
  paymentTreatment = treatments.find(treatment => treatment.id === button.dataset.paymentTreatment);
  if (!paymentTreatment) return;
  editingPayment = null;
  const total = Number(paymentTreatment.estimatedCost || 0); const paid = Number(paymentTreatment.paidAmount || 0); const balance = total - paid;
  const modal = document.querySelector('#payment-modal');
  modal.querySelector('.payment-modal').reset();
  modal.querySelector('.eyebrow').textContent = 'REGISTRAR ABONO';
  modal.querySelector('[name="paymentDate"]').value = isoToday;
  modal.querySelector('#payment-title').textContent = `${paymentTreatment.name} · saldo ${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(balance)}`;
  modal.classList.add('visible');
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-appointment]');
  if (!button) return;
  editingAppointment = agendaAppointments.find(appointment => appointment.id === button.dataset.editAppointment);
  if (!editingAppointment) return;
  const modal = document.querySelector('#agenda-modal');
  const form = modal.querySelector('.agenda-modal');
  const startsAt = new Date(editingAppointment.startsAt);
  form.patientName.value = editingAppointment.patient;
  form.date.value = dateValue(startsAt);
  form.time.value = new Intl.DateTimeFormat('en-GB', { timeZone:'America/Mexico_City', hour:'2-digit', minute:'2-digit', hour12:false }).format(startsAt);
  form.appointmentType.value = editingAppointment.type;
  form.durationMinutes.value = String(editingAppointment.durationMinutes);
  form.status.value = editingAppointment.statusKey;
  if (!form.querySelector('#whatsapp-reminder')) form.querySelector('#agenda-error').insertAdjacentHTML('beforebegin', reminderPanel());
  const reminder = form.querySelector('#whatsapp-reminder');
  const help = form.querySelector('#whatsapp-help');
  const message = form.querySelector('#whatsapp-message');
  const openButton = form.querySelector('#open-whatsapp');
  const markButton = form.querySelector('#mark-whatsapp-sent');
  const reminderStatus = form.querySelector('#reminder-status');
  reminder.hidden = false;
  message.value = reminderMessage(editingAppointment);
  if (!editingAppointment.phone) {
    help.textContent = 'Agrega un teléfono al expediente del paciente para enviar el recordatorio.';
    openButton.disabled = true;
    markButton.disabled = true;
    reminderStatus.textContent = '';
  } else {
    help.textContent = `Se abrirá WhatsApp con el teléfono ${editingAppointment.phone}. Revisa el texto antes de enviarlo.`;
    openButton.disabled = false;
    markButton.disabled = false;
    if (editingAppointment.reminderSentAt) {
      markButton.textContent = 'Enviado';
      reminderStatus.textContent = 'Este recordatorio ya fue marcado como enviado.';
    } else {
      markButton.textContent = 'Marcar enviado';
      reminderStatus.textContent = '';
    }
  }
  modal.classList.add('visible');
});
document.addEventListener('click', event => {
  const button = event.target.closest('#open-whatsapp');
  if (!button || !editingAppointment?.phone) return;
  const rawPhone = String(editingAppointment.phone).replace(/\D/g, '').replace(/^00/, '');
  const phone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;
  if (phone.length < 10) return toast('El teléfono del paciente no es válido.');
  const message = document.querySelector('#whatsapp-message')?.value.trim();
  if (!message) return toast('Escribe un mensaje antes de abrir WhatsApp.');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});
document.addEventListener('click', async event => {
  const button = event.target.closest('#mark-whatsapp-sent');
  if (!button || !editingAppointment?.phone || button.disabled) return;
  button.disabled = true;
  try {
    await api(`/api/appointments/${editingAppointment.id}/reminder`, { method:'PATCH', body:JSON.stringify({}) });
    toast('Recordatorio marcado como enviado');
    await loadAgenda();
  } catch (err) {
    toast(err.message);
    button.disabled = false;
  }
});
function toast(message) { const element = document.createElement('div'); element.className = 'toast'; element.textContent = message; document.body.append(element); setTimeout(() => element.remove(), 2800); }
async function boot() { if (!token) return authPage(); try { user = (await api('/api/auth/me')).user; await loadDashboard(); } catch { localStorage.removeItem('odontia-token'); token = null; authPage(); } }
boot();
