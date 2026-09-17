const CACHE_NAME = "kinoshita-daisen-v3";

const APP_SHELL = ["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png"];

const CHAPTER_REWARD_PATCH = `
/* ===== 日本編・各章クリア報酬 ===== */
if(!window.__chapterRewardsPatchInstalled){
  window.__chapterRewardsPatchInstalled=true;
  const chapterRewardCards=[
    {name:"突撃ハーランド木下",cost:777,hp:2500,atk:1500,range:60,spd:2.5,interval:.7,recharge:25.0,icon:"⚽",motion:"super",attackType:"area",kb:2,series:"日本編章クリア報酬",rarity:"SR",specialReward:true,ability:{name:"突撃ハーランド",desc:"高い攻撃力と素早い突撃を行う範囲攻撃"}},
    {name:"異常木下",cost:3000,hp:15000,atk:3000,range:200,spd:.3,interval:.5,recharge:45.0,icon:"😈",motion:"muscle",attackType:"single",kb:5,series:"日本編章クリア報酬",rarity:"SSR",specialReward:true,ability:{name:"異常なる一撃",desc:"高耐久・超長射程の強力な単体攻撃"}},
    {name:"吉田",cost:200,hp:6000,atk:1111,range:100,spd:1.2,interval:.65,recharge:3.0,icon:"🧑🏻",motion:"power",attackType:"area",kb:2,series:"日本編章クリア報酬",rarity:"SR",specialReward:true,ability:{name:"吉田の猛攻",desc:"短い再生時間で出撃できる範囲攻撃"}}
  ];
  const chapterRewardIds=[];
  if(typeof cards!=='undefined'){
    for(const c of chapterRewardCards){
      let idx=cards.findIndex(x=>x&&x.name===c.name);
      if(idx<0){idx=cards.length;cards.push(c);}
      chapterRewardIds.push(idx);
    }
  }
  if(typeof allyTraits!=='undefined'){
    allyTraits['突撃ハーランド木下']='無';
    allyTraits['異常木下']='赤';
    allyTraits['吉田']='赤';
  }
  function chapterRewardSync(){
    if(typeof chapterClears==='undefined'||typeof ownedFlags==='undefined'||chapterRewardIds.length!==3)return;
    let changed=false;
    for(let ch=0;ch<3;ch++){
      if(Number(chapterClears[ch]||0)>=48){
        const idx=chapterRewardIds[ch];
        if(!ownedFlags[idx]){ownedFlags[idx]=true;changed=true;}
      }
    }
    if(changed){
      try{if(typeof syncOwnedCount==='function')syncOwnedCount();}catch(e){}
      try{if(typeof save==='function')save();}catch(e){}
      try{if(typeof renderCards==='function')renderCards();}catch(e){}
      try{if(typeof renderFormation==='function')renderFormation();}catch(e){}
    }
  }
  chapterRewardSync();
  setInterval(chapterRewardSync,500);
}
`;

function transformHtml(text){
  if(text.includes("__chapterRewardsPatchInstalled"))return text;
  const pos=text.lastIndexOf("</script>");
  if(pos<0)return text;
  return text.slice(0,pos)+"\n"+CHAPTER_REWARD_PATCH+"\n"+text.slice(pos);
}

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(
    fetch(event.request).then(async response=>{
      const type=response.headers.get("content-type")||"";
      if(type.includes("text/html")){
        const text=await response.clone().text();
        const patched=transformHtml(text);
        const patchedResponse=new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers});
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,patchedResponse.clone()));
        return patchedResponse;
      }
      caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
