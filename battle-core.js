/* Shared deterministic primitives for the browser battle engine and Supabase replay worker.
 * Keep this file dependency-free so it can run as a classic browser script and as a Deno side-effect import.
 */
(function(root){
  'use strict';
  function createRng(seedText){
    const text=String(seedText??'');
    let seed=2166136261;
    for(let i=0;i<text.length;i++)seed=Math.imul(seed^text.charCodeAt(i),16777619);
    let state=seed>>>0;
    return function random(){
      state+=0x6D2B79F5;
      let t=state;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function createClock(initial=0){
    let current=Number.isFinite(Number(initial))?Number(initial):0;
    return Object.freeze({
      now:()=>current,
      set(value){const next=Number(value);if(!Number.isFinite(next)||next<current)throw new RangeError('Battle clock must be finite and monotonic');current=next;return current;},
      advance(delta){const step=Number(delta);if(!Number.isFinite(step)||step<0)throw new RangeError('Battle clock delta must be finite and non-negative');current+=step;return current;}
    });
  }
  function scaleLevelStat(base,level,growth=1.04){const b=Number(base),lv=Math.max(1,Number(level)||1),g=Number(growth);return b*Math.pow(Number.isFinite(g)&&g>0?g:1,lv-1);}
  function traits(value){return String(value||'無').split(/[・,]/).map(x=>x.trim()).filter(Boolean);}
  function hasTrait(entity,trait){if(!entity||!trait)return false;return traits(entity.trait).includes(String(trait));}
  function matchesTrait(entity,rules){return (Array.isArray(rules)?rules:[rules]).some(trait=>String(trait)==='*'||hasTrait(entity,trait));}
  function tableMatches(table,entity){return !!table&&traits(entity?.trait||'無').some(trait=>Object.prototype.hasOwnProperty.call(table,trait));}
  function traitMultiplier(table,entity,mode='max'){
    if(!table||!entity)return 1;
    const values=traits(entity.trait).map(trait=>Number(table[trait])).filter(value=>Number.isFinite(value)&&value>0);
    if(values.length)return mode==='min'?Math.min(...values):Math.max(...values);
    return Number(table['*'])>0?Number(table['*']):1;
  }
  function selectTarget(candidates,currentTarget,options={}) {
    const list=Array.isArray(candidates)?candidates:[];
    const x=Number(options.x)||0;
    const range=Math.max(0,Number(options.range)||0);
    const canTarget=typeof options.canTarget==='function'?options.canTarget:()=>true;
    const inRange=typeof options.inRange==='function'
      ? options.inRange
      : candidate=>Math.abs(Number(candidate?.x||0)-x)<range;
    const valid=candidate=>!!candidate&&list.includes(candidate)&&Number(candidate.hp)>0&&!candidate.muscleGrabbedBy&&canTarget(candidate)&&inRange(candidate);
    if(valid(currentTarget))return currentTarget;
    let best=null,bestDistance=Infinity;
    for(const candidate of list){
      if(!valid(candidate))continue;
      const distance=Math.abs(Number(candidate.x||0)-x);
      if(distance<bestDistance){best=candidate;bestDistance=distance;}
    }
    return best;
  }
  function calculateAttackDamage(options){
    const o=options||{},attacker=o.attacker||{},target=o.target||{},ability=o.ability||{};
    const now=Number(o.time)||0,random=typeof o.random==='function'?o.random:Math.random;
    const multiplier=typeof o.traitMultiplier==='function'?o.traitMultiplier:traitMultiplier;
    const baseAttack=Math.max(1,Number(o.baseAttack??attacker.atk??1)||1);
    let effectiveAttack=baseAttack;
    if(attacker.festivalVoidUntil&&now<Number(attacker.festivalVoidUntil))effectiveAttack*=Number(attacker.festivalVoidAttackFactor||.55);
    if(attacker.attackDownUntil&&now<Number(attacker.attackDownUntil))effectiveAttack*=Number(attacker.attackDownFactor||.01);
    if(attacker.cursedUntil&&now<Number(attacker.cursedUntil)&&attacker.cursedAttackFactor)effectiveAttack*=Number(attacker.cursedAttackFactor)||1;
    let critical=false;
    if(target.metal){
      if(ability.criticalChance&&random()<Number(ability.criticalChance)){
        critical=true;
        let metalDamage=effectiveAttack*Number(ability.criticalMultiplier||2);
        if(ability.hpBelowThresholdMultiplier&&attacker.hp<attacker.maxhp*Number(ability.hpBelowThreshold||.5))metalDamage*=Number(ability.hpBelowThresholdMultiplier)||1;
        return {damage:Math.max(1,Math.round(metalDamage)),rawDamage:metalDamage,critical,effectiveAttack};
      }
      return {damage:1,rawDamage:1,critical:false,effectiveAttack};
    }
    let mult=1;
    if(attacker.mythDomainUntil&&now<Number(attacker.mythDomainUntil))mult*=Number(attacker.mythDomainAtk||.72);
    if(ability.killAttackStack)mult*=1+Math.min(Number(ability.killAttackStack.maxBonus||0),Number(attacker.killAttackStacks||0)*Number(ability.killAttackStack.perKill||.05));
    if(ability.hpThresholdAttackBonus&&attacker.hp>=attacker.maxhp*Number(ability.hpThresholdAttackBonus.threshold||.5))mult*=Number(ability.hpThresholdAttackBonus.multiplier||1);
    if(attacker.phoenixLowHpMultiplier&&attacker.hp<attacker.maxhp*.5)mult*=Number(attacker.phoenixLowHpMultiplier)||1;
    if(ability.criticalChance&&random()<Number(ability.criticalChance)){critical=true;mult*=Number(ability.criticalMultiplier||2);}
    if(ability.hpBelowThresholdMultiplier&&attacker.hp<attacker.maxhp*Number(ability.hpBelowThreshold||.5))mult*=Number(ability.hpBelowThresholdMultiplier)||1;
    if(ability.wyvernStrongTraits&&traits(target.trait).some(trait=>ability.wyvernStrongTraits.includes(trait)))mult*=Number(ability.wyvernStrongMultiplier||4);
    else mult*=multiplier(ability.strong,target,'max');
    if(ability.ancientHunter&&hasTrait(target,'古代'))mult*=Number(ability.ancientHunter)||1;
    if(ability.attributeOverload&&!hasTrait(target,'古代')&&attacker.series!=='機械防衛隊！木下s')mult*=Number(ability.attributeOverload.outgoing)||1;
    if(target.cursedUntil&&now<Number(target.cursedUntil)&&ability.cursedAttackMultiplier)mult*=Number(ability.cursedAttackMultiplier)||1;
    const rawDamage=effectiveAttack*mult;
    return {damage:Math.max(1,Math.round(rawDamage)),rawDamage,critical,effectiveAttack};
  }
  function calculateDamageTaken(options){
    const o=options||{},target=o.target||{},attacker=o.attacker||{},ability=o.ability||target.ability||{};
    const random=typeof o.random==='function'?o.random:Math.random;
    const multiplier=typeof o.traitMultiplier==='function'?o.traitMultiplier:traitMultiplier;
    const time=Number(o.time)||0, incoming=Math.max(0,Number(o.damage)||0);
    let factor=multiplier(ability.resist,attacker,'min');
    const reduction=ability.damageReduce;
    if(reduction&&random()<Number(reduction.chance??.5))factor*=Number(reduction.factor??reduction)||1;
    if(Number(target.cursedUntil)>time)factor*=Number(o.curseFactor??ability.cursedAttackMultiplier??1);
    let damage=Math.max(1,Math.round(incoming*factor));
    const cap=o.applyCap?Number(ability.damageCapRatio||ability.iceWyvern?.damageCap||0):0;
    if(cap>0)damage=Math.min(damage,Math.max(1,Math.round(Number(target.maxhp??target.max_hp??1)*cap)));
    return {damage,factor,capped:cap>0&&damage>=Math.round(Number(target.maxhp??target.max_hp??1)*cap)};
  }
  function resolveDamage(options){
    const o=options||{},target=o.target||{};
    const mitigation=calculateDamageTaken(o);
    let remaining=mitigation.damage;
    const barrier=Math.max(0,Number(target.barrier)||0);
    const powerShield=Math.max(0,Number(target.powerShield??target.power_shield)||0);
    const absorbedBarrier=Math.min(barrier,remaining);remaining-=absorbedBarrier;
    const absorbedPowerShield=Math.min(powerShield,remaining);remaining-=absorbedPowerShield;
    const hpBefore=Math.max(0,Number(target.hp)||0);
    const hpDamage=Math.min(hpBefore,remaining);
    return { ...mitigation, damage:hpDamage, mitigatedDamage:mitigation.damage,
      absorbedBarrier, absorbedPowerShield, hp:Math.max(0,hpBefore-hpDamage),
      barrier:barrier-absorbedBarrier, powerShield:powerShield-absorbedPowerShield };
  }
  let activeRuntime=null;
  function createRuntime(seed,initialTime=0){
    const clock=createClock(initialTime);
    return Object.freeze({seed:String(seed??''),random:createRng(seed),clock,now:()=>clock.now(),setNow:value=>clock.set(value),advance:delta=>clock.advance(delta)});
  }
  function setActiveRuntime(runtime){activeRuntime=runtime&&typeof runtime.random==='function'&&runtime.clock?runtime:null;return !!activeRuntime;}
  function clearActiveRuntime(){activeRuntime=null;}
  function random(){return activeRuntime?activeRuntime.random():Math.random();}
  function now(){return activeRuntime?activeRuntime.now():(root.performance?.now?.()??Date.now());}
  function setFrameTime(value){if(activeRuntime)activeRuntime.setNow(value);}
  root.KinoshitaBattleCore=Object.freeze({
    version:'1.1.0',
    createRng,
    scaleLevelStat,
    traits,
    hasTrait,
    matchesTrait,
    tableMatches,
    traitMultiplier,
    calculateAttackDamage,
    calculateDamageTaken,
    selectTarget,
    createClock,
    createRuntime,
    setActiveRuntime,
    clearActiveRuntime,
    random,
    now,
    setFrameTime
  });
})(globalThis);
