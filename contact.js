/* Only links the visitor's own telephone or email app; no call tracking. */
(()=>{
 function applyContacts(company){
  if(company.phone){let normalized=company.phone.replace(/[^+0-9]/g,'');if(normalized.startsWith('00'))normalized='+'+normalized.slice(2);else if(normalized.startsWith('0'))normalized='+49'+normalized.slice(1);if(/^\+[1-9]\d{7,14}$/.test(normalized)){document.querySelectorAll('[data-phone-link]').forEach(a=>a.href='tel:'+normalized);document.querySelectorAll('[data-phone-number]').forEach(n=>n.textContent=company.phone)}}
  if(company.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email))document.querySelectorAll('[data-email-link]').forEach(a=>a.href='mailto:'+company.email);
 }
 fetch('/api/business',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(r=>{if(r?.business)applyContacts(r.business)}).catch(()=>{});
})();
