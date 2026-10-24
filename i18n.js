/* Text-only localization. Form values and private input are never translated. */
(()=>{
 const locales={de:{name:'Deutsch',tag:'de-DE',conversation:'Deutsch'},en:{name:'English',tag:'en-GB',conversation:'Englisch'},prs:{name:'دری',tag:'fa-AF',conversation:'Dari'},fa:{name:'فارسی',tag:'fa-IR',conversation:'Farsi'},tr:{name:'Türkçe',tag:'tr-TR',conversation:'Türkisch'},ru:{name:'Русский',tag:'ru-RU',conversation:'Russisch'},ar:{name:'العربية',tag:'ar',conversation:'Arabisch'}};
 let language=window.theraviaInitialLanguage||'de';const catalog=window.TheraViaLocaleCatalog||{};const originals=new WeakMap();const attributes=new WeakMap();let queued=false;
 const normalize=text=>String(text).replace(/\s+/g,' ').trim();
 const localizedNumber=n=>new Intl.NumberFormat(locales[language].tag,{useGrouping:false}).format(n);
 function money(text){const n=Number(text.replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''));return Number.isFinite(n)?new Intl.NumberFormat(locales[language].tag,{style:'currency',currency:'EUR',maximumFractionDigits:Number.isInteger(n)?0:2}).format(n):text}
 function sessions(n){const v=localizedNumber(n);if(language==='ru'){const m=n%10,t=n%100;return v+' '+(m===1&&t!==11?'консультация':m>=2&&m<=4&&(t<12||t>14)?'консультации':'консультаций')}return v+' '+({en:n===1?'session':'sessions',tr:'görüşme',fa:'گفت‌وگو',prs:'گفت‌وگو',ar:n>=3&&n<=10?'جلسات':'جلسة'}[language]||'Gespräche')}
 function translate(text){
  if(language==='de')return text;const dictionary=catalog[language]||{};const key=normalize(text);let result=dictionary[key];
  if(result===undefined){let m;
   if((m=key.match(/^Gewählte Gesprächssprache: (.+)$/)))result=({en:'Selected session language: ',tr:'Seçilen görüşme dili: ',ru:'Выбранный язык консультации: ',fa:'زبان انتخاب‌شده: ',prs:'زبان انتخاب‌شده: ',ar:'لغة الجلسة المختارة: '}[language])+translate(m[1]);
   else if((m=key.match(/^(\d+) Gespräche$/)))result=sessions(Number(m[1]));
   else if((m=key.match(/^(\d+) Minuten( je Gespräch)?$/)))result=localizedNumber(Number(m[1]))+' '+({en:'minutes',tr:'dakika',ru:'минут',fa:'دقیقه',prs:'دقیقه',ar:'دقيقة'}[language])+(m[2]?({en:' per session',tr:' / görüşme',ru:' на консультацию',fa:' در هر جلسه',prs:' در هر جلسه',ar:' لكل جلسة'}[language]):'');
   else if((m=key.match(/^(\d+) × (\d+) Minuten$/)))result=localizedNumber(+m[1])+' × '+translate(m[2]+' Minuten');
   else if((m=key.match(/^([\d.,\s]+€) je Gespräch · ([\d.,\s]+€) Paketvorteil$/)))result=money(m[1])+({en:' per session · save ',tr:' / görüşme · tasarruf ',ru:' за консультацию · экономия ',fa:' هر جلسه · صرفه‌جویی ',prs:' هر جلسه · صرفه‌جویی ',ar:' لكل جلسة · توفير '}[language])+money(m[2]);
   else if((m=key.match(/^([\d.,\s]+€) je Gespräch im Paket$/)))result=money(m[1])+({en:' per session in the package',tr:' / paket içi görüşme',ru:' за консультацию в пакете',fa:' برای هر جلسه در بسته',prs:' برای هر جلسه در بسته',ar:' لكل جلسة ضمن الباقة'}[language]);
   else if(/^[\d.,\s]+€$/.test(key))result=money(key);
   else if(key.includes(', ')&&key.split(', ').every(x=>dictionary[x]))result=key.split(', ').map(x=>dictionary[x]).join(['fa','prs','ar'].includes(language)?'، ':', ');
   else return text;
  }
  return text.match(/^\s*/)[0]+result+text.match(/\s*$/)[0];
 }
 function eligible(element){return element&&!element.closest('script,style,textarea,input,[contenteditable], [data-i18n-ignore],.language-utility select')}
 function localizeNode(node){if(!eligible(node.parentElement))return;const previous=originals.get(node);const original=previous&&previous.rendered===node.data?previous.original:node.data;const rendered=translate(original);originals.set(node,{original,rendered});if(node.data!==rendered)node.data=rendered}
 function url(destination){const u=new URL(destination,location.href);if(u.origin===location.origin&&!u.pathname.endsWith('admin.html'))u.searchParams.set('lang',language);return u.href}
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type!=='childList'||r.addedNodes.length)&&!queued){queued=true;queueMicrotask(apply)}});
 function apply(){queued=false;observer.disconnect();document.documentElement.lang=language==='prs'?'fa-AF':language;document.documentElement.dir=['prs','fa','ar'].includes(language)?'rtl':'ltr';
  // Freeze implicit option values BEFORE translating their labels.
  document.querySelectorAll('option:not([value])').forEach(n=>n.setAttribute('value',n.textContent));
  const walker=document.createTreeWalker(document,NodeFilter.SHOW_TEXT);while(walker.nextNode())localizeNode(walker.currentNode);
  document.querySelectorAll('[aria-label],[placeholder],[title],[alt]').forEach(el=>{if(el.closest('script,style,[data-i18n-ignore],.language-utility select'))return;const saved=attributes.get(el)||{};for(const name of ['aria-label','placeholder','title','alt']){if(!el.hasAttribute(name))continue;const value=el.getAttribute(name);const prior=saved[name];const original=prior&&prior.rendered===value?prior.original:value;const rendered=translate(original);saved[name]={original,rendered};if(value!==rendered)el.setAttribute(name,rendered)}attributes.set(el,saved)});
  const description=document.querySelector('meta[name=description]');if(description){const s=attributes.get(description)||{};const key=s.content?.original||description.content;s.content={original:key};attributes.set(description,s);description.content=translate(key)}
  renderLanguagePicker();document.querySelectorAll('[data-interface-language]').forEach(n=>n.textContent=translate('Website-Sprache'));document.querySelectorAll('a[href]').forEach(a=>{const raw=a.getAttribute('href');if(!raw||raw.startsWith('#'))return;const u=new URL(raw,location.href);if(u.origin===location.origin&&(/\.html$/.test(u.pathname)||u.pathname==='/')&&!u.pathname.endsWith('admin.html'))a.href=url(u.href)});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title','alt']});
 }
 const globe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
 const chevron='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
 const check='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>';
 const bar=document.createElement('div');bar.className='language-utility';bar.innerHTML='<div class="wrap language-utility-inner"><div class="language-control"><span data-interface-language>Website-Sprache</span><div class="language-switch" data-i18n-ignore><button type="button" id="website-language" class="language-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="website-language-menu"><span class="language-globe">'+globe+'</span><bdi class="language-current"></bdi><span class="language-chevron">'+chevron+'</span></button><div class="language-menu" id="website-language-menu" role="menu" hidden><div class="language-menu-heading" aria-hidden="true"><span class="language-menu-icon">'+globe+'</span><span class="language-menu-title"></span></div><div class="language-menu-options">'+Object.entries(locales).map(([code,l])=>'<button type="button" role="menuitemradio" aria-checked="false" tabindex="-1" data-ui-locale="'+code+'"><span class="language-code">'+code.toUpperCase()+'</span><span class="language-option-copy"><bdi lang="'+(code==='prs'?'fa-AF':code)+'">'+l.name+'</bdi><small class="language-local-name"></small></span><span class="language-selected">'+check+'</span></button>').join('')+'</div></div></div></div><span class="language-timezone">Alle Uhrzeiten gelten für Deutschland (Europe/Berlin).</span></div>';document.body.prepend(bar);
 const picker=bar.querySelector('.language-trigger'),languageMenu=bar.querySelector('.language-menu'),languageOptions=[...languageMenu.querySelectorAll('[data-ui-locale]')];
 function renderLanguagePicker(){
  picker.querySelector('.language-current').textContent=locales[language].name;
  picker.setAttribute('aria-label',translate('Website-Sprache')+': '+locales[language].name);
  languageMenu.setAttribute('aria-label',translate('Website-Sprache'));
  languageMenu.querySelector('.language-menu-title').textContent=translate('Website-Sprache');
  languageOptions.forEach(button=>{const code=button.dataset.uiLocale;button.setAttribute('aria-checked',String(code===language));button.classList.toggle('is-active',code===language);const localName=translate(locales[code].conversation);const subtitle=button.querySelector('.language-local-name');subtitle.textContent=localName;subtitle.hidden=localName===locales[code].name;});
 }
 function positionLanguageMenu(){const rect=picker.getBoundingClientRect();const viewport=document.documentElement.clientWidth;const width=Math.min(300,viewport-32);languageMenu.style.width=width+'px';languageMenu.style.left=Math.max(16,Math.min(rect.left,viewport-width-16))+'px';languageMenu.style.top=(rect.bottom+10)+'px';languageMenu.style.maxHeight=Math.max(120,window.innerHeight-rect.bottom-26)+'px';}
 function closeLanguageMenu(restoreFocus=false){languageMenu.hidden=true;picker.setAttribute('aria-expanded','false');if(restoreFocus)picker.focus();}
 function openLanguageMenu(index){languageMenu.hidden=false;picker.setAttribute('aria-expanded','true');positionLanguageMenu();languageOptions[index??languageOptions.findIndex(b=>b.dataset.uiLocale===language)].focus();}
 function selectLanguage(code){if(!locales[code])return;language=code;try{localStorage.setItem('theravia.uiLanguage',code)}catch{}const next=new URL(location.href);next.searchParams.set('lang',code);history.replaceState(null,'',next);apply();document.dispatchEvent(new CustomEvent('theravia:languagechange',{detail:{language:code}}));}
 picker.addEventListener('click',()=>languageMenu.hidden?openLanguageMenu():closeLanguageMenu(true));
 picker.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openLanguageMenu(event.key==='ArrowUp'?languageOptions.length-1:0)}else if(event.key==='Escape')closeLanguageMenu(true)});
 languageMenu.addEventListener('click',event=>{const option=event.target.closest('[data-ui-locale]');if(!option)return;selectLanguage(option.dataset.uiLocale);closeLanguageMenu(true)});
 languageMenu.addEventListener('keydown',event=>{const index=languageOptions.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(index+1)%languageOptions.length;else if(event.key==='ArrowUp')next=(index+languageOptions.length-1)%languageOptions.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=languageOptions.length-1;else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeLanguageMenu(true);return}else if(event.key==='Tab'){closeLanguageMenu(true);return}if(next!==undefined){event.preventDefault();languageOptions[next].focus()}});
 document.addEventListener('pointerdown',event=>{if(!languageMenu.hidden&&!bar.querySelector('.language-switch').contains(event.target))closeLanguageMenu()});
 window.addEventListener('resize',()=>closeLanguageMenu());
 window.addEventListener('scroll',()=>{if(!languageMenu.hidden)closeLanguageMenu()},{passive:true});
 window.TheraViaI18n=Object.freeze({t:translate,url,select:selectLanguage,get language(){return language},get conversationLanguage(){return locales[language].conversation}});
 // Independent URLs for every UI language; hosting remains in Germany.
 for(const [code,l] of Object.entries(locales)){const alternate=document.createElement('link');alternate.rel='alternate';alternate.hreflang=code==='prs'?'fa-AF':code;const target=new URL(location.href);target.hash='';target.searchParams.set('lang',code);alternate.href=target.href;document.head.append(alternate)}
 apply();
})();
