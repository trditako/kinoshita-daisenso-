const fs = require('node:fs');
const assert = require('node:assert/strict');

const edge = fs.readFileSync('supabase/functions/kwl-spectator-battle/index.ts', 'utf8');
const kwl = fs.readFileSync('kwl.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261122123000_kwl_server_rehearsal_isolation.sql', 'utf8');
const credentialCleanup = fs.readFileSync('supabase/migrations/20261122130000_kwl_rehearsal_env_secret_auth.sql', 'utf8');

assert.match(edge, /action==='rehearsal_start'/, 'server rehearsal start action exists');
assert.match(edge, /action==='rehearsal_read'/, 'public replay read action exists');
assert.match(edge, /rehearsalCredentialValid\\(req\\)/, 'server validates the operator credential');
assert.match(edge, /Deno\\.env\\.get\\('KWL_REHEARSAL_OPERATOR_KEY'\\)/, 'operator key is read from an Edge Function secret');
assert.match(edge, /rehearsalSafeEqual/, 'credential comparison avoids early character mismatch exit');
assert.match(edge, /function startIsolatedRehearsal/, 'isolated BO5 simulator exists');
assert.match(edge, /from\('ai_accounts'\)\.select\('\*'\)/, 'AI profiles are read as simulation inputs');
assert.match(edge, /from\('kwl_rehearsal_runs'\)\.insert/, 'rehearsal run is written to isolated storage');
assert.match(edge, /from\('kwl_rehearsal_games'\)\.insert/, 'replay frames are written to isolated storage');
assert.doesNotMatch(edge, /from\('(kwl_matches|kwl_games|kwl_live_events|kwl_teams|kwl_game_players|player_rankings)'\)\.(insert|update|upsert|delete)/, 'rehearsal path does not write official KWL or player records');
assert.match(edge, /kwl-server-rehearsal:/, 'each server rehearsal game receives a deterministic seed');
assert.match(edge, /team1Wins>=3\|\|team2Wins>=3/, 'series ends at three wins');
assert.match(edge, /x-kwl-operator-key/, 'CORS allows the separate operator credential header');

assert.match(kwl, /function kwlIsOperator\(\)/, 'operator UI gate exists');
assert.match(kwl, /kwlServerRehearsalStart/, 'server rehearsal UI action is wired');
assert.match(kwl, /prompt\('運営用サーバーリハーサルキー/, 'server rehearsal requires an operator key at start');
assert.match(kwl, /action:'rehearsal_start'/, 'UI calls the server rehearsal action');
assert.match(kwl, /action:'rehearsal_read'/, 'UI reads the stored replay');
assert.match(kwl, /id="kwlRehearsalOpenReplay"/, 'shared replay viewer is available to all players');
assert.match(kwl, /kwlServerRehearsalWatch\(runId,gameNo\)/, 'shared replay UI opens the stored server replay');
assert.match(kwl, /async function kwlSpectatorStart\(requestedGameNo,replayOverride=null/, 'same replay viewer can play isolated rehearsal replays');

assert.match(migration, /create table if not exists public\.kwl_rehearsal_runs/, 'isolated run table exists');
assert.match(migration, /create table if not exists public\.kwl_rehearsal_games/, 'isolated replay table exists');
assert.match(credentialCleanup, /drop table if exists public\\.kwl_rehearsal_credentials/, 'operator secret is not stored in the database');
assert.match(migration, /enable row level security/g, 'RLS is enabled on rehearsal tables');
assert.match(migration, /revoke all on public\.kwl_rehearsal_runs from public, anon, authenticated/, 'public roles cannot mutate or directly read run data');
assert.doesNotMatch(migration, /references public\.kwl_(tournaments|matches|games|teams)/, 'rehearsal data has no foreign key into official tournament records');

console.log('KWL isolated server rehearsal regression tests passed');
