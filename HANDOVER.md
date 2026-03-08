# Lotion — Handover

Use this doc to save status and continue work later. Repo: **lotion** (contributing to `main` on [github.com/MarcoHarald/lotion](https://github.com/MarcoHarald/lotion)).

---

## Current status

| Phase | Status | Notes |
|-------|--------|--------|
| Doc / README | Done | New spec is main README. |
| Phase 1: Schema + seed | Done | Migrations and seed in `supabase/`. |
| Phase 1: Edge Function | Done | `generate-consequences` (Claude only). |
| Phase 1: React app | Done | Three-panel UI, graph, inspector, library. |
| Phase 2: Swarm + Perplexity | Done | Perplexity enrichment, six domain agents, synthesiser in Edge Function. |
| Phase 2: SETUP.md + staged UI | Done | SETUP.md documents Phase 2 keys; polling, staged status, cache timestamp in header. |
| Phase 3: Feedback + OSINT | Not started | Feedback Queue UI, selective re-run, RapidAPI (X/Telegram), source cards tab, analogues overlay, stress test. |

**Stopping point:** Phase 2 complete. Ready for Phase 3. No API keys in repo.

---

## Repo layout

```
lotion/
├── README.md                 # Full build brief (spec)
├── SETUP.md                  # Keys + deploy steps (Phase 1 & 2)
├── HANDOVER.md               # This file + key learnings below
├── .env.example              # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── run-dev.sh                # npm install && npm run dev (run from your terminal)
├── test-generate-button.mjs  # Playwright: click Generate, capture console
├── .gitignore
├── package.json              # React + Vite + D3 + Tailwind + Supabase
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── App.tsx               # Three-panel layout, state, polling when generating
│   ├── supabase.ts           # Client + types (Scenario incl. generation_stage, perplexity_cached_at)
│   ├── LeftPanel.tsx         # Trigger, timeline, domains, scenario library
│   ├── Graph.tsx             # D3 force-directed graph (safeNodes/safeEdges)
│   └── RightPanel.tsx        # Tabs: Inspector, Source cards, Analogues, Stress test
└── supabase/
    ├── migrations/
    │   ├── 00001_initial_schema.sql   # All tables + RLS
    │   └── 00002_generation_stage.sql # scenarios.generation_stage
    ├── seed.sql                       # 8 historical_analogues (idempotent)
    └── functions/
        └── generate-consequences/
            └── index.ts               # Perplexity → 6 domain agents → synthesiser; CORS on all responses
```

---

## What you need to do (before “continue”)

1. **Supabase project**  
   Create one at [supabase.com](https://supabase.com). Then:
   - **SQL Editor:** run `supabase/migrations/00001_initial_schema.sql`, then `00002_generation_stage.sql`.
   - **SQL Editor:** run `supabase/seed.sql`.

2. **Edge Function secrets**  
   Dashboard → **Edge Functions** → **Secrets** → add:
   - `ANTHROPIC_API_KEY` (required)
   - `PERPLEXITY_API_KEY` (optional; if missing, generation continues without live context)
   Deploy: `supabase link --project-ref YOUR_REF` then `supabase functions deploy generate-consequences`.

3. **Frontend env**  
   - Copy `.env.example` to `.env`.  
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from same Supabase project → Settings → API).

4. **Run**  
   From **your own terminal** (see Key learnings: agent terminal often has no `npm`):  
   `cd lotion` then `npm install` and `npm run dev`, or `bash run-dev.sh`.  
   Open http://localhost:5173/, enter a trigger, click “Generate consequences”.

---

## Keys summary (no keys in repo)

| Where | Key | Purpose |
|-------|-----|--------|
| Supabase Edge Function Secrets | `ANTHROPIC_API_KEY` | Claude (required) |
| Supabase Edge Function Secrets | `PERPLEXITY_API_KEY` | Live context (optional) |
| Local `.env` | `VITE_SUPABASE_URL` | Frontend Supabase client |
| Local `.env` | `VITE_SUPABASE_ANON_KEY` | Frontend Supabase client |

Phase 3: RapidAPI, Agno, etc. in Supabase Secrets (see README).

---

## How to continue (next work)

- **Plan reference:** Cursor plan file (e.g. `lotion_phased_implementation_*.plan.md` in `.cursor/plans/` or similar) or the README Sections 3–12.
- **Phase 3:** Feedback Queue UI, selective re-run Edge Function, RapidAPI (X/Telegram) + source cards in UI, analogues overlay, stress test. See README Sections 3–12 and plan in `.cursor/plans/` (RapidAPI/Phase 3).

Hand off by saying: “Continue Lotion from HANDOVER.md: Phase 3”

---

## Quick commands

```bash
# From lotion repo root
npm install
npm run dev                    # Frontend

supabase link --project-ref YOUR_REF
supabase functions deploy generate-consequences
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set PERPLEXITY_API_KEY=...
```

---

## Key learnings (for next agent)

- **Cursor agent terminal and npm:** The in-editor Agent runs commands in a minimal environment; `PATH` often does not include Node/npm (no nvm, no Homebrew). So `npm install` / `npm run dev` usually fail with “command not found: npm”. Either install Node so it’s on the default PATH (e.g. nodejs.org installer to `/usr/local/bin`), or run those commands in the user’s own terminal. A `run-dev.sh` script is provided; user runs it from their terminal.
- **Supabase MCP:** In this project the server name is **`user-supabase`** (not `supabase`). Use it for `execute_sql`, `list_tables`, `apply_migration`, `deploy_edge_function`, etc.
- **Edge Function CORS:** Browsers send an OPTIONS preflight before POST. The function must return **200** with body `"ok"` and headers `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers` (include `authorization, x-client-info, apikey, content-type`). Apply the same CORS headers to every response (success and error). See `generate-consequences/index.ts` and [Supabase CORS docs](https://supabase.com/docs/guides/functions/cors).
- **React hook order:** `loadScenario` must be declared **above** any `useEffect` that uses it (or that lists it in deps). Otherwise “Cannot access 'loadScenario' before initialization” at runtime.
- **Defensive data:** When loading from Supabase or passing props to Graph/RightPanel, treat `nodes` and `edges` as possibly non-arrays; use `Array.isArray(x) ? x : []` and filter out items missing `id` or required fields. Graph uses `safeNodes`/`safeEdges`; RightPanel uses `safeNodes`/`safeEdges` and null-safe node fields in Inspector.
- **Browser testing:** Playwright is in devDependencies. `node test-generate-button.mjs` opens the app, fills trigger, clicks Generate, waits (e.g. 90s), and prints console output and any errors. Use this to verify CORS and flow without manual clicking.
- **nvm on this machine:** If the user has no Node, `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash` then `source ~/.nvm/nvm.sh` and `nvm install node` works. Create `~/.zshrc` with the nvm source lines so new terminals get `node`/`npm`.
- **RapidAPI / X (Phase 3):** Not implemented yet. Spec: domain agents (especially Political/Military) will call RapidAPI for X/Twitter and Telegram; results become source cards. Schema and Edge Function already accept and store `source_cards`; UI has a placeholder tab. See README and plan file for Phase 3.

---

*Last handover: Phase 2 complete. HANDOVER + learnings updated for spinning another agent.*
