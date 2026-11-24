(() => {
'use strict';
if (window.__EVIL_KINOSHITA_RAID_V1__) return;
window.__EVIL_KINOSHITA_RAID_V1__ = true;

const STAGE_NAME = '悪の木下降臨';
const BOSS_NAME = '悪の木下';
const ALLY_NAME = '悪の木下';
const SERVANT_NAME = '最高神に使える者';
const EVIL_ROBOT_SHIELD = 5000000;
const ALLY_ROBOT_SHIELD = 500000;
const portals = [];
const fallingRains = [];

const ENEMY_FORMS = {
  robot: { atk: 5500, range: 90, spd: 1, interval: 0.6, attackType: 'area', kb: 3, label: 'ロボット形態' },
  normal: { atk: 25000, range: 150, spd: 0.6, interval: 1, attackType: 'single', kb: 3, label: '通常形態' },
  domination: { atk: 35000, range: 150, spd: 1.3, interval: 0.9, attackType: 'area', kb: 3, label: '支配形態' },
  final: { atk: 15000, range: 250, spd: 1.6, interval: 0.2, attackType: 'single', kb: 3, label: '最終形態' }
};
const ALLY_FORMS = {
  robot: { atk: 900, range: 90, spd: 1, interval: 0.6, attackType: 'area', kb: 3, label: 'ロボット形態' },
  normal: { atk: 12000, range: 150, spd: 0.6, interval: 1, attackType: 'single', kb: 3, label: '通常形態' },
  domination: { atk: 18000, range: 150, spd: 1, interval: 0.9, attackType: 'area', kb: 3, label: '支配形態' },
  final: { atk: 8000, range: 250, spd: 1.3, interval: 0.35, attackType: 'single', kb: 3, label: '最終形態' }
};

const enemyAbility = {
  name: '次元支配・絶対防衛',
  desc: '全属性から受けるダメージ45%軽減、全属性に3倍ダメージ。パワーシールド所持者にはさらに3倍。1回の被ダメージは最大HPの5%まで。呪い・停止無効。攻撃するたび攻撃力+7%（上限なし）、攻撃時50%で3秒停止。ロボット形態のシールドが破壊されると通常形態へ移行。HP50%以下で支配形態、10%以下で最終形態。',
  strong: { '*': 3 },
  resist: { '*': 0.55 },
  curseImmune: true,
  stopImmune: true,
  damageCap: 0.05,
  evilKinoshitaEnemy: true
};
const allyAbility = {
  name: '次元支配・縮退版',
  desc: '全属性から受けるダメージ20%軽減、全属性に1.5倍ダメージ。1回の被ダメージは最大HPの20%まで。呪い・停止無効。攻撃するたび攻撃力+2%（最大+50%）、攻撃時25%で1.5秒停止。ポータル移動・ポータル攻撃・部下召喚・ビームを使用する。',
  strong: { '*': 1.5 },
  resist: { '*': 0.8 },
  curseImmune: true,
  stopImmune: true,
  damageCap: 0.20,
  evilKinoshitaAlly: true
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const alive = unit => !!unit && Number(unit.hp) > 0 && !unit.evilRetreated;
const clampX = x => Math.max(120, Math.min(Math.max(120, Number(worldWidth || 3000) - 178), Number(x) || 120));
const isPowerShielded = unit => Number(unit?.powerShieldMax || 0) > 0 || Number(unit?.powerShield || 0) > 0;
const setMark = (unit, icon, label, duration, type) => {
  if (typeof window.setStatusMark === 'function') window.setStatusMark(unit, icon, label, duration, type);
};
const updateHpBar = unit => {
  if (typeof window.updateHp === 'function') window.updateHp(unit);
  else if (unit?.el) {
    const fill = unit.el.querySelector?.('.hp i');
    if (fill) fill.style.width = Math.max(0, Number(unit.hp || 0) / Math.max(1, Number(unit.maxhp || 1)) * 100) + '%';
  }
};
const popup = (message, unit) => {
  if (typeof window.popup === 'function') window.popup(message, Number(unit?.x || 120), 90);
};

function effectLayer() {
  return document.getElementById('effects') || document.getElementById('field') || document.body;
}
function addEffect(className, x, width, icon) {
  const node = document.createElement('div');
  node.className = className;
  node.style.left = Number(x || 120) + 'px';
  if (width != null) node.style.width = Number(width) + 'px';
  if (icon) node.textContent = icon;
  effectLayer().appendChild(node);
  return node;
}
function portalVisual(x, duration = 2) {
  const node = addEffect('evilKinoshitaPortalFx', x, 76, '🌀');
  node.style.bottom = '34px';
  window.setTimeout(() => node.remove?.(), duration * 1000 + 100);
}
function beamVisual(actor, range, duration) {
  const leftward = !actor.isEnemy;
  const left = leftward ? Math.max(120, Number(actor.x || 120) - range) : Number(actor.x || 120);
  const node = addEffect('evilKinoshitaBeamFx', left, range, '');
  node.style.bottom = '46px';
  node.style.setProperty('--evil-beam-duration', duration + 's');
  window.setTimeout(() => node.remove?.(), duration * 1000 + 150);
}
function fallingVisual(x, icon) {
  const node = addEffect('evilKinoshitaFallingFx', x, 36, icon);
  node.style.bottom = '145px';
  window.setTimeout(() => node.remove?.(), 650);
}
function removeShieldDisplay(actor) {
  actor?.el?.querySelector?.('.powerShieldBar')?.remove?.();
  actor?.el?.querySelector?.('.powerShieldLabel')?.remove?.();
}
function updateShieldLabel(actor) {
  if (!actor?.el) return;
  if (typeof window.updatePowerShieldDisplay === 'function') window.updatePowerShieldDisplay(actor);
}

function setForm(actor, form, side) {
  if (!actor || !((side === 'enemy' && ENEMY_FORMS[form]) || (side === 'ally' && ALLY_FORMS[form]))) return;
  const spec = (side === 'enemy' ? ENEMY_FORMS : ALLY_FORMS)[form];
  actor.evilPhase = form;
  actor.evilSide = side;
  const growth = Math.max(1, Number(actor.evilAtkGrowth || 1));
  actor.atk = Math.round(spec.atk * growth);
  actor.range = spec.range;
  actor.spd = spec.spd;
  actor.interval = spec.interval;
  actor.attackType = spec.attackType;
  actor.kb = spec.kb;
  actor.kbRemaining = Math.min(Number(actor.kbRemaining ?? spec.kb), spec.kb);
  actor.evilBaseAtk = spec.atk;
  actor.cd = Math.max(Number(actor.cd || 0), 0.25);
  if (actor.el) {
    const type = actor.el.querySelector?.('.typeTag');
    if (type) type.textContent = spec.attackType === 'area' ? '範囲' : '単体';
    actor.el.dataset.evilPhase = form;
    actor.el.style.left = Number(actor.x || 120) + 'px';
  }
  updateHpBar(actor);
  updateShieldLabel(actor);
  setMark(actor, '🌀', spec.label, 3, 'evilKinoshitaPhase');
  popup('🌀 ' + spec.label, actor);
  if (form === 'domination') {
    if (side === 'enemy') scheduleEnemyWipe(actor);
    else scheduleAllyDominationBeam(actor);
  }
  if (form === 'final') {
    if (side === 'enemy') scheduleEnemyFinalBeam(actor);
    else scheduleAllyFinalBeam(actor);
  }
}

function createPortal(actor, x, targetSide, duration) {
  const at = now();
  const portal = {
    owner: actor,
    x: clampX(x),
    targetSide,
    expiresAt: at + duration,
    armedAt: at + 0.15,
    hitIds: new Set()
  };
  portals.push(portal);
  portalVisual(portal.x, duration);
  return portal;
}
function createFallingRain(actor, target, config) {
  const at = now();
  fallingRains.push({
    owner: actor,
    target,
    nextAt: at + config.interval,
    expiresAt: at + config.duration,
    interval: config.interval,
    damageRatio: config.damageRatio,
    slowFactor: config.slowFactor,
    slowDuration: config.slowDuration,
    iconIndex: 0,
    icons: config.icons
  });
}
function applySlow(target, factor, duration) {
  if (!alive(target) || target.slowImmune || target.ability?.slowImmune) return;
  const until = now() + duration;
  target.slowUntil = Math.max(Number(target.slowUntil || 0), until);
  target.slowFactor = Math.min(Number(target.slowFactor || 1), factor);
  setMark(target, '🐌', '移動速度' + Math.round((1 - factor) * 100) + '%低下', duration, 'evilKinoshitaSlow');
}
function applyStop(target, duration) {
  if (!alive(target) || target.stopImmune || target.ability?.stopImmune) return;
  const until = now() + duration;
  target.stopUntil = Math.max(Number(target.stopUntil || 0), until);
  setMark(target, '⏸️', '停止', duration, 'evilKinoshitaStop');
}

function spawnServants(actor, side, count, scale, interval) {
  for (let index = 0; index < count; index++) {
    window.setTimeout(() => {
      if (!alive(actor)) return;
      const spec = enemyTypes[SERVANT_NAME];
      if (!spec) return;
      if (side === 'enemy') {
        if (typeof window.spawnEnemy === 'function') {
          window.spawnEnemy(SERVANT_NAME, 'normal', scale, true, clampX(Number(actor.x || 120) - 34 - index * 18));
        }
        return;
      }
      const hp = Math.max(1, Math.round(Number(spec.hp || 2500000) * scale));
      const ally = {
        ...spec,
        hp,
        maxhp: hp,
        atk: Math.max(1, Math.round(Number(spec.atk || 37000) * scale)),
        range: Number(spec.range || 110),
        spd: Number(spec.spd || 1.3),
        interval: Number(spec.interval || 1.9),
        x: clampX(Number(actor.x || worldWidth - 190) + 34 + index * 18),
        cd: 0.15,
        id: 'evil-servant-' + Date.now() + '-' + index,
        isEnemy: false,
        owner: 'evil-kinoshita',
        motion: spec.motion || 'super',
        attackType: spec.attackType || 'single',
        kb: Number(spec.kb || 2),
        kbRemaining: Number(spec.kb || 2),
        ability: { ...(spec.ability || {}) },
        evilKinoshitaServant: true
      };
      units.push(ally);
      if (typeof window.renderUnitElement === 'function') window.renderUnitElement(ally);
    }, index * interval * 1000);
  }
}

function enemyFrontlineX() {
  const candidates = (Array.isArray(units) ? units : []).filter(alive);
  if (!candidates.length) return Math.max(160, Number(worldWidth || 3000) * 0.34);
  return clampX(Math.min(...candidates.map(unit => Number(unit.x || 120))) - 72);
}
function allyFrontlineX() {
  const candidates = (Array.isArray(enemies) ? enemies : []).filter(alive);
  if (!candidates.length) return Math.max(120, Number(worldWidth || 3000) - 260);
  return clampX(Math.max(...candidates.map(unit => Number(unit.x || 120))) + 72);
}
function initializeEnemy(actor) {
  if (!actor || actor.evilInitialized) return;
  actor.evilInitialized = true;
  actor.evilAtkGrowth = 1;
  actor.evilIntroDone = true;
  actor.barrier = 0;
  actor.barrierMax = 0;
  actor.powerShield = EVIL_ROBOT_SHIELD;
  actor.powerShieldMax = EVIL_ROBOT_SHIELD;
  actor.x = enemyFrontlineX();
  if (actor.el) actor.el.style.left = actor.x + 'px';
  portalVisual(actor.x, 1.2);
  setForm(actor, 'robot', 'enemy');
}
function initializeAlly(actor) {
  if (!actor || actor.evilInitialized) return;
  actor.evilInitialized = true;
  actor.evilAtkGrowth = 1;
  actor.evilIntroDone = true;
  actor.barrier = 0;
  actor.barrierMax = 0;
  actor.powerShield = ALLY_ROBOT_SHIELD;
  actor.powerShieldMax = ALLY_ROBOT_SHIELD;
  actor.x = allyFrontlineX();
  if (actor.el) actor.el.style.left = actor.x + 'px';
  portalVisual(actor.x, 1.2);
  setForm(actor, 'robot', 'ally');
}
function escapeRobot(actor, side) {
  if (!actor || actor.evilEscapedRobot) return;
  actor.evilEscapedRobot = true;
  actor.barrier = 0;
  actor.barrierMax = 0;
  actor.powerShield = 0;
  actor.powerShieldMax = 0;
  removeShieldDisplay(actor);
  actor.x = side === 'enemy' ? 120 : Math.max(120, Number(worldWidth || 3000) - 190);
  if (actor.el) actor.el.style.left = actor.x + 'px';
  portalVisual(actor.x, 1.1);
  setForm(actor, 'normal', side);
  popup('🌀 ポータル脱出！', actor);
}

function scheduleEnemyWipe(actor) {
  if (actor.evilWipeScheduled) return;
  actor.evilWipeScheduled = true;
  window.setTimeout(() => {
    if (!alive(actor) || actor.evilPhase !== 'domination' && actor.evilPhase !== 'final') return;
    beamVisual(actor, Math.max(500, Number(worldWidth || 3000) - 240), 1.2);
    for (const unit of [...(Array.isArray(units) ? units : [])]) {
      if (!unit || unit === actor || !alive(unit)) continue;
      unit.hp = 0;
      if (typeof window.removeUnit === 'function') window.removeUnit(unit);
    }
    for (const enemy of [...(Array.isArray(enemies) ? enemies : [])]) {
      if (!enemy || enemy === actor || !alive(enemy)) continue;
      enemy.hp = 0;
      if (typeof window.removeEnemy === 'function') window.removeEnemy(enemy);
    }
    popup('☄️ 支配の一撃', actor);
  }, 3000);
}
function scheduleAllyDominationBeam(actor) {
  if (actor.evilAllyDominationScheduled) return;
  actor.evilAllyDominationScheduled = true;
  window.setTimeout(() => {
    if (!alive(actor) || actor.evilPhase !== 'domination' && actor.evilPhase !== 'final') return;
    beamVisual(actor, 500, 1.2);
    for (const target of [...(Array.isArray(units) ? units : []), ...(Array.isArray(enemies) ? enemies : [])]) {
      if (!target || target === actor || !alive(target)) continue;
      const damage = Math.max(1, Math.round(Number(target.maxhp || target.hp || 1) * 0.15));
      window.hit(target, damage, actor, { evilAllyBeam: true });
      if (target.hp <= 0) {
        if (target.isEnemy && typeof window.removeEnemy === 'function') window.removeEnemy(target);
        else if (!target.isEnemy && typeof window.removeUnit === 'function') window.removeUnit(target);
      }
    }
    popup('☄️ 支配の一撃', actor);
  }, 3000);
}
function scheduleEnemyFinalBeam(actor) {
  if (actor.evilFinalBeamScheduled) return;
  actor.evilFinalBeamScheduled = true;
  window.setTimeout(() => {
    if (!alive(actor) || actor.evilPhase !== 'final') return;
    beamVisual(actor, 1000, 3);
    let hits = 0;
    const timer = window.setInterval(() => {
      if (!alive(actor) || actor.evilPhase !== 'final' || hits >= 15) {
        window.clearInterval(timer);
        return;
      }
      hits++;
      for (const target of [...(Array.isArray(units) ? units : [])]) {
        if (!alive(target) || Number(target.x || 0) < Number(actor.x || 0) || Number(target.x || 0) - Number(actor.x || 0) > 1000) continue;
        const damage = Math.max(1, Math.round(Number(target.maxhp || target.hp || 1) * 0.07 + Number(actor.atk || 0)));
        window.hit(target, damage, actor, { evilEnemyFinalBeam: true });
        if (target.hp <= 0 && typeof window.removeUnit === 'function') window.removeUnit(target);
      }
    }, 200);
    window.setTimeout(() => window.clearInterval(timer), 3150);
    popup('🌌 最高峰', actor);
  }, 3000);
}
function scheduleAllyFinalBeam(actor) {
  if (actor.evilAllyFinalBeamScheduled) return;
  actor.evilAllyFinalBeamScheduled = true;
  window.setTimeout(() => {
    if (!alive(actor) || actor.evilPhase !== 'final') return;
    beamVisual(actor, 500, 1.5);
    let hits = 0;
    const timer = window.setInterval(() => {
      if (!alive(actor) || actor.evilPhase !== 'final' || hits >= 5) {
        window.clearInterval(timer);
        return;
      }
      hits++;
      for (const target of [...(Array.isArray(enemies) ? enemies : [])]) {
        if (!alive(target) || Number(target.x || 0) > Number(actor.x || 0) || Number(actor.x || 0) - Number(target.x || 0) > 500) continue;
        const damage = Math.max(1, Math.round(Number(target.maxhp || target.hp || 1) * 0.02 + Number(actor.atk || 0)));
        window.hit(target, damage, actor, { evilAllyFinalBeam: true });
        if (target.hp <= 0 && typeof window.removeEnemy === 'function') window.removeEnemy(target);
      }
    }, 300);
    window.setTimeout(() => window.clearInterval(timer), 1650);
    popup('🌌 最高峰', actor);
  }, 3000);
}

if (typeof document !== 'undefined' && document.head) {
  const style = document.createElement('style');
  style.textContent = '.evilKinoshitaPortalFx{position:absolute;height:76px;border:5px solid #facc15;border-radius:50%;background:radial-gradient(ellipse,rgba(250,204,21,.45),rgba(30,41,59,.18) 60%,transparent 72%);box-shadow:0 0 18px #facc15,0 0 38px #f59e0b;transform:translateX(-50%);pointer-events:none;z-index:45;animation:evilPortalPulse .55s ease-in-out infinite alternate}.evilKinoshitaBeamFx{position:absolute;height:34px;background:linear-gradient(180deg,transparent,#fde68a 30%,#fef3c7 50%,#f59e0b 72%,transparent);filter:drop-shadow(0 0 10px #facc15);opacity:.9;pointer-events:none;z-index:48;animation:evilBeamFlash .18s linear infinite alternate}.evilKinoshitaFallingFx{position:absolute;height:42px;font-size:30px;text-align:center;pointer-events:none;z-index:52;animation:evilFallingObject .6s ease-in forwards}@keyframes evilPortalPulse{from{opacity:.55;scale:.9}to{opacity:1;scale:1.08}}@keyframes evilBeamFlash{from{opacity:.55}to{opacity:1}}@keyframes evilFallingObject{from{transform:translateY(0) rotate(-10deg);opacity:1}to{transform:translateY(120px) rotate(35deg);opacity:.1}}';
  document.head.appendChild(style);
}

if (typeof enemyTypes !== 'undefined') {
  enemyTypes[BOSS_NAME] = {
    name: BOSS_NAME,
    icon: '🌀👑',
    trait: '神話・天使',
    hp: 18000000,
    atk: ENEMY_FORMS.robot.atk,
    range: ENEMY_FORMS.robot.range,
    spd: ENEMY_FORMS.robot.spd,
    interval: ENEMY_FORMS.robot.interval,
    attackType: ENEMY_FORMS.robot.attackType,
    kb: 3,
    boss: true,
    money: 0,
    barrier: 0,
    powerShield: EVIL_ROBOT_SHIELD,
    powerShieldMax: EVIL_ROBOT_SHIELD,
    ability: enemyAbility,
    curseImmune: true,
    stopImmune: true,
    evilKinoshita: true
  };
}

if (typeof eventStages !== 'undefined' && !eventStages.some(stage => stage?.name === STAGE_NAME)) {
  eventStages.push({
    name: STAGE_NAME,
    width: 3000,
    baseHp: 2500000,
    xp: 40000,
    eventReward: ALLY_NAME,
    rewardCharacter: ALLY_NAME,
    enemies: ['酒呑童子', SERVANT_NAME, BOSS_NAME],
    schedule: [
      { t: 1, enemy: '酒呑童子', mult: 55.55, fixedMultiplier: true },
      { t: 7, enemy: SERVANT_NAME, mult: 0.5, fixedMultiplier: true },
      { t: 8, enemy: SERVANT_NAME, mult: 0.5, fixedMultiplier: true },
      { t: 9, enemy: SERVANT_NAME, mult: 0.5, fixedMultiplier: true },
      { t: 10, enemy: BOSS_NAME, role: 'boss', mult: 1, fixedMultiplier: true }
    ],
    repeatSpawns: [
      { start: 27, interval: 40, enemy: '酒呑童子', mult: 55.55, fixedMultiplier: true },
      { start: 33, interval: 39, enemy: SERVANT_NAME, mult: 0.5, fixedMultiplier: true }
    ]
  });
}

if (typeof cards !== 'undefined' && !cards.some(card => card?.name === ALLY_NAME)) {
  cards.push({
    id: cards.length,
    name: ALLY_NAME,
    cost: 1800,
    hp: 450000,
    atk: ALLY_FORMS.robot.atk,
    range: ALLY_FORMS.robot.range,
    spd: ALLY_FORMS.robot.spd,
    interval: ALLY_FORMS.robot.interval,
    recharge: 90,
    icon: '🌀👑',
    motion: 'scientist',
    attackType: ALLY_FORMS.robot.attackType,
    kb: 3,
    trait: '神話・天使',
    rarity: 'UR',
    series: '悪の木下降臨クリア報酬',
    specialReward: true,
    eventReward: STAGE_NAME,
    barrier: 0,
    powerShield: ALLY_ROBOT_SHIELD,
    powerShieldMax: ALLY_ROBOT_SHIELD,
    ability: allyAbility,
    skills: [
      { name: '降臨', desc: '登場時に前線へポータル移動し、ロボット形態とシールド500,000を獲得。' },
      { name: '脱出', desc: 'ロボットのシールドが0になると通常形態へ戻り、自陣の城前へ移動。' },
      { name: 'ポータル', desc: '通常形態以降、攻撃時10%で敵の足元にポータルを1.5秒生成。敵を敵城前へ移動させる。クールタイム12秒。' },
      { name: 'ポータル反撃', desc: '被弾時25%で2秒間、0.4秒ごとに物体を落とし、対象の最大HP2%ダメージと移動速度30%低下。クールタイム20秒。' },
      { name: '支配', desc: 'HP50%以下で支配形態へ変化。' },
      { name: '支配の一撃', desc: '支配形態3秒後に一度だけ発動。敵味方に最大HP15%のダメージ。' },
      { name: '召喚', desc: '支配形態以降、被弾時25%で最高神に使える者10%を1体召喚。生存中は被ダメージ20%を肩代わり。クールタイム65秒。' },
      { name: '支配', desc: 'HP10%以下で最終形態へ変化。' },
      { name: '最高峰', desc: '最終形態3秒後に一度だけ、前方射程500へ1.5秒ビーム。0.3秒ごとに最大HP2%+自身の攻撃力。' },
      { name: '撤退', desc: '味方版では撤退せず、通常どおり撃破される。' }
    ]
  });
}

const allyIndex = typeof cards !== 'undefined' ? cards.findIndex(card => card?.name === ALLY_NAME) : -1;
if (allyIndex >= 0) {
  cards[allyIndex].id = allyIndex;
  if (Array.isArray(ownedFlags) && ownedFlags.length < cards.length) ownedFlags.length = cards.length;
  if (Array.isArray(charLevel) && charLevel.length < cards.length) while (charLevel.length < cards.length) charLevel.push(1);
  if (Array.isArray(charMaxLevel) && charMaxLevel.length < cards.length) while (charMaxLevel.length < cards.length) charMaxLevel.push(20);
  if (Array.isArray(charForm) && charForm.length < cards.length) while (charForm.length < cards.length) charForm.push(1);
  if (Array.isArray(normalEvolved) && normalEvolved.length < cards.length) while (normalEvolved.length < cards.length) normalEvolved.push(false);
  const savedNames = Array.isArray(ownedCharacterNamesAtBoot) ? ownedCharacterNamesAtBoot : null;
  const cleared = typeof eventClears !== 'undefined' && eventClears[STAGE_NAME] === true;
  if (savedNames) {
    const names = new Set(savedNames);
    ownedFlags = cards.map((card, index) => index === 0 || names.has(card.name) || (index === allyIndex && cleared));
  } else if (cleared) {
    ownedFlags[allyIndex] = true;
  }
  if (typeof syncOwnedCount === 'function') syncOwnedCount();
  const savedFormationNames = Array.isArray(formationStableNamesAtBoot) && formationStableNamesAtBoot.length
    ? formationStableNamesAtBoot
    : Array.isArray(formationCharacterNamesAtBoot) ? formationCharacterNamesAtBoot : null;
  if (savedFormationNames?.includes(ALLY_NAME)) {
    const restored = savedFormationNames.map(name => cards.findIndex(card => card?.name === name)).filter(index => index >= 0 && hasCharacter(index)).slice(0, 10);
    if (restored.length) formation = restored;
    if (typeof normalizeFormation === 'function') normalizeFormation();
    if (typeof saveFormationStableNames === 'function') saveFormationStableNames();
  }
  if (typeof save === 'function') save();
}

const originalUpdateBarrierDisplay = window.updateBarrierDisplay;
if (typeof originalUpdateBarrierDisplay === 'function') {
  window.updateBarrierDisplay = function(actor) {
    const result = originalUpdateBarrierDisplay.apply(this, arguments);
    if (actor?.evilSide && actor?.evilInitialized) updateShieldLabel(actor);
    return result;
  };
}
const originalRenderUnitElement = window.renderUnitElement;
if (typeof originalRenderUnitElement === 'function') {
  window.renderUnitElement = function(actor) {
    if (actor?.name === ALLY_NAME && !actor.isEnemy) initializeAlly(actor);
    const result = originalRenderUnitElement.apply(this, arguments);
    if (actor?.name === ALLY_NAME && !actor.isEnemy) updateShieldLabel(actor);
    return result;
  };
}
const originalSpawnEnemy = window.spawnEnemy;
if (typeof originalSpawnEnemy === 'function') {
  window.spawnEnemy = function() {
    const actor = originalSpawnEnemy.apply(this, arguments);
    if (actor?.name === BOSS_NAME && actor.isEnemy) initializeEnemy(actor);
    return actor;
  };
}
const originalDamageTakenBy = window.damageTakenBy;
if (typeof originalDamageTakenBy === 'function') {
  window.damageTakenBy = function(target, attacker) {
    let damage = originalDamageTakenBy.apply(this, arguments);
    if (attacker?.name === BOSS_NAME && attacker.isEnemy && isPowerShielded(target)) damage *= 3;
    return Math.max(1, Math.round(damage));
  };
}
const originalDamageAgainst = window.damageAgainst;
if (typeof originalDamageAgainst === 'function') {
  window.damageAgainst = function(attacker, target, baseAttack) {
    let damage = originalDamageAgainst.apply(this, arguments);
    if (attacker?.name === ALLY_NAME && !attacker.isEnemy && isPowerShielded(target)) damage *= 1.5;
    return Math.max(1, Math.round(damage));
  };
}
const originalEnemyAttackTarget = window.enemyAttackTarget;
if (typeof originalEnemyAttackTarget === 'function') {
  window.enemyAttackTarget = function(actor, target) {
    if (actor?.name !== BOSS_NAME || !actor.isEnemy) return originalEnemyAttackTarget.apply(this, arguments);
    if (!alive(actor) || !alive(target)) return;
    const before = Number(target.hp || 0);
    const beforeShield = Number(target.powerShield || 0);
    const result = originalEnemyAttackTarget.apply(this, arguments);
    actor.evilAtkGrowth = Math.max(1, Number(actor.evilAtkGrowth || 1) * 1.07);
    actor.atk = Math.round(Number(actor.evilBaseAtk || ENEMY_FORMS[actor.evilPhase || 'robot'].atk) * actor.evilAtkGrowth);
    if ((Number(target.hp || 0) < before || Number(target.barrier || 0) < beforeBarrier) && Math.random() < 0.5) applyStop(target, 3);
    if (actor.evilPhase !== 'robot' && now() >= Number(actor.evilPortalNextAt || 0) && Math.random() < 0.30) {
      actor.evilPortalNextAt = now() + 8;
      createPortal(actor, target.x, 'ally', 2);
      popup('🌀 ポータル', actor);
    }
    return result;
  };
}
const originalHit = window.hit;
if (typeof originalHit === 'function') {
  window.hit = function(target, damage, source, abilitySource) {
    if (!target || !alive(target)) return originalHit.apply(this, arguments);
    if (source?.name === ALLY_NAME && !source.isEnemy && target.isEnemy && !abilitySource) {
      source.evilAtkGrowth = Math.min(1.5, Number(source.evilAtkGrowth || 1) * 1.02);
      const spec = ALLY_FORMS[source.evilPhase || 'robot'];
      source.atk = Math.round(spec.atk * source.evilAtkGrowth);
      if (Math.random() < 0.25) applyStop(target, 1.5);
      if (source.evilPhase !== 'robot' && now() >= Number(source.evilPortalNextAt || 0) && Math.random() < 0.10) {
        source.evilPortalNextAt = now() + 12;
        createPortal(source, target.x, 'enemy', 1.5);
      }
    }
    const isEnemyBoss = target.name === BOSS_NAME && target.isEnemy;
    const isAllyBoss = target.name === ALLY_NAME && !target.isEnemy;
    if (!isEnemyBoss && !isAllyBoss) return originalHit.apply(this, arguments);

    const beforeHp = Number(target.hp || 0);
    const beforeBarrier = Number(target.barrier || 0);
    let result;
    if (isEnemyBoss && ['domination', 'final'].includes(target.evilPhase)) {
      const servant = (Array.isArray(enemies) ? enemies : []).find(unit => unit?.name === SERVANT_NAME && unit.isEnemy && alive(unit));
      if (servant) {
        result = originalHit.call(this, servant, damage, source, abilitySource);
        if (servant.hp <= 0 && typeof window.removeEnemy === 'function') window.removeEnemy(servant);
      } else {
        const cap = Math.max(1, Number(target.maxhp || 1) * 0.05);
        result = originalHit.call(this, target, Math.min(Number(damage || 0), cap), source, abilitySource);
      }
    } else if (isAllyBoss && ['domination', 'final'].includes(target.evilPhase)) {
      const servant = (Array.isArray(units) ? units : []).find(unit => unit?.name === SERVANT_NAME && !unit.isEnemy && alive(unit));
      if (servant) {
        const shared = Math.max(1, Number(damage || 0) * 0.20);
        result = originalHit.call(this, servant, shared, source, abilitySource);
        if (servant.hp <= 0 && typeof window.removeUnit === 'function') window.removeUnit(servant);
        result = originalHit.call(this, target, Math.max(0, Number(damage || 0) - shared), source, abilitySource);
      } else {
        const cap = Math.max(1, Number(target.maxhp || 1) * 0.20);
        result = originalHit.call(this, target, Math.min(Number(damage || 0), cap), source, abilitySource);
      }
    } else if (isEnemyBoss) {
      const cap = Math.max(1, Number(target.maxhp || 1) * 0.05);
      result = originalHit.call(this, target, Math.min(Number(damage || 0), cap), source, abilitySource);
    } else {
      const cap = Math.max(1, Number(target.maxhp || 1) * 0.20);
      result = originalHit.call(this, target, Math.min(Number(damage || 0), cap), source, abilitySource);
    }

    const hpDamage = Math.max(0, beforeHp - Number(target.hp || 0));
    const shieldDamage = Math.max(0, beforeShield - Number(target.powerShield || 0));
    const tookDamage = Number(damage || 0) > 0 && !!source;
    if (tookDamage) {
      if (isEnemyBoss && isPowerShielded(source)) {
        source.attackDownUntil = Math.max(Number(source.attackDownUntil || 0), now() + 5);
        source.attackDownFactor = 0.1;
        setMark(source, '⬇️', '攻撃力90%低下', 5, 'evilKinoshitaAttackDown');
      }
      if (target.evilPhase !== 'robot' && source && alive(source) && now() >= Number(target.evilCounterNextAt || 0) && Math.random() < (isEnemyBoss ? 0.50 : 0.25)) {
        target.evilCounterNextAt = now() + (isEnemyBoss ? 15 : 20);
        createFallingRain(target, source, isEnemyBoss
          ? { duration: 3, interval: 0.3, damageRatio: 0.07, slowFactor: 0.5, slowDuration: 3, icons: ['🚗', '📦', '🪨', '🛞'] }
          : { duration: 2, interval: 0.4, damageRatio: 0.02, slowFactor: 0.7, slowDuration: 2, icons: ['🚙', '📦', '🪨'] });
      }
      if (isEnemyBoss && ['domination', 'final'].includes(target.evilPhase) &&
          now() >= Number(target.evilSummonNextAt || 0) && Math.random() < 0.50) {
        target.evilSummonNextAt = now() + 55;
        spawnServants(target, 'enemy', 3, 0.25, 1);
      }
      if (isAllyBoss && ['domination', 'final'].includes(target.evilPhase) &&
          now() >= Number(target.evilSummonNextAt || 0) && Math.random() < 0.25) {
        target.evilSummonNextAt = now() + 65;
        spawnServants(target, 'ally', 1, 0.10, 1);
      }
    }

    if (isEnemyBoss) {
      if (target.hp <= 0) {
        target.evilRetreated = true;
        target.hp = 0;
        if (typeof window.removeEnemy === 'function') window.removeEnemy(target, true);
        return result;
      }
      if (target.evilPhase === 'robot' && Number(target.powerShield || 0) <= 0) escapeRobot(target, 'enemy');
      else if (target.evilPhase === 'normal' && target.hp <= target.maxhp * 0.50) setForm(target, 'domination', 'enemy');
      else if (target.evilPhase === 'domination' && target.hp <= target.maxhp * 0.10) setForm(target, 'final', 'enemy');
    } else {
      if (target.evilPhase === 'robot' && Number(target.powerShield || 0) <= 0) escapeRobot(target, 'ally');
      else if (target.evilPhase === 'normal' && target.hp <= target.maxhp * 0.50) setForm(target, 'domination', 'ally');
      else if (target.evilPhase === 'domination' && target.hp <= target.maxhp * 0.10) setForm(target, 'final', 'ally');
    }
    updateHpBar(target);
    updateShieldLabel(target);
    return result;
  };
}

function tickEffects() {
  const time = now();
  for (let index = portals.length - 1; index >= 0; index--) {
    const portal = portals[index];
    if (time >= portal.expiresAt) {
      portals.splice(index, 1);
      continue;
    }
    if (time < portal.armedAt) continue;
    const targets = portal.targetSide === 'ally' ? units : enemies;
    const destination = portal.targetSide === 'ally' ? Math.max(120, Number(worldWidth || 3000) - 190) : 120;
    for (const target of [...(Array.isArray(targets) ? targets : [])]) {
      if (!alive(target) || target === portal.owner) continue;
      const id = String(target.id ?? target.name + ':' + target.x);
      if (portal.hitIds.has(id) || Math.abs(Number(target.x || 0) - portal.x) > 42) continue;
      portal.hitIds.add(id);
      target.x = destination;
      target.cd = Math.max(Number(target.cd || 0), 0.3);
      if (target.el) {
        target.el.style.left = target.x + 'px';
        target.el.classList?.add('hitback');
        window.setTimeout(() => target.el?.classList?.remove('hitback'), 250);
      }
      setMark(target, '🌀', 'ポータル転送', 1.5, 'evilKinoshitaWarp');
    }
  }
  for (let index = fallingRains.length - 1; index >= 0; index--) {
    const rain = fallingRains[index];
    if (time >= rain.expiresAt || !alive(rain.owner) || !alive(rain.target)) {
      fallingRains.splice(index, 1);
      continue;
    }
    if (time < rain.nextAt) continue;
    rain.nextAt += rain.interval;
    const icon = rain.icons[rain.iconIndex++ % rain.icons.length];
    fallingVisual(rain.target.x, icon);
    const damage = Math.max(1, Math.round(Number(rain.target.maxhp || rain.target.hp || 1) * rain.damageRatio));
    window.hit(rain.target, damage, rain.owner, { evilPortalObject: true });
    applySlow(rain.target, rain.slowFactor, rain.slowDuration);
    if (rain.target.hp <= 0) {
      if (rain.target.isEnemy && typeof window.removeEnemy === 'function') window.removeEnemy(rain.target);
      else if (!rain.target.isEnemy && typeof window.removeUnit === 'function') window.removeUnit(rain.target);
    }
  }
}
if (typeof window.setInterval === 'function' && !window.__evilKinoshitaEffectTimer) {
  window.__evilKinoshitaEffectTimer = window.setInterval(tickEffects, 80);
}

if (typeof window.KINOSHITA_REFRESH_CHARACTER_ROSTER_AUDIT === 'function') window.KINOSHITA_REFRESH_CHARACTER_ROSTER_AUDIT();
if (typeof window.renderStageSelect === 'function') window.renderStageSelect();
if (typeof window.renderCards === 'function') window.renderCards();
if (typeof window.renderOwnedStart === 'function') window.renderOwnedStart();
if (typeof window.renderFormation === 'function') window.renderFormation();
if (typeof window.renderFormationBuffSummary === 'function') window.renderFormationBuffSummary();
})();