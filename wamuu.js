(() => {
'use strict';
if (window.__KINOSHITA_WAMUU_OPERATOR_TRIAL__) return;
if (typeof isOperatorPlayer !== 'function' || !isOperatorPlayer(playerRankingId)) return;
if (typeof cards === 'undefined' || typeof ownedFlags === 'undefined') return;
if (cards.some(card => card && card.name === 'ワムウ')) return;
window.__KINOSHITA_WAMUU_OPERATOR_TRIAL__ = true;

const NAME = 'ワムウ';
const TRIAL_STATS = Object.freeze({
  hp: 1000000, atk: 35000, range: 300, spd: 0.75,
  interval: 1.2, cost: 1800, recharge: 60,
  lifeReversalRatio: 0.08, lifeReversalHeal: 0.045,
  indomitableThreshold: 0.35, damageReduction: 0.10
});
const SKILLS = Object.freeze({
  X: { cooldown: 3.8, label: 'X・神砂嵐' },
  A: { cooldown: 20, label: 'A・引き寄せ' },
  Y: { cooldown: 22, label: 'Y・絶対防御' },
  ZL: { cooldown: 26, label: 'ZL・流法' },
  R: { cooldown: 31, label: 'R・究極奥義' }
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
      { name: 'X・神砂嵐', desc: '前方突進を2段階で行い、広範囲に1.5秒間砂嵐を発生。2.8秒後、近くの敵に「敵HP＋敵シールド×4%」の通常ダメージ。再使用3.8秒。' },
      { name: 'A・引き寄せ', desc: '3秒間、周囲の敵を自身へ引き寄せ、0.1秒ごとに「敵HP＋敵シールド＋試合中の累計回復量の1%」の通常ダメージ。自身のHP・シールドも回復。再使用20秒。' },
      { name: 'Y・絶対防御', desc: '3秒間すべてのダメージを無効化し、0.3秒ごとに自身HP・シールド・敵シールド合計の3%を範囲ダメージ。発動6秒後に同じ効果を再発動。再使用22秒。' },
      { name: 'ZL・流法', desc: '3秒間、砂嵐を発生させながら高速前進。移動中に受けたダメージの合計を2倍にして範囲へ通常ダメージとして返し、自身のHPを回復。再使用26秒。' },
      { name: 'R・究極奥義', desc: '3秒間の光刃攻撃中はAと同じ効果。5秒後に3秒間の砂嵐と引き寄せ、8秒後に「自身HP＋敵の累計回復量」の30%を通常ダメージ。10秒間無敵、敵HP回復を99%抑制。再使用31秒。' }
    ]
  },
  skills: [
    { name: 'X・神砂嵐', desc: '突進2段階、砂嵐、2.8秒後の追加攻撃。CT3.8秒（発動時から計測）。' },
    { name: 'A・引き寄せ', desc: '3秒間引き寄せと連続攻撃。CT20秒（発動時から計測）。' },
    { name: 'Y・絶対防御', desc: '無敵と範囲攻撃を2回発生。CT22秒（発動時から計測）。' },
    { name: 'ZL・流法', desc: '被ダメージを蓄積して2倍にして返す。CT26秒（発動時から計測）。' },
    { name: 'R・究極奥義', desc: '光刃・砂嵐・引き寄せ・最終攻撃。CT31秒（発動時から計測）。' }
  ]
};
cards.push(card);
const id = cards.length - 1;
for (const [key, fallback] of [['charLevel', 1], ['charMaxLevel', 20], ['charForm', 1], ['normalEvolved', false], ['ownedFlags', false], ['rechargeLeft', 0]]) {
  if (Array.isArray(globalThis[key])) while (globalThis[key].length < cards.length) globalThis[key].push(fallback);
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
const enemiesAlive = () => (Array.isArray(enemies) ? enemies : []).filter(enemy => live(enemy));
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
const popup = (text, unit) => {
  try { if (typeof mythicPopup === 'function') mythicPopup(text, unit); else if (typeof popup === 'function') popup(text, unit?.x || 0, 90); } catch (_) {}
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
    if (enemy.el) enemy.el.style.left = enemy.x + 'px';
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
function canUse(unit, key) {
  return live(unit) && now() >= Number(cooldownMap(unit)[key] || 0);
}
function sandstormTick(unit, radius) {
  for (const enemy of inRadius(unit, radius || 520, false)) {
    const amount = Number(enemy.hp || 0) + shieldOf(enemy) + healedOf(enemy) * 0.03;
    damageEnemy(unit, enemy, amount, 'sandstorm');
    enemy.wamuuDamageTakenBonus = Math.min(15, Number(enemy.wamuuDamageTakenBonus || 0) + 0.00001);
  }
}
function aTick(unit, radius) {
  for (const enemy of inRadius(unit, radius || 520, false)) {
    const amount = Number(enemy.hp || 0) + shieldOf(enemy) + healedOf(enemy) * 0.01;
    damageEnemy(unit, enemy, amount, 'A');
  }
  heal(unit, Math.max(1, unit.maxhp * 0.01), Math.max(1, unit.maxhp * 0.01));
}
function yTick(unit) {
  for (const enemy of inRadius(unit, 520, false)) {
    const amount = (Number(unit.hp || 0) + shieldOf(unit) + shieldOf(enemy)) * 0.03;
    damageEnemy(unit, enemy, amount, 'Y');
  }
}
function activate(unit, key) {
  if (!live(unit) || !SKILLS[key] || !canUse(unit, key)) return false;
  const started = now();
  startCooldown(unit, key);
  const list = effectList(unit);
  if (key === 'X') {
    list.push({ key, started, lastRush1: -1, lastRush2: -1, lastStorm: -1, finisher: false });
    windEffect(unit, 220); popup('🌪️ ワムウ X発動', unit);
  } else if (key === 'A') {
    list.push({ key, started, lastTick: -1 });
    windEffect(unit, 180); popup('🌀 ワムウ A発動', unit);
  } else if (key === 'Y') {
    list.push({ key, started, lastTick1: -1, lastTick2: -1 });
    setInvulnerable(unit, 3);
    windEffect(unit, 200); popup('🛡️ ワムウ Y発動', unit);
  } else if (key === 'ZL') {
    unit.wamuuZlDamageTaken = 0;
    list.push({ key, started, lastTick: -1, finished: false });
    windEffect(unit, 200); popup('🌪️ ワムウ ZL発動', unit);
  } else if (key === 'R') {
    list.push({ key, started, lastBlade: -1, lastStorm: -1, pulled: false, finisher: false });
    setInvulnerable(unit, 10);
    unit.wamuuHealBlockUntil = Math.max(Number(unit.wamuuHealBlockUntil || 0), started + 10);
    windEffect(unit, 260); popup('✨ ワムウ R発動', unit);
  }
  return true;
}
function tickEffects(unit, time) {
  const list = effectList(unit);
  for (let i = list.length - 1; i >= 0; i--) {
    const effect = list[i], elapsed = time - effect.started;
    if (effect.key === 'X') {
      if (elapsed >= 0.3 && elapsed < 0.8 && (effect.lastRush1 < 0 || elapsed - effect.lastRush1 >= 0.1)) {
        effect.lastRush1 = elapsed; unit.x = Math.max(120, Number(unit.x || 0) - 32);
        for (const enemy of inRadius(unit, 420, true)) damageEnemy(unit, enemy, unit.atk * 1.4, 'X-rush-1');
      }
      if (elapsed >= 0.8 && elapsed < 1.4 && (effect.lastRush2 < 0 || elapsed - effect.lastRush2 >= 0.1)) {
        effect.lastRush2 = elapsed; unit.x = Math.max(120, Number(unit.x || 0) - 42);
        for (const enemy of inRadius(unit, 680, true)) damageEnemy(unit, enemy, unit.atk * 2, 'X-rush-2');
      }
      if (elapsed >= 1.3 && elapsed < 2.8 && (effect.lastStorm < 0 || elapsed - effect.lastStorm >= 0.55)) {
        effect.lastStorm = elapsed; sandstormTick(unit, 600); pullEnemies(unit, 600, 0.08);
      }
      if (elapsed >= 2.8 && !effect.finisher) {
        effect.finisher = true;
        for (const enemy of inRadius(unit, 600, false)) damageEnemy(unit, enemy, Number(enemy.hp || 0) + shieldOf(enemy) * 0.04, 'X-finisher');
      }
      if (elapsed >= 3.2) list.splice(i, 1);
    } else if (effect.key === 'A') {
      if (elapsed < 3 && (effect.lastTick < 0 || elapsed - effect.lastTick >= 0.1)) {
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
        const returned = Math.max(1, Number(unit.wamuuZlDamageTaken || 0) * 2);
        for (const enemy of inRadius(unit, 650, false)) damageEnemy(unit, enemy, returned, 'ZL-return');
        heal(unit, returned, 0);
      } else list.splice(i, 1);
    } else if (effect.key === 'R') {
      if (elapsed < 3 && (effect.lastBlade < 0 || elapsed - effect.lastBlade >= 0.1)) {
        effect.lastBlade = elapsed;
        for (const enemy of inRadius(unit, 620, true)) damageEnemy(unit, enemy, unit.atk * 0.8, 'R-blade');
        pullEnemies(unit, 620, 0.08); aTick(unit, 620);
      }
      if (elapsed >= 5 && elapsed < 8 && (effect.lastStorm < 0 || elapsed - effect.lastStorm >= 0.55)) {
        effect.lastStorm = elapsed; pullEnemies(unit, 650, 0.12); sandstormTick(unit, 650);
      }
      if (elapsed >= 8 && !effect.finisher) {
        effect.finisher = true;
        for (const enemy of inRadius(unit, 700, false)) {
          const amount = (Number(unit.hp || 0) + healedOf(enemy)) * 0.30;
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
    if (shieldOf(unit) <= 0 && time - lastShieldDrain >= 1) {
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
    if (isWamuu && abilitySource?.wamuuDamageType === 'piercing') {
      if (Number(target.wamuuPiercingNullUntil || 0) > time) return 0;
      target.wamuuPiercingPendingUntil = time + 0.2;
    }
    const result = originalHit.call(this, target, adjusted, source, abilitySource);
    if (isWamuu) {
      const hpDamage = Math.max(0, beforeHp - Number(target.hp || 0));
      const shieldDamage = Math.max(0, beforeShield - shieldOf(target));
      if (Number(target.wamuuZlDamageTaken || 0) >= 0 && effectList(target).some(effect => effect.key === 'ZL')) {
        target.wamuuZlDamageTaken += hpDamage + shieldDamage;
      }
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
      const current = now();
      if (current - Number(target.wamuuDamageWindowStarted || 0) > 0.15) {
        target.wamuuDamageWindowStarted = current;
        target.wamuuDamageWindowTotal = 0;
      }
      target.wamuuDamageWindowTotal = Number(target.wamuuDamageWindowTotal || 0) + hpDamage;
      if (target.wamuuDamageWindowTotal >= Number(target.maxhp || 1) * TRIAL_STATS.lifeReversalRatio &&
          current >= Number(target.wamuuLifeReversalReadyAt || 0)) {
        target.wamuuLifeReversalReadyAt = current + 15;
        setInvulnerable(target, 2);
        heal(target, target.maxhp * TRIAL_STATS.lifeReversalHeal, target.maxhp * TRIAL_STATS.lifeReversalHeal);
        setTimeout(() => {
          if (live(target)) heal(target, target.maxhp * TRIAL_STATS.lifeReversalHeal, target.maxhp * TRIAL_STATS.lifeReversalHeal);
        }, 1000);
        popup('🔄 生命反転！', target);
      }
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
    const result = originalDeploy.apply(this, arguments);
    if (Number(index) === id) {
      const unit = [...(Array.isArray(units) ? units : [])].reverse().find(candidate => candidate && candidate.cardIndex === id && !candidate.isEnemy);
      if (unit) {
        unit.barrierMax = Math.max(Number(unit.barrierMax || 0), Number(unit.maxhp || TRIAL_STATS.hp) * 0.5);
        unit.wamuuDamageWindowStarted = 0;
        unit.wamuuDamageWindowTotal = 0;
        unit.wamuuZlDamageTaken = 0;
        updateShield(unit);
        popup('🌪️ ワムウ（運営試用版）出撃', unit);
      }
    }
    return result;
  };
}
function ensureBattleState() {
  const unit = wamuuUnits()[0];
  const active = !!unit && typeof running !== 'undefined' && running;
  panel.style.display = active ? 'flex' : 'none';
  if (!active) return;
  for (const button of panel.querySelectorAll('[data-wamuu-skill]')) {
    const key = button.dataset.wamuuSkill;
    const left = Math.max(0, Number(cooldownMap(unit)[key] || 0) - now());
    button.disabled = left > 0;
    button.textContent = left > 0 ? key + ' ' + left.toFixed(1) + 's' : key;
    button.title = SKILLS[key].label + ' / CT ' + SKILLS[key].cooldown + '秒';
  }
}
function updateSkillPanel() { ensureBattleState(); }
panel.querySelectorAll('[data-wamuu-skill]').forEach(button => {
  button.addEventListener('click', () => {
    const unit = wamuuUnits()[0];
    if (!unit || typeof running === 'undefined' || !running) return;
    activate(unit, button.dataset.wamuuSkill);
    updateSkillPanel();
  });
});
const timer = window.setInterval(tick, 100);
window.WAMUU_OPERATOR_TRIAL_API = Object.freeze({
  id, stats: TRIAL_STATS, skills: SKILLS,
  formulas: Object.freeze({
    sandstorm: (hp, shield, healed) => hp + shield + healed * 0.03,
    A: (hp, shield, healed) => hp + shield + healed * 0.01,
    X: (hp, shield) => hp + shield * 0.04,
    Y: (selfHp, selfShield, enemyShield) => (selfHp + selfShield + enemyShield) * 0.03,
    R: (selfHp, healed) => (selfHp + healed) * 0.30
  }),
  activate, canUse, cooldownMap, effectList,
  dispose() { window.clearInterval(timer); panel.remove(); }
});
})();