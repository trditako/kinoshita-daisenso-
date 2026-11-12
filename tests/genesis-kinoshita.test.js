#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'genesis.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const abilities=[...source.matchAll(/\{id:(\d+),name:'([^']+)'/g)].map(m=>({id:Number(m[1]),name:m[2]}));
assert.equal(abilities.length,37,'創世木下は37種類の能力を定義する');
assert.deepEqual(abilities.map(a=>a.id),Array.from({length:37},(_,i)=>i+1),'能力IDは1〜37で連番');
assert.equal(new Set(abilities.map(a=>a.name)).size,37,'能力名は重複しない');
for(const name of ['次元崩壊','神殺し','創世の一撃','絶対防壁','永遠の再生','不滅の創世','世界創造','終焉と始まり','天罰の雷','崩壊連鎖','次元追放','全軍蘇生','世界改変','万物の創造主']){
 assert.ok(abilities.some(a=>a.name===name),'能力が存在する: '+name);
}
assert.match(source,/name:GENESIS_NAME,cost:6000,hp:5000000,atk:250000/,'基本ステータスを定義');
assert.match(source,/cards\.push\(genesisCard\)/,'既存カードの末尾へ追加');
assert.match(source,/name:'創世神話'.*?rewardCharacter:GENESIS_NAME/s,'専用ステージのクリア報酬を設定');
assert.match(source,/name:'原初の虚無木下'/,'専用ステージのボスを定義');
assert.match(source,/enemyTypes\['創世木下・終焉形態'\]=\{[\s\S]*?hp:50000000,atk:200000,range:700/,'敵版創世木下の最終ボス性能を定義');
assert.match(source,/genesisFinalPhase2/,'HP50%で第二形態へ移行');
assert.match(source,/genesisFinalPhase3/,'HP25%で最終形態へ移行');
assert.match(source,/width:3600,baseHp:8000000/,'専用ステージを高難易度に調整');
assert.match(source,/enemy:'創世木下・終焉形態'/,'敵版創世木下を開幕ボスに設定');
assert.match(source,/genesisSelfRevived/,'自身の復活処理を実装');
assert.match(source,/genesisAllyReviveUsed/,'味方の復活処理を実装');
assert.match(source,/genesisNextEnergyAt/,'20秒ごとの創世エネルギーを実装');
assert.match(source,/genesisNextGrowthAt/,'60秒ごとの成長を実装');
assert.match(source,/genesisAbilityBook/,'37能力の詳細UIを実装');
assert.match(html,/\.\/genesis\.js\?v=20261111-ice-id-remap/,'ゲーム本体から能力スクリプトを読み込む');
assert.match(sw,/kinoshita-daisen-v92/,'Service Workerキャッシュを更新');
assert.match(sw,/\.\/genesis\.js/,'オフラインキャッシュへ能力スクリプトを追加');
process.stdout.write('創世木下テスト成功：37能力、ID、専用ステージ、報酬、UI、キャッシュを確認しました。\n');

assert.match(source,/name:GENESIS_COUNTER_NAME,cost:5200,hp:4500000,atk:700000,range:950/,'創世討伐兵器・零式の基本ステータス');
assert.match(source,/target\.name==='創世木下・終焉形態'\)dealt=Math\.round\(dealt\*20\)/,'終焉形態への専用特効20倍');
assert.match(source,/target\.trait==='神話'\)dealt=Math\.round\(dealt\*4\)/,'神話属性への特効4倍');
assert.match(source,/dealt=Math\.round\(dealt\*\.25\)/,'終焉形態からの被ダメージ75%軽減');
assert.match(source,/Math\.random\(\)<\.2/,'追加砲撃の発動率');
assert.match(source,/name:'創世討伐訓練'.*?rewardCharacter:GENESIS_COUNTER_NAME/s,'対策キャラクターの入手ステージ');
assert.match(source,/genesisCounterAbilityInfo/,'対策能力のキャラクター詳細UI');
