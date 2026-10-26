(() => {
'use strict';
const BASE='https://jhohdvuoyvbzwjumnibc.supabase.co';
const KEY='sb_publishable_bofrXTgGnFd-s52JoE2OnQ_75sLT_Jg';
const SESSION_KEY='kinoshitaTradeAuthSession';
const el=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null, profile=null, offers=[], history=[], busy=false;
const chosen={give:{items:{},cosmetics:{}},want:{items:{},cosmetics:{}}};
try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{}
function saveSession(){try{if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}catch{}}
async function authRequest(path,body,method='POST'){
 const r=await fetch(BASE+'/auth/v1/'+path,{method,headers:{apikey:KEY,'Content-Type':'application/json',...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.msg||data.message||data.error_description||data.error||'認証に失敗しました');
 return data;
}
async function ensureSession(){
 if(session?.access_token&&session?.refresh_token&&Number(session.expires_at||0)>Math.floor(Date.now()/1000)+90)return;
 if(session?.refresh_token){
  try{const n=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});session={...n,expires_at:Math.floor(Date.now()/1000)+Number(n.expires_in||3600)};saveSession();return}catch{session=null;saveSession()}
 }
 const n=await authRequest('signup',{});
 if(!n.access_token)throw new Error('匿名ログインが有効でないか、認証設定を確認できません。');
 session={...n,expires_at:Math.floor(Date.now()/1000)+Number(n.expires_in||3600)};saveSession();
}
async function api(action,extra={}){
 await ensureSession();
 const r=await fetch(BASE+'/functions/v1/player-trading',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error(d.error||'取引APIでエラーが発生しました');
 return d;
}
function panel(){
 if(el('kinoshitaTradeRoot'))return;
 const style=document.createElement('style');
 style.textContent=`
 #kinoshitaTradeHomeButton{background:#5b21b6!important;color:#fff!important;border:2px solid #c4b5fd!important;border-radius:10px!important;padding:10px 14px!important;font-weight:800!important;box-shadow:0 3px 12px #0005!important;margin:4px!important}
 #kinoshitaTradeRoot{display:none;position:fixed;inset:0;z-index:9991;background:#000b;align-items:center;justify-content:center;padding:12px;font:14px system-ui,sans-serif;color:#f8fafc}
 #kinoshitaTradeCard{width:min(720px,100%);max-height:92dvh;overflow:auto;background:#111827;border:1px solid #6d28d9;border-radius:16px;padding:16px;box-sizing:border-box}
 #kinoshitaTradeCard input,#kinoshitaTradeCard textarea{box-sizing:border-box;width:100%;padding:9px;margin:4px 0 9px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff}
 #kinoshitaTradeCard button{cursor:pointer;border:0;border-radius:8px;padding:9px 12px;font-weight:700}
 .kt-primary{background:#7c3aed;color:white}.kt-secondary{background:#334155;color:white}.kt-offer{border:1px solid #475569;border-radius:10px;padding:10px;margin:8px 0;background:#1f2937}
 .kt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kt-offer select{box-sizing:border-box;width:100%;padding:9px;margin:4px 0 9px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff}.kt-selected-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px;border-bottom:1px solid #475569}.kt-selected-row button{padding:4px 7px!important}.kt-muted{color:#cbd5e1;font-size:12px}.kt-error{color:#fca5a5}.kt-good{color:#86efac}
 .kt-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.kt-filters select{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff}.kt-value-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px;border-bottom:1px solid #475569}.kt-help ol{padding-left:22px}.kt-help li{margin:7px 0}@media(max-width:480px){.kt-grid,.kt-filters{grid-template-columns:1fr}}
 `;
 document.head.appendChild(style);
 const b=document.createElement('button');b.id='kinoshitaTradeHomeButton';b.type='button';b.textContent='🏪 バザー';b.onclick=()=>{el('kinoshitaTradeRoot').style.display='flex';refresh().catch(showError)};b.style.display='none';
 function attachHomeButton(){
  if(!b.isConnected)return;
  const visible=(n)=>!!(n&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none');
  const isHomeLabel=(t)=>/(編成|図鑑|ガチャ|交換所|ステージ|ランク戦|対戦|ホーム|キャラ|イベント)/.test(t||'');
  const candidates=[...document.querySelectorAll('button,[role="button"]')].filter(n=>n!==b&&visible(n)&&isHomeLabel((n.innerText||n.textContent||'').trim()));
  let best=null,bestScore=0;
  for(const n of candidates){let p=n.parentElement;for(let depth=0;p&&depth<5;depth++,p=p.parentElement){const bs=[...p.querySelectorAll('button,[role="button"]')].filter(x=>x!==b&&visible(x));const labels=bs.filter(x=>isHomeLabel((x.innerText||x.textContent||'').trim()));const score=labels.length*10-depth;if(labels.length>=3&&score>bestScore){best=p;bestScore=score}}}
  if(best){if(b.parentElement!==best)best.appendChild(b);b.style.display='inline-block'}else{b.style.display='none'}
 }
 const root=document.createElement('div');
 const root=document.createElement('div');root.id='kinoshitaTradeRoot';root.innerHTML=`<section id="kinoshitaTradeCard" role="dialog" aria-modal="true" aria-label="プレイヤー取引">
 <header style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><h2 style="margin:0;font-size:22px">🏪 みんなのバザー</h2><div class="kt-muted">プレイヤーとAIが出品・購入する共通市場</div></div><button id="ktClose" class="kt-secondary">閉じる</button></header>
 <div id="ktStatus" style="margin:12px 0">認証状態を確認しています…</div>
 <div id="ktBody" style="display:none">
  <div id="ktWallet" class="kt-offer"></div>
  <h3>サーバー資産変更履歴</h3><p class="kt-muted">ここにはサーバー側の取引資産が変更された記録のみ表示されます。端末内のゲーム報酬履歴ではありません。</p><div id="ktLedger"></div>
  <details class="kt-offer"><summary style="cursor:pointer;font-weight:700">アカウント引き継ぎ設定</summary>
   <p class="kt-muted">まずメールアドレスを登録して確認メールのリンクを開き、その後ゲームに戻ってもう一度ボタンを押すとパスワードを設定できます。</p>
   <label>メールアドレス<input id="ktEmail" type="email" autocomplete="email" placeholder="example@example.com"></label>
   <label>パスワード（8文字以上）<input id="ktPassword" type="password" autocomplete="new-password" minlength="8" placeholder="8文字以上"></label>
   <button id="ktLink" class="kt-primary">引き継ぎ用ログインを追加</button>
  </details>
  <h3>バザーに出品する</h3>
  <p class="kt-muted">IDやJSONの入力は不要です。サーバーで確認できる所持品から選び、渡す個数を指定してください。衣装・携帯品は重複不可のため1点単位です。ブラウザ保存データの自動取り込みは安全性のため行いません。</p>
  <p class="kt-muted">初回に現在のコイン・XP・アイテム・衣装を取引残高へ取り込みます。取引成立後は交換結果をゲーム内保存データへ反映します。ゲーム側がブラウザ保存方式のため、初回取り込みは端末データを信頼する方式であり、不正改変を完全には防げません。</p>
  <div class="kt-grid">
   <label>渡すコイン<input id="ktGiveCoins" type="number" min="0" step="1" value="0"></label><label>渡すXP<input id="ktGiveXp" type="number" min="0" step="1" value="0"></label>
   <label>求めるコイン<input id="ktWantCoins" type="number" min="0" step="1" value="0"></label><label>求めるXP<input id="ktWantXp" type="number" min="0" step="1" value="0"></label>
  </div>
  <div class="kt-grid">
   <section class="kt-offer"><h4>渡すアイテム・衣装</h4><label>所持品<select id="ktGiveAsset"></select></label><label>個数<input id="ktGiveQty" type="number" min="1" step="1" value="1"></label><button id="ktAddGive" class="kt-secondary" type="button">渡すものに追加</button><div id="ktGiveSelected"></div></section>
   <section class="kt-offer"><h4>求めるアイテム・衣装</h4><label>品目<select id="ktWantAsset"></select></label><label>個数<input id="ktWantQty" type="number" min="1" step="1" value="1"></label><button id="ktAddWant" class="kt-secondary" type="button">求めるものに追加</button><div id="ktWantSelected"></div></section>
  </div>
  <label>相手のユーザーID（空欄なら公開募集）<input id="ktBuyer" placeholder="特定の相手に限定する場合のみ"></label>
  <button id="ktCreate" class="kt-primary">出品する</button>
  <h3 style="margin-top:18px">出品の絞り込み</h3><div class="kt-filters"><label>出品者<select id="ktFilterSeller"><option value="all">すべて</option><option value="player">プレイヤー</option><option value="ai">AI</option></select></label><label>品目<select id="ktFilterType"><option value="all">すべての品目</option><option value="item">アイテム</option><option value="cosmetic">衣装・携帯品</option><option value="currency">コイン・XP</option></select></label></div>
  <h3 style="margin-top:18px">バザー出品一覧</h3><button id="ktRefresh" class="kt-secondary">更新</button><div id="ktOffers"></div>
  <details class="kt-offer"><summary style="cursor:pointer;font-weight:700">📊 アイテム・衣装・携帯品の参考価値表</summary><p class="kt-muted">表示価格はゲーム内で比較するための参考評価（木下コイン換算）です。公式固定価格や売却保証ではなく、出品者の希望価格・実際の成立価格とは異なります。相場は取引データが増えたら見直してください。</p><div id="ktValueTable"></div></details>
  <details class="kt-offer kt-help"><summary style="cursor:pointer;font-weight:700">📖 出品方法・取引の手順</summary><ol><li>「バザーに出品する」で、渡す側の所持品一覧から出品するアイテム・衣装・携帯品を選びます。IDを手入力する必要はありません。</li><li>アイテムは渡したい個数を入力して「渡すものに追加」を押します。衣装・携帯品は重複できないため1点ずつ指定します。コイン・XPも必要な分だけ入力します。</li><li>「求めるもの」側で、交換相手に希望するコイン・XP・アイテム・衣装・携帯品を選びます。何も指定しない募集は作成できません。</li><li>誰でも応募できる場合は相手のユーザーIDを空欄にします。特定の相手だけに出したい場合は、その相手のユーザーIDを入力します。</li><li>内容と参考価値を確認して「出品する」を押します。出品後は一覧に表示され、成立前なら自分の出品の「出品取消」から取り下げられます。</li><li>他のプレイヤーの出品は「条件で交換」、AIのコイン・XP販売は「購入する」から進めます。確定前に内容を確認してください。成立した取引は原則として取り消せません。</li></ol><p class="kt-muted">注意：サーバーで確認できる所持品だけが出品対象です。初回同期の端末データは完全な不正防止を保証しません。相手のユーザーIDや提示条件をよく確認してください。</p></details>
  <h3 style="margin-top:18px">取引履歴</h3><div id="ktHistory"></div>
 </div>
 </section>`;
 root.addEventListener('click',e=>{if(e.target===root)root.style.display='none'});document.body.appendChild(root);
 el('ktClose').onclick=()=>root.style.display='none';
 el('ktRefresh').onclick=()=>refresh().catch(showError);
 el('ktFilterSeller').onchange=renderOffers;el('ktFilterType').onchange=renderOffers;
 el('ktCreate').onclick=()=>createOffer().catch(showError);
 el('ktLink').onclick=()=>linkAccount().catch(showError);
}
function renderLedger(entries){
 const box=el('ktLedger');if(!box)return;
 if(!entries?.length){box.innerHTML='<p class="kt-muted">サーバー側の資産変更記録はまだありません。</p>';return}
 const labels={coins:'木下コイン',xp:'プレイヤーXP',item:'アイテム',cosmetic:'衣装・携帯品'};
 box.innerHTML=entries.map(e=>{
  const delta=Number(e.delta||0),sign=delta>0?'+':'';
  return '<article class="kt-offer"><div><b>'+esc(labels[e.asset_type]||e.asset_type)+'</b> · '+esc(e.asset_type==='item'?assetLabel('item',e.asset_id):e.asset_type==='cosmetic'?assetLabel('cosmetic',e.asset_id):e.asset_id)+'</div><div>'+esc(sign+delta.toLocaleString())+'（変更後: '+esc(Number(e.balance_after||0).toLocaleString())+'）</div><div class="kt-muted">'+esc(new Date(e.created_at).toLocaleString('ja-JP'))+' · '+esc(e.source||'server')+'</div></article>';
 }).join('');
}
function showError(e){const s=el('ktStatus');if(s)s.innerHTML='<span class="kt-error">'+esc(e?.message||e)+'</span>'}
function localGameSnapshot(){
 const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||fallback);return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}};
 const cosmeticsRaw=read('kinoshitaShinjuInventory','{}'), cosmetics={};
 for(const [id,n] of Object.entries(cosmeticsRaw))if(Number(n)>0)cosmetics[id]=1;
 return {coins:Math.max(0,Math.floor(Number(localStorage.getItem('kinoshitaGachaCoins')||0))),xp:Math.max(0,Math.floor(Number(localStorage.getItem('kinoshitaPlayerXP')||0))),items:read('kinoshitaInventoryItems','{}'),cosmetics};
}
function applyProfileToGame(p){
 if(!p)return;
 localStorage.setItem('kinoshitaGachaCoins',String(Math.max(0,Number(p.coins)||0)));
 localStorage.setItem('kinoshitaPlayerXP',String(Math.max(0,Number(p.xp)||0)));
 localStorage.setItem('kinoshitaInventoryItems',JSON.stringify(p.inventory&&typeof p.inventory==='object'?p.inventory:{}));
 localStorage.setItem('kinoshitaShinjuInventory',JSON.stringify(p.cosmetics&&typeof p.cosmetics==='object'?p.cosmetics:{}));
 if(p.updated_at)localStorage.setItem('kinoshitaTradeWalletVersion',String(p.updated_at));
}
function gameCatalog(){
 const items=profile?.inventory||{}, cosmetics=profile?.cosmetics||{};
 const defs=typeof KINOSHITA_INVENTORY_ITEM_DEFS!=='undefined'?KINOSHITA_INVENTORY_ITEM_DEFS:{};
 const allItems=Object.entries(defs).map(([id,d])=>({kind:'item',id,name:(d.emoji||'🎁')+' '+d.name,qty:Math.max(0,Math.floor(Number(items[id])||0))}));
 for(const [id,qty] of Object.entries(items))if(!allItems.some(x=>x.id===id))allItems.push({kind:'item',id,name:'🎁 アイテム名未登録（識別子: '+id+'）',qty:Math.max(0,Math.floor(Number(qty)||0))});
 let allCosmetics=[];
 try{if(typeof SHINJU_ITEMS!=='undefined')allCosmetics=SHINJU_ITEMS.map(x=>({kind:'cosmetic',id:String(x.id),name:(x.emoji||'✨')+' '+x.name+'（'+(x.rarity||'')+' '+(x.type==='costume'?'衣装':'携帯品')+'）',qty:Math.max(0,Math.floor(Number(cosmetics[x.id])||0))}))}catch{}
 return {all:[...allItems,...allCosmetics],owned:[...allItems,...allCosmetics].filter(x=>x.qty>0)};
}
function assetLabel(kind,id){return gameCatalog().all.find(x=>x.kind===kind&&x.id===id)?.name||String(id)}
function fillAssetSelect(side){
 const select=el(side==='give'?'ktGiveAsset':'ktWantAsset');if(!select)return;
 const c=gameCatalog(),rows=side==='give'?c.owned:c.all;
 select.innerHTML=rows.length?rows.map(x=>'<option value="'+esc(x.kind+':'+x.id)+'">'+esc(x.name)+(side==='give'?' · 所持 '+x.qty:'')+'</option>').join(''):'<option value="">'+(side==='give'?'渡せる所持品がありません':'品目がありません')+'</option>';
}
function renderChosen(side){
 const box=el(side==='give'?'ktGiveSelected':'ktWantSelected');if(!box)return;
 const state=chosen[side],rows=[...Object.entries(state.items).map(([id,qty])=>({kind:'item',id,qty})),...Object.entries(state.cosmetics).map(([id,qty])=>({kind:'cosmetic',id,qty}))];
 box.innerHTML=rows.length?rows.map(x=>'<div class="kt-selected-row"><span>'+esc(assetLabel(x.kind,x.id))+' × '+x.qty+'</span><button type="button" class="kt-secondary" data-remove-side="'+side+'" data-remove-kind="'+x.kind+'" data-remove-id="'+esc(x.id)+'">削除</button></div>').join(''):'<p class="kt-muted">まだ選択されていません。</p>';
 box.querySelectorAll('[data-remove-side]').forEach(b=>b.onclick=()=>{delete chosen[b.dataset.removeSide][b.dataset.removeKind==='item'?'items':'cosmetics'][b.dataset.removeId];renderChosen(side);});
}
function addSelectedAsset(side){
 const value=el(side==='give'?'ktGiveAsset':'ktWantAsset').value;if(!value)return;
 const split=value.indexOf(':'),kind=value.slice(0,split),id=value.slice(split+1);
 const qty=Number(el(side==='give'?'ktGiveQty':'ktWantQty').value);
 if(!Number.isSafeInteger(qty)||qty<1||qty>100000)throw new Error('個数は1以上100,000以下の整数にしてください。');
 const target=chosen[side][kind==='item'?'items':'cosmetics'];
 if(kind==='cosmetic'&&qty!==1)throw new Error('衣装・携帯品は重複できないため個数は1にしてください。');
 if(kind==='cosmetic'&&target[id])throw new Error('同じ衣装・携帯品は複数回追加できません。');
 const next=(target[id]||0)+qty;
 if(side==='give'){const owned=gameCatalog().owned.find(x=>x.kind===kind&&x.id===id);if(!owned||next>owned.qty)throw new Error('現在の所持数を超えて指定できません。');}
 target[id]=next;renderChosen(side);
}
function integerInput(id){const n=Number(el(id).value||0);if(!Number.isSafeInteger(n)||n<0||n>1000000000)throw new Error('コイン・XPは0以上1,000,000,000以下の整数にしてください。');return n;}
function selectedAssets(side){return {coins:integerInput(side==='give'?'ktGiveCoins':'ktWantCoins'),xp:integerInput(side==='give'?'ktGiveXp':'ktWantXp'),items:{...chosen[side].items},cosmetics:{...chosen[side].cosmetics}}}
function formatAssets(a){
 const out=[];if(Number(a?.coins||0))out.push('🪙 '+Number(a.coins).toLocaleString());if(Number(a?.xp||0))out.push('⭐ XP '+Number(a.xp).toLocaleString());
 for(const [id,n] of Object.entries(a?.items||{}))out.push(assetLabel('item',id)+' × '+n);
 for(const id of Object.keys(a?.cosmetics||{}))out.push(assetLabel('cosmetic',id));
 return out.length?out.map(esc).join('、'):'なし';
}

function cosmeticValue(id){
 const x=gameCatalog().all.find(v=>v.kind==='cosmetic'&&v.id===String(id));const rarity=String(x?.name||'').match(/(ノーマル|レア|激レア|超激レア|伝説レア)/)?.[1];
 return ({'ノーマル':500,'レア':1500,'激レア':4000,'超激レア':12000,'伝説レア':30000}[rarity]||5000);
}
function marketValue(id){
 const key=String(id).toLowerCase();
 const fixed={
  normal_gold:250,power_chest:1200,golden_chest:2400,ability_core:1800,ancient_power:900,
  latest_character_exchange_chest:30000,'rarity_gold:ノーマル':300,'rarity_gold:レア':600,
  'rarity_gold:激レア':1200,'rarity_gold:超激レア':6000,'rarity_gold:伝説レア':18000
 };
 return fixed[id]??fixed[key]??150;
}
function estimateAssets(assets){
 const a=assets&&typeof assets==='object'?assets:{};
 let total=Math.max(0,Number(a.coins)||0)+Math.max(0,Number(a.xp)||0)/20;
 for(const [id,qty] of Object.entries(a.items||{}))total+=marketValue(id)*Math.max(0,Number(qty)||0);
 for(const [id,owned] of Object.entries(a.cosmetics||{}))if(owned===true||Number(owned)>0)total+=5000;
 return Math.round(total);
}
function renderHistory(){
 const box=el('ktHistory');if(!box)return;
 if(!history.length){box.innerHTML='<p class="kt-muted">完了した取引はまだありません。</p>';return}
 box.innerHTML=history.map(h=>{
  const mine=h.seller_id===session?.user?.id;
  const give=mine?h.offered_assets:h.requested_assets;
  const receive=mine?h.requested_assets:h.offered_assets;
  return '<article class="kt-offer"><div><b>'+esc(new Date(h.completed_at).toLocaleString('ja-JP'))+'</b> · '+(mine?'自分が募集':'自分が承諾')+'</div><div class="kt-muted">受け渡し: '+formatAssets(give||{})+'（目安 '+estimateAssets(give||{}).toLocaleString()+'）</div><div class="kt-muted">受取: '+formatAssets(receive||{})+'（目安 '+estimateAssets(receive||{}).toLocaleString()+'）</div><div class="kt-muted">募集ID: '+esc(String(h.offer_id||'').slice(0,8))+'</div></article>'
 }).join('');
}
function renderValueTable(){
 const box=el('ktValueTable');if(!box)return;const c=gameCatalog();
 const rows=c.all.slice().sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(x=>({name:x.name,kind:x.kind,value:x.kind==='item'?marketValue(x.id):cosmeticValue(x.id)}));
 box.innerHTML=rows.length?rows.map(x=>'<div class="kt-value-row"><span>'+esc(x.name)+'<span class="kt-muted"> · '+(x.kind==='item'?'アイテム':'衣装・携帯品')+'</span></span><b>'+Number(x.value).toLocaleString()+' コイン相当</b></div>').join(''):'<p class="kt-muted">現在のカタログを読み込めませんでした。</p>';
}
function offerMatches(o){
 const seller=el('ktFilterSeller')?.value||'all',type=el('ktFilterType')?.value||'all';
 if(seller==='ai'&&o.seller_type!=='ai')return false;if(seller==='player'&&o.seller_type==='ai')return false;
 if(type==='all')return true;const assets=[o.offered_assets||{},o.requested_assets||{}];
 if(type==='item')return assets.some(a=>Object.keys(a.items||{}).length>0);
 if(type==='cosmetic')return assets.some(a=>Object.keys(a.cosmetics||{}).length>0);
 if(type==='currency')return assets.some(a=>Number(a.coins||0)>0||Number(a.xp||0)>0);
 return true;
}
function renderOffers(){
 const box=el('ktOffers');if(!box)return;const visibleOffers=offers.filter(offerMatches);
 if(!visibleOffers.length){box.innerHTML='<p class="kt-muted">選択した条件に一致する出品はありません。</p>';return}
 box.innerHTML=visibleOffers.map(o=>{
  const isAI=o.seller_type==='ai';
  const mine=!isAI&&o.seller_id===session?.user?.id;
  const canAccept=!isAI&&!mine&&(!o.buyer_id||o.buyer_id===session?.user?.id);
  const priceOnly=Number(o.requested_assets?.coins||0)>0||Number(o.requested_assets?.xp||0)>0;
  const button=isAI
   ? (priceOnly?'<button class="kt-primary" data-buy-ai="'+esc(o.id)+'">購入する</button>':'<span class="kt-muted">交換不可</span>')
   : (canAccept?'<button class="kt-primary" data-accept="'+esc(o.id)+'">条件で交換</button>':'');
  return '<article class="kt-offer"><div><b>'+(isAI?'🤖 AIバザー':'📦 プレイヤー出品')+'</b> · '+esc(o.id.slice(0,8))+' · '+esc(new Date(o.created_at).toLocaleString('ja-JP'))+'</div><div class="kt-muted">出品者: '+esc(isAI?(o.seller_name||('AI '+o.seller_ai_id)):o.seller_id)+(o.buyer_id?' · 指定相手あり':' · 公開出品')+'</div><div class="kt-muted">出品: '+formatAssets(o.offered_assets)+' · 参考評価 '+estimateAssets(o.offered_assets).toLocaleString()+'</div><div class="kt-muted">希望: '+formatAssets(o.requested_assets)+' · 参考評価 '+estimateAssets(o.requested_assets).toLocaleString()+'</div><div style="display:flex;gap:8px;margin-top:8px">'+button+(mine?'<button class="kt-secondary" data-cancel="'+esc(o.id)+'">出品取消</button>':'')+'</div></article>'
 }).join('');
 box.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{try{if(!confirm('この条件で取引を確定しますか？確定後は取り消せません。'))return;await api('accept',{offer_id:b.dataset.accept});const wallet=await api('profile',{display_name:localStorage.getItem('kinoshitaPlayerName')||'プレイヤー'});applyProfileToGame(wallet.profile);el('ktStatus').innerHTML='<span class="kt-good">取引成立。ゲーム内の所持数を更新しています…</span>';setTimeout(()=>location.reload(),250)}catch(e){showError(e)}});
 box.querySelectorAll('[data-buy-ai]').forEach(b=>b.onclick=async()=>{try{if(!confirm('AIの出品を購入しますか？コイン・XPを消費します。'))return;await api('buy_ai_offer',{offer_id:b.dataset.buyAi});const wallet=await api('profile',{display_name:localStorage.getItem('kinoshitaPlayerName')||'プレイヤー'});applyProfileToGame(wallet.profile);el('ktStatus').innerHTML='<span class="kt-good">購入成立。ゲーム内所持品を更新しています…</span>';setTimeout(()=>location.reload(),250)}catch(e){showError(e)}});
 box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{try{await api('cancel',{offer_id:b.dataset.cancel});await refresh()}catch(e){showError(e)}});
}
async function refresh(){
 if(busy)return;busy=true;
 try{
  el('ktStatus').textContent='認証と取引情報を確認しています…';
  const name=localStorage.getItem('kinoshitaPlayerName')||localStorage.getItem('kinoshitaPlayerDisplayName')||'プレイヤー';
  const d=await api('profile',{display_name:name});
  profile=d.profile;
  const synced=await api('sync_wallet',{snapshot:localGameSnapshot()});
  profile=synced.profile||profile;
  const appliedVersion=localStorage.getItem('kinoshitaTradeWalletVersion');
  if(synced.imported||!appliedVersion||(profile?.updated_at&&String(profile.updated_at)!==appliedVersion)) applyProfileToGame(profile);
  fillAssetSelect('give');fillAssetSelect('want');renderChosen('give');renderChosen('want');
  const list=await api('list');offers=[...(list.offers||[]),...(list.ai_offers||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const completed=await api('history');history=completed.history||[];
  el('ktStatus').innerHTML='<span class="kt-good">匿名ログイン済み</span> · ユーザーID: <code>'+esc(session.user?.id||'')+'</code>';
  el('ktBody').style.display='block';
  el('ktWallet').innerHTML='<b>サーバー所持状況（取引の正本）</b><div>コイン: '+Number(profile.coins||0).toLocaleString()+' · XP: '+Number(profile.xp||0).toLocaleString()+'</div><div class="kt-muted">アイテム: '+formatAssets({items:profile.inventory||{}})+'</div><div class="kt-muted">衣装・携帯品: '+formatAssets({cosmetics:profile.cosmetics||{}})+'</div><p class="kt-error">初回同期でゲーム内所持品を取り込み、取引後はサーバーの所持数をゲーム内保存データへ反映します。</p>';
  renderOffers();renderValueTable();
  const ledger=await api('ledger');renderLedger(ledger.entries||[]);
   renderHistory();
 }finally{busy=false}
}
async function createOffer(){
 const offered=selectedAssets('give');
  const requested=selectedAssets('want');
  if(!offered.coins&&!offered.xp&&!Object.keys(offered.items).length&&!Object.keys(offered.cosmetics).length)throw new Error('渡すものを1つ以上選んでください。');
  if(!requested.coins&&!requested.xp&&!Object.keys(requested.items).length&&!Object.keys(requested.cosmetics).length)throw new Error('求めるものを1つ以上選んでください。');
 const buyer=el('ktBuyer').value.trim();
 await api('create_offer',{offered_assets:offered,requested_assets:requested,buyer_id:buyer||null});
 el('ktStatus').innerHTML='<span class="kt-good">募集を作成しました。</span>';
 await refresh();
}
async function linkAccount(){
 const email=el('ktEmail').value.trim(),password=el('ktPassword').value;
 await ensureSession();
 const headers={apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
 const ur=await fetch(BASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}});
 const user=await ur.json().catch(()=>({}));
 if(!ur.ok)throw new Error(user.msg||user.message||user.error_description||'アカウント状態を確認できませんでした');
 if(user.email_confirmed_at){
  if(password.length<8)throw new Error('パスワードは8文字以上で入力してください');
  const r=await fetch(BASE+'/auth/v1/user',{method:'PUT',headers,body:JSON.stringify({password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.msg||d.message||d.error_description||'パスワード設定に失敗しました');
  el('ktStatus').innerHTML='<span class="kt-good">パスワードを設定しました。メールアドレスとこのパスワードで引き継ぎできます。</span>';
  el('ktPassword').value='';
  return;
 }
 if(!email)throw new Error('先にメールアドレスを入力してください');
 const r=await fetch(BASE+'/auth/v1/user',{method:'PUT',headers,body:JSON.stringify({email})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.msg||d.message||d.error_description||'確認メールの送信に失敗しました');
 el('ktStatus').innerHTML='<span class="kt-good">確認メールを送信しました。メール内のリンクで確認を完了し、このゲームに戻ってから、もう一度このボタンを押してパスワードを設定してください。</span>';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();
 const watchHome=()=>{const b=el('kinoshitaTradeHomeButton');if(b&&b.isConnected){const visible=(n)=>!!(n&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none');const match=t=>/(編成|図鑑|ガチャ|交換所|ステージ|ランク戦|対戦|ホーム|キャラ|イベント)/.test(t||'');const nodes=[...document.querySelectorAll('button,[role="button"]')].filter(n=>n!==b&&visible(n)&&match((n.innerText||n.textContent||'').trim()));let best=null,score=0;for(const n of nodes){let p=n.parentElement;for(let d=0;p&&d<5;d++,p=p.parentElement){const bs=[...p.querySelectorAll('button,[role="button"]')].filter(x=>x!==b&&visible(x));const count=bs.filter(x=>match((x.innerText||x.textContent||'').trim())).length;const s=count*10-d;if(count>=3&&s>score){best=p;score=s}}}if(best){if(b.parentElement!==best)best.appendChild(b);b.style.display='inline-block'}else b.style.display='none'}};
 const observer=new MutationObserver(watchHome);observer.observe(document.documentElement,{childList:true,subtree:true});watchHome();
})();