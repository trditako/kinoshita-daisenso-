#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','balance.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cards=[
 {name:'初期木下',cost:50,hp:100,atk:100,recharge:10},
 {name:'レア木下',rarity:'R',hp:100,atk:100,recharge:10},
 {name:'超激レア木下',rarity:'SSR',hp:100,atk:100,recharge:10},
 {name:'UR木下',rarity:'UR',hp:100,atk:100,recharge:10},
 {name:'LR木下',rarity:'LR',hp:100,atk:100,recharge:10},
 {name:'創世木下',rarity:'UR',hp:1600000,atk:70000,interval:2,recharge:180,ability:{strong:{神話:2.5},damageReduce:{factor:.1}}},
 {name:'天使神:木下',rarity:'UR',hp:200000,atk:28000,interval:3,recharge:320,ability:{strong:{神話:8}}},
 {name:'ノヴァ木下',rarity:'UR',hp:68000,atk:166666,interval:10,recharge:180,ability:{strong:{神話:5}}},
 {name:'覇風',rarity:'UR',hp:58500,atk:12500,interval:.6,recharge:32,ability:{strong:{赤:8},resist:{赤:.45},haifuSkill:{chance:.15,multiplier:3,cooldown:13}}},
 {name:'MiraiK',rarity:'UR',hp:69000,atk:2550,interval:2.5,recharge:65,ability:{wyvernStrongMultiplier:5,wyvernResistMultiplier:.25}},
 {name:'呪木下',rarity:'SSR',hp:3200,atk:620,ability:{curseDuration:4}},
 {name:'前衛木下',rarity:'R',hp:850,atk:72,recharge:3.8},
 {name:'天使迎撃木下',rarity:'R',hp:1250,atk:240,ability:{strong:{天使:2},resist:{天使:.55}}},
 {name:'未来探査木下',rarity:'SR',hp:1800,atk:360,ability:{strong:{宇宙:2}}},
 {name:'日本防衛木下',rarity:'SR',hp:4000,atk:400,ability:{strong:{無:1.8,赤:1.8},resist:{無:.5,赤:.5}}},
 {name:'日本制圧木下',rarity:'SSR',hp:5000,atk:650,ability:{strong:{無:2.2,赤:2.2,黒:2.2},resist:{無:.55,赤:.55,黒:.55}}},
 {name:'哲学の賢者ゾクラテス',rarity:'LR',hp:19500,atk:3200},
 {name:'最終攻略木下',rarity:'SSR',hp:7000,atk:950,ability:{strong:{無:2,赤:2,黒:2,天使:2,宇宙:2},resist:{無:.5,赤:.5,黒:.5,天使:.5,宇宙:.5}}},
 {name:'呪王木下',rarity:'SSR',hp:14000,atk:3800,ability:{curseDuration:3,attackDownChance:.4,curseSlowChance:.3,cursedAttackMultiplier:1.4}},
 {name:'銀河攻略',rarity:'SSR',hp:1,atk:1,ability:{strong:{宇宙:3}}},
 {name:'富豪木下',rarity:'LR',hp:30000,atk:1500,secondForm:{name:'大富豪木下',hp:85000,atk:300000,interval:20,recharge:150,ability:{criticalChance:.5,wyvernStrongMultiplier:5,hpBelowThresholdMultiplier:4}}},
 {name:'ヒットマン木下',rarity:'LR',hp:72000,atk:6200,secondAtk:3400,multiAttack:[6200,3400],ability:{desc:'old'}}
];
const originalOrder=cards.map(c=>c.name);
const normalSecondForms={0:{name:'木下・覚醒',hp:5000,atk:1200}};
const context={cards,window:{},NORMAL_SECOND_FORMS:normalSecondForms,CURRENT_CHARACTER_COUNT:cards.length};
vm.runInNewContext(source,context);
assert.deepEqual(cards.map(c=>c.name),originalOrder,'カード順・ID順を変更しない');
assert.ok(cards[0].hp>100&&cards[0].atk>100,'初期キャラを強化する');
assert.ok(cards[1].hp>100&&cards[1].atk>100,'レアを強化する');
assert.ok(cards[2].hp>100&&cards[2].atk>100,'超激レアを小幅強化する');
assert.ok(cards[3].hp<100&&cards[3].atk<100,'URを適度に抑える');
assert.ok(cards[4].hp<100&&cards[4].atk<100,'LRを適度に抑える');
assert.ok(cards[5].hp<2000000&&cards[5].atk<40000,'創世木下の突出した基礎性能を抑える');
assert.equal(cards[5].ability.strong.神話,1.6,'創世木下の属性倍率を抑える');
assert.equal(cards[5].ability.damageReduce.factor,.25,'過剰なダメージ軽減を抑える');
assert.ok(cards[6].atk<20000,'天使神を調整する');
assert.ok(cards[7].atk<70000,'ノヴァ木下を調整する');
assert.equal(cards[8].ability.haifuSkill.multiplier,2,'覇風の固有技倍率を調整する');
assert.equal(cards[8].ability.resist.赤,.65,'覇風の耐性を調整する');
assert.equal(cards[9].ability.wyvernStrongMultiplier,3,'MiraiKの特効倍率を調整する');
assert.ok(cards[10].hp>3200&&cards[10].atk>620,'使用率・勝率が低い呪木下を強化する');
assert.ok(cards[11].hp>850&&cards[11].atk>72,'前衛木下を強化する');
assert.equal(cards[12].ability.strong.天使,2.5,'天使迎撃木下の対天使性能を強化する');
assert.equal(cards[13].ability.strong.宇宙,2.5,'未来探査木下の対宇宙性能を強化する');
assert.ok(cards[14].hp>4000&&cards[14].atk>400,'日本防衛木下を小幅強化する');
assert.equal(cards[15].ability.strong.無,2.4,'日本制圧木下を強化する');
assert.ok(cards[16].hp>19500&&cards[16].atk>3200,'ゾクラテスを強化する');
assert.equal(cards[17].ability.strong.宇宙,2.3,'最終攻略木下を強化する');
assert.ok(cards[18].ability.attackDownChance<.4&&cards[18].ability.cursedAttackMultiplier<1.4,'呪王木下の妨害重複を抑える');
assert.equal(cards[19].ability.strong.宇宙,2.5,'銀河攻略の特効を適正化する');
assert.ok(cards[20].secondForm.atk<150000,'富豪木下の第二形態を弱体化する');
assert.equal(cards[20].secondForm.ability.wyvernStrongMultiplier,3,'大富豪木下の特効倍率を抑える');
assert.equal(cards[20].secondForm.ability.hpBelowThresholdMultiplier,2.2,'大富豪木下のHP条件倍率を抑える');
assert.ok(normalSecondForms[0].hp>5000&&normalSecondForms[0].atk>1200,'通常キャラの第二形態も強化する');
assert.match(cards[21].ability.desc,/5,208/,'ヒットマン木下の最終攻撃力表示を実数値に合わせる');
assert.match(html,/dealt=Math\.round\(dealt\*\.8\)/,'覇風の敵攻撃力20%低下を実装する');
assert.match(html,/haifuAttackDown/,'覇風の敵デバフを戦闘状態表示に反映する');
assert.equal(context.window.KINOSHITA_BALANCE_REPORT.adjusted,cards.length);
process.stdout.write('環境調整テスト成功：レアリティ別調整、上位キャラ弱体化、配列順維持を確認しました。\n');
