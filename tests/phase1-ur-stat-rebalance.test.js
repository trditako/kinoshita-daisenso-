'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const genesis = fs.readFileSync('genesis.js','utf8');
const evil = fs.readFileSync('evil-kinoshita.js','utf8');
const kwl = JSON.parse(fs.readFileSync('supabase/functions/kwl-spectator-battle/character-data.json','utf8'));
assert.match(genesis,/genesisCard\.hp=100000;genesisCard\.atk=30000/);
assert.match(genesis,/genesisCounterCard\.hp=65000;genesisCounterCard\.atk=12000;genesisCounterCard\.range=900;genesisCounterCard\.interval=3\.8/);
assert.match(evil,/name: ALLY_NAME,[\s\S]{0,160}hp: 500000,[\s\S]{0,60}atk: ALLY_FORMS\.robot\.atk/);
const byName=Object.fromEntries(kwl.map(c=>[c.name,c]));
assert.deepEqual([byName['創世木下'].hp,byName['創世木下'].atk,byName['創世木下'].rarity],[100000,30000,'伝説レア']);
assert.deepEqual([byName['創世討伐兵器・零式'].hp,byName['創世討伐兵器・零式'].atk,byName['創世討伐兵器・零式'].rarity],[65000,12000,'伝説レア']);
assert.deepEqual([byName['悪の木下'].hp,byName['悪の木下'].atk,byName['悪の木下'].rarity],[500000,900,'UR']);
console.log('Phase 1 UR stat targets passed.');
