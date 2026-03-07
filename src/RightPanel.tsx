import { useState } from "react";
import { supabase } from "./supabase";
import type {
  Node,
  Edge,
  SourceCard,
  AnalystFeedback,
  HistoricalAnalogue,
  ScenarioAnalogue,
} from "./supabase";

type ScenarioAnalogueWithAnalogue = ScenarioAnalogue & {
  historical_analogues: HistoricalAnalogue | null;
};

const TABS = ["Inspector", "Source cards", "Analogues", "Stress test"] as const;
const FEEDBACK_TYPES = [
  { value: "disagree" as const, label: "Disagree" },
  { value: "amplify" as const, label: "Amplify" },
  { value: "scenario_tweak" as const, label: "Scenario tweak" },
  { value: "external_inject" as const, label: "External inject" },
];

type Props = {
  selectedNode: Node | null;
  scenarioId: string | null;
  nodes: Node[];
  edges: Edge[];
  sourceCards: SourceCard[];
  analystFeedback: AnalystFeedback[];
  scenarioAnalogues: ScenarioAnalogueWithAnalogue[];
  historicalAnalogues: HistoricalAnalogue[];
  onFeedbackSubmitted?: () => void;
};

export function RightPanel({
  selectedNode,
  scenarioId,
  nodes,
  edges,
  sourceCards,
  analystFeedback,
  scenarioAnalogues,
  historicalAnalogues,
  onFeedbackSubmitted,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Inspector");
  const [feedbackType, setFeedbackType] = useState<AnalystFeedback["feedback_type"]>("disagree");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [stressTestText, setStressTestText] = useState("");
  const [stressTestSubmitting, setStressTestSubmitting] = useState(false);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeSourceCards = Array.isArray(sourceCards) ? sourceCards : [];
  const pendingFeedback = Array.isArray(analystFeedback)
    ? analystFeedback.filter((f) => f.status === "pending")
    : [];

  const handleAddFeedback = async () => {
    if (!scenarioId || !feedbackContent.trim()) return;
    setFeedbackSubmitting(true);
    try {
      const nodeId = feedbackType === "amplify" || feedbackType === "disagree" ? selectedNode?.id ?? null : null;
      const domainTag = selectedNode?.domain ?? null;
      await supabase.from("analyst_feedback").insert({
        scenario_id: scenarioId,
        node_id: nodeId,
        feedback_type: feedbackType,
        content: feedbackContent.trim(),
        domain_tag: domainTag,
        status: "pending",
      });
      setFeedbackContent("");
      onFeedbackSubmitted?.();
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleStressTestAdd = async () => {
    if (!scenarioId || !stressTestText.trim()) return;
    setStressTestSubmitting(true);
    try {
      await supabase.from("analyst_feedback").insert({
        scenario_id: scenarioId,
        node_id: selectedNode?.id ?? null,
        feedback_type: "external_inject",
        content: `Stress test (worse variant): ${stressTestText.trim()}`,
        domain_tag: selectedNode?.domain ?? null,
        status: "pending",
      });
      setStressTestText("");
      onFeedbackSubmitted?.();
    } finally {
      setStressTestSubmitting(false);
    }
  };

  const handleReRunWithFeedback = async () => {
    if (!scenarioId || pendingFeedback.length === 0) return;
    setFeedbackSubmitting(true);
    console.log("[Re-run] start", { scenario_id: scenarioId });
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-consequences", {
        body: { scenario_id: scenarioId, re_run_with_feedback: true },
      });
      console.log("[Re-run] response:", fnError ? { error: fnError } : { data });
      if (fnError) throw new Error(fnError.message || "Function error");
      const payload = data as { error?: string; code?: string };
      if (typeof payload?.error === "string" && payload.error) {
        const msg =
          payload.code === "RATE_LIMITED"
            ? "Rate limited. Please try again in a minute."
            : payload.code === "PROVIDER_ERROR"
              ? "Analysis service temporarily unavailable. Please try again."
              : payload.error;
        throw new Error(msg);
      }
      console.log("[Re-run] complete");
      onFeedbackSubmitted?.();
    } catch (e) {
      console.error("[Re-run] failed:", e);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <aside className="w-[340px] shrink-0 flex flex-col border-l border-gray-800 bg-bg overflow-hidden">
      <div className="flex border-b border-gray-800">
        {TABS.map((t) => (
          <button
            key={t}
            className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-amber-500 text-amber-400" : "text-gray-500 hover:text-gray-300"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "Inspector" && (
          <NodeInspector selectedNode={selectedNode} nodes={safeNodes} edges={safeEdges} />
        )}
        {tab === "Source cards" && (
          <SourceCardsTab sourceCards={safeSourceCards} nodes={safeNodes} />
        )}
        {tab === "Analogues" && (
          <AnaloguesTab
            scenarioAnalogues={scenarioAnalogues}
            historicalAnalogues={historicalAnalogues}
          />
        )}
        {tab === "Stress test" && (
          <StressTestTab
            selectedNode={selectedNode}
            stressTestText={stressTestText}
            onStressTestTextChange={setStressTestText}
            onAdd={handleStressTestAdd}
            submitting={stressTestSubmitting}
          />
        )}
      </div>
      <FeedbackQueueFooter
        scenarioId={scenarioId}
        pendingFeedback={pendingFeedback}
        nodes={safeNodes}
        feedbackType={feedbackType}
        feedbackContent={feedbackContent}
        onFeedbackTypeChange={setFeedbackType}
        onFeedbackContentChange={setFeedbackContent}
        onAddFeedback={handleAddFeedback}
        onReRunWithFeedback={handleReRunWithFeedback}
        submitting={feedbackSubmitting}
        selectedNode={selectedNode}
      />
    </aside>
  );
}

function SourceCardsTab({ sourceCards, nodes }: { sourceCards: SourceCard[]; nodes: Node[] }) {
  if (sourceCards.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No source cards for this scenario. Domain agents can attach sources (e.g. Perplexity); OSINT via RapidAPI in a future phase.
      </p>
    );
  }
  const byNode = sourceCards.reduce<Record<string, SourceCard[]>>((acc, card) => {
    const key = card.node_id ?? "_none_";
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});
  const nodeTitles: Record<string, string> = Object.fromEntries(nodes.map((n) => [n.id, n.title ?? n.id]));

  return (
    <div className="space-y-3 text-sm">
      {Object.entries(byNode).map(([nodeId, cards]) => (
        <div key={nodeId}>
          {nodeId !== "_none_" && (
            <p className="text-xs text-gray-500 uppercase mb-1">{nodeTitles[nodeId] ?? nodeId.slice(0, 8)}</p>
          )}
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="p-2 rounded bg-gray-800/50 border border-gray-700">
                <span className="text-gray-400 text-xs">{c.platform}</span>
                {c.handle && <span className="ml-1 text-amber-400/90">@{c.handle}</span>}
                {c.snippet && <p className="mt-1 text-gray-300 text-xs line-clamp-3">{c.snippet}</p>}
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500 hover:underline text-xs mt-1 inline-block truncate max-w-full"
                  >
                    {c.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AnaloguesTab({
  scenarioAnalogues,
  historicalAnalogues,
}: {
  scenarioAnalogues: ScenarioAnalogueWithAnalogue[];
  historicalAnalogues: HistoricalAnalogue[];
}) {
  return (
    <div className="space-y-4 text-sm">
      {scenarioAnalogues.length > 0 && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase mb-2">Linked to this scenario</h4>
          <ul className="space-y-2">
            {scenarioAnalogues.map((sa) => {
              const a = sa.historical_analogues;
              if (!a) return null;
              return (
                <li key={sa.id} className="p-2 rounded bg-amber-900/20 border border-amber-700/40">
                  <span className="font-medium text-amber-200">{a.event_name}</span>
                  <span className="text-gray-500 ml-1">({a.year})</span>
                  {sa.relevance_explanation && (
                    <p className="text-gray-400 text-xs mt-1">{sa.relevance_explanation}</p>
                  )}
                  {a.relevant_lesson && (
                    <p className="text-gray-500 text-xs mt-1 italic">{a.relevant_lesson}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div>
        <h4 className="text-xs text-gray-500 uppercase mb-2">Historical analogue library</h4>
        {historicalAnalogues.length === 0 ? (
          <p className="text-gray-500 text-xs">No analogues in database. Run seed.sql.</p>
        ) : (
          <ul className="space-y-1.5">
            {historicalAnalogues.map((a) => (
              <li key={a.id} className="text-gray-300">
                <span className="font-medium">{a.event_name}</span>
                <span className="text-gray-500 ml-1">({a.year})</span>
                {a.structural_similarity && (
                  <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{a.structural_similarity}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StressTestTab({
  selectedNode,
  stressTestText,
  onStressTestTextChange,
  onAdd,
  submitting,
}: {
  selectedNode: Node | null;
  stressTestText: string;
  onStressTestTextChange: (v: string) => void;
  onAdd: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-500 text-xs">
        Describe a worse variant (e.g. escalation, longer duration). This is added to the feedback queue as external context for re-runs.
      </p>
      {selectedNode && (
        <p className="text-gray-400 text-xs">
          Linked to node: <span className="text-amber-400">{selectedNode.title}</span>
        </p>
      )}
      <textarea
        className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        placeholder="e.g. Blockade lasts 6 months; military escalation closes Bab el-Mandeb..."
        value={stressTestText}
        onChange={(e) => onStressTestTextChange(e.target.value)}
        disabled={submitting}
      />
      <button
        className="w-full py-2 rounded font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 text-sm"
        onClick={onAdd}
        disabled={!stressTestText.trim() || submitting}
      >
        {submitting ? "Adding…" : "Add to feedback queue"}
      </button>
    </div>
  );
}

function FeedbackQueueFooter({
  scenarioId,
  pendingFeedback,
  nodes,
  feedbackType,
  feedbackContent,
  onFeedbackTypeChange,
  onFeedbackContentChange,
  onAddFeedback,
  onReRunWithFeedback,
  submitting,
  selectedNode,
}: {
  scenarioId: string | null;
  pendingFeedback: AnalystFeedback[];
  nodes: Node[];
  feedbackType: AnalystFeedback["feedback_type"];
  feedbackContent: string;
  onFeedbackTypeChange: (v: AnalystFeedback["feedback_type"]) => void;
  onFeedbackContentChange: (v: string) => void;
  onAddFeedback: () => void;
  onReRunWithFeedback: () => void;
  submitting: boolean;
  selectedNode: Node | null;
}) {
  const nodeTitles: Record<string, string> = Object.fromEntries(nodes.map((n) => [n.id, n.title ?? n.id]));

  return (
    <div className="border-t border-gray-800 p-2 flex flex-col gap-2 text-xs">
      <div className="text-gray-500 font-medium">Feedback queue</div>
      {!scenarioId ? (
        <p className="text-gray-500">Load a scenario to add feedback.</p>
      ) : (
        <>
          <div className="flex gap-1 flex-wrap">
            {FEEDBACK_TYPES.map(({ value, label }) => (
              <button
                key={value}
                className={`px-2 py-1 rounded ${feedbackType === value ? "bg-amber-600 text-gray-900" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                onClick={() => onFeedbackTypeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full h-14 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder={
              feedbackType === "disagree"
                ? "This won't happen because…"
                : feedbackType === "amplify"
                  ? "Go deeper on this because…"
                  : feedbackType === "scenario_tweak"
                    ? "Revised trigger / scenario…"
                    : "Paste external content (e.g. Telegram, source)…"
            }
            value={feedbackContent}
            onChange={(e) => onFeedbackContentChange(e.target.value)}
            disabled={submitting}
          />
          <div className="flex gap-1">
            <button
              className="flex-1 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50"
              onClick={onAddFeedback}
              disabled={!feedbackContent.trim() || submitting}
            >
              Add
            </button>
            <button
              className="flex-1 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onReRunWithFeedback}
              disabled={pendingFeedback.length === 0 || submitting}
            >
              Re-run with feedback
            </button>
          </div>
          {pendingFeedback.length > 0 && (
            <ul className="text-gray-500 max-h-20 overflow-y-auto space-y-0.5">
              {pendingFeedback.map((f) => (
                <li key={f.id}>
                  <span className="text-amber-500/80">{f.feedback_type}</span>
                  {f.node_id && (
                    <span className="ml-1 truncate">→ {nodeTitles[f.node_id] ?? f.node_id.slice(0, 8)}</span>
                  )}
                  : {f.content?.slice(0, 40)}
                  {f.content && f.content.length > 40 ? "…" : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NodeInspector({
  selectedNode,
  nodes,
  edges,
}: {
  selectedNode: Node | null;
  nodes: Node[];
  edges: Edge[];
}) {
  if (!selectedNode || !selectedNode.id) {
    return <p className="text-gray-500 text-sm">Click a node to inspect.</p>;
  }
  const incoming = edges.filter((e) => e && e.target_node_id === selectedNode.id);
  const outgoing = edges.filter((e) => e && e.source_node_id === selectedNode.id);
  const domain = selectedNode.domain ?? "unknown";
  const timeline = selectedNode.timeline ?? "";
  const confidence = selectedNode.confidence ?? "";
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: domainBg(domain),
            color: "#0f1117",
          }}
        >
          {domain}
        </span>
        <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
          {timeline}
        </span>
        <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
          {confidence}
        </span>
      </div>
      <h3 className="font-semibold text-gray-100">{selectedNode.title}</h3>
      {selectedNode.description && (
        <p className="text-gray-400">{selectedNode.description}</p>
      )}
      {selectedNode.mechanism && (
        <div>
          <span className="text-gray-500 uppercase text-xs">Mechanism</span>
          <p className="text-gray-300 mt-0.5">{selectedNode.mechanism}</p>
        </div>
      )}
      {Array.isArray(selectedNode.assumptions) && selectedNode.assumptions.length > 0 && (
        <div>
          <span className="text-gray-500 uppercase text-xs">Assumptions</span>
          <ul className="list-disc list-inside text-gray-300 mt-0.5">
            {selectedNode.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {selectedNode.quantitative_estimate && (
        <div>
          <span className="text-gray-500 uppercase text-xs">Estimate</span>
          <p className="text-gray-300 mt-0.5 font-mono text-xs">{selectedNode.quantitative_estimate}</p>
        </div>
      )}
      {Array.isArray(selectedNode.monitoring_indicators) && selectedNode.monitoring_indicators.length > 0 && (
        <div>
          <span className="text-gray-500 uppercase text-xs">Monitoring</span>
          <ul className="list-disc list-inside text-gray-300 mt-0.5">
            {selectedNode.monitoring_indicators.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {selectedNode.historical_precedent && (
        <div>
          <span className="text-gray-500 uppercase text-xs">Precedent</span>
          <p className="text-gray-300 mt-0.5">{selectedNode.historical_precedent}</p>
        </div>
      )}
      <div className="text-gray-500 text-xs">
        In: {incoming.length} · Out: {outgoing.length}
      </div>
    </div>
  );
}

function domainBg(domain: string): string {
  const map: Record<string, string> = {
    energy: "#f59e0b",
    food: "#22c55e",
    finance: "#3b82f6",
    political: "#ef4444",
    military: "#6b7280",
    supply_chain: "#a855f7",
    root: "#e5e7eb",
  };
  return map[domain] ?? "#9ca3af";
}
