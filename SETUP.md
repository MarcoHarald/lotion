# Lotion — Setup (keys and deploy)

Implement the plan up to the point where you add keys. No API keys are stored in the repo.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API** copy:
   - **Project URL** → use for `VITE_SUPABASE_URL` and for Edge Function (auto-injected).
   - **anon public** key → use for `VITE_SUPABASE_ANON_KEY`.

## 2. Database

- Run migrations in order: Supabase Dashboard → **SQL Editor** → run `supabase/migrations/00001_initial_schema.sql`, then `00002_generation_stage.sql`.
- Seed analogues: run `supabase/seed.sql` in the SQL Editor (or `psql` / Supabase CLI).

## 3. Edge Function secrets (Phase 2)

The `generate-consequences` function uses:

- **Dashboard:** Project → **Edge Functions** → **Secrets** → add:
  - `ANTHROPIC_API_KEY` = your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com)).
  - `PERPLEXITY_API_KEY` = your Perplexity API key (from [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)). Optional: if missing, generation continues without live context enrichment.
- **CLI:** `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` and `supabase secrets set PERPLEXITY_API_KEY=...`

Deploy the function (from repo root). **Required for CORS:** the Edge Function returns `200` with correct headers for OPTIONS preflight so the browser can call it from localhost.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy generate-consequences
```

## 4. Frontend env

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL` = your Project URL
- `VITE_SUPABASE_ANON_KEY` = your anon key

Then run in **your own terminal** (Cursor’s in-editor Agent uses a minimal PATH and may not see `npm`):

```bash
cd lotion
npm install
npm run dev
```

Or use the helper script (from repo root: `bash lotion/run-dev.sh` or from `lotion/`: `./run-dev.sh`).

## 5. Keys you need (summary)

| Where              | Key                     | Used for                         |
|--------------------|-------------------------|----------------------------------|
| Supabase Secrets   | `ANTHROPIC_API_KEY`     | Edge Function (Claude, required)|
| Supabase Secrets   | `PERPLEXITY_API_KEY`    | Live context enrichment (optional)|
| Local `.env`       | `VITE_SUPABASE_URL`     | Frontend Supabase client         |
| Local `.env`       | `VITE_SUPABASE_ANON_KEY`| Frontend Supabase client         |

Phase 3 will add RapidAPI, Agno, etc. in Supabase Secrets as needed.
