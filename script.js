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
