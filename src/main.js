import './style.css';

const initialAppointments = [
  { id: 1, time: '09:00', patient: 'Mariana Torres', type: 'Limpieza dental', duration: '45 min', tone: 'aqua', status: 'Confirmada', initials: 'MT' },
  { id: 2, time: '10:00', patient: 'Carlos Mendoza', type: 'Valoración · primera cita', duration: '30 min', tone: 'purple', status: 'Pendiente', initials: 'CM' },
  { id: 3, time: '11:30', patient: 'Sofía Ramírez', type: 'Ajuste de ortodoncia', duration: '30 min', tone: 'orange', status: 'Confirmada', initials: 'SR' },
  { id: 4, time: '16:00', patient: 'Diego Hernández', type: 'Revisión de tratamiento', duration: '30 min', tone: 'blue', status: 'Pendiente', initials: 'DH' },
];

let appointments = JSON.parse(localStorage.getItem('odontia-appointments') || 'null') || initialAppointments;
let activeView = 'Inicio';
let activeFilter = 'Todas';

const icon = (name) => ({
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 5.8M17 14c2.4.4 4 2.4 4 5"/></svg>',
  tooth: '<svg viewBox="0 0 24 24"><path d="M7.2 3.7C9 3 10.1 4.2 12 4.2s3-1.2 4.8-.5c2.8 1.1 3.1 4.4 1.5 7.2-1.3 2.3-1.4 6.9-3.2 8.9-.9 1-1.9.4-2.1-.6L12 14l-.9 5.2c-.2 1-1.2 1.6-2.1.6-1.8-2-1.9-6.6-3.2-8.9-1.6-2.8-1.4-6.1 1.4-7.2Z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.3 2.3-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.3-2.3.1-.1A1.7 1.7 0 0 0 6.4 15a1.7 1.7 0 0 0-1.5-1H4.7v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L6 7.8l2.3-2.3.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.3 2.3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  message: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8 8 0 0 1-8.5 8 9.4 9.4 0 0 1-3.8-.8L3 20.5l1.7-5.2A7.6 7.6 0 0 1 4 11.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 8Z"/></svg>',
}[name] || '');

function navItem(label, iconName) {
  return `<button class="nav-item ${activeView === label ? 'active' : ''}" data-view="${label}">${icon(iconName)}<span>${label}</span></button>`;
}

function appointmentCard(a) {
  return `<article class="appointment-card">
    <time>${a.time}</time><div class="appointment-line"></div>
    <div class="avatar ${a.tone}">${a.initials}</div>
    <div class="appointment-info"><strong>${a.patient}</strong><span>${a.type} <i>•</i> ${a.duration}</span></div>
    <span class="status ${a.status === 'Confirmada' ? 'confirmed' : 'pending'}">${a.status}</span>
    <button class="card-more" aria-label="Más opciones">•••</button>
  </article>`;
}

function schedule() {
  const shown = activeFilter === 'Todas' ? appointments : appointments.filter(a => a.status === activeFilter);
  return `<section class="schedule panel"><div class="section-heading"><div><h2>Citas de hoy</h2><p>Martes, 30 de septiembre</p></div><button class="text-button" data-view="Agenda">Ver agenda completa ${icon('chevron')}</button></div>
    <div class="filters">${['Todas', 'Confirmada', 'Pendiente'].map(f => `<button class="filter ${activeFilter === f ? 'selected' : ''}" data-filter="${f}">${f === 'Todas' ? 'Todas' : f + 's'} <b>${f === 'Todas' ? appointments.length : appointments.filter(a => a.status === f).length}</b></button>`).join('')}</div>
    <div class="appointment-list">${shown.map(appointmentCard).join('') || '<p class="empty">No hay citas con este estado.</p>'}</div></section>`;
}

function app() {
  document.querySelector('#app').innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">O</span><span>odontia</span></a>
    <nav>${navItem('Inicio','grid')}${navItem('Agenda','calendar')}${navItem('Pacientes','users')}${navItem('Tratamientos','tooth')}${navItem('Reportes','chart')}</nav>
    <div class="sidebar-bottom">${navItem('Configuración','settings')}<div class="doctor"><div class="avatar doctor-avatar">DA</div><div><strong>Dra. Andrea</strong><span>Odontóloga</span></div><button aria-label="Cambiar cuenta">⌄</button></div></div></aside>
    <main><header class="topbar"><button class="mobile-menu" aria-label="Abrir menú">☰</button><div class="search">${icon('search')}<input id="search" placeholder="Buscar paciente, cita o tratamiento…" /></div><div class="header-actions"><button class="icon-button notification" aria-label="Notificaciones">${icon('bell')}<i></i></button><button class="new-appointment" id="open-modal">${icon('plus')} Nueva cita</button></div></header>
    <div class="content"><div class="welcome"><div><p class="eyebrow">MARTES, 30 DE SEPTIEMBRE</p><h1>Buenos días, Andrea <span>👋</span></h1><p>Esto es lo que tienes programado para hoy.</p></div><div class="mini-calendar"><b>SEPTIEMBRE 2026</b><div class="calendar-days"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>${[28,29,30,1,2,3,4].map((d,i)=>`<strong class="${i === 2 ? 'today' : ''}">${d}</strong>`).join('')}</div></div></div>
    <section class="metrics"><article><div class="metric-icon teal">${icon('calendar')}</div><p>Citas para hoy</p><strong>${appointments.length}</strong><span class="up">↗ 2 más que ayer</span></article><article><div class="metric-icon violet">${icon('users')}</div><p>Pacientes este mes</p><strong>48</strong><span class="up">↗ 12% vs. mes anterior</span></article><article><div class="metric-icon amber">${icon('tooth')}</div><p>Tratamientos activos</p><strong>23</strong><span>7 por finalizar</span></article><article><div class="metric-icon blue">${icon('chart')}</div><p>Ingresos del mes</p><strong>$32,480</strong><span class="up">↗ 18% vs. mes anterior</span></article></section>
    <div class="dashboard-grid">${schedule()}<aside class="right-column"><section class="panel next-patient"><div class="section-heading"><div><h2>Próximo paciente</h2><p>En 28 minutos</p></div><span class="clock">09:00</span></div><div class="patient-feature"><div class="avatar aqua large">MT</div><div><h3>Mariana Torres</h3><p>32 años · Paciente desde 2023</p></div></div><div class="detail-row"><span>Motivo de consulta</span><strong>Limpieza dental</strong></div><div class="detail-row"><span>Última visita</span><strong>12 jun 2026</strong></div><button class="outline-button">Ver expediente ${icon('chevron')}</button></section><section class="panel reminder"><div class="reminder-top"><span class="whatsapp">${icon('message')}</span><button class="dismiss" aria-label="Ocultar">×</button></div><h3>Recordatorios inteligentes</h3><p>2 pacientes aún no confirman su cita de mañana.</p><button>Enviar recordatorios</button></section></aside></div></div></main></div>${modal()}`;
  bindEvents();
}

function modal() { return `<div class="modal-backdrop" id="modal"><form class="modal"><button type="button" class="modal-close" id="close-modal">×</button><p class="eyebrow">NUEVA CITA</p><h2>Agenda una consulta</h2><label>Paciente<input required name="patient" placeholder="Nombre completo" /></label><div class="form-row"><label>Hora<input required name="time" type="time" value="09:00" /></label><label>Tipo de cita<select name="type"><option>Limpieza dental</option><option>Valoración · primera cita</option><option>Revisión de tratamiento</option><option>Ajuste de ortodoncia</option></select></label></div><button class="save-appointment">Guardar cita</button></form></div>`; }

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { activeView = el.dataset.view; toast(activeView === 'Inicio' ? 'Estás en el inicio' : `${activeView} estará disponible en la siguiente pantalla del MVP`); app(); }));
  document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => { activeFilter = el.dataset.filter; app(); }));
  document.querySelector('#open-modal').addEventListener('click', () => document.querySelector('#modal').classList.add('visible'));
  document.querySelector('#close-modal').addEventListener('click', () => document.querySelector('#modal').classList.remove('visible'));
  document.querySelector('#modal').addEventListener('click', e => { if(e.target.id === 'modal') e.currentTarget.classList.remove('visible'); });
  document.querySelector('.modal form')?.addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); const patient = data.get('patient'); appointments.push({id: Date.now(), time: data.get('time'), patient, type: data.get('type'), duration: '30 min', tone: 'blue', status: 'Pendiente', initials: patient.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}); appointments.sort((a,b) => a.time.localeCompare(b.time)); localStorage.setItem('odontia-appointments', JSON.stringify(appointments)); toast('Cita guardada correctamente'); app(); });
  document.querySelector('.reminder button')?.addEventListener('click', () => toast('Recordatorios preparados para enviar por WhatsApp.'));
  document.querySelector('#search')?.addEventListener('input', e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('.appointment-card').forEach(card => card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none'); });
  document.querySelector('.mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
}

function toast(message) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = message; document.body.append(t); setTimeout(() => t.remove(), 2800); }
app();
