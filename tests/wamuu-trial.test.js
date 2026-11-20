'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('wamuu.js', 'utf8');

function createRuntime(operator = true) {
  let clock = 1000;
  const timers = [];
  const intervals = [];
  const buttons = ['X', 'A', 'Y', 'ZL', 'R'].map(key => ({
    dataset: { wamuuSkill: key }, addEventListener() {}, disabled: false,
    textContent: '', title: ''
  }));
  const elements = [];
  const makeElement = () => ({
    style: { setProperty() {} }, children: [], dataset: {}, classList: { add() {}, remove() {} },
    appendChild(node) { this.children.push(node); elements.push(node); },
    append(...nodes) { this.children.push(...nodes); },
    setAttribute() {}, addEventListener() {}, remove() {}, querySelectorAll() { return buttons; },
    querySelector() { return null; }
  });
  const panel = makeElement();
  let runtimeContext = null;
  const window = {
    __KINOSHITA_WAMUU_OPERATOR_TRIAL__: false,
    hit(target, damage) {
      let remaining = Math.max(0, Number(damage) || 0);
      if (Number(target.barrier || 0) > 0) {
        const absorbed = Math.min(target.barrier, remaining);
        target.barrier -= absorbed;
        remaining -= absorbed;
      }
      target.hp = Math.max(0, Number(target.hp || 0) - remaining);
      return remaining;
    },
    removeEnemy(enemy) {
      enemy.removed = true;
      const index = runtimeContext.enemies.indexOf(enemy);
      if (index >= 0) runtimeContext.enemies.splice(index, 1);
    },
    deploy(index) {
      const c = runtimeContext.cards[index];
      runtimeContext.units.push({ ...c, hp: c.hp, maxhp: c.hp, barrier: 0, barrierMax: 0, x: 800, isEnemy: false, cardIndex: index });
    },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {}
  };
  const sandbox = {
    window, document: {
      getElementById(id) { return id === 'wamuuSkillPanel' ? null : null; },
      createElement() { return makeElement(); },
      body: { appendChild(node) { if (node === panel) elements.push(node); } },
      head: { appendChild() {} }
    },
    performance: { now: () => clock },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {},
    isOperatorPlayer: id => id === 'operator',
    playerRankingId: operator ? 'operator' : 'ordinary',
    cards: [], ownedFlags: [], charLevel: [], charMaxLevel: [], charForm: [],
    normalEvolved: [], rechargeLeft: [], formation: [],
    formationStableNamesAtBoot: [], ownedCharacterNamesAtBoot: [],
    units: [], enemies: [], running: false, rankMode: false, pvpMode: false,
    save() {}, syncOwnedCount() {}, renderOwnedStart() {}, renderFormation() {}, renderCards() {},
    updatePowerShieldDisplay() {}, mythicPopup() {},
    setClock(value) { clock = value; },
    get timers() { return timers; },
    get intervals() { return intervals; },
    get buttons() { return buttons; },
    get elements() { return elements; }
  };
  runtimeContext = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'wamuu.js' });
  return sandbox;
}

const ordinary = createRuntime(false);
assert.equal(ordinary.cards.length, 0, 'ordinary players do not register the trial character');
assert.equal(ordinary.window.WAMUU_OPERATOR_TRIAL_API, undefined, 'ordinary players receive no trial API');

const runtime = createRuntime(true);
assert.equal(runtime.cards.length, 1, 'operator receives one trial character');
assert.equal(runtime.cards[0].name, 'ワムウ');
assert.equal(runtime.cards[0].operatorOnly, true);
assert.equal(runtime.ownedFlags[0], true, 'operator trial copy is granted automatically');
assert.equal(runtime.cards[0].hp, 250000);
assert.equal(runtime.cards[0].atk, 22200);
assert.equal(runtime.cards[0].skills.length, 5, 'five active skills are displayed separately');
assert.equal(runtime.window.WAMUU_OPERATOR_TRIAL_API.stats.lifeReversalRatio, 0.08);
assert.equal(runtime.window.WAMUU_OPERATOR_TRIAL_API.stats.indomitableThreshold, 0.35);

const api = runtime.window.WAMUU_OPERATOR_TRIAL_API;
assert.equal(api.formulas.sandstorm(100), 45);
assert.equal(api.formulas.A(100, 10), 500);
assert.equal(api.formulas.X(100), 475);
assert.equal(api.formulas.Y(100, 20), 360);
assert.equal(api.formulas.ZL(100), 750);
assert.ok(Math.abs(api.formulas.R(100) - 920) < 1e-9);
assert.match(source, /windEffect\(unit, 260\)/);
assert.doesNotMatch(source, /光刃|R-blade|lastBlade/);

const unit = { name: 'ワムウ', hp: 250000, maxhp: 250000, isEnemy: false, cardIndex: api.id, atk: 22200, x: 800 };
runtime.formation.push(api.id);
assert.equal(api.isTopRow(unit), true);
assert.equal(api.canUse(unit, 'X'), true);
assert.equal(api.activate(unit, 'X'), true);
assert.equal(api.canUse(unit, 'X'), false, 'cooldown starts at activation');
assert.equal(api.cooldownMap(unit).X, 9);
runtime.setClock(9000);
assert.equal(api.canUse(unit, 'X'), true, 'X becomes ready after 8 seconds');
assert.equal(api.activate(unit, 'A'), true);
assert.equal(api.cooldownMap(unit).A, 29);
runtime.formation = [1, 2, 3, 4, 5, api.id];
assert.equal(api.isTopRow(unit), false, 'bottom-row Wamuu cannot use skills');
assert.equal(api.canUse(unit, 'Y'), false, 'bottom-row skills are locked');
assert.equal(api.activate(unit, 'Y'), false, 'bottom-row activation is rejected');
runtime.formation = [api.id];

runtime.rankMode = true;
runtime.window.deploy(api.id);
assert.equal(runtime.units.length, 0, 'trial character cannot be deployed in ranked matches');
runtime.rankMode = false;
runtime.window.deploy(api.id);
assert.equal(runtime.units.length, 1, 'operator can deploy Wamuu in a normal battle');
runtime.enemies.push({ hp: 100, maxhp: 100, isEnemy: true, x: 700, el: { style: {}, remove() {} } });
const enemy = runtime.enemies[0];
runtime.window.WAMUU_OPERATOR_TRIAL_API.activate(runtime.units[0], 'A');
runtime.setClock(11900);
runtime.intervals[0].fn();
assert.equal(enemy.hp, 0, 'skill damage reduces enemy HP to zero');
assert.equal(enemy.removed, true, 'dead enemy is passed to the normal removeEnemy routine');
assert.equal(runtime.enemies.includes(enemy), false, 'dead enemy is removed from the active enemy list');

assert.match(fs.readFileSync('service-worker.js', 'utf8'), /wamuu\.js\?v=20261120-row-death-balance/);
assert.match(fs.readFileSync('service-worker.js', 'utf8'), /kinoshita-daisen-v114/);
process.stdout.write('Wamuu operator-only trial, access gating, skills, formulas, cooldowns and ranked-mode exclusion passed.\n');
