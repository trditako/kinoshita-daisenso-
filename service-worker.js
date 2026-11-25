const CACHE_NAME="kinoshita-daisen-v128";
const API_CACHE_NAME="kinoshita-public-api-v1";
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
  } catch (_) {
    return 0;
  }
}

async function cachedApiResponse(request, ttl) {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);
  const cachedAt = cached ? Number(cached.headers.get("x-kw-cache-time") || 0) : 0;

  if (cached && cachedAt && Date.now() - cachedAt < ttl) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        const headers = new Headers(response.headers);
        headers.set("x-kw-cache-time", String(Date.now()));
        await cache.put(request, new Response(await response.clone().arrayBuffer(), {
          status: response.status,
          statusText: response.statusText,
          headers
        }));
      } catch (_) {}
      return response;
    }
    if (cached && (response.status === 402 || response.status >= 500)) return cached;
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll([
    "./","./index.html","./manifest.json","./icon-192.png","./icon-512.png",
    "./genesis.js","./hitman.js","./zeus.js","./hastur.js","./prism.js","./kwl.js",
    "./equipment.js","./wamuu.js","./evil-kinoshita.js","./battle-core.js",
    "./battle-core.js?v=20261120-kwl-combat-core-2"
  ])));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME&&key!==API_CACHE_NAME).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=="GET") return;
  const url=e.request.url;
  const ttl=apiCacheTtl(url);

  if(ttl){
    e.respondWith(cachedApiResponse(e.request,ttl)
      .catch(()=>caches.match(e.request).then(response=>response||Response.error())));
    return;
  }

  if(url.includes('/rest/v1/ai_accounts')||url.includes('/rest/v1/player_rankings')){
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(fetch(e.request,/(trade|hitman|genesis|zeus|hastur|prism|kwl|wamuu|evil-kinoshita|battle-core)\.js/.test(url)?{cache:"reload"}:undefined)
    .then(async response=>{
      const type=response.headers.get('content-type')||'';
      if(type.includes('text/html')){
        const html=await response.clone().text();
        const position=html.lastIndexOf('</body>');
        const inject='\n<script src="./hastur.js?v=20261123-kwl-post-rebalance"></script>\n<script src="./equipment.js?v=20261116-home-button-set-effects"></script>\n<script src="./kwl.js?v=20261122-existing-operator-key"></script>\n<script src="./wamuu.js?v=20261120-row-death-balance"></script>\n<script src="./prism.js?v=20261124-ownership-wamuu-order"></script>\n<script src="./evil-kinoshita.js?v=20261124-evil-kinoshita-raid"></script>\n';
        const output=new Response(position<0?html:html.slice(0,position)+inject+html.slice(position),{
          status:response.status,statusText:response.statusText,headers:response.headers
        });
        caches.open(CACHE_NAME).then(cache=>cache.put(e.request,output.clone()));
        return output;
      }
      caches.open(CACHE_NAME).then(cache=>cache.put(e.request,response.clone()));
      return response;
    })
    .catch(()=>caches.match(e.request)));
});
