const fs = require('node:fs');
const assert = require('node:assert/strict');

const kwl = fs.readFileSync('kwl.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /GAME_VERSION='v1\\.9\\.79'/);
assert.doesNotMatch(html, /<script src="\\.\\/kwl\\.js/, 'KWL is injected once by the service worker');
assert.match(sw, /kinoshita-daisen-v110/);
assert.match(sw, /kwl\\.js\\?v=20261118-local-rehearsal/);
assert.match(sw, /equipment\\.js[\\s\\S]*kwl\\.js/, 'KWL loads after equipment');
assert.match(kwl, /id="kwlStartRehearsal"/);
assert.match(kwl, /function kwlRehearsalSuppressPersistence\\(\\)/);
assert.match(kwl, /if\\(window\\.__KWL_REHEARSAL_ACTIVE\\)\\{kwlRehearsalFinish\\(!!win\\);return;\\}/);
assert.match(kwl, /function kwlRehearsalExit\\(\\)/);

const finishStart = kwl.indexOf('function kwlRehearsalFinish(win)');
const finishEnd = kwl.indexOf('function kwlRehearsalExit()', finishStart);
assert.ok(finishStart >= 0 && finishEnd > finishStart, 'rehearsal finish handler must exist');
const finish = kwl.slice(finishStart, finishEnd);
assert.doesNotMatch(finish, /rpc\\(|addStageXP\\(|syncPlayerRanking\\(/, 'rehearsal result handler must not submit results or grant rewards');

console.log('KWL local rehearsal isolation checks passed');
