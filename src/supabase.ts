import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env (see .env.example).");
}

export const supabase = createClient(url || "", anonKey || "");

export type Scenario = {
  id: string;
  user_id: string | null;
  title: string | null;
  trigger_text: string | null;
  trigger_summary: string | null;
  status: string;
  generation_stage: string | null;
  perplexity_cache: unknown;
  perplexity_cached_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Node = {
  id: string;
  scenario_id: string;
  parent_id: string | null;
  domain: string;
  title: string;
  description: string | null;
  mechanism: string | null;
  confidence: string;
  timeline: string;
  assumptions: string[] | null;
  monitoring_indicators: string[] | null;
  quantitative_estimate: string | null;
  historical_precedent: string | null;
  agent_generated_by: string | null;
  is_analyst_modified: boolean;
  created_at: string;
  updated_at: string;
};

export type Edge = {
  id: string;
  scenario_id: string;
  source_node_id: string;
  target_node_id: string;
  mechanism: string | null;
  is_cross_domain: boolean;
  confidence: string;
  created_at: string;
};

export type SourceCard = {
  id: string;
  scenario_id: string;
  node_id: string | null;
  platform: string;
  handle: string | null;
  snippet: string | null;
  url: string | null;
  retrieved_at: string | null;
  created_at: string;
};

export type AnalystFeedback = {
  id: string;
  scenario_id: string;
  node_id: string | null;
  user_id: string | null;
  feedback_type: "disagree" | "amplify" | "scenario_tweak" | "external_inject";
  content: string | null;
  domain_tag: string | null;
  status: "pending" | "applied" | "dismissed";
  re_run_triggered_at: string | null;
  created_at: string;
};

export type HistoricalAnalogue = {
  id: string;
  event_name: string;
  year: number;
  region: string[] | null;
  domains: string[] | null;
  structural_similarity: string | null;
  ground_truth: string | null;
  relevant_lesson: string | null;
  created_at: string;
};

export type ScenarioAnalogue = {
  id: string;
  scenario_id: string;
  analogue_id: string;
  relevance_explanation: string | null;
  created_at: string;
};
