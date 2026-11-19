(() => {
'use strict';
if (window.__KINOSHITA_WAMUU_OPERATOR_TRIAL__) return;
if (typeof isOperatorPlayer !== 'function' || !isOperatorPlayer(playerRankingId)) return;
if (typeof cards === 'undefined' || typeof ownedFlags === 'undefined') return;
if (cards.some(card => card && card.name === 'ワムウ')) return;
window.__KINOSHITA_WAMUU_OPERATOR_TRIAL__ = true;

const NAME = 'ワムウ'; // Operator-only prototype; tune after live trial battles.
const TRIAL_STATS = Object.freeze({
  hp: 250000, atk: 22200, range: 300, spd: 0.75,
  interval: 1.2, cost: 1800, recharge: 60,
  lifeReversalRatio: 0.08, lifeReversalHeal: 0.045,
  indomitableThreshold: 0.35, damageReduction: 0.10
});
const SKILLS = Object.freeze({
  X: { cooldown: 8, label: 'X・神砂嵐' },
  A: { cooldown: 20, label: 'A・引き寄せ' },
  Y: { cooldown: 22, label: 'Y・絶対防御' },
  ZL: { cooldown: 26, label: 'ZL・流法' },
  R: { cooldown: 45, label: 'R・究極奥義' }
});
const card = {
  id: cards.length, name: NAME, cost: TRIAL_STATS.cost,
  hp: TRIAL_STATS.hp, atk: TRIAL_STATS.atk, range: TRIAL_STATS.range,
  spd: TRIAL_STATS.spd, interval: TRIAL_STATS.interval,
  recharge: TRIAL_STATS.recharge, icon: '🌪️', motion: 'super',
  attackType: 'area', kb: 3, trait: '神話', rarity: 'UR',
  series: 'はじプロ移植・運営試用', operatorOnly: true,
  ability: {
    name: '風の流法・究極生命体',
    desc: '通常ダメージ10%軽減。0.15秒以内に最大HPの8%以上の実HPダメージを受けると、2秒間すべてのダメージを無効化し、HP・シールドを最大HPの4.5%ずつ2回回復（再発動15秒）。HP35%以上で状態異常の残り時間を98%短縮。シールドの有無に応じて敵シールドへ干渉する。数値は運営試用版。',
    skills: [
      { name: 'X・神砂嵐', desc: '前方へ2段階で突進し、砂嵐を重ねる。攻撃はワムウの攻撃力を基準に調整。再使用8秒。' },
      { name: 'A・引き寄せ', desc: '3秒間、周囲の敵を自身へ引き寄せ、0.3秒ごとに攻撃力の50%の範囲ダメージ。自身のHP・シールドを少量回復。再使用20秒。' },
      { name: 'Y・絶対防御', desc: '3秒間ダメージを無効化し、0.3秒ごとに攻撃力の18%の範囲ダメージ。発動6秒後に同じ効果を再発動。再使用22秒。' },
      { name: 'ZL・流法', desc: '3秒間、砂嵐を発生させながら高速前進。移動中に受けたダメージを蓄積し、攻撃力の3倍を上限に反撃して自身のHPを回復。再使用26秒。' },
      { name: 'R・究極奥義', desc: '最初の3秒間、風圧波で引き寄せと攻撃力50%の連続ダメージ。5秒後に砂嵐、8秒後に攻撃力150%の範囲攻撃。6秒間無敵、敵HP回復を99%抑制。再使用45秒。' }
    ]
  },
  skills: [
    { name: 'X・神砂嵐', desc: '2段階突進と砂嵐、最後に攻撃力基準の追加攻撃。CT8秒。' },
    { name: 'A・引き寄せ', desc: '3秒間引き寄せと攻撃力基準の連続攻撃。CT20秒。' },
    { name: 'Y・絶対防御', desc: '無敵と攻撃力基準の範囲攻撃を2回発生。CT22秒。' },
    { name: 'ZL・流法', desc: '被ダメージを蓄積し、攻撃力の3倍を上限に反撃。CT26秒。' },
    { name: 'R・究極奥義', desc: '風圧波・砂嵐・引き寄せ・最終攻撃。CT45秒。' }
  ]
};
cards.push(card);
const id = cards.length - 1;
for (const [array, fallback] of [[charLevel, 1], [charMaxLevel, 20], [charForm, 1], [normalEvolved, false], [ownedFlags, false], [rechargeLeft, 0]]) {
  if (Array.isArray(array)) while (array.length < cards.length) array.push(fallback);
}
if (Array.isArray(ownedFlags)) ownedFlags[id] = true;
if (typeof CURRENT_CHARACTER_COUNT !== 'undefined') {
  try { CURRENT_CHARACTER_COUNT = cards.length; } catch (_) {}
}
const savedOwned = Array.isArray(ownedCharacterNamesAtBoot) && ownedCharacterNamesAtBoot.includes(NAME);
if (savedOwned) ownedFlags[id] = true;
if (Array.isArray(formationStableNamesAtBoot) && formationStableNamesAtBoot.includes(NAME) && Array.isArray(formation)) {
  const restored = formationStableNamesAtBoot.map(name => cards.findIndex(c => c && c.name === name)).filter(index => index >= 0);
  formation = restored.slice(0, 10);
}
if (typeof syncOwnedCount === 'function') syncOwnedCount();
if (typeof save === 'function') save();
if (typeof renderOwnedStart === 'function') renderOwnedStart();
if (typeof renderFormation === 'function') renderFormation();
if (typeof renderCards === 'function') renderCards();

const now = () => performance.now() / 1000;
const live = unit => !!unit && Number(unit.hp) > 0;
const wamuuUnits = () => (Array.isArray(units) ? units : []).filter(unit => live(unit) && !unit.isEnemy && unit.name === NAME);
const enemiesAlive = () => (Array.isArray(enemies) ? enemies : []).filter(enemy => live(enemy) && !enemy.wamuuRemoved);
const shieldOf = entity => Math.max(0, Number(entity?.barrier || entity?.mythBarrier || entity?.powerShield || 0));
const healedOf = enemy => Math.max(0, Number(enemy?.wamuuCumulativeHealing || 0));
const updateHp = entity => {
  const bar = entity?.el?.querySelector?.('.hp i');
  if (bar) bar.style.width = Math.max(0, Number(entity.hp || 0) / Math.max(1, Number(entity.maxhp || 1)) * 100) + '%';
  const label = entity?.el?.querySelector?.('.hpLabel');
  if (label) label.textContent = Math.ceil(entity.hp).toLocaleString() + ' / ' + Math.ceil(entity.maxhp).toLocaleString();
};
const updateShield = entity => {
  try { if (typeof updatePowerShieldDisplay === 'function') updatePowerShieldDisplay(entity); } catch (_) {}
  try {
    const bar = entity?.el?.querySelector?.('.barrierBar i');
    const label = entity?.el?.querySelector?.('.barrierLabel');
    if (bar && Number(entity.barrierMax || 0) > 0) bar.style.width = Math.max(0, Number(entity.barrier || 0) / Number(entity.barrierMax) * 100) + '%';
    if (label && Number(entity.barrierMax || 0) > 0) label.textContent = '🛡 シールド ' + Math.ceil(Number(entity.barrier || 0)).toLocaleString() + ' / ' + Math.ceil(Number(entity.barrierMax)).toLocaleString();
  } catch (_) {}
};
const showPopup = (text, unit) => {
  try { if (typeof mythicPopup === 'function') mythicPopup(text, unit); else if (typeof window.popup === 'function') window.popup(text, unit?.x || 0, 90); } catch (_) {}
};
function heal(unit, hpAmount, shieldAmount) {
  if (!live(unit)) return;
  const hp = Math.max(0, Number(hpAmount || 0));
  const shield = Math.max(0, Number(shieldAmount || 0));
  unit.hp = Math.min(Number(unit.maxhp || 1), Number(unit.hp || 0) + hp);
  const cap = Math.max(Number(unit.barrierMax || 0), Number(unit.maxhp || 1) * 0.5);
  unit.barrierMax = cap;
  unit.barrier = Math.min(cap, Number(unit.barrier || 0) + shield);
  updateHp(unit); updateShield(unit);
}
function setInvulnerable(unit, duration) {
  unit.wamuuInvulnerableUntil = Math.max(Number(unit.wamuuInvulnerableUntil || 0), now() + duration);
}
function damageEnemy(unit, enemy, damage, tag) {
  if (!live(unit) || !live(enemy) || typeof window.hit !== 'function') return 0;
  const before = Number(enemy.hp || 0);
  window.hit(enemy, Math.max(1, Math.round(Number(damage) || 1)), unit, { wamuuSkill: true, wamuuDamageTag: tag || 'skill' });
  if (Number(enemy.hp || 0) <= 0 && !enemy.wamuuRemoved) {
    enemy.wamuuRemoved = true;
    const stillTracked = Array.isArray(enemies) && enemies.includes(enemy);
    if (stillTracked && typeof window.removeEnemy === 'function') window.removeEnemy(enemy);
    else if (stillTracked && typeof removeEnemy === 'function') removeEnemy(enemy);
    else if (stillTracked) {
      const index = enemies.indexOf(enemy);
      if (index >= 0) enemies.splice(index, 1);
      enemy.el?.remove?.();
    }
  }
  return Math.max(0, before - Number(enemy.hp || 0));
}
function inRadius(unit, radius, frontOnly) {
  return enemiesAlive().filter(enemy => {
    const dx = Number(enemy.x || 0) - Number(unit.x || 0);
    return Math.abs(dx) <= radius && (!frontOnly || dx < 40);
  });
}
function pullEnemies(unit, radius, strength) {
  for (const enemy of inRadius(unit, radius, false)) {
    const dx = Number(unit.x || 0) - Number(enemy.x || 0);
    enemy.x = Number(enemy.x || 0) + dx * strength;
    if (enemy.el?.style) enemy.el.style.left = enemy.x + 'px';
  }
}
function windEffect(unit, size) {
  const layer = document.getElementById('effects');
  if (!layer || !unit) return;
  const node = document.createElement('div');
  node.className = 'wamuuWindFx';
  node.style.left = Number(unit.x || 0) + 'px';
  node.style.setProperty('--wamuu-size', (size || 180) + 'px');
  layer.appendChild(node);
  setTimeout(() => node.remove(), 900);
}
if (!document.getElementById('wamuuTrialStyle')) {
  const style = document.createElement('style');
  style.id = 'wamuuTrialStyle';
  style.textContent = '.wamuuWindFx{position:absolute;bottom:38px;left:0;width:var(--wamuu-size,180px);height:var(--wamuu-size,180px);transform:translateX(-50%);border:5px solid rgba(186,230,253,.65);border-left-color:transparent;border-right-color:rgba(56,189,248,.85);border-radius:50%;box-shadow:0 0 22px rgba(56,189,248,.65),inset 0 0 18px rgba(56,189,248,.25);pointer-events:none;z-index:27;animation:wamuuSpin .7s linear infinite}@keyframes wamuuSpin{to{transform:translateX(-50%) rotate(360deg)}}#wamuuSkillPanel{position:fixed;right:8px;bottom:12px;z-index:9000;display:none;gap:5px;flex-wrap:wrap;max-width:min(96vw,430px);padding:7px;border:1px solid #7dd3fc;border-radius:12px;background:rgba(8,47,73,.94);box-shadow:0 4px 18px #0008}#wamuuSkillPanel button{min-width:58px;padding:8px 7px;border:1px solid #bae6fd;border-radius:8px;background:#075985;color:#fff;font-weight:900;font-size:12px}#wamuuSkillPanel button:disabled{opacity:.42;background:#334155}';
  document.head.appendChild(style);
}
let panel = document.getElementById('wamuuSkillPanel');
if (!panel) {
  panel = document.createElement('div');
  panel.id = 'wamuuSkillPanel';
  panel.setAttribute('aria-label', 'ワムウの運営試用スキル');
  panel.innerHTML = Object.keys(SKILLS).map(key => '<button type="button" data-wamuu-skill="' + key + '">' + key + '</button>').join('');
  document.body.appendChild(panel);
}
const cooldowns = new WeakMap();
const effects = new WeakMap();
function cooldownMap(unit) {
  if (!cooldowns.has(unit)) cooldowns.set(unit, {});
  return cooldowns.get(unit);
}
function effectList(unit) {
  if (!effects.has(unit)) effects.set(unit, []);
  return effects.get(unit);
}
function startCooldown(unit, key) {
  const map = cooldownMap(unit);
  map[key] = now() + SKILLS[key].cooldown;
}
function isTopRow(unit) {
  return !!unit && Number(unit.cardIndex) === id && Array.isArray(formation) &&
    formation.slice(0, 5).some(index => Number(index) === id);
}
function canUse(unit, key) {
  return live(unit) && isTopRow(unit) && !!SKILLS[key] && now() >= Number(cooldownMap(unit)[key] || 0);
}
function sandstormTick(unit, radius) {
  for (const enemy of inRadius(unit, radius || 520, false)) {
    damageEnemy(unit, enemy, Number(unit.atk || TRIAL_STATS.atk) * 0.45, 'sandstorm');
    enemy.wamuuDamageTakenBonus = Math.min(15, Number(enemy.wamuuDamageTakenBonus || 0) + 0.00001);
  }
}
function aTick(unit, radius, frontOnly = false) {
  for (const enemy of inRadius(unit, radius || 520, frontOnly)) {
    damageEnemy(unit, enemy, Number(unit.atk || TRIAL_STATS.atk) * 0.5, 'A');
  }
  heal(unit, Math.max(1, unit.maxhp * 0.0025), Math.max(1, unit.maxhp * 0.0025));
}
function yTick(unit) {
  for (const enemy of inRadius(unit, 520, false)) {
    damageEnemy(unit, enemy, Number(unit.atk || TRIAL_STATS.atk) * 0.18, 'Y');
  }
}
function activate(unit, key) {
  if (!live(unit) || !SKILLS[key] || !canUse(unit, key)) return false;
  const started = now();
  startCooldown(unit, key);
  const list = effectList(unit);
  if (key === 'X') {
    list.push({ key, started, lastRush1: -1, lastRush2: -1, lastStorm: -1, finisher: false });
    windEffect(unit, 220); showPopup('🌪️ ワムウ X発動', unit);
  } else if (key === 'A') {
    list.push({ key, started, lastTick: -1 });
    windEffect(unit, 180); showPopup('🌀 ワムウ A発動', unit);
  } else if (key === 'Y') {
    list.push({ key, started, lastTick1: -1, lastTick2: -1 });
    setInvulnerable(unit, 3);
    windEffect(unit, 200); showPopup('🛡️ ワムウ Y発動', unit);
  } else if (key === 'ZL') {
    unit.wamuuZlDamageTaken = 0;
    list.push({ key, started, lastTick: -1, finished: false });
    windEffect(unit, 200); showPopup('🌪️ ワムウ ZL発動', unit);
  } else if (key === 'R') {
    list.push({ key, started, lastWave: -1, lastStorm: -1, pulled: false, finisher: false });
    setInvulnerable(unit, 6);
    unit.wamuuHealBlockUntil = Math.max(Number(unit.wamuuHealBlockUntil || 0), started + 6);
    windEffect(unit, 260); showPopup('✨ ワムウ R発動', unit);
  }
  return true;
}
function tickEffects(unit, time) {
  const list = effectList(unit);
  for (let i = list.length - 1; i >= 0; i--) {
    const effect = list[i], elapsed = time - effect.started;
    if (effect.key === 'X') {
      if (elapsed >= 0.3 && effect.lastRush1 < 0) {
        effect.lastRush1 = elapsed; unit.x = Math.max(120, Number(unit.x || 0) - 32);
        windEffect(unit, 220);
        for (const enemy of inRadius(unit, 420, true)) damageEnemy(unit, enemy, unit.atk * 1.0, 'X-rush-1');
      }
      if (elapsed >= 0.8 && effect.lastRush2 < 0) {
        effect.lastRush2 = elapsed; unit.x = Math.max(120, Number(unit.x || 0) - 42);
        windEffect(unit, 300);
        for (const enemy of inRadius(unit, 680, true)) damageEnemy(unit, enemy, unit.atk * 1.4, 'X-rush-2');
      }
      if (elapsed >= 1.3 && elapsed < 2.8 && (effect.lastStorm < 0 || elapsed - effect.lastStorm >= 0.55)) {
        effect.lastStorm = elapsed; sandstormTick(unit, 600); pullEnemies(unit, 600, 0.08);
      }
      if (elapsed >= 2.8 && !effect.finisher) {
        effect.finisher = true;
        for (const enemy of inRadius(unit, 600, false)) damageEnemy(unit, enemy, Number(unit.atk || TRIAL_STATS.atk) * 1.0, 'X-finisher');
      }
      if (elapsed >= 3.2) list.splice(i, 1);
    } else if (effect.key === 'A') {
      if (elapsed < 3 && (effect.lastTick < 0 || elapsed - effect.lastTick >= 0.3)) {
        effect.lastTick = elapsed; pullEnemies(unit, 650, 0.12); aTick(unit, 650);
      }
      if (elapsed >= 3) list.splice(i, 1);
    } else if (effect.key === 'Y') {
      if (elapsed >= 0 && elapsed < 3 && (effect.lastTick1 < 0 || elapsed - effect.lastTick1 >= 0.3)) {
        effect.lastTick1 = elapsed; yTick(unit);
      }
      if (elapsed >= 6 && elapsed < 9 && (effect.lastTick2 < 0 || elapsed - effect.lastTick2 >= 0.3)) {
        effect.lastTick2 = elapsed; setInvulnerable(unit, 0.35); yTick(unit);
      }
      if (elapsed >= 9) list.splice(i, 1);
    } else if (effect.key === 'ZL') {
      if (elapsed < 3) {
        unit.x = Math.max(120, Number(unit.x || 0) - 24);
        if (effect.lastTick < 0 || elapsed - effect.lastTick >= 0.3) {
          effect.lastTick = elapsed;
          sandstormTick(unit, 500);
        }
      } else if (!effect.finished) {
        effect.finished = true;
        const returned = Math.min(Number(unit.atk || TRIAL_STATS.atk) * 3, Math.max(1, Number(unit.wamuuZlDamageTaken || 0) * 1.25));
        for (const enemy of inRadius(unit, 650, false)) damageEnemy(unit, enemy, returned, 'ZL-return');
        heal(unit, returned * 0.5, 0);
      } else list.splice(i, 1);
    } else if (effect.key === 'R') {
      if (elapsed < 3 && (effect.lastWave < 0 || elapsed - effect.lastWave >= 0.3)) {
        effect.lastWave = elapsed;
        windEffect(unit, 260);
        pullEnemies(unit, 620, 0.08); aTick(unit, 620, true);
      }
      if (elapsed >= 5 && elapsed < 8 && (effect.lastStorm < 0 || elapsed - effect.lastStorm >= 0.55)) {
        effect.lastStorm = elapsed; pullEnemies(unit, 650, 0.12); sandstormTick(unit, 650);
      }
      if (elapsed >= 8 && !effect.finisher) {
        effect.finisher = true;
        for (const enemy of inRadius(unit, 700, false)) {
          const amount = Number(unit.atk || TRIAL_STATS.atk) * 1.5;
          damageEnemy(unit, enemy, amount, 'R-finisher');
        }
      }
      if (elapsed >= 8.5) list.splice(i, 1);
    }
  }
}
function updateEnemyHealingAndShields(time) {
  for (const enemy of enemiesAlive()) {
    const hp = Number(enemy.hp || 0), shield = shieldOf(enemy);
    if (enemy.wamuuLastHp == null) enemy.wamuuLastHp = hp;
    if (enemy.wamuuLastShield == null) enemy.wamuuLastShield = shield;
    const hpGain = Math.max(0, hp - Number(enemy.wamuuLastHp || 0));
    const shieldGain = Math.max(0, shield - Number(enemy.wamuuLastShield || 0));
    if (hpGain > 0 || shieldGain > 0) {
      enemy.wamuuCumulativeHealing = healedOf(enemy) + hpGain + shieldGain;
      const rActive = wamuuUnits().some(unit => Number(unit.wamuuHealBlockUntil || 0) > time);
      if (rActive && hpGain > 0) enemy.hp = Math.max(0, enemy.hp - hpGain * 0.99);
      const shieldedWamuu = wamuuUnits().some(unit => shieldOf(unit) > 0);
      if (shieldedWamuu && shieldGain > 0 && 'barrier' in enemy) enemy.barrier = Math.max(0, Number(enemy.barrier || 0) - shieldGain);
    }
    enemy.wamuuLastHp = Number(enemy.hp || 0);
    enemy.wamuuLastShield = shieldOf(enemy);
  }
}
let lastShieldDrain = 0;
function tick() {
  const time = now();
  updateEnemyHealingAndShields(time);
  for (const unit of wamuuUnits()) {
    if (Number(unit.maxhp || 0) > 0 && unit.barrierMax == null) unit.barrierMax = Number(unit.maxhp) * 0.5;
    tickEffects(unit, time);
    if (wamuuUnits().every(candidate => shieldOf(candidate) <= 0) && time - lastShieldDrain >= 1) {
      for (const enemy of enemiesAlive()) {
        if (Number(enemy.barrier || 0) > 0) {
          enemy.barrier = Math.max(0, Number(enemy.barrier) - 1000);
          updateShield(enemy);
        }
      }
    }
  }
  if (time - lastShieldDrain >= 1) lastShieldDrain = time;
  updateSkillPanel();
}
const originalHit = window.hit;
if (typeof originalHit === 'function') {
  window.hit = function(target, damage, source, abilitySource) {
    const isWamuu = target && !target.isEnemy && target.name === NAME;
    const beforeHp = Number(target?.hp || 0), beforeShield = shieldOf(target);
    const time = now();
    if (isWamuu && Number(target.wamuuInvulnerableUntil || 0) > time) return 0;
    let adjusted = Number(damage || 0);
    if (isWamuu) adjusted *= (1 - TRIAL_STATS.damageReduction);
    if (target?.isEnemy && Number(target.wamuuDamageTakenBonus || 0) > 0) adjusted *= 1 + Number(target.wamuuDamageTakenBonus || 0);
    if (isWamuu && abilitySource?.wamuuDamageType === 'followup') adjusted *= 0.25;
    if (isWamuu && abilitySource?.wamuuDamageType === 'piercing') {
      if (shieldOf(target) > 0 || Number(target.wamuuPiercingNullUntil || 0) > time) return 0;
      target.wamuuPiercingPendingUntil = time + 0.2;
    }
    if (isWamuu) {
      if (time - Number(target.wamuuDamageWindowStarted || 0) > 0.15) {
        target.wamuuDamageWindowStarted = time;
        target.wamuuDamageWindowTotal = 0;
      }
      const predictedHpDamage = Math.max(0, adjusted - beforeShield);
      const threshold = Number(target.maxhp || 1) * TRIAL_STATS.lifeReversalRatio;
      if (Number(target.wamuuDamageWindowTotal || 0) + predictedHpDamage >= threshold &&
          time >= Number(target.wamuuLifeReversalReadyAt || 0)) {
        target.wamuuLifeReversalReadyAt = time + 15;
        setInvulnerable(target, 2);
        heal(target, target.maxhp * TRIAL_STATS.lifeReversalHeal, target.maxhp * TRIAL_STATS.lifeReversalHeal);
        setTimeout(() => {
          if (live(target)) heal(target, target.maxhp * TRIAL_STATS.lifeReversalHeal, target.maxhp * TRIAL_STATS.lifeReversalHeal);
        }, 1000);
        showPopup('🔄 生命反転！', target);
        return 0;
      }
    }
    let protectedShieldBreakSource = null;
    let savedBarrierBreak = null;
    if (isWamuu && Number(target.hp || 0) >= Number(target.maxhp || 1) * TRIAL_STATS.indomitableThreshold) {
      protectedShieldBreakSource = source?.ability?.barrierBreak ? source : (abilitySource?.ability?.barrierBreak ? abilitySource : null);
      if (protectedShieldBreakSource) {
        savedBarrierBreak = protectedShieldBreakSource.ability.barrierBreak;
        protectedShieldBreakSource.ability.barrierBreak = false;
      }
    }
    let result;
    try {
      result = originalHit.call(this, target, adjusted, source, abilitySource);
    } finally {
      if (protectedShieldBreakSource) protectedShieldBreakSource.ability.barrierBreak = savedBarrierBreak;
    }
    if (isWamuu) {
      const hpDamage = Math.max(0, beforeHp - Number(target.hp || 0));
      const shieldDamage = Math.max(0, beforeShield - shieldOf(target));
      if (effectList(target).some(effect => effect.key === 'ZL')) target.wamuuZlDamageTaken += hpDamage + shieldDamage;
      if (abilitySource?.wamuuDamageType === 'followup') {
        const followup = Math.max(0, Number(damage || 0));
        heal(target, followup * 0.35, followup * 0.35);
        if (source && live(source)) originalHit.call(this, source, followup * 0.5, target, { wamuuReflection: true });
      }
      if (abilitySource?.wamuuDamageType === 'piercing') {
        const piercing = Math.max(0, Number(damage || 0));
        heal(target, piercing * 0.99, 0);
        if (source && live(source)) originalHit.call(this, source, piercing * 0.99, target, { wamuuReflection: true });
        setTimeout(() => {
          if (live(target)) target.wamuuPiercingNullUntil = now() + 1;
        }, 200);
      }
      target.wamuuDamageWindowTotal = Number(target.wamuuDamageWindowTotal || 0) + hpDamage;
      if (Number(target.hp || 0) >= Number(target.maxhp || 1) * TRIAL_STATS.indomitableThreshold) {
        const currentTime = now();
        for (const key of Object.keys(target)) {
          if (!key.endsWith('Until') || key.startsWith('wamuu')) continue;
          const expiry = Number(target[key] || 0);
          if (expiry > currentTime) target[key] = currentTime + (expiry - currentTime) * 0.02;
        }
      }
      updateHp(target); updateShield(target);
    }
    return result;
  };
}
const originalDeploy = window.deploy;
if (typeof originalDeploy === 'function') {
  window.deploy = function(index) {
    if (Number(index) === id && ((typeof rankMode !== 'undefined' && rankMode) || (typeof pvpMode !== 'undefined' && pvpMode))) {
      showPopup('ワムウの運営試用版は通常バトルでのみ使用できます', null);
      return;
    }
    const result = originalDeploy.apply(this, arguments);
    if (Number(index) === id) {
      const unit = [...(Array.isArray(units) ? units : [])].reverse().find(candidate => candidate && candidate.cardIndex === id && !candidate.isEnemy);
      if (unit) {
        unit.barrierMax = Math.max(Number(unit.barrierMax || 0), Number(unit.maxhp || TRIAL_STATS.hp) * 0.5);
        unit.wamuuDamageWindowStarted = 0;
        unit.wamuuDamageWindowTotal = 0;
        unit.wamuuZlDamageTaken = 0;
        updateShield(unit);
        showPopup('🌪️ ワムウ（運営試用版）出撃', unit);
      }
    }
    return result;
  };
}
function ensureBattleState() {
  const unit = wamuuUnits()[0];
  const active = !!unit && typeof running !== 'undefined' && running;
  const topRow = active && isTopRow(unit);
  panel.style.display = topRow ? 'flex' : 'none';
  if (!topRow) return;
  for (const button of panel.querySelectorAll('[data-wamuu-skill]')) {
    const key = button.dataset.wamuuSkill;
    const left = Math.max(0, Number(cooldownMap(unit)[key] || 0) - now());
    button.disabled = left > 0;
    button.textContent = left > 0 ? key + ' ' + left.toFixed(1) + 's' : key;
    button.title = SKILLS[key].label + ' / CT ' + SKILLS[key].cooldown + '秒 / 編成上段限定';
  }
}
function updateSkillPanel() { ensureBattleState(); }
panel.querySelectorAll('[data-wamuu-skill]').forEach(button => {
  button.addEventListener('click', () => {
    const unit = wamuuUnits()[0];
    if (!unit || typeof running === 'undefined' || !running || !isTopRow(unit)) return;
    activate(unit, button.dataset.wamuuSkill);
    updateSkillPanel();
  });
});
const timer = window.setInterval(tick, 100);
window.WAMUU_OPERATOR_TRIAL_API = Object.freeze({
  id, stats: TRIAL_STATS, skills: SKILLS,
  formulas: Object.freeze({
    sandstorm: atk => atk * 0.45,
    X: (atk, sandstormTicks = 3) => atk * (1 + 1.4 + 0.45 * sandstormTicks + 1),
    A: (atk, ticks = 10) => atk * 0.5 * ticks,
    Y: (atk, ticks = 20) => atk * 0.18 * ticks,
    ZL: (atk, sandstormTicks = 10) => atk * (0.45 * sandstormTicks + 3),
    R: (atk, waveTicks = 10, stormTicks = 6) => atk * (0.5 * waveTicks + 0.45 * stormTicks + 1.5)
  }),
  activate, canUse, isTopRow, cooldownMap, effectList,
  dispose() { window.clearInterval(timer); panel.remove(); }
});
})();