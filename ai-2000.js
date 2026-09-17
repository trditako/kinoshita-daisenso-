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
      if(typeof renderAIAccountList==='function')renderAIAccountList();
      const c=document.getElementById('aiAccountCount');if(c)c.textContent='表示：'+aiProfiles.length+' / 2000アカウント';
      if(typeof saveRank==='function')saveRank();
    }catch(e){console.warn('AI2000同期失敗',e)}
  }
  function patchUI(){
    if(typeof cards!=='undefined')for(const c of REWARDS)if(!cards.some(x=>x&&x.name===c.name))cards.push(c);
    if(typeof allyTraits!=='undefined'){allyTraits['突撃ハーランド木下']='無';allyTraits['異常木下']='赤';allyTraits['吉田']='赤'}
    const c=document.getElementById('aiAccountCount');if(c&&typeof aiProfiles!=='undefined')c.textContent='表示：'+aiProfiles.length+' / 2000アカウント';
  }
  patchUI();setTimeout(sync2000,0);setInterval(()=>{try{patchUI()}catch(e){}},1000);
})();
