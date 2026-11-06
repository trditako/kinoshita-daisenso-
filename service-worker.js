const CACHE_NAME="kinoshita-daisen-v73";
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./genesis.js","./hitman.js","./formation-detail-enhancements.js"]))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=="GET")return;
 const u=e.request.url;
 if(u.includes('/rest/v1/ai_accounts')||u.includes('/rest/v1/player_rankings')){e.respondWith(fetch(e.request));return;}
 e.respondWith(fetch(e.request,e.request.url.includes("trade.js")?{cache:"reload"}:undefined).then(async r=>{
  const type=r.headers.get('content-type')||'';
  if(type.includes('text/html')){
   let html=await r.clone().text();
   if(!html.includes('formation-detail-enhancements.js')){
    const p=html.lastIndexOf('</body>');
    const script='<script src="./formation-detail-enhancements.js"></script>';
    html=p<0?html+'\n'+script:html.slice(0,p)+'\n'+script+'\n'+html.slice(p);
   }
   const headers=new Headers(r.headers);
   headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
   const out=new Response(html,{status:r.status,statusText:r.statusText,headers});
   caches.open(CACHE_NAME).then(c=>c.put(e.request,out.clone()));
   return out;
  }
  caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));
  return r;
 }).catch(()=>caches.match(e.request)));
});
