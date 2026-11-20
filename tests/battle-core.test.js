'use strict';
const assert=require('node:assert/strict');
require('../battle-core.js');
const core=globalThis.KinoshitaBattleCore;
assert.ok(core,'shared battle runtime is registered');
assert.equal(core.version,'1.1.0');
assert.equal(typeof core.resolveOnHitEffects,'function','shared status effect resolver is exported for the replay worker');
assert.equal(typeof core.resolveDamage,'function','shared damage and shield resolution is exported for the replay worker');
assert.equal(typeof core.calculateDamageTaken,'function','shared damage mitigation is exported for the server replay worker');
assert.equal(core.scaleLevelStat(100,1),100);
assert.equal(core.scaleLevelStat(100,2),104);
assert.equal(core.scaleLevelStat(100,3,1),100,'non-growing stats stay constant across levels');
assert.equal(core.advancePosition({x:500,speed:2,dt:.1,direction:-1}),488,'shared movement advances allied units toward the opposing side');
assert.equal(core.advancePosition({x:500,speed:2,dt:.1,direction:-1,slowFactor:.5,curseFactor:.5}),497,'shared movement applies slow and curse factors');
assert.equal(core.advancePosition({x:500,speed:2,dt:.1,direction:-1,stopped:true}),500,'stopped units do not move');
assert.equal(core.advancePosition({x:125,speed:2,dt:.1,direction:-1,minX:120}),120,'movement respects the field boundary');
assert.equal(core.advancePosition({x:895,speed:2,dt:.1,direction:1,maxX:900}),900,'movement respects the far field boundary');
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
const resisted=core.calculateDamageTaken({target:{maxhp:100,cursedUntil:0,ability:{resist:{赤:.5}}},attacker:{trait:'赤'},damage:100,time:0,random:()=>.99});
assert.equal(resisted.damage,50,'shared damage mitigation applies the strongest resistance reduction');
const reduced=core.calculateDamageTaken({target:{maxhp:100,ability:{damageReduce:{chance:1,factor:.2}}},attacker:{trait:'無'},damage:100,time:0,random:()=>0});
assert.equal(reduced.damage,20,'shared damage mitigation applies deterministic damage reduction');
const cursed=core.calculateDamageTaken({target:{maxhp:100,cursedUntil:5,ability:{}},attacker:{trait:'無'},damage:100,time:1,random:()=>.99});
assert.equal(cursed.damage,70,'shared damage mitigation applies the cursed damage factor');
const capped=core.calculateDamageTaken({target:{maxhp:100,ability:{damageCapRatio:.25}},attacker:{trait:'無'},damage:1000,time:0,random:()=>.99,applyCap:true});
assert.equal(capped.damage,25,'shared damage mitigation enforces the maximum-HP damage cap');
const shielded=core.resolveDamage({target:{hp:50,maxhp:100,barrier:20,power_shield:10,ability:{}},attacker:{trait:'無'},damage:100,time:0,random:()=>.99});
assert.equal(shielded.mitigatedDamage,100);
assert.equal(shielded.absorbedBarrier,20);
assert.equal(shielded.absorbedPowerShield,10);
assert.equal(shielded.damage,50);
const powerFirst=core.resolveDamage({target:{hp:100,maxhp:100,barrier:20,powerShield:30,ability:{}},attacker:{trait:'無'},damage:40,time:0,random:()=>.99,curseFactor:1,shieldOrder:'power-first'});
assert.equal(powerFirst.absorbedPowerShield,30);
assert.equal(powerFirst.absorbedBarrier,10);
assert.equal(powerFirst.hp,100);
const noDamage=core.resolveDamage({target:{hp:100,maxhp:100,barrier:0,powerShield:0,ability:{}},attacker:{trait:'無'},damage:0,time:0,random:()=>.99,curseFactor:1});
assert.equal(noDamage.damage,0,'zero incoming damage remains zero');
assert.equal(shielded.hp,0);
assert.equal(shielded.barrier,0);
assert.equal(shielded.powerShield,0);
const onHit=core.resolveOnHitEffects({time:10,random:()=>0,attacker:{ability:{slow:{chance:1,duration:3,factor:.4,trait:'赤'},stopChance:1,stopDuration:2,curseChance:1,curseDuration:4,attackDownChance:1,attackDownDuration:5,attackDownFactor:.25,knockbackChance:1,guaranteeKnockback:true}},target:{trait:'赤',ability:{}},knockbackDistance:45,guaranteedKnockbackDistance:48});
assert.equal(onHit.slowUntil,13);assert.equal(onHit.slowFactor,.4);assert.equal(onHit.stopUntil,12);assert.equal(onHit.cursedUntil,14);assert.equal(onHit.attackDownUntil,15);assert.equal(onHit.attackDownFactor,.25);assert.equal(onHit.knockback,93);
assert.deepEqual(onHit.effects,['鈍足','停止','呪い','攻撃力低下','ふっとばし','確定ふっとばし']);
const immune=core.resolveOnHitEffects({time:10,random:()=>0,attacker:{ability:{slowChance:1,stopChance:1,curseChance:1,sealChance:1,attackDownChance:1,knockbackChance:1}},target:{ability:{slowImmune:true,stopImmune:true,curseImmune:true,sealImmune:true,attackDownImmune:true,knockbackImmune:true}}});
assert.deepEqual(immune.effects,[],'status immunities prevent their matching on-hit effects');
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
