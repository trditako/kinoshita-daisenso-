'use strict';
const assert=require('node:assert/strict');
require('../battle-core.js');
const core=globalThis.KinoshitaBattleCore;
assert.ok(core,'shared battle runtime is registered');
assert.equal(core.version,'1.1.0');
assert.equal(core.scaleLevelStat(100,1),100);
assert.equal(core.scaleLevelStat(100,2),104);
assert.equal(core.scaleLevelStat(100,3,1),100,'non-growing stats stay constant across levels');
assert.deepEqual(core.traits('赤・黒,浮'),['赤','黒','浮']);
assert.equal(core.hasTrait({trait:'赤・黒'},'黒'),true);
assert.equal(core.hasTrait({trait:'赤・黒'},'天使'),false);
assert.equal(core.matchesTrait({trait:'赤・黒'},['天使','黒']),true);
assert.equal(core.matchesTrait({trait:'赤・黒'},'*'),true);
assert.equal(core.tableMatches({赤:0.5},{trait:'赤・黒'}),true);
assert.equal(core.traitMultiplier({赤:1.5,黒:2},{trait:'赤・黒'},'max'),2);
assert.equal(core.traitMultiplier({赤:1.5,黒:2},{trait:'赤・黒'},'min'),1.5);
assert.equal(core.traitMultiplier({'*':1.8},{trait:'無'}),1.8);
const baseAttack=core.calculateAttackDamage({
  attacker:{atk:100,hp:100,maxhp:100},target:{trait:'赤'},baseAttack:100,time:0,
  ability:{strong:{赤:2}},random:()=>.99
});
assert.equal(baseAttack.damage,200,'shared attack damage applies trait strength');
const criticalAttack=core.calculateAttackDamage({
  attacker:{atk:100,hp:100,maxhp:100},target:{trait:'赤'},baseAttack:100,time:0,
  ability:{strong:{赤:2},criticalChance:.5,criticalMultiplier:3},random:()=>0
});
assert.equal(criticalAttack.damage,600,'shared attack damage applies deterministic critical hits');
assert.equal(criticalAttack.critical,true);
const metalAttack=core.calculateAttackDamage({
  attacker:{atk:100,hp:100,maxhp:100},target:{trait:'赤',metal:true},baseAttack:100,time:0,
  ability:{strong:{赤:2}},random:()=>.99
});
assert.equal(metalAttack.damage,1,'metal target keeps the non-critical one-damage rule');
const farTarget={id:1,x:90,hp:100};
const nearTarget={id:2,x:25,hp:100};
const deadTarget={id:3,x:5,hp:0};
const grabbedTarget={id:4,x:10,hp:100,muscleGrabbedBy:{id:99}};
assert.equal(core.selectTarget([farTarget,nearTarget,deadTarget,grabbedTarget],null,{x:0,range:100}),nearTarget,
  'shared targeting chooses the nearest living, unrestrained target');
assert.equal(core.selectTarget([farTarget,nearTarget],farTarget,{x:0,range:100}),farTarget,
  'shared targeting preserves a still-valid current target');
assert.equal(core.selectTarget([farTarget],farTarget,{x:0,range:20}),null,
  'shared targeting drops a current target that leaves range');
assert.equal(core.selectTarget([nearTarget],farTarget,{x:0,range:100}),nearTarget,
  'shared targeting rejects a current target removed from the active candidate list');
assert.equal(core.selectTarget([farTarget,nearTarget],null,{x:0,range:100,canTarget:t=>t.id!==2}),farTarget,
  'shared targeting applies caller-specific target eligibility');
const rngA=core.createRng('kwl-shared-core-regression');
const rngB=core.createRng('kwl-shared-core-regression');
const seqA=Array.from({length:32},()=>rngA());
const seqB=Array.from({length:32},()=>rngB());
assert.deepEqual(seqA,seqB,'seeded random sequence is reproducible');
assert.ok(seqA.every(x=>x>=0&&x<1),'random values stay in [0,1)');
const clock=core.createClock(0);
assert.equal(clock.now(),0);
assert.equal(clock.advance(.1),.1);
assert.equal(clock.set(.5),.5);
assert.throws(()=>clock.set(.4),/monotonic/,'battle clock cannot move backwards');
assert.throws(()=>clock.advance(-.1),/non-negative/,'battle clock rejects negative steps');
const runtime=core.createRuntime('kwl-runtime-test',0);
assert.equal(core.setActiveRuntime(runtime),true);
const activeRng=core.createRng('kwl-runtime-test');
assert.equal(core.random(),activeRng(),'browser and server share the same seeded RNG');
core.setFrameTime(1234);
assert.equal(core.now(),1234,'browser battle clock follows the frame timestamp');
core.clearActiveRuntime();
assert.notEqual(core.now(),1234,'normal gameplay returns to the browser monotonic clock');
console.log('Shared battle core regression tests passed');
