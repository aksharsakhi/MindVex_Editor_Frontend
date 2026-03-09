/**
 * ArchitecturePage.tsx
 *
 * Enhanced Architecture / Dependency Graph tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { graphCache } from '~/lib/stores/graphCacheStore';
import {
  getUnifiedParser,
  parseModeStore,
  ParseModeSelector,
  ParseModeStatus,
  setParserOnlyMode,
  type LLMAnalysis,
} from '~/lib/unifiedParser';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Brain, RefreshCw, Download, Layers, Box, RotateCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { ForceGraph2D, ForceGraph3D, SpriteText } from '~/components/ui/ForceGraph.client';
import { ArchitectureDiagram } from './ArchitectureDiagram';

// @ts-ignore - three types not installed
import * as THREE from 'three';

interface Props {
  onBack: () => void;
}

interface AnalysisResult {
  metadata: {
    totalFiles: number;
    totalDirectories: number;
    languages: Record<string, number>;
    architectureType: string;
    patterns: string[];
  };
  llmAnalysis?: LLMAnalysis;
  analysisTime?: number;
}

export function ArchitecturePage({ onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();
  const graphData = useStore(graphCache);
  const parseMode = useStore(parseModeStore);

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLLMDetails, setShowLLMDetails] = useState(false);
  const [aiGraphData, setAiGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);
  const [showAiGraph, setShowAiGraph] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'dag' | 'diagram'>('diagram');

  // Layer Colors (Shared with ArchitectureDiagram)
  const layerColors: Record<string, string> = {
    frontend: '#3B82F6', // Blue
    backend: '#10B981', // Emerald
    data: '#F59E0B', // Amber
    external: '#8B5CF6', // Violet
    infrastructure: '#64748B', // Slate
    controller: '#EC4899', // Pink
    service: '#10B981', // Emerald
    repository: '#F59E0B', // Amber
    model: '#6366F1', // Indigo
    util: '#94A3B8', // Slate
    entry: '#EF4444', // Red
    interface: '#8B5CF6', // Violet
  };

  // Helper to detect layer from file path/name
  const detectLayer = (name: string, path: string) => {
    const n = name.toLowerCase();
    const p = path.toLowerCase();

    if (n.includes('application') || n.includes('main')) {
      return 'entry';
    }

    if (n.includes('controller') || p.includes('/controller')) {
      return 'controller';
    }

    if (n.includes('service') || p.includes('/service')) {
      return 'service';
    }

    if (n.includes('repository') || p.includes('/repository')) {
      return 'repository';
    }

    if (n.includes('model') || n.includes('entity') || n.includes('dto') || p.includes('/model')) {
      return 'model';
    }

    if (p.includes('/interface')) {
      return 'interface';
    }

    return 'util';
  };

  // Format data for react-force-graph
  const forceGraphData = useMemo(() => {
    // Determine source data
    const sourceData = showAiGraph && aiGraphData ? aiGraphData : null;

    // Use AI Graph Data (Architecture Diagram Mode)
    if (sourceData) {
      // Create mutable copy of nodes
      let nodes = sourceData.nodes.map((n) => ({
        ...n,
        color: layerColors[n.layer] || n.color || '#F472B6',
        val: n.type === 'database' ? 15 : n.type === 'service' ? 12 : 8,
      }));

      // SVG Diagram Mode handles its own layout, but we clean up for 2D/3D
      if (viewMode !== 'diagram') {
        nodes = nodes.map((n) => {
          const { fx, fy, ...rest } = n;
          return rest;
        });
      }

      // Shallow copy links
      return { nodes, links: sourceData.links.map((l) => ({ ...l })) };
    }

    // Fallback to original graphData (File Dependency Graph) - Now Enhanced!
    if (graphData) {
      const nodes: any[] = [];
      const links: any[] = [];
      const nodeMap = new Map();
      const directoryMap: Record<string, any[]> = {};

      // Add file nodes with Layer Coloring
      graphData.nodes.forEach((n) => {
        const layer = detectLayer(n.data.label, n.data.filePath || '');
        const color = layerColors[layer] || '#10B981';

        const node = {
          id: n.data.id,
          name: n.data.label,
          val: layer === 'entry' ? 10 : layer === 'controller' ? 8 : 5,
          color,
          type: 'file',
          filePath: n.data.filePath,
          layer, // Store layer for filtering/logic
        };
        nodeMap.set(n.data.id, node);
        nodes.push(node);

        // Group by directory
        const dirName = n.data.filePath ? n.data.filePath.split('/')[0] : 'root';

        if (!directoryMap[dirName]) {
          directoryMap[dirName] = [];
        }

        directoryMap[dirName].push(node);
      });

      // Add directory nodes (infer from paths)
      const dirs = new Set<string>();
      graphData.nodes.forEach((n) => {
        const filePath = n.data.filePath || '';
        const pathParts = filePath.split(/[/\\]/);

        if (pathParts.length > 1) {
          const dirPath = pathParts.slice(0, -1).join('/');

          if (!dirs.has(dirPath)) {
            dirs.add(dirPath);

            const dirId = `dir_${dirPath}`;
            const dirNode = {
              id: dirId,
              name: dirPath,
              val: 10,
              color: '#3B82F6', // Blue-500
              type: 'directory',
            };
            nodeMap.set(dirId, dirNode);

            /*
             * Only add directory nodes in non-Diagram modes if we want hierarchy
             * But user said "old implementation" was bad. Maybe we skip directories in 2D/3D too?
             * Let's keep them but make them less obtrusive or distinct.
             */
            nodes.push(dirNode);
          }

          // Link file to dir
          const dirId = `dir_${pathParts.slice(0, -1).join('/')}`;
          links.push({
            source: dirId,
            target: n.data.id,
            color: '#1E293B', // Very dark slate for hierarchy links
            width: 0.5,
            particles: 0,
          });
        }
      });

      // Add dependency edges
      graphData.edges.forEach((e) => {
        const source = typeof e.data.source === 'string' ? e.data.source : (e.data.source as any).id;
        const target = typeof e.data.target === 'string' ? e.data.target : (e.data.target as any).id;

        const sourceNode = nodeMap.get(source);
        const targetNode = nodeMap.get(target);

        if (sourceNode && targetNode) {
          // If in Diagram Mode, filter out directory nodes
          if (viewMode === 'diagram') {
            if (sourceNode.type !== 'directory' && targetNode.type !== 'directory') {
              links.push({
                source,
                target,
                color: '#94A3B8',
                width: 1.5,
                curvature: 0.2,
              });
            }
          } else {
            // In 2D/3D Mode, keep all edges but make dependency edges distinct
            links.push({
              source,
              target,
              color: '#60A5FA', // Blue-400
              width: 1.5,
              particles: 2,
              curvature: 0.2,
            });
          }
        }
      });

      /*
       * Filter nodes to remove directories from final render in Diagram Mode
       * In 2D/3D, we also filter out directories if we want a cleaner "Architecture" view
       * Let's filter directories out for 2D/3D to make it cleaner like the user wants
       */
      const finalNodes = nodes.filter((n) => n.type !== 'directory');

      // If filtering directories, we must also filter links that connect to them
      const nodeIds = new Set(finalNodes.map((n) => n.id));
      const finalLinks = links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

      return {
        nodes: finalNodes,
        links: finalLinks,
      };
    }

    return { nodes: [], links: [] };
  }, [graphData, aiGraphData, showAiGraph, viewMode]);

  // Adjust forces for better spreading when viewMode changes
  useEffect(() => {
    if (fgRef.current && (viewMode === '2d' || viewMode === '3d')) {
      // Safely access d3Force if available
      if (typeof fgRef.current.d3Force === 'function') {
        try {
          // Increase repulsion (Charge) - default is usually -30
          fgRef.current.d3Force('charge').strength(-500);

          // Increase Link Distance - default is usually 30
          fgRef.current.d3Force('link').distance(100);
        } catch (e) {
          console.warn('Failed to configure forces', e);
        }
      }

      // Re-heat simulation to apply new forces, but safely
      if (typeof fgRef.current.d3Alpha === 'function') {
        try {
          fgRef.current.d3Alpha(1);

          /*
           * Only call restart if it exists on the return value (it usually doesn't on the component ref)
           * If d3Alpha returns the simulation, it might work, but safer to just set alpha.
           * In react-force-graph, setting alpha usually triggers restart internally if needed.
           */
        } catch (e) {
          console.warn('Failed to set alpha', e);
        }
      }
    }
  }, [viewMode, forceGraphData]);

  const performEnhancedAnalysis = async () => {
    if (!graphData || !graphData.nodes.length) {
      toast.warning('No graph data available for architecture analysis');
      return;
    }

    setIsAnalyzing(true);

    try {
      const unifiedParser = await getUnifiedParser();
      const { webcontainer } = await import('~/lib/webcontainer');
      const container = await webcontainer;

      // Read real code from WebContainer for each file
      const files = await Promise.all(
        graphData.nodes.map(async (node) => {
          const language = node.data.language || 'javascript';
          const filePath = node.data.filePath || `${node.data.label}.${language}`;

          let content = '';

          try {
            content = (await container.fs.readFile(filePath, 'utf-8')) as string;
          } catch (e) {
            // File not found or unreadable — use empty placeholder
            content = `// Unable to read ${filePath}`;
          }

          return {
            path: filePath,
            content,
          };
        }),
      );

      console.log(
        'Sending files to parser',
        files.map((f) => ({ path: f.path, len: f.content.length })),
      );

      // Check if AI is enabled
      const currentMode = parseMode;
      const useAI = currentMode.type === 'llm-enhanced';

      if (!useAI) {
        toast.info(`Analyzing ${files.length} files with parser-only mode`);
      } else {
        toast.info(`Analyzing ${files.length} files with AI enhancement (${currentMode.model})`);
      }

      const projectAnalysis = await unifiedParser.parseProject(files);

      const dirs = new Set<string>();
      graphData.nodes.forEach((n) => {
        const filePath = n.data.filePath || '';
        const pathParts = filePath.split(/[/\\]/);

        if (pathParts.length > 1) {
          dirs.add(pathParts.slice(0, -1).join('/'));
        }
      });

      const result: AnalysisResult = {
        metadata: {
          totalFiles: projectAnalysis.projectMetadata.totalFiles,
          totalDirectories: dirs.size,
          languages: projectAnalysis.projectMetadata.languages as Record<string, number>,
          architectureType: projectAnalysis.llmAnalysis?.architecture.type || 'Mixed',
          patterns: projectAnalysis.llmAnalysis?.architecture.patterns || [],
        },
        llmAnalysis: projectAnalysis.llmAnalysis,
        analysisTime: projectAnalysis.files.reduce((sum: number, file: any) => sum + (file.analysisTime || 0), 0),
      };

      setAnalysisResult(result);

      // handle possible AI-generated graph overlay
      const graphReturned = projectAnalysis.llmAnalysis?.graph && projectAnalysis.llmAnalysis.graph.nodes.length > 0;

      if (useAI && graphReturned && projectAnalysis.llmAnalysis?.graph) {
        const aiNodes = projectAnalysis.llmAnalysis.graph.nodes.map((n) => ({
          id: n.id,
          name: n.label,
          val: 8,
          color: n.type === 'module' ? '#F472B6' : '#60A5FA', // Pink or Blue
          type: n.type,
        }));

        const aiLinks = projectAnalysis.llmAnalysis.graph.edges.map((e) => ({
          source: e.source,
          target: e.target,
          color: '#A78BFA', // Purple
          width: Math.max(1, e.strength || 1),
          label: e.type,
        }));

        setAiGraphData({ nodes: aiNodes, links: aiLinks });
        setShowAiGraph(true);
        toast.success('AI-enhanced architecture graph is now displayed');
      } else {
        // clear previous overlay if any
        if (showAiGraph) {
          setAiGraphData(null);
          setShowAiGraph(false);
        }

        if (useAI && !graphReturned) {
          // revert to parser-only mode so UI status matches result
          setParserOnlyMode();
          toast.warning('AI mode enabled but no graph was generated; check your API key or try again');
        }

        toast.success(
          useAI
            ? 'Architecture analysis completed (no AI graph returned)'
            : 'Architecture analysis completed (parser-only)',
        );
      }
    } catch (error) {
      console.error('Architecture analysis failed:', error);
      toast.error('Architecture analysis failed: ' + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportAnalysis = () => {
    if (!analysisResult) {
      toast.warning('No analysis results to export');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      mode: parseMode.type,
      model: parseMode.model,
      analysis: analysisResult,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Architecture analysis exported successfully');
  };

  if (!graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">📊</div>
        <h2 className="text-2xl font-bold text-white mb-3">Loading Architecture Data...</h2>
        <p className="text-gray-400 max-w-md">Analyzing project structure and module dependencies.</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">📊</div>
        <h2 className="text-2xl font-bold text-white mb-3">No Architecture Data Yet</h2>
        <p className="text-gray-400 max-w-md mb-6">
          The architecture graph requires a SCIP index to be uploaded for this repository. Once indexed, this page will
          display module-level architecture and dependency structure.
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
            <span>📊</span> Architecture / Dependency Graph
          </h2>
          <ParseModeStatus />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 mr-2">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === '2d'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Layers className="w-3 h-3" />
              2D
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === '3d'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Box className="w-3 h-3" />
              3D
            </button>
            <button
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'diagram'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title="Architecture Diagram View"
            >
              <RotateCw className="w-3 h-3" />
              Diagram
            </button>
          </div>

          <ParseModeSelector compact />
          <Button variant="outline" size="sm" onClick={performEnhancedAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-3 w-3 mr-1" />
                Analyze
              </>
            )}
          </Button>
          {aiGraphData && (
            <Button variant="ghost" size="sm" onClick={() => setShowAiGraph(!showAiGraph)}>
              {showAiGraph ? 'Show Dependency Graph' : 'Show AI Graph'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportAnalysis} disabled={!analysisResult}>
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      {analysisResult && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400">Total Files</div>
              <div className="text-xl font-bold">{analysisResult.metadata.totalFiles}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Directories</div>
              <div className="text-xl font-bold">{analysisResult.metadata.totalDirectories}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Architecture</div>
              <div className="text-xl font-bold">{analysisResult.metadata.architectureType}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Analysis Time</div>
              <div className="text-xl font-bold">{(analysisResult.analysisTime || 0).toFixed(0)}ms</div>
            </div>
          </div>

          {analysisResult.llmAnalysis && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-purple-400">
                  <Brain className="h-4 w-4" />
                  AI Architectural Insights
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setShowLLMDetails(!showLLMDetails)}>
                  {showLLMDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              {showLLMDetails && (
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <strong className="text-gray-200">Summary:</strong> {analysisResult.llmAnalysis.summary}
                  </div>
                  {analysisResult.llmAnalysis.architecture.patterns.length > 0 && (
                    <div>
                      <strong className="text-gray-200">Patterns:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysisResult.llmAnalysis.architecture.patterns.map((pattern, idx) => (
                          <Badge key={idx} variant="outline" size="sm" className="border-purple-500/30 text-purple-300">
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisResult.llmAnalysis.architecture.issues.length > 0 && (
                    <div>
                      <strong className="text-gray-200">Issues:</strong>
                      <ul className="list-disc list-inside pl-1 mt-1 text-red-300">
                        {analysisResult.llmAnalysis.architecture.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Graph Visualization */}
      <div
        className="flex-1 bg-[#050505] rounded-lg border border-gray-800 overflow-hidden relative"
        ref={containerRef}
      >
        {viewMode === 'diagram' ? (
          <ArchitectureDiagram nodes={forceGraphData.nodes} links={forceGraphData.links} showAiGraph={showAiGraph} />
        ) : viewMode === '3d' ? (
          <ForceGraph3D
            ref={fgRef}
            graphData={forceGraphData}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            linkColor="color"
            linkWidth="width"
            backgroundColor="#050505"
            linkOpacity={0.6}
            nodeResolution={16}
            linkDirectionalParticles="particles"
            linkDirectionalParticleSpeed={0.005}
            d3AlphaDecay={0.1}
            d3VelocityDecay={0.4}
            warmupTicks={200}
            cooldownTicks={0}
            nodeRelSize={8}
            onEngineStop={() => {
              // Lock all nodes after initial layout
              if (forceGraphData && forceGraphData.nodes) {
                forceGraphData.nodes.forEach((node: any) => {
                  node.fx = node.x;
                  node.fy = node.y;

                  if (node.z !== undefined) {
                    node.fz = node.z;
                  }
                });
              }
            }}
            nodeThreeObject={(node: any) => {
              if (!node) {
                return new THREE.Object3D();
              }

              try {
                const sprite = new SpriteText(node.name || 'Node');
                sprite.color = node.color || '#fff';
                sprite.textHeight = 4 + (node.val || 5) / 2;

                return sprite;
              } catch (e) {
                console.error('Error creating sprite for node:', node, e);
                return new THREE.Object3D();
              }
            }}
            nodeThreeObjectExtend={true}
          />
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={forceGraphData}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="val"
            linkColor="color"
            linkWidth="width"
            backgroundColor="#050505"
            linkDirectionalParticles="particles"
            linkDirectionalParticleSpeed={0.005}
            d3AlphaDecay={0.1}
            d3VelocityDecay={0.4}
            warmupTicks={200}
            cooldownTicks={0}
            nodeRelSize={8}
            onEngineStop={() => {
              // Lock all nodes after initial layout
              if (forceGraphData && forceGraphData.nodes) {
                forceGraphData.nodes.forEach((node: any) => {
                  node.fx = node.x;
                  node.fy = node.y;
                });
              }
            }}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              // Ensure node coordinates are finite
              if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
                return;
              }

              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;

              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2);

              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.fillRect(
                node.x - bckgDimensions[0] / 2,
                node.y - bckgDimensions[1] / 2,
                bckgDimensions[0],
                bckgDimensions[1],
              );

              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.color;
              ctx.fillText(label, node.x, node.y);

              node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
            }}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
                return;
              }

              ctx.fillStyle = color;

              const bckgDimensions = node.__bckgDimensions;

              if (bckgDimensions) {
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y - bckgDimensions[1] / 2,
                  bckgDimensions[0],
                  bckgDimensions[1],
                );
              }
            }}
          />
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur p-3 rounded-lg border border-gray-800 text-xs z-10">
          <div className="font-semibold mb-2 text-white">Legend</div>
          {!showAiGraph ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="text-gray-300">File</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <span className="text-gray-300">Directory</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-blue-400/50"></div>
                <span className="text-gray-300">Dependency</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                <span className="text-gray-300">Frontend / UI</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                <span className="text-gray-300">Backend / Logic</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                <span className="text-gray-300">Data / Storage</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]"></div>
                <span className="text-gray-300">External / API</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.6)]"></div>
                <span className="text-gray-300">Infrastructure</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
