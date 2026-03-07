/**
 * LivingWiki.tsx — Full documentation viewer with Dashboard, visual renderers, and PDF export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { mcpGetWiki, mcpDescribeModule, mcpRecommendDiagrams, mcpGenerateDiagram } from '~/lib/mcp/mcpClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore } from '~/lib/stores/settings';
import { Button } from '~/components/ui/Button';
import {
  RefreshCw,
  Book,
  FileText,
  Package,
  Sparkles,
  FileJson,
  BookOpen,
  ScrollText,
  Download,
  Building2,
  Activity,
  GitBranch,
  Code2,
  Share2,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  CheckCheck,
  Printer,
  X,
  Info,
  LayoutDashboard,
  Play,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer as EnhancedMarkdownRenderer } from './MarkdownRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocFiles = Record<string, string>;
interface TabConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}
interface TreeNode {
  name: string;
  type?: string;
  children?: TreeNode[];
}

// ─── Tab Registry ─────────────────────────────────────────────────────────────

const DIAGRAM_OPTIONS = [
  'System Architecture Diagram',
  'Component Diagram',
  'Module Dependency Graph',
  'Function Call Graph',
  'Sequence Diagram',
  'API Flow Diagram',
  'User Flow Diagram',
  'Data Flow Diagram',
  'Database ER Diagram',
  'Deployment Diagram',
];

const KNOWN_TABS: TabConfig[] = [
  { key: '__dashboard__', label: 'Dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" />, group: 'overview' },
  { key: 'README.md', label: 'README', icon: <BookOpen className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'adr.md', label: 'ADR', icon: <ScrollText className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'api-reference.md', label: 'API Ref', icon: <FileText className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'architecture.md', label: 'Architecture', icon: <Building2 className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'documentation-health.md', label: 'Health', icon: <Activity className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'api-descriptions.json', label: 'API JSON', icon: <FileJson className="h-3.5 w-3.5" />, group: 'data' },
  { key: 'doc_snapshot.json', label: 'Snapshot', icon: <Code2 className="h-3.5 w-3.5" />, group: 'data' },
  {
    key: 'architecture-graph.json',
    label: 'Architecture Graph',
    icon: <Share2 className="h-3.5 w-3.5" />,
    group: 'data',
  },
  ...DIAGRAM_OPTIONS.map((opt) => ({
    key: opt.replace(/\s+/g, '-').toLowerCase() + '-graph.json',
    label: opt,
    icon: <Share2 className="h-3.5 w-3.5" />,
    group: 'diagrams',
  })),
  { key: 'tree.txt', label: 'Tree', icon: <GitBranch className="h-3.5 w-3.5" />, group: 'structure' },
  { key: 'tree.json', label: 'Tree Visual', icon: <Share2 className="h-3.5 w-3.5" />, group: 'structure' },
];

const GROUP_LABELS: Record<string, string> = {
  overview: 'Overview',
  docs: 'Documentation',
  diagrams: 'Generated Diagrams',
  data: 'Data Files',
  structure: 'Structure',
};

const FILE_ICONS: Record<string, React.ReactNode> = {
  'README.md': <BookOpen className="h-4 w-4 text-emerald-400" />,
  'adr.md': <ScrollText className="h-4 w-4 text-blue-400" />,
  'api-reference.md': <FileText className="h-4 w-4 text-purple-400" />,
  'architecture.md': <Building2 className="h-4 w-4 text-yellow-400" />,
  'documentation-health.md': <Activity className="h-4 w-4 text-red-400" />,
  'api-descriptions.json': <FileJson className="h-4 w-4 text-cyan-400" />,
  'doc_snapshot.json': <Code2 className="h-4 w-4 text-indigo-400" />,
  'architecture-graph.json': <Share2 className="h-4 w-4 text-emerald-400" />,
  'tree.txt': <GitBranch className="h-4 w-4 text-teal-400" />,
  'tree.json': <Share2 className="h-4 w-4 text-orange-400" />,
};

const FILE_DESCRIPTIONS: Record<string, string> = {
  'README.md': 'Project overview, setup & usage guide',
  'adr.md': 'Architecture Decision Records',
  'api-reference.md': 'Full API reference documentation',
  'architecture.md': 'System design & diagrams',
  'documentation-health.md': 'Coverage report & quality score',
  'api-descriptions.json': 'Structured API endpoint definitions',
  'doc_snapshot.json': 'Project statistics snapshot',
  'architecture-graph.json': 'Interactive module & component relationships',
  'tree.txt': 'ASCII directory tree',
  'tree.json': 'Interactive visual file tree',
};

DIAGRAM_OPTIONS.forEach((opt) => {
  const key = opt.replace(/\s+/g, '-').toLowerCase() + '-graph.json';
  FILE_ICONS[key] = <Share2 className="h-4 w-4 text-emerald-400" />;
  FILE_DESCRIPTIONS[key] = `Interactive visualization for ${opt}`;
});

// ─── Diagram Generator Component ──────────────────────────────────────────────

function DiagramGeneratorPanel({
  repoUrl,
  providerInfo,
  onDiagramGenerated,
}: {
  repoUrl: string;
  providerInfo: any;
  onDiagramGenerated: (dType: string, content: string) => void;
}) {
  const [loadingContext, setLoadingContext] = useState(false);
  const [recommended, setRecommended] = useState<string[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchRecommendations = async () => {
    try {
      setLoadingContext(true);
      const res = await mcpRecommendDiagrams(repoUrl, providerInfo);
      if (res.recommended) {
        let parsed = JSON.parse(res.recommended);
        if (!Array.isArray(parsed) && parsed.recommended) {
          parsed = parsed.recommended;
        }
        setRecommended(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      toast.error('Failed to get recommendations. Ensure backend AI providers are configured.');
    } finally {
      setLoadingContext(false);
    }
  };

  const handleGenerate = async (dType: string) => {
    try {
      setGenerating(dType);
      const res = await mcpGenerateDiagram(repoUrl, dType, providerInfo);
      const fileName = dType.replace(/\s+/g, '-').toLowerCase() + '-graph.json';
      onDiagramGenerated(fileName, JSON.stringify(res.graph, null, 2));
    } catch (e: any) {
      toast.error(`Failed to generate ${dType}: ${e.message}`);
    } finally {
      setGenerating(null);
    }
  };

  // Divide options purely by recommendation state
  const recommendedOptions = DIAGRAM_OPTIONS.filter((opt) => recommended.includes(opt));
  const otherOptions = DIAGRAM_OPTIONS.filter((opt) => !recommended.includes(opt));

  // If we have recommended options, we default to hiding the rest unless explicitly asked to show
  const displayOther = recommendedOptions.length === 0 || showAll;

  const renderCard = (opt: string, isRec: boolean) => {
    const isGen = generating === opt;
    return (
      <div
        key={opt}
        className={`p-4 rounded-xl border flex flex-col items-start gap-4 transition-all ${isRec ? 'bg-emerald-500/[0.04] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'bg-white/[0.02] border-white/5 hover:border-white/20'}`}
      >
        <div className="flex items-start justify-between w-full">
          <div className="flex items-center gap-2">
            <Share2 className={`h-4 w-4 ${isRec ? 'text-emerald-400' : 'text-gray-500'}`} />
            <span className={`text-[11px] font-bold ${isRec ? 'text-emerald-300' : 'text-gray-300'}`}>{opt}</span>
          </div>
        </div>

        {isRec && (
          <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Recommended
          </span>
        )}

        <button
          onClick={() => handleGenerate(opt)}
          disabled={isGen || loadingContext}
          className={`mt-auto w-full py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all flex justify-center items-center gap-2 ${isRec ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
        >
          {isGen ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {isGen ? 'Generating...' : 'Generate'}
        </button>
      </div>
    );
  };

  return (
    <div className="mt-8 bg-[#111111] border border-white/5 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -ml-[250px] -mt-[250px] pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-emerald-500" />
            Architecture Diagram Generator
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Let the AI analyze your codebase and recommend the most valuable topology diagrams.
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loadingContext}
          className="flex items-center justify-center gap-2 px-6 h-10 bg-emerald-500 border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap"
        >
          {loadingContext ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loadingContext
            ? 'Analyzing Codebase...'
            : recommended.length > 0
              ? 'Re-Analyze Codebase'
              : 'Recommend Diagrams'}
        </button>
      </div>

      <div className="relative z-10 space-y-8">
        {recommendedOptions.length > 0 && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <h4 className="text-[10px] font-bold text-emerald-500 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Sparkles className="h-3 w-3" />
              AI Recommended for this Project
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedOptions.map((opt) => renderCard(opt, true))}
            </div>
          </div>
        )}

        {!displayOther && recommendedOptions.length > 0 && (
          <div className="flex justify-center -mt-2">
            <button
              onClick={() => setShowAll(true)}
              className="px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-bold text-gray-400 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <ChevronDown className="h-3 w-3" />
              Show Extra Diagram Options ({otherOptions.length})
            </button>
          </div>
        )}

        {displayOther && (
          <div>
            <h4 className="text-[10px] font-bold text-gray-500 mb-4 uppercase tracking-widest pl-1">
              {recommendedOptions.length > 0 ? 'Other Available Diagrams' : 'All Available Diagrams'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {otherOptions.map((opt) => renderCard(opt, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({
  docFiles,
  onNavigate,
  repoUrl,
  providerInfo,
  providerInfoObj,
  onDiagramGenerated,
}: {
  docFiles: DocFiles;
  onNavigate: (key: string) => void;
  repoUrl: string;
  providerInfo: string;
  providerInfoObj: any;
  onDiagramGenerated: (dType: string, content: string) => void;
}) {
  const fileKeys = Object.keys(docFiles);
  const totalChars = Object.values(docFiles).reduce((a, v) => a + v.length, 0);

  let healthScore: number | null = null;
  const healthContent = docFiles['documentation-health.md'];
  if (healthContent) {
    const m = healthContent.match(/(\d{1,3})\s*(?:\/\s*100|%|out of 100)/i);
    if (m) healthScore = Math.min(100, parseInt(m[1]));
  }

  const docColor =
    healthScore == null ? '#10b981' : healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const healthLabel =
    healthScore == null
      ? 'N/A'
      : healthScore >= 80
        ? 'Excellent'
        : healthScore >= 60
          ? 'Good'
          : healthScore >= 40
            ? 'Fair'
            : 'Needs Work';

  const availableDocs = KNOWN_TABS.filter((t) => t.key !== '__dashboard__' && docFiles[t.key]);

  // Group files by extension
  const markdownDocs = availableDocs.filter((t) => t.key.endsWith('.md'));
  const jsonDocs = availableDocs.filter((t) => t.key.endsWith('.json'));
  const otherDocs = availableDocs.filter((t) => !t.key.endsWith('.md') && !t.key.endsWith('.json'));

  const renderFileGrid = (docs: TabConfig[], title: string, subtitle: string) => {
    if (docs.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{title}</h4>
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[9px] text-gray-700 font-mono">{docs.length} files</span>
        </div>
        <p className="text-[10px] text-gray-600 -mt-1 mb-2">{subtitle}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className="group flex items-start gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] group-hover:bg-emerald-500/[0.03] transition-colors rounded-bl-[100px]" />
              <div className="w-10 h-10 rounded-lg bg-black border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                {FILE_ICONS[tab.key]}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition-colors">
                  {tab.key}
                </h4>
                <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">{FILE_DESCRIPTIONS[tab.key]}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] font-mono text-gray-700">
                    {docFiles[tab.key]?.length.toLocaleString()} chars
                  </span>
                  <div className="w-1 h-1 rounded-full bg-gray-800" />
                  <span className="text-[9px] text-gray-700 uppercase">{tab.group}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-800 group-hover:text-emerald-500 mt-3 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/5 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Documentation Ready</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 truncate">{repoUrl.split('/').pop()}</h2>
            <p className="text-xs text-gray-500 mb-6 truncate opacity-70">{repoUrl}</p>

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[9px] uppercase text-gray-600 font-bold tracking-tighter">Files</p>
                <p className="text-lg font-mono text-white">{fileKeys.length}</p>
              </div>
              <div className="space-y-1 border-l border-white/5 pl-6">
                <p className="text-[9px] uppercase text-gray-600 font-bold tracking-tighter">Content</p>
                <p className="text-lg font-mono text-white">{(totalChars / 1024).toFixed(1)}K chars</p>
              </div>
              <div className="space-y-1 border-l border-white/5 pl-6">
                <p className="text-[9px] uppercase text-gray-600 font-bold tracking-tighter">Provider</p>
                <p className="text-[10px] font-bold text-purple-400 truncate mt-2">{providerInfo}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={docColor}
                  strokeWidth="2.5"
                  strokeDasharray={`${healthScore || 0} ${100 - (healthScore || 0)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white tracking-tighter">{healthScore ?? '--'}</span>
                <span className="text-[8px] text-gray-500 uppercase tracking-widest">Score</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{healthLabel}</span>
          </div>
        </div>
      </div>

      {/* Files Grid - Grouped by Type */}
      <div className="space-y-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          Generated Files
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] font-mono">{fileKeys.length} total</span>
        </h3>

        {renderFileGrid(markdownDocs, 'Markdown Documentation', 'Human-readable documentation files')}
        {renderFileGrid(jsonDocs, 'JSON Data Files', 'Structured data and metadata files')}
        {renderFileGrid(otherDocs, 'Other Files', 'Additional documentation files')}
      </div>
      {/* Diagram Generator */}
      <DiagramGeneratorPanel repoUrl={repoUrl} providerInfo={providerInfoObj} onDiagramGenerated={onDiagramGenerated} />
    </div>
  );
}

// ─── ASCII Diagram Block ──────────────────────────────────────────────────────

function DiagramBlock({ lines }: { lines: string[] }) {
  return (
    <div className="my-4 rounded-lg border border-gray-700 bg-[#0a0a0a] overflow-hidden">
      <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Architecture Diagram</span>
        </div>
      </div>
      <div className="p-5">
        <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre overflow-x-auto">
          {lines.join('\n')}
        </pre>
      </div>
    </div>
  );
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

const CROSS_REF_RE =
  /(?:refer(?:ring)? to|see|check|view|found in|details? in|documented in)\s+[`"]?([a-z0-9_-]+\.(?:md|json|txt))[`"]?/i;
const FILE_LINK_RE = /\[([^\]]+)\]\(([a-z0-9_-]+\.(?:md|json|txt))\)/gi;

function isAsciiDiagram(lines: string[]) {
  if (lines.length < 3) return false;
  const diagChars = /[|+\-=<>v^]{2,}/;
  const matchCount = lines.filter((l) => diagChars.test(l)).length;
  return matchCount / lines.length > 0.4;
}

function isAsciiDiagramLine(line: string) {
  return /[|+\-]{2,}/.test(line) || /^\s*[<>v^]/.test(line);
}

function MarkdownRenderer({ content, onNavigate }: { content: string; onNavigate?: (tab: string) => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative group/md">
      <button
        onClick={() => {
          navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover/md:opacity-100 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-all z-10"
      >
        {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <EnhancedMarkdownRenderer content={content} />
    </div>
  );
}

// ─── Visual Components ────────────────────────────────────────────────────────

function ApiExplorer({ content }: { content: string }) {
  const [search, setSearch] = useState('');
  let data: any = {};
  try {
    data = JSON.parse(content);
  } catch {
    /* raw */
  }
  const endpoints: any[] = data.endpoints || [];
  const filtered = endpoints.filter(
    (ep: any) =>
      !search ||
      ep.path?.toLowerCase().includes(search.toLowerCase()) ||
      ep.description?.toLowerCase().includes(search.toLowerCase()),
  );
  const mc = (m: string) =>
    ({
      GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
      PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    })[m?.toUpperCase()] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-gray-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search API endpoints..."
          className="w-full bg-[#111] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/40 transition-colors"
        />
      </div>
      <div className="space-y-2.5">
        {filtered.map((ep, i) => (
          <div
            key={i}
            className="group border border-white/5 rounded-xl bg-[#0f0f0f] overflow-hidden hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-3 p-4">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${mc(ep.method)}`}>
                {ep.method || 'ANY'}
              </span>
              <span className="text-xs font-mono text-gray-200 flex-1 truncate">{ep.path}</span>
              <span className="text-[11px] text-gray-500 hidden md:block">{ep.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotDashboard({ content }: { content: string }) {
  let data: any = {};
  try {
    data = JSON.parse(content) || {};
  } catch (e) {
    console.error('[SnapshotDashboard] Failed to parse snapshot JSON:', e);
    data = {};
  }
  const stats = [
    {
      label: 'Total Files',
      val: data?.totalFiles || '--',
      icon: <FileText className="h-4 w-4" />,
      color: 'text-blue-400',
    },
    {
      label: 'Modules',
      val: Array.isArray(data?.modules) ? data.modules.length : '--',
      icon: <Package className="h-4 w-4" />,
      color: 'text-emerald-400',
    },
    {
      label: 'Coverage',
      val: `${((data?.coverage || 0) * 100).toFixed(0)}%`,
      icon: <Activity className="h-4 w-4" />,
      color: 'text-purple-400',
    },
    {
      label: 'Health',
      val: data?.health || 'Unknown',
      icon: <HeartPulse className="h-4 w-4" />,
      color: 'text-red-400',
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((s, i) => (
        <div key={i} className="p-4 rounded-xl bg-[#111] border border-white/5 flex flex-col items-center text-center">
          <div className={`${s.color} opacity-80 mb-2`}>{s.icon}</div>
          <span className="text-[10px] uppercase text-gray-600 font-bold mb-1 tracking-widest">{s.label}</span>
          <span className="text-lg font-bold text-white tracking-tighter">{s.val}</span>
        </div>
      ))}
    </div>
  );
}

function HeartPulse(props: any) {
  return <Activity {...props} />;
}

function TreeVisualizer({ content }: { content: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  let data: TreeNode | null = null;

  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error('[TreeVisualizer] Failed to parse tree.json:', e);
  }

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const Item = ({ node, depth, path }: { node: TreeNode; depth: number; path: string }) => {
    const id = path || node.name;
    const isDir = !!node.children && node.children.length > 0;
    const isExp = expanded[id] ?? depth === 0; // Root expanded by default

    return (
      <div className={depth > 0 ? 'ml-4' : ''}>
        <div
          onClick={() => isDir && toggle(id)}
          className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${
            isDir ? 'cursor-pointer hover:bg-white/5 text-gray-300' : 'text-gray-500'
          }`}
        >
          {isDir ? (
            isExp ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <div className="w-3" />
          )}
          {isDir ? (
            <Package className="h-3 w-3 text-emerald-400 opacity-60" />
          ) : (
            <FileText className="h-3 w-3 opacity-40" />
          )}
          <span className="text-[11px] font-mono">{node.name}</span>
        </div>
        {isDir &&
          isExp &&
          node.children?.map((child, idx) => {
            const childPath = path ? `${path}/${child.name}` : child.name;
            return <Item key={idx} node={child} depth={depth + 1} path={childPath} />;
          })}
      </div>
    );
  };

  if (!data || !data.name) {
    return (
      <div className="p-8 rounded-2xl bg-[#0a0a0a] border border-white/5 flex flex-col items-center justify-center gap-3 text-gray-600">
        <GitBranch className="h-8 w-8 opacity-20" />
        <p className="text-xs">No tree structure available</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/5 overflow-auto max-h-[600px]">
      <Item node={data} depth={0} path="" />
    </div>
  );
}

function ArchitectureVisualizer({ content }: { content: string }) {
  let data: { nodes: any[]; links: any[] } = { nodes: [], links: [] };
  try {
    const raw = JSON.parse(content);

    // Parse Cytoscape or generic format
    const rawNodes = raw.graph?.nodes || raw.nodes || [];
    const rawEdges = raw.graph?.links || raw.graph?.edges || raw.links || raw.edges || [];

    data.nodes = Array.isArray(rawNodes)
      ? rawNodes.map((n: any) => ({
          id: n?.data?.id || n?.id,
          label: n?.data?.label || n?.label,
          type: n?.data?.type || n?.type || 'module',
          ...n?.data,
          ...n,
        }))
      : [];

    data.links = Array.isArray(rawEdges)
      ? rawEdges.map((e: any) => ({
          source: e?.data?.source || e?.source,
          target: e?.data?.target || e?.target,
          label: e?.data?.relation || e?.data?.label || e?.relation || e?.label,
          ...e?.data,
          ...e,
        }))
      : [];
  } catch (e) {
    console.error('[ArchitectureVisualizer] Failed to parse JSON:', e);
  }

  const fgRef = useRef<any>();

  useEffect(() => {
    // Inject dynamic repulsion to allow nodes to breathe and break out of clustered square patterns
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-450).distanceMax(500);
      fgRef.current.d3Force('link').distance(90);
      fgRef.current.d3Force('collide', d3.forceCollide().radius(40));
    }
  }, [data]);

  // To make the canvas responsive, we track the container dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initial size
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth && clientHeight) setDimensions({ width: clientWidth, height: clientHeight });

    // Resize observer for dynamic adjustments
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[500px] w-full bg-[#080808] rounded-2xl border border-white/5 overflow-hidden relative group"
    >
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <h3 className="text-xs font-bold text-white flex items-center gap-2">
          <Share2 className="h-3 w-3 text-emerald-400" />
          Interactive System Graph
        </h3>
        <p className="text-[10px] text-gray-500">Drag to pan • Scroll to zoom</p>
      </div>
      {data.nodes.length > 0 ? (
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          dagMode="td"
          dagLevelDistance={100}
          nodeRelSize={14}
          nodeLabel={() => ''} // Disable default tooltip in favor of rich shapes
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.label || node.id;
            const typeText = (node.type || 'module').toUpperCase();

            // Font sizing
            const fontSize = Math.max(12 / globalScale, 2.5);
            const typeFontSize = Math.max(8 / globalScale, 1.5);

            // Measure widths
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            const textWidth = ctx.measureText(label).width;
            ctx.font = `bold ${typeFontSize}px Inter, sans-serif`;
            const typeWidth = ctx.measureText(typeText).width;

            // Card dimensions
            const width = Math.max(textWidth, typeWidth) + 24 / globalScale;
            const height = 36 / globalScale;

            const x = node.x - width / 2;
            const y = node.y - height / 2;

            const colors: Record<string, string> = {
              ui: '#ec4899',
              controller: '#f43f5e',
              service: '#3b82f6',
              api: '#8b5cf6',
              repository: '#eab308',
              database: '#f59e0b',
              module: '#10b981',
              function: '#6366f1',
              external: '#ef4444',
              utility: '#64748b',
              component: '#14b8a6',
              default: '#6b7280',
            };
            const color = colors[node.type?.toLowerCase()] || colors.default;

            const radius = 4 / globalScale;

            // Base shape (rounded rect)
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.arcTo(x + width, y, x + width, y + height, radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.arcTo(x + width, y + height, x, y + height, radius);
            ctx.lineTo(x + radius, y + height);
            ctx.arcTo(x, y + height, x, y, radius);
            ctx.lineTo(x, y + radius);
            ctx.arcTo(x, y, x + width, y, radius);
            ctx.closePath();

            ctx.fillStyle = '#111111';
            ctx.fill();

            ctx.lineWidth = 1.2 / globalScale;
            ctx.strokeStyle = color;
            ctx.stroke();

            // Type Ribbon Header
            ctx.save();
            ctx.clip(); // Constrain to rounded outline
            ctx.fillStyle = color + '22'; // slight highlight tint
            ctx.fillRect(x, y, width, 14 / globalScale);
            ctx.restore();

            // Render type text
            ctx.font = `bold ${typeFontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = color;
            ctx.fillText(typeText, node.x, y + 3 / globalScale);

            // Render node label
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, node.x, node.y + 2 / globalScale);
          }}
          linkColor={() => 'rgba(255, 255, 255, 0.2)'}
          linkWidth={1.5}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link: any, ctx, globalScale) => {
            const label = link.label;
            if (!label || globalScale < 0.8) return;

            const start = link.source;
            const end = link.target;
            if (typeof start !== 'object' || typeof end !== 'object') return;

            const textPos = {
              x: start.x + (end.x - start.x) / 2,
              y: start.y + (end.y - start.y) / 2,
            };

            const relLink = { x: end.x - start.x, y: end.y - start.y };
            let textAngle = Math.atan2(relLink.y, relLink.x);
            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
            if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

            const fontSize = Math.max(9 / globalScale, 2);
            ctx.font = `500 ${fontSize}px Inter, sans-serif`;

            ctx.save();
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(textAngle);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textWidth = ctx.measureText(label).width;
            const bgHeight = fontSize + 4 / globalScale;
            const padding = 4 / globalScale;

            ctx.fillStyle = 'rgba(8, 8, 8, 0.9)';
            ctx.beginPath();
            ctx.roundRect(
              -textWidth / 2 - padding,
              -bgHeight / 2 - padding / 2,
              textWidth + padding * 2,
              bgHeight,
              padding,
            );
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(label, 0, 0);
            ctx.restore();
          }}
          backgroundColor="#080808"
          width={dimensions.width}
          height={dimensions.height}
          d3VelocityDecay={0.2} // More dynamic bounce settling
        />
      ) : (
        <div className="h-full min-h-[500px] w-full flex flex-col items-center justify-center text-gray-700 gap-4">
          <Activity className="h-8 w-8 opacity-20" />
          <p className="text-xs">No graph data found in file.</p>
        </div>
      )}
    </div>
  );
}

function HealthReport({ content, onNavigate }: { content: string; onNavigate?: (tab: string) => void }) {
  const m = content.match(/(\d{1,3})\s*(?:\/\s*100|%|out of 100)/i);
  const score = m ? Math.min(100, parseInt(m[1])) : null;
  const color =
    score == null
      ? 'text-gray-400'
      : score >= 80
        ? 'text-emerald-400'
        : score >= 50
          ? 'text-yellow-400'
          : 'text-red-400';
  const ring = score == null ? '#374151' : score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-6">
      {score != null && (
        <div className="flex items-center gap-6 bg-[#111] rounded-2xl p-6 border border-white/5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke={ring}
                strokeWidth="2.5"
                strokeDasharray={`${score} ${100 - score}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${color}`}>{score}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1 tracking-widest">System Health Score</p>
            <p className={`text-2xl font-bold ${color}`}>
              {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Repair'}
            </p>
          </div>
        </div>
      )}
      <MarkdownRenderer content={content} onNavigate={onNavigate} />
    </div>
  );
}

// ─── Content Dispatcher ───────────────────────────────────────────────────────

function FileContent({
  filename,
  content,
  onNavigate,
}: {
  filename: string;
  content: string;
  onNavigate?: (tab: string) => void;
}) {
  if (filename === 'api-descriptions.json') return <ApiExplorer content={content} />;
  if (filename === 'doc_snapshot.json') return <SnapshotDashboard content={content} />;
  if (filename === 'architecture-graph.json' || filename.endsWith('-graph.json'))
    return <ArchitectureVisualizer content={content} />;
  if (filename === 'tree.json') return <TreeVisualizer content={content} />;
  if (filename === 'tree.txt')
    return (
      <div className="bg-[#0a0a0a] rounded-lg border border-gray-700 p-5">
        <pre className="text-xs font-mono text-gray-300 whitespace-pre leading-relaxed">{content}</pre>
      </div>
    );
  if (filename === 'documentation-health.md') return <HealthReport content={content} onNavigate={onNavigate} />;
  if (filename.endsWith('.json'))
    return (
      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed p-5 bg-[#0a0a0a] rounded-lg border border-gray-700">
        {(() => {
          try {
            return JSON.stringify(JSON.parse(content), null, 2);
          } catch {
            return content;
          }
        })()}
      </pre>
    );
  return <MarkdownRenderer content={content} onNavigate={onNavigate} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LivingWiki() {
  const providers = useStore(providersStore);
  const [repoUrl, setRepoUrl] = useState('');
  const [docFiles, setDocFiles] = useState<DocFiles | null>(null);
  const [activeTab, setActiveTab] = useState('__dashboard__');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>('');
  const [moduleInput, setModuleInput] = useState('');
  const [moduleDesc, setModuleDesc] = useState<string | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const recent = (repositoryHistoryStore as any).getRecentRepositories?.(1);
    if (recent?.length > 0) {
      const url = recent[0].url;
      setRepoUrl(url);
      try {
        const saved = sessionStorage.getItem('livingwiki:' + url);
        if (saved) {
          setDocFiles(JSON.parse(saved));
          setActiveTab('__dashboard__');
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const ep = Object.values(providers).find((p) => p.settings.enabled);
    if (ep) {
      const m = ep.settings.selectedModel || ep.staticModels?.[0]?.name || '';
      setProviderLabel(`${ep.name}${m ? ': ' + m : ''}`);
    }
  }, [providers]);

  const getProvider = () => {
    const ep = Object.values(providers).find((p) => p.settings.enabled);
    if (!ep) return undefined;
    return {
      name: ep.name,
      model: ep.settings.selectedModel || ep.staticModels?.[0]?.name || '',
      apiKey: ep.settings.apiKey || '',
      baseUrl: ep.settings.baseUrl || '',
    };
  };

  const generate = async () => {
    if (!repoUrl) {
      toast.error('No repository loaded.');
      return;
    }
    const prov = getProvider();
    if (!prov) {
      toast.error('No AI provider enabled.');
      return;
    }
    setLoading(true);
    setError(null);
    setDocFiles(null);
    try {
      toast.info(`Architecting wiki with ${prov.name}...`);
      const res = await mcpGetWiki(repoUrl, prov);
      let files: DocFiles = {};
      if (res.format === 'multiple-files' && typeof res.content === 'object') {
        files = res.content as DocFiles;
      } else if (typeof res.content === 'string') {
        files = { 'README.md': res.content };
      } else {
        throw new Error('Format error');
      }

      setDocFiles(files);
      setActiveTab('__dashboard__');
      try {
        sessionStorage.setItem('livingwiki:' + repoUrl, JSON.stringify(files));
      } catch {
        /* ignore */
      }
      toast.success('Documentation Generated');
    } catch (err: any) {
      const msg = err?.message || 'Error';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = () => {
    if (!docFiles) return;
    Object.entries(docFiles).forEach(([n, c]) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([c], { type: 'text/plain' }));
      a.download = n;
      a.click();
    });
    toast.success('Downloading all files...');
  };

  const exportPdf = useCallback(() => {
    if (!docFiles) return;
    const content = activeTab === '__dashboard__' ? '' : docFiles[activeTab] || '';
    const title = activeTab === '__dashboard__' ? 'Documentation Overview' : activeTab;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.7}
    h1{font-size:2rem;border-bottom:3px solid #10b981;padding-bottom:12px}h2{font-size:1.4rem;color:#059669;margin-top:2rem}h3{font-size:1.1rem;color:#374151}
    code,pre{background:#f5f5f5;border-radius:4px;font-family:"Courier New",monospace}code{padding:2px 6px;font-size:.85em}pre{padding:14px;overflow-x:auto}
    .hdr{background:linear-gradient(135deg,#059669,#10b981);color:white;padding:20px;border-radius:8px;margin-bottom:28px}
    .hdr h1{color:white;border:none;margin:0;font-size:1.4rem}
    @media print{.hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
    <body><div class="hdr"><h1>${title}</h1><p>${repoUrl}</p></div>
    <pre style="white-space:pre-wrap;font-family:inherit;background:none;padding:0">${content.replace(/</g, '&lt;')}</pre></body></html>`);
    w.document.close();
    w.onload = () => w.print();
    toast.info('Print dialog opened.');
  }, [docFiles, activeTab, repoUrl]);

  const currentContent = docFiles?.[activeTab] || '';
  const matchCount =
    searchQuery && currentContent
      ? (currentContent.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
      : 0;

  return (
    <div className="flex flex-col h-full bg-[#080808] text-white">
      {/* Top Header */}
      <div className="px-6 py-4 flex-shrink-0 bg-[#0c0c0c] border-b border-white/5 flex items-center justify-between shadow-2xl z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">System Knowledge Base</h2>
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">
              {providerLabel || 'Select an AI provider'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {docFiles && (
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5 mr-2">
              <button
                onClick={downloadAll}
                className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={exportPdf}
                className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading || !repoUrl}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyzing...' : 'Generate Wiki'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-white/5 flex flex-col bg-[#0b0b0b] group/side">
          <div className="p-4 space-y-6 flex-1 overflow-y-auto overflow-x-hidden">
            {Object.entries(GROUP_LABELS).map(([gid, label]) => {
              const groupTabs = KNOWN_TABS.filter(
                (t) => t.group === gid && (t.key === '__dashboard__' || (docFiles && docFiles[t.key])),
              );
              if (groupTabs.length === 0) return null;
              return (
                <div key={gid}>
                  <h4 className="px-3 text-[10px] font-bold text-gray-600 uppercase tracking-[2px] mb-3">{label}</h4>
                  <div className="space-y-1">
                    {groupTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${activeTab === tab.key ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border-transparent'}`}
                      >
                        <span className={activeTab === tab.key ? 'text-emerald-400' : 'text-gray-700'}>{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 mt-auto border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] border border-white/5 rounded-xl">
              <Activity className="h-3 w-3 text-emerald-500" />
              <div className="flex-1">
                <p className="text-[9px] font-bold text-white uppercase tracking-tighter">System Health</p>
                <div className="h-1 w-full bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#080808]">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === '__dashboard__' ? (
                  docFiles ? (
                    <DashboardView
                      docFiles={docFiles}
                      onNavigate={setActiveTab}
                      repoUrl={repoUrl}
                      providerInfo={providerLabel}
                      providerInfoObj={getProvider()}
                      onDiagramGenerated={(fileName, content) => {
                        setDocFiles((prev) => {
                          const newFiles = { ...prev, [fileName]: content };
                          try {
                            sessionStorage.setItem('livingwiki:' + repoUrl, JSON.stringify(newFiles));
                          } catch {
                            /* ignore */
                          }
                          return newFiles;
                        });
                        setActiveTab(fileName);
                        toast.success(`Generated ${fileName}`);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
                        <Sparkles className="h-8 w-8 text-emerald-500/40" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">Build a Knowledge Base</h3>
                      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                        Generate a living wiki to document your codebase automatically. It explores patterns,
                        architectural decisions, and system flows.
                      </p>
                      <div className="grid grid-cols-2 gap-3 w-full opacity-40">
                        {['README.md', 'Architecture', 'API Docs', 'ADRs'].map((f) => (
                          <div
                            key={f}
                            className="flex items-center gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-white">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          {FILE_ICONS[activeTab] || <FileText className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{activeTab}</h3>
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                            {FILE_DESCRIPTIONS[activeTab] || 'Detailed Documentation'}
                          </p>
                        </div>
                      </div>

                      {activeTab.endsWith('-graph.json') && (
                        <button
                          onClick={() => {
                            if (!docFiles) return;
                            const currentReadme =
                              docFiles['README.md'] ||
                              '# System Documentation\n\nThis project contains auto-generated documentation.';
                            const title = activeTab
                              .replace('-graph.json', '')
                              .split('-')
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(' ');

                            const diagramLink = `[View ${title} Interactive Graph](${activeTab})`;
                            if (currentReadme.includes(diagramLink) || currentReadme.includes(`](${activeTab})`)) {
                              toast.info('Diagram is already in the README!');
                              return;
                            }

                            const appendText = `\n\n### Diagram: ${title}\n${diagramLink}\n\n`;
                            const updatedReadme = currentReadme + appendText;

                            const newFiles = { ...docFiles, 'README.md': updatedReadme };
                            setDocFiles(newFiles);
                            try {
                              sessionStorage.setItem('livingwiki:' + repoUrl, JSON.stringify(newFiles));
                            } catch {
                              /* ignore */
                            }

                            toast.success(`${title} added to README!`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition-all shadow-lg shadow-blue-500/5"
                        >
                          <BookOpen className="h-3 w-3" />
                          Add to README
                        </button>
                      )}

                      {activeTab.endsWith('.md') && (
                        <div className="relative group">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-700" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search content..."
                            className="bg-[#111] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/30 w-32 md:w-48 transition-all"
                          />
                          {searchQuery && (
                            <div className="absolute -top-6 right-0 text-[10px] font-bold text-emerald-500 transition-all">
                              {matchCount} matches
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0c0c0c] border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl">
                      {currentContent ? (
                        <FileContent filename={activeTab} content={currentContent} onNavigate={setActiveTab} />
                      ) : (
                        <p className="text-gray-700 text-sm">No content generated for this file.</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
