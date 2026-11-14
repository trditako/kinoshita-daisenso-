(()=>{'use strict';
if(window.__KWL_BOOTED)return;window.__KWL_BOOTED=true;
const API='https://jhohdvuoyvbzwjumnibc.supabase.co/rest/v1';
const KEY='sb_publishable_bofrXTgGnFd-s52JoE2OnQ_75sLT_Jg';
const TOURNAMENT='kwl-2026-01';
const headers=extra=>Object.assign({apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},extra||{});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
let root=null,teams=[],matches=[],tournament=null;
function ensureButton(){
 const start=document.getElementById('start');if(!start||document.getElementById('kwlOpenBtn'))return;
 const b=document.createElement('button');b.id='kwlOpenBtn';b.className='formationBtn';b.textContent='🏆 木下ワールドリーグ（KWL）';b.style.cssText='background:linear-gradient(100deg,#172554,#854d0e)!important;color:#fff!important;border:2px solid #facc15!important';
 const alliance=document.getElementById('allianceBtn');if(alliance?.parentNode)alliance.parentNode.insertBefore(b,alliance.nextSibling);else start.querySelector('.panel')?.appendChild(b);
 b.addEventListener('click',open);
}
function shell(){
 if(root)return root;
 root=document.createElement('section');root.id='kwlScreen';root.style.cssText='position:fixed;inset:0;z-index:10050;display:none;overflow:auto;background:linear-gradient(145deg,#0b1225,#172554 55%,#3b260d);color:#fff;padding:12px;font-family:system-ui,"Noto Sans JP",sans-serif';
 root.innerHTML='<div style="max-width:900px;margin:0 auto"><header style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><div style="font-size:12px;color:#facc15;font-weight:900;letter-spacing:2px">KINOSHITA WORLD LEAGUE</div><h1 style="margin:4px 0;font-size:26px">🏆 木下ワールドリーグ</h1><div style="font-size:12px;color:#cbd5e1">第1回大会 / 2026</div></div><button id="kwlClose" class="formationBtn">ゲームへ戻る</button></header><div id="kwlContent" style="margin-top:14px"></div></div>';
 document.body.appendChild(root);root.querySelector('#kwlClose').onclick=()=>{root.style.display='none';const start=document.getElementById('start');if(start)start.style.display='flex';};
 return root;
}
async function request(path,opts){const r=await fetch(API+path,Object.assign({headers:headers(),cache:'no-store'},opts||{}));const body=await r.json().catch(()=>null);if(!r.ok)throw new Error(body?.message||body?.details||'通信エラー HTTP '+r.status);return body;}
async function open(){const start=document.getElementById('start');if(start)start.style.display='none';const s=shell();s.style.display='block';await refresh();}
async function refresh(){
 const c=root.querySelector('#kwlContent');c.innerHTML='<p style="text-align:center;padding:30px">大会情報を読み込んでいます…</p>';
 try{
  [tournament,teams,matches]=await Promise.all([
   request('/kwl_tournaments?select=*&tournament_key=eq.'+TOURNAMENT).then(x=>x[0]),
   request('/kwl_teams?select=*&tournament_key=eq.'+TOURNAMENT+'&order=created_at.asc'),
   request('/kwl_matches?select=*&tournament_key=eq.'+TOURNAMENT+'&order=round_number.asc,match_number.asc')
  ]);
  render();
 }catch(e){c.innerHTML='<div style="background:#7f1d1d;padding:14px;border-radius:10px">大会情報を取得できませんでした。<br>'+esc(e.message)+'<br><button id="kwlRetry" class="formationBtn">再読み込み</button></div>';c.querySelector('#kwlRetry').onclick=refresh;}
}
function render(){
 const c=root.querySelector('#kwlContent');if(!tournament){c.innerHTML='<p>大会データがまだ準備されていません。</p>';return;}
 const now=Date.now(),opens=new Date(tournament.entry_opens_at).getTime(),closes=new Date(tournament.entry_closes_at).getTime();
 const alliance=(typeof myAlliance!=='undefined'?myAlliance:null);
 const mine=teams.find(t=>Number(t.alliance_id)===Number(alliance?.id));
 let html='<div style="padding:14px;border:1px solid #64748b;border-radius:14px;background:#0f172acc"><div style="font-size:12px;color:#facc15">第1回大会 日程</div><div style="font-size:20px;font-weight:1000;margin:5px 0">11/21（土）13:30 開幕</div><div style="font-size:13px;color:#cbd5e1">エントリー：11/17 00:00 ～ 11/19 23:59（日本時間）</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span>参加 '+teams.length+'/10チーム</span><span>BO5</span><span>トーナメント方式</span></div></div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">エントリー</h2>';
 if(mine)html+='<div style="padding:12px;border-radius:10px;background:#14532d">✅ '+esc(mine.alliance_name)+' はエントリー済みです。登録選手：'+(mine.roster||[]).length+'人</div>';
 else if(!alliance)html+='<div style="padding:12px;border-radius:10px;background:#334155">大会に参加するには同盟への所属が必要です。同盟リーダーのみエントリーできます。</div>';
 else if(String(alliance.owner_id)!==String(window.playerRankingId))html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー操作は同盟リーダーのみ行えます。</div>';
 else if(now<opens)html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー開始までお待ちください。</div>';
 else if(now>closes)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">エントリー期間は終了しました。</div>';
 else if(teams.length>=10)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">参加上限10チームに達しました。</div>';
 else html+='<div style="padding:12px;border-radius:10px;background:#1e293b"><b>'+esc(alliance.name)+'</b><p style="font-size:13px;color:#cbd5e1">同盟メンバーの先頭から最大10人を登録します。5人以上必要です。</p><button id="kwlRegister" class="formationBtn" style="background:#b45309;color:white">この同盟でエントリーする</button></div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">参加チーム</h2>';
 html+=teams.length?teams.map((t,i)=>'<div style="padding:9px 11px;margin:5px 0;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;gap:8px"><b>'+(i+1)+'. '+esc(t.alliance_name)+'</b><span style="color:#cbd5e1;font-size:12px">'+(t.roster||[]).length+'選手</span></div>').join(''):'<div style="color:#cbd5e1">まだエントリーはありません。</div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">トーナメント</h2>';
 html+=matches.length?matches.map(m=>'<div style="padding:10px;margin:5px 0;background:#1e293b;border-radius:8px"><b>ラウンド '+m.round_number+' / 試合 '+m.match_number+'</b><div style="font-size:13px;margin-top:5px">'+esc(teamName(m.team1_id))+'　VS　'+esc(teamName(m.team2_id))+'</div><small style="color:#cbd5e1">'+esc(m.status)+'</small></div>').join(''):'<div style="color:#cbd5e1">抽選結果は11月20日に公開します。</div>';
 html+='<p style="font-size:12px;color:#cbd5e1;margin-top:18px">※大会の対戦はBO5。1カード内で同じ選手は再出場できません。各チーム5人以上の登録が必要です。</p>';
 c.innerHTML=html;
 const btn=c.querySelector('#kwlRegister');if(btn)btn.onclick=register;
}
function teamName(id){if(!id)return 'BYE（シード）';return teams.find(t=>Number(t.id)===Number(id))?.alliance_name||'対戦相手未定';}
async function register(){
 const b=root.querySelector('#kwlRegister');if(!b)return;
 if(typeof playerRankingId==='undefined'||!playerRankingId||typeof myAlliance==='undefined'||!myAlliance)return alert('プレイヤー・同盟情報を確認できません。');
 if(!confirm('同盟の先頭から最大10人をKWL登録選手としてエントリーします。よろしいですか？'))return;
 b.disabled=true;b.textContent='エントリー中…';
 try{await request('/rpc/kwl_register_team',{method:'POST',headers:headers(),body:JSON.stringify({p_player_id:String(playerRankingId),p_alliance_id:Number(myAlliance.id)})});await refresh();alert('KWLへのエントリーが完了しました。');}
 catch(e){alert('エントリーできませんでした：'+e.message);b.disabled=false;b.textContent='この同盟でエントリーする';}
}
function boot(){ensureButton();const start=document.getElementById('start');if(start&&!start.__kwlObserver){start.__kwlObserver=new MutationObserver(ensureButton);start.__kwlObserver.observe(start,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
