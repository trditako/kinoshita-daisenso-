const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('zeus.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(html, /GAME_VERSION='v1\.9\.71'/);
assert.match(html, /zeus\.js\?v=20261112-zeus-raid/);
assert.match(sw, /kinoshita-daisen-v85/);
assert.match(sw, /\.\/zeus\.js/);
assert.match(sw, /trade\|hitman\|genesis\|zeus/);

assert.match(source, /最高神:ゼウス降臨/);
assert.match(source, /最高神に使える者/);
assert.match(source, /hp: 26000000/);
assert.match(source, /hp: 2500000, atk: 37000/);
assert.match(source, /damage: 60000/);
assert.match(source, /damage: 22222/);
assert.match(source, /damage: 15000/);
assert.match(source, /damage: 150000/);
assert.match(source, /damage: 55555/);
assert.match(source, /damage: 35000/);
assert.match(source, /start: 8, interval: 25/);
assert.match(source, /start: 15, interval: 17/);
assert.match(source, /threshold: 0\.99/);
assert.match(source, /barrier: 5000000/);
assert.match(source, /shield: 100000/);
assert.match(source, /shield: 5000000/);
assert.match(source, /rewardCharacter: ZEUS_ALLY/);
console.log('Zeus raid stage regression checks passed.');
