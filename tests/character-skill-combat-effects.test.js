const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const enhancement = fs.readFileSync(path.join(__dirname, '..', 'formation-detail-enhancements.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');

assert.match(enhancement, /function collectSkills/);
assert.match(enhancement, /card\?\.skills/);
assert.match(enhancement, /card\?\.ability\?\.kbrSkill/);
assert.match(enhancement, /if \(!skills\.length\) return result/);
assert.match(enhancement, /固有能力/);
assert.match(enhancement, /temporaryEffectsOnly/);
assert.match(enhancement, /persistentLabels/);
assert.match(enhancement, /haifuDefense/); // combat-earned growth remains visible in the original status renderer
assert.match(serviceWorker, /kinoshita-daisen-v73/);
assert.match(serviceWorker, /formation-detail-enhancements\.js/);
assert.match(serviceWorker, /headers\.delete\('content-length'\)/);
console.log('Character skill separation and temporary combat-effect display regression checks passed.');
