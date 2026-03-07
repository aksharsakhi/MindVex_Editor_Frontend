/**
 * AnalyticsDashboard.tsx
 *
 * Enhanced Code Analytics & Hotspots tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  getHotspots,
  getFileTrend,
  triggerMining,
  type HotspotResult,
  type WeeklyChurn,
} from '~/lib/analytics/analyticsClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import {
  getUnifiedParser,
  parseModeStore,
  ParseModeSelector,
  ParseModeStatus,
  type LLMAnalysis,
} from '~/lib/unifiedParser';
import { workbenchStore } from '~/lib/stores/workbench';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import {
  Brain,
  Zap,
  Info,
  RefreshCw,
  Download,
  Flame,
  TrendingUp,
  BarChart2,
  Search,
  Filter,
  ArrowUpDown,
  FileCode,
  FileJson,
  FileText,
  AlertTriangle,
  Activity,
  GitCommit,
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Inline SVG Chart Components ─────────────────────────────────────────────

function MiniBarChart({ data, maxVal, color }: { data: number[]; maxVal: number; color: string }) {
  const h = 48,
    w = 200;
  const barW = Math.max(2, (w - data.length) / data.length);

  return (
    <svg width={w} height={h} className="overflow-visible">
      {data.map((v, i) => {
        const barH = maxVal > 0 ? (v / maxVal) * h : 0;
        return (
          <rect key={i} x={i * (barW + 1)} y={h - barH} width={barW} height={barH} rx={1} fill={color} opacity={0.85} />
        );
      })}
    </svg>
  );
}

function ChurnLineChart({ data }: { data: WeeklyChurn[] }) {
  if (!data.length) {
    return null;
  }

  const w = 600,
    h = 200,
    pad = 40;
  const maxChurn = Math.max(...data.map((d) => d.churnRate), 1);
  const maxLines = Math.max(...data.map((d) => d.linesAdded + d.linesDeleted), 1);

  const points = data.map((d, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2),
    yChurn: h - pad - (d.churnRate / maxChurn) * (h - pad * 2),
    yLines: h - pad - ((d.linesAdded + d.linesDeleted) / maxLines) * (h - pad * 2),
  }));

  const churnPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yChurn}`).join(' ');
  const linesPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yLines}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={pad}
          y1={h - pad - frac * (h - pad * 2)}
          x2={w - pad}
          y2={h - pad - frac * (h - pad * 2)}
          stroke="#333"
          strokeWidth={0.5}
        />
      ))}
      {/* Lines */}
      <path d={linesPath} fill="none" stroke="#60A5FA" strokeWidth={2} opacity={0.6} />
      <path d={churnPath} fill="none" stroke="#F97316" strokeWidth={2.5} />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.yChurn} r={3} fill="#F97316" />
      ))}
      {/* Labels */}
      {data.map((d, i) => {
        if (data.length > 8 && i % 2 !== 0) {
          return null;
        }

        return (
          <text key={i} x={points[i].x} y={h - 5} textAnchor="middle" fill="#888" fontSize={9}>
            {new Date(d.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </text>
        );
      })}
      {/* Legend */}
      <circle cx={w - 120} cy={12} r={4} fill="#F97316" />
      <text x={w - 112} y={16} fill="#ccc" fontSize={10}>
        Churn %
      </text>
      <circle cx={w - 55} cy={12} r={4} fill="#60A5FA" />
      <text x={w - 47} y={16} fill="#ccc" fontSize={10}>
        Lines Δ
      </text>
    </svg>
  );
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getFileIcon(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const iconClass = 'h-4 w-4';

  if (!ext) {
    return <FileText className={iconClass} />;
  }

  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext)) {
    return <FileCode className={`${iconClass} text-blue-400`} />;
  }

  if (['json', 'yaml', 'yml', 'xml', 'toml'].includes(ext)) {
    return <FileJson className={`${iconClass} text-yellow-400`} />;
  }

  return <FileText className={`${iconClass} text-gray-400`} />;
}

function getSeverityBadge(churnRate: number) {
  if (churnRate >= 50) {
    return (
      <Badge variant="outline" className="border-red-500/50 text-red-400 text-[10px] px-1.5 py-0">
        Critical
      </Badge>
    );
  }

  if (churnRate >= 30) {
    return (
      <Badge variant="outline" className="border-orange-500/50 text-orange-400 text-[10px] px-1.5 py-0">
        High
      </Badge>
    );
  }

  if (churnRate >= 15) {
    return (
      <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-[10px] px-1.5 py-0">
        Medium
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-green-500/50 text-green-400 text-[10px] px-1.5 py-0">
      Low
    </Badge>
  );
}

function exportHotspotsToCSV(hotspots: HotspotResult[]) {
  const headers = ['File Path', 'Avg Churn Rate (%)', 'Total Commits', 'Lines Added', 'Lines Deleted'];
  const rows = hotspots.map((h) => [
    h.filePath,
    h.avgChurnRate.toFixed(2),
    h.totalCommits,
    h.totalLinesAdded,
    h.totalLinesDeleted,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hotspots-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Hotspots exported to CSV');
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [hotspots, setHotspots] = useState<HotspotResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileTrend, setFileTrend] = useState<WeeklyChurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [miningLoading, setMiningLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');

  const parseMode = useStore(parseModeStore);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // UI enhancement states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'churn' | 'commits' | 'lines'>('churn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const recent = repositoryHistoryStore.getRecentRepositories(1);

    if (recent.length > 0) {
      setRepoUrl(recent[0].url);
    }
  }, []);

  const loadHotspots = useCallback(async () => {
    if (!repoUrl) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getHotspots(repoUrl, 12, 10);
      setHotspots(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [repoUrl]);

  useEffect(() => {
    if (repoUrl) {
      loadHotspots();
    }
  }, [repoUrl, loadHotspots]);

  const handleSelectFile = async (filePath: string) => {
    setSelectedFile(filePath);

    try {
      const trend = await getFileTrend(repoUrl, filePath, 12);
      setFileTrend(trend);

      // Perform AI analysis if in LLM mode
      if (parseMode.type === 'llm-enhanced') {
        performAIAnalysis(filePath, trend);
      } else {
        setLlmAnalysis(null);
      }
    } catch {
      setFileTrend([]);
      setLlmAnalysis(null);
    }
  };

  const performAIAnalysis = async (filePath: string, trend: WeeklyChurn[]) => {
    setIsAnalyzing(true);

    try {
      const unifiedParser = await getUnifiedParser();
      const filesMap = workbenchStore.files.get();
      const dirent = filesMap[filePath];
      let realContent = '';

      if (dirent?.type === 'file') {
        realContent = dirent.content;
      }

      const avgChurn = trend.length > 0 ? (trend.reduce((s, t) => s + t.churnRate, 0) / trend.length).toFixed(1) : '0';
      const totalCommits = trend.reduce((s, t) => s + t.commitCount, 0);

      const statsContext = `// Hotspot Analysis Context:
// File: ${filePath}
// Avg Churn Rate: ${avgChurn}%
// Total Commits: ${totalCommits}
// 
// Task: Analyze why this file is a hotspot. Look for high complexity, god classes, or frequent modification patterns.
`;

      // If content is too long, truncate it to avoid token limits (simple truncation)
      const MAX_CHARS = 20000;
      const contentToAnalyze =
        realContent.length > MAX_CHARS ? realContent.substring(0, MAX_CHARS) + '\n// ... (truncated)' : realContent;

      const codeToAnalyze = contentToAnalyze ? statsContext + '\n' + contentToAnalyze : statsContext;

      const analysis = await unifiedParser.parseCode(codeToAnalyze, filePath);
      setLlmAnalysis(analysis.llmAnalysis || null);
      toast.success('AI hotspot analysis completed');
    } catch (error) {
      console.error('AI hotspot analysis failed:', error);
      toast.error('AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTriggerMining = async () => {
    if (!repoUrl) {
      return;
    }

    setMiningLoading(true);

    try {
      await triggerMining(repoUrl, 90);

      // Wait a bit then reload
      setTimeout(() => {
        loadHotspots();
        setMiningLoading(false);
      }, 5000);
    } catch {
      setMiningLoading(false);
    }
  };

  // Filter and sort hotspots
  const filteredAndSortedHotspots = hotspots
    .filter((h) => h.filePath.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'churn') {
        comparison = a.avgChurnRate - b.avgChurnRate;
      } else if (sortBy === 'commits') {
        comparison = a.totalCommits - b.totalCommits;
      } else if (sortBy === 'lines') {
        comparison = a.totalLinesAdded + a.totalLinesDeleted - (b.totalLinesAdded + b.totalLinesDeleted);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const maxChurn = Math.max(...hotspots.map((h) => h.avgChurnRate), 1);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0a0a0a] text-white">
      {/* Enhanced Header */}
      <div className="p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-[#0a0a0a] to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30">
                <BarChart2 className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-500 bg-clip-text text-transparent">
                  Code Analytics & Hotspots
                </h1>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <Activity className="h-3 w-3" />
                  Real-time analysis powered by JGit mining
                </p>
              </div>
            </div>
            <ParseModeStatus />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => exportHotspotsToCSV(hotspots)}
              disabled={hotspots.length === 0}
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
            <ParseModeSelector compact />
            <Button
              onClick={handleTriggerMining}
              disabled={miningLoading || !repoUrl}
              variant="outline"
              size="sm"
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              {miningLoading ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  Mining...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Mine History
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Row */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-red-950/30 to-red-900/10 border-red-500/20 p-4 hover:border-red-500/40 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-red-400 group-hover:animate-pulse" />
              Hotspot Files
            </div>
            <AlertTriangle className="h-4 w-4 text-red-400/40" />
          </div>
          <div className="text-3xl font-bold text-red-400 mb-1">{hotspots.length}</div>
          <div className="text-[10px] text-gray-500">Files requiring attention</div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-950/30 to-orange-900/10 border-orange-500/20 p-4 hover:border-orange-500/40 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-orange-400 group-hover:animate-bounce" />
              Avg Churn Rate
            </div>
            <Activity className="h-4 w-4 text-orange-400/40" />
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-1">
            {hotspots.length > 0
              ? (hotspots.reduce((s, h) => s + h.avgChurnRate, 0) / hotspots.length).toFixed(1)
              : '0'}
            <span className="text-lg">%</span>
          </div>
          <div className="text-[10px] text-gray-500">Average code volatility</div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-950/30 to-blue-900/10 border-blue-500/20 p-4 hover:border-blue-500/40 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <GitCommit className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
              Total Commits
            </div>
            <BarChart2 className="h-4 w-4 text-blue-400/40" />
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-1">
            {hotspots.reduce((s, h) => s + h.totalCommits, 0)}
          </div>
          <div className="text-[10px] text-gray-500">Across all hotspot files</div>
        </Card>
      </div>

      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        {/* Hotspot Heatmap */}
        <div className="bg-[#111] border border-white/5 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-400" />
            Hotspot Files
            <Badge variant="outline" className="border-gray-500/30 text-gray-400 text-[10px]">
              {filteredAndSortedHotspots.length}
            </Badge>
          </h2>

          {/* Search and Sort Controls */}
          <div className="mb-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'churn' | 'commits' | 'lines')}
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="churn">Sort by Churn Rate</option>
                <option value="commits">Sort by Commits</option>
                <option value="lines">Sort by Lines Changed</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-2 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg hover:border-orange-500/50 transition-colors"
              >
                <ArrowUpDown
                  className={`h-3.5 w-3.5 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`}
                />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading hotspots...
            </div>
          ) : hotspots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">No hotspots found. Click "Mine History" to analyze commits.</p>
            </div>
          ) : filteredAndSortedHotspots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No files match your search</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredAndSortedHotspots.map((h, i) => {
                const intensity = h.avgChurnRate / maxChurn;
                const bgColor = `rgba(239, 68, 68, ${intensity * 0.25})`;
                const borderColor = `rgba(239, 68, 68, ${intensity * 0.5})`;

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectFile(h.filePath)}
                    className={`w-full text-left p-3 rounded-lg border transition-all hover:scale-[1.01] hover:shadow-lg ${
                      selectedFile === h.filePath ? 'ring-2 ring-orange-500 shadow-orange-500/20' : ''
                    }`}
                    style={{ backgroundColor: bgColor, borderColor }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getFileIcon(h.filePath)}
                        <span className="text-sm font-mono text-gray-200 truncate" title={h.filePath}>
                          {h.filePath.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(h.avgChurnRate)}
                        <span className="text-xs font-bold text-red-400">{h.avgChurnRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="font-mono text-[10px] truncate max-w-[60%]" title={h.filePath}>
                        {h.filePath}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{h.totalCommits} commits</span>
                      <span>
                        +{h.totalLinesAdded} / -{h.totalLinesDeleted}
                      </span>
                    </div>
                    {h.weeklyTrend && (
                      <div className="mt-2">
                        <MiniBarChart
                          data={h.weeklyTrend.map((w) => w.churnRate)}
                          maxVal={100}
                          color={`rgb(239, ${Math.round(68 + (1 - intensity) * 100)}, 68)`}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* File Trend Detail */}
        <div className="bg-[#111] border border-white/5 rounded-xl p-5 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            📈 Churn Trend
            {selectedFile && (
              <span className="text-xs text-gray-500 font-normal font-mono truncate max-w-[200px]" title={selectedFile}>
                — {selectedFile.split('/').pop()}
              </span>
            )}
          </h2>

          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
              <div className="text-4xl mb-3">👈</div>
              <p className="text-sm">Select a hotspot file to view its trend</p>
            </div>
          ) : fileTrend.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading trend data...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              <ChurnLineChart data={fileTrend} />

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 mb-6">
                <div className="bg-[#0a0a0a] rounded-lg p-3 text-center border border-white/5">
                  <div className="text-xs text-gray-500">Peak Churn</div>
                  <div className="text-lg font-bold text-red-400">
                    {Math.max(...fileTrend.map((d) => d.churnRate)).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3 text-center border border-white/5">
                  <div className="text-xs text-gray-500">Total Lines Δ</div>
                  <div className="text-lg font-bold text-blue-400">
                    {fileTrend.reduce((s, d) => s + d.linesAdded + d.linesDeleted, 0)}
                  </div>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3 text-center border border-white/5">
                  <div className="text-xs text-gray-500">Commits</div>
                  <div className="text-lg font-bold text-green-400">
                    {fileTrend.reduce((s, d) => s + d.commitCount, 0)}
                  </div>
                </div>
              </div>

              {/* AI Analysis section */}
              {parseMode.type === 'llm-enhanced' && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4" /> AI Hotspot Analysis
                  </h3>

                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Analyzing hotspot patterns...
                    </div>
                  ) : llmAnalysis ? (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-300 leading-relaxed bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                        {llmAnalysis.summary}
                      </div>

                      {llmAnalysis.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Recommendations
                          </h4>
                          <ul className="space-y-1">
                            {llmAnalysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                                <div className="mt-1.5 w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 bg-gray-800/50 rounded border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">Risk Level</div>
                          <div
                            className={`text-sm font-bold ${llmAnalysis.quality.score < 50 ? 'text-red-400' : 'text-orange-400'}`}
                          >
                            {llmAnalysis.quality.score < 50 ? 'High' : 'Moderate'}
                          </div>
                        </div>
                        <div className="p-2 bg-gray-800/50 rounded border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">Complexity</div>
                          <div className="text-sm font-bold text-blue-400">
                            {llmAnalysis.complexity.score.toFixed(1)}/100
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      Select a file to generate AI analysis of this hotspot.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
