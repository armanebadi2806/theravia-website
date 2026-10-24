const form = { step: 0, offer: '', age: '', language: 'Deutsch', concerns: [], note: '', time: '' };
try {
  const saved = JSON.parse(sessionStorage.getItem('theravia.questionnaire') || 'null');
  if (saved && ['einzel','paar','familie'].includes(saved.offer) && ['erwachsen','minderjaehrig'].includes(saved.age) && ['Deutsch','Dari','Farsi','Englisch','Türkisch','Russisch','Arabisch'].includes(saved.language) && ['werktag','wochenende','flexibel'].includes(saved.time) && Array.isArray(saved.concerns) && saved.concerns.length) {
    Object.assign(form,{...saved,step:5,note:typeof saved.note === 'string' ? saved.note.slice(0,500) : ''});
  }
} catch {
  sessionStorage.removeItem('theravia.questionnaire');
}

const concernOptions = {
  einzel: ['Stress und Überlastung', 'Ängste und Sorgen', 'Gedrückte Stimmung', 'Belastende Erfahrungen', 'Schlaf', 'Beziehungen', 'Migration und Identität', 'Anderes', 'Ich bin noch unsicher'],
  paar: ['Kommunikation', 'Wiederkehrende Konflikte', 'Vertrauen', 'Nähe und Distanz', 'Trennung', 'Kulturelle Unterschiede', 'Anderes', 'Ich bin noch unsicher'],
  familie: ['Kommunikation', 'Wiederkehrende Konflikte', 'Erziehung', 'Veränderungen in der Familie', 'Trennung', 'Kulturelle Unterschiede', 'Anderes', 'Ich bin noch unsicher']
};

const content = document.getElementById('q-content');
const progress = document.getElementById('q-progress');
const stepLabel = document.getElementById('q-step-label');
const backButton = document.getElementById('q-back');
const nextButton = document.getElementById('q-next');
const arrow = '<img src="assets/icons/arrow-right.svg" alt="">';
const offerIcons = {einzel:'user',paar:'users',familie:'users-group'};
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

function choice(label, value, name, selected, multi = false) {
  const icon = name === 'offer' ? `<img class="choice-icon" src="assets/icons/${offerIcons[value]}.svg" alt="">` : '';
  return `<label class="choice"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${escapeHtml(value)}" ${selected ? 'checked' : ''}>${icon}<span>${escapeHtml(label)}</span></label>`;
}

function setLanguage(language) {
  form.language = language;
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  const feedback = document.getElementById('language-feedback');
  if (feedback) feedback.textContent = `Gewählte Gesprächssprache: ${language}`;
  if (form.step === 2 || form.step === 5) render();
}

function render() {
  stepLabel.textContent = form.step < 5 ? `${String(form.step + 1).padStart(2, '0')} / 05` : 'DEINE ÜBERSICHT';
  progress.style.width = `${Math.min(((form.step + 1) / 5) * 100, 100)}%`;
  document.querySelectorAll('.q-steps span').forEach((marker, index) => marker.classList.toggle('active', index <= Math.min(form.step, 4)));
  backButton.disabled = form.step === 0;
  nextButton.innerHTML = `${form.step === 5 ? 'Kostenlos anfragen' : form.step === 4 ? 'Übersicht ansehen' : 'Weiter'} ${arrow}`;

  if (form.step === 0) {
    content.innerHTML = `<h3>Für wen suchst du Unterstützung?</h3><p class="q-sub">Wähle den Weg, der am besten zu deinem Anliegen passt.</p><div class="choice-grid">${[
      ['Einzelperson', 'einzel'], ['Für uns als Paar', 'paar'], ['Für meine Familie', 'familie']
    ].map(([label, value]) => choice(label, value, 'offer', form.offer === value)).join('')}</div>`;
  } else if (form.step === 1) {
    content.innerHTML = `<h3>Für welche Altersgruppe?</h3><p class="q-sub">Für Minderjährige ab 10 Jahren übernimmt eine sorgeberechtigte Person die Buchung.</p><div class="choice-grid">${choice('Erwachsene Person (18+)', 'erwachsen', 'age', form.age === 'erwachsen')}${choice('Kind oder jugendliche Person (10–17)', 'minderjaehrig', 'age', form.age === 'minderjaehrig')}</div>`;
  } else if (form.step === 2) {
    content.innerHTML = `<h3>In welcher Sprache möchtest du sprechen?</h3><p class="q-sub">Wir berücksichtigen deine Wahl bei der Suche nach einer passenden Fachperson.</p><div class="choice-grid">${['Deutsch','Dari','Farsi','Englisch','Türkisch','Russisch','Arabisch'].map(language => choice(language,language,'language',form.language === language)).join('')}</div>`;
  } else if (form.step === 3) {
    const options = concernOptions[form.offer] || concernOptions.einzel;
    content.innerHTML = `<h3>Was beschäftigt dich?</h3><p class="q-sub">Mehrere Antworten sind möglich. Wir besprechen dein Anliegen persönlich.</p><div class="choice-grid multi">${options.map(option => choice(option, option, 'concern', form.concerns.includes(option), true)).join('')}</div><div class="q-field"><label for="q-note">Möchtest du etwas ergänzen? (freiwillig)</label><textarea id="q-note" maxlength="500" placeholder="Ein kurzer Hinweis genügt.">${escapeHtml(form.note)}</textarea></div>`;
  } else if (form.step === 4) {
    content.innerHTML = `<h3>Wann passt es dir am besten?</h3><p class="q-sub">Montag bis Freitag 17–22 Uhr, Samstag und Sonntag 10–18 Uhr.</p><div class="choice-grid">${[['Werktags am Abend','werktag'],['Am Wochenende','wochenende'],['Ich bin flexibel','flexibel']].map(([label,value]) => choice(label,value,'time',form.time === value)).join('')}</div>`;
  } else {
    const offerName = {einzel:'Einzelberatung',paar:'Paarberatung',familie:'Familienberatung'}[form.offer];
    const ageName = form.age === 'minderjaehrig' ? 'Kind oder jugendliche Person (10–17)' : 'Erwachsene Person';
    const timeName = {werktag:'Werktags am Abend',wochenende:'Am Wochenende',flexibel:'Flexibel'}[form.time];
    const rows = [['Angebot',offerName],['Für wen',ageName],['Sprache',form.language],['Themen',form.concerns.join(', ')],['Zeitfenster',timeName]];
    if (form.note) rows.push(['Hinweis',form.note]);
    content.innerHTML = `<h3>Dein Überblick</h3><p class="q-sub">Prüfe deine Auswahl. Danach kannst du dein kostenloses 15-minütiges Orientierungsgespräch anfragen.</p><div class="summary-list">${rows.map(([label,value]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong${label==='Hinweis'?' data-i18n-ignore':''}>${escapeHtml(value)}</strong></div>`).join('')}</div><div class="summary-note">Das Orientierungsgespräch ist kostenlos und unverbindlich. Eine psychologische Fachperson klärt mit dir den passenden nächsten Schritt. Eine Beratungssitzung findet dabei noch nicht statt.</div><div class="q-summary-links"><button type="button" class="q-reset" id="q-reset">Auswahl neu beginnen</button><a class="q-direct-booking" href="kosten.html">Preise ansehen &amp; direkt buchen</a></div>`;
    content.querySelector('#q-reset').addEventListener('click', resetQuestionnaire);
  }
}

function saveCurrentStep() {
  if (form.step === 0) form.offer = content.querySelector('input[name="offer"]:checked')?.value || '';
  if (form.step === 1) form.age = content.querySelector('input[name="age"]:checked')?.value || '';
  if (form.step === 2) setLanguage(content.querySelector('input[name="language"]:checked')?.value || '');
  if (form.step === 3) {
    form.concerns = [...content.querySelectorAll('input[name="concern"]:checked')].map(input => input.value);
    form.note = content.querySelector('#q-note')?.value.trim() || '';
  }
  if (form.step === 4) form.time = content.querySelector('input[name="time"]:checked')?.value || '';
}

function resetQuestionnaire() {
  sessionStorage.removeItem('theravia.bookingSelection');
  sessionStorage.removeItem('theravia.questionnaire');
  Object.assign(form, {step:0,offer:'',age:'',language:'Deutsch',concerns:[],note:'',time:''});
  setLanguage('Deutsch');
  render();
}

function finishQuestionnaire(destination) {
  sessionStorage.setItem('theravia.questionnaire',JSON.stringify(form));
  sessionStorage.removeItem('theravia.bookingSelection');
  window.location.assign(window.TheraViaI18n?TheraViaI18n.url(destination):destination);
}

nextButton.addEventListener('click', () => {
  if (form.step === 5) {
    finishQuestionnaire('termine.html');
    return;
  }
  const previousOffer = form.offer;
  saveCurrentStep();
  const valid = [Boolean(form.offer), Boolean(form.age), Boolean(form.language), form.concerns.length > 0, Boolean(form.time)][form.step];
  content.querySelector('.q-error')?.remove();
  if (!valid) {
    content.insertAdjacentHTML('beforeend', '<p class="q-error" role="alert">Bitte wähle mindestens eine Antwort aus.</p>');
    return;
  }
  if (form.step === 0 && form.offer !== previousOffer) {
    form.concerns = [];
  }
  form.step += 1;
  render();
});

backButton.addEventListener('click', () => {
  if (form.step > 0) {
    saveCurrentStep();
    form.step -= 1;
    render();
  }
});

document.querySelectorAll('[data-offer]').forEach(link => link.addEventListener('click', () => {
  form.offer = link.dataset.offer;
  form.concerns = [];
  form.step = 1;
  render();
}));
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
render();
setLanguage(form.language);

const menuButton = document.querySelector('.menu-toggle');
const mobileNavigation = document.getElementById('mobile-navigation');
function setMenuOpen(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  menuButton.querySelector('img').src = `assets/icons/${open ? 'x' : 'menu-2'}.svg`;
  mobileNavigation.hidden = !open;
}
menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
mobileNavigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    menuButton.focus();
  }
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 850 && menuButton.getAttribute('aria-expanded') === 'true') setMenuOpen(false);
});

const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!motionReduced && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:0.12,rootMargin:'0px 0px -30px 0px'});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}

if ('IntersectionObserver' in window) {
  const sectionLinks = [...document.querySelectorAll('.primary-nav a[href^="#"]')];
  const sectionObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    sectionLinks.forEach(link => {
      if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, {rootMargin:'-28% 0px -54% 0px',threshold:0});
  sectionLinks.forEach(link => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) sectionObserver.observe(section);
  });
}

let scrollScheduled = false;
const storyChapters = [...document.querySelectorAll('.selfpay-chapter')];
const storyNumber = document.getElementById('selfpay-visual-number');
const storyWord = document.getElementById('selfpay-visual-word');
const storyProgress = document.getElementById('selfpay-story-progress');
let activeStory = -1;
function updateScrollState() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  document.getElementById('page-progress').style.transform = `scaleX(${Math.min(1, window.scrollY / maxScroll)})`;
  document.querySelector('.site-header').classList.toggle('scrolled', window.scrollY > 12);
  if (!motionReduced && window.innerWidth > 850) {
    const shift = Math.min(55, window.scrollY * 0.12);
    document.querySelector('.hero-background').style.transform = `translateY(${shift}px) scale(1.05)`;
  }
  if (window.innerWidth > 650 && storyChapters.length) {
    const readingLine = window.innerHeight * 0.51;
    let closestIndex = 0;
    let closestDistance = Infinity;
    storyChapters.forEach((chapter, index) => {
      const rect = chapter.getBoundingClientRect();
      const distance = Math.abs((rect.top + rect.bottom) / 2 - readingLine);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    if (closestIndex !== activeStory) {
      activeStory = closestIndex;
      storyNumber.textContent = String(closestIndex + 1).padStart(2, '0');
      storyWord.textContent = storyChapters[closestIndex].dataset.storyWord;
      storyProgress.style.width = `${((closestIndex + 1) / storyChapters.length) * 100}%`;
    }
  }
  scrollScheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    window.requestAnimationFrame(updateScrollState);
  }
}, {passive:true});
window.addEventListener('resize', updateScrollState);
updateScrollState();
