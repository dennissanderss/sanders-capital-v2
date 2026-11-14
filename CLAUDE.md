# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # dev server (Turbopack) on http://localhost:3000
npm run build   # production build
npm start       # serve production build
```

- There is **no lint or test setup**. `next.config.ts` has `typescript.ignoreBuildErrors: true`, so `npm run build` will NOT catch type errors — don't rely on the build as a type check.
- Root-level `.js`/`.mjs` files and everything in `scripts/` are one-off research/backfill/optimizer utilities (run with `node scripts/<name>.mjs`, need `.env.local`); they are not part of the app.

## What this is

Sanders Capital (sanderscapital.nl): Dutch-language FX education/analysis site on Next.js 16 (App Router) + React 19 + Tailwind v4 + Supabase, deployed on Vercel. **All user-facing text, comments, and commit messages are in Dutch.** Site-wide light theme; only the footer stays dark navy.

Because this is Next 16: `src/proxy.ts` replaces `middleware.ts` (it runs Supabase session refresh via `src/lib/supabase-middleware.ts`). Check `node_modules/next/dist/docs/` before assuming an API exists.

## Architecture

### Two generations of FX signal tools (both live)

1. **Old — "Daily Macro Briefing"** at `/tools/fx-selector/v2`, engine in `src/lib/fx-engine/` (import from its `index.ts`: pipeline → regime → currency scoring → intermarket → tradeability → signal), API at `src/app/api/briefing-v2/`. UI shell in `src/components/fx-desk/`.
2. **New — "Fundamental Briefing"** at `/tools/fundamental-briefing`, engine in `src/lib/fundamental/` (`service.ts` is the entry point; scoring, prices, calendar, `newsLlm.ts` uses Groq), API at `src/app/api/fundamental-briefing/{data,generate,resolve}`. UI in `src/components/fundamental-briefing/`. Spec and design rationale live in `docs/` — read `docs/fundamental-briefing-overzicht.md` before touching this tool.

### Non-negotiable domain rules (from `docs/`)

- **No look-ahead / no leakage**: all price inputs are anchored on *completed* daily candles (using the forming candle caused the historical "flicker" bug). Calls are locked once per morning (weekly calls on Monday) and never recomputed intraday.
- Each call is resolved on **5 horizons (1/3/5/10/20 trading days), close-to-close**, and a horizon is only scored after it has fully elapsed. The new tool's trackrecord is forward-only — never backfill it.
- **Wherever pips are shown, also show begin + end price and date** so it's verifiable in TradingView.

### Data & background jobs

- **Supabase** is the database and auth. Three client helpers: `src/lib/supabase.ts` (browser), `supabase-server.ts` (server components), `supabase-middleware.ts` (session refresh in proxy). API routes that need write access create their own client with `SUPABASE_SERVICE_ROLE_KEY`.
- Schema changes: SQL files in `supabase/migrations/` (plus older loose `supabase_migration_*.sql` in the root); they are applied manually in the Supabase dashboard, there is no migration runner.
- **Vercel crons** (see `vercel.json`): daily news ingest, trackrecord update, monthly central-bank snapshot, and fb-generate/fb-resolve for the Fundamental Briefing. All cron routes check `CRON_SECRET` via the Authorization header.
- Price data comes from Yahoo Finance (`src/app/api/yahoo-chart/`, `src/lib/fundamental/prices.ts`). Beware the timezone of daily candles — a candle-dating bug was fixed before; dates must match TradingView daily closes.
- **Legacy Python serverless functions** in `api/*.py` (Vercel Python runtime, helpers in `api/_lib/`) back the older `/tools/fx-analyse` tool. Still deployed; rarely touched.

### Content & auth

- Kennisbank/blog/nieuws content lives in Supabase and is edited at `/admin` with a TipTap `RichEditor`. Public pages render it with react-markdown.
- Supabase auth with a `premium` members area; gate client pages with `src/components/AuthGate.tsx`.
- Telegram bot integration in `src/lib/telegram.ts` + `src/app/api/telegram/`.

### Environment

`.env.local` needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`.

## Workflow

- Path alias: `@/*` → `./src/*`.
- After code changes: commit and push to `main` (deploys via Vercel; `/deploy-check` page exists to verify a deploy landed).
