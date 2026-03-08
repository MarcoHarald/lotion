import { useEffect, useRef, useState } from "react";
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

type NodeWithPos = Node & { x?: number; y?: number; vx?: number; vy?: number };

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
  const simulationRef = useRef<d3.Simulation<NodeWithPos, Edge> | null>(null);

  const safeNodes = Array.isArray(nodes) ? nodes.filter((n) => n && typeof n.id === "string") : [];
  const safeEdges = Array.isArray(edges) ? edges.filter((e) => e && typeof e.source_node_id === "string" && typeof e.target_node_id === "string") : [];

  useEffect(() => {
    if (!safeNodes.length || !svgRef.current) return;

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodesForSim: NodeWithPos[] = safeNodes.map((n) => ({ ...n }));
    const links: { source: string; target: string; id: string }[] = safeEdges
      .filter((e) => nodesForSim.some((n) => n.id === e.source_node_id) && nodesForSim.some((n) => n.id === e.target_node_id))
      .map((e) => ({ source: e.source_node_id, target: e.target_node_id, id: e.id }));

    const sim = d3
      .forceSimulation(nodesForSim)
      .force(
        "link",
        d3
          .forceLink<NodeWithPos, { source: string; target: string }>(links)
          .id((d) => (d as NodeWithPos).id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(centerX, centerY))
      .force("x", d3.forceX(centerX).strength(0.05))
      .force("y", d3.forceY(centerY).strength(0.05));

    const root = nodesForSim.find((n) => n.domain === "root" || n.parent_id === null);
    if (root) {
      const rootNode = nodesForSim.find((n) => n.id === root.id);
      if (rootNode) {
        rootNode.x = centerX;
        rootNode.y = centerY;
        sim.force("x", d3.forceX(centerX).strength((d) => (d.id === root.id ? 0.3 : 0.02)));
        sim.force("y", d3.forceY(centerY).strength((d) => (d.id === root.id ? 0.3 : 0.02)));
      }
    }

    simulationRef.current = sim;
    sim.on("tick", () => {
      const pos: Record<string, { x: number; y: number }> = {};
      nodesForSim.forEach((n) => {
        if (n.x != null && n.y != null) pos[n.id] = { x: n.x, y: n.y };
      });
      setPositions((p) => (Object.keys(pos).length ? pos : p));
    });

    return () => {
      sim.stop();
      simulationRef.current = null;
    };
  }, [safeNodes, safeEdges, scenarioId]);

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
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseLeave={() => onSelectNode(null)}
      >
        <g>
          {safeEdges.map((e) => {
            const src = getNodePos(e.source_node_id);
            const tgt = getNodePos(e.target_node_id);
            return (
              <line
                key={e.id}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={e.is_cross_domain ? "#4b5563" : "#374151"}
                strokeWidth={e.is_cross_domain ? 1 : 1.5}
                strokeDasharray={e.is_cross_domain ? "4 2" : undefined}
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
                <title>{`${node.title} (${node.domain}) — ${node.timeline}, ${node.confidence}`}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
