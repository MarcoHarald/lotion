# Supabase rebuild reference

Use this document to recreate the Supabase project after deleting the instance. No data or secret values are stored here—only structure, config, and secret **names**.

---

## 1. Tables and columns

Apply in order: `00001_initial_schema.sql`, then `00002_generation_stage.sql`, then `00003_domain_results.sql`.

### Extension

- `uuid-ossp`

### public.users

| Column     | Type         | Constraints                          |
|-----------|--------------|--------------------------------------|
| id        | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| email     | text         |                                      |
| created_at| timestamptz | DEFAULT now()                        |

### public.scenarios

| Column              | Type         | Constraints |
|---------------------|--------------|-------------|
| id                  | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| user_id             | uuid         | REFERENCES public.users(id) |
| title               | text         | |
| trigger_text        | text         | |
| trigger_summary     | text         | |
| status              | text         | CHECK (status IN ('generating','complete','error','archived')), DEFAULT 'generating' |
| perplexity_cache    | jsonb        | |
| perplexity_cached_at| timestamptz | |
| created_at          | timestamptz | DEFAULT now() |
| updated_at          | timestamptz | DEFAULT now() |
| generation_stage    | text         | (migration 00002) — comment: current pipeline stage when status=generating |
| domain_results      | jsonb        | (migration 00003) DEFAULT '[]' |
| node_id_map         | jsonb        | (migration 00003) DEFAULT '{}' |

Indexes: `idx_scenarios_user_id` (user_id), `idx_scenarios_status` (status).

### public.nodes

| Column                | Type         | Constraints |
|-----------------------|--------------|-------------|
| id                    | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| scenario_id           | uuid         | NOT NULL, REFERENCES public.scenarios(id) ON DELETE CASCADE |
| parent_id             | uuid         | REFERENCES public.nodes(id) ON DELETE SET NULL |
| domain                | text         | NOT NULL, CHECK (domain IN ('root','energy','food','finance','political','military','supply_chain')) |
| title                 | text         | NOT NULL |
| description           | text         | |
| mechanism             | text         | |
| confidence            | text         | CHECK (confidence IN ('high','medium','speculative')) |
| timeline              | text         | CHECK (timeline IN ('immediate','short','medium','long')) |
| assumptions           | text[]       | |
| monitoring_indicators | text[]       | |
| quantitative_estimate| text         | |
| historical_precedent   | text         | |
| agent_generated_by    | text         | |
| is_analyst_modified   | boolean      | DEFAULT false |
| created_at            | timestamptz | DEFAULT now() |
| updated_at            | timestamptz | DEFAULT now() |

Indexes: `idx_nodes_scenario_id`, `idx_nodes_parent_id`, `idx_nodes_domain`.

### public.edges

| Column         | Type         | Constraints |
|----------------|--------------|-------------|
| id             | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| scenario_id    | uuid         | NOT NULL, REFERENCES public.scenarios(id) ON DELETE CASCADE |
| source_node_id | uuid         | NOT NULL, REFERENCES public.nodes(id) ON DELETE CASCADE |
| target_node_id | uuid         | NOT NULL, REFERENCES public.nodes(id) ON DELETE CASCADE |
| mechanism      | text         | |
| is_cross_domain| boolean      | DEFAULT false |
| confidence     | text         | CHECK (confidence IN ('high','medium','speculative')) |
| created_at     | timestamptz | DEFAULT now() |

Index: `idx_edges_scenario_id`.

### public.source_cards

| Column       | Type         | Constraints |
|--------------|--------------|-------------|
| id           | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| scenario_id  | uuid         | NOT NULL, REFERENCES public.scenarios(id) ON DELETE CASCADE |
| node_id      | uuid         | REFERENCES public.nodes(id) ON DELETE CASCADE |
| platform     | text         | CHECK (platform IN ('twitter','telegram','web','perplexity')) |
| handle       | text         | |
| snippet      | text         | |
| url          | text         | |
| retrieved_at | timestamptz | |
| created_at   | timestamptz | DEFAULT now() |

Index: `idx_source_cards_scenario_id`.

### public.analyst_feedback

| Column            | Type         | Constraints |
|-------------------|--------------|-------------|
| id                | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| scenario_id       | uuid         | NOT NULL, REFERENCES public.scenarios(id) ON DELETE CASCADE |
| node_id           | uuid         | REFERENCES public.nodes(id) ON DELETE SET NULL |
| user_id           | uuid         | REFERENCES public.users(id) |
| feedback_type     | text         | CHECK (feedback_type IN ('disagree','amplify','scenario_tweak','external_inject')) |
| content           | text         | |
| domain_tag        | text         | |
| status            | text         | CHECK (status IN ('pending','applied','dismissed')), DEFAULT 'pending' |
| re_run_triggered_at | timestamptz | |
| created_at        | timestamptz | DEFAULT now() |

Index: `idx_analyst_feedback_scenario_id`.

### public.historical_analogues

| Column                 | Type         | Constraints |
|------------------------|--------------|-------------|
| id                     | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| event_name             | text         | NOT NULL |
| year                   | integer      | NOT NULL |
| region                 | text[]       | |
| domains                | text[]       | |
| structural_similarity  | text         | |
| ground_truth           | text         | |
| relevant_lesson        | text         | |
| created_at             | timestamptz | DEFAULT now() |
| UNIQUE(event_name, year) |            | |

### public.scenario_analogues

| Column               | Type         | Constraints |
|----------------------|--------------|-------------|
| id                   | uuid         | PRIMARY KEY, DEFAULT gen_random_uuid() |
| scenario_id          | uuid         | NOT NULL, REFERENCES public.scenarios(id) ON DELETE CASCADE |
| analogue_id          | uuid         | NOT NULL, REFERENCES public.historical_analogues(id) ON DELETE CASCADE |
| relevance_explanation| text         | |
| created_at           | timestamptz | DEFAULT now() |

Index: `idx_scenario_analogues_scenario_id`.

---

## 2. RLS (row level security)

All tables have RLS **enabled**. Policies are permissive (solo analyst; auth later).

- **public.users:** policy `"Allow all users"` — FOR ALL USING (true) WITH CHECK (true)
- **public.scenarios:** policy `"Allow all scenarios"` — FOR ALL USING (true) WITH CHECK (true)
- **public.nodes:** policy `"Allow all nodes"` — FOR ALL USING (true) WITH CHECK (true)
- **public.edges:** policy `"Allow all edges"` — FOR ALL USING (true) WITH CHECK (true)
- **public.source_cards:** policy `"Allow all source_cards"` — FOR ALL USING (true) WITH CHECK (true)
- **public.analyst_feedback:** policy `"Allow all analyst_feedback"` — FOR ALL USING (true) WITH CHECK (true)
- **public.historical_analogues:** policy `"Allow all historical_analogues"` — FOR ALL USING (true) WITH CHECK (true)
- **public.scenario_analogues:** policy `"Allow all scenario_analogues"` — FOR ALL USING (true) WITH CHECK (true)

(Exact SQL is in `00001_initial_schema.sql`.)

---

## 3. Edge functions

| Function               | Secret names used (names only) | Config |
|------------------------|---------------------------------|--------|
| **anthropic-test**     | ANTHROPIC_API_KEY               | default verify_jwt |
| **generate-consequences** | ANTHROPIC_API_KEY, PERPLEXITY_API_KEY (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | verify_jwt = false |

Source lives under `supabase/functions/` (anthropic-test, generate-consequences, _shared/cors.ts).

---

## 4. Project config (config.toml)

```toml
# Allow OPTIONS preflight (no JWT sent by browser) to reach the function so CORS works.
# POST from the app still sends anon key; this only lets the preflight through.
[functions.generate-consequences]
verify_jwt = false
```

---

## 5. Secret names checklist (Vault / Edge Function secrets)

Recreate these in the new project (Dashboard → Vault and/or Edge Functions → Secrets). **Names only**—values you set yourself.

| Secret name               | Purpose |
|---------------------------|---------|
| ANTHROPIC_API_KEY         | Anthropic (Claude) API — used by edge functions and domain/synthesis agents |
| PERPLEXITY_API_KEY        | Perplexity API — live context enrichment (optional in generate-consequences) |
| SUPABASE_URL              | Supabase project URL — used by generate-consequences |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service_role key — server-side Postgres/Vault from generate-consequences |
| AGNO_API_KEY              | Agno platform — agent orchestration (if used by app) |
| RAPIDAPI_API_KEY          | RapidAPI — X/Twitter and Telegram OSINT (if used by app) |

---

## 6. Seed data

After running migrations, run **seed.sql** to populate `public.historical_analogues`. No row data is stored in this document; use the file `supabase/seed.sql`.

---

## Rebuild steps (summary)

1. Create a new Supabase project.
2. Run migrations in order: `00001_initial_schema.sql`, `00002_generation_stage.sql`, `00003_domain_results.sql`.
3. Run `seed.sql`.
4. Deploy edge functions from `supabase/functions/` (anthropic-test, generate-consequences).
5. Set function config so `generate-consequences` has `verify_jwt = false`.
6. Add all secret **names** in Vault / Edge Function secrets and set their values.
