#!/usr/bin/env node
'use strict';

// Ability regression checks for 木下大戦争.
// Run: node tests/ability-regression.test.js [path-to-index.html]
// These tests exercise the real helper/function source extracted from index.html
// and verify key character definitions. They do not replace browser battle testing.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('✓ ' + name + '\n');
  } catch (error) {
    process.stderr.write('✗ ' + name + '\n' + (error.stack || error) + '\n');
    process.exitCode = 1;
  }
}

function functionSource(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'function not found: ' + name);
  const next = html.indexOf('\nfunction ', start + 1);
  return html.slice(start, next === -1 ? html.length : next).trim();
}

function evaluate(source, context = {}) {
  const sandbox = {
    Math: Object.create(Math),
    performance: { now: () => 1000 },
    enemies: [],
    units: [],
    setStatusMark: () => {},
    popup: () => {},
    hit: () => {},
    removeEnemy: () => {},
    removeUnit: () => {},
    applySlow: () => {},
    applyCurseStatus: () => {},
    isAbilitySealed: () => false,
    ...context,
  };
  sandbox.Math.random = () => 0;
  vm.runInNewContext(source + '\nthis.__result = typeof result !== "undefined" ? result : undefined;', sandbox);
  return sandbox;
}

function getFunction(name, extra = {}) {
  const helpers = name === 'hasAbilityFlag' ? '' : functionSource('hasAbilityFlag') + '\n';
  const sandbox = evaluate(helpers + functionSource(name) + '\nthis.__fn = ' + name + ';', extra);
  return { fn: sandbox.__fn, sandbox };
}

function objectDefinition(prefix, suffix) {
  const start = html.indexOf(prefix);
  assert.notEqual(start, -1, 'definition not found: ' + prefix);
  const end = html.indexOf(suffix, start);
  assert.notEqual(end, -1, 'definition end not found: ' + suffix);
  return html.slice(start + prefix.length, end).trim().replace(/;\s*$/, '');
}

test('shared immunity helper checks both top-level and ability flags', () => {
  const { fn } = getFunction('hasAbilityFlag');
  assert.equal(fn({ stopImmune: true }, 'stopImmune'), true);
  assert.equal(fn({ ability: { stopImmune: true } }, 'stopImmune'), true);
  assert.equal(fn({ ability: { stopImmune: false } }, 'stopImmune'), false);
  assert.equal(fn({}, 'stopImmune'), false);
});

test('stop immunity prevents guaranteed stop status', () => {
  const applyAbility = getFunction('applyAbility', {
    applyCurseStatus: () => false,
    applySlow: () => {},
  }).fn;
  const attacker = { ability: { stopChance: 1, stopDuration: 3 } };
  const topLevelImmune = { hp: 100, spd: 1, stopImmune: true };
  const nestedImmune = { hp: 100, spd: 1, ability: { stopImmune: true } };
  const vulnerable = { hp: 100, spd: 1 };
  applyAbility(attacker, topLevelImmune, 1);
  applyAbility(attacker, nestedImmune, 1);
  applyAbility(attacker, vulnerable, 1);
  assert.equal(topLevelImmune.stopUntil, undefined);
  assert.equal(nestedImmune.stopUntil, undefined);
  assert.equal(vulnerable.stopUntil, 4);
});

test('slow immunity prevents slow status', () => {
  const { fn: applySlow } = getFunction('applySlow', {
    setStatusMark: () => {},
    performance: { now: () => 1000 },
  });
  const immune = { slowImmune: true };
  const nestedImmune = { ability: { slowImmune: true } };
  const vulnerable = { spd: 1 };
  const slow = { trait: '*', factor: 0.5, duration: 2 };
  applySlow(immune, slow);
  applySlow(nestedImmune, slow);
  applySlow(vulnerable, slow);
  assert.equal(immune.slowUntil, undefined);
  assert.equal(nestedImmune.slowUntil, undefined);
  assert.equal(vulnerable.slowUntil, 3);
});

test('surge and wave immunity helpers check both supported flag locations', () => {
  const { fn: surgeImmune } = getFunction('isSurgeImmuneEntity');
  const { fn: waveImmune } = getFunction('isWaveImmuneEntity');
  assert.equal(surgeImmune({ surgeImmune: true }), true);
  assert.equal(surgeImmune({ ability: { surgeImmunity: true } }), true);
  assert.equal(surgeImmune({}), false);
  assert.equal(waveImmune({ waveImmune: true }), true);
  assert.equal(waveImmune({ ability: { waveImmunity: true } }), true);
  assert.equal(waveImmune({}), false);
});

test('ally surge damage filters surge-immune enemies', () => {
  assert.match(functionSource('triggerPhoenixSurge'), /!isSurgeImmuneEntity\(e\)/);
  assert.match(functionSource('triggerPhoenixSurge'), /!isSurgeImmuneEntity\(u\)/);
});

test('ally wave damage filters wave-immune enemies', () => {
  assert.match(functionSource('allyWaveAttack'), /!isWaveImmuneEntity\(e\)/);
  assert.match(functionSource('enemyWaveAttack'), /!isWaveImmuneEntity\(u\)/);
});

test('ally Phoenix definition includes stop, slow, wave and surge immunity', () => {
  const raw = objectDefinition('const PHOENIX_REWARD_CARD=', ';\n// フェニックスは全カード登録後');
  const card = vm.runInNewContext('(' + raw + ')');
  for (const flag of ['stopImmune', 'slowImmune', 'waveImmune', 'surgeImmune']) {
    assert.equal(card[flag] === true || card.ability?.[flag] === true, true, 'missing ' + flag);
  }
  assert.equal(card.ability.phoenixSurgeMin, 1);
  assert.equal(card.ability.phoenixSurgeMax, 200);
});

test('Harland second form keeps its documented wave and immunity configuration', () => {
  const raw = objectDefinition('const HARLAND_SECOND_FORM=', ';\nfunction chapterRewardIndex');
  const card = vm.runInNewContext('(' + raw + ')');
  assert.equal(card.ability.waveLevel, 4);
  assert.equal(card.ability.waveChance, 1);
  for (const flag of ['stopImmune', 'slowImmune', 'curseImmune', 'attackDownImmune', 'sealImmune', 'waveImmune', 'surgeImmune', 'warpImmune']) {
    assert.equal(card.ability[flag], true, 'missing ' + flag);
  }
});

test('enemy Phoenix forms declare surge immunity in their actual definitions', () => {
  const normalStart = html.indexOf('フェニックス:{name:"フェニックス🐦‍🔥"');
  const awakeStart = html.indexOf('"フェニックス(覚醒)":{name:"フェニックス🐦‍🔥(覚醒)"');
  assert.notEqual(normalStart, -1, 'normal enemy Phoenix definition missing');
  assert.notEqual(awakeStart, -1, 'awakened enemy Phoenix definition missing');
  const normal = html.slice(normalStart, html.indexOf('\n', normalStart));
  const awakened = html.slice(awakeStart, html.indexOf('\n', awakeStart));
  assert.match(normal, /surgeImmune:true/);
  assert.match(awakened, /surgeImmune:true/);
  assert.match(normal, /stopImmune:true/);
  assert.match(awakened, /stopImmune:true/);
});


test('ordinary curse does not seal abilities unless curseSeal is enabled', () => {
  const { fn: isSealed } = getFunction('isAbilitySealed');
  const { fn: applyCurseStatus } = getFunction('applyCurseStatus', {
    setStatusMark: () => {},
    performance: { now: () => 1000 },
  });
  const ordinary = { ability: { curseChance: 1, curseDuration: 4 } };
  const sealing = { ability: { curseChance: 1, curseDuration: 4, curseSeal: true } };
  const targetA = {};
  const targetB = {};
  applyCurseStatus(ordinary, targetA);
  applyCurseStatus(sealing, targetB);
  assert.equal(isSealed(targetA), false);
  assert.equal(isSealed(targetB), true);
});

test('simulation curse only seals abilities when curseSeal is enabled', () => {
  const { fn: applySimCurseStatus } = getFunction('applySimCurseStatus');
  const ordinary = { ability: { curseChance: 1, curseDuration: 4 } };
  const sealing = { ability: { curseChance: 1, curseDuration: 4, curseSeal: true } };
  const targetA = {};
  const targetB = {};
  applySimCurseStatus(ordinary, targetA, 10);
  applySimCurseStatus(sealing, targetB, 10);
  assert.equal(targetA.abilitySealedUntil, undefined);
  assert.equal(targetB.abilitySealedUntil, 14);
});

test('enemy area attack-down respects attackDownImmune', () => {
  assert.ok(html.includes("!hasAbilityFlag(ally,'attackDownImmune')"), 'area attack-down must skip immune units');
});


test('enemy wave starts from actual attack hit positions', () => {
  assert.match(functionSource('enemyWaveAttack'), /Math\.max\(\.\.\.origins\.map\(u=>Number\(u\.x\)\)\)/);
  assert.ok(html.includes('enemyWaveAttack(e,targets)'), 'enemy attack must pass its actual hit targets to wave generation');
});

test('reflected waves respect wave immunity on both sides', () => {
  const allyReflect = functionSource('reflectAllyWave');
  const enemyReflect = functionSource('reflectEnemyWave');
  assert.match(allyReflect, /!isWaveImmuneEntity\(u\)/);
  assert.match(enemyReflect, /!isWaveImmuneEntity\(e\)/);
  assert.match(enemyReflect, /allyWaveEffect reflectedWaveEffect/, 'reflected enemy wave should travel visually toward the enemy side');
});

test('Yabayaba clone wave uses the hit target and does not bypass wave chance', () => {
  const clone = functionSource('applyYabayabaCloneAbility');
  assert.match(clone, /enemyWaveAttack\(e,\[waveTarget\]\)/);
  assert.doesNotMatch(clone, /enemyWaveAttack\(e,targets\)/, 'targets is not defined in the clone ability function');
  assert.match(clone, /if\(a\.waveChance!=null\)/);
});


test('wave and surge positions use hit-target coordinates and correct directions', () => {
  const allyWave = functionSource('allyWaveAttack');
  const enemyWave = functionSource('enemyWaveAttack');
  const surge = functionSource('triggerPhoenixSurge');
  assert.match(allyWave, /Math\.min\(\.\.\.origins\.map\(e=>Number\(e\.x\)\)\)/);
  assert.match(enemyWave, /Math\.max\(\.\.\.origins\.map\(u=>Number\(u\.x\)\)\)/);
  assert.match(surge, /const origin=Number\(targets\[i\]\?\.x\?\?center\)/);
  assert.match(surge, /const lo=isAlly\?origin-max:origin\+min/);
  assert.match(surge, /const hi=isAlly\?origin-min:origin\+max/);
});


test('ally and enemy knockback chance causes an independent push', () => {
  assert.match(functionSource('applyAbility'), /a\.knockbackChance&&target\.hp>0/);
  assert.match(functionSource('enemyAttackTarget'), /ea\.knockbackChance&&Math\.random\(\)<Number\(ea\.knockbackChance\)/);
});

test('barrier break bypasses barriers, respects ability seal, and covers enemy attacks', () => {
  const hit = functionSource('hit');
  assert.match(hit, /barrierBreakSource\?\.ability\?\.barrierBreak/);
  assert.match(hit, /!isAbilitySealed\(source\)/);
  assert.match(hit, /target\.mythBarrier=0/);
  assert.match(functionSource('enemyAttackTarget'), /if\(ea\.barrierBreak\)/);
});

test('enemy seal and warp effects respect their respective immunities', () => {
  const attack = functionSource('enemyAttackTarget');
  assert.match(attack, /hasAbilityFlag\(t,'sealImmune'\)/);
  assert.match(attack, /hasAbilityFlag\(t,'warpImmune'\)/);
});

test('being ability-sealed does not grant immunity to additional debuffs', () => {
  assert.doesNotMatch(functionSource('enemyAttackTarget'), /if\(!sourceSealed&&!isAbilitySealed\(t\)\)/);
  assert.doesNotMatch(functionSource('applyPhoenixAttackAbility'), /isAbilitySealed\(target\)/);
});

test('area attack-down uses a single attack-level chance and respects immunity', () => {
  assert.match(functionSource('loop'), /ea\.areaAttackDownChance&&Math\.random\(\)<Number\(ea\.areaAttackDownChance\)/);
  assert.match(functionSource('applyAreaAttackDown'), /hasAbilityFlag\(e,'attackDownImmune'\)/);
});

test('mythology gravity and rune debuffs respect immunity flags', () => {
  assert.match(functionSource('mythologyV2Tick'), /gravityWell[^;]*hasAbilityFlag\(u,'slowImmune'\)/);
  assert.match(functionSource('mythologyV2OnEnemyAttack'), /hasAbilityFlag\(t,'attackDownImmune'\)/);
});

test('Socrates surge does not apply ability effects twice per hit', () => {
  assert.doesNotMatch(functionSource('triggerSocratesSurge'), /applyAbility\(source,t,dealt\)/);
});

test('composite traits match their individual trait abilities', () => {
  const { fn: hasTrait } = getFunction('entityHasTrait');
  const { fn: multiplier } = getFunction('traitMultiplier');
  assert.equal(hasTrait({ trait: '赤・黒' }, '赤'), true);
  assert.equal(hasTrait({ trait: '赤・黒' }, '黒'), true);
  assert.equal(hasTrait({ trait: '赤・黒' }, '宇宙'), false);
  assert.equal(multiplier({ 赤: 2, 黒: 3 }, { trait: '赤・黒' }, 'max'), 3);
  assert.equal(multiplier({ 赤: 0.4, 黒: 0.7 }, { trait: '赤・黒' }, 'min'), 0.4);
});

test('curse-only status text no longer claims ability seal', () => {
  assert.match(functionSource('applyCurseStatus'), /a\.curseSeal\?'呪い・能力封印':'呪い'/);
  assert.match(functionSource('updateStatusMark'), /curseSealUntil/);
});


test('global slow is rolled once per attack and applied to the correct side', () => {
  const body = functionSource('applyAbility');
  assert.doesNotMatch(body, /if\(a\.slow&&Math\.random\(\)<Number\(a\.slow\.chance\|\|0\)\)\{if\(a\.slow\.all\)/);
  assert.match(functionSource('applyGlobalSlow'), /const targets=source\.isEnemy\?units:enemies/);
  const calls = [];
  const { fn } = getFunction('applyGlobalSlow', {
    enemies: [{ hp: 10 }, { hp: 0 }, { hp: 20 }],
    applySlow: target => calls.push(target),
  });
  fn({ ability: { slow: { trait: '*', chance: 0.35, factor: 0.8, duration: 2, all: true } } });
  assert.equal(calls.length, 2);
  assert.match(functionSource('loop'), /applyGlobalSlow\(u\);applyAreaAttackDown\(u\)/);
  assert.match(functionSource('loop'), /if\(!sourceSealed\)applyGlobalSlow\(e\)/);
});

test('clone per-target slow does not roll global slow once per hit', () => {
  const body = functionSource('applyYabayabaCloneAbility');
  assert.match(body, /if\(a\.slow&&!a\.slow\.all&&Math\.random/);
  assert.match(body, /const affected=\[target\]/);
  assert.doesNotMatch(body, /if\(a\.slow&&Math\.random\(\)<Number\(a\.slow\.chance\|\|0\)\)\{\s*const affected=a\.slow\.all/);
});

test('curse chance is rolled only by the shared curse helper', () => {
  assert.doesNotMatch(functionSource('applyPhoenixAttackAbility'), /Math\.random\(\)<Number\(a\.curseChance\)/);
  assert.match(functionSource('enemyAttackTarget'), /if\(ea\.curseChance\)applyCurseStatus\(e,t\)/);
  assert.doesNotMatch(functionSource('enemyAttackTarget'), /Math\.random\(\)<Number\(ea\.curseChance\).*applyCurseStatus/);
  assert.match(functionSource('applyAbility'), /Math\.random\(\)<Number\(band\.curseChance\|\|0\)/);
});

test('splash damage follows the attacker side and can hit flying targets when allowed', () => {
  assert.match(functionSource('applyAbility'), /const splashTargets=u\.isEnemy\?units:enemies/);
  assert.match(functionSource('applyAbility'), /airAttack:!!u\.airAttack/);
});

test('seal duration is extended rather than shortened by a weaker reapplication', () => {
  assert.match(functionSource('applyAbility'), /Math\.max\(Number\(target\.abilitySealedUntil\|\|0\),now\+Number\(a\.sealDuration\|\|3\)\)/);
  assert.match(functionSource('enemyAttackTarget'), /Math\.max\(Number\(t\.abilitySealedUntil\|\|0\),now2\+Number\(ea\.sealDuration\|\|4\)\)/);
});


test('machine-series and attribute-overload modifiers recognize composite ancient traits', () => {
  assert.match(functionSource('damageAgainst'), /!entityHasTrait\(target,'古代'\)/);
  assert.match(functionSource('damageTakenBy'), /!entityHasTrait\(u,'古代'\)/);
  assert.match(functionSource('damageTakenBy'), /!entityHasTrait\(attacker,'古代'\)/);
});


test('reflected enemy waves do not apply the reflector ability twice', () => {
  const body = functionSource('reflectEnemyWave');
  assert.match(body, /hit\(e,dealt,reflector\)/);
  assert.doesNotMatch(body, /applyAbility\(reflector,e,dealt\)/);
});

test('enemy nested slow abilities apply per target and respect slow immunity', () => {
  const body = functionSource('enemyAttackTarget');
  assert.match(body, /ea\.slow&&!ea\.slow\.all&&!hasAbilityFlag\(t,'slowImmune'\)/);
  assert.match(body, /entityHasTrait\(t,ea\.slow\.trait\)/);
  assert.match(functionSource('loop'), /if\(!sourceSealed\)applyGlobalSlow\(e\)/);
});


test('multi-hit attacks and Socrates range bands select the configured damage', () => {
  const { fn: sequence } = getFunction('getAttackSequence');
  const fighting = sequence({ name: 'ファイティング木下', atk: 400, multiAttack: [400, 800, 200] }, { x: 100 });
  assert.equal(fighting.length, 3);
  assert.equal(fighting[0].damage, 400);
  assert.equal(fighting[1].damage, 800);
  assert.equal(fighting[2].damage, 200);
  const pair = sequence({ name: '木下&吉田', atk: 1200, secondAtk: 550 }, { x: 100 });
  assert.equal(pair.length, 2);
  assert.equal(pair[1].damage, 550);
  const socrates = sequence({ name: '哲学の賢者ゾクラテス', atk: 3200, x: 0, ability: { rangeBands: [{ max: 100, damage: 3200 }, { min: 101, max: 250, damage: 2000 }, { min: 251, max: 600, damage: 1750 }] } }, { x: 150 });
  assert.equal(socrates.length, 1);
  assert.equal(socrates[0].damage, 2000);
  assert.equal(socrates[0].bandIndex, 1);
  assert.match(functionSource('loop'), /setTimeout\(\(\)=>resolveFollowupAttack\(u,t,followup\.damage,hitIndex\),hitIndex\*100\)/);
  assert.match(functionSource('loop'), /waveTargets=targets\.filter\(t=>Math\.abs\(Number\(t\.x\|\|0\)-Number\(u\.x\|\|0\)\)<=100\)/);
});

test('top-level and nested strong/resistance modifiers both affect combat damage', () => {
  const traitMultiplier = (table, target, mode) => {
    if (!table) return 1;
    const traits = String(target?.trait || '無').split(/[・,]/);
    const values = traits.map(trait => table[trait]).filter(value => value != null).map(Number);
    if (table['*'] != null) values.push(Number(table['*']));
    return values.length ? (mode === 'min' ? Math.min(...values) : Math.max(...values)) : 1;
  };
  const { fn: damageAgainst } = getFunction('damageAgainst', {
    isAbilitySealed: () => false,
    traitMultiplier,
    entityHasTrait: () => false,
  });
  assert.equal(damageAgainst({ atk: 100, strong: { 赤: 4 }, ability: {} }, { trait: '赤' }), 400);
  assert.equal(damageAgainst({ atk: 100, ability: { strong: { 赤: 3 } } }, { trait: '赤' }), 300);
  const { fn: damageTakenBy } = getFunction('damageTakenBy', {
    isAbilitySealed: () => false,
    traitMultiplier,
    entityHasTrait: () => false,
    entityTraitMatch: () => false,
    traitTableMatches: () => false,
  });
  assert.equal(damageTakenBy({ hp: 100, maxhp: 100, trait: '赤', resist: { 赤: 0.2 }, ability: {} }, { atk: 100, trait: '赤', ability: {} }), 20);
});

test('first-hit and wave-stop abilities respect stop immunity and ability seal', () => {
  const { fn: applyStop } = getFunction('applyDirectStop', {
    setStatusMark: () => {},
    performance: { now: () => 1000 },
  });
  const immune = { hp: 100, spd: 1, ability: { stopImmune: true } };
  applyStop(immune, 1, 2);
  assert.equal(immune.stopUntil, undefined);
  const vulnerable = { hp: 100, spd: 1 };
  applyStop(vulnerable, 1, 2);
  assert.equal(vulnerable.stopUntil, 3);
  assert.match(functionSource('loop'), /!isAbilitySealed\(u\)&&firstStopChance/);
  assert.match(functionSource('loop'), /!isAbilitySealed\(u\)&&waveStopChance/);
});

process.stdout.write('\n' + passed + ' regression checks passed.\n');
