'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../battle-core.js');
const core = globalThis.KinoshitaBattleCore;
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('const enemyBaseStop=118;'), 'allied castle stop threshold is defined');
assert.ok(html.includes('stopped:isThousandStep||stopNow,minX:enemyBaseStop}),'), 'allied movement can reach the castle attack threshold');
assert.ok(html.includes("else if(u.x<=enemyBaseStop){u.state='base';"), 'allied units enter the base attack state at the same threshold');
assert.ok(html.includes('enemyHp-=u.atk;'), 'allied base attacks reduce enemy castle HP');

const threshold = 118;
const reached = core.advancePosition({x:120,speed:1,dt:.1,direction:-1,minX:threshold});
assert.equal(reached, threshold, 'a unit can reach the castle attack threshold');
assert.ok(reached <= threshold, 'the castle attack condition becomes reachable');
assert.equal(core.advancePosition({x:threshold,speed:1,dt:.1,direction:-1,minX:threshold}), threshold,
  'the unit remains at the attack position while waiting for its cooldown');
console.log('Allied castle attack regression tests passed');
