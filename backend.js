/* Payment transport. Does not change the page layout or the local practice API. */
(()=>{
 const config=window.TheraViaBackendConfig;
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const remote=!!(config?.enabled&&!local&&/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/theravia-api$/.test(config.url));
 const routes=new Set(['/api/business','/api/checkout-config','/api/checkout','/api/order-confirmation']);
 async function request(path,options={}){
  if(!remote)return fetch(path,options);
  if(!routes.has(path))throw new Error('Diese Funktion ist noch nicht online angebunden.');
  if(path==='/api/checkout'&&options.method==='POST'){
   const body=JSON.parse(options.body);
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
   const fingerprint=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
   let saved=null;try{saved=JSON.parse(sessionStorage.getItem('theravia.checkoutAttempt'));}catch{}
   if(saved?.fingerprint!==fingerprint){saved={fingerprint,key:crypto.randomUUID()};sessionStorage.setItem('theravia.checkoutAttempt',JSON.stringify(saved));}
   body.requestKey=saved.key;options={...options,body:JSON.stringify(body)};
  }
  const response=await fetch(config.url+path.slice(4),{...options,credentials:'omit',mode:'cors',cache:'no-store'});
  if(path==='/api/checkout'&&response.status===409){try{if((await response.clone().json()).code==='CHECKOUT_EXPIRED')sessionStorage.removeItem('theravia.checkoutAttempt');}catch{}}
  return response;
 }
 window.TheraViaBackend=Object.freeze({request,remote,clearCheckout(){sessionStorage.removeItem('theravia.checkoutAttempt');}});
})();
