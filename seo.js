/* Public search metadata only; never reads forms, records or analytics identifiers. */
(()=>{
 const config=window.TheraViaSEOData;
 if(!config)return;
 const supported=Object.keys(config.languages);
 function localeUrl(destination,language){
  const target=new URL(destination,location.href);
  if(target.origin!==location.origin||target.pathname.endsWith('/admin.html'))return target.href;
  const file=target.pathname==='/'?'index.html':target.pathname.split('/').pop();
  const page=config.routes[file];
  if(page){target.pathname='/'+(language==='de'?(page==='index.html'?'':page):page.replace('.html','-'+language+'.html'));target.searchParams.delete('lang');}
  else target.searchParams.set('lang',language);
  return target.href;
 }
 function setMeta(selector,value){const el=document.querySelector(selector);if(el)el.setAttribute('content',value);}
 function apply(language){
  const page=document.documentElement.dataset.seoPage;
  if(!config.pages[page]||!supported.includes(language))return;
  const [title,description]=config.pages[page][language],canonical=(config.baseUrl||location.origin)+new URL(localeUrl(page,language)).pathname;
  document.title=title;
  setMeta('meta[name="description"]',description);
  setMeta('meta[property="og:title"]',title);setMeta('meta[property="og:description"]',description);
  setMeta('meta[property="og:url"]',canonical);setMeta('meta[property="og:locale"]',config.languages[language].og);
  setMeta('meta[name="twitter:title"]',title);setMeta('meta[name="twitter:description"]',description);
  const link=document.querySelector('link[rel="canonical"]');if(link)link.href=canonical;
  const structured=document.querySelector('script[type="application/ld+json"]');
  if(structured){try{const data=JSON.parse(structured.textContent);const entry=data['@graph']?.find(n=>n['@type']==='WebPage');if(entry){Object.assign(entry,{'@id':canonical+'#webpage',url:canonical,name:title,description,inLanguage:config.languages[language].tag});const next=JSON.stringify(data);if(structured.textContent!==next)structured.textContent=next;}}catch{}}
 }
 window.TheraViaSEO=Object.freeze({localeUrl,apply});
 document.addEventListener('theravia:languagechange',e=>apply(e.detail.language));
 apply(window.theraviaInitialLanguage||document.documentElement.dataset.seoLanguage||'de');
})();
