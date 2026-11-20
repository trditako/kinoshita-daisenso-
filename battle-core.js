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
    version:'1.0.0',
    createRng,
    traits,
    hasTrait,
    matchesTrait,
    tableMatches,
    traitMultiplier,
    createClock,
    createRuntime,
    setActiveRuntime,
    clearActiveRuntime,
    random,
    now,
    setFrameTime
  });
})(globalThis);
