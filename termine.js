const form = document.getElementById('orientation-form');
const context = document.getElementById('orientation-context');
const statusNode = document.getElementById('orientation-status');
const successNode = document.getElementById('orientation-success');
const guardianLabel = document.getElementById('guardian-label');
const submitButton = form.querySelector('.orientation-submit');
let consentVersion=null;
let requestKey=sessionStorage.getItem('theravia.orientationRequestKey')||crypto.randomUUID();
sessionStorage.setItem('theravia.orientationRequestKey',requestKey);
fetch('/api/business',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(result=>{consentVersion=result.version;}).catch(()=>{submitButton.disabled=true;setStatus('Die Online-Anfrage ist noch nicht freigeschaltet. Bitte versuche es später erneut.',true);});

let questionnaire = null;
try {
  questionnaire = JSON.parse(sessionStorage.getItem('theravia.questionnaire') || 'null');
} catch {
  questionnaire = null;
}

const offers = {einzel:'Einzelberatung',paar:'Paarberatung',familie:'Familienberatung'};
const windows = {werktag:'Werktags 17–22 Uhr',wochenende:'Wochenende 10–18 Uhr',flexibel:'Flexibel'};
const valid = questionnaire && offers[questionnaire.offer] &&
  ['erwachsen','minderjaehrig'].includes(questionnaire.age) &&
  ['Deutsch','Dari','Farsi','Englisch','Türkisch','Russisch','Arabisch'].includes(questionnaire.language) &&
  ['werktag','wochenende','flexibel'].includes(questionnaire.time) &&
  Array.isArray(questionnaire.concerns) && questionnaire.concerns.length > 0;

function setStatus(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('is-error', error);
}

if (!valid) {
  context.innerHTML = '<p class="booking-invalid">Bitte fülle zuerst den kurzen Fragebogen aus. So können wir das Gespräch passend vorbereiten.</p><a class="booking-start" href="index.html#fragebogen">Zum Fragebogen <span aria-hidden="true">↗</span></a>';
  form.hidden = true;
} else {
  const facts = [
    ['Angebot', offers[questionnaire.offer]],
    ['Sprache', questionnaire.language],
    ['Themen', questionnaire.concerns.join(', ')],
    ['Zeitfenster', windows[questionnaire.time]]
  ];
  context.innerHTML = facts.map(([label]) => `<div><span>${label}</span><strong></strong></div>`).join('');
  context.querySelectorAll('strong').forEach((node, index) => { node.textContent = facts[index][1]; });
  form.elements.callbackWindow.value = questionnaire.time;
  if (questionnaire.age === 'minderjaehrig') {
    guardianLabel.hidden = false;
    form.elements.guardian.required = true;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!valid || !form.reportValidity()) return;
  if(!consentVersion)return setStatus('Bitte warte, bis die Datenschutzhinweise geladen sind.',true);
  if (questionnaire.age === 'minderjaehrig' && !form.elements.guardian.checked) {
    return setStatus('Bitte bestätige deine Sorgeberechtigung.', true);
  }
  const payload = {
    service: questionnaire.offer,
    uiLocale:window.TheraViaI18n?.language||'de',
    requestKey,consentVersion,
    consent: form.elements.consent.checked,
    contact: {
      name: form.elements.name.value.trim(), email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(), callbackWindow: form.elements.callbackWindow.value,
      language: questionnaire.language, ageGroup: questionnaire.age,
      guardian: form.elements.guardian.checked
    },
    intake: {
      offer: questionnaire.offer, age: questionnaire.age,
      language: questionnaire.language, concerns: questionnaire.concerns,
      note: questionnaire.note || '', time: questionnaire.time
    }
  };
  submitButton.disabled = true;
  setStatus('Deine Anfrage wird sicher übermittelt …');
  try {
    const response = await fetch('/api/orientation', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result = await response.json();
    if (!response.ok || !result.requested) throw new Error(result.error || 'Die Anfrage konnte nicht gesendet werden.');
    form.hidden = true;
    context.hidden = true;
    successNode.hidden = false;
    sessionStorage.removeItem('theravia.orientationRequestKey');
  } catch (error) {
    setStatus(error.message || 'Die Anfrage konnte nicht gesendet werden.', true);
    submitButton.disabled = false;
  }
});
