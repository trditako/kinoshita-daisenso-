const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = fs.readFileSync('hastur.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /kinoshita-daisen-v98/);
assert.match(sw, /hastur\.js\?v=20261114-hastur-raid/);
assert.ok(sw.includes('./hastur.js'));

const calls = { stage: 0, cards: 0 };
let nextTimer = 0;
const intervals = new Map();
const scheduled = [];
const window = {
  setStatusMark() {},
  updatePowerShieldDisplay() {},
  removeEnemy(e) { const i = sandbox.enemies.indexOf(e); if (i >= 0) sandbox.enemies.splice(i, 1); },
  removeUnit(e) { const i = sandbox.units.indexOf(e); if (i >= 0) sandbox.units.splice(i, 1); }
};
function baseHit(target, damage) {
  let d = Math.max(0, Number(damage) || 0);
  const shield = Math.max(0, Number(target.barrier || target.powerShield || 0));
  if (shield > 0) {
    const used = Math.min(shield, d);
    if ('barrier' in target) target.barrier -= used;
    else target.powerShield -= used;
    d -= used;
  }
  target.hp = Math.max(0, Number(target.hp || 0) - d);
  return target.hp;
}
window.hit = baseHit;
window.damageAgainst = (attacker, target, baseAtk) => Number(baseAtk || attacker.atk || 1);
window.damageTakenBy = (target, attacker) => Number(attacker.atk || 1);
const sandbox = {
  window,
  document: {
    createElement() { return { style: {}, className: '', remove() {} }; },
    body: { appendChild() {} },
    documentElement: { appendChild() {} },
    getElementById() { return null; }
  },
  performance: { now: () => 1000 },
  setInterval(fn) { const id = ++nextTimer; intervals.set(id, fn); return id; },
  clearInterval(id) { intervals.delete(id); },
  setTimeout(fn) { scheduled.push(fn); return ++nextTimer; },
  Math: Object.assign(Object.create(Math), { random: () => .9 }),
  cards: [], enemyTypes: {
    '最高神に使える者': { name: '最高神に使える者', hp: 2500000, atk: 37000, trait: '氷' }
  }, eventStages: [], units: [], enemies: [], formation: [],
  CURRENT_CHARACTER_COUNT: 0, charLevel: [], charMaxLevel: [], charForm: [],
  normalEvolved: [], ownedFlags: [], rechargeLeft: [],
  renderStageSelect() { calls.stage++; }, renderCards() { calls.cards++; },
  renderOwnedStart() {}, renderFormation() {}, renderFormationBuffSummary() {},
  console
};
vm.runInNewContext(source, sandbox);

assert.equal(sandbox.eventStages.length, 1);
const stage = sandbox.eventStages[0];
assert.equal(stage.name, '最高神:ハスター降臨');
assert.deepEqual(JSON.parse(JSON.stringify(stage.schedule)), [
  { t: 0, enemy: '最高神:ハスター', mult: 1, fixedMultiplier: true, role: 'boss' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(stage.repeatSpawns)), [
  { start: 2, interval: 35, enemy: '最高神に使える者', mult: 1.2, fixedMultiplier: true }
]);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].hp, 28500000);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].atk, 174500);
assert.equal(sandbox.enemyTypes['最高神に使える者'].hp, 2500000, 'preserve Zeus shared servant stats');
assert.equal(sandbox.enemyTypes['最高神に使える者'].atk, 37000);
assert.equal(sandbox.cards[0].hp, 500000);
assert.equal(sandbox.cards[0].atk, 122000);
assert.equal(sandbox.cards[0].trait, '最高神');
assert.equal(sandbox.cards[0].skills.length, 2);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].skills.length, 2);
assert.equal(sandbox.cards[0].ability.hastur.damageCap, .15);
assert.equal(sandbox.cards[0].ability.hastur.madnessInterval, 26);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].ability.hastur.madnessInterval, 22);
assert.equal(calls.stage, 1);
assert.equal(calls.cards, 1);

const api = sandbox.window.HASTUR_RAID_TEST_API;
const allyGod = { name: '最高神:ハスター', isEnemy: false, hp: 500000, maxhp: 500000, atk: 122000, range: 180, spd: .8, interval: 5.5, trait: '最高神' };
const cursedTarget = { name: 'test', isEnemy: true, hp: 1000, maxhp: 1000, atk: 100, range: 100, spd: 1, interval: 1, trait: '赤', barrier: 100 };
sandbox.units.push(allyGod);
api.applyStatus(cursedTarget, 'curse', 3, allyGod, api.allyCfg);
assert.equal(cursedTarget.barrier, 0, 'curse breaks power shields');
assert.equal(allyGod.hasturCurseCount, 1, 'each currently cursed target adds one 15% stack');
assert.equal(allyGod.maxhp, 575000, 'curse count raises all Hastur stats by 15%');

const madnessTarget = { name: 'madness target', isEnemy: true, hp: 1000, maxhp: 1000, atk: 100, range: 100, spd: 1, interval: 1, trait: '黒', barrier: 50 };
api.applyStatus(madnessTarget, 'madness', 5, allyGod, api.allyCfg);
assert.equal(madnessTarget.hp, 750, 'madness deals 25% max HP exactly once on application');
assert.equal(madnessTarget.barrier, 0, 'madness breaks power shields');
assert.ok(madnessTarget.trait.includes('赤'), 'madness temporarily adds red trait');
assert.equal(allyGod.hasturMadnessCount, 1);
assert.equal(allyGod.maxhp, 700000, 'curse and madness stacks combine additively');

const beforeMadnessHit = madnessTarget.hp;
window.hit(madnessTarget, 100, { name: 'normal attacker', isEnemy: false, atk: 100 });
assert.equal(madnessTarget.hp, beforeMadnessHit - 400, 'madness multiplies incoming damage by four');

for (const fn of intervals.values()) fn();
const recoveredBefore = madnessTarget.hp;
allyGod.hp = allyGod.maxhp - 1000;
const godHpBeforeRecovery = allyGod.hp;
madnessTarget.hp += 100;
for (const fn of intervals.values()) fn();
assert.equal(madnessTarget.hp, recoveredBefore, 'madness converts recovered HP into damage');
assert.equal(allyGod.hp, godHpBeforeRecovery + 25, 'Hastur recovers 25% of converted healing');

const curseHpBefore = cursedTarget.hp;
cursedTarget.hp += 80;
for (const fn of intervals.values()) fn();
assert.equal(cursedTarget.hp, curseHpBefore, 'curse prevents HP recovery');

const debuffed = { atk: 100, attackDownUntil: 10, attackDownFactor: .2 };
assert.equal(window.damageAgainst(debuffed, {}, 100), 20, 'attack-down status reduces outgoing damage');
assert.equal(window.damageTakenBy({}, debuffed), 20, 'attack-down status also affects enemy-side attacks');

const enemyGod = { name: '最高神:ハスター', isEnemy: true, hp: 28500000, maxhp: 28500000, atk: 174500, range: 240, spd: .8, interval: 5, trait: '最高神' };
const traitAttacker = { name: 'trait attacker', isEnemy: false, hp: 10000000, maxhp: 10000000, atk: 1000, trait: '赤' };
sandbox.enemies.push(enemyGod);
const hpBeforeCap = enemyGod.hp;
window.hit(enemyGod, 200000000, traitAttacker, { hasturSkill: true });
assert.equal(enemyGod.hasturDamageTaken, 4275000, 'one hit is capped at 15% of maximum HP after mitigation');
assert.equal(enemyGod.hasturDefense, .05, 'each damaging hit increases defense by five percentage points');
assert.ok(traitAttacker.hp < traitAttacker.maxhp, 'Hastur reflects 75% of actual HP damage');
sandbox.enemies.splice(sandbox.enemies.indexOf(enemyGod), 1);

const teamGod = { name: '最高神:ハスター', isEnemy: true, hp: 28500000, maxhp: 28500000, atk: 174500, range: 240, spd: .8, interval: 5, trait: '最高神' };
const teammate = { name: 'enemy teammate', isEnemy: true, hp: 1000, maxhp: 1000, atk: 100, range: 100, spd: 1, interval: 1, trait: '無' };
const player = { name: 'player unit', isEnemy: false, hp: 1000, maxhp: 1000, atk: 100, trait: '無' };
sandbox.enemies.push(teamGod, teammate);
sandbox.units.push(player);
const teammateHp = teammate.hp, teamGodHp = teamGod.hp;
assert.equal(teammateHp, 1000);
assert.equal(teamGodHp, 28500000);
window.hit(teammate, 100, player);
assert.equal(teammate.hp, 1050, 'teammate receives +10% team stats and then takes the remaining half damage');
assert.equal(teamGod.hasturDamageTaken, 50, 'Hastur shoulders exactly half of the original damage');
assert.equal(teamGod.hasturTeamBuff, .1, 'enemy Hastur grants +10% team stats per damage event');
assert.equal(teammate.hasturTeamBuff, .1);

sandbox.cards.push({ name: 'non-highest one', trait: '無' }, { name: 'non-highest two', trait: '黒' });
sandbox.formation = [0, 1, 2];
const formationGod = { name: '最高神:ハスター', isEnemy: false, hp: 500000, maxhp: 500000, atk: 122000, range: 180, spd: .8, interval: 5.5, trait: '最高神' };
api.applyFormationSynergy(formationGod);
assert.equal(formationGod.hasturFormationAllFactor, 1.75, 'one highest-god formation member grants +75% to all allies');
assert.equal(formationGod.hasturFormationHighestFactor, 2.1, 'two non-highest members grant +110% to highest-god stats');
assert.equal(formationGod.maxhp, 1837500);

process.stdout.write('Hastur stage, status effects, healing conversion, damage caps, reflection, team sharing, skills and formation synergy checks passed.\\n');
