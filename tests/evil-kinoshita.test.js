'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync('evil-kinoshita.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const exporter = fs.readFileSync('scripts/export-character-roster.mjs', 'utf8');
const worker = fs.readFileSync('supabase/functions/ai-worker/index.ts', 'utf8');

assert.match(html, /GAME_VERSION='v1\.9\.85'/);
assert.match(sw, /kinoshita-daisen-v126/);
assert.match(sw, /prism\.js\?v=20261124-ownership-wamuu-order[\s\S]*evil-kinoshita\.js\?v=20261124-evil-kinoshita-raid/);
assert.match(exporter, /page\.addScriptTag\(\{path:path\.join\(root,'evil-kinoshita\.js'\)\}\)/);
assert.match(exporter, /KINOSHITA_CHARACTER_ID_AUDIT\.total===129/);
assert.match(worker, /let MAX_CHARS=129/);
assert.match(source, /hp: 18000000/);
assert.match(source, /EVIL_ROBOT_SHIELD = 5000000/);
assert.match(source, /ALLY_ROBOT_SHIELD = 500000/);
assert.match(source, /strong: \{ '\*': 3 \}/);
assert.match(source, /resist: \{ '\*': 0\.55 \}/);
assert.match(source, /damageCap: 0\.05/);
assert.match(source, /target\.hp <= target\.maxhp \* 0\.50/);
assert.match(source, /target\.hp <= target\.maxhp \* 0\.10/);
assert.match(source, /start: 27, interval: 40, enemy: '酒呑童子', mult: 55\.55/);
assert.match(source, /start: 33, interval: 39, enemy: SERVANT_NAME, mult: 0\.5/);
assert.match(source, /evilRetreated = true/);
assert.match(source, /window\.removeEnemy\(target, true\)/);

function makeElement() {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '',
      style: { setProperty() {} },
      dataset: {},
      classList: { add() {}, remove() {} },
      remove() {},
      appendChild() {}
    });
    return nodes.get(selector);
  };
  return {
    style: { setProperty() {} },
    dataset: {},
    classList: { add() {}, remove() {} },
    querySelector: node,
    querySelectorAll() { return []; },
    appendChild() {},
    remove() {}
  };
}

const cards = Array.from({ length: 128 }, (_, id) => ({ id, name: 'existing-' + id }));
const enemyTypes = {
  '酒呑童子': { name: '酒呑童子', hp: 220000, atk: 8200, range: 120, spd: 0.5, interval: 1.55, attackType: 'area', kb: 5, trait: '神話' },
  '最高神に使える者': { name: '最高神に使える者', hp: 2500000, atk: 37000, range: 110, spd: 1.3, interval: 1.9, attackType: 'single', kb: 2, trait: '氷', ability: {} }
};
const units = [];
const enemies = [];
const timers = [];
const intervals = [];
const removedEnemies = [];
const overlay = { appendChild() {} };
const fakeMath = Object.create(Math);
fakeMath.random = () => 0.99;
let spawnSerial = 0;
const context = {
  cards,
  enemyTypes,
  eventStages: [],
  units,
  enemies,
  ownedFlags: Array(128).fill(false),
  charLevel: Array(128).fill(1),
  charMaxLevel: Array(128).fill(20),
  charForm: Array(128).fill(1),
  normalEvolved: Array(128).fill(false),
  rechargeLeft: Array(128).fill(0),
  CURRENT_CHARACTER_COUNT: 128,
  ownedCharacterNamesAtBoot: ['existing-0', '悪の木下'],
  formationStableNamesAtBoot: ['悪の木下'],
  formationCharacterNamesAtBoot: null,
  formation: [],
  eventClears: {},
  worldWidth: 3000,
  running: true,
  selectedMode: 'event',
  Math: fakeMath,
  Date,
  performance: { now: () => 1000 },
  setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
  clearTimeout() {},
  setInterval(fn, delay) { intervals.push({ fn, delay }); return intervals.length; },
  clearInterval() {},
  document: {
    head: { appendChild() {} },
    body: { appendChild() {} },
    getElementById(id) { return id === 'effects' ? overlay : null; },
    createElement() { return makeElement(); }
  },
  syncOwnedCount() { context.owned = context.ownedFlags.filter(Boolean).length; },
  hasCharacter(index) { return !!context.ownedFlags[index]; },
  normalizeFormation() { context.formation = context.formation.filter(index => context.ownedFlags[index]); },
  saveFormationStableNames() { context.formationNamesSaved = true; },
  save() { context.saved = true; },
  renderStageSelect() { context.stageRendered = true; },
  renderCards() { context.cardsRendered = true; },
  renderOwnedStart() {},
  renderFormation() {},
  renderFormationBuffSummary() {},
  updateHp() {},
  setStatusMark() {},
  popup() {},
  updateBarrierDisplay() {},
  updatePowerShieldDisplay() {},
  KINOSHITA_REFRESH_CHARACTER_ROSTER_AUDIT() { context.rosterAuditRefreshed = true; },
  renderUnitElement(actor) { actor.el = makeElement(); return actor.el; },
  spawnEnemy(name, role, multOverride, fixedMultiplier, spawnX) {
    const spec = context.enemyTypes[name];
    if (!spec) return null;
    const scale = multOverride == null ? 1 : Number(multOverride);
    const actor = {
      ...spec,
      hp: Math.round(spec.hp * scale),
      maxhp: Math.round(spec.hp * scale),
      atk: Math.round(spec.atk * scale),
      x: spawnX == null ? 120 : Number(spawnX),
      id: 'enemy-' + (++spawnSerial),
      cd: 0.15,
      isEnemy: true,
      role,
      barrier: Number(spec.barrier || 0),
      barrierMax: Number(spec.barrier || 0),
      el: makeElement()
    };
    context.enemies.push(actor);
    return actor;
  },
  hit(target, damage) {
    let remaining = Math.max(0, Number(damage) || 0);
    if (Number(target.powerShield || 0) > 0) {
      const absorbed = Math.min(Number(target.powerShield), remaining);
      target.powerShield -= absorbed;
      remaining -= absorbed;
    }
    if (Number(target.barrier || 0) > 0) {
      const absorbed = Math.min(Number(target.barrier), remaining);
      target.barrier -= absorbed;
      remaining -= absorbed;
    }
    target.hp = Math.max(0, Number(target.hp || 0) - remaining);
    return target.hp;
  },
  damageTakenBy(target, attacker) { return Math.max(1, Number(attacker.atk || 1)); },
  damageAgainst(attacker, target, baseAttack) { return Math.max(1, Number(baseAttack || attacker.atk || 1)); },
  enemyAttackTarget(attacker, target) {
    let damage = context.damageTakenBy(target, attacker);
    if (Number(target.barrier || 0) > 0) {
      const absorbed = Math.min(Number(target.barrier || 0), damage);
      target.barrier = Math.max(0, Number(target.barrier || 0) - absorbed);
      damage -= absorbed;
    }
    if (damage > 0) target.hp = Math.max(0, Number(target.hp || 0) - damage);
    return damage;
  },
  getAttackSequence(actor) { return [{ damage: actor.atk }]; },
  removeEnemy(actor, noReward) {
    actor.removedNoReward = !!noReward;
    removedEnemies.push(actor);
    const index = context.enemies.indexOf(actor);
    if (index >= 0) context.enemies.splice(index, 1);
  },
  removeUnit(actor) {
    const index = context.units.indexOf(actor);
    if (index >= 0) context.units.splice(index, 1);
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'evil-kinoshita.js' });

assert.equal(cards.length, 129, 'reward character is appended after PRISM IDs');
assert.equal(cards[128].name, '悪の木下');
assert.equal(cards[128].id, 128);
assert.equal(context.CURRENT_CHARACTER_COUNT, 129);
assert.equal(context.rechargeLeft.length, 129);
assert.equal(cards[128].rarity, 'UR');
assert.equal(cards[128].skills.length, 10);
assert.equal(context.ownedFlags[128], true, 'ownership restores from saved character names');
assert.deepEqual(Array.from(context.formation), [128], 'saved formation restores by name');
assert.equal(context.saved, true);
assert.equal(context.stageRendered, true);
assert.equal(context.cardsRendered, true);
assert.equal(context.rosterAuditRefreshed, true);

const stage = context.eventStages.find(item => item.name === '悪の木下降臨');
assert.ok(stage, 'raid stage is registered');
assert.equal(stage.eventReward, '悪の木下');
assert.equal(stage.rewardCharacter, '悪の木下');
assert.deepEqual(Array.from(stage.schedule, item => item.t), [1, 7, 8, 9, 10]);
assert.equal(stage.schedule[0].mult, 55.55);
assert.equal(stage.schedule[4].role, 'boss');
assert.deepEqual(Array.from(stage.repeatSpawns, item => [item.start, item.interval]), [[27, 40], [33, 39]]);
assert.equal(stage.baseHp, 2500000);

const enemyAbility = context.enemyTypes['悪の木下'].ability;
assert.equal(context.enemyTypes['悪の木下'].hp, 18000000);
assert.equal(context.enemyTypes['悪の木下'].trait, '神話・天使');
assert.equal(enemyAbility.strong['*'], 3);
assert.equal(enemyAbility.resist['*'], 0.55);
assert.equal(enemyAbility.damageCap, 0.05);

const boss = context.spawnEnemy('悪の木下', 'boss', 1, true);
assert.equal(boss.evilPhase, 'robot');
assert.equal(boss.powerShield, 5000000);
assert.equal(boss.atk, 5500);
assert.equal(boss.range, 90);
assert.equal(boss.attackType, 'area');

const attacker = { name: 'shield attacker', hp: 10000, maxhp: 10000, isEnemy: false, powerShieldMax: 5000, powerShield: 5000 };
const shieldTarget = { hp: 100000, maxhp: 100000, isEnemy: false, powerShieldMax: 1000, powerShield: 1000 };
assert.equal(context.damageTakenBy(shieldTarget, boss), boss.atk * 3, 'enemy boss deals triple damage to power-shield targets');

boss.powerShield = 1;
context.hit(boss, 1000, attacker);
assert.equal(boss.evilPhase, 'normal', 'robot shield depletion triggers escape into normal form');
assert.equal(boss.x, 120, 'enemy boss retreats to its own castle front');
assert.equal(boss.powerShieldMax, 0);

boss.hp = boss.maxhp * 0.49;
context.hit(boss, 1, attacker);
assert.equal(boss.evilPhase, 'domination', '50% HP threshold triggers domination form');
assert.ok(timers.some(timer => timer.delay === 3000), 'domination schedules its one-time beam');

boss.hp = boss.maxhp * 0.09;
context.hit(boss, 1, attacker);
assert.equal(boss.evilPhase, 'final', '10% HP threshold triggers final form');
assert.ok(timers.filter(timer => timer.delay === 3000).length >= 2, 'final form schedules its own beam');

boss.evilPhase = 'normal';
boss.barrier = 0;
boss.hp = boss.maxhp;
const beforeCap = boss.hp;
context.hit(boss, 5000000, attacker);
assert.ok(beforeCap - boss.hp <= boss.maxhp * 0.05 + 1, 'enemy boss damage cap limits each hit to 5% max HP');

const attackTarget = { name: 'attack target', hp: 1000000, maxhp: 1000000, x: boss.x + 100, isEnemy: false, powerShieldMax: 1000, powerShield: 1000 };
const attackBefore = boss.atk;
context.enemyAttackTarget(boss, attackTarget);
assert.ok(boss.atk > attackBefore, 'enemy boss gains 7% attack after each attack');
fakeMath.random = () => 0;
boss.evilPortalNextAt = 0;
context.enemyAttackTarget(boss, attackTarget);
assert.ok(boss.evilPortalNextAt > 0, 'normal and later forms can create portals on attacks');
boss.evilPhase = 'domination';
boss.evilCounterNextAt = 0;
boss.evilSummonNextAt = 0;
context.hit(boss, 100, attacker);
assert.ok(boss.evilCounterNextAt > 0, 'portal counterattack starts its cooldown');
assert.ok(boss.evilSummonNextAt > 0, 'domination form summons servants after being hit');
assert.ok(timers.filter(timer => timer.delay === 0 || timer.delay === 1000 || timer.delay === 2000).length >= 3, 'enemy summon schedules three servants at one-second intervals');

const retreatingBoss = context.spawnEnemy('悪の木下', 'boss', 1, true);
retreatingBoss.evilPhase = 'normal';
retreatingBoss.powerShield = 0;
retreatingBoss.hp = 1;
context.hit(retreatingBoss, 1000, attacker);
assert.equal(retreatingBoss.evilRetreated, true);
assert.equal(retreatingBoss.removedNoReward, true, 'final retreat removes the boss without money');

context.enemies.length = 0;
const ally = {
  ...cards[128],
  hp: cards[128].hp,
  maxhp: cards[128].hp,
  atk: cards[128].atk,
  barrier: 0,
  barrierMax: 0,
  powerShield: 500000,
  powerShieldMax: 500000,
  x: 2800,
  id: 'ally-evil-kinoshita',
  isEnemy: false,
  cd: 0.15
};
context.units.push(ally);
context.renderUnitElement(ally);
assert.equal(ally.evilPhase, 'robot');
assert.equal(ally.powerShield, 500000);
assert.equal(ally.atk, 900);

// A fully absorbed enemy hit must still compare the barrier without throwing.
const barrierProbe = { hp: 10000, maxhp: 10000, barrier: 100000, isEnemy: false, x: 2700 };
context.enemyAttackTarget(boss, barrierProbe);
assert.equal(barrierProbe.hp, 10000);
assert.ok(barrierProbe.barrier < 10000, 'enemy attack correctly handles barrier-only damage');

// Verify all normal-form ally attack procs through the real hit wrapper.
ally.powerShield = 0;
context.hit(ally, 1, { name: 'enemy attacker', hp: 10000, maxhp: 10000, isEnemy: true });
assert.equal(ally.evilPhase, 'normal');
assert.equal(ally.x, 2810, 'ally robot escapes to the player castle front');

// Normal-form attack: +2% attack growth, 25% stop chance, and 10% portal chance.
fakeMath.random = () => 0;
const allyAttackTarget = { name: 'ally attack target', hp: 100000, maxhp: 100000, x: 2700, isEnemy: true };
const allyBaseAtk = ally.atk;
context.hit(allyAttackTarget, 100, ally);
assert.ok(ally.atk > allyBaseAtk, 'ally attack grows its attack after a successful hit');
assert.ok(allyAttackTarget.stopUntil > 0, 'ally attack can stop the target');
assert.ok(ally.evilPortalNextAt > 0, 'ally normal-form attack can create a portal');

// Being hit in domination form triggers falling-object retaliation and servant summon.
ally.hp = ally.maxhp * 0.49;
context.hit(ally, 1, { name: 'enemy attacker', hp: 10000, maxhp: 10000, isEnemy: true });
assert.equal(ally.evilPhase, 'domination');
const enemyAttacker = { name: 'enemy attacker', hp: 10000, maxhp: 10000, isEnemy: true };
ally.evilCounterNextAt = 0;
ally.evilSummonNextAt = 0;
const allySummonTimerStart = timers.length;
context.hit(ally, 100, enemyAttacker);
assert.ok(ally.evilCounterNextAt > 0, 'ally being hit triggers falling-object retaliation cooldown');
assert.ok(ally.evilSummonNextAt > 0, 'ally being hit in domination summons a servant');
const allySummonTimer = timers.slice(allySummonTimerStart).find(timer => timer.delay === 0);
assert.ok(allySummonTimer, 'ally servant summon is scheduled');
allySummonTimer.fn();
assert.ok(units.some(unit => unit.evilKinoshitaServant), 'ally servant is actually created');

// Servant receives 20% of incoming damage while the ally is in domination/final form.
const servant = units.find(unit => unit.evilKinoshitaServant);
const allyHpBeforeShared = ally.hp;
const servantHpBeforeShared = servant.hp;
context.hit(ally, 1000, enemyAttacker);
assert.equal(servantHpBeforeShared - servant.hp, 200, 'servant absorbs 20% of incoming damage');
assert.equal(allyHpBeforeShared - ally.hp, 800, 'ally receives the remaining 80%');

ally.hp = ally.maxhp * 0.09;
context.hit(ally, 1, enemyAttacker);
assert.equal(ally.evilPhase, 'final');
assert.ok(ally.atk <= 12000, 'ally attack growth is capped and remains weaker than enemy form');
const finalBeamTimer = timers.filter(timer => timer.delay === 3000).at(-1);
assert.ok(finalBeamTimer, 'ally final form schedules its beam');
const enemyForBeam = { name: 'beam target', hp: 100000, maxhp: 100000, x: 2700, isEnemy: true };
enemies.push(enemyForBeam);
finalBeamTimer.fn();
const allyBeamTimer = intervals.filter(timer => timer.delay === 300).at(-1);
assert.ok(allyBeamTimer, 'ally final beam schedules repeated hits');
const beamHpBefore = enemyForBeam.hp;
allyBeamTimer.fn();
assert.ok(enemyForBeam.hp < beamHpBefore, 'ally final beam damages enemies in front of the ally');

console.log('Evil Kinoshita raid, phases, portals, shield, summons, beams, reward registration and ally balance tests passed.');
