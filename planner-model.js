/* Pure calendar rules, shared by the appointment UI and its tests. */
(function(root){
 function dayBounds(day,toEpoch){const date=new Date(day+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==day)return null;const weekend=[0,6].includes(date.getUTCDay());return {start:toEpoch(day+'T'+(weekend?'10:00':'17:00')),end:toEpoch(day+'T'+(weekend?'18:00':'22:00'))};}
 function available({day,practitionerId,patientId,duration,availabilityDays=[],releases=[],appointments=[],excludeId=null,preferredStart=null,toEpoch,now=Date.now()/1000}){
  if(!day||!practitionerId||!patientId||!Number.isFinite(duration)||duration<=0)return [];
  const bounds=dayBounds(day,toEpoch),free=availabilityDays.find(d=>d.practitionerId===practitionerId&&d.dayKey===day&&d.status==='free'),released=releases.some(r=>r.practitionerId===practitionerId&&r.monthKey===day.slice(0,7)&&r.active!==false);
  if(!bounds||!free||!released)return [];
  const start=Math.max(bounds.start,free.startsAt),end=Math.min(bounds.end,free.endsAt),slots=[];
  const fits=t=>t>=Math.max(start,now)&&t+duration*60<=end&&!appointments.some(a=>a.id!==excludeId&&a.status==='scheduled'&&(a.practitionerId===practitionerId||a.patientId===patientId)&&a.startsAt<t+duration*60&&a.endsAt>t);
  for(let t=Math.ceil(start/300)*300;t+duration*60<=end;t+=900){if(fits(t))slots.push(t);}
  if(Number.isFinite(preferredStart)&&fits(preferredStart)&&!slots.includes(preferredStart))slots.push(preferredStart);
  slots.sort((a,b)=>a-b);
  return slots;
 }
 const api={available,dayBounds};if(typeof module==='object'&&module.exports)module.exports=api;else root.TheraViaPlannerModel=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
