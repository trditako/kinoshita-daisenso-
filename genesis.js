(function(){
'use strict';
const GENESIS_NAME='創世木下';
const GENESIS_ABILITY_DEFS=[
 {id:1,name:'次元崩壊',desc:'攻撃時50%で通常攻撃の200%の追加攻撃'},
 {id:2,name:'神殺し',desc:'全属性に2.5倍ダメージ'},
 {id:3,name:'創世の一撃',desc:'10%で通常攻撃の500%の追加攻撃'},
 {id:4,name:'空間断裂',desc:'範囲内の敵をまとめて攻撃'},
 {id:5,name:'絶対防壁',desc:'被ダメージ90%軽減。主要な妨害・能力封印に耐性'},
 {id:6,name:'永遠の再生',desc:'自身の最大HPの1%を毎秒回復'},
 {id:7,name:'不滅の創世',desc:'撃破時に一度だけ最大HPの50%で復活'},
 {id:8,name:'ダメージ変換',desc:'実際に受けたHPダメージの10%を回復'},
 {id:9,name:'時間支配',desc:'攻撃時30%で敵全体を3秒停止'},
 {id:10,name:'全能の呪縛',desc:'攻撃した敵の攻撃力・移動速度を50%低下、攻撃間隔を2倍。10秒'},
 {id:11,name:'能力封印',desc:'攻撃時20%で敵の特殊能力を5秒封印'},
 {id:12,name:'重力支配',desc:'攻撃範囲内の敵の移動速度を80%低下。5秒'},
 {id:13,name:'歴史の頂点',desc:'編成中、味方全員のHP・攻撃力を50%上昇'},
 {id:14,name:'全軍再生',desc:'出撃中、味方全員の最大HPの0.5%を毎秒回復'},
 {id:15,name:'神速の祝福',desc:'編成中、味方全員の移動速度を20%上昇'},
 {id:16,name:'世界創造',desc:'出撃20秒ごとに攻撃力+20%。最大3段階'},
 {id:17,name:'終焉と始まり',desc:'HP25%以下で一度覚醒。攻撃力2倍、攻撃間隔0.5秒、被ダメージ95%軽減。20秒'},
 {id:18,name:'天罰の雷',desc:'5回の攻撃動作ごとに敵全体へ攻撃力300%の雷撃'},
 {id:19,name:'無限貫通',desc:'範囲攻撃で射程内の敵すべてを攻撃'},
 {id:20,name:'崩壊連鎖',desc:'敵撃破時、周囲へ攻撃力200%の爆発'},
 {id:21,name:'神域の追撃',desc:'攻撃時25%で通常攻撃の50%の追撃を3回'},
 {id:22,name:'存在消去',desc:'攻撃時5%で通常攻撃の500%の追加ダメージ'},
 {id:23,name:'七彩神壁',desc:'10秒ごとに最大HPの10%分のシールドを獲得'},
 {id:24,name:'絶対領域',desc:'自身の周囲の味方の被ダメージを30%軽減'},
 {id:25,name:'災厄吸収',desc:'自身への状態異常を50%の確率で無効化し、HP5%回復'},
 {id:26,name:'不動の神体',desc:'停止・鈍足・吹っ飛ばし・ワープなど主要妨害を無効化'},
 {id:27,name:'終末装甲',desc:'HP50%以下で被ダメージをさらに20%軽減'},
 {id:28,name:'永劫拘束',desc:'攻撃時15%で敵を5秒停止'},
 {id:29,name:'神威剥奪',desc:'攻撃した敵の強化効果を10秒間無効化'},
 {id:30,name:'空間封鎖',desc:'攻撃時、敵のワープ・瞬間移動能力を8秒封印'},
 {id:31,name:'永久刻印',desc:'攻撃した敵が受けるダメージを30%増加。10秒'},
 {id:32,name:'次元追放',desc:'攻撃時5%で敵を3秒間戦場から退場させる'},
 {id:33,name:'全軍蘇生',desc:'味方1体をステージ中一度だけHP30%で復活'},
 {id:34,name:'創世の加護',desc:'編成中、味方全員の状態異常を50%の確率で無効化'},
 {id:35,name:'無限供給',desc:'編成中、味方の再生産時間を15%短縮'},
 {id:36,name:'世界改変',desc:'開始30秒後から20秒ごとに敵全体へランダムな弱体効果'},
 {id:37,name:'万物の創造主',desc:'60秒ごとに攻撃力・最大HPが10%上昇。最大5段階'}
];
const GENESIS_TRAITS=['無','赤','青','黒','浮','鋼','天使','宇宙','古代','神話','ゾンビ','光','闇','白'];
const genesisStrong={};
for(const trait of GENESIS_TRAITS)genesisStrong[trait]=2.5;
let genesisIndex=cards.findIndex(c=>c&&c.name===GENESIS_NAME);
if(genesisIndex<0){
 const genesisCard={
  name:GENESIS_NAME,cost:6000,hp:5000000,atk:250000,range:650,spd:1.5,interval:2.0,recharge:180,
  icon:'🌌',motion:'super',attackType:'area',kb:1,trait:'神話',rarity:'UR',series:'創世神話',
  specialReward:true,eventReward:'創世木下',genesisAbilities:GENESIS_ABILITY_DEFS,
  ability:{
   name:'創世の37能力',desc:'37種類の固有能力を持つ歴代最強キャラクター。詳細はキャラクター詳細画面を確認。',
   genesis:true,strong:genesisStrong,damageReduce:{chance:1,factor:.1},
   curseImmune:true,stopImmune:true,slowImmune:true,attackDownImmune:true,sealImmune:true,
   waveImmune:true,waveImmunity:true,surgeImmune:true,surgeImmunity:true,
   knockbackImmune:true,warpImmune:true,yabayabaImmune:true,reflectImmune:true
  }
 };
 cards.push(genesisCard);
 genesisIndex=cards.length-1;
 if(Array.isArray(charLevel)&&!Number.isFinite(Number(charLevel[genesisIndex])))charLevel[genesisIndex]=1;
 if(Array.isArray(charMaxLevel)&&!Number.isFinite(Number(charMaxLevel[genesisIndex])))charMaxLevel[genesisIndex]=20;
 if(Array.isArray(charForm)&&!Number.isFinite(Number(charForm[genesisIndex])))charForm[genesisIndex]=1;
 if(Array.isArray(normalEvolved)&&normalEvolved[genesisIndex]===undefined)normalEvolved[genesisIndex]=false;
 if(Array.isArray(ownedFlags)&&ownedFlags[genesisIndex]===undefined)ownedFlags[genesisIndex]=false;
 if(Array.isArray(rechargeLeft)&&rechargeLeft[genesisIndex]===undefined)rechargeLeft[genesisIndex]=0;
}
const genesisCard=cards[genesisIndex];
genesisCard.id=genesisIndex;
genesisCard.genesisAbilities=GENESIS_ABILITY_DEFS;
genesisCard.ability={...(genesisCard.ability||{}),genesis:true,strong:genesisStrong,damageReduce:{chance:1,factor:.1},
 curseImmune:true,stopImmune:true,slowImmune:true,attackDownImmune:true,sealImmune:true,
 waveImmune:true,waveImmunity:true,surgeImmune:true,surgeImmunity:true,
 knockbackImmune:true,warpImmune:true,yabayabaImmune:true,reflectImmune:true};
try{CURRENT_CHARACTER_COUNT=cards.length;}catch(e){}
try{
 const savedNames=Array.isArray(ownedCharacterNamesAtBoot)?ownedCharacterNamesAtBoot:[];
 if(Array.isArray(ownedFlags)){
  while(ownedFlags.length<=genesisIndex)ownedFlags.push(false);
  if(savedNames.includes(GENESIS_NAME))ownedFlags[genesisIndex]=true;
 }
 if(Array.isArray(charLevel)){
  const lv=Number(charLevel[genesisIndex]);charLevel[genesisIndex]=Number.isFinite(lv)&&lv>=1?Math.floor(lv):1;
 }
 if(Array.isArray(charMaxLevel))charMaxLevel[genesisIndex]=Math.max(20,Math.min(30,Number(charMaxLevel[genesisIndex])||20));
 if(Array.isArray(charForm))charForm[genesisIndex]=Number(charForm[genesisIndex])===2?2:1;
 if(Array.isArray(normalEvolved))normalEvolved[genesisIndex]=!!normalEvolved[genesisIndex];
 const savedFormation=Array.isArray(formationStableNamesAtBoot)?formationStableNamesAtBoot:(Array.isArray(formationCharacterNamesAtBoot)?formationCharacterNamesAtBoot:[]);
 if(savedNames.includes(GENESIS_NAME)&&savedFormation.includes(GENESIS_NAME)&&ownedFlags?.[genesisIndex]){
  formation=[genesisIndex,...formation.filter(i=>i!==genesisIndex)].slice(0,10);
  if(typeof normalizeFormation==='function')normalizeFormation();
 }
 if(typeof saveFormationStableNames==='function')saveFormationStableNames();
 if(typeof syncOwnedCount==='function')syncOwnedCount();
}catch(e){console.warn('Genesis Kinoshita save restoration skipped',e);}
enemyTypes['原初の虚無木下']=enemyTypes['原初の虚無木下']||{
 name:'原初の虚無木下',icon:'🌑',trait:'神話',hp:950000,atk:26000,range:520,spd:.2,interval:2.4,
 attackType:'area',kb:3,money:1800,boss:true,
 ability:{wave:true,waveLevel:6,waveChance:1,stopChance:.35,stopDuration:2,slowChance:.45,slowFactor:.5,slowDuration:4,
  curseChance:.35,curseDuration:4,attackDownChance:.35,attackDownFactor:.5,attackDownDuration:5,
  damageReduce:{chance:1,factor:.55},waveImmune:true,surgeImmune:true,knockbackImmune:true}
};
enemyTypes['創世木下・終焉形態']={
 name:'創世木下・終焉形態',icon:'🌌',trait:'神話',hp:50000000,atk:200000,range:700,spd:.18,interval:1.2,
 attackType:'area',kb:1,money:50000,boss:true,
 ability:{
  wave:true,waveLevel:10,waveChance:1,stopChance:.5,stopDuration:3,
  slowChance:.65,slowFactor:.35,slowDuration:5,
  curseChance:.5,curseDuration:6,attackDownChance:.5,attackDownFactor:.4,attackDownDuration:6,
  damageReduce:{chance:1,factor:.35},
  waveImmune:true,waveImmunity:true,surgeImmune:true,surgeImmunity:true,
  knockbackImmune:true,stopImmune:true,slowImmune:true,curseImmune:true,
  sealImmune:true,warpImmune:true,reflectImmune:true
 }
};
const genesisFinalStage={
 name:'創世神話',width:3600,baseHp:8000000,xp:75000,eventReward:GENESIS_NAME,rewardCharacter:GENESIS_NAME,
 enemies:['創世木下・終焉形態','原初の虚無木下','天照大神','古代神木下','酒呑童子','めっちゃ木下'],
 schedule:[
  {t:0,enemy:'創世木下・終焉形態',mult:1,fixedMultiplier:true,role:'boss'},
  {t:7,enemy:'めっちゃ木下',mult:90,fixedMultiplier:true},
  {t:14,enemy:'天照大神',mult:18,fixedMultiplier:true},
  {t:22,enemy:'原初の虚無木下',mult:5,fixedMultiplier:true,role:'boss'},
  {t:32,enemy:'古代神木下',mult:24,fixedMultiplier:true},
  {t:45,enemy:'酒呑童子',mult:28,fixedMultiplier:true},
  {t:60,enemy:'めっちゃ木下',mult:120,fixedMultiplier:true},
  {t:78,enemy:'天照大神',mult:28,fixedMultiplier:true},
  {t:95,enemy:'原初の虚無木下',mult:8,fixedMultiplier:true,role:'boss'},
  {t:115,enemy:'古代神木下',mult:35,fixedMultiplier:true}
 ],
 repeatSpawns:[
  {start:38,interval:22,enemy:'めっちゃ木下',mult:100,fixedMultiplier:true},
  {start:52,interval:34,enemy:'天照大神',mult:22,fixedMultiplier:true},
  {start:72,interval:48,enemy:'酒呑童子',mult:24,fixedMultiplier:true}
 ]
};
const genesisStageIndex=eventStages.findIndex(st=>st&&st.name==='創世神話');
if(genesisStageIndex>=0)eventStages[genesisStageIndex]=genesisFinalStage;
else eventStages.push(genesisFinalStage);
function genesisInFormation(){
 return Array.isArray(formation)&&formation.includes(genesisIndex)&&typeof hasCharacter==='function'&&hasCharacter(genesisIndex);
}
function genesisAlive(){
 return Array.isArray(units)?units.find(u=>u&&!u.isEnemy&&u.name===GENESIS_NAME&&u.hp>0):null;
}
function genesisRefreshUnit(unit){
 if(!unit)return;
 try{
  if(unit.el){
   const hp=unit.el.querySelector('.hp i');if(hp)hp.style.width=Math.max(0,unit.hp/Math.max(1,unit.maxhp||1)*100)+'%';
   const label=unit.el.querySelector('.hpLabel');if(label)label.textContent=Math.ceil(unit.hp).toLocaleString()+' / '+Math.ceil(unit.maxhp||0).toLocaleString();
  }
  if(typeof updateBarrierDisplay==='function')updateBarrierDisplay(unit);
  if(typeof updatePowerShieldDisplay==='function')updatePowerShieldDisplay(unit);
  if(typeof updateStatusMark==='function')updateStatusMark(unit);
 }catch(e){}
}
function genesisSetMark(target,icon,label,duration,type){
 if(typeof setStatusMark==='function')setStatusMark(target,icon,label,duration,type);
}
function genesisClearDebuff(target,type){
 if(!target)return;
 if(type==='stop'){target.stopUntil=0;target.spd=target.spdOriginal??target.spd;}
 if(type==='slow'){target.slowUntil=0;target.slowFactor=1;}
 if(type==='attackDown'){target.attackDownUntil=0;target.attackDownFactor=1;}
 if(type==='curse'){target.cursedUntil=0;target.cursedSpeedFactor=1;target.cursedAttackFactor=1;}
 if(type==='abilitySeal')target.abilitySealedUntil=0;
 if(type==='warp'){target.warpUntil=0;target.warpedUntil=0;}
 if(target.statuses&&typeof target.statuses==='object')delete target.statuses[type];
}
const _genesisOriginalSetStatusMark=setStatusMark;
setStatusMark=function(target,icon,label,duration,type){
 const kind=String(type||'');
 const isGenesis=!!target&&!target.isEnemy&&target.name===GENESIS_NAME;
 const isGuarded=!!target&&!target.isEnemy&&target.genesisStatusGuard;
 const debuff=['debuff','stop','slow','attackDown','curse','abilitySeal','warp','rangeDown','knockback'].includes(kind);
 if(debuff&&(isGenesis||isGuarded)){
  const full=isGenesis&&['stop','slow','warp','knockback'].includes(kind);
  if(full||Math.random()<.5){
   genesisClearDebuff(target,kind);
   if(isGenesis||isGuarded)target.hp=Math.min(Number(target.maxhp||1),Number(target.hp||0)+(isGenesis?Number(target.maxhp||1)*.05:Number(target.maxhp||1)*.02));
   genesisRefreshUnit(target);
   return;
  }
 }
 return _genesisOriginalSetStatusMark(target,icon,label,duration,type);
};
function genesisApplyFormationBuff(unit){
 if(!unit||unit.isEnemy||unit.genesisFormationApplied||!genesisInFormation())return;
 const ratio=Number(unit.maxhp)>0?Number(unit.hp||0)/Number(unit.maxhp):1;
 unit.maxhp=Math.max(1,Math.round(Number(unit.maxhp||1)*1.5));
 unit.hp=Math.max(1,Math.round(unit.maxhp*ratio));
 unit.atk=Math.max(1,Math.round(Number(unit.atk||1)*1.5));
 unit.spd=Number(unit.spd||0)*1.2;
 unit.genesisStatusGuard=true;
 unit.genesisFormationApplied=true;
 if(unit.name===GENESIS_NAME){
  unit.genesisCoreAtk=unit.atk;unit.genesisCoreMaxHp=unit.maxhp;unit.genesisBaseInterval=unit.interval;
  unit.genesisNextEnergyAt=(typeof stageTime==='number'?stageTime:0)+20;
  unit.genesisNextGrowthAt=(typeof stageTime==='number'?stageTime:0)+60;
  unit.genesisNextShieldAt=(typeof stageTime==='number'?stageTime:0)+10;
  unit.genesisWorldPulseAt=(typeof stageTime==='number'?stageTime:0)+30;
 }
 genesisRefreshUnit(unit);
}
function genesisApplyFormationToAll(){
 if(!genesisInFormation()||!Array.isArray(units))return;
 for(const unit of units)genesisApplyFormationBuff(unit);
}
function genesisStop(target,duration){
 if(!target||target.hp<=0||target.stopImmune||target.ability?.stopImmune)return;
 const now=performance.now()/1000;
 target.stopUntil=Math.max(Number(target.stopUntil||0),now+duration);
 target.spdOriginal=target.spdOriginal??target.spd;
 genesisSetMark(target,'⏸️','停止',duration,'stop');
}
function genesisSlow(target,factor,duration){
 if(!target||target.hp<=0||target.slowImmune||target.ability?.slowImmune)return;
 const now=performance.now()/1000;
 target.slowUntil=Math.max(Number(target.slowUntil||0),now+duration);
 target.slowFactor=Math.min(Number(target.slowFactor??1),factor);
 genesisSetMark(target,'🐌','移動速度低下',duration,'slow');
}
function genesisAttackDown(target,factor,duration){
 if(!target||target.hp<=0||target.attackDownImmune||target.ability?.attackDownImmune)return;
 const now=performance.now()/1000;
 target.attackDownUntil=Math.max(Number(target.attackDownUntil||0),now+duration);
 target.attackDownFactor=Math.min(Number(target.attackDownFactor??1),factor);
 genesisSetMark(target,'⬇️','攻撃力低下',duration,'attackDown');
}
function genesisSeal(target,duration){
 if(!target||target.hp<=0||target.sealImmune||target.ability?.sealImmune)return;
 const now=performance.now()/1000;
 target.abilitySealedUntil=Math.max(Number(target.abilitySealedUntil||0),now+duration);
 genesisSetMark(target,'🔒','能力封印',duration,'abilitySeal');
}
function genesisClearEnemyBuffs(target){
 if(!target)return;
 target.genesisBuffSuppressedUntil=performance.now()/1000+10;
 if(target.statuses&&typeof target.statuses==='object'){
  for(const key of Object.keys(target.statuses)){
   if(['attackBoost','defenseBoost','buff','damageBoost','speedBoost','shieldBoost'].includes(key))delete target.statuses[key];
  }
 }
 for(const key of ['attackBoostUntil','defenseBoostUntil','damageBoostUntil','speedBoostUntil','shieldBoostUntil']){
  if(key in target)target[key]=0;
 }
 genesisSetMark(target,'🌑','強化効果無効',10,'genesisBuffNull');
}
function genesisBanish(target){
 if(!target||target.hp<=0||target.genesisBanishedUntil>performance.now()/1000)return;
 const now=performance.now()/1000,originalX=Number(target.x||0),token=now+3;
 target.genesisBanishedUntil=token;target.genesisBanishedX=originalX;
 target.spawnProtectedUntil=token;target.x=-500;
 genesisSetMark(target,'🌀','次元追放',3,'genesisBanish');
 setTimeout(()=>{
  if(target&&target.hp>0&&target.genesisBanishedUntil===token&&Array.isArray(enemies)&&enemies.includes(target)){
   target.x=target.genesisBanishedX;target.genesisBanishedUntil=0;target.spawnProtectedUntil=0;
   if(target.el)target.el.style.left=target.x+'px';
   genesisRefreshUnit(target);
  }
 },3000);
}
function genesisScheduleDeadEnemyCleanup(){
 setTimeout(()=>{
  if(!Array.isArray(enemies))return;
  for(const enemy of [...enemies])if(enemy&&enemy.hp<=0&&enemies.includes(enemy))removeEnemy(enemy);
 },0);
}
function genesisOnAttack(source,target,dealt,beforeHp,afterHp){
 if(!source||source.name!==GENESIS_NAME||!target||!target.isEnemy||isAbilitySealed(source))return;
 const now=performance.now()/1000;
 let needsCleanup=false;
 const attackToken=Math.floor(performance.now()/50);
 if(source.genesisLastAttackToken!==attackToken){
  source.genesisLastAttackToken=attackToken;
  source.genesisHitCount=Number(source.genesisHitCount||0)+1;
 }
 // ① 次元崩壊
 if(Math.random()<.5&&target.hp>0)_genesisOriginalHit(target,Math.max(1,Math.round(dealt*2)),source,{genesisInternal:true});
 // ③ 創世の一撃
 if(target.hp>0&&Math.random()<.1)_genesisOriginalHit(target,Math.max(1,Math.round(dealt*5)),source,{genesisInternal:true});
 // ⑱ 天罰の雷：5ヒットごとに敵全体へ攻撃力300%
 if(source.genesisHitCount%5===0&&source.genesisThunderToken!==attackToken){
  source.genesisThunderToken=attackToken;
  for(const enemy of [...enemies]){
   if(!enemy||enemy.hp<=0)continue;
   _genesisOriginalHit(enemy,Math.max(1,Math.round(source.atk*3)),source,{genesisInternal:true});
   if(enemy.hp<=0)needsCleanup=true;
  }
  if(typeof popup==='function')popup('⚡ 天罰の雷',source.x,90,'criticalPop');
 }
 // ⑳ 崩壊連鎖
 if(beforeHp>0&&afterHp<=0){
  for(const enemy of [...enemies]){
   if(!enemy||enemy===target||enemy.hp<=0||Math.abs(Number(enemy.x||0)-Number(target.x||0))>180)continue;
   _genesisOriginalHit(enemy,Math.max(1,Math.round(source.atk*2)),source,{genesisInternal:true});
   if(enemy.hp<=0)needsCleanup=true;
  }
  if(typeof popup==='function')popup('💥 崩壊連鎖',target.x,90,'criticalPop');
 }
 // ㉑ 神域の追撃
 if(target.hp>0&&Math.random()<.25){
  for(let n=0;n<3&&target.hp>0;n++)_genesisOriginalHit(target,Math.max(1,Math.round(dealt*.5)),source,{genesisInternal:true});
 }
 // ㉒ 存在消去
 if(target.hp>0&&Math.random()<.05)_genesisOriginalHit(target,Math.max(1,Math.round(dealt*5)),source,{genesisInternal:true});
 // ⑨ 時間支配
 if(Math.random()<.3){
  for(const enemy of enemies)genesisStop(enemy,3);
 }
 // ⑩ 全能の呪縛
 if(target.hp>0){
  genesisAttackDown(target,.5,10);genesisSlow(target,.5,10);
  if(target.genesisBaseInterval==null)target.genesisBaseInterval=Number(target.interval||1);
  target.interval=Math.max(Number(target.interval||1),Number(target.genesisBaseInterval||1)*2);
  target.genesisIntervalDebuffUntil=now+10;
  if(typeof applyCurseStatus==='function')applyCurseStatus({ability:{curseChance:1,curseDuration:10}},target);
 }
 // ⑪ 能力封印
 if(target.hp>0&&Math.random()<.2)genesisSeal(target,5);
 // ⑫ 重力支配
 if(target.hp>0)genesisSlow(target,.2,5);
 // ㉘ 永劫拘束
 if(target.hp>0&&Math.random()<.15)genesisStop(target,5);
 // ㉙ 神威剥奪
 genesisClearEnemyBuffs(target);
 // ㉚ 空間封鎖
 if(target.hp>0&&Math.random()<.2)genesisSeal(target,8);
 // ㉛ 永久刻印
 if(target.hp>0){
  target.genesisVulnerabilityUntil=now+10;
  genesisSetMark(target,'🎯','被ダメージ+30%',10,'genesisVulnerability');
 }
 // ㉜ 次元追放
 if(target.hp>0&&Math.random()<.05)genesisBanish(target);
 if(needsCleanup)genesisScheduleDeadEnemyCleanup();
}
const _genesisOriginalHit=hit;
hit=function(target,damage,source,abilitySource){
 const before=Number(target?.hp||0);
 const sourceIsGenesis=source?.name===GENESIS_NAME&&!abilitySource?.genesisInternal;
 const targetIsGenesis=target?.name===GENESIS_NAME&&!target?.isEnemy;
 const result=_genesisOriginalHit(target,damage,source,abilitySource);
 const after=Number(target?.hp||0);
 if(sourceIsGenesis&&target?.isEnemy&&before>after){
  genesisOnAttack(source,target,Math.max(1,before-after),before,after);
 }
 if(targetIsGenesis&&source?.isEnemy&&before>after&&target.hp>0){
  // ⑧ ダメージ変換：実際のHPダメージの10%を回復
  target.hp=Math.min(target.maxhp,target.hp+Math.round((before-after)*.1));
  genesisRefreshUnit(target);
 }
 return result;
};
const _genesisOriginalDamageTakenBy=damageTakenBy;
damageTakenBy=function(target,attacker){
 let dealt=_genesisOriginalDamageTakenBy(target,attacker);
 const now=performance.now()/1000;
 if(target?.genesisAuraActive&&!target.isEnemy)dealt=Math.round(dealt*.7);
 if(target?.name===GENESIS_NAME&&!target.isEnemy&&target.hp<=target.maxhp*.5&&!(target.genesisAwakenedUntil>now))dealt=Math.round(dealt*.8);
 return Math.max(1,dealt);
};
const _genesisOriginalDamageAgainst=damageAgainst;
damageAgainst=function(source,target,baseAtk){
 let dealt=_genesisOriginalDamageAgainst(source,target,baseAtk);
 const now=performance.now()/1000;
 if(source?.name===GENESIS_NAME&&target?.genesisVulnerabilityUntil>now)dealt=Math.round(dealt*1.3);
 return Math.max(1,dealt);
};
const _genesisOriginalRemoveUnit=removeUnit;
removeUnit=function(unit){
 if(unit&&!unit.isEnemy&&unit.name===GENESIS_NAME&&!unit.genesisSelfRevived){
  // ⑦ 不滅の創世：自身は一度だけ最大HPの50%で復活
  unit.genesisSelfRevived=true;unit.hp=Math.max(1,Math.round(unit.maxhp*.5));
  genesisSetMark(unit,'♾️','不滅の創世：復活済み',999999,'genesisRevive');
  genesisRefreshUnit(unit);
  if(typeof popup==='function')popup('♾️ 創世木下が復活！',unit.x,90,'criticalPop');
  return;
 }
 const creator=genesisAlive();
 if(unit&&!unit.isEnemy&&unit.name!==GENESIS_NAME&&creator&&!creator.genesisAllyReviveUsed&&!unit.genesisAllyRevived){
  // ㉝ 全軍蘇生：味方1体をステージ中一度だけHP30%で復活
  creator.genesisAllyReviveUsed=true;unit.genesisAllyRevived=true;
  unit.hp=Math.max(1,Math.round(unit.maxhp*.3));
  genesisSetMark(unit,'🌟','全軍蘇生：復活済み',999999,'genesisAllyRevive');
  genesisRefreshUnit(unit);
  if(typeof popup==='function')popup('🌟 全軍蘇生！ '+unit.name,unit.x,90,'criticalPop');
  return;
 }
 return _genesisOriginalRemoveUnit(unit);
};
const _genesisOriginalDeploy=deploy;
deploy=function(i){
 if(i===genesisIndex&&Array.isArray(units)&&units.some(u=>u&&!u.isEnemy&&u.name===GENESIS_NAME&&u.hp>0))return;
 const before=new Set((Array.isArray(units)?units:[]).map(u=>u.id));
 const result=_genesisOriginalDeploy(i);
 if(genesisInFormation()){
  genesisApplyFormationToAll();
  const created=(Array.isArray(units)?units:[]).find(u=>u&&!before.has(u.id));
  if(created&&Array.isArray(rechargeLeft)&&Number.isFinite(Number(rechargeLeft[i])))rechargeLeft[i]=Math.max(0,Number(rechargeLeft[i])*.85);
 }
 return result;
};
const _genesisOriginalShowCharacterDetail=showCharacterDetail;
showCharacterDetail=function(i){
 const result=_genesisOriginalShowCharacterDetail(i);
 if(i!==genesisIndex)return result;
 const root=document.getElementById('detail'),panel=root?.querySelector('.panel')||root;
 if(!panel)return result;
 panel.querySelector('#genesisAbilityBook')?.remove();
 const section=document.createElement('section');section.id='genesisAbilityBook';
 section.style.cssText='margin:10px 0;padding:12px;border:2px solid #7c3aed;border-radius:12px;background:linear-gradient(135deg,#111827,#312e81);color:#fff;text-align:left';
 const heading=document.createElement('h3');heading.textContent='🌌 創世木下・37種類の固有能力';heading.style.cssText='margin:0 0 8px;font-size:17px';section.appendChild(heading);
 const list=document.createElement('div');list.style.cssText='display:grid;grid-template-columns:1fr;gap:6px';
 for(const ability of GENESIS_ABILITY_DEFS){
  const item=document.createElement('article');item.style.cssText='padding:7px 9px;border:1px solid #a5b4fc66;border-radius:8px;background:#ffffff0d';
  const title=document.createElement('b');title.textContent=String(ability.id).padStart(2,'0')+'　'+ability.name;title.style.display='block';
  const desc=document.createElement('div');desc.textContent=ability.desc;desc.style.cssText='font-size:12px;line-height:1.45;color:#e0e7ff;margin-top:3px';
  item.append(title,desc);list.appendChild(item);
 }
 section.appendChild(list);panel.appendChild(section);
 return result;
};
const _genesisOriginalRenderFormationBuffSummary=renderFormationBuffSummary;
renderFormationBuffSummary=function(){
 const result=_genesisOriginalRenderFormationBuffSummary();
 const el=document.getElementById('formationBuffSummary');
 if(el){
  el.querySelector('#genesisFormationSummary')?.remove();
  if(genesisInFormation()){
   const card=document.createElement('article');card.id='genesisFormationSummary';card.className='formationBuffCard';
   card.style.cssText='grid-column:1/-1;border:2px solid #7c3aed;background:#f5f3ff;color:#312e81;padding:10px;border-radius:10px';
   card.innerHTML='<h3>🌌 創世木下の編成効果</h3><div><b>全味方：</b>HP・攻撃力 +50%、移動速度 +20%、再生産時間 -15%</div><div><b>状態異常：</b>50%の確率で無効化</div><div><b>編成制限：</b>創世木下は同時に1体まで出撃可能</div>';
   el.appendChild(card);
  }
 }
 return result;
};
let genesisLastTick=performance.now()/1000;
setInterval(()=>{
 const now=performance.now()/1000,dt=Math.max(0,Math.min(1,now-genesisLastTick));genesisLastTick=now;
 if(typeof running==='undefined'||!running||(typeof paused!=='undefined'&&paused))return;
 if(Array.isArray(enemies)){
  for(const enemy of enemies){
   if(enemy?.genesisIntervalDebuffUntil&&enemy.genesisIntervalDebuffUntil<=now){
    enemy.interval=Number(enemy.genesisBaseInterval||enemy.interval||1);
    enemy.genesisIntervalDebuffUntil=0;
   }
   if(enemy?.isEnemy&&enemy.name==='創世木下・終焉形態'&&enemy.hp>0){
    if(!Number.isFinite(Number(enemy.genesisFinalBaseAtk)))enemy.genesisFinalBaseAtk=Number(enemy.atk||200000);
    if(!Number.isFinite(Number(enemy.genesisFinalBaseInterval)))enemy.genesisFinalBaseInterval=Number(enemy.interval||1.2);
    const ratio=Number(enemy.hp)/Math.max(1,Number(enemy.maxhp||enemy.hp));
    if(ratio<=.5&&!enemy.genesisFinalPhase2){
     enemy.genesisFinalPhase2=true;
     enemy.atk=Math.round(enemy.genesisFinalBaseAtk*1.8);
     enemy.interval=Math.max(.55,enemy.genesisFinalBaseInterval*.72);
     if(enemy.ability?.damageReduce)enemy.ability.damageReduce.factor=.2;
     if(enemy.ability)enemy.ability.waveLevel=12;
     genesisSetMark(enemy,'🌑','第二形態：世界崩壊',999999,'genesisFinalPhase');
     if(typeof popup==='function')popup('🌑 創世木下・世界崩壊',enemy.x,80,'criticalPop');
     genesisRefreshUnit(enemy);
    }
    if(ratio<=.25&&!enemy.genesisFinalPhase3){
     enemy.genesisFinalPhase3=true;
     enemy.atk=Math.round(enemy.genesisFinalBaseAtk*2.6);
     enemy.interval=Math.max(.35,enemy.genesisFinalBaseInterval*.48);
     enemy.range=Math.max(Number(enemy.range||0),850);
     if(enemy.ability?.damageReduce)enemy.ability.damageReduce.factor=.1;
     if(enemy.ability){enemy.ability.waveLevel=15;enemy.ability.stopChance=.75;enemy.ability.stopDuration=4;enemy.ability.surge=true;enemy.ability.surgeChance=.5;}
     genesisSetMark(enemy,'🔥','最終形態：終焉と創世',999999,'genesisFinalPhase');
     if(typeof popup==='function')popup('🔥 創世木下・終焉と創世',enemy.x,80,'criticalPop');
     genesisRefreshUnit(enemy);
    }
   }
  }
 }
 const creator=genesisAlive();
 if(!creator)return;
 if(!isAbilitySealed(creator)){
  // ⑥ 永遠の再生
  creator.hp=Math.min(creator.maxhp,creator.hp+creator.maxhp*.01*dt);
 }
 // ⑭ 全軍再生、㉔ 絶対領域、㉞ 創世の加護
 for(const ally of units){
  if(!ally||ally.isEnemy||ally.hp<=0)continue;
  ally.genesisStatusGuard=genesisInFormation();
  ally.genesisAuraActive=Math.abs(Number(ally.x||0)-Number(creator.x||0))<=180;
  if(ally!==creator){
   const beforeHeal=ally.hp;
   ally.hp=Math.min(ally.maxhp,ally.hp+ally.maxhp*.005*dt);
   if(ally.hp>beforeHeal)genesisRefreshUnit(ally);
  }
 }
 // ⑯ 世界創造：20秒ごとに攻撃力+20%、最大3段階
 if(stageTime>=Number(creator.genesisNextEnergyAt||Infinity)&&Number(creator.genesisEnergyStacks||0)<3){
  creator.genesisEnergyStacks=Number(creator.genesisEnergyStacks||0)+1;
  creator.genesisNextEnergyAt+=20;
 }
 // ㊲ 万物の創造主：60秒ごとに攻撃力・最大HP+10%、最大5段階
 if(stageTime>=Number(creator.genesisNextGrowthAt||Infinity)&&Number(creator.genesisGrowthStacks||0)<5){
  const ratio=creator.hp/Math.max(1,creator.maxhp);
  creator.genesisGrowthStacks=Number(creator.genesisGrowthStacks||0)+1;
  creator.genesisNextGrowthAt+=60;
  creator.maxhp=Math.round(creator.genesisCoreMaxHp*Math.pow(1.1,creator.genesisGrowthStacks));
  creator.hp=Math.max(1,Math.round(creator.maxhp*ratio));
 }
 const energy=1+.2*Number(creator.genesisEnergyStacks||0);
 const growth=1+.1*Number(creator.genesisGrowthStacks||0);
 if(creator.hp<=creator.maxhp*.25&&!creator.genesisAwakeningUsed){
  // ⑰ 終焉と始まり
  creator.genesisAwakeningUsed=true;creator.genesisAwakenedUntil=now+20;
  creator.interval=.5;
  if(creator.ability?.damageReduce)creator.ability.damageReduce.factor=.05;
  genesisSetMark(creator,'🔥','終焉と始まり：覚醒',20,'genesisAwakening');
  if(typeof popup==='function')popup('🔥 創世木下・覚醒！',creator.x,80,'criticalPop');
 }
 if(creator.genesisAwakenedUntil&&creator.genesisAwakenedUntil<=now){
  creator.genesisAwakenedUntil=0;creator.interval=Number(creator.genesisBaseInterval||2);
  if(creator.ability?.damageReduce)creator.ability.damageReduce.factor=.1;
 }
 creator.atk=Math.max(1,Math.round(Number(creator.genesisCoreAtk||creator.atk)*energy*growth*(creator.genesisAwakenedUntil>now?2:1)));
 // ㉓ 七彩神壁：10秒ごとに最大HPの10%シールドを補充
 if(stageTime>=Number(creator.genesisNextShieldAt||Infinity)){
  creator.barrierMax=Math.max(Number(creator.barrierMax||0),Math.round(creator.maxhp*.1));
  creator.barrier=Math.max(Number(creator.barrier||0),Math.round(creator.maxhp*.1));
  creator.genesisNextShieldAt+=10;
  genesisRefreshUnit(creator);
 }
 // ㊱ 世界改変：開始30秒後から20秒ごとに敵全体へランダム弱体
 if(stageTime>=Number(creator.genesisWorldPulseAt||Infinity)){
  const effects=['stop','slow','attackDown','seal'];
  const chosen=effects[Math.floor(Math.random()*effects.length)];
  for(const enemy of enemies){
   if(!enemy||enemy.hp<=0)continue;
   if(chosen==='stop')genesisStop(enemy,2);
   else if(chosen==='slow')genesisSlow(enemy,.5,5);
   else if(chosen==='attackDown')genesisAttackDown(enemy,.5,5);
   else genesisSeal(enemy,3);
  }
  creator.genesisWorldPulseAt+=20;
  if(typeof popup==='function')popup('🌌 世界改変：'+chosen,creator.x,75,'criticalPop');
 }
 genesisRefreshUnit(creator);
},250);
try{
 if(typeof save==='function')save();
 if(typeof renderCards==='function')renderCards();
 if(typeof renderOwnedStart==='function')renderOwnedStart();
 if(typeof renderStageSelect==='function')renderStageSelect();
 if(typeof renderFormationBuffSummary==='function')renderFormationBuffSummary();
}catch(e){console.warn('Genesis Kinoshita initialization UI refresh failed',e);}
window.GENESIS_KINOSHITA_TEST_API={index:genesisIndex,abilities:GENESIS_ABILITY_DEFS};
}

// 創世木下対策専用キャラクター
const GENESIS_COUNTER_NAME='創世討伐兵器・零式';
let genesisCounterIndex=cards.findIndex(c=>c&&c.name===GENESIS_COUNTER_NAME);
if(genesisCounterIndex<0){
 const genesisCounterCard={
  name:GENESIS_COUNTER_NAME,cost:5200,hp:4500000,atk:700000,range:950,spd:.35,interval:3.2,recharge:240,
  icon:'🛡️',motion:'super',attackType:'area',kb:2,trait:'無',rarity:'UR',series:'創世神話',
  specialReward:true,eventReward:GENESIS_COUNTER_NAME,
  ability:{
   name:'終焉特化・創世核破壊',
   desc:'創世木下・終焉形態に20倍、その他の神話属性に4倍のダメージ。終焉形態から受けるダメージを75%軽減。波動・停止・鈍足・呪い・攻撃力低下・能力封印・吹っ飛ばし・ワープを無効化。攻撃時20%で攻撃力300%の追加砲撃。',
   genesisCounter:true,
   stopImmune:true,slowImmune:true,curseImmune:true,attackDownImmune:true,sealImmune:true,
   waveImmune:true,waveImmunity:true,surgeImmune:true,surgeImmunity:true,
   knockbackImmune:true,warpImmune:true
  }
 };
 cards.push(genesisCounterCard);
 genesisCounterIndex=cards.length-1;
}
const genesisCounterCard=cards[genesisCounterIndex];
genesisCounterCard.id=genesisCounterIndex;
genesisCounterCard.ability={
 ...(genesisCounterCard.ability||{}),
 name:'終焉特化・創世核破壊',
 desc:'創世木下・終焉形態に20倍、その他の神話属性に4倍のダメージ。終焉形態から受けるダメージを75%軽減。波動・停止・鈍足・呪い・攻撃力低下・能力封印・吹っ飛ばし・ワープを無効化。攻撃時20%で攻撃力300%の追加砲撃。',
 genesisCounter:true,
 stopImmune:true,slowImmune:true,curseImmune:true,attackDownImmune:true,sealImmune:true,
 waveImmune:true,waveImmunity:true,surgeImmune:true,surgeImmunity:true,
 knockbackImmune:true,warpImmune:true
};
try{
 if(Array.isArray(charLevel)&&!Number.isFinite(Number(charLevel[genesisCounterIndex])))charLevel[genesisCounterIndex]=1;
 if(Array.isArray(charMaxLevel)&&!Number.isFinite(Number(charMaxLevel[genesisCounterIndex])))charMaxLevel[genesisCounterIndex]=30;
 if(Array.isArray(charForm)&&!Number.isFinite(Number(charForm[genesisCounterIndex])))charForm[genesisCounterIndex]=1;
 if(Array.isArray(normalEvolved)&&normalEvolved[genesisCounterIndex]===undefined)normalEvolved[genesisCounterIndex]=false;
 if(Array.isArray(ownedFlags)){
  while(ownedFlags.length<=genesisCounterIndex)ownedFlags.push(false);
  const savedNames=Array.isArray(ownedCharacterNamesAtBoot)?ownedCharacterNamesAtBoot:[];
  if(savedNames.includes(GENESIS_COUNTER_NAME))ownedFlags[genesisCounterIndex]=true;
 }
 if(Array.isArray(rechargeLeft)&&!Number.isFinite(Number(rechargeLeft[genesisCounterIndex])))rechargeLeft[genesisCounterIndex]=0;
 CURRENT_CHARACTER_COUNT=cards.length;
}catch(e){console.warn('Genesis counter save restoration skipped',e);}
enemyTypes['創世討伐訓練用・虚無木下']=enemyTypes['創世討伐訓練用・虚無木下']||{
 name:'創世討伐訓練用・虚無木下',icon:'🌑',trait:'神話',hp:1900000,atk:52000,range:520,spd:.2,interval:2.4,
 attackType:'area',kb:3,money:3000,boss:true,
 ability:{wave:true,waveLevel:5,waveChance:1,stopChance:.25,stopDuration:1.5,
  slowChance:.3,slowFactor:.6,slowDuration:3,damageReduce:{chance:1,factor:.55},
  waveImmune:true,surgeImmune:true,knockbackImmune:true}
};
const genesisCounterStage={
 name:'創世討伐訓練',width:2600,baseHp:2500000,xp:45000,
 eventReward:GENESIS_COUNTER_NAME,rewardCharacter:GENESIS_COUNTER_NAME,
 enemies:['創世討伐訓練用・虚無木下','めっちゃ木下','天照大神','酒呑童子'],
 schedule:[
  {t:0,enemy:'創世討伐訓練用・虚無木下',mult:1,fixedMultiplier:true,role:'boss'},
  {t:6,enemy:'めっちゃ木下',mult:35,fixedMultiplier:true},
  {t:14,enemy:'天照大神',mult:10,fixedMultiplier:true},
  {t:24,enemy:'酒呑童子',mult:12,fixedMultiplier:true},
  {t:38,enemy:'めっちゃ木下',mult:45,fixedMultiplier:true}
 ],
 repeatSpawns:[
  {start:48,interval:28,enemy:'めっちゃ木下',mult:40,fixedMultiplier:true},
  {start:58,interval:42,enemy:'天照大神',mult:10,fixedMultiplier:true}
 ]
};
const genesisCounterStageIndex=eventStages.findIndex(st=>st&&st.name==='創世討伐訓練');
if(genesisCounterStageIndex>=0)eventStages[genesisCounterStageIndex]=genesisCounterStage;
else eventStages.push(genesisCounterStage);

// 与ダメージ補正。終焉形態の最終段階でも有効な専用特効。
const _genesisCounterOriginalDamageAgainst=damageAgainst;
damageAgainst=function(source,target,baseAtk){
 let dealt=_genesisCounterOriginalDamageAgainst(source,target,baseAtk);
 if(source?.name===GENESIS_COUNTER_NAME&&target?.isEnemy){
  if(target.name==='創世木下・終焉形態')dealt=Math.round(dealt*20);
  else if(target.trait==='神話')dealt=Math.round(dealt*4);
 }
 return Math.max(1,dealt);
};
// 終焉形態からの被ダメージを75%軽減。
const _genesisCounterOriginalDamageTakenBy=damageTakenBy;
damageTakenBy=function(target,attacker){
 let dealt=_genesisCounterOriginalDamageTakenBy(target,attacker);
 if(target?.name===GENESIS_COUNTER_NAME&&attacker?.isEnemy&&attacker.name==='創世木下・終焉形態'){
  dealt=Math.round(dealt*.25);
 }
 return Math.max(1,dealt);
};
// 20%で攻撃力300%の追加砲撃。内部追加攻撃では再抽選しない。
const _genesisCounterOriginalHit=hit;
hit=function(target,damage,source,abilitySource){
 const result=_genesisCounterOriginalHit(target,damage,source,abilitySource);
 if(source?.name===GENESIS_COUNTER_NAME&&target?.isEnemy&&target.hp>0&&
    !abilitySource?.genesisCounterInternal&&Math.random()<.2){
  _genesisOriginalHit(target,Math.max(1,Math.round(Number(source.atk||0)*3)),source,{genesisCounterInternal:true});
  if(typeof popup==='function')popup('🛡️ 創世核破壊・追加砲撃',target.x,85,'criticalPop');
 }
 return result;
};
const _genesisCounterOriginalShowCharacterDetail=showCharacterDetail;
showCharacterDetail=function(i){
 const result=_genesisCounterOriginalShowCharacterDetail(i);
 if(i!==genesisCounterIndex)return result;
 const root=document.getElementById('detail'),panel=root?.querySelector('.panel')||root;
 if(!panel)return result;
 panel.querySelector('#genesisCounterAbilityInfo')?.remove();
 const section=document.createElement('section');section.id='genesisCounterAbilityInfo';
 section.style.cssText='margin:10px 0;padding:12px;border:2px solid #0f766e;border-radius:12px;background:linear-gradient(135deg,#082f49,#134e4a);color:#fff;text-align:left';
 const heading=document.createElement('h3');heading.textContent='🛡️ 創世木下・終焉形態 対策能力';heading.style.cssText='margin:0 0 8px;font-size:17px';
 const body=document.createElement('div');body.style.cssText='font-size:13px;line-height:1.7';
 body.textContent='終焉形態への特効20倍／神話属性への特効4倍。終焉形態からの被ダメージ75%軽減。波動・停止・鈍足・呪い・攻撃力低下・能力封印・吹っ飛ばし・ワープ無効。攻撃時20%で攻撃力300%の追加砲撃。';
 const note=document.createElement('p');note.style.cssText='margin:8px 0 0;color:#a7f3d0;font-size:12px';note.textContent='入手方法：イベント「創世討伐訓練」クリア報酬';
 section.append(heading,body,note);panel.appendChild(section);
 return result;
};
try{
 if(typeof save==='function')save();
 if(typeof renderCards==='function')renderCards();
 if(typeof renderOwnedStart==='function')renderOwnedStart();
 if(typeof renderStageSelect==='function')renderStageSelect();
}catch(e){console.warn('Genesis counter initialization UI refresh failed',e);}

})();