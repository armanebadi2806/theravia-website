fetch('/api/business',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(result=>{
  const business=result.business;
  document.querySelectorAll('[data-business]').forEach(node=>{
    const value=business[node.dataset.business];
    const populated=value!==null&&value!==undefined&&String(value).trim()!=='';
    if(populated)node.textContent=value;
    const row=node.closest('[data-business-row]');
    if(row)row.hidden=!populated;
  });
  document.querySelectorAll('[data-business-section]').forEach(section=>{
    section.hidden=!Array.from(section.querySelectorAll('[data-business-row]')).some(row=>!row.hidden);
  });
  const recipient=document.querySelector('[data-withdrawal-recipient]');
  if(recipient)recipient.textContent=[business.name,business.ownerName,business.address,business.email].filter(Boolean).join('\n');
  const version=document.getElementById('legal-version');if(version)version.textContent=result.version;
}).catch(()=>{/* Confirmed contact details remain available without the API. */});
document.getElementById('download-withdrawal')?.addEventListener('click',()=>{
  const text=document.getElementById('withdrawal-template').textContent;
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='TheraVia-Widerrufsmuster.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
