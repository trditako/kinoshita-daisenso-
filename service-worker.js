const CACHE_NAME="kinoshita-daisen-v13";
const APP_SHELL=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./ai-2000.js"];
const INJECT='<script src="./ai-2000.js"></script>';
function transformHtml(text){if(text.includes('ai-2000.js'))return text;const p=text.lastIndexOf('</body>');return p<0?text+INJECT:text.slice(0,p)+INJECT+'\n'+text.slice(p)}
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=="GET")return;const u=e.request.url;if(u.includes('/rest/v1/ai_accounts')){e.respondWith(fetch(e.request));return}e.respondWith(fetch(e.request).then(async r=>{const type=r.headers.get('content-type')||'';if(type.includes('text/html')){const text=await r.clone().text();const out=new Response(transformHtml(text),{status:r.status,statusText:r.statusText,headers:r.headers});caches.open(CACHE_NAME).then(c=>c.put(e.request,out.clone()));return out}caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request)))});
