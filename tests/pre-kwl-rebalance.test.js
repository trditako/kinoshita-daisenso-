'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const genesis = fs.readFileSync('genesis.js', 'utf8');
const hastur = fs.readFileSync('hastur.js', 'utf8');
const hitman = fs.readFileSync('hitman.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /const GAME_VERSION='v1\.9\.81'/);
assert.match(html, /title:'⚖️ KWL前キャラクター中規模リバランス'/);
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
assert.match(genesis, /genesisCard\.hp=1500000;genesisCard\.atk=50000/);
assert.match(genesis, /name:GENESIS_COUNTER_NAME,cost:5200,hp:900000,atk:210000,range:950/);
assert.match(genesis, /genesisCounterCard\.hp=900000;genesisCounterCard\.atk=210000/);

assert.match(hastur, /const card=\{id:-1,name:NAME,cost:3500,hp:200000,atk:61000,range:150/);
assert.match(hastur, /Object\.assign\(rebalanceHasturCard,\{cost:3500,hp:200000,atk:61000,range:150\}\)/);

assert.match(hitman, /name: NAME, cost: 2000, hp: 124540, atk: 11125, secondAtk: 6885/);
assert.match(hitman, /multiAttack: \[11125, 6885\], range: 220, spd: 0\.8, interval: 0\.7/);
assert.match(hitman, /recharge: 59/);
assert.match(hitman, /6885 \/ 11125/, '2段目のレベル補正率');
assert.match(sw, /kinoshita-daisen-v121/);
console.log('Pre-KWL character rebalance regression checks passed');
