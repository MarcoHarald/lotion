-- Lotion: initial schema (README Section 5)
-- Run with: supabase db push (or apply via Dashboard SQL)

-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- users (auth not enforced in V1; user_id can be null)
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text,
  created_at      timestamptz default now()
);

-- scenarios
create table if not exists public.scenarios (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.users(id),
  title                 text,
  trigger_text          text,
  trigger_summary       text,
  status                text check (status in ('generating','complete','error','archived')) default 'generating',
  perplexity_cache      jsonb,
  perplexity_cached_at  timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_scenarios_user_id on public.scenarios(user_id);
create index if not exists idx_scenarios_status on public.scenarios(status);

-- nodes (parent_id self-reference; root has parent_id null)
create table if not exists public.nodes (
  id                      uuid primary key default gen_random_uuid(),
  scenario_id             uuid not null references public.scenarios(id) on delete cascade,
  parent_id               uuid references public.nodes(id) on delete set null,
  domain                  text not null check (domain in ('root','energy','food','finance','political','military','supply_chain')),
  title                   text not null,
  description             text,
  mechanism               text,
  confidence              text check (confidence in ('high','medium','speculative')),
  timeline                text check (timeline in ('immediate','short','medium','long')),
  assumptions             text[],
  monitoring_indicators   text[],
  quantitative_estimate   text,
  historical_precedent    text,
  agent_generated_by      text,
  is_analyst_modified      boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index if not exists idx_nodes_scenario_id on public.nodes(scenario_id);
create index if not exists idx_nodes_parent_id on public.nodes(parent_id);
create index if not exists idx_nodes_domain on public.nodes(domain);

-- edges
create table if not exists public.edges (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references public.scenarios(id) on delete cascade,
  source_node_id  uuid not null references public.nodes(id) on delete cascade,
  target_node_id  uuid not null references public.nodes(id) on delete cascade,
  mechanism       text,
  is_cross_domain boolean default false,
  confidence      text check (confidence in ('high','medium','speculative')),
  created_at      timestamptz default now()
);

create index if not exists idx_edges_scenario_id on public.edges(scenario_id);

-- source_cards
create table if not exists public.source_cards (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references public.scenarios(id) on delete cascade,
  node_id         uuid references public.nodes(id) on delete cascade,
  platform        text check (platform in ('twitter','telegram','web','perplexity')),
  handle          text,
  snippet         text,
  url             text,
  retrieved_at    timestamptz,
  created_at      timestamptz default now()
);

create index if not exists idx_source_cards_scenario_id on public.source_cards(scenario_id);

-- analyst_feedback
create table if not exists public.analyst_feedback (
  id                  uuid primary key default gen_random_uuid(),
  scenario_id         uuid not null references public.scenarios(id) on delete cascade,
  node_id             uuid references public.nodes(id) on delete set null,
  user_id             uuid references public.users(id),
  feedback_type       text check (feedback_type in ('disagree','amplify','scenario_tweak','external_inject')),
  content             text,
  domain_tag          text,
  status              text check (status in ('pending','applied','dismissed')) default 'pending',
  re_run_triggered_at timestamptz,
  created_at          timestamptz default now()
);

create index if not exists idx_analyst_feedback_scenario_id on public.analyst_feedback(scenario_id);

-- historical_analogues (seeded; no FK from app)
create table if not exists public.historical_analogues (
  id                    uuid primary key default gen_random_uuid(),
  event_name            text not null,
  year                  integer not null,
  region                text[],
  domains               text[],
  structural_similarity text,
  ground_truth          text,
  relevant_lesson       text,
  created_at            timestamptz default now(),
  unique(event_name, year)
);

-- scenario_analogues (links scenarios to historical analogues)
create table if not exists public.scenario_analogues (
  id                    uuid primary key default gen_random_uuid(),
  scenario_id           uuid not null references public.scenarios(id) on delete cascade,
  analogue_id           uuid not null references public.historical_analogues(id) on delete cascade,
  relevance_explanation text,
  created_at            timestamptz default now()
);

create index if not exists idx_scenario_analogues_scenario_id on public.scenario_analogues(scenario_id);

-- RLS: allow all for now (solo analyst; auth later)
alter table public.users enable row level security;
alter table public.scenarios enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.source_cards enable row level security;
alter table public.analyst_feedback enable row level security;
alter table public.historical_analogues enable row level security;
alter table public.scenario_analogues enable row level security;

create policy "Allow all users" on public.users for all using (true) with check (true);
create policy "Allow all scenarios" on public.scenarios for all using (true) with check (true);
create policy "Allow all nodes" on public.nodes for all using (true) with check (true);
create policy "Allow all edges" on public.edges for all using (true) with check (true);
create policy "Allow all source_cards" on public.source_cards for all using (true) with check (true);
create policy "Allow all analyst_feedback" on public.analyst_feedback for all using (true) with check (true);
create policy "Allow all historical_analogues" on public.historical_analogues for all using (true) with check (true);
create policy "Allow all scenario_analogues" on public.scenario_analogues for all using (true) with check (true);
