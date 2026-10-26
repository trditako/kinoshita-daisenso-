(() => {
'use strict';
const BASE='https://jhohdvuoyvbzwjumnibc.supabase.co';
const KEY='sb_publishable_bofrXTgGnFd-s52JoE2OnQ_75sLT_Jg';
const SESSION_KEY='kinoshitaTradeAuthSession';
const el=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null, profile=null, offers=[], busy=false;
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
 #kinoshitaTradeLaunch{position:fixed;right:12px;bottom:86px;z-index:9990;background:#5b21b6;color:#fff;border:2px solid #c4b5fd;border-radius:999px;padding:11px 15px;font-weight:800;box-shadow:0 4px 16px #0008}
 #kinoshitaTradeRoot{display:none;position:fixed;inset:0;z-index:9991;background:#000b;align-items:center;justify-content:center;padding:12px;font:14px system-ui,sans-serif;color:#f8fafc}
 #kinoshitaTradeCard{width:min(720px,100%);max-height:92dvh;overflow:auto;background:#111827;border:1px solid #6d28d9;border-radius:16px;padding:16px;box-sizing:border-box}
 #kinoshitaTradeCard input,#kinoshitaTradeCard textarea{box-sizing:border-box;width:100%;padding:9px;margin:4px 0 9px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff}
 #kinoshitaTradeCard button{cursor:pointer;border:0;border-radius:8px;padding:9px 12px;font-weight:700}
 .kt-primary{background:#7c3aed;color:white}.kt-secondary{background:#334155;color:white}.kt-offer{border:1px solid #475569;border-radius:10px;padding:10px;margin:8px 0;background:#1f2937}
 .kt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kt-muted{color:#cbd5e1;font-size:12px}.kt-error{color:#fca5a5}.kt-good{color:#86efac}
 @media(max-width:480px){.kt-grid{grid-template-columns:1fr}#kinoshitaTradeLaunch{bottom:76px}}
 `;
 document.head.appendChild(style);
 const b=document.createElement('button');b.id='kinoshitaTradeLaunch';b.textContent='🔁 取引';b.onclick=()=>{el('kinoshitaTradeRoot').style.display='flex';refresh().catch(showError)};document.body.appendChild(b);
 const root=document.createElement('div');root.id='kinoshitaTradeRoot';root.innerHTML=`<section id="kinoshitaTradeCard" role="dialog" aria-modal="true" aria-label="プレイヤー取引">
 <header style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><h2 style="margin:0;font-size:22px">🔁 プレイヤー取引</h2><div class="kt-muted">認証済みの取引・サーバー側所持確認</div></div><button id="ktClose" class="kt-secondary">閉じる</button></header>
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
  <h3>取引を募集する</h3>
  <p class="kt-muted">アイテム・携帯品・衣装IDはサーバー所持品に登録済みのものだけ取引できます。現段階では端末内データを自動で所持品として登録しません。</p>
  <div class="kt-grid">
   <label>渡すコイン<input id="ktGiveCoins" type="number" min="0" value="0"></label><label>渡すXP<input id="ktGiveXp" type="number" min="0" value="0"></label>
   <label>求めるコイン<input id="ktWantCoins" type="number" min="0" value="0"></label><label>求めるXP<input id="ktWantXp" type="number" min="0" value="0"></label>
  </div>
  <div class="kt-grid"><label>渡すアイテム（JSON）<textarea id="ktGiveItems" rows="2" placeholder='{"item_id":1}'>{}</textarea></label><label>求めるアイテム（JSON）<textarea id="ktWantItems" rows="2" placeholder='{"item_id":1}'>{}</textarea></label></div>
  <div class="kt-grid"><label>渡す衣装・携帯品ID（JSON）<textarea id="ktGiveCos" rows="2" placeholder='{"cosmetic_id":1}'>{}</textarea></label><label>求める衣装・携帯品ID（JSON）<textarea id="ktWantCos" rows="2" placeholder='{"cosmetic_id":1}'>{}</textarea></label></div>
  <label>相手のユーザーID（空欄なら公開募集）<input id="ktBuyer" placeholder="特定の相手に限定する場合のみ"></label>
  <button id="ktCreate" class="kt-primary">取引募集を作成</button>
  <h3 style="margin-top:18px">募集中の取引</h3><button id="ktRefresh" class="kt-secondary">更新</button><div id="ktOffers"></div>
 </div>
 </section>`;
 root.addEventListener('click',e=>{if(e.target===root)root.style.display='none'});document.body.appendChild(root);
 el('ktClose').onclick=()=>root.style.display='none';
 el('ktRefresh').onclick=()=>refresh().catch(showError);
 el('ktCreate').onclick=()=>createOffer().catch(showError);
 el('ktLink').onclick=()=>linkAccount().catch(showError);
}
function renderLedger(entries){
 const box=el('ktLedger');if(!box)return;
 if(!entries?.length){box.innerHTML='<p class="kt-muted">サーバー側の資産変更記録はまだありません。</p>';return}
 const labels={coins:'木下コイン',xp:'プレイヤーXP',item:'アイテム',cosmetic:'衣装・携帯品'};
 box.innerHTML=entries.map(e=>{
  const delta=Number(e.delta||0),sign=delta>0?'+':'';
  return '<article class="kt-offer"><div><b>'+esc(labels[e.asset_type]||e.asset_type)+'</b> · '+esc(e.asset_id)+'</div><div>'+esc(sign+delta.toLocaleString())+'（変更後: '+esc(Number(e.balance_after||0).toLocaleString())+'）</div><div class="kt-muted">'+esc(new Date(e.created_at).toLocaleString('ja-JP'))+' · '+esc(e.source||'server')+'</div></article>';
 }).join('');
}
function showError(e){const s=el('ktStatus');if(s)s.innerHTML='<span class="kt-error">'+esc(e?.message||e)+'</span>'}
function parseJson(id){let v;try{v=JSON.parse(el(id).value||'{}')}catch{throw new Error('アイテム欄は正しいJSONで入力してください')}if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('アイテム欄はJSONオブジェクトで入力してください');return v}
function renderOffers(){
 const box=el('ktOffers');if(!box)return;
 if(!offers.length){box.innerHTML='<p class="kt-muted">現在、募集中の取引はありません。</p>';return}
 box.innerHTML=offers.map(o=>{
  const mine=o.seller_id===session?.user?.id;
  const canAccept=!mine&&(!o.buyer_id||o.buyer_id===session?.user?.id);
  return '<article class="kt-offer"><div><b>募集 '+esc(o.id.slice(0,8))+'</b> · '+esc(new Date(o.created_at).toLocaleString('ja-JP'))+'</div><div class="kt-muted">渡す: '+esc(JSON.stringify(o.offered_assets))+'</div><div class="kt-muted">求める: '+esc(JSON.stringify(o.requested_assets))+'</div><div class="kt-muted">募集者ID: '+esc(o.seller_id)+(o.buyer_id?' · 指定相手あり':' · 公開募集')+'</div><div style="display:flex;gap:8px;margin-top:8px">'+(canAccept?'<button class="kt-primary" data-accept="'+esc(o.id)+'">条件を承諾</button>':'')+(mine?'<button class="kt-secondary" data-cancel="'+esc(o.id)+'">募集取消</button>':'')+'</div></article>'
 }).join('');
 box.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{try{if(!confirm('この条件で取引を確定しますか？確定後は取り消せません。'))return;await api('accept',{offer_id:b.dataset.accept});await refresh()}catch(e){showError(e)}});
 box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{try{await api('cancel',{offer_id:b.dataset.cancel});await refresh()}catch(e){showError(e)}});
}
async function refresh(){
 if(busy)return;busy=true;
 try{
  el('ktStatus').textContent='認証と取引情報を確認しています…';
  const name=localStorage.getItem('kinoshitaPlayerName')||localStorage.getItem('kinoshitaPlayerDisplayName')||'プレイヤー';
  const playerId=localStorage.getItem('kinoshitaPlayerRankingId')||null;
  const d=await api('profile',{display_name:name,player_id:playerId});
  profile=d.profile;
  const list=await api('list');offers=list.offers||[];
  const ledger=await api('ledger');renderLedger(ledger.entries||[]);
  el('ktStatus').innerHTML='<span class="kt-good">匿名ログイン済み</span> · ユーザーID: <code>'+esc(session.user?.id||'')+'</code>';
  el('ktBody').style.display='block';
  el('ktWallet').innerHTML='<b>サーバー所持状況</b><div>コイン: '+Number(profile.coins||0).toLocaleString()+' · XP: '+Number(profile.xp||0).toLocaleString()+'</div><div class="kt-muted">アイテム: '+esc(JSON.stringify(profile.inventory||{}))+'</div><div class="kt-muted">衣装・携帯品: '+esc(JSON.stringify(profile.cosmetics||{}))+'</div>';
  renderOffers();
 }finally{busy=false}
}
async function createOffer(){
 const offered={coins:Number(el('ktGiveCoins').value||0),xp:Number(el('ktGiveXp').value||0),items:parseJson('ktGiveItems'),cosmetics:parseJson('ktGiveCos')};
 const requested={coins:Number(el('ktWantCoins').value||0),xp:Number(el('ktWantXp').value||0),items:parseJson('ktWantItems'),cosmetics:parseJson('ktWantCos')};
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
})();