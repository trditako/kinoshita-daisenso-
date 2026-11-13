const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const source=fs.readFileSync('hastur.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
assert.match(sw,/kinoshita-daisen-v98/);
assert.match(sw,/hastur\.js\?v=20261114-hastur-raid/);
assert.match(sw,/\.\/hastur\.js/);
const calls={stage:0,cards:0};
const sandbox={
 window:{hit(target,damage){target.hp=Math.max(0,target.hp-damage);return target.hp;},setStatusMark(){}},
 document:{createElement(){return {style:{},remove(){}};},body:{appendChild(){}},getElementById(){return null;}},
 performance:{now:()=>1000},setInterval(){return 1;},setTimeout(){return 1;},Math:Object.create(Math),
 cards:[],enemyTypes:{},eventStages:[],CURRENT_CHARACTER_COUNT:0,charLevel:[],charMaxLevel:[],charForm:[],normalEvolved:[],ownedFlags:[],
 renderStageSelect(){calls.stage++;},renderCards(){calls.cards++;},renderOwnedStart(){},renderFormation(){},renderFormationBuffSummary(){},console
};
vm.runInNewContext(source,sandbox);
assert.equal(sandbox.eventStages.length,1);
const stage=sandbox.eventStages[0];
assert.equal(stage.name,'最高神:ハスター降臨');
assert.deepEqual(JSON.parse(JSON.stringify(stage.schedule)),[{t:0,enemy:'最高神:ハスター',mult:1,fixedMultiplier:true,role:'boss'}]);
assert.deepEqual(JSON.parse(JSON.stringify(stage.repeatSpawns)),[{start:2,interval:35,enemy:'最高神に使える者',mult:1.2,fixedMultiplier:true}]);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].hp,28500000);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].atk,174500);
assert.equal(sandbox.cards[0].hp,500000);
assert.equal(sandbox.cards[0].atk,122000);
assert.equal(sandbox.cards[0].trait,'最高神');
assert.equal(sandbox.cards[0].ability.hastur.damageCap,.15);
assert.equal(sandbox.cards[0].ability.hastur.madnessInterval,26);
assert.equal(sandbox.enemyTypes['最高神:ハスター'].ability.hastur.madnessInterval,22);
assert.equal(calls.stage,1);
assert.equal(calls.cards,1);
process.stdout.write('Hastur stage registration and configuration checks passed.\\n');
