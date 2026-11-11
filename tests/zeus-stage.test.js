const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync('zeus.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /GAME_VERSION='v1\.9\.73'/);
assert.match(html, /zeus\.js\?v=20261112-zeus-lightning-reward-fix/);
assert.match(sw, /kinoshita-daisen-v88/);
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
assert.match(source, /function allyZeusStrikeBandIndex\(distance\)/, 'ally Zeus has continuous distance bands throughout its 250 range');
assert.match(source, /impactDistance > Math\.max\(0, Number\(source\.range \|\| 250\)\)/, 'strike is cancelled if the target leaves the attack range before impact');
assert.match(source, /distance <= 400 && distanceBand === index/, 'enemy Zeus strikes targets throughout its full attack range');
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
const effectsLayer = {
  appendChild(node) { effectNodes.push(node); },
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 500 }; }
};
const runtimeCalls = { stages: 0, cards: 0, owned: 0, formation: 0, buffs: 0 };
const runtimeWindow = {
  hit(target, damage) {
    target.hp = Math.max(0, target.hp - Number(damage || 0));
    return target.hp;
  },
  getAttackSequence() { return []; },
  enemyAttackTarget(enemy, target) {
    target.hp = Math.max(0, target.hp - Number(enemy.atk || 0));
  },
  removeEnemy(victim) {
    const index = runtimeEnemies.indexOf(victim);
    if (index >= 0) runtimeEnemies.splice(index, 1);
    return true;
  },
  renderUnitElement(unit) { return unit; }
};
const runtime = {
  window: runtimeWindow,
  document: {
    getElementById(id) { return id === 'effects' ? effectsLayer : null; },
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
  renderStageSelect() { runtimeCalls.stages++; },
  renderCards() { runtimeCalls.cards++; },
  renderOwnedStart() { runtimeCalls.owned++; },
  renderFormation() { runtimeCalls.formation++; },
  renderFormationBuffSummary() { runtimeCalls.buffs++; },
  eventClears: { '最高神:ゼウス降臨': true },
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
assert.equal(runtime.enemyTypes['最高神:ゼウス'].hp, 26000000);
assert.deepEqual(runtimeCalls, { stages: 1, cards: 1, owned: 1, formation: 1, buffs: 1 });

// A servant's ordinary attack heals the enemy Zeus once and respects its
// per-servant healing cap.
const god = { name: '最高神:ゼウス', hp: 800, maxhp: 1000, atk: 100, spd: 0.4, interval: 3 };
runtimeEnemies.push(god);
const servant = { name: '最高神に使える者', hp: 100, maxhp: 100, atk: 10, trait: '氷' };
const angelTarget = { name: 'ally', hp: 500, maxhp: 500, trait: '天使', isEnemy: false };
runtimeWindow.enemyAttackTarget(servant, angelTarget, {}, 1, false);
assert.equal(angelTarget.hp, 420, 'servant deals eight times damage to angel targets');
assert.equal(god.hp, 820, 'servant heals Zeus by 25% of actual damage exactly once');

// Killing a servant strengthens the enemy Zeus.
const deadServant = { name: '最高神に使える者', hp: 0, maxhp: 100 };
runtimeEnemies.push(deadServant);
runtimeWindow.removeEnemy(deadServant);
assert.equal(god.zeusServantDeaths, 1);
assert.equal(god.maxhp, 1250);
assert.equal(god.atk, 125);
assert.equal(god.spd, 0.5);
assert.equal(god.interval, 2.4);

// Ally Zeus strikes each enemy in its full 250 range with a visible bolt,
// and damage is applied at the same moment the lightning reaches the target.
const allyZeus = { name: '最高神:ゼウス', hp: 1000, maxhp: 1000, x: 0, range: 250 };
const strikeTarget = {
  name: 'strike target', hp: 1000, maxhp: 1000, x: 100, isEnemy: true,
  el: { getBoundingClientRect() { return { left: 90, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
};
runtimeEnemies.push(strikeTarget);
assert.equal(runtimeWindow.getAttackSequence(allyZeus, { x: 80 }).length, 1, 'targets in a former distance gap still receive an attack');
assert.equal(runtimeWindow.getAttackSequence(allyZeus, { x: 249 }).length, 1, 'the far edge of Zeus range remains attackable');
assert.equal(runtimeWindow.getAttackSequence(allyZeus, { x: 251 }).length, 0, 'targets outside Zeus range are not attacked');
runtimeWindow.hit(strikeTarget, 100, allyZeus);
assert.equal(strikeTarget.hp, 1000, 'damage waits for the lightning impact');
assert.equal(scheduledTimers[0].delay, 500, 'the middle strike zone has its staged lightning timing');
scheduledTimers.shift().fn();
assert.equal(strikeTarget.hp, 900, 'the target takes damage when the bolt lands');
assert.equal(effectNodes.length, 1, 'a visible lightning bolt is created for the actual hit');

// Enemy Zeus also covers the gaps between its three damage bands.
const enemyGapTargetA = {
  name: 'enemy gap target A', hp: 500000, maxhp: 500000, x: 130, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 120, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
};
const enemyGapTargetB = {
  name: 'enemy gap target B', hp: 500000, maxhp: 500000, x: 280, isEnemy: false,
  el: { getBoundingClientRect() { return { left: 270, top: 120, width: 20, height: 20 }; }, querySelector() { return null; } }
};
runtime.units.push(enemyGapTargetA, enemyGapTargetB);
runtimeWindow.enemyAttackTarget(god, enemyGapTargetA, {}, 1, false);
const runScheduled = delay => {
  const index = scheduledTimers.findIndex(timer => timer.delay === delay);
  assert.notEqual(index, -1, 'expected scheduled lightning wave at ' + delay + 'ms');
  scheduledTimers.splice(index, 1)[0].fn();
};
runScheduled(500);
assert.ok(enemyGapTargetA.hp < 500000, 'enemy Zeus hits targets in the 100-150 distance gap');
runScheduled(1000);
assert.ok(enemyGapTargetB.hp < 500000, 'enemy Zeus hits targets in the 250-300 distance gap');
assert.equal(effectNodes.length, 3, 'each enemy Zeus target receives its own lightning visual');

// Re-rendering an ally Zeus must not refill an already-damaged shield.
const ally = { name: '最高神:ゼウス', hp: 100, maxhp: 100, powerShield: 5000, powerShieldMax: 100000 };
runtimeWindow.renderUnitElement(ally);
assert.equal(ally.powerShield, 5000);
console.log('Zeus raid runtime and regression checks passed.');

