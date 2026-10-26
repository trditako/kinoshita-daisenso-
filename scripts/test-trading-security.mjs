import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('trade API never trusts a client-supplied game player ID', async () => {
  const source = await read('../supabase/functions/player-trading/index.ts');
  assert.match(source, /player_id:\s*null/);
  assert.doesNotMatch(source, /player_id\s*:\s*body\.player_id/);
  assert.doesNotMatch(source, /\.update\(\{[^}]*player_id\s*:/s);
});

test('trade UI does not submit the local ranking ID as identity proof', async () => {
  const source = await read('../trade.js');
  assert.doesNotMatch(source, /kinoshitaPlayerRankingId/);
  assert.doesNotMatch(source, /player_id\s*:\s*playerId/);
});

test('game wallet requires a valid Supabase bearer session', async () => {
  const source = await read('../supabase/functions/game-wallet/index.ts');
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /AUTH_REQUIRED/);
  assert.match(source, /INVALID_SESSION/);
});

test('daily login cannot mint transferable assets before verified account linking', async () => {
  const source = await read('../supabase/functions/game-wallet/index.ts');
  const claimBranch = source.match(/if \(action === 'claim_daily_login'\) \{([\s\S]*?)\n    \}/);
  assert.ok(claimBranch, 'daily login guard must exist');
  assert.match(claimBranch[1], /GAME_ACCOUNT_LINK_REQUIRED/);
  assert.doesNotMatch(claimBranch[1], /\.rpc\(['"]claim_game_daily_login/);
});

test('database requires a verified timestamp for every linked game ID', async () => {
  const source = await read('../supabase/migrations/20261026070000_verified_game_account_link_guard.sql');
  assert.match(source, /create unique index if not exists trade_profiles_verified_player_id_unique/);
  assert.match(source, /player_id is not null and player_link_verified_at is not null/);
  assert.match(source, /set player_id = null/);
});
