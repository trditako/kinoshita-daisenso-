/* 木下大戦争 装備システム v1 */
(()=>{
'use strict';
if(window.__KINOSHITA_EQUIPMENT_V1__)return;
window.__KINOSHITA_EQUIPMENT_V1__=true;
const KEY='kinoshitaEquipmentDataV1';
const SETS={
 warrior:{name:'剛力',bonus:{atk:0.08},special:{2:'攻撃力+8%',4:'攻撃時に追加衝撃'}},
 guardian:{name:'守護',bonus:{hp:0.08,defense:0.06},special:{2:'HP+8%',4:'被ダメージ軽減'}},
 recovery:{name:'慈愛',bonus:{healing:0.1},special:{2:'回復率+10%',4:'回復効果強化'}},
 wave:{name:'波紋',bonus:{waveDamage:0.1},special:{2:'波動ダメージ+10%',4:'波動攻撃を獲得'}},
 surge:{name:'烈火',bonus:{surgeDamage:0.1},special:{2:'烈波ダメージ+10%',4:'烈波攻撃を獲得'}},
 bulwark:{name:'不屈',bonus:{waveReduce:0.08,surgeReduce:0.08},special:{2:'波動・烈波軽減+8%',4:'波動・烈波耐性強化'}}
};
const ITEMS=[
 ['iron','鉄壁の兜','guardian',0,{hp:5,defense:4}],['iron2','鉄壁の鎧','guardian',0,{hp:7,defense:3}],['iron3','鉄壁の具足','guardian',0,{hp:4,defense:5}],
 ['power1','剛力の指輪','warrior',1,{atk:6}],['power2','剛力の腕輪','warrior',1,{atk:8}],['power3','剛力の戦靴','warrior',1,{atk:5,defense:2}],
 ['heal1','慈愛の首飾り','recovery',1,{healing:8,hp:2}],['heal2','慈愛の法衣','recovery',1,{healing:10}],['heal3','慈愛の聖杯','recovery',2,{healing:12}],
 ['wave1','波紋の結晶','wave',2,{waveDamage:10}],['wave2','波紋の護符','wave',1,{waveReduce:8}],['wave3','波紋の指輪','wave',2,{waveDamage:8,waveReduce:4}],
 ['surge1','烈火の結晶','surge',2,{surgeDamage:10}],['surge2','烈火の護符','surge',1,{surgeReduce:8}],['surge3','烈火の指輪','surge',2,{surgeDamage:8,surgeReduce:4}],
 ['ward1','不屈の紋章','bulwark',1,{waveReduce:8,surgeReduce:8}],['ward2','不屈の盾','bulwark',2,{hp:5,defense:5,waveReduce:5,surgeReduce:5}],
 ['myth','神話の核','wave',3,{atk:5,waveDamage:15,surgeDamage:10}]
].map(([id,name,set,rarity,stats])=>({id,name,set,rarity,stats}));
const RARITY=['N','R','SR','SSR'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let data={inventory:{},equipped:{},selected:''};
try{data={...data,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}};
const owned=()=>typeof ownedFlags!=='undefined'?cards.map((c,i)=>ownedFlags[i]?i:-1).filter(i=>i>=0):[];
const charKey=i=>String(cards[i]?.name||i);
const count=id=>Math.max(0,Number(data.inventory[id]||0));
const add=(id,n=1)=>{data.inventory[id]=count(id)+n;save();};
const equipped=i=>Array.isArray(data.equipped[charKey(i)])?data.equipped[charKey(i)].slice(0,6):[];
function totals(i){
 const ids=equipped(i),t={hp:0,atk:0,defense:0,healing:0,waveDamage:0,waveReduce:0,surgeDamage:0,surgeReduce:0},sets={};
 ids.forEach(id=>{const item=ITEMS.find(x=>x.id===id);if(!item)return;sets[item.set]=(sets[item.set]||0)+1;Object.entries(item.stats).forEach(([k,v])=>t[k]=(t[k]||0)+v);});
 const active={};Object.entries(sets).forEach(([k,n])=>{if(n>=2)active[k]=n;});
 return {ids,t,sets:active};
}
function bonuses(i){const x=totals(i),b={...x.t};Object.entries(x.sets).forEach(([key,n])=>{const s=SETS[key];if(n>=4)Object.entries(s.bonus).forEach(([k,v])=>b[k]=(b[k]||0)+v*100);});return b;}
function pct(i,key){return Math.max(0,Number(bonuses(i)[key]||0))/100;}
function ensureUI(){
 if(document.getElementById('equipmentLauncher'))return;
 const style=document.createElement('style');style.textContent=`
 #equipmentLauncher{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 84px);z-index:9990;background:#253b66;color:#fff;border:2px solid #d7b66d;border-radius:14px;padding:10px 13px;font-weight:900;box-shadow:0 3px 12px #0005}
 #equipmentModal{display:none;position:fixed;inset:0;z-index:10020;background:#101827eF;overflow:auto;padding:18px 10px;color:#f8fafc}
 #equipmentPanel{max-width:760px;margin:20px auto;background:#17243a;border:1px solid #71839e;border-radius:16px;padding:14px}
 #equipmentPanel button,#equipmentPanel select{padding:8px;border-radius:9px;border:1px solid #64748b;margin:3px}
 .eqgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
 .eqitem{background:#243650;border:1px solid #52647e;border-radius:10px;padding:9px;font-size:13px}
 .eqslots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .eqslot{min-height:65px;background:#0f172a;border:1px dashed #64748b;border-radius:9px;padding:6px;font-size:12px}
 .eqmuted{color:#b9c5d6;font-size:12px}
 @media(max-width:480px){.eqgrid{grid-template-columns:1fr}#equipmentLauncher{bottom:calc(env(safe-area-inset-bottom,0px) + 76px)}}
 `;document.head.appendChild(style);
 const btn=document.createElement('button');btn.id='equipmentLauncher';btn.textContent='🛡️ 装備';btn.onclick=open;document.body.appendChild(btn);
 const modal=document.createElement('div');modal.id='equipmentModal';modal.innerHTML=`
 <div id="equipmentPanel"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:4px 0">🛡️ キャラクター装備</h2><button id="eqClose">閉じる</button></div>
 <p class="eqmuted">キャラごとに最大6枠。装備の基礎効果・シリーズ効果・セット効果は戦闘に反映されます。</p>
 <label>キャラクター <select id="eqCharacter"></select></label>
 <div id="eqSummary"></div><h3>装備スロット（6枠）</h3><div id="eqSlots" class="eqslots"></div>
 <h3>所持装備</h3><div id="eqInventory" class="eqgrid"></div>
 <h3>装備の入手</h3><div style="display:flex;flex-wrap:wrap;gap:6px"><button id="eqGacha">装備ガチャ（5,000コイン）</button><button id="eqShop">装備ショップ</button><button id="eqDropInfo">ステージ報酬について</button></div><div id="eqShopArea"></div><p id="eqMessage" class="eqmuted"></p></div>`;
 document.body.appendChild(modal);
 modal.querySelector('#eqClose').onclick=()=>modal.style.display='none';
 modal.querySelector('#eqCharacter').onchange=()=>{data.selected=modal.querySelector('#eqCharacter').value;save();render();};
 modal.querySelector('#eqGacha').onclick=gacha;
 modal.querySelector('#eqShop').onclick=shop;
 modal.querySelector('#eqDropInfo').onclick=()=>message('ステージクリア時に装備がドロップします。高難度ステージほど高レア装備の抽選率が上がります。');
 render();
}
function message(s){const e=document.getElementById('eqMessage');if(e)e.textContent=s;}
function open(){const m=document.getElementById('equipmentModal');if(m){m.style.display='block';render();}}
function render(){
 const sel=document.getElementById('eqCharacter');if(!sel||typeof cards==='undefined')return;
 const list=owned();if(!list.length){sel.innerHTML='<option>所持キャラがいません</option>';return;}
 const current=list.some(i=>charKey(i)===data.selected)?data.selected:charKey(list[0]);data.selected=current;
 sel.innerHTML=list.map(i=>'<option value="'+charKey(i).replace(/"/g,'&quot;')+'">'+cards[i].name+'</option>').join('');sel.value=current;
 const i=list.find(x=>charKey(x)===current),x=totals(i),b=bonuses(i);
 const summary=document.getElementById('eqSummary');
 summary.innerHTML='<div class="eqitem">HP +'+(b.hp||0)+'% / 攻撃 +'+(b.atk||0)+'% / 防御 +'+(b.defense||0)+'% / 回復 +'+(b.healing||0)+'%<br>波動ダメージ +'+(b.waveDamage||0)+'%・軽減 '+(b.waveReduce||0)+'%<br>烈波ダメージ +'+(b.surgeDamage||0)+'%・軽減 '+(b.surgeReduce||0)+'%<br><b>シリーズ：</b>'+Object.entries(x.sets).map(([k,n])=>SETS[k].name+' '+n+'個').join(' / ')+'</div>';
 const slots=document.getElementById('eqSlots');slots.innerHTML=Array.from({length:6},(_,n)=>{const id=x.ids[n],it=ITEMS.find(z=>z.id===id);return '<div class="eqslot">'+(it?'<b>'+it.name+'</b><br>'+SETS[it.set].name+'<br><button data-remove="'+n+'">外す</button>':'空き枠')+'</div>';}).join('');
 slots.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{const a=equipped(i);const n=Number(btn.dataset.remove);const id=a[n];if(!id)return;a.splice(n,1);data.equipped[charKey(i)]=a;add(id);save();render();});
 const inv=document.getElementById('eqInventory');const ownedItems=ITEMS.filter(it=>count(it.id)>0);
 inv.innerHTML=ownedItems.length?ownedItems.map(it=>'<div class="eqitem"><b>'+it.name+'</b> <span class="eqmuted">'+RARITY[it.rarity]+' / '+SETS[it.set].name+'</span><br><span class="eqmuted">'+Object.entries(it.stats).map(([k,v])=>k+' +'+v+'%').join('・')+'</span><br>所持 '+count(it.id)+'個 <button data-equip="'+it.id+'">装備する</button></div>').join(''):'<p class="eqmuted">装備をまだ所持していません。</p>';
 inv.querySelectorAll('[data-equip]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.equip,a=equipped(i);if(a.length>=6){message('装備枠が6つ埋まっています。先に装備を外してください。');return;}if(!count(id))return;data.inventory[id]=count(id)-1;a.push(id);data.equipped[charKey(i)]=a;save();render();});
}
function gacha(){
 if(typeof gachaCoins==='undefined'||gachaCoins<5000){message('木下コインが5,000枚必要です。');return;}
 gachaCoins-=5000;const r=Math.random(),rarity=r<.01?3:r<.12?2:r<.48?1:0;
 const pool=ITEMS.filter(it=>it.rarity===rarity),it=pool[Math.floor(Math.random()*pool.length)];add(it.id);if(typeof save==='function')save();render();message('装備ガチャ：'+it.name+'（'+RARITY[rarity]+'）を獲得！');
}
function shop(){
 const area=document.getElementById('eqShopArea');if(!area)return;
 area.innerHTML='<div class="eqgrid">'+ITEMS.map(it=>'<div class="eqitem"><b>'+it.name+'</b><br>'+SETS[it.set].name+' / '+RARITY[it.rarity]+'<br>価格 '+(2000+it.rarity*3500).toLocaleString()+'コイン <button data-buy="'+it.id+'">交換</button></div>').join('')+'</div>';
 area.querySelectorAll('[data-buy]').forEach(btn=>btn.onclick=()=>{const it=ITEMS.find(x=>x.id===btn.dataset.buy),cost=2000+it.rarity*3500;if(typeof gachaCoins==='undefined'||gachaCoins<cost){message('コインが足りません。');return;}gachaCoins-=cost;add(it.id);if(typeof save==='function')save();render();message(it.name+'を交換しました。');});
}
function stageDrop(win){
 if(!win||Math.random()>.28)return;
 const r=Math.random(),rarity=r<.025?3:r<.18?2:r<.55?1:0,pool=ITEMS.filter(it=>it.rarity===rarity),it=pool[Math.floor(Math.random()*pool.length)];
 add(it.id);const el=document.getElementById('resultText');if(el)el.textContent+='\n🛡️ 装備ドロップ：'+it.name+'を獲得！';
}
function init(){
 ensureUI();
 if(typeof showResult==='function'&&!window.__eqResultWrapped){const prev=showResult;showResult=function(win){const result=prev.apply(this,arguments);try{stageDrop(!!win);}catch(e){console.warn('equipment reward',e);}return result;};window.__eqResultWrapped=true;}
 if(typeof statAt==='function'&&!window.__eqStatWrapped){const prev=statAt;statAt=function(i,key){let v=prev.apply(this,arguments);if(!Number.isInteger(i)||i<0)return v;const b=bonuses(i);if(key==='hp')v*=1+(b.hp||0)/100;if(key==='atk')v*=1+(b.atk||0)/100;return Math.round(v*100)/100;};window.__eqStatWrapped=true;}
 if(typeof deploy==='function'&&!window.__eqDeployWrapped){const prev=deploy;deploy=function(i){const before=Array.isArray(units)?units.length:0;const result=prev.apply(this,arguments);try{const u=units?.slice(before).find(x=>!x.isEnemy&&x.cardIndex===i);if(u){const b=bonuses(i);u.equipmentDefense=(b.defense||0)/100;u.equipmentWaveReduce=(b.waveReduce||0)/100;u.equipmentSurgeReduce=(b.surgeReduce||0)/100;u.equipmentWaveDamage=(b.waveDamage||0)/100;u.equipmentSurgeDamage=(b.surgeDamage||0)/100;const sets=totals(i).sets;if(sets.wave>=4){u.ability={...(u.ability||{}),wave:true,waveLevel:Math.max(1,Number(u.ability?.waveLevel||0)),waveChance:Math.max(.25,Number(u.ability?.waveChance||0))};}if(sets.surge>=4){u.ability={...(u.ability||{}),phoenixSurgeLevel:Math.max(1,Number(u.ability?.phoenixSurgeLevel||0)),phoenixSurgeMin:1,phoenixSurgeMax:Math.max(1,Number(u.ability?.phoenixSurgeMax||0))};}}}catch(e){console.warn('equipment deploy',e);}return result;};window.__eqDeployWrapped=true;}
 if(typeof hit==='function'&&!window.__eqHitWrapped){const prev=hit;hit=function(target,damage,source,abilitySource){let d=Number(damage)||0;if(target&&!target.isEnemy){const reduction=Math.max(0,Math.min(.35,Number(target.equipmentDefense||0)));d*=1-reduction;}return prev.call(this,target,d,source,abilitySource);};window.__eqHitWrapped=true;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
