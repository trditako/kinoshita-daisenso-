(()=>{'use strict';
// KWL local rehearsal: browser-only BO5 flow; no production RPC result writes.
// Rehearsal result handling intentionally bypasses the regular reward-bearing result handler.
if(window.__KWL_BOOTED)return;window.__KWL_BOOTED=true;
const API='https://jhohdvuoyvbzwjumnibc.supabase.co/rest/v1';
const KEY='sb_publishable_bofrXTgGnFd-s52JoE2OnQ_75sLT_Jg';
const TOURNAMENT='kwl-2026-01';
const headers=extra=>Object.assign({apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},extra||{});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
let root=null,teams=[],matches=[],tournament=null,refreshTimer=null,broadcastTimer=null,countdownTimer=null,selectedMatch=null,matchDetail={games:[],players:[],locks:[],events:[]},broadcastEvents=[];
const ACTIVE_KEY='kwl-active-series-v1';
let kwlAiBattleActive=false,kwlAiBattleContext=null;
function activeSeries(){try{return JSON.parse(sessionStorage.getItem(ACTIVE_KEY)||'null')}catch(_){return null}}
function setActiveSeries(v){try{if(v)sessionStorage.setItem(ACTIVE_KEY,JSON.stringify(v));else sessionStorage.removeItem(ACTIVE_KEY)}catch(_){}try{window.KinoshitaEquipment?.useTournamentLoadout?.(v?.equipmentSnapshot??null)}catch(_){}}
function rpc(name,body){return request('/rpc/'+name,{method:'POST',body:JSON.stringify(body)});}
function kwlIsOperator(){return typeof playerRankingId!=='undefined'&&String(playerRankingId)==='cd19b245-1a70-45de-9bb7-967f6c568425';}
function equipmentSummary(snapshot){if(!snapshot||typeof snapshot!=='object')return '未登録';const rows=Object.entries(snapshot).filter(([,ids])=>Array.isArray(ids)&&ids.length).map(([name,ids])=>esc(name)+'：'+ids.map(esc).join('・'));return rows.length?rows.join(' / '):'装備なし';}
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
 document.body.appendChild(root);root.querySelector('#kwlClose').onclick=()=>{root.style.display='none';if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}if(broadcastTimer){clearInterval(broadcastTimer);broadcastTimer=null;}if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}const start=document.getElementById('start');if(start)start.style.display='flex';};
 return root;
}
async function request(path,opts){const r=await fetch(API+path,Object.assign({headers:headers(),cache:'no-store'},opts||{}));const body=await r.json().catch(()=>null);if(!r.ok)throw new Error(body?.message||body?.details||'通信エラー HTTP '+r.status);return body;}
async function open(){const start=document.getElementById('start');if(start)start.style.display='none';const s=shell();s.style.display='block';if(typeof loadMyAlliance==='function')await loadMyAlliance();await refresh();if(!refreshTimer)refreshTimer=setInterval(()=>{if(root?.style.display==='block')refresh();},60000);if(!broadcastTimer)broadcastTimer=setInterval(()=>{if(root?.style.display==='block')refreshBroadcast();},15000);if(!countdownTimer)countdownTimer=setInterval(()=>{if(root?.style.display==='block')updateCountdown();},1000);}
async function refresh(){
 const c=root.querySelector('#kwlContent');c.innerHTML='<p style="text-align:center;padding:30px">大会情報を読み込んでいます…</p>';
 try{
  [tournament,teams,matches]=await Promise.all([
   request('/kwl_tournaments?select=*&tournament_key=eq.'+TOURNAMENT).then(x=>x[0]),
   request('/kwl_teams?select=*&tournament_key=eq.'+TOURNAMENT+'&order=created_at.asc'),
   request('/kwl_matches?select=*&tournament_key=eq.'+TOURNAMENT+'&order=round_number.asc,match_number.asc')
  ]);
  render();await refreshBroadcast();
 }catch(e){c.innerHTML='<div style="background:#7f1d1d;padding:14px;border-radius:10px">大会情報を取得できませんでした。<br>'+esc(e.message)+'<br><button id="kwlRetry" class="formationBtn">再読み込み</button></div>';c.querySelector('#kwlRetry').onclick=refresh;}
}
function countdownLabel(target,now){const ms=Math.max(0,target-now),d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000),sec=Math.floor(ms%60000/1000);return d+'日 '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
function updateCountdown(){updateMatchPhaseCountdown();const el=root?.querySelector('#kwlCountdown');if(!el||!tournament)return;const now=Date.now(),opens=new Date(tournament.entry_opens_at).getTime(),closes=new Date(tournament.entry_closes_at).getTime(),draw=new Date(tournament.bracket_draw_at).getTime(),starts=new Date(tournament.starts_at).getTime();let label,target;if(now<opens){label='エントリー開始まで';target=opens;}else if(now<closes){label='エントリー締切まで';target=closes;}else if(now<draw){label='組み合わせ抽選まで';target=draw;}else if(now<starts){label='大会開幕まで';target=starts;}else{el.textContent='大会開催期間です';return;}el.textContent=label+'：'+countdownLabel(target,now);}
function roundLabel(round,maxRound){const left=maxRound-Number(round);if(left===0)return '決勝';if(left===1)return '準決勝';if(left===2)return '準々決勝';return '第'+round+'回戦';}
const KWL_GUIDE_ENTRIES=[
{id:102,name:'覇風',role:'編成支援',importance:'高',when:'URを複数採用する編成で、味方全体を支える枠。',strength:'UR数に応じた全体強化。過去の調整方針は1体につき+35%、最大+95%。射程・再生産時間は対象外。',caution:'旧仕様の+75%/体・最大+450%を前提にしない。'},
{id:103,name:'MiraiK',role:'固有スキル・特殊相互作用',importance:'要検証',when:'固有スキルの発動条件が合う対面で採用候補。',strength:'固有スキルと編成時バフ表示が過去に調整対象。',caution:'最新のスキル条件・数値を確認して評価する。'},
{id:115,name:'ノヴァ木下',role:'特殊相互作用',importance:'高',when:'神話キャラを含む編成など、固有の相互作用が重要な対面で候補。',strength:'味方バフによる攻撃力・攻撃間隔の上昇を受けない仕様。神話キャラ編成時のデバフ条件がある。',caution:'通常のバフ前提で火力計算しない。'},
{id:116,name:'創世木下',role:'万能型切り札',importance:'高',when:'重要なカードで切り札として使う候補。1体制限を踏まえ投入タイミングを計画する。',strength:'特別なUR。37種類の能力を持つと過去に共有された。',caution:'各能力の発動条件と対策を確認する。'},
{id:117,name:'創世討伐兵器・零式',role:'特殊能力枠',importance:'要検証',when:'固有能力の対象が相手編成に含まれる場合に採用を検討。',strength:'創世神話関連の特殊キャラクター。',caution:'カウンター対象・発動条件の最新データが必要。'},
{id:118,name:'ヒットマン木下',role:'高レア・固有スキル枠',importance:'要検証',when:'スキル内容と相手編成が噛み合うカードで採用候補。',strength:'神話編全48ステージクリア報酬の伝説レア。固有スキルを持つ。',caution:'希少性だけで強さを判断しない。'},
{id:119,name:'アイスワイバーン',role:'氷属性・範囲妨害',importance:'高',when:'敵の進軍を止めたい場面や、氷エリアを活かせる対面で候補。',strength:'飛行モード、アイスエリア、冷凍ビームを持つ氷属性キャラ。',caution:'飛行中の移動・エリア生成・冷凍ビームの挙動を確認する。'},
{id:120,name:'最高神:ゼウス',role:'範囲制圧・雷撃',importance:'高',when:'指定範囲への雷撃で複数位置を制圧したい対面で候補。',strength:'雷撃そのものが攻撃。指定範囲に雷が落ちる仕様を目指して調整された。',caution:'カメラ位置ではなく戦場上の指定範囲に落ちるか確認する。'},
{id:121,name:'最高神:ハスター',role:'触手・妨害',importance:'高',when:'触手による攻撃・妨害を活かせる対面で候補。',strength:'触手ギミックを持つ。味方版の触手位置やバフ表示が調整対象になった。',caution:'触手の出現位置・攻撃対象・バフ表示を確認する。'},
{id:101,name:'狂乱の強化木下',role:'イベント報酬・固有スキル枠',importance:'要検証',when:'固有スキルと相手の編成が噛み合う場合に採用候補。',strength:'狂乱シリーズのイベント報酬。固有スキルを持つ。',caution:'最新ステータスとスキル詳細の確認が必要。'},
{id:104,name:'狂乱のマッチョ木下',role:'イベント報酬・固有スキル枠',importance:'要検証',when:'固有スキルの効果が有効な対面で採用候補。',strength:'狂乱シリーズのイベント報酬。固有スキルを持つ。',caution:'ボス性能と味方性能を混同せず、味方版の実数値で評価する。'}
];
function kwlGuideMarkup(){return '<section style="margin-top:16px;padding:13px;border:1px solid #38bdf8;border-radius:13px;background:linear-gradient(135deg,#082f49,#172554)"><div style="font-size:11px;letter-spacing:2px;color:#7dd3fc;font-weight:900">KWL STRATEGY GUIDE</div><h2 style="margin:4px 0 6px;font-size:20px">📘 KWL攻略図鑑</h2><p style="font-size:12px;color:#dbeafe;line-height:1.7;margin:0 0 9px">過去の調整・仕様相談から、戦術上の注目キャラを掲載。評価は暫定で、強さランキングや勝率を断定するものではありません。未確認の数値は記載せず、実戦データが集まり次第更新します。</p><input id="kwlGuideSearch" type="search" placeholder="キャラ名・役割で検索" style="box-sizing:border-box;width:100%;padding:10px;border-radius:8px;border:1px solid #64748b;color:#111"><div id="kwlGuideList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px"></div><div style="font-size:10px;color:#bfdbfe;margin-top:8px">重要度「高」は戦術への影響が大きいと考えられる枠、「要検証」は実性能・発動条件の確認が必要な枠です。強さの順位ではありません。</div></section>';}
function kwlRenderGuide(filter){const list=root?.querySelector('#kwlGuideList');if(!list)return;const q=String(filter||'').trim().toLocaleLowerCase();const rows=KWL_GUIDE_ENTRIES.filter(x=>(x.name+' '+x.role+' '+x.when+' '+x.strength).toLocaleLowerCase().includes(q));list.innerHTML=rows.map(x=>'<article style="padding:10px;background:#0f172acc;border:1px solid #475569;border-radius:9px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><b>'+esc(x.name)+'</b><span style="font-size:10px;padding:3px 6px;border-radius:6px;background:'+(x.importance==='高'?'#854d0e':'#334155')+'">'+esc(x.importance)+'</span></div><div style="font-size:11px;color:#7dd3fc;margin:4px 0">'+esc(x.role)+'</div><div style="font-size:12px;line-height:1.6"><b>採用場面：</b>'+esc(x.when)+'</div><div style="font-size:12px;line-height:1.6;margin-top:4px"><b>特徴：</b>'+esc(x.strength)+'</div><div style="font-size:12px;line-height:1.6;margin-top:4px;color:#fcd34d"><b>注意点：</b>'+esc(x.caution)+'</div><div style="font-size:10px;color:#94a3b8;margin-top:5px">図鑑ID：'+x.id+'</div></article>').join('')||'<div style="font-size:12px;color:#cbd5e1">該当するキャラクターはありません。</div>';}
function render(){
 const c=root.querySelector('#kwlContent');if(!tournament){c.innerHTML='<p>大会データがまだ準備されていません。</p>';return;}
 const now=Date.now(),opens=new Date(tournament.entry_opens_at).getTime(),closes=new Date(tournament.entry_closes_at).getTime();
 const operator=kwlIsOperator();
 const alliance=(typeof myAlliance!=='undefined'?myAlliance:null);
 const mine=teams.find(t=>Number(t.alliance_id)===Number(alliance?.id));
 const entryRoster=Array.isArray(alliance?.members)?alliance.members.slice(0,10).map(p=>({id:String(p.id||''),name:String(p.name||p.id||''),type:String(p.type||'player')})).filter(p=>p.id):[];
 const entryOptionMarkup=entryRoster.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'（'+(p.type==='ai'?'AI':'プレイヤー')+'）</option>').join('');
 const dateLabel=value=>new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});\n let html='<div style="padding:14px;border:1px solid #64748b;border-radius:14px;background:#0f172acc"><div style="font-size:12px;color:#facc15">第1回大会 日程</div><div style="font-size:20px;font-weight:1000;margin:5px 0">'+esc(dateLabel(tournament.starts_at))+' 開幕</div><div style="font-size:13px;color:#cbd5e1">エントリー：'+esc(dateLabel(tournament.entry_opens_at))+' ～ '+esc(dateLabel(tournament.entry_closes_at))+'（日本時間）</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span>参加 '+teams.length+'/10チーム</span><span>BO5</span><span>トーナメント方式</span></div></div>';
 html+='<div style="margin-top:10px;padding:12px;border:1px solid #f59e0b;border-radius:10px;background:#451a03"><div id="kwlCountdown" style="font-size:18px;font-weight:900;color:#fde68a">日程を確認中…</div><div style="font-size:11px;color:#fed7aa;margin-top:4px">すべて日本時間（JST）</div></div>';
 if(tournament.status==='paused')html+='<div style="margin-top:10px;padding:12px;border:2px solid #ef4444;border-radius:10px;background:#450a0a;color:#fee2e2"><b>⛔ 大会は運営により緊急停止中です</b><div style="font-size:12px;margin-top:4px">大会の進行・出場登録・試合結果の確定を一時停止しています。再開までお待ちください。</div>'+(tournament.pause_reason?'<div style="font-size:12px;margin-top:5px">停止理由：'+esc(tournament.pause_reason)+'</div>':'')+'</div>';
 if(operator)html+='<section style="margin-top:12px;padding:12px;border:2px solid #f59e0b;border-radius:12px;background:#3f1d0b"><div style="font-weight:1000;color:#fde68a">🛠 大会運営専用・緊急管理</div><div style="font-size:12px;color:#fed7aa;margin:5px 0 9px">現在の状態：'+(tournament.status==='paused'?'緊急停止中':'稼働中（'+esc(tournament.status)+'）')+'</div>'+(tournament.status==='paused'?'<button id="kwlEmergencyResume" class="formationBtn" style="width:100%;background:#166534;color:#fff">▶ 大会を再開する</button>':'<input id="kwlPauseReason" maxlength="120" placeholder="停止理由（任意・120文字以内）" style="box-sizing:border-box;width:100%;padding:9px;border-radius:7px;margin-bottom:7px;color:#111"><button id="kwlEmergencyStop" class="formationBtn" style="width:100%;background:#b91c1c;color:#fff;border:1px solid #fecaca">⛔ 大会を緊急停止する</button>')+'<div style="font-size:11px;color:#fed7aa;margin-top:7px">停止しても大会データ・対戦表・確定済みの勝敗は削除されません。再開すると停止前の状態に戻ります。</div></section>';

 html+='<div style="margin-top:12px;padding:12px;background:#1e293b;border-radius:10px"><button id="kwlRulesToggle" class="formationBtn" style="width:100%">📖 大会ルール・日程を確認する ▼</button><div id="kwlRules" hidden style="padding:10px 2px 0;font-size:13px;line-height:1.8;color:#e2e8f0"><b style="color:#facc15">大会日程</b><br>エントリー開始：'+esc(date(tournament.entry_opens_at))+'<br>エントリー締切：'+esc(date(tournament.entry_closes_at))+'<br>組み合わせ抽選：'+esc(date(tournament.bracket_draw_at))+'<br>大会開始：'+esc(date(tournament.starts_at))+'<br><br><b style="color:#facc15">参加ルール</b><br>・参加上限は10チーム。<br>・登録選手は1チーム5〜10人。<br>・エントリー操作は同盟リーダーが行います。<br>・トーナメントはシングルエリミネーション方式。<br>・各カードはBO5（先に3勝したチームが勝利）。<br>・エントリー時に第1〜第5試合の出場予定選手を5名決め、残りの登録選手は補欠になります。<br>・確定後の出場順変更は運営承認が必要です。<br>・1シリーズ内で同じ選手は2回出場できません。<br>・同じチームがシリーズ中に使用したキャラクターは、チームメイトも再使用できません。<br>・試合結果と進行状況は大会記録に従います。</div></div>';
 if(operator)html+='<section style="margin-top:14px;padding:14px;border:2px solid #38bdf8;border-radius:12px;background:linear-gradient(130deg,#082f49,#172554)"><div style="font-size:11px;color:#7dd3fc;font-weight:900;letter-spacing:2px">LOCAL REHEARSAL / NO REWARDS</div><h2 style="font-size:19px;margin:4px 0 7px">🧪 無料・報酬なしのリハーサル</h2><p style="font-size:12px;color:#dbeafe;line-height:1.7;margin:4px 0 10px">リハーサル試合の登録・結果送信は本番KWLのデータベースに行わず、ブラウザ内だけで進行します。実際のバトルエンジンでBO5を行い、結果はこのタブ内だけに記録します。コイン・XP・報酬・ランキング・戦績は更新しません。</p><div style="font-size:12px;color:#bfdbfe;margin-bottom:8px">対戦：運営テストチーム VS テストAIチーム ／ 3勝先取（最大5試合）</div><button id="kwlStartRehearsal" class="formationBtn" style="width:100%;background:#0369a1;color:#fff;border:1px solid #7dd3fc">🧪 リハーサルを開始する</button><div style="font-size:10px;color:#bae6fd;margin-top:7px">ステージ：'+esc((typeof currentStage==='function'&&currentStage()?.name)||'日本編 第1章 1ステージ')+'（現在選択中のステージ）</div></section>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">エントリー</h2>';
 if(tournament.status==='paused'&&!mine)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">大会は緊急停止中のため、新規エントリーを受け付けていません。</div>';
 else if(mine)html+='<div style="padding:12px;border-radius:10px;background:#14532d">✅ '+esc(mine.alliance_name)+' はエントリー済みです。登録選手：'+(mine.roster||[]).length+'人'+(Array.isArray(mine.match_lineup)&&mine.match_lineup.length===5?'<div style="margin-top:8px;font-size:12px;color:#dcfce7"><b>確定済みの出場順</b><br>'+mine.match_lineup.slice().sort((a,b)=>Number(a.game_number)-Number(b.game_number)).map(p=>'第'+Number(p.game_number)+'試合：'+esc(p.player_name||p.player_id)+(String(p.player_type)==='ai'?'（AI）':'')).join('<br>')+'</div><div style="margin-top:6px;font-size:11px;color:#bbf7d0">補欠：'+(mine.roster||[]).filter(p=>!mine.match_lineup.some(x=>String(x.player_id)===String(p.id)&&String(x.player_type||'player')===String(p.type||'player'))).map(p=>esc(p.name||p.id)).join('、')+'</div>':'<div style="margin-top:6px;font-size:11px">旧方式の登録です。次回大会から出場順をエントリー時に確定します。</div>')+'</div>';
 else if(!alliance)html+='<div style="padding:12px;border-radius:10px;background:#334155">大会に参加するには同盟への所属が必要です。同盟リーダーのみエントリーできます。</div>';
 else if(String(alliance.owner_id)!==String(playerRankingId))html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー操作は同盟リーダーのみ行えます。</div>';
 else if(now<opens)html+='<div style="padding:12px;border-radius:10px;background:#334155">エントリー開始までお待ちください。</div>';
 else if(now>closes)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">エントリー期間は終了しました。</div>';
 else if(teams.length>=10)html+='<div style="padding:12px;border-radius:10px;background:#7f1d1d">参加上限10チームに達しました。</div>';
 else html+='<div style="padding:12px;border-radius:10px;background:#1e293b"><b>'+esc(alliance.name)+'</b><p style="font-size:13px;color:#cbd5e1">同盟メンバーの先頭から最大10人を登録します。第1〜第5試合の出場予定選手をここで5人選択してください。残りの登録メンバーは補欠になります。</p>'
 +Array.from({length:5},(_,i)=>'<label style="display:block;margin:8px 0;font-size:12px">第'+(i+1)+'試合の出場選手<select id="kwlStarter'+(i+1)+'" style="display:block;width:100%;padding:9px;margin-top:4px;color:#111"><option value="">選手を選択してください</option>'+entryOptionMarkup+'</select></label>').join('')
 +'<button id="kwlRegister" class="formationBtn" style="background:#b45309;color:white">出場順を確定してエントリー</button></div>';
 html+='<h2 style="font-size:18px;margin:18px 0 8px">参加チーム</h2>';
 html+=teams.length?teams.map((t,i)=>'<div style="padding:9px 11px;margin:5px 0;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;gap:8px"><b>'+(i+1)+'. '+esc(t.alliance_name)+'</b><span style="color:#cbd5e1;font-size:12px">'+(t.roster||[]).length+'選手</span></div>').join(''):'<div style="color:#cbd5e1">まだエントリーはありません。</div>';
 html+=kwlGuideMarkup();
  html+='<section id="kwlBracketSection" style="margin-top:14px;padding:14px;border:2px solid #facc15;border-radius:14px;background:linear-gradient(145deg,#172554,#0f172a);box-shadow:0 8px 24px #0006"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><div style="font-size:11px;color:#fde68a;font-weight:900;letter-spacing:2px">OFFICIAL TOURNAMENT BRACKET</div><h2 style="font-size:21px;margin:3px 0">🏆 第1回大会 トーナメント表</h2></div><span style="font-size:11px;color:#bfdbfe">'+matches.length+'カード / '+teams.length+'チーム</span></div><p style="font-size:12px;color:#cbd5e1;margin:5px 0 10px">左右にスクロールすると全ラウンドを確認できます。カードをタップすると試合詳細を開きます。</p>';
 if(operator&&tournament.status!=='paused'&&Date.now()>=new Date(tournament.bracket_draw_at).getTime()&&!matches.length)html+='<button id="kwlDraw" class="formationBtn" style="background:#b45309;color:white">組み合わせ抽選を実行</button>';
 if(matches.length){const maxRound=Math.max(...matches.map(m=>Number(m.round_number)||1)),grouped={};matches.forEach(m=>(grouped[m.round_number]||(grouped[m.round_number]=[])).push(m));const roundKeys=Object.keys(grouped).sort((a,b)=>Number(a)-Number(b));html+='<div style="display:flex;gap:12px;overflow-x:auto;padding:6px 2px 14px;align-items:flex-start;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch">'+roundKeys.map(r=>'<div style="min-width:235px;max-width:280px;flex:1 0 235px;scroll-snap-align:start"><div style="position:sticky;top:0;font-weight:900;color:#facc15;margin:4px 0 8px;padding:7px 9px;background:#0f172af2;border:1px solid #475569;border-radius:8px">'+roundLabel(r,maxRound)+'</div>'+grouped[r].sort((a,b)=>Number(a.match_number)-Number(b.match_number)).map(m=>{const bye=!m.team2_id||String(m.status)==='bye',status=String(m.status||'pending'),statusText=bye?'不戦勝':status==='completed'?'試合終了':status==='live'?'試合中':status==='ready'?'対戦可能':'対戦待ち',mineTeam=mine&&(Number(m.team1_id)===Number(mine.id)||Number(m.team2_id)===Number(mine.id)),border=status==='completed'?'#22c55e':status==='live'?'#f97316':mineTeam?'#facc15':'#64748b';return '<button data-kwl-match="'+m.id+'" style="display:block;width:100%;text-align:left;padding:10px;margin:7px 0;background:#1e293b;color:#fff;border:2px solid '+border+';border-radius:10px;box-shadow:0 3px 10px #0004"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><b style="font-size:12px">試合 '+m.match_number+'</b><small style="color:'+(bye?'#86efac':status==='live'?'#fdba74':'#cbd5e1')+'">'+statusText+'</small></div><div style="font-size:12px;margin-top:8px;padding:7px;background:#0f172a;border-radius:6px;line-height:1.5"><b>'+esc(teamName(m.team1_id))+'</b><div style="color:#facc15;font-weight:900;margin-top:2px">'+Number(m.team1_wins||0)+' 勝</div></div><div style="font-size:12px;margin-top:5px;padding:7px;background:#0f172a;border-radius:6px;line-height:1.5"><b>'+esc(teamName(m.team2_id))+'</b><div style="color:#facc15;font-weight:900;margin-top:2px">'+Number(m.team2_wins||0)+' 勝</div></div>'+(bye?'<div style="font-size:10px;color:#86efac;margin-top:6px">相手チームなし・次のラウンドへ進出</div>':'')+'</button>';}).join('')+'</div>').join('')+'</div>';}else html+='<div style="padding:14px;background:#0f172a;border-radius:9px;color:#cbd5e1">抽選結果はまだ公開されていません。</div>';
 html+='</section>';
 html+='<section style="margin-top:16px;padding:14px;border:1px solid #facc15;border-radius:14px;background:linear-gradient(120deg,#111827,#1e3a8a)"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><div style="font-size:11px;color:#facc15;font-weight:900;letter-spacing:2px">KWL LIVE BROADCAST</div><h2 style="font-size:20px;margin:3px 0">📡 大会配信・観戦</h2></div><span style="font-size:11px;color:#bfdbfe">15秒ごとに更新</span></div><p style="font-size:12px;color:#cbd5e1;margin:4px 0 10px">全対戦カードのスコア、出場選手、キャラクター使用履歴、実況イベントを確認できます。</p><div id="kwlBroadcast"><div style="color:#cbd5e1">配信データを読み込み中…</div></div></section>'; html+='<div id="kwlMatchDetail" style="margin-top:12px"></div>';
 html+='<p style="font-size:12px;color:#cbd5e1;margin-top:18px">※大会の対戦はBO5。1カード内で同じ選手は再出場できません。各チーム5人以上の登録が必要です。</p>';
 c.innerHTML=html;
 const guideSearch=c.querySelector('#kwlGuideSearch');if(guideSearch){kwlRenderGuide('');guideSearch.addEventListener('input',()=>kwlRenderGuide(guideSearch.value));}const rulesToggle=c.querySelector('#kwlRulesToggle');if(rulesToggle)rulesToggle.onclick=()=>{const panel=c.querySelector('#kwlRules');panel.hidden=!panel.hidden;rulesToggle.textContent=panel.hidden?'📖 大会ルール・日程を確認する ▼':'📖 大会ルール・日程を閉じる ▲';};updateCountdown();const btn=c.querySelector('#kwlRegister');if(btn)btn.onclick=register;const draw=c.querySelector('#kwlDraw');if(draw)draw.onclick=drawBracket;const rehearsal=c.querySelector('#kwlStartRehearsal');if(rehearsal)rehearsal.onclick=kwlRehearsalStart;const stop=c.querySelector('#kwlEmergencyStop');if(stop)stop.onclick=()=>setTournamentPaused(true);const resume=c.querySelector('#kwlEmergencyResume');if(resume)resume.onclick=()=>setTournamentPaused(false);
 c.querySelectorAll('[data-kwl-match]').forEach(x=>x.onclick=()=>loadMatchDetail(Number(x.dataset.kwlMatch)));
}
async function refreshBroadcast(){
 const box=root?.querySelector('#kwlBroadcast');if(!box||!tournament)return;
 try{
  broadcastEvents=await request('/kwl_live_events?select=*&tournament_key=eq.'+TOURNAMENT+'&order=id.desc&limit=80');
  const active=matches.filter(m=>['live','ready'].includes(String(m.status)));
  const cards=active.length?active.map(m=>'<button data-kwl-live-match="'+m.id+'" style="width:100%;text-align:left;padding:10px;margin:4px 0;border:1px solid #475569;border-radius:9px;background:#0f172a;color:#fff"><b>'+esc(teamName(m.team1_id))+'　'+Number(m.team1_wins||0)+' - '+Number(m.team2_wins||0)+'　'+esc(teamName(m.team2_id))+'</b><div style="font-size:11px;color:#93c5fd">R'+m.round_number+' / Match '+m.match_number+' · '+esc(m.status)+'</div></button>').join(''):'<div style="padding:9px;background:#0f172a;border-radius:8px;color:#cbd5e1;font-size:12px">現在進行中の対戦はありません。大会開始後、ここにライブ対戦が表示されます。</div>';
  const feed=broadcastEvents.slice(0,24).map(e=>{const m=matches.find(x=>Number(x.id)===Number(e.match_id));return '<div style="padding:7px 3px;border-bottom:1px solid #334155;font-size:12px"><div style="display:flex;justify-content:space-between;gap:6px"><b style="color:'+(e.event_type==='score'?'#facc15':e.event_type==='commentary'?'#93c5fd':'#e2e8f0')+'">'+esc(e.player_name||({score:'試合結果',deployment:'出撃',system:'システム',commentary:'実況',battle_start:'試合開始',battle_end:'試合終了'}[e.event_type]||'KWL'))+'</b><span style="color:#94a3b8">'+date(e.created_at)+'</span></div><div>'+esc(e.message)+'</div><div style="color:#94a3b8;font-size:10px">'+(m?'R'+m.round_number+' / Match '+m.match_number:'大会イベント')+'</div></div>';}).join('');
  box.innerHTML='<h3 style="font-size:13px;margin:10px 0 5px">🔴 ライブ対戦</h3>'+cards+'<h3 style="font-size:13px;margin:12px 0 5px">🎙️ 実況・プレイバイプレイ</h3><div style="max-height:260px;overflow:auto;padding:7px;background:#020617;border-radius:8px">'+(feed||'<div style="font-size:12px;color:#94a3b8">実況イベントはまだありません。</div>')+'</div><button id="kwlBroadcastRefresh" class="formationBtn" style="width:100%;margin-top:8px">配信情報を更新</button>';
  box.querySelectorAll('[data-kwl-live-match]').forEach(b=>b.onclick=()=>{loadMatchDetail(Number(b.dataset.kwlLiveMatch));root.querySelector('#kwlMatchDetail')?.scrollIntoView({behavior:'smooth',block:'start'});});
  box.querySelector('#kwlBroadcastRefresh').onclick=refreshBroadcast;
 }catch(e){box.innerHTML='<div style="font-size:12px;color:#fecaca">配信情報を取得できません：'+esc(e.message)+'</div>';}
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

const KWL_PHASE_LABELS={intro:'チーム紹介',draft:'選手選択・編成',live:'試合中',result:'結果発表',break:'ラウンド間休憩'};
function kwlPresentation(m){return m?.live_state?.presentation||{};}
function kwlPhaseMarkup(m,operator){
 const p=kwlPresentation(m),phase=String(p.phase||'pending'),names=[m.team1_id,m.team2_id].map(id=>{
  const t=teams.find(x=>Number(x.id)===Number(id));
  const members=(t?.roster||[]).map(x=>esc(x.name||x.id)).filter(Boolean);
  return '<div style="padding:8px;background:#0f172a;border-radius:7px;margin-top:5px"><b>'+esc(teamName(id))+'</b><div style="font-size:11px;color:#cbd5e1;margin-top:3px">'+(members.length?members.join(' ・ '):'登録選手情報なし')+'</div></div>';
 }).join('');
 let controls='';
 if(operator){
  if(phase==='pending')controls='<button data-kwl-phase="intro" class="formationBtn" style="width:100%;background:#92400e;color:#fff">▶ チーム紹介を開始（1分）</button>';
  else if(phase==='intro')controls='<button data-kwl-phase="draft" class="formationBtn" style="width:100%;background:#1d4ed8;color:#fff">選手選択・編成へ（1分30秒）</button>';
  else if(phase==='draft')controls='<button data-kwl-phase="draft" class="formationBtn" style="width:100%;background:#1d4ed8;color:#fff">選手選択・編成を90秒延長</button><button data-kwl-phase="live" class="formationBtn" style="width:100%;margin-top:6px;background:#166534;color:#fff">⚔️ 試合開始（両チーム登録後）</button>';
  else if(phase==='result')controls='<button data-kwl-phase="break" class="formationBtn" style="width:100%;background:#475569;color:#fff">次ラウンドまで休憩（5分）</button>';
 }
 const label=phase==='pending'?'運営開始待ち':(KWL_PHASE_LABELS[phase]||'進行状況未設定');
 const remaining=p.phase_ends_at?Math.max(0,Math.ceil((new Date(p.phase_ends_at).getTime()-Date.now())/1000)):null;
 const time=remaining===null?'':remaining===0?'時間終了・運営の次操作待ち':'残り '+Math.floor(remaining/60)+'分'+String(remaining%60).padStart(2,'0')+'秒';
 return '<section style="margin-top:10px;padding:11px;border:1px solid #facc15;border-radius:10px;background:#172554"><div style="font-size:11px;color:#fde68a;font-weight:900;letter-spacing:1px">MATCH PRESENTATION</div><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:4px"><b>'+label+'</b><span id="kwlPhaseCountdown" style="font-size:12px;color:#fde68a">'+time+'</span></div><div style="font-size:11px;color:#cbd5e1;margin-top:5px">チーム紹介は60秒、選手選択・編成は90秒。試合・結果・休憩は運営操作で進行します。</div>'+names+(phase==='break'?'<div style="font-size:11px;color:#86efac;margin-top:7px">休憩中です。次の対戦カードを選択し、次ラウンドの開始時にチーム紹介を開始してください。</div>':'')+(controls?'<div style="margin-top:9px">'+controls+'</div>':'')+'</section>';
}
async function kwlSetMatchPhase(phase){
 const m=selectedMatch;if(!m||!kwlIsOperator())return;
 const p=kwlPresentation(m);
 const gameNumber=Number(p.game_number)||Number((matchDetail.games||[]).filter(g=>g.status!=='completed').sort((a,b)=>a.game_number-b.game_number)[0]?.game_number)||1;
 const b=root?.querySelector('[data-kwl-phase="'+phase+'"]');if(b)b.disabled=true;
 try{
  await rpc('kwl_set_match_phase',{p_match_id:Number(m.id),p_actor_id:String(playerRankingId),p_phase:phase,p_game_number:gameNumber});
  await refresh();await loadMatchDetail(m.id);
 }catch(e){alert('大会進行を更新できませんでした：'+e.message);if(b)b.disabled=false;}
}
function updateMatchPhaseCountdown(){
 const el=root?.querySelector('#kwlPhaseCountdown');if(!el||!selectedMatch)return;
 const p=kwlPresentation(selectedMatch);if(!p.phase_ends_at){el.textContent='';return;}
 const remaining=Math.max(0,Math.ceil((new Date(p.phase_ends_at).getTime()-Date.now())/1000));
 el.textContent=remaining===0?'時間終了・運営の次操作待ち':'残り '+Math.floor(remaining/60)+'分'+String(remaining%60).padStart(2,'0')+'秒';
}

function renderMatchDetail(){
 const box=root?.querySelector('#kwlMatchDetail'),m=selectedMatch;if(!box||!m)return;
 const alliance=(typeof myAlliance!=='undefined'?myAlliance:null),mine=teams.find(t=>Number(t.alliance_id)===Number(alliance?.id));
 const myTeamId=Number(mine?.id||0),isInMatch=myTeamId&&(myTeamId===Number(m.team1_id)||myTeamId===Number(m.team2_id));
 const roster=mine?.roster||[];const loggedInPlayerId=typeof playerRankingId!=='undefined'?String(playerRankingId):'';const humanRoster=roster.filter(p=>String(p.type||'player')==='player'&&String(p.id)===loggedInPlayerId);const aiRoster=roster.filter(p=>String(p.type||'player')==='ai');const opts=humanRoster.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||p.id)+'</option>').join('');
 const games=matchDetail.games||[],players=matchDetail.players||[],locks=matchDetail.locks||[],events=matchDetail.events||[],operator=kwlIsOperator();
 let h='<section style="padding:12px;background:#0f172acc;border:1px solid #64748b;border-radius:12px"><h3 style="margin:0 0 8px">BO5シリーズ管理</h3><div>'+esc(teamName(m.team1_id))+' '+Number(m.team1_wins||0)+' - '+Number(m.team2_wins||0)+' '+esc(teamName(m.team2_id))+'</div>';
 h+='<div style="margin:8px 0;font-size:12px;color:#cbd5e1">各試合で別の選手が出場。シリーズ中、同じチームが一度出撃させたキャラクターは再使用できません。</div>';h+=kwlPhaseMarkup(m,operator);
 for(let n=1;n<=5;n++){const g=games.find(x=>Number(x.game_number)===n),ps=players.filter(x=>Number(x.game_number)===n),aiGame=ps.length===2&&ps.every(p=>String(p.player_type)==='ai')&&(String(g?.status)==='completed'||(n===Number(kwlPresentation(m).game_number||1)&&String(kwlPresentation(m).phase)==='live'));h+='<div style="padding:8px;margin:5px 0;background:#1e293b;border-radius:8px"><b>第'+n+'試合</b> · '+esc(g?.status||'未登録')+'<div style="font-size:12px">'+(ps.map(p=>esc(teamName(p.team_id))+'：'+esc(p.player_name)+'<div style="font-size:11px;color:#cbd5e1;margin-top:3px">装備固定：'+equipmentSummary(p.equipment_snapshot)+'</div><div style="font-size:11px;color:#bfdbfe;margin-top:3px">登録編成：'+((Array.isArray(p.formation_snapshot)?p.formation_snapshot:[]).map(esc).join(' ・ ')||'未登録')+'</div>').join('')||'出場選手未登録')+'</div>'+(aiGame?'<button data-kwl-watch-game="'+n+'" class="formationBtn" style="width:100%;margin-top:7px;background:#1d4ed8;color:#fff">📺 サーバー共通リプレイを観戦</button>':'')+'</div>';}
 const presentation=kwlPresentation(m),phase=String(presentation.phase||'pending'),phaseOpen=phase==='draft'&&(!presentation.phase_ends_at||Date.parse(presentation.phase_ends_at)>Date.now());
  const usedPlayerIds=players.filter(p=>Number(p.team_id)===myTeamId).map(p=>String(p.player_id));
  const availableHumanRoster=humanRoster.filter(p=>!usedPlayerIds.includes(String(p.id)));
  const availableOpts=availableHumanRoster.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||p.id)+'</option>').join('');
  const currentGameNumber=Math.max(1,Number(presentation.game_number||1));
  const expectedLineup=Array.isArray(mine?.match_lineup)?mine.match_lineup.find(p=>Number(p.game_number)===currentGameNumber):null;
  const expectedPlayerId=String(expectedLineup?.player_id||'');
  const expectedPlayerType=String(expectedLineup?.player_type||'player');
  const expectedPlayerName=String(expectedLineup?.player_name||roster.find(p=>String(p.id)===expectedPlayerId)?.name||expectedPlayerId);
  const myCurrentPlayer=players.find(p=>Number(p.team_id)===myTeamId&&Number(p.game_number)===Number(presentation.game_number||0));
  if(isInMatch&&m.status!=='completed'&&phaseOpen){
   if(expectedPlayerId&&expectedPlayerType==='ai')h+='<div style="margin-top:10px;padding:10px;background:#172554;border-radius:8px"><b>第'+currentGameNumber+'試合の出場予定選手</b><p style="font-size:12px;color:#fbbf24">'+esc(expectedPlayerName)+'（AI）</p><p style="font-size:11px;color:#cbd5e1">エントリー時に確定した選手です。サーバー側のAI処理による出場登録を待っています。</p></div>';
   else if(expectedPlayerId&&expectedPlayerId===loggedInPlayerId)h+='<div style="margin-top:10px;padding:10px;background:#172554;border-radius:8px"><b>第'+currentGameNumber+'試合の出場予定選手</b><p style="font-size:12px;color:#bfdbfe">'+esc(expectedPlayerName)+'（エントリー時に確定済み）</p><p style="font-size:11px;color:#cbd5e1">登録済みの編成はゲーム本体の編成画面で確認してください。</p><button id="kwlClaimPlayer" class="formationBtn" style="width:100%;background:#b45309;color:#fff">この選手で出場登録</button></div>';
   else if(expectedPlayerId)h+='<div style="margin-top:10px;padding:10px;background:#172554;border-radius:8px"><b>第'+currentGameNumber+'試合の出場予定選手</b><p style="font-size:12px;color:#bfdbfe">'+esc(expectedPlayerName)+'</p><p style="font-size:11px;color:#cbd5e1">この試合は登録時に決めた選手が出場します。選手本人のアカウントで登録してください。</p></div>';
   else h+='<div style="margin-top:10px;padding:10px;background:#7f1d1d;border-radius:8px"><b>出場予定選手が未登録です</b><p style="font-size:11px">このチームは旧方式で登録されています。次回大会のエントリーから出場順を事前確定します。</p><select id="kwlPlayerSelect" style="width:100%;padding:10px;margin:7px 0;color:#111">'+(availableOpts||'<option value="">出場可能な人間選手がいません</option>')+'</select><button id="kwlClaimPlayer" class="formationBtn" style="width:100%;background:#b45309;color:#fff" '+(!availableHumanRoster.length?'disabled':'')+'>この選手で出場登録</button></div>';
  }else if(isInMatch&&m.status!=='completed'&&phase==='live'){
   const opponentTeamId=myTeamId===Number(m.team1_id)?Number(m.team2_id):Number(m.team1_id);
   const opponentAiPlayer=players.find(p=>Number(p.team_id)===opponentTeamId&&Number(p.game_number)===Number(presentation.game_number||0)&&String(p.player_type)==='ai');
   const opponentIsAi=!!opponentAiPlayer;
   h+='<div style="margin-top:10px;padding:10px;background:#14532d;border-radius:8px"><b>試合開始</b><p style="font-size:11px;color:#dcfce7">'+(myCurrentPlayer?'出場選手：'+esc(myCurrentPlayer.player_name):'登録済みの出場選手を確認してください')+(opponentIsAi?'。登録済みのAI選手と実戦します。':'。対戦相手と同じルームID・パスワードで接続してください。')+'</p>'+(myCurrentPlayer?(opponentIsAi?'<button id="kwlStartAiBattle" class="formationBtn" style="width:100%">⚔️ AIチームと実戦開始</button>':'<button id="kwlOpenPvp" class="formationBtn" style="width:100%">⚔️ 対人戦ルームを開く</button>'):'<div style="font-size:11px;color:#fbbf24">先に出場選手登録を完了してください。</div>')+'</div>';
  }else if(isInMatch&&m.status!=='completed'){
   h+='<div style="padding:9px;background:#334155;border-radius:8px">現在は出場登録受付外です。運営によるチーム紹介・選手選択・試合開始の進行をお待ちください。</div>';
  }else if(!isInMatch)h+='<div style="padding:9px;background:#334155;border-radius:8px">自分の同盟チームが出場するカードではありません。</div>';
 const cg=Number(presentation.game_number||1),cr=players.filter(p=>Number(p.game_number)===cg),aiVsAi=cr.some(p=>Number(p.team_id)===Number(m.team1_id)&&String(p.player_type)==='ai')&&cr.some(p=>Number(p.team_id)===Number(m.team2_id)&&String(p.player_type)==='ai');
 if(phase==='live'&&aiVsAi&&m.status!=='completed')h+='<div style="margin-top:10px;padding:12px;background:#172554;border:1px solid #facc15;border-radius:10px"><b>🤖 AI対AI・ライブ観戦</b><p style="font-size:11px;color:#dbeafe">サーバーが試合を一度だけ計算し、同じ戦闘記録を全観戦者へ配信します。表示される勝敗は大会の公式結果に反映されます。</p><button id="kwlWatchAiVsAi" data-kwl-watch-game="'+cg+'" class="formationBtn" style="width:100%;background:#b45309;color:#fff">📺 サーバー共通試合を観戦する</button></div>';
 h+='<h4 style="margin:12px 0 5px">チーム別使用禁止キャラクター</h4>';
 for(const tid of [m.team1_id,m.team2_id]){const ls=locks.filter(x=>Number(x.team_id)===Number(tid));h+='<div style="font-size:12px;margin:4px 0"><b>'+esc(teamName(tid))+'：</b>'+(ls.map(x=>esc(x.character_key)+'（第'+x.first_game_number+'試合）').join('、')||'まだ使用なし')+'</div>';}
 h+='<h4 style="margin:12px 0 5px">ライブ実況・試合ログ</h4><div id="kwlEventList" style="max-height:190px;overflow:auto;background:#111827;padding:8px;border-radius:8px">'+(events.length?events.slice().reverse().map(e=>'<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #334155"><b>'+esc(e.player_name||e.event_type)+'</b> '+esc(e.message)+'</div>').join(''):'<div style="color:#94a3b8;font-size:12px">まだイベントはありません。</div>')+'</div>';
 h+='<button id="kwlRefreshDetail" class="formationBtn" style="width:100%;margin-top:8px">実況・試合状況を更新</button>';

 if(operator&&m.status!=='completed'){
  const gameOpts=games.filter(g=>g.status!=='completed').map(g=>'<option value="'+g.game_number+'">第'+g.game_number+'試合</option>').join('');
  h+='<div style="margin-top:12px;padding:10px;background:#3f1d0b;border:1px solid #f59e0b;border-radius:9px"><b>大会運営者パネル</b><p style="font-size:11px;color:#fde68a">試合結果の確認・実況投稿。本人確認は現行のゲーム内プレイヤーID方式に依存します。</p><select id="kwlAdminGame" style="width:100%;padding:8px;color:#111">'+(gameOpts||'<option value="">未確定ゲームなし</option>')+'</select><select id="kwlAdminWinner" style="width:100%;padding:8px;margin-top:6px;color:#111"><option value="'+m.team1_id+'">'+esc(teamName(m.team1_id))+' 勝利</option><option value="'+m.team2_id+'">'+esc(teamName(m.team2_id))+' 勝利</option></select><button id="kwlAdminResult" class="formationBtn" style="width:100%;margin-top:6px;background:#b45309;color:#fff" '+(!gameOpts?'disabled':'')+'>このゲームの結果を確定</button><textarea id="kwlAdminComment" maxlength="240" placeholder="公式実況コメント（240文字以内）" style="width:100%;min-height:70px;padding:8px;margin-top:8px;color:#111;border-radius:7px"></textarea><button id="kwlAdminPost" class="formationBtn" style="width:100%;margin-top:6px">公式実況を投稿</button></div>';
 }
 h+='</section>';box.innerHTML=h;
 const claim=box.querySelector('#kwlClaimPlayer');if(claim)claim.onclick=async()=>{const expected=(mine?.match_lineup||[]).find(x=>Number(x.game_number)===Math.max(1,Number(presentation.game_number||1)));const pid=String(expected?.player_id||box.querySelector('#kwlPlayerSelect')?.value||'');const p=humanRoster.find(x=>String(x.id)===pid);if(!p||String(p.id)!==String(playerRankingId)||String(expected?.player_type||p.type||'player')!=='player')return alert('エントリー時に登録した出場選手本人のアカウントで登録してください。');claim.disabled=true;try{const formationSnapshot=(Array.isArray(formation)?formation:[]).map(i=>cards[Number(i)]?.name).filter(Boolean).slice(0,10);if(!formationSnapshot.length)throw new Error('出場前に通常の編成画面で編成を設定してください。');const result=await rpc('kwl_claim_game_player',{p_match_id:Number(m.id),p_team_id:myTeamId,p_player_id:String(p.id),p_player_type:String(p.type||'player'),p_player_name:String(p.name||p.id),p_equipment_snapshot:window.KinoshitaEquipment?.exportLoadout?.()||{}});const row=Array.isArray(result)?result[0]:result;await rpc('kwl_set_game_formation',{p_match_id:Number(m.id),p_game_number:Number(row.game_number),p_team_id:myTeamId,p_player_id:String(p.id),p_formation_snapshot:formationSnapshot});setActiveSeries({matchId:Number(m.id),teamId:myTeamId,opponentTeamId:Number(myTeamId)===Number(m.team1_id)?Number(m.team2_id):Number(m.team1_id),gameNumber:Number(row.game_number),playerId:String(p.id),playerType:String(p.type||'player'),playerName:String(p.name||p.id),equipmentSnapshot:row.equipment_snapshot||{},formationSnapshot,locked:[]});alert('第'+row.game_number+'試合の出場選手・編成を登録しました。');await loadMatchDetail(m.id);}catch(e){alert('出場登録・編成保存ができません：'+e.message);claim.disabled=false;}};
 const openBtn=box.querySelector('#kwlOpenPvp');if(openBtn)openBtn.onclick=()=>{if(typeof openPvp==='function')openPvp();else alert('対人戦画面を開けません。');};const aiBattleBtn=box.querySelector('#kwlStartAiBattle');if(aiBattleBtn)aiBattleBtn.onclick=()=>kwlStartAiBattle();
 const watchAiBtn=box.querySelector('#kwlWatchAiVsAi');if(watchAiBtn)watchAiBtn.onclick=()=>kwlSpectatorStart(Number(watchAiBtn.dataset.kwlWatchGame||kwlPresentation(m).game_number||1));box.querySelectorAll('[data-kwl-watch-game]').forEach(btn=>{btn.onclick=()=>kwlSpectatorStart(Number(btn.dataset.kwlWatchGame));});
 const ref=box.querySelector('#kwlRefreshDetail');if(ref)ref.onclick=()=>loadMatchDetail(m.id);
 const adminResult=box.querySelector('#kwlAdminResult');if(adminResult)adminResult.onclick=async()=>{const game=Number(box.querySelector('#kwlAdminGame').value),winner=Number(box.querySelector('#kwlAdminWinner').value);if(!game||!confirm('第'+game+'試合の勝者を確定します。結果は取り消せません。'))return;adminResult.disabled=true;try{await rpc('kwl_record_game_result',{p_match_id:Number(m.id),p_game_number:game,p_winner_team_id:winner,p_reporter_id:String(playerRankingId)});alert('試合結果を記録しました。');await refresh();await loadMatchDetail(m.id);}catch(e){alert('結果を確定できません：'+e.message);adminResult.disabled=false;}};
 const adminPost=box.querySelector('#kwlAdminPost');if(adminPost)adminPost.onclick=async()=>{const msg=box.querySelector('#kwlAdminComment').value.trim();if(!msg)return alert('実況コメントを入力してください。');adminPost.disabled=true;try{await rpc('kwl_post_commentary',{p_match_id:Number(m.id),p_message:msg,p_author:'公式実況'});box.querySelector('#kwlAdminComment').value='';await loadMatchDetail(m.id);await refreshBroadcast();}catch(e){alert('実況を投稿できません：'+e.message);adminPost.disabled=false;}};

}
function kwlStartAiBattle(){
 const a=activeSeries(),m=selectedMatch;if(!a||!m||Number(a.matchId)!==Number(m.id))return alert('この試合の出場登録情報がありません。');
 if(String(a.playerId)!==String(playerRankingId))return alert('登録した本人のアカウントで開始してください。');
 const gamePlayers=matchDetail.players||[];
 const aiRow=gamePlayers.find(p=>Number(p.match_id)===Number(m.id)&&Number(p.game_number)===Number(a.gameNumber)&&Number(p.team_id)===Number(a.opponentTeamId)&&String(p.player_type)==='ai');
 if(!aiRow)return alert('対戦AIの出場登録がまだ完了していません。運営に確認してください。');
 const accountMatch=String(aiRow.player_id||'').match(/^AI-(\d{1,4})$/);if(!accountMatch)return alert('AI選手IDを確認できません。');
 const profiles=typeof aiProfiles!=='undefined'&&Array.isArray(aiProfiles)?aiProfiles:[];
 const aiAccountDigits=String(aiRow.player_id).replace(/\D/g,'');const opponent=profiles.find(p=>String(p.accountId)===String(aiRow.player_id)||String(p.accountId).replace(/\D/g,'')===aiAccountDigits);
 if(!opponent)return alert('対戦AIのデータを読み込めません。AIデータの読み込み後に再度お試しください。');
 if(typeof setupWorld!=='function'||!unitsEl||typeof aiBuildFormation!=='function')return alert('戦闘エンジンを初期化できません。');
 const previousFormation=Array.isArray(formation)?formation.slice():[];
 const playerRow=gamePlayers.find(p=>Number(p.team_id)===Number(a.teamId)&&Number(p.game_number)===Number(a.gameNumber));
 const snapshot=Array.isArray(a.formationSnapshot)&&a.formationSnapshot.length?a.formationSnapshot:(Array.isArray(playerRow?.formation_snapshot)?playerRow.formation_snapshot:[]);
 if(snapshot.length){const ids=snapshot.map(name=>cards.findIndex(c=>String(c?.name)===String(name))).filter(i=>i>=0);if(!ids.length){formation=previousFormation;return alert('登録した編成のキャラクターを現在のゲームデータから確認できません。');}formation=ids.slice(0,10);}
 if(!Array.isArray(formation)||!formation.length){formation=previousFormation;return alert('登録編成を読み込めませんでした。');}
 const lockedNames=new Set((matchDetail.locks||[]).filter(x=>Number(x.team_id)===Number(a.opponentTeamId)).map(x=>String(x.character_key)));
 const previousRankMode=rankMode;rankMode=true;rankAI={...opponent,formation:Array.isArray(opponent.formation)?opponent.formation.slice():[]};rankAI._battleFormationCache=aiBuildFormation(rankAI).filter(i=>!lockedNames.has(String(cards[i]?.name))).slice(0,10);
 if(!rankAI._battleFormationCache.length){rankMode=previousRankMode;formation=previousFormation;return alert('このAIチームには出場可能なキャラクターが残っていません。');}
 kwlAiBattleContext={formation:previousFormation,mode:typeof selectedMode!=='undefined'?selectedMode:'japan',chapter:typeof selectedChapter!=='undefined'?selectedChapter:1,stage:typeof selectedStage!=='undefined'?selectedStage:1,matchId:Number(m.id),gameNumber:Number(a.gameNumber),aiTeamId:Number(a.opponentTeamId),aiPlayerId:String(aiRow.player_id),aiLockedIndices:new Set()};
 window.__KWL_AI_BATTLE_ACTIVE=true;kwlAiBattleActive=true;haifuSummonCount=0;gameSpeed=1;updateGameSpeedButton();paused=false;rankMode=true;pvpMode=false;
 rankPlayerUsed=[];rankAIUsed=[];rankAIMoney=1500;rankAITimer=0;rankAICooldown=.25;rankAIRecharge=Array(cards.length).fill(0);
 document.getElementById('rankLobby').style.display='none';document.getElementById('pvpLobby').style.display='none';document.getElementById('start').style.display='none';document.getElementById('result').style.display='none';document.getElementById('pause').style.display='none';document.getElementById('detail').style.display='none';document.getElementById('rankResultOverlay')?.remove();document.getElementById('rankModeTag')?.remove();
 units=[];enemies=[];unitsEl.innerHTML='';enemyMaxHp=5000;enemyHp=5000;baseHp=playerCastleMaxHp();setupWorld();level=1;workerMax=6000;workerIncome=120;money=1500;running=true;last=0;stageTime=0;spawnIndex=0;rechargeLeft=cards.map(()=>0);repeatNextTimes=[];
 const tag=document.createElement('div');tag.id='rankModeTag';tag.className='rankModeTag';tag.textContent='🏆 KWL '+(playerName||'プレイヤー')+' VS 🤖 '+String(aiRow.player_name||opponent.name||'AI');document.getElementById('field').appendChild(tag);
 if(root)root.style.display='none';document.getElementById('battlePauseBtn').style.display='none';
 if(audioEnabled){if(audioStarted)startBGM('rank');else initAudio();}playSE('boss');requestAnimationFrame(loop);
}
function kwlFinishAiBattle(win){
 const ctx=kwlAiBattleContext;kwlAiBattleActive=false;window.__KWL_AI_BATTLE_ACTIVE=false;kwlAiBattleContext=null;
 rankMode=false;pvpMode=false;running=false;paused=false;gameSpeed=normalGameSpeed;updateGameSpeedButton();try{stopBGM();playSE(win?'win':'lose');}catch(_){}
 document.getElementById('battlePauseBtn').style.display='';document.getElementById('pause').style.display='none';document.getElementById('detail').style.display='none';document.getElementById('rankModeTag')?.remove();units=[];enemies=[];if(unitsEl)unitsEl.innerHTML='';
 if(ctx){formation=ctx.formation;selectedMode=ctx.mode;selectedChapter=ctx.chapter;selectedStage=ctx.stage;}
 if(typeof renderCards==='function')renderCards();if(root)root.style.display='block';
 const overlay=document.createElement('div');overlay.id='kwlAiResultOverlay';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#020617ef;display:flex;align-items:center;justify-content:center;padding:18px;color:#fff';
 overlay.innerHTML='<div style="width:min(92vw,440px);padding:22px;border:2px solid #facc15;border-radius:16px;background:#172554;text-align:center"><div style="font-size:12px;color:#fde68a;letter-spacing:2px;font-weight:900">KWL LIVE MATCH</div><h2 style="font-size:25px;margin:8px 0">'+(win?'🏆 KWL試合勝利':'KWL試合敗北')+'</h2><p style="font-size:13px;line-height:1.7;color:#dbeafe">この試合の結果を大会記録へ送信します。通常報酬・XP・ランクポイントは発生しません。</p><button id="kwlAiResultClose" class="formationBtn" style="width:100%;background:#b45309;color:#fff">KWL大会画面へ戻る</button></div>';
 document.body.appendChild(overlay);overlay.querySelector('#kwlAiResultClose').onclick=()=>{overlay.remove();if(root)root.style.display='block';if(selectedMatch)loadMatchDetail(selectedMatch.id);};
 recordActiveSeries(win);
}

let handlingRemoteFinish=false;
function recordActiveSeries(localWin){const a=activeSeries();if(!a)return;const winner=localWin?a.teamId:a.opponentTeamId;rpc('kwl_record_game_result',{p_match_id:a.matchId,p_game_number:a.gameNumber,p_winner_team_id:winner,p_reporter_id:a.playerId}).then(async r=>{const row=Array.isArray(r)?r[0]:r;setActiveSeries(null);alert('KWL第'+a.gameNumber+'試合の結果を記録しました。\\n'+row.team1_wins+' - '+row.team2_wins+(row.series_completed?'\\nシリーズ決着！':'\\n次の試合の出場選手を登録してください。'));try{await refresh();await loadMatchDetail(a.matchId);await refreshBroadcast();}catch(refreshError){console.warn('KWL match detail refresh deferred:',refreshError);}}).catch(e=>alert('KWL結果を記録できませんでした：'+e.message));}

let kwlSpectatorActive=false,kwlSpectatorContext=null;
function kwlFindAiProfile(row){const ps=typeof aiProfiles!=='undefined'&&Array.isArray(aiProfiles)?aiProfiles:[],id=String(row?.player_id||''),digits=id.replace(/\\D/g,'');return ps.find(p=>String(p.accountId)===id||String(p.accountId).replace(/\\D/g,'')===digits)||null;}
function kwlSpectatorThink(){}
function kwlSpectatorFinish(){const c=kwlSpectatorContext;kwlSpectatorActive=false;kwlSpectatorContext=null;const overlay=document.getElementById('kwlServerSpectator');if(overlay){overlay.__kwlClosed=true;overlay.__kwlCleanup?.();overlay.remove();}if(c?.matchId)loadMatchDetail(c.matchId);}
async function kwlSpectatorStart(requestedGameNo){
 const m=selectedMatch;if(!m)return alert('観戦する試合を選択してください。');
 const gameNo=Math.max(1,Math.min(5,Number(requestedGameNo||kwlPresentation(m).game_number||1)));
 const old=document.getElementById('kwlServerSpectator');if(old){old.__kwlClosed=true;old.__kwlCleanup?.();old.remove();}
 const overlay=document.createElement('div');overlay.id='kwlServerSpectator';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#020617f5;color:#fff;padding:12px;display:flex;align-items:center;justify-content:center;overflow:auto;font-family:system-ui,"Noto Sans JP",sans-serif';
 overlay.innerHTML='<section style="width:min(100%,980px);background:#0f172a;border:1px solid #64748b;border-radius:16px;padding:12px"><header style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><div style="font-size:11px;color:#facc15;font-weight:900;letter-spacing:2px">KWL SERVER AUTHORITATIVE REPLAY</div><h2 style="font-size:20px;margin:4px 0">🤖 AI対AI・サーバー共通観戦</h2><div id="kwlReplayStatus" style="font-size:12px;color:#cbd5e1">サーバーの試合データを確認しています…</div></div><button id="kwlReplayClose" class="formationBtn">閉じる</button></header><div id="kwlReplayBody" style="margin-top:12px"><div style="padding:28px;text-align:center;background:#1e293b;border-radius:10px">サーバーが試合を一度だけ計算し、共通リプレイを作成しています。<br>観戦者ごとに別々の戦闘は実行しません。</div></div></section>';
 document.body.appendChild(overlay);kwlSpectatorActive=true;kwlSpectatorContext={matchId:Number(m.id),gameNumber:gameNo,overlay};
 let closed=false;overlay.__kwlClosed=false;
 const close=()=>{closed=true;overlay.__kwlClosed=true;overlay.__kwlCleanup?.();kwlSpectatorActive=false;kwlSpectatorContext=null;overlay.remove();};
 overlay.querySelector('#kwlReplayClose').onclick=close;
 const status=overlay.querySelector('#kwlReplayStatus'),body=overlay.querySelector('#kwlReplayBody');
 const replayPath='/kwl_spectator_battles?select=status,winner_team_id,duration_seconds,replay,completed_at&match_id=eq.'+Number(m.id)+'&game_number=eq.'+gameNo+'&limit=1';
 const getReplay=async()=>{const rows=await request(replayPath);return Array.isArray(rows)?rows[0]||null:null;};
 const renderReplay=(replay)=>{
  if(closed||overlay.__kwlClosed)return;
  const frames=Array.isArray(replay?.frames)?replay.frames:[];
  if(!frames.length)throw new Error('サーバーリプレイにフレームがありません。');
  const duration=Math.max(.1,Number(replay.duration_seconds||frames[frames.length-1].t||0));
  const t1=replay.team1||{},t2=replay.team2||{};
  body.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"><div style="padding:9px;background:#172554;border:1px solid #3b82f6;border-radius:9px"><b>'+esc(t1.name||'チーム1')+'</b><div id="kwlReplayBase1" style="font-size:12px;color:#bfdbfe">城HP 5000</div></div><div style="padding:9px;background:#451a1a;border:1px solid #ef4444;border-radius:9px"><b>'+esc(t2.name||'チーム2')+'</b><div id="kwlReplayBase2" style="font-size:12px;color:#fecaca">城HP 5000</div></div></div><div id="kwlReplayField" style="position:relative;height:min(55vh,430px);min-height:280px;overflow:hidden;border:1px solid #64748b;border-radius:12px;background:linear-gradient(180deg,#172554 0%,#1e293b 52%,#334155 100%)"><div style="position:absolute;left:0;right:0;top:50%;border-top:2px dashed #94a3b8;opacity:.45"></div><div style="position:absolute;left:8px;bottom:8px;padding:8px;background:#1d4ed8;border-radius:8px;font-size:11px;font-weight:900">TEAM 2 城</div><div style="position:absolute;right:8px;bottom:8px;padding:8px;background:#991b1b;border-radius:8px;font-size:11px;font-weight:900">TEAM 1 城</div><div id="kwlReplayZones" style="position:absolute;inset:0;pointer-events:none"></div><div id="kwlReplayUnits"></div><div id="kwlReplayEnd" style="display:none;position:absolute;inset:0;background:#020617cc;align-items:center;justify-content:center;text-align:center;padding:20px"><div><div style="font-size:12px;color:#facc15;letter-spacing:2px">OFFICIAL SERVER RESULT</div><h2 id="kwlReplayWinner" style="font-size:28px;margin:8px 0"></h2><p style="font-size:12px;color:#cbd5e1">この結果はサーバーで一度だけ計算され、全観戦者に共通です。</p></div></div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px"><button id="kwlReplayPlay" class="formationBtn" style="min-width:84px">⏸ 一時停止</button><label style="font-size:12px">速度 <select id="kwlReplaySpeed" style="padding:7px;border-radius:6px;color:#111"><option value="0.5">0.5倍</option><option value="1" selected>1倍</option><option value="2">2倍</option></select></label><input id="kwlReplaySeek" type="range" min="0" max="'+duration+'" step="0.1" value="0" style="flex:1;min-width:130px"><span id="kwlReplayTime" style="font-size:12px;font-variant-numeric:tabular-nums">0.0 / '+duration.toFixed(1)+'秒</span></div><div id="kwlReplayEvent" style="font-size:12px;color:#fde68a;margin-top:8px;min-height:20px">サーバー生成リプレイを再生します。</div>';
  const zoneLayer=body.querySelector('#kwlReplayZones'),unitLayer=body.querySelector('#kwlReplayUnits'),base1=body.querySelector('#kwlReplayBase1'),base2=body.querySelector('#kwlReplayBase2'),playBtn=body.querySelector('#kwlReplayPlay'),speedSelect=body.querySelector('#kwlReplaySpeed'),seek=body.querySelector('#kwlReplaySeek'),timeLabel=body.querySelector('#kwlReplayTime'),eventLabel=body.querySelector('#kwlReplayEvent'),endOverlay=body.querySelector('#kwlReplayEnd'),winnerLabel=body.querySelector('#kwlReplayWinner');
  const unitNodes=new Map(),zoneNodes=new Map(),events=Array.isArray(replay.events)?replay.events:[];let currentTime=0,playing=true,speed=1,startAt=performance.now(),raf=0;
  const formatTime=v=>Number(v).toFixed(1)+'秒';
  const makeUnit=(u)=>{
   const card=cards[Number(u.card_id)]||{},el=document.createElement('div');el.dataset.unitId=String(u.id);
   el.style.cssText='position:absolute;width:72px;min-height:58px;transform:translateX(-50%);text-align:center;transition:opacity .12s;pointer-events:none;text-shadow:0 1px 2px #000';
   el.innerHTML='<div style="font-size:25px;line-height:28px">'+esc(card.icon||'❔')+'</div><div style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(card.name||('キャラ#'+(Number(u.card_id)+1)))+'</div><div data-replay-state style="font-size:8px;line-height:11px;min-height:11px;color:#cbd5e1"></div><div style="height:5px;background:#334155;border:1px solid #0f172a;border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:100%;background:#22c55e"></i></div>';
   unitLayer.appendChild(el);unitNodes.set(Number(u.id),el);return el;
  };
  const paint=(time)=>{
   let index=0;while(index<frames.length-2&&Number(frames[index+1].t)<time)index++;
   const a=frames[index],b=frames[Math.min(index+1,frames.length-1)],span=Math.max(.001,Number(b.t)-Number(a.t)),ratio=clamp((time-Number(a.t))/span,0,1);
   base1.textContent='城HP '+Math.max(0,Math.round(Number(a.team1_base_hp)+(Number(b.team1_base_hp)-Number(a.team1_base_hp))*ratio));
   base2.textContent='城HP '+Math.max(0,Math.round(Number(a.team2_base_hp)+(Number(b.team2_base_hp)-Number(a.team2_base_hp))*ratio));
   const za=Array.isArray(a.ice_zones)?a.ice_zones:[],zb=Array.isArray(b.ice_zones)?b.ice_zones:[],zoneA=new Map(za.map(z=>[Number(z.id),z])),zoneB=new Map(zb.map(z=>[Number(z.id),z])),zoneIds=new Set([...zoneA.keys(),...zoneB.keys()]);
   for(const id of zoneIds){
    const x=zoneA.get(id)||zoneB.get(id),y=zoneB.get(id)||zoneA.get(id);let el=zoneNodes.get(id);
    if(!el){el=document.createElement('div');el.style.cssText='position:absolute;width:54px;height:22px;transform:translateX(-50%);border:1px solid #7dd3fc;border-radius:50%;background:radial-gradient(ellipse,#bae6fdcc 0%,#38bdf855 55%,transparent 78%);box-shadow:0 0 12px #38bdf899;pointer-events:none';el.title='アイスエリア';zoneLayer.appendChild(el);zoneNodes.set(id,el);}
    const pos=Number(x.x)+(Number(y.x)-Number(x.x))*ratio,side=String(x.side||y.side);
    el.style.left=(clamp(pos/Number(replay.world_width||1900),0,1)*100)+'%';el.style.bottom=(side==='team1'?26:132)+'px';
    el.style.opacity=zoneA.has(id)&&zoneB.has(id)?'1':String(zoneA.has(id)?1-ratio:ratio);
   }
   for(const [id,el] of zoneNodes)if(!zoneIds.has(id)){el.remove();zoneNodes.delete(id);}
   const ua=Array.isArray(a.units)?a.units:[],ub=Array.isArray(b.units)?b.units:[],mapA=new Map(ua.map(u=>[Number(u.id),u])),mapB=new Map(ub.map(u=>[Number(u.id),u])),ids=new Set([...mapA.keys(),...mapB.keys()]);
   for(const id of ids){
    const x=mapA.get(id)||mapB.get(id),y=mapB.get(id)||mapA.get(id);let el=unitNodes.get(id);if(!el)el=makeUnit(x);
    const pos=Number(x.x)+(Number(y.x)-Number(x.x))*ratio,hp=Number(x.hp)+(Number(y.hp)-Number(x.hp))*ratio,maxHp=Math.max(1,Number(y.max_hp||x.max_hp||1));
    const side=String(x.side||y.side),state=String(y.state||x.state||'move'),flying=!!(y.is_flying||x.is_flying||state==='fly'),frozen=!!(y.frozen||x.frozen||state==='frozen');
    const bottom=(side==='team1'?44:150)+(id%3)*34+(flying?110:0);
    el.style.left=(clamp(pos/Number(replay.world_width||1900),0,1)*100)+'%';el.style.bottom=bottom+'px';el.style.opacity=mapA.has(id)&&mapB.has(id)?'1':String(mapA.has(id)?1-ratio:ratio);
    const stateLabel=frozen?'🧊 凍結':flying?'🪽 飛行':state==='grabbed'?'✊ 拘束':state==='stopped'?'⏸ 停止':state==='attack'?'⚔️ 攻撃':state==='move'?'移動':'';
    const stateNode=el.querySelector('[data-replay-state]');if(stateNode){stateNode.textContent=stateLabel;stateNode.style.color=frozen?'#7dd3fc':flying?'#bae6fd':state==='grabbed'?'#fbbf24':'#cbd5e1';}
    const bar=el.querySelector('i');if(bar)bar.style.width=(clamp(hp/maxHp,0,1)*100)+'%';
   }
   for(const [id,el] of unitNodes)if(!ids.has(id)){el.remove();unitNodes.delete(id);}
   timeLabel.textContent=formatTime(time)+' / '+formatTime(duration);seek.value=String(time);
   const event=events.filter(e=>Number(e.t)<=time).slice(-1)[0];if(event)eventLabel.textContent=formatTime(event.t)+' · '+String(event.character||'戦闘')+' '+String(event.detail||({spawn:'出撃',attack:'攻撃',hit:'ダメージ',death:'撃破',base_hit:'城攻撃',skill:'能力発動',wave:'波動',surge:'烈波',match_end:'試合終了'}[event.type]||event.type))+(event.target?' → '+event.target:'')+(event.value?'（'+Number(event.value).toLocaleString()+'）':'');
  };
  const finish=()=>{playing=false;playBtn.textContent='▶ 再生';endOverlay.style.display='flex';winnerLabel.textContent=Number(replay.winner_team_id)===Number(t1.id)?'🏆 '+String(t1.name||'チーム1')+' 勝利':'🏆 '+String(t2.name||'チーム2')+' 勝利';};
  const tick=()=>{if(closed||overlay.__kwlClosed)return;if(playing){currentTime=Math.min(duration,(performance.now()-startAt)/1000*speed);paint(currentTime);if(currentTime>=duration){finish();return;}}raf=requestAnimationFrame(tick);};
  playBtn.onclick=()=>{if(playing){playing=false;currentTime=Math.min(duration,(performance.now()-startAt)/1000*speed);playBtn.textContent='▶ 再生';}else{if(currentTime>=duration){currentTime=0;endOverlay.style.display='none';}playing=true;startAt=performance.now()-currentTime/speed*1000;playBtn.textContent='⏸ 一時停止';tick();}};
  speedSelect.onchange=()=>{speed=Number(speedSelect.value)||1;if(playing)startAt=performance.now()-currentTime/speed*1000;};
  seek.oninput=()=>{currentTime=Number(seek.value)||0;startAt=performance.now()-currentTime/speed*1000;if(currentTime>=duration){paint(duration);finish();return;}endOverlay.style.display='none';paint(currentTime);playing=false;playBtn.textContent='▶ 再生';};
  paint(0);tick();
  overlay.__kwlCleanup=()=>{cancelAnimationFrame(raf);playing=false;};
 };
 try{
  let replayRow=await getReplay();
  if(replayRow?.status!=='completed'||!replayRow?.replay)status.textContent='AI Workerがサーバー共通試合を準備しています…';
  for(let attempt=0;(!replayRow||replayRow.status!=='completed'||!replayRow.replay)&&attempt<150&&!closed;attempt++){
   status.textContent='サーバー戦闘の完了を待っています… '+(attempt+1)+'/150';
   await new Promise(resolve=>setTimeout(resolve,2000));
   replayRow=await getReplay();
   if(replayRow?.status==='failed')throw new Error('サーバー戦闘に失敗しました。運営に確認してください。');
  }
  if(closed)return;
  if(!replayRow?.replay)throw new Error('サーバーリプレイがまだ準備できていません。時間をおいて再度開いてください。');
  status.textContent='サーバー生成済み・全観戦者共通の試合結果です。';
  renderReplay(replayRow.replay);
 }catch(e){
  if(closed)return;
  status.textContent='観戦データを取得できませんでした。';
  body.innerHTML='<div style="padding:16px;background:#7f1d1d;border-radius:10px">'+esc(e.message||e)+'<p style="font-size:12px;color:#fecaca">サーバーDBのマイグレーションとEdge Functionのデプロイが必要です。</p></div>';
 }
}
function patchBattleHooks(){
 const restored=activeSeries();if(restored)try{window.KinoshitaEquipment?.useTournamentLoadout?.(restored.equipmentSnapshot||{})}catch(_){}
 if(typeof window.deploy==='function'&&!window.deploy.__kwlWrapped){const original=window.deploy;const wrapped=function(i){const a=activeSeries();if(!a&&!kwlAiBattleActive)return original.apply(this,arguments);if(!(kwlAiBattleActive||(typeof pvpMode!=='undefined'&&pvpMode)))return original.apply(this,arguments);const base=(typeof activeCard==='function'?activeCard(i):null)||(typeof cards!=='undefined'?cards[i]:null);if(!running||!hasCharacter(i)||!formation.includes(i)||money<base.cost||(rechargeLeft[i]||0)>0||(base.growth&&units.some(u=>!u.isEnemy&&u.cardIndex===i&&u.hp>0))||(base.ability?.modeSwitch&&units.some(u=>u.hp>0&&u.ability?.modeSwitch)))return original.apply(this,arguments);const key=String(base?.name||'');if(!key)return original.apply(this,arguments);if((a.locked||[]).includes(key)){alert(key+' はこのBO5シリーズですでに使用済みです。');return;}rpc('kwl_lock_character',{p_match_id:a.matchId,p_game_number:a.gameNumber,p_team_id:a.teamId,p_player_id:a.playerId,p_player_type:a.playerType,p_character_key:key}).then(()=>{const next=activeSeries();if(!next||next.matchId!==a.matchId)return;next.locked=[...(next.locked||[]),key];setActiveSeries(next);original.call(this,i);}).catch(e=>alert('キャラクター使用を登録できません：'+e.message));};wrapped.__kwlWrapped=true;window.deploy=wrapped;}
 if(typeof window.rankAIThink==='function'&&!window.rankAIThink.__kwlWrapped){const original=window.rankAIThink;const wrapped=function(dt){const result=original.apply(this,arguments);if(kwlSpectatorActive)kwlSpectatorThink(dt);if(kwlAiBattleActive&&kwlAiBattleContext){const ctx=kwlAiBattleContext;for(const index of rankAIUsed||[]){if(ctx.aiLockedIndices.has(index))continue;ctx.aiLockedIndices.add(index);const character=cards[index]?.name;if(!character)continue;rpc('kwl_lock_character',{p_match_id:ctx.matchId,p_game_number:ctx.gameNumber,p_team_id:ctx.aiTeamId,p_player_id:ctx.aiPlayerId,p_player_type:'ai',p_character_key:String(character)}).catch(e=>console.warn('KWL AI character lock failed:',e.message));}}return result;};wrapped.__kwlWrapped=true;window.rankAIThink=wrapped;}
 if(typeof window.finishRank==='function'&&!window.finishRank.__kwlWrapped){const original=window.finishRank;const wrapped=function(win){if(kwlSpectatorActive){kwlSpectatorFinish(!!win);return;}if(kwlAiBattleActive){kwlFinishAiBattle(!!win);return;}return original.apply(this,arguments);};wrapped.__kwlWrapped=true;window.finishRank=wrapped;}
 if(typeof window.showResult==='function'&&!window.showResult.__kwlWrapped){const original=window.showResult;const wrapped=function(win){if(window.__KWL_REHEARSAL_ACTIVE){kwlRehearsalFinish(!!win);return;}const shouldRecord=!handlingRemoteFinish&&!!activeSeries()&&typeof pvpMode!=='undefined'&&pvpMode;const result=original.apply(this,arguments);if(shouldRecord)recordActiveSeries(!!win);return result;};wrapped.__kwlWrapped=true;window.showResult=wrapped;}
 if(typeof window.pvpFinish==='function'&&!window.pvpFinish.__kwlWrapped){const original=window.pvpFinish;const wrapped=function(opponentWon){const shouldRecord=!!activeSeries();handlingRemoteFinish=true;const result=original.apply(this,arguments);handlingRemoteFinish=false;if(shouldRecord)recordActiveSeries(!opponentWon);return result;};wrapped.__kwlWrapped=true;window.pvpFinish=wrapped;}
 if(typeof window.pvpQuit==='function'&&!window.pvpQuit.__kwlWrapped){const original=window.pvpQuit;const wrapped=function(){const shouldRecord=!!activeSeries();const result=original.apply(this,arguments);if(shouldRecord)recordActiveSeries(false);return result;};wrapped.__kwlWrapped=true;window.pvpQuit=wrapped;}
}

const KWL_REHEARSAL_KEY='kwl-local-rehearsal-v1';
let kwlRehearsalSaveOriginal=null,kwlRehearsalRankSyncOriginal=null,kwlRehearsalNextOriginal=null,kwlRehearsalBackOriginal=null;
function kwlRehearsalState(){try{return JSON.parse(sessionStorage.getItem(KWL_REHEARSAL_KEY)||'null')}catch(_){return null}}
function kwlRehearsalStore(v){try{sessionStorage.setItem(KWL_REHEARSAL_KEY,JSON.stringify(v))}catch(_){}}
function kwlRehearsalSuppressPersistence(){
 if(typeof window.save==='function'&&!kwlRehearsalSaveOriginal){kwlRehearsalSaveOriginal=window.save;window.save=function(){if(window.__KWL_REHEARSAL_ACTIVE)return;return kwlRehearsalSaveOriginal.apply(this,arguments);};}
 if(typeof window.syncPlayerRanking==='function'&&!kwlRehearsalRankSyncOriginal){kwlRehearsalRankSyncOriginal=window.syncPlayerRanking;window.syncPlayerRanking=function(){if(window.__KWL_REHEARSAL_ACTIVE)return;return kwlRehearsalRankSyncOriginal.apply(this,arguments);};}
}
function kwlRehearsalRestorePersistence(){
 if(kwlRehearsalSaveOriginal){window.save=kwlRehearsalSaveOriginal;kwlRehearsalSaveOriginal=null;}
 if(kwlRehearsalRankSyncOriginal){window.syncPlayerRanking=kwlRehearsalRankSyncOriginal;kwlRehearsalRankSyncOriginal=null;}
}
function kwlRehearsalQuitButton(){
 document.getElementById('kwlRehearsalQuit')?.remove();
 const b=document.createElement('button');b.id='kwlRehearsalQuit';b.type='button';b.textContent='🧪 リハーサル終了';
 b.style.cssText='position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:8px;z-index:100000;background:#075985;color:#fff;border:2px solid #bae6fd;border-radius:10px;padding:10px;font-weight:900;box-shadow:0 2px 10px #0008';
 b.onclick=kwlRehearsalExit;document.body.appendChild(b);
}
function kwlRehearsalStart(){
 if(!kwlIsOperator()){alert('リハーサルを開始できるのは運営アカウントのみです。');return;}
 if(!confirm('無料のローカルリハーサルを開始します。通常の報酬・セーブ・ランキング更新は無効化されます。本番大会データは使用しません。'))return;
 let mode=typeof selectedMode!=='undefined'?selectedMode:'japan',chapter=typeof selectedChapter!=='undefined'?Number(selectedChapter)||1:1,stage=typeof selectedStage!=='undefined'?Number(selectedStage)||1:1;
 if(['pvp','daily','bossrush'].includes(mode)||typeof currentStage!=='function'||!currentStage()){mode='japan';chapter=1;stage=1;}
 const stageName=String((typeof currentStage==='function'&&currentStage()?.name)||'日本編 第1章 1ステージ');
 const state={active:true,game:1,team1Wins:0,team2Wins:0,history:[],mode,chapter,stage,stageName,previousMode:typeof selectedMode!=='undefined'?selectedMode:'japan',previousChapter:typeof selectedChapter!=='undefined'?selectedChapter:1,previousStage:typeof selectedStage!=='undefined'?selectedStage:1};
 kwlRehearsalStore(state);window.__KWL_REHEARSAL_ACTIVE=true;kwlRehearsalSuppressPersistence();
 selectedMode=mode;selectedChapter=chapter;selectedStage=stage;rankMode=false;pvpMode=false;
 if(root)root.style.display='none';
 try{startStage(stage);kwlRehearsalQuitButton();}
 catch(e){console.error('KWL local rehearsal start failed',e);kwlRehearsalExit();alert('リハーサルを開始できませんでした：'+e.message);}
}
function kwlRehearsalFinish(win){
 const s=kwlRehearsalState();if(!s?.active)return;
 s.history.push({game:s.game,win:!!win});if(win)s.team1Wins++;else s.team2Wins++;
 s.completed=s.team1Wins>=3||s.team2Wins>=3||s.game>=5;kwlRehearsalStore(s);
 running=false;paused=false;rankMode=false;pvpMode=false;try{stopBGM();}catch(_){}
 document.getElementById('pause').style.display='none';document.getElementById('detail').style.display='none';document.getElementById('start').style.display='none';
 document.getElementById('rankLobby').style.display='none';document.getElementById('pvpLobby').style.display='none';document.getElementById('battlePauseBtn').style.display='';
 const r=document.getElementById('result');r.style.setProperty('display','flex','important');r.style.setProperty('position','fixed','important');r.style.setProperty('inset','0','important');r.style.setProperty('z-index','99999','important');r.style.setProperty('pointer-events','auto','important');
 document.getElementById('resultTitle').textContent=s.completed?'🧪 リハーサルシリーズ終了':'🧪 リハーサル第'+s.game+'試合終了';
 document.getElementById('resultText').textContent=(win?'今回の試合：運営テストチームの勝利':'今回の試合：テストAIチームの勝利')+'\nBO5スコア：'+s.team1Wins+' - '+s.team2Wins+'\n試合数：'+s.game+' / 5\n\n報酬・コイン・XP・ランキング・プレイヤー戦績は一切更新していません。'+(s.completed?'\nシリーズ結果をローカルに記録しました。':'\n次の試合へ進めます。');
 const next=document.getElementById('nextBtn'),back=document.getElementById('stageBack');
 if(!kwlRehearsalNextOriginal)kwlRehearsalNextOriginal=next.onclick;if(!kwlRehearsalBackOriginal)kwlRehearsalBackOriginal=back.onclick;
 next.style.display='inline-block';next.textContent=s.completed?'リハーサルを終了':'次の試合へ';next.onclick=()=>{if(s.completed){kwlRehearsalExit();return;}const n=kwlRehearsalState();n.game++;kwlRehearsalStore(n);r.style.display='none';try{startStage(n.stage);kwlRehearsalQuitButton();}catch(e){kwlRehearsalExit();alert('次の試合を開始できませんでした：'+e.message);}};
 back.style.display='inline-block';back.textContent='リハーサル終了';back.onclick=kwlRehearsalExit;
 document.getElementById('kwlRehearsalQuit')?.remove();
}
function kwlRehearsalExit(){
 const s=kwlRehearsalState();window.__KWL_REHEARSAL_ACTIVE=false;running=false;paused=false;try{stopBGM();}catch(_){}
 kwlRehearsalRestorePersistence();document.getElementById('kwlRehearsalQuit')?.remove();sessionStorage.removeItem(KWL_REHEARSAL_KEY);
 if(s){selectedMode=s.previousMode;selectedChapter=s.previousChapter;selectedStage=s.previousStage;}
 const r=document.getElementById('result');if(r)r.style.display='none';
 const next=document.getElementById('nextBtn'),back=document.getElementById('stageBack');
 if(next&&kwlRehearsalNextOriginal!==null){next.onclick=kwlRehearsalNextOriginal;kwlRehearsalNextOriginal=null;}
 if(back&&kwlRehearsalBackOriginal!==null){back.onclick=kwlRehearsalBackOriginal;kwlRehearsalBackOriginal=null;}
 document.getElementById('start').style.display='flex';if(typeof renderStageSelect==='function')renderStageSelect();if(typeof renderCards==='function')renderCards();
 if(root)root.style.display='none';
}

async function setTournamentPaused(paused){
 const action=paused?'緊急停止':'再開';
 const reason=paused?String(root?.querySelector('#kwlPauseReason')?.value||'').trim().slice(0,120):'';
 if(!confirm(paused?'KWL大会を直ちに緊急停止します。出場登録と試合結果の確定を停止します。よろしいですか？':'KWL大会を停止前の状態に戻して再開します。よろしいですか？'))return;
 const button=root?.querySelector(paused?'#kwlEmergencyStop':'#kwlEmergencyResume');if(button){button.disabled=true;button.textContent=paused?'停止処理中…':'再開処理中…';}
 try{
  await rpc('kwl_set_tournament_pause',{p_actor_id:String(playerRankingId),p_paused:!!paused,p_reason:reason});
  await refresh();
  alert('KWL大会を'+action+'しました。');
 }catch(e){alert(action+'できませんでした：'+e.message);if(button){button.disabled=false;button.textContent=paused?'⛔ 大会を緊急停止する':'▶ 大会を再開する';}}
}
async function register(){
 const b=root.querySelector('#kwlRegister');if(!b)return;
 if(typeof playerRankingId==='undefined'||!playerRankingId||typeof myAlliance==='undefined'||!myAlliance)return alert('プレイヤー・同盟情報を確認できません。');
 const roster=Array.isArray(myAlliance.members)?myAlliance.members.slice(0,10):[];
 const lineup=Array.from({length:5},(_,i)=>{const id=String(root.querySelector('#kwlStarter'+(i+1))?.value||'');const p=roster.find(x=>String(x.id)===id);return p?{game_number:i+1,player_id:id,player_type:String(p.type||'player'),player_name:String(p.name||id)}:null;});
 if(lineup.some(x=>!x))return alert('第1〜第5試合の出場選手をすべて選択してください。');
 if(new Set(lineup.map(x=>x.player_type+':'+x.player_id)).size!==5)return alert('同じ選手を複数の試合に登録できません。5人の異なる選手を選択してください。');
 if(!confirm('第1〜第5試合の出場選手と順番を確定してエントリーします。選ばなかった登録メンバーは補欠になります。確定後の変更は運営承認が必要です。よろしいですか？'))return;
 b.disabled=true;b.textContent='エントリー中…';
 try{await request('/rpc/kwl_register_team',{method:'POST',headers:headers(),body:JSON.stringify({p_tournament_key:TOURNAMENT,p_player_id:String(playerRankingId),p_alliance_id:Number(myAlliance.id),p_lineup:lineup})});await refresh();alert('出場選手5名と順番を確定してエントリーしました。');}
 catch(e){alert('エントリーできませんでした：'+e.message);b.disabled=false;b.textContent='出場順を確定してエントリー';}
}
function boot(){ensureButton();patchBattleHooks();const start=document.getElementById('start');if(start&&!start.__kwlObserver){start.__kwlObserver=new MutationObserver(()=>{ensureButton();patchBattleHooks();});start.__kwlObserver.observe(start,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
