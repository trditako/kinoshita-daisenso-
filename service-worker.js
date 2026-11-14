const CACHE_NAME="kinoshita-daisen-v103";
const API_CACHE_TTL = [
  ["/rest/v1/world_announcements", 5 * 60 * 1000],
  ["/rest/v1/world_operator_state", 2 * 60 * 1000],
  ["/rest/v1/ai_server_state", 60 * 1000],
  ["/rest/v1/kwl_tournaments", 30 * 1000],
  ["/rest/v1/kwl_teams", 30 * 1000],
  ["/rest/v1/kwl_matches", 30 * 1000]
];
function apiCacheTtl(url) {
  try {
    const path = new URL(url).pathname;
    const match = API_CACHE_TTL.find(([prefix]) => path === prefix);
    return match ? match[1] : 0;
  } catch {
    return 0;
  }
}
async function cachedApiResponse(request, ttl) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const cachedAt = cached ? Number(cached.headers.get("x-kw-cache-time") || 0) : 0;
  if (cached && cachedAt && Date.now() - cachedAt < ttl) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        const headers = new Headers(response.headers);
        headers.set("x-kw-cache-time", String(Date.now()));
        const body = await response.clone().arrayBuffer();
        await cache.put(request, new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers
        }));
      } catch (_) {}
      return response;
    }
    // If Supabase is temporarily restricted, preserve the last successful
    // public snapshot instead of replacing it with an error response.
    if (cached && (response.status === 402 || response.status >= 500)) return cached;
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./genesis.js","./hitman.js","./zeus.js","./hastur.js","./kwl.js"])))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=="GET")return;
  const u=e.request.url;
  const ttl=apiCacheTtl(u);
  if(ttl){
    e.respondWith(cachedApiResponse(e.request,ttl).catch(()=>caches.match(e.request).then(r=>r||Response.error())));
    return;
  }
  if(u.includes('/rest/v1/ai_accounts')||u.includes('/rest/v1/player_rankings')){
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(fetch(e.request,/(trade|hitman|genesis|zeus|hastur|kwl)\\.js/.test(e.request.url)?{cache:"reload"}:undefined).then(async r=>{
    const type=r.headers.get('content-type')||'';
    if(type.includes('text/html')){
      const text=await r.clone().text();
      const p=text.lastIndexOf('</body>');
      const inject='\\n<script src="./hastur.js?v=20261114-hastur-formation-hp-display"></script>\\n<script src="./kwl.js?v=20261114-kwl-first-league"></script>\\n';
      const out=new Response(p<0?text:text.slice(0,p)+inject+text.slice(p),{status:r.status,statusText:r.statusText,headers:r.headers});
      caches.open(CACHE_NAME).then(c=>c.put(e.request,out.clone()));
      return out;
    }
    caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));
    return r;
  }).catch(()=>caches.match(e.request)));
});
