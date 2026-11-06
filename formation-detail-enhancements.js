/* v1.9.59: キャラ詳細のスキル分離と戦闘中の一時効果表示 */
(() => {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  function readSkillData(index) {
    try {
      return window.eval(`(() => {
        const i = ${Number(index)};
        const card = (typeof activeCard === 'function' ? activeCard(i) : null) || cards[i];
        const tree = typeof skillTreeFor === 'function' ? skillTreeFor(i) : null;
        const profiles = typeof SKILL_TREE_ABILITY_PROFILES !== 'undefined' ? SKILL_TREE_ABILITY_PROFILES : [];
        const treeSkills = [];
        if (tree) {
          for (const key of ['hp','atk','range','spd','interval','recharge']) {
            if (Number(tree[key] || 0) > 0) treeSkills.push({name: ({
              hp:'HP強化', atk:'攻撃力強化', range:'射程強化',
              spd:'移動速度強化', interval:'攻撃間隔短縮', recharge:'再生産短縮'
            })[key], desc: 'スキルツリー Lv.' + tree[key]});
          }
          for (let slot = 1; slot <= 3; slot++) {
            if (Number(tree['ability' + slot] || 0) === 1) {
              const profile = profiles[i]?.[slot - 1];
              if (profile) treeSkills.push({name:profile.name,desc:profile.desc});
            }
          }
        }
        return {card, treeSkills};
      })()`);
    } catch (error) {
      console.warn('character skill data unavailable', error);
      return null;
    }
  }

  function skillText(skill) {
    if (typeof skill === 'string' || typeof skill === 'number') return {name:'スキル', desc:String(skill)};
    if (!skill || typeof skill !== 'object') return null;
    const name = skill.name || skill.title || skill.label || skill.type || 'スキル';
    const desc = skill.desc || skill.description || skill.text || skill.detail || '';
    return {name:String(name), desc:typeof desc === 'string' ? desc : JSON.stringify(desc)};
  }

  function collectSkills(card, treeSkills) {
    const result = [];
    const add = value => {
      if (Array.isArray(value)) value.forEach(add);
      else if (value && typeof value === 'object' && !Array.isArray(value) &&
               !('name' in value || 'title' in value || 'label' in value || 'desc' in value || 'description' in value)) {
        Object.entries(value).forEach(([name, item]) => {
          const normalized = skillText(item);
          if (normalized) result.push({name: item?.name || name, desc: normalized.desc});
        });
      } else {
        const normalized = skillText(value);
        if (normalized) result.push(normalized);
      }
    };

    if (card?.skills) add(card.skills);
    if (card?.skill) add(card.skill);
    if (card?.activeSkill) add(card.activeSkill);
    if (card?.passiveSkill) add(card.passiveSkill);

    const kbr = card?.ability?.kbrSkill;
    if (kbr && typeof kbr === 'object') {
      const descriptions = {
        speed: '騎乗加速：一定時間、移動速度を強化します。',
        heal: '味方全体回復：味方ユニットのHPを回復します。',
        slow: '周囲の敵を鈍足にします。',
        stop: '周囲の敵を停止させます。',
        storm: '周囲の敵に範囲妨害を発生させます。',
        awakening: 'HP条件を満たすと覚醒し、性能が上昇します。'
      };
      result.push({
        name: kbr.name || ({speed:'騎乗加速',heal:'全体回復',slow:'鈍足の風',stop:'停止の技',storm:'嵐の技',awakening:'覚醒'}[kbr.type] || 'KBRスキル'),
        desc: kbr.desc || descriptions[kbr.type] || '発動条件・効果はスキル設定に従います。'
      });
    }
    result.push(...(treeSkills || []));
    const seen = new Set();
    return result.filter(skill => {
      const key = String(skill.name || '') + '|' + String(skill.desc || '');
      if (!skill.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const originalShowDetail = window.showCharacterDetail;
  if (typeof originalShowDetail === 'function' && !originalShowDetail.__skillSeparated) {
    const wrappedShowDetail = function(index) {
      const result = originalShowDetail.apply(this, arguments);
      const data = readSkillData(index);
      const body = document.getElementById('detailBody');
      if (!body || !data?.card) return result;
      body.querySelector('.characterSkillSection')?.remove();
      const skills = collectSkills(data.card, data.treeSkills);
      if (!skills.length) return result;

      const section = document.createElement('section');
      section.className = 'characterSkillSection';
      section.innerHTML = '<h3 class="detailSectionTitle">✨ スキル</h3>' +
        skills.map(skill => '<article class="detailAbility" style="margin:6px 0;padding:9px;border-left:4px solid #0ea5e9;background:#f0f9ff">' +
          '<b>' + escapeHtml(skill.name) + '</b>' +
          (skill.desc ? '<p style="margin:4px 0 0">' + escapeHtml(skill.desc) + '</p>' : '') +
          '</article>').join('');
      const abilityTitle = [...body.querySelectorAll('.detailSectionTitle')].find(el => el.textContent.includes('固有能力'));
      if (abilityTitle) body.insertBefore(section, abilityTitle);
      else body.appendChild(section);
      return result;
    };
    wrappedShowDetail.__skillSeparated = true;
    window.showCharacterDetail = wrappedShowDetail;
  }

  // 編成由来の常時効果・生来の耐性は戦闘中の一時バフ一覧に出さない。
  // 出撃後に獲得した成長、時間制限付きの強化・妨害、シールド等は残す。
  const persistentLabels = [
    '味方の攻撃力・攻撃間隔バフ無効',
    '呪い・波動無効／被ダメージ上限25%',
    '覇風：HP・移動速度',
    '呪いの木下達 ',
    '神話 ',
    'HP50%以上：攻撃力 +15%'
  ];
  const persistentClasses = new Set([
    'novaMode', 'novaAllyBuffLock', 'novaImmunity',
    'novaSeries', 'novaMyth', 'novaHaifu', 'rageHpThreshold'
  ]);

  const originalUpdateStatus = window.updateStatusMark;
  if (typeof originalUpdateStatus === 'function' && !originalUpdateStatus.__temporaryEffectsOnly) {
    const wrappedUpdateStatus = function(target) {
      const result = originalUpdateStatus.apply(this, arguments);
      const box = target?.el?.querySelector('.unitEffects');
      if (!box) return result;
      for (const tag of [...box.children]) {
        const label = tag.textContent || '';
        if ([...persistentClasses].some(name => tag.classList.contains(name)) ||
            persistentLabels.some(prefix => label.includes(prefix))) tag.remove();
      }
      if (!box.children.length) box.remove();
      return result;
    };
    wrappedUpdateStatus.__temporaryEffectsOnly = true;
    window.updateStatusMark = wrappedUpdateStatus;
  }
})();
