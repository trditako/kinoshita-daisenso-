import { createClient } from 'npm:@supabase/supabase-js@2'
import '../../../battle-core.js'

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
}
const PROJECT_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AI_TOKEN = Deno.env.get('AI_WORKER_TOKEN') || ''
const ENGINE_VERSION = 'kwl-server-replay-v2-shared-runtime'
const CARDS = JSON.parse(await Deno.readTextFile(new URL('./character-data.json', import.meta.url))) as Card[]
const WORLD_WIDTH = 1900
const MAX_TIME = 180
const STEP = 0.1
const FRAME_INTERVAL = 0.5
const MAX_UNITS_PER_SIDE = 48

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-ai-worker-token',
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
  const u:Unit={id:nextId,card_id:cardId,name:String(card.name),icon:String(card.icon||'❔'),side:side.key,
    x:side.key==='team1'?WORLD_WIDTH-145:145,hp,max_hp:hp,atk:Math.max(1,stat(side.ai,cardId,'atk')),
    range:Math.max(1,stat(side.ai,cardId,'range')),spd:Math.max(0,stat(side.ai,cardId,'spd')),
    interval:Math.max(.15,stat(side.ai,cardId,'interval')),cooldown:.15,cost:num(card.cost),recharge:num(card.recharge),
    trait:String(card.trait||'無'),attack_type:String(card.attackType||'single'),ability:obj(card.ability),
    kb:Math.max(1,num(card.kb,1)),state:'move',slow_until:0,slow_factor:1,stop_until:0,
    attack_down_until:0,attack_down_factor:1,cursed_until:0,barrier:num(card.barrier),
    power_shield:num(card.powerShield||card.ability?.powerShield),kill_stacks:0,target_id:null}
  if (u.name==='ノヴァ木下') u.ability={...u.ability,modeSwitch:false}
  return u
}
function damageDealt(attacker:Unit,target:Unit,rng:()=>number,time:number) {
  const normalizedAttacker={...attacker,maxhp:attacker.max_hp,killAttackStacks:attacker.kill_stacks,
    attackDownUntil:attacker.attack_down_until,attackDownFactor:attacker.attack_down_factor,
    cursedUntil:attacker.cursed_until,cursedAttackFactor:attacker.cursed_until>time ? .5 : 1}
  const normalizedTarget={...target,maxhp:target.max_hp,cursedUntil:target.cursed_until}
  return BattleCore.calculateAttackDamage({attacker:normalizedAttacker,target:normalizedTarget,
    baseAttack:attacker.atk,time,ability:attacker.ability||{},random:rng,traitMultiplier}).damage
}

function damageTaken(target:Unit,attacker:Unit,damage:number,rng:()=>number,time:number) {
  const a=target.ability||{}
  let mult=traitMultiplier(a.resist,attacker,'min')
  if (a.damageReduce&&typeof a.damageReduce==='object'&&rng()<num(a.damageReduce.chance,.5))mult*=num(a.damageReduce.factor,.2)
  if (target.cursed_until>time)mult*=.7
  let out=Math.max(1,Math.round(damage*mult))
  const cap=num(a.damageCapRatio||a.iceWyvern?.damageCap||0)
  if (cap>0)out=Math.min(out,Math.max(1,Math.round(target.max_hp*cap)))
  return out
}
function snapshot(time:number,sides:any[],events:any[]) {
  return {t:Number(time.toFixed(2)),team1_base_hp:Math.max(0,Math.round(sides[0].base_hp)),
    team2_base_hp:Math.max(0,Math.round(sides[1].base_hp)),team1_money:Math.floor(sides[0].money),
    team2_money:Math.floor(sides[1].money),units:sides.flatMap((s:any)=>s.units.filter((u:Unit)=>u.hp>0).map((u:Unit)=>({
      id:u.id,card_id:u.card_id,side:u.side,x:Number(u.x.toFixed(1)),hp:Math.max(0,Math.round(u.hp)),
      max_hp:Math.max(1,Math.round(u.max_hp)),state:u.state,trait:u.trait,barrier:Math.round(u.barrier),
      power_shield:Math.round(u.power_shield),slow:u.slow_until>time,stopped:u.stop_until>time
    })))}
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
    let dealt=damageTaken(target,attacker,damage,rng,time)
    if(target.barrier>0){const absorbed=Math.min(target.barrier,dealt);target.barrier-=absorbed;dealt-=absorbed}
    if(target.power_shield>0&&dealt>0){const absorbed=Math.min(target.power_shield,dealt);target.power_shield-=absorbed;dealt-=absorbed}
    if(dealt>0)target.hp=Math.max(0,target.hp-dealt)
    emit('hit',attacker.side,attacker,target,dealt)
    const a=attacker.ability||{}
    if(a.slow&&!target.ability?.slowImmune&&!target.ability?.slowImmunity&&matchTrait(a.slow.trait||'*',target)&&rng()<num(a.slow.chance)) {
      target.slow_until=time+num(a.slow.duration,2);target.slow_factor=clamp(num(a.slow.factor,.6),.05,1)
      emit('skill',attacker.side,attacker,target,0,'鈍足')
    }
    if(a.slowChance&&!target.ability?.slowImmune&&!target.ability?.slowImmunity&&rng()<num(a.slowChance)) {target.slow_until=time+num(a.slowDuration,2);target.slow_factor=clamp(num(a.slowFactor,.6),.05,1);emit('skill',attacker.side,attacker,target,0,'鈍足')}
    if(a.stopChance&&!target.ability?.stopImmune&&!target.ability?.stopImmunity&&rng()<num(a.stopChance)) {target.stop_until=time+num(a.stopDuration,1);emit('skill',attacker.side,attacker,target,0,'停止')}
    if(a.curseChance&&!target.ability?.curseImmune&&!target.ability?.curseImmunity&&rng()<num(a.curseChance)) {target.cursed_until=time+num(a.curseDuration,2);emit('skill',attacker.side,attacker,target,0,'呪い')}
    if(a.sealChance&&!target.ability?.sealImmune&&!target.ability?.sealImmunity&&rng()<num(a.sealChance)) {target.cursed_until=time+num(a.sealDuration,3);emit('skill',attacker.side,attacker,target,0,'能力封印')}
    if(a.attackDownChance&&!target.ability?.attackDownImmune&&rng()<num(a.attackDownChance)) {target.attack_down_until=time+num(a.attackDownDuration,4);target.attack_down_factor=clamp(num(a.attackDownFactor,.5),.01,1);emit('skill',attacker.side,attacker,target,0,'攻撃力低下')}
    if(a.knockbackChance&&!target.ability?.knockbackImmune&&rng()<num(a.knockbackChance)) {target.x+=target.side==='team1'?45:-45;emit('skill',attacker.side,attacker,target,0,'ふっとばし')}
    if(a.guaranteeKnockback){target.x+=target.side==='team1'?48:-48;emit('skill',attacker.side,attacker,target,0,'確定ふっとばし')}
    if(a.splash&&a.splash>0) {
      const other=sides.find((x:any)=>x.key!==attacker.side)
      for(const splashTarget of other.units)if(splashTarget!==target&&splashTarget.hp>0&&Math.abs(splashTarget.x-target.x)<70){
        const extra=Math.max(1,Math.round(dealt*num(a.splash)));splashTarget.hp=Math.max(0,splashTarget.hp-extra);emit('hit',attacker.side,attacker,splashTarget,extra)
        if(splashTarget.hp<=0)emit('death',splashTarget.side,splashTarget,attacker)
      }
    }
    if(target.hp<=0) {
      emit('death',target.side,target,attacker)
      if(a.killAttackStack){attacker.kill_stacks=Math.min(30,attacker.kill_stacks+1);attacker.atk=Math.round(attacker.atk*(1+num(a.killAttackStack.perKill,.05)))}
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
    for(const side of sides) {
      const other=sides.find((x:any)=>x.key!==side.key)
      for(const u of side.units) {
        if(u.hp<=0)continue
        u.cooldown=Math.max(0,u.cooldown-STEP)
        if(u.stop_until>time){u.state='stopped';continue}
        const activeEnemies=other.units.filter((v:Unit)=>v.hp>0)
        const currentTarget=activeEnemies.find((v:Unit)=>v.id===u.target_id)||null
        const target=BattleCore.selectTarget(activeEnemies,currentTarget,{x:u.x,range:u.range+28,canTarget:(v:Unit)=>!(v as any).is_flying||!!u.ability?.airAttack}) as Unit|null
        if(target) {
          u.state='attack';u.target_id=target.id
          if(u.cooldown<=0&&u.stop_until<=time) {
            const targets=u.attack_type==='area'?activeEnemies.filter((v:Unit)=>Math.abs(v.x-u.x)<u.range+28):[target]
            emit('attack',side.key,u,target)
            for(const t of targets) {
              let damage=damageDealt(u,t,rng,time)
              hit(side,t,u,damage)
              const a=u.ability||{}
              if(a.wave&&rng()<num(a.waveChance,1)) {
                for(const w of other.units)if(w.hp>0&&Math.abs(w.x-t.x)<160&&w!==t){const d=Math.max(1,Math.round(u.atk*.55));w.hp=Math.max(0,w.hp-d);emit('wave',side.key,u,w,d);if(w.hp<=0)emit('death',w.side,w,u)}
              }
              if(a.phoenixSurgeLevel&&rng()<num(a.phoenixSurgeChance,1)) {
                for(const w of other.units)if(w.hp>0&&Math.abs(w.x-u.x)<=num(a.phoenixSurgeMax,200)){const d=Math.max(1,Math.round(u.atk*.35));w.hp=Math.max(0,w.hp-d);emit('surge',side.key,u,w,d);if(w.hp<=0)emit('death',w.side,w,u)}
              }
            }
            u.cooldown=u.interval
          }
        } else {
          u.state='move';u.target_id=null
          const slow=u.slow_until>time?u.slow_factor:1
          u.x+=side.key==='team1'?-u.spd*60*STEP*slow:u.spd*60*STEP*slow
          const reached=side.key==='team1'?u.x<=118:u.x>=WORLD_WIDTH-178
          if(reached&&u.cooldown<=0) {
            side // keep type inference stable for Deno
            other.base_hp=Math.max(0,other.base_hp-u.atk);emit('base_hit',side.key,u,null,u.atk);u.cooldown=u.interval
          }
        }
      }
      side.units=side.units.filter((u:Unit)=>u.hp>0||u.x< -100||u.x>WORLD_WIDTH+100)
    }
    time=Number(clock.advance(STEP).toFixed(4))
    if(time+1e-6>=nextFrame) {frames.push(snapshot(time,sides,events));nextFrame+=FRAME_INTERVAL}
  }
  if(sides[0].base_hp===sides[1].base_hp) {
    const hp1=sides[0].units.reduce((a:number,u:Unit)=>a+Math.max(0,u.hp),0)
    const hp2=sides[1].units.reduce((a:number,u:Unit)=>a+Math.max(0,u.hp),0)
    if(hp1===hp2)sides[rng()<.5?0:1].base_hp=0
    else (hp1>hp2?sides[1]:sides[0]).base_hp=0
  }
  const winner=sides[0].base_hp>sides[1].base_hp?sides[0]:sides[1]
  emit('match_end',winner.key,null,null,winner.base_hp,'server_authoritative')
  frames.push(snapshot(time,sides,events))
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

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return json({ok:true})
  if(req.method!=='POST')return json({ok:false,error:'POST only'},405)
  const suppliedToken=req.headers.get('x-ai-worker-token')
  if(!AI_TOKEN||suppliedToken!==AI_TOKEN)return json({ok:false,error:'Unauthorized'},401)
  const workerRequest=true
  try {
    const body=await req.json().catch(()=>({})) as Record<string,unknown>
    const matchId=Math.floor(num(body.match_id))
    const gameNo=Math.floor(num(body.game_number))
    if(matchId<=0||gameNo<1||gameNo>5)return json({ok:false,error:'Invalid match/game'},400)
    const result=await runBattle(matchId,gameNo)
    if(workerRequest)return json({ok:true,status:result.status,match_id:matchId,game_number:gameNo,winner_team_id:result.winner_team_id,duration_seconds:result.duration_seconds})
    return json({ok:true,...result})
  } catch(error) {
    console.error('KWL spectator server battle failed:',error)
    return json({ok:false,error:error instanceof Error?error.message:String(error)},500)
  }
})
