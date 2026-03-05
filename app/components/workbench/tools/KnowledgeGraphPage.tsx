/**
 * KnowledgeGraphPage.tsx
 *
 * Enhanced Knowledge Graph Construction tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { graphCache } from '~/lib/stores/graphCacheStore';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { semanticFilter, getGraphStats } from '~/lib/graph/graphClient';
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
import {
  Brain,
  Zap,
  Info,
  RefreshCw,
  Download,
  Maximize,
  Box,
  Layout,
  Search,
  Filter,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'react-toastify';

// Dynamic imports for force graphs to avoid SSR issues
import { ForceGraph2D, ForceGraph3D, SpriteText } from '~/components/ui/ForceGraph.client';

interface Props {
  onBack: () => void;
}

interface AnalysisResult {
  nodes: any[];
  edges: any[];
  metadata: {
    totalFiles: number;
    languages: Record<string, number>;
    complexity: number;
    patterns: string[];
  };
  llmAnalysis?: LLMAnalysis;
  analysisTime?: number;
}

export function KnowledgeGraphPage({ onBack }: Props) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphData = useStore(graphCache);
  const parseMode = useStore(parseModeStore);

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLLMDetails, setShowLLMDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [granularity, setGranularity] = useState<'file' | 'symbol'>('file');
  const [originalASTGraph, setOriginalASTGraph] = useState<any>(null);
  const [symbolGraphData, setSymbolGraphData] = useState<any>(null);

  // New features
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [complexityFilter, setComplexityFilter] = useState<number>(0);
  const [showCycles, setShowCycles] = useState(false);
  const [graphStats, setGraphStats] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);

  // Load initial graph data into originalASTGraph when it first arrives
  useEffect(() => {
    if (graphData && !originalASTGraph && !isAnalyzing) {
      setOriginalASTGraph(JSON.parse(JSON.stringify(graphData)));
    }
  }, [graphData, originalASTGraph, isAnalyzing]);

  // Handle Granularity Change
  useEffect(() => {
    if (granularity === 'symbol' && !symbolGraphData && graphData) {
      generateSymbolGraph();
    }
  }, [granularity, graphData]);

  const generateSymbolGraph = async () => {
    setIsAnalyzing(true);

    try {
      const unifiedParser = await getUnifiedParser();

      // Set to parser-only for symbol generation to be fast and deterministic
      const originalMode = parseMode;

      /*
       * We don't change the global store, just the instance behavior if possible,
       * but here we just use the parser part of unifiedParser.
       */

      const filesMap = workbenchStore.files.get();
      const newNodes: any[] = [];
      const newEdges: any[] = [];

      // Copy existing file nodes
      graphData?.nodes.forEach((n) => {
        newNodes.push({ ...n, data: { ...n.data, type: 'file' } });
      });

      // Process each file to find symbols
      for (const node of graphData?.nodes || []) {
        const filePath = node.data.filePath;
        const dirent = filesMap[filePath];
        const language = node.data.language || 'javascript';

        if (dirent?.type === 'file') {
          const fileContent = dirent.content;

          try {
            // Force parser-only for AST extraction
            const parseResult = await unifiedParser.parseCode(fileContent, language);

            // Add Class nodes
            parseResult.metadata.classes.forEach((cls) => {
              const clsId = `${filePath}#${cls.name}`;
              newNodes.push({
                data: {
                  id: clsId,
                  label: cls.name,
                  type: 'class',
                  filePath,
                  language,
                  complexity: cls.methods.reduce((acc, m) => acc + m.complexity, 0),
                },
              });

              // Edge from File to Class
              newEdges.push({
                data: {
                  source: node.data.id,
                  target: clsId,
                  label: 'contains',
                  type: 'contains',
                },
              });
            });

            // Add Function nodes
            parseResult.metadata.functions.forEach((func) => {
              const funcId = `${filePath}#${func.name}`;
              newNodes.push({
                data: {
                  id: funcId,
                  label: func.name,
                  type: 'function',
                  filePath,
                  language,
                  complexity: func.complexity,
                },
              });

              // Edge from File to Function
              newEdges.push({
                data: {
                  source: node.data.id,
                  target: funcId,
                  label: 'contains',
                  type: 'contains',
                },
              });
            });
          } catch (e) {
            console.warn(`Failed to parse ${filePath}`, e);
          }
        }
      }

      // Add original edges (file dependencies)
      graphData?.edges.forEach((e) => {
        newEdges.push(e);
      });

      setSymbolGraphData({ nodes: newNodes, edges: newEdges });
    } catch (error) {
      console.error('Symbol graph generation failed:', error);
      toast.error('Failed to generate symbol graph');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Sync with parseMode and handle switching back
  useEffect(() => {
    if (parseMode.type === 'parser-only' && originalASTGraph) {
      /*
       * If we are in parser-only mode, we might want to revert to original graph
       * OR keep the symbol graph if granularity is symbol.
       * The requirement is "With AI" vs "Without AI".
       * "Without AI" + "Symbol" = TreeSitter AST Graph.
       * "With AI" + "Symbol" = TreeSitter AST Graph + LLM Annotations.
       */

      setAnalysisResult(null);
    }
  }, [parseMode.type, originalASTGraph]);

  useEffect(() => {
    console.log('GRAPH DATA:', graphData);
    console.log('NODES:', graphData?.nodes?.length);
    console.log('EDGES:', graphData?.edges?.length);
  }, [graphData]);

  // Format data for react-force-graph
  const forceGraphData = useMemo(() => {
    const data = granularity === 'symbol' && symbolGraphData ? symbolGraphData : graphData;

    if (!data) {
      return { nodes: [], links: [] };
    }

    // Create a map to ensure unique nodes by ID
    const nodeMap = new Map();
    data.nodes.forEach((n: any) => {
      // Normalize ID: trim whitespace
      const id = n.data.id.trim();

      let color = getLanguageColor(n.data.language);
      let val = ((n.data as any).complexity || 1) + 8;

      if (n.data.type === 'class') {
        color = '#F472B6'; // Pink for classes
        val = 6;
      } else if (n.data.type === 'function') {
        color = '#60A5FA'; // Blue for functions
        val = 4;
      }

      nodeMap.set(id, {
        id,
        name: n.data.label,
        val,
        color,
        language: n.data.language,
        filePath: n.data.filePath,
        type: n.data.type || 'file',
      });
    });

    const links = data.edges
      .map((e: any) => {
        let source = typeof e.data.source === 'string' ? e.data.source : (e.data.source as any).id;
        let target = typeof e.data.target === 'string' ? e.data.target : (e.data.target as any).id;

        // Normalize source/target
        source = source.trim();
        target = target.trim();

        return {
          source,
          target,
          label: (e.data as any).label || 'depends',
          strength: (e.data as any).strength || 1,
          type: (e.data as any).type,
        };
      })
      .filter((l: any) => {
        const hasSource = nodeMap.has(l.source);
        const hasTarget = nodeMap.has(l.target);

        if (!hasSource || !hasTarget) {
          // console.warn('Dropping invalid link:', l, { hasSource, hasTarget });
        }

        return hasSource && hasTarget;
      });

    console.log('FORCE GRAPH DATA:', {
      granularity,
      nodeCount: nodeMap.size,
      linkCount: links.length,
    });

    // Apply filters
    let filteredNodes = Array.from(nodeMap.values());
    let filteredLinks = links;

    // Semantic filter: only show nodes matching semantic search
    if (semanticResults.length > 0) {
      const semanticSet = new Set(semanticResults);
      filteredNodes = filteredNodes.filter((n) => semanticSet.has(n.id));
      filteredLinks = filteredLinks.filter((l: any) => semanticSet.has(l.source) && semanticSet.has(l.target));
    }

    // Complexity filter: hide nodes below threshold
    if (complexityFilter > 0) {
      const complexSet = new Set(
        filteredNodes.filter((n) => ((n as any).val || 0) >= complexityFilter).map((n) => n.id),
      );
      filteredNodes = filteredNodes.filter((n) => complexSet.has(n.id));
      filteredLinks = filteredLinks.filter((l: any) => complexSet.has(l.source) && complexSet.has(l.target));
    }

    // Cycles filter: highlight or hide cycle edges
    if (showCycles) {
      // Find cycle information from graphData if available
      const cycleEdges = data.edges?.filter((e: any) => e.data.cycle) || [];
      filteredLinks = filteredLinks.map((l: any) => {
        const isCycle = cycleEdges.some((e: any) => e.data.source === l.source && e.data.target === l.target);
        return {
          ...l,
          color: isCycle ? '#ef4444' : undefined, // Red for cycles
          width: isCycle ? 2 : 1,
        };
      });
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, symbolGraphData, granularity, semanticResults, complexityFilter, showCycles]);

  function getLanguageColor(lang: string = ''): string {
    const safeLang = lang || '';
    const colors: Record<string, string> = {
      java: '#F97316',
      python: '#10B981',
      javascript: '#F59E0B',
      typescript: '#3B82F6',
      go: '#00ADD8',
      rust: '#CE422B',
      cpp: '#004482',
      c: '#A8B9CC',
      html: '#E34C26',
      css: '#1572B6',
      json: '#000000',
      yaml: '#CB171E',
      markdown: '#083FA1',
    };

    return colors[safeLang.toLowerCase()] || '#3B82F6';
  }

  // Automatic fitting and centering
  useEffect(() => {
    if (graphRef.current) {
      // Apply custom forces if the library supports it via d3Force
      if (typeof (graphRef.current as any).d3Force === 'function') {
        (graphRef.current as any)
          .d3Force('link')
          ?.distance((link: any) => (viewMode === '2d' ? 100 : 150) / (link.strength || 1));
      }

      // Zoom to fit after data changes
      setTimeout(() => {
        if (viewMode === '2d' && graphRef.current?.zoomToFit) {
          graphRef.current.zoomToFit(400, 100);
        }
      }, 500);
    }
  }, [forceGraphData, viewMode]);

  const performEnhancedAnalysis = async () => {
    if (!graphData || !graphData.nodes.length) {
      toast.warning('No graph data available for analysis');
      return;
    }

    setIsAnalyzing(true);

    try {
      // Save current AST graph as original if not already saved
      if (!originalASTGraph) {
        setOriginalASTGraph(JSON.parse(JSON.stringify(graphData)));
      }

      // Get the unified parser
      const unifiedParser = await getUnifiedParser();

      // Sync the mode with the current store value
      unifiedParser.setMode(parseMode);

      // Get real content from workbench store
      const filesMap = workbenchStore.files.get();

      const files = graphData.nodes.map((node) => {
        const language = node.data.language || 'javascript';
        const fileName = node.data.label || 'unknown';
        const filePath = node.data.filePath || `${fileName}.${language}`;

        // Try to get content from workbench store
        const workbenchFile = filesMap[filePath];
        const content =
          (workbenchFile?.type === 'file' ? (workbenchFile as any).content : null) ||
          `// Content for ${fileName}\n// Path: ${filePath}`;

        return {
          path: filePath,
          content,
        };
      });

      // Perform unified analysis
      const projectAnalysis = await unifiedParser.parseProject(files);

      // Attach content back to analysis results for local reference checking
      projectAnalysis.files.forEach((f) => {
        const originalFile = files.find((input) => input.path === f.filePath);

        if (originalFile) {
          (f as any).content = originalFile.content;
        }
      });

      // ─── Build graph from AI analysis ──────────────────────────────────────────

      let newNodes: any[] = [];
      let newEdges: any[] = [];

      if (projectAnalysis.llmAnalysis?.graph && projectAnalysis.llmAnalysis.graph.edges.length > 0) {
        // Use AI-generated graph data
        newNodes = projectAnalysis.llmAnalysis.graph.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            filePath: node.id,
            language: node.id.split('.').pop() || 'unknown',
          },
        }));

        newEdges = projectAnalysis.llmAnalysis.graph.edges.map((edge, idx) => ({
          data: {
            id: `ai-edge-${idx}`,
            source: edge.source,
            target: edge.target,
            label: edge.type,
            strength: edge.strength || 1,
          },
        }));

        console.log('Using AI-generated graph with edges:', newEdges.length);
      } else {
        // Fallback to basic AST-based graph if AI didn't provide graph data OR returned no edges
        console.log('AI returned no edges, falling back to AST-based graph construction');

        newNodes = projectAnalysis.files.map((file) => ({
          data: {
            id: file.filePath,
            label: file.filePath.split('/').pop() || 'unknown',
            filePath: file.filePath,
            language: file.language,
            complexity: file.metadata.complexity,
            linesOfCode: file.metadata.linesOfCode,
          },
        }));

        projectAnalysis.files.forEach((file) => {
          file.metadata.imports.forEach((imp) => {
            const target = projectAnalysis.files.find((f) => {
              // Normalize file paths for comparison
              const normalizedFilePath = f.filePath.replace(/\\/g, '/');
              const normalizedImport = imp.module.replace(/\./g, '/');

              // Check if import matches file path (e.g. com/example/User matches src/main/java/com/example/User.java)
              return (
                normalizedFilePath.includes(normalizedImport) ||
                (f.language === 'java' && normalizedFilePath.endsWith(`/${imp.symbols[0]}.java`))
              );
            });

            if (target) {
              newEdges.push({
                data: {
                  id: `${file.filePath}-${target.filePath}`,
                  source: file.filePath,
                  target: target.filePath,
                  type: 'import',
                  label: imp.symbols.join(', ') || 'imports',
                },
              });
            }
          });
        });
      }

      // 3. Fallback: Check for same-package dependencies or relative file siblings
      if (projectAnalysis) {
        projectAnalysis.files.forEach((file) => {
          // Check for package-based linking (Java, Go, Kotlin, PHP, C/C++)
          if (['java', 'go', 'kotlin', 'php', 'c', 'cpp'].includes(file.language) && file.metadata.packageName) {
            // Find other files in the same package
            const samePackageFiles = projectAnalysis.files.filter(
              (f) =>
                f.filePath !== file.filePath &&
                f.language === file.language &&
                f.metadata.packageName === file.metadata.packageName,
            );

            // Read file content to check for references
            const fileContent = (file as any).content || '';

            samePackageFiles.forEach((sibling) => {
              // Extract potential class/struct/func name from file path
              const siblingName = sibling.filePath.split('/').pop()?.split('.')[0];

              if (siblingName) {
                /*
                 * Check for various forms of usage:
                 * 1. Instantiation: new BaseEntity()
                 * 2. Declaration: BaseEntity entity;
                 * 3. Inheritance: extends BaseEntity
                 * 4. Implementation: implements BaseEntity
                 * 5. Generic: List<BaseEntity>
                 * 6. Static access: BaseEntity.someMethod()
                 */

                const usageRegex = new RegExp(`\\b${siblingName}\\b`);

                if (usageRegex.test(fileContent)) {
                  // Avoid duplicates
                  const edgeId = `${file.filePath}-${sibling.filePath}`;

                  if (!newEdges.some((e) => e.data.id === edgeId)) {
                    console.log(
                      `Adding implicit package edge: ${file.filePath} -> ${sibling.filePath} (${siblingName})`,
                    );
                    newEdges.push({
                      data: {
                        id: edgeId,
                        source: file.filePath,
                        target: sibling.filePath,
                        type: 'package_reference',
                        label: 'uses',
                        strength: 2,
                      },
                    });
                  }
                }
              }
            });
          }

          // Check for Python same-directory implicit module access (rare but possible in some patterns)
          if (file.language === 'python') {
            const dir = file.filePath.substring(0, file.filePath.lastIndexOf('/'));
            const sameDirFiles = projectAnalysis.files.filter(
              (f) =>
                f.filePath !== file.filePath &&
                f.language === 'python' &&
                f.filePath.startsWith(dir) &&
                f.filePath.split('/').length === file.filePath.split('/').length,
            );

            const fileContent = (file as any).content || '';

            sameDirFiles.forEach((sibling) => {
              const moduleName = sibling.filePath.split('/').pop()?.replace('.py', '');

              if (moduleName && fileContent.includes(moduleName)) {
                const edgeId = `${file.filePath}-${sibling.filePath}`;

                if (!newEdges.some((e) => e.data.id === edgeId)) {
                  newEdges.push({
                    data: {
                      id: edgeId,
                      source: file.filePath,
                      target: sibling.filePath,
                      type: 'module_reference',
                      label: 'uses',
                      strength: 1,
                    },
                  });
                }
              }
            });
          }
        });
      }

      // Update the graph cache with the new, AI-verified data
      graphCache.set({
        nodes: newNodes,
        edges: newEdges,
        cycles: [],
        isFallback: false,
      });

      const result: AnalysisResult = {
        nodes: newNodes,
        edges: newEdges,
        metadata: {
          totalFiles: projectAnalysis.projectMetadata.totalFiles,
          languages: projectAnalysis.projectMetadata.languages as Record<string, number>,
          complexity: projectAnalysis.projectMetadata.complexity.average,
          patterns: projectAnalysis.llmAnalysis?.patterns?.map((p: any) => p.name) || [],
        },
        llmAnalysis: projectAnalysis.llmAnalysis,
        analysisTime: projectAnalysis.files.reduce((sum: number, file: any) => sum + (file.analysisTime || 0), 0),
      };

      setAnalysisResult(result);
      toast.success('Enhanced analysis completed');
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Analysis failed: ' + (error as Error).message);
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
    a.download = `knowledge-graph-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Analysis exported successfully');
  };

  const handleSemanticSearch = async () => {
    if (!semanticQuery.trim()) {
      setSemanticResults([]);
      return;
    }

    const recentRepos = (repositoryHistoryStore as any).getRecentRepositories?.(1);
    if (!recentRepos || recentRepos.length === 0) {
      toast.warning('No repository context available');
      return;
    }

    const repoUrl = recentRepos[0].url;
    setIsSearching(true);

    try {
      const result = await semanticFilter(repoUrl, semanticQuery, 20);
      setSemanticResults(result.matchingNodes);

      if (result.error) {
        toast.warning(`Semantic search: ${result.error}`);
      } else {
        toast.success(`Found ${result.totalMatches} semantic matches`);
      }
    } catch (error) {
      console.error('Semantic search failed:', error);
      toast.error('Semantic search failed');
      setSemanticResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadGraphStats = async () => {
    const recentRepos = (repositoryHistoryStore as any).getRecentRepositories?.(1);
    if (!recentRepos || recentRepos.length === 0) return;

    const repoUrl = recentRepos[0].url;

    try {
      const stats = await getGraphStats(repoUrl);
      setGraphStats(stats);
      setShowStats(true);
    } catch (error) {
      console.error('Stats loading failed:', error);
      toast.error('Failed to load graph statistics');
    }
  };

  if (!graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">🧠</div>
        <h2 className="text-2xl font-bold text-white mb-3">Loading Knowledge Graph...</h2>
        <p className="text-gray-400 max-w-md">The knowledge graph is being constructed from your codebase analysis.</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-6xl mb-6">🧠</div>
        <h2 className="text-2xl font-bold text-white mb-3">No Graph Data Yet</h2>
        <p className="text-gray-400 max-w-md mb-6">
          The knowledge graph requires a SCIP index to be uploaded for this repository. Once indexed, this page will
          display all file nodes and their dependency relationships.
        </p>
        <div className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-lg p-4 max-w-md">
          <strong>How to populate:</strong> Upload a SCIP index via the <code>/api/scip/upload</code> endpoint for this
          repository, then refresh the graph.
        </div>
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
            <span>🧠</span> Knowledge Graph Construction
          </h2>
          <ParseModeStatus />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 mr-2">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === '2d' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layout className="w-3 h-3" />
              2D
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Box className="w-3 h-3" />
              3D
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (graphRef.current) {
                if (viewMode === '2d') {
                  graphRef.current.zoomToFit(400, 100);
                } else {
                  graphRef.current.zoomToFit(400);
                }
              }
            }}
            title="Fit Graph to View"
          >
            <Maximize className="h-3 w-3 mr-1" />
            Fit View
          </Button>
          <Button variant="outline" size="sm" onClick={exportAnalysis} disabled={!analysisResult}>
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadGraphStats}>
            <BarChart3 className="h-3 w-3 mr-1" />
            Stats
          </Button>
        </div>
      </div>

      {/* Semantic Search & Filters */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Semantic Search */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Semantic Code Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                onKey
                Press={(e) => e.key === 'Enter' && handleSemanticSearch()}
                placeholder="e.g., authentication logic..."
                className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <Button variant="outline" size="sm" onClick={handleSemanticSearch} disabled={isSearching}>
                {isSearching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              </Button>
            </div>
            {semanticResults.length > 0 && (
              <div className="text-xs text-emerald-400 mt-1">{semanticResults.length} nodes match semantic query</div>
            )}
          </div>

          {/* Complexity Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block flex items-center justify-between">
              <span>Complexity Filter</span>
              <span className="text-white font-mono">{complexityFilter}</span>
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={complexityFilter}
              onChange={(e) => setComplexityFilter(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>All</span>
              <span>High</span>
            </div>
          </div>

          {/* Cycles Toggle */}
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => setShowCycles(!showCycles)} className="w-full">
              {showCycles ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {showCycles ? 'Hide' : 'Show'} Cycles
            </Button>
          </div>
        </div>
      </Card>

      {/* Graph Stats Panel */}
      {showStats && graphStats && (
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Graph Statistics
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setShowStats(false)}>
              Hide
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-400">Nodes</div>
              <div className="text-xl font-bold">{graphStats.totalNodes}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Edges</div>
              <div className="text-xl font-bold">{graphStats.totalEdges}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Avg Complexity</div>
              <div className="text-xl font-bold">{graphStats.avgComplexity.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Languages</div>
              <div className="text-sm">
                {Object.entries(graphStats.languages).map(([lang, count]: [string, any]) => (
                  <Badge key={lang} variant="outline" className="mr-1 mb-1 text-[10px]">
                    {lang}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          {graphStats.hubs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Most Connected Nodes (Hubs)</div>
              <div className="space-y-1">
                {graphStats.hubs.slice(0, 5).map((hub: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-gray-800/50 px-3 py-1.5 rounded"
                  >
                    <span className="text-white truncate flex-1">{hub.filePath}</span>
                    <Badge variant="outline" size="sm" className="ml-2">
                      {hub.complexity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Analysis Summary */}
      {analysisResult && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400">Total Files</div>
              <div className="text-xl font-bold">{analysisResult.metadata.totalFiles}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Languages</div>
              <div className="text-sm">
                {Object.entries(analysisResult.metadata.languages).map(([lang, count]) => (
                  <Badge key={lang} variant="outline" className="mr-1 mb-1">
                    {lang}: {count}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Avg Complexity</div>
              <div className="text-xl font-bold">{analysisResult.metadata.complexity.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Analysis Time</div>
              <div className="text-xl font-bold">{analysisResult.analysisTime}ms</div>
            </div>
          </div>

          {analysisResult.llmAnalysis && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Analysis
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setShowLLMDetails(!showLLMDetails)}>
                  {showLLMDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              {showLLMDetails && (
                <div className="space-y-3 text-sm">
                  <div>
                    <strong>Summary:</strong> {analysisResult.llmAnalysis.summary}
                  </div>
                  <div>
                    <strong>Architecture:</strong> {analysisResult.llmAnalysis.architecture.type}
                  </div>
                  {analysisResult.llmAnalysis.patterns.length > 0 && (
                    <div>
                      <strong>Patterns:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysisResult.llmAnalysis.patterns.map((pattern, idx) => (
                          <Badge key={idx} variant="outline" size="sm">
                            {pattern.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisResult.llmAnalysis.recommendations.length > 0 && (
                    <div>
                      <strong>Recommendations:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {analysisResult.llmAnalysis.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                      <div className="text-xs text-gray-400">Complexity Score</div>
                      <div className="text-lg font-bold">{analysisResult.llmAnalysis.complexity.score.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Quality Score</div>
                      <div className="text-lg font-bold">{analysisResult.llmAnalysis.quality.score.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Issues</div>
                      <div className="text-lg font-bold">{analysisResult.llmAnalysis.quality.issues.length}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Graph Visualization */}
      <div className="flex-1 min-h-0 border border-gray-700 rounded-xl bg-gray-950 overflow-hidden relative group">
        <div className="absolute top-4 left-4 z-10 bg-gray-900/80 p-3 rounded-lg border border-gray-700 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="text-xs text-gray-400">
            Nodes: {forceGraphData.nodes.length} | Edges: {forceGraphData.links.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Mode: {parseMode.type === 'parser-only' ? 'Parser Only' : 'LLM Enhanced'}
            {parseMode.model && ` (${parseMode.model})`}
          </div>
        </div>

        <div className="w-full h-full min-h-[600px]">
          <ClientOnly>
            {() =>
              viewMode === '3d' ? (
                <ForceGraph3D
                  ref={graphRef}
                  graphData={forceGraphData}
                  nodeLabel="name"
                  nodeColor="color"
                  nodeThreeObject={(node: any) => {
                    const sprite = new SpriteText(node.name);
                    sprite.color = node.color;
                    sprite.textHeight = 8;

                    return sprite;
                  }}
                  nodeThreeObjectExtend={true}
                  linkDirectionalArrowLength={3.5}
                  linkDirectionalArrowRelPos={1}
                  linkCurvature={0.25}
                  backgroundColor="#020617"
                  linkColor={() => '#475569'}
                  linkLabel="label"
                />
              ) : (
                <ForceGraph2D
                  ref={graphRef}
                  graphData={forceGraphData}
                  nodeLabel="name"
                  nodeColor="color"
                  nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const label = node.name;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;

                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2);

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
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

                    node.__bckgDimensions = bckgDimensions;
                  }}
                  nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    ctx.fillStyle = color;

                    const bckgDimensions = node.__bckgDimensions;
                    bckgDimensions &&
                      ctx.fillRect(
                        node.x - bckgDimensions[0] / 2,
                        node.y - bckgDimensions[1] / 2,
                        bckgDimensions[0],
                        bckgDimensions[1],
                      );
                  }}
                  linkWidth={(link: any) => (link.strength || 1) * 0.5}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleSpeed={0.005}
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  linkCurvature={0.25}
                  backgroundColor="#020617"
                  linkColor={() => '#334155'}
                  linkLabel="label"
                />
              )
            }
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
