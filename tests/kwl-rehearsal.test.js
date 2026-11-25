const fs = require('node:fs');
const assert = require('node:assert/strict');

const kwl = fs.readFileSync('kwl.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.ok(html.includes("const GAME_VERSION='v1.9.85'"), 'game version updated');
assert.ok(!html.includes('<script src="./kwl.js'), 'KWL is not injected twice by index');
assert.ok(sw.includes('kinoshita-daisen-v128'), 'service worker cache is refreshed');
assert.ok(sw.includes('kwl.js?v=20261122-existing-operator-key'), 'service worker loads the new KWL script');
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
