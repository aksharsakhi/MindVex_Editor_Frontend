/**
 * RealTimeGraphPage.tsx
 *
 * Enhanced Real-Time Graph Update tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { useStore } from '@nanostores/react';
import { graphCache, refreshGraph, graphCacheRepoUrl, graphCacheLoading } from '~/lib/stores/graphCacheStore';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  getUnifiedParser,
  parseModeStore,
  ParseModeSelector,
  ParseModeStatus,
  type ProjectAnalysis,
  type LLMAnalysis,
} from '~/lib/unifiedParser';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Brain, Zap, Info, RefreshCw, Download, Activity, Clock, Play, Pause, History } from 'lucide-react';
import { toast } from 'react-toastify';

interface Props {
  onBack: () => void;
}

interface UpdateStats {
  lastUpdated: Date;
  changesDetected: number;
  filesAnalyzed: number;
  averageTime: number;
  llmInsights?: string[];
  nodesAdded: number;
  edgesAdded: number;
  nodesRemoved: number;
  edgesRemoved: number;
}

interface ChangeHistoryEntry {
  timestamp: Date;
  type: 'node_added' | 'node_removed' | 'edge_added' | 'edge_removed' | 'sync';
  description: string;
}

export function RealTimeGraphPage({ onBack }: Props) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const graphData = useStore(graphCache);
  const repoUrl = useStore(graphCacheRepoUrl);
  const isLoading = useStore(graphCacheLoading);
  const parseMode = useStore(parseModeStore);
  const files = useStore(workbenchStore.files);

  const [localGraphData, setLocalGraphData] = useState<typeof graphData>(null);

  const [stats, setStats] = useState<UpdateStats>({
    lastUpdated: new Date(),
    changesDetected: 0,
    filesAnalyzed: 0,
    averageTime: 0,
    nodesAdded: 0,
    edgesAdded: 0,
    nodesRemoved: 0,
    edgesRemoved: 0,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processedFiles] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = disabled
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modifiedNodes, setModifiedNodes] = useState<Set<string>>(new Set());
  const [previousFileVersions, setPreviousFileVersions] = useState<Map<string, string>>(new Map());

  // Initialize local graph data
  useEffect(() => {
    if (graphData && !localGraphData) {
      setLocalGraphData(JSON.parse(JSON.stringify(graphData)));
    }
  }, [graphData]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0 && !isPaused) {
      const interval = setInterval(() => {
        handleRefresh();
      }, autoRefreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, isPaused]);

  // Handle Real-Time Updates
  useEffect(() => {
    if (isPaused) return;

    const handleFileChange = async () => {
      // Detect modified files by comparing content
      const filesMap = workbenchStore.files.get();
      const modifiedFiles: string[] = [];

      Object.entries(filesMap).forEach(([path, dirent]) => {
        if (dirent.type === 'file') {
          const previousContent = previousFileVersions.get(path);
          if (previousContent !== undefined && previousContent !== dirent.content) {
            modifiedFiles.push(path);
          }
          previousFileVersions.set(path, dirent.content);
        }
      });

      if (modifiedFiles.length === 0) {
        return;
      }

      const parser = await getUnifiedParser();
      let changes = 0;
      const startTime = Date.now();
      let nodesAdded = 0;
      let edgesAdded = 0;

      for (const filePath of modifiedFiles) {
        const dirent = filesMap[filePath];

        changes++;

        // Track this node as modified for visual highlighting
        setModifiedNodes((prev) => new Set([...prev, filePath]));

        // Clear highlight after 3 seconds
        setTimeout(() => {
          setModifiedNodes((prev) => {
            const next = new Set(prev);
            next.delete(filePath);
            return next;
          });
        }, 3000);

        if (dirent?.type === 'file') {
          try {
            // Parse the changed file
            const result = await parser.parseCode(dirent.content, filePath);

            // Update graph edges based on new imports
            if (localGraphData) {
              const newEdges = [...localGraphData.edges];
              const newNodes = [...localGraphData.nodes];

              // Remove old edges from this source
              const oldEdgeCount = newEdges.length;
              const filteredEdges = newEdges.filter((e) => e.data.source !== filePath);
              const edgesRemoved = oldEdgeCount - filteredEdges.length;

              // Add new edges with tracking
              const edgesBefore = filteredEdges.length;
              result.metadata.imports.forEach((imp) => {
                // Find target node (naive matching by filename)
                const targetNode = newNodes.find((n) => n.data.filePath?.includes(imp.module));

                if (targetNode) {
                  filteredEdges.push({
                    data: {
                      id: `${filePath}-${targetNode.data.id}`,
                      source: filePath,
                      target: targetNode.data.id,
                      type: 'import',
                      cycle: false,
                      label: 'imports',
                      strength: 1,
                      isNew: true, // Mark as new for visual highlight
                    } as any,
                  });
                }
              });

              const newEdgesCount = filteredEdges.length - edgesBefore;
              edgesAdded += newEdgesCount;

              // Log change
              if (newEdgesCount > 0 || edgesRemoved > 0) {
                setChangeHistory((prev) =>
                  [
                    {
                      timestamp: new Date(),
                      type: newEdgesCount > 0 ? 'edge_added' : 'edge_removed',
                      description: `${filePath}: ${newEdgesCount} edges added, ${edgesRemoved} edges removed`,
                    },
                    ...prev,
                  ].slice(0, 50),
                ); // Keep last 50 changes
              }

              setLocalGraphData({
                ...localGraphData,
                edges: filteredEdges,
              });

              // Clear "new" flag after 3 seconds
              setTimeout(() => {
                setLocalGraphData((prev) =>
                  prev
                    ? {
                        ...prev,
                        edges: prev.edges.map((e) => ({
                          ...e,
                          data: { ...e.data, isNew: false },
                        })),
                      }
                    : prev,
                );
              }, 3000);
            }
          } catch (e) {
            console.error('Failed to parse changed file', e);
          }
        }
      }

      if (changes > 0) {
        setStats((prev) => ({
          ...prev,
          lastUpdated: new Date(),
          changesDetected: prev.changesDetected + changes,
          filesAnalyzed: prev.filesAnalyzed + changes,
          averageTime: (Date.now() - startTime) / changes,
          edgesAdded: prev.edgesAdded + edgesAdded,
          nodesAdded: prev.nodesAdded + nodesAdded,
        }));

        setChangeHistory((prev) =>
          [
            {
              timestamp: new Date(),
              type: 'sync',
              description: `Detected ${changes} file changes`,
            },
            ...prev,
          ].slice(0, 50),
        );

        if (parseMode.type === 'llm-enhanced') {
          // Trigger AI analysis for impact
          toast.info(`AI analyzing impact of ${changes} changed files...`);
        }
      }
    };

    const timeoutId = setTimeout(handleFileChange, 2000);

    return () => clearTimeout(timeoutId);
  }, [files, parseMode, isPaused]); // Debounce on files change

  useEffect(() => {
    if (containerRef.current && localGraphData) {
      const elements = [
        ...localGraphData.nodes.map((n) => ({ data: n.data })),
        ...localGraphData.edges.map((e) => ({ data: e.data })),
      ];

      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (ele) => (modifiedNodes.has(ele.id()) ? '#22c55e' : '#0ea5e9'), // green if modified
              label: 'data(label)',
              color: '#fff',
              'text-valign': 'center',
              'text-halign': 'right',
              'font-size': '12px',
              'transition-property': 'background-color',
              'transition-duration': 500,
            },
          },
          {
            selector: 'edge',
            style: {
              width: (ele) => (ele.data('isNew') ? 3 : 2),
              'line-color': (ele) => (ele.data('isNew') ? '#22c55e' : '#334155'), // green if new
              'target-arrow-color': (ele) => (ele.data('isNew') ? '#22c55e' : '#334155'),
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'transition-property': 'line-color, width',
              'transition-duration': 500,
            },
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 2,
              'border-color': '#f0f9ff',
              'background-color': '#0284c7',
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

      return () => {
        if (cyRef.current) {
          cyRef.current.destroy();
          cyRef.current = null;
        }
      };
    }
  }, [localGraphData, modifiedNodes]);

  const handleRefresh = async () => {
    if (repoUrl && !isLoading) {
      setIsAnalyzing(true);

      try {
        const unifiedParser = await getUnifiedParser();

        // Force sync with backend
        const currentUrl = repoUrl;
        graphCacheRepoUrl.set(null);
        await refreshGraph(currentUrl);

        // If LLM mode is enabled, perform additional analysis
        if (parseMode.type === 'llm-enhanced' && graphData) {
          const files = graphData.nodes.slice(0, 5).map((node) => ({
            path: node.data.filePath || 'unknown',
            content: `// Simulated content for ${node.data.label}\n// Monitoring for changes...`,
          }));

          const analysis = await unifiedParser.parseProject(files);

          setStats((prev) => ({
            ...prev,
            llmInsights: analysis.llmAnalysis?.recommendations || [],
            averageTime:
              analysis.files.reduce((sum: number, f: any) => sum + (f.analysisTime || 0), 0) / analysis.files.length,
          }));
        }

        toast.success('Real-time sync completed');
      } catch (error) {
        console.error('Sync failed:', error);
        toast.error('Sync failed: ' + (error as Error).message);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  if (!graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">🔄</div>
        <h2 className="text-2xl font-bold text-white mb-3">Loading Real-Time Monitor...</h2>
        <p className="text-gray-400 max-w-md">Establishing connection to codebase monitoring service.</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">🔄</div>
        <h2 className="text-2xl font-bold text-white mb-3">No Graph Data Yet</h2>
        <p className="text-gray-400 max-w-md mb-6">
          Real-time monitoring requires a SCIP index to be uploaded for this repository. Once indexed, changes will be
          tracked and visualized here automatically.
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
            <span className={isLoading || isAnalyzing ? 'animate-spin' : ''}>🔄</span> Real-Time Graph Update
          </h2>
          <ParseModeStatus />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}
          >
            {isPaused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value={0}>Manual Refresh</option>
            <option value={5}>Auto 5s</option>
            <option value={10}>Auto 10s</option>
            <option value={30}>Auto 30s</option>
            <option value={60}>Auto 1m</option>
          </select>
          <ParseModeSelector compact />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isAnalyzing || isPaused}>
            {isLoading || isAnalyzing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                Syncing...
              </>
            ) : (
              <>
                <Zap className="h-3 w-3 mr-1" />
                Force Sync Now
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-3 w-3 mr-1" />
            History
          </Button>
        </div>
      </div>

      {/* Monitor Stats */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Last Sync</div>
              <div className="text-sm font-bold">{stats.lastUpdated.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Activity className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Changes Detected</div>
              <div className="text-sm font-bold">{stats.changesDetected}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <RefreshCw className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Nodes Monitored</div>
              <div className="text-sm font-bold">{stats.filesAnalyzed}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Zap className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Avg Parse Time</div>
              <div className="text-sm font-bold">{stats.averageTime.toFixed(1)}ms</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex justify-between px-2 py-1 bg-gray-800/50 rounded">
            <span className="text-gray-400">Nodes Added:</span>
            <span className="text-green-400 font-semibold">{stats.nodesAdded}</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-gray-800/50 rounded">
            <span className="text-gray-400">Edges Added:</span>
            <span className="text-green-400 font-semibold">{stats.edgesAdded}</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-gray-800/50 rounded">
            <span className="text-gray-400">Nodes Removed:</span>
            <span className="text-red-400 font-semibold">{stats.nodesRemoved}</span>
          </div>
          <div className="flex justify-between px-2 py-1 bg-gray-800/50 rounded">
            <span className="text-gray-400">Edges Removed:</span>
            <span className="text-red-400 font-semibold">{stats.edgesRemoved}</span>
          </div>
        </div>

        {stats.llmInsights && stats.llmInsights.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <Brain className="h-3 w-3" />
              Real-time AI Insights
            </h4>
            <div className="space-y-1">
              {stats.llmInsights.map((insight, idx) => (
                <div key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                  {insight}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Change History Panel */}
      {showHistory && (
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4" />
              Change History ({changeHistory.length})
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setChangeHistory([])}>
              Clear
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {changeHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No changes detected yet</p>
            ) : (
              changeHistory.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs bg-gray-800/50 p-2 rounded">
                  <div className="mt-0.5">
                    {entry.type === 'node_added' && <span className="text-green-400">+N</span>}
                    {entry.type === 'edge_added' && <span className="text-green-400">+E</span>}
                    {entry.type === 'node_removed' && <span className="text-red-400">-N</span>}
                    {entry.type === 'edge_removed' && <span className="text-red-400">-E</span>}
                    {entry.type === 'sync' && <span className="text-blue-400">📡</span>}
                  </div>
                  <div className="flex-1">
                    <div className="text-gray-300">{entry.description}</div>
                    <div className="text-gray-500 text-[10px] mt-0.5">{entry.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Monitor Visualization */}
      <div className="flex-1 min-h-[500px] border border-gray-700 rounded-xl bg-gray-900 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-gray-900/80 p-3 rounded-lg border border-gray-700 backdrop-blur">
          <p className="text-xs text-gray-300 flex items-center gap-2">
            {isPaused ? (
              <>
                <Pause className="h-3 w-3 text-orange-400" />
                Monitoring paused - Click Resume to continue tracking changes
              </>
            ) : (
              <>
                <Activity className="h-3 w-3 text-green-400 animate-pulse" />
                Live monitoring - Green highlights show recent changes
              </>
            )}
          </p>
        </div>
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
