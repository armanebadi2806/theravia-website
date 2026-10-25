/* Same portal interface; confidential data is loaded only after server authentication. */
(()=>{
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),config=window.TheraViaBackendConfig;
 const remote=!!(!local&&config?.enabled&&/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/theravia-api$/.test(config.url));
 const key='theravia.portal.session';
 async function request(path,options={}){
  if(!remote)return fetch(path,options);
  const login=path==='/api/admin/login',logout=path==='/api/admin/logout';
  if(!login&&!logout&&!path.startsWith('/api/portal/'))throw Error('Unbekannte Portalfunktion.');
  const endpoint=login?'/portal/login':logout?'/portal/logout':path.slice(4),headers=new Headers(options.headers);
  const token=sessionStorage.getItem(key);if(token)headers.set('Authorization','Bearer '+token);
  if(path==='/api/portal/action'&&options.method==='POST'){const data=JSON.parse(options.body);data._requestId=data._requestId||crypto.randomUUID();options={...options,body:JSON.stringify(data)};}
  const response=await fetch(config.url+endpoint,{...options,headers,credentials:'omit',mode:'cors',cache:'no-store'});
  if(login&&response.ok){const data=await response.clone().json();sessionStorage.setItem(key,data.token);}
  if(logout||response.status===401&&!login)sessionStorage.removeItem(key);
  return response;
 }
 async function download(path){
  const response=await request(path);if(!response.ok){let data={};try{data=await response.json();}catch{}throw Error(data.error||'Download nicht verfügbar.');}
  const disposition=response.headers.get('Content-Disposition')||'',encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i),plain=disposition.match(/filename="([^"]+)"/i);
  const name=encoded?decodeURIComponent(encoded[1]):plain?.[1]||'theravia-download';
  const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 if(remote)document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(!a)return;const url=new URL(a.href,location.href);if(url.origin===location.origin&&/^\/api\/portal\/(documents|invoices|patients|backups)\//.test(url.pathname)){event.preventDefault();download(url.pathname).catch(e=>{if(typeof toast==='function')toast(e.message,true);});}});
 window.TheraViaPortalTransport=Object.freeze({request,download,remote});
})();
