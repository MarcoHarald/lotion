// Phase 2: Perplexity enrichment, six domain agents (parallel), synthesiser.
// Secrets: ANTHROPIC_API_KEY, PERPLEXITY_API_KEY (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "claude-sonnet-4-6";

/** Cap trigger and context sizes so Anthropic/Perplexity payloads stay reasonable (avoid timeouts/rate limits). */
const MAX_TRIGGER_CHARS = 3000;
const MAX_PERPLEXITY_CONTEXT_CHARS = 6000;
const MAX_FEEDBACK_CONTEXT_CHARS = 4000;

const DOMAINS = ["energy", "food", "finance", "political", "military", "supply_chain"] as const;

interface DomainNode {
  id: string;
  parent_id: string | null;
  title: string;
  description: string;
  mechanism: string;
  confidence: "high" | "medium" | "speculative";
  timeline: "immediate" | "short" | "medium" | "long";
  assumptions?: string[];
  monitoring_indicators?: string[];
  quantitative_estimate?: string | null;
  historical_precedent?: string | null;
  change_type?: string;
}

interface CrossDomainEdgeSuggestion {
  source_node_id: string;
  target_domain: string;
  target_node_id?: string;
  mechanism: string;
  confidence: string;
}

interface SourceCard {
  platform: string;
  handle?: string;
  snippet?: string;
  url?: string | null;
  informs_node_ids?: string[];
}

interface DomainAgentResponse {
  domain?: string;
  nodes: DomainNode[];
  cross_domain_edge_suggestions?: CrossDomainEdgeSuggestion[];
  source_cards?: SourceCard[];
}

interface SynthesiserEdge {
  source_node_id: string;
  target_node_id: string;
  mechanism: string;
  confidence: string;
}

interface SynthesiserResponse {
  edges: SynthesiserEdge[];
  analogue_ids?: string[];
}

function extractJson(text: string): string {
  const stripped = text.replace(/^```\w*\n?/gm, "").replace(/\n?```$/gm, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return text;
  return stripped.slice(start, end + 1);
}

/** Parse JSON; on failure try stripping trailing commas (common LLM mistake) and parse again. */
function tryParseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fixed = raw.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(fixed) as T;
  }
}

/** Try to parse synthesiser response with repair; on total failure return empty edges and log. */
function tryParseSynthesisResponse(raw: string): SynthesiserResponse {
  try {
    return tryParseJson<SynthesiserResponse>(raw);
  } catch (e1) {
    console.error("[Synthesis] JSON parse failed (first try):", (e1 as Error)?.message ?? e1);
  }
  const repairs = [
    raw.replace(/,(\s*[}\]])/g, "$1"),
    raw.replace(/\r\n/g, "\n").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""),
    raw.replace(/,(\s*[}\]])/g, "$1").replace(/\r\n/g, "\n"),
  ];
  for (let i = 0; i < repairs.length; i++) {
    try {
      const out = JSON.parse(repairs[i]) as SynthesiserResponse;
      if (Array.isArray(out.edges)) {
        console.log("[Synthesis] Parse succeeded after repair", i + 1);
        return out;
      }
    } catch {
      // continue
    }
  }
  const edgesMatch = raw.match(/"edges"\s*:\s*\[([\s\S]*?)\]/);
  if (edgesMatch) {
    try {
      const arrStr = "[" + edgesMatch[1] + "]";
      const fixedArr = arrStr.replace(/,(\s*[}\]])/g, "$1");
      const arr = JSON.parse(fixedArr) as SynthesiserEdge[];
      if (Array.isArray(arr)) {
        console.log("[Synthesis] Recovered edges array only, count:", arr.length);
        return { edges: arr, analogue_ids: [] };
      }
    } catch (e2) {
      console.error("[Synthesis] Edges array recovery failed:", (e2 as Error)?.message ?? e2);
    }
  }
  console.error("[Synthesis] All parse attempts failed, returning empty edges. Raw length:", raw.length);
  return { edges: [], analogue_ids: [] };
}

/** Exponential backoff delays (seconds) for 429 retries. */
const RATE_LIMIT_BACKOFF = [10, 30, 60];

/** Retry up to 3 times on 429. Uses Retry-After when present, else 10s / 30s / 60s. */
async function anthropicPost(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ res: Response; wasRateLimited: boolean }> {
  const doFetch = () =>
    fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  let res = await doFetch();
  let wasRateLimited = false;
  for (let attempt = 0; attempt < RATE_LIMIT_BACKOFF.length && res.status === 429; attempt++) {
    wasRateLimited = true;
    const suggested = parseInt(res.headers.get("retry-after") ?? "", 10);
    const waitSec = Number.isFinite(suggested) && suggested > 0
      ? Math.min(65, suggested)
      : RATE_LIMIT_BACKOFF[attempt];
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    res = await doFetch();
  }
  if (res.status === 429) wasRateLimited = true;
  return { res, wasRateLimited };
}

async function callPerplexity(apiKey: string, triggerText: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Summarise current news and recent developments (last 2 weeks) relevant to this geopolitical scenario. Be concise; focus on facts and signals that would affect consequence analysis. Scenario: ${triggerText}. Return a short structured summary (key events, actors, recent developments).`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Perplexity error:", res.status, t);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return { summary: content, fetched_at: new Date().toISOString() };
  } catch (e) {
    console.error("Perplexity exception:", e);
    return null;
  }
}

function domainSystemPrompt(domain: string): string {
  const scope: Record<string, string> = {
    energy: "Oil, gas, LNG pricing; strategic reserves; pipeline vs shipping; Gulf/MENA energy flows.",
    food: "Fertiliser feedstocks; grain shipping routes; caloric import dependency; food security.",
    finance: "Sovereign debt; currency pressure; insurance and shipping rate spikes; capital flight.",
    political: "Government vulnerability to price shocks; protest/unrest risk; regime change scenarios.",
    military: "Force movements; deterrence signals; escalation ladders; proxy activation.",
    supply_chain: "Industrial inputs; semiconductor dependencies; manufacturing disruption; logistics.",
  };
  return `You are an expert geopolitical analyst focused on: ${scope[domain] ?? domain}.
Return ONLY a valid JSON object—no preamble, no markdown fences, no explanation.
Schema: { "domain": "${domain}", "nodes": [ { "id": "unique id within domain (e.g. ${domain}-1)", "parent_id": null or id of parent node (use "root" for trigger)", "title": "3-7 words", "description": "1-2 sentences", "mechanism": "causal explanation", "confidence": "high"|"medium"|"speculative", "timeline": "immediate"|"short"|"medium"|"long", "assumptions": ["string"], "monitoring_indicators": ["string"], "quantitative_estimate": "string or null", "historical_precedent": "string or null" } ], "cross_domain_edge_suggestions": [ { "source_node_id": "", "target_domain": "other domain name", "mechanism": "", "confidence": "" } ], "source_cards": [] }
Produce 2-4 consequence nodes for this domain only. First node may have parent_id "root". Be specific and quantitative. Weight toward Gulf/MENA unless trigger implies otherwise.`;
}

async function callDomainAgent(
  apiKey: string,
  domain: string,
  triggerText: string,
  perplexityContext: Record<string, unknown> | null,
  feedbackContext?: string
): Promise<DomainAgentResponse> {
  const rawSummary = perplexityContext?.summary;
  const summaryStr = typeof rawSummary === "string"
    ? rawSummary.slice(0, MAX_PERPLEXITY_CONTEXT_CHARS)
    : "";
  const contextStr = summaryStr ? `\nCurrent context (use to ground your analysis):\n${summaryStr}` : "";
  const feedbackStr = feedbackContext
    ? `\n\nAnalyst feedback (incorporate or acknowledge):\n${feedbackContext.slice(0, MAX_FEEDBACK_CONTEXT_CHARS)}`
    : "";
  const userMessage = `Trigger event: ${triggerText}${contextStr}${feedbackStr}\n\nDate: ${new Date().toISOString().slice(0, 10)}. Return only the JSON object for domain "${domain}".`;

  const { res, wasRateLimited } = await anthropicPost(apiKey, {
    model: MODEL,
    max_tokens: 4096,
    system: domainSystemPrompt(domain),
    messages: [{ role: "user", content: userMessage }],
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429 || wasRateLimited) {
      const e = new Error(`Claude API rate limited (${domain}). Try again in a minute.`) as Error & { code?: string };
      e.code = "RATE_LIMITED";
      throw e;
    }
    if (res.status >= 500) {
      const e = new Error(`Claude API error (${domain}): ${res.status} ${err}`) as Error & { code?: string };
      e.code = "PROVIDER_ERROR";
      throw e;
    }
    throw new Error(`Claude API error (${domain}): ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  let raw = extractJson(text);
  let parsed: DomainAgentResponse;
  try {
    parsed = tryParseJson<DomainAgentResponse>(raw);
  } catch {
    const { res: retryRes, wasRateLimited: retryRateLimited } = await anthropicPost(apiKey, {
      model: MODEL,
      max_tokens: 4096,
      system: domainSystemPrompt(domain) + "\n\nReturn only raw JSON starting with { and ending with }. No other text.",
      messages: [{ role: "user", content: userMessage }],
    });
    if (!retryRes.ok) {
      if (retryRes.status === 429 || retryRateLimited) {
        const e = new Error(`Claude API rate limited (${domain}). Try again in a minute.`) as Error & { code?: string };
        e.code = "RATE_LIMITED";
        throw e;
      }
      if (retryRes.status >= 500) {
        const e = new Error(`Claude API error (${domain}): ${retryRes.status}`) as Error & { code?: string };
        e.code = "PROVIDER_ERROR";
        throw e;
      }
      const err = await retryRes.text();
      throw new Error(`Claude API error (${domain}): ${retryRes.status} ${err}`);
    }
    const retryData = await retryRes.json();
    const retryText = retryData.content?.[0]?.text ?? "";
    parsed = tryParseJson<DomainAgentResponse>(extractJson(retryText));
  }
  return parsed;
}

async function callSynthesiser(
  apiKey: string,
  triggerText: string,
  nodeSummary: string,
  edgeSuggestionsSummary: string
): Promise<SynthesiserResponse> {
  const systemPrompt = `You are a consistency checker and reconciler for a consequence graph. You do NOT generate new nodes.
Return ONLY a valid JSON object: { "edges": [ { "source_node_id": "id from the nodes list", "target_node_id": "id from the nodes list", "mechanism": "string", "confidence": "high|medium|speculative" } ], "analogue_ids": [] }.
Task: Validate and resolve cross-domain edge suggestions. Output the final list of edges to create (source_node_id and target_node_id must be exact node ids from the provided nodes). Coherence is the bar, not plausibility. If you cannot resolve a suggestion, omit it.`;

  const userMessage = `Trigger: ${triggerText}\n\nNodes (id, domain, title):\n${nodeSummary}\n\nCross-domain edge suggestions:\n${edgeSuggestionsSummary}\n\nReturn only the JSON object with "edges" (array of source_node_id, target_node_id, mechanism, confidence) and optionally "analogue_ids" (array of historical analogue ids if we had them).`;

  const { res, wasRateLimited } = await anthropicPost(apiKey, {
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  if (!res.ok) {
    if (res.status === 429 || wasRateLimited) {
      const e = new Error("Claude API rate limited (synthesiser). Try again in a minute.") as Error & { code?: string };
      e.code = "RATE_LIMITED";
      throw e;
    }
    if (res.status >= 500) {
      const e = new Error(`Synthesiser Claude error: ${res.status}`) as Error & { code?: string };
      e.code = "PROVIDER_ERROR";
      throw e;
    }
    const err = await res.text();
    throw new Error(`Synthesiser Claude error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const raw = extractJson(text);
  let parsed = tryParseSynthesisResponse(raw);
  if (parsed.edges.length === 0 && raw.length > 100) {
    const { res: retryRes, wasRateLimited: retryRateLimited } = await anthropicPost(apiKey, {
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt + "\n\nReturn only valid JSON. No trailing commas, no comments.",
      messages: [{ role: "user", content: userMessage }],
    });
    if (!retryRes.ok) {
      if (retryRes.status === 429 || retryRateLimited) {
        const e = new Error("Claude API rate limited (synthesiser). Try again in a minute.") as Error & { code?: string };
        e.code = "RATE_LIMITED";
        throw e;
      }
      if (retryRes.status >= 500) {
        const e = new Error(`Synthesiser Claude error: ${retryRes.status}`) as Error & { code?: string };
        e.code = "PROVIDER_ERROR";
        throw e;
      }
      const err = await retryRes.text();
      throw new Error(`Synthesiser Claude error: ${retryRes.status} ${err}`);
    }
    const retryData = await retryRes.json();
    const retryText = retryData.content?.[0]?.text ?? "";
    const retryRaw = extractJson(retryText);
    parsed = tryParseSynthesisResponse(retryRaw);
  }
  return parsed;
}

async function handleReRunWithFeedback(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  scenarioId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: scenario, error: scenarioErr } = await supabase
    .from("scenarios")
    .select("id, trigger_text, perplexity_cache, status")
    .eq("id", scenarioId)
    .single();
  if (scenarioErr || !scenario) {
    return new Response(
      JSON.stringify({ error: scenarioErr?.message ?? "Scenario not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (scenario.status !== "complete") {
    return new Response(
      JSON.stringify({ error: "Scenario must be complete to re-run with feedback" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: feedbackList } = await supabase
    .from("analyst_feedback")
    .select("id, feedback_type, content, domain_tag")
    .eq("scenario_id", scenarioId)
    .eq("status", "pending");
  if (!feedbackList?.length) {
    return new Response(
      JSON.stringify({ error: "No pending feedback for this scenario" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const feedbackSummary = feedbackList
    .map((f: { feedback_type: string; content: string | null; domain_tag: string | null }) =>
      `[${f.feedback_type}${f.domain_tag ? ` @${f.domain_tag}` : ""}] ${f.content ?? ""}`
    )
    .join("\n")
    .slice(0, MAX_FEEDBACK_CONTEXT_CHARS);
  let triggerText = (scenario.trigger_text ?? "").trim();
  if (triggerText.length > MAX_TRIGGER_CHARS) triggerText = triggerText.slice(0, MAX_TRIGGER_CHARS);
  const perplexityCache = (scenario.perplexity_cache as Record<string, unknown> | null) ?? null;

  await supabase.from("nodes").delete().eq("scenario_id", scenarioId);
  await supabase.from("scenarios").update({
    status: "generating",
    generation_stage: "domains",
    updated_at: new Date().toISOString(),
  }).eq("id", scenarioId);

  const nodeIdToDbId: Record<string, string> = {};
  const rootRes = await supabase
    .from("nodes")
    .insert({
      scenario_id: scenarioId,
      parent_id: null,
      domain: "root",
      title: triggerText.slice(0, 80),
      description: null,
      mechanism: null,
      confidence: "high",
      timeline: "immediate",
      assumptions: [],
      monitoring_indicators: [],
      agent_generated_by: "root",
    })
    .select("id")
    .single();
  if (rootRes.error || !rootRes.data?.id) {
    await supabase.from("scenarios").update({ status: "error", generation_stage: null, updated_at: new Date().toISOString() }).eq("id", scenarioId);
    return new Response(JSON.stringify({ error: rootRes.error?.message ?? "Failed to create root node" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  nodeIdToDbId["root"] = rootRes.data.id;

  // Run domain agents in two batches of 3 to reduce Anthropic 429 rate limits
  const domainOrder = [...DOMAINS];
  const batch1 = domainOrder.slice(0, 3);
  const batch2 = domainOrder.slice(3, 6);
  const results1 = await Promise.all(
    batch1.map((domain) =>
      callDomainAgent(apiKey, domain, triggerText, perplexityCache, feedbackSummary).then((r) => ({ domain, response: r }))
    )
  );
  await new Promise((r) => setTimeout(r, 2000));
  const results2 = await Promise.all(
    batch2.map((domain) =>
      callDomainAgent(apiKey, domain, triggerText, perplexityCache, feedbackSummary).then((r) => ({ domain, response: r }))
    )
  );
  const results = [...results1, ...results2];

  const allEdgeSuggestions: Array<{ domain: string; suggestions: CrossDomainEdgeSuggestion[] }> = [];
  const nodeSummaryLines: string[] = ["root (root) " + triggerText.slice(0, 50)];

  for (let i = 0; i < results.length; i++) {
    const { domain, response } = results[i];
    const nodes = response.nodes ?? [];
    const suggestions = response.cross_domain_edge_suggestions ?? [];
    allEdgeSuggestions.push({ domain, suggestions });

    for (const n of nodes) {
      const parentDbId = n.parent_id ? nodeIdToDbId[n.parent_id] ?? null : null;
      const { data: inserted, error: nodeErr } = await supabase
        .from("nodes")
        .insert({
          scenario_id: scenarioId,
          parent_id: parentDbId,
          domain: domain,
          title: n.title ?? "",
          description: n.description ?? null,
          mechanism: n.mechanism ?? null,
          confidence: (n.confidence as "high" | "medium" | "speculative") ?? "medium",
          timeline: (n.timeline as "immediate" | "short" | "medium" | "long") ?? "short",
          assumptions: n.assumptions ?? [],
          monitoring_indicators: n.monitoring_indicators ?? [],
          quantitative_estimate: n.quantitative_estimate ?? null,
          historical_precedent: n.historical_precedent ?? null,
          agent_generated_by: domain,
        })
        .select("id")
        .single();
      if (nodeErr) throw new Error(nodeErr.message);
      if (inserted?.id) {
        nodeIdToDbId[n.id] = inserted.id;
        nodeSummaryLines.push(`${n.id} (${domain}) ${n.title}`);
      }
    }

    for (const sc of response.source_cards ?? []) {
      const nodeIds = sc.informs_node_ids ?? [];
      const nodeId = nodeIds.length ? nodeIdToDbId[nodeIds[0]] : null;
      await supabase.from("source_cards").insert({
        scenario_id: scenarioId,
        node_id: nodeId,
        platform: (sc.platform as "twitter" | "telegram" | "web" | "perplexity") ?? "web",
        handle: sc.handle ?? null,
        snippet: sc.snippet ?? null,
        url: sc.url ?? null,
        retrieved_at: new Date().toISOString(),
      });
    }
  }

  await supabase
    .from("scenarios")
    .update({ generation_stage: "synthesis", updated_at: new Date().toISOString() })
    .eq("id", scenarioId);

  const edgeSuggestionsSummary = allEdgeSuggestions
    .flatMap(({ domain, suggestions }) =>
      suggestions.map((s) => `[${domain}] ${s.source_node_id} -> ${s.target_domain}: ${s.mechanism}`)
    )
    .join("\n");

  const synthesis = await callSynthesiser(
    apiKey,
    triggerText,
    nodeSummaryLines.join("\n"),
    edgeSuggestionsSummary || "(none)"
  );

  for (const e of synthesis.edges ?? []) {
    const srcId = nodeIdToDbId[e.source_node_id];
    const tgtId = nodeIdToDbId[e.target_node_id];
    if (!srcId || !tgtId) continue;
    await supabase.from("edges").insert({
      scenario_id: scenarioId,
      source_node_id: srcId,
      target_node_id: tgtId,
      mechanism: e.mechanism ?? null,
      is_cross_domain: true,
      confidence: (e.confidence as "high" | "medium" | "speculative") ?? "medium",
    });
  }

  const now = new Date().toISOString();
  await supabase
    .from("scenarios")
    .update({
      status: "complete",
      trigger_summary: triggerText.slice(0, 256),
      generation_stage: null,
      updated_at: now,
    })
    .eq("id", scenarioId);

  await supabase
    .from("analyst_feedback")
    .update({ status: "applied", re_run_triggered_at: now })
    .eq("scenario_id", scenarioId)
    .eq("status", "pending");

  return new Response(
    JSON.stringify({ scenario_id: scenarioId, status: "complete" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/** Phase 1: Create scenario, run Perplexity, create root node. Returns quickly so UI can show context. */
async function handleStartPhase(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  triggerText: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("[Phase 1] start: creating scenario + Perplexity + root node");
  const { data: scenarioInsert, error: scenarioErr } = await supabase
    .from("scenarios")
    .insert({
      trigger_text: triggerText,
      title: triggerText.slice(0, 120),
      status: "generating",
      generation_stage: "perplexity",
    })
    .select("id")
    .single();
  if (scenarioErr || !scenarioInsert?.id) {
    return new Response(JSON.stringify({ error: scenarioErr?.message ?? "Failed to create scenario" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const scenarioId = scenarioInsert.id;

  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  let perplexityCache: Record<string, unknown> | null = null;
  if (perplexityKey) {
    perplexityCache = await callPerplexity(perplexityKey, triggerText);
    if (perplexityCache) {
      await supabase
        .from("scenarios")
        .update({
          perplexity_cache: perplexityCache,
          perplexity_cached_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", scenarioId);
    }
  }

  const rootRes = await supabase
    .from("nodes")
    .insert({
      scenario_id: scenarioId,
      parent_id: null,
      domain: "root",
      title: triggerText.slice(0, 80),
      description: null,
      mechanism: null,
      confidence: "high",
      timeline: "immediate",
      assumptions: [],
      monitoring_indicators: [],
      agent_generated_by: "root",
    })
    .select("id")
    .single();
  if (rootRes.error || !rootRes.data?.id) {
    return new Response(JSON.stringify({ error: rootRes.error?.message ?? "Failed to create root node" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nodeIdMap: Record<string, string> = { root: rootRes.data.id };
  await supabase
    .from("scenarios")
    .update({
      generation_stage: "perplexity_done",
      node_id_map: nodeIdMap,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scenarioId);

  const perplexityPreview =
    perplexityCache && typeof perplexityCache.summary === "string"
      ? (perplexityCache.summary as string).slice(0, 500)
      : undefined;

  console.log("[Phase 1] done:", { scenario_id: scenarioId, has_preview: !!perplexityPreview });
  return new Response(
    JSON.stringify({
      scenario_id: scenarioId,
      stage: "perplexity_done",
      perplexity_preview: perplexityPreview,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/** Phase 2a/2b: Run one batch of 3 domain agents, persist results and nodes. */
async function handleDomainsBatch(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  scenarioId: string,
  batch: 1 | 2,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("[Phase 2] domains_batch", { scenario_id: scenarioId, batch });
  const { data: scenario, error: scenarioErr } = await supabase
    .from("scenarios")
    .select("id, trigger_text, perplexity_cache, domain_results, node_id_map")
    .eq("id", scenarioId)
    .single();
  if (scenarioErr || !scenario) {
    return new Response(JSON.stringify({ error: scenarioErr?.message ?? "Scenario not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const triggerText = ((scenario.trigger_text as string) ?? "").slice(0, MAX_TRIGGER_CHARS);
  const perplexityCache = (scenario.perplexity_cache as Record<string, unknown> | null) ?? null;
  const existingResults = (scenario.domain_results as Array<{ domain: string; response: DomainAgentResponse }>) ?? [];
  const nodeIdToDbId: Record<string, string> = (scenario.node_id_map as Record<string, string>) ?? {};

  const batchDomains = batch === 1 ? DOMAINS.slice(0, 3) : DOMAINS.slice(3, 6);
  const results = await Promise.all(
    batchDomains.map((domain) =>
      callDomainAgent(apiKey, domain, triggerText, perplexityCache).then((r) => ({ domain, response: r }))
    )
  );

  const allEdgeSuggestions: Array<{ domain: string; suggestions: CrossDomainEdgeSuggestion[] }> = [];
  for (const { domain, response } of results) {
    const nodes = response.nodes ?? [];
    const suggestions = response.cross_domain_edge_suggestions ?? [];
    allEdgeSuggestions.push({ domain, suggestions });

    for (const n of nodes) {
      const parentDbId = n.parent_id ? nodeIdToDbId[n.parent_id] ?? null : null;
      const { data: inserted, error: nodeErr } = await supabase
        .from("nodes")
        .insert({
          scenario_id: scenarioId,
          parent_id: parentDbId,
          domain: domain,
          title: n.title ?? "",
          description: n.description ?? null,
          mechanism: n.mechanism ?? null,
          confidence: (n.confidence as "high" | "medium" | "speculative") ?? "medium",
          timeline: (n.timeline as "immediate" | "short" | "medium" | "long") ?? "short",
          assumptions: n.assumptions ?? [],
          monitoring_indicators: n.monitoring_indicators ?? [],
          quantitative_estimate: n.quantitative_estimate ?? null,
          historical_precedent: n.historical_precedent ?? null,
          agent_generated_by: domain,
        })
        .select("id")
        .single();
      if (nodeErr) throw new Error(nodeErr.message);
      if (inserted?.id) {
        nodeIdToDbId[n.id] = inserted.id;
      }
    }
    for (const sc of response.source_cards ?? []) {
      const nodeIds = sc.informs_node_ids ?? [];
      const nodeId = nodeIds.length ? nodeIdToDbId[nodeIds[0]] : null;
      await supabase.from("source_cards").insert({
        scenario_id: scenarioId,
        node_id: nodeId,
        platform: (sc.platform as "twitter" | "telegram" | "web" | "perplexity") ?? "web",
        handle: sc.handle ?? null,
        snippet: sc.snippet ?? null,
        url: sc.url ?? null,
        retrieved_at: new Date().toISOString(),
      });
    }
  }

  const mergedResults = [...existingResults, ...results];
  await supabase
    .from("scenarios")
    .update({
      domain_results: mergedResults,
      node_id_map: nodeIdToDbId,
      generation_stage: batch === 1 ? "domains_batch_1_done" : "domains_batch_2_done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", scenarioId);

  const stage = batch === 1 ? "domains_batch_1_done" : "domains_batch_2_done";
  console.log("[Phase 2] done:", { scenario_id: scenarioId, stage });
  return new Response(
    JSON.stringify({ scenario_id: scenarioId, stage }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/** Phase 3: Run synthesiser from stored domain_results, insert edges, mark complete. */
async function handleSynthesisPhase(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  scenarioId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("[Phase 3] synthesis:", { scenario_id: scenarioId });
  const { data: scenario, error: scenarioErr } = await supabase
    .from("scenarios")
    .select("id, trigger_text, domain_results, node_id_map")
    .eq("id", scenarioId)
    .single();
  if (scenarioErr || !scenario) {
    return new Response(JSON.stringify({ error: scenarioErr?.message ?? "Scenario not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const triggerText = ((scenario.trigger_text as string) ?? "").slice(0, MAX_TRIGGER_CHARS);
  const domainResults = (scenario.domain_results as Array<{ domain: string; response: DomainAgentResponse }>) ?? [];
  const nodeIdToDbId: Record<string, string> = (scenario.node_id_map as Record<string, string>) ?? {};

  const allEdgeSuggestions: Array<{ domain: string; suggestions: CrossDomainEdgeSuggestion[] }> = [];
  const nodeSummaryLines: string[] = ["root (root) " + triggerText.slice(0, 50)];
  for (const { domain, response } of domainResults) {
    const nodes = response.nodes ?? [];
    const suggestions = response.cross_domain_edge_suggestions ?? [];
    allEdgeSuggestions.push({ domain, suggestions });
    for (const n of nodes) {
      nodeSummaryLines.push(`${n.id} (${domain}) ${n.title}`);
    }
  }

  const edgeSuggestionsSummary = allEdgeSuggestions
    .flatMap(({ domain, suggestions }) =>
      suggestions.map((s) => `[${domain}] ${s.source_node_id} -> ${s.target_domain}: ${s.mechanism}`)
    )
    .join("\n");

  const synthesis = await callSynthesiser(
    apiKey,
    triggerText,
    nodeSummaryLines.join("\n"),
    edgeSuggestionsSummary || "(none)"
  );

  for (const e of synthesis.edges ?? []) {
    const srcId = nodeIdToDbId[e.source_node_id];
    const tgtId = nodeIdToDbId[e.target_node_id];
    if (!srcId || !tgtId) continue;
    await supabase.from("edges").insert({
      scenario_id: scenarioId,
      source_node_id: srcId,
      target_node_id: tgtId,
      mechanism: e.mechanism ?? null,
      is_cross_domain: true,
      confidence: (e.confidence as "high" | "medium" | "speculative") ?? "medium",
    });
  }

  await supabase
    .from("scenarios")
    .update({
      status: "complete",
      trigger_summary: triggerText.slice(0, 256),
      generation_stage: null,
      domain_results: [],
      node_id_map: {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", scenarioId);

  console.log("[Phase 3] done:", { scenario_id: scenarioId, status: "complete" });
  return new Response(
    JSON.stringify({ scenario_id: scenarioId, status: "complete" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY not set. Add it in Supabase Dashboard → Edge Functions → Secrets.",
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: {
    trigger_text?: string;
    scenario_id?: string;
    re_run_with_feedback?: boolean;
    phase?: "domains_batch" | "synthesis";
    batch?: number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const isReRun = !!(body.re_run_with_feedback && body.scenario_id);
  if (isReRun) {
    return await handleReRunWithFeedback(supabase, apiKey, body.scenario_id!, CORS_HEADERS);
  }

  if (body.scenario_id && body.phase === "domains_batch" && (body.batch === 1 || body.batch === 2)) {
    try {
      return await handleDomainsBatch(supabase, apiKey, body.scenario_id, body.batch as 1 | 2, CORS_HEADERS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      const isRateLimit = code === "RATE_LIMITED";
      const isProviderError = code === "PROVIDER_ERROR";
      const status = isRateLimit ? 429 : isProviderError ? 502 : 500;
      const responseCode = isRateLimit ? "RATE_LIMITED" : isProviderError ? "PROVIDER_ERROR" : undefined;
      return new Response(JSON.stringify({ error: message, code: responseCode }), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  if (body.scenario_id && body.phase === "synthesis") {
    try {
      return await handleSynthesisPhase(supabase, apiKey, body.scenario_id, CORS_HEADERS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      const isRateLimit = code === "RATE_LIMITED";
      const isProviderError = code === "PROVIDER_ERROR";
      const status = isRateLimit ? 429 : isProviderError ? 502 : 500;
      const responseCode = isRateLimit ? "RATE_LIMITED" : isProviderError ? "PROVIDER_ERROR" : undefined;
      return new Response(JSON.stringify({ error: message, code: responseCode }), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  let triggerText = (body.trigger_text ?? "").trim();
  if (!triggerText) {
    return new Response(JSON.stringify({ error: "trigger_text is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  if (triggerText.length > MAX_TRIGGER_CHARS) {
    triggerText = triggerText.slice(0, MAX_TRIGGER_CHARS);
  }

  try {
    return await handleStartPhase(supabase, apiKey, triggerText, CORS_HEADERS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
    const isRateLimit = code === "RATE_LIMITED";
    const isProviderError = code === "PROVIDER_ERROR";
    const status = isRateLimit ? 429 : isProviderError ? 502 : 500;
    const responseCode = isRateLimit ? "RATE_LIMITED" : isProviderError ? "PROVIDER_ERROR" : undefined;
    return new Response(JSON.stringify({ error: message, code: responseCode }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
