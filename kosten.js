const services = {
  einzel: {
    title: 'Einzelberatung', eyebrow: 'EINZELBERATUNG · 50 MINUTEN',
    heading: 'Flexibel beginnen oder bewusst vertiefen.',
    description: 'Psychologische Beratung für persönliche Belastungen, Entscheidungen und Veränderungen.',
    prices: TheraViaPreise.beratung
  },
  paar: {
    title: 'Paargespräch', eyebrow: 'PAARGESPRÄCH · 70 MINUTEN',
    heading: 'Gemeinsam verstehen, was Veränderung braucht.',
    description: 'Für Kommunikation, Konflikte, Vertrauen und gemeinsame Entscheidungen.',
    prices: TheraViaPreise.paarFamilie
  },
  familie: {
    title: 'Familiengespräch', eyebrow: 'FAMILIENGESPRÄCH · 70 MINUTEN',
    heading: 'Miteinander wieder handlungsfähig werden.',
    description: 'Für wiederkehrende Konflikte, Übergänge, Erziehung und familiäre Belastungen.',
    prices: TheraViaPreise.paarFamilie
  }
};

const grid = document.getElementById('price-grid');
const tabs = [...document.querySelectorAll('[data-service]')];
const format = TheraViaPreise.format;
let activeService = 'einzel';

function selectOffer() { window.location.assign(window.TheraViaI18n?TheraViaI18n.url('kontakt.html'):'kontakt.html'); }

function renderPrices() {
  const service = services[activeService];
  document.getElementById('pricing-eyebrow').textContent = service.eyebrow;
  document.getElementById('pricing-title').textContent = service.heading;
  document.getElementById('pricing-description').textContent = service.description;
  const single = service.prices[1];
  const plans = [
    {count:1, label:'Einzeltermin', note:'Flexibel einsteigen', featured:false},
    {count:3, label:'3 Gespräche', note:'Kompakter Fokus', featured:false},
    {count:6, label:'6 Gespräche', note:'Empfohlener Einstieg', featured:true},
    {count:10, label:'10 Gespräche', note:'Kontinuierlicher Prozess', featured:false}
  ];
  grid.innerHTML = plans.map(plan => {
    const total = service.prices[plan.count];
    const perSession = Math.round(total / plan.count);
    const saving = plan.count > 1 ? single * plan.count - total : 0;
    const comparison = plan.count === 1
      ? 'Einmalig und ohne Bindung'
      : saving > 0
        ? `${format(perSession)} je Gespräch · ${format(saving)} Paketvorteil`
        : `${format(perSession)} je Gespräch im Paket`;
    return `<article class="price-card ${plan.featured ? 'is-featured' : ''}">
      <div class="price-card-top"><span>${plan.note}</span>${plan.featured ? '<strong>Beliebt</strong>' : ''}</div>
      <h4>${plan.label}</h4>
      <div class="price-amount"><strong>${format(total)}</strong><span>Gesamtpreis</span></div>
      <div class="price-math">${comparison}</div>
      <ul><li>${plan.count} × ${activeService === 'einzel' ? '50' : '70'} Minuten</li><li>Online und persönlich abgestimmt</li><li>Sieben Gesprächssprachen</li></ul>
      <button type="button" data-book="${plan.count}">${plan.count === 1 ? 'Termin anfragen' : 'Paket anfragen'} <span aria-hidden="true">↗</span></button>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-book]').forEach(button => button.addEventListener('click', () => selectOffer(activeService, button.dataset.book)));
}

tabs.forEach(tab => tab.addEventListener('click', () => {
  activeService = tab.dataset.service;
  tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  renderPrices();
  document.querySelector('.pricing-context').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'nearest'});
}));

renderPrices();
