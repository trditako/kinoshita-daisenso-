(() => {
'use strict';
if (!Array.isArray(cards)) return;
const TRIGGER = /攻撃時|攻撃するたび|攻撃ごと|攻撃が命中するたび|攻撃した敵|攻撃を受けた場合|出撃時|召喚時|召喚後|召喚するたび|敵撃破時|敵撃破ごと|敵撃破で|撃破時|撃破ごと|撃破で|敵を倒すと|敵を倒したとき|被弾時|被弾ごと|致命傷時|致命傷を受けたとき|ダメージを与えるたび|ダメージを受けると|HP\s*\d+%?(?:未満|以下|以上)|\d+(?:\.\d+)?秒ごと|CT\s*\d+(?:\.\d+)?秒|\d+(?:\.\d+)?個で|右手：|左手：|攻撃で\d+(?:\.\d+)?%発動/;
function triggerLabel(text) {
  if (/出撃時/.test(text)) return '出撃時';
  if (/召喚時|召喚後|召喚するたび/.test(text)) return '召喚時・召喚後';
  if (/右手：|左手：/.test(text)) return '条件を満たした時';
  if (/\d+(?:\.\d+)?個で/.test(text)) return '撃破スタック条件';
  if (/致命傷|HP\s*\d+%?(?:未満|以下|以上)/.test(text)) return 'HP条件を満たした時';
  if (/被弾|攻撃を受けた場合|ダメージを受けると/.test(text)) return '被弾時';
  if (/撃破|敵を倒す/.test(text)) return '敵撃破時';
  if (/\d+(?:\.\d+)?秒ごと|CT\s*\d+(?:\.\d+)?秒/.test(text)) return '定期発動';
  if (/攻撃|ダメージを与える/.test(text)) return '攻撃時';
  return '条件発動';
}
function skillName(card, text, index) {
  if (/再反転/.test(text)) return '再反転';
  if (/反転/.test(text)) return '反転';
  if (/追跡マーカー/.test(text)) return '追跡マーカー';
  if (/回復を\d+(?:\.\d+)?秒封じ/.test(text)) return '回復封印';
  if (/再出撃時間.*円/.test(text)) return '攻撃報酬';
  if (/撃破ごと|敵撃破/.test(text)) return '撃破成長';
  if (/右手：/.test(text)) return '右手拘束';
  if (/左手：/.test(text)) return '左手拘束';
  if (/因果反転/.test(text)) return '因果反転';
  if (/創世律動/.test(text)) return '創世律動';
  if (/破壊砲/.test(text)) return '破壊砲';
  if (/ミニガン/.test(text)) return 'ミニガン';
  if (/飛行|飛んで/.test(text)) return '飛行';
  if (/停止/.test(text) && /鈍足|攻撃力低下|呪い/.test(text)) return '複合妨害';
  return String(card.ability?.name || card.name || '戦闘スキル') + (index ? '（' + (index + 1) + '）' : '');
}
function ensureSkill(card, skill) {
  if (!Array.isArray(card.skills)) card.skills = [];
  if (card.skills.some(s => s && s.id === skill.id)) return;
  card.skills.push(skill);
}
function metadata(text) {
  const out = {};
  const chance = text.match(/(\d+(?:\.\d+)?)%(?:で|発動)/);
  const interval = text.match(/(\d+(?:\.\d+)?)秒(?:ごと|間隔)/);
  const cooldown = text.match(/CT\s*(\d+(?:\.\d+)?)秒|クール(?:タイム|ダウン)\s*(\d+(?:\.\d+)?)秒/);
  const duration = text.match(/(\d+(?:\.\d+)?)秒(?:間|持続|呪い|停止|鈍足|封印)/);
  const count = text.match(/(\d+)回(?:発射|追跡|発動)/);
  if (chance) out.chance = Number(chance[1]) / 100;
  if (interval) out.interval = Number(interval[1]);
  if (cooldown) out.cooldown = Number(cooldown[1] || cooldown[2]);
  if (duration) out.duration = Number(duration[1]);
  if (count) out.count = Number(count[1]);
  return out;
}
function migrateCard(card, cardIndex) {
  if (!card || !card.ability || typeof card.ability.desc !== 'string') return;
  const original = card.ability.desc.trim();
  if (!original || original === '特殊能力なし' || card.__battleSkillMigrationV1) return;
  const passive = [], active = [];
  const sentences = original.split(/(?<=[。；;])/u).filter(Boolean);
  for (const sentence of sentences) {
    const pieces = sentence.split(/(?<=＋)/u).filter(Boolean);
    for (const piece of pieces) {
      if (TRIGGER.test(piece)) active.push(piece.trim());
      else passive.push(piece.trim());
    }
  }
  if (!active.length) return;
  active.forEach((description, skillIndex) => {
    const id = 'legacy_battle_skill_' + cardIndex + '_' + skillIndex;
    const name = skillName(card, description, skillIndex);
    if (Array.isArray(card.skills) && card.skills.some(skill => skill && (skill.name === name || skill.description === description))) return;
    ensureSkill(card, {
      id,
      name,
      description,
      trigger: triggerLabel(description),
      ...metadata(description),
      source: 'migrated-ability-description'
    });
  });
  card.ability.desc = passive.join('').trim();
  card.__battleSkillMigrationV1 = true;
}
cards.forEach(migrateCard);
const hitman = cards.find(c => c && c.name === 'ヒットマン木下');
if (hitman) {
  ensureSkill(hitman, {
    id: 'hitman_counter',
    name: '転移反撃',
    description: '被弾時25%で攻撃者の背後へ転移し、攻撃力の15倍で反撃する。実際に与えたダメージの50%を回復する。1回の出撃につき最大2回。',
    trigger: '被弾時',
    chance: .25,
    cooldown: 15,
    damageMultiplier: 15,
    healRatio: .5,
    maxUses: 2
  });
  ensureSkill(hitman, {
    id: 'hitman_ride',
    name: '乗馬',
    description: '出撃直後に発動し、以後15秒ごとに3秒間騎乗する。騎乗中は移動速度+2・烈波無効。',
    trigger: '出撃時／15秒ごと',
    interval: 15,
    duration: 3
  });
}
const nova = cards.find(c => c && c.name === 'ノヴァ木下');
if (nova) ensureSkill(nova, {
  id: 'nova_mode_switch',
  name: '破壊／連射モード切替',
  description: '編成上段から出撃中、木下マネー3,000を消費して破壊モードと連射モードを切り替える。',
  trigger: 'プレイヤー操作時'
});
})();