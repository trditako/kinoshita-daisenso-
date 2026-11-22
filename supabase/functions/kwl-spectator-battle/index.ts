import { createClient } from 'npm:@supabase/supabase-js@2'
import './battle-core.js'

const BattleCore = (globalThis as any).KinoshitaBattleCore
if (!BattleCore) throw new Error('Shared battle runtime failed to load')

type Card = {
  name: string; cost: number; hp: number; atk: number; range: number; spd: number;
  interval: number; recharge: number; icon?: string; attackType?: string; trait?: string;
  kb?: number; ability?: Record<string, any>; skills?: any[]; secondForm?: Record<string, any>;
  [key: string]: any;
}
type AIAccount = {
  account_id: number; name?: string; skill?: number; strategy?: string; rp?: number;
  formation?: number[]; owned_characters?: number[]; char_levels?: number[];
  chapter_clears?: number[]; activity?: Record<string, any>;
  [key: string]: any;
}
type Unit = {
  id: number; card_id: number; name: string; icon: string; side: 'team1'|'team2';
  x: number; hp: number; max_hp: number; atk: number; range: number; spd: number;
  interval: number; cooldown: number; cost: number; recharge: number; trait: string;
  attack_type: string; ability: Record<string, any>; kb: number; state: string;
  slow_until: number; slow_factor: number; stop_until: number; attack_down_until: number;
  attack_down_factor: number; cursed_until: number; barrier: number; power_shield: number;
  kill_stacks: number; target_id: number|null;
  [key: string]: any;
}
const PROJECT_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AI_TOKEN = Deno.env.get('AI_WORKER_TOKEN') || ''
const REHEARSAL_OPERATOR_KEY = Deno.env.get('WORLD_ANNOUNCEMENT_TOKEN') || ''
const ENGINE_VERSION = 'kwl-server-replay-v3-shared-combat'
const CARDS = [
  {
    "name": "木下",
    "cost": 50,
    "hp": 260,
    "atk": 32,
    "range": 50,
    "spd": 1.35,
    "interval": 0.9,
    "recharge": 5,
    "icon": "👨🏻",
    "motion": "basic",
    "attackType": "single",
    "kb": 3,
    "ability": {
      "name": "基本攻撃",
      "desc": "特殊能力なし"
    },
    "secondForm": {
      "name": "木下・覚醒",
      "hp": 5000,
      "atk": 1200,
      "range": 75,
      "spd": 1.8,
      "interval": 0.55,
      "recharge": 4.5,
      "kb": 6,
      "ability": {
        "name": "覚醒・連撃波動",
        "desc": "45%でLv3波動。20%で追加攻撃。全属性からの被ダメージ0.8倍。",
        "wave": true,
        "waveLevel": 3,
        "waveChance": 0.45,
        "extraAttackChance": 0.2,
        "resist": {
          "*": 0.8
        }
      }
    },
    "trait": "無",
    "id": 0
  },
  {
    "name": "強化木下",
    "cost": 100,
    "hp": 500,
    "atk": 58,
    "range": 55,
    "spd": 1,
    "interval": 1.05,
    "recharge": 7,
    "icon": "💪🏻",
    "motion": "power",
    "attackType": "single",
    "kb": 4,
    "ability": {
      "name": "赤にめっぽう強い",
      "desc": "赤属性への攻撃1.5倍・被ダメージ0.5倍",
      "strong": {
        "赤": 1.5
      },
      "resist": {
        "赤": 0.5
      }
    },
    "secondForm": {
      "name": "強化木下・改",
      "hp": 9000,
      "atk": 1600,
      "range": 90,
      "spd": 1.3,
      "interval": 0.7,
      "recharge": 5.5,
      "kb": 6,
      "ability": {
        "name": "赤絶対制圧",
        "desc": "赤属性に4倍ダメージ、赤属性からの被ダメージ0.25倍。30%で1秒停止。",
        "strong": {
          "赤": 4
        },
        "resist": {
          "赤": 0.25
        },
        "stopChance": 0.3,
        "stopDuration": 1
      }
    },
    "trait": "赤",
    "id": 1
  },
  {
    "name": "マッチョ木下",
    "cost": 200,
    "hp": 900,
    "atk": 105,
    "range": 62,
    "spd": 0.72,
    "interval": 1.25,
    "recharge": 10,
    "icon": "🏋️",
    "motion": "muscle",
    "attackType": "area",
    "kb": 2,
    "ability": {
      "name": "赤に撃たれ強い",
      "desc": "赤属性からの被ダメージ0.4倍",
      "resist": {
        "赤": 0.4
      }
    },
    "secondForm": {
      "name": "マッチョ木下・改",
      "hp": 16000,
      "atk": 2200,
      "range": 85,
      "spd": 0.9,
      "interval": 0.85,
      "recharge": 8,
      "kb": 4,
      "ability": {
        "name": "超重装・粉砕",
        "desc": "赤属性からの被ダメージ0.2倍。被ダメージ25%軽減。攻撃時50%で後退、25%でLv2波動。",
        "resist": {
          "赤": 0.2
        },
        "damageReduce": {
          "chance": 1,
          "factor": 0.75
        },
        "knockbackChance": 0.5,
        "wave": true,
        "waveLevel": 2,
        "waveChance": 0.25
      }
    },
    "trait": "青",
    "id": 2
  },
  {
    "name": "木下（野球）",
    "cost": 400,
    "hp": 700,
    "atk": 150,
    "range": 88,
    "spd": 0.82,
    "interval": 1.4,
    "recharge": 14,
    "icon": "⚾",
    "motion": "baseball",
    "attackType": "single",
    "kb": 5,
    "ability": {
      "name": "赤に超ダメージ",
      "desc": "赤属性への攻撃2.2倍",
      "strong": {
        "赤": 2.2
      }
    },
    "secondForm": {
      "name": "木下（野球）・改",
      "hp": 12000,
      "atk": 3000,
      "range": 150,
      "spd": 1.1,
      "interval": 0.9,
      "recharge": 10,
      "kb": 7,
      "ability": {
        "name": "超・ホームラン",
        "desc": "赤属性に5倍ダメージ。30%で追加攻撃、50%で後退。",
        "strong": {
          "赤": 5
        },
        "extraAttackChance": 0.3,
        "knockbackChance": 0.5
      }
    },
    "trait": "赤",
    "id": 3
  },
  {
    "name": "木下（覚醒）",
    "cost": 800,
    "hp": 1500,
    "atk": 280,
    "range": 108,
    "spd": 0.55,
    "interval": 1.7,
    "recharge": 19,
    "icon": "🦸🏻",
    "motion": "awakened",
    "attackType": "area",
    "kb": 3,
    "ability": {
      "name": "赤を遅くする",
      "desc": "攻撃時50%で赤属性を40%減速・2.5秒",
      "slow": {
        "trait": "赤",
        "chance": 0.5,
        "factor": 0.6,
        "duration": 2.5
      }
    },
    "secondForm": {
      "name": "木下（覚醒）・改",
      "hp": 18000,
      "atk": 3800,
      "range": 180,
      "spd": 0.8,
      "interval": 1.1,
      "recharge": 14,
      "kb": 5,
      "ability": {
        "name": "覚醒・灼熱制圧",
        "desc": "赤属性に3.5倍ダメージ。70%で50%減速・3秒、40%でLv3波動。",
        "strong": {
          "赤": 3.5
        },
        "slow": {
          "trait": "赤",
          "chance": 0.7,
          "factor": 0.5,
          "duration": 3
        },
        "wave": true,
        "waveLevel": 3,
        "waveChance": 0.4
      }
    },
    "trait": "浮",
    "id": 4
  },
  {
    "name": "木下（忍者）",
    "cost": 650,
    "hp": 1050,
    "atk": 190,
    "range": 72,
    "spd": 1.15,
    "interval": 1.05,
    "recharge": 12,
    "icon": "🥷🏻",
    "motion": "ninja",
    "attackType": "single",
    "kb": 4,
    "trait": "黒",
    "ability": {
      "name": "高速再出撃",
      "desc": "再生時間が短め。攻撃時25%で敵を20%減速・1.5秒",
      "slow": {
        "trait": "*",
        "chance": 0.25,
        "factor": 0.8,
        "duration": 1.5
      }
    },
    "secondForm": {
      "name": "木下（忍者）・改",
      "hp": 13000,
      "atk": 3300,
      "range": 110,
      "spd": 2.2,
      "interval": 0.45,
      "recharge": 7,
      "kb": 7,
      "ability": {
        "name": "超高速・乱舞",
        "desc": "60%で追加攻撃、30%で後退。全属性からの被ダメージ0.6倍。",
        "extraAttackChance": 0.6,
        "knockbackChance": 0.3,
        "resist": {
          "*": 0.6
        }
      }
    },
    "id": 5
  },
  {
    "name": "木下（博士）",
    "cost": 1000,
    "hp": 1250,
    "atk": 240,
    "range": 132,
    "spd": 0.48,
    "interval": 1.9,
    "recharge": 22,
    "icon": "🧑🏻‍🔬",
    "motion": "scientist",
    "attackType": "area",
    "kb": 3,
    "ability": {
      "name": "範囲攻撃＋赤妨害",
      "desc": "攻撃対象の周囲にも60%ダメージ。赤には35%で40%減速・3秒",
      "splash": 0.6,
      "slow": {
        "trait": "赤",
        "chance": 0.35,
        "factor": 0.6,
        "duration": 3
      }
    },
    "secondForm": {
      "name": "木下（博士）・改",
      "hp": 16000,
      "atk": 4200,
      "range": 260,
      "spd": 0.7,
      "interval": 1.1,
      "recharge": 15,
      "kb": 5,
      "ability": {
        "name": "超広域・完全解析",
        "desc": "周囲へ70%追加範囲攻撃。全敵を65%減速・3秒。35%で50%攻撃力低下・3秒、35%でLv3波動。",
        "splash": 0.7,
        "slow": {
          "trait": "*",
          "chance": 0.65,
          "factor": 0.35,
          "duration": 3,
          "all": true
        },
        "attackDownChance": 0.35,
        "attackDownFactor": 0.5,
        "attackDownDuration": 3,
        "wave": true,
        "waveLevel": 3,
        "waveChance": 0.35
      }
    },
    "trait": "青",
    "id": 6
  },
  {
    "name": "木下（ロボ）",
    "cost": 1400,
    "hp": 2500,
    "atk": 360,
    "range": 82,
    "spd": 0.4,
    "interval": 1.8,
    "recharge": 26,
    "icon": "🤖",
    "motion": "robot",
    "attackType": "area",
    "kb": 2,
    "trait": "鋼",
    "ability": {
      "name": "装甲",
      "desc": "全属性からの被ダメージ0.75倍",
      "resist": {
        "*": 0.75
      }
    },
    "secondForm": {
      "name": "木下（ロボ）・改",
      "hp": 35000,
      "atk": 6000,
      "range": 130,
      "spd": 0.65,
      "interval": 1.1,
      "recharge": 20,
      "kb": 4,
      "ability": {
        "name": "超装甲・完全防衛",
        "desc": "全属性からの被ダメージ0.45倍。さらに被ダメージ35%軽減、波動無効・停止無効。",
        "resist": {
          "*": 0.45
        },
        "damageReduce": {
          "chance": 1,
          "factor": 0.65
        },
        "waveImmunity": true,
        "stopImmune": true
      }
    },
    "id": 7
  },
  {
    "name": "木下（王）",
    "cost": 2000,
    "hp": 3400,
    "atk": 480,
    "range": 118,
    "spd": 0.5,
    "interval": 1.65,
    "recharge": 32,
    "icon": "🤴🏻",
    "motion": "king",
    "attackType": "area",
    "kb": 3,
    "trait": "光",
    "ability": {
      "name": "王の威圧",
      "desc": "攻撃時35%で全敵を20%減速・2秒",
      "slow": {
        "trait": "*",
        "chance": 0.35,
        "factor": 0.8,
        "duration": 2,
        "all": true
      }
    },
    "secondForm": {
      "name": "木下（王）・改",
      "hp": 45000,
      "atk": 9000,
      "range": 220,
      "spd": 0.75,
      "interval": 1,
      "recharge": 25,
      "kb": 6,
      "ability": {
        "name": "王・絶対支配",
        "desc": "全敵を60%減速・3秒。40%で後退、40%で50%攻撃力低下・3秒。",
        "slow": {
          "trait": "*",
          "chance": 0.6,
          "factor": 0.4,
          "duration": 3,
          "all": true
        },
        "knockbackChance": 0.4,
        "attackDownChance": 0.4,
        "attackDownFactor": 0.5,
        "attackDownDuration": 3
      }
    },
    "id": 8
  },
  {
    "name": "木下（超覚醒）",
    "cost": 3000,
    "hp": 5200,
    "atk": 720,
    "range": 145,
    "spd": 0.62,
    "interval": 1.45,
    "recharge": 40,
    "icon": "🦸🏻‍♂️",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "ability": {
      "name": "超覚醒",
      "desc": "赤に超ダメージ＋攻撃時40%で赤を50%減速・3秒",
      "strong": {
        "赤": 2
      },
      "slow": {
        "trait": "赤",
        "chance": 0.4,
        "factor": 0.5,
        "duration": 3
      }
    },
    "secondForm": {
      "name": "木下（超覚醒）・改",
      "hp": 65000,
      "atk": 15000,
      "range": 280,
      "spd": 0.85,
      "interval": 0.85,
      "recharge": 32,
      "kb": 7,
      "ability": {
        "name": "超覚醒・極",
        "desc": "赤属性に5倍ダメージ。70%で50%減速・3秒、35%でLv4波動、25%で追加攻撃。被ダメージ25%軽減。",
        "strong": {
          "赤": 5
        },
        "slow": {
          "trait": "赤",
          "chance": 0.7,
          "factor": 0.5,
          "duration": 3
        },
        "wave": true,
        "waveLevel": 4,
        "waveChance": 0.35,
        "extraAttackChance": 0.25,
        "damageReduce": {
          "chance": 1,
          "factor": 0.75
        }
      }
    },
    "trait": "赤",
    "id": 9
  },
  {
    "name": "森の守護木下",
    "cost": 300,
    "hp": 900,
    "atk": 115,
    "range": 58,
    "spd": 0.9,
    "interval": 1,
    "recharge": 8,
    "icon": "🌿",
    "motion": "basic",
    "attackType": "area",
    "kb": 3,
    "series": "森の守護者",
    "rarity": "R",
    "ability": {
      "name": "自然の加護",
      "desc": "無属性の敵への攻撃1.35倍",
      "strong": {
        "無": 1.35
      }
    },
    "secondForm": {
      "name": "森羅の守護木下",
      "icon": "🌳",
      "cost": 650,
      "hp": 18000,
      "atk": 2100,
      "range": 82,
      "spd": 0.95,
      "interval": 0.85,
      "recharge": 10,
      "kb": 5,
      "attackType": "area",
      "motion": "super",
      "ability": {
        "name": "森羅結界",
        "desc": "全属性からの被ダメージを軽減。無属性に2倍ダメージ。攻撃時35%で敵全体を鈍足にする。",
        "resist": {
          "*": 0.7
        },
        "strong": {
          "無": 2
        },
        "slow": {
          "trait": "*",
          "chance": 0.35,
          "factor": 0.7,
          "duration": 2,
          "all": true
        }
      }
    },
    "trait": "無",
    "id": 10
  },
  {
    "name": "森の杖木下",
    "cost": 500,
    "hp": 850,
    "atk": 175,
    "range": 105,
    "spd": 0.75,
    "interval": 1.25,
    "recharge": 12,
    "icon": "🌱",
    "motion": "baseball",
    "attackType": "single",
    "kb": 4,
    "series": "森の守護者",
    "rarity": "SR",
    "ability": {
      "name": "後方狙い",
      "desc": "無属性の敵への攻撃1.6倍",
      "strong": {
        "無": 1.6
      }
    },
    "secondForm": {
      "name": "森霊導師木下",
      "icon": "🪄",
      "cost": 900,
      "hp": 13500,
      "atk": 2800,
      "range": 220,
      "spd": 0.65,
      "interval": 1.2,
      "recharge": 14,
      "kb": 5,
      "attackType": "area",
      "motion": "super",
      "ability": {
        "name": "森霊の導き",
        "desc": "長射程の範囲攻撃。攻撃時45%で敵全体を鈍足にし、25%でLv2波動を放つ。",
        "strong": {
          "無": 2.2
        },
        "slow": {
          "trait": "*",
          "chance": 0.45,
          "factor": 0.5,
          "duration": 2.5,
          "all": true
        },
        "wave": true,
        "waveLevel": 2,
        "waveChance": 0.25
      }
    },
    "trait": "浮",
    "id": 11
  },
  {
    "name": "森王木下",
    "cost": 1100,
    "hp": 2600,
    "atk": 360,
    "range": 125,
    "spd": 0.52,
    "interval": 1.55,
    "recharge": 21,
    "icon": "🌳",
    "motion": "king",
    "attackType": "area",
    "kb": 4,
    "series": "森の守護者",
    "rarity": "SSR",
    "trait": "無",
    "ability": {
      "name": "森王の号令",
      "desc": "攻撃時35%で敵全体を25%減速・2.5秒",
      "slow": {
        "trait": "*",
        "chance": 0.35,
        "factor": 0.75,
        "duration": 2.5,
        "all": true
      }
    },
    "id": 12
  },
  {
    "name": "木下（電脳）",
    "cost": 350,
    "hp": 780,
    "atk": 135,
    "range": 95,
    "spd": 1,
    "interval": 0.9,
    "recharge": 9,
    "icon": "💻",
    "motion": "scientist",
    "attackType": "single",
    "kb": 5,
    "series": "電脳木下隊",
    "rarity": "R",
    "trait": "青",
    "ability": {
      "name": "解析",
      "desc": "攻撃時25%で敵の攻撃間隔を一時的に遅くする",
      "slow": {
        "trait": "*",
        "chance": 0.25,
        "factor": 0.85,
        "duration": 1.5
      }
    },
    "secondForm": {
      "name": "電脳支配木下",
      "icon": "💠",
      "cost": 700,
      "hp": 15000,
      "atk": 2800,
      "range": 155,
      "spd": 0.85,
      "interval": 0.75,
      "recharge": 11,
      "kb": 6,
      "attackType": "area",
      "motion": "super",
      "ability": {
        "name": "オーバークロック",
        "desc": "全属性からの被ダメージを軽減。35%でLv3波動、40%で攻撃力を低下させる。",
        "resist": {
          "*": 0.8
        },
        "wave": true,
        "waveLevel": 3,
        "waveChance": 0.35,
        "attackDownChance": 0.4,
        "attackDownFactor": 0.6,
        "attackDownDuration": 2.5
      }
    },
    "id": 13
  },
  {
    "name": "木下（ドローン）",
    "cost": 700,
    "hp": 1250,
    "atk": 245,
    "range": 145,
    "spd": 0.58,
    "interval": 1.5,
    "recharge": 15,
    "icon": "🛸",
    "motion": "scientist",
    "attackType": "area",
    "kb": 3,
    "series": "電脳木下隊",
    "rarity": "SR",
    "ability": {
      "name": "空中観測",
      "desc": "浮属性の敵に攻撃1.8倍",
      "strong": {
        "浮": 1.8
      }
    },
    "secondForm": {
      "name": "無人機母艦木下",
      "icon": "🚁",
      "cost": 1100,
      "hp": 14500,
      "atk": 3400,
      "range": 210,
      "spd": 0.8,
      "interval": 1.1,
      "recharge": 15,
      "kb": 5,
      "attackType": "area",
      "motion": "super",
      "airAttack": true,
      "ability": {
        "name": "航空管制網",
        "desc": "浮属性に3倍ダメージ。攻撃時30%でLv2波動を発生させ、敵全体を鈍足にする。",
        "strong": {
          "浮": 3
        },
        "wave": true,
        "waveLevel": 2,
        "waveChance": 0.3,
        "slow": {
          "trait": "*",
          "chance": 0.3,
          "factor": 0.65,
          "duration": 2,
          "all": true
        }
      }
    },
    "trait": "浮",
    "id": 14
  },
  {
    "name": "木下（AI）",
    "cost": 1500,
    "hp": 3100,
    "atk": 470,
    "range": 155,
    "spd": 0.45,
    "interval": 1.45,
    "recharge": 25,
    "icon": "🧠",
    "motion": "robot",
    "attackType": "area",
    "kb": 4,
    "series": "電脳木下隊",
    "rarity": "SSR",
    "trait": "鋼",
    "ability": {
      "name": "戦術演算",
      "desc": "全属性からの被ダメージ0.8倍＋攻撃時30%で20%減速・2秒",
      "resist": {
        "*": 0.8
      },
      "slow": {
        "trait": "*",
        "chance": 0.3,
        "factor": 0.8,
        "duration": 2
      }
    },
    "id": 15
  },
  {
    "name": "星読み木下",
    "cost": 400,
    "hp": 700,
    "atk": 150,
    "range": 90,
    "spd": 1.05,
    "interval": 0.95,
    "recharge": 9,
    "icon": "🔭",
    "motion": "ninja",
    "attackType": "single",
    "kb": 5,
    "series": "星空の木下団",
    "rarity": "R",
    "ability": {
      "name": "星読み",
      "desc": "赤属性の敵への攻撃1.4倍",
      "strong": {
        "赤": 1.4
      }
    },
    "secondForm": {
      "name": "星詠み賢者木下",
      "icon": "🌌",
      "cost": 750,
      "hp": 11500,
      "atk": 2600,
      "range": 175,
      "spd": 1,
      "interval": 0.8,
      "recharge": 10,
      "kb": 6,
      "attackType": "single",
      "motion": "super",
      "ability": {
        "name": "星辰予測",
        "desc": "赤属性に2.5倍ダメージ。攻撃時35%で敵を後退させ、25%でLv2波動を放つ。",
        "strong": {
          "赤": 2.5
        },
        "knockbackChance": 0.35,
        "wave": true,
        "waveLevel": 2,
        "waveChance": 0.25
      }
    },
    "trait": "光",
    "id": 16
  },
  {
    "name": "流星木下",
    "cost": 850,
    "hp": 1500,
    "atk": 300,
    "range": 135,
    "spd": 0.7,
    "interval": 1.35,
    "recharge": 17,
    "icon": "☄️",
    "motion": "awakened",
    "attackType": "area",
    "kb": 3,
    "series": "星空の木下団",
    "rarity": "SR",
    "ability": {
      "name": "流星落とし",
      "desc": "攻撃時40%で敵を後退させる強力な一撃",
      "knockbackChance": 0.4
    },
    "secondForm": {
      "name": "超新星木下",
      "icon": "☄️",
      "cost": 1300,
      "hp": 20000,
      "atk": 4200,
      "range": 165,
      "spd": 0.85,
      "interval": 1.05,
      "recharge": 16,
      "kb": 4,
      "attackType": "area",
      "motion": "super",
      "ability": {
        "name": "超新星爆発",
        "desc": "赤属性に2.2倍ダメージ。35%でLv3波動を放ち、30%で敵を後退させる。",
        "strong": {
          "赤": 2.2
        },
        "wave": true,
        "waveLevel": 3,
        "waveChance": 0.35,
        "knockbackChance": 0.3,
        "resist": {
          "*": 0.85
        }
      }
    },
    "trait": "浮",
    "id": 17
  },
  {
    "name": "星王木下",
    "cost": 1900,
    "hp": 3900,
    "atk": 620,
    "range": 175,
    "spd": 0.48,
    "interval": 1.6,
    "recharge": 30,
    "icon": "🌟",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "series": "星空の木下団",
    "rarity": "SSR",
    "ability": {
      "name": "星王の輝き",
      "desc": "赤属性に2倍の攻撃＋攻撃時35%で50%減速・3秒",
      "strong": {
        "赤": 2
      },
      "slow": {
        "trait": "赤",
        "chance": 0.35,
        "factor": 0.5,
        "duration": 3
      }
    },
    "trait": "光",
    "id": 18
  },
  {
    "name": "狂乱の木下",
    "cost": 2400,
    "hp": 4600,
    "atk": 760,
    "range": 128,
    "spd": 0.72,
    "interval": 1.25,
    "recharge": 36,
    "icon": "😡",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "series": "狂乱の木下",
    "rarity": "SSR",
    "specialReward": true,
    "ability": {
      "name": "狂乱の猛攻",
      "desc": "攻撃力が高く、攻撃時30%で敵を後退させる",
      "knockbackChance": 0.3
    },
    "trait": "黒",
    "id": 19
  },
  {
    "name": "突撃ハーランド木下",
    "cost": 777,
    "hp": 1200,
    "atk": 400,
    "range": 45,
    "spd": 1.2,
    "interval": 0.7,
    "recharge": 25,
    "icon": "🏃",
    "motion": "power",
    "attackType": "area",
    "kb": 2,
    "series": "日本編 第1章クリア報酬",
    "rarity": "SR",
    "specialReward": true,
    "chapterReward": 1,
    "ability": {
      "name": "突撃ハーランド",
      "desc": "高速で前線へ進み、範囲攻撃を行う"
    },
    "secondForm": {
      "name": "突撃ハーランド木下・極",
      "icon": "⚡",
      "cost": 777,
      "hp": 30000,
      "atk": 7000,
      "range": 120,
      "spd": 0.8,
      "interval": 0.9,
      "recharge": 36,
      "kb": 4,
      "attackType": "area",
      "motion": "power",
      "trait": "無",
      "ability": {
        "name": "極・突撃覇王",
        "desc": "全属性に超ダメージ。攻撃時100%でLv4波動・Lv3烈波・3秒停止・4秒鈍足・4秒攻撃力90%低下・4秒呪い・能力封印3秒・確定ノックバック。全属性からの被ダメージを40%軽減し、停止・鈍足・呪い・攻撃力低下・能力封印・波動・烈波・ワープを無効化。",
        "strong": {
          "*": 2.5
        },
        "resist": {
          "*": 0.6
        },
        "wave": true,
        "waveLevel": 4,
        "waveChance": 1,
        "stopChance": 1,
        "stopDuration": 3,
        "slowChance": 1,
        "slowFactor": 0.25,
        "slowDuration": 4,
        "attackDownChance": 1,
        "attackDownFactor": 0.1,
        "attackDownDuration": 4,
        "curseChance": 1,
        "curseDuration": 4,
        "sealChance": 1,
        "sealDuration": 3,
        "knockbackChance": 1,
        "curseImmune": true,
        "stopImmune": true,
        "slowImmune": true,
        "attackDownImmune": true,
        "sealImmune": true,
        "waveImmune": true,
        "surgeImmune": true,
        "warpImmune": true,
        "phoenixSurgeLevel": 3,
        "phoenixSurgeMin": 1,
        "phoenixSurgeMax": 175
      }
    },
    "trait": "無",
    "id": 20
  },
  {
    "name": "異常木下",
    "cost": 3000,
    "hp": 15000,
    "atk": 3000,
    "range": 200,
    "spd": 0.3,
    "interval": 0.5,
    "recharge": 45,
    "icon": "👁️",
    "motion": "super",
    "attackType": "single",
    "kb": 5,
    "series": "日本編 第2章クリア報酬",
    "rarity": "SSR",
    "specialReward": true,
    "chapterReward": 2,
    "ability": {
      "name": "異常な力",
      "desc": "高HP・高火力・超長射程の単体攻撃"
    },
    "secondForm": {
      "name": "異常木下・終焉形態",
      "icon": "👁️‍🗨️",
      "cost": 3000,
      "hp": 52000,
      "atk": 9000,
      "range": 240,
      "spd": 0.7,
      "interval": 0.8,
      "recharge": 55,
      "kb": 6,
      "attackType": "area",
      "motion": "super",
      "trait": "無",
      "airAttack": true,
      "ability": {
        "name": "終焉を見渡す異常存在",
        "desc": "空中攻撃可能。古代・浮いている敵・宇宙属性に3.5倍ダメージ。対象属性からの被ダメージを45%軽減。攻撃時100%でLv4波動とLv2烈波、50%で2秒停止。呪い・停止・鈍足・波動・烈波・ワープを無効化。",
        "strong": {
          "古代": 3.5,
          "浮": 3.5,
          "宇宙": 3.5
        },
        "resist": {
          "古代": 0.45,
          "浮": 0.45,
          "宇宙": 0.45
        },
        "wave": true,
        "waveLevel": 4,
        "waveChance": 1,
        "phoenixSurgeLevel": 2,
        "phoenixSurgeMin": 1,
        "phoenixSurgeMax": 200,
        "stopChance": 0.5,
        "stopDuration": 2,
        "curseImmune": true,
        "stopImmune": true,
        "slowImmune": true,
        "waveImmune": true,
        "surgeImmune": true,
        "warpImmune": true,
        "airAttack": true
      }
    },
    "trait": "赤",
    "id": 21
  },
  {
    "name": "吉田",
    "cost": 200,
    "hp": 3000,
    "atk": 500,
    "range": 90,
    "spd": 1,
    "interval": 1,
    "recharge": 8,
    "icon": "🧑",
    "motion": "basic",
    "attackType": "area",
    "kb": 2,
    "series": "日本編 第3章クリア報酬",
    "rarity": "SR",
    "specialReward": true,
    "chapterReward": 3,
    "ability": {
      "name": "吉田の一撃",
      "desc": "短い再出撃時間で範囲攻撃を行う"
    },
    "secondForm": {
      "name": "覚醒吉田",
      "icon": "🔥",
      "cost": 200,
      "hp": 37000,
      "atk": 9300,
      "range": 105,
      "spd": 1.5,
      "interval": 0.7,
      "recharge": 9,
      "kb": 1,
      "attackType": "area",
      "motion": "super",
      "trait": "赤",
      "ability": {
        "name": "覚醒・対災厄能力",
        "desc": "烈波・波動・呪い・停止無効。ゾンビに4倍ダメージを与え、ゾンビキラーで蘇生を阻止する。",
        "strong": {
          "ゾンビ": 4
        },
        "surgeImmune": true,
        "waveImmune": true,
        "curseImmune": true,
        "stopImmune": true,
        "zombieKiller": true
      }
    },
    "trait": "赤",
    "id": 22
  },
  {
    "name": "対無木下",
    "cost": 500,
    "hp": 1000,
    "atk": 180,
    "range": 70,
    "spd": 0.9,
    "interval": 1,
    "recharge": 8,
    "icon": "🛡️",
    "motion": "basic",
    "attackType": "single",
    "kb": 3,
    "series": "攻略特化隊",
    "rarity": "R",
    "gachaCost": 2000,
    "ability": {
      "name": "無属性特効",
      "desc": "無属性に攻撃1.8倍・被ダメージ0.6倍",
      "strong": {
        "無": 1.8
      },
      "resist": {
        "無": 0.6
      }
    },
    "trait": "無",
    "id": 23
  },
  {
    "name": "赤狩り木下",
    "cost": 550,
    "hp": 1200,
    "atk": 210,
    "range": 75,
    "spd": 0.82,
    "interval": 1,
    "recharge": 9,
    "icon": "🔥",
    "motion": "power",
    "attackType": "single",
    "kb": 3,
    "series": "攻略特化隊",
    "rarity": "R",
    "gachaCost": 2000,
    "ability": {
      "name": "赤属性特効",
      "desc": "赤属性に攻撃2倍・被ダメージ0.5倍",
      "strong": {
        "赤": 2
      },
      "resist": {
        "赤": 0.5
      }
    },
    "trait": "赤",
    "id": 24
  },
  {
    "name": "黒追撃木下",
    "cost": 600,
    "hp": 900,
    "atk": 260,
    "range": 80,
    "spd": 1.15,
    "interval": 0.85,
    "recharge": 9,
    "icon": "🌑",
    "motion": "ninja",
    "attackType": "single",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "R",
    "gachaCost": 2000,
    "ability": {
      "name": "黒追撃",
      "desc": "黒属性に攻撃2倍＋攻撃時40%で40%減速・2秒",
      "strong": {
        "黒": 2
      },
      "slow": {
        "trait": "黒",
        "chance": 0.4,
        "factor": 0.6,
        "duration": 2
      }
    },
    "trait": "黒",
    "id": 25
  },
  {
    "name": "天使迎撃木下",
    "cost": 650,
    "hp": 1250,
    "atk": 240,
    "range": 85,
    "spd": 0.9,
    "interval": 1,
    "recharge": 10,
    "icon": "👼",
    "motion": "awakened",
    "attackType": "area",
    "kb": 5,
    "series": "攻略特化隊",
    "rarity": "R",
    "gachaCost": 2000,
    "ability": {
      "name": "天使迎撃",
      "desc": "天使に攻撃2倍・被ダメージ0.55倍",
      "strong": {
        "天使": 2
      },
      "resist": {
        "天使": 0.55
      }
    },
    "trait": "天使",
    "id": 26
  },
  {
    "name": "宇宙観測木下",
    "cost": 700,
    "hp": 1100,
    "atk": 250,
    "range": 130,
    "spd": 0.75,
    "interval": 1.15,
    "recharge": 11,
    "icon": "🔭",
    "motion": "scientist",
    "attackType": "single",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "R",
    "gachaCost": 2000,
    "ability": {
      "name": "宇宙観測",
      "desc": "宇宙属性に攻撃2倍",
      "strong": {
        "宇宙": 2
      }
    },
    "trait": "宇宙",
    "id": 27
  },
  {
    "name": "宇宙突破木下",
    "cost": 850,
    "hp": 1500,
    "atk": 330,
    "range": 125,
    "spd": 0.65,
    "interval": 1.15,
    "recharge": 13,
    "icon": "🚀",
    "motion": "power",
    "attackType": "single",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "バリアブレイク",
      "desc": "宇宙属性に強く、バリアを破壊できる",
      "strong": {
        "宇宙": 2
      },
      "barrierBreak": true
    },
    "trait": "宇宙",
    "id": 28
  },
  {
    "name": "赤壁木下",
    "cost": 900,
    "hp": 3000,
    "atk": 190,
    "range": 60,
    "spd": 0.5,
    "interval": 1.2,
    "recharge": 14,
    "icon": "🧱",
    "motion": "muscle",
    "attackType": "area",
    "kb": 2,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "赤の壁",
      "desc": "赤属性からの被ダメージ0.4倍",
      "resist": {
        "赤": 0.4
      }
    },
    "trait": "赤",
    "id": 29
  },
  {
    "name": "無敵壁木下",
    "cost": 950,
    "hp": 3600,
    "atk": 170,
    "range": 55,
    "spd": 0.45,
    "interval": 1.25,
    "recharge": 15,
    "icon": "🛡️",
    "motion": "robot",
    "attackType": "area",
    "kb": 2,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "無の要塞",
      "desc": "無属性からの被ダメージ0.35倍",
      "resist": {
        "無": 0.35
      }
    },
    "trait": "無",
    "id": 30
  },
  {
    "name": "黒速攻木下",
    "cost": 800,
    "hp": 1300,
    "atk": 360,
    "range": 75,
    "spd": 1.3,
    "interval": 0.8,
    "recharge": 11,
    "icon": "⚡",
    "motion": "ninja",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "黒速攻",
      "desc": "黒属性に攻撃2.4倍",
      "strong": {
        "黒": 2.4
      }
    },
    "trait": "黒",
    "id": 31
  },
  {
    "name": "天使封殺木下",
    "cost": 1000,
    "hp": 1700,
    "atk": 320,
    "range": 105,
    "spd": 0.65,
    "interval": 1.05,
    "recharge": 14,
    "icon": "✨",
    "motion": "awakened",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "天使封殺",
      "desc": "天使に攻撃2.2倍＋50%で50%減速・3秒",
      "strong": {
        "天使": 2.2
      },
      "slow": {
        "trait": "天使",
        "chance": 0.5,
        "factor": 0.5,
        "duration": 3
      }
    },
    "trait": "天使",
    "id": 32
  },
  {
    "name": "宇宙砕き木下",
    "cost": 1100,
    "hp": 1900,
    "atk": 390,
    "range": 120,
    "spd": 0.58,
    "interval": 1.1,
    "recharge": 15,
    "icon": "💥",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "宇宙砕き",
      "desc": "宇宙属性に攻撃2.5倍＋バリアブレイク",
      "strong": {
        "宇宙": 2.5
      },
      "barrierBreak": true
    },
    "trait": "宇宙",
    "id": 33
  },
  {
    "name": "未来探査木下",
    "cost": 1200,
    "hp": 1800,
    "atk": 360,
    "range": 180,
    "spd": 0.5,
    "interval": 1.25,
    "recharge": 16,
    "icon": "🛰️",
    "motion": "scientist",
    "attackType": "single",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "未来探査",
      "desc": "宇宙属性に攻撃2倍・長射程",
      "strong": {
        "宇宙": 2
      }
    },
    "trait": "宇宙",
    "id": 34
  },
  {
    "name": "攻略隊長木下",
    "cost": 1300,
    "hp": 2400,
    "atk": 430,
    "range": 115,
    "spd": 0.55,
    "interval": 1.1,
    "recharge": 17,
    "icon": "🎖️",
    "motion": "king",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "四属性対策",
      "desc": "赤・黒・天使・宇宙に攻撃1.7倍",
      "strong": {
        "赤": 1.7,
        "黒": 1.7,
        "天使": 1.7,
        "宇宙": 1.7
      }
    },
    "trait": "宇宙",
    "id": 35
  },
  {
    "name": "日本防衛木下",
    "cost": 1400,
    "hp": 4000,
    "atk": 400,
    "range": 95,
    "spd": 0.45,
    "interval": 1.25,
    "recharge": 18,
    "icon": "🇯🇵",
    "motion": "robot",
    "attackType": "area",
    "kb": 3,
    "series": "攻略特化隊",
    "rarity": "SR",
    "gachaCost": 4000,
    "ability": {
      "name": "日本防衛",
      "desc": "無・赤属性に攻撃1.8倍、被ダメージ0.5倍",
      "strong": {
        "無": 1.8,
        "赤": 1.8
      },
      "resist": {
        "無": 0.5,
        "赤": 0.5
      }
    },
    "trait": "無",
    "id": 36
  },
  {
    "name": "日本制圧木下",
    "cost": 1800,
    "hp": 5000,
    "atk": 650,
    "range": 125,
    "spd": 0.5,
    "interval": 1.1,
    "recharge": 24,
    "icon": "🏯",
    "motion": "king",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "日本制圧",
      "desc": "無・赤・黒に攻撃2.2倍、被ダメージ0.55倍",
      "strong": {
        "無": 2.2,
        "赤": 2.2,
        "黒": 2.2
      },
      "resist": {
        "無": 0.55,
        "赤": 0.55,
        "黒": 0.55
      }
    },
    "trait": "無",
    "id": 37
  },
  {
    "name": "未来制圧木下",
    "cost": 2100,
    "hp": 5200,
    "atk": 720,
    "range": 145,
    "spd": 0.5,
    "interval": 1.15,
    "recharge": 26,
    "icon": "🌌",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "未来制圧",
      "desc": "天使・宇宙に攻撃2.3倍＋バリアブレイク",
      "strong": {
        "天使": 2.3,
        "宇宙": 2.3
      },
      "barrierBreak": true
    },
    "trait": "宇宙",
    "id": 38
  },
  {
    "name": "四属性討伐木下",
    "cost": 2300,
    "hp": 4800,
    "atk": 700,
    "range": 135,
    "spd": 0.55,
    "interval": 1,
    "recharge": 27,
    "icon": "⚔️",
    "motion": "awakened",
    "attackType": "area",
    "kb": 5,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "四属性討伐",
      "desc": "赤・黒・天使・宇宙に攻撃2.1倍＋50%で50%減速・3秒",
      "strong": {
        "赤": 2.1,
        "黒": 2.1,
        "天使": 2.1,
        "宇宙": 2.1
      },
      "slow": {
        "trait": "*",
        "chance": 0.5,
        "factor": 0.5,
        "duration": 3
      }
    },
    "trait": "赤",
    "id": 39
  },
  {
    "name": "銀河攻略木下",
    "cost": 2500,
    "hp": 5500,
    "atk": 800,
    "range": 190,
    "spd": 0.48,
    "interval": 1.2,
    "recharge": 30,
    "icon": "🌠",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "銀河攻略",
      "desc": "宇宙属性に攻撃3倍＋バリアブレイク",
      "strong": {
        "宇宙": 3
      },
      "barrierBreak": true
    },
    "trait": "宇宙",
    "id": 40
  },
  {
    "name": "最終攻略木下",
    "cost": 3000,
    "hp": 7000,
    "atk": 950,
    "range": 170,
    "spd": 0.45,
    "interval": 1.05,
    "recharge": 35,
    "icon": "👑",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "全属性攻略",
      "desc": "5属性に攻撃2倍・被ダメージ0.5倍＋バリアブレイク",
      "strong": {
        "無": 2,
        "赤": 2,
        "黒": 2,
        "天使": 2,
        "宇宙": 2
      },
      "resist": {
        "無": 0.5,
        "赤": 0.5,
        "黒": 0.5,
        "天使": 0.5,
        "宇宙": 0.5
      },
      "barrierBreak": true
    },
    "trait": "無",
    "id": 41
  },
  {
    "name": "宇宙決戦木下",
    "cost": 2800,
    "hp": 6200,
    "atk": 900,
    "range": 155,
    "spd": 0.5,
    "interval": 1,
    "recharge": 32,
    "icon": "🪐",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "series": "攻略特化隊",
    "rarity": "SSR",
    "gachaCost": 10000,
    "ability": {
      "name": "宇宙決戦",
      "desc": "宇宙属性に攻撃3倍＋バリアブレイク",
      "strong": {
        "宇宙": 3
      },
      "barrierBreak": true
    },
    "trait": "宇宙",
    "id": 42
  },
  {
    "name": "波動木下",
    "cost": 1800,
    "hp": 4200,
    "atk": 420,
    "range": 110,
    "spd": 0.48,
    "interval": 1.3,
    "recharge": 24,
    "icon": "〰️",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "series": "波動木下降臨クリア報酬",
    "rarity": "SSR",
    "specialReward": true,
    "eventReward": "波動木下降臨",
    "waveLevel": 3,
    "ability": {
      "name": "波動Lv3",
      "desc": "攻撃後に波動Lv3を放つ。波動のダメージは攻撃力と同じ。",
      "wave": true
    },
    "trait": "宇宙",
    "id": 43
  },
  {
    "name": "ファイティング木下",
    "cost": 450,
    "hp": 1800,
    "atk": 400,
    "secondAtk": 800,
    "thirdAtk": 200,
    "range": 90,
    "spd": 1,
    "interval": 0.85,
    "recharge": 24,
    "icon": "🥊",
    "motion": "power",
    "attackType": "single",
    "kb": 3,
    "trait": "赤",
    "rarity": "LR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "multiAttack": [
      400,
      800,
      200
    ],
    "waveLevel": 3,
    "waveChance": 0.33,
    "waveStopChance": 0.33,
    "waveStopDuration": 0.5,
    "ability": {
      "name": "三連攻撃",
      "desc": "0.1秒間隔の三連撃。各攻撃で33%の確率で波動Lv3、33%の確率で0.5秒停止。波動にも停止判定。",
      "wave": true
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 44
  },
  {
    "name": "炎撃木下",
    "cost": 900,
    "hp": 3000,
    "atk": 900,
    "range": 100,
    "spd": 0.75,
    "interval": 1.4,
    "recharge": 20,
    "icon": "🔥",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "赤",
    "rarity": "SSR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "ability": {
      "name": "炎撃・灼熱",
      "desc": "赤属性に攻撃1.5倍。攻撃時40%の確率で敵を2秒間鈍足にする。",
      "strong": {
        "赤": 1.5
      },
      "slowChance": 0.4,
      "slowDuration": 2
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 45
  },
  {
    "name": "水帝木下",
    "cost": 950,
    "hp": 3600,
    "atk": 720,
    "range": 125,
    "spd": 0.6,
    "interval": 1.3,
    "recharge": 22,
    "icon": "💧",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "trait": "青",
    "rarity": "SSR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "ability": {
      "name": "水帝・凍流",
      "desc": "攻撃時50%の確率で敵を1.5秒停止。射程が長く、遠距離から攻撃できる。",
      "stopChance": 0.5,
      "stopDuration": 1.5
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 46
  },
  {
    "name": "大地木下",
    "cost": 1000,
    "hp": 5200,
    "atk": 650,
    "range": 80,
    "spd": 0.45,
    "interval": 1.5,
    "recharge": 25,
    "icon": "🪨",
    "motion": "muscle",
    "attackType": "area",
    "kb": 5,
    "trait": "黒",
    "rarity": "SSR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "ability": {
      "name": "大地・鉄壁",
      "desc": "50%の確率で受けるダメージを半減。攻撃時、敵を確実にノックバックさせる。",
      "damageReduce": 0.5,
      "guaranteeKnockback": true
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 47
  },
  {
    "name": "疾風木下",
    "cost": 750,
    "hp": 2400,
    "atk": 560,
    "range": 75,
    "spd": 1.25,
    "interval": 0.75,
    "recharge": 16,
    "icon": "🌪️",
    "motion": "ninja",
    "attackType": "single",
    "kb": 4,
    "trait": "浮",
    "rarity": "SSR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "ability": {
      "name": "疾風・連撃",
      "desc": "攻撃間隔が短く、攻撃時30%の確率で追加攻撃。移動速度が高い。",
      "extraAttackChance": 0.3
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 48
  },
  {
    "name": "雷光木下",
    "cost": 1100,
    "hp": 3300,
    "atk": 1050,
    "range": 110,
    "spd": 0.7,
    "interval": 1.2,
    "recharge": 23,
    "icon": "⚡",
    "motion": "awakened",
    "attackType": "area",
    "kb": 3,
    "trait": "宇宙",
    "rarity": "SSR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "ability": {
      "name": "雷光・感電",
      "desc": "攻撃時40%の確率で敵を1秒停止。さらに20%の確率で波動Lv3を放つ。",
      "stopChance": 0.4,
      "stopDuration": 1,
      "waveChance": 0.2,
      "waveLevel": 3,
      "wave": true
    },
    "limitedExchangeSeries": "エレメンタル木下s",
    "id": 49
  },
  {
    "name": "木下&吉田",
    "cost": 800,
    "hp": 1700,
    "atk": 1200,
    "secondAtk": 550,
    "range": 60,
    "spd": 0.7,
    "interval": 0.8,
    "recharge": 22,
    "icon": "👨‍🤝‍👨",
    "motion": "power",
    "attackType": "area",
    "kb": 2,
    "trait": "宇宙",
    "rarity": "LR",
    "series": "ランク1位限定",
    "specialReward": true,
    "rankLimited": true,
    "firstStopChance": 0.5,
    "firstStopDuration": 1,
    "waveLevel": 5,
    "waveOnHit": 2,
    "ability": {
      "name": "二連撃・波動Lv5",
      "desc": "2連続攻撃。1段目が当たると50%で敵を1秒停止。2段目で波動Lv5を放つ。",
      "wave": true
    },
    "id": 50
  },
  {
    "name": "千年に一歩歩く木下",
    "cost": 1001,
    "hp": 1001,
    "atk": 6000,
    "range": 600,
    "minRange": 150,
    "detectionRange": 800,
    "spd": 0,
    "interval": 5,
    "recharge": 120,
    "icon": "🐦",
    "motion": "thousandStep",
    "attackType": "area",
    "kb": 1,
    "trait": "宇宙",
    "series": "千年に一歩",
    "rarity": "SSR",
    "gachaCost": 15000,
    "chargeTime": 3,
    "ability": {
      "name": "千年に一歩",
      "desc": "【専用能力】移動不可。感知射程800。150〜600の遠方範囲を攻撃し、150未満には攻撃不可。攻撃前に3秒間チャージする。チャージ中は専用モーションと攻撃範囲を表示。無・赤・黒に4倍ダメージ。",
      "strong": {
        "無": 4,
        "赤": 4,
        "黒": 4
      }
    },
    "id": 51
  },
  {
    "name": "ヤバすぎ木下",
    "cost": 1600,
    "hp": 6000,
    "atk": 350,
    "range": 35,
    "spd": 0.3,
    "interval": 1.5,
    "recharge": 30,
    "icon": "👽",
    "motion": "super",
    "attackType": "single",
    "kb": 4,
    "series": "ヤバすぎ木下降臨クリア報酬",
    "rarity": "SSR",
    "specialReward": true,
    "eventReward": "ヤバすぎ木下降臨",
    "trait": "宇宙",
    "stopImmune": true,
    "attackDownImmune": true,
    "ability": {
      "name": "ヤバヤバLv2・停止無効・攻撃力低下無効",
      "desc": "ヤバヤバLv2。停止と攻撃力低下を無効化する。",
      "yabayaba": 2
    },
    "id": 52
  },
  {
    "name": "呪木下",
    "cost": 1650,
    "hp": 3200,
    "atk": 620,
    "range": 120,
    "spd": 0.8,
    "interval": 0.8,
    "recharge": 20,
    "icon": "🪬",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "無",
    "rarity": "SSR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "呪い・封印",
      "desc": "100%の確率で4秒間呪い。呪われた敵は特殊能力を発動できない。30%の確率で2秒間、移動速度を50%にする。",
      "curseChance": 1,
      "curseDuration": 4,
      "curseSeal": true,
      "curseSlowChance": 0.3,
      "curseSlowFactor": 0.5,
      "curseSlowDuration": 2
    },
    "id": 53
  },
  {
    "name": "呪怨木下",
    "cost": 2100,
    "hp": 6800,
    "atk": 1250,
    "range": 100,
    "spd": 0.6,
    "interval": 1,
    "recharge": 22,
    "icon": "👹",
    "motion": "power",
    "attackType": "single",
    "kb": 3,
    "trait": "黒",
    "rarity": "SSR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "怨念・弱体",
      "desc": "40%の確率で4秒間、敵の攻撃力を50%にする。さらに60%の確率で4秒間呪う。自分は被ダメージ20%減少。",
      "curseChance": 0.6,
      "curseDuration": 4,
      "attackDownChance": 0.4,
      "attackDownFactor": 0.5,
      "attackDownDuration": 4,
      "damageReduce": 0.2
    },
    "id": 54
  },
  {
    "name": "呪詛木下",
    "cost": 2400,
    "hp": 2400,
    "atk": 850,
    "range": 180,
    "spd": 0.5,
    "interval": 1.1,
    "recharge": 24,
    "icon": "📜",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "trait": "天使",
    "rarity": "SSR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "呪詛・鈍化",
      "desc": "50%の確率で4秒間呪い。30%の確率で2秒間、移動速度を50%にする。呪われた敵への攻撃力は1.3倍。",
      "curseChance": 0.5,
      "curseDuration": 4,
      "curseSlowChance": 0.3,
      "curseSlowFactor": 0.5,
      "curseSlowDuration": 2,
      "cursedAttackMultiplier": 1.3
    },
    "id": 55
  },
  {
    "name": "呪影木下",
    "cost": 1900,
    "hp": 3600,
    "atk": 1600,
    "range": 110,
    "spd": 1,
    "interval": 0.9,
    "recharge": 21,
    "icon": "🌑",
    "motion": "ninja",
    "attackType": "single",
    "kb": 4,
    "trait": "浮",
    "rarity": "SSR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "呪影・追撃",
      "desc": "40%の確率で4秒間呪う。呪われた敵への攻撃力1.5倍。呪われた敵に20%の確率で1秒間鈍足。自分が呪われている間は攻撃力70%。",
      "curseChance": 0.4,
      "curseDuration": 4,
      "cursedAttackMultiplier": 1.5,
      "cursedSlowChance": 0.2,
      "cursedSlowFactor": 0.5,
      "cursedSlowDuration": 1,
      "selfCursedAttackFactor": 0.7
    },
    "id": 56
  },
  {
    "name": "呪王木下",
    "cost": 3900,
    "hp": 14000,
    "atk": 3800,
    "range": 160,
    "spd": 0.4,
    "interval": 1.2,
    "recharge": 27,
    "icon": "👑",
    "motion": "king",
    "attackType": "area",
    "kb": 2,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "呪王・重呪",
      "desc": "100%の確率で3秒間呪い。40%の確率で3秒間、敵の攻撃力を50%にする。30%の確率で3秒間、移動速度を50%にする。呪われた敵への攻撃力1.4倍。波動無効・烈波無効。",
      "curseChance": 1,
      "curseDuration": 3,
      "attackDownChance": 0.4,
      "attackDownFactor": 0.5,
      "attackDownDuration": 3,
      "curseSlowChance": 0.3,
      "curseSlowFactor": 0.5,
      "curseSlowDuration": 3,
      "cursedAttackMultiplier": 1.4,
      "waveImmunity": true,
      "surgeImmunity": true
    },
    "id": 57
  },
  {
    "name": "呪神木下",
    "cost": 4800,
    "hp": 24000,
    "atk": 6500,
    "range": 180,
    "spd": 0.7,
    "interval": 1,
    "recharge": 30,
    "icon": "☯️",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "無",
    "rarity": "LR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "ability": {
      "name": "呪神・大呪",
      "desc": "100%の確率で6秒間呪い。呪われた敵は攻撃力70%、移動速度60%、特殊能力発動不可。呪われた敵への攻撃力1.5倍。",
      "curseChance": 1,
      "curseDuration": 6,
      "curseSeal": true,
      "cursedAttackFactor": 0.7,
      "cursedSpeedFactor": 0.6,
      "cursedAttackMultiplier": 1.5
    },
    "id": 58
  },
  {
    "name": "パーフェクト木下",
    "cost": 1500,
    "hp": 7500,
    "atk": 5000,
    "range": 100,
    "spd": 0.9,
    "interval": 3.5,
    "recharge": 45,
    "icon": "🌟",
    "motion": "super",
    "attackType": "single",
    "kb": 2,
    "trait": "無",
    "rarity": "LR",
    "series": "パーフェクト木下降臨クリア報酬",
    "specialReward": true,
    "eventReward": "パーフェクト木下降臨",
    "ability": {
      "name": "完全対宇宙決戦",
      "desc": "呪い無効・波動無効。無/宇宙/赤に与えるダメージ3倍。",
      "strong": {
        "無": 3,
        "宇宙": 3,
        "赤": 3
      },
      "waveImmune": true,
      "curseImmune": true
    },
    "id": 59
  },
  {
    "name": "前衛木下",
    "cost": 75,
    "hp": 850,
    "atk": 72,
    "range": 45,
    "spd": 1.45,
    "interval": 0.9,
    "recharge": 3.8,
    "icon": "🪖",
    "motion": "basic",
    "attackType": "single",
    "kb": 3,
    "series": "ランク戦小型隊",
    "rarity": "R",
    "gachaCost": 1800,
    "ability": {
      "name": "前線維持",
      "desc": "低コスト・短い再出撃時間で前線を維持する"
    },
    "trait": "無",
    "id": 60
  },
  {
    "name": "突撃木下",
    "cost": 140,
    "hp": 620,
    "atk": 210,
    "range": 55,
    "spd": 2.05,
    "interval": 0.82,
    "recharge": 5.5,
    "icon": "🏃",
    "motion": "ninja",
    "attackType": "single",
    "kb": 4,
    "series": "ランク戦小型隊",
    "rarity": "R",
    "gachaCost": 2400,
    "ability": {
      "name": "高速突撃",
      "desc": "移動速度が高く、敵前線へ素早く接近する"
    },
    "trait": "無",
    "id": 61
  },
  {
    "name": "連撃木下",
    "cost": 260,
    "hp": 980,
    "atk": 125,
    "secondAtk": 125,
    "range": 62,
    "spd": 1.35,
    "interval": 0.72,
    "recharge": 7.5,
    "icon": "🥋",
    "motion": "power",
    "attackType": "single",
    "kb": 4,
    "series": "ランク戦小型隊",
    "rarity": "SR",
    "gachaCost": 4500,
    "multiAttack": [
      125,
      125
    ],
    "ability": {
      "name": "二連撃",
      "desc": "短い間隔で2回攻撃する"
    },
    "trait": "無",
    "id": 62
  },
  {
    "name": "機甲前線木下",
    "cost": 600,
    "hp": 12000,
    "atk": 800,
    "range": 90,
    "spd": 0.62,
    "interval": 1,
    "recharge": 18,
    "icon": "🦾",
    "motion": "robot",
    "attackType": "area",
    "kb": 5,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "ability": {
      "name": "古代掃討システム・機甲装甲",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。波動無効。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "waveImmunity": true,
      "curseImmune": true
    },
    "id": 63
  },
  {
    "name": "電磁砲木下",
    "cost": 1800,
    "hp": 6500,
    "atk": 2800,
    "range": 260,
    "spd": 0.42,
    "interval": 2.1,
    "recharge": 24,
    "icon": "⚡",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "waveLevel": 6,
    "ability": {
      "name": "古代掃討システム・電磁殲滅",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。攻撃後に波動Lv6。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "wave": true,
      "curseImmune": true
    },
    "id": 64
  },
  {
    "name": "高速機動木下",
    "cost": 1300,
    "hp": 5000,
    "atk": 1800,
    "range": 120,
    "spd": 1.8,
    "interval": 0.75,
    "recharge": 15,
    "icon": "🏎️",
    "motion": "ninja",
    "attackType": "single",
    "kb": 6,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "ability": {
      "name": "古代掃討システム・高速機動",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。高速再出撃。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "extraAttackChance": 0.35,
      "curseImmune": true
    },
    "id": 65
  },
  {
    "name": "古代掃討砲木下",
    "cost": 2400,
    "hp": 9000,
    "atk": 4200,
    "range": 300,
    "spd": 0.35,
    "interval": 2.4,
    "recharge": 29,
    "icon": "🎯",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "waveLevel": 8,
    "ability": {
      "name": "古代掃討システム・長距離殲滅",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。攻撃後に波動Lv8。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "wave": true,
      "curseImmune": true
    },
    "id": 66
  },
  {
    "name": "超装甲木下",
    "cost": 3500,
    "hp": 30000,
    "atk": 3200,
    "range": 150,
    "spd": 0.3,
    "interval": 1.8,
    "recharge": 36,
    "icon": "🛡️",
    "motion": "robot",
    "attackType": "area",
    "kb": 3,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "ability": {
      "name": "古代掃討システム・超装甲",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。被ダメージをさらに30%軽減。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "damageReduce": {
        "chance": 1,
        "factor": 0.7
      },
      "waveImmunity": true,
      "stopImmune": true,
      "curseImmune": true
    },
    "id": 67
  },
  {
    "name": "機神木下",
    "cost": 5000,
    "hp": 55000,
    "atk": 9000,
    "range": 360,
    "spd": 0.28,
    "interval": 2.2,
    "recharge": 45,
    "icon": "🤖",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "trait": "鋼",
    "rarity": "LR",
    "series": "機械防衛隊！木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "機械防衛隊！木下s",
    "curseImmune": true,
    "waveLevel": 10,
    "ability": {
      "name": "古代掃討システム・機神",
      "desc": "古代に6倍ダメージ・古代からの被ダメージ0.15倍。古代以外への攻撃0.35倍・古代以外からの被ダメージ2.5倍。波動Lv10、停止・攻撃力低下・烈波無効。",
      "ancientHunter": 6,
      "ancientHunterResist": 0.15,
      "attributeOverload": {
        "outgoing": 0.35,
        "incoming": 2.5
      },
      "wave": true,
      "stopImmune": true,
      "attackDownImmune": true,
      "surgeImmunity": true
    },
    "id": 68
  },
  {
    "name": "哲学の賢者ゾクラテス",
    "cost": 2300,
    "hp": 19500,
    "atk": 3200,
    "secondAtk": 2000,
    "thirdAtk": 1750,
    "range": 600,
    "spd": 0.9,
    "interval": 4,
    "recharge": 30,
    "icon": "🏛️",
    "motion": "super",
    "attackType": "area",
    "kb": 8,
    "trait": "天使",
    "rarity": "LR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "multiAttack": [
      3200,
      2000,
      1750
    ],
    "waveLevel": 2,
    "wave": true,
    "waveReflect": true,
    "curseImmune": true,
    "stopImmune": true,
    "surgeImmunity": true,
    "strong": {
      "黒": 4,
      "宇宙": 4,
      "無": 4
    },
    "damageReduce": {
      "chance": 1,
      "factor": 0.35
    },
    "ability": {
      "name": "哲学・三距離問答",
      "desc": "射程1〜100は3200＋波動Lv2、101〜250は2000＋烈波Lv2、251〜600は1750＋黒・宇宙・無属性への射程低下・呪いを行う。波動反射・呪い無効・停止無効・烈波無効、黒・宇宙・無属性に4倍、被ダメージ0.35倍。",
      "rangeBands": [
        {
          "max": 100,
          "damage": 3200,
          "waveLevel": 2
        },
        {
          "min": 101,
          "max": 250,
          "damage": 2000,
          "surgeLevel": 2
        },
        {
          "min": 251,
          "max": 600,
          "damage": 1750,
          "rangeDownFactor": 0.2,
          "rangeDownDuration": 5,
          "curseChance": 1,
          "curseDuration": 5
        }
      ],
      "waveReflect": true,
      "curseImmune": true,
      "stopImmune": true,
      "surgeImmunity": true
    },
    "id": 69
  },
  {
    "name": "発明の賢者アルキメデェス",
    "cost": 1800,
    "hp": 6200,
    "atk": 2600,
    "range": 190,
    "spd": 0.55,
    "interval": 1.7,
    "recharge": 25,
    "icon": "⚙️",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "trait": "鋼",
    "rarity": "SSR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "ability": {
      "name": "発明・浮力機構",
      "desc": "バリアブレイク・波動無効・被ダメージ30%軽減。攻撃時35%で1秒停止、20%で追加攻撃。",
      "barrierBreak": true,
      "waveImmunity": true,
      "damageReduce": {
        "chance": 1,
        "factor": 0.7
      },
      "stopChance": 0.35,
      "stopDuration": 1,
      "extraAttackChance": 0.2
    },
    "id": 70
  },
  {
    "name": "星空の賢者ガリレオ・ガリレェン",
    "cost": 2100,
    "hp": 4800,
    "atk": 1700,
    "range": 420,
    "spd": 0.42,
    "interval": 2.2,
    "recharge": 27,
    "icon": "🔭",
    "motion": "scientist",
    "attackType": "area",
    "kb": 5,
    "trait": "宇宙",
    "rarity": "SSR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "ability": {
      "name": "星空・観測眼",
      "desc": "長射程。60%で2秒鈍足、30%で波動Lv3、宇宙に3倍ダメージ。",
      "slowChance": 0.6,
      "slowDuration": 2,
      "wave": true,
      "waveLevel": 3,
      "waveChance": 0.3,
      "strong": {
        "宇宙": 3
      }
    },
    "id": 71
  },
  {
    "name": "重力の賢者ニュトーン",
    "cost": 1500,
    "hp": 4200,
    "atk": 1500,
    "range": 170,
    "spd": 0.72,
    "interval": 1.1,
    "recharge": 21,
    "icon": "🍎",
    "motion": "power",
    "attackType": "area",
    "kb": 4,
    "trait": "無",
    "rarity": "SSR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "ability": {
      "name": "重力・落下法則",
      "desc": "50%で1.5秒停止、30%で吹っ飛ばし、被ダメージ20%軽減。",
      "stopChance": 0.5,
      "stopDuration": 1.5,
      "knockbackChance": 0.3,
      "damageReduce": {
        "chance": 1,
        "factor": 0.8
      }
    },
    "id": 72
  },
  {
    "name": "芸術の賢者レオナルド・ダ・ピンチ",
    "cost": 2000,
    "hp": 7500,
    "atk": 2100,
    "range": 150,
    "spd": 0.5,
    "interval": 1.6,
    "recharge": 26,
    "icon": "🎨",
    "motion": "muscle",
    "attackType": "area",
    "kb": 5,
    "trait": "浮",
    "rarity": "SSR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "ability": {
      "name": "芸術・万能設計図",
      "desc": "40%で1秒停止、30%で2秒鈍足、50%で被ダメージ半減、バリアブレイク。",
      "stopChance": 0.4,
      "stopDuration": 1,
      "slowChance": 0.3,
      "slowDuration": 2,
      "damageReduce": {
        "chance": 0.5,
        "factor": 0.5
      },
      "barrierBreak": true
    },
    "id": 73
  },
  {
    "name": "教えの賢者コウシィ",
    "cost": 1250,
    "hp": 5600,
    "atk": 1150,
    "range": 130,
    "spd": 0.8,
    "interval": 1.25,
    "recharge": 22,
    "icon": "📜",
    "motion": "king",
    "attackType": "area",
    "kb": 6,
    "trait": "無",
    "rarity": "SSR",
    "series": "聖なる偉人達",
    "limitedExchange": true,
    "limitedExchangeSeries": "聖なる偉人達",
    "ability": {
      "name": "教え・五徳",
      "desc": "100%で4秒呪い、50%で4秒攻撃力50%低下、40%で2秒速度50%低下。呪い・停止・攻撃力低下無効。",
      "curseChance": 1,
      "curseDuration": 4,
      "attackDownChance": 0.5,
      "attackDownFactor": 0.5,
      "attackDownDuration": 4,
      "curseSlowChance": 0.4,
      "curseSlowFactor": 0.5,
      "curseSlowDuration": 2,
      "curseImmune": true,
      "stopImmune": true,
      "attackDownImmune": true
    },
    "id": 74
  },
  {
    "name": "フェニックス",
    "rarity": "超激レア",
    "cost": 3500,
    "hp": 16000,
    "atk": 1150,
    "range": 100,
    "spd": 1.1,
    "interval": 1.6,
    "recharge": 45,
    "icon": "🐦‍🔥",
    "motion": "super",
    "attackType": "allrange",
    "kb": 1,
    "minRange": -70,
    "maxRange": 100,
    "trait": "無",
    "specialReward": true,
    "stopImmune": true,
    "ability": {
      "name": "不死鳥の炎",
      "desc": "攻撃時、命中した敵の数だけLv1烈波を発生。烈波は射程1〜200で、生成元の攻撃力と能力を引き継ぐ。古代・宇宙・天使に50%で3秒呪い。停止無効。鈍足・波動・烈波を無効化。",
      "phoenixSurgeLevel": 1,
      "phoenixSurgeMin": 1,
      "phoenixSurgeMax": 200,
      "curseChance": 0.5,
      "curseDuration": 3,
      "stopChance": 0.33,
      "stopDuration": 2,
      "stopImmune": true,
      "slowImmune": true,
      "waveImmune": true,
      "surgeImmune": true,
      "curseTargets": [
        "古代",
        "宇宙",
        "天使"
      ]
    },
    "id": 75
  },
  {
    "name": "パンプキン木下",
    "cost": 1800,
    "hp": 6800,
    "atk": 1350,
    "range": 125,
    "spd": 0.72,
    "interval": 1.35,
    "recharge": 32,
    "icon": "🎃",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "series": "ハロウィンナイト2026",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "黒・浮",
    "ability": {
      "name": "パンプキンボム",
      "desc": "黒・浮属性に攻撃1.8倍。攻撃時30%で2秒間鈍足。",
      "strong": {
        "黒": 1.8,
        "浮": 1.8
      },
      "slow": {
        "trait": "*",
        "chance": 0.3,
        "factor": 0.6,
        "duration": 2
      }
    },
    "id": 76
  },
  {
    "name": "ワイバーン",
    "cost": 3500,
    "hp": 22000,
    "atk": 8700,
    "range": 150,
    "spd": 1.3,
    "interval": 1.5,
    "recharge": 45,
    "icon": "🐉",
    "motion": "super",
    "attackType": "area",
    "kb": 2,
    "trait": "無",
    "rarity": "超激レア",
    "specialReward": true,
    "eventReward": "ワイバーン襲来",
    "airAttack": true,
    "curseImmune": true,
    "stopImmune": true,
    "slowImmune": true,
    "waveImmune": true,
    "surgeImmune": true,
    "ability": {
      "name": "竜王の天翔",
      "desc": "攻撃時100%で烈波Lv2。全属性へ3秒間の呪い・停止・鈍足。赤・天使・鋼・浮に4倍ダメージ、該当属性からの被ダメージ0.25倍。空中攻撃可能。呪い・停止・鈍足・波動・烈波無効。",
      "phoenixSurgeLevel": 2,
      "phoenixSurgeMin": 1,
      "phoenixSurgeMax": 200,
      "curseChance": 1,
      "curseDuration": 3,
      "stopChance": 1,
      "stopDuration": 3,
      "slowChance": 1,
      "slowFactor": 0.5,
      "slowDuration": 3,
      "curseImmune": true,
      "stopImmune": true,
      "slowImmune": true,
      "waveImmune": true,
      "surgeImmune": true,
      "wyvernStrongTraits": [
        "赤",
        "天使",
        "鋼",
        "メタル",
        "浮"
      ],
      "wyvernStrongMultiplier": 4,
      "wyvernResistTraits": [
        "赤",
        "天使",
        "鋼",
        "メタル",
        "浮"
      ],
      "wyvernResistMultiplier": 0.25,
      "strong": {
        "赤": 4,
        "天使": 4,
        "鋼": 4,
        "メタル": 4,
        "浮": 4
      },
      "resist": {
        "赤": 0.25,
        "天使": 0.25,
        "鋼": 0.25,
        "メタル": 0.25,
        "浮": 0.25
      }
    },
    "id": 77
  },
  {
    "name": "富豪木下",
    "cost": 1500,
    "hp": 30000,
    "atk": 1500,
    "range": 70,
    "spd": 0.2,
    "interval": 1.5,
    "recharge": 150,
    "icon": "💰",
    "motion": "super",
    "attackType": "single",
    "kb": 2,
    "trait": "無",
    "rarity": "LR",
    "series": "特別真髄",
    "specialGachaOnly": true,
    "curseImmune": true,
    "ability": {
      "name": "富豪の資産運用",
      "desc": "場にいる間、敵撃破時のお金2倍・2秒ごとに150円獲得（各効果最大2体分まで重複）。呪い無効。",
      "curseImmune": true
    },
    "secondForm": {
      "name": "大富豪木下",
      "icon": "💎",
      "cost": 4500,
      "hp": 85000,
      "atk": 300000,
      "range": 140,
      "spd": 1.3,
      "interval": 20,
      "recharge": 150,
      "kb": 2,
      "attackType": "single",
      "trait": "赤",
      "ability": {
        "name": "大富豪の超臨界",
        "desc": "50%でクリティカル（ダメージ2倍、メタルにも通常ダメージを通す）。浮・天使・神話に5倍ダメージ。呪い・波動・烈波・停止・攻撃力低下無効。HP50%未満で攻撃力300%増加。",
        "criticalChance": 0.5,
        "criticalMultiplier": 2,
        "wyvernStrongTraits": [
          "浮",
          "天使",
          "神話"
        ],
        "wyvernStrongMultiplier": 5,
        "curseImmune": true,
        "waveImmune": true,
        "surgeImmune": true,
        "stopImmune": true,
        "attackDownImmune": true,
        "hpBelowThreshold": 0.5,
        "hpBelowThresholdMultiplier": 4
      },
      "curseImmune": true,
      "waveImmune": true,
      "surgeImmune": true,
      "stopImmune": true,
      "attackDownImmune": true
    },
    "id": 78
  },
  {
    "name": "異次元木下",
    "cost": 1800,
    "hp": 9800,
    "atk": 2250,
    "range": 175,
    "spd": 0.85,
    "interval": 1.4,
    "recharge": 38,
    "icon": "🌀",
    "motion": "king",
    "attackType": "area",
    "kb": 3,
    "trait": "浮・黒",
    "rarity": "UR",
    "series": "日替わり異次元戦線",
    "limitedExchange": false,
    "limitedExchangeSeries": "日替わり異次元戦線",
    "ability": {
      "name": "異次元の加護",
      "desc": "浮いている敵・黒い敵にめっぽう強い。",
      "strong": {
        "浮": 1.5,
        "黒": 1.5
      },
      "resist": {
        "浮": 0.5,
        "黒": 0.5
      }
    },
    "id": 79
  },
  {
    "name": "アイヴィ",
    "cost": 2800,
    "hp": 35000,
    "atk": 9500,
    "range": 95,
    "spd": 0.9,
    "interval": 1.6,
    "recharge": 42,
    "icon": "🌿",
    "motion": "super",
    "attackType": "area",
    "kb": 2,
    "trait": "黒",
    "rarity": "超激レア",
    "specialReward": true,
    "eventReward": "アイヴィ降臨",
    "ability": {
      "name": "感情転移・魂喰い・烈波蓄積",
      "desc": "感情転移、魂喰い、烈波蓄積。呪い・停止・攻撃力低下・鈍足・烈波・波動無効。",
      "ivyTransfer": true,
      "ivyTransferInterval": 60,
      "ivyTransferOnFirstContact": true,
      "ivySoulAtk": 0.03,
      "ivySoulHeal": 0,
      "ivySurgeStack": true,
      "ivySurgeStackRequired": 5,
      "ivySpecialSurgeIgnoresSurgeImmune": true,
      "curseImmune": true,
      "stopImmune": true,
      "attackDownImmune": true,
      "slowImmune": true,
      "surgeImmune": true,
      "waveImmune": true
    },
    "id": 80
  },
  {
    "name": "吉田（ハロウィン）",
    "cost": 650,
    "hp": 5200,
    "atk": 1450,
    "range": 125,
    "spd": 1.05,
    "interval": 1.1,
    "recharge": 18,
    "icon": "🎃",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "series": "ハロウィンナイト2026 第二弾",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "黒・浮",
    "ability": {
      "name": "ジャック・オー・スマッシュ",
      "desc": "黒・浮属性に攻撃2倍。攻撃時35%で2秒間鈍足。",
      "strong": {
        "黒": 2,
        "浮": 2
      },
      "slow": {
        "trait": "*",
        "chance": 0.35,
        "factor": 0.55,
        "duration": 2
      }
    },
    "id": 81
  },
  {
    "name": "マッチョ木下（ハロウィン）",
    "cost": 900,
    "hp": 14500,
    "atk": 2300,
    "range": 85,
    "spd": 0.62,
    "interval": 1.45,
    "recharge": 28,
    "icon": "💪🎃",
    "motion": "muscle",
    "attackType": "area",
    "kb": 2,
    "series": "ハロウィンナイト2026 第二弾",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "赤・黒",
    "ability": {
      "name": "パンプキンアーマー",
      "desc": "赤・黒属性からの被ダメージを軽減。",
      "resist": {
        "赤": 0.55,
        "黒": 0.65
      }
    },
    "id": 82
  },
  {
    "name": "木下（野球・ハロウィン）",
    "cost": 1200,
    "hp": 6800,
    "atk": 3800,
    "range": 190,
    "spd": 0.8,
    "interval": 1.8,
    "recharge": 32,
    "icon": "⚾🎃",
    "motion": "baseball",
    "attackType": "single",
    "kb": 4,
    "series": "ハロウィンナイト2026 第二弾",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "浮",
    "ability": {
      "name": "満月ホームラン",
      "desc": "浮属性に3倍ダメージ。",
      "strong": {
        "浮": 3
      }
    },
    "id": 83
  },
  {
    "name": "異常木下（ハロウィン）",
    "cost": 2400,
    "hp": 18000,
    "atk": 4900,
    "range": 230,
    "spd": 0.48,
    "interval": 2.1,
    "recharge": 42,
    "icon": "👁️🎃",
    "motion": "super",
    "attackType": "area",
    "kb": 2,
    "series": "ハロウィンナイト2026 第二弾",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "黒・古代",
    "ability": {
      "name": "呪われた月夜",
      "desc": "攻撃時50%で3秒間呪い。黒・古代属性に攻撃1.8倍。",
      "strong": {
        "黒": 1.8,
        "古代": 1.8
      },
      "curseChance": 0.5,
      "curseDuration": 3
    },
    "id": 84
  },
  {
    "name": "木下（覚醒・ハロウィン）",
    "cost": 3000,
    "hp": 25000,
    "atk": 7200,
    "range": 165,
    "spd": 0.7,
    "interval": 1.7,
    "recharge": 48,
    "icon": "🌕🎃",
    "motion": "king",
    "attackType": "area",
    "kb": 3,
    "series": "ハロウィンナイト2026 第二弾",
    "rarity": "超激レア",
    "specialReward": true,
    "trait": "赤・浮・黒",
    "ability": {
      "name": "トリック・オア・トリート",
      "desc": "赤・浮・黒属性に攻撃2倍。",
      "strong": {
        "赤": 2,
        "浮": 2,
        "黒": 2
      }
    },
    "id": 85
  },
  {
    "name": "超越木下・天翔",
    "cost": 4200,
    "hp": 78000,
    "atk": 18500,
    "range": 260,
    "spd": 0.72,
    "interval": 1.35,
    "recharge": 60,
    "icon": "🌌",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "rarity": "SSR",
    "series": "超木下祭",
    "limitedExchange": true,
    "limitedExchangeSeries": "超木下祭",
    "growth": true,
    "trait": "神話",
    "growthDesc": "成長1段階：HP・攻撃力を1.8倍、射程+35、移動速度×1.12、攻撃間隔×0.86。次元断裂は現在HPの3%に強化。\n成長2段階：HP・攻撃力をさらに2.2倍、射程+50、移動速度×1.12、攻撃間隔×0.86。次元断裂は現在HPの4%。\n成長3段階：HP・攻撃力をさらに2.8倍、射程+75、移動速度×1.12、攻撃間隔×0.86。次元断裂は現在HPの5%。ボスへの追加ダメージ上限は8,000。",
    "ability": {
      "name": "次元断裂",
      "desc": "攻撃が命中するたび、通常攻撃とは別に対象の命中後の現在HPの2%を追加ダメージとして与える。通常敵への追加ダメージに固定上限はない。ボス扱いの敵には1回あたり最大8,000の上限が適用される。対象の残りHPを基準に計算するため、HPが高い敵ほど序盤の追加ダメージが大きい。",
      "dimensionalRend": {
        "chance": 1,
        "factor": 0.02,
        "bossCap": 8000
      }
    },
    "id": 86
  },
  {
    "name": "超越木下・冥王",
    "cost": 4800,
    "hp": 112000,
    "atk": 22000,
    "range": 210,
    "spd": 0.48,
    "interval": 1.65,
    "recharge": 70,
    "icon": "🌑",
    "motion": "king",
    "attackType": "area",
    "kb": 3,
    "rarity": "SSR",
    "series": "超木下祭",
    "limitedExchange": true,
    "limitedExchangeSeries": "超木下祭",
    "growth": true,
    "trait": "黒",
    "growthDesc": "成長1段階：HP・攻撃力を1.8倍、射程+35、移動速度×1.12、攻撃間隔×0.86。虚無領域の範囲半径+60。\n成長2段階：HP・攻撃力をさらに2.2倍、射程+50、移動速度×1.12、攻撃間隔×0.86。虚無領域の範囲半径をさらに+60。\n成長3段階：HP・攻撃力をさらに2.8倍、射程+75、移動速度×1.12、攻撃間隔×0.86。虚無領域の範囲半径をさらに+60。",
    "ability": {
      "name": "虚無領域",
      "desc": "自身を中心とした範囲内の敵に虚無の弱体化を付与する。効果中は敵の攻撃ダメージを通常時の55%、移動速度を65%に低下させ、召喚能力と結界再生を3秒間封じる。範囲内にいる間は効果時間を更新する。成長1段階ごとに範囲半径が60増加する。",
      "voidField": {
        "radius": 180,
        "attackSlow": 0.55,
        "speedSlow": 0.65,
        "disableSummon": true,
        "disableRegen": true
      }
    },
    "id": 87
  },
  {
    "name": "超越木下・時空王",
    "cost": 5200,
    "hp": 90000,
    "atk": 14500,
    "range": 330,
    "spd": 0.62,
    "interval": 1.1,
    "recharge": 75,
    "icon": "⏳",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "rarity": "SSR",
    "series": "超木下祭",
    "limitedExchange": true,
    "limitedExchangeSeries": "超木下祭",
    "growth": true,
    "trait": "浮",
    "growthDesc": "成長1段階：HP・攻撃力を1.8倍、射程+35、移動速度×1.12、攻撃間隔×0.86。\n成長2段階：HP・攻撃力をさらに2.2倍、射程+50、移動速度×1.12、攻撃間隔×0.86。\n成長3段階：HP・攻撃力をさらに2.8倍、射程+75、移動速度×1.12、攻撃間隔×0.86。因果反転自体は最大HPの40%で復活し、3秒無敵。",
    "ability": {
      "name": "因果反転",
      "desc": "戦闘中に初めて致命傷を受けたとき、1回だけ戦闘不能を回避し、HPを最大HPの40%まで回復する。その後3秒間は無敵状態となり、無敵時間中のダメージを受けない。発動済みの因果反転は同じ出撃中に再発動しない。成長しても復活HP40%と無敵3秒の設定は変わらない。",
      "causalityReversal": {
        "once": true,
        "heal": 0.4,
        "invulnerable": 3
      }
    },
    "id": 88
  },
  {
    "name": "超越木下・創世神",
    "cost": 6000,
    "hp": 280000,
    "atk": 42000,
    "range": 360,
    "spd": 0.38,
    "interval": 2.1,
    "recharge": 100,
    "icon": "✨",
    "motion": "super",
    "attackType": "allrange",
    "kb": 2,
    "minRange": -90,
    "maxRange": 360,
    "rarity": "LR",
    "series": "超木下祭",
    "limitedExchange": true,
    "limitedExchangeSeries": "超木下祭",
    "growth": true,
    "trait": "神話",
    "growthDesc": "成長1段階：HP・攻撃力×1.8、射程+35、速度×1.12、攻撃間隔×0.86。12秒ごとの味方回復が5%、敵全体ダメージが攻撃力の30%に上昇。\n成長2段階：味方回復7%、敵全体ダメージ40%。\n成長3段階：味方回復9%、敵全体ダメージ50%。設定上の上限は回復15%、敵全体ダメージ60%。",
    "ability": {
      "name": "創世律動",
      "desc": "12秒ごとに1回発動する。生存している味方全員のHPを各自の最大HPの3%回復し、生存している敵全員に創世神の攻撃力の20%分の追加ダメージを与える。通常攻撃とは別に発動し、敵を倒した場合は通常の撃破処理を行う。成長で回復率と敵全体への追加ダメージ率が上がる。",
      "genesisPulse": {
        "cooldown": 12,
        "allyHeal": 0.03,
        "enemyDamage": 0.2
      }
    },
    "id": 89
  },
  {
    "name": "天使神:木下",
    "cost": 2500,
    "hp": 208688,
    "atk": 28675,
    "range": 150,
    "spd": 1.2,
    "interval": 3,
    "recharge": 320,
    "icon": "👼",
    "motion": "super",
    "attackType": "area",
    "kb": 2,
    "rarity": "UR",
    "series": "超木下祭",
    "limitedExchange": true,
    "limitedExchangeSeries": "超木下祭",
    "growth": true,
    "trait": "天使",
    "growthDesc": "成長1段階：全ステータスを20%上昇。成長2段階：さらに全ステータスを45%上昇。成長3段階：さらに全ステータスを85%上昇。各段階の必要木下マネーは2,500／5,000／8,500。天使属性の編成数による強化、攻撃命中ごとの攻撃力上昇、再生産時間短縮は成長と別に累積する。",
    "ability": {
      "name": "天使神の超越支配",
      "desc": "自身を含む編成中の天使属性1体につき自身の全ステータス+7%（最大+30%）。自身以外の味方天使属性は編成中にHP・攻撃力・射程・移動速度・攻撃間隔・再生産時間が常時強化され、呪い・波動・烈波を無効化。自身は呪い・烈波・波動・停止・ヤバヤバ化・攻撃力低下・移動速度低下・ふっとばしを無効化。致命傷時に一度だけHP100%で復活し、復活時に最大HPと攻撃力を入れ替える。受ける1回のダメージは最大HPの15%まで。常時、実際に受けたHPダメージの15%を回復。HPが最大値の40%以上なら全属性からのダメージを35%軽減し、受けたダメージの15%を攻撃者へ反射。敵にダメージを与えるたび攻撃力+2%（最大+70%）・再生産残り時間を2%短縮。敵撃破時に最大HPの1.5%を回復し、2秒間移動速度3。古代・赤・黒・浮・神話属性に8倍ダメージ、これらの属性から受けるダメージをさらに20%軽減。",
      "angelGod": true,
      "curseImmune": true,
      "waveImmune": true,
      "surgeImmune": true,
      "stopImmune": true,
      "slowImmune": true,
      "attackDownImmune": true,
      "knockbackImmune": true,
      "yabayabaImmune": true,
      "damageCapRatio": 0.15,
      "damageReflectRatio": 0.15,
      "damageHealRatio": 0.15,
      "highHpThreshold": 0.4,
      "highHpDamageReduction": 0.35,
      "traitDamageReduction": 0.2,
      "traitDamageBonus": 8
    },
    "id": 90
  },
  {
    "name": "駆け出しの木下",
    "cost": 420,
    "hp": 4200,
    "atk": 680,
    "range": 58,
    "spd": 1.65,
    "interval": 0.85,
    "recharge": 7.5,
    "icon": "🏇",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_attack",
        "name": "初陣の突撃",
        "description": "攻撃時20%で通常攻撃に追加ダメージ（追加分は通常攻撃の1.10倍相当）。",
        "trigger": "攻撃時",
        "chance": 0.2,
        "effect": {
          "type": "damage",
          "chance": 0.2,
          "factor": 2.1
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 91
  },
  {
    "name": "白銀の疾走者",
    "cost": 780,
    "hp": 9800,
    "atk": 1150,
    "range": 105,
    "spd": 1.25,
    "interval": 1.2,
    "recharge": 13,
    "icon": "🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "追い風の加護",
        "description": "自身の移動速度を1.4倍にする（3秒）。",
        "trigger": "定期発動",
        "interval": 12,
        "duration": 3,
        "effect": {
          "type": "speed",
          "interval": 12,
          "duration": 3,
          "factor": 1.4
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 92
  },
  {
    "name": "荒野の狙撃手",
    "cost": 950,
    "hp": 7600,
    "atk": 2200,
    "range": 245,
    "spd": 0.72,
    "interval": 1.65,
    "recharge": 15,
    "icon": "🏹🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_attack",
        "name": "精密射撃",
        "description": "攻撃時30%で通常攻撃に追加ダメージ（追加分は通常攻撃の1.25倍相当）。",
        "trigger": "攻撃時",
        "chance": 0.3,
        "effect": {
          "type": "damage",
          "chance": 0.3,
          "factor": 2.25
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 93
  },
  {
    "name": "砂塵の機巧騎手",
    "cost": 1250,
    "hp": 14500,
    "atk": 1750,
    "range": 130,
    "spd": 0.88,
    "interval": 1.35,
    "recharge": 17,
    "icon": "🐴",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "砂煙幕",
        "description": "範囲320以内の敵の移動速度を62%に低下させる（3秒）。",
        "trigger": "定期発動",
        "interval": 15,
        "duration": 3,
        "effect": {
          "type": "slow",
          "interval": 15,
          "duration": 3,
          "radius": 320,
          "factor": 0.62
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 94
  },
  {
    "name": "大地の調教師",
    "cost": 1800,
    "hp": 22500,
    "atk": 1300,
    "range": 175,
    "spd": 0.62,
    "interval": 1.7,
    "recharge": 22,
    "icon": "🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "超激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "騎手の手当て",
        "description": "味方全体のHPを最大HPの8%回復する。",
        "trigger": "定期発動",
        "interval": 10,
        "effect": {
          "type": "heal",
          "interval": 10,
          "factor": 0.08
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 95
  },
  {
    "name": "紅蓮の突撃騎手",
    "cost": 2200,
    "hp": 18500,
    "atk": 3800,
    "range": 65,
    "spd": 1.35,
    "interval": 1.05,
    "recharge": 25,
    "icon": "🔥🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "超激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "紅蓮連走",
        "description": "自身の移動速度を1.65倍にする（2.5秒）。",
        "trigger": "定期発動",
        "interval": 18,
        "duration": 2.5,
        "effect": {
          "type": "speed",
          "interval": 18,
          "duration": 2.5,
          "factor": 1.65
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true,
      "extraAttackChance": 0.25
    },
    "id": 96
  },
  {
    "name": "時渡りの旅人",
    "cost": 2600,
    "hp": 16000,
    "atk": 2400,
    "range": 220,
    "spd": 0.82,
    "interval": 1.4,
    "recharge": 28,
    "icon": "🌌🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "超激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "時刻の蹄音",
        "description": "範囲260以内の敵を1.1秒間停止させる。",
        "trigger": "定期発動",
        "interval": 20,
        "duration": 1.1,
        "effect": {
          "type": "stop",
          "interval": 20,
          "duration": 1.1,
          "radius": 260
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 97
  },
  {
    "name": "黄金の王道騎手",
    "cost": 3200,
    "hp": 36000,
    "atk": 4600,
    "range": 95,
    "spd": 0.78,
    "interval": 1.35,
    "recharge": 32,
    "icon": "👑🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "超激レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_periodic",
        "name": "王者の粘り",
        "description": "HP50%以下で一度だけ、攻撃力を1.5倍・移動速度を1.2倍にする。",
        "trigger": "HP条件を満たした時",
        "effect": {
          "type": "awakening",
          "threshold": 0.5,
          "factor": 1.5
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 98
  },
  {
    "name": "黒嵐の競争者",
    "cost": 4200,
    "hp": 52000,
    "atk": 8200,
    "range": 155,
    "spd": 0.68,
    "interval": 1.8,
    "recharge": 40,
    "icon": "🌩️🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "伝説レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_attack",
        "name": "黒嵐の轟撃（攻撃時）",
        "description": "攻撃時20%で通常攻撃に追加ダメージ（追加分は通常攻撃の1.10倍相当）。命中時に敵を後退させる。",
        "trigger": "攻撃時",
        "chance": 0.2,
        "effect": {
          "type": "damage",
          "chance": 0.2,
          "factor": 2.1,
          "knockback": true
        }
      },
      {
        "id": "kbr_periodic",
        "name": "黒嵐の轟撃（定期発動）",
        "description": "範囲330以内の敵に4秒間雷雨を発生させ、35%の確率で攻撃力の45%分の追加ダメージ。",
        "trigger": "定期発動",
        "interval": 25,
        "duration": 4,
        "effect": {
          "type": "storm",
          "interval": 25,
          "duration": 4,
          "radius": 330,
          "factor": 0.65
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true
    },
    "id": 99
  },
  {
    "name": "KBRの覇者・木下",
    "cost": 5500,
    "hp": 88000,
    "atk": 12500,
    "range": 190,
    "spd": 0.92,
    "interval": 1.65,
    "recharge": 55,
    "icon": "🏆🐎",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "rarity": "伝説レア",
    "series": "Kinoshita Ball Run",
    "trait": "宇宙",
    "kbrMounted": true,
    "skills": [
      {
        "id": "kbr_attack",
        "name": "終着点を越えて（攻撃時）",
        "description": "攻撃時15%で通常攻撃に追加ダメージ（追加分は通常攻撃の1.50倍相当）。",
        "trigger": "攻撃時",
        "chance": 0.15,
        "effect": {
          "type": "damage",
          "chance": 0.15,
          "factor": 2.5
        }
      },
      {
        "id": "kbr_periodic",
        "name": "終着点を越えて（定期発動）",
        "description": "走行中に定期発動し、攻撃力を強化。最大で基礎攻撃力の2.2倍まで上昇する。",
        "trigger": "定期発動",
        "interval": 20,
        "effect": {
          "type": "champion",
          "interval": 20,
          "factor": 1.5
        }
      }
    ],
    "ability": {
      "name": "騎乗特性",
      "desc": "騎乗中は悪天候による移動速度低下を軽減する。",
      "kbrMounted": true,
      "strong": {
        "宇宙": 1.5
      }
    },
    "id": 100
  },
  {
    "name": "狂乱の強化木下",
    "cost": 3900,
    "hp": 29500,
    "atk": 19600,
    "range": 55,
    "spd": 0.8,
    "interval": 4,
    "recharge": 16,
    "icon": "🌌",
    "motion": "super",
    "attackType": "single",
    "kb": 2,
    "trait": "宇宙",
    "rarity": "SSR",
    "series": "狂乱シリーズ",
    "specialReward": true,
    "eventReward": "狂乱の強化木下降臨",
    "ability": {
      "name": "狂乱強化・宇宙共鳴",
      "desc": "編成中の宇宙属性1体につき攻撃力+15%（最大+100%）。天使・赤・浮いてる敵・黒に3倍ダメージ、同属性からの被ダメージ25%軽減。呪い・停止・烈波・吹っ飛ばす無効。攻撃時25%で烈波Lv2。敵撃破ごとに攻撃力+5%（最大+50%）、最大HPの1%回復。HP50%以上で攻撃力+15%。",
      "strong": {
        "天使": 3,
        "赤": 3,
        "浮": 3,
        "黒": 3
      },
      "resist": {
        "天使": 0.75,
        "赤": 0.75,
        "浮": 0.75,
        "黒": 0.75
      },
      "curseImmune": true,
      "stopImmune": true,
      "surgeImmune": true,
      "knockbackImmune": true,
      "phoenixSurgeLevel": 2,
      "phoenixSurgeChance": 0.25,
      "cosmicFormationBonus": {
        "perUnit": 0.15,
        "maxBonus": 1
      },
      "killAttackStack": {
        "perKill": 0.05,
        "maxBonus": 0.5
      },
      "healOnKill": 0.01,
      "hpThresholdAttackBonus": {
        "threshold": 0.5,
        "multiplier": 1.15
      }
    },
    "id": 101
  },
  {
    "name": "覇風",
    "cost": 880,
    "hp": 58500,
    "atk": 12500,
    "range": 225,
    "spd": 1.9,
    "interval": 0.6,
    "recharge": 32,
    "icon": "🌪️",
    "motion": "super",
    "attackType": "single",
    "kb": 2,
    "trait": "神話",
    "rarity": "UR",
    "series": "エレメンタル木下s",
    "limitedExchange": true,
    "limitedExchangeSeries": "エレメンタル木下s",
    "waveLevel": 5,
    "waveChance": 1,
    "waveImmune": true,
    "reflectImmune": true,
    "strong": {
      "宇宙": 8,
      "赤": 8,
      "天使": 8
    },
    "resist": {
      "宇宙": 0.45,
      "赤": 0.45,
      "天使": 0.45
    },
    "haifu": true,
    "skills": [
      {
        "id": "haifu_five_summon_storm",
        "name": "五召喚の大嵐",
        "description": "覇風が5回召喚されるごとに、敵全体へ自身の攻撃力250%分のダメージを与え、与えたダメージの50%分を味方全体へ回復する。",
        "trigger": "5回目の召喚時",
        "everySummons": 5,
        "damageMultiplier": 2.5,
        "healRatio": 0.5
      },
      {
        "id": "haifu_guts",
        "name": "根性だけで勝ちます",
        "description": "攻撃時15%で、対象の攻撃力と自身の攻撃力の合計×3の追加ダメージを与える。",
        "trigger": "攻撃時",
        "chance": 0.15,
        "cooldown": 13,
        "damageMultiplier": 3
      }
    ],
    "ability": {
      "name": "覇風の絶対支配",
      "desc": "編成中のウルトラレア以外の味方1体につき自身のHP・攻撃力・攻撃間隔・再生産時間+35%（最大+200%、射程・移動速度は対象外）。編成中のウルトラレア1体につき全味方のHP・攻撃力・移動速度・攻撃間隔+35%（最大+95%、射程・再生産時間は対象外）。場にいる間、敵全体の攻撃力を35%低下（最大70%）。編成中は全味方に自身の攻撃力80%分のパワーシールドを付与。召喚後2秒ごとにHP・攻撃力+7%（最大+35%）。宇宙・赤・天使に8倍ダメージ、同属性からの被ダメージ55%軽減。被弾ごとに防御力+2.5%（最大+20%）。1回の被ダメージは最大HPの20%まで。攻撃時100%で波動Lv5。敵の反射攻撃を無効化。",
      "waveImmune": true,
      "reflectImmune": true
    },
    "id": 102
  },
  {
    "name": "MiraiK",
    "cost": 1400,
    "hp": 69000,
    "atk": 2550,
    "range": 150,
    "spd": 0.8,
    "interval": 2.5,
    "recharge": 65,
    "icon": "🌗",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "天使",
    "rarity": "UR",
    "series": "特別真髄",
    "specialGachaOnly": true,
    "skills": [
      {
        "id": "miraiK_reverse",
        "name": "反転",
        "description": "天使属性で攻撃した時、75%の確率で自身の現在HPの150%分の追加ダメージを与え、攻撃力が7%上昇する（最大+15%）。",
        "trigger": "天使属性で攻撃時",
        "chance": 0.75,
        "cooldown": 15,
        "damageMultiplier": 1.5,
        "attackBonusPerActivation": 0.07,
        "maxAttackBonus": 0.15
      },
      {
        "id": "miraiK_reversal",
        "name": "再反転",
        "description": "黒属性で攻撃した時、75%の確率で敵攻撃力と自身攻撃力の合計分の追加ダメージを与え、実際に与えたダメージの5%を回復する。",
        "trigger": "黒属性で攻撃時",
        "chance": 0.75,
        "cooldown": 15,
        "healRatio": 0.05
      }
    ],
    "ability": {
      "name": "反転・再反転",
      "desc": "距離装甲：攻撃者との距離が150以上なら被ダメージ85%軽減。自身以外の編成中の天使属性1体につき与ダメージ+10%（最大+55%）。自身が編成にいるだけで味方の天使属性全員のHP・攻撃力・射程・移動速度・攻撃間隔・再生産時間+10%。黒・浮・神話属性に5倍ダメージ、同属性からの被ダメージ75%軽減。対象が黒・浮・神話属性なら攻撃時に射程を3秒間80%低下。攻撃時50%で2秒呪い、50%で2秒停止。敵に攻撃するたび攻撃間隔を0.1秒短縮（最大0.3秒）。単体攻撃の敵に対して被ダメージ25%軽減・与ダメージ3倍。1回の被ダメージは最大HPの25%まで。上限を超える攻撃を受けた場合、攻撃者の攻撃力を7秒間90%低下させ、2秒間呪いを付与。",
      "curseChance": 0.5,
      "curseDuration": 2,
      "stopChance": 0.5,
      "stopDuration": 2,
      "wyvernStrongTraits": [
        "黒",
        "浮",
        "神話"
      ],
      "wyvernStrongMultiplier": 5,
      "wyvernResistTraits": [
        "黒",
        "浮",
        "神話"
      ],
      "wyvernResistMultiplier": 0.25
    },
    "id": 103
  },
  {
    "name": "狂乱のマッチョ木下",
    "cost": 4200,
    "hp": 50000,
    "atk": 23000,
    "range": 110,
    "spd": 0.5,
    "interval": 0.9,
    "recharge": 180,
    "icon": "💪",
    "motion": "super",
    "attackType": "area",
    "kb": 4,
    "trait": "黒",
    "rarity": "SSR",
    "series": "狂乱シリーズ",
    "specialReward": true,
    "eventReward": "狂乱のマッチョ木下降臨",
    "waveImmune": true,
    "waveReflect": true,
    "stopImmune": true,
    "surgeImmune": true,
    "knockbackImmune": true,
    "curseImmune": true,
    "skills": [
      {
        "id": "muscle_right_grab",
        "name": "右手拘束",
        "description": "最高攻撃力の敵を右手で拘束する。拘束中は対象の攻撃力を加算し、自身が最大HPの20%分のダメージを受けると対象を敵城前へ飛ばして最大HPの50%分の割合ダメージと3秒間の鈍足を与える。拘束するたび自身の攻撃力+50%（最大+200%）。",
        "trigger": "右手の発動条件を満たした時",
        "cooldown": 45
      },
      {
        "id": "muscle_left_grab",
        "name": "左手拘束",
        "description": "最高HPの敵を左手で拘束し、対象に自身の最大HPの最大50%分のダメージを肩代わりさせる。拘束解除時、対象を敵城前へ飛ばし、残りHPに応じたパワーシールドを獲得する。",
        "trigger": "左手の発動条件を満たした時",
        "cooldown": 75
      }
    ],
    "ability": {
      "waveImmune": true,
      "waveReflect": true,
      "stopImmune": true,
      "surgeImmune": true,
      "knockbackImmune": true,
      "curseImmune": true,
      "name": "双腕拘束・狂乱の筋肉",
      "desc": "場にいる間、神話・天使・赤属性から受けるダメージを15%軽減し、同属性への与ダメージ+20%。1回の被ダメージは最大HPの25%まで。被弾ごとに防御力+5%（最大+50%）。敵撃破ごとに最大HPの2%回復・攻撃力+5%（最大+50%）。呪い・停止・烈波・吹っ飛ばす無効、波動反射。攻撃時50%で烈波Lv2、50%で3秒停止。右手：最高攻撃力の敵を拘束し、攻撃力を加算。自身が最大HPの20%分のダメージを受けると敵城前へ飛ばして最大HP50%の割合ダメージと3秒鈍足。掴むたび攻撃力+50%（最大+200%）、CT45秒。左手：最高HPの敵を拘束し、被ダメージを最大HPの50%分肩代わりさせる。解除時に敵城前へ飛ばし、残りHP分のパワーシールドを獲得。CT75秒。",
      "muscleHands": {
        "rightCooldown": 45,
        "leftCooldown": 75,
        "rightDamageThreshold": 0.2,
        "rightDamagePercent": 0.5,
        "rightAtkPerGrab": 0.5,
        "rightAtkMaxBonus": 2,
        "leftAbsorbMax": 0.5,
        "leftSlowDuration": 3,
        "leftSlowFactor": 0.5
      },
      "muscleKillGrowth": {
        "perKill": 0.05,
        "maxBonus": 0.5,
        "heal": 0.02
      },
      "muscleDefenseGrowth": {
        "perHit": 0.05,
        "maxBonus": 0.5
      },
      "damageCap": 0.25,
      "phoenixSurgeLevel": 2,
      "phoenixSurgeChance": 0.5,
      "stopChance": 0.5,
      "stopDuration": 3
    },
    "id": 104
  },
  {
    "name": "木下ガード",
    "cost": 300,
    "hp": 2400,
    "atk": 95,
    "range": 55,
    "spd": 0.48,
    "interval": 1.35,
    "recharge": 8,
    "icon": "🛡️",
    "motion": "robot",
    "attackType": "area",
    "kb": 2,
    "series": "通常交換所・実用隊",
    "rarity": "R",
    "gachaCost": 2200,
    "ability": {
      "name": "堅実な装甲",
      "desc": "全属性から受けるダメージを15%軽減する。",
      "resist": {
        "*": 0.85
      }
    },
    "id": 105
  },
  {
    "name": "木下ランナー",
    "cost": 180,
    "hp": 850,
    "atk": 250,
    "range": 58,
    "spd": 1.75,
    "interval": 1,
    "recharge": 7,
    "icon": "🏃",
    "motion": "ninja",
    "attackType": "single",
    "kb": 5,
    "series": "通常交換所・実用隊",
    "rarity": "R",
    "gachaCost": 2400,
    "ability": {
      "name": "先行突撃",
      "desc": "移動速度が高く、低コストで前線へ素早く到着する。"
    },
    "id": 106
  },
  {
    "name": "木下スナイパー",
    "cost": 550,
    "hp": 900,
    "atk": 310,
    "range": 190,
    "spd": 0.48,
    "interval": 1.8,
    "recharge": 13,
    "icon": "🎯",
    "motion": "scientist",
    "attackType": "single",
    "kb": 4,
    "series": "通常交換所・実用隊",
    "rarity": "R",
    "gachaCost": 2800,
    "ability": {
      "name": "遠距離射撃",
      "desc": "長めの射程から安定した単体攻撃を行う。"
    },
    "id": 107
  },
  {
    "name": "赤対策木下",
    "cost": 500,
    "hp": 1250,
    "atk": 185,
    "range": 95,
    "spd": 0.68,
    "interval": 1.2,
    "recharge": 12,
    "icon": "🔥",
    "motion": "power",
    "attackType": "area",
    "kb": 4,
    "series": "通常交換所・実用隊",
    "rarity": "R",
    "gachaCost": 2800,
    "ability": {
      "name": "赤の足止め",
      "desc": "赤属性の敵を30%の確率で2秒間、移動速度30%低下させる。",
      "slow": {
        "trait": "赤",
        "chance": 0.3,
        "factor": 0.7,
        "duration": 2
      }
    },
    "id": 108
  },
  {
    "name": "木下ブラスター",
    "cost": 420,
    "hp": 1550,
    "atk": 175,
    "range": 78,
    "spd": 0.78,
    "interval": 1.15,
    "recharge": 11,
    "icon": "💥",
    "motion": "basic",
    "attackType": "area",
    "kb": 3,
    "series": "通常交換所・実用隊",
    "rarity": "R",
    "gachaCost": 2600,
    "ability": {
      "name": "小範囲攻撃",
      "desc": "複数の敵をまとめて攻撃できる扱いやすい前衛。"
    },
    "id": 109
  },
  {
    "name": "天使迎撃木下・改",
    "cost": 900,
    "hp": 2200,
    "atk": 520,
    "range": 120,
    "spd": 0.55,
    "interval": 1.45,
    "recharge": 18,
    "icon": "✨",
    "motion": "awakened",
    "attackType": "area",
    "kb": 4,
    "trait": "天使",
    "series": "通常交換所・実用隊",
    "rarity": "SR",
    "gachaCost": 5200,
    "ability": {
      "name": "天使迎撃",
      "desc": "天使属性に1.8倍のダメージを与える。",
      "strong": {
        "天使": 1.8
      }
    },
    "id": 110
  },
  {
    "name": "バリア割り木下",
    "cost": 1000,
    "hp": 1850,
    "atk": 430,
    "range": 150,
    "spd": 0.5,
    "interval": 1.65,
    "recharge": 19,
    "icon": "🚀",
    "motion": "scientist",
    "attackType": "single",
    "kb": 4,
    "trait": "宇宙",
    "series": "通常交換所・実用隊",
    "rarity": "SR",
    "gachaCost": 5500,
    "ability": {
      "name": "バリアブレイク",
      "desc": "宇宙属性に少し強く、バリアを破壊できる。",
      "strong": {
        "宇宙": 1.5
      },
      "barrierBreak": true
    },
    "id": 111
  },
  {
    "name": "木下ノックバック",
    "cost": 850,
    "hp": 1750,
    "atk": 360,
    "range": 130,
    "spd": 0.62,
    "interval": 1.5,
    "recharge": 17,
    "icon": "🥊",
    "motion": "power",
    "attackType": "area",
    "kb": 4,
    "series": "通常交換所・実用隊",
    "rarity": "SR",
    "gachaCost": 5200,
    "ability": {
      "name": "押し返し",
      "desc": "攻撃時20%の確率で敵を後退させる。",
      "knockbackChance": 0.2
    },
    "id": 112
  },
  {
    "name": "木下サポーター",
    "cost": 1200,
    "hp": 2600,
    "atk": 300,
    "range": 170,
    "spd": 0.45,
    "interval": 1.8,
    "recharge": 22,
    "icon": "📡",
    "motion": "scientist",
    "attackType": "area",
    "kb": 4,
    "series": "通常交換所・実用隊",
    "rarity": "SR",
    "gachaCost": 6000,
    "ability": {
      "name": "戦術妨害",
      "desc": "攻撃時20%の確率で敵の移動速度を20%低下させる（2秒）。",
      "slow": {
        "trait": "*",
        "chance": 0.2,
        "factor": 0.8,
        "duration": 2
      }
    },
    "id": 113
  },
  {
    "name": "木下シールド隊長",
    "cost": 1500,
    "hp": 6200,
    "atk": 440,
    "range": 85,
    "spd": 0.4,
    "interval": 1.8,
    "recharge": 28,
    "icon": "🛡️",
    "motion": "king",
    "attackType": "area",
    "kb": 3,
    "series": "通常交換所・実用隊",
    "rarity": "SR",
    "gachaCost": 6500,
    "ability": {
      "name": "防衛指揮",
      "desc": "全属性から受けるダメージを10%軽減する。",
      "resist": {
        "*": 0.9
      }
    },
    "id": 114
  },
  {
    "id": 115,
    "name": "ノヴァ木下",
    "cost": 4500,
    "hp": 68750,
    "atk": 166666,
    "range": 350,
    "spd": 1,
    "interval": 10,
    "recharge": 180,
    "icon": "🌌",
    "motion": "super",
    "attackType": "area",
    "kb": 5,
    "trait": "宇宙",
    "rarity": "UR",
    "series": "呪いの木下達",
    "limitedExchange": true,
    "limitedExchangeSeries": "呪いの木下達",
    "airAttack": false,
    "skills": [
      {
        "id": "nova_mode_switch",
        "name": "モード切替",
        "description": "出撃中に破壊モードと連射モードを切り替える。編成上段（1〜5番）から出撃している場合のみ使用でき、切り替え時に木下マネー3,000を消費する。",
        "trigger": "プレイヤー操作",
        "cooldown": 0
      },
      {
        "id": "nova_destruction_cannon",
        "name": "破壊砲",
        "description": "破壊モード中、敵を撃破するたびに破壊欲を1段階獲得（最大5段階）。5段階に到達すると破壊欲を消費して、前方の敵に攻撃力120%分のダメージを与える。",
        "trigger": "破壊モード中に敵を5体撃破した時"
      },
      {
        "id": "nova_minigun",
        "name": "ミニガン",
        "description": "連射モード中、攻撃時15%で発動。8秒間、破壊モード時の攻撃力の50%を追加し、攻撃時35%で敵をふっとばす。再使用まで20秒。",
        "trigger": "連射モード中の攻撃時",
        "chance": 0.15,
        "cooldown": 20,
        "duration": 8
      }
    ],
    "ability": {
      "name": "切り替え・破壊砲・ミニガン",
      "desc": "編成上段から出撃中、木下マネー3,000で破壊モード／連射モードを切り替える。味方の攻撃力・攻撃間隔バフ無効。編成中は初期所持金+750。呪い・波動無効。一度に受けるダメージは最大HPの25%。破壊モード：呪いの木下達1体につき攻撃力+150%・攻撃間隔+2秒。神話1体につき攻撃力-95%（最大-500%）。与ダメージの5%回復。敵撃破で破壊欲を獲得（最大5）：1個につき攻撃力+25%・攻撃間隔-1秒。5個で破壊砲を発射し、敵に攻撃力120%のダメージ。連射モード：対空可能。攻撃ごとに攻撃間隔-0.01秒（最大0.4秒）、攻撃力+3%（最大180%）。黒・天使・神話・無属性に5倍ダメージ、被ダメージ75%軽減。攻撃時15%でミニガン発動（8秒間、破壊モード攻撃力の50%を上乗せ・攻撃時35%吹っ飛ばし、再使用20秒）。",
      "modeSwitch": true,
      "curseImmune": true,
      "waveImmune": true,
      "waveImmunity": true,
      "resist": {
        "黒": 0.25,
        "天使": 0.25,
        "神話": 0.25,
        "無": 0.25
      },
      "strong": {
        "黒": 5,
        "天使": 5,
        "神話": 5,
        "無": 5
      }
    }
  },
  {
    "name": "創世木下",
    "cost": 6000,
    "hp": 5000000,
    "atk": 250000,
    "range": 650,
    "spd": 1.5,
    "interval": 2,
    "recharge": 180,
    "icon": "🌌",
    "motion": "super",
    "attackType": "area",
    "kb": 1,
    "trait": "神話",
    "rarity": "UR",
    "series": "創世神話",
    "specialReward": true,
    "eventReward": "創世木下",
    "genesisAbilities": [
      {
        "id": 1,
        "name": "次元崩壊",
        "desc": "攻撃時50%で通常攻撃の200%の追加攻撃"
      },
      {
        "id": 2,
        "name": "神殺し",
        "desc": "全属性に2.5倍ダメージ"
      },
      {
        "id": 3,
        "name": "創世の一撃",
        "desc": "10%で通常攻撃の500%の追加攻撃"
      },
      {
        "id": 4,
        "name": "空間断裂",
        "desc": "範囲内の敵をまとめて攻撃"
      },
      {
        "id": 5,
        "name": "絶対防壁",
        "desc": "被ダメージ90%軽減。主要な妨害・能力封印に耐性"
      },
      {
        "id": 6,
        "name": "永遠の再生",
        "desc": "自身の最大HPの1%を毎秒回復"
      },
      {
        "id": 7,
        "name": "不滅の創世",
        "desc": "撃破時に一度だけ最大HPの50%で復活"
      },
      {
        "id": 8,
        "name": "ダメージ変換",
        "desc": "実際に受けたHPダメージの10%を回復"
      },
      {
        "id": 9,
        "name": "時間支配",
        "desc": "攻撃時30%で敵全体を3秒停止"
      },
      {
        "id": 10,
        "name": "全能の呪縛",
        "desc": "攻撃した敵の攻撃力・移動速度を50%低下、攻撃間隔を2倍。10秒"
      },
      {
        "id": 11,
        "name": "能力封印",
        "desc": "攻撃時20%で敵の特殊能力を5秒封印"
      },
      {
        "id": 12,
        "name": "重力支配",
        "desc": "攻撃範囲内の敵の移動速度を80%低下。5秒"
      },
      {
        "id": 13,
        "name": "歴史の頂点",
        "desc": "編成中、味方全員のHP・攻撃力を50%上昇"
      },
      {
        "id": 14,
        "name": "全軍再生",
        "desc": "出撃中、味方全員の最大HPの0.5%を毎秒回復"
      },
      {
        "id": 15,
        "name": "神速の祝福",
        "desc": "編成中、味方全員の移動速度を20%上昇"
      },
      {
        "id": 16,
        "name": "世界創造",
        "desc": "出撃20秒ごとに攻撃力+20%。最大3段階"
      },
      {
        "id": 17,
        "name": "終焉と始まり",
        "desc": "HP25%以下で一度覚醒。攻撃力2倍、攻撃間隔0.5秒、被ダメージ95%軽減。20秒"
      },
      {
        "id": 18,
        "name": "天罰の雷",
        "desc": "5回の攻撃動作ごとに敵全体へ攻撃力300%の雷撃"
      },
      {
        "id": 19,
        "name": "無限貫通",
        "desc": "範囲攻撃で射程内の敵すべてを攻撃"
      },
      {
        "id": 20,
        "name": "崩壊連鎖",
        "desc": "敵撃破時、周囲へ攻撃力200%の爆発"
      },
      {
        "id": 21,
        "name": "神域の追撃",
        "desc": "攻撃時25%で通常攻撃の50%の追撃を3回"
      },
      {
        "id": 22,
        "name": "存在消去",
        "desc": "攻撃時5%で通常攻撃の500%の追加ダメージ"
      },
      {
        "id": 23,
        "name": "七彩神壁",
        "desc": "10秒ごとに最大HPの10%分のシールドを獲得"
      },
      {
        "id": 24,
        "name": "絶対領域",
        "desc": "自身の周囲の味方の被ダメージを30%軽減"
      },
      {
        "id": 25,
        "name": "災厄吸収",
        "desc": "自身への状態異常を50%の確率で無効化し、HP5%回復"
      },
      {
        "id": 26,
        "name": "不動の神体",
        "desc": "停止・鈍足・吹っ飛ばし・ワープなど主要妨害を無効化"
      },
      {
        "id": 27,
        "name": "終末装甲",
        "desc": "HP50%以下で被ダメージをさらに20%軽減"
      },
      {
        "id": 28,
        "name": "永劫拘束",
        "desc": "攻撃時15%で敵を5秒停止"
      },
      {
        "id": 29,
        "name": "神威剥奪",
        "desc": "攻撃した敵の強化効果を10秒間無効化"
      },
      {
        "id": 30,
        "name": "空間封鎖",
        "desc": "攻撃時、敵のワープ・瞬間移動能力を8秒封印"
      },
      {
        "id": 31,
        "name": "永久刻印",
        "desc": "攻撃した敵が受けるダメージを30%増加。10秒"
      },
      {
        "id": 32,
        "name": "次元追放",
        "desc": "攻撃時5%で敵を3秒間戦場から退場させる"
      },
      {
        "id": 33,
        "name": "全軍蘇生",
        "desc": "味方1体をステージ中一度だけHP30%で復活"
      },
      {
        "id": 34,
        "name": "創世の加護",
        "desc": "編成中、味方全員の状態異常を50%の確率で無効化"
      },
      {
        "id": 35,
        "name": "無限供給",
        "desc": "編成中、味方の再生産時間を15%短縮"
      },
      {
        "id": 36,
        "name": "世界改変",
        "desc": "開始30秒後から20秒ごとに敵全体へランダムな弱体効果"
      },
      {
        "id": 37,
        "name": "万物の創造主",
        "desc": "60秒ごとに攻撃力・最大HPが10%上昇。最大5段階"
      }
    ],
    "ability": {
      "name": "創世の37能力",
      "desc": "37種類の固有能力を持つ歴代最強キャラクター。詳細はキャラクター詳細画面を確認。",
      "genesis": true,
      "strong": {
        "無": 2.5,
        "赤": 2.5,
        "青": 2.5,
        "黒": 2.5,
        "浮": 2.5,
        "鋼": 2.5,
        "天使": 2.5,
        "宇宙": 2.5,
        "古代": 2.5,
        "神話": 2.5,
        "ゾンビ": 2.5,
        "光": 2.5,
        "闇": 2.5,
        "白": 2.5
      },
      "damageReduce": {
        "chance": 1,
        "factor": 0.1
      },
      "curseImmune": true,
      "stopImmune": true,
      "slowImmune": true,
      "attackDownImmune": true,
      "sealImmune": true,
      "waveImmune": true,
      "waveImmunity": true,
      "surgeImmune": true,
      "surgeImmunity": true,
      "knockbackImmune": true,
      "warpImmune": true,
      "yabayabaImmune": true,
      "reflectImmune": true
    },
    "id": 116
  },
  {
    "name": "創世討伐兵器・零式",
    "cost": 5200,
    "hp": 4500000,
    "atk": 700000,
    "range": 950,
    "spd": 0.35,
    "interval": 3.2,
    "recharge": 240,
    "icon": "🛡️",
    "motion": "super",
    "attackType": "area",
    "kb": 2,
    "trait": "無",
    "rarity": "UR",
    "series": "創世神話",
    "specialReward": true,
    "eventReward": "創世討伐兵器・零式",
    "ability": {
      "name": "終焉特化・創世核破壊",
      "desc": "創世木下・終焉形態に20倍、その他の神話属性に4倍のダメージ。終焉形態から受けるダメージを75%軽減。波動・停止・鈍足・呪い・攻撃力低下・能力封印・吹っ飛ばし・ワープを無効化。攻撃時20%で攻撃力300%の追加砲撃。",
      "genesisCounter": true,
      "stopImmune": true,
      "slowImmune": true,
      "curseImmune": true,
      "attackDownImmune": true,
      "sealImmune": true,
      "waveImmune": true,
      "waveImmunity": true,
      "surgeImmune": true,
      "surgeImmunity": true,
      "knockbackImmune": true,
      "warpImmune": true
    },
    "id": 117
  },
  {
    "name": "ヒットマン木下",
    "cost": 2200,
    "hp": 95800,
    "atk": 8900,
    "secondAtk": 5100,
    "multiAttack": [
      8900,
      5100
    ],
    "range": 220,
    "spd": 0.8,
    "interval": 1,
    "recharge": 75,
    "icon": "🎯",
    "motion": "super",
    "attackType": "single",
    "kb": 2,
    "trait": "黒",
    "rarity": "伝説レア",
    "series": "神話編全48ステージクリア報酬",
    "specialReward": true,
    "chapterReward": 7,
    "skills": [
      {
        "id": "hitman_tracking",
        "name": "追跡マーカー",
        "description": "出撃時に追跡マーカーを3発発射する。各マーカーは命中した敵に攻撃力の500%分のダメージを与える。",
        "trigger": "出撃時",
        "count": 3,
        "interval": 0.2,
        "damageMultiplier": 5
      },
      {
        "id": "hitman_ride",
        "name": "騎乗",
        "description": "出撃直後に発動し、以後15秒ごとに3秒間騎乗する。騎乗中は移動速度+2、烈波無効。",
        "trigger": "出撃時・以後15秒ごと",
        "interval": 15,
        "duration": 3,
        "speedBonus": 2
      },
      {
        "id": "hitman_counter",
        "name": "転移反撃",
        "description": "敵からダメージを受けた時、25%の確率で発動（最大2回）。敵の近くへ転移し、攻撃力の1500%分のダメージを与え、実ダメージの50%を回復する。再使用まで15秒。",
        "trigger": "敵からダメージを受けた時",
        "chance": 0.25,
        "cooldown": 15,
        "maxUses": 2,
        "damageMultiplier": 15,
        "healRatio": 0.5,
        "teleportOffset": 70
      }
    ],
    "ability": {
      "name": "神話狩り・追跡戦術",
      "desc": "神話属性に5倍ダメージ。神話属性から受けるダメージを85%軽減し、受けたHPダメージの80%を反射。呪い・停止・波動・反射を無効化。通常攻撃は1段目8,900、0.2秒後に2段目5,100。攻撃ごとに再出撃時間を3%短縮し、75円を獲得。攻撃した敵の回復を2秒封じる。敵撃破ごとに全ステータス+10%（最大+200%）。",
      "strong": {
        "神話": 5
      },
      "resist": {
        "神話": 0.15
      },
      "curseImmune": true,
      "stopImmune": true,
      "waveImmune": true,
      "reflectImmune": true
    },
    "curseImmune": true,
    "stopImmune": true,
    "waveImmune": true,
    "reflectImmune": true,
    "id": 118
  },
  {
    "id": 119,
    "name": "アイスワイバーン",
    "cost": 5200,
    "hp": 120000,
    "atk": 22000,
    "range": 250,
    "spd": 0.5,
    "interval": 1.3,
    "recharge": 180,
    "icon": "🐲❄️",
    "motion": "super",
    "attackType": "area",
    "kb": 10,
    "trait": "氷",
    "rarity": "UR",
    "series": "ワイバーンシリーズ",
    "skills": [
      {
        "id": "ice_wyvern_flight",
        "name": "飛行",
        "description": "55秒おきに3秒間飛行モードになり、攻撃せず敵を無視して移動速度+1で進む。通過した地面に4秒間アイスエリアを残し、侵入した敵を凍結させ、1秒ごとに最大HPの15%ダメージを与える。",
        "trigger": "55秒ごと",
        "cooldown": 55,
        "duration": 3
      },
      {
        "id": "ice_wyvern_beam",
        "name": "冷凍ビーム",
        "description": "46秒おきに前方射程600へ冷凍ビームを発射。命中した敵に攻撃力250%のダメージと3秒凍結を与え、与えたダメージの10%を回復（合計2回まで）。",
        "trigger": "46秒ごと",
        "cooldown": 46,
        "range": 600
      }
    ],
    "ability": {
      "name": "氷竜の加護",
      "desc": "神話属性からの被ダメージ65%軽減・与ダメージ5倍・受けたダメージの30%回復。神話属性の戦闘中の能力強化を解除し、神話属性からのスキルダメージ25%反射、被弾時100%で3秒回復不能、神話属性からのデバフ無効。神話属性へのダメージ上限を通常の2倍まで緩和。自身の被ダメージは最大HPの15%まで。攻撃ごとに攻撃力+5%（最大+100%）・攻撃間隔-2%（最大-30%）。烈波・呪い・停止無効。パワーシールド所持者へ3倍ダメージ。攻撃時55%クリティカル・烈波Lv2・ヤバヤバLv2。被弾ごとに全ステータス+3%（最大+90%）。",
      "iceWyvern": {
        "mythDamageTaken": 0.35,
        "mythDamageDealt": 5,
        "mythHeal": 0.3,
        "skillReflect": 0.25,
        "damageCap": 0.15,
        "attackPerHit": 0.05,
        "attackMax": 1,
        "intervalPerHit": 0.02,
        "intervalMax": 0.3,
        "damageGrowthPerHit": 0.03,
        "damageGrowthMax": 0.9,
        "shieldMultiplier": 3,
        "flightInterval": 55,
        "flightDuration": 3,
        "flightSpeed": 1.5,
        "beamInterval": 46,
        "beamRange": 600,
        "beamFreeze": 3,
        "beamHeal": 0.1,
        "beamHits": 2,
        "areaFreeze": 3,
        "areaDamage": 0.15
      },
      "criticalChance": 0.55,
      "criticalMultiplier": 2,
      "phoenixSurgeLevel": 2,
      "phoenixSurgeChance": 1,
      "yabayaba": 2,
      "yabayabaChance": 1,
      "curseImmune": true,
      "stopImmune": true,
      "surgeImmune": true
    }
  },
  {
    "id": 120,
    "name": "最高神:ゼウス",
    "cost": 6000,
    "hp": 210000,
    "atk": 250000,
    "secondAtk": 125000,
    "thirdAtk": 78000,
    "multiAttack": [
      250000,
      125000,
      78000
    ],
    "range": 600,
    "senseRange": 600,
    "detectRange": 600,
    "attackRangeBands": [
      {
        "min": -100,
        "max": 75,
        "damage": 250000
      },
      {
        "min": 125,
        "max": 200,
        "damage": 125000
      },
      {
        "min": 200,
        "max": 400,
        "damage": 78000
      }
    ],
    "spd": 0.4,
    "interval": 3,
    "recharge": 180,
    "icon": "⚡👑",
    "motion": "super",
    "attackType": "area",
    "kb": 3,
    "trait": "最高神",
    "rarity": "UR",
    "series": "最高神",
    "ability": {
      "name": "最高神の雷霆・神授の加護",
      "desc": "天使・神話・赤・宇宙から受けるダメージ55%軽減、同属性へ5倍ダメージ。受けた実HPダメージの30%を回復し20%反射。全デバフ無効。一度に受けるダメージは最大HPの11%まで。ふっとばす・呪い・停止・烈波を無効化し、波動ダメージを50%軽減。攻撃時33%で停止2秒または攻撃力80%低下2秒。敵数×2%攻撃力上昇（最大+20%）。登場時パワーシールド100,000。敵撃破ごとにシールド2%回復。シールド被弾時、吸収ダメージ10%反射・停止1秒・射程80%低下3秒。被弾ごとに防御力+5%（最大+75%）。",
      "strong": {
        "天使": 5,
        "神話": 5,
        "赤": 5,
        "宇宙": 5
      },
      "resist": {
        "天使": 0.45,
        "神話": 0.45,
        "赤": 0.45,
        "宇宙": 0.45
      },
      "curseImmune": true,
      "stopImmune": true,
      "surgeImmune": true,
      "slowImmune": true,
      "attackDownImmune": true,
      "warpImmune": true,
      "yabayabaImmune": true,
      "sealImmune": true,
      "knockbackImmune": true,
      "waveDamageFactor": 0.5,
      "damageCap": 0.11,
      "zeusAlly": {
        "bands": [
          {
            "min": -100,
            "max": 75,
            "damage": 250000
          },
          {
            "min": 125,
            "max": 200,
            "damage": 125000
          },
          {
            "min": 200,
            "max": 400,
            "damage": 78000
          }
        ],
        "defensePerHit": 0.05,
        "defenseMax": 0.75,
        "enemyCountAttack": 0.02,
        "enemyCountMax": 0.2,
        "shield": 100000,
        "shieldKillRestore": 0.02,
        "shieldReflect": 0.1,
        "shieldStop": 1,
        "shieldRangeFactor": 0.2,
        "shieldRangeDuration": 3,
        "stopChance": 0.33,
        "stopDuration": 2,
        "attackDownChance": 0.33,
        "attackDownFactor": 0.2,
        "attackDownDuration": 2
      }
    },
    "strong": {
      "天使": 5,
      "神話": 5,
      "赤": 5,
      "宇宙": 5
    },
    "resist": {
      "天使": 0.45,
      "神話": 0.45,
      "赤": 0.45,
      "宇宙": 0.45
    },
    "curseImmune": true,
    "stopImmune": true,
    "surgeImmune": true,
    "knockbackImmune": true,
    "waveDamageFactor": 0.5
  },
  {
    "id": 121,
    "name": "最高神:ハスター",
    "cost": 1800,
    "hp": 500000,
    "atk": 122000,
    "range": 180,
    "spd": 0.8,
    "interval": 5.5,
    "recharge": 180,
    "icon": "🟡👑",
    "motion": "super",
    "attackType": "single",
    "kb": 3,
    "trait": "最高神",
    "rarity": "UR",
    "series": "最高神",
    "skills": [
      {
        "id": "hastur_tentacle",
        "name": "触手",
        "description": "自身が9回攻撃するたび、または波動で25回ダメージを受けると発動。2秒後に倒れる触手を前方に生やし、触手から射程-20〜350の範囲に自身の残りHP分のダメージを与える。撃破数×7%だけ射程・攻撃間隔以外のステータスが上昇（最大25%）。CTなし。",
        "trigger": "9回攻撃／波動被弾25回",
        "attackCount": 9,
        "waveCount": 25,
        "buffPerKill": 0.07,
        "buffMax": 0.25,
        "delay": 2,
        "rangeMin": -20,
        "rangeMax": 350
      },
      {
        "id": "hastur_king_in_yellow",
        "name": "黄衣の王",
        "description": "26秒間隔で発動し、次の2回の通常攻撃が命中した対象に100%で5秒間「狂気」を付与する。CT26秒。",
        "trigger": "26秒ごと",
        "interval": 26,
        "attacks": 2,
        "duration": 5,
        "chance": 1
      }
    ],
    "ability": {
      "name": "黄衣の王",
      "desc": "神話・天使・黒・赤から受けるダメージ55%軽減、同属性へ3倍。被ダメージ25%回復・15%反射。スキル被ダメージ50%軽減。最大HP15%を超える一撃を受けない。パワーシールドへ3倍。攻撃時25%で3秒間ハスターの呪い。編成中の最高神1体につき味方全体+75%（最大+200%）、最高神以外1体につき最高神+55%（最大+350%）。呪い・停止・攻撃力低下・ふっとばす無効。最大HP15%分の被ダメージごと攻撃力+7%・攻撃間隔5%短縮（上限なし）。被弾ごと防御力+5%（最大45%）。味方の被ダメージ50%肩代わり、味方全体+5%（最大+50%）。通常攻撃は防御無視。パワーシールド持ちの敵から攻撃されると相手攻撃力50%低下3秒。",
      "strong": {
        "神話": 3,
        "天使": 3,
        "黒": 3,
        "赤": 3
      },
      "resist": {
        "神話": 0.45,
        "天使": 0.45,
        "黒": 0.45,
        "赤": 0.45
      },
      "curseImmune": true,
      "stopImmune": true,
      "attackDownImmune": true,
      "knockbackImmune": true,
      "ignoreDefense": true,
      "pierceDefense": true,
      "hastur": {
        "enemy": false,
        "damageCap": 0.15,
        "heal": 0.25,
        "reflect": 0.15,
        "defensePerHit": 0.05,
        "defenseMax": 0.45,
        "attackThreshold": 0.15,
        "attackStep": 0.07,
        "intervalStep": 0.05,
        "skillReduction": 0.5,
        "shieldDamage": 3,
        "curseChance": 0.25,
        "curseBuff": 0.15,
        "madnessBuff": 0.25,
        "teamBuffStep": 0.05,
        "teamBuffMax": 0.5,
        "tentacleAttacks": 9,
        "tentacleWaves": 25,
        "tentacleBuffStep": 0.07,
        "tentacleBuffMax": 0.25,
        "madnessInterval": 26,
        "madnessAttacks": 2
      }
    },
    "strong": {
      "神話": 3,
      "天使": 3,
      "黒": 3,
      "赤": 3
    },
    "resist": {
      "神話": 0.45,
      "天使": 0.45,
      "黒": 0.45,
      "赤": 0.45
    },
    "curseImmune": true,
    "stopImmune": true,
    "attackDownImmune": true,
    "knockbackImmune": true
  }
] as Card[]
const WORLD_WIDTH = 1900
const MAX_TIME = 180
const STEP = 0.1
const FRAME_INTERVAL = 0.5
const MAX_UNITS_PER_SIDE = 48

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-ai-worker-token, x-operator-broadcast-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS' }
})
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const arr = <T>(v: unknown): T[] => Array.isArray(v) ? v as T[] : []
const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}
const traits = (v: unknown) => BattleCore.traits(v)
const matchTrait = (rule: unknown, target: Unit|Card) => BattleCore.matchesTrait(target,rule)
const traitMultiplier = (table: any, target: Unit|Card, mode: 'min'|'max'='max') => BattleCore.traitMultiplier(table,target,mode)
const makeRng = (seedText: string) => BattleCore.createRng(seedText)

function powerMultiplier(ai: AIAccount) {
  const c = arr<number>(ai.chapter_clears)
  return 1 + num(c[0])*0.01 + num(c[1])*0.002 + num(c[2])*0.003
}
function activeCard(ai: AIAccount, id: number): Card {
  const base = CARDS[id]
  if (!base) throw new Error('Unknown character ID: '+id)
  const activity = obj(ai.activity)
  const forms = arr<any>(activity.aiCharForm)
  const evolved = arr<any>(activity.aiNormalEvolved)
  const chapterEvolved = obj(activity.aiChapterRewardEvolved)
  const isSecond = Number(forms[id]) === 2 || evolved[id] === true || chapterEvolved[String(id)] === true
  return isSecond && base.secondForm ? { ...base, ...base.secondForm, ability: base.secondForm.ability || base.ability } : base
}
function stat(ai: AIAccount, id: number, key: 'hp'|'atk'|'range'|'spd'|'interval') {
  const card = activeCard(ai,id)
  const lv = clamp(Math.floor(num(arr<number>(ai.char_levels)[id],1)),1,30)
  const base = num(card[key])
  const scaled = BattleCore.scaleLevelStat(base,lv,key === 'hp' || key === 'atk' ? 1.04 : 1)
  const power = powerMultiplier(ai)
  if (key === 'range' || key === 'spd') return scaled*power
  if (key === 'interval') return scaled/power
  return scaled*power
}
function strategyPick(ai: AIAccount, form: number[], affordable: number[], rng: ()=>number, time: number) {
  if (!affordable.length) return -1
  const strategy = String(ai.strategy || 'balanced')
  if (strategy === 'economy' && time < 12) return -1
  if (strategy === 'boss' && time < 9 && rng() < 0.8) return -1
  const list = affordable.slice()
  const c = (id:number) => activeCard(ai,id)
  if (strategy === 'rush' || strategy === 'swarm') list.sort((a,b)=>c(a).cost-c(b).cost)
  else if (strategy === 'tank') list.sort((a,b)=>stat(ai,b,'hp')-stat(ai,a,'hp'))
  else if (strategy === 'boss') list.sort((a,b)=>stat(ai,b,'atk')-stat(ai,a,'atk'))
  else if (strategy === 'counter') list.sort((a,b)=>c(b).range-c(a).range)
  else if (strategy === 'economy') list.sort((a,b)=>stat(ai,b,'atk')-stat(ai,a,'atk'))
  else list.sort((a,b)=>(stat(ai,b,'atk')/Math.max(1,c(b).cost))-(stat(ai,a,'atk')/Math.max(1,c(a).cost)))
  const skill = clamp(num(ai.skill,.25),.05,.995)
  const jitter = rng() < (.08+(1-skill)*.22) ? Math.floor(rng()*list.length) : 0
  return list[Math.min(jitter,list.length-1)]
}
function aiFormation(ai: AIAccount, banned: Set<number>) {
  const owned = new Set(arr<number>(ai.owned_characters).map(x=>Math.floor(num(x))).filter(x=>x>=0&&x<CARDS.length))
  let form = [...new Set(arr<number>(ai.formation).map(x=>Math.floor(num(x))).filter(x=>owned.has(x)&&!banned.has(x)))]
  if (form.length < 5) {
    form = [...owned].filter(id=>!banned.has(id)).sort((a,b)=>
      (stat(ai,b,'atk')+stat(ai,b,'hp')*.25)/(CARDS[b].cost||1) -
      (stat(ai,a,'atk')+stat(ai,a,'hp')*.25)/(CARDS[a].cost||1)).slice(0,10)
  }
  if (!form.length) form = [0]
  return form.slice(0,10)
}
function applyFormation(side: any, u: Unit) {
  const has = (name:string) => side.form.some((id:number)=>CARDS[id]?.name===name)
  if (has('覇風')) {
    const urCount = side.form.filter((id:number)=>['UR','ウルトラレア'].includes(String(CARDS[id]?.rarity))).length
    const normalCount = side.form.length-urCount
    const isUr = ['UR','ウルトラレア'].includes(String(CARDS[u.card_id]?.rarity))
    const m = isUr ? 1+Math.min(.95,urCount*.35) : 1+Math.min(2,normalCount*.35)
    u.max_hp*=m;u.hp*=m;u.atk*=m;u.spd*=m;u.interval/=m
  }
  if (has('MiraiK') && u.name!=='MiraiK' && traits(u.trait).includes('天使')) {
    u.max_hp*=1.1;u.hp*=1.1;u.atk*=1.1;u.range*=1.1;u.spd*=1.1;u.interval/=1.1
  }
}
function buildUnit(side:any, cardId:number, nextId:number, time:number): Unit {
  const card=activeCard(side.ai,cardId), hp=Math.max(1,Math.round(stat(side.ai,cardId,'hp')))
  // Preserve card-level flags (metal, airAttack, immunity flags, boss roles, etc.) so
  // the server simulation evaluates the same metadata as the browser battle engine.
  const u:Unit={...card,id:nextId,card_id:cardId,name:String(card.name),icon:String(card.icon||'❔'),side:side.key,
    x:side.key==='team1'?WORLD_WIDTH-145:145,hp,max_hp:hp,atk:Math.max(1,stat(side.ai,cardId,'atk')),
    range:Math.max(1,stat(side.ai,cardId,'range')),spd:Math.max(0,stat(side.ai,cardId,'spd')),
    interval:Math.max(.15,stat(side.ai,cardId,'interval')),cooldown:.15,cost:num(card.cost),recharge:num(card.recharge),
    trait:String(card.trait||'無'),attack_type:String(card.attackType||'single'),ability:obj(card.ability),
    kb:Math.max(1,num(card.kb,1)),state:'move',slow_until:0,slow_factor:1,stop_until:0,
    attack_down_until:0,attack_down_factor:1,cursed_until:0,barrier:num(card.barrier),
    power_shield:num(card.powerShield||card.ability?.powerShield||card.ability?.zeusAlly?.shield),power_shield_max:num(card.powerShield||card.ability?.powerShield||card.ability?.zeusAlly?.shield),kill_stacks:0,target_id:null}
  if (u.name==='ノヴァ木下') u.ability={...u.ability,modeSwitch:false}
  return u
}
function damageDealt(attacker:Unit,target:Unit,rng:()=>number,time:number,baseAttack=num(attacker.atk,1)) {
  const normalizedAttacker={...attacker,maxhp:attacker.max_hp,killAttackStacks:attacker.kill_stacks,
    attackDownUntil:attacker.attack_down_until,attackDownFactor:attacker.attack_down_factor,
    cursedUntil:attacker.cursed_until,cursedAttackFactor:attacker.cursed_until>time ? .5 : 1}
  const normalizedTarget={...target,maxhp:target.max_hp,cursedUntil:target.cursed_until}
  const sealed=BattleCore.isAbilitySealed(normalizedAttacker,time)
  if(sealed)(normalizedAttacker as any).phoenixLowHpMultiplier=0
  return BattleCore.calculateAttackDamage({attacker:normalizedAttacker,target:normalizedTarget,
    baseAttack,time,ability:sealed?{}:(attacker.ability||{}),random:rng,traitMultiplier}).damage
}

function applyResolvedDamage(attacker:Unit,target:Unit,rawDamage:number,time:number,rng:()=>number,emit:(type:string,side:string,unit:Unit|null,target:Unit|null,value?:number,detail?:string)=>void,flags:any={}) {
  if(target.hp<=0)return 0
  const normalizedTarget={...target,maxhp:target.max_hp,cursedUntil:target.cursed_until,barrier:target.barrier,power_shield:target.power_shield}
  const iceWyvernDamage=BattleCore.resolveIceWyvernIncomingDamage({attacker,target:normalizedTarget,damage:rawDamage})
  const miraiKDamage=BattleCore.resolveMiraiKIncomingDamage({target:normalizedTarget,attacker,damage:iceWyvernDamage.damage,time})
  let incoming=miraiKDamage.damage
  if(miraiKDamage.capped){
    attacker.attack_down_until=Math.max(num(attacker.attack_down_until),miraiKDamage.attackDownUntil)
    attacker.attack_down_factor=Math.min(num(attacker.attack_down_factor,1),miraiKDamage.attackDownFactor)
    attacker.cursed_until=Math.max(num(attacker.cursed_until),miraiKDamage.cursedUntil)
    attacker.cursedAttackFactor=miraiKDamage.cursedAttackFactor
  }
  const zeusTarget=target.name==='最高神:ゼウス'
  if(zeusTarget){
    if(BattleCore.matchesTrait(attacker,['天使','神話','赤','宇宙']))incoming*=.45
    incoming=Math.min(incoming,Math.max(1,target.max_hp*.11))
    incoming*=1-Math.min(.75,num(target.zeusDefenseStacks)*.05)
  }
  if(iceWyvernDamage.mythologyAttacker){
    attacker.healing_disabled_until=time+3
    attacker.kill_stacks=0;attacker.muscleKillStacks=0;attacker.muscleRightBonusAtk=0;attacker.mythSoulAtkFactor=1
    if(attacker.iceWyvernBaseAtk)attacker.atk=Number(attacker.iceWyvernBaseAtk)
    if(attacker.iceWyvernBaseSpd)attacker.spd=Number(attacker.iceWyvernBaseSpd)
    if(attacker.iceWyvernBaseInterval)attacker.interval=Number(attacker.iceWyvernBaseInterval)
  }
  const resolution=BattleCore.resolveDamage({
    target:normalizedTarget,
    attacker,damage:incoming,time,ability:{},random:rng,traitMultiplier,curseFactor:1
  })
  target.barrier=resolution.barrier;target.power_shield=resolution.powerShield;target.hp=resolution.hp
  const iceGrowth=BattleCore.resolveIceWyvernAfterHit({target:{...target,maxhp:target.max_hp},attacker,actualDamage:resolution.damage})
  if(iceGrowth.applied){
    target.hp=iceGrowth.hp;target.max_hp=iceGrowth.maxHp;target.atk=iceGrowth.atk;target.spd=iceGrowth.spd
    target.range=iceGrowth.range;target.interval=iceGrowth.interval;target.iceDamageStacks=iceGrowth.iceDamageStacks
    target.iceWyvernBaseStats=iceGrowth.iceWyvernBaseStats;target.iceWyvernAppliedGrowth=iceGrowth.iceWyvernAppliedGrowth
  }
  const shieldDamage=Math.max(0,num(normalizedTarget.power_shield)-num(target.power_shield))
  if(zeusTarget&&(resolution.damage>0||shieldDamage>0)){
    if(resolution.damage>0){
      target.hp=Math.min(target.max_hp,target.hp+Math.round(resolution.damage*.3))
      if(attacker.hp>0&&!flags.zeusReflection)applyResolvedDamage(target,attacker,Math.max(1,Math.round(resolution.damage*.2)),time,rng,emit,{zeusReflection:true})
    }
    target.zeusDefenseStacks=Math.min(15,num(target.zeusDefenseStacks)+1)
    if(shieldDamage>0&&attacker.hp>0&&!flags.zeusReflection){
      applyResolvedDamage(target,attacker,Math.max(1,Math.round(shieldDamage*.1)),time,rng,emit,{zeusReflection:true})
      if(!attacker.stopImmune&&!attacker.ability?.stopImmune)attacker.stop_until=Math.max(num(attacker.stop_until),time+1)
      if(attacker.zeus_range_base==null)attacker.zeus_range_base=attacker.range
      attacker.range=Math.max(1,num(attacker.zeus_range_base)*.2)
      attacker.zeus_range_until=time+3
    }
  }
  if(target.hp<=0&&attacker.name==='最高神:ゼウス'){
    const maxShield=num(attacker.power_shield_max)
    attacker.power_shield=Math.min(maxShield,num(attacker.power_shield)+maxShield*num(attacker.ability?.zeusAlly?.shieldKillRestore,.02))
  }
  if(attacker.name==='最高神:ゼウス'&&resolution.damage>0&&!flags.zeusReflection){
    const z=attacker.ability?.zeusAlly||{},chance=Math.max(0,Math.min(1,num(z.stopChance)))
    if(rng()<chance){
      const canStop=!(target.stopImmune||target.ability?.stopImmune)
      const canLower=!(target.attackDownImmune||target.ability?.attackDownImmune)
      if(rng()<.5&&canStop)target.stop_until=Math.max(num(target.stop_until),time+num(z.stopDuration,2))
      else if(canLower){target.attack_down_until=Math.max(num(target.attack_down_until),time+num(z.attackDownDuration,2));target.attack_down_factor=num(z.attackDownFactor,.2)}
      else if(canStop)target.stop_until=Math.max(num(target.stop_until),time+num(z.stopDuration,2))
    }
  }
  emit('hit',attacker.side,attacker,target,resolution.damage)
  if(target.hp<=0)emit('death',target.side,target,attacker)
  return resolution.damage
}
function snapshot(time:number,sides:any[],events:any[],iceZones:any[] = []) {
  return {t:Number(time.toFixed(2)),team1_base_hp:Math.max(0,Math.round(sides[0].base_hp)),
    team2_base_hp:Math.max(0,Math.round(sides[1].base_hp)),team1_money:Math.floor(sides[0].money),
    team2_money:Math.floor(sides[1].money),units:sides.flatMap((s:any)=>s.units.filter((u:Unit)=>u.hp>0).map((u:Unit)=>({
      id:u.id,card_id:u.card_id,side:u.side,x:Number(u.x.toFixed(1)),hp:Math.max(0,Math.round(u.hp)),
      max_hp:Math.max(1,Math.round(u.max_hp)),state:u.state,trait:u.trait,barrier:Math.round(u.barrier),
      power_shield:Math.round(u.power_shield),slow:u.slow_until>time,stopped:u.stop_until>time,frozen:num(u.ice_frozen_until)>time,is_flying:!!u.isFlying
    }))),ice_zones:iceZones.filter((z:any)=>z.until>time).map((z:any)=>({id:z.id,x:Number(z.x.toFixed(1)),remaining:Number((z.until-time).toFixed(2)),side:z.source.side}))}
}
function simulate(ai1:AIAccount,ai2:AIAccount,team1:any,team2:any,form1:number[],form2:number[],seed:string) {
  const rng=makeRng(seed),sides:any[]=[
    {key:'team1',team_id:Number(team1.id),name:String(team1.alliance_name||'チーム1'),ai:ai1,form:form1,money:1500,base_hp:5000,units:[],recharge:Array(CARDS.length).fill(0),timer:0,cooldown:.25,used:[]},
    {key:'team2',team_id:Number(team2.id),name:String(team2.alliance_name||'チーム2'),ai:ai2,form:form2,money:1500,base_hp:5000,units:[],recharge:Array(CARDS.length).fill(0),timer:0,cooldown:.25,used:[]}
  ]
  const frames:any[]=[],events:any[]=[];const clock=BattleCore.createClock(0);let time=clock.now(),nextId=1,nextFrame=0
  const emit=(type:string,side:string,unit:Unit|null,target:Unit|null,value=0,detail='')=>events.push({
    t:Number(time.toFixed(2)),type,side,unit_id:unit?.id??null,target_id:target?.id??null,
    character:unit?.name??null,target:target?.name??null,value:Math.round(value),detail
  })
  const spawn=(side:any,id:number)=>{
    if(side.units.filter((u:Unit)=>u.hp>0).length>=MAX_UNITS_PER_SIDE)return
    const u=buildUnit(side,id,nextId++,time);applyFormation(side,u);side.units.push(u);side.recharge[id]=u.recharge
    side.used.push(id);emit('spawn',side.key,u,null,u.hp)
  }
  const hit=(side:any,target:Unit,attacker:Unit,damage:number)=>{
    if(target.hp<=0)return
    const dealt=applyResolvedDamage(attacker,target,damage,time,rng,emit)
    const sealed=BattleCore.isAbilitySealed(attacker,time)
    const a=sealed?{}:(attacker.ability||{})
    // A defeated unit cannot receive new status effects or knockback.
    if(target.hp>0&&!sealed){
      const effects=BattleCore.resolveOnHitEffects({attacker,target,time,random:rng,knockbackDistance:45,guaranteedKnockbackDistance:48})
      target.slow_until=effects.slowUntil;target.slow_factor=effects.slowFactor;target.stop_until=effects.stopUntil
      target.cursed_until=effects.cursedUntil;target.attack_down_until=effects.attackDownUntil;target.attack_down_factor=effects.attackDownFactor
      if(effects.knockback)target.x+=target.side==='team1'?effects.knockback:-effects.knockback
      for(const effect of effects.effects)emit('skill',attacker.side,attacker,target,0,effect)
    }
    if(a.splash&&a.splash>0) {
      const other=sides.find((x:any)=>x.key!==attacker.side)
      for(const splashTarget of other.units)if(splashTarget!==target&&splashTarget.hp>0&&Math.abs(splashTarget.x-target.x)<70){
        const extra=Math.max(1,Math.round(dealt*num(a.splash)))
        applyResolvedDamage(attacker,splashTarget,extra,time,rng,emit)
      }
    }
    if(target.hp<=0&&a.killAttackStack){attacker.kill_stacks=Math.min(30,attacker.kill_stacks+1);attacker.atk=Math.round(attacker.atk*(1+num(a.killAttackStack.perKill,.05)))}
  }
  const processZeusStrikes=()=>{
    for(const side of sides){
      const opposing=sides.find((entry:any)=>entry.key!==side.key)
      for(const source of side.units){
        const queue=arr<any>(source.zeus_strike_queue)
        if(!queue.length||source.hp<=0)continue
        const pending:any[]=[]
        for(const strike of queue){
          if(num(strike.at)>time+1e-6){pending.push(strike);continue}
          const bands=arr<any>(source.ability?.zeusAlly?.bands)
          const band=bands[Number(strike.bandIndex)]
          if(!band)continue
          const senseRange=Math.max(0,num(source.senseRange??source.detectRange,600))
          const targets=opposing.units.filter((target:Unit)=>{
            if(target.hp<=0||(target as any).muscleGrabbedBy)return false
            const distance=(Number(target.x)-Number(source.x))*Number(strike.direction||1)
            return distance>=num(band.min)&&distance<=num(band.max)&&Math.abs(distance)<=senseRange
          })
          const enemyCount=opposing.units.filter((target:Unit)=>target.hp>0).length
          const bonus=1+Math.min(num(source.ability?.zeusAlly?.enemyCountMax,.2),enemyCount*num(source.ability?.zeusAlly?.enemyCountAttack,.02))
          for(const target of targets){
            const traitBonus=BattleCore.matchesTrait(target,['天使','神話','赤','宇宙'])?5:1
            const rawDamage=Math.max(1,Math.round(num(band.damage,source.atk)*bonus*traitBonus))
            const damage=damageDealt(source,target,rng,time,rawDamage)
            emit('attack',side.key,source,target,0,'ゼウス雷撃 '+(Number(strike.bandIndex)+1)+'段目')
            hit(side,target,source,damage)
          }
          if(!targets.length)emit('skill',side.key,source,null,0,'ゼウス雷撃 '+(Number(strike.bandIndex)+1)+'段目・空振り')
        }
        source.zeus_strike_queue=pending
      }
    }
  }
  const processFollowups=()=>{
    for(const side of sides){
      const opposing=sides.find((entry:any)=>entry.key!==side.key)
      for(const attacker of side.units){
        const queue=arr<any>(attacker.followup_attacks)
        if(!queue.length||attacker.hp<=0)continue
        const pending:any[]=[]
        for(const followup of queue){
          if(num(followup.at)>time+1e-6){pending.push(followup);continue}
          const target=opposing.units.find((unit:Unit)=>unit.id===Number(followup.target_id)&&unit.hp>0)
          if(!target)continue
          const damage=damageDealt(attacker,target,rng,time,num(followup.damage,attacker.atk))
          emit('attack',side.key,attacker,target,0,'追撃 '+Number(followup.hitIndex+1)+'段目')
          hit(side,target,attacker,damage)
          const stopChance=num(attacker.waveStopChance??attacker.ability?.waveStopChance)
          if(!BattleCore.isAbilitySealed(attacker,time)&&stopChance>0&&rng()<stopChance)
            target.stop_until=Math.max(target.stop_until,time+num(attacker.waveStopDuration??attacker.ability?.waveStopDuration,1))
        }
        attacker.followup_attacks=pending
      }
    }
  }
  const iceZones:any[]=[];let nextIceZoneId=1
  const freezeByIce=(target:Unit,duration:number,source:Unit)=>{
    if(!target||target.hp<=0||target.freezeImmune||target.ability?.freezeImmune||target.ability?.iceWyvern?.freezeImmune)return
    target.ice_frozen_until=Math.max(num(target.ice_frozen_until),time+duration)
    target.ice_freeze_source_id=source.id
  }
  const tickIceWyvern=()=>{
    for(let i=iceZones.length-1;i>=0;i--){
      const zone=iceZones[i]
      if(time>=zone.until){iceZones.splice(i,1);continue}
      const opposing=sides.find(side=>side.key!==zone.source.side)
      for(const target of opposing.units){
        if(target.hp<=0||Math.abs(target.x-zone.x)>48)continue
        freezeByIce(target,Math.max(.2,zone.until-time),zone.source)
        if(time>=num(target.ice_zone_tick_at)){
          target.ice_zone_tick_at=time+1
          const damage=Math.max(1,Math.round(target.max_hp*.15))
          applyResolvedDamage(zone.source,target,damage,time,rng,emit)
        }
      }
    }
    for(const actorSide of sides){
      for(const actor of actorSide.units){
        const a=actor.ability?.iceWyvern
        if(actor.hp<=0||!a)continue
        actor.ice_skill_next_flight=num(actor.ice_skill_next_flight,time+num(a.flightInterval,55))
        actor.ice_skill_next_beam=num(actor.ice_skill_next_beam,time+num(a.beamInterval,46))
        if(actor.isFlying&&Math.abs(actor.x-num(actor.ice_last_zone_x,-9999))>=28){
          actor.ice_last_zone_x=actor.x
          iceZones.push({id:nextIceZoneId++,x:actor.x,until:time+4,source:actor})
          emit('skill',actor.side,actor,null,0,'氷結エリア生成')
        }
        if(time>=actor.ice_skill_next_flight&&!actor.isFlying){
          actor.ice_skill_next_flight=time+num(a.flightInterval,55)
          actor.isFlying=true;actor.ice_flight_until=time+num(a.flightDuration,3)
          actor.ice_wyvern_base_spd=actor.ice_wyvern_base_spd??actor.spd
          actor.spd=num(a.flightSpeed,1.5);actor.target_id=null;actor.state='fly'
          emit('skill',actor.side,actor,null,0,'飛行開始')
        }
        if(actor.isFlying&&time>=num(actor.ice_flight_until)){
          actor.isFlying=false;actor.spd=num(actor.ice_wyvern_base_spd,actor.spd)
          emit('skill',actor.side,actor,null,0,'飛行終了')
        }
        if(time>=actor.ice_skill_next_beam){
          actor.ice_skill_next_beam=time+num(a.beamInterval,46)
          const opposing=sides.find(side=>side.key!==actor.side)
          const candidates=opposing.units.filter((target:Unit)=>target.hp>0&&
            (actor.side==='team1'?target.x<actor.x:target.x>actor.x)&&
            Math.abs(target.x-actor.x)<=num(a.beamRange,600))
            .sort((x:Unit,y:Unit)=>Math.abs(x.x-actor.x)-Math.abs(y.x-actor.x)).slice(0,num(a.beamHits,2))
          for(const target of candidates){
            let damage=Math.max(1,Math.round(actor.atk*2.5))
            if(BattleCore.matchesTrait(target,'神話'))damage=Math.round(damage*num(a.mythDamageDealt,1))
            applyResolvedDamage(actor,target,damage,time,rng,emit)
            freezeByIce(target,num(a.beamFreeze,3),actor)
            if(!num(actor.healing_disabled_until)||time>=num(actor.healing_disabled_until))actor.hp=Math.min(actor.max_hp,actor.hp+Math.round(damage*num(a.beamHeal,0)))
            emit('skill',actor.side,actor,target,damage,'冷凍ビーム')
          }
        }
      }
    }
  }
  while(time<MAX_TIME&&sides.every(s=>s.base_hp>0)) {
    for(const side of sides) {
      const skill=clamp(num(side.ai.skill,.25),.05,.995)
      side.money=Math.min(6000,side.money+(112+skill*28)*STEP)
      side.timer+=STEP;side.cooldown=Math.max(0,side.cooldown-STEP)
      for(let i=0;i<side.recharge.length;i++)side.recharge[i]=Math.max(0,side.recharge[i]-STEP)
      const affordable=side.form.filter((id:number)=>side.money>=num(activeCard(side.ai,id).cost)&&side.recharge[id]<=0)
      if(side.cooldown<=0&&affordable.length) {
        const st=String(side.ai.strategy||'balanced')
        const wait=st==='economy'&&side.timer<12||st==='boss'&&side.timer<9&&rng()<.8
        if(!wait&&(side.timer>=.35||rng()>skill*.75)) {
          const id=strategyPick(side.ai,side.form,affordable,rng,time)
          if(id>=0){side.money-=num(activeCard(side.ai,id).cost);spawn(side,id);side.timer=0;side.cooldown=Math.max(.72,st==='rush'?.85:st==='swarm'?.9:st==='economy'?1.8:st==='boss'?1.55:1.2)}
        }
      }
    }
    tickIceWyvern()
    processZeusStrikes()
    processFollowups()
    for(const side of sides) {
      const other=sides.find((x:any)=>x.key!==side.key)
      for(const u of side.units) {
        if(u.hp<=0)continue
        if(u.zeus_range_until&&time>=num(u.zeus_range_until)){u.range=Math.max(1,num(u.zeus_range_base,u.range));u.zeus_range_base=null;u.zeus_range_until=0}
        if(u.isFlying&&u.ability?.iceWyvern){
          u.state='fly';u.x=BattleCore.advancePosition({x:u.x,speed:u.spd,dt:STEP,direction:side.key==='team1'?-1:1,minX:side.key==='team1'?120:undefined,maxX:side.key==='team2'?WORLD_WIDTH-96:undefined});continue
        }
        if(num(u.ice_frozen_until)>time){u.state='frozen';continue}
        u.cooldown=Math.max(0,u.cooldown-STEP)
        if(u.stop_until>time){u.state='stopped';continue}
        const activeEnemies=other.units.filter((v:Unit)=>v.hp>0)
        const currentTarget=activeEnemies.find((v:Unit)=>v.id===u.target_id)||null
        const target=BattleCore.selectTarget(activeEnemies,currentTarget,{x:u.x,range:u.name==='最高神:ゼウス'?num(u.senseRange??u.detectRange,u.range):u.range+30,inRange:(v:Unit)=>{const distance=Number(v.x)-Number(u.x);return u.name==='最高神:ゼウス'?Math.abs(distance)<=num(u.senseRange??u.detectRange,u.range):u.attack_type==='allrange'?distance>=num(u.minRange)&&distance<=num(u.maxRange,u.range):Math.abs(distance)<u.range+30},canTarget:(v:Unit)=>!((v as any).isFlying||(v as any).is_flying)||!!u.airAttack||!!u.ability?.airAttack}) as Unit|null
        if(target) {
          u.state='attack';u.target_id=target.id
          if(u.cooldown<=0&&u.stop_until<=time) {
            if(u.name==='最高神:ゼウス'&&Array.isArray(u.ability?.zeusAlly?.bands)){
              const direction=Number(target.x)-Number(u.x)<0?-1:1
              if(!Array.isArray(u.zeus_strike_queue))u.zeus_strike_queue=[]
              u.ability.zeusAlly.bands.forEach((band:any,index:number)=>u.zeus_strike_queue.push({at:time+index*.5,bandIndex:index,direction}))
              emit('attack',side.key,u,target,0,'ゼウス雷撃開始')
              u.cooldown=u.interval
              continue
            }
            const inAttackRange=(v:Unit)=>{const distance=Number(v.x)-Number(u.x);return u.attack_type==='allrange'?distance>=num(u.minRange)&&distance<=num(u.maxRange,u.range):Math.abs(distance)<u.range+30};const targets=u.attack_type==='area'||u.attack_type==='allrange'?activeEnemies.filter(inAttackRange):[target]
            emit('attack',side.key,u,target)
            for(const t of targets) {
              const sequence=u.name==='最高神:ゼウス'?[u.atk]:(Array.isArray(u.multiAttack)&&u.multiAttack.length?u.multiAttack:[u.atk,...(u.secondAtk!=null?[u.secondAtk]:[]),...(u.thirdAtk!=null?[u.thirdAtk]:[])])
              let damage=damageDealt(u,t,rng,time,num(sequence[0],u.atk))
              hit(side,t,u,damage)
              for(let hitIndex=1;hitIndex<sequence.length;hitIndex++){
                if(!Array.isArray(u.followup_attacks))u.followup_attacks=[]
                u.followup_attacks.push({at:time+hitIndex*.1,target_id:t.id,damage:num(sequence[hitIndex],u.atk),hitIndex})
              }
              const a=u.ability||{}
              if(a.wave&&rng()<num(a.waveChance,1)) {
                for(const w of other.units)if(w.hp>0&&Math.abs(w.x-t.x)<160&&w!==t){const d=Math.max(1,Math.round(u.atk*.55));const dealt=applyResolvedDamage(u,w,d,time,rng,emit);if(dealt>0)emit('wave',side.key,u,w,dealt)}
              }
              if(a.phoenixSurgeLevel&&rng()<num(a.phoenixSurgeChance,1)) {
                for(const w of other.units)if(w.hp>0&&Math.abs(w.x-u.x)<=num(a.phoenixSurgeMax,200)){const d=Math.max(1,Math.round(u.atk*.35));const dealt=applyResolvedDamage(u,w,d,time,rng,emit);if(dealt>0)emit('surge',side.key,u,w,dealt)}
              }
            }
            u.cooldown=u.interval
          }
        } else {
          u.state='move';u.target_id=null
          const slow=u.slow_until>time?u.slow_factor:1
          u.x=BattleCore.advancePosition({x:u.x,speed:u.spd,dt:STEP,direction:side.key==='team1'?-1:1,slowFactor:slow})
          const reached=side.key==='team1'?u.x<=118:u.x>=WORLD_WIDTH-178
          if(reached&&u.cooldown<=0) {
            side // keep type inference stable for Deno
            other.base_hp=Math.max(0,other.base_hp-u.atk);emit('base_hit',side.key,u,null,u.atk);u.cooldown=u.interval
          }
        }
      }
      side.units=side.units.filter((u:Unit)=>u.hp>0||u.x< -100||u.x>WORLD_WIDTH+100)
    }
    processZeusStrikes()
    time=Number(clock.advance(STEP).toFixed(4))
    if(time+1e-6>=nextFrame) {frames.push(snapshot(time,sides,events,iceZones));nextFrame+=FRAME_INTERVAL}
  }
  if(sides[0].base_hp===sides[1].base_hp) {
    const hp1=sides[0].units.reduce((a:number,u:Unit)=>a+Math.max(0,u.hp),0)
    const hp2=sides[1].units.reduce((a:number,u:Unit)=>a+Math.max(0,u.hp),0)
    if(hp1===hp2)sides[rng()<.5?0:1].base_hp=0
    else (hp1>hp2?sides[1]:sides[0]).base_hp=0
  }
  const winner=sides[0].base_hp>sides[1].base_hp?sides[0]:sides[1]
  emit('match_end',winner.key,null,null,winner.base_hp,'server_authoritative')
  frames.push(snapshot(time,sides,events,iceZones))
  return {winner_team_id:winner.team_id,duration_seconds:Number(time.toFixed(2)),
    replay:{version:ENGINE_VERSION,seed,world_width:WORLD_WIDTH,frame_interval:FRAME_INTERVAL,
      team1:{id:sides[0].team_id,name:sides[0].name},team2:{id:sides[1].team_id,name:sides[1].name},
      winner_team_id:winner.team_id,frames,events}}
}

let db:any
function getDb() {
  if(db)return db
  if(!PROJECT_URL||!SERVICE_KEY)throw new Error('Supabase server configuration missing')
  db=createClient(PROJECT_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  return db
}
async function runBattle(matchId:number,gameNo:number) {
  const client=getDb()
  const {data:match,error:matchError}=await client.from('kwl_matches').select('*').eq('id',matchId).maybeSingle()
  if(matchError||!match)throw new Error(matchError?.message||'KWL match not found')
  if(!['ready','live'].includes(String(match.status)))throw new Error('Match is not active')
  const presentation=obj(obj(match.live_state).presentation)
  const phase=String(presentation.phase||'pending')
  if(phase!=='live')throw new Error('KWL match is not in live phase')
  if(Number(presentation.game_number||0)!==gameNo)throw new Error('Requested game is not the current live game')
  const {data:teams,error:teamsError}=await client.from('kwl_teams').select('id,leader_type,roster,alliance_name').eq('tournament_key',String(match.tournament_key))
  if(teamsError)throw teamsError
  const team1=arr<any>(teams).find(t=>Number(t.id)===Number(match.team1_id))
  const team2=arr<any>(teams).find(t=>Number(t.id)===Number(match.team2_id))
  const fullAi=(t:any)=>t&&String(t.leader_type)==='ai'&&arr<any>(t.roster).length>=5&&arr<any>(t.roster).every(p=>String(p.type||'player')==='ai'&&/^AI-\d{1,4}$/.test(String(p.id||'')))
  if(!fullAi(team1)||!fullAi(team2))throw new Error('This server replay is only for full AI vs AI matches')
  const {data:game,error:gameError}=await client.from('kwl_games').select('*').eq('match_id',matchId).eq('game_number',gameNo).maybeSingle()
  if(gameError||!game)throw new Error(gameError?.message||'KWL game not found')
  if(['completed','cancelled'].includes(String(game.status))) {
    const {data:old}=await client.from('kwl_spectator_battles').select('*').eq('match_id',matchId).eq('game_number',gameNo).maybeSingle()
    if(old?.status==='completed')return old
    throw new Error('KWL game is already completed without a replay')
  }
  const {data:players,error:playersError}=await client.from('kwl_game_players').select('*').eq('match_id',matchId).eq('game_number',gameNo)
  if(playersError)throw playersError
  const side1=arr<any>(players).find(p=>Number(p.team_id)===Number(team1.id)&&String(p.player_type)==='ai')
  const side2=arr<any>(players).find(p=>Number(p.team_id)===Number(team2.id)&&String(p.player_type)==='ai')
  if(arr<any>(players).length!==2||!side1||!side2)throw new Error('Both AI players must be registered for this game')
  const parseId=(v:any)=>{const m=String(v||'').match(/^AI-(\d{1,4})$/);return m?Number(m[1]):0}
  const id1=parseId(side1.player_id),id2=parseId(side2.player_id)
  if(!id1||!id2)throw new Error('AI account IDs are invalid')
  const {data:accounts,error:accountsError}=await client.from('ai_accounts').select('*').in('account_id',[id1,id2])
  if(accountsError)throw accountsError
  const ai1=arr<AIAccount>(accounts).find(a=>Number(a.account_id)===id1)
  const ai2=arr<AIAccount>(accounts).find(a=>Number(a.account_id)===id2)
  if(!ai1||!ai2)throw new Error('AI account data is missing')
  const {data:locks,error:locksError}=await client.from('kwl_character_locks').select('team_id,character_key,first_game_number').eq('match_id',matchId)
  if(locksError)throw locksError
  const previousBans=(teamId:number)=>new Set(arr<any>(locks).filter(x=>Number(x.team_id)===teamId&&Number(x.first_game_number)<gameNo).flatMap(x=>{
    const key=String(x.character_key||'');const id=Number(key)
    const index=Number.isInteger(id)&&String(id)===key?id:CARDS.findIndex(c=>c.name===key)
    return index>=0?[index]:[]
  }))
  const form1=aiFormation(ai1,previousBans(Number(team1.id)))
  const form2=aiFormation(ai2,previousBans(Number(team2.id)))
  if(!form1.length||!form2.length)throw new Error('No eligible AI characters remain')
  const seed='kwl:'+matchId+':'+gameNo+':'+Math.min(id1,id2)+':'+Math.max(id1,id2)
  const workerId='kwl-server-replay:'+matchId+':'+gameNo+':'+crypto.randomUUID()
  const {data:claimed,error:claimError}=await client.rpc('kwl_claim_spectator_battle',{
    p_match_id:matchId,p_game_number:gameNo,p_worker_id:workerId,p_lease_seconds:240
  })
  if(claimError)throw claimError
  if(claimed!==true) {
    const {data:existing}=await client.from('kwl_spectator_battles').select('*').eq('match_id',matchId).eq('game_number',gameNo).maybeSingle()
    if(existing?.status==='completed')return existing
    return {status:'simulating',match_id:matchId,game_number:gameNo}
  }
  try {
    const result=simulate(ai1,ai2,team1,team2,form1,form2,seed)
    const now=new Date().toISOString()
    const {error:saveError}=await client.from('kwl_spectator_battles').update({
      status:'completed',winner_team_id:result.winner_team_id,duration_seconds:result.duration_seconds,
      replay:result.replay,started_at:now,completed_at:now,lease_until:null,updated_at:now,error:null
    }).eq('match_id',matchId).eq('game_number',gameNo).eq('worker_id',workerId)
    if(saveError)throw saveError
    // Official BO5 results are written only by ai-worker after it receives this replay.
    return {status:'completed',match_id:matchId,game_number:gameNo,winner_team_id:result.winner_team_id,duration_seconds:result.duration_seconds,replay:result.replay}
  } catch(error) {
    await client.from('kwl_spectator_battles').update({
      status:'failed',lease_until:null,error:String(error instanceof Error?error.message:error),updated_at:new Date().toISOString()
    }).eq('match_id',matchId).eq('game_number',gameNo).eq('worker_id',workerId)
    throw error
  }
}


function rehearsalSafeEqual(a:string,b:string) {
  if(a.length!==b.length)return false
  let diff=0
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i)
  return diff===0
}
function rehearsalCredentialValid(req:Request) {
  const supplied=req.headers.get('x-operator-broadcast-token')||''
  const expected=REHEARSAL_OPERATOR_KEY
  if(!supplied||!expected||supplied.length!==expected.length)return false
  return rehearsalSafeEqual(supplied,expected)
}
async function rehearsalRunSnapshot(client:any,runId:string,includeReplays=false) {
  const {data:run,error:runError}=await client.from('kwl_rehearsal_runs').select(
    'id,status,phase,current_game_number,engine_version,team1_id,team2_id,team1_name,team2_name,team1_roster,team2_roster,team1_wins,team2_wins,games_completed,winner_team_id,started_at,phase_updated_at,completed_at,error'
  ).eq('id',runId).maybeSingle()
  if(runError||!run)throw runError||new Error('Rehearsal run not found')
  const columns=includeReplays
    ? 'game_number,status,winner_team_id,duration_seconds,engine_version,team1_player_id,team1_player_name,team2_player_id,team2_player_name,replay,completed_at'
    : 'game_number,status,winner_team_id,duration_seconds,engine_version,team1_player_id,team1_player_name,team2_player_id,team2_player_name,completed_at'
  const {data:games,error:gamesError}=await client.from('kwl_rehearsal_games').select(columns)
    .eq('run_id',runId).order('game_number',{ascending:true})
  if(gamesError)throw gamesError
  return {ok:true,run,games:arr<any>(games)}
}
async function startIsolatedRehearsal(client:any) {
  const {data:accounts,error:accountError}=await client.from('ai_accounts').select('*')
    .order('rp',{ascending:false}).limit(100)
  if(accountError)throw accountError
  const candidates=arr<AIAccount>(accounts).filter(a=>arr<number>(a.owned_characters).length>0)
  if(candidates.length<10)throw new Error('10 eligible AI accounts are required to form two five-player rosters')
  const rosterPlayer=(a:AIAccount)=>({
    player_id:'AI-'+String(a.account_id),
    player_name:String(a.name||('AI-'+String(a.account_id))),
    account_id:Number(a.account_id),
    strategy:String(a.strategy||'balanced'),
    skill:num(a.skill,.25)
  })
  const team1Roster=[0,2,4,6,8].map(i=>rosterPlayer(candidates[i]))
  const team2Roster=[1,3,5,7,9].map(i=>rosterPlayer(candidates[i]))
  const team1={id:-1001,alliance_name:'KWLサーバーリハーサル A'}
  const team2={id:-1002,alliance_name:'KWLサーバーリハーサル B'}
  const now=new Date().toISOString()
  const {data:run,error:runError}=await client.from('kwl_rehearsal_runs').insert({
    status:'running',phase:'team_intro',current_game_number:1,phase_updated_at:now,
    engine_version:ENGINE_VERSION,team1_id:team1.id,team2_id:team2.id,
    team1_name:team1.alliance_name,team2_name:team2.alliance_name,
    team1_ai_account_id:team1Roster[0].account_id,team2_ai_account_id:team2Roster[0].account_id,
    team1_roster:team1Roster,team2_roster:team2Roster,started_at:now
  }).select('id').single()
  if(runError||!run?.id)throw runError||new Error('Failed to create rehearsal run')
  const snapshot=await rehearsalRunSnapshot(client,String(run.id),false)
  return {...snapshot,run_id:String(run.id)}
}
async function advanceIsolatedRehearsal(client:any,runId:string) {
  const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if(!valid.test(runId))throw new Error('Invalid rehearsal run ID')
  const {data:initial,error:readError}=await client.from('kwl_rehearsal_runs').select('*').eq('id',runId).maybeSingle()
  if(readError||!initial)throw readError||new Error('Rehearsal run not found')
  const phase=String(initial.phase||'team_intro')
  const gameNo=Math.floor(num(initial.current_game_number,1))
  const now=new Date().toISOString()
  if(phase==='completed'||phase==='failed')return await rehearsalRunSnapshot(client,runId,false)
  if(phase==='team_intro') {
    await client.from('kwl_rehearsal_runs').update({phase:'player_selection',phase_updated_at:now})
      .eq('id',runId).eq('phase','team_intro').eq('current_game_number',gameNo)
    return await rehearsalRunSnapshot(client,runId,false)
  }
  if(phase==='player_selection'||phase==='simulating') {
    if(phase==='player_selection') {
      const {data:claimed,error:claimError}=await client.from('kwl_rehearsal_runs').update({phase:'simulating',phase_updated_at:now})
        .eq('id',runId).eq('phase','player_selection').eq('current_game_number',gameNo).select('id').maybeSingle()
      if(claimError)throw claimError
      if(!claimed)return await rehearsalRunSnapshot(client,runId,false)
    }
    const {data:existing,error:existingError}=await client.from('kwl_rehearsal_games').select('*')
      .eq('run_id',runId).eq('game_number',gameNo).maybeSingle()
    if(existingError)throw existingError
    if(!existing) {
      const roster1=arr<any>(initial.team1_roster),roster2=arr<any>(initial.team2_roster)
      const player1=roster1[gameNo-1],player2=roster2[gameNo-1]
      if(!player1||!player2)throw new Error('The selected game player is missing from the five-player roster')
      const {data:accounts,error:accountsError}=await client.from('ai_accounts').select('*')
        .in('account_id',[Number(player1.account_id),Number(player2.account_id)])
      if(accountsError)throw accountsError
      const ai1=arr<AIAccount>(accounts).find(a=>Number(a.account_id)===Number(player1.account_id))
      const ai2=arr<AIAccount>(accounts).find(a=>Number(a.account_id)===Number(player2.account_id))
      if(!ai1||!ai2)throw new Error('Selected AI player data is missing')
      const form1=aiFormation(ai1,new Set<number>()),form2=aiFormation(ai2,new Set<number>())
      if(!form1.length||!form2.length)throw new Error('Selected AI player formation is empty')
      const team1={id:Number(initial.team1_id),alliance_name:String(initial.team1_name)}
      const team2={id:Number(initial.team2_id),alliance_name:String(initial.team2_name)}
      const seed='kwl-server-rehearsal:'+runId+':'+gameNo+':'+player1.account_id+':'+player2.account_id
      const result=simulate(ai1,ai2,team1,team2,form1,form2,seed)
      result.replay.team1.player={id:player1.player_id,name:player1.player_name}
      result.replay.team2.player={id:player2.player_id,name:player2.player_name}
      const {error:insertError}=await client.from('kwl_rehearsal_games').insert({
        run_id:runId,game_number:gameNo,status:'completed',
        winner_team_id:result.winner_team_id,duration_seconds:result.duration_seconds,
        engine_version:ENGINE_VERSION,replay:result.replay,
        team1_player_id:player1.player_id,team1_player_name:player1.player_name,
        team2_player_id:player2.player_id,team2_player_name:player2.player_name
      })
      if(insertError) {
        const {data:raceWinner}=await client.from('kwl_rehearsal_games').select('id')
          .eq('run_id',runId).eq('game_number',gameNo).maybeSingle()
        if(!raceWinner)throw insertError
      }
    }
    const {data:allGames,error:allGamesError}=await client.from('kwl_rehearsal_games').select('winner_team_id')
      .eq('run_id',runId)
    if(allGamesError)throw allGamesError
    const team1Wins=arr<any>(allGames).filter(g=>Number(g.winner_team_id)===Number(initial.team1_id)).length
    const team2Wins=arr<any>(allGames).filter(g=>Number(g.winner_team_id)===Number(initial.team2_id)).length
    const {error:updateError}=await client.from('kwl_rehearsal_runs').update({
      phase:'live',team1_wins:team1Wins,team2_wins:team2Wins,
      games_completed:arr<any>(allGames).length,phase_updated_at:new Date().toISOString()
    }).eq('id',runId).eq('phase','simulating')
    if(updateError)throw updateError
    return await rehearsalRunSnapshot(client,runId,false)
  }
  if(phase==='live') {
    await client.from('kwl_rehearsal_runs').update({phase:'result',phase_updated_at:now})
      .eq('id',runId).eq('phase','live').eq('current_game_number',gameNo)
    return await rehearsalRunSnapshot(client,runId,false)
  }
  if(phase==='result') {
    const won=Number(initial.team1_wins)>=3||Number(initial.team2_wins)>=3||gameNo>=5
    const winner=Number(initial.team1_wins)>Number(initial.team2_wins)?Number(initial.team1_id):Number(initial.team2_id)
    const {error:updateError}=await client.from('kwl_rehearsal_runs').update(won
      ? {phase:'completed',status:'completed',winner_team_id:winner,completed_at:now,phase_updated_at:now}
      : {phase:'break',phase_updated_at:now}
    ).eq('id',runId).eq('phase','result').eq('current_game_number',gameNo)
    if(updateError)throw updateError
    return await rehearsalRunSnapshot(client,runId,false)
  }
  if(phase==='break') {
    await client.from('kwl_rehearsal_runs').update({phase:'team_intro',current_game_number:gameNo+1,phase_updated_at:now})
      .eq('id',runId).eq('phase','break').eq('current_game_number',gameNo)
    return await rehearsalRunSnapshot(client,runId,false)
  }
  throw new Error('Unsupported rehearsal phase: '+phase)
}
async function readIsolatedRehearsal(client:any,body:Record<string,unknown>) {
  const runId=String(body.run_id||'')
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId))
    throw new Error('Invalid rehearsal run ID')
  const gameNo=Math.floor(num(body.game_number))
  if(gameNo>=1&&gameNo<=5) {
    const {data:game,error:gameError}=await client.from('kwl_rehearsal_games').select(
      'game_number,status,winner_team_id,duration_seconds,engine_version,team1_player_id,team1_player_name,team2_player_id,team2_player_name,replay,completed_at'
    ).eq('run_id',runId).eq('game_number',gameNo).maybeSingle()
    if(gameError||!game)throw gameError||new Error('Rehearsal game not found')
    const snapshot=await rehearsalRunSnapshot(client,runId,false)
    return {...snapshot,game}
  }
  return await rehearsalRunSnapshot(client,runId,false)
}
Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return json({ok:true})
  if(req.method!=='POST')return json({ok:false,error:'POST only'},405)
  try {
    const body=await req.json().catch(()=>({})) as Record<string,unknown>
    const action=String(body.action||'')
    const client=getDb()
    if(action==='rehearsal_read') {
      const result=await readIsolatedRehearsal(client,body)
      return json(result)
    }
    if(action==='rehearsal_start'||action==='rehearsal_advance') {
      if(!REHEARSAL_OPERATOR_KEY)return json({ok:false,error:'Existing operator token is not configured in Edge Function Secrets'},503)
      if(!rehearsalCredentialValid(req))return json({ok:false,error:'Operator authentication failed'},401)
      if(action==='rehearsal_start') {
        const result=await startIsolatedRehearsal(client)
        return json(result)
      }
      const runId=String(body.run_id||'')
      const result=await advanceIsolatedRehearsal(client,runId)
      return json(result)
    }
    const suppliedToken=req.headers.get('x-ai-worker-token')
    if(!AI_TOKEN||suppliedToken!==AI_TOKEN)return json({ok:false,error:'Unauthorized'},401)
    const matchId=Math.floor(num(body.match_id))
    const gameNo=Math.floor(num(body.game_number))
    if(matchId<=0||gameNo<1||gameNo>5)return json({ok:false,error:'Invalid match/game'},400)
    const result=await runBattle(matchId,gameNo)
    return json({ok:true,status:result.status,match_id:matchId,game_number:gameNo,winner_team_id:result.winner_team_id,duration_seconds:result.duration_seconds})
  } catch(error) {
    console.error('KWL spectator server battle failed:',error)
    return json({ok:false,error:error instanceof Error?error.message:String(error)},500)
  }
})
