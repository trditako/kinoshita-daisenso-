(() => {
'use strict';
if (window.__ZEUS_RAID_V1__) return;
window.__ZEUS_RAID_V1__ = true;

const STAGE_NAME = '最高神:ゼウス降臨';
const ZEUS_ENEMY = '最高神:ゼウス';
const ZEUS_ALLY = '最高神:ゼウス';
const SERVANT = '最高神に使える者';

const servantAbility = {
  name: '最高神への忠誠',
  desc: '天使・神話属性から受けるダメージを95%軽減し、同属性へ8倍ダメージ。天使・神話属性からのデバフを無効化。一度に受けるダメージは最大HPの15%まで。ふっとばす・停止・波動を無効化。敵版ゼウスが場にいる間は全ステータス+75%。攻撃で与えた実ダメージの25%をゼウスへ回復（1体につき合計100,000まで）。',
  strong: { 天使: 8, 神話: 8 },
  resist: { 天使: 0.05, 神話: 0.05 },
  stopImmune: true, knockbackImmune: true, waveImmune: true,
  curseImmune: true, slowImmune: true, attackDownImmune: true,
  zeusServant: { damageCap: 0.15, healRatio: 0.25, healLimit: 100000, godBuff: 0.75 }
};

const enemyZeusAbility = {
  name: '最高神の雷霆・絶対神域',
  desc: '天使・神話・赤・宇宙から受けるダメージ85%軽減、同属性へ10倍ダメージ。実HPダメージの50%を回復・反射し、デバフを無効化。一度に受けるダメージは最大HPの7%まで。ふっとばす・呪い・停止・烈波を無効化し、波動ダメージを50%軽減。最高神に使える者が倒れるたび射程以外の全ステータス+25%（最大+100%）。攻撃時33%で停止2秒または攻撃力80%低下2秒、50%でふっとばす、ヤバヤバLv5。敵数×10%攻撃力上昇（上限なし）。登場時パワーシールド5,000,000。撃破ごとにシールド2%回復。シールド被弾時、吸収ダメージ25%反射・停止1秒・射程80%低下5秒。被弾ごとに防御力+5%（最大+75%）、場の最高神に使える者の防御力+7%（最大+70%）。',
  strong: { 天使: 10, 神話: 10, 赤: 10, 宇宙: 10 },
  resist: { 天使: 0.15, 神話: 0.15, 赤: 0.15, 宇宙: 0.15 },
  curseImmune: true, stopImmune: true, surgeImmune: true,
  knockbackImmune: true, waveDamageFactor: 0.5,
  damageCap: 0.07,
  zeusEnemy: {
    bands: [{ min: 0, max: 100, damage: 150000 }, { min: 150, max: 250, damage: 55555 }, { min: 300, max: 400, damage: 35000 }],
    interval: 0.5, healRatio: 0.5, reflectRatio: 0.5,
    defensePerHit: 0.05, defenseMax: 0.75,
    servantDefensePerHit: 0.07, servantDefenseMax: 0.70,
    servantDeathPerStack: 0.25, servantDeathMax: 1,
    enemyCountAttack: 0.10, shield: 5000000,
    shieldKillRestore: 0.02, shieldReflect: 0.25,
    shieldStop: 1, shieldRangeFactor: 0.2, shieldRangeDuration: 5
  },
  stopChance: 0.33, stopDuration: 2,
  attackDownChance: 0.33, attackDownFactor: 0.2, attackDownDuration: 2,
  knockbackChance: 0.5, yabayaba: 5, yabayabaChance: 1
};

const allyZeusAbility = {
  name: '最高神の雷霆・神授の加護',
  desc: '天使・神話・赤・宇宙から受けるダメージ55%軽減、同属性へ5倍ダメージ。受けた実HPダメージの30%を回復し20%反射。全デバフ無効。一度に受けるダメージは最大HPの11%まで。ふっとばす・呪い・停止・烈波を無効化し、波動ダメージを50%軽減。攻撃時33%で停止2秒または攻撃力80%低下2秒。敵数×2%攻撃力上昇（最大+20%）。登場時パワーシールド100,000。敵撃破ごとにシールド2%回復。シールド被弾時、吸収ダメージ10%反射・停止1秒・射程80%低下3秒。被弾ごとに防御力+5%（最大+75%）。',
  strong: { 天使: 5, 神話: 5, 赤: 5, 宇宙: 5 },
  resist: { 天使: 0.45, 神話: 0.45, 赤: 0.45, 宇宙: 0.45 },
  curseImmune: true, stopImmune: true, surgeImmune: true,
  knockbackImmune: true, waveDamageFactor: 0.5,
  damageCap: 0.11,
  zeusAlly: { bands: [{ min: 0, max: 50, damage: 60000 }, { min: 100, max: 150, damage: 22222 }, { min: 200, max: 250, damage: 15000 }], defensePerHit: 0.05, defenseMax: 0.75, enemyCountAttack: 0.02, enemyCountMax: 0.20, shield: 100000, shieldKillRestore: 0.02, shieldReflect: 0.10, shieldStop: 1, shieldRangeFactor: 0.2, shieldRangeDuration: 3, stopChance: 0.33, stopDuration: 2, attackDownChance: 0.33, attackDownFactor: 0.2, attackDownDuration: 2 }
};

const enemyZeus = {
  name: ZEUS_ENEMY, icon: '⚡👑', trait: '最高神',
  hp: 26000000, atk: 150000, range: 400, spd: 0.4, interval: 3,
  attackType: 'area', kb: 3, boss: true, money: 30000,
  barrier: 5000000, ability: enemyZeusAbility,
  multiAttack: [150000, 55555, 35000],
  secondAtk: 55555, thirdAtk: 35000,
  stopChance: 0.33, stopDuration: 2,
  attackDownChance: 0.33, attackDownFactor: 0.2, attackDownDuration: 2,
  knockbackChance: 0.5, yabayaba: 5, yabayabaChance: 1,
  curseImmune: true, stopImmune: true, surgeImmune: true,
  knockbackImmune: true, waveDamageFactor: 0.5
};
const servantEnemy = {
  name: SERVANT, icon: '🧊⚔️', trait: '氷',
  hp: 2500000, atk: 37000, range: 110, spd: 1.3,
  interval: 1.9, attackType: 'single', kb: 2, money: 4000,
  ability: servantAbility, curseImmune: true, stopImmune: true,
  knockbackImmune: true, waveImmune: true
};

if (typeof cards !== 'undefined' && typeof enemyTypes !== 'undefined' && typeof eventStages !== 'undefined') {
  if (!cards.some(c => c && c.name === ZEUS_ALLY)) {
    cards.push({
      name: ZEUS_ALLY, cost: 6000, hp: 180000, atk: 60000,
      secondAtk: 22222, thirdAtk: 15000, multiAttack: [60000, 22222, 15000],
      range: 250, spd: 0.4, interval: 3, recharge: 180,
      icon: '⚡👑', motion: 'super', attackType: 'area', kb: 3,
      trait: '最高神', rarity: 'UR', series: '最高神',
      ability: allyZeusAbility, strong: allyZeusAbility.strong,
      resist: allyZeusAbility.resist, curseImmune: true,
      stopImmune: true, surgeImmune: true, knockbackImmune: true,
      waveDamageFactor: 0.5
    });
    if (typeof CURRENT_CHARACTER_COUNT !== 'undefined') CURRENT_CHARACTER_COUNT = cards.length;
    if (typeof charLevel !== 'undefined') while (charLevel.length < cards.length) charLevel.push(1);
    if (typeof charMaxLevel !== 'undefined') while (charMaxLevel.length < cards.length) charMaxLevel.push(20);
    if (typeof charForm !== 'undefined') while (charForm.length < cards.length) charForm.push(1);
    if (typeof normalEvolved !== 'undefined') while (normalEvolved.length < cards.length) normalEvolved.push(false);
    if (typeof ownedFlags !== 'undefined') while (ownedFlags.length < cards.length) ownedFlags.push(false);
  }
  enemyTypes[ZEUS_ENEMY] = enemyZeus;
  enemyTypes[SERVANT] = servantEnemy;
  if (!eventStages.some(s => s && s.name === STAGE_NAME)) {
    eventStages.push({
      name: STAGE_NAME, width: 2600, baseHp: 500000, xp: 20000,
      eventReward: ZEUS_ALLY, rewardCharacter: ZEUS_ALLY,
      enemies: ['酒呑童子', ZEUS_ENEMY, SERVANT, 'メタル木下'],
      schedule: [
        { t: 0, enemy: '酒呑童子', mult: 55.55, fixedMultiplier: true },
        { t: 0, enemy: ZEUS_ENEMY, mult: 1, fixedMultiplier: true, role: 'boss' }
      ],
      repeatSpawns: [
        { start: 8, interval: 25, enemy: SERVANT, mult: 2.5, fixedMultiplier: true },
        { start: 15, interval: 17, enemy: 'メタル木下', mult: 0.5, fixedMultiplier: true }
      ],
      triggerSpawns: { threshold: 0.99, spawns: [], repeats: [] },
      knockbackAll: true
    });
  }
}

function live(entity) { return !!entity && Number(entity.hp) > 0; }
function traitIs(entity, names) {
  const raw = String(entity?.trait || entity?.attribute || '');
  return names.some(name => raw.includes(name));
}
function updateHp(entity) {
  const bar = entity?.el?.querySelector?.('.hp i');
  if (bar) bar.style.width = Math.max(0, Number(entity.hp || 0) / Math.max(1, Number(entity.maxhp || 1)) * 100) + '%';
  const label = entity?.el?.querySelector?.('.hpLabel');
  if (label) label.textContent = Math.ceil(entity.hp).toLocaleString() + ' / ' + Math.ceil(entity.maxhp).toLocaleString();
}
function zeusLightning(target, color = '#facc15') {
  if (!target || !document.getElementById('effects')) return;
  const fx = document.createElement('div');
  fx.textContent = '⚡';
  fx.style.cssText = 'position:absolute;z-index:80;pointer-events:none;font-size:42px;font-weight:1000;filter:drop-shadow(0 0 8px ' + color + ');left:' + Math.max(0, Number(target.x || 0) - 16) + 'px;bottom:100px;animation:zeusBolt .45s ease-out forwards';
  document.getElementById('effects').appendChild(fx);
  setTimeout(() => fx.remove(), 500);
}
if (!document.getElementById('zeusLightningStyle')) {
  const style = document.createElement('style');
  style.id = 'zeusLightningStyle';
  style.textContent = '@keyframes zeusBolt{0%{opacity:0;transform:translateY(-100px) scale(.5)}35%{opacity:1;transform:translateY(0) scale(1.25)}100%{opacity:0;transform:translateY(18px) scale(.8)}}';
  document.head.appendChild(style);
}

const originalHit = window.hit;
if (typeof originalHit === 'function') {
  window.hit = function(target, damage, source, abilitySource) {
    if (!target || !live(target)) return originalHit.apply(this, arguments);
    const isEnemyZeus = target.isEnemy && target.name === ZEUS_ENEMY;
    const isAllyZeus = !target.isEnemy && target.name === ZEUS_ALLY;
    const isServant = target.name === SERVANT;
    const incomingTraits = isEnemyZeus || isAllyZeus ? ['天使', '神話', '赤', '宇宙'] : isServant ? ['天使', '神話'] : [];
    const reduction = isEnemyZeus ? 0.15 : isAllyZeus ? 0.45 : isServant ? 0.05 : 1;
    let incoming = Math.max(0, Number(damage) || 0);
    if (source && traitIs(source, incomingTraits)) incoming *= reduction;
    if (isEnemyZeus || isAllyZeus || isServant) {
      const capRatio = isEnemyZeus ? 0.07 : isAllyZeus ? 0.11 : 0.15;
      incoming = Math.min(incoming, Math.max(1, Number(target.maxhp || 1) * capRatio));
    }
    if (isEnemyZeus) {
      const stacks = Number(target.zeusDefenseStacks || 0);
      incoming *= 1 - Math.min(0.75, stacks * 0.05);
    }
    if (isAllyZeus) incoming *= 1 - Math.min(0.75, Number(target.zeusDefenseStacks || 0) * 0.05);
    const beforeHp = Number(target.hp || 0);
    const beforeShield = Number(target.barrier || 0);
    const result = originalHit.call(this, target, incoming, source, abilitySource);
    const actual = Math.max(0, beforeHp - Number(target.hp || 0));
    const shieldDamage = Math.max(0, beforeShield - Number(target.barrier || 0));
    if ((isEnemyZeus || isAllyZeus) && actual > 0) {
      target.hp = Math.min(target.maxhp, target.hp + Math.round(actual * (isEnemyZeus ? 0.5 : 0.3)));
      if (source && live(source) && !abilitySource?.zeusReflection) {
        originalHit.call(this, source, Math.round(actual * (isEnemyZeus ? 0.5 : 0.2)), target, { zeusReflection: true });
      }
      target.zeusDefenseStacks = Math.min(15, Number(target.zeusDefenseStacks || 0) + 1);
      updateHp(target);
      const defenseGain = isEnemyZeus ? 0.07 : 0;
      if (defenseGain && Array.isArray(enemies)) {
        for (const servant of enemies) if (servant?.name === SERVANT && live(servant)) {
          servant.zeusDefenseStacks = Math.min(10, Number(servant.zeusDefenseStacks || 0) + 1);
        }
      }
    }
    if ((isEnemyZeus || isAllyZeus) && shieldDamage > 0 && source && live(source) && !abilitySource?.zeusReflection) {
      originalHit.call(this, source, Math.max(1, Math.round(shieldDamage * (isEnemyZeus ? 0.25 : 0.10))), target, { zeusReflection: true });
      const now = performance.now() / 1000;
      if (!source.stopImmune && !source.ability?.stopImmune) {
        source.stopUntil = Math.max(Number(source.stopUntil || 0), now + 1);
      }
      const factor = 0.2, duration = isEnemyZeus ? 5 : 3;
      if (source.zeusRangeBase == null) source.zeusRangeBase = Number(source.range || 0);
      source.range = Math.max(1, Number(source.zeusRangeBase) * factor);
      source.zeusRangeUntil = now + duration;
      setTimeout(() => {
        if (live(source) && Number(source.zeusRangeUntil || 0) <= performance.now() / 1000) {
          source.range = Number(source.zeusRangeBase || source.range);
          source.zeusRangeBase = null;
        }
      }, duration * 1000 + 50);
      if (typeof window.setStatusMark === 'function') window.setStatusMark(source, '⚡', 'シールド反射・停止／射程低下', duration, 'zeusShield');
    }
    if (isServant && actual > 0 && source && traitIs(source, ['天使', '神話'])) {
      target.hp = Math.min(target.maxhp, target.hp + Math.round(actual * 0));
    }
    if ((isEnemyZeus || isAllyZeus) && target.hp > 0) zeusLightning(target);
    return result;
  };
}

const originalEnemyAttackTarget = window.enemyAttackTarget;
if (typeof originalEnemyAttackTarget === 'function') {
  window.enemyAttackTarget = function(enemy, target, ea, now, sealed) {
    if (!enemy || enemy.name !== ZEUS_ENEMY) return originalEnemyAttackTarget.apply(this, arguments);
    const attackNow = Number(now || performance.now() / 1000);
    if (Number(enemy.zeusLastAttackAt || -999) > attackNow - 0.18) return;
    enemy.zeusLastAttackAt = attackNow;
    const bands = enemyZeusAbility.zeusEnemy.bands;
    const segments = bands.map((band, index) => ({ band, index }));
    for (const { band, index } of segments) {
      const fire = () => {
        if (!live(enemy)) return;
        const targets = (Array.isArray(units) ? units : []).filter(unit => live(unit) && !unit.isEnemy && !unit.muscleGrabbedBy &&
          Math.abs(Number(unit.x || 0) - Number(enemy.x || 0)) >= band.min &&
          Math.abs(Number(unit.x || 0) - Number(enemy.x || 0)) <= band.max);
        for (const unit of targets) {
          const scaled = { ...enemy, atk: Math.round(band.damage * (1 + (Array.isArray(enemies) ? enemies.length : 1) * 0.10)) };
          originalEnemyAttackTarget.call(this, scaled, unit, ea, performance.now() / 1000, sealed);
          zeusLightning(unit);
          if (unit.hp <= 0 && Array.isArray(enemies)) {
            for (const servant of enemies) if (servant?.name === SERVANT && live(servant)) {
              servant.zeusDeathCounted = servant.zeusDeathCounted || false;
            }
          }
        }
      };
      if (index === 0) fire();
      else setTimeout(fire, index * 500);
    }
  };
}

const originalSequence = window.getAttackSequence;
if (typeof originalSequence === 'function') {
  window.getAttackSequence = function(source, target) {
    if (source?.name === ZEUS_ALLY && Array.isArray(allyZeusAbility.zeusAlly.bands)) {
      const distance = Math.abs(Number(target?.x || 0) - Number(source.x || 0));
      const band = allyZeusAbility.zeusAlly.bands.find(b => distance >= b.min && distance <= b.max);
      if (!band) return [];
      const enemyCount = Array.isArray(enemies) ? enemies.filter(live).length : 0;
      const bonus = 1 + Math.min(allyZeusAbility.zeusAlly.enemyCountMax, enemyCount * allyZeusAbility.zeusAlly.enemyCountAttack);
      return [{ damage: Math.round(band.damage * bonus), index: 0 }];
    }
    return originalSequence.apply(this, arguments);
  };
}

const originalSpawnEnemy = window.spawnEnemy;
if (typeof originalSpawnEnemy === 'function') {
  window.spawnEnemy = function(key) {
    const enemy = originalSpawnEnemy.apply(this, arguments);
    if (enemy?.name === SERVANT && Array.isArray(enemies) && enemies.some(e => e?.name === ZEUS_ENEMY && live(e))) {
      const factor = 1.75;
      enemy.hp = enemy.maxhp = Math.round(enemy.maxhp * factor);
      enemy.atk = Math.round(enemy.atk * factor);
      enemy.range = Math.round(enemy.range * factor);
      enemy.spd *= factor;
      enemy.interval /= factor;
      enemy.zeusGodBuffApplied = true;
      updateHp(enemy);
    }
    return enemy;
  };
}
})();