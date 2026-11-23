'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const genesis = fs.readFileSync('genesis.js', 'utf8');
const hastur = fs.readFileSync('hastur.js', 'utf8');
const hitman = fs.readFileSync('hitman.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /const GAME_VERSION='v1\\.9\\.82'/);
assert.match(html, /title:'⚖️ KWL前キャラクター中規模リバランス'/);\nassert.match(html, /version:'v1\\.9\\.82',title:"⚖️ KWL前・第2回キャラクターリバランス"/);\nfor (const name of ['最高神:ハスター','創世木下','創世討伐兵器・零式','最高神:ゼウス','ヒットマン木下','狂乱のマッチョ木下','超越木下・創世神','覇風','アイスワイバーン','ノヴァ木下','天使神:木下']) assert.match(html, new RegExp(name));
assert.match(html, /x\.details\.map\(i=>'<li>'\+i\+'<\/li>'\)/, 'アップデートログに詳細ボタンの内容を表示する');
assert.match(html, /hp:177385,atk:24374/, '天使神:木下のHP・攻撃力を15%低下');
assert.match(html, /成長1段階：全ステータスを15%上昇。成長2段階：さらに全ステータスを25%上昇。成長3段階：さらに全ステータスを40%上昇。/);
assert.match(html, /isAngelGod\?\[1\.15,1\.25,1\.4\]\[n-1\]/, '成長詳細の予測倍率');
assert.match(html, /ability='全ステータスを'\+\[15,25,40\]\[n-1\]/, '成長詳細の表示値');
assert.match(html, /const factor=\[1\.15,1\.25,1\.4\]\[stage\]/, '戦闘中の成長倍率');
assert.match(html, /hp:49725,atk:11250,range:90,spd:1\.3/, '覇風の新性能');
assert.match(html, /cost:1400,hp:86250,atk:3825,range:150,spd:\.8,interval:1\.8,recharge:40/, 'MiraiKの新性能');
assert.match(html, /6885\*\(detailStat\('atk'\)\/11125\)/, 'ヒットマン木下の2段目詳細表示を新攻撃力に同期');

assert.match(genesis, /name:GENESIS_NAME,cost:6000,hp:1500000,atk:50000,range:650/);
assert.match(genesis, /genesisCard\.hp=450000;genesisCard\.atk=30000/);
assert.match(genesis, /name:GENESIS_COUNTER_NAME,cost:5200,hp:900000,atk:210000,range:950/);
assert.match(genesis, /genesisCounterCard\.hp=400000;genesisCounterCard\.atk=100000;genesisCounterCard\.range=900;genesisCounterCard\.interval=3\.8/);

assert.match(hastur, /const card=\\{id:-1,name:NAME,cost:3500,hp:150000,atk:45750,range:150/);
assert.match(hastur, /Object\\.assign\\(rebalanceHasturCard/);

assert.match(hitman, /name: NAME, cost: 2200, hp: 100000, atk: 8500, secondAtk: 5100/);
assert.match(hitman, /multiAttack: \[8500, 5100\], range: 220, spd: 0\.8, interval: 0\.8/);
assert.match(hitman, /recharge: 70/);
assert.match(hitman, /6885 \/ 11125/, '2段目のレベル補正率');
assert.match(sw, /kinoshita-daisen-v122/);
console.log('Pre-KWL character rebalance regression checks passed');
