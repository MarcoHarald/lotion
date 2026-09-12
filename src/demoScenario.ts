import type {
  AnalystFeedback,
  Edge,
  HistoricalAnalogue,
  Node,
  Scenario,
  ScenarioAnalogue,
  SourceCard,
} from "./supabase";

const NOW = "2026-03-12T12:00:00.000Z";
const SID = "11111111-1111-4111-8111-111111111111";

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export const demoScenario: Scenario = {
  id: SID,
  user_id: null,
  title: "Hormuz mining campaign",
  trigger_text:
    "Iran begins mining campaign in Strait of Hormuz in response to sanctions escalation",
  trigger_summary:
    "Iranian mining of Hormuz lanes; war-risk spike; tanker delay and partial reroute; Gulf/MENA second-order effects.",
  status: "complete",
  generation_stage: "synthesis",
  perplexity_cache: { preview: "War-risk premiums up; several majors delaying Hormuz transits." },
  perplexity_cached_at: "2026-03-12T11:40:00.000Z",
  created_at: NOW,
  updated_at: NOW,
};

const node = (
  id: string,
  parent_id: string | null,
  domain: Node["domain"] extends infer D ? D : string,
  title: string,
  rest: Partial<Node>
): Node => ({
  id,
  scenario_id: SID,
  parent_id,
  domain,
  title,
  description: rest.description ?? null,
  mechanism: rest.mechanism ?? null,
  confidence: rest.confidence ?? "medium",
  timeline: rest.timeline ?? "short",
  assumptions: rest.assumptions ?? null,
  monitoring_indicators: rest.monitoring_indicators ?? null,
  quantitative_estimate: rest.quantitative_estimate ?? null,
  historical_precedent: rest.historical_precedent ?? null,
  agent_generated_by: rest.agent_generated_by ?? domain,
  is_analyst_modified: false,
  created_at: NOW,
  updated_at: NOW,
});

export const demoNodes: Node[] = [
  node("n-root", null, "root", "Hormuz mining campaign", {
    description: "Iran seeds mines in Hormuz traffic lanes after a sanctions step-up.",
    mechanism: "Threat to the chokepoint that moves ~20% of globally traded oil.",
    confidence: "high",
    timeline: "immediate",
    agent_generated_by: "orchestrator",
  }),
  node("n-energy-1", "n-root", "energy", "War-risk tanker freeze", {
    description: "P&I clubs and hull underwriters reprice transits; several majors pause Hormuz sailings pending minesweep assurance.",
    mechanism: "Mine risk is an insured-peril event. Cover withdraws faster than physical capacity disappears.",
    confidence: "high",
    timeline: "immediate",
    assumptions: ["No immediate US/UK minesweep corridor", "Clubs treat mines as war risk, not marine"],
    monitoring_indicators: ["Lloyd's war-risk listing for Hormuz", "Maersk/MSC routing advisories", "VLCC fixture cancellations"],
    quantitative_estimate: "War-risk premium 0.5–2.0% of hull value per transit (from ~0.025%)",
    historical_precedent: "2012 Iran sanctions / Hormuz threats",
    agent_generated_by: "energy",
  }),
  node("n-energy-2", "n-energy-1", "energy", "Spot LNG price surge", {
    description: "Qatari and UAE cargoes delayed or held; Asian and European spot LNG tightens within days.",
    mechanism: "Qatar LNG and Gulf crude share the same strait. Insurance freeze hits gas as hard as oil.",
    confidence: "high",
    timeline: "short",
    assumptions: ["Qatar does not fully divert via Fujairah/pipeline options", "European storage is not at seasonal max"],
    monitoring_indicators: ["JKM and TTF day-on-day", "Ras Laffan loadings", "Qatari force-majeure language"],
    quantitative_estimate: "15–25% JKM spike in 1–2 weeks if transits stay impaired",
    historical_precedent: "2022 Russia–Ukraine energy decoupling",
    agent_generated_by: "energy",
  }),
  node("n-energy-3", "n-energy-2", "energy", "IEA reserve debate", {
    description: "IEA members float a coordinated SPR release to cap the fear premium, not to replace lost barrels.",
    mechanism: "Physical shortfall is modest at first; the market is pricing duration and insurance, not missing cargoes.",
    confidence: "medium",
    timeline: "medium",
    assumptions: ["OECD politics allow a release", "Saudi spare capacity is not fully committed"],
    monitoring_indicators: ["IEA emergency meeting notices", "US SPR draw announcements", "Saudi official output guidance"],
    quantitative_estimate: "SPR signalling historically trims $4–8/bbl of risk premium",
    historical_precedent: "1990 Gulf War / Kuwait invasion",
    agent_generated_by: "energy",
  }),
  node("n-food-1", "n-root", "food", "Fertiliser feedstock squeeze", {
    description: "Gulf urea and ammonia liftings slip; import-dependent producers in South Asia face a 3–6 week cover gap.",
    mechanism: "Ammonia and urea ride the same tanker/insurance stack as energy. A Hormuz freeze is a fertiliser event within a month.",
    confidence: "medium",
    timeline: "short",
    assumptions: ["India and Bangladesh have <6 weeks urea cover", "Black Sea fertiliser does not fully substitute"],
    monitoring_indicators: ["Middle East urea FOB offers", "Indian tender undersubscription", "Baltic ammonia freight"],
    quantitative_estimate: "Urea FOB +20–40% if Gulf liftings drop >15% for two weeks",
    historical_precedent: "2022 Russia–Ukraine energy decoupling",
    agent_generated_by: "food",
  }),
  node("n-food-2", "n-food-1", "food", "MENA grain delay cascade", {
    description: "Higher bunker and war-risk on remaining Gulf calls lengthens wheat and corn arrival windows into MENA mills.",
    mechanism: "Same ships, same clubs. Grain is a residual user of tanker-adjacent bulk capacity and insurance.",
    confidence: "medium",
    timeline: "short",
    assumptions: ["Egypt and Yemen remain import-dependent at current volumes"],
    monitoring_indicators: ["Egypt GASC tender timing", "Aden/Jeddah discharge delays", "Wheat CIF Alexandria"],
    quantitative_estimate: "7–14 day extra arrival lag; CIF +8–15% on affected routes",
    agent_generated_by: "food",
  }),
  node("n-fin-1", "n-root", "finance", "Tanker war-risk premium", {
    description: "War-risk and additional premiums reprice overnight; some hulls become uneconomic for a single Hormuz round-trip.",
    mechanism: "Insurance is the binding constraint before mines are the binding constraint.",
    confidence: "high",
    timeline: "immediate",
    assumptions: ["London market remains the primary war-risk venue"],
    monitoring_indicators: ["JWC listed areas", "Quoted AP as % of hull", "Mutual club circulars"],
    quantitative_estimate: "AP from ~0.025% to 0.5–2% of hull; $5–15/bbl equivalent on some VLCCs",
    historical_precedent: "2012 Iran sanctions / Hormuz threats",
    agent_generated_by: "finance",
  }),
  node("n-fin-2", "n-energy-2", "finance", "Import-bill FX shock", {
    description: "Energy-importing EMs spend reserves defending FX as the oil/LNG bill jumps faster than hedges roll.",
    mechanism: "Current-account hit is immediate; rate defence follows if the freeze lasts beyond two weeks.",
    confidence: "medium",
    timeline: "short",
    assumptions: ["No large pre-hedge book in Pakistan, Bangladesh, Türkiye"],
    monitoring_indicators: ["USD/PKR, USD/BDT, USD/TRY", "EM 5y CDS", "central-bank reserve prints"],
    quantitative_estimate: "50–150 bps EM energy-importer CDS widening in the first month",
    agent_generated_by: "finance",
  }),
  node("n-pol-1", "n-food-2", "political", "Subsidy-state protest risk", {
    description: "Governments that cap fuel and bread prices face a fiscal vs street trade-off within one to two months.",
    mechanism: "Pass-through into administered prices is a political decision. Delay spends fiscal space; pass-through spends legitimacy.",
    confidence: "speculative",
    timeline: "medium",
    assumptions: ["No offsetting GCC budget support", "Domestic stocks of wheat/fuel are thin"],
    monitoring_indicators: ["Official pump-price notices", "bread-price protests", "IMF staff-level mentions of subsidy bills"],
    quantitative_estimate: "Elevated unrest probability in highly import-dependent, low-buffer states if freeze >4 weeks",
    historical_precedent: "2017 Qatar blockade",
    agent_generated_by: "political",
  }),
  node("n-mil-1", "n-root", "military", "Coalition minesweeping", {
    description: "US 5th Fleet and partners surge MCM assets and announce a protected lane; credibility of the lane is the market variable.",
    mechanism: "Physical clearance is slow. The signal is whether underwriters accept the lane as insurable.",
    confidence: "high",
    timeline: "short",
    assumptions: ["Iran does not contest MCM with anti-ship fire", "Partners contribute MCM hulls within 10 days"],
    monitoring_indicators: ["5th Fleet MCM deployments", "UK/FR minehunter movements", "official lane coordinates"],
    quantitative_estimate: "Credible lane in 7–21 days; full clearance weeks to months",
    historical_precedent: "1990 Gulf War / Kuwait invasion",
    agent_generated_by: "military",
  }),
  node("n-mil-2", "n-mil-1", "military", "Escalation-ladder watch", {
    description: "Mining plus MCM creates a contact surface: IRGCN harassment, detainment, or a strike on a minesweeper.",
    mechanism: "The first kinetic incident against MCM or a merchant under escort is the jump from insurance shock to shooting war.",
    confidence: "medium",
    timeline: "immediate",
    assumptions: ["Iran's objective is leverage, not a full closure"],
    monitoring_indicators: ["IRGCN fast-boat density", "AIS dark activity near lanes", "detainment of merchant crews"],
    agent_generated_by: "military",
  }),
  node("n-sc-1", "n-energy-1", "supply_chain", "Cape reroute for non-Gulf", {
    description: "Owners already on the fence about Red Sea plus Hormuz send residual Asia–Europe strings via Cape; transit +10–14 days.",
    mechanism: "Two chokepoint risks stack. Schedulers buy certainty even when Hormuz is only impaired, not closed.",
    confidence: "high",
    timeline: "short",
    assumptions: ["Red Sea risk remains elevated", "bunker prices do not reverse the Cape arithmetic"],
    monitoring_indicators: ["Cape of Good Hope AIS counts", "Asia–N. Europe transit times", "blank sailings"],
    quantitative_estimate: "+10–14 days, +15–30% slot cost on affected strings",
    historical_precedent: "2021–2022 Houthi / Red Sea campaign",
    agent_generated_by: "supply_chain",
  }),
  node("n-sc-2", "n-sc-1", "supply_chain", "Petrochemical input lag", {
    description: "Naphtha, LPG and polymer feedstocks from the Gulf slip; Asian crackers cut rates before European ones.",
    mechanism: "Gulf NGL/naphtha is a swing feedstock. A two-week delay shows up as cracker utilisation, then resin prices.",
    confidence: "medium",
    timeline: "medium",
    assumptions: ["USGC and Asian alternative barrels do not fully backfill"],
    monitoring_indicators: ["CFR China naphtha", "cracker operating rates", "PE/PP spot vs contract"],
    quantitative_estimate: "Naphtha +10–20% CFR Asia if Gulf NGL delayed >2 weeks",
    agent_generated_by: "supply_chain",
  }),
];

const edge = (
  id: string,
  source: string,
  target: string,
  mechanism: string,
  is_cross_domain: boolean,
  confidence: Edge["confidence"] extends infer C ? C : string
): Edge => ({
  id,
  scenario_id: SID,
  source_node_id: source,
  target_node_id: target,
  mechanism,
  is_cross_domain,
  confidence,
  created_at: NOW,
});

export const demoEdges: Edge[] = [
  edge("e1", "n-root", "n-energy-1", "Mine threat withdraws marine cover", false, "high"),
  edge("e2", "n-energy-1", "n-energy-2", "Same insurance freeze hits Qatari LNG", false, "high"),
  edge("e3", "n-energy-2", "n-energy-3", "Price spike triggers IEA consultation", false, "medium"),
  edge("e4", "n-root", "n-food-1", "Gulf ammonia/urea share tanker risk", false, "medium"),
  edge("e5", "n-food-1", "n-food-2", "Fertiliser and grain compete for remaining cover", false, "medium"),
  edge("e6", "n-root", "n-fin-1", "JWC listing and AP reprice overnight", false, "high"),
  edge("e7", "n-energy-2", "n-fin-2", "LNG/oil bill hits EM current accounts", true, "medium"),
  edge("e8", "n-food-2", "n-pol-1", "Delayed grain plus fuel cost hits administered prices", true, "speculative"),
  edge("e9", "n-root", "n-mil-1", "MCM is the only path back to insurable transit", false, "high"),
  edge("e10", "n-mil-1", "n-mil-2", "Protected lane is a new target set", false, "medium"),
  edge("e11", "n-energy-1", "n-sc-1", "Owners stack Hormuz risk on existing Red Sea risk", true, "high"),
  edge("e12", "n-sc-1", "n-sc-2", "Longer strings delay Gulf NGL/naphtha", false, "medium"),
  edge("e13", "n-fin-1", "n-energy-1", "Premiums and sailing pauses reinforce each other", true, "high"),
];

export const demoSourceCards: SourceCard[] = [
  {
    id: "src-1",
    scenario_id: SID,
    node_id: "n-energy-1",
    platform: "web",
    handle: "Lloyd's List",
    snippet: "War-risk underwriters reviewing Hormuz as a listed area after reported mining activity; several owners delaying fixtures.",
    url: "https://www.lloydslist.com/",
    retrieved_at: NOW,
    created_at: NOW,
  },
  {
    id: "src-2",
    scenario_id: SID,
    node_id: "n-energy-2",
    platform: "perplexity",
    handle: "Perplexity",
    snippet: "Qatar remains the swing LNG supplier through Hormuz; any multi-day loading pause tightens JKM before TTF.",
    url: null,
    retrieved_at: NOW,
    created_at: NOW,
  },
  {
    id: "src-3",
    scenario_id: SID,
    node_id: "n-mil-1",
    platform: "web",
    handle: "USNI News",
    snippet: "5th Fleet MCM inventory and partner minehunters are the binding constraint on a declared transit lane.",
    url: "https://news.usni.org/",
    retrieved_at: NOW,
    created_at: NOW,
  },
];

export const demoHistoricalAnalogues: HistoricalAnalogue[] = [
  {
    id: "a-2012",
    event_name: "2012 Iran sanctions / Hormuz threats",
    year: 2012,
    region: ["Iran", "Strait of Hormuz", "Gulf"],
    domains: ["energy", "military", "finance", "supply_chain"],
    structural_similarity:
      "Threatened closure of chokepoint; sanctions on Iranian exports; insurance and shipping rate spikes.",
    ground_truth:
      "No physical closure; insurance and war-risk premiums rose; tanker rerouting discussed; oil prices elevated but no supply collapse.",
    relevant_lesson:
      "Threat of chokepoint closure can move markets and insurance without physical closure; credibility of threat and military posture drive premium.",
    created_at: NOW,
  },
  {
    id: "a-1973",
    event_name: "1973 Arab Oil Embargo",
    year: 1973,
    region: ["Middle East", "Global"],
    domains: ["energy", "finance", "political", "supply_chain"],
    structural_similarity:
      "Coordinated supply shock by producers; politicisation of oil exports; demand destruction in OECD.",
    ground_truth:
      "Oil prices quadrupled; strategic reserve creation (IEA); recession; lasting shift to efficiency and non-OPEC supply.",
    relevant_lesson:
      "Supply shocks propagate via prices and policy; strategic reserves dampen but do not eliminate volatility.",
    created_at: NOW,
  },
  {
    id: "a-1990",
    event_name: "1990 Gulf War / Kuwait invasion",
    year: 1990,
    region: ["Gulf", "Kuwait", "Iraq"],
    domains: ["energy", "military", "finance", "political"],
    structural_similarity:
      "Military conflict in major oil-producing region; immediate threat to shipping and production; rapid coalition response.",
    ground_truth:
      "Spike to ~$40/bbl (nominal); release of strategic reserves; production loss partly offset by Saudi; prices normalised within months.",
    relevant_lesson:
      "Markets price invasion risk fast; physical disruption and fear premium can be short-lived if alternative supply is credible.",
    created_at: NOW,
  },
  {
    id: "a-2021rs",
    event_name: "2021–2022 Houthi / Red Sea campaign",
    year: 2021,
    region: ["Red Sea", "Yemen", "Bab el-Mandeb"],
    domains: ["military", "supply_chain", "energy", "finance"],
    structural_similarity:
      "Sustained harassment of shipping at a chokepoint; rerouting via Cape; insurance and rate spikes.",
    ground_truth:
      "Major carriers rerouted via Cape; transit times and costs rose; no permanent closure.",
    relevant_lesson:
      "Prolonged harassment can match a short closure via rerouting and insurance; naval response and convoy options matter.",
    created_at: NOW,
  },
  {
    id: "a-2022",
    event_name: "2022 Russia-Ukraine energy decoupling",
    year: 2022,
    region: ["Europe", "Russia", "Ukraine"],
    domains: ["energy", "political", "food", "finance", "supply_chain"],
    structural_similarity:
      "Sustained supply shock; politicisation of gas/oil/fertiliser; realignment of trade and reserves.",
    ground_truth:
      "Gas and oil flows redirected; fertiliser and grain disruption; EU storage and LNG build-out.",
    relevant_lesson:
      "Politicised decoupling creates sustained price shocks; food and fertiliser interlink with energy.",
    created_at: NOW,
  },
];

export const demoScenarioAnalogues: (ScenarioAnalogue & {
  historical_analogues: HistoricalAnalogue | null;
})[] = [
  {
    id: "sa-1",
    scenario_id: SID,
    analogue_id: "a-2012",
    relevance_explanation:
      "Closest structural match: Hormuz threat transmitted first through insurance and war-risk, not through a physical closure.",
    created_at: NOW,
    historical_analogues: demoHistoricalAnalogues[0],
  },
  {
    id: "sa-2",
    scenario_id: SID,
    analogue_id: "a-2021rs",
    relevance_explanation:
      "Shows how sustained harassment plus a second chokepoint (Red Sea) produces Cape reroutes even without a blockade.",
    created_at: NOW,
    historical_analogues: demoHistoricalAnalogues[3],
  },
];

export const demoFeedback: AnalystFeedback[] = [
  {
    id: "fb-1",
    scenario_id: SID,
    node_id: "n-pol-1",
    user_id: null,
    feedback_type: "amplify",
    content: "Weight Egypt and Jordan subsidy bills harder; that is the fiscal-to-street path.",
    domain_tag: "political",
    status: "pending",
    re_run_triggered_at: null,
    created_at: NOW,
  },
];

export const demoTriggerText = demoScenario.trigger_text ?? "";
export const demoSelectedNodeId = "n-energy-2";
