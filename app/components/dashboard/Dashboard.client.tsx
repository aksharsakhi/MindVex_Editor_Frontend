import React, { useState, useEffect } from 'react';
import { Link } from '@remix-run/react';
import { webcontainer } from '~/lib/webcontainer';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import { path } from '~/utils/path';
import { toast } from 'react-toastify';
import { WORK_DIR } from '~/utils/constants';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import {
  Brain,
  FileCode,
  Layers,
  AlertCircle,
  TrendingUp,
  Cpu,
  Database,
  Sparkles,
  Network,
  BookOpen,
  MessageSquare,
  History,
  Activity,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { Progress } from '~/components/ui/Progress';
import { Badge } from '~/components/ui/Badge';
import { providersStore } from '~/lib/stores/settings';
import { useStore } from '@nanostores/react';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { workbenchStore } from '~/lib/stores/workbench';

interface LanguageDistribution {
  language: string;
  count: number;
  percentage: number;
}

interface CodeHealthReason {
  category: 'positive' | 'warning' | 'critical';
  message: string;
  impact: number;
}

interface DashboardData {
  totalFiles: number;
  totalModules: number;
  languagesDetected: number;
  codeHealthScore: number;
  codeHealthReasons: CodeHealthReason[];
  languageDistribution: LanguageDistribution[];
  recentChanges: string[];
  dependencies: string[];
  fileStructure: string[];
  potentialIssues: string[];
  architectureLayers: string[];
  totalLines: number;
  totalCodeLines: number;
  totalCommentLines: number;
  totalBlankLines: number;
  aiSummary?: string;
}

interface DashboardState {
  loading: boolean;
  data: DashboardData;
}

export function Dashboard() {
  const providers = useStore(providersStore);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    loading: true,
    data: {
      totalFiles: 0,
      totalModules: 0,
      languagesDetected: 0,
      codeHealthScore: 0,
      codeHealthReasons: [],
      languageDistribution: [],
      recentChanges: [],
      dependencies: [],
      fileStructure: [],
      potentialIssues: [],
      architectureLayers: [],
      totalLines: 0,
      totalCodeLines: 0,
      totalCommentLines: 0,
      totalBlankLines: 0,
    },
  });

  const loadDashboardData = async () => {
    try {
      // Get files from workbench store instead of manual scan for better reliability
      const filesMap = workbenchStore.files.get();
      const fileEntries = Object.entries(filesMap).filter(([_, dirent]) => dirent?.type === 'file');

      let analysisFiles: { path: string; content: string }[] = [];

      if (fileEntries.length > 0) {
        analysisFiles = fileEntries.map(([path, dirent]) => ({
          path,
          content: dirent?.type === 'file' ? (dirent as any).content || '' : '',
        }));
      } else {
        // Fallback to manual scan if store is empty
        const container = await webcontainer;

        async function getAllFiles(dirPath: string): Promise<{ path: string; content: string }[]> {
          const files: { path: string; content: string }[] = [];

          try {
            const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);

              if (entry.isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build', '.cache'].includes(entry.name)) {
                  const subFiles = await getAllFiles(fullPath);
                  files.push(...subFiles);
                }
              } else if (entry.isFile()) {
                if (!entry.name.endsWith('.DS_Store') && !entry.name.endsWith('.log')) {
                  try {
                    const content = await container.fs.readFile(fullPath, 'utf-8');
                    files.push({ path: fullPath, content: content as string });
                  } catch (e) { }
                }
              }
            }
          } catch (e) { }

          return files;
        }

        const [rootFiles, workFiles] = await Promise.all([getAllFiles('/'), getAllFiles(WORK_DIR)]);
        analysisFiles = workFiles.length >= rootFiles.length ? workFiles : rootFiles;
      }

      const totalFiles = analysisFiles.length;

      let totalLines = 0;
      let totalCodeLines = 0;
      let totalCommentLines = 0;
      const langStats: Record<string, number> = {};

      analysisFiles.forEach((file) => {
        const ext = path.extname(file.path).slice(1);
        const lang = getLanguageFromExtension(ext);

        if (lang !== 'unknown') {
          langStats[lang] = (langStats[lang] || 0) + 1;
        }

        const lines = file.content.split('\n');
        totalLines += lines.length;
        lines.forEach((line) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            totalCommentLines++;
          } else if (trimmed.length > 0) {
            totalCodeLines++;
          }
        });
      });

      const languageDistribution = Object.entries(langStats)
        .map(([language, count]) => ({
          language,
          count,
          percentage: (count / (totalFiles || 1)) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate code health reasons
      const healthReasons: CodeHealthReason[] = [];
      let healthScore = 100;

      // Documentation check
      const commentRatio = totalCodeLines > 0 ? totalCommentLines / totalCodeLines : 0;

      if (commentRatio >= 0.3) {
        healthReasons.push({
          category: 'positive',
          message: 'Excellent documentation coverage',
          impact: 15,
        });
      } else if (commentRatio >= 0.15) {
        healthReasons.push({
          category: 'positive',
          message: 'Good comment density',
          impact: 10,
        });
      } else if (commentRatio >= 0.05) {
        healthReasons.push({
          category: 'warning',
          message: 'Low comment density - improve documentation',
          impact: -15,
        });
        healthScore -= 15;
      } else {
        healthReasons.push({
          category: 'critical',
          message: 'Minimal documentation detected',
          impact: -25,
        });
        healthScore -= 25;
      }

      // File count check
      if (totalFiles > 100) {
        healthReasons.push({
          category: 'positive',
          message: 'Large codebase - good project scale',
          impact: 10,
        });
      } else if (totalFiles < 5) {
        healthReasons.push({
          category: 'warning',
          message: 'Small codebase - consider modularization',
          impact: -5,
        });
        healthScore -= 5;
      }

      // Language diversity check
      if (languageDistribution.length > 3) {
        healthReasons.push({
          category: 'warning',
          message: 'Multiple languages detected - ensure consistency',
          impact: -10,
        });
        healthScore -= 10;
      } else if (languageDistribution.length === 1) {
        healthReasons.push({
          category: 'positive',
          message: 'Single language stack - good consistency',
          impact: 10,
        });
      }

      // Module structure check
      const fileToModuleRatio =
        totalFiles > 0 ? totalFiles / (new Set(analysisFiles.map((f) => path.dirname(f.path))).size || 1) : 0;

      if (fileToModuleRatio > 5 && fileToModuleRatio < 15) {
        healthReasons.push({
          category: 'positive',
          message: 'Well-organized module structure',
          impact: 10,
        });
      } else if (fileToModuleRatio > 30) {
        healthReasons.push({
          category: 'warning',
          message: 'Possible file organization issues',
          impact: -10,
        });
        healthScore -= 10;
      }

      // Code to comment ratio
      const codeCommentBalance = totalCodeLines > 0 ? totalCommentLines / totalCodeLines : 0;

      if (codeCommentBalance > 0.2) {
        healthReasons.push({
          category: 'positive',
          message: 'Good code-to-comment balance',
          impact: 5,
        });
      }

      // Ensure score is between 0-100
      healthScore = Math.max(0, Math.min(100, healthScore));

      setDashboardState({
        loading: false,
        data: {
          totalFiles,
          totalModules: new Set(analysisFiles.map((f) => path.dirname(f.path))).size,
          languagesDetected: languageDistribution.length,
          codeHealthScore: healthScore,
          codeHealthReasons: healthReasons,
          languageDistribution,
          recentChanges: ['Updated run.sh', 'Enhanced AI Providers'],
          dependencies: ['react', 'nanostores', 'cytoscape'],
          fileStructure: analysisFiles.slice(0, 5).map((f) => f.path),
          potentialIssues: healthReasons.filter((r) => r.category !== 'positive').map((r) => r.message),
          architectureLayers: ['Frontend', 'Backend', 'AI Bridge'],
          totalLines,
          totalCodeLines,
          totalCommentLines,
          totalBlankLines: totalLines - totalCodeLines - totalCommentLines,
          aiSummary:
            totalFiles > 0
              ? 'This repository implements a high-performance AI coding environment with unified parsing capabilities.'
              : 'No repository files detected yet. Try importing a repository from the sidebar.',
        },
      });
    } catch (error) {
      toast.error('Failed to analyze repository');
      setDashboardState((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Subscribe to workbench files to update stats in real-time
    const unsubscribe = workbenchStore.files.subscribe(() => {
      loadDashboardData();
    });

    return () => unsubscribe();
  }, []);

  const { data, loading } = dashboardState;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const activeProvider = Object.values(providers).find((p) => p.settings.enabled);

  const stats =
    data.totalFiles > 0
      ? data
      : {
        totalFiles: 0,
        totalModules: 0,
        totalLines: 0,
        totalCodeLines: 0,
        totalCommentLines: 0,
        totalBlankLines: 0,
        codeHealthScore: 0,
        codeHealthReasons: [],
        languageDistribution: [],
        aiSummary: 'No repository files detected yet. Try importing a repository from the sidebar.',
        architectureLayers: ['N/A'],
        potentialIssues: ['Import a repository to see optimization vectors'],
      };

  return (
    <div className="p-6 space-y-8 overflow-auto h-full max-w-[1600px] mx-auto w-full transition-all duration-300">
      {/* AI Header Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-6 rounded-2xl border border-purple-500/30 shadow-2xl backdrop-blur-md gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/30 flex items-center justify-center border border-purple-500/40 shadow-inner group">
            <Brain className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Project Intelligence</h1>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Provider:{' '}
              <span className="text-purple-400 font-bold uppercase tracking-wider">
                {activeProvider?.name || 'None Configured'}
              </span>
              {activeProvider?.settings.selectedModel && (
                <>
                  <span className="text-gray-600">•</span>
                  <Badge variant="outline" className="border-purple-500/30 text-purple-300 text-[10px]">
                    {activeProvider.settings.selectedModel}
                  </Badge>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-black transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95 uppercase tracking-widest"
        >
          Configure AI
        </button>
      </div>

      {/* Main Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ToolCard
          icon={<Network className="w-6 h-6 text-blue-400" />}
          title="Knowledge Graph Construction"
          desc="Build graphs using AST parsing"
          toolId="kg-construction"
        />
        <ToolCard
          icon={<Layers className="w-6 h-6 text-purple-400" />}
          title="Architecture / Dependency Graph"
          desc="Visualize your code architecture"
          toolId="architecture-graph"
        />
        <ToolCard
          icon={<Activity className="w-6 h-6 text-orange-400" />}
          title="Real-Time Graph Update"
          desc="Update graphs as code changes"
          toolId="realtime-graph"
        />
        <ToolCard
          icon={<AlertCircle className="w-6 h-6 text-red-400" />}
          title="Change Impact Analysis"
          desc="Analyze impact of code changes"
          toolId="impact-analysis"
        />
        <ToolCard
          icon={<Activity className="w-6 h-6 text-yellow-400" />}
          title="Cycle Detection"
          desc="Detect architectural anomalies"
          toolId="cycle-detection"
        />
        <ToolCard
          icon={<TrendingUp className="w-6 h-6 text-pink-400" />}
          title="Code Analytics & Hotspots"
          desc="Visualize churn and rework trends"
          toolId="analytics-dashboard"
        />
        <ToolCard
          icon={<History className="w-6 h-6 text-indigo-400" />}
          title="Evolutionary Blame"
          desc="AI-powered git churn analysis"
          toolId="evolutionary-blame"
        />
        <ToolCard
          icon={<MessageSquare className="w-6 h-6 text-cyan-400" />}
          title="Code Intelligence Chat"
          desc="Ask questions using semantic search"
          toolId="intelligent-chat"
        />
        <ToolCard
          icon={<BookOpen className="w-6 h-6 text-emerald-400" />}
          title="Living Wiki & Documentation"
          desc="AI-generated project docs"
          toolId="living-wiki"
        />
        <ToolCard
          icon={<ShieldAlert className="w-6 h-6 text-teal-400" />}
          title="Security & Coverage Heatmap"
          desc="Diagnostic view of code health"
          toolId="code-health-heatmap"
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileCode className="w-5 h-5 text-blue-500" />} label="Files" value={stats.totalFiles} />
        <StatCard icon={<Layers className="w-5 h-5 text-green-500" />} label="Modules" value={stats.totalModules} />
        <StatCard
          icon={<Database className="w-5 h-5 text-yellow-500" />}
          label="LOC"
          value={stats.totalLines.toLocaleString()}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          label="Health"
          value={`${stats.codeHealthScore}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Language Breakdown */}
        <Card className="lg:col-span-1 bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl overflow-hidden group">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
              <Cpu className="w-4 h-4 text-purple-500" />
              Stack Composition
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {stats.languageDistribution.map((lang) => (
              <div key={lang.language} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 font-bold uppercase tracking-tight">{lang.language}</span>
                  <span className="text-gray-500 font-mono">{lang.count} files</span>
                </div>
                <Progress value={lang.percentage} className="h-1.5 bg-gray-800" />
              </div>
            ))}
            {stats.languageDistribution.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-20">
                <Code className="w-12 h-12 mb-2" />
                <p className="text-xs font-bold uppercase">No data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Health Details */}
        <Card className="lg:col-span-1 bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Code Health Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={`text-4xl font-black ${stats.codeHealthScore >= 80 ? 'text-green-500' : stats.codeHealthScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
              >
                {stats.codeHealthScore}%
              </div>
              <div className="flex-1">
                <Progress value={stats.codeHealthScore} className="h-2 bg-gray-800 mb-2" />
                <p className="text-xs text-gray-400">Overall Health Score</p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              {stats.codeHealthReasons.map((reason, idx) => (
                <div key={idx} className="text-xs space-y-1">
                  <div className="flex items-start gap-2">
                    {reason.category === 'positive' && <span className="text-green-500 font-bold mt-0.5">✓</span>}
                    {reason.category === 'warning' && <span className="text-yellow-500 font-bold mt-0.5">⚠</span>}
                    {reason.category === 'critical' && <span className="text-red-500 font-bold mt-0.5">✗</span>}
                    <span
                      className={`flex-1 ${reason.category === 'positive' ? 'text-green-400' : reason.category === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}
                    >
                      {reason.message}
                    </span>
                  </div>
                  {reason.impact !== 0 && (
                    <div className="text-gray-500 ml-5">
                      Impact: {reason.impact > 0 ? '+' : ''}
                      {reason.impact}%
                    </div>
                  )}
                </div>
              ))}
              {stats.codeHealthReasons.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-2">No analysis available yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lines of Code Breakdown */}
        <Card className="lg:col-span-1 bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
              <Database className="w-4 h-4 text-blue-500" />
              Code Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase font-bold">Total Lines</span>
                <span className="text-lg font-black text-white">{stats.totalLines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase font-bold">Code Lines</span>
                <span className="text-lg font-black text-green-400">{stats.totalCodeLines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase font-bold">Comments</span>
                <span className="text-lg font-black text-blue-400">{stats.totalCommentLines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase font-bold">Blank Lines</span>
                <span className="text-lg font-black text-gray-500">{stats.totalBlankLines.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <div className="text-xs text-gray-400 mb-3 font-bold uppercase">Distribution</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Code</span>
                    <span className="text-green-400">
                      {((stats.totalCodeLines / stats.totalLines) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(stats.totalCodeLines / stats.totalLines) * 100} className="h-1.5 bg-gray-800" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Comments</span>
                    <span className="text-blue-400">
                      {((stats.totalCommentLines / stats.totalLines) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(stats.totalCommentLines / stats.totalLines) * 100} className="h-1.5 bg-gray-800" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Blank</span>
                    <span className="text-gray-400">
                      {((stats.totalBlankLines / stats.totalLines) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(stats.totalBlankLines / stats.totalLines) * 100} className="h-1.5 bg-gray-800" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        <Card className="lg:col-span-3 bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl overflow-hidden relative group">
          <div className="absolute -top-10 -right-10 p-4 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <Brain className="w-80 h-80" />
          </div>
          <CardHeader className="border-b border-white/5 bg-white/5">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Neural Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6 relative z-10">
            <div className="bg-purple-500/5 p-6 rounded-2xl border border-purple-500/10 backdrop-blur-sm shadow-inner">
              <p className="text-gray-200 text-lg leading-relaxed font-medium italic">"{stats.aiSummary}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Core Architecture</h4>
                <div className="flex flex-wrap gap-2">
                  {stats.architectureLayers.map((layer) => (
                    <Badge
                      key={layer}
                      variant="secondary"
                      className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] px-2 py-0.5"
                    >
                      {layer}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Optimization Vectors
                </h4>
                <ul className="space-y-2">
                  {stats.potentialIssues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-500/50 mt-0.5 shrink-0" />
                      {issue}
                    </li>
                  ))}
                  {stats.potentialIssues.length === 0 && (
                    <li className="text-xs text-green-500/50 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Architecture optimized
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ControlPanel open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function ToolCard({
  icon,
  title,
  desc,
  toolId,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  toolId: string;
}) {
  return (
    <button
      onClick={() => {
        workbenchStore.currentView.set('quick-actions');
        window.dispatchEvent(new CustomEvent('open-tool', { detail: { toolId } }));
      }}
      className="block w-full text-left group bg-transparent p-0 border-none outline-none"
    >
      <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor hover:border-purple-500/40 hover:bg-purple-500/[0.02] transition-all duration-300 shadow-lg h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6 space-y-3">
          <div className="p-3 rounded-xl bg-gray-800/50 w-fit group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300">
            {icon}
          </div>
          <div>
            <h3 className="font-black text-white text-sm uppercase tracking-wider">{title}</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mt-1">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor hover:border-purple-500/30 transition-all duration-300 group shadow-md overflow-hidden relative">
      <CardContent className="p-5 flex items-center gap-4 relative z-10">
        <div className="p-3 rounded-xl bg-gray-800/50 group-hover:bg-purple-500/10 transition-colors">{icon}</div>
        <div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">{label}</p>
          <p className="text-2xl font-black text-white tabular-nums tracking-tighter">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
