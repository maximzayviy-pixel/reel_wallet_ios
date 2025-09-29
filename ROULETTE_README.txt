
# Roulette Integration Summary

- Added **components/Roulette.tsx** — horizontal-cards roulette with agreement gate and green‑screen GIF overlay (chroma keyed in-browser).
- Updated **pages/obmen.tsx** — imported and rendered `<Roulette />` at the end of the page content so the BottomNav remains visible (Layout already has `pb-24`).
- Replaced **pages/api/roulette-spin.ts** — server picks from prizes: -3, -5, -10, -15, -50, -100, -1000, Plush Pepe NFT. Cost = 15 ⭐. Records to `ledger`:
  - `roulette_cost` (−15)
  - `roulette_prize` (delta set to prize value) **or** `nft_reward` (delta 0, meta with image).

Client uses `/api/my-balance?tg_id=...` to display updated balance after spin.
Agreement link: https://telegra.ph/Polzovatelskoe-soglashenie-Game-Reel-Wallet-09-29

GIF overlay: https://s4.ezgif.com/tmp/ezgif-4a73d92325fcc3.gif (rendered to canvas; green background removed per-pixel).

## Notes
- The API extracts `tg_id` from `x-init-data` (Telegram WebApp) or body fallback. If you already enforce signature verification upstream, keep it as is.
- No changes to BottomNav; overlay appears only during spin and auto-hides.
