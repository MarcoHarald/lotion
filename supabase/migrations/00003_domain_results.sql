-- Phased generation: store domain agent outputs and node id mapping for synthesis phase
alter table public.scenarios
  add column if not exists domain_results jsonb default '[]'::jsonb,
  add column if not exists node_id_map jsonb default '{}'::jsonb;

comment on column public.scenarios.domain_results is 'Accumulated domain agent outputs [{ domain, response }] for synthesis phase';
comment on column public.scenarios.node_id_map is 'Maps agent node id (e.g. energy-1) to DB node uuid for edge insertion in synthesis phase';
