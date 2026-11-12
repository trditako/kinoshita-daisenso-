const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync('zeus.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /GAME_VERSION='v1\.9\.73'/);
assert.match(html, /zeus\.js\?v=20261112-zeus-lightning-reward-fix/);
assert.match(sw, /kinoshita-daisen-v92/);
assert.match(sw, /\.\/zeus\.js/);
assert.match(sw, /trade\|hitman\|genesis\|zeus/);

assert.match(source, /最高神:ゼウス降臨/);
assert.match(source, /最高神に使える者/);
assert.match(source, /hp: 26000000/);
assert.match(source, /hp: 2500000, atk: 37000/);
assert.match(source, /damage: 60000/);
assert.match(source, /damage: 22222/);
assert.match(source, /damage: 15000/);
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
assert.match(source, /window.__zeusEnemySenseLoop/, 'enemy Zeus has a separate 600-range sensing loop');
assert.match(source, /zeusLightningOverlay/, 'lightning is rendered in a viewport-level overlay');
assert.match(source, /launchAllyZeusLightning\(source\)/, 'ally lightning launches from the attack sequence, not from a successful hit');
assert.match(source, /if \(distance > senseRange\) return \[\]/, '600 is only the sensing threshold and does not cap lightning impact bands');
assert.match(source, /if \(!targets\.length\)/, 'empty lightning bands still produce a strike visual');
assert.match(source, /distance >= band\.min && distance <= band\.max/, 'enemy Zeus uses the exact three attack bands');
assert.match(source, /attackNow - Math\.max\(0\.1, Number\(enemy\.interval \|\| 3\)\)/, 'enemy Zeus waits its full 3-second attack interval');
assert.match(source, /zeusLightningFx/, 'lightning effect uses dedicated visual elements');
assert.match(source, /getBoundingClientRect/, 'lightning is positioned from the actual target element');
assert.match(source, /savedNames\.includes\(ZEUS_ALLY\).*savedFormationNames\.includes\(ZEUS_ALLY\)/s, 'saved ownership and formation names can restore Zeus');
assert.doesNotMatch(source, /const statusRoll = Math\.random\(\)/, 'do not double-roll Zeus status probabilities');
assert.equal((source.match(/zeusHealTotal/g) || []).length, 3, 'servant healing has one capped implementation');

// Execute the feature script with a minimal game-like global scope to verify
// that the stage and reward character are actually registered at runtime.
const runtimeEnemies = [];
const scheduledTimers = [];
const effectNodes = [];
const effectsOverlay = { appendChild(node) { effectNodes.push(node); } };
const documentBody = { appendChild(node) { if (node.id === 'zeusLightningOverlay') runtime.effectsOverlay = node; } };
const runtimeCalls = { stages: 0, cards: 0, owned: 0, formation: 0, buffs: 0, enemyNormalAttacks: 0 };
const runtimeWindow = {
  hit(target, damage) {
    target.hp = Math.max(0, target.hp - Number(damage || 0));
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
  renderUnitElement(unit) { return unit; },
  setInterval(fn, delay) { runtime.enemySenseLoop = fn; runtime.enemySenseLoopDelay = delay; return 1; }
};
const runtime = {
  window: runtimeWindow,
  document: {
    body: documentBody,
    documentElement: documentBody,
    getElementById(id) { return id === 'zeusLightningOverlay' ? effectsOverlay : null; },
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
  updateHp() {},
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
const god = { name: '最高神:ゼウス', hp: 800, maxhp: 1000, atk: 100, spd: 0.4, interval: 3, isEnemy: true };
runtimeEnemies.push(god);
runtimeWindow.hit(god, 100, null);
assert.equal(effectNodes.length, 0, 'taking damage does not trigger Zeus attack lightning');
god.hp = 800; // Keep the servant-healing assertion independent of this visual regression.
const servant = { name: '最高神に使える者', hp: 100, maxhp: 100, atk: 10, trait: '氷' };
const angelTarget = { name: 'ally', hp: 500, maxhp: 500, trait: '天使', isEnemy: false };
runtimeWindow.enemyAttackTarget(servant, angelTarget, {}, 1, false);
assert.equal(angelTarget.hp, 420, 'servant deals eight times damage to angel targets');
assert.equal(god.hp, 820, 'servant heals Zeus by 25% of actual damage exactly once');
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
const allyZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 0, range: 600, senseRange: 600, interval: 3 };
const makeAllyTarget = (name, x) => ({
  name, hp: 200000, maxhp: 200000, x, isEnemy: true,
  el: { getBoundingClientRect() { return { left: x - 10, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
});
const allyBandA = makeAllyTarget('ally band 1', 25);
const allyGapTrigger = makeAllyTarget('ordinary target in a gap', 80);
const allyBandB = makeAllyTarget('ally band 2', 125);
const allyBandC = makeAllyTarget('ally band 3', 225);
runtimeEnemies.push(allyBandA, allyGapTrigger, allyBandB, allyBandC);
assert.equal(runtimeWindow.getAttackSequence(allyZeus, allyGapTrigger).length, 0, 'the normal hit sequence is bypassed because lightning is the attack');
assert.equal(allyGapTrigger.hp, 200000, 'the selected target in the gap is not hit by a conventional attack');
assert.ok(allyBandA.hp < 200000, 'the first lightning band deals its own damage immediately');
assert.equal(effectNodes.length, 1, 'the first lightning band has a visible bolt');
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

// A gap with no target in one or more strike bands still displays the empty
// band lightning, and repeated attack-sequence polling cannot duplicate it.
const emptyBandZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 5000, range: 600, senseRange: 600, interval: 3 };
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

assert.equal(effectNodes.length, effectsAfterEmptyStrike + 3, 'enemy Zeus shows the empty first band plus both occupied bands');

// Detection at 600 starts the lightning attack; it does not move the impact
// to the detected target or deal conventional target-locked damage there.
const senseRangeZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 10000, range: 600, senseRange: 600, interval: 3 };
const detectedAt600 = makeAllyTarget('detected at 600', 10600);
runtimeEnemies.push(detectedAt600);
const before600Effects = effectNodes.length;
assert.equal(runtimeWindow.getAttackSequence(senseRangeZeus, detectedAt600).length, 0);
assert.equal(detectedAt600.hp, 200000, 'the sensed target at 600 is not hit by a normal attack');
assert.equal(effectNodes.length, before600Effects + 1, 'the first lightning band begins as soon as the 600-range target is sensed');
assert.ok(scheduledTimers.some(timer => timer.delay === 500));
assert.ok(scheduledTimers.some(timer => timer.delay === 1000));
const beyondSenseZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 20000, range: 400, senseRange: 600, interval: 3 };
const beyond600 = makeAllyTarget('outside sensing range', 20601);
runtimeEnemies.push(beyond600);
const beforeBeyondEffects = effectNodes.length;
runtimeWindow.getAttackSequence(beyondSenseZeus, beyond600);
assert.equal(effectNodes.length, beforeBeyondEffects, 'targets beyond 600 do not trigger the lightning attack');

// Re-rendering an ally Zeus must not refill an already-damaged shield.
const ally = { name: '最高神:ゼウス', hp: 100, maxhp: 100, powerShield: 5000, powerShieldMax: 100000 };
runtimeWindow.renderUnitElement(ally);
assert.equal(ally.powerShield, 5000);

// Enemy-side sensing must begin at 600 even though its ordinary attack
// radius is capped at 400; the strike remains lightning-only and visible.
const sensedEnemyZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 30000, range: 400, senseRange: 600, interval: 3, isEnemy: true };
const enemySensedAt550 = { name: 'sensed ally at 550', hp: 500000, maxhp: 500000, x: 30550, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 540, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } } };
runtimeEnemies.push(sensedEnemyZeus);
runtime.units.push(enemySensedAt550);
const effectsBeforeEnemySense = effectNodes.length;
runtime.enemySenseLoop();
assert.equal(enemySensedAt550.hp, 500000, 'a target at 550 is sensed but not hit by a conventional 600-range attack');
assert.equal(effectNodes.length, effectsBeforeEnemySense + 1, 'enemy Zeus emits a visible lightning effect when sensing a target at 550');
assert.equal(runtimeCalls.enemyNormalAttacks, normalAttackCallsBeforeZeus, 'enemy sensing does not invoke the generic attack handler');

console.log('Zeus raid runtime and regression checks passed.');

