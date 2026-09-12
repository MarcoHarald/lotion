import { useCallback, useEffect, useState } from "react";
import {
  supabase,
  type Scenario,
  type Node,
  type Edge,
  type SourceCard,
  type AnalystFeedback,
  type HistoricalAnalogue,
  type ScenarioAnalogue,
} from "./supabase";
import { LeftPanel } from "./LeftPanel";
import { Graph } from "./Graph";
import { RightPanel } from "./RightPanel";
import {
  demoEdges,
  demoFeedback,
  demoHistoricalAnalogues,
  demoNodes,
  demoScenario,
  demoScenarioAnalogues,
  demoSelectedNodeId,
  demoSourceCards,
  demoTriggerText,
  isDemoMode,
} from "./demoScenario";

const TIMELINE_ORDER = ["immediate", "short", "medium", "long"] as const;
const DOMAINS = ["energy", "food", "finance", "political", "military", "supply_chain"] as const;

type ScenarioAnalogueWithAnalogue = ScenarioAnalogue & {
  historical_analogues: HistoricalAnalogue | null;
};

export default function App() {
  const [triggerText, setTriggerText] = useState(isDemoMode ? demoTriggerText : "");
  const [scenarios, setScenarios] = useState<Scenario[]>(isDemoMode ? [demoScenario] : []);
  const [scenarioId, setScenarioId] = useState<string | null>(isDemoMode ? demoScenario.id : null);
  const [nodes, setNodes] = useState<Node[]>(isDemoMode ? demoNodes : []);
  const [edges, setEdges] = useState<Edge[]>(isDemoMode ? demoEdges : []);
  const [sourceCards, setSourceCards] = useState<SourceCard[]>(isDemoMode ? demoSourceCards : []);
  const [analystFeedback, setAnalystFeedback] = useState<AnalystFeedback[]>(isDemoMode ? demoFeedback : []);
  const [scenarioAnalogues, setScenarioAnalogues] = useState<ScenarioAnalogueWithAnalogue[]>(
    isDemoMode ? demoScenarioAnalogues : []
  );
  const [historicalAnalogues, setHistoricalAnalogues] = useState<HistoricalAnalogue[]>(
    isDemoMode ? demoHistoricalAnalogues : []
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(isDemoMode ? demoSelectedNodeId : null);
  const [timelineIndex, setTimelineIndex] = useState(isDemoMode ? 3 : 1);
  const [domainFilters, setDomainFilters] = useState<Record<string, boolean>>(
    Object.fromEntries(DOMAINS.map((d) => [d, true]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [perplexityPreview, setPerplexityPreview] = useState<string | null>(null);

  const loadScenarios = useCallback(async () => {
    if (isDemoMode) {
      setScenarios([demoScenario]);
      return;
    }
    const { data, error: e } = await supabase
      .from("scenarios")
      .select("id, user_id, title, trigger_text, trigger_summary, status, generation_stage, perplexity_cache, perplexity_cached_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (e) {
      setError(e.message);
      return;
    }
    setScenarios((data as Scenario[]) ?? []);
  }, []);

  const loadScenario = useCallback(async (id: string) => {
    if (isDemoMode) {
      setScenarioId(demoScenario.id);
      setSelectedNodeId(demoSelectedNodeId);
      setNodes(demoNodes);
      setEdges(demoEdges);
      setSourceCards(demoSourceCards);
      setAnalystFeedback(demoFeedback);
      setScenarioAnalogues(demoScenarioAnalogues);
      setError(null);
      return;
    }
    setScenarioId(id);
    setSelectedNodeId(null);
    setError(null);
    try {
      const [
        scenarioRes,
        nodesRes,
        edgesRes,
        sourceCardsRes,
        feedbackRes,
        scenarioAnaloguesRes,
      ] = await Promise.all([
        supabase.from("scenarios").select("id, status, generation_stage, perplexity_cached_at").eq("id", id).single(),
        supabase.from("nodes").select("*").eq("scenario_id", id),
        supabase.from("edges").select("*").eq("scenario_id", id),
        supabase.from("source_cards").select("*").eq("scenario_id", id),
        supabase.from("analyst_feedback").select("*").eq("scenario_id", id).order("created_at", { ascending: false }),
        supabase.from("scenario_analogues").select("*, historical_analogues(*)").eq("scenario_id", id),
      ]);
      if (scenarioRes.data && typeof scenarioRes.data === "object") {
        setScenarios((prev) => {
          const idx = prev.findIndex((s) => s.id === id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], ...(scenarioRes.data as Record<string, unknown>) };
          return next;
        });
      }
      if (nodesRes.error) setError(nodesRes.error.message);
      else setNodes(Array.isArray(nodesRes.data) ? (nodesRes.data as Node[]) : []);
      if (edgesRes.error) setError(edgesRes.error.message);
      else setEdges(Array.isArray(edgesRes.data) ? (edgesRes.data as Edge[]) : []);
      setSourceCards(Array.isArray(sourceCardsRes.data) ? (sourceCardsRes.data as SourceCard[]) : []);
      setAnalystFeedback(Array.isArray(feedbackRes.data) ? (feedbackRes.data as AnalystFeedback[]) : []);
      setScenarioAnalogues(
        Array.isArray(scenarioAnaloguesRes.data)
          ? (scenarioAnaloguesRes.data as ScenarioAnalogueWithAnalogue[])
          : []
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const loadHistoricalAnalogues = useCallback(async () => {
    if (isDemoMode) {
      setHistoricalAnalogues(demoHistoricalAnalogues);
      return;
    }
    const { data } = await supabase.from("historical_analogues").select("*").order("year", { ascending: false });
    setHistoricalAnalogues(Array.isArray(data) ? (data as HistoricalAnalogue[]) : []);
  }, []);

  useEffect(() => {
    loadHistoricalAnalogues();
  }, [loadHistoricalAnalogues]);

  const scenarioList = Array.isArray(scenarios) ? scenarios : [];
  const currentScenario = scenarioId ? scenarioList.find((s) => s && s.id === scenarioId) ?? null : null;
  const isGenerating = currentScenario?.status === "generating";

  useEffect(() => {
    if (!scenarioId || !isGenerating) return;
    const interval = setInterval(() => {
      loadScenario(scenarioId);
      loadScenarios();
    }, 2000);
    return () => clearInterval(interval);
  }, [scenarioId, isGenerating, loadScenario, loadScenarios]);

  const handleGenerate = useCallback(async () => {
    if (!triggerText.trim()) return;
    if (isDemoMode) {
      setError("Demo mode is read-only. Set up Supabase (see SETUP.md) to generate a live scenario.");
      return;
    }
    setLoading(true);
    setError(null);
    setPerplexityPreview(null);
    setStatusMessage("Enriching context…");
    const throwOnError = (data: unknown, fnError: unknown) => {
      if (fnError) throw new Error((fnError as { message?: string })?.message || "Function error");
      if (data == null || typeof data !== "object") throw new Error("Invalid response from server");
      const payload = data as { error?: string; scenario_id?: string; code?: string };
      if (typeof payload.error === "string" && payload.error) {
        const msg =
          payload.code === "RATE_LIMITED"
            ? "Rate limited. Please try again in a minute."
            : payload.code === "PROVIDER_ERROR"
              ? "Analysis service temporarily unavailable. Please try again."
              : payload.error;
        throw new Error(msg);
      }
      return payload;
    };
    try {
      let sid: string;
      console.log("[Generate] Phase 1: start (Perplexity + root node)");
      const res1 = await supabase.functions.invoke("generate-consequences", {
        body: { trigger_text: triggerText.trim() },
      });
      console.log("[Generate] Phase 1 response:", res1.error ? { error: res1.error } : { scenario_id: (res1.data as { scenario_id?: string })?.scenario_id, stage: (res1.data as { stage?: string })?.stage });
      const p1 = throwOnError(res1.data, res1.error) as { scenario_id?: string; perplexity_preview?: string };
      sid = p1.scenario_id!;
      if (typeof p1.perplexity_preview === "string" && p1.perplexity_preview) {
        setPerplexityPreview(p1.perplexity_preview);
      }
      await loadScenarios();
      await loadScenario(sid);

      setStatusMessage("Domain analysis 1/2…");
      console.log("[Generate] Phase 2a: domains batch 1", { scenario_id: sid });
      const res2 = await supabase.functions.invoke("generate-consequences", {
        body: { scenario_id: sid, phase: "domains_batch", batch: 1 },
      });
      console.log("[Generate] Phase 2a response:", res2.error ? { error: res2.error } : { stage: (res2.data as { stage?: string })?.stage });
      throwOnError(res2.data, res2.error);
      await loadScenario(sid);

      setStatusMessage("Domain analysis 2/2…");
      console.log("[Generate] Phase 2b: domains batch 2", { scenario_id: sid });
      const res3 = await supabase.functions.invoke("generate-consequences", {
        body: { scenario_id: sid, phase: "domains_batch", batch: 2 },
      });
      console.log("[Generate] Phase 2b response:", res3.error ? { error: res3.error } : { stage: (res3.data as { stage?: string })?.stage });
      throwOnError(res3.data, res3.error);
      await loadScenario(sid);

      setStatusMessage("Synthesising…");
      console.log("[Generate] Phase 3: synthesis", { scenario_id: sid });
      const res4 = await supabase.functions.invoke("generate-consequences", {
        body: { scenario_id: sid, phase: "synthesis" },
      });
      console.log("[Generate] Phase 3 response:", res4.error ? { error: res4.error } : { scenario_id: (res4.data as { scenario_id?: string })?.scenario_id, status: (res4.data as { status?: string })?.status });
      const p4 = throwOnError(res4.data, res4.error) as { scenario_id?: string };
      if (p4.scenario_id) {
        await loadScenarios();
        await loadScenario(p4.scenario_id);
        console.log("[Generate] Complete", { scenario_id: p4.scenario_id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Generate] Error:", msg, e);
      const friendly =
        msg.toLowerCase().includes("rate limit")
          ? "Rate limited. Please try again in a minute."
          : msg.toLowerCase().includes("temporarily unavailable") || msg.includes("PROVIDER_ERROR")
            ? "Analysis service temporarily unavailable. Please try again."
            : msg;
      setError(friendly);
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  }, [triggerText, loadScenarios, loadScenario]);

  const nodeList = Array.isArray(nodes) ? nodes : [];
  const filteredNodes = nodeList.filter((n) => {
    if (!n || typeof n.timeline !== "string" || typeof n.domain !== "string") return false;
    const tlOk = TIMELINE_ORDER.indexOf(n.timeline as (typeof TIMELINE_ORDER)[number]) <= timelineIndex;
    const domainOk = domainFilters[n.domain] !== false;
    return tlOk && domainOk;
  });

  const selectedNode = selectedNodeId
    ? (nodeList.find((n) => n && n.id === selectedNodeId) ?? null)
    : null;

  const stageFromGeneration = (() => {
    if (!isGenerating || !currentScenario?.generation_stage) return null;
    const stage = currentScenario.generation_stage;
    if (stage === "perplexity" || stage === "perplexity_done") return "Context ready.";
    if (stage === "domains_batch_1_done") return "Domain analysis 1/2 done.";
    if (stage === "domains_batch_2_done") return "Domain analysis 2/2 done.";
    if (stage === "domains") return "Running domain agents…";
    if (stage === "synthesis") return "Synthesising…";
    return "Generating…";
  })();
  const stageMessage = statusMessage ?? stageFromGeneration;

  const cacheTime = currentScenario?.perplexity_cached_at
    ? new Date(currentScenario.perplexity_cached_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col h-full bg-bg text-gray-200">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0 gap-2">
        <span className="font-mono font-semibold">Lotion</span>
        <span className="text-sm text-gray-500 truncate max-w-md">
          {currentScenario?.title ?? (scenarioId ? "Scenario" : "No scenario loaded")}
        </span>
        {cacheTime && (
          <span className="text-xs text-gray-500 shrink-0" title="Perplexity context cached">
            Context: {cacheTime}
          </span>
        )}
        {perplexityPreview && (
          <span className="text-xs text-amber-200/90 shrink-0 max-w-xs truncate" title={perplexityPreview}>
            {perplexityPreview}
          </span>
        )}
        {error && <span className="text-red-400 text-sm shrink-0">{error}</span>}
      </header>
      <div className="flex flex-1 min-h-0">
        <LeftPanel
          triggerText={triggerText}
          onTriggerTextChange={setTriggerText}
          onGenerate={handleGenerate}
          loading={loading}
          statusMessage={stageMessage}
          timelineIndex={timelineIndex}
          onTimelineChange={setTimelineIndex}
          domainFilters={domainFilters}
          onDomainFilterChange={(d, v) => setDomainFilters((f) => ({ ...f, [d]: v }))}
          scenarios={scenarioList}
          onSelectScenario={(s) => loadScenario(s.id)}
          selectedScenarioId={scenarioId}
        />
        <main className="flex-1 min-w-0 flex flex-col border-l border-r border-gray-800">
          <Graph
            nodes={filteredNodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            scenarioId={scenarioId}
          />
        </main>
        <RightPanel
          selectedNode={selectedNode}
          scenarioId={scenarioId}
          nodes={nodes}
          edges={edges}
          sourceCards={sourceCards}
          analystFeedback={analystFeedback}
          scenarioAnalogues={scenarioAnalogues}
          historicalAnalogues={historicalAnalogues}
          onFeedbackSubmitted={() => scenarioId && loadScenario(scenarioId)}
        />
      </div>
    </div>
  );
}
