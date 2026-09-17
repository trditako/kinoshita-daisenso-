(()=>{
  const SUPABASE='https://jhohdvuoyvbzwjumnibc.supabase.co';
  const PERS=['突撃型','鉄壁型','物量型','安定型','対戦狂','ボス狙い型','節約型','気まぐれ型','収集家','育成マニア','イベント派','ランカー','慎重派','ギャンブラー','高速攻略型','研究家'];
  const REWARDS=[
    {name:'突撃ハーランド木下',cost:777,hp:2500,atk:1500,range:60,spd:2.5,interval:.7,recharge:25,icon:'⚽',motion:'super',attackType:'area',kb:2,series:'日本編章クリア報酬',rarity:'SR',specialReward:true},
    {name:'異常木下',cost:3000,hp:15000,atk:3000,range:200,spd:.3,interval:.5,recharge:45,icon:'😈',motion:'muscle',attackType:'single',kb:5,series:'日本編章クリア報酬',rarity:'SSR',specialReward:true},
    {name:'吉田',cost:200,hp:6000,atk:1111,range:100,spd:1.2,interval:.65,recharge:3,icon:'🧑🏻',motion:'power',attackType:'area',kb:2,series:'日本編章クリア報酬',rarity:'SR',specialReward:true}
  ];
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
  function tier(id){const x=((id-1)%1000)+1;if(x<=10)return ['最強',90,99.5];if(x<=50)return ['激強',78,94];if(x<=100)return ['強い',65,86];if(x<=700)return ['普通',38,72];if(x<=900)return ['弱い',22,55];return ['激弱',8,36]}
  function mapRow(r){
    const id=Number(r.account_id)||0,t=tier(id);
    const a={accountId:'AI-'+String(id).padStart(4,'0'),name:r.name||('AI-'+String(id).padStart(4,'0')),rp:Number(r.rp||0),skill:Number(r.skill??.25),wins:Number(r.wins||0),losses:Number(r.losses||0),generation:Number(r.generation||1),strategy:r.strategy||'balanced',aggression:Number(r.aggression??.5),save:Number(r.save_rate??.5),formation:Array.isArray(r.formation)?r.formation:[],stageClears:Number(r.stage_clears||0),chapterClears:Array.isArray(r.chapter_clears)?r.chapter_clears:[0,0,0],ownedCharacters:Array.isArray(r.owned_characters)?r.owned_characters:[0],eventClears:r.event_clears&&typeof r.event_clears==='object'?r.event_clears:{},charLevels:Array.isArray(r.char_levels)?r.char_levels:[],trainingXP:Number(r.training_xp||0),matches:Number(r.matches||0),lastResult:r.last_result||'',matchHistory:Array.isArray(r.match_history)?r.match_history:[],coins:Number(r.coins||900),playerXP:Number(r.player_xp||0),workerLevel:Number(r.worker_level||1),activity:typeof r.activity==='object'?(r.activity?.text||r.activity?.message||'待機中'):(r.activity||'待機中'),activityHistory:Array.isArray(r.activity_history)?r.activity_history:[]};
    a.tierLabel=t[0];a.personality=PERS[hash('p'+id)%PERS.length];a.aiStrength=Math.round(t[1]+(hash('s'+id)%10000)/10000*(t[2]-t[1]));return a;
  }
  async function getRows(offset){const u=SUPABASE+'/rest/v1/ai_accounts?select=*&order=account_id.asc&limit=1000&offset='+offset;const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('AI '+r.status);return await r.json()}

  let page=0;
  let renderWrapped=false;
  let rankWrapped=false;

  function installPageTabs(){
    if(renderWrapped||typeof renderAIAccountList!=='function')return;
    const originalRender=renderAIAccountList;
    window.renderAIAccountList=function(){
      const all=Array.isArray(aiProfiles)?aiProfiles:[];
      const start=page===0?0:1000;
      const end=page===0?Math.min(1000,all.length):all.length;
      const visible=all.slice(start,end);
      const saved=aiProfiles;
      aiProfiles=visible;
      try{originalRender()}finally{aiProfiles=saved}
      const count=document.getElementById('aiAccountCount');
      if(count)count.textContent=(page===0?'表示：AI-0001 ～ AI-1000':'表示：AI-1001 ～ AI-2000')+'（全'+all.length+'体）';
    };
    renderWrapped=true;
  }

  function makeTabs(){
    installPageTabs();
    if(document.getElementById('aiRangeTabs'))return;
    const list=document.getElementById('aiAccountList');
    if(!list)return;
    const panel=list.closest('.panel')||list.parentElement;
    if(!panel)return;
    const box=document.createElement('div');
    box.id='aiRangeTabs';
    box.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 12px;padding:8px;background:#0f172a;border:2px solid #475569;border-radius:12px;position:relative;z-index:9999;width:100%;box-sizing:border-box;';
    function btn(label,p){
      const b=document.createElement('button');
      b.type='button';b.textContent=label;b.dataset.page=p;
      b.style.cssText='flex:1 1 220px;min-height:44px;padding:9px 12px;border:2px solid #64748b;border-radius:10px;background:#1e293b;color:#fff;font-weight:1000;font-size:15px;cursor:pointer;touch-action:manipulation;display:block;visibility:visible;opacity:1;';
      b.addEventListener('click',()=>{page=p;updateButtons();if(typeof renderAIAccountList==='function')renderAIAccountList()});
      box.appendChild(b);return b;
    }
    const b1=btn('AI-0001 ～ AI-1000',0),b2=btn('AI-1001 ～ AI-2000',1);
    function updateButtons(){[b1,b2].forEach(b=>{const on=Number(b.dataset.page)===page;b.style.background=on?'#2563eb':'#1e293b';b.style.borderColor=on?'#93c5fd':'#64748b'});}
    updateButtons();
    const h1=panel.querySelector('h1');
    if(h1&&h1.nextSibling)panel.insertBefore(box,h1.nextSibling);else panel.insertBefore(box,panel.firstChild);
  }

  function installRankPatch(){
    if(rankWrapped||typeof renderRankLeaderboard!=='function')return;
    const originalRank=renderRankLeaderboard;
    window.renderRankLeaderboard=function(){
      originalRank();
      const board=document.getElementById('rankBoard');
      if(board){
        const rows=Array.isArray(aiProfiles)?aiProfiles.length:0;
        const old=board.previousElementSibling;
        if(old&&old.textContent&&old.textContent.trim()==='🏅 ランキング')old.textContent='🏅 ランキング（プレイヤー＋AI-0001～AI-'+String(Math.max(2000,rows)).padStart(4,'0')+'）';
      }
    };
    rankWrapped=true;
  }

  async function sync2000(){
    if(typeof aiProfiles==='undefined')return;
    try{
      const [r1,r2]=await Promise.all([getRows(0),getRows(1000)]);
      const rows=[...(Array.isArray(r1)?r1:[]),...(Array.isArray(r2)?r2:[])].sort((a,b)=>Number(a.account_id)-Number(b.account_id)).slice(0,2000);
      if(rows.length<1000)return;
      aiProfiles=rows.map(mapRow);
      if(typeof normalizeAIAccount==='function')aiProfiles=aiProfiles.map((a,i)=>normalizeAIAccount(a,i,i<500?1:2));
      aiProfiles.forEach((a,i)=>{const id=Number(String(a.accountId).replace(/\D/g,''))||i+1;a.tierLabel=tier(id)[0];a.personality=PERS[hash('p'+id)%PERS.length]});
      try{localStorage.setItem('kinoshitaAIProfilesV2',JSON.stringify(aiProfiles))}catch(e){}
      installPageTabs();
      installRankPatch();
      makeTabs();
      if(typeof renderAIAccountList==='function')renderAIAccountList();
      if(typeof renderRankLeaderboard==='function')renderRankLeaderboard();
      const c=document.getElementById('aiAccountCount');if(c)c.textContent=(page===0?'表示：AI-0001 ～ AI-1000':'表示：AI-1001 ～ AI-2000')+'（全'+aiProfiles.length+'体）';
      const m=document.getElementById('aiManageBtn');if(m)m.textContent='🤖 2000AIアカウントを確認';
      if(typeof saveRank==='function')saveRank();
    }catch(e){console.warn('AI2000同期失敗',e)}
  }

  function patchUI(){
    if(typeof cards!=='undefined')for(const c of REWARDS)if(!cards.some(x=>x&&x.name===c.name))cards.push(c);
    if(typeof allyTraits!=='undefined'){allyTraits['突撃ハーランド木下']='無';allyTraits['異常木下']='赤';allyTraits['吉田']='赤'}
    installPageTabs();
    installRankPatch();
    makeTabs();
    const c=document.getElementById('aiAccountCount');if(c&&typeof aiProfiles!=='undefined')c.textContent=(page===0?'表示：AI-0001 ～ AI-1000':'表示：AI-1001 ～ AI-2000')+'（全'+aiProfiles.length+'体）';
    const m=document.getElementById('aiManageBtn');if(m)m.textContent='🤖 2000AIアカウントを確認';
  }

  patchUI();
  setTimeout(sync2000,0);
  setInterval(()=>{try{patchUI()}catch(e){}},500);
})();
