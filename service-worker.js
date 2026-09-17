const CACHE_NAME = "kinoshita-daisen-v5";

const APP_SHELL = ["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png"];

const PATCH = `
/* ===== 日本編・各章クリア報酬 ===== */
if(!window.__chapterRewardsPatchInstalled){
window.__chapterRewardsPatchInstalled=true;
const chapterRewardCards=[
{name:"突撃ハーランド木下",cost:777,hp:2500,atk:1500,range:60,spd:2.5,interval:.7,recharge:25,icon:"⚽",motion:"super",attackType:"area",kb:2,series:"日本編章クリア報酬",rarity:"SR",specialReward:true,ability:{name:"突撃ハーランド",desc:"高い攻撃力と素早い突撃を行う範囲攻撃"}},
{name:"異常木下",cost:3000,hp:15000,atk:3000,range:200,spd:.3,interval:.5,recharge:45,icon:"😈",motion:"muscle",attackType:"single",kb:5,series:"日本編章クリア報酬",rarity:"SSR",specialReward:true,ability:{name:"異常なる一撃",desc:"高耐久・超長射程の強力な単体攻撃"}},
{name:"吉田",cost:200,hp:6000,atk:1111,range:100,spd:1.2,interval:.65,recharge:3,icon:"🧑🏻",motion:"power",attackType:"area",kb:2,series:"日本編章クリア報酬",rarity:"SR",specialReward:true,ability:{name:"吉田の猛攻",desc:"短い再生時間で出撃できる範囲攻撃"}}
];
const chapterRewardIds=[];
if(typeof cards!=='undefined')for(const c of chapterRewardCards){let i=cards.findIndex(x=>x&&x.name===c.name);if(i<0){i=cards.length;cards.push(c)}chapterRewardIds.push(i)}
if(typeof allyTraits!=='undefined'){allyTraits['突撃ハーランド木下']='無';allyTraits['異常木下']='赤';allyTraits['吉田']='赤'}
function chapterRewardSync(){if(typeof chapterClears==='undefined'||typeof ownedFlags==='undefined'||chapterRewardIds.length!==3)return;let chg=false;for(let c=0;c<3;c++)if(Number(chapterClears[c]||0)>=48){const i=chapterRewardIds[c];if(!ownedFlags[i]){ownedFlags[i]=true;chg=true}}if(chg){try{syncOwnedCount()}catch(e){}try{save()}catch(e){}try{renderCards()}catch(e){}}}
chapterRewardSync();setInterval(chapterRewardSync,500);
const hiddenGachaRewards=new Set(['狂乱の木下','突撃ハーランド木下','異常木下','吉田']);
if(typeof renderGacha==='function'){const oldGacha=renderGacha;renderGacha=function(){const changed=[];try{if(typeof cards!=='undefined'&&typeof ownedFlags!=='undefined')cards.forEach((c,i)=>{if(c&&hiddenGachaRewards.has(c.name)&&!ownedFlags[i]){ownedFlags[i]=true;changed.push(i)}});oldGacha()}finally{changed.forEach(i=>ownedFlags[i]=false)}}}

/* ===== AI個体差・行動分岐 ===== */
if(typeof aiActivityProgress==='function'){
window.__originalAIActivityProgress=aiActivityProgress;
aiActivityProgress=function(ai){
 const id=String(ai.accountId||ai.name||Math.random()),stageTotal=Number(ai.stageClears||0),cc=Array.isArray(ai.chapterClears)?ai.chapterClears:[0,0,0];
 const strategy=typeof strategyOf==='function'?strategyOf(ai):{key:ai.strategy||'balanced',label:'バランス型'};
 const seed=(s)=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return(h%100000)/100000};
 const strength=.78+seed(id+':strength')*.48,focus=seed(id+':focus'),risk=seed(id+':risk'),roll=seed(id+':'+Date.now().toString().slice(0,-4));
 const weights={stage:.18,rank:.28,event:.18,train:.18,gacha:.18};
 if(strategy.key==='rush')weights.stage+=.18;
 if(strategy.key==='tank')weights.train+=.10,weights.event+=.07;
 if(strategy.key==='swarm')weights.gacha+=.12,weights.stage+=.06;
 if(strategy.key==='balanced')weights.stage+=.04,weights.rank+=.08;
 if(strategy.key==='counter')weights.rank+=.18,weights.event+=.06;
 if(strategy.key==='boss')weights.event+=.18,weights.train+=.07;
 if(strategy.key==='economy')weights.gacha+=.16,weights.train+=.08;
 if(strategy.key==='trick')weights.rank+=.10,weights.event+=.10;
 if(focus<.20)weights.rank+=.22;
 if(focus>.80)weights.stage+=.22;
 if(ai.playerXP>=150)weights.train+=.22;
 if(ai.coins>=600)weights.gacha+=.18;
 if(stageTotal>=80)weights.rank+=.08;
 if(stageTotal<12)weights.event*=.45;
 if(!cc.some(x=>x<48))weights.stage=.03;
 const total=Object.values(weights).reduce((a,b)=>a+b,0);let x=roll*total;let action='gacha';for(const k of ['stage','rank','event','train','gacha']){x-=weights[k];if(x<=0){action=k;break}}
 const log=(t)=>{ai.activity=t;ai.activityHistory=Array.isArray(ai.activityHistory)?ai.activityHistory:[];ai.activityHistory.unshift(t);ai.activityHistory=ai.activityHistory.slice(0,10)};
 if(action==='gacha'){
   let did=0;while(did<2&&typeof aiTryGachaExchange==='function'&&aiTryGachaExchange(ai))did++;
   if(did)log('🎟️ 戦術に合わせてガチャ交換（コイン消費）');else log('🪙 ガチャ資金を貯蓄中');
 }else if(action==='train'){
   const before=ai.playerXP,leveled=typeof aiLevelUpFromXP==='function'?aiLevelUpFromXP(ai):0;
   log(leveled?`📈 戦術育成：${leveled}体育成（XP消費 ${before-ai.playerXP}）`:'📈 育成用XPを貯蓄中');
 }else if(action==='rank'){
   const win=seed(id+':rank:'+Math.floor(Date.now()/120000))<Math.min(.9,.30+Number(ai.skill||.25)*.48+(strength-1)*.22);
   ai.matches=(ai.matches||0)+1;
   if(win){ai.wins=(ai.wins||0)+1;ai.rp=(ai.rp||0)+8+Math.floor(strength*5);ai.playerXP=(ai.playerXP||0)+30;ai.coins=(ai.coins||0)+45;ai.lastResult='ランク戦勝利';log('🏆 ランク戦勝利：RP・XP・コイン獲得')}
   else{ai.losses=(ai.losses||0)+1;ai.rp=Math.max(0,(ai.rp||0)-5);ai.playerXP=(ai.playerXP||0)+18;ai.coins=(ai.coins||0)+25;ai.lastResult='ランク戦敗北';log('🏆 ランク戦敗北：RP・XP・コイン獲得')}
 }else if(action==='event'){
   const can=stageTotal>=12&&(ai.ownedCharacters||[]).length>=3;
   if(ai.eventClears&&ai.eventClears['狂乱の木下降臨']){ai.playerXP=(ai.playerXP||0)+22;ai.coins=(ai.coins||0)+35;log('🔥 イベント周回：XP・コイン獲得')}
   else if(!can)log('🔥 イベント挑戦：戦力不足で見送り');
   else{const win=seed(id+':event:'+Math.floor(Date.now()/120000))<Math.min(.82,.12+strength*.22+Number(ai.skill||.25)*.3+stageTotal*.0015);if(win){ai.eventClears=ai.eventClears||{};ai.eventClears['狂乱の木下降臨']=true;const ri=cards.findIndex(c=>c&&c.name==='狂乱の木下');if(ri>=0&&!ai.ownedCharacters.includes(ri))ai.ownedCharacters.push(ri);ai.playerXP=(ai.playerXP||0)+80;ai.coins=(ai.coins||0)+150;log('🔥 狂乱の木下降臨クリア：報酬獲得')}else{log('🔥 狂乱の木下降臨に挑戦：敗北')}}
 }else{
   const ch=cc.findIndex(v=>Number(v||0)<48);
   if(ch<0){ai.playerXP=(ai.playerXP||0)+25;ai.coins=(ai.coins||0)+35;log('🇯🇵 日本編クリア済み：周回ではなく育成・対戦を優先')}
   else{
     const st=Number(cc[ch]||0)+1,win=seed(id+':stage:'+ch+':'+st+':'+Math.floor(Date.now()/120000))<Math.min(.88,.24+Number(ai.skill||.25)*.42+strength*.14+Math.min(0.18,stageTotal*.0015));
     if(win){cc[ch]=st;ai.chapterClears=cc;ai.stageClears=cc.reduce((a,b)=>a+b,0);ai.playerXP=(ai.playerXP||0)+70+st*2;ai.coins=(ai.coins||0)+120+st*3;const s=chapterStages[ch]?.[st-1],r=s?.reward;if(Number.isInteger(r)&&r>0&&!ai.ownedCharacters.includes(r-1))ai.ownedCharacters.push(r-1);log(`🇯🇵 第${ch+1}章 ${st}ステージクリア：XP・コイン獲得`)}else log(`🇯🇵 第${ch+1}章 ${st}ステージ挑戦：敗北`)
   }
 }
 /* 追加の購入・育成も資源がある場合だけ実行。無料育成は一切しない。 */
 if(risk>.55&&typeof aiTryGachaExchange==='function')aiTryGachaExchange(ai);
 if(typeof aiLevelUpFromXP==='function')aiLevelUpFromXP(ai);
 ai.coins=Math.max(0,(ai.coins||0)+10);
 ai.ownedCharacters=[...new Set(ai.ownedCharacters||[0])];
 ai.formation=(ai.formation||[]).filter(i=>ai.ownedCharacters.includes(i));
 if(!ai.formation.length)ai.formation=[0];
}
}

/* 対戦学習では無料レベルアップしない。実際のプレイヤーXPを使う。 */
if(typeof aiLearnFromMatch==='function'){
aiLearnFromMatch=function(ai,won){if(!ai)return;ai.skill=Math.min(.995,Number(ai.skill||.25)+(won?.0018:.0007));ai.trainingXP=(ai.trainingXP||0)+(won?4:2);ai.lastResult=won?'勝利':'敗北';if(typeof pushAIActivity==='function')pushAIActivity(ai,`🧠 対戦学習：AI強度 ${Math.round(ai.skill*100)}%`)};
}

/* ランクランキング：自分以外のAIも常時表示。上位50＋自分の順位を表示。 */
if(typeof renderRankLeaderboard==='function'){
renderRankLeaderboard=function(){const el=document.getElementById('rankBoard');if(!el)return;const rows=[{name:playerName,rp:rankPoints,strategy:'プレイヤー',me:true,wins:playerRankWins,losses:playerRankLosses}].concat(aiProfiles.map(a=>({name:a.name,rp:Number(a.rp)||0,strategy:typeof strategyOf==='function'?strategyOf(a).label:'AI',me:false,wins:Number(a.wins)||0,losses:Number(a.losses)||0}))).sort((a,b)=>b.rp-a.rp||b.wins-a.wins);const me=rows.findIndex(x=>x.me);const shown=rows.slice(0,50);if(me>=50)shown.push(rows[me]);el.innerHTML=`<div style="font-weight:1000;text-align:center;padding:6px">🏆 ランクランキング　全${rows.length}人</div>`+shown.map((x,i)=>{const real=x.me?me+1:i+1;return `<div class="rankRow ${x.me?'me':''}"><b>${real}位</b><span>${x.me?'👤 ':'🤖 '}${x.name}<small class="rankStrategy">${x.strategy}</small></span><span>${x.rp} RP</span><span>${x.wins}勝 ${x.losses}敗</span></div>`}).join('')};
}
}

function transformHtml(text){if(text.includes("__chapterRewardsPatchInstalled"))return text;const pos=text.lastIndexOf("</script>");if(pos<0)return text;return text.slice(0,pos)+"\n"+PATCH+"\n"+text.slice(pos)}
self.addEventListener("install",event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).then(async response=>{const type=response.headers.get("content-type")||"";if(type.includes("text/html")){const text=await response.clone().text(),patched=transformHtml(text),r=new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers});caches.open(CACHE_NAME).then(c=>c.put(event.request,r.clone()));return r}caches.open(CACHE_NAME).then(c=>c.put(event.request,response.clone()));return response}).catch(()=>caches.match(event.request)))});
