(() => {
'use strict';
const NAME = 'ヒットマン木下';
if (window.__HITMAN_KINOSHITA_V1__) return;
window.__HITMAN_KINOSHITA_V1__ = true;

const definition = {
  name: NAME, cost: 2200, hp: 95800, atk: 8900, secondAtk: 5100,
  multiAttack: [8900, 5100], range: 220, spd: 0.8, interval: 1,
  recharge: 75, icon: '🎯', motion: 'super', attackType: 'single',
  kb: 2, trait: '黒', rarity: '伝説レア',
  series: '神話編全48ステージクリア報酬',
  specialReward: true, chapterReward: 7,
  skills: [
    { id: 'hitman_tracking', name: '追跡マーカー', description: '出撃時に追跡マーカーを3発発射する。各マーカーは命中した敵に攻撃力の500%分のダメージを与える。', trigger: '出撃時', count: 3, interval: 0.2, damageMultiplier: 5 },
    { id: 'hitman_ride', name: '騎乗', description: '出撃直後に発動し、以後15秒ごとに3秒間騎乗する。騎乗中は移動速度+2、烈波無効。', trigger: '出撃時・以後15秒ごと', interval: 15, duration: 3, speedBonus: 2 },
    { id: 'hitman_counter', name: '転移反撃', description: '敵からダメージを受けた時、25%の確率で発動（最大2回）。敵の近くへ転移し、攻撃力の1500%分のダメージを与え、実ダメージの50%を回復する。再使用まで15秒。', trigger: '敵からダメージを受けた時', chance: 0.25, cooldown: 15, maxUses: 2, damageMultiplier: 15, healRatio: 0.5, teleportOffset: 70 }
  ],
  ability: {
    name: '神話狩り・追跡戦術',
    desc: '神話属性に5倍ダメージ。神話属性から受けるダメージを85%軽減し、受けたHPダメージの80%を反射。呪い・停止・波動・反射を無効化。通常攻撃は1段目8,900、0.2秒後に2段目5,100。攻撃ごとに再出撃時間を3%短縮し、75円を獲得。攻撃した敵の回復を2秒封じる。敵撃破ごとに全ステータス+10%（最大+200%）。',
    strong: { 神話: 5 }, resist: { 神話: 0.15 },
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
function hitmanSkill(id) {
  return Array.isArray(card.skills) ? card.skills.find(skill => skill && skill.id === id) : null;
}
function hitmanAttackDamage(unit, hitIndex = 0) {
  const currentAttack = Math.max(1, Number(unit && unit.atk) || 8900);
  const multiplier = Number(hitIndex) === 1 ? 5100 / 8900 : 1;
  return Math.max(1, Math.round(currentAttack * multiplier));
}
function syncHitmanMultiAttack(unit) {
  if (!unit || unit.name !== NAME) return [];
  const firstHit = hitmanAttackDamage(unit, 0);
  const secondHit = hitmanAttackDamage(unit, 1);
  // 戦闘本体は multiAttack を優先参照するため、出撃ユニット側もレベル補正値に同期する。
  unit.multiAttack = [firstHit, secondHit];
  unit.secondAtk = secondHit;
  return unit.multiAttack;
}
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

function remapIceWyvernCharacterId(rawId, iceIndex, oldLength) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 0) return rawId;
  if (id === iceIndex) return oldLength - 1;
  if (id > iceIndex && id < oldLength) return id - 1;
  return id;
}
function remapIceWyvernArrayById(rawArray, iceIndex, oldLength, fillValue) {
  if (!Array.isArray(rawArray)) return rawArray;
  const old = rawArray.slice();
  const next = Array(Math.max(old.length, oldLength)).fill(fillValue);
  for (let oldId = 0; oldId < old.length; oldId++) {
    next[remapIceWyvernCharacterId(oldId, iceIndex, oldLength)] = old[oldId];
  }
  return next;
}
function moveIceWyvernToLatestId() {
  const iceIndex = cards.findIndex(c => c && c.name === 'アイスワイバーン');
  if (iceIndex < 0) return;
  const oldLength = cards.length;
  if (iceIndex !== oldLength - 1) {
    const [iceCard] = cards.splice(iceIndex, 1);
    cards.push(iceCard);
  }
  const latestIndex = cards.length - 1;
  const remapId = id => remapIceWyvernCharacterId(id, iceIndex, oldLength);
  // このマップは、まだ旧ID順で保存されているSupabase AIデータの読み込みにも使用する。
  window.__KINOSHITA_ICE_WYVERN_ID_REMAP__ = { from: iceIndex, to: latestIndex, oldLength, version: 1 };
  const migrationKey = 'kinoshitaIceWyvernLatestIdV1';
  const migrationStorage = typeof storage !== 'undefined' && storage ? storage : window.localStorage;
  let alreadyMigrated = false;
  try { alreadyMigrated = !!migrationStorage && migrationStorage.getItem(migrationKey) === 'done'; } catch (e) { console.warn('Ice Wyvern migration status read skipped', e); }
  if (!alreadyMigrated && iceIndex !== latestIndex) {
    ownedFlags = remapIceWyvernArrayById(ownedFlags, iceIndex, oldLength, false);
    charLevel = remapIceWyvernArrayById(charLevel, iceIndex, oldLength, 1);
    charMaxLevel = remapIceWyvernArrayById(charMaxLevel, iceIndex, oldLength, 20);
    charForm = remapIceWyvernArrayById(charForm, iceIndex, oldLength, 1);
    normalEvolved = remapIceWyvernArrayById(normalEvolved, iceIndex, oldLength, false);
    rechargeLeft = remapIceWyvernArrayById(rechargeLeft, iceIndex, oldLength, 0);
    formation = Array.isArray(formation) ? formation.map(remapId) : [];
    if (typeof formationBeforeLateCards !== 'undefined' && Array.isArray(formationBeforeLateCards)) {
      for (let i = 0; i < formationBeforeLateCards.length; i++) formationBeforeLateCards[i] = remapId(formationBeforeLateCards[i]);
    }
    if (typeof formationPresets !== 'undefined' && Array.isArray(formationPresets)) {
      formationPresets = formationPresets.map(p => Array.isArray(p) ? p.map(remapId) : p);
    }
    if (typeof aiProfiles !== 'undefined' && Array.isArray(aiProfiles)) {
      for (const profile of aiProfiles) {
        if (!profile || typeof profile !== 'object') continue;
        if (Array.isArray(profile.ownedCharacters)) profile.ownedCharacters = profile.ownedCharacters.map(remapId);
        if (Array.isArray(profile.formation)) profile.formation = profile.formation.map(remapId);
        if (Array.isArray(profile.charLevels)) profile.charLevels = remapIceWyvernArrayById(profile.charLevels, iceIndex, oldLength, 1);
        if (Array.isArray(profile.charMaxLevels)) profile.charMaxLevels = remapIceWyvernArrayById(profile.charMaxLevels, iceIndex, oldLength, 20);
        if (Array.isArray(profile.formationPresets)) profile.formationPresets = profile.formationPresets.map(p => Array.isArray(p) ? p.map(remapId) : p);
        const state = profile.activityState;
        if (state && typeof state === 'object') {
          for (const key of ['aiCharMaxLevel', 'aiCharForm', 'aiNormalEvolved']) {
            if (Array.isArray(state[key])) state[key] = remapIceWyvernArrayById(state[key], iceIndex, oldLength, key === 'aiNormalEvolved' ? false : 1);
          }
          state.iceWyvernLatestIdV1 = 1;
        }
      }
      try { if (migrationStorage) migrationStorage.setItem('kinoshitaAIProfilesV2', JSON.stringify(aiProfiles)); } catch (e) { console.warn('Ice Wyvern AI ID migration save skipped', e); }
    }
    if (typeof rankMetaStats !== 'undefined' && rankMetaStats && typeof rankMetaStats === 'object') {
      const nextChars = {};
      for (const [key, value] of Object.entries(rankMetaStats.chars || {})) {
        const oldId = Number(key);
        nextChars[String(Number.isInteger(oldId) ? remapId(oldId) : key)] = value;
      }
      rankMetaStats.chars = nextChars;
      const nextForms = {};
      for (const [key, value] of Object.entries(rankMetaStats.formations || {})) {
        if (key === 'empty') { nextForms[key] = value; continue; }
        const ids = key.split('-').map(Number);
        nextForms[ids.every(Number.isInteger) ? ids.map(remapId).join('-') : key] = value;
      }
      rankMetaStats.formations = nextForms;
    }
    const storageKeys = [];
    try { for (let i = 0; migrationStorage && i < migrationStorage.length; i++) { const key = migrationStorage.key(i); if (key) storageKeys.push(key); } } catch (e) {}
    try { if (migrationStorage && migrationStorage.data && typeof migrationStorage.data === 'object') storageKeys.push(...Object.keys(migrationStorage.data)); } catch (e) {}
    storageKeys.push('kinoshitaPreviousSeasonTop5', 'kinoshitaPreviousSeasonTop10');
    try { storageKeys.push('kinoshitaRankBannedCharacters_' + currentRankSeason()); } catch (e) {}
    for (const key of new Set(storageKeys)) {
      if (!key.startsWith('kinoshitaRankBannedCharacters_') && key !== 'kinoshitaPreviousSeasonTop5' && key !== 'kinoshitaPreviousSeasonTop10') continue;
      try {
        const ids = JSON.parse(migrationStorage.getItem(key) || 'null');
        if (Array.isArray(ids) && ids.every(Number.isInteger)) migrationStorage.setItem(key, JSON.stringify(ids.map(remapId)));
      } catch (e) {}
    }
    try { if (typeof syncOwnedCount === 'function') syncOwnedCount(); } catch (e) {}
    try { if (typeof saveFormationStableNames === 'function') saveFormationStableNames(); } catch (e) {}
    try { if (typeof save === 'function') save(); } catch (e) { console.warn('Ice Wyvern ID migration save skipped', e); }
    try { if (typeof saveRankMeta === 'function') saveRankMeta(); } catch (e) { console.warn('Ice Wyvern rank ID migration save skipped', e); }
    try { if (migrationStorage) migrationStorage.setItem(migrationKey, 'done'); } catch (e) { console.warn('Ice Wyvern migration marker save skipped', e); }
  } else if (!alreadyMigrated) {
    try { if (migrationStorage) migrationStorage.setItem(migrationKey, 'done'); } catch (e) { console.warn('Ice Wyvern migration marker save skipped', e); }
  }
  try {
    if (typeof window.__KINOSHITA_REMAP_GENESIS_CARD_IDS__ === 'function') window.__KINOSHITA_REMAP_GENESIS_CARD_IDS__(remapId);
  } catch (e) { console.warn('Genesis character ID remap skipped', e); }
  for (let i = 0; i < cards.length; i++) if (cards[i]) cards[i].id = i;
  index = cards.indexOf(card);
  card.id = index;
  CURRENT_CHARACTER_COUNT = cards.length;
  window.KINOSHITA_CHARACTER_ID_AUDIT = {
    total: cards.length,
    expectedTotal: 119,
    iceWyvernId: cards.findIndex(c => c && c.name === 'アイスワイバーン'),
    latestId: cards.length - 1,
    iceWyvernIsLatest: cards[cards.length - 1]?.name === 'アイスワイバーン',
    idsAligned: cards.every((entry, id) => !entry || entry.id === id)
  };
  if (cards.length !== 119) console.warn('[木下大戦争] キャラクター総数の想定は119体ですが、現在は' + cards.length + '体です。ID監査を確認してください。');
}
moveIceWyvernToLatestId();

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

// 起動時に保存名キーから一時的に除外された後発キャラクターを、全スクリプト登録後に復元する。
// 所持名はIDより優先し、既存キャラクターの所持状態を失わないよう「追加のみ」で補正する。
try {
  const bootOwnedNames = new Set(Array.isArray(ownedCharacterNamesAtBoot) ? ownedCharacterNamesAtBoot : []);
  for (let i = 0; i < cards.length; i++) {
    if (cards[i] && bootOwnedNames.has(cards[i].name)) ownedFlags[i] = true;
  }
  // クリア記録が残っているのに報酬だけ欠落した既存セーブへ、アイスワイバーンを再付与する。
  const iceIndex = cards.findIndex(c => c && c.name === 'アイスワイバーン');
  if (iceIndex >= 0 && typeof eventClears !== 'undefined' && eventClears &&
      eventClears['アイスワイバーン襲来'] === true) {
    ownedFlags[iceIndex] = true;
  }
  if (typeof syncOwnedCount === 'function') syncOwnedCount();

  // main script の後発キャラクター読込前に削られた編成を、全119体の登録後に名前から復元する。
  const bootFormationNames = Array.isArray(formationStableNamesAtBoot) && formationStableNamesAtBoot.length
    ? formationStableNamesAtBoot
    : (Array.isArray(formationCharacterNamesAtBoot) ? formationCharacterNamesAtBoot : null);
  if (Array.isArray(bootFormationNames)) {
    const restoredFormation = bootFormationNames
      .map(name => cards.findIndex(c => c && c.name === name))
      .filter(id => id >= 0);
    // 編成に保存されていたキャラクターは、所持名キーが古い場合でも編成内容を優先して保護する。
    for (const id of restoredFormation) ownedFlags[id] = true;
    formation = restoredFormation;
    if (typeof normalizeFormation === 'function') normalizeFormation();
  }
  if (typeof save === 'function') save();
  if (typeof saveFormationStableNames === 'function') saveFormationStableNames();
  if (typeof renderCards === 'function') renderCards();
  if (typeof renderFormation === 'function') renderFormation();
  if (typeof renderFormationBuffSummary === 'function') renderFormationBuffSummary();
} catch (e) {
  console.warn('後発キャラクターの所持・編成復元を一部スキップしました', e);
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
  const factor = 1 + Math.min(20, Math.max(0, Number(unit.hitmanKillStacks || 0))) * 0.1;
  unit.maxhp = Math.max(1, Math.round(core.maxhp * factor));
  unit.hp = Math.max(1, Math.min(unit.maxhp, Math.round(unit.maxhp * ratio)));
  unit.atk = Math.max(1, Math.round(core.atk * factor));
  syncHitmanMultiAttack(unit);
  unit.range = Math.max(1, Math.round(core.range * factor));
  unit.spd = Math.max(0.01, core.spd * factor + (unit.hitmanRiding ? Number(hitmanSkill('hitman_ride')?.speedBonus || 2) : 0));
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
  const skill = hitmanSkill('hitman_ride');
  unit.hitmanRiding = true;
  unit.hitmanRideUntil = Number(stageTime || 0) + Number(skill?.duration || 3);
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
      const skill = hitmanSkill('hitman_ride');
      const interval = Math.max(1, Number(skill?.interval || 15));
      while (unit.hitmanNextRideAt <= now) unit.hitmanNextRideAt += interval;
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
      interval: Number(unit.interval || 1), recharge: Number(unit.recharge || 75)
    };
  }
  unit.hitmanKillStacks = Math.min(20, Number(unit.hitmanKillStacks || 0) + 1);
  refreshHitmanStats(unit);
  const bonus = unit.hitmanKillStacks * 10;
  if (typeof setStatusMark === 'function') setStatusMark(unit, '📈', '全ステータス +' + bonus + '%（撃破強化）', 999999, 'hitmanGrowth');
  if (typeof popup === 'function') popup('🎯 撃破強化 +' + bonus + '%', unit.x, 90, 'criticalPop');
}

function tryHitmanCounter(unit, attacker) {
  if (!unit || unit.hp <= 0 || !attacker || !attacker.isEnemy || attacker.hp <= 0) return;
  const skill = hitmanSkill('hitman_counter');
  if (!skill || Number(unit.hitmanSkill2Uses || 0) >= Number(skill.maxUses || 2)) return;
  const now = Number(stageTime || 0);
  if (now < Number(unit.hitmanSkill2ReadyAt || 0)) return;
  if (Math.random() >= Number(skill.chance ?? 0.25)) return;
  unit.hitmanSkill2Uses = Number(unit.hitmanSkill2Uses || 0) + 1;
  unit.hitmanSkill2ReadyAt = now + Number(skill.cooldown || 15);
  const maxX = Math.max(130, Number(worldWidth || 1100) - 145);
  unit.x = Math.max(130, Math.min(maxX, Number(attacker.x || 130) + Number(skill.teleportOffset || 70)));
  unit.target = attacker;
  unit.state = 'attack';
  if (unit.el) unit.el.style.left = unit.x + 'px';
  if (typeof setStatusMark === 'function') setStatusMark(unit, '✨', '戦闘術：転移反撃 ' + unit.hitmanSkill2Uses + '/' + Number(skill.maxUses || 2), Number(skill.cooldown || 15), 'hitmanCounter');
  if (typeof popup === 'function') popup('✨ 戦闘術！ 転移反撃', unit.x, 90, 'criticalPop');
  const baseAttack = Math.max(1, Math.round(Number(unit.atk || 8900) * Number(skill.damageMultiplier || 15)));
  const damage = damageAgainst(unit, attacker, baseAttack);
  const dealt = hit(attacker, damage, unit, { hitmanCounter: true });
  if (attacker.hp <= 0 && Array.isArray(enemies) && enemies.includes(attacker)) removeEnemy(attacker);
  const heal = Math.max(0, Math.round(Number(dealt || 0) * Number(skill.healRatio ?? 0.5)));
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
      const skill = hitmanSkill('hitman_tracking');
      const damage = damageAgainst(unit, target, Math.max(1, Math.round(Number(unit.atk || 8900) * Number(skill?.damageMultiplier || 5))));
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
  const skill = hitmanSkill('hitman_tracking');
  const count = Math.max(1, Math.floor(Number(skill?.count || 3)));
  const interval = Math.max(0, Number(skill?.interval ?? 0.2) * 1000);
  for (let i = 0; i < count; i++) setTimeout(() => spawnTrackingMarker(unit), i * interval);
}

const originalDeploy = deploy;
deploy = function(i) {
  const before = new Set(Array.isArray(units) ? units : []);
  const result = originalDeploy(i);
  if (cards[i] && cards[i].name === NAME) {
    const unit = (Array.isArray(units) ? units : []).find(u => !before.has(u) && u && u.cardIndex === i && u.hp > 0);
    if (unit) {
      unit.hitmanCoreStats = {
        maxhp: Number(unit.maxhp || 95800), atk: Number(unit.atk || 8900),
        range: Number(unit.range || 220), spd: Number(unit.spd || 0.8),
        interval: Number(unit.interval || 1), recharge: Number(unit.recharge || 75)
      };
      unit.hitmanKillStacks = 0;
      unit.hitmanSkill2Uses = 0;
      unit.hitmanSkill2ReadyAt = Number(stageTime || 0);
      unit.hitmanNextRideAt = Number(stageTime || 0) + Number(hitmanSkill('hitman_ride')?.interval || 15);
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
    money = Math.min(Number(workerMax || 999999999), Number(money || 0) + 75);
    if (Array.isArray(rechargeLeft) && Number.isInteger(unit.cardIndex) && rechargeLeft[unit.cardIndex] > 0) {
      rechargeLeft[unit.cardIndex] = Math.max(0, rechargeLeft[unit.cardIndex] * 0.97);
    }
    if (typeof popup === 'function') popup('+75円', target.x, 105, 'criticalPop');
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
    const reflected = Math.max(1, Math.round(actual * 0.8));
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
    return syncHitmanMultiAttack(source).map((damage, index) => ({ damage, index }));
  }
  return originalGetAttackSequence(source, target);
};

const originalFollowup = resolveFollowupAttack;
resolveFollowupAttack = function(source, target, baseAttack, hitIndex) {
  if (source && source.name === NAME) {
    const currentDamage = Number(hitIndex) === 1 ? hitmanAttackDamage(source, 1) : baseAttack;
    setTimeout(() => originalFollowup(source, target, currentDamage, hitIndex), 100);
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
  index, card, refreshHitmanStats, hitmanAttackDamage, syncHitmanMultiAttack, startRide, stopRide, tickHitmanUnits,
  addHitmanKillStack, spawnTrackingMarker, launchTrackingMarkers,
  blockEnemyHealing, tryHitmanCounter
};
})();