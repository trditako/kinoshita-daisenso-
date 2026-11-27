const fs = require('node:fs');
const assert = require('node:assert/strict');

const kwl = fs.readFileSync('kwl.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const hastur = fs.readFileSync('hastur.js', 'utf8');

assert.match(html,/const GAME_VERSION='v1\.9\.\d+'/,'game version is declared');
assert.ok(!html.includes('<script src="./kwl.js'), 'KWL is not injected twice by index');
assert.match(sw,/CACHE_NAME=[\"']kinoshita-daisen-v\d+[\"']/,'service worker cache is versioned');
assert.ok(sw.includes('kwl.js?v=20261122-existing-operator-key'), 'service worker loads the new KWL script');
assert.ok(sw.includes('hastur.js?v=20261128-angel-god-runtime-sync'), 'service worker loads the refreshed Haster runtime');
const angelStart = hastur.indexOf("'天使神:木下':{");
const angelEnd = hastur.indexOf('}}};', angelStart);
assert.ok(angelStart >= 0 && angelEnd > angelStart, 'Angel God runtime override exists');
const angelPatch = hastur.slice(angelStart, angelEnd);
for (const value of ['damageCapRatio:.15','damageReflectRatio:.15','damageHealRatio:.15','highHpDamageReduction:.35','traitDamageReduction:.2','traitDamageBonus:8','最大HP100%','8倍ダメージ']) assert.ok(angelPatch.includes(value), 'Angel God override matches the current detail: '+value);
assert.ok(!angelPatch.includes('復活時HP50%'), 'Angel God runtime override must not restore the old description');

const injection = sw.slice(sw.indexOf('const inject='));
assert.ok(injection.indexOf('equipment.js') < injection.indexOf('kwl.js'), 'KWL loads after equipment');
assert.ok(kwl.includes("if(operator)html+='<section") && kwl.includes('id="kwlStartRehearsal"'), 'rehearsal button is rendered only for the operator');
assert.ok(kwl.includes('function kwlIsOperator()') && kwl.includes("if(!kwlIsOperator()){alert('リハーサルを開始できるのは運営アカウントのみです。');return;}"), 'rehearsal start handler independently enforces operator access');
assert.ok(kwl.includes('function kwlRehearsalSuppressPersistence()'), 'persistence suppression exists');
assert.ok(kwl.includes('if(window.__KWL_REHEARSAL_ACTIVE){kwlRehearsalFinish(!!win);return;}'), 'result handler bypasses normal rewards');
assert.ok(kwl.includes('function kwlRehearsalExit()'), 'rehearsal exit handler exists');

const finishStart = kwl.indexOf('function kwlRehearsalFinish(win)');
const finishEnd = kwl.indexOf('function kwlRehearsalExit()', finishStart);
assert.ok(finishStart >= 0 && finishEnd > finishStart, 'rehearsal finish handler must exist');
const finish = kwl.slice(finishStart, finishEnd);
assert.doesNotMatch(finish, /rpc\(|addStageXP\(|syncPlayerRanking\(/, 'rehearsal result handler must not submit results or grant rewards');

console.log('KWL local rehearsal isolation checks passed');
