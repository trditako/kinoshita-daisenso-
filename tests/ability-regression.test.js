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

process.stdout.write('\n' + passed + ' regression checks passed.\n');
