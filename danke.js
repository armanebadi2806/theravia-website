const paymentRequest=(...args)=>window.TheraViaBackend?TheraViaBackend.request(...args):fetch(...args);
const container=document.getElementById('confirmation-selection');
const priceNode=document.getElementById('confirmation-price');
const names={einzel:'Einzelberatung',paar:'Paarberatung',familie:'Familienberatung'};
const confirmationStarted=Date.now();
async function refreshConfirmation(){
 const token=new URLSearchParams(location.hash.slice(1)).get('ref');
 const title=document.querySelector('.section-label');const lead=document.querySelector('.booking-lead');
 if(!token){title.textContent='BUCHUNGSSTATUS';lead.textContent='Für die Bestätigung benötigen wir deinen persönlichen Buchungslink.';container.textContent='Ohne gültigen Bestätigungslink können wir hier keine Zahlung bestätigen.';return}
 try{const response=await paymentRequest('/api/order-confirmation',{cache:'no-store',headers:{Authorization:'Bearer '+token}});const result=await response.json();if(!response.ok)throw Error(result.error);const o=result.order;if(['paid','contacted'].includes(o.status))window.TheraViaBackend?.clearCheckout();
 title.textContent={pending:'ZAHLUNG NOCH OFFEN',paid:'ZAHLUNG BESTÄTIGT',contacted:'BUCHUNG BESTÄTIGT',refunded:'ZAHLUNG ERSTATTET',cancelled:'BUCHUNG STORNIERT',checkout_failed:'ZAHLUNG NICHT ABGESCHLOSSEN'}[o.status]||'BUCHUNGSSTATUS';
 lead.textContent=['paid','contacted'].includes(o.status)?'Dein gebuchtes Angebot ist bestätigt. Wir melden uns innerhalb von 24 Stunden nach Zahlung persönlich zur Terminabstimmung.':o.status==='pending'?'Für deine Bestellung liegt noch kein bestätigter Zahlungseingang vor.':o.status==='refunded'?'Die Rückzahlung zu dieser Buchung wurde erfasst.':'Diese Buchung ist derzeit nicht als bezahlt bestätigt.';
 container.replaceChildren();[['Leistung',names[o.service]],['Umfang',o.total===1?'Einzeltermin':o.total+' Gespräche'],['Dauer',o.duration+' Minuten je Gespräch']].forEach(([label,value])=>{const row=document.createElement('div'),l=document.createElement('span'),v=document.createElement('strong');l.textContent=label;v.textContent=value;row.append(l,v);container.append(row)});if(o.status==='pending'&&Date.now()-confirmationStarted<60000)setTimeout(refreshConfirmation,3000);
 priceNode.textContent=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(o.amount/100);
 }catch(e){title.textContent='STATUS NICHT VERFÜGBAR';lead.textContent='Der Buchungsstatus konnte nicht abgerufen werden.';container.textContent=e.message||'Bitte später erneut versuchen.'}
}
refreshConfirmation();
