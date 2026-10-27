if (window.location.protocol === 'file:') {
  window.location.replace('http://127.0.0.1:4173/admin.html');
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const euro = cents => new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'}).format((cents || 0) / 100);
const dateTime = seconds => seconds ? new Intl.DateTimeFormat('de-DE', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Berlin'}).format(new Date(seconds * 1000)) : '–';
const shortDate = seconds => new Intl.DateTimeFormat('de-DE', {weekday:'short', day:'2-digit', month:'2-digit', timeZone:'Europe/Berlin'}).format(new Date(seconds * 1000));
const timeOnly = seconds => new Intl.DateTimeFormat('de-DE', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Berlin'}).format(new Date(seconds * 1000));
const roleNames = {admin:'Admin', psychologist:'Psycholog:in', psychotherapist:'Bisherige Rolle'};
const actionNames = {user_created:'Teammitglied angelegt',user_activated:'Zugang aktiviert',user_deactivated:'Zugang deaktiviert',patient_created:'Patientenakte angelegt',intake_converted:'Anfrage übernommen',patient_assigned:'Zuständigkeit geändert',patient_archived:'Patientenakte archiviert',appointment_created:'Termin angelegt',appointment_status_changed:'Terminstatus geändert',availability_added:'Verfügbarkeit eingetragen',availability_day_set:'Tagesverfügbarkeit geändert',availability_released:'Verfügbarkeiten freigegeben',clinical_entry_created:'Dokumentation ergänzt',document_uploaded:'Dokument hochgeladen',document_downloaded:'Dokument heruntergeladen',chat_message_sent:'Teamnachricht gesendet'};
const entryNames = {session_note:'Sitzungsdokumentation',general_note:'Interne Notiz',concern:'Anliegen',diagnosis:'Früherer Akteneintrag'};
const statusNames = {scheduled:'Geplant',completed:'Abgeschlossen',cancelled:'Abgesagt',no_show:'Nicht erschienen'};
const packageNames = {'einzel-1':'Einzel · 1 Gespräch','einzel-3':'Einzel · 3 Gespräche','einzel-6':'Einzel · 6 Gespräche','einzel-10':'Einzel · 10 Gespräche','paar-1':'Paar · 1 Gespräch','paar-3':'Paar · 3 Gespräche','paar-6':'Paar · 6 Gespräche','paar-10':'Paar · 10 Gespräche','familie-1':'Familie · 1 Gespräch','familie-3':'Familie · 3 Gespräche','familie-6':'Familie · 6 Gespräche','familie-10':'Familie · 10 Gespräche'};

let state = null;
let portalSessionGeneration = 0;
let currentView = 'overview';
let calendarDate = new Date();
let selectedPatientId = null;
let availabilityPractitionerId = null;
let selectedAvailabilityDay = null;
let toastTimer;
let activeChatPeerId = null;
let chatPollTimer = null;
let chatRequestPending = false;

function isAdmin(){ return state?.me.roles.includes('admin'); }
function hasClinicalRole(){ return state?.me.roles.some(role => role === 'psychologist'); }
function user(id){ return state?.users.find(item => item.id === id); }
function patient(id){ return state?.patients.find(item => item.id === id); }
function monthKey(date = calendarDate){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function initials(name){ return String(name || '?').split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase(); }

function toast(message, error = false){
  const node = $('#toast'); node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3500);
}

async function api(url, options = {}){
  const response = await (window.TheraViaPortalTransport?.request||fetch)(url, {credentials:'same-origin', cache:'no-store', ...options});
  let result = {};
  try { result = await response.json(); } catch {}
  if (!response.ok) throw new Error(result.error || 'Die Anfrage konnte nicht verarbeitet werden.');
  return result;
}

async function loadState(month = monthKey()){
  const generation=portalSessionGeneration;
  const nextState = await api(`/api/portal/state?month=${encodeURIComponent(month)}`);
  if(generation!==portalSessionGeneration)return;
  state=nextState;renderAll();
}

async function act(payload, success){
  await api('/api/portal/action', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  if (success) toast(success);
  await loadState(state?.monthKey || monthKey());
}

function showPortal(){
  $('#login-view').hidden = true; $('#portal').hidden = false;
  const me = state.me;
  $('#user-name').textContent = me.displayName; $('#welcome-name').textContent = `${me.displayName.split(' ')[0]}.`;
  $('#user-avatar').textContent = initials(me.displayName); $('#user-role').textContent = me.roles.map(role => roleNames[role]).join(' · ');
  $$('[data-admin]').forEach(node => node.hidden = !isAdmin());
  $$('[data-revenue]').forEach(node => node.hidden = !(isAdmin() || hasClinicalRole()));
  if (!isAdmin() && ['intakes','team','activity','operations'].includes(currentView)) switchView('overview');
}

function renderAll(){
  showPortal();
  $('#today-label').textContent = new Intl.DateTimeFormat('de-DE', {weekday:'long', day:'2-digit', month:'long', year:'numeric'}).format(new Date());
  $('#quick-button').hidden = !isAdmin();
  renderOverview(); renderCalendar(); renderIntakes(); renderPatients(); renderChats(); renderAvailability(); renderTeam(); renderRevenue(); renderActivity();
  if (typeof renderPracticeExtras==='function') renderPracticeExtras();
  if(selectedPatientId){if(patient(selectedPatientId))openPatient(selectedPatientId,false);else closePatient();}
}

function stat(label, value, note){ return `<article class="stat-card"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></article>`; }
function appointmentRow(item){
  const p = patient(item.patientId); const clinician = user(item.practitionerId);
  return `<button class="appointment-row row-button" data-patient="${esc(item.patientId)}"><span class="appointment-time"><strong>${esc(timeOnly(item.startsAt))}</strong><span>${esc(shortDate(item.startsAt))}</span></span><span class="appointment-main"><b>${esc(p?.name || 'Unbekannte Akte')}</b><span>${esc(item.kind)} · ${esc(clinician?.displayName || 'Nicht zugeordnet')}</span></span><span class="status-pill ${item.status !== 'scheduled' ? 'off' : ''}">${esc(statusNames[item.status] || item.status)}</span></button>`;
}

function renderOverview(){
  const now = Math.floor(Date.now()/1000); const upcoming = state.appointments.filter(item => item.startsAt >= now && item.status === 'scheduled').sort((a,b)=>a.startsAt-b.startsAt);
  const unassigned = state.patients.filter(item => item.status === 'active' && !item.assignedUserId).length;
  const openIntakes = state.intakes.filter(item => !item.completed && !item.archived && ['paid','requested'].includes(item.status)).length;
  const monthRevenue = state.revenue.filter(item => new Date(item.paidAt*1000).getMonth() === new Date().getMonth() && new Date(item.paidAt*1000).getFullYear() === new Date().getFullYear()).reduce((sum,item)=>sum+item.amount,0);
  const cards = isAdmin() ? [stat('Nächste Termine', upcoming.length, 'geplant'),stat('Ohne Zuweisung', unassigned, 'Patient:innen'),stat('Neue Anfragen', openIntakes, 'zu bearbeiten'),stat('Umsatz im Monat', euro(monthRevenue), 'bestätigte Zahlungen')] : [stat('Nächste Termine', upcoming.length, 'in deinem Kalender'),stat('Aktive Patient:innen', state.patients.filter(p=>p.status==='active').length, 'dir zugewiesen'),stat('Offene Dokumentation', state.appointments.filter(a=>a.status==='completed'&&!state.entries.some(e=>e.appointmentId===a.id)).length, 'abgeschlossene Termine'),stat('Freie Tage', state.availabilityDays.filter(a=>a.practitionerId===state.me.id&&a.dayKey.startsWith(state.targetMonthKey)&&a.status==='free').length, state.targetMonthKey)];
  $('#overview-stats').innerHTML = cards.join('');
  $('#next-appointments').innerHTML = upcoming.length ? upcoming.slice(0,5).map(appointmentRow).join('') : '<div class="empty">Aktuell stehen keine kommenden Termine im Kalender.</div>';
  const released = state.releases.some(item => item.practitionerId === state.me.id && item.monthKey === state.targetMonthKey);
  const ownSlots = state.availabilityDays.filter(item => item.practitionerId === state.me.id && item.dayKey.startsWith(state.targetMonthKey) && item.status === 'free').length;
  $('#availability-pulse').innerHTML = `<div class="pulse-number">${ownSlots}</div><p>${released ? 'Deine Zeiten wurden freigegeben.' : `Freie Zeiten für ${esc(monthLabel(state.targetMonthKey))} eintragen und bis zum 15. freigeben.`}</p><button class="secondary-btn" data-go="availability">${released ? 'Freigabe ansehen' : 'Jetzt planen'}</button>`;
}

function monthLabel(key){ const [year,month] = key.split('-').map(Number); return new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(year,month-1,1)); }
function localDayKey(seconds){ return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(seconds*1000)); }

function renderCalendar(){
  $('#calendar-month').textContent = new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(calendarDate);
  const year=calendarDate.getFullYear(), month=calendarDate.getMonth(); const first=new Date(year,month,1); const mondayOffset=(first.getDay()+6)%7; const start=new Date(year,month,1-mondayOffset);
  let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=>`<div class="calendar-weekday">${day}</div>`).join('');
  for(let i=0;i<42;i++){
    const day=new Date(start); day.setDate(start.getDate()+i); const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    const events=state.appointments.filter(item=>localDayKey(item.startsAt)===key).sort((a,b)=>a.startsAt-b.startsAt);
    const today=new Date(); const sameToday=day.toDateString()===today.toDateString();
    html += `<div class="calendar-day ${day.getMonth()!==month?'outside':''} ${sameToday?'today':''} ${isAdmin()?'bookable':''}" ${isAdmin()?`data-calendar-day="${key}"`:""}>${isAdmin()?`<button type="button" class="calendar-day-add" data-book-day="${key}" aria-label="Termin am ${esc(plannerLabel(key))} anlegen"><span class="day-number">${day.getDate()}</span><span class="day-plus" aria-hidden="true">+</span></button>`:`<span class="day-number">${day.getDate()}</span>`}${events.map(item=>{const p=patient(item.patientId);return `<button class="calendar-event ${item.status==='cancelled'?'cancelled':''}" data-patient="${esc(item.patientId)}" data-appointment="${esc(item.id)}"><b>${esc(timeOnly(item.startsAt))}</b> ${esc(p?.name||'Termin')}</button>`}).join('')}</div>`;
  }
  $('#calendar-grid').innerHTML=html;let hint=$('#calendar-hint');if(!hint){hint=document.createElement('p');hint.id='calendar-hint';hint.className='calendar-hint';$('#calendar-grid').before(hint);}hint.textContent=isAdmin()?'Tag anklicken, freie Uhrzeit auswählen und Termin anlegen.':'Klicke auf einen Termin, um die zugehörige Akte zu öffnen.';
}

function renderIntakes(){
  if(!isAdmin()) return;
  const search=$('#intake-search').value.trim().toLowerCase(), filter=$('#intake-filter').value;
  const items=state.intakes.filter(item=>{const hay=[item.contact?.name,item.contact?.language,item.sku,...(item.intake?.concerns||[])].join(' ').toLowerCase();const ok=filter==='all'||(filter==='converted'&&item.completed&&!item.archived)||(filter==='archived'&&item.archived)||(filter==='open'&&!item.completed&&!item.archived);return ok&&(!search||hay.includes(search));});
  $('#nav-intake-count').textContent=state.intakes.filter(item=>!item.completed&&!item.archived&&['paid','requested'].includes(item.status)).length;
  $('#intake-list').innerHTML=items.length?items.map(item=>`<article class="intake-card"><div class="intake-card-head"><div><span class="kicker">${item.kind==='payment'?'BESTÄTIGTE ZAHLUNG':'ORIENTIERUNGSANFRAGE'} · ${esc(dateTime(item.paidAt||item.createdAt))}</span><h3>${esc(item.contact.name)}</h3><p class="muted">${esc(item.contact.language)} · ${esc(item.contact.phone)} · ${esc(packageNames[item.sku]||item.sku)}</p><div class="chip-row">${(item.intake.concerns||[]).map(label=>`<span class="chip">${esc(label)}</span>`).join('')}</div></div><div class="card-actions">${item.status!=='contacted'?`<button class="secondary-btn" data-contacted="${item.id}" data-kind="${item.kind}">Kontakt erfolgt</button>`:'<span class="status-pill">Kontaktiert</span>'}${item.converted?`<button class="secondary-btn" data-patient="${item.patientId}">Akte öffnen</button><button class="main" data-plan-patient="${item.patientId}">Termin zuweisen</button>`:`<button class="main" data-convert="${item.id}" data-kind="${item.kind}">Als Patient:in übernehmen</button>`}${item.archived?`<button class="text-btn" data-restore-intake="${item.id}" data-kind="${item.kind}">Wiederherstellen</button>`:`<button class="text-btn" data-archive-intake="${item.id}" data-kind="${item.kind}">Archivieren</button>`}</div></div></article>`).join(''):'<div class="empty">Keine passenden Anfragen vorhanden.</div>';
}

function renderPatients(){
  const search=$('#patient-search').value.trim().toLowerCase(), filter=$('#patient-filter').value;
  const items=state.patients.filter(item=>{const hay=[item.name,item.language,item.careType,...(item.concerns||[])].join(' ').toLowerCase();const ok=filter==='all'||(filter==='unassigned'&&!item.assignedUserId)||(filter==='active'&&item.status==='active');return ok&&(!search||hay.includes(search));});
  $('#patient-list').innerHTML=items.length?items.map(item=>{const clinician=user(item.assignedUserId);return `<article class="patient-card" data-patient="${item.id}" tabindex="0"><div class="patient-identity"><div class="user-avatar">${esc(initials(item.name))}</div><div><span class="kicker">${esc(item.careType||'BEGLEITUNG')}</span><h3>${esc(item.name)}</h3><div class="chip-row">${(item.concerns||[]).slice(0,3).map(label=>`<span class="chip">${esc(label)}</span>`).join('')}</div></div></div><div class="patient-meta"><strong>${esc(clinician?.displayName||'Noch nicht zugewiesen')}</strong><span>${esc(item.language||'Sprache offen')} · ${esc(item.status==='archived'?'Archiviert':'Aktiv')}</span></div></article>`}).join(''):'<div class="empty">Keine Patient:innen für diese Auswahl.</div>';
}

function renderAvailability(){
  const target=state.targetMonthKey;
  const clinicians=state.users.filter(item=>item.active&&item.roles.some(role=>role==='psychologist'));
  if(!availabilityPractitionerId||!clinicians.some(item=>item.id===availabilityPractitionerId)) availabilityPractitionerId=isAdmin()?state.me.id:state.me.id;
  const select=$('#availability-practitioner');
  select.innerHTML=clinicians.map(item=>`<option value="${item.id}" ${item.id===availabilityPractitionerId?'selected':''}>${esc(item.displayName)}</option>`).join('');
  select.closest('label').hidden=!isAdmin();
  const selectedUser=availabilityPractitionerId||state.me.id;
  const released=state.releases.some(item=>item.practitionerId===selectedUser&&item.monthKey===target);
  const days=state.availabilityDays.filter(item=>item.practitionerId===selectedUser);
  $('#availability-month').textContent=monthLabel(target);
  $('#release-button').disabled=released||(!isAdmin()&&selectedUser!==state.me.id);
  $('#release-button').textContent=released?'Freigegeben ✓':'Monat freigeben';
  $('#availability-summary').innerHTML=`<div class="notice ${released?'done':''}"><div><strong>${released?'Monatsplanung ist freigegeben':'Freigabe bis zum 15.'}</strong><p>${released?'Du kannst deine Tage weiterhin anpassen; Änderungen setzen die Freigabe zurück.':`Tippe die Tage an, an denen du in ${esc(monthLabel(target))} verfügbar bist.`}</p></div><span class="status-pill ${released?'':'warn'}">${released?'Erledigt':'Ausstehend'}</span></div>`;
  const [year,month]=target.split('-').map(Number);const first=new Date(year,month-1,1);const offset=(first.getDay()+6)%7;const start=new Date(year,month-1,1-offset);let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=>`<div class="availability-weekday">${day}</div>`).join('');
  const byDate=new Map(days.map(item=>[item.dayKey,item]));
  for(let i=0;i<42;i++){
    const day=new Date(start);day.setDate(start.getDate()+i);const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;const record=byDate.get(key);const isCurrent=day.getMonth()===month-1;const inTarget=key.startsWith(target);
    html+=`<button class="availability-day ${isCurrent?'':'outside'} ${record?.status==='free'?'is-free':''} ${record?.status==='unavailable'?'is-unavailable':''}" data-availability-day="${key}" ${inTarget?'':'disabled'}><span class="availability-day-number">${day.getDate()}</span><span class="availability-day-status">${record?.status==='free'?`Frei · ${record.startsAt?timeOnly(record.startsAt)+'–'+timeOnly(record.endsAt):'17–22 Uhr'}`:record?.status==='unavailable'?'Nicht verfügbar':'Tippen zum Auswählen'}</span></button>`;
  }
  $('#availability-calendar').innerHTML=html;
  $('#release-status').innerHTML=clinicians.map(item=>{const done=state.releases.some(entry=>entry.practitionerId===item.id&&entry.monthKey===target);const count=state.availabilityDays.filter(entry=>entry.practitionerId===item.id&&entry.dayKey.startsWith(target)&&entry.status==='free').length;return `<div class="release-person"><div class="user-avatar">${esc(initials(item.displayName))}</div><div><b>${esc(item.displayName)}</b><span>${count} freie Tage · ${done?'Freigegeben':'Noch offen'}</span></div><span class="status-pill ${done?'':'warn'}">${done?'✓':'!'}</span></div>`}).join('');
}

function renderTeam(){
  if(!isAdmin())return;
  $('#team-list').innerHTML=state.users.map(item=>`<article class="team-card"><div class="user-avatar">${esc(initials(item.displayName))}</div><h3>${esc(item.displayName)}</h3><p>${esc(item.email||item.username)}</p><div>${item.roles.map(role=>`<span class="role-tag">${esc(roleNames[role])}</span>`).join('')}</div><footer><span class="status-pill ${item.active?'':'off'}">${item.active?'Aktiv':'Deaktiviert'}</span>${item.owner?'':`<button data-toggle-user="${item.id}" data-active="${item.active?'false':'true'}">${item.active?'Zugang deaktivieren':'Zugang aktivieren'}</button>`}</footer></article>`).join('');
}

function renderRevenue(){
  if(!isAdmin()&&!hasClinicalRole())return;
  const personal=!isAdmin();
  $('[data-page="revenue"] h1').textContent=personal?'Deine Umsätze':'Umsätze';
  $('[data-page="revenue"] .page-heading p').textContent=personal?'Anteiliger Paketwert deiner abgeschlossenen Gespräche. Dies ist keine Honorar- oder Auszahlungsabrechnung.':'Bestätigte Zahlungseingänge abzüglich tatsächlich erfasster Erstattungen.';
  $('[data-page="revenue"] .panel-head h2').textContent=personal?'Wert deiner abgeschlossenen Gespräche':'Zahlungseingänge';
  const total=state.revenue.reduce((sum,item)=>sum+item.amount,0); const monthMap={};
  state.revenue.forEach(item=>{const key=new Date(item.paidAt*1000).toISOString().slice(0,7);monthMap[key]=(monthMap[key]||0)+item.amount});
  const months=Object.entries(monthMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6); const max=Math.max(1,...months.map(([,value])=>value));
  $('#revenue-stats').innerHTML=personal?[stat('Gesprächswert',euro(total),`${state.revenue.length} abgeschlossene Gespräche`),stat('Ø je Gespräch',euro(state.revenue.length?total/state.revenue.length:0),'anteiliger Paketpreis'),stat('Dieser Monat',euro(monthMap[new Date().toISOString().slice(0,7)]||0),'abgeschlossene Gespräche'),stat('Gespräche',state.revenue.length,'selbst durchgeführt')].join(''):[stat('Gesamt bestätigt',euro(total),`${state.revenue.length} Zahlungen`),stat('Ø je Zahlung',euro(state.revenue.length?total/state.revenue.length:0),'Paketdurchschnitt'),stat('Aktueller Monat',euro(monthMap[new Date().toISOString().slice(0,7)]||0),'Zahlungseingänge'),stat('Offene Erstattungen',euro((state.refunds||[]).filter(r=>r.status==='requested').reduce((sum,r)=>sum+r.amount,0)),'zur Prüfung vorgemerkt')].join('');
  $('#revenue-chart').innerHTML=months.length?months.map(([key,value])=>`<div class="bar-wrap"><b>${esc(euro(value))}</b><div class="bar" style="height:${Math.max(3,value/max*100)}%"></div><span>${esc(monthLabel(key))}</span></div>`).join(''):'<div class="empty">Noch keine bestätigten Zahlungen.</div>';
  $('#revenue-list').innerHTML=state.revenue.slice(0,8).map(item=>`<div class="revenue-row"><span class="appointment-time"><strong>${esc(new Date(item.paidAt*1000).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}))}</strong></span><span class="appointment-main"><b>${esc(packageNames[item.sku]||item.sku)}</b><span>${personal?'Gespräch abgeschlossen':item.kind==='refund'?'Erstattung erfasst':item.method==='bank'?'Überweisung bestätigt':item.method==='cash'?'Barzahlung bestätigt':'Zahlung bestätigt'}</span></span><b>${esc(euro(item.amount))}</b></div>`).join('');
}

function renderActivity(){
  if(!isAdmin())return;
  $('#activity-list').innerHTML=state.activity.length?state.activity.map(item=>`<div class="timeline-item"><b>${esc(actionNames[item.action]||item.action)}</b><span>${esc(user(item.actorId)?.displayName||item.actorId)} · ${esc(dateTime(item.createdAt))}</span></div>`).join(''):'<div class="empty">Noch keine protokollierten Aktionen.</div>';
}

function renderChats(){
  const unread = state.chatUnread || 0;
  const badge = $('#nav-chat-count');
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.hidden = unread === 0;
  const contacts = state.users.filter(item => item.active && item.id !== state.me.id);
  $('#chat-contact-count').textContent = `${contacts.length} ${contacts.length === 1 ? 'Person' : 'Personen'}`;
  $('#chat-contact-list').innerHTML = contacts.length ? contacts.map(contact => {
    const thread = state.chatThreads.find(item => item.peerId === contact.id);
    const role = contact.roles.map(item => roleNames[item]).join(' · ');
    const when = thread?.lastAt ? timeOnly(thread.lastAt) : '';
    return `<button class="chat-contact ${activeChatPeerId === contact.id ? 'active' : ''}" role="listitem" data-chat-peer="${esc(contact.id)}" aria-current="${activeChatPeerId === contact.id ? 'true' : 'false'}"><span class="chat-peer-avatar">${esc(initials(contact.displayName))}</span><span class="chat-contact-copy"><b>${esc(contact.displayName)}</b><small>${esc(role || 'Teammitglied')}</small><span>${esc(thread?.preview || 'Gespräch beginnen')}</span></span><span class="chat-contact-meta">${when ? `<time>${esc(when)}</time>` : ''}${thread?.unread ? `<i aria-label="${thread.unread} ungelesene Nachrichten">${thread.unread > 9 ? '9+' : thread.unread}</i>` : ''}</span></button>`;
  }).join('') : '<div class="empty chat-empty">Noch keine weiteren Teammitglieder mit aktivem Zugang.</div>';
}

async function openChat(peerId){
  activeChatPeerId = peerId;
  renderChats();
  await refreshChat(true);
  $('#chat-message').focus({preventScroll:true});
  startChatPolling();
}

async function refreshChat(markRead = false){
  if(!activeChatPeerId || chatRequestPending || currentView !== 'messages') return;
  chatRequestPending = true;
  try{
    const result = await api(`/api/portal/chat?with=${encodeURIComponent(activeChatPeerId)}`);
    const peer = result.peer;
    $('#chat-header').innerHTML = `<span class="chat-peer-avatar">${esc(initials(peer.displayName))}</span><div><b>${esc(peer.displayName)}</b><span>${esc(peer.roles.map(role => roleNames[role]).join(' · '))}</span></div><span class="chat-secure">● Intern</span>`;
    $('#chat-compose').hidden = false;
    $('#chat-messages').innerHTML = result.messages.length ? result.messages.map(message => {
      const mine = message.senderId === state.me.id;
      return `<article class="chat-bubble ${mine ? 'mine' : 'theirs'}"><p>${esc(message.text)}</p><footer>${esc(dateTime(message.createdAt))}${mine ? `<span>${message.readAt ? ' · Gelesen' : ' · Gesendet'}</span>` : ''}</footer></article>`;
    }).join('') : '<div class="empty">Noch keine Nachrichten. Schreib eine kurze Nachricht, um den Austausch zu beginnen.</div>';
    const box = $('#chat-messages'); box.scrollTop = box.scrollHeight;
    const unread = result.messages.some(message => message.senderId === peer.id && !message.readAt);
    if((markRead || unread) && unread){
      await api('/api/portal/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mark_chat_read',peerId:peer.id})});
      state = await api(`/api/portal/state?month=${encodeURIComponent(state.monthKey || monthKey())}`);
      showPortal(); renderChats();
    }
  }catch(error){toast(error.message,true)}
  finally{chatRequestPending=false}
}

function startChatPolling(){
  clearInterval(chatPollTimer);
  chatPollTimer = setInterval(async()=>{
    if(currentView !== 'messages' || document.hidden || !state) return;
    try{await loadState(state.monthKey || monthKey());await refreshChat()}catch{}
  },8000);
}

function switchView(view){
  currentView=view; $$('.view').forEach(node=>node.classList.toggle('active',node.dataset.page===view)); $$('#portal-nav button').forEach(node=>node.classList.toggle('active',node.dataset.view===view));
  if(view === 'messages'){
    startChatPolling();
    if(!activeChatPeerId){const first=state?.chatThreads?.[0]?.peerId || state?.users?.find(item=>item.active&&item.id!==state.me.id)?.id;if(first)openChat(first)}
  }else clearInterval(chatPollTimer);
  $('.sidebar').classList.remove('open'); $('#portal').classList.remove('menu-open');$('#menu-button').setAttribute('aria-expanded','false'); $('#portal-main').focus({preventScroll:true});
}

function dialog(title,kicker,content){ $('#form-dialog').classList.remove('appointment-dialog'); $('#dialog-title').textContent=title;$('#dialog-kicker').textContent=kicker;$('#dialog-content').innerHTML=content;$('#form-dialog').showModal(); }
function clinicianOptions(selected=''){return state.users.filter(item=>item.active&&item.roles.some(role=>role==='psychologist')).map(item=>`<option value="${item.id}" ${item.id===selected?'selected':''}>${esc(item.displayName)} · ${esc(item.roles.map(role=>roleNames[role]).join(', '))}</option>`).join('')}

function openForm(type, options={}){
  if(type==='appointment' && typeof openAppointmentPlanner==='function'){openAppointmentPlanner(options);return;}
  if(type==='patient')dialog('Patient:in anlegen','NEUE AKTE',`<form id="patient-form" class="form-grid"><label>Name<input name="name" required maxlength="120"></label><label>Sprache<select name="language">${['Deutsch','Dari','Farsi','Englisch','Türkisch','Russisch','Arabisch'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>E-Mail<input name="email" type="email"></label><label>Telefon<input name="phone"></label><label>Altersgruppe<select name="ageGroup"><option value="erwachsen">Erwachsen</option><option value="minderjaehrig">Minderjährig</option></select></label><label>Versorgungsform<select name="careType"><option value="einzel">Einzel</option><option value="paar">Paar</option><option value="familie">Familie</option></select></label><label class="full">Vorinformation<textarea name="preInfo"></textarea></label><div class="dialog-actions"><button type="button" data-close>Abbrechen</button><button class="submit">Akte anlegen</button></div></form>`);
  if(type==='team')dialog('Teammitglied anlegen','TEAM & ROLLEN',`<form id="team-form" class="form-grid"><label>Name<input name="displayName" required></label><label>E-Mail<input name="email" type="email" required></label><label>Benutzername<input name="username" pattern="[A-Za-z0-9._-]{3,40}" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" required></label><label>Startpasswort (mind. 4 Zeichen)<input name="password" type="password" minlength="4" maxlength="256" autocomplete="new-password" required></label><label>Startpasswort wiederholen<input name="passwordConfirmation" type="password" minlength="4" maxlength="256" autocomplete="new-password" required></label><div class="full"><span class="field-label">Rollen</span><div class="check-row"><label><input type="checkbox" name="roles" value="psychologist"> Psycholog:in</label><label><input type="checkbox" name="roles" value="admin"> Admin</label></div></div><div class="dialog-actions"><button type="button" data-close>Abbrechen</button><button class="submit">Zugang anlegen</button></div></form>`);
  if(type==='appointment')dialog('Termin zuweisen','KALENDER',`<form id="appointment-form" class="form-grid"><label class="full">Patient:in<select name="patientId" required><option value="">Bitte auswählen</option>${state.patients.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label class="full">Behandler:in<select name="practitionerId" required><option value="">Bitte auswählen</option>${clinicianOptions()}</select></label><label>Beginn<input name="start" type="datetime-local" required></label><label>Dauer<select name="duration"><option value="15">15 Minuten</option><option value="50" selected>50 Minuten</option><option value="70">70 Minuten</option></select></label><label class="full">Terminart<input name="kind" value="Online-Sitzung" required></label><div class="dialog-actions"><button type="button" data-close>Abbrechen</button><button class="submit">Termin eintragen</button></div></form>`);
}

function openAvailabilityDay(dayKey){
  selectedAvailabilityDay=dayKey;
  const [year,month,day]=dayKey.split('-').map(Number);const date=new Date(year,month-1,day);const weekend=date.getDay()===0||date.getDay()===6;
  const saved=state.availabilityDays.find(item=>item.practitionerId===availabilityPractitionerId&&item.dayKey===dayKey);
  const from=saved?.startsAt?timeOnly(saved.startsAt):(weekend?'10:00':'17:00');const to=saved?.endsAt?timeOnly(saved.endsAt):(weekend?'18:00':'22:00');
  dialog(new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(date),'TAG PLANEN',`<div class="availability-choice"><button type="button" class="availability-choice-card ${saved?.status==='free'?'selected':''}" data-choose-status="free"><span class="choice-mark">✓</span><b>Frei</b><small>Für Termine verfügbar</small></button><button type="button" class="availability-choice-card ${saved?.status==='unavailable'?'selected':''}" data-choose-status="unavailable"><span class="choice-mark">×</span><b>Nicht verfügbar</b><small>An diesem Tag keine Termine</small></button></div><div id="availability-time-panel" ${saved?.status==='free'?'':'hidden'}><p class="suggested-hours">${weekend?'Wochenende · Vorschlag 10–18 Uhr':'Werktag · Vorschlag 17–22 Uhr'}</p><div class="time-fields"><label>Von<input id="day-start" type="time" value="${esc(from)}"></label><span>bis</span><label>Bis<input id="day-end" type="time" value="${esc(to)}"></label></div><button type="button" class="primary-btn save-day" data-save-day="free">Freien Tag speichern</button></div><div id="availability-unavailable-panel" ${saved?.status==='unavailable'?'':'hidden'}><p>Deine Verfügbarkeit für diesen Tag wird als „Nicht verfügbar“ markiert.</p><button type="button" class="primary-btn save-day" data-save-day="unavailable">Tag als nicht verfügbar speichern</button></div>`);
}

function localTimeToEpoch(dayKey,time){return berlinEpoch(`${dayKey}T${time}`)}

function openPatient(id, announce=true){
  const p=patient(id);if(!p)return;selectedPatientId=id;const clinician=user(p.assignedUserId);const appointments=state.appointments.filter(a=>a.patientId===id).sort((a,b)=>b.startsAt-a.startsAt);const entries=state.entries.filter(e=>e.patientId===id);const docs=state.documents.filter(d=>d.patientId===id);
  $('#drawer-title').textContent=p.name; $('#drawer-content').innerHTML=`
    <section class="drawer-section"><h3>Übersicht</h3><dl class="facts"><dt>Zuständig</dt><dd>${esc(clinician?.displayName||'Noch nicht zugewiesen')}</dd><dt>Sprache</dt><dd>${esc(p.language||'–')}</dd><dt>Telefon</dt><dd>${esc(p.phone||'–')}</dd><dt>E-Mail</dt><dd>${esc(p.email||'–')}</dd><dt>Versorgung</dt><dd>${esc(p.careType||'–')}</dd><dt>Anliegen</dt><dd>${esc((p.concerns||[]).join(', ')||'–')}</dd><dt>Vorinformation</dt><dd>${esc(p.preInfo||'–')}</dd></dl>${isAdmin()?`<form id="assign-form" class="inline-form"><select name="userId"><option value="">Nicht zugewiesen</option>${clinicianOptions(p.assignedUserId)}</select><button class="primary-btn">Zuständigkeit speichern</button></form>`:''}</section>
    <section class="drawer-section"><h3>Termine</h3>${isAdmin()?`<button class="primary-btn" data-plan-patient="${p.id}">+ Termin zuweisen</button>`:''}${appointments.length?appointments.map(a=>`<div class="appointment-row"><span class="appointment-time"><strong>${esc(timeOnly(a.startsAt))}</strong><span>${esc(shortDate(a.startsAt))}</span></span><span class="appointment-main"><b>${esc(a.kind)}</b><span>${esc(user(a.practitionerId)?.displayName||'–')}</span></span><select class="status-select" data-appointment-status="${a.id}" ${!isAdmin()&&a.practitionerId!==state.me.id?'disabled':''}>${Object.entries(statusNames).map(([key,label])=>`<option value="${key}" ${a.status===key?'selected':''}>${label}</option>`).join('')}</select></div>`).join(''):'<div class="empty">Noch keine Termine.</div>'}</section>
    ${hasClinicalRole()?`<section class="drawer-section"><h3>Dokumentation</h3>${entries.length?entries.map(e=>`<article class="entry"><header><b>${esc(entryNames[e.type]||e.type)}</b><span>${esc(user(e.authorId)?.displayName||e.authorId)} · ${esc(dateTime(e.createdAt))}</span></header><p>${esc(e.text)}</p></article>`).join(''):'<div class="empty">Noch keine Einträge.</div>'}<form id="entry-form" class="inline-form"><select name="entryType"><option value="session_note">Sitzungsdokumentation</option><option value="general_note">Interne Notiz</option><option value="concern">Leidensfeld</option></select><select name="appointmentId"><option value="">Allgemeiner Akteneintrag</option>${appointments.map(a=>`<option value="${a.id}">${esc(dateTime(a.startsAt))} · ${esc(a.kind)}</option>`).join('')}</select><textarea name="text" placeholder="Sachlich und beratungbezogen dokumentieren …" maxlength="5000" required></textarea><button class="primary-btn">Eintrag speichern</button></form></section><section class="drawer-section"><h3>Dokumente</h3>${docs.length?docs.map(d=>`<div class="availability-row"><span>▧</span><span class="appointment-main"><b>${esc(d.filename)}</b><span>${esc(dateTime(d.createdAt))}</span></span><a class="secondary-btn" href="/api/portal/documents/${d.id}">Herunterladen</a></div>`).join(''):'<div class="empty">Noch keine Dokumente.</div>'}<form id="document-form" class="inline-form"><input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required><small>PDF, JPG oder PNG · maximal 5 MB</small><button class="primary-btn">Dokument verschlüsselt speichern</button></form></section>`:''}
    ${isAdmin()?`<section class="drawer-section"><button class="secondary-btn danger-action" data-archive-patient="${p.id}" ${p.status==='archived'?'disabled':''}>Akte archivieren</button></section>`:''}`;
  $('#patient-drawer').classList.add('open');$('#patient-drawer').setAttribute('aria-hidden','false');$('#drawer-backdrop').hidden=false;if(announce)$('#drawer-close').focus();
}

function closePatient(){selectedPatientId=null;$('#patient-drawer').classList.remove('open');$('#patient-drawer').setAttribute('aria-hidden','true');$('#drawer-backdrop').hidden=true;$('#drawer-content').replaceChildren();$('#drawer-title').textContent='';}
async function logout(){portalSessionGeneration++;state=null;closePatient();if($('#form-dialog').open)$('#form-dialog').close();$('#dialog-content').replaceChildren();clearInterval(chatPollTimer);activeChatPeerId=null;$('#portal').hidden=true;$('#login-view').hidden=false;$('#admin-password').value='';await api('/api/admin/logout',{method:'POST'}).catch(()=>{});}

$('#toggle-admin-password').addEventListener('click',()=>{const input=$('#admin-password');const visible=input.type==='password';input.type=visible?'text':'password';$('#toggle-admin-password').textContent=visible?'Passwort verbergen':'Passwort anzeigen';$('#toggle-admin-password').setAttribute('aria-pressed',String(visible));});
$('#admin-password').addEventListener('keyup',event=>{$('#login-caps-lock').hidden=!event.getModifierState('CapsLock');});
$('#admin-password').addEventListener('blur',()=>{$('#login-caps-lock').hidden=true;});
$('#admin-login').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=$('#login-status'),submit=$('#admin-login button[type="submit"]');
  if(submit.disabled)return;
  submit.disabled=true;status.textContent='Anmeldung wird geprüft …';
  try{
    await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#admin-username').value.trim(),password:$('#admin-password').value})});
    await loadState();status.textContent='';$('#admin-password').value='';
    $('#admin-password').type='password';$('#toggle-admin-password').textContent='Passwort anzeigen';$('#toggle-admin-password').setAttribute('aria-pressed','false');
  }catch(error){status.textContent=error.message;}
  finally{submit.disabled=false;}
});
$('#admin-logout').addEventListener('click',logout);$('#mobile-logout').addEventListener('click',logout);
$('#portal-nav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)switchView(button.dataset.view)});
document.addEventListener('click',async event=>{
  const chatPeer=event.target.closest('[data-chat-peer]');if(chatPeer){openChat(chatPeer.dataset.chatPeer);return}
  const go=event.target.closest('[data-go]');if(go)switchView(go.dataset.go);
  const open=event.target.closest('[data-open]');if(open)openForm(open.dataset.open);
  const availabilityDay=event.target.closest('[data-availability-day]');if(availabilityDay)openAvailabilityDay(availabilityDay.dataset.availabilityDay);
  const chooseStatus=event.target.closest('[data-choose-status]');if(chooseStatus){$$('[data-choose-status]').forEach(button=>button.classList.toggle('selected',button===chooseStatus));$('#availability-time-panel').hidden=chooseStatus.dataset.chooseStatus!=='free';$('#availability-unavailable-panel').hidden=chooseStatus.dataset.chooseStatus!=='unavailable';}
  const saveDay=event.target.closest('[data-save-day]');if(saveDay){const status=saveDay.dataset.saveDay;try{let payload={action:'set_availability_day',practitionerId:availabilityPractitionerId,dayKey:selectedAvailabilityDay,status};if(status==='free'){const start=$('#day-start').value,end=$('#day-end').value;if(!start||!end||start>=end){toast('Bitte prüfe Beginn und Ende der freien Zeit.',true);return}payload.startsAt=localTimeToEpoch(selectedAvailabilityDay,start);payload.endsAt=localTimeToEpoch(selectedAvailabilityDay,end)}await act(payload,status==='free'?'Der Tag ist als verfügbar markiert.':'Der Tag ist als nicht verfügbar markiert.');$('#form-dialog').close()}catch(error){toast(error.message,true)}}
  const patientNode=event.target.closest('[data-patient]');if(patientNode)openPatient(patientNode.dataset.patient);
  if(event.target.closest('[data-close]'))$('#form-dialog').close();
  const convert=event.target.closest('[data-convert]');if(convert){try{await act({action:'convert_intake',sourceId:convert.dataset.convert,kind:convert.dataset.kind},'Die Anfrage wurde als Patientenakte übernommen.')}catch(error){toast(error.message,true)}}
  const toggle=event.target.closest('[data-toggle-user]');if(toggle){try{await act({action:'toggle_user',userId:toggle.dataset.toggleUser,active:toggle.dataset.active==='true'},'Der Zugang wurde aktualisiert.')}catch(error){toast(error.message,true)}}
  const archive=event.target.closest('[data-archive-patient]');if(archive){try{await act({action:'archive_patient',patientId:archive.dataset.archivePatient},'Die Akte wurde archiviert.')}catch(error){toast(error.message,true)}}
});
$('#quick-button').addEventListener('click',()=>openForm('appointment'));function closePortalMenu(){ $('.sidebar').classList.remove('open');$('#portal').classList.remove('menu-open');$('#menu-button').setAttribute('aria-expanded','false');$('#menu-button').focus(); }
$('#menu-button').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('open');$('#portal').classList.toggle('menu-open',open);$('#menu-button').setAttribute('aria-expanded',String(open));if(open)$('#close-portal-menu').focus();});
$('#close-portal-menu').addEventListener('click',closePortalMenu);
$('#portal').addEventListener('click',e=>{if(e.target===$('#portal')&&$('#portal').classList.contains('menu-open'))closePortalMenu();});
document.addEventListener('keydown',e=>{if(!$('.sidebar').classList.contains('open'))return;if(e.key==='Escape'){closePortalMenu();return}if(e.key==='Tab'){const nodes=[...$('.sidebar').querySelectorAll('a,button')].filter(n=>n.offsetParent!==null&&!n.disabled);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus()}}});
$('#drawer-close').addEventListener('click',closePatient);$('#drawer-backdrop').addEventListener('click',closePatient);
$('#dialog-close').addEventListener('click',()=>$('#form-dialog').close());
$('#patient-search').addEventListener('input',renderPatients);$('#patient-filter').addEventListener('change',renderPatients);$('#intake-search').addEventListener('input',renderIntakes);$('#intake-filter').addEventListener('change',renderIntakes);
$('#month-prev').addEventListener('click',async()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);await loadState(monthKey())});$('#month-next').addEventListener('click',async()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);await loadState(monthKey())});$('#month-today').addEventListener('click',async()=>{calendarDate=new Date();await loadState(monthKey())});
$('#release-button').addEventListener('click',async()=>{if(!state.availabilityDays.some(d=>d.practitionerId===availabilityPractitionerId&&d.dayKey.startsWith(state.targetMonthKey)&&d.status==='free')){practiceForm('Keine Termine im Folgemonat','release_availability','<p class="full">Du bestätigst, dass in diesem Monat keine freien Termine angeboten werden. Du kannst die Planung später ändern und erneut freigeben.</p>',{practitionerId:availabilityPractitionerId,monthKey:state.targetMonthKey,confirmNoAvailability:true});return}try{await act({action:'release_availability',practitionerId:availabilityPractitionerId,monthKey:state.targetMonthKey},'Die Monatsplanung wurde freigegeben.')}catch(error){toast(error.message,true)}});
$('#availability-practitioner').addEventListener('change',event=>{availabilityPractitionerId=event.target.value;renderAvailability()});

document.addEventListener('change',async event=>{const select=event.target.closest('[data-appointment-status]');if(!select)return;try{await act({action:'appointment_status',appointmentId:select.dataset.appointmentStatus,status:select.value},'Der Terminstatus wurde aktualisiert.')}catch(error){select.value=state.appointments.find(a=>a.id===select.dataset.appointmentStatus)?.status||'scheduled';toast(error.message,true)}});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='chat-compose'){
    event.preventDefault();if(!activeChatPeerId)return;const input=$('#chat-message');const text=input.value.trim();if(!text)return;
    try{await api('/api/portal/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send_chat_message',recipientId:activeChatPeerId,text})});input.value='';await loadState(state?.monthKey||monthKey());await refreshChat();input.focus()}catch(error){toast(error.message,true)}
    return;
  }
  if(!['patient-form','team-form','appointment-form','assign-form','entry-form','document-form'].includes(form.id))return;event.preventDefault();const data=new FormData(form);const submit=form.querySelector('button:not([type=button])');if(submit?.disabled)return;if(submit)submit.disabled=true;
  try{
    if(form.id==='patient-form')await act({action:'create_patient',...Object.fromEntries(data)},'Die Patientenakte wurde angelegt.');
    if(form.id==='team-form'){if(data.get('password')!==data.get('passwordConfirmation'))throw new Error('Die beiden Passwörter stimmen nicht überein.');await act({action:'create_user',displayName:data.get('displayName'),email:data.get('email'),username:data.get('username'),password:data.get('password'),passwordConfirmation:data.get('passwordConfirmation'),roles:data.getAll('roles')},'Der persönliche Zugang wurde angelegt.');}
    if(form.id==='appointment-form'){const start=Math.floor(new Date(data.get('start')).getTime()/1000),end=start+Number(data.get('duration'))*60;await act({action:'create_appointment',patientId:data.get('patientId'),practitionerId:data.get('practitionerId'),startsAt:start,endsAt:end,kind:data.get('kind')},'Der Termin wurde zugewiesen.');}
    if(form.id==='assign-form')await act({action:'assign_patient',patientId:selectedPatientId,userId:data.get('userId')},'Die Zuständigkeit wurde gespeichert.');
    if(form.id==='entry-form')await act({action:'add_entry',patientId:selectedPatientId,appointmentId:data.get('appointmentId'),entryType:data.get('entryType'),text:data.get('text')},'Der Eintrag wurde sicher gespeichert.');
    if(form.id==='document-form'){const file=data.get('document');if(file.size>5*1024*1024)throw new Error('Die Datei ist größer als 5 MB.');const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});await act({action:'upload_document',patientId:selectedPatientId,filename:file.name,mime:file.type,data:encoded},'Das Dokument wurde verschlüsselt gespeichert.');}
    if($('#form-dialog').open)$('#form-dialog').close();
  }catch(error){toast(error.message,true)}finally{if(submit)submit.disabled=false}
});

loadState().catch(()=>{});
