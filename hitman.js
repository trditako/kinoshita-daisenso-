(() => {
'use strict';
const NAME = 'ヒットマン木下';
if (window.__HITMAN_KINOSHITA_V1__) return;
window.__HITMAN_KINOSHITA_V1__ = true;

const definition = {
  name: NAME, cost: 2200, hp: 72000, atk: 6200, secondAtk: 3400,
  multiAttack: [6200, 3400], range: 220, spd: 0.8, interval: 1,
  recharge: 100, icon: '🎯', motion: 'super', attackType: 'single',
  kb: 2, trait: '黒', rarity: '伝説レア',
  series: '神話編全48ステージクリア報酬',
  specialReward: true, chapterReward: 7,
  skills: [
    { name: '追跡マーカー', desc: '出撃時に3発を0.2秒間隔で発射。命中した敵に現在攻撃力の200%のダメージ。' },
    { name: '乗馬', desc: '出撃直後と以後の定期発動時に3秒間騎乗。移動速度+2、烈波無効。初回後は15秒後、以後20秒周期で発動。' },
    { name: '戦闘術：転移反撃', desc: '被弾時15%で発動。攻撃者の近くへ転移して攻撃力の4倍で反撃し、与えたダメージの20%を回復。再使用20秒、1回の出撃につき最大2回。' }
  ],
  ability: {
    name: '神話狩り・追跡戦術',
    desc: '神話属性に3倍ダメージ。神話属性から受けるダメージを65%軽減し、受けたHPダメージの35%を反射。呪い・停止・波動・反射を無効化。攻撃ごとに再出撃時間を1.5%短縮し、50円を獲得。攻撃した敵の回復を2秒封じる。敵撃破ごとに全ステータス+5%（最大+100%）。',
    strong: { 神話: 3 }, resist: { 神話: 0.35 },
    curseImmune: true, stopImmune: true, waveImmune: true,
    reflectImmune: true
  },
  curseImmune: true, stopImmune: true, waveImmune: true,
  reflectImmune: true
};

let index = cards.findIndex(c => c && c.name === NAME);
if (index < 0) {
  cards.push(definition);
  index = cards.length - 1;
} else {
  Object.assign(cards[index], definition);
}
const card = cards[index];
card.id = index;
if (typeof CURRENT_CHARACTER_COUNT !== 'undefined') CURRENT_CHARACTER_COUNT = cards.length;

function extendArray(arr, length, value) {
  if (!Array.isArray(arr)) return;
  while (arr.length < length) arr.push(typeof value === 'function' ? value() : value);
}
extendArray(ownedFlags, cards.length, false);
extendArray(charLevel, cards.length, 1);
extendArray(charMaxLevel, cards.length, 20);
extendArray(charForm, cards.length, 1);
extendArray(normalEvolved, cards.length, false);
if (Array.isArray(rechargeLeft)) extendArray(rechargeLeft, cards.length, 0);

const savedOwned = typeof ownedCharacterNamesAtBoot !== 'undefined' &&
  Array.isArray(ownedCharacterNamesAtBoot) && ownedCharacterNamesAtBoot.includes(NAME);
function unlockHitman(showNotice) {
  const alreadyOwned = !!ownedFlags[index];
  ownedFlags[index] = true;
  if (typeof syncOwnedCount === 'function') syncOwnedCount();
  if (typeof save === 'function') save();
  if (showNotice && !alreadyOwned) {
    const resultText = document.getElementById('resultText');
    if (resultText) resultText.textContent += '\n🎯 章クリア報酬：ヒットマン木下を入手しました！';
    if (typeof popup === 'function') popup('🎯 ヒットマン木下を入手！', 0, 90, 'criticalPop');
  }
  try {
    if (typeof renderCards === 'function') renderCards();
    if (typeof renderFormation === 'function') renderFormation();
    if (typeof renderFormationBuffSummary === 'function') renderFormationBuffSummary();
  } catch (e) { console.warn('ヒットマン木下 UI更新を一部スキップしました', e); }
}
if (savedOwned || (Array.isArray(chapterClears) && Number(chapterClears[6] || 0) >= 48)) {
  unlockHitman(false);
}

function refreshHp(unit) {
  if (!unit) return;
  if (unit.el) {
    const bar = unit.el.querySelector('.hp i');
    const label = unit.el.querySelector('.hpLabel');
    if (bar) bar.style.width = Math.max(0, unit.hp / Math.max(1, unit.maxhp) * 100) + '%';
    if (label) label.textContent = Math.ceil(unit.hp).toLocaleString() + ' / ' + Math.ceil(unit.maxhp).toLocaleString();
  }
  if (typeof updateStatusMark === 'function') updateStatusMark(unit);
}

function refreshHitmanStats(unit) {
  if (!unit || !unit.hitmanCoreStats) return;
  const core = unit.hitmanCoreStats;
  const ratio = Math.max(0, Math.min(1, Number(unit.hp || 0) / Math.max(1, Number(unit.maxhp || 1))));
  const factor = 1 + Math.min(20, Math.max(0, Number(unit.hitmanKillStacks || 0))) * 0.05;
  unit.maxhp = Math.max(1, Math.round(core.maxhp * factor));
  unit.hp = Math.max(1, Math.min(unit.maxhp, Math.round(unit.maxhp * ratio)));
  unit.atk = Math.max(1, Math.round(core.atk * factor));
  unit.range = Math.max(1, Math.round(core.range * factor));
  unit.spd = Math.max(0.01, core.spd * factor + (unit.hitmanRiding ? 2 : 0));
  unit.interval = Math.max(0.05, core.interval / factor);
  unit.recharge = Math.max(1, core.recharge / factor);
  unit.cardSpeed = unit.spd;
  if (Array.isArray(rechargeLeft) && Number.isInteger(unit.cardIndex) && rechargeLeft[unit.cardIndex] > 0) {
    rechargeLeft[unit.cardIndex] = Math.max(0, rechargeLeft[unit.cardIndex] / factor);
  }
  refreshHp(unit);
}

function startRide(unit) {
  if (!unit || unit.hp <= 0 || unit.hitmanRiding) return;
  unit.hitmanRiding = true;
  unit.hitmanRideUntil = Number(stageTime || 0) + 3;
  unit.hitmanOriginalSurgeImmune = {
    direct: unit.surgeImmune,
    ability: unit.ability ? unit.ability.surgeImmune : undefined
  };
  unit.surgeImmune = true;
  if (unit.ability) unit.ability.surgeImmune = true;
  refreshHitmanStats(unit);
  if (typeof setStatusMark === 'function') setStatusMark(unit, '🐎', '騎乗中：移動速度+2・烈波無効', 3, 'hitmanRide');
  if (typeof popup === 'function') popup('🐎 乗馬！ 移動速度+2・烈波無効', unit.x, 90, 'criticalPop');
}
function stopRide(unit) {
  if (!unit || !unit.hitmanRiding) return;
  unit.hitmanRiding = false;
  const original = unit.hitmanOriginalSurgeImmune || {};
  if (original.direct === undefined) delete unit.surgeImmune;
  else unit.surgeImmune = original.direct;
  if (unit.ability) {
    if (original.ability === undefined) delete unit.ability.surgeImmune;
    else unit.ability.surgeImmune = original.ability;
  }
  refreshHitmanStats(unit);
  if (typeof setStatusMark === 'function') setStatusMark(unit, '🐎', '騎乗終了', 0, 'hitmanRide');
}
function tickHitmanUnits() {
  if (!running || paused || !Array.isArray(units)) return;
  const now = Number(stageTime || 0);
  for (const unit of units) {
    if (!unit || unit.isEnemy || unit.name !== NAME || unit.hp <= 0) continue;
    if (unit.hitmanRiding && now >= Number(unit.hitmanRideUntil || 0)) stopRide(unit);
    if (!unit.hitmanRiding && now >= Number(unit.hitmanNextRideAt || Infinity)) {
      while (unit.hitmanNextRideAt <= now) unit.hitmanNextRideAt += 20;
      startRide(unit);
    }
  }
}

function blockEnemyHealing(target) {
  if (!target || !target.isEnemy) return;
  const until = performance.now() / 1000 + 2;
  target.festivalRegenDisabledUntil = Math.max(Number(target.festivalRegenDisabledUntil || 0), until);
  if (typeof setStatusMark === 'function') setStatusMark(target, '🚫', '回復封印', 2, 'hitmanHealBlock');
}
function addHitmanKillStack(unit) {
  if (!unit || unit.name !== NAME || unit.hp <= 0) return;
  if (!unit.hitmanCoreStats) {
    unit.hitmanCoreStats = {
      maxhp: Number(unit.maxhp || unit.hp || 1), atk: Number(unit.atk || 1),
      range: Number(unit.range || 1), spd: Number(unit.spd || 0.01),
      interval: Number(unit.interval || 1), recharge: Number(unit.recharge || 100)
    };
  }
  unit.hitmanKillStacks = Math.min(20, Number(unit.hitmanKillStacks || 0) + 1);
  refreshHitmanStats(unit);
  const bonus = unit.hitmanKillStacks * 5;
  if (typeof setStatusMark === 'function') setStatusMark(unit, '📈', '全ステータス +' + bonus + '%（撃破強化）', 999999, 'hitmanGrowth');
  if (typeof popup === 'function') popup('🎯 撃破強化 +' + bonus + '%', unit.x, 90, 'criticalPop');
}

function tryHitmanCounter(unit, attacker) {
  if (!unit || unit.hp <= 0 || !attacker || !attacker.isEnemy || attacker.hp <= 0) return;
  if (Number(unit.hitmanSkill2Uses || 0) >= 2) return;
  const now = Number(stageTime || 0);
  if (now < Number(unit.hitmanSkill2ReadyAt || 0)) return;
  if (Math.random() >= 0.15) return;
  unit.hitmanSkill2Uses = Number(unit.hitmanSkill2Uses || 0) + 1;
  unit.hitmanSkill2ReadyAt = now + 20;
  const maxX = Math.max(130, Number(worldWidth || 1100) - 145);
  unit.x = Math.max(130, Math.min(maxX, Number(attacker.x || 130) + 70));
  unit.target = attacker;
  unit.state = 'attack';
  if (unit.el) unit.el.style.left = unit.x + 'px';
  if (typeof setStatusMark === 'function') setStatusMark(unit, '✨', '戦闘術：転移反撃 ' + unit.hitmanSkill2Uses + '/2', 15, 'hitmanCounter');
  if (typeof popup === 'function') popup('✨ 戦闘術！ 転移反撃', unit.x, 90, 'criticalPop');
  const baseAttack = Math.max(1, Math.round(Number(unit.atk || 6200) * 4));
  const damage = damageAgainst(unit, attacker, baseAttack);
  const dealt = hit(attacker, damage, unit, { hitmanCounter: true });
  if (attacker.hp <= 0 && Array.isArray(enemies) && enemies.includes(attacker)) removeEnemy(attacker);
  const heal = Math.max(0, Math.round(Number(dealt || 0) * 0.2));
  if (heal > 0) {
    unit.hp = Math.min(unit.maxhp, unit.hp + heal);
    refreshHp(unit);
    if (typeof popup === 'function') popup('💚 戦闘術：HP +' + heal.toLocaleString(), unit.x, 115, 'criticalPop');
  }
}

function spawnTrackingMarker(unit) {
  if (!unit || !Array.isArray(enemies) || !document) return;
  // world はカメラ移動で translateX されるマップ本体。
  // マーカーも world の子に置き、unit.x / enemy.x と同じマップ座標系で動かす。
  const worldElement = document.getElementById('world') || (typeof world !== 'undefined' ? world : null);
  if (!worldElement) return;
  const marker = document.createElement('div');
  marker.textContent = '✦';
  marker.setAttribute('aria-hidden', 'true');
  marker.dataset.hitmanTrackingMarker = 'true';
  marker.style.cssText = 'position:absolute;width:25px;height:25px;display:flex;align-items:center;justify-content:center;border:2px solid #67e8f9;border-radius:50%;background:radial-gradient(circle,#ecfeff 0%,#0891b2 72%,#164e63 100%);color:#fff;font-size:17px;font-weight:900;box-shadow:0 0 10px #22d3ee,0 0 20px #0891b2;z-index:60;pointer-events:none;bottom:67px;';
  let x = Number(unit.x || (worldWidth || 1100) - 145);
  marker.style.left = x + 'px';
  worldElement.appendChild(marker);
  let previous = performance.now();
  const animate = now => {
    if (!marker.isConnected) return;
    if (!running) { marker.remove(); return; }
    const dt = Math.max(0, Math.min(0.05, (now - previous) / 1000));
    previous = now;
    const oldX = x;
    x -= 120 * dt;
    marker.style.left = x + 'px';
    const target = enemies
      .filter(e => e && e.hp > 0 && !e.muscleGrabbedBy && e.x <= oldX + 12 && e.x >= x - 18)
      .sort((a, b) => b.x - a.x)[0];
    if (target) {
      const damage = damageAgainst(unit, target, Math.max(1, Math.round(Number(unit.atk || 6200) * 2)));
      hit(target, damage, unit, { hitmanMarker: true });
      if (target.hp <= 0 && enemies.includes(target)) removeEnemy(target);
      marker.remove();
      if (typeof popup === 'function') popup('✦ 追跡マーカー命中', target.x, 80, 'criticalPop');
      return;
    }
    if (x <= 118) { marker.remove(); return; }
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
function launchTrackingMarkers(unit) {
  [0, 200, 400].forEach(delay => setTimeout(() => spawnTrackingMarker(unit), delay));
}

const originalDeploy = deploy;
deploy = function(i) {
  const before = new Set(Array.isArray(units) ? units : []);
  const result = originalDeploy(i);
  if (cards[i] && cards[i].name === NAME) {
    const unit = (Array.isArray(units) ? units : []).find(u => !before.has(u) && u && u.cardIndex === i && u.hp > 0);
    if (unit) {
      unit.hitmanCoreStats = {
        maxhp: Number(unit.maxhp || 72000), atk: Number(unit.atk || 6200),
        range: Number(unit.range || 220), spd: Number(unit.spd || 0.8),
        interval: Number(unit.interval || 1), recharge: Number(unit.recharge || 100)
      };
      unit.hitmanKillStacks = 0;
      unit.hitmanSkill2Uses = 0;
      unit.hitmanSkill2ReadyAt = Number(stageTime || 0);
      unit.hitmanNextRideAt = Number(stageTime || 0) + 15;
      startRide(unit);
      launchTrackingMarkers(unit);
    }
  }
  return result;
};

const originalHaifuOnAttack = haifuOnAttack;
haifuOnAttack = function(unit, target) {
  const result = originalHaifuOnAttack(unit, target);
  if (unit && unit.name === NAME && target && target.hp > 0) {
    money = Math.min(Number(workerMax || 999999999), Number(money || 0) + 50);
    if (Array.isArray(rechargeLeft) && Number.isInteger(unit.cardIndex) && rechargeLeft[unit.cardIndex] > 0) {
      rechargeLeft[unit.cardIndex] = Math.max(0, rechargeLeft[unit.cardIndex] * 0.985);
    }
    if (typeof popup === 'function') popup('+50円', target.x, 105, 'criticalPop');
    if (typeof update === 'function') update(true);
  }
  return result;
};

const originalHit = hit;
hit = function(target, damage, source, abilitySource) {
  let safeDamage = Number(damage) || 0;
  if (target && target.name === NAME && source && source.isEnemy) {
    const factor = typeof muscleAuraDamageFactor === 'function'
      ? Math.max(0.000001, Number(muscleAuraDamageFactor(source, target)) || 1) : 1;
    safeDamage = Math.min(safeDamage, Math.max(1, Number(target.maxhp || 1) * 0.1) / factor);
  }
  if (target && target.isEnemy && source && source.name === NAME) blockEnemyHealing(target);
  const before = Number(target && target.hp || 0);
  const result = originalHit(target, safeDamage, source, abilitySource);
  const actual = Math.max(0, before - Number(target && target.hp || 0));

  if (target && target.name === NAME && source && source.isEnemy && actual > 0 &&
      entityHasTrait(source, '神話') && !(abilitySource && abilitySource.hitmanReflection)) {
    const reflected = Math.max(1, Math.round(actual * 0.35));
    hit(source, reflected, target, { hitmanReflection: true });
    if (source.hp <= 0 && Array.isArray(enemies) && enemies.includes(source)) removeEnemy(source);
  }
  if (target && target.isEnemy && source && source.name === NAME && target.hp <= 0 && !target.hitmanKillAwarded) {
    target.hitmanKillAwarded = true;
    addHitmanKillStack(source);
  }
  if (target && target.name === NAME && source && source.isEnemy && actual > 0) {
    tryHitmanCounter(target, source);
  }
  return result;
};

const originalEnemyAttackTarget = enemyAttackTarget;
enemyAttackTarget = function(e, t, ea, now2, sourceSealed) {
  const attackNow = Number(now2 || performance.now() / 1000);
  const suppressHealing = !!(e && e.ability && Number(e.festivalRegenDisabledUntil || 0) > attackNow);
  const originalHealOnKill = suppressHealing ? e.ability.healOnKill : undefined;
  if (suppressHealing && originalHealOnKill) e.ability.healOnKill = 0;
  try {
    return originalEnemyAttackTarget(e, t, ea, now2, sourceSealed);
  } finally {
    if (suppressHealing) e.ability.healOnKill = originalHealOnKill;
  }
};

const originalGetAttackSequence = getAttackSequence;
getAttackSequence = function(source, target) {
  if (source && source.name === NAME) {
    const factor = Math.max(0.01, Number(source.atk || 6200) / 6200);
    return [
      { damage: Math.max(1, Math.round(6200 * factor)), index: 0 },
      { damage: Math.max(1, Math.round(3400 * factor)), index: 1 }
    ];
  }
  return originalGetAttackSequence(source, target);
};

const originalFollowup = resolveFollowupAttack;
resolveFollowupAttack = function(source, target, baseAttack, hitIndex) {
  if (source && source.name === NAME) {
    setTimeout(() => originalFollowup(source, target, baseAttack, hitIndex), 100);
    return;
  }
  return originalFollowup(source, target, baseAttack, hitIndex);
};

const originalLoop = loop;
loop = function(t) {
  const result = originalLoop(t);
  tickHitmanUnits();
  return result;
};

const originalShowResult = showResult;
showResult = function(win) {
  const result = originalShowResult(win);
  if (win && selectedMode === 'japan' && Number(selectedChapter) === 7 &&
      Number(selectedStage) === 48 && Array.isArray(chapterClears) &&
      Number(chapterClears[6] || 0) >= 48) {
    unlockHitman(true);
  }
  return result;
};

try {
  if (typeof save === 'function') save();
  if (typeof renderCards === 'function') renderCards();
  if (typeof renderFormation === 'function') renderFormation();
  if (typeof renderStageSelect === 'function') renderStageSelect();
  if (typeof renderFormationBuffSummary === 'function') renderFormationBuffSummary();
} catch (e) { console.warn('ヒットマン木下の初期化UI更新を一部スキップしました', e); }

window.HITMAN_KINOSHITA_TEST_API = {
  index, card, refreshHitmanStats, startRide, stopRide, tickHitmanUnits,
  addHitmanKillStack, spawnTrackingMarker, launchTrackingMarkers,
  blockEnemyHealing, tryHitmanCounter
};
})();