# AGENT BUILD BRIEF: Geopolitical Consequence Mapping Tool
### *A scenario reasoning engine for analysts tracking second and third-order effects of geopolitical events*

---

## 0. PREAMBLE — READ THIS FIRST

This document is a complete build brief for an autonomous coding agent. It contains everything needed to build a working prototype of a geopolitical consequence mapping tool — purpose, architecture, UX behaviour, AI integration strategy, data persistence, known failure modes, and workarounds. Read the entire document before writing a single line of code.

This tool is **not** a news aggregator. It is **not** a dashboard. It is a structured reasoning interface where an AI agent swarm produces a first-pass consequence map of a geopolitical trigger event, and a knowledgeable analyst interrogates, challenges, and steers that map through iterative feedback. The consequence graph is a *draft* — the human-in-the-loop feedback cycle is the core product.

---

## 1. PURPOSE AND MISSION

### The Problem Being Solved

When a significant geopolitical event occurs — a Strait of Hormuz disruption, a Gulf state blockade, a sudden shift in LNG export routing — the immediate first-order effects are obvious and quickly priced in. The real analytical value lies in second and third-order effects: food insecurity in import-dependent nations, sovereign debt pressure, political instability, downstream manufacturing disruption, and the feedback loops between these domains.

Analysts currently work through these consequence chains manually, using prose reports, personal knowledge, and ad-hoc searches. This is slow, non-visual, and makes assumptions implicit rather than explicit. By the time a thorough consequence analysis is complete, the window for actionable insight has often closed.

### The Mission

Build a tool that allows an analyst to input a geopolitical trigger event in plain language and, within under a minute, have a structured interactive consequence graph populated across multiple domains — with streaming domain-by-domain results, cited OSINT sources, timeline estimates, confidence indicators, and historical analogues. The analyst can then push back on any node, inject external context, tweak the scenario, and re-trigger the agent swarm selectively — without waiting for a full re-run when only part of the graph needs updating.

### The Target User

**Not** a general public user. The user is a solo analyst, researcher, or informed observer who already understands the domain deeply. They know what the Strait of Hormuz is, they understand LNG spot markets, they're familiar with sovereign debt contagion. The tool respects this: no condescending explanations, no oversimplification. The value is speed of structured reasoning and a reasoning partner that can be interrogated and corrected.

---

## 2. CORE CONCEPTS AND TERMINOLOGY

### Trigger Event
A plain-language description of a geopolitical event that initiates the analysis. Examples:
- "Iran begins mining campaign in Strait of Hormuz in response to sanctions escalation"
- "Houthi attacks force Maersk to suspend Red Sea transits indefinitely"
- "Saudi Arabia signals willingness to accept non-USD payment for oil exports"
- "Qatar placed under blockade by GCC neighbours"

### Consequence Node
A discrete downstream effect of the trigger or of another consequence. Each node carries:
- **Domain** — which analytical domain this effect belongs to
- **Title** — 3–7 word summary
- **Description** — 1–2 sentence effect description
- **Mechanism** — causal explanation of why this follows from its parent
- **Confidence** — High / Medium / Speculative
- **Timeline** — Immediate (0–72hr) / Short (1–4wk) / Medium (1–6mo) / Long (6mo+)
- **Assumptions** — what must be true for this link to hold
- **Quantitative estimate** — where known ("15–25% spot LNG price spike")
- **Monitoring indicators** — real-world signals that would confirm this consequence is materialising
- **Historical precedent** — named prior event if applicable
- **Sources** — cited X/Telegram/web sources used by the agent to support this node

### Domains
Six analytical domains, each with a distinct visual identity:

| Domain | Colour | Scope |
|---|---|---|
| **Energy** | Amber | Oil, gas, LNG pricing; strategic reserves; pipeline vs shipping dependency |
| **Food & Agriculture** | Green | Fertiliser feedstocks; grain shipping routes; caloric import dependency |
| **Finance** | Blue | Sovereign debt; currency pressure; insurance/shipping rate spikes; capital flight |
| **Political Stability** | Red | Government vulnerability to price shocks; protest/unrest risk; regime change scenarios |
| **Military & Posture** | Dark grey | Force movements; deterrence signals; escalation ladders; proxy activation |
| **Supply Chain** | Purple | Industrial inputs; semiconductor dependencies; manufacturing disruption |

### Consequence Graph
A directed graph where the trigger event is the root node and consequence nodes fan out by domain, with cross-domain edges representing interactions between domains. Depth runs 2–3 levels before confidence degrades too far to be analytically useful.

### Source Cards
When an Agno domain agent uses an X/Twitter account or Telegram channel to enrich its reasoning, the source must be surfaced as a citable card — not silently absorbed. A source card contains: platform, handle/channel, brief content snippet, link, and which consequence node(s) it informed. The analyst can follow the source independently. These are *leads*, not just data.

### Historical Analogue
A real prior event structurally similar to the current scenario, used to ground-truth agent reasoning. Core analogue library (stored in Supabase, not hardcoded):
- 1973 Arab Oil Embargo
- 1990 Gulf War / Kuwait invasion
- 2003 Iraq War
- 2012 Iran sanctions / Hormuz threats
- 2017 Qatar blockade
- 2021 Suez Canal blockage (Ever Given)
- 2021–2022 Houthi / Red Sea campaign
- 2022 Russia-Ukraine energy decoupling

### Analyst Feedback
Structured input from the analyst after reviewing a generated graph. Four distinct feedback modes, each triggering a different re-run pattern:

| Mode | Description | Re-run scope |
|---|---|---|
| **Disagree** | "This won't happen because X" — analyst counter-reasoning injected as constraint | Affected domain agent(s) + re-synthesise |
| **Amplify** | "Go deeper on this, it's more important than weighted" | That domain agent only + re-synthesise |
| **Scenario tweak** | Changes to the trigger itself | Full swarm re-run (Perplexity cache preserved) |
| **External inject** | Analyst pastes in content — a Telegram post, a source the tool doesn't have | Inject into relevant agent(s) + re-synthesise |

The analyst can batch multiple feedback items across nodes before triggering a re-run. A single "Submit feedback" action commits all pending items at once, and the orchestrator determines the minimal re-run scope from the combined set.

---

## 3. SYSTEM ARCHITECTURE

### High-Level Flow

```
[1] TRIGGER INPUT
        ↓
[2] PERPLEXITY ENRICHMENT
    Pulls current news/context for the trigger event
    Output: enriched context object, cached for the session
    Refreshable manually by analyst; never auto-re-run on feedback loops
        ↓
[3] AGNO DOMAIN SWARM (parallel execution)
    ├── Energy agent        ← Perplexity context + X/Telegram tools
    ├── Food/Ag agent       ← Perplexity context + X/Telegram tools
    ├── Finance agent       ← Perplexity context
    ├── Political agent     ← Perplexity context + X/Telegram tools (heavy OSINT)
    ├── Military agent      ← Perplexity context + X/Telegram tools (heavy OSINT)
    └── Supply Chain agent  ← Perplexity context
    Each agent returns: consequence nodes + cross-domain edge suggestions + source cards
        ↓
    STREAMING RENDER — domain graphs appear in UI as each agent completes
    Analyst can begin reading immediately while remaining agents run
        ↓
[4] SYNTHESISER AGENT
    Runs once all domain agents complete
    ├── Internal consistency check (timeline/confidence coherence)
    ├── Cross-domain edge reconciliation (resolve contradictions between agents)
    └── Source attribution pass (flag unsourced influential claims)
    Cross-domain edges and Analogues panel appear in UI after synthesiser completes
        ↓
[5] FULL GRAPH RENDERED
    Consequence graph + source cards + historical analogues + feedback tools
        ↓
[6] ANALYST FEEDBACK
    Analyst reviews, annotates, disagrees, amplifies, tweaks, or injects
    Multiple feedback items batched in the Feedback Queue before submission
        ↓
[7] SELECTIVE RE-TRIGGER
    Orchestrator determines minimal re-run scope from feedback type(s):
    ├── Disagree / Amplify / External inject → re-run affected domain agent(s) only
    ├── Scenario tweak → full swarm re-run, Perplexity cache preserved
    └── Mixed batch → union of affected domains
    → Re-synthesise → re-render affected subgraph only
    → Feedback items marked Applied with timestamp in Supabase
```

### Degradation Hierarchy
Never show a blank screen when partial results are available:

- **RapidAPI fails** → proceed without OSINT enrichment; note absence in source cards panel
- **Perplexity fails** → proceed with Claude/Agno knowledge only; display "no live context" warning prominently
- **One domain agent fails** → render all other domains; show error state for failed domain with individual retry button
- **Synthesiser fails** → render raw domain outputs with visible "coherence unverified" warning; analyst can still interact with the graph
- **Supabase write fails** → continue session normally; retry persistence in background; warn analyst that save failed

---

## 4. TECHNOLOGY STACK

| Layer | Technology | Role |
|---|---|---|
| Frontend | React + D3.js + Tailwind CSS | Single-page app, graph rendering, UI |
| Agent orchestration | Agno | Domain swarm coordination, parallel execution, selective re-triggering |
| Primary reasoning | Anthropic Claude API (`claude-sonnet-4-20250514`) | All domain agents + synthesiser |
| Live context enrichment | Perplexity API | Pre-swarm current events context, session-cached |
| OSINT enrichment | RapidAPI (X/Twitter, Telegram) | Domain agent tools, optional enrichment layer |
| Persistence | Supabase (Postgres) | Scenarios, nodes, edges, feedback, analogues, source cards |
| Secrets management | Supabase Vault | All API keys — never in code, never in committed environment files |

### API Key Management — Critical
All five external service credentials (Anthropic, Agno, Perplexity, RapidAPI, Supabase) must be stored in **Supabase Vault**. No API keys are to be hardcoded anywhere in the codebase. No API keys in `.env` files committed to version control. The application retrieves secrets from Supabase Vault at runtime. Document the required vault key names clearly in a `SETUP.md` so a developer can populate them on first deploy without reading source code.

---

## 5. DATABASE SCHEMA

The schema is designed for a solo analyst today but structured for multi-user from the start. Auth UI is not built in V1 — `user_id` fields are present and indexed but authentication is not enforced yet.

### `users`
```sql
id              uuid primary key
email           text
created_at      timestamptz
```

### `scenarios`
```sql
id                  uuid primary key
user_id             uuid references users(id)
title               text
trigger_text        text            -- analyst's original input verbatim
trigger_summary     text            -- synthesiser's cleaned version
status              text check (status in ('generating','complete','error','archived'))
perplexity_cache    jsonb           -- cached enrichment context, timestamped
perplexity_cached_at timestamptz
created_at          timestamptz
updated_at          timestamptz
```

### `nodes`
```sql
id                      uuid primary key
scenario_id             uuid references scenarios(id)
parent_id               uuid references nodes(id)   -- null for root trigger node
domain                  text check (domain in ('root','energy','food','finance','political','military','supply_chain'))
title                   text
description             text
mechanism               text
confidence              text check (confidence in ('high','medium','speculative'))
timeline                text check (timeline in ('immediate','short','medium','long'))
assumptions             text[]
monitoring_indicators   text[]
quantitative_estimate   text
historical_precedent    text
agent_generated_by      text        -- which domain agent created this node
is_analyst_modified     boolean default false
created_at              timestamptz
updated_at              timestamptz
```

### `edges`
```sql
id              uuid primary key
scenario_id     uuid references scenarios(id)
source_node_id  uuid references nodes(id)
target_node_id  uuid references nodes(id)
mechanism       text
is_cross_domain boolean
confidence      text check (confidence in ('high','medium','speculative'))
created_at      timestamptz
```

### `source_cards`
```sql
id              uuid primary key
scenario_id     uuid references scenarios(id)
node_id         uuid references nodes(id)
platform        text check (platform in ('twitter','telegram','web','perplexity'))
handle          text            -- @handle or channel name
snippet         text
url             text
retrieved_at    timestamptz
created_at      timestamptz
```

### `analyst_feedback`
```sql
id                      uuid primary key
scenario_id             uuid references scenarios(id)
node_id                 uuid references nodes(id)   -- null = scenario-level feedback
user_id                 uuid references users(id)
feedback_type           text check (feedback_type in ('disagree','amplify','scenario_tweak','external_inject'))
content                 text        -- analyst's written feedback or injected content
domain_tag              text        -- inferred from node's domain, used for re-run scoping
status                  text check (status in ('pending','applied','dismissed'))
re_run_triggered_at     timestamptz
created_at              timestamptz
```

### `historical_analogues`
```sql
id                      uuid primary key
event_name              text
year                    integer
region                  text[]
domains                 text[]      -- which domains this analogue is relevant to
structural_similarity   text
ground_truth            text        -- what actually happened
relevant_lesson         text
created_at              timestamptz
```
*Seeded on first deploy. Never hardcoded in frontend. New analogues added via database without code changes.*

### `scenario_analogues`
```sql
id                      uuid primary key
scenario_id             uuid references scenarios(id)
analogue_id             uuid references historical_analogues(id)
relevance_explanation   text        -- why this analogue applies to this specific scenario
created_at              timestamptz
```

---

## 6. AGNO AGENT SPECIFICATIONS

### Orchestrator Agent
Receives the trigger event and analyst feedback. Dispatches domain agents in parallel, passing Perplexity context to each. Collects outputs and passes to synthesiser. On feedback re-trigger, determines minimal re-run scope from feedback types and domain tags, then dispatches only the necessary agents with feedback content injected as constraints.

### Domain Agents (six, parallel)
Each domain agent receives:
- Trigger event text
- Perplexity enrichment context object
- Domain specialisation and scope definition
- Any analyst feedback relevant to its domain (on re-runs), as explicit constraints
- Existing nodes for its domain (on re-runs) — modify rather than regenerate from scratch; return a `change_type` field per node: `modified | new | unchanged | removed`

OSINT tool use via RapidAPI is most critical for Political and Military agents. Energy and Food agents use it selectively. Finance and Supply Chain agents rely primarily on Perplexity context and Claude reasoning.

When X/Telegram sources are used, agents must return source cards — handle, snippet, URL, and which node(s) the source informed. Sources are leads for the analyst, not anonymous data.

### Synthesiser Agent
Runs once all domain agents complete. Performs three tasks in order — it does not generate new consequence nodes:

1. **Consistency check**: Timeline and confidence coherence. A Long-timeline node cannot be the parent of a Short-timeline node. Speculative nodes should not be parents of High-confidence nodes without explicit flagging. Correct or flag.

2. **Cross-domain reconciliation**: Merge duplicate effects touched by multiple domain agents. Resolve contradictions. Validate cross-domain edge suggestions. Build the final edge list.

3. **Source attribution**: Attach cited sources to the nodes they informed. Flag Medium/High confidence nodes with no source basis as "agent reasoning, uncited."

The coherence bar is internal logic, not plausibility. Wacky-but-coherent stays. Incoherent gets flagged.

---

## 7. AI PROMPT DESIGN

### Domain Agent System Prompt Requirements
Each domain agent's system prompt must specify:
- Expert persona for that domain
- Return **only valid JSON** — no preamble, no markdown fences, no explanation text
- Exact JSON schema (see below)
- Be specific and quantitative where possible
- Cite sources explicitly when OSINT tools are used — handle, snippet, URL
- Weight consequences toward Gulf/MENA context unless trigger implies otherwise
- On re-runs: treat existing nodes as starting point, return only changed nodes with `change_type`

### Synthesiser System Prompt Requirements
- Role is consistency checker and reconciler, not analyst
- Return structured reconciliation output: resolved contradictions, merged nodes, validated edges, flagged unsourced claims
- Coherence is the bar, not plausibility

### Domain Agent JSON Output Schema
```json
{
  "domain": "string",
  "nodes": [
    {
      "id": "string",
      "parent_id": "string | null",
      "title": "string",
      "description": "string",
      "mechanism": "string",
      "confidence": "high | medium | speculative",
      "timeline": "immediate | short | medium | long",
      "assumptions": ["string"],
      "monitoring_indicators": ["string"],
      "quantitative_estimate": "string | null",
      "historical_precedent": "string | null",
      "change_type": "new | modified | unchanged | removed"
    }
  ],
  "cross_domain_edge_suggestions": [
    {
      "source_node_id": "string",
      "target_domain": "string",
      "mechanism": "string",
      "confidence": "high | medium | speculative"
    }
  ],
  "source_cards": [
    {
      "platform": "twitter | telegram | web",
      "handle": "string",
      "snippet": "string",
      "url": "string | null",
      "informs_node_ids": ["string"]
    }
  ]
}
```

### JSON Reliability
1. Strip markdown fences if present
2. Extract content between first `{` and last `}`
3. If parse fails, retry once with explicit: "Return only raw JSON starting with { and ending with }. No other text."
4. If retry fails, mark domain as errored, render other domains, show per-domain retry button

---

## 8. FRONTEND ARCHITECTURE

### Layout: Three-Panel Dark Interface

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: Scenario title | Agent status | Cache timestamp | Export        │
├──────────────┬─────────────────────────────────────────┬────────────────────┤
│  LEFT PANEL  │        CENTRE PANEL                 │   RIGHT PANEL      │
│  ~280px      │        Consequence Graph            │   ~340px           │
│              │        D3 force-directed SVG        │                    │
│  Trigger     │                                     │  [Tabs]            │
│  Input       │        Domains stream in            │  Node Inspector    │
│              │        as agents complete           │  Source Cards      │
│  Timeline    │                                     │  Analogues         │
│  Slider      │        Cross-domain edges +         │  Stress Test       │
│              │        Analogues appear after       │                    │
│  Domain      │        synthesiser completes        │  ──────────────    │
│  Filters     │                                     │  Feedback Queue    │
│              │                                     │  (pending items)   │
│  Scenario    │                                     │                    │
│  Library     │                                     │  [Submit Feedback] │
└──────────────┴─────────────────────────────────────┴────────────────────┘
```

### Visual Design
- **Dark theme mandatory.** Background `#0f1117`. High contrast text. Domain colours tuned for dark background.
- **Information density over whitespace.** Expert user. Pack in data.
- **No decorative elements.** No aesthetic animations. Motion only when it conveys data (timeline slider, streaming graph build).
- Typography: technical sans-serif for UI chrome, monospace for data fields and estimates.

### Left Panel

**Trigger Input**: Large textarea. Placeholder: *"Describe a geopolitical trigger event..."*. Full-width Generate button below. During generation, button becomes a live status indicator cycling through agent pipeline stages with specific descriptions — not a generic spinner.

**Timeline Slider**: Four positions — Immediate / Short / Medium / Long. Filters visible nodes to those at or before selected horizon. Nodes fade in/out on transition. Default: Short.

**Domain Filter Toggles**: Six coloured buttons, all on by default.

**Scenario Library**: Collapsible. Lists saved scenarios from Supabase for this user. Clicking loads full scenario state — graph, feedback history, source cards, analogue associations. No hardcoded scenarios in frontend. The library is topic-agnostic by design: Gulf scenarios today, Taiwan Strait tomorrow, Sahel next month — same schema, same UI, no code changes required.

### Centre Panel — Consequence Graph

**D3 Force-Directed Graph**: Root trigger node at centre, larger, white, distinct. Six domain clusters at hexagonal centroid positions around root. Within-domain edges: solid lines. Cross-domain edges: dashed bezier curves, rendered below nodes, appearing only after synthesiser completes.

**Node Visual Encoding**:
- Colour = domain
- Size = confidence (High > Medium > Speculative)
- Opacity = timeline (Immediate 100% → Long 60%)
- Border = confidence (solid / dashed / dotted)
- ⚠ icon on speculative nodes
- 📎 icon on nodes with source cards

**Node Interactions**:
- Hover: tooltip — title, domain, timeline, confidence
- Click: populate right panel Node Inspector; activate focus mode (non-connected nodes dim to 20%)
- Right-click context menu: Expand further / Disagree / Amplify / Find historical precedent / Remove

**Graph Controls**: Zoom (scroll), pan (drag background), Reset layout, Export PNG.

**Keyboard shortcuts**: `T` toggle timeline, `D` cycle domain filters, `R` reset layout, `Escape` deselect node.

### Right Panel

**Node Inspector Tab**: Domain badge, timeline badge, confidence badge. Mechanism. Key assumptions. Quantitative estimate. Monitoring indicators (highest-value field — what to watch to confirm the consequence is materialising). Historical precedent. "Add feedback" button.

**Source Cards Tab**: All source cards grouped by node. Platform icon, handle, snippet, link. If no sources: informational note, not an error.

**Analogues Tab**: 2–4 historical analogues for the current scenario. Event, year, structural similarity, ground truth, lesson. "Overlay on graph" button renders muted ghost of historical consequence pattern over current graph for visual comparison.

**Stress Test Tab**: Select a node. Describe worse-than-expected variant. "Run stress test" → targeted API call → returns modified nodes (with delta) and new nodes. Stress-tested nodes show red outline on graph.

**Feedback Queue** (bottom of right panel, always visible): List of pending feedback items. Each shows: type badge, node reference, content preview, remove button. "Submit all feedback" triggers selective re-run. After completion, items show Applied state with timestamp.

---

## 9. SCENARIO SEEDING

All scenario data lives in Supabase. Nothing is hardcoded in the frontend.

On first deploy, a seed script populates:

**`historical_analogues`**: Full analogue library as specified in Section 2, with all fields populated with expert-quality content.

**Initial scenario seeds**: A set of Gulf/MENA scenarios in the `scenarios`, `nodes`, `edges`, and `source_cards` tables representing expert-quality first-pass analysis. These are not placeholders — each must include quantitative estimates, specific monitoring indicators, and realistic source card references. Seeded scenarios:

- Strait of Hormuz partial disruption (mining/harassment)
- Strait of Hormuz full closure (military action)
- Red Sea sustained Houthi escalation
- Qatar renewed GCC blockade
- Saudi Arabia internal political instability
- Iran nuclear threshold crossing
- UAE targeted infrastructure attack

The scenario schema is intentionally topic-agnostic. Future domains (Taiwan Strait, South China Sea, Sahel) are added via database seeding only — no code changes required.

---

## 10. KNOWN CHALLENGES AND WORKAROUNDS

### D3 + React DOM Conflict
D3 and React both want to own the DOM.

**Workaround**: D3 computes positions only. React renders all SVG elements from state. D3 never touches the DOM. Use `useRef` for SVG container, `useEffect` for simulation, store positions in React state updated via simulation tick callbacks.

### Graph Readability at Scale
20+ nodes creates visual clutter.

**Workaround**: Domain clustering with hexagonal centroid layout. Focus mode (click node → dim non-connected to 20%). Timeline slider as natural density tool — analyst slides forward to grow the graph progressively.

### Cross-Domain Edge Tangling
Cross-domain edges cross the centre of the graph.

**Workaround**: High-curvature bezier paths for cross-domain edges. Rendered in a dedicated SVG layer below nodes but above within-domain edges. Dashed style distinguishes them visually.

### Perplexity Cache Staleness
Session cache may go stale during a fast-moving situation.

**Workaround**: Display cache timestamp in header next to "Refresh context" button. Analyst decides when to invalidate. Scenario tweaks do not auto-refresh.

### Synthesiser Cannot Run Until All Agents Complete
**Workaround**: This is by design, not a limitation. Stream domain outputs immediately as agents complete. Render "synthesis in progress" state on cross-domain edges and Analogues tab. Second visual wave when synthesiser finishes. Analyst is reading useful content throughout.

### Feedback Re-run Scope Determination
Mixed feedback batches (disagree on energy node + inject into military) require correct scope inference.

**Workaround**: Feedback items carry `domain_tag` (inferred from node's domain at creation). Orchestrator unions all affected domains from the batch. If scope is ambiguous, default to broader re-run rather than narrower — coherence is worth the latency.

---

## 11. SUCCESS CRITERIA

1. Analyst inputs a trigger event and receives a streaming consequence graph within 60 seconds, domains appearing as agents complete
2. Timeline slider meaningfully filters nodes with smooth transitions
3. Source cards appear for OSINT-informed nodes, with handles and links the analyst can follow independently
4. Analyst can batch feedback across multiple nodes, submit once, and see only the affected subgraph update
5. Scenario tweak triggers full swarm re-run with Perplexity cache preserved
6. Historical analogues surface per scenario and can be overlaid on the graph
7. Any single agent or service failure degrades gracefully — partial graph visible, failed component retryable, no blank screens
8. All scenario data, feedback, and source cards persist to Supabase and are fully recoverable across sessions
9. No API keys appear anywhere in the codebase
10. A knowledgeable analyst understands how to use the tool within 30 seconds without instruction

---

## 12. TONE AND VOICE

Every piece of text in the tool — labels, tooltips, placeholders, error messages, loading states — reflects that this is a tool for experts. No hedging. No oversimplification. Direct, specific, technically precise.

The tool's role is a highly capable analyst who has done the first-pass consequence mapping so the human can spend their time interrogating, challenging, and extending it. The AI produces the draft. The analyst is the editor.

---

*Build brief prepared for autonomous agent execution. All architectural decisions documented above should be followed as specified. Where implementation details are not specified, default to the approach that best serves an expert analytical user on a dark-themed, information-dense interface.*
