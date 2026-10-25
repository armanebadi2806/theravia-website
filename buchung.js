const paymentRequest=(...args)=>window.TheraViaBackend?TheraViaBackend.request(...args):fetch(...args);
let consentVersion=null;paymentRequest('/api/business',{cache:'no-store'}).then(r=>r.json()).then(r=>{consentVersion=r.version}).catch(()=>{});
const selectionNode = document.getElementById('booking-selection');
document.querySelector('.booking-exit').addEventListener('click', event => {
  if (!document.referrer) return;
  const previous = new URL(document.referrer);
  if (previous.origin === window.location.origin && (previous.pathname === '/' || previous.pathname.endsWith('/index.html'))) {
    event.preventDefault();
    window.history.back();
  }
});
let selection = null;
try {
  selection = JSON.parse(sessionStorage.getItem('theravia.bookingSelection') || 'null');
} catch {
  selection = null;
}

const offers = {
  einzel: {name:'Einzelberatung',duration:'50 Minuten je Gespräch',packages:['1','3','6','10'],taxNote:'Der verbindliche Gesamtpreis für die psychologische Beratung wird vor der Zahlung ausgewiesen.'},
  paar: {name:'Paargespräch',duration:'70 Minuten je Gespräch',packages:['1','3','6','10'],taxNote:'Paarberatung ohne medizinischen Behandlungszweck ist in der Regel umsatzsteuerpflichtig. Der vollständige Gesamtpreis wird vor einer Zahlung ausgewiesen.'},
  familie: {name:'Familiengespräch',duration:'70 Minuten je Gespräch',packages:['1','3','6','10'],taxNote:'Der vollständige Gesamtpreis wird vor einer Zahlung ausgewiesen.'}
};

const offerKey = selection?.angebot;
const packageKey = selection?.paket;
const offer = Object.hasOwn(offers,offerKey) ? offers[offerKey] : null;
const valid = offer && offer.packages.includes(packageKey);
const callbackForm = document.getElementById('callback-form');
const callbackStatus = document.getElementById('callback-status');
const payButton = callbackForm.querySelector('.booking-pay');
const sku = valid ? `${offerKey}-${packageKey}` : null;
let checkoutAvailable = false;

const selectedWindow = selection?.zeitfenster;
const selectedAge = selection?.alter;
const selectedLanguage = selection?.sprache;
if (selectedWindow && ['werktag','wochenende','flexibel'].includes(selectedWindow)) {
  callbackForm.elements.callbackWindow.value = selectedWindow;
}
if (selectedAge) callbackForm.elements.ageGroup.value = selectedAge;
if (selectedLanguage) callbackForm.elements.language.value = selectedLanguage;
function updateGuardianRequirement() {
  callbackForm.elements.guardian.required = callbackForm.elements.ageGroup.value === 'minderjaehrig';
}
callbackForm.elements.ageGroup.addEventListener('change', updateGuardianRequirement);
updateGuardianRequirement();

function setStatus(message, error = false) {
  callbackStatus.textContent = message;
  callbackStatus.classList.toggle('is-error', error);
}

if (!valid) {
  selectionNode.innerHTML = '<p class="booking-invalid">Es liegt noch keine gültige Auswahl vor.</p><a class="booking-start" href="kosten.html#preise">Zu den Preisen <span aria-hidden="true">↗</span></a>';
  document.getElementById('booking-tax-note').textContent = 'Wähle zunächst ein Gespräch oder Paket auf der Kostenseite.';
} else {
  document.getElementById('booking-tax-note').textContent = offer.taxNote;
  const proposedTotal = document.getElementById('booking-total');
  const priceLabel = document.getElementById('booking-price-label');
  const previewNote = document.getElementById('booking-price-preview');
  {
    const table = offerKey === 'paar' || offerKey === 'familie' ? TheraViaPreise.paarFamilie : TheraViaPreise.beratung;
    priceLabel.textContent = 'Verbindlicher Gesamtpreis';
    proposedTotal.textContent = TheraViaPreise.format(table[packageKey]);
    previewNote.textContent = 'Gesamtpreis inklusive der gegebenenfalls anfallenden Umsatzsteuer.';
  }
  const packageName = packageKey === '1' ? 'Einzeltermin' : `${packageKey} Gespräche`;
  const rows = [
    ['Leistung',offer.name],
    ['Paket',packageName],
    ['Dauer',offer.duration],
    ['Orientierung','Optional kostenfrei vorab']
  ];
  for (const [label,value] of rows) {
    const row = document.createElement('div');
    const title = document.createElement('span');
    const text = document.createElement('strong');
    title.textContent = label;
    text.textContent = value;
    if (label === 'Paket' && packageKey === '6') {
      const badge = document.createElement('small');
      badge.className = 'booking-package-badge';
      badge.textContent = 'Empfohlen';
      text.append(badge);
    }
    row.append(title,text);
    selectionNode.append(row);
  }

  // The static preview has no payment endpoint. A production server may expose
  // only approved, tax-inclusive Stripe prices through this endpoint.
  paymentRequest('/api/checkout-config', {cache:'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      const item = config?.catalog?.[sku];
      if (!config?.enabled || !item || !Number.isInteger(item.amount) || item.currency !== 'eur') return;
      checkoutAvailable = true;
      document.querySelector('.preview-note')?.remove();
      document.querySelector('.booking-footer span').textContent='© TheraVia';
      document.querySelector('.booking-lock')?.remove();
      priceLabel.textContent = 'Verbindlicher Gesamtpreis';
      proposedTotal.textContent = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2}).format(item.amount / 100);
      previewNote.textContent = 'Dies ist der im Checkout zu zahlende Gesamtpreis.';
      payButton.disabled = false;
      setStatus('Deine Kontaktdaten werden erst beim Start des sicheren Checkouts übermittelt.');
    })
    .catch(() => {});
}

callbackForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!checkoutAvailable || !valid) {
    setStatus('Die Zahlung ist in dieser Vorschau noch nicht freigeschaltet.', true);
    return;
  }
  if (!callbackForm.reportValidity()) return;
  const ageGroup = callbackForm.elements.ageGroup.value;
  const language = callbackForm.elements.language.value;
  if (ageGroup === 'minderjaehrig' && !callbackForm.elements.guardian.checked) {
    setStatus('Bitte bestätige deine Sorgeberechtigung.', true);
    return;
  }
  const contact = {
    name: callbackForm.elements.name.value.trim(),
    email: callbackForm.elements.email.value.trim(),
    phone: callbackForm.elements.phone.value.trim(),
    callbackWindow: callbackForm.elements.callbackWindow.value,
    language,
    ageGroup,
    guardian: callbackForm.elements.guardian.checked
  };
  payButton.disabled = true;
  setStatus('Sicherer Checkout wird vorbereitet …');
  try {
    const response = await paymentRequest('/api/checkout', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku,contact,uiLocale:window.TheraViaI18n?.language||'de',intake:{source:'direct'},billingAddress:callbackForm.elements.billingAddress.value,terms:callbackForm.elements.terms.checked,privacy:callbackForm.elements.privacy.checked,consentVersion,earlyStart:callbackForm.elements.earlyStart.checked,earlyAcknowledgement:callbackForm.elements.earlyAcknowledgement.checked})});
    const result = await response.json();
    if(response.ok&&result.confirmationUrl){
      const confirmation=new URL(result.confirmationUrl);
      if(confirmation.origin===location.origin&&confirmation.pathname==='/danke.html'&&/^#ref=[a-f0-9]{64}$/.test(confirmation.hash)){window.location.assign(confirmation.href);return;}
    }
    if (!response.ok || !result.url || new URL(result.url).hostname !== 'checkout.stripe.com') throw new Error(result.error || 'Checkout konnte nicht gestartet werden.');
    window.location.assign(result.url);
  } catch (error) {
    setStatus(error.message || 'Checkout konnte nicht gestartet werden.', true);
    payButton.disabled = false;
  }
});
