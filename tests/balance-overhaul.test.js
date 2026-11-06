#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','balance.js'),'utf8');
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
 {name:'MiraiK',rarity:'UR',hp:69000,atk:2550,interval:2.5,recharge:65,ability:{wyvernStrongMultiplier:5,wyvernResistMultiplier:.25}}
];
const originalOrder=cards.map(c=>c.name);
const context={cards,window:{},CURRENT_CHARACTER_COUNT:cards.length};
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
assert.equal(context.window.KINOSHITA_BALANCE_REPORT.adjusted,cards.length);
process.stdout.write('環境調整テスト成功：レアリティ別調整、上位キャラ弱体化、配列順維持を確認しました。\n');
