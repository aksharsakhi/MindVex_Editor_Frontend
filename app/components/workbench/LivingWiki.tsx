/**
 * LivingWiki.tsx — Full documentation viewer with Dashboard, visual renderers, and PDF export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { mcpGetWiki, mcpDescribeModule } from '~/lib/mcp/mcpClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore } from '~/lib/stores/settings';
import { Button } from '~/components/ui/Button';
import {
  RefreshCw, Book, FileText, Package, Sparkles, FileJson,
  BookOpen, ScrollText, Download, Building2, Activity,
  GitBranch, Code2, Share2, ChevronRight, ChevronDown,
  Search, Copy, CheckCheck, Printer, X, Info, LayoutDashboard,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ForceGraph2D from 'react-force-graph-2d';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocFiles = Record<string, string>;
interface TabConfig { key: string; label: string; icon: React.ReactNode; group: string; }
interface TreeNode { name: string; type?: string; children?: TreeNode[]; }

// ─── Tab Registry ─────────────────────────────────────────────────────────────

const KNOWN_TABS: TabConfig[] = [
  { key: '__dashboard__', label: 'Dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" />, group: 'overview' },
  { key: 'README.md', label: 'README', icon: <BookOpen className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'adr.md', label: 'ADR', icon: <ScrollText className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'api-reference.md', label: 'API Ref', icon: <FileText className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'architecture.md', label: 'Architecture', icon: <Building2 className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'documentation-health.md', label: 'Health', icon: <Activity className="h-3.5 w-3.5" />, group: 'docs' },
  { key: 'api-descriptions.json', label: 'API JSON', icon: <FileJson className="h-3.5 w-3.5" />, group: 'data' },
  { key: 'doc_snapshot.json', label: 'Snapshot', icon: <Code2 className="h-3.5 w-3.5" />, group: 'data' },
  { key: 'architecture-graph.json', label: 'Architecture Graph', icon: <Share2 className="h-3.5 w-3.5" />, group: 'data' },
  { key: 'tree.txt', label: 'Tree', icon: <GitBranch className="h-3.5 w-3.5" />, group: 'structure' },
  { key: 'tree.json', label: 'Tree Visual', icon: <Share2 className="h-3.5 w-3.5" />, group: 'structure' },
];

const GROUP_LABELS: Record<string, string> = {
  overview: 'Overview',
  docs: 'Documentation',
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

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ docFiles, onNavigate, repoUrl, providerInfo }: {
  docFiles: DocFiles;
  onNavigate: (key: string) => void;
  repoUrl: string;
  providerInfo: string;
}) {
  const fileKeys = Object.keys(docFiles);
  const totalChars = Object.values(docFiles).reduce((a, v) => a + v.length, 0);

  let healthScore: number | null = null;
  const healthContent = docFiles['documentation-health.md'];
  if (healthContent) {
    const m = healthContent.match(/(\d{1,3})\s*(?:\/\s*100|%|out of 100)/i);
    if (m) healthScore = Math.min(100, parseInt(m[1]));
  }

  const docColor = healthScore == null ? '#10b981'
    : healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const healthLabel = healthScore == null ? 'N/A'
    : healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Work';

  const availableDocs = KNOWN_TABS.filter(t => t.key !== '__dashboard__' && docFiles[t.key]);

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
                <circle cx="18" cy="18" r="16" fill="none" stroke={docColor} strokeWidth="2.5"
                  strokeDasharray={`${healthScore || 0} ${100 - (healthScore || 0)}`} strokeLinecap="round" className="transition-all duration-1000" />
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

      {/* Files Grid */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          Generated Files
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] font-mono">{fileKeys.length} items</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
          {availableDocs.map(tab => (
            <button key={tab.key} onClick={() => onNavigate(tab.key)}
              className="group flex items-start gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] group-hover:bg-emerald-500/[0.03] transition-colors rounded-bl-[100px]" />
              <div className="w-10 h-10 rounded-lg bg-black border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                {FILE_ICONS[tab.key]}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition-colors">{tab.key}</h4>
                <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">{FILE_DESCRIPTIONS[tab.key]}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] font-mono text-gray-700">{docFiles[tab.key]?.length.toLocaleString()} chars</span>
                  <div className="w-1 h-1 rounded-full bg-gray-800" />
                  <span className="text-[9px] text-gray-700 uppercase">{tab.group}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-800 group-hover:text-emerald-500 mt-3 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ASCII Diagram Block ──────────────────────────────────────────────────────

function DiagramBlock({ lines }: { lines: string[] }) {
  return (
    <div className="my-6 rounded-2xl overflow-hidden border border-emerald-500/20 bg-[#080808] shadow-2xl shadow-emerald-500/5 group/diag">
      <div className="flex items-center justify-between px-5 py-3 bg-emerald-500/5 border-b border-emerald-500/10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">System Architecture Diagram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-emerald-500/50 font-bold uppercase">Visual Rendering Active</span>
        </div>
      </div>
      <div className="relative p-6 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0%,transparent_100%)]">
        <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed whitespace-pre overflow-x-auto scrollbar-hide">
          {lines.join('\n')}
        </pre>
        {/* Subtle decorative grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#10b981 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      </div>
    </div>
  );
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────

const CROSS_REF_RE = /(?:refer(?:ring)? to|see|check|view|found in|details? in|documented in)\s+[`"]?([a-z0-9_-]+\.(?:md|json|txt))[`"]?/i;
const FILE_LINK_RE = /\[([^\]]+)\]\(([a-z0-9_-]+\.(?:md|json|txt))\)/gi;

function isAsciiDiagram(lines: string[]) {
  if (lines.length < 3) return false;
  const diagChars = /[|+\-=<>v^]{2,}/;
  const matchCount = lines.filter(l => diagChars.test(l)).length;
  return (matchCount / lines.length) > 0.4;
}

function isAsciiDiagramLine(line: string) {
  return /[|+\-]{2,}/.test(line) || /^\s*[<>v^]/.test(line);
}

function MarkdownRenderer({ content, onNavigate }: { content: string; onNavigate?: (tab: string) => void }) {
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let diagLines: string[] = [];
  const elements: React.ReactNode[] = [];

  const flush = (key: string) => {
    if (isAsciiDiagram(codeLines)) {
      elements.push(<DiagramBlock key={key} lines={codeLines} />);
    } else {
      elements.push(
        <div key={key} className="my-5 rounded-xl overflow-hidden border border-white/10 shadow-lg group/code">
          <div className="bg-[#151515] px-4 py-2 text-[10px] text-gray-500 font-bold font-mono border-b border-white/5 flex items-center justify-between">
            <span className="uppercase tracking-widest">{codeLang || 'code'}</span>
            <Code2 className="h-3 w-3 opacity-20" />
          </div>
          <pre className="bg-[#0b0b0b] p-5 text-xs text-emerald-300/90 font-mono overflow-x-auto leading-relaxed whitespace-pre scrollbar-hide">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
    }
    codeLines = []; codeLang = '';
  };

  const flushDiag = (key: string) => {
    if (diagLines.length >= 2) elements.push(<DiagramBlock key={key} lines={diagLines} />);
    else if (diagLines.length) elements.push(<pre key={key} className="text-xs font-mono text-gray-400 whitespace-pre ml-4">{diagLines.join('\n')}</pre>);
    diagLines = [];
  };

  const renderInline = (text: string, key: string | number) => {
    if (onNavigate) {
      if (text.includes('architecture-graph.json')) {
        const idx = text.indexOf('architecture-graph.json');
        return (
          <span key={key}>
            {text.slice(0, idx)}
            <button onClick={() => onNavigate('architecture-graph.json')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold mx-1 transition-all shadow-lg shadow-emerald-500/5 group">
              <Share2 className="h-3 w-3 group-hover:scale-110 transition-transform" />
              View Interactive Graph
            </button>
            {text.slice(idx + 'architecture-graph.json'.length)}
          </span>
        );
      }

      const m = text.match(CROSS_REF_RE);
      if (m) {
        const ref = m[1];
        const idx = text.indexOf(m[0]);
        return (
          <span key={key}>
            {text.slice(0, idx)}
            <button onClick={() => onNavigate(ref)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-mono mx-1 transition-colors">
              <FileText className="h-2.5 w-2.5" />{ref}
            </button>
            {text.slice(idx + m[0].length)}
          </span>
        );
      }

      if (FILE_LINK_RE.test(text)) {
        FILE_LINK_RE.lastIndex = 0;
        const pts: React.ReactNode[] = [];
        let cur = 0; let m2;
        while ((m2 = FILE_LINK_RE.exec(text)) !== null) {
          pts.push(text.slice(cur, m2.index));
          const [, label, file] = m2;
          pts.push(
            <button key={m2.index} onClick={() => onNavigate(file)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 text-[10px] font-mono mx-0.5 transition-colors">
              <FileText className="h-2.5 w-2.5" />{label}
            </button>
          );
          cur = FILE_LINK_RE.lastIndex;
        }
        pts.push(text.slice(cur));
        return <span key={key}>{pts}</span>;
      }
    }

    const segs = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {segs.map((s, j) => {
          if (s.startsWith('**') && s.endsWith('**')) return <strong key={j} className="text-gray-200 font-semibold">{s.slice(2, -2)}</strong>;
          if (s.startsWith('`') && s.endsWith('`')) return <code key={j} className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-emerald-400 text-xs font-mono border border-white/5">{s.slice(1, -1)}</code>;
          return s;
        })}
      </span>
    );
  };

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (diagLines.length) flushDiag(`diag-${i}`);
      if (inCode) { inCode = false; flush(`code-${i}`); }
      else { inCode = true; codeLang = line.slice(3).trim(); }
      return;
    }
    if (inCode) { codeLines.push(line); return; }

    if (isAsciiDiagramLine(line) && line.trim()) {
      diagLines.push(line);
      return;
    } else if (diagLines.length) {
      flushDiag(`diag-${i}`);
    }

    if (line.startsWith('# ')) return elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-8 mb-6 pb-4 border-b border-white/10 tracking-tight">{line.slice(2)}</h1>);
    if (line.startsWith('## ')) return elements.push(<h2 key={i} className="text-base font-bold text-white mt-10 mb-4 flex items-center gap-3"><div className="w-1.5 h-5 bg-emerald-500 rounded-full flex-shrink-0" />{line.slice(3)}</h2>);
    if (line.startsWith('### ')) return elements.push(<h3 key={i} className="text-sm font-semibold text-emerald-400 mt-6 mb-3">{line.slice(4)}</h3>);
    if (line.startsWith('#### ')) return elements.push(<h4 key={i} className="text-xs font-semibold text-gray-300 mt-4 mb-2">{line.slice(5)}</h4>);

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return elements.push(
        <div key={i} className="flex items-start gap-3 ml-4 text-gray-300 text-[13px] mb-2 leading-relaxed">
          <span className="text-emerald-500 mt-1 flex-shrink-0 text-[10px] animate-pulse">▶</span>
          <span className="flex-1">{renderInline(line.slice(2), i)}</span>
        </div>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.*)/);
      if (m) return elements.push(
        <div key={i} className="flex gap-3 ml-4 mb-2 text-[13px] text-gray-300 leading-relaxed">
          <span className="text-emerald-500 font-mono text-[11px] mt-0.5 flex-shrink-0 w-5">{m[1]}.</span>
          <span className="flex-1">{renderInline(m[2], i)}</span>
        </div>
      );
    }
    if (line.startsWith('> ')) return elements.push(<blockquote key={i} className="ml-4 pl-4 border-l-2 border-emerald-500/20 text-gray-500 text-[13px] italic my-4 py-1 bg-white/[0.02] rounded-r-lg">{line.slice(2)}</blockquote>);
    if (/^---+$/.test(line.trim())) return elements.push(<hr key={i} className="border-white/5 my-8" />);
    if (line.trim() === '') return elements.push(<div key={i} className="h-4" />);

    elements.push(<p key={i} className="text-gray-400 text-[13px] leading-relaxed mb-3">{renderInline(line, i)}</p>);
  });

  if (inCode && codeLines.length) flush('code-final');
  if (diagLines.length) flushDiag('diag-final');

  return (
    <div className="relative group/md">
      <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-0 right-0 opacity-0 group-hover/md:opacity-100 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-all z-10">
        {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <div className="pr-2">{elements}</div>
    </div>
  );
}

// ─── Visual Components ────────────────────────────────────────────────────────

function ApiExplorer({ content }: { content: string }) {
  const [search, setSearch] = useState('');
  let data: any = {};
  try { data = JSON.parse(content); } catch { /* raw */ }
  const endpoints: any[] = data.endpoints || [];
  const filtered = endpoints.filter((ep: any) =>
    !search || ep.path?.toLowerCase().includes(search.toLowerCase()) || ep.description?.toLowerCase().includes(search.toLowerCase())
  );
  const mc = (m: string) => ({ GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30', PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', DELETE: 'bg-red-500/20 text-red-400 border-red-500/30', PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }[m?.toUpperCase()] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search API endpoints..."
          className="w-full bg-[#111] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/40 transition-colors" />
      </div>
      <div className="space-y-2.5">
        {filtered.map((ep, i) => (
          <div key={i} className="group border border-white/5 rounded-xl bg-[#0f0f0f] overflow-hidden hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 p-4">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${mc(ep.method)}`}>{ep.method || 'ANY'}</span>
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
  try { data = JSON.parse(content); } catch { /* raw */ }
  const stats = [
    { label: 'Total Files', val: data.totalFiles || '--', icon: <FileText className="h-4 w-4" />, color: 'text-blue-400' },
    { label: 'Modules', val: data.modules?.length || '--', icon: <Package className="h-4 w-4" />, color: 'text-emerald-400' },
    { label: 'Coverage', val: `${((data.coverage || 0) * 100).toFixed(0)}%`, icon: <Activity className="h-4 w-4" />, color: 'text-purple-400' },
    { label: 'Health', val: data.health || 'Unknown', icon: <HeartPulse className="h-4 w-4" />, color: 'text-red-400' },
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

function HeartPulse(props: any) { return <Activity {...props} />; }

function TreeVisualizer({ content }: { content: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'root': true });
  let data: TreeNode = { name: 'root', children: [] };
  try { data = JSON.parse(content); } catch { /* raw */ }

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const Item = ({ node, depth, p }: { node: TreeNode; depth: number; p: string }) => {
    const id = `${p}/${node.name}`;
    const isDir = !!node.children;
    const isExp = expanded[id];
    return (
      <div className="ml-4">
        <div onClick={() => isDir && toggle(id)} className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors ${isDir ? 'text-gray-300' : 'text-gray-500'}`}>
          {isDir ? (isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <div className="w-3" />}
          {isDir ? <Package className="h-3 w-3 text-emerald-400 opacity-60" /> : <FileText className="h-3 w-3 opacity-40" />}
          <span className="text-[11px] font-mono">{node.name}</span>
        </div>
        {isDir && isExp && node.children?.map((c, i) => <Item key={i} node={c} depth={depth + 1} p={id} />)}
      </div>
    );
  };

  return <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/5"><Item node={data} depth={0} p="" /></div>;
}

function ArchitectureVisualizer({ content }: { content: string }) {
  let data: any = { nodes: [], edges: [] };
  try {
    const raw = JSON.parse(content);
    data = raw.nodes ? raw : (raw.graph || { nodes: [], edges: [] });
  } catch { /* ignore */ }

  const fgRef = useRef<any>();

  return (
    <div className="h-[500px] w-full bg-[#080808] rounded-2xl border border-white/5 overflow-hidden relative group">
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
          nodeLabel="label"
          nodeColor={n => (n as any).type === 'module' ? '#10b981' : (n as any).type === 'component' ? '#3b82f6' : '#6b7280'}
          linkColor={() => 'rgba(255, 255, 255, 0.08)'}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          nodeRelSize={6}
          backgroundColor="#080808"
          width={800}
          height={500}
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-gray-700 gap-4">
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
  const color = score == null ? 'text-gray-400' : score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const ring = score == null ? '#374151' : score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-6">
      {score != null && (
        <div className="flex items-center gap-6 bg-[#111] rounded-2xl p-6 border border-white/5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="16" fill="none" stroke={ring} strokeWidth="2.5"
                strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><span className={`text-lg font-bold ${color}`}>{score}</span></div>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1 tracking-widest">System Health Score</p>
            <p className={`text-2xl font-bold ${color}`}>{score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Repair'}</p>
          </div>
        </div>
      )}
      <MarkdownRenderer content={content} onNavigate={onNavigate} />
    </div>
  );
}

// ─── Content Dispatcher ───────────────────────────────────────────────────────

function FileContent({ filename, content, onNavigate }: { filename: string; content: string; onNavigate?: (tab: string) => void }) {
  if (filename === 'api-descriptions.json') return <ApiExplorer content={content} />;
  if (filename === 'doc_snapshot.json') return <SnapshotDashboard content={content} />;
  if (filename === 'architecture-graph.json') return <ArchitectureVisualizer content={content} />;
  if (filename === 'tree.json') return <TreeVisualizer content={content} />;
  if (filename === 'tree.txt') return <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6 shadow-inner"><pre className="text-xs font-mono text-emerald-300/80 whitespace-pre leading-loose">{content}</pre></div>;
  if (filename === 'documentation-health.md') return <HealthReport content={content} onNavigate={onNavigate} />;
  if (filename.endsWith('.json')) return <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed p-6 bg-[#0c0c0c] rounded-xl border border-white/5">{(() => { try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; } })()}</pre>;
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
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const ep = Object.values(providers).find(p => p.settings.enabled);
    if (ep) {
      const m = ep.settings.selectedModel || ep.staticModels?.[0]?.name || '';
      setProviderLabel(`${ep.name}${m ? ': ' + m : ''}`);
    }
  }, [providers]);

  const getProvider = () => {
    const ep = Object.values(providers).find(p => p.settings.enabled);
    if (!ep) return undefined;
    return { name: ep.name, model: ep.settings.selectedModel || ep.staticModels?.[0]?.name || '', apiKey: ep.settings.apiKey || '', baseUrl: ep.settings.baseUrl || '' };
  };

  const generate = async () => {
    if (!repoUrl) { toast.error('No repository loaded.'); return; }
    const prov = getProvider();
    if (!prov) { toast.error('No AI provider enabled.'); return; }
    setLoading(true); setError(null); setDocFiles(null);
    try {
      toast.info(`Architecting wiki with ${prov.name}...`);
      const res = await mcpGetWiki(repoUrl, prov);
      let files: DocFiles = {};
      if (res.format === 'multiple-files' && typeof res.content === 'object') {
        files = res.content as DocFiles;
      } else if (typeof res.content === 'string') {
        files = { 'README.md': res.content };
      } else { throw new Error('Format error'); }

      setDocFiles(files);
      setActiveTab('__dashboard__');
      try { sessionStorage.setItem('livingwiki:' + repoUrl, JSON.stringify(files)); } catch { /* ignore */ }
      toast.success('Documentation Generated');
    } catch (err: any) {
      const msg = err?.message || 'Error';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const downloadAll = () => {
    if (!docFiles) return;
    Object.entries(docFiles).forEach(([n, c]) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([c], { type: 'text/plain' }));
      a.download = n; a.click();
    });
    toast.success('Downloading all files...');
  };

  const exportPdf = useCallback(() => {
    if (!docFiles) return;
    const content = activeTab === '__dashboard__' ? '' : (docFiles[activeTab] || '');
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
    w.document.close(); w.onload = () => w.print();
    toast.info('Print dialog opened.');
  }, [docFiles, activeTab, repoUrl]);

  const currentContent = docFiles?.[activeTab] || '';
  const matchCount = searchQuery && currentContent ? (currentContent.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length : 0;

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
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">{providerLabel || 'Select an AI provider'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {docFiles && (
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5 mr-2">
              <button onClick={downloadAll} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"><Download className="h-4 w-4" /></button>
              <button onClick={exportPdf} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"><Printer className="h-4 w-4" /></button>
            </div>
          )}
          <button onClick={generate} disabled={loading || !repoUrl}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-500/20">
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
              const groupTabs = KNOWN_TABS.filter(t => t.group === gid && (t.key === '__dashboard__' || (docFiles && docFiles[t.key])));
              if (groupTabs.length === 0) return null;
              return (
                <div key={gid}>
                  <h4 className="px-3 text-[10px] font-bold text-gray-600 uppercase tracking-[2px] mb-3">{label}</h4>
                  <div className="space-y-1">
                    {groupTabs.map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${activeTab === tab.key ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border-transparent'}`}>
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
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {activeTab === '__dashboard__' ? (
                  docFiles ? <DashboardView docFiles={docFiles} onNavigate={setActiveTab} repoUrl={repoUrl} providerInfo={providerLabel} /> : (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-6">
                        <Sparkles className="h-8 w-8 text-emerald-500/40" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">Build a Knowledge Base</h3>
                      <p className="text-sm text-gray-500 mb-8 leading-relaxed">Generate a living wiki to document your codebase automatically. It explores patterns, architectural decisions, and system flows.</p>
                      <div className="grid grid-cols-2 gap-3 w-full opacity-40">
                        {['README.md', 'Architecture', 'API Docs', 'ADRs'].map(f => (
                          <div key={f} className="flex items-center gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
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
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest">{FILE_DESCRIPTIONS[activeTab] || 'Detailed Documentation'}</p>
                        </div>
                      </div>

                      {activeTab.endsWith('.md') && (
                        <div className="relative group">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-700" />
                          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search content..."
                            className="bg-[#111] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/30 w-32 md:w-48 transition-all" />
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
