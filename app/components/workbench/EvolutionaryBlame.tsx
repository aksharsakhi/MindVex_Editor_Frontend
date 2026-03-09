/**
 * EvolutionaryBlame.tsx
 *
 * Enhanced Evolutionary Blame tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import {
  getBlame,
  type BlameLine,
  getAiChurnSummary,
  getFileTrend,
  type WeeklyChurn,
  getHotspots,
  type HotspotData,
} from '~/lib/analytics/blameClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import {
  getUnifiedParser,
  parseModeStore,
  ParseModeSelector,
  ParseModeStatus,
  type LLMAnalysis,
} from '~/lib/unifiedParser';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import {
  Brain,
  Zap,
  RefreshCw,
  Search,
  History,
  Clock,
  User,
  AlertTriangle,
  Users,
  GitCommit,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import * as Popover from '@radix-ui/react-popover';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap } from '~/lib/stores/files';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  filePath?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

// Build file tree from FileMap
function buildFileTree(files: FileMap): FileNode[] {
  const root: FileNode[] = [];
  const folderMap = new Map<string, FileNode>();

  // Sort files by path and strip /home/project prefix
  const sortedPaths = Object.keys(files)
    .filter((path) => files[path]?.type === 'file')
    .map((path) => path.replace(/^\/home\/project\/?/, ''))
    .filter((path) => path.length > 0)
    .sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const isFile = i === parts.length - 1;

      if (isFile) {
        // Add file node
        currentLevel.push({
          name: part,
          path: filePath,
          type: 'file',
        });
      } else {
        // Add or find folder node
        let folderNode = folderMap.get(currentPath);

        if (!folderNode) {
          folderNode = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap.set(currentPath, folderNode);
          currentLevel.push(folderNode);
        }

        currentLevel = folderNode.children!;
      }
    }
  }

  return root;
}

// File tree node component
function FileTreeNode({
  node,
  onFileSelect,
  expandedFolders,
  onToggleFolder,
}: {
  node: FileNode;
  onFileSelect: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded text-xs w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-gray-500" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-500" />
          )}
          {isExpanded ? <FolderOpen className="h-3 w-3 text-blue-400" /> : <Folder className="h-3 w-3 text-blue-400" />}
          <span className="text-gray-300">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div className="ml-4 border-l border-white/5">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className="flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded text-xs w-full text-left"
    >
      <File className="h-3 w-3 text-gray-500 ml-4" />
      <span className="text-gray-300">{node.name}</span>
    </button>
  );
}

export function EvolutionaryBlame({ filePath }: Props) {
  const [blameData, setBlameData] = useState<BlameLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [inputPath, setInputPath] = useState(filePath || '');
  const [repoUrl, setRepoUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const parseMode = useStore(parseModeStore);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysis | null>(null);

  // New state for enhancements
  const [churnTrend, setChurnTrend] = useState<WeeklyChurn[]>([]);
  const [isHotspot, setIsHotspot] = useState(false);
  const [hotspotData, setHotspotData] = useState<HotspotData | null>(null);
  const [clusterByCommit, setClusterByCommit] = useState(true); // Commit clustering toggle

  // Get files from workbench store
  const files = useStore(workbenchStore.files);

  // Build file tree from FileMap
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  useEffect(() => {
    const recent = repositoryHistoryStore.getRecentRepositories(1);

    if (recent.length > 0) {
      setRepoUrl(recent[0].url);
    }
  }, []);

  const loadBlame = async (path: string) => {
    if (!repoUrl || !path) {
      return;
    }

    setLoading(true);
    setError(null);
    setAiSummary(null);
    setLlmAnalysis(null);
    setChurnTrend([]);
    setIsHotspot(false);
    setHotspotData(null);

    try {
      // Parallel fetch: blame data + churn trend + hotspots
      const [data, trend, hotspots] = await Promise.all([
        getBlame(repoUrl, path),
        getFileTrend(repoUrl, path, 12).catch(() => []),
        getHotspots(repoUrl, 12, 25.0).catch(() => []),
      ]);

      setBlameData(data);
      setChurnTrend(trend);

      // Check if current file is a hotspot
      const currentHotspot = hotspots.find((h) => h.filePath === path);

      if (currentHotspot) {
        setIsHotspot(true);
        setHotspotData(currentHotspot);
      }

      // If in LLM mode, automatically trigger AI analysis
      if (parseMode.type === 'llm-enhanced' && data.length > 0) {
        handleAiAnalysis(path, data);
      }
    } catch (err: any) {
      setError(err.message);
      setBlameData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filePath) {
      loadBlame(filePath);
    }
  }, [filePath, repoUrl]);

  const handleFileSelect = (path: string) => {
    // Strip /home/project prefix if present
    const cleanPath = path.replace(/^\/home\/project\/?/, '');
    setInputPath(cleanPath);
    setOpen(false);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputPath) {
      loadBlame(inputPath);
    }
  };

  const handleAiAnalysis = async (path: string, data: BlameLine[]) => {
    setAiLoading(true);

    try {
      // Get the unified parser for deeper analysis
      const unifiedParser = await getUnifiedParser();

      // Combine file content from blame lines
      const content = data.map((l) => l.content).join('\n');

      // Calculate blame statistics for context
      const authors = new Set(data.map((l) => l.authorEmail || 'Unknown'));
      const dates = data.map((l) => new Date(l.committedAt).getTime());
      const oldestDate = new Date(Math.min(...dates));
      const newestDate = new Date(Math.max(...dates));

      const blameContext = `// Evolutionary Blame Context:
// Authors: ${Array.from(authors).join(', ')}
// Time Range: ${oldestDate.toISOString()} to ${newestDate.toISOString()}
// Total Lines: ${data.length}
// 
// Task: Analyze the code evolution. Identify if multiple authors have contributed to complex sections, suggesting potential technical debt or knowledge silos.
`;

      const codeWithContext = blameContext + '\n' + content;

      const analysis = await unifiedParser.parseCode(codeWithContext, path);

      setLlmAnalysis(analysis.llmAnalysis || null);

      // Also get the standard churn summary
      const summary = await getAiChurnSummary(repoUrl, path, 0, data.length, 12);
      setAiSummary(summary);

      toast.success('Evolutionary AI analysis completed');
    } catch (error) {
      console.error('AI blame analysis failed:', error);
      setAiSummary('Could not generate full AI summary.');
    } finally {
      setAiLoading(false);
    }
  };

  const getAgeColor = (dateStr: string): string => {
    const age = Date.now() - new Date(dateStr).getTime();
    const days = age / (1000 * 60 * 60 * 24);

    if (days < 7) {
      return '#22C55E';
    } // green

    if (days < 30) {
      return '#3B82F6';
    } // blue

    if (days < 90) {
      return '#A855F7';
    } // purple

    if (days < 365) {
      return '#F97316';
    } // orange

    return '#6B7280'; // gray
  };

  // Calculate author statistics
  const getAuthorStats = () => {
    const authorContributions = new Map<string, number>();
    blameData.forEach((line) => {
      const author = line.authorEmail || 'Unknown';
      authorContributions.set(author, (authorContributions.get(author) || 0) + 1);
    });

    const sorted = Array.from(authorContributions.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([author, lines]) => ({
        author,
        lines,
        percentage: ((lines / blameData.length) * 100).toFixed(1),
      }));

    return sorted;
  };

  // Prepare chart data for churn trend
  const getChartData = () => {
    if (churnTrend.length === 0) {
      return null;
    }

    const labels = churnTrend.map((w) =>
      new Date(w.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    );

    return {
      labels,
      datasets: [
        {
          label: 'Churn Rate (%)',
          data: churnTrend.map((w) => w.churnRate),
          borderColor: '#F97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          tension: 0.3,
        },
        {
          label: 'Commits',
          data: churnTrend.map((w) => w.commitCount),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { color: '#9CA3AF', font: { size: 10 } },
      },
      title: {
        display: true,
        text: '12-Week Churn Trend',
        color: '#F97316',
        font: { size: 12, weight: 'bold' as const },
      },
    },
    scales: {
      x: {
        ticks: { color: '#6B7280', font: { size: 9 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        ticks: { color: '#F97316', font: { size: 9 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        title: { display: true, text: 'Churn %', color: '#F97316' },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        ticks: { color: '#3B82F6', font: { size: 9 } },
        grid: { display: false },
        title: { display: true, text: 'Commits', color: '#3B82F6' },
      },
    },
  };

  const uniqueAuthors = [...new Set(blameData.map((l) => l.authorEmail))];
  const authorStats = blameData.length > 0 ? getAuthorStats() : [];
  const chartData = getChartData();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-orange-400" /> Evolutionary Blame
            </h2>
            {isHotspot && (
              <Badge variant="outline" className="border-red-500/30 text-red-400 text-[10px] h-5 py-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" /> High Churn Hotspot
              </Badge>
            )}
            <ParseModeStatus />
          </div>
          <ParseModeSelector compact />
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              placeholder="Enter file path or select from dropdown..."
              className="w-full bg-[#151515] border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
            />
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger asChild>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded">
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  className="bg-[#151515] border border-white/10 rounded-lg p-2 shadow-lg max-h-[400px] overflow-y-auto w-[500px] z-50"
                  sideOffset={5}
                >
                  <div className="mb-2 px-2 py-1 text-xs text-gray-500 border-b border-white/5">
                    Select file to analyze
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {fileTree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        onFileSelect={handleFileSelect}
                        expandedFolders={expandedFolders}
                        onToggleFolder={toggleFolder}
                      />
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <Button
            onClick={() => inputPath && loadBlame(inputPath)}
            disabled={loading || !inputPath}
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-400"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Load Blame'}
          </Button>
          {blameData.length > 0 && (
            <Button
              type="button"
              onClick={() => handleAiAnalysis(inputPath, blameData)}
              disabled={aiLoading}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-400"
            >
              {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
              AI Analysis
            </Button>
          )}
        </div>

        {/* Legend & Stats */}
        <div className="flex items-center flex-wrap gap-y-2 gap-x-4 text-[10px] text-gray-500">
          <div className="flex items-center gap-3 mr-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> &lt;1w
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> &lt;1m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> &lt;3m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> &lt;1y
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span> 1y+
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Badge variant="outline" className="text-[10px] h-5 py-0">
              <User className="h-2.5 w-2.5 mr-1" /> {uniqueAuthors.length} Authors
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 py-0">
              <History className="h-2.5 w-2.5 mr-1" /> {blameData.length} Lines
            </Badge>
            <button
              onClick={() => setClusterByCommit(!clusterByCommit)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-colors ${
                clusterByCommit
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}
              title="Group consecutive lines by commit"
            >
              <GitCommit className="h-2.5 w-2.5" /> Cluster
            </button>
          </div>
        </div>
      </div>

      {/* AI Analysis Panel */}
      {(aiSummary || llmAnalysis) && (
        <div className="mx-5 mt-3 space-y-3 flex-shrink-0">
          {aiSummary && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-gray-300">
              <div className="font-bold text-purple-400 mb-1 flex items-center gap-1">
                <Brain className="h-3 w-3" /> Git History Insight
              </div>
              <p className="leading-relaxed opacity-90">{aiSummary}</p>
            </div>
          )}

          {llmAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
                <div className="font-bold text-blue-400 mb-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Quality Score
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${llmAnalysis.quality.score}%` }} />
                  </div>
                  <span className="font-mono">{llmAnalysis.quality.score.toFixed(0)}%</span>
                </div>
              </div>
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs">
                <div className="font-bold text-orange-400 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Complexity
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${llmAnalysis.complexity.score}%` }} />
                  </div>
                  <span className="font-mono">{llmAnalysis.complexity.score.toFixed(0)}/100</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Churn Trend & Author Statistics */}
      {blameData.length > 0 && (
        <div className="mx-5 mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
          {/* Churn Trend Chart */}
          {chartData && (
            <div className="p-3 bg-[#151515] border border-white/10 rounded-lg">
              <div className="h-[180px]">
                <Line data={chartData} options={chartOptions} />
              </div>
              {isHotspot && hotspotData && (
                <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 flex items-center justify-between">
                  <span>Avg Churn: {hotspotData.avgChurnRate.toFixed(1)}%</span>
                  <span>Total Commits: {hotspotData.totalCommits}</span>
                  <span className="text-red-400">
                    +{hotspotData.totalLinesAdded} / -{hotspotData.totalLinesDeleted}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Author Statistics */}
          <div className="p-3 bg-[#151515] border border-white/10 rounded-lg">
            <div className="font-bold text-blue-400 mb-2 flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" /> Author Contributions
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {authorStats.slice(0, 10).map((stat, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="truncate text-gray-400" title={stat.author}>
                        {stat.author.split('@')[0]}
                      </span>
                      <span className="text-gray-600 font-mono ml-2">{stat.percentage}%</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${stat.percentage}%` }} />
                    </div>
                  </div>
                  <span className="text-gray-600 font-mono w-10 text-right">{stat.lines}L</span>
                </div>
              ))}
            </div>
            {authorStats.length > 10 && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-gray-600 text-center">
                +{authorStats.length - 10} more authors
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-5 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Blame Table */}
      <div className="flex-1 overflow-y-auto font-mono text-[10px] mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading git blame...
          </div>
        ) : blameData.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm">Enter a file path to view evolutionary history</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {blameData.map((line, i) => {
                const color = getAgeColor(line.committedAt);
                const showMeta = clusterByCommit ? i === 0 || blameData[i - 1].commitHash !== line.commitHash : true;

                return (
                  <tr key={i} className="hover:bg-white/5 group">
                    <td className="w-1 px-0" style={{ backgroundColor: color, opacity: 0.6 }}></td>
                    <td className="px-2 py-0.5 text-gray-600 text-right select-none w-10 border-r border-white/5">
                      {line.lineNumber}
                    </td>
                    <td className="px-2 py-0.5 w-[240px] text-gray-500 border-r border-white/5 truncate">
                      {showMeta ? (
                        <span className="flex items-center gap-2">
                          <span className="truncate max-w-[100px] text-gray-400" title={line.authorEmail}>
                            {line.authorEmail.split('@')[0]}
                          </span>
                          <span className="text-gray-600">
                            {new Date(line.committedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-gray-700 truncate max-w-[80px]" title={line.commitHash}>
                            {line.commitHash.slice(0, 7)}
                          </span>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-0.5 text-gray-300 whitespace-pre leading-normal">{line.content}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
