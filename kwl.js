(()=>{'use strict';
if(window.__KWL_BOOTED)return;window.__KWL_BOOTED=true;
const API='https://jhohdvuoyvbzwjumnibc.supabase.co/rest/v1';
const KEY='sb_publishable_bofrXTgGnFd-s52JoE2OnQ_75sLT_Jg';
const TOURNAMENT='kwl-2026-01';
const headers=extra=>Object.assign({apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},extra||{});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
let root=null,teams=[],matches=[],tournament=null,refreshTimer=null,selectedMatch=null,matchDetail={games:[],players:[],locks:[],events:[]};
const ACTIVE_KEY='kwl-active-series-v1';
function activeSeries(){try{return JSON.parse(sessionStorage.getItem(ACTIVE_KEY)||'null')}catch(_){return null}}
function setActiveSeries(v){try{if(v)sessionStorage.setItem(ACTIVE_KEY,JSON.stringify(v));else sessionStorage.removeItem(ACTIVE_KEY)}catch(_){}}
function rpc(name,body){return request('/rpc/'+name,{method:'POST',body:JSON.stringify(body)});}
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
 document.body.appendChild(root);root.querySelector('#kwlClose').onclick=()=>{root.style.display='none';if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}const start=document.getElementById('start');if(start)start.style.display='flex';};
 return root;
}
async function request(path,opts){const r=await fetch(API+path,Object.assign({headers:headers(),cache:'no-store'},opts||{}));const body=await r.json().catch(()=>null);if(!r.ok)throw new Error(body?.message||body?.details||'通信エラー HTTP '+r.status);return body;}
async function open(){const start=document.getElementById('start');if(start)start.style.display='none';const s=shell();s.style.display='block';if(typeof loadMyAlliance==='function')await loadMyAlliance();await refresh();if(!refreshTimer)refreshTimer=setInterval(()=>{if(root?.style.display==='block')refresh();},60000);}
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
 else if(String(alliance.owner_id)!==String(playerRankingId))html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー操作は同盟リーダーのみ行えます。</div>';
 else if(now<opens)html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー開始までお待ちください。</div>';
 else if(now>closes)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">エントリー期間は終了しました。</div>';
 else if(teams.length>=10)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">参加上限10チームに達しました。</div>';
 else html+='<div style="padding:12px;border-radius:10px;background:#1e293b"><b>'+esc(alliance.name)+'</b><p style="font-size:13px;color:#cbd5e1">同盟メンバーの先頭から最大10人を登録します。5人以上必要です。</p><button id="kwlRegister" class="formationBtn" style="background:#b45309;color:white">この同盟でエントリーする</button></div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">参加チーム</h2>';
 html+=teams.length?teams.map((t,i)=>'<div style="padding:9px 11px;margin:5px 0;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;gap:8px"><b>'+(i+1)+'. '+esc(t.alliance_name)+'</b><span style="color:#cbd5e1;font-size:12px">'+(t.roster||[]).length+'選手</span></div>').join(''):'<div style="color:#cbd5e1">まだエントリーはありません。</div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">トーナメント</h2>';
 if(typeof playerRankingId!=='undefined'&&String(playerRankingId)==='cd19b245-1a70-45de-9bb7-967f6c568425'&&Date.now()>=new Date(tournament.bracket_draw_at).getTime()&&!matches.length)html+='<button id="kwlDraw" class="formationBtn" style="background:#b45309;color:white">組み合わせ抽選を実行</button>';
 html+=matches.length?matches.map(m=>'<button data-kwl-match="'+m.id+'" style="display:block;width:100%;text-align:left;padding:10px;margin:5px 0;background:#1e293b;color:#fff;border:1px solid #64748b;border-radius:8px"><b>ラウンド '+m.round_number+' / 試合 '+m.match_number+'</b><div style="font-size:13px;margin-top:5px">'+esc(teamName(m.team1_id))+'　VS　'+esc(teamName(m.team2_id))+'</div><small style="color:#cbd5e1">'+esc(m.status)+'　'+Number(m.team1_wins||0)+' - '+Number(m.team2_wins||0)+'</small></button>').join(''):'<div style="color:#cbd5e1">抽選結果は11月20日に公開します。</div>';
 html+='<div id="kwlMatchDetail" style="margin-top:12px"></div>';
 html+='<p style="font-size:12px;color:#cbd5e1;margin-top:18px">※大会の対戦はBO5。1カード内で同じ選手は再出場できません。各チーム5人以上の登録が必要です。</p>';
 c.innerHTML=html;
 const btn=c.querySelector('#kwlRegister');if(btn)btn.onclick=register;const draw=c.querySelector('#kwlDraw');if(draw)draw.onclick=drawBracket;
 c.querySelectorAll('[data-kwl-match]').forEach(x=>x.onclick=()=>loadMatchDetail(Number(x.dataset.kwlMatch)));
}
async function drawBracket(){if(!confirm('最大10チームの組み合わせ抽選を確定します。AI同盟も空き枠に参加します。続行しますか？'))return;const b=root.querySelector('#kwlDraw');if(b){b.disabled=true;b.textContent='抽選中…';}try{await request('/rpc/kwl_draw_bracket',{method:'POST',headers:headers(),body:JSON.stringify({p_actor_id:String(playerRankingId)})});await refresh();alert('KWLのトーナメント表を確定しました。');}catch(e){alert('抽選できませんでした：'+e.message);if(b){b.disabled=false;b.textContent='組み合わせ抽選を実行';}}}
function teamName(id){if(!id)return 'BYE（シード）';return teams.find(t=>Number(t.id)===Number(id))?.alliance_name||'対戦相手未定';}
async function loadMatchDetail(id){
 selectedMatch=matches.find(x=>Number(x.id)===Number(id));const box=root?.querySelector('#kwlMatchDetail');if(!selectedMatch||!box)return;
 box.innerHTML='<div style="padding:12px;background:#0f172a;border-radius:10px">BO5情報を読み込み中…</div>';
 try{const q='?select=*&match_id=eq.'+id;const [games,players,locks,events]=await Promise.all([
 request('/kwl_games'+q+'&order=game_number.asc'),request('/kwl_game_players'+q+'&order=game_number.asc'),request('/kwl_character_locks'+q+'&order=first_game_number.asc'),request('/kwl_live_events'+q+'&order=id.desc&limit=30')
 ]);matchDetail={games,players,locks,events};renderMatchDetail();}catch(e){box.innerHTML='<div style="padding:12px;background:#7f1d1d;border-radius:10px">BO5情報を取得できません：'+esc(e.message)+'</div>';}
}
function renderMatchDetail(){
 const box=root?.querySelector('#kwlMatchDetail'),m=selectedMatch;if(!box||!m)return;
 const alliance=(typeof myAlliance!=='undefined'?myAlliance:null),mine=teams.find(t=>Number(t.alliance_id)===Number(alliance?.id));
 const myTeamId=Number(mine?.id||0),isInMatch=myTeamId&&(myTeamId===Number(m.team1_id)||myTeamId===Number(m.team2_id));
 const roster=mine?.roster||[];const opts=roster.map((p,i)=>'<option value="'+i+'">'+esc(p.name||p.id)+' ('+(p.type==='ai'?'AI':'選手')+')</option>').join('');
 const games=matchDetail.games||[],players=matchDetail.players||[],locks=matchDetail.locks||[],events=matchDetail.events||[];
 let h='<section style="padding:12px;background:#0f172acc;border:1px solid #64748b;border-radius:12px"><h3 style="margin:0 0 8px">BO5シリーズ管理</h3><div>'+esc(teamName(m.team1_id))+' '+Number(m.team1_wins||0)+' - '+Number(m.team2_wins||0)+' '+esc(teamName(m.team2_id))+'</div>';
 h+='<div style="margin:8px 0;font-size:12px;color:#cbd5e1">各試合で別の選手が出場。シリーズ中、同じチームが一度出撃させたキャラクターは再使用できません。</div>';
 for(let n=1;n<=5;n++){const g=games.find(x=>Number(x.game_number)===n),ps=players.filter(x=>Number(x.game_number)===n);h+='<div style="padding:8px;margin:5px 0;background:#1e293b;border-radius:8px"><b>第'+n+'試合</b> · '+esc(g?.status||'未登録')+'<div style="font-size:12px">'+(ps.map(p=>esc(teamName(p.team_id))+'：'+esc(p.player_name)).join(' / ')||'出場選手未登録')+'</div></div>';}
 if(isInMatch&&m.status!=='completed'){
  h+='<div style="margin-top:10px;padding:10px;background:#172554;border-radius:8px"><b>出場選手登録</b><select id="kwlPlayerSelect" style="width:100%;padding:10px;margin:7px 0;color:#111">'+opts+'</select><button id="kwlClaimPlayer" class="formationBtn" style="width:100%;background:#b45309;color:#fff">この選手で次の試合に出場登録</button><p style="font-size:11px;color:#cbd5e1">登録後は既存の対人戦ルームで相手と接続してください。試合終了時に勝敗を記録します。</p><button id="kwlOpenPvp" class="formationBtn" style="width:100%">⚔️ 対人戦ルームを開く</button></div>';
 }else if(!isInMatch)h+='<div style="padding:9px;background:#334155;border-radius:8px">自分の同盟チームが出場するカードではありません。</div>';
 h+='<h4 style="margin:12px 0 5px">チーム別使用禁止キャラクター</h4>';
 for(const tid of [m.team1_id,m.team2_id]){const ls=locks.filter(x=>Number(x.team_id)===Number(tid));h+='<div style="font-size:12px;margin:4px 0"><b>'+esc(teamName(tid))+'：</b>'+(ls.map(x=>esc(x.character_key)+'（第'+x.first_game_number+'試合）').join('、')||'まだ使用なし')+'</div>';}
 h+='<h4 style="margin:12px 0 5px">ライブ実況・試合ログ</h4><div id="kwlEventList" style="max-height:190px;overflow:auto;background:#111827;padding:8px;border-radius:8px">'+(events.length?events.slice().reverse().map(e=>'<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #334155"><b>'+esc(e.player_name||e.event_type)+'</b> '+esc(e.message)+'</div>').join(''):'<div style="color:#94a3b8;font-size:12px">まだイベントはありません。</div>')+'</div>';
 h+='<button id="kwlRefreshDetail" class="formationBtn" style="width:100%;margin-top:8px">実況・試合状況を更新</button>';
 h+='</section>';box.innerHTML=h;
 const claim=box.querySelector('#kwlClaimPlayer');if(claim)claim.onclick=async()=>{const p=roster[Number(box.querySelector('#kwlPlayerSelect').value)];if(!p)return;claim.disabled=true;try{const result=await rpc('kwl_claim_game_player',{p_match_id:Number(m.id),p_team_id:myTeamId,p_player_id:String(p.id),p_player_type:String(p.type||'player'),p_player_name:String(p.name||p.id)});const row=Array.isArray(result)?result[0]:result;setActiveSeries({matchId:Number(m.id),teamId:myTeamId,opponentTeamId:Number(myTeamId)===Number(m.team1_id)?Number(m.team2_id):Number(m.team1_id),gameNumber:Number(row.game_number),playerId:String(p.id),playerType:String(p.type||'player'),playerName:String(p.name||p.id),locked:[]});alert('第'+row.game_number+'試合の出場選手として登録しました。');await loadMatchDetail(m.id);}catch(e){alert('出場登録できません：'+e.message);claim.disabled=false;}};
 const openBtn=box.querySelector('#kwlOpenPvp');if(openBtn)openBtn.onclick=()=>{if(typeof openPvp==='function')openPvp();else alert('対人戦画面を開けません。');};
 const ref=box.querySelector('#kwlRefreshDetail');if(ref)ref.onclick=()=>loadMatchDetail(m.id);
}
function patchBattleHooks(){
 if(typeof window.deploy==='function'&&!window.deploy.__kwlWrapped){const original=window.deploy;const wrapped=function(i){const a=activeSeries();if(!a||!window.pvpMode)return original.apply(this,arguments);const card=window.cards?.[i],key=String(card?.name||'');if(!key)return original.apply(this,arguments);if((a.locked||[]).includes(key)){alert(key+' はこのBO5シリーズですでに使用済みです。');return;}rpc('kwl_lock_character',{p_match_id:a.matchId,p_game_number:a.gameNumber,p_team_id:a.teamId,p_player_id:a.playerId,p_player_type:a.playerType,p_character_key:key}).then(()=>{const next=activeSeries();if(!next||next.matchId!==a.matchId)return;next.locked=[...(next.locked||[]),key];setActiveSeries(next);original.call(this,i);}).catch(e=>alert('キャラクター使用を登録できません：'+e.message));};wrapped.__kwlWrapped=true;window.deploy=wrapped;}
 if(typeof window.pvpFinish==='function'&&!window.pvpFinish.__kwlWrapped){const original=window.pvpFinish;const wrapped=function(opponentWon){const a=activeSeries();const result=original.apply(this,arguments);if(a){const winner=opponentWon?a.opponentTeamId:a.teamId;rpc('kwl_record_game_result',{p_match_id:a.matchId,p_game_number:a.gameNumber,p_winner_team_id:winner,p_reporter_id:a.playerId}).then(r=>{const row=Array.isArray(r)?r[0]:r;setActiveSeries(null);alert('KWL第'+a.gameNumber+'試合の結果を記録しました。\n'+row.team1_wins+' - '+row.team2_wins+(row.series_completed?'\nシリーズ決着！':'\n次の試合の出場選手を登録してください。'));}).catch(e=>alert('KWL結果を記録できませんでした：'+e.message));}return result;};wrapped.__kwlWrapped=true;window.pvpFinish=wrapped;}
}

async function register(){
 const b=root.querySelector('#kwlRegister');if(!b)return;
 if(typeof playerRankingId==='undefined'||!playerRankingId||typeof myAlliance==='undefined'||!myAlliance)return alert('プレイヤー・同盟情報を確認できません。');
 if(!confirm('同盟の先頭から最大10人をKWL登録選手としてエントリーします。よろしいですか？'))return;
 b.disabled=true;b.textContent='エントリー中…';
 try{await request('/rpc/kwl_register_team',{method:'POST',headers:headers(),body:JSON.stringify({p_player_id:String(playerRankingId),p_alliance_id:Number(myAlliance.id)})});await refresh();alert('KWLへのエントリーが完了しました。');}
 catch(e){alert('エントリーできませんでした：'+e.message);b.disabled=false;b.textContent='この同盟でエントリーする';}
}
function boot(){ensureButton();patchBattleHooks();const start=document.getElementById('start');if(start&&!start.__kwlObserver){start.__kwlObserver=new MutationObserver(()=>{ensureButton();patchBattleHooks();});start.__kwlObserver.observe(start,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
