const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync('zeus.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /GAME_VERSION='v1.9.76'/);
assert.match(html, /zeus\.js\?v=20261112-enemy-zeus-render-fix/);
assert.match(sw, /kinoshita-daisen-v99/);
assert.match(sw, /\.\/zeus\.js/);
assert.match(sw, /trade\|hitman\|genesis\|zeus/);

assert.match(source, /最高神:ゼウス降臨/);
assert.match(source, /最高神に使える者/);
assert.match(source, /hp: 26000000/);
assert.match(source, /hp: 2500000, atk: 37000/);
assert.match(source, /damage: 250000/);
assert.match(source, /damage: 125000/);
assert.match(source, /damage: 78000/);
assert.match(source, /damage: 150000/);
assert.match(source, /damage: 55555/);
assert.match(source, /damage: 35000/);
assert.match(source, /start: 8, interval: 25/);
assert.match(source, /start: 15, interval: 17/);
assert.match(source, /threshold: 0\.99/);
assert.match(source, /barrier: 5000000/);
assert.match(source, /shield: 100000/);
assert.match(source, /shield: 5000000/);
assert.match(source, /rewardCharacter: ZEUS_ALLY/);
assert.match(source, /zeusWaveContext === 'ally'/);
assert.match(source, /zeusWaveContext === 'enemy'/);
assert.match(source, /waveDamageFactor: 0\.5/);
assert.match(source, /warpImmune: true/);
assert.match(source, /bandIndex \* 500/);
assert.match(source, /zeusLightningResolved: true/);

assert.match(source, /Number\(victim\.hp\) <= 0/, 'servant death is detected after its HP reaches zero');
assert.match(source, /if \(typeof renderStageSelect === 'function'\) renderStageSelect\(\)/, 'refresh stage list after late-loaded stage registration');
assert.match(source, /function allyZeusStrikeBandIndex\(distance\)/, 'ally Zeus uses explicit attack bands');
assert.match(source, /range: 400, senseRange: 600, detectRange: 600/, 'enemy Zeus keeps a 400 strike radius separate from its 600 sensing range');
assert.match(source, /range: 600, senseRange: 600, detectRange: 600, attackRangeBands: allyZeusAbility\.zeusAlly\.bands/, 'ally Zeus uses 600 only to acquire a target while its own bands determine lightning impacts');
assert.match(source, /bands: \[\{ min: 0, max: 100, damage: 150000 \}, \{ min: 150, max: 250, damage: 55555 \}, \{ min: 300, max: 400, damage: 35000 \}\]/, 'enemy Zeus keeps its own three ranges and damage values');
assert.match(source, /bands: \[\{ min: -100, max: 75, damage: 250000 \}, \{ min: 125, max: 200, damage: 125000 \}, \{ min: 200, max: 400, damage: 78000 \}\]/, 'ally Zeus uses the requested signed three ranges and stronger damage values');
assert.match(source, /hp: 210000, atk: 250000/, 'ally Zeus receives the requested HP and first-band attack stat');
assert.match(source, /secondAtk: 125000, thirdAtk: 78000, multiAttack: \[250000, 125000, 78000\]/, 'ally Zeus card stats match all three lightning damage values');
assert.match(source, /const distance = \(Number\(candidate\.x \|\| 0\) - Number\(source\.x \|\| 0\)\) \* direction/, 'ally lightning bands mirror their signed ranges toward the triggering enemy');
assert.match(source, /zeusLightning\(\{ x: Number\(source\.x \|\| 0\) \+ direction \* \(\(band\.min \+ band\.max\) \/ 2\) \}/, 'empty ally lightning bands render in the same forward direction as damage');
assert.match(source, /launchAllyZeusLightning\(source, target\)/, 'the selected target determines ally Zeus facing direction');
assert.match(source, /const traitBonus = traitIs\(victim, \['天使', '神話', '赤', '宇宙'\]\) \? 5 : 1/, 'ally Zeus applies its fivefold trait damage multiplier');
assert.match(source, /const traitBonus = traitIs\(unit, \['天使', '神話', '赤', '宇宙'\]\) \? 10 : 1/, 'enemy Zeus applies its tenfold trait damage multiplier');
assert.match(source, /const zeusAttacker = source\?\.name === ZEUS_ALLY/, 'both ally and enemy Zeus lightning can apply their attack debuffs');
assert.match(source, /window.__zeusEnemySenseLoop/, 'enemy Zeus has a separate 600-range sensing loop');
assert.match(source, /if \(sensed\) launchEnemyZeusLightning\(god, now\)/, 'enemy sensing launches lightning directly without depending on the generic attack wrapper');
assert.match(source, /document\.getElementById\('effects'\)/, 'lightning is rendered in the battlefield world effects layer');
assert.match(source, /fx\.style\.left = Number\(target\.x\) \+ 'px'/, 'lightning X uses the game world coordinate directly');
assert.match(source, /fx\.style\.bottom = '40px'/, 'lightning impact is anchored to the battlefield lane');
assert.match(source, /launchAllyZeusLightning\(source, target\)/, 'ally lightning launches from the attack sequence using the selected target direction');
assert.match(source, /if \(distance > senseRange\) return \[\]/, '600 is only the sensing threshold and does not cap lightning impact bands');
assert.ok(source.includes("zeusLightning({ x: Number(enemy.x || 0) + direction * center }, '#60a5fa', enemy);"), 'enemy lightning is rendered at every band position, including empty bands');
assert.match(source, /distance >= band\.min && distance <= band\.max/, 'enemy Zeus uses the exact three attack bands');
assert.match(source, /attackNow - Math\.max\(0\.1, Number\(enemy\.interval \|\| 3\)\)/, 'enemy Zeus waits its full 3-second attack interval');
assert.match(source, /zeusLightningFx/, 'lightning effect uses dedicated visual elements');
assert.ok(source.includes("direction * center }, '#60a5fa', enemy)"), 'enemy Zeus always renders a blue lightning bolt at each attack-band position');
assert.match(html, /雷撃の段別性能/, 'ally Zeus detail shows each lightning band attack and range');
assert.ok(html.includes("攻撃力：<b>'+Math.round(raw*scale)"), 'ally Zeus detail displays level-adjusted per-band damage');
assert.match(source, /!abilitySource\?\.zeusLightningResolved && !abilitySource\?\.zeusReflection/, 'Zeus cannot deal damage through conventional non-lightning hits');
assert.match(source, /savedNames\.includes\(ZEUS_ALLY\).*savedFormationNames\.includes\(ZEUS_ALLY\)/s, 'saved ownership and formation names can restore Zeus');
assert.doesNotMatch(source, /const statusRoll = Math\.random\(\)/, 'do not double-roll Zeus status probabilities');
assert.equal((source.match(/zeusHealTotal/g) || []).length, 3, 'servant healing has one capped implementation');

// Execute the feature script with a minimal game-like global scope to verify
// that the stage and reward character are actually registered at runtime.
const runtimeEnemies = [];
const scheduledTimers = [];
const effectNodes = [];
const effectsOverlay = { appendChild(node) { effectNodes.push(node); node.parentElement = effectsOverlay; } };
const documentBody = { appendChild(node) { if (node.id === 'effects') runtime.effectsOverlay = node; } };
const runtimeCalls = { stages: 0, cards: 0, owned: 0, formation: 0, buffs: 0, enemyNormalAttacks: 0 };
const runtimeWindow = {
  hit(target, damage, source) {
    target.hp = Math.max(0, target.hp - Number(damage || 0));
    // Model the core engine's default ally-side Yabayaba kill hook so the
    // Zeus regression test proves enemy lightning suppresses that branch.
    if (target.hp <= 0 && source?.ability?.yabayaba) {
      runtimeWindow.spawnYabayabaClone(target, source.ability.yabayaba, true);
    }
    return target.hp;
  },
  getAttackSequence() { return []; },
  enemyAttackTarget(enemy, target) {
    runtimeCalls.enemyNormalAttacks++;
    target.hp = Math.max(0, target.hp - Number(enemy.atk || 0));
  },
  removeEnemy(victim) {
    const index = runtimeEnemies.indexOf(victim);
    if (index >= 0) runtimeEnemies.splice(index, 1);
    return true;
  },
  removeUnit(victim) {
    const index = runtime.units.indexOf(victim);
    if (index >= 0) runtime.units.splice(index, 1);
    runtime.removedUnits = runtime.removedUnits || [];
    runtime.removedUnits.push(victim);
    return true;
  },
  spawnYabayabaClone(victim, level, asAlly = false) {
    runtime.yabayabaClones = runtime.yabayabaClones || [];
    runtime.yabayabaClones.push({ victim, level, asAlly });
  },
  setStatusMark() {},
  renderUnitElement(unit) { return unit; },
  setInterval(fn, delay) { runtime.enemySenseLoop = fn; runtime.enemySenseLoopDelay = delay; return 1; }
};
const runtime = {
  window: runtimeWindow,
  document: {
    body: documentBody,
    documentElement: documentBody,
    getElementById(id) { return id === 'effects' ? effectsOverlay : null; },
    createElement() { return { style: { setProperty() {} }, textContent: '', append() {}, remove() {} }; },
    head: { appendChild() {} }
  },
  cards: [],
  enemyTypes: {},
  eventStages: [],
  CURRENT_CHARACTER_COUNT: 0,
  charLevel: [],
  charMaxLevel: [],
  charForm: [],
  normalEvolved: [],
  ownedFlags: [],
  enemies: runtimeEnemies,
  units: [],
  worldWidth: 100000,
  updateHp() {},
  Math: Object.create(Math),
  performance: { now: () => 1000 },
  setTimeout(fn, delay) { scheduledTimers.push({ fn, delay }); return scheduledTimers.length; },
  setInterval(fn, delay) { runtime.enemySenseLoop = fn; runtime.enemySenseLoopDelay = delay; return 1; },
  renderStageSelect() { runtimeCalls.stages++; },
  renderCards() { runtimeCalls.cards++; },
  renderOwnedStart() { runtimeCalls.owned++; },
  renderFormation() { runtimeCalls.formation++; },
  renderFormationBuffSummary() { runtimeCalls.buffs++; },
  eventClears: { '最高神:ゼウス降臨': true },
  formation: [],
  formationStableNamesAtBoot: ['最高神:ゼウス'],
  normalizeFormation() {},
  saveFormationStableNames() {},
  syncOwnedCount() { runtime.ownedCount = runtime.ownedFlags.filter(Boolean).length; },
  save() { runtime.saved = true; },
  console
};
vm.runInNewContext(source, runtime);
const registeredStage = runtime.eventStages.find(stage => stage.name === '最高神:ゼウス降臨');
assert.ok(registeredStage, 'Zeus stage is registered in the live eventStages array');
assert.equal(registeredStage.schedule.length, 2);
assert.equal(registeredStage.repeatSpawns.length, 2);
assert.equal(registeredStage.knockbackAll, true);
assert.equal(runtime.cards[0].name, '最高神:ゼウス');
assert.equal(runtime.cards[0].id, 0);
assert.equal(runtime.CURRENT_CHARACTER_COUNT, 1);
assert.equal(runtime.ownedFlags[0], true, 'a saved Zeus raid clear restores the reward character');
assert.equal(runtime.saved, true, 'restored reward ownership is persisted');
assert.equal(runtime.formation.length, 1, 'the saved Zeus formation is restored after late character registration');
assert.equal(runtime.formation[0], 0);
assert.equal(runtime.enemyTypes['最高神:ゼウス'].hp, 26000000);
assert.equal(runtime.enemyTypes['最高神:ゼウス'].range, 400);
assert.equal(runtime.enemyTypes['最高神:ゼウス'].senseRange, 600);
assert.equal(runtime.enemySenseLoopDelay, 120);
assert.deepEqual(runtimeCalls, { stages: 1, cards: 1, owned: 1, formation: 1, buffs: 1, enemyNormalAttacks: 0 });

// A servant's ordinary attack heals the enemy Zeus once and respects its
// per-servant healing cap.
const god = { name: '最高神:ゼウス', hp: 800, maxhp: 1000, atk: 100, spd: 0.4, x: 0, range: 400, senseRange: 600, interval: 3, isEnemy: true,
  el: { getBoundingClientRect() { return { left: -10, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } } };
runtimeEnemies.push(god);
runtimeWindow.hit(god, 100, null);
assert.equal(effectNodes.length, 0, 'taking damage does not trigger Zeus attack lightning');
god.hp = 800; // Keep the servant-healing assertion independent of this visual regression.
const servant = { name: '最高神に使える者', hp: 100, maxhp: 100, atk: 10, trait: '氷' };
const angelTarget = { name: 'ally', hp: 500, maxhp: 500, trait: '天使', isEnemy: false };
runtimeWindow.enemyAttackTarget(servant, angelTarget, {}, 1, false);
assert.equal(angelTarget.hp, 420, 'servant deals eight times damage to angel targets');
assert.equal(god.hp, 820, 'servant heals Zeus by 25% of actual damage exactly once');
const allyZeus = makeZeusSource(0);
const conventionalHitTarget = { name: 'ordinary target', hp: 1000, maxhp: 1000, isEnemy: true };
runtimeWindow.hit(conventionalHitTarget, 500, allyZeus, {});
assert.equal(conventionalHitTarget.hp, 1000, 'ally Zeus cannot damage with a conventional hit');
runtimeWindow.hit(conventionalHitTarget, 500, allyZeus, { zeusLightningResolved: true });
assert.equal(conventionalHitTarget.hp, 500, 'ally Zeus damages targets only through a resolved lightning strike');
god.x = 1000; // Keep the enemy Zeus outside the ally's 0-250 lightning bands.

// Killing a servant strengthens the enemy Zeus.
const deadServant = { name: '最高神に使える者', hp: 0, maxhp: 100 };
runtimeEnemies.push(deadServant);
runtimeWindow.removeEnemy(deadServant);
assert.equal(god.zeusServantDeaths, 1);
assert.equal(god.maxhp, 1250);
assert.equal(god.atk, 125);
assert.equal(god.spd, 0.5);
assert.equal(god.interval, 2.4);

// Ally Zeus's attack is the three lightning strikes themselves. A target in
// a gap can trigger the attack, but is not required to be hit by a normal attack.
function makeZeusSource(x, isEnemy = false) {
  return {
    name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x,
    range: isEnemy ? 400 : 600, senseRange: 600, interval: 3, isEnemy,
    el: { getBoundingClientRect() { return { left: x - 10, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
  };
}
const makeAllyTarget = (name, x, trait = '') => ({
  name, hp: 200000, maxhp: 200000, x, isEnemy: true, trait,
  el: { getBoundingClientRect() { return { left: x - 10, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
});
const allyBandA = makeAllyTarget('ally band 1', -50);
const allyGapTrigger = makeAllyTarget('ordinary target in a gap', 80);
const allyBandB = makeAllyTarget('ally band 2', 125);
const allyBandC = makeAllyTarget('ally band 3', 225);
runtimeEnemies.push(allyBandA, allyGapTrigger, allyBandB, allyBandC);
assert.equal(runtimeWindow.getAttackSequence(allyZeus, allyGapTrigger).length, 0, 'the normal hit sequence is bypassed because lightning is the attack');
assert.equal(allyGapTrigger.hp, 200000, 'the selected target in the gap is not hit by a conventional attack');
assert.ok(allyBandA.hp < 200000, 'the first lightning band deals its own damage immediately');
assert.equal(effectNodes.length, 1, 'the first lightning band has a visible bolt');
assert.equal(effectNodes[0].style.left, '-50px', 'first lightning impact uses its actual world X coordinate');
assert.ok(scheduledTimers.some(timer => timer.delay === 500), 'the second lightning band lands 0.5 seconds later');
assert.ok(scheduledTimers.some(timer => timer.delay === 1000), 'the third lightning band lands 1 second later');
const runAllyScheduled = delay => {
  const index = scheduledTimers.findIndex(timer => timer.delay === delay);
  assert.notEqual(index, -1, 'expected ally lightning at ' + delay + 'ms');
  scheduledTimers.splice(index, 1)[0].fn();
};
runAllyScheduled(500);
assert.ok(allyBandB.hp < 200000, 'the second lightning band deals its own damage');
runAllyScheduled(1000);
assert.ok(allyBandC.hp < 200000, 'the third lightning band deals its own damage');
assert.equal(effectNodes.length, 3, 'all three ally lightning bands create visible effects');
assert.equal(effectNodes[1].style.left, '125px', 'delayed lightning keeps the second band world coordinate');


// When the triggering enemy is on Zeus's left, all three signed bands mirror
// to the left instead of continuing to strike behind him.
const reverseAllyZeus = makeZeusSource(7000);
const reverseBandA = makeAllyTarget('reverse band 1', 7050);
const reverseGapTrigger = makeAllyTarget('reverse gap trigger', 6920);
const reverseBandB = makeAllyTarget('reverse band 2', 6875);
const reverseBandC = makeAllyTarget('reverse band 3', 6775);
runtimeEnemies.push(reverseBandA, reverseGapTrigger, reverseBandB, reverseBandC);
runtimeWindow.getAttackSequence(reverseAllyZeus, reverseGapTrigger);
assert.ok(reverseBandA.hp < 200000, 'left-facing first lightning band mirrors and hits behind the world origin direction');
runAllyScheduled(500);
assert.ok(reverseBandB.hp < 200000, 'left-facing second lightning band mirrors toward the left');
runAllyScheduled(1000);
assert.ok(reverseBandC.hp < 200000, 'left-facing third lightning band mirrors toward the left');

// A gap with no target in one or more strike bands still displays the empty
// band lightning, and repeated attack-sequence polling cannot duplicate it.
const emptyBandZeus = makeZeusSource(5000);
const gapOnlyTarget = makeAllyTarget('gap-only trigger', 5080);
runtimeEnemies.push(gapOnlyTarget);
runtimeWindow.getAttackSequence(emptyBandZeus, gapOnlyTarget);
const effectsAfterEmptyStrikeStart = effectNodes.length;
assert.ok(effectsAfterEmptyStrikeStart >= 4, 'an empty first band still displays a lightning strike');
runtimeWindow.getAttackSequence(emptyBandZeus, gapOnlyTarget);
assert.equal(effectNodes.length, effectsAfterEmptyStrikeStart, 'the attack cooldown prevents duplicate lightning from repeated sequence checks');
runAllyScheduled(500);
runAllyScheduled(1000);
const effectsAfterEmptyStrike = effectNodes.length;
// Enemy Zeus also covers the gaps between its three damage bands.
const enemyGapTargetA = {
  name: 'enemy band 2 target', hp: 500000, maxhp: 500000, x: 200, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 120, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
};
const enemyGapTargetB = {
  name: 'enemy band 3 target', hp: 500000, maxhp: 500000, x: 350, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 270, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
};
runtime.units.push(enemyGapTargetA, enemyGapTargetB);
god.x = 0; // Enemy Zeus now uses its own forward-facing 0-400 strike bands.
const normalAttackCallsBeforeZeus = runtimeCalls.enemyNormalAttacks;
runtimeWindow.enemyAttackTarget(god, enemyGapTargetA, {}, 1, false);
assert.equal(runtimeCalls.enemyNormalAttacks, normalAttackCallsBeforeZeus, 'enemy Zeus lightning never invokes the generic non-lightning attack handler');
const runScheduled = delay => {
  const index = scheduledTimers.findIndex(timer => timer.delay === delay);
  assert.notEqual(index, -1, 'expected scheduled lightning wave at ' + delay + 'ms');
  scheduledTimers.splice(index, 1)[0].fn();
};
runScheduled(500);
assert.ok(enemyGapTargetA.hp < 500000, 'enemy Zeus hits its exact 150-250 second band');
runScheduled(1000);
assert.ok(enemyGapTargetB.hp < 500000, 'enemy Zeus hits its exact 300-400 third band');

assert.equal(effectNodes.length, effectsAfterEmptyStrike + 5, 'enemy Zeus shows the empty first band plus both occupied bands');

// Detection at 600 starts the lightning attack; it does not move the impact
// to the detected target or deal conventional target-locked damage there.
const senseRangeZeus = makeZeusSource(10000);
const detectedAt600 = makeAllyTarget('detected at 600', 10600);
runtimeEnemies.push(detectedAt600);
const before600Effects = effectNodes.length;
assert.equal(runtimeWindow.getAttackSequence(senseRangeZeus, detectedAt600).length, 0);
assert.equal(detectedAt600.hp, 200000, 'the sensed target at 600 is not hit by a normal attack');
assert.equal(effectNodes.length, before600Effects + 1, 'the first lightning band begins as soon as the 600-range target is sensed');
assert.ok(scheduledTimers.some(timer => timer.delay === 500));
assert.ok(scheduledTimers.some(timer => timer.delay === 1000));
const beyondSenseZeus = makeZeusSource(20000);
const beyond600 = makeAllyTarget('outside sensing range', 20601);

// Trait damage is applied to ally Zeus's lightning, not just its card metadata.
const traitDamageZeus = makeZeusSource(40000);
const traitNormal = makeAllyTarget('non-trait comparison', 40020);
const traitAngel = makeAllyTarget('angel comparison', 40040, '天使');
traitNormal.hp = traitNormal.maxhp = 5000000;
traitAngel.hp = traitAngel.maxhp = 5000000;
runtimeEnemies.push(traitNormal, traitAngel);
runtimeWindow.getAttackSequence(traitDamageZeus, traitNormal);
const normalLoss = 5000000 - traitNormal.hp;
const angelLoss = 5000000 - traitAngel.hp;
assert.equal(angelLoss, normalLoss * 5, 'ally Zeus deals fivefold lightning damage to its four specified traits');

runtimeEnemies.push(beyond600);
const beforeBeyondEffects = effectNodes.length;
runtimeWindow.getAttackSequence(beyondSenseZeus, beyond600);
assert.equal(effectNodes.length, beforeBeyondEffects, 'targets beyond 600 do not trigger the lightning attack');

// Re-rendering an ally Zeus must not refill an already-damaged shield.
const ally = { name: '最高神:ゼウス', hp: 100, maxhp: 100, powerShield: 5000, powerShieldMax: 100000 };
runtimeWindow.renderUnitElement(ally);
assert.equal(ally.powerShield, 5000);

// Enemy Zeus lightning applies its own stop/attack-down proc to opposing units.
const enemyStatusTarget = { name: 'status test ally', hp: 100000, maxhp: 100000, isEnemy: false };
const oldRandom = runtime.Math.random;
runtime.Math.random = () => 0;
runtimeWindow.hit(enemyStatusTarget, 1000, god, { zeusLightningResolved: true });
runtime.Math.random = oldRandom;
assert.ok(enemyStatusTarget.stopUntil > 1, 'enemy Zeus applies its configured stop proc on successful lightning damage');

// The custom enemy-Zeus lightning path must apply the configured 50%
// knockback, remove defeated player units, and create level-5 clones on the
// enemy side (not the ally side used by the core hit() helper).
const knockbackZeus = makeZeusSource(60000, true);
knockbackZeus.ability = runtime.enemyTypes['最高神:ゼウス'].ability;
knockbackZeus.yabayaba = 5;
knockbackZeus.yabayabaChance = 1;
const knockbackTarget = { name: 'knockback test ally', hp: 500000, maxhp: 500000, x: 60050, isEnemy: false,
  el: { classList: { remove() {}, add() {} }, getBoundingClientRect() { return { left: 40, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } } };
runtimeEnemies.push(knockbackZeus);
runtime.units.push(knockbackTarget);
runtime.Math.random = () => 0;
runtime.enemySenseLoop();
runtime.Math.random = oldRandom;
assert.equal(knockbackTarget.x, 60092, 'enemy Zeus has a 50% chance to knock a surviving target back by 42 world units');
assert.ok(knockbackTarget.hitbackUntil > 1, 'knockback applies the normal hitback state');

const yabayabaZeus = makeZeusSource(70000, true);
yabayabaZeus.ability = runtime.enemyTypes['最高神:ゼウス'].ability;
yabayabaZeus.yabayaba = 5;
yabayabaZeus.yabayabaChance = 1;
const defeatedForClone = { name: 'Yabayaba victim', hp: 100, maxhp: 100, atk: 50, range: 70, spd: 1, interval: 1,
  attackType: 'single', kb: 2, x: 70050, isEnemy: false };
runtimeEnemies.push(yabayabaZeus);
runtime.units.push(defeatedForClone);
runtime.Math.random = () => 0;
runtime.enemySenseLoop();
runtime.Math.random = oldRandom;
assert.ok(runtime.removedUnits?.includes(defeatedForClone), 'enemy Zeus removes a unit defeated by its lightning');
const spawnedZeusClone = runtime.yabayabaClones?.find(clone => clone.victim === defeatedForClone);
assert.ok(spawnedZeusClone, 'enemy Zeus activates Yabayaba when its lightning defeats a unit');
assert.equal(spawnedZeusClone.level, 5, 'enemy Zeus uses Yabayaba level 5');
assert.equal(spawnedZeusClone.asAlly, false, 'enemy Zeus creates its Yabayaba copy on the enemy side');
assert.equal(runtime.yabayabaClones.filter(clone => clone.victim === defeatedForClone && clone.asAlly).length, 0,
  'enemy Zeus does not accidentally create an ally-side Yabayaba clone');

// Enemy-side sensing must begin at 600 even though its ordinary attack
// radius is capped at 400; the strike remains lightning-only and visible.
const sensedEnemyZeus = makeZeusSource(30000, true);
const enemySensedAt550 = { name: 'sensed ally at 550', hp: 500000, maxhp: 500000, x: 30550, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 540, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } } };
runtimeEnemies.push(sensedEnemyZeus);
runtime.units.push(enemySensedAt550);
const effectsBeforeEnemySense = effectNodes.length;
runtime.enemySenseLoop();
assert.equal(enemySensedAt550.hp, 500000, 'a target at 550 is sensed but not hit by a conventional 600-range attack');
assert.equal(effectNodes.length, effectsBeforeEnemySense + 1, 'enemy Zeus emits a visible lightning effect when sensing a target at 550');
assert.ok(scheduledTimers.some(timer => timer.delay === 500), 'enemy Zeus schedules its second lightning band after 500ms');
assert.ok(scheduledTimers.some(timer => timer.delay === 1000), 'enemy Zeus schedules its third lightning band after 1000ms');
assert.equal(runtimeCalls.enemyNormalAttacks, normalAttackCallsBeforeZeus, 'enemy sensing does not invoke the generic attack handler');

console.log('Zeus raid runtime and regression checks passed.');

