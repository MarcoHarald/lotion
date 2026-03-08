-- Seed historical_analogues (README Section 2 & 9). Run after 00001_initial_schema.sql.
-- Idempotent: ON CONFLICT DO NOTHING on (event_name, year).

insert into public.historical_analogues (event_name, year, region, domains, structural_similarity, ground_truth, relevant_lesson)
values
  (
    '1973 Arab Oil Embargo',
    1973,
    array['Middle East','Global'],
    array['energy','finance','political','supply_chain'],
    'Coordinated supply shock by producers; politicisation of oil exports; demand destruction in OECD.',
    'Oil prices quadrupled; strategic reserve creation (IEA); recession; lasting shift to efficiency and non-OPEC supply.',
    'Supply shocks propagate via prices and policy; strategic reserves dampen but do not eliminate volatility; political alignment of producers amplifies impact.'
  ),
  (
    '1990 Gulf War / Kuwait invasion',
    1990,
    array['Gulf','Kuwait','Iraq'],
    array['energy','military','finance','political'],
    'Military conflict in major oil-producing region; immediate threat to shipping and production; rapid coalition response.',
    'Spike to ~$40/bbl (nominal); release of strategic reserves; production loss partly offset by Saudi; prices normalised within months post-conflict.',
    'Markets price invasion risk fast; physical disruption and fear premium can be short-lived if alternative supply and reserves are credible.'
  ),
  (
    '2003 Iraq War',
    2003,
    array['Iraq','Gulf'],
    array['energy','political','military'],
    'Major military action in oil-producing state; uncertainty over supply and duration; no immediate large supply loss.',
    'Prices rose on uncertainty then fell; no sustained supply disruption; geopolitical risk premium persisted for years.',
    'Uncertainty and risk premium can dominate over actual supply loss; duration of conflict and damage to infrastructure matter more than invasion itself.'
  ),
  (
    '2012 Iran sanctions / Hormuz threats',
    2012,
    array['Iran','Strait of Hormuz','Gulf'],
    array['energy','military','finance','supply_chain'],
    'Threatened closure of chokepoint; sanctions on Iranian exports; insurance and shipping rate spikes.',
    'No physical closure; insurance and war-risk premiums rose; tanker rerouting and strategic stock releases discussed; oil prices elevated but no supply collapse.',
    'Threat of chokepoint closure can move markets and insurance without physical closure; credibility of threat and military posture drive premium.'
  ),
  (
    '2017 Qatar blockade',
    2017,
    array['Gulf','Qatar','Saudi Arabia','UAE'],
    array['energy','political','food','supply_chain'],
    'GCC political rupture; land/sea blockade of Qatar; LNG and food supply rerouting.',
    'Qatar rerouted trade and LNG; food imports diversified; no lasting LNG supply loss; regional realignment and lasting diplomatic rift.',
    'Blockades in integrated regions force rapid rerouting; LNG and food logistics can adapt; political consequences outlast supply disruption.'
  ),
  (
    '2021 Suez Canal blockage (Ever Given)',
    2021,
    array['Egypt','Red Sea','Global'],
    array['supply_chain','finance','energy'],
    'Accidental chokepoint closure; single-vessel incident with system-wide delay cascade.',
    'Canal blocked ~6 days; hundreds of vessels queued; spot rates spiked; delays propagated for weeks; no lasting structural change.',
    'Single-point failures in chokepoints cause cascading delays; recovery is faster than for deliberate or sustained disruption.'
  ),
  (
    '2021–2022 Houthi / Red Sea campaign',
    2021,
    array['Red Sea','Yemen','Bab el-Mandeb'],
    array['military','supply_chain','energy','finance'],
    'Sustained harassment of shipping at chokepoint; rerouting via Cape; insurance and rate spikes.',
    'Major carriers rerouted via Cape; transit times and costs rose; no permanent closure; risk premium and war-risk insurance increased.',
    'Prolonged harassment can achieve similar economic impact to short closure via rerouting and insurance; naval response and convoy options matter.'
  ),
  (
    '2022 Russia-Ukraine energy decoupling',
    2022,
    array['Europe','Russia','Ukraine'],
    array['energy','political','food','finance','supply_chain'],
    'Sustained supply shock; politicisation of gas/oil/fertiliser; realignment of trade and reserves.',
    'Gas and oil flows redirected; fertiliser and grain disruption; EU storage and LNG build-out; lasting shift in European energy mix and supply chains.',
    'Politicised decoupling creates sustained price and availability shocks; diversification and storage take years; food and fertiliser interlink with energy.'
  )
on conflict (event_name, year) do nothing;
