# Game wallet migration audit

This audit is based on `main/index.html` at blob `10c17ed6f1ecac5a039d60c4f5e6a9f2b1919115`. It is a migration checklist, not a claim that browser-side economy writes have already moved to the server.

## Current trust boundary

- `gachaCoins`, `playerXP`, item inventory, Shinju inventory, cosmetics, and many claim flags are browser/localStorage state.
- `save()` persists game state locally. A browser can modify those values, so they cannot be imported into trusted server balances as proof of ownership.
- The current game does not have a canonical authenticated player identity bound to the existing local ranking ID. The trade UI's anonymous Supabase session is not automatically proof that it owns the local game save.
- `game-wallet` and `claim_game_daily_login` currently maintain a separate server wallet. Do not call the claim endpoint from the live game until the displayed/spendable wallet is switched as one consistent unit.

## Client-side coin/XP mutation entry points found

| Area | Source entry point / pattern | Server-side requirement |
|---|---|---|
| Save state | `save()` | Remains a local cache only; never authoritative for balances or ownership. |
| Character gacha | `buyGachaCharacter(i)`, coin deductions around `drawSpecialShinju(count)` | Server must verify the exact catalog item/cost, roll rarity server-side, and atomically charge/grant. |
| Shinju gacha | `drawSpecialShinju(count)`, `shinjuDrawOne(...)` and Shinju point updates | Server-side RNG and transaction; duplicate compensation and inventory grants must be atomic. |
| Halloween gacha/shop | `drawHalloweenGacha(times)`, `buyHalloweenShopItem(id)` | Validate event window, offer ID, purchase limit, price, RNG, and reward on server. |
| Item exchange | `renderItemExchange` / exchange action using `o.costType`, `o.cost`, `o.rewardType` | Server-owned offer catalogue and atomic cost/reward update; client must not choose arbitrary rewards or amounts. |
| Daily login | `claimDailyLoginBonus(forceOpen)` | Use server date and unique daily claim; do not also award locally. |
| Rank gifts | `claimAllGifts()` | Server verifies gift ownership and marks each gift claimed once before crediting rewards. |
| Achievement rewards | `claimAchievementReward(id)` | Server checks progress/unlock state and idempotently claims. |
| Mission/event rewards | `claimMission(...)`, event claim paths using `item.claimed` and `def.rewardCoins/rewardXP` | Server validates progress, period, event status, and one-time claim; client-supplied reward amounts are untrusted. |
| Character leveling | `levelUpCharacter(i)` and other XP deduction paths | Server validates character ownership, level cap, cost, materials, and commits spend + level change atomically. |
| Stage clears | Stage completion paths that add `gachaCoins` / `playerXP` | Server needs a verifiable clear/result receipt and idempotency key; never accept arbitrary client-reported reward totals. |
| PvP/other rewards | Rank-match paths and other direct balance increments | Server verifies the match result and prevents replay/duplicate settlement. |

This list is intentionally not exhaustive for every item/currency. The source also mutates rarity materials, attribute power, Halloween candy, Shinju points, limited character ownership, and cosmetics. Those need their own catalog and transaction audit before tradeable ownership can be synchronized.

## Safe migration order

1. Establish a stable authenticated player identity and explicit account-linking flow. Do not treat a localStorage ranking ID as authentication.
2. Create server-owned wallet, inventory, cosmetic ownership, progression, claim receipts, and idempotency records. Define which assets are tradeable.
3. Migrate one transaction family at a time: server-owned offer catalog → atomic RPC/Edge Function → UI call → returned canonical state → retry/duplicate tests.
4. Make all game UI render and spend from the same server-authoritative wallet. Local storage may cache the last server response but cannot add balances or assets.
5. Migrate stage/PvP rewards only after server validation of results exists. Audit event, daily, mission, gift, and achievement claim flags to prevent replay.
6. Add tests for concurrent spending, duplicate requests, invalid offer IDs, insufficient funds, replayed claims, Tokyo date rollover, and ledger consistency.
7. Only then enable trade settlement against game assets, deploy migrations/functions, and perform a production smoke test.

## Current status

- Server wallet foundation and daily-login RPC are in PR #312.
- The in-game economy has **not** been switched to that wallet.
- No localStorage inventory import is trusted.
- Do not merge/deploy the feature as a complete game-wallet integration until the migration and end-to-end tests above are done.
