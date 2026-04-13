import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Network, RefreshCw, Loader2, Filter, X, Search,
} from 'lucide-react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
  useSetSettings,
  ControlsContainer,
  ZoomControl,
  FullScreenControl,
} from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';

import { fetchKnowledgeGraph } from '../api';
import { useLang } from '../store';
import type { KnowledgeGraphData, GraphNode, GraphEdge } from '../types';

// ─── 节点颜色配置 ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  agent:     { fill: '#93bbfd', stroke: '#3b82f6', text: '#1e40af' },
  category:  { fill: '#d8b4fe', stroke: '#8b5cf6', text: '#5b21b6' },
  skill:     { fill: '#fcd34d', stroke: '#f59e0b', text: '#92400e' },
  knowledge: { fill: '#6ee7b7', stroke: '#10b981', text: '#065f46' },
  tool:      { fill: '#fca5a5', stroke: '#ef4444', text: '#991b1b' },
};

const EDGE_COLORS: Record<string, string> = {
  belongs_to:    '#8b5cf6',
  uses_skill:    '#f59e0b',
  has_knowledge: '#10b981',
  depends_on:    '#ef4444',
  collaborates:  '#3b82f6',
  uses_tool:     '#f97316',
};

const NODE_SIZE_MAP: Record<string, number> = {
  agent: 12,
  category: 14,
  skill: 8,
  knowledge: 7,
  tool: 6,
};

// ─── 构建 graphology 图实例 ──────────────────────────────────────────────────

const buildGraph = (
  nodes: GraphNode[],
  edges: GraphEdge[],
): Graph => {
  const graph = new Graph();

  for (const node of nodes) {
    const colors = NODE_COLORS[node.type] || NODE_COLORS.agent;
    graph.addNode(node.id, {
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: node.size || NODE_SIZE_MAP[node.type] || 8,
      color: colors.fill,
      borderColor: colors.stroke,
      label: `${node.emoji || '●'} ${node.label}`,
      // 自定义属性，用于 reducer
      nodeType: node.type,
      emoji: node.emoji || '●',
      rawLabel: node.label,
      metadata: node.metadata,
    });
  }

  for (const edge of edges) {
    // 避免重复边或自环
    if (edge.source === edge.target) continue;
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      try {
        graph.addEdge(edge.source, edge.target, {
          color: EDGE_COLORS[edge.type] || '#cbd5e1',
          size: edge.weight || 1.5,
          label: edge.label,
          edgeType: edge.type,
        });
      } catch {
        // 忽略重复边
      }
    }
  }

  // 运行 ForceAtlas2 布局
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, {
    iterations: 200,
    settings: {
      ...settings,
      gravity: 1,
      scalingRatio: 10,
      barnesHutOptimize: graph.order > 50,
    },
  });

  return graph;
};

// ─── 图谱加载子组件 ──────────────────────────────────────────────────────────

interface GraphLoaderProps {
  graphData: KnowledgeGraphData;
  filteredNodes: GraphNode[];
  filteredEdges: GraphEdge[];
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  hoveredNode: string | null;
  onHoverNode: (id: string | null) => void;
}

const GraphLoader = ({
  filteredNodes,
  filteredEdges,
  selectedNode,
  onSelectNode,
  hoveredNode,
  onHoverNode,
}: GraphLoaderProps) => {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const setSettings = useSetSettings();

  // 加载图数据
  useEffect(() => {
    const graph = buildGraph(filteredNodes, filteredEdges);
    loadGraph(graph);

    // 自适应视图
    setTimeout(() => {
      const camera = sigma.getCamera();
      camera.animatedReset({ duration: 300 });
    }, 100);
  }, [filteredNodes, filteredEdges, loadGraph, sigma]);

  // 注册事件
  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeId = event.node;
        onSelectNode(selectedNode === nodeId ? null : nodeId);
      },
      enterNode: (event) => {
        onHoverNode(event.node);
      },
      leaveNode: () => {
        onHoverNode(null);
      },
      clickStage: () => {
        onSelectNode(null);
      },
    });
  }, [registerEvents, selectedNode, onSelectNode, onHoverNode]);

  // 动态更新 nodeReducer / edgeReducer 实现高亮效果
  useEffect(() => {
    const activeNode = hoveredNode || selectedNode;
    const graph = sigma.getGraph();

    // 预计算邻居节点集合
    const neighborNodes = new Set<string>();
    if (activeNode && graph.hasNode(activeNode)) {
      graph.forEachNeighbor(activeNode, (neighbor) => neighborNodes.add(neighbor));
    }

    setSettings({
      nodeReducer: (node: string, data: Record<string, any>) => {
        const res = { ...data };
        if (!activeNode) return res;

        if (node === activeNode) {
          res.highlighted = true;
          res.zIndex = 10;
        } else if (neighborNodes.has(node)) {
          res.zIndex = 5;
        } else {
          res.color = '#e2e8f0';
          res.label = '';
          res.zIndex = 0;
        }
        return res;
      },
      edgeReducer: (edge: string, data: Record<string, any>) => {
        const res = { ...data };
        if (!activeNode) return res;

        // 通过 graph 实例获取边的端点
        try {
          const source = graph.source(edge);
          const target = graph.target(edge);
          const isConnected = source === activeNode || target === activeNode;
          if (!isConnected) {
            res.color = '#f1f5f9';
            res.size = 0.3;
            res.label = '';
          } else {
            // 高亮关联边
            res.size = 2.5;
            res.zIndex = 10;
          }
        } catch {
          res.color = '#f1f5f9';
          res.size = 0.3;
        }
        return res;
      },
    } as any);
  }, [hoveredNode, selectedNode, sigma, setSettings]);

  // 节点拖拽支持
  useEffect(() => {
    let draggedNode: string | null = null;
    let isDragging = false;

    const handleDownNode = (e: { node: string; event: { original: MouseEvent | TouchEvent } }) => {
      draggedNode = e.node;
      isDragging = false;
      sigma.getGraph().setNodeAttribute(draggedNode, 'highlighted', true);
    };

    const handleMoveBody = (e: { event: { original: MouseEvent | TouchEvent } }) => {
      if (!draggedNode) return;
      isDragging = true;

      // 阻止 sigma 默认的相机平移
      const event = e.event as any;
      if (event.preventSigmaDefault) event.preventSigmaDefault();

      // 获取鼠标在图坐标系中的位置
      const mouseEvent = event.original as MouseEvent;
      const coords = sigma.viewportToGraph({
        x: mouseEvent.offsetX,
        y: mouseEvent.offsetY,
      });

      sigma.getGraph().setNodeAttribute(draggedNode, 'x', coords.x);
      sigma.getGraph().setNodeAttribute(draggedNode, 'y', coords.y);
    };

    const handleUp = () => {
      if (draggedNode) {
        sigma.getGraph().removeNodeAttribute(draggedNode, 'highlighted');
      }
      draggedNode = null;
      isDragging = false;
    };

    sigma.on('downNode', handleDownNode as any);
    sigma.on('moveBody', handleMoveBody as any);
    sigma.on('upNode', handleUp as any);
    sigma.on('upStage', handleUp as any);

    return () => {
      sigma.off('downNode', handleDownNode as any);
      sigma.off('moveBody', handleMoveBody as any);
      sigma.off('upNode', handleUp as any);
      sigma.off('upStage', handleUp as any);
    };
  }, [sigma]);

  return null;
};

// ─── 节点详情面板 ────────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  nodeId: string;
  graphData: KnowledgeGraphData;
  onClose: () => void;
}

const NodeDetailPanel = ({ nodeId, graphData, onClose }: NodeDetailPanelProps) => {
  const node = graphData.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const colors = NODE_COLORS[node.type] || NODE_COLORS.agent;
  const connectedEdges = graphData.edges.filter(
    e => e.source === nodeId || e.target === nodeId,
  );

  return (
    <div className="absolute top-4 right-4 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-5 z-10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{node.emoji || '●'}</span>
          <div>
            <span className="text-sm font-bold text-slate-800 block">{node.label}</span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize inline-block mt-0.5"
              style={{ background: colors.fill, color: colors.text }}
            >
              {node.type}
            </span>
          </div>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          onClick={onClose}
          tabIndex={0}
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 元数据 */}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <div className="space-y-1.5 mb-3 pb-3 border-b border-slate-100">
          {Object.entries(node.metadata).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-xs">
              <span className="text-slate-400 flex-shrink-0 min-w-[48px]">{k}:</span>
              <span className="text-slate-700 font-medium break-all">
                {Array.isArray(v) ? v.join(', ') : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 关联关系 */}
      <div>
        <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">
          关联关系 ({connectedEdges.length})
        </h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {connectedEdges.map((edge, i) => {
            const isSource = edge.source === nodeId;
            const otherNodeId = isSource ? edge.target : edge.source;
            const otherNode = graphData.nodes.find(n => n.id === otherNodeId);
            const edgeColor = EDGE_COLORS[edge.type] || '#94a3b8';
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: edgeColor }} />
                <span className="text-slate-500 flex-shrink-0">{edge.label}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-700 font-medium truncate">
                  {otherNode?.emoji} {otherNode?.label || otherNodeId}
                </span>
              </div>
            );
          })}
          {connectedEdges.length === 0 && (
            <p className="text-xs text-slate-400 italic">无关联关系</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

const KnowledgeGraphPage = () => {
  const lang = useLang();

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeGraph();
      setGraphData(data);
    } catch { /* 拦截器已处理 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // 过滤节点和边
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!graphData) return { filteredNodes: [], filteredEdges: [] };

    const nodes = graphData.nodes.filter(n => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (searchText && !n.label.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(e =>
      nodeIds.has(e.source) && nodeIds.has(e.target),
    );

    return { filteredNodes: nodes, filteredEdges: edges };
  }, [graphData, typeFilter, searchText]);

  // Sigma 基础 settings（reducers 在 GraphLoader 子组件中动态设置）
  const sigmaSettings = useMemo(() => ({
    defaultEdgeType: 'line' as const,
    renderEdgeLabels: true,
    edgeLabelSize: 10,
    labelSize: 12,
    labelWeight: 'bold',
    labelColor: { color: '#334155' },
    edgeLabelColor: { color: '#94a3b8' },
    labelRenderedSizeThreshold: 6,
    labelDensity: 0.3,
    labelGridCellSize: 100,
    zIndex: true,
    minEdgeThickness: 0.8,
    enableEdgeEvents: false,
  }), []);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Network className="w-6 h-6 text-emerald-500" />
              {lang === 'zh' ? '知识图谱' : 'Knowledge Graph'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === 'zh'
                ? 'Agent ↔ Skill ↔ Tool ↔ MCP ↔ 知识库 平台能力拓扑图'
                : 'Platform capability topology: Agent ↔ Skill ↔ Tool ↔ MCP ↔ Knowledge'}
            </p>
          </div>
          {graphData && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{graphData.stats.totalNodes} {lang === 'zh' ? '节点' : 'nodes'}</span>
              <span>{graphData.stats.totalEdges} {lang === 'zh' ? '关系' : 'edges'}</span>
              {graphData.stats.toolCount && graphData.stats.toolCount > 0 && (
                <span>🔧 {graphData.stats.toolCount} {lang === 'zh' ? '工具' : 'tools'}</span>
              )}
              {graphData.stats.mcpCount && graphData.stats.mcpCount > 0 && (
                <span>🔌 {graphData.stats.mcpCount} MCP</span>
              )}
              <button
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                onClick={loadGraph}
                tabIndex={0}
                aria-label="刷新"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200 focus-within:border-emerald-400 w-48">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder-slate-400"
              placeholder={lang === 'zh' ? '搜索节点...' : 'Search nodes...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="搜索节点"
              tabIndex={0}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {[
              { key: 'all', label: lang === 'zh' ? '全部' : 'All' },
              { key: 'agent', label: '🤖 Agent' },
              { key: 'category', label: lang === 'zh' ? '📂 分类' : '📂 Category' },
              { key: 'skill', label: '⚡ Skill' },
              { key: 'knowledge', label: lang === 'zh' ? '📚 知识' : '📚 Knowledge' },
              { key: 'tool', label: lang === 'zh' ? '🔧 工具' : '🔧 Tool' },
            ].map(f => (
              <button
                key={f.key}
                className={`text-[11px] px-2 py-1 rounded-full transition-all font-medium ${
                  typeFilter === f.key
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                    : 'text-slate-500 border border-slate-200 bg-white hover:border-slate-300'
                }`}
                onClick={() => setTypeFilter(f.key)}
                tabIndex={0}
                aria-label={f.label}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 图谱区域 */}
      <div className="flex-1 relative overflow-hidden bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : graphData && filteredNodes.length > 0 ? (
          <>
            <SigmaContainer
              style={{ width: '100%', height: '100%' }}
              settings={sigmaSettings}
            >
              <GraphLoader
                graphData={graphData}
                filteredNodes={filteredNodes}
                filteredEdges={filteredEdges}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                hoveredNode={hoveredNode}
                onHoverNode={setHoveredNode}
              />
              <ControlsContainer position="bottom-right">
                <ZoomControl labels={{ zoomIn: '放大', zoomOut: '缩小', reset: '重置' }} />
                <FullScreenControl />
              </ControlsContainer>
            </SigmaContainer>

            {/* 图例 */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-3 z-10">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">
                {lang === 'zh' ? '图例' : 'Legend'}
              </div>
              <div className="space-y-1.5">
                {Object.entries(NODE_COLORS).map(([type, colors]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2"
                      style={{ background: colors.fill, borderColor: colors.stroke }}
                    />
                    <span className="text-[11px] text-slate-600 capitalize font-medium">{type}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                  {lang === 'zh' ? '操作' : 'Controls'}
                </div>
                <div className="text-[10px] text-slate-500">🖱️ {lang === 'zh' ? '点击节点查看详情' : 'Click node for details'}</div>
                <div className="text-[10px] text-slate-500">✋ {lang === 'zh' ? '拖拽节点移动位置' : 'Drag node to move'}</div>
                <div className="text-[10px] text-slate-500">🔍 {lang === 'zh' ? '滚轮缩放画布' : 'Scroll to zoom'}</div>
              </div>
            </div>

            {/* 选中节点详情 */}
            {selectedNode && graphData && (
              <NodeDetailPanel
                nodeId={selectedNode}
                graphData={graphData}
                onClose={() => setSelectedNode(null)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Network className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{lang === 'zh' ? '暂无图谱数据' : 'No graph data'}</p>
            <p className="text-xs mt-1">
              {lang === 'zh' ? '尝试调整筛选条件或刷新数据' : 'Try adjusting filters or refreshing'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;
