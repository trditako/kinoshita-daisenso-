#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const genesis=fs.readFileSync(path.join(root,'genesis.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/validate-index.yml'),'utf8');

assert.ok(genesis.includes('function clearGenesisDetailSections()'),'詳細画面切替時の専用表示クリーナーを定義');
assert.ok(genesis.includes("panel?.querySelector('#genesisAbilityBook')?.remove()"),'創世木下の37能力欄を削除');
assert.ok(genesis.includes("panel?.querySelector('#genesisCounterAbilityInfo')?.remove()"),'創世討伐兵器・零式の対策能力欄を削除');
assert.ok(genesis.includes('showCharacterDetail=function(i){\n clearGenesisDetailSections();\n const result=_genesisOriginalShowCharacterDetail'),'通常キャラ詳細を開く前に前回表示を消去');
assert.ok(genesis.includes('showCharacterDetail=function(i){\n clearGenesisDetailSections();\n const result=_genesisCounterOriginalShowCharacterDetail'),'対策キャラ詳細を開く前にも前回表示を消去');

const start=html.indexOf('function renderFormationBuffSummary(){');
const end=html.indexOf('\nfunction renderFormation(){',start);
assert.ok(start>=0&&end>start,'編成効果サマリー関数を確認');
const summary=html.slice(start,end);
assert.ok(summary.includes('天使神:木下の編成効果'),'天使神の編成効果カードを表示');
assert.ok(summary.includes('自身以外の天使属性の味方'),'天使神の味方対象を明記');
assert.ok(summary.includes('+55%'),'天使神の味方強化率を表示');
assert.ok(summary.includes('最大+30%'),'天使神自身の強化上限を表示');
assert.ok(summary.includes('ノヴァ木下の編成効果'),'ノヴァの編成効果カードを表示');
assert.ok(summary.includes('初期所持金 +750'),'ノヴァの初期所持金ボーナスを表示');
assert.ok(summary.includes('覇風の編成バフ'),'覇風の既存編成効果表示を維持');
assert.ok(summary.includes('MiraiKの編成バフ'),'MiraiKの既存編成効果表示を維持');
assert.ok(summary.includes('狂乱の強化木下の編成・戦闘能力'),'狂乱の強化木下の既存表示を維持');
assert.ok(genesis.includes('genesisFormationSummary'),'創世木下の編成効果表示を維持');
assert.ok(html.includes("GAME_VERSION='v1.9.53'"),'ゲームバージョンを更新');
assert.ok(sw.includes('kinoshita-daisen-v70'),'Service Workerキャッシュを更新');
assert.ok(workflow.includes('node tests/formation-buff-summary.test.js'),'新しい回帰テストをCIに登録');
process.stdout.write('編成効果・詳細表示テスト成功：詳細欄の残留防止、天使神・ノヴァ・既存バフ表示を確認しました。\n');
