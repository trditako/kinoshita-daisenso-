(function(){
'use strict';
if(typeof window!=='undefined'&&window.__KINOSHITA_BALANCE_V1__)return;
if(typeof window!=='undefined')window.__KINOSHITA_BALANCE_V1__=true;
if(!Array.isArray(cards))return;
const TIERS={
 normal:{hp:1.18,atk:1.22,recharge:.94},
 r:{hp:1.15,atk:1.18,recharge:.95},
 sr:{hp:1.11,atk:1.12,recharge:.97},
 ssr:{hp:1.03,atk:1.02,recharge:1.02},
 ur:{hp:.94,atk:.90,recharge:1.08},
 lr:{hp:.88,atk:.84,recharge:1.12}
};
const round=v=>Math.max(1,Math.round(Number(v)||1));
const tierOf=c=>{
 const r=String(c.rarity||'');
 if(r==='UR')return 'ur';
 if(r==='LR'||r==='伝説レア')return 'lr';
 if(r==='SSR'||r==='超激レア')return 'ssr';
 if(r==='SR'||r==='激レア')return 'sr';
 if(r==='R'||r==='レア')return 'r';
 return 'normal';
};
const scaleCard=(c,t)=>{
 if(!c||typeof c!=='object'||!Number.isFinite(Number(c.hp))||!Number.isFinite(Number(c.atk)))return;
 c.hp=round(c.hp*t.hp);
 c.atk=round(c.atk*t.atk);
 if(Number.isFinite(Number(c.recharge)))c.recharge=Math.max(1,Number((c.recharge*t.recharge).toFixed(2)));
 if(Number.isFinite(Number(c.secondAtk)))c.secondAtk=round(c.secondAtk*t.atk);
 if(Number.isFinite(Number(c.thirdAtk)))c.thirdAtk=round(c.thirdAtk*t.atk);
 if(Array.isArray(c.multiAttack))c.multiAttack=c.multiAttack.map(v=>round(v*t.atk));
 if(c.cost>=4000){c.hp=round(c.hp*.98);c.atk=round(c.atk*.95);if(Number.isFinite(Number(c.recharge)))c.recharge=Number((c.recharge*1.04).toFixed(2));}
 if(c.range>=300&&c.interval<=2&&c.atk>2000)c.atk=round(c.atk*.92);
 const ability=c.ability;
 if(ability&&typeof ability==='object'){
  for(const holder of [c,ability]){
   if(holder.strong&&typeof holder.strong==='object')for(const key of Object.keys(holder.strong))if(Number(holder.strong[key])>4.5)holder.strong[key]=4.5;
   if(holder.resist&&typeof holder.resist==='object')for(const key of Object.keys(holder.resist))if(Number(holder.resist[key])<.25)holder.resist[key]=.25;
   if(holder.damageReduce&&Number(holder.damageReduce.factor)<.25)holder.damageReduce.factor=.25;
  }
 }
};
for(const c of cards){
 if(!c||typeof c!=='object')continue;
 const t=TIERS[tierOf(c)];
 scaleCard(c,t);
 if(c.secondForm&&typeof c.secondForm==='object')scaleCard(c.secondForm,TIERS[tierOf(c.secondForm.rarity?c.secondForm:c)]);
}
if(typeof NORMAL_SECOND_FORMS!=='undefined'&&NORMAL_SECOND_FORMS&&typeof NORMAL_SECOND_FORMS==='object'){
 for(const [id,form] of Object.entries(NORMAL_SECOND_FORMS)){
  const base=cards[Number(id)];
  scaleCard(form,TIERS[tierOf(base||{})]);
 }
}
const byName=name=>cards.find(c=>c&&c.name===name)||cards.map(c=>c&&c.secondForm).find(c=>c&&c.name===name)||(
 typeof NORMAL_SECOND_FORMS!=='undefined'&&NORMAL_SECOND_FORMS?Object.values(NORMAL_SECOND_FORMS).find(c=>c&&c.name===name):null
);
const tune=(name,values,ability)=>{
 const c=byName(name);if(!c)return;
 for(const [key,factor] of Object.entries(values)){
  if(Number.isFinite(Number(c[key])))c[key]=key==='recharge'?Math.max(1,Number((c[key]*factor).toFixed(2))):round(c[key]*factor);
 }
 if(ability&&c.ability)for(const [key,value] of Object.entries(ability))c.ability[key]=value;
};
tune('創世木下',{hp:.55,atk:.45,interval:1.15,recharge:1.15});
tune('天使神:木下',{hp:.78,atk:.62,interval:1.08,recharge:1.18},{traitDamageBonus:3.5,damageCapRatio:.25,damageReflectRatio:.08,damageHealRatio:.08,highHpDamageReduction:.2});
tune('ノヴァ木下',{hp:.85,atk:.42,interval:1.15,recharge:1.15});
tune('覇風',{hp:.9,atk:.75,interval:1.15,recharge:1.12},{waveLevel:3,waveChance:.65});
tune('MiraiK',{hp:.95,atk:.85,interval:1.1,recharge:1.1},{wyvernStrongMultiplier:3,wyvernResistMultiplier:.4});
tune('大富豪木下',{hp:.9,atk:.5,interval:1.15,recharge:1.12},{criticalChance:.3,wyvernStrongMultiplier:3,hpBelowThresholdMultiplier:2.2});
tune('超越木下・創世神',{hp:.85,atk:.75,interval:1.08,recharge:1.1});
tune('狂乱の強化木下',{hp:.95,atk:.78,interval:1.08,recharge:1.1});
tune('狂乱のマッチョ木下',{hp:.95,atk:.82,interval:1.08,recharge:1.1});
// 直近ランクシーズン20の使用率・勝率を参照した低採用キャラの個別救済。
tune('呪木下',{hp:1.3,atk:1.35});
tune('前衛木下',{hp:1.2,atk:1.25,recharge:.9});
tune('天使迎撃木下',{hp:1.25,atk:1.3});
tune('未来探査木下',{hp:1.25,atk:1.35});
tune('日本防衛木下',{hp:1.15,atk:1.15});
tune('日本制圧木下',{hp:1.25,atk:1.35});
tune('哲学の賢者ゾクラテス',{hp:1.35,atk:1.35});
tune('最終攻略木下',{hp:1.25,atk:1.3});
const setTrait=(name,trait,strong,resist)=>{
 const c=byName(name);if(!c)return;
 const holder=c.ability&&c.ability.strong?c.ability:c;
 if(strong!=null&&holder.strong)holder.strong[trait]=strong;
 const resistance=c.ability&&c.ability.resist?c.ability:c;
 if(resist!=null&&resistance.resist)resistance.resist[trait]=resist;
};
setTrait('天使迎撃木下','天使',2.5,.5);
setTrait('未来探査木下','宇宙',2.5);
setTrait('日本防衛木下','無',2.0,.48);setTrait('日本防衛木下','赤',2.0,.48);
setTrait('日本制圧木下','無',2.4,.5);setTrait('日本制圧木下','赤',2.4,.5);setTrait('日本制圧木下','黒',2.4,.5);
setTrait('最終攻略木下','無',2.3,.48);setTrait('最終攻略木下','赤',2.3,.48);setTrait('最終攻略木下','黒',2.3,.48);setTrait('最終攻略木下','天使',2.3,.48);setTrait('最終攻略木下','宇宙',2.3,.48);
// 勝率が高めの呪王・銀河攻略は採用を維持しつつ、突出した妨害・特効倍率だけを小幅に抑える。
tune('呪王木下',{hp:.95,atk:.92},{curseDuration:2.5,attackDownChance:.3,curseSlowChance:.2,cursedAttackMultiplier:1.25});
setTrait('銀河攻略','宇宙',2.5);
const hitman=byName('ヒットマン木下');
if(hitman&&hitman.ability)hitman.ability.desc='神話属性に3倍ダメージ。神話属性から受けるダメージを65%軽減し、受けたHPダメージの35%を反射。呪い・停止・波動・反射を無効化。攻撃ごとに再出撃時間を1.5%短縮し、50円を獲得。攻撃した敵の回復を2秒封じる。敵撃破ごとに全ステータス+5%（最大+100%）。';
const genesis=byName('創世木下');
if(genesis&&genesis.ability){if(genesis.ability.strong)for(const k of Object.keys(genesis.ability.strong))genesis.ability.strong[k]=Math.min(1.6,Number(genesis.ability.strong[k])||1);if(genesis.ability.damageReduce)genesis.ability.damageReduce.factor=.25;}
const haifu=byName('覇風');
if(haifu){haifu.waveLevel=3;haifu.waveChance=.65;if(haifu.strong)for(const k of Object.keys(haifu.strong))haifu.strong[k]=Math.min(4,Number(haifu.strong[k])||1);if(haifu.resist)for(const k of Object.keys(haifu.resist))haifu.resist[k]=Math.max(.65,Number(haifu.resist[k])||1);}
if(haifu&&haifu.ability){
 const a=haifu.ability;
 if(a.haifuSkill){a.haifuSkill.chance=.1;a.haifuSkill.multiplier=2;a.haifuSkill.cooldown=16;}
 if(a.strong)for(const k of Object.keys(a.strong))a.strong[k]=Math.min(4,Number(a.strong[k])||1);
 if(a.resist)for(const k of Object.keys(a.resist))a.resist[k]=Math.max(.65,Number(a.resist[k])||1);
 a.desc='編成中のUR1体につき全味方のHP・攻撃力・移動速度・攻撃間隔+15%（最大+45%）。非UR1体につき覇風自身のHP・攻撃力・攻撃間隔・再生産時間+15%（最大+90%）。場にいる間、敵全体の攻撃力を20%低下。全味方に攻撃力35%分のパワーシールド。5回召喚ごとの全体攻撃は攻撃力150%、回復量は与ダメージの25%。成長は4秒ごとに+3%（最大+15%）。';
}
const angel=byName('天使神:木下');
if(angel&&angel.ability){
 if(angel.ability.strong)for(const k of Object.keys(angel.ability.strong))angel.ability.strong[k]=Math.min(3.5,Number(angel.ability.strong[k])||1);
 angel.ability.desc='天使編成数による自身強化は最大+20%。天使属性の味方への編成支援は各ステータス+25%。主要な妨害耐性、1回の被ダメージ上限25%、回復・反射は控えめに調整。古代・赤・黒・浮・神話に3.5倍ダメージ。';
}
const nova=byName('ノヴァ木下');
if(nova&&nova.ability){
 if(nova.ability.strong)for(const k of Object.keys(nova.ability.strong))nova.ability.strong[k]=Math.min(3,Number(nova.ability.strong[k])||1);
 if(nova.ability.resist)for(const k of Object.keys(nova.ability.resist))nova.ability.resist[k]=Math.max(.45,Number(nova.ability.resist[k])||1);
 nova.ability.desc='切り替え式の高火力キャラクター。破壊モードの基礎攻撃力と編成シナジーを抑え、連射モードは対空と継続火力を担当。黒・天使・神話・無属性に最大3倍。';
}
const mirai=byName('MiraiK');
if(mirai&&mirai.ability){
 mirai.ability.wyvernStrongMultiplier=3;mirai.ability.wyvernResistMultiplier=.4;
 mirai.ability.desc='距離装甲の軽減率を65%に調整。黒・浮・神話に3倍ダメージ、同属性からの被ダメージ60%軽減。単体攻撃への反撃倍率を抑制。天使属性の編成支援は従来どおり+10%。';
}
const rich=byName('大富豪木下');
if(rich&&rich.ability){
 rich.ability.wyvernStrongMultiplier=3;rich.ability.hpBelowThresholdMultiplier=2.2;
 rich.ability.desc='クリティカル率30%。浮・天使・神話に3倍ダメージ。HP50%未満で攻撃力2.2倍。主要な妨害耐性は維持。';
}
if(typeof CURRENT_CHARACTER_COUNT!=='undefined')try{CURRENT_CHARACTER_COUNT=cards.length;}catch(e){}
if(typeof window!=='undefined')window.KINOSHITA_BALANCE_REPORT={version:1,adjusted:cards.length};
})();