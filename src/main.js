import './style.css';
import './patients.css';
import './agenda.css';

let token = localStorage.getItem('odontia-token');
let user;
let appointments = [];
let patients = [];
let editingPatient = null;
let agendaAppointments = [];
let editingAppointment = null;
let creatingFromAgenda = false;
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
  const setMode = () => {
    document.querySelector('#name-label').hidden = !register; document.querySelector('#clinic-label').hidden = !register;
    document.querySelector('#auth-submit').textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    document.querySelector('#switch-line').innerHTML = register ? '¿Ya tienes una cuenta? <button id="mode-toggle">Inicia sesión</button>' : '¿Aún no tienes cuenta? <button id="mode-toggle">Crear cuenta</button>';
    form.password.autocomplete = register ? 'new-password' : 'current-password';
    document.querySelector('#mode-toggle').onclick = () => { register = !register; setMode(); };
  };
  document.querySelector('#mode-toggle').onclick = () => { register = false; setMode(); };
  form.onsubmit = async event => {
    event.preventDefault(); const submit = document.querySelector('#auth-submit'); const error = document.querySelector('#form-error'); error.textContent = ''; submit.disabled = true;
    try { const payload = Object.fromEntries(new FormData(form)); const data = await api(register ? '/api/auth/register' : '/api/auth/login', { method:'POST', body:JSON.stringify(payload) }); token = data.token; user = data.user; localStorage.setItem('odontia-token', token); await loadDashboard(); }
    catch (err) { error.textContent = err.message; submit.disabled = false; }
  };
}

const nav = (label, name, active = false) => `<button class="nav-item ${active ? 'active' : ''}" data-section="${label}">${icon(name)}<span>${label}</span></button>`;
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
function patientModal() { return `<div class="modal-backdrop" id="patient-modal"><form class="modal patient-modal"><button type="button" class="modal-close" id="close-patient-modal">×</button><p class="eyebrow">NUEVO PACIENTE</p><h2>Crear expediente</h2><label>Nombre completo<input required name="fullName" placeholder="Nombre completo"/></label><div class="form-row"><label>Teléfono<input name="phone" type="tel" placeholder="55 1234 5678"/></label><label>Correo<input name="email" type="email" placeholder="correo@ejemplo.com"/></label></div><label>Alergias o consideraciones<textarea name="allergies" placeholder="Ej. alergia a penicilina"></textarea></label><label>Notas clínicas iniciales<textarea name="notes" placeholder="Observaciones relevantes"></textarea></label><p class="form-error" id="patient-error"></p><button class="save-appointment">Guardar paciente</button></form></div>`; }
function patientRow(patient) { return `<article class="patient-row"><div class="avatar purple">${esc(initials(patient.fullName))}</div><div class="patient-name"><strong>${esc(patient.fullName)}</strong><span>${esc(patient.phone || patient.email || 'Sin datos de contacto')}</span></div><div class="patient-detail"><span>Visitas</span><strong>${patient.appointmentCount}</strong></div><div class="patient-detail"><span>Alertas</span><strong>${esc(patient.allergies || 'Ninguna')}</strong></div><button class="edit-patient" data-edit-patient="${esc(patient.id)}">Editar</button></article>`; }
function patientsPage() {
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand"><span class="brand-mark">O</span><span>odontia</span></a><nav>${nav('Inicio','grid')}${nav('Agenda','calendar')}${nav('Pacientes','users',true)}${nav('Tratamientos','tooth')}${nav('Reportes','chart')}</nav><div class="sidebar-bottom">${nav('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">${esc(initials(user.fullName))}</div><div><strong>${esc(user.fullName)}</strong><span>${esc(user.clinicName || 'Odontóloga')}</span></div><button id="logout" title="Cerrar sesión">↗</button></div></div></aside><main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="search">${icon('search')}<input id="patient-search" placeholder="Buscar paciente…"/></div><div class="header-actions"><button class="new-appointment" id="open-patient-modal">${icon('plus')} Nuevo paciente</button></div></header><div class="content patient-content"><div class="page-heading"><div><p class="eyebrow">EXPEDIENTES CLÍNICOS</p><h1>Pacientes</h1><p>${patients.length} paciente${patients.length === 1 ? '' : 's'} registrado${patients.length === 1 ? '' : 's'} en tu consultorio.</p></div></div><section class="panel patient-list"><div class="patient-list-head"><span>Paciente</span><span>Visitas</span><span>Alertas médicas</span></div><div id="patient-rows">${patients.map(patientRow).join('') || '<p class="empty">Aún no hay pacientes. Crea el primer expediente.</p>'}</div></section></div></main></div>${patientModal()}`;
  const open = () => { editingPatient = null; const form = document.querySelector('.patient-modal'); form.reset(); document.querySelector('#patient-modal .eyebrow').textContent = 'NUEVO PACIENTE'; document.querySelector('#patient-modal h2').textContent = 'Crear expediente'; form.querySelector('.save-appointment').textContent = 'Guardar paciente'; document.querySelector('#patient-modal').classList.add('visible'); };
  document.querySelector('#open-patient-modal').onclick = open;
  document.querySelector('#close-patient-modal').onclick = () => document.querySelector('#patient-modal').classList.remove('visible');
  document.querySelector('#patient-modal').onclick = event => { if (event.target.id === 'patient-modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#patient-search').oninput = event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('.patient-row').forEach(row => row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section !== 'Pacientes') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadPatients() { patients = (await api('/api/patients')).patients; patientsPage(); }
function agendaModal() { return `<div class="modal-backdrop" id="agenda-modal"><form class="modal agenda-modal"><button type="button" class="modal-close" id="close-agenda-modal">×</button><p class="eyebrow">EDITAR CITA</p><h2>Detalles de la cita</h2><label>Paciente<input disabled name="patientName"/></label><div class="form-row"><label>Fecha<input required name="date" type="date"/></label><label>Hora<input required name="time" type="time"/></label></div><label>Tipo de cita<select name="appointmentType"><option>Limpieza dental</option><option>Valoración · primera cita</option><option>Revisión de tratamiento</option><option>Ajuste de ortodoncia</option></select></label><div class="form-row"><label>Duración<select name="durationMinutes"><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label><label>Estado<select name="status"><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="completed">Atendida</option><option value="cancelled">Cancelada</option></select></label></div><p class="form-error" id="agenda-error"></p><button class="save-appointment">Guardar cambios</button></form></div>`; }
function agendaCard(appointment) { return `<button class="agenda-card status-${esc(appointment.statusKey)}" data-edit-appointment="${esc(appointment.id)}"><b>${esc(appointment.time)}</b><span>${esc(appointment.patient)}</span><small>${esc(appointment.type)}</small></button>`; }
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
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Inicio') loadDashboard(); else if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section !== 'Agenda') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadAgenda() { const from = dateValue(agendaStart); const to = dateValue(addDays(agendaStart, 6)); agendaAppointments = (await api(`/api/appointments?from=${from}&to=${to}`)).appointments; agendaPage(); }
function bindDashboard() {
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; dashboard(); });
  const open = () => { creatingFromAgenda = false; document.querySelector('#modal').classList.add('visible'); }; document.querySelector('#open-modal').onclick = open; document.querySelector('#open-modal-2').onclick = open; document.querySelector('#close-modal').onclick = () => document.querySelector('#modal').classList.remove('visible');
  document.querySelector('#modal').onclick = event => { if (event.target.id === 'modal') event.currentTarget.classList.remove('visible'); };
  document.querySelector('#search').oninput = event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('.appointment-card').forEach(element => element.style.display = element.textContent.toLowerCase().includes(query) ? '' : 'none'); };
  document.querySelector('#logout').onclick = () => { localStorage.removeItem('odontia-token'); token = null; authPage(); };
  document.querySelector('.mobile-menu').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  document.querySelectorAll('[data-section]').forEach(button => button.onclick = () => { if (button.dataset.section === 'Pacientes') loadPatients(); else if (button.dataset.section === 'Agenda') loadAgenda(); else if (button.dataset.section !== 'Inicio') toast(`${button.dataset.section} estará disponible próximamente.`); });
}
async function loadDashboard() { appointments = (await api('/api/appointments')).appointments; dashboard(); }
document.addEventListener('submit', async event => {
  if (!event.target.matches('.modal:not(.patient-modal)')) return;
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
    await api(isEditing ? `/api/appointments/${editingAppointment.id}` : '/api/appointments', { method:isEditing ? 'PATCH' : 'POST', body:JSON.stringify({ patientName:values.patientName, appointmentType:values.appointmentType, startsAt:`${values.date}T${values.time}:00`, durationMinutes:Number(values.durationMinutes || 30), ...(isEditing ? { status:values.status } : {}) }) });
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
  form.allergies.value = editingPatient.allergies || '';
  form.notes.value = editingPatient.notes || '';
  modal.querySelector('.eyebrow').textContent = 'EDITAR PACIENTE';
  modal.querySelector('h2').textContent = 'Actualizar expediente';
  form.querySelector('.save-appointment').textContent = 'Guardar cambios';
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
  modal.classList.add('visible');
});
function toast(message) { const element = document.createElement('div'); element.className = 'toast'; element.textContent = message; document.body.append(element); setTimeout(() => element.remove(), 2800); }
async function boot() { if (!token) return authPage(); try { user = (await api('/api/auth/me')).user; await loadDashboard(); } catch { localStorage.removeItem('odontia-token'); token = null; authPage(); } }
boot();
