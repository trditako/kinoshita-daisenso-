#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'character-skills.js'),'utf8');
const cards=[
 {name:'MiraiK',ability:{name:'反転・再反転',desc:'距離装甲：攻撃者との距離が150以上なら被ダメージ85%軽減。攻撃時50%で2秒呪い、50%で2秒停止。敵に攻撃するたび攻撃間隔を0.1秒短縮。天使属性時の攻撃で75%発動「反転」：現在HPの150%分のダメージ。黒属性時の攻撃で75%発動「再反転」：敵攻撃力+自身攻撃力分のダメージ。'}},
 {name:'ヒットマン木下',ability:{name:'神話狩り・追跡戦術',desc:'神話属性に5倍ダメージ。出撃時、0.2秒間隔で3回追跡マーカーを飛ばし、命中した敵に攻撃力500%のダメージ。敵撃破ごとに全ステータス+10%。'}},
 {name:'ノヴァ木下',ability:{name:'切り替え・破壊砲・ミニガン',desc:'初期所持金+750。敵撃破で破壊欲を獲得。5個で破壊砲を発射。攻撃時15%でミニガン発動。'}},
 {name:'狂乱のマッチョ木下',ability:{name:'双腕拘束',desc:'被弾ごとに防御力+5%。右手：最高攻撃力の敵を拘束し、CT45秒。左手：最高HPの敵を拘束し、CT75秒。'}},
 {name:'超越木下・時空王',ability:{name:'因果反転',desc:'戦闘中に初めて致命傷を受けたとき、1回だけ復活し、3秒間無敵。'}},
 {name:'超越木下・創世神',ability:{name:'創世律動',desc:'12秒ごとに1回発動する。味方全員のHPを3%回復し、敵全員に攻撃力20%分の追加ダメージ。'}},
 {name:'通常木下',ability:{name:'赤にめっぽう強い',desc:'赤属性への攻撃1.5倍・被ダメージ0.5倍'}},
 {name:'KBR既存スキル',skills:[{id:'kbr_periodic',name:'時刻の蹄音',description:'20秒ごとに停止',trigger:'定期発動'}],ability:{name:'騎乗特性',desc:'悪天候による減速を軽減。'}},
 {name:'MiraiK重複確認',skills:[{id:'miraiK_reverse',name:'反転',description:'既存の反転スキル',trigger:'攻撃時'}],ability:{name:'反転',desc:'天使属性時の攻撃で75%発動「反転」：現在HPの150%分の追加ダメージ。'}}
];
const context={cards};
vm.runInNewContext(source,context);
const mirai=cards[0];
assert.ok(mirai.skills.some(s=>s.name==='反転'&&s.chance===.75),'MiraiKの反転スキル');
assert.ok(mirai.skills.some(s=>s.name==='再反転'&&s.chance===.75),'MiraiKの再反転スキル');
assert.ok(mirai.skills.some(s=>s.trigger==='攻撃時'),'MiraiKの攻撃時発動スキル');
assert.ok(mirai.ability.desc.includes('距離装甲'),'MiraiKの固有能力を維持');
assert.ok(!mirai.ability.desc.includes('反転'),'MiraiKのスキル説明を能力欄から分離');
const hitman=cards[1];
assert.ok(hitman.skills.some(s=>s.name==='追跡マーカー'&&s.count===3&&s.interval===.2),'ヒットマンの出撃スキル');
assert.ok(hitman.skills.some(s=>s.name==='撃破成長'),'ヒットマンの撃破成長');
assert.ok(hitman.skills.some(s=>s.id==='hitman_counter'&&s.chance===.25&&s.cooldown===15&&s.damageMultiplier===15&&s.healRatio===.5),'ヒットマンの転移反撃');
assert.ok(hitman.skills.some(s=>s.id==='hitman_ride'&&s.interval===15&&s.duration===3&&s.description.includes('出撃時')),'ヒットマンの乗馬');
assert.ok(hitman.ability.desc.includes('神話属性に5倍'),'ヒットマンの常時特性を能力欄に維持');
assert.ok(!hitman.ability.desc.includes('追跡マーカー'),'ヒットマンのスキル説明を能力欄から分離');
assert.ok(cards[2].skills.some(s=>s.name==='破壊砲')&&cards[2].skills.some(s=>s.name==='ミニガン'),'ノヴァの特殊攻撃をスキル化');
assert.ok(cards[3].skills.some(s=>s.name==='右手拘束')&&cards[3].skills.some(s=>s.name==='左手拘束'),'狂乱のマッチョ木下の双腕スキル');
assert.ok(cards[4].skills.some(s=>s.name==='因果反転'),'時空王の復活スキル');
assert.ok(cards[5].skills.some(s=>s.name==='創世律動'),'創世神の定期発動スキル');
assert.equal(cards[6].skills,undefined,'戦闘スキルのないキャラにスキル欄を追加しない');
assert.equal(cards[7].skills.length,1,'既存KBRスキルを重複させない');
assert.ok(cards[7].ability.desc.includes('悪天候'),'既存KBR固有能力を維持');
assert.equal(cards[8].skills.length,1,'既存の同名スキルを重複登録しない');
const count=hitman.skills.length;
vm.runInNewContext(source,context);
assert.equal(hitman.skills.length,count,'二重実行してもスキルを重複登録しない');
process.stdout.write('キャラクタースキルテスト成功：全体移行、MiraiK、ヒットマン、ノヴァ、双腕拘束、創世系、既存スキル維持を確認しました。\n');
