'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const genesis = fs.readFileSync('genesis.js', 'utf8');
const hastur = fs.readFileSync('hastur.js', 'utf8');
const hitman = fs.readFileSync('hitman.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const kwl = JSON.parse(fs.readFileSync('supabase/functions/kwl-spectator-battle/character-data.json', 'utf8'));

assert.match(html, /const GAME_VERSION='v1\.9\.84'/);
assert.match(html, /version:'v1\.9\.82',title:"⚖️ KWL前・第2回キャラクターリバランス"/);
assert.match(html, /x\.details\.map\(i=>'<li>'\+i\+'<\/li>'\)/);
const targets = ['最高神:ハスター','創世木下','創世討伐兵器・零式','最高神:ゼウス','ヒットマン木下','狂乱のマッチョ木下','超越木下・創世神','覇風','アイスワイバーン','ノヴァ木下','天使神:木下'];
for (const name of targets) assert.ok(html.includes(name), '更新ログに対象キャラがある: ' + name);

assert.match(genesis, /genesisCard\.hp=450000;genesisCard\.atk=30000/);
assert.match(genesis, /genesisCounterCard\.hp=400000;genesisCounterCard\.atk=100000;genesisCounterCard\.range=900;genesisCounterCard\.interval=3\.8/);
assert.match(hastur, /const card=\{id:-1,name:NAME,cost:3500,hp:150000,atk:45750,range:150/);
assert.match(hitman, /name: NAME, cost: 2200, hp: 100000, atk: 8500, secondAtk: 5100/);
assert.match(hitman, /multiAttack: \[8500, 5100\]/);
assert.match(sw, /kinoshita-daisen-v126/);

assert.equal(kwl.length, 128, 'PRISM追加後もKWLキャラクターID順を維持');
const byName = Object.fromEntries(kwl.map(c => [c.name, c]));
assert.deepEqual([byName['創世木下'].id, byName['創世討伐兵器・零式'].id, byName['ヒットマン木下'].id, byName['アイスワイバーン'].id, byName['最高神:ゼウス'].id, byName['最高神:ハスター'].id], [116,117,118,119,120,121]);
assert.deepEqual([byName['最高神:ハスター'].hp, byName['最高神:ハスター'].atk], [150000,45750]);
assert.deepEqual([byName['創世木下'].hp, byName['創世木下'].atk], [450000,30000]);
assert.deepEqual([byName['創世討伐兵器・零式'].hp, byName['創世討伐兵器・零式'].atk], [400000,100000]);
assert.deepEqual([byName['最高神:ゼウス'].hp, byName['最高神:ゼウス'].atk], [160000,150000]);
assert.deepEqual([byName['ヒットマン木下'].hp, byName['ヒットマン木下'].atk], [100000,8500]);
for (const name of targets) assert.ok(byName[name], 'KWL観戦データに対象キャラがある: ' + name);

console.log('Pre-KWL v1.9.83 rebalance regression checks passed');
