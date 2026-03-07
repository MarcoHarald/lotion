# AGENT BUILD BRIEF: Geopolitical Consequence Mapping Tool
### *A scenario reasoning engine for analysts tracking second and third-order effects of geopolitical events*

---

## 0. PREAMBLE — READ THIS FIRST

This document is a complete build brief for an autonomous coding agent. It contains everything needed to build a working prototype of a geopolitical consequence mapping tool — purpose, architecture, UX behaviour, data sources, AI integration strategy, known failure modes, and workarounds. Read the entire document before writing a single line of code.

This tool is **not** a news aggregator. It is **not** a dashboard. It is a structured reasoning interface that helps a knowledgeable analyst rapidly understand and explore the downstream consequences of a geopolitical trigger event — with particular focus on the Gulf region, energy markets, and global supply chain interdependencies.

---

## 1. PURPOSE AND MISSION

### The Problem Being Solved

When a significant geopolitical event occurs — a Strait of Hormuz disruption, a Gulf state blockade, a sudden shift in LNG export routing — the immediate first-order effects (energy price spike, shipping disruption) are obvious and quickly priced in by markets. The *real* analytical value lies in second and third-order effects: food insecurity in import-dependent nations, sovereign debt pressure, political instability, downstream manufacturing disruption, and the feedback loops between these domains.

Currently, analysts work through these consequence chains manually, using a combination of prose reports (Stratfor, Oxford Analytica), personal knowledge, and ad-hoc searches. This process is slow, non-visual, and makes assumptions implicit rather than explicit. By the time a thorough consequence analysis is complete, the window for actionable insight has often closed.

### The Mission

Build a tool that allows an analyst to input a geopolitical trigger event in plain language and, within under a minute, have a structured, interactive consequence graph populated across multiple domains — with timeline estimates, confidence indicators, historical analogues, and the ability to drill into, modify, and stress-test any node in the graph.

### The Target User

**Not** a general public user. **Not** someone who needs geopolitics explained. The user is an analyst, journalist, researcher, or informed observer who already understands the domain. They know what the Strait of Hormuz is, they understand LNG spot markets, they're familiar with concepts like sovereign debt contagion. The tool should respect this: no condescending explanations, no oversimplification. The value is speed of structured reasoning, not education.

---

## 2. CORE CONCEPTS AND TERMINOLOGY

### Trigger Event
A user-described geopolitical event that initiates the analysis. Examples:
- "Iran begins mining campaign in Strait of Hormuz"
- "Houthi attacks force Maersk to suspend Red Sea transits indefinitely"
- "Saudi Arabia signals willingness to accept non-USD payment for oil exports"
- "Qatar placed under blockade by GCC neighbours"

### Consequence Node
A discrete downstream effect of the trigger or of another consequence. Each node has:
- **Domain** (see below)
- **Description** of the effect
- **Confidence level** (High / Medium / Speculative)
- **Timeline** (Immediate: 0–72hrs / Short: 1–4 weeks / Medium: 1–6 months / Long: 6months+)
- **Mechanism** — a brief explanation of *why* this effect follows from its parent
- **Assumptions** — what must be true for this link to hold
- **Historical precedent** — if applicable, a named prior event

### Domains
The tool organises consequences across six domains. Each has a distinct visual identity:

| Domain | Colour | Scope |
|---|---|---|
| **Energy** | Amber | Oil, gas, LNG pricing; strategic reserves; pipeline vs shipping dependency |
| **Food & Agriculture** | Green | Fertiliser feedstocks; grain shipping routes; caloric import dependency |
| **Finance** | Blue | Sovereign debt; currency pressure; insurance/shipping rate spikes; capital flight |
| **Political Stability** | Red | Government vulnerability to price shocks; protest/unrest risk; regime change scenarios |
| **Military & Posture** | Dark grey | Force movements; deterrence signals; escalation ladders; proxy activation |
| **Supply Chain** | Purple | Industrial inputs; semiconductor dependencies; manufacturing disruption |

### Consequence Graph
A directed acyclic graph (in practice, sometimes with feedback loops) where:
- The trigger event is the root node
- Each domain contains child nodes connected by causal edges
- Nodes can have cross-domain connections (e.g. an Energy node triggering a Finance node)
- Depth typically goes 2–3 levels before confidence degrades too far to be useful

### Historical Analogue
A real prior event that is structurally similar to the current scenario, used to ground-truth the AI's consequence reasoning. Key analogues in the library:
- **1973 Arab Oil Embargo** — supply shock, strategic reserve creation, demand destruction
- **1990 Gulf War / Kuwait Invasion** — rapid oil price spike, military coalition formation
- **2003 Iraq War** — price uncertainty without supply disruption, geopolitical risk premium
- **2012 Iran Sanctions / Hormuz Threats** — threatened closure scenario, insurance rate spike
- **2021–2022 Houthi/Red Sea Campaign** — active chokepoint harassment, shipping rerouting economics
- **2017 Qatar Blockade** — GCC political rupture, LNG rerouting, food import disruption
- **2021 Suez Canal Blockage (Ever Given)** — accidental chokepoint closure, cascading delays
- **2022 Russia-Ukraine / Energy Decoupling** — sustained supply shock, political realignment, food crisis (fertiliser/grain)

---

## 3. ARCHITECTURE OVERVIEW

The tool is a single-page React application. There is no backend. All data fetching and AI calls happen client-side via API calls made from within the artifact/app.

### Three-Panel Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: Tool name, scenario title, export button                        │
├──────────────┬─────────────────────────────────────┬────────────────────┤
│              │                                     │                    │
│  LEFT PANEL  │        CENTRE PANEL                 │   RIGHT PANEL      │
│  ~280px      │        Consequence Graph            │   ~320px           │
│              │        (D3 force-directed)          │                    │
│  Trigger     │                                     │  Node Detail       │
│  Input       │                                     │  Inspector         │
│              │                                     │                    │
│  Timeline    │                                     │  Historical        │
│  Slider      │                                     │  Analogues         │
│              │                                     │                    │
│  Domain      │                                     │  Stress Test       │
│  Filters     │                                     │  Panel             │
│              │                                     │                    │
│  Scenario    │                                     │                    │
│  Library     │                                     │                    │
│              │                                     │                    │
└──────────────┴─────────────────────────────────────┴────────────────────┘
```

### Technology Stack
- **React** with hooks for state management
- **D3.js** for the force-directed consequence graph
- **Anthropic Claude API** (`claude-sonnet-4-20250514`) for consequence generation and reasoning
- **Tailwind CSS** for styling — dark theme, information-dense, professional
- All in a **single JSX file**

---

## 4. DETAILED COMPONENT SPECIFICATIONS

### 4.1 Left Panel — Control Surface

#### Trigger Event Input
- Large textarea, prominent, at top of left panel
- Placeholder text: *"Describe a geopolitical trigger event... e.g. 'Iran begins mining Strait of Hormuz in response to US sanctions escalation'"*
- Below it: a **Generate Consequences** button — primary CTA, full width
- While generating: show a pulsing status line with stage descriptions ("Analysing trigger domains... Mapping energy dependencies... Identifying political vulnerabilities... Cross-referencing historical analogues...")
- Loading should feel intelligent, not just a spinner

#### Timeline Slider
- A horizontal slider: **Immediate (0–72hr)** → **Short (1–4wk)** → **Medium (1–6mo)** → **Long (6mo+)**
- Moving the slider filters which nodes are visible in the graph — only nodes with timeline at or before the selected horizon are shown
- This is one of the most powerful UX interactions: watching the graph *grow* as you slide the timeline forward creates genuine insight
- Default position: Short (1–4 weeks)

#### Domain Filter Toggles
- Six toggle buttons, one per domain, each in the domain's colour
- Toggling a domain hides/shows all nodes of that domain
- All enabled by default

#### Scenario Library
- A collapsed/expandable section below the filters
- Contains 5–8 pre-seeded scenarios the analyst can load instantly without running the AI (uses cached/hardcoded consequence data)
- Scenarios should cover the most likely Gulf/MENA situations:
  - "Strait of Hormuz — partial disruption (mining/harassment)"
  - "Strait of Hormuz — full closure (military action)"
  - "Red Sea — sustained Houthi campaign escalation"
  - "Qatar — renewed GCC blockade"
  - "Saudi Arabia — internal political instability / succession crisis"
  - "Iran — nuclear threshold crossing"
  - "UAE — targeted infrastructure attack"
- Clicking a scenario loads it instantly into the graph, bypassing API call
- Each pre-seeded scenario must be fully populated with realistic, expert-level consequence data hardcoded in the app — not placeholders

### 4.2 Centre Panel — Consequence Graph

This is the centrepiece of the tool. It must be visually compelling and analytically useful simultaneously.

#### Graph Rendering (D3 Force-Directed)
- The trigger event is rendered as a central root node — larger, white/light, distinct
- Consequence nodes are arranged around it by domain, with some clustering by domain but allowing cross-domain edges to create natural cross-cluster connections
- Node size scales with **confidence level** — High confidence nodes are larger
- Node opacity scales with **timeline** — Immediate effects are fully opaque, Long effects are more transparent (but still readable)
- Edge thickness scales with strength of causal link
- Edges are directed (arrows) — causality has direction
- Cross-domain edges use a dashed line style to distinguish them from within-domain edges
- Domain colour is the primary visual encoding — the graph should be immediately readable as a colour-coded consequence map

#### Node Interactions
- **Hover**: Show a tooltip with node description and mechanism (the "why")
- **Click**: Populate the Right Panel Node Inspector with full details
- **Right-click or long-press**: Context menu with options:
  - "Expand this node further" (triggers API call to generate deeper consequences from this specific node)
  - "Stress test — what if this effect is worse than expected"
  - "Find historical precedent for this specific effect"
  - "Mark as unlikely / remove from analysis"

#### Graph Controls
- Zoom in/out (mouse wheel)
- Pan (drag on background)
- "Reset layout" button to re-centre
- "Export as PNG" button

#### Visual Confidence Encoding
Use a subtle visual treatment to distinguish confidence levels — this is important so analysts don't treat speculative nodes with the same weight as high-confidence ones:
- **High confidence**: Solid border, full opacity
- **Medium confidence**: Dashed border, 85% opacity  
- **Speculative**: Dotted border, 65% opacity, small ⚠ icon

### 4.3 Right Panel — Inspector and Context

#### Node Detail Inspector
When no node is selected, show a brief instruction. When a node is selected:
- Node title (large)
- Domain badge in domain colour
- Timeline badge
- Confidence badge
- **Mechanism**: Full explanation of the causal chain leading to this effect
- **Key assumptions**: Bulleted list of what must hold for this consequence to materialise
- **Data basis**: What structural fact underlies this (e.g. "68% of Pakistan's edible oil imports transit Strait of Hormuz")
- **Uncertainty range**: What would make this effect stronger / weaker than the median estimate
- **Monitoring indicators**: What real-world signals would confirm this consequence is beginning to materialise (this is extremely high value for analysts — it tells them what to watch)

#### Historical Analogues Panel
Below the Node Inspector, always visible:
- Automatically populated when a scenario is loaded/generated
- Shows 2–4 most relevant historical analogues
- Each analogue entry shows:
  - Event name and date
  - One-line structural similarity explanation
  - **What happened vs what models predicted** — a brief "ground truth" note
  - A "Compare scenarios" button that overlays the historical analogue's consequence pattern on the current graph in a muted colour — allowing the analyst to visually compare what happened then vs what the model predicts now

#### Stress Test Panel
Accessible via a "Stress Test" tab in the right panel:
- Analyst can select any node and define a "worse than expected" variant
- Tool re-runs consequence generation from that node with the amplified assumption
- Changed nodes highlight in the graph with a red outline
- Useful for war-gaming: "what if the Hormuz closure lasts 6 months instead of 3 weeks?"

---

## 5. AI INTEGRATION — CLAUDE API

### The Core Prompt Strategy

The quality of the consequence graph is entirely dependent on prompt design. This is the most important engineering decision in the tool. The AI call must return **structured data**, not prose.

#### Primary Consequence Generation Prompt

The system prompt must instruct Claude to:
1. Act as an expert geopolitical analyst with deep knowledge of energy markets, supply chains, and political economy
2. Return **only** a valid JSON object — no preamble, no explanation, no markdown fences
3. Populate a consequence graph with nodes at 2–3 levels of depth
4. For each node, populate all required fields: id, parentId, domain, title, description, mechanism, confidence, timeline, assumptions, monitoringIndicators, historicalPrecedent
5. Be specific and quantitative where possible ("a 15–25% spike in spot LNG prices" not "energy prices rise")
6. Cross-domain edges must be explicitly listed as separate edge objects

The user message should include:
- The trigger event description
- Current date/context
- An explicit instruction to weight consequences toward the Gulf/MENA regional context unless the trigger clearly implies otherwise
- A request to include 3–5 historical analogues relevant to this scenario

#### Expected JSON Schema

```
{
  "scenario": {
    "title": string,
    "triggerSummary": string,
    "generatedAt": ISO timestamp,
    "analystNotes": string  // AI's top 3 things the analyst should watch
  },
  "nodes": [
    {
      "id": string,
      "parentId": string | null,  // null for root
      "domain": "energy" | "food" | "finance" | "political" | "military" | "supply_chain",
      "title": string,  // short, 3-7 words
      "description": string,  // 1-2 sentences
      "mechanism": string,  // the causal explanation, 2-3 sentences
      "confidence": "high" | "medium" | "speculative",
      "timeline": "immediate" | "short" | "medium" | "long",
      "assumptions": string[],  // what must be true
      "monitoringIndicators": string[],  // what to watch for
      "historicalPrecedent": string | null,  // named event if applicable
      "quantitativeEstimate": string | null  // e.g. "15-25% price increase"
    }
  ],
  "crossDomainEdges": [
    {
      "sourceId": string,
      "targetId": string,
      "mechanism": string  // why domain A node affects domain B node
    }
  ],
  "historicalAnalogues": [
    {
      "event": string,
      "year": number,
      "structuralSimilarity": string,
      "groundTruth": string,  // what actually happened
      "relevantLesson": string
    }
  ]
}
```

#### Node Expansion Prompt (Right-click "Expand Further")
When the analyst right-clicks a node and selects expand, make a secondary API call with:
- The full current scenario context
- The specific node being expanded
- An instruction to generate 3–5 deeper consequences from that specific node, going one level deeper than currently exists
- Return the same node schema, with parentId set to the expanded node's id

#### Stress Test Prompt
When running a stress test:
- Send the current scenario + the specific node + the analyst's "worse than expected" description
- Ask Claude to identify which *other* nodes in the existing graph change in probability or magnitude, and what *new* nodes might appear
- Return a diff: modified nodes (with delta explanation) and new nodes

### API Call Management
- All API calls should show a loading state with descriptive stage text
- Primary generation call should use `max_tokens: 4000` — consequence graphs need space
- Include error handling: if JSON parse fails, retry once with an explicit "return only valid JSON, no other text" instruction
- Rate limit awareness: if multiple rapid calls are made, queue them

---

## 6. PRE-SEEDED SCENARIO DATA

The scenario library must contain fully hardcoded, expert-quality consequence data for the pre-seeded scenarios. This data must be realistic and specific — not generic placeholders. It serves two purposes: instant loading without API dependency, and as a quality benchmark for what AI-generated scenarios should aspire to.

### Quality Bar for Pre-seeded Data

Each pre-seeded scenario should have:
- 15–25 consequence nodes across all 6 domains
- 3–7 cross-domain edges
- Quantitative estimates where known (e.g. Bab-el-Mandeb disruption typically adds $2–4/barrel risk premium; Hormuz closure in 1Q would spike European TTF gas 40–80%)
- At least 2 historical analogues per scenario
- Monitoring indicators that are specific and actionable (not "watch energy markets" but "watch Platts LNG NE Asia spot index, JKM futures curve, and Suezmax tanker day rates")

---

## 7. DESIGN AND UX PRINCIPLES

### Visual Design
- **Dark theme, mandatory.** This is a professional analytical tool, often used in low-light environments. Dark background (#0f1117 or similar), high contrast text, domain colours adjusted for dark theme legibility.
- **Information density over whitespace.** The user is expert; they want data on screen, not breathing room.
- **No decorative elements.** No gradients for aesthetics, no animations that don't convey data, no splash screens.
- **Typography**: Monospace or technical sans-serif for data fields, clean readable font for descriptions.

### Interaction Principles
- The timeline slider is the primary exploration mechanism — it must feel responsive and the graph transition must be smooth (nodes fade in/out rather than snapping)
- Clicking a node should never navigate away or disrupt the graph — the right panel updates in place
- The analyst should never feel "locked out" of the tool — if an API call fails, pre-seeded scenarios still work; if a node expansion fails, the existing graph is unaffected
- Provide keyboard shortcuts for power users: `T` to toggle timeline, `D` to cycle domain filters, `R` to reset layout, `Escape` to deselect node

### Loading States
Loading must feel intelligent. Don't show a spinner with "Loading...". Show a sequence of descriptive status messages:
1. "Parsing trigger event..."
2. "Mapping primary energy dependencies..."
3. "Analysing food/fertiliser supply chain exposure..."
4. "Modelling sovereign fiscal vulnerabilities..."
5. "Cross-referencing historical analogues..."
6. "Building consequence graph..."

---

## 8. KNOWN CHALLENGES AND WORKAROUNDS

### Challenge 1: D3 + React Integration Complexity
D3 wants to own the DOM; React wants to own the DOM. This conflict is the #1 source of bugs in D3-in-React projects.

**Workaround**: Use D3 exclusively for layout calculation (force simulation, position computation) but use React to render the actual SVG elements. D3 computes x,y positions; React renders `<circle>` and `<line>` elements from state. This is more code but avoids the double-DOM-ownership problem. Use `useRef` for the SVG container and `useEffect` for D3 simulation, but store node positions in React state.

### Challenge 2: JSON Reliability from Claude API
LLMs sometimes return malformed JSON, add markdown fences, or include explanatory text before the JSON object.

**Workaround**: 
- Use a robust JSON extraction function that strips markdown fences, finds the first `{` and last `}`, and parses what's between them
- If parse fails, make one retry call with an explicit instruction: "Your previous response could not be parsed as JSON. Return only the raw JSON object with no other text, starting with { and ending with }"
- If retry also fails, show an error state that preserves any partial data and offers the analyst the option to load the closest pre-seeded scenario instead

### Challenge 3: Graph Readability at High Node Counts
A fully populated scenario with 20+ nodes will become visually cluttered.

**Workaround**:
- Domain clustering: use D3 force simulation with a cluster force that pulls same-domain nodes toward domain "centroid" positions arranged in a fixed hexagonal layout around the root
- Implement a "focus mode" — clicking a node dims all non-connected nodes to 20% opacity, highlighting only the selected node and its direct ancestors/descendants
- The timeline slider is also a natural density management tool — at "Immediate" only 3–6 nodes show; the graph grows gradually as the analyst slides forward

### Challenge 4: Cross-Domain Edge Routing Legibility
Cross-domain edges crossing the graph will tangle with within-domain edges.

**Workaround**: Render cross-domain edges as curved bezier paths with a larger curvature radius, and in a visually distinct style (dashed, slightly thinner). This visually separates them from the domain-internal edges. Also render cross-domain edges in a layer *below* nodes but *above* within-domain edges.

### Challenge 5: Stale Pre-seeded Data
Hardcoded scenarios will gradually become outdated as geopolitical situations evolve.

**Workaround**: Each pre-seeded scenario includes a `lastValidated` date field displayed to the analyst. Include a "Refresh with AI" button on pre-seeded scenarios that runs the current trigger through the API to generate a fresh version while keeping the pre-seeded version as a baseline for comparison.

### Challenge 6: Analyst Trust in AI-Generated Consequences
An analyst may not trust AI-generated consequence nodes, especially speculative ones.

**Workaround**: The confidence encoding (solid/dashed/dotted borders) is the primary trust signal. Additionally:
- Every node's "mechanism" and "assumptions" fields are always visible in the inspector — the analyst can evaluate the reasoning, not just the conclusion
- Include a "Challenge this node" interaction that prompts Claude to steelman *and* counter its own consequence assessment for that node
- The historical analogues panel grounds AI reasoning in real events, making it easier to evaluate

---

## 9. DATA SOURCES AND THEIR ROLES

The tool does not make live data API calls in its initial prototype form. However, the AI prompting should be informed by known structural facts, and the pre-seeded scenario data should reference real, specific data points. The following sources should inform the hardcoded data and AI system prompt:

- **UN Comtrade**: Bilateral trade flow data — which countries import what via which routes
- **EIA**: US Energy Information Administration — LNG export terminal capacities, strategic reserve levels, shipping route dependency maps
- **IEA**: Days of strategic petroleum reserve coverage by country
- **FAO**: Food import dependency ratios, fertiliser trade flows, caloric vulnerability indices
- **IMF World Economic Outlook**: Fiscal space indicators, current account deficits, countries most exposed to commodity import price shocks
- **UNCTAD**: Chokepoint dependency analysis — which % of world trade transits each major strait

These sources inform the *quality* of pre-seeded data and AI prompting, but the tool does not make live calls to them in prototype. A future version could integrate live Comtrade API calls to give the AI current trade flow data as context.

---

## 10. FUTURE CAPABILITIES (OUT OF SCOPE FOR PROTOTYPE, BUT DESIGN FOR)

The architecture should not preclude these future additions, even though they are not built in V1:

1. **Live data integration**: Perplexity API calls to enrich AI context with current news before generating consequences
2. **Collaborative annotations**: Multiple analysts adding comments/disagreements to specific nodes
3. **Scenario comparison mode**: Two consequence graphs side by side (e.g. "partial disruption" vs "full closure")
4. **Alert triggers**: Analyst defines a consequence node they're watching; tool monitors for monitoring indicator signals
5. **Export to structured report**: One-click export of the consequence graph as a formatted PDF briefing
6. **Custom domain schemas**: Analysts add their own domain categories relevant to their specific focus area

---

## 11. SUCCESS CRITERIA

The prototype is successful when:

1. An analyst can input a Gulf-region geopolitical trigger event and receive a populated, visually coherent consequence graph in under 60 seconds
2. The timeline slider meaningfully changes what nodes are visible and the graph transition is smooth
3. Clicking any node reveals a detailed, credible consequence assessment in the right panel with specific monitoring indicators
4. At least one pre-seeded scenario is fully populated with expert-quality data and loads instantly
5. The historical analogues panel shows relevant real events with genuine comparative insight
6. The tool runs entirely in the browser with no backend dependency beyond the Anthropic API
7. A knowledgeable analyst looking at the tool for the first time, without instruction, can understand how to use it within 30 seconds

---

## 12. TONE AND VOICE THROUGHOUT THE TOOL

Every piece of text in the tool — labels, tooltips, placeholder text, error messages, loading states — should reflect that this is a tool for experts. No hedging language like "AI may make mistakes." No oversimplification. Write as a fellow analyst would write: direct, specific, technically precise.

The tool's personality, if it has one, is a highly competent analyst colleague who has done the first pass of consequence mapping so you can spend your time interrogating, challenging, and extending their work rather than doing the initial scaffolding from scratch.

---

*Build brief prepared for autonomous agent execution. All architectural decisions documented above should be followed as specified. Where implementation details are not specified, default to the approach that best serves an expert analytical user on a dark-themed, information-dense interface.*
