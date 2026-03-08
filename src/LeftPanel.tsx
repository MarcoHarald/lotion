import { useState } from "react";
import type { Scenario } from "./supabase";

const DOMAINS = ["energy", "food", "finance", "political", "military", "supply_chain"] as const;
const TIMELINE_LABELS = ["Immediate (0–72hr)", "Short (1–4wk)", "Medium (1–6mo)", "Long (6mo+)"];
const DOMAIN_LABELS: Record<string, string> = {
  energy: "Energy",
  food: "Food & Ag",
  finance: "Finance",
  political: "Political",
  military: "Military",
  supply_chain: "Supply Chain",
};

type Props = {
  triggerText: string;
  onTriggerTextChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  statusMessage: string | null;
  timelineIndex: number;
  onTimelineChange: (i: number) => void;
  domainFilters: Record<string, boolean>;
  onDomainFilterChange: (domain: string, value: boolean) => void;
  scenarios: Scenario[];
  onSelectScenario: (s: Scenario) => void;
  selectedScenarioId: string | null;
};

export function LeftPanel({
  triggerText,
  onTriggerTextChange,
  onGenerate,
  loading,
  statusMessage,
  timelineIndex,
  onTimelineChange,
  domainFilters,
  onDomainFilterChange,
  scenarios,
  onSelectScenario,
  selectedScenarioId,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(true);
  return (
    <aside className="w-[280px] shrink-0 flex flex-col border-r border-gray-800 bg-bg overflow-hidden">
      <div className="p-3 flex flex-col gap-3">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Trigger event</label>
        <textarea
          className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          placeholder="Describe a geopolitical trigger event..."
          value={triggerText}
          onChange={(e) => onTriggerTextChange(e.target.value)}
          disabled={loading}
        />
        <button
          className="w-full py-2.5 rounded font-medium bg-amber-600 hover:bg-amber-500 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? (statusMessage ?? "Generating…") : "Generate consequences"}
        </button>
      </div>

      <div className="px-3 pb-3">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Timeline</label>
        <div className="flex gap-1 mt-1">
          {TIMELINE_LABELS.map((label, i) => (
            <button
              key={i}
              className={`flex-1 py-1.5 rounded text-xs ${timelineIndex === i ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              onClick={() => onTimelineChange(i)}
              title={label}
            >
              {i === 0 ? "Immed." : i === 1 ? "Short" : i === 2 ? "Med." : "Long"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-3">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Domains</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DOMAINS.map((d) => (
            <button
              key={d}
              className={`px-2 py-1 rounded text-xs border ${domainFilters[d] ? "border-current opacity-100" : "border-gray-700 text-gray-500 opacity-60"}`}
              style={{ color: domainColor(d) }}
              onClick={() => onDomainFilterChange(d, !domainFilters[d])}
            >
              {DOMAIN_LABELS[d] ?? d}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-800 mt-auto">
        <button
          className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800/50 flex justify-between items-center"
          onClick={() => setLibraryOpen((o) => !o)}
        >
          Scenario library
          <span className="text-gray-600">{libraryOpen ? "−" : "+"}</span>
        </button>
        {libraryOpen && (
          <ul className="max-h-48 overflow-y-auto pb-2">
            {scenarios.length === 0 && (
              <li className="px-3 py-2 text-gray-500 text-sm">No scenarios yet. Generate one above.</li>
            )}
            {scenarios.map((s) => (
              <li key={s.id}>
                <button
                  className={`w-full px-3 py-1.5 text-left text-sm truncate ${s.id === selectedScenarioId ? "bg-gray-700 text-amber-400" : "text-gray-300 hover:bg-gray-800/50"}`}
                  onClick={() => onSelectScenario(s)}
                >
                  {s.title || s.trigger_text?.slice(0, 40) || s.id.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function domainColor(domain: string): string {
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

