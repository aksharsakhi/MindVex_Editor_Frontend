/**
 * CycleDetectionPage.tsx
 *
 * Enhanced Cycle Detection tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import { useStore } from '@nanostores/react';
import { graphCache } from '~/lib/stores/graphCacheStore';
import { getUnifiedParser, parseModeStore, ParseModeSelector, ParseModeStatus } from '~/lib/unifiedParser';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Brain, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Props {
  onBack: () => void;
}

interface CycleInfo {
  id: string;
  paths: string[];
  raw: string;
  llmInsight?: string;
}

export function CycleDetectionPage({ onBack }: Props) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphData = useStore(graphCache);
  const parseMode = useStore(parseModeStore);

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cycleInsights, setCycleInsights] = useState<Record<string, string>>({});

  const [detectedCycles, setDetectedCycles] = useState<string[]>([]);

  // Calculate cycles on client side if not provided by backend
  useEffect(() => {
    if (graphData && (!graphData.cycles || graphData.cycles.length === 0)) {
      // Simple DFS based cycle detection
      const adj = new Map<string, string[]>();
      graphData.edges.forEach((e) => {
        const src = typeof e.data.source === 'string' ? e.data.source : (e.data.source as any).id;
        const tgt = typeof e.data.target === 'string' ? e.data.target : (e.data.target as any).id;

        if (!adj.has(src)) {
          adj.set(src, []);
        }

        adj.get(src)?.push(tgt);
      });

      const visited = new Set<string>();
      const recStack = new Set<string>();
      const cycles: string[] = [];
      const path: string[] = [];

      const dfs = (u: string) => {
        visited.add(u);
        recStack.add(u);
        path.push(u);

        const neighbors = adj.get(u) || [];

        for (const v of neighbors) {
          if (!visited.has(v)) {
            dfs(v);
          } else if (recStack.has(v)) {
            // Cycle found
            const cycleStart = path.indexOf(v);

            if (cycleStart !== -1) {
              cycles.push(path.slice(cycleStart).join(' -> ') + ' -> ' + v);
            }
          }
        }

        recStack.delete(u);
        path.pop();
      };

      graphData.nodes.forEach((n) => {
        const id = n.data.id;

        if (!visited.has(id)) {
          dfs(id);
        }
      });

      // Deduplicate cycles (simple string set)
      const uniqueCycles = Array.from(new Set(cycles));

      // Limit to top 20 to avoid freezing UI on massive graphs
      setDetectedCycles(uniqueCycles.slice(0, 20));
    } else if (graphData?.cycles) {
      setDetectedCycles(graphData.cycles);
    }
  }, [graphData]);

  // Group cycles for easier display in the side panel
  const cycleList = useMemo(() => {
    if (!detectedCycles || detectedCycles.length === 0) {
      return [];
    }

    return detectedCycles.map((cycleStr, idx) => ({
      id: `cycle-${idx}`,
      paths: cycleStr.split(' -> '),
      raw: cycleStr,
      llmInsight: cycleInsights[`cycle-${idx}`],
    }));
  }, [detectedCycles, cycleInsights]);

  useEffect(() => {
    if (!containerRef.current || !graphData) {
      return () => {};
    }

    const elements = [
      ...graphData.nodes.map((n) => ({ data: n.data })),
      ...graphData.edges.map((e) => ({ data: e.data })),
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Base styles (dimmed by default)
        {
          selector: 'node',
          style: {
            'background-color': '#1f2937', // gray-800
            label: 'data(label)',
            color: '#4b5563', // gray-600
            'text-valign': 'center',
            'text-halign': 'right',
            'font-size': '10px',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#1f2937', // gray-800
            'target-arrow-color': '#1f2937',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.1,
          },
        },

        // Highlight styles for general cycles
        {
          selector: 'node.cycle',
          style: {
            'background-color': '#ef4444', // red-500
            color: '#cbd5e1', // slate-300
            'font-size': '12px',
          },
        },
        {
          selector: 'edge.cycle',
          style: {
            width: 3,
            'line-color': '#ef4444', // red-500
            'target-arrow-color': '#ef4444',
            opacity: 0.7,
            'z-index': 10,
          },
        },

        // Super-highlight styles for selected cycle
        {
          selector: 'node.selected-cycle',
          style: {
            'background-color': '#dc2626', // red-600
            color: '#fff',
            'font-size': '14px',
            'font-weight': 'bold',
            width: 40,
            height: 40,
            'z-index': 100,
          },
        },
        {
          selector: 'edge.selected-cycle',
          style: {
            width: 5,
            'line-color': '#dc2626', // red-600
            'target-arrow-color': '#dc2626',
            opacity: 1,
            'z-index': 99,
          },
        },
      ],
      layout: {
        name: 'cose',
        padding: 50,
        nodeRepulsion: () => 4000,
        animate: true,
        animationDuration: 500,
      },
    });

    // Apply initial cycle highlights
    cyRef.current.edges().forEach((edge) => {
      if (edge.data('cycle')) {
        edge.addClass('cycle');
        edge.source().addClass('cycle');
        edge.target().addClass('cycle');
      }
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData]);

  // Handle selected cycle change
  useEffect(() => {
    if (!cyRef.current || !graphData) {
      return;
    }

    const cy = cyRef.current;
    cy.elements().removeClass('selected-cycle');

    if (selectedCycleId) {
      const cycleInfo = cycleList.find((c) => c.id === selectedCycleId);

      if (!cycleInfo) {
        return;
      }

      const { paths } = cycleInfo;

      paths.forEach((path) => {
        const node = cy.nodes().filter((n) => n.data('filePath') === path);
        node.addClass('selected-cycle');
      });

      for (let i = 0; i < paths.length - 1; i++) {
        const sourcePath = paths[i];
        const targetPath = paths[i + 1];
        const sourceNode = cy.nodes().filter((n) => n.data('filePath') === sourcePath);
        const targetNode = cy.nodes().filter((n) => n.data('filePath') === targetPath);

        if (sourceNode.length > 0 && targetNode.length > 0) {
          const edge = cy
            .edges()
            .filter((e) => e.source().id() === sourceNode.id() && e.target().id() === targetNode.id());
          edge.addClass('selected-cycle');
        }
      }

      const firstNode = cy.nodes().filter((n) => n.data('filePath') === paths[0]);
      const lastNode = cy.nodes().filter((n) => n.data('filePath') === paths[paths.length - 1]);

      if (firstNode.length > 0 && lastNode.length > 0) {
        const closingEdge = cy
          .edges()
          .filter((e) => e.source().id() === lastNode.id() && e.target().id() === firstNode.id());
        closingEdge.addClass('selected-cycle');
      }
    }
  }, [selectedCycleId, cycleList, graphData]);

  const analyzeCycleWithAI = async (cycle: (typeof cycleList)[0]) => {
    setIsAnalyzing(true);

    try {
      const unifiedParser = await getUnifiedParser();

      const prompt = `Analyze this dependency cycle and suggest how to break it:
Cycle: ${cycle.raw}

Components involved:
${cycle.paths.map((p) => `- ${p}`).join('\n')}

Please provide:
1. Why this cycle is problematic
2. Which dependency is likely the best candidate to break
3. Refactoring strategy (e.g., dependency inversion, extracting common interface, etc.)`;

      // Simulate a code analysis to get LLM access
      const dummyCode = `// Dependency cycle analysis\n// Cycle: ${cycle.raw}`;
      const analysis = await unifiedParser.parseCode(dummyCode, cycle.paths[0]);

      if (analysis.llmAnalysis) {
        setCycleInsights((prev) => ({
          ...prev,
          [cycle.id]:
            analysis.llmAnalysis?.recommendations[0] || 'Refactor by extracting shared logic to a common component.',
        }));
      }

      toast.success('AI cycle analysis completed');
    } catch (error) {
      console.error('AI cycle analysis failed:', error);
      toast.error('AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">❌</div>
        <h2 className="text-2xl font-bold text-white mb-3">Loading Cycle Detector...</h2>
        <p className="text-gray-400 max-w-md">Searching for circular dependencies in the codebase architecture.</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">❌</div>
        <h2 className="text-2xl font-bold text-white mb-3">No Cycle Data Yet</h2>
        <p className="text-gray-400 max-w-md mb-6">
          Cycle detection requires a SCIP index to be uploaded for this repository. Once indexed, circular dependencies
          will be highlighted and listed here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>❌</span> Cycle Detection
          </h2>
          <ParseModeStatus />
        </div>

        <div className="flex items-center gap-2">
          <ParseModeSelector compact />
        </div>
      </div>

      <div className="flex-1 min-h-[500px] border border-gray-700 rounded-xl bg-gray-900 overflow-hidden relative flex">
        <div ref={containerRef} className="flex-1 h-full" />

        <div className="w-80 border-l border-gray-700 bg-gray-800/80 backdrop-blur p-4 overflow-y-auto flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5" />
              Dependency Cycles
            </h3>
            <p className="text-sm text-gray-400">
              {cycleList.length > 0
                ? `Found ${cycleList.length} circular dependencies. Select one to highlight its path.`
                : 'Great job! No circular dependencies found in this codebase.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {cycleList.map((cycle, index) => (
              <Card
                key={cycle.id}
                className={`p-3 cursor-pointer transition-all border ${
                  selectedCycleId === cycle.id
                    ? 'bg-red-900/20 border-red-500 scale-[1.02]'
                    : 'bg-gray-800 border-gray-700 hover:border-red-500/50'
                }`}
                onClick={() => setSelectedCycleId(cycle.id === selectedCycleId ? null : cycle.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-red-400 text-sm">Cycle #{index + 1}</span>
                  <Badge variant="destructive" className="text-[10px]">
                    {cycle.paths.length} nodes
                  </Badge>
                </div>

                <div className="space-y-1 mb-3">
                  {cycle.paths.map((path, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className="text-red-500 font-bold shrink-0">↳</span>
                      <span className="text-gray-300 font-mono break-all">{path.split(/[/\\]/).pop()}</span>
                    </div>
                  ))}
                </div>

                {parseMode.type === 'llm-enhanced' && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    {!cycle.llmInsight ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          analyzeCycleWithAI(cycle);
                        }}
                        disabled={isAnalyzing}
                      >
                        <Brain className="h-3 w-3" />
                        Analyze Break Strategy
                      </Button>
                    ) : (
                      <div className="text-[10px] text-blue-300 italic">
                        <span className="font-bold flex items-center gap-1 mb-1">
                          <Brain className="h-2 w-2" /> AI Insight:
                        </span>
                        {cycle.llmInsight}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
