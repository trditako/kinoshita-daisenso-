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
  curseImmune: true, slowImmune: true, attackDownImmune: true, warpImmune: true, yabayabaImmune: true, sealImmune: true,
  zeusServant: { damageCap: 0.15, healRatio: 0.25, healLimit: 100000, godBuff: 0.75 }
};

const enemyZeusAbility = {
  name: '最高神の雷霆・絶対神域',
  desc: '天使・神話・赤・宇宙から受けるダメージ85%軽減、同属性へ10倍ダメージ。実HPダメージの50%を回復・反射し、デバフを無効化。一度に受けるダメージは最大HPの7%まで。ふっとばす・呪い・停止・烈波を無効化し、波動ダメージを50%軽減。最高神に使える者が倒れるたび射程以外の全ステータス+25%（最大+100%）。攻撃時33%で停止2秒または攻撃力80%低下2秒、50%でふっとばす、ヤバヤバLv5。敵数×10%攻撃力上昇（上限なし）。登場時パワーシールド5,000,000。撃破ごとにシールド2%回復。シールド被弾時、吸収ダメージ25%反射・停止1秒・射程80%低下5秒。被弾ごとに防御力+5%（最大+75%）、場の最高神に使える者の防御力+7%（最大+70%）。',
  strong: { 天使: 10, 神話: 10, 赤: 10, 宇宙: 10 },
  resist: { 天使: 0.15, 神話: 0.15, 赤: 0.15, 宇宙: 0.15 },
  curseImmune: true, stopImmune: true, surgeImmune: true, slowImmune: true, attackDownImmune: true, warpImmune: true, yabayabaImmune: true, sealImmune: true,
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
  curseImmune: true, stopImmune: true, surgeImmune: true, slowImmune: true, attackDownImmune: true, warpImmune: true, yabayabaImmune: true, sealImmune: true,
  knockbackImmune: true, waveDamageFactor: 0.5,
  damageCap: 0.11,
  zeusAlly: { bands: [{ min: 0, max: 50, damage: 60000 }, { min: 100, max: 150, damage: 22222 }, { min: 200, max: 250, damage: 15000 }], defensePerHit: 0.05, defenseMax: 0.75, enemyCountAttack: 0.02, enemyCountMax: 0.20, shield: 100000, shieldKillRestore: 0.02, shieldReflect: 0.10, shieldStop: 1, shieldRangeFactor: 0.2, shieldRangeDuration: 3, stopChance: 0.33, stopDuration: 2, attackDownChance: 0.33, attackDownFactor: 0.2, attackDownDuration: 2 }
};

const enemyZeus = {
  name: ZEUS_ENEMY, icon: '⚡👑', trait: '最高神',
  hp: 26000000, atk: 150000, range: 600, senseRange: 600, detectRange: 600, spd: 0.4, interval: 3,
  attackType: 'area', kb: 3, boss: true, money: 30000,
  barrier: 5000000, ability: enemyZeusAbility,
  multiAttack: [150000, 55555, 35000],
  secondAtk: 55555, thirdAtk: 35000,
  stopChance: 0.33, stopDuration: 2,
  attackDownChance: 0.33, attackDownFactor: 0.2, attackDownDuration: 2,
  knockbackChance: 0.5, yabayaba: 5, yabayabaChance: 1,
  curseImmune: true, stopImmune: true, surgeImmune: true, slowImmune: true, attackDownImmune: true, warpImmune: true, yabayabaImmune: true, sealImmune: true,
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
      id: cards.length, name: ZEUS_ALLY, cost: 6000, hp: 180000, atk: 60000,
      secondAtk: 22222, thirdAtk: 15000, multiAttack: [60000, 22222, 15000],
      range: 600, senseRange: 600, detectRange: 600, attackRangeBands: allyZeusAbility.zeusAlly.bands, spd: 0.4, interval: 3, recharge: 180,
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
  // Zeus is registered after hitman.js performs the normal late-character restore.
  // Rehydrate it here from the persisted name list or the event-clear record.
  const zeusCardIndex = cards.findIndex(c => c && c.name === ZEUS_ALLY);
  if (zeusCardIndex >= 0 && Array.isArray(ownedFlags)) {
    const savedNames = typeof ownedCharacterNamesAtBoot !== 'undefined' && Array.isArray(ownedCharacterNamesAtBoot)
      ? ownedCharacterNamesAtBoot : [];
    const savedFormationNames = typeof formationStableNamesAtBoot !== 'undefined' && Array.isArray(formationStableNamesAtBoot)
      ? formationStableNamesAtBoot
      : (typeof formationCharacterNamesAtBoot !== 'undefined' && Array.isArray(formationCharacterNamesAtBoot) ? formationCharacterNamesAtBoot : []);
    const wasOwned = savedNames.includes(ZEUS_ALLY) || savedFormationNames.includes(ZEUS_ALLY);
    const wasCleared = typeof eventClears !== 'undefined' && eventClears && eventClears[STAGE_NAME] === true;
    if (wasOwned || wasCleared) ownedFlags[zeusCardIndex] = true;

    // Zeus is registered after the main save loader and hitman.js restoration.
    // Rebuild the saved formation by stable character names so its late ID is not lost on refresh.
    if (savedFormationNames.includes(ZEUS_ALLY) && typeof formation !== 'undefined' && Array.isArray(formation)) {
      const restored = savedFormationNames
        .map(name => cards.findIndex(card => card && card.name === name))
        .filter(id => id >= 0);
      for (const id of restored) ownedFlags[id] = true;
      formation = restored.slice(0, 10);
      if (typeof normalizeFormation === 'function') normalizeFormation();
      if (typeof saveFormationStableNames === 'function') saveFormationStableNames();
    }
    if (wasOwned || wasCleared || savedFormationNames.includes(ZEUS_ALLY)) {
      if (typeof syncOwnedCount === 'function') syncOwnedCount();
      if (typeof save === 'function') save();
    }
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

function allyZeusStrikeBandIndex(distance) {
  if (!Number.isFinite(distance) || distance < 0) return -1;
  return allyZeusAbility.zeusAlly.bands.findIndex(band => distance >= band.min && distance <= band.max);
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
function zeusLightning(target, color = '#facc15', source = null) {
  const effects = document.getElementById('effects');
  if (!target || !effects) return;
  const fx = document.createElement('div');
  fx.className = 'zeusLightningFx';
  const bolt = document.createElement('i');
  bolt.className = 'zeusLightningBolt';
  const branch = document.createElement('i');
  branch.className = 'zeusLightningBolt secondary';
  const flash = document.createElement('i');
  flash.className = 'zeusLightningFlash';
  fx.append(bolt, branch, flash);
  fx.style.setProperty('--zeus-color', color);
  const targetRect = target.el?.getBoundingClientRect?.();
  const sourceRect = source?.el?.getBoundingClientRect?.();
  const effectsRect = effects.getBoundingClientRect?.();
  if (targetRect && effectsRect) {
    fx.style.left = (targetRect.left + targetRect.width / 2 - effectsRect.left) + 'px';
    fx.style.top = Math.max(0, targetRect.top + targetRect.height / 2 - effectsRect.top - 148) + 'px';
  } else if (sourceRect && effectsRect && source) {
    const direction = Number(source.x || 0) >= 0 ? -1 : 1;
    fx.style.left = (sourceRect.left + sourceRect.width / 2 + (Number(target.x || 0) - Number(source.x || 0)) * direction - effectsRect.left) + 'px';
    fx.style.top = Math.max(0, sourceRect.top + sourceRect.height / 2 - effectsRect.top - 148) + 'px';
  } else {
    fx.style.left = Math.max(0, Number(target.x || 0)) + 'px';
    fx.style.bottom = '38px';
  }
  effects.appendChild(fx);
  setTimeout(() => fx.remove(), 620);
}
if (!document.getElementById('zeusLightningStyle')) {
  const style = document.createElement('style');
  style.id = 'zeusLightningStyle';
  style.textContent = `
    .zeusLightningFx{position:absolute;width:104px;height:178px;z-index:90;pointer-events:none;transform:translateX(-50%);filter:drop-shadow(0 0 8px var(--zeus-color,#facc15));animation:zeusStrike .58s ease-out forwards}
    .zeusLightningBolt{position:absolute;left:24px;top:0;width:58px;height:148px;background:linear-gradient(180deg,#fff 0%,var(--zeus-color,#facc15) 35%,#fff7b2 70%,var(--zeus-color,#facc15) 100%);clip-path:polygon(57% 0,18% 48%,44% 48%,22% 100%,86% 38%,58% 38%);filter:drop-shadow(0 0 8px #fff);animation:zeusBoltFlash .58s ease-out forwards}
    .zeusLightningBolt.secondary{left:49px;top:16px;width:34px;height:100px;opacity:.8;transform:rotate(12deg) scaleX(.7)}
    .zeusLightningFlash{position:absolute;left:50%;bottom:0;width:76px;height:34px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,#fff 0%,var(--zeus-color,#facc15) 25%,rgba(250,204,21,.45) 55%,transparent 76%);box-shadow:0 0 22px 8px rgba(250,204,21,.55);animation:zeusImpact .58s ease-out forwards}
    @keyframes zeusStrike{0%{opacity:0;transform:translate(-50%,-30px) scale(.75)}18%{opacity:1;transform:translate(-50%,0) scale(1.08)}68%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,14px) scale(.96)}}
    @keyframes zeusBoltFlash{0%,100%{opacity:.15}18%,62%{opacity:1}}
    @keyframes zeusImpact{0%,20%{opacity:0;transform:translateX(-50%) scale(.35)}45%{opacity:1;transform:translateX(-50%) scale(1.25)}100%{opacity:0;transform:translateX(-50%) scale(1.8)}}
  `;
  document.head.appendChild(style);
}

let zeusWaveContext = null;
const originalAllyWaveAttack = window.allyWaveAttack;
if (typeof originalAllyWaveAttack === 'function') {
  window.allyWaveAttack = function() {
    const previous = zeusWaveContext;
    zeusWaveContext = 'ally';
    try { return originalAllyWaveAttack.apply(this, arguments); }
    finally { zeusWaveContext = previous; }
  };
}
const originalEnemyWaveAttack = window.enemyWaveAttack;
if (typeof originalEnemyWaveAttack === 'function') {
  window.enemyWaveAttack = function() {
    const previous = zeusWaveContext;
    zeusWaveContext = 'enemy';
    try { return originalEnemyWaveAttack.apply(this, arguments); }
    finally { zeusWaveContext = previous; }
  };
}

const originalHit = window.hit;
if (typeof originalHit === 'function') {
  window.hit = function(target, damage, source, abilitySource) {
    if (!target || !live(target)) return originalHit.apply(this, arguments);
    if (source?.name === ZEUS_ALLY && target.isEnemy && !abilitySource?.zeusLightningResolved) {
      // Zeus attacks by calling down lightning across every band, not by hitting
      // the enemy selected by the normal attack loop.
      const attackNow = performance.now() / 1000;
      if (Number(source.zeusLightningNextAt || 0) <= attackNow) {
        source.zeusLightningNextAt = attackNow + Math.max(0.1, Number(source.interval || 3));
        const bands = allyZeusAbility.zeusAlly.bands;
        bands.forEach((band, bandIndex) => {
          const strike = () => {
            if (!live(source) || !Array.isArray(enemies)) return;
            const senseRange = Math.max(0, Number(source.senseRange || source.range || 600));
            const targets = enemies.filter(candidate => {
              if (!live(candidate) || !candidate.isEnemy || candidate.muscleGrabbedBy) return false;
              const distance = Math.abs(Number(candidate.x || 0) - Number(source.x || 0));
              return distance <= senseRange && distance >= band.min && distance <= band.max;
            });
            if (!targets.length) {
              const center = (band.min + band.max) / 2;
              const direction = Number(source.x || 0) >= 0 ? -1 : 1;
              zeusLightning({ x: Number(source.x || 0) + direction * center }, '#facc15', source);
              return;
            }
            const enemyCount = enemies.filter(live).length;
            const bonus = 1 + Math.min(allyZeusAbility.zeusAlly.enemyCountMax, enemyCount * allyZeusAbility.zeusAlly.enemyCountAttack);
            for (const victim of targets) {
              zeusLightning(victim, '#facc15', source);
              const rawDamage = Math.max(1, Math.round(Number(band.damage || 1) * bonus));
              const dealt = typeof damageAgainst === 'function' ? damageAgainst(source, victim, rawDamage) : rawDamage;
              window.hit(victim, dealt, source, { zeusLightningResolved: true, zeusBandIndex: bandIndex });
              if (victim.hp <= 0 && typeof window.removeEnemy === 'function') window.removeEnemy(victim);
            }
          };
          if (bandIndex === 0) strike();
          else setTimeout(strike, bandIndex * 500);
        });
      }
      return 0;
    }
    const isEnemyZeus = target.isEnemy && target.name === ZEUS_ENEMY;
    const isAllyZeus = !target.isEnemy && target.name === ZEUS_ALLY;
    const isServant = target.name === SERVANT;
    const incomingTraits = isEnemyZeus || isAllyZeus ? ['天使', '神話', '赤', '宇宙'] : isServant ? ['天使', '神話'] : [];
    const reduction = isEnemyZeus ? 0.15 : isAllyZeus ? 0.45 : isServant ? 0.05 : 1;
    let incoming = Math.max(0, Number(damage) || 0);
    if ((isEnemyZeus && zeusWaveContext === 'ally') || (isAllyZeus && zeusWaveContext === 'enemy')) incoming *= 0.5;
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
    if (isServant) incoming *= 1 - Math.min(0.70, Number(target.zeusDefenseStacks || 0) * 0.07);
    const beforeHp = Number(target.hp || 0);
    const beforeShield = Number(target.barrier || 0);
    const result = originalHit.call(this, target, incoming, source, abilitySource);
    const actual = Math.max(0, beforeHp - Number(target.hp || 0));
    if (actual > 0 && source) target.zeusLastDamageSource = source;
    const shieldDamage = Math.max(0, beforeShield - Number(target.barrier || 0));
    if ((isEnemyZeus || isAllyZeus) && (actual > 0 || shieldDamage > 0)) {
      if (actual > 0) {
        target.hp = Math.min(target.maxhp, target.hp + Math.round(actual * (isEnemyZeus ? 0.5 : 0.3)));
        if (source && live(source) && !abilitySource?.zeusReflection) {
          originalHit.call(this, source, Math.round(actual * (isEnemyZeus ? 0.5 : 0.2)), target, { zeusReflection: true });
        }
        updateHp(target);
      }
      target.zeusDefenseStacks = Math.min(15, Number(target.zeusDefenseStacks || 0) + 1);
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
    if (source?.name === ZEUS_ALLY && target.isEnemy && actual > 0) {
      const now = performance.now() / 1000;
      if (Math.random() < 0.33) {
        if (Math.random() < 0.5 && !target.stopImmune && !target.ability?.stopImmune) {
          target.stopUntil = Math.max(Number(target.stopUntil || 0), now + 2);
          if (typeof window.setStatusMark === 'function') window.setStatusMark(target, '⏸️', '停止', 2, 'zeusStop');
        } else if (!target.attackDownImmune && !target.ability?.attackDownImmune) {
          target.attackDownUntil = Math.max(Number(target.attackDownUntil || 0), now + 2);
          target.attackDownFactor = 0.2;
          if (typeof window.setStatusMark === 'function') window.setStatusMark(target, '⬇️', '攻撃力80%低下', 2, 'zeusAttackDown');
        }
      }
    }
    // Zeus should emit lightning when it attacks, not when it is hit.
    // Attack impact visuals are emitted by the dedicated ally/enemy strike handlers.
    return result;
  };
}

const originalEnemyAttackTarget = window.enemyAttackTarget;
if (typeof originalEnemyAttackTarget === 'function') {
  window.enemyAttackTarget = function(enemy, target, ea, now, sealed) {
    if (!enemy) return originalEnemyAttackTarget.apply(this, arguments);
    if (enemy.name === SERVANT) {
      const multiplier = traitIs(target, ['天使', '神話']) ? 8 : 1;
      const before = Number(target?.hp || 0);
      const scaledServant = multiplier === 1 ? enemy : { ...enemy, atk: Math.round(Number(enemy.atk || 1) * multiplier) };
      const result = originalEnemyAttackTarget.call(this, scaledServant, target, ea, now, sealed);
      const actual = Math.max(0, before - Number(target?.hp || 0));
      const god = Array.isArray(enemies) ? enemies.find(e => e?.name === ZEUS_ENEMY && live(e)) : null;
      if (god && actual > 0) {
        const healed = Math.min(Math.max(0, 100000 - Number(enemy.zeusHealTotal || 0)), Math.round(actual * 0.25));
        enemy.zeusHealTotal = Number(enemy.zeusHealTotal || 0) + healed;
        god.hp = Math.min(god.maxhp, god.hp + healed);
        updateHp(god);
      }
      return result;
    }
    if (enemy.name !== ZEUS_ENEMY) return originalEnemyAttackTarget.apply(this, arguments);
    const attackNow = Number(now || performance.now() / 1000);
    if (Number(enemy.zeusLastAttackAt ?? -999) > attackNow - Math.max(0.1, Number(enemy.interval || 3))) return;
    enemy.zeusLastAttackAt = attackNow;
    const bands = enemyZeusAbility.zeusEnemy.bands;
    for (let index = 0; index < bands.length; index++) {
      const band = bands[index];
      const fire = () => {
        if (!live(enemy)) return;
        const targets = (Array.isArray(units) ? units : []).filter(unit => {
          if (!live(unit) || unit.isEnemy || unit.muscleGrabbedBy) return false;
          const distance = Math.abs(Number(unit.x || 0) - Number(enemy.x || 0));
          return distance >= band.min && distance <= band.max && distance <= Number(enemy.senseRange || enemy.range || 600);
        });
        if (!targets.length) {
          const center = (band.min + band.max) / 2;
          zeusLightning({ x: Number(enemy.x || 0) + center }, '#facc15', enemy);
        }
        for (const unit of targets) {
          const godBonus = 1 + (Array.isArray(enemies) ? enemies.length : 1) * 0.10;
          const traitBonus = traitIs(unit, ['天使', '神話', '赤', '宇宙']) ? 10 : 1;
          const scaled = { ...enemy, atk: Math.round(band.damage * godBonus * traitBonus) };
          originalEnemyAttackTarget.call(this, scaled, unit, ea, performance.now() / 1000, sealed);
          zeusLightning(unit, '#facc15', enemy);
          if (unit.hp <= 0) {
            const shieldMax = Number(enemy.barrierMax || enemy.barrier || enemyZeusAbility.zeusEnemy.shield);
            enemy.barrier = Math.min(shieldMax, Number(enemy.barrier || 0) + shieldMax * 0.02);
            if (typeof window.updatePowerShieldDisplay === 'function') window.updatePowerShieldDisplay(enemy);
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
      const bandIndex = allyZeusStrikeBandIndex(distance);
      const band = bandIndex < 0 ? null : allyZeusAbility.zeusAlly.bands[bandIndex];
      if (!band || distance > Math.max(0, Number(source.senseRange || source.range || 600))) return [];
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
    if (enemy?.name === ZEUS_ENEMY) {
      const label = enemy.el?.querySelector?.('.barrierLabel');
      if (label) label.textContent = '⚡ パワーシールド ' + Math.ceil(enemy.barrier || 0).toLocaleString() + ' / ' + Math.ceil(enemy.barrierMax || 5000000).toLocaleString();
    }
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

const originalRemoveEnemy = window.removeEnemy;
if (typeof originalRemoveEnemy === 'function') {
  window.removeEnemy = function(victim) {
    const wasServant = victim?.name === SERVANT && Number(victim.hp) <= 0;
    const result = originalRemoveEnemy.apply(this, arguments);
    if (victim?.zeusLastDamageSource?.name === ZEUS_ALLY && Array.isArray(units)) {
      const ally = units.find(u => u?.name === ZEUS_ALLY && live(u));
      if (ally) {
        const maximum = Number(ally.powerShieldMax || 100000);
        ally.powerShield = Math.min(maximum, Number(ally.powerShield || 0) + maximum * 0.02);
        if (typeof window.updatePowerShieldDisplay === 'function') window.updatePowerShieldDisplay(ally);
      }
    }
    if (wasServant && Array.isArray(enemies)) {
      const god = enemies.find(e => e?.name === ZEUS_ENEMY && live(e));
      if (god) {
        god.zeusServantDeaths = Math.min(4, Number(god.zeusServantDeaths || 0) + 1);
        const factor = 1.25;
        god.maxhp = Math.round(Number(god.maxhp || 1) * factor);
        god.hp = Math.min(god.maxhp, Math.round(Number(god.hp || 0) * factor));
        god.atk = Math.round(Number(god.atk || 1) * factor);
        god.spd = Number(god.spd || 0.4) * factor;
        god.interval = Math.max(0.1, Number(god.interval || 3) / factor);
        updateHp(god);
        if (typeof window.setStatusMark === 'function') window.setStatusMark(god, '⚡', '使える者撃破強化 +' + god.zeusServantDeaths * 25 + '%', 999999, 'zeusServantDeath');
      }
    }
    return result;
  };
}
const originalRenderUnitElement = window.renderUnitElement;
if (typeof originalRenderUnitElement === 'function') {
  window.renderUnitElement = function(unit) {
    const result = originalRenderUnitElement.apply(this, arguments);
    if (unit?.name === ZEUS_ALLY) {
      if (unit.powerShieldMax == null) unit.powerShieldMax = 100000;
      if (unit.powerShield == null) unit.powerShield = unit.powerShieldMax;
      if (typeof window.updatePowerShieldDisplay === 'function') window.updatePowerShieldDisplay(unit);
    }
    return result;
  };
}

// The main inline script renders the stage list before this feature script loads.
// Refresh the visible UI after registering the stage and reward character.
if (typeof renderStageSelect === 'function') renderStageSelect();
if (typeof renderCards === 'function') renderCards();
if (typeof renderOwnedStart === 'function') renderOwnedStart();
if (typeof renderFormation === 'function') renderFormation();
if (typeof renderFormationBuffSummary === 'function') renderFormationBuffSummary();
})();