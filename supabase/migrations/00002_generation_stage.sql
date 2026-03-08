-- Phase 2: staged generation status for UI (perplexity → domains → synthesis)
alter table public.scenarios
  add column if not exists generation_stage text;

comment on column public.scenarios.generation_stage is 'Current pipeline stage when status=generating: perplexity, energy, food, finance, political, military, supply_chain, synthesis, or null when complete';
