import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Node, Edge } from "./supabase";

const DOMAIN_COLORS: Record<string, string> = {
  root: "#e5e7eb",
  energy: "#f59e0b",
  food: "#22c55e",
  finance: "#3b82f6",
  political: "#ef4444",
  military: "#6b7280",
  supply_chain: "#a855f7",
};

/** Hex ring around the root, matching the spec’s domain clustering. */
const DOMAIN_ANGLES: Record<string, number> = {
  energy: -Math.PI / 2,
  food: -Math.PI / 2 + Math.PI / 3,
  finance: -Math.PI / 2 + (2 * Math.PI) / 3,
  political: Math.PI / 2,
  military: Math.PI / 2 + Math.PI / 3,
  supply_chain: Math.PI / 2 + (2 * Math.PI) / 3,
};

type NodeWithPos = Node & { x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };

type Props = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  scenarioId: string | null;
};

export function Graph({ nodes, edges, selectedNodeId, onSelectNode, scenarioId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const safeNodes = Array.isArray(nodes) ? nodes.filter((n) => n && typeof n.id === "string") : [];
  const safeEdges = Array.isArray(edges)
    ? edges.filter((e) => e && typeof e.source_node_id === "string" && typeof e.target_node_id === "string")
    : [];

  const layoutKey = useMemo(
    () =>
      `${scenarioId ?? ""}|${safeNodes.map((n) => n.id).join(",")}|${safeEdges.map((e) => e.id).join(",")}`,
    [scenarioId, nodes, edges]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!safeNodes.length || !svg) return;

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const ring = Math.min(width, height) * 0.34;

    const targetFor = (n: Node) => {
      if (n.domain === "root" || n.parent_id === null) return { x: centerX, y: centerY };
      const angle = DOMAIN_ANGLES[n.domain] ?? 0;
      return { x: centerX + Math.cos(angle) * ring, y: centerY + Math.sin(angle) * ring };
    };

    const nodesForSim: NodeWithPos[] = safeNodes.map((n) => {
      const t = targetFor(n);
      const pinned = n.domain === "root" || n.parent_id === null;
      return {
        ...n,
        x: t.x,
        y: t.y,
        fx: pinned ? centerX : undefined,
        fy: pinned ? centerY : undefined,
      };
    });

    type SimLink = { source: string; target: string; id: string };
    const links: SimLink[] = safeEdges
      .filter(
        (e) =>
          nodesForSim.some((n) => n.id === e.source_node_id) &&
          nodesForSim.some((n) => n.id === e.target_node_id)
      )
      .map((e) => ({ source: e.source_node_id, target: e.target_node_id, id: e.id }));

    const sim = d3
      .forceSimulation(nodesForSim)
      .force(
        "link",
        d3
          .forceLink<NodeWithPos, SimLink>(links)
          .id((d) => d.id)
          .distance(90)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force(
        "x",
        d3.forceX<NodeWithPos>((d) => targetFor(d).x).strength((d) => (d.domain === "root" ? 1 : 0.55))
      )
      .force(
        "y",
        d3.forceY<NodeWithPos>((d) => targetFor(d).y).strength((d) => (d.domain === "root" ? 1 : 0.55))
      )
      .force("collide", d3.forceCollide<NodeWithPos>(() => 36).iterations(2))
      .stop();

    sim.tick(220);

    const pos: Record<string, { x: number; y: number }> = {};
    nodesForSim.forEach((n) => {
      if (n.x != null && n.y != null) pos[n.id] = { x: n.x, y: n.y };
    });
    setPositions(pos);

    return () => {
      sim.stop();
    };
    // safeNodes/safeEdges are new arrays each render; layoutKey is the identity of the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  if (!scenarioId && safeNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Generate a scenario or select one from the library.
      </div>
    );
  }

  const nodePosList = safeNodes
    .map((n) => ({ node: n, pos: positions[n.id] }))
    .filter(({ pos }) => pos != null) as { node: Node; pos: { x: number; y: number } }[];

  const getNodePos = (id: string) => positions[id] ?? { x: 0, y: 0 };

  return (
    <div className="flex-1 min-h-0 relative">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g>
          {safeEdges.map((e) => {
            const src = getNodePos(e.source_node_id);
            const tgt = getNodePos(e.target_node_id);
            if (e.is_cross_domain) {
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const cx = mx - (tgt.y - src.y) * 0.18;
              const cy = my + (tgt.x - src.x) * 0.18;
              return (
                <path
                  key={e.id}
                  d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${tgt.x} ${tgt.y}`}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              );
            }
            return (
              <line
                key={e.id}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#374151"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
        <g>
          {nodePosList.map(({ node, pos }) => {
            const isRoot = node.domain === "root" || node.parent_id === null;
            const r = isRoot ? 14 : node.confidence === "high" ? 10 : node.confidence === "medium" ? 8 : 6;
            const opacity = node.timeline === "immediate" ? 1 : node.timeline === "long" ? 0.65 : 0.85;
            const selected = node.id === selectedNodeId;
            const color = DOMAIN_COLORS[node.domain] ?? "#9ca3af";
            const label = node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => onSelectNode(node.id)}
              >
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={opacity}
                  stroke={selected ? "#fff" : "rgba(255,255,255,0.3)"}
                  strokeWidth={selected ? 2.5 : 1}
                />
                <text
                  y={r + 12}
                  textAnchor="middle"
                  fill={selected ? "#f3f4f6" : "#9ca3af"}
                  fontSize={selected ? 11 : 9}
                  fontWeight={selected ? 600 : 400}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {label}
                </text>
                <title>{`${node.title} (${node.domain}) — ${node.timeline}, ${node.confidence}`}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
