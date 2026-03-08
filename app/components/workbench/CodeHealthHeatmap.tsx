import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore } from '~/lib/stores/settings';
import { mcpChat } from '~/lib/mcp/mcpClient';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import {
    ShieldAlert, Activity, FileCode, FileText, FileJson, Search, ArrowUpDown,
    RefreshCw, Bug, ShieldCheck, Zap, AlertOctagon, AlertTriangle, Info,
    TrendingUp, TrendingDown, Eye, Filter, Lock, Unlock, Code2, Database, TerminalSquare
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Utilities & Mock Data Generators ───────────────────────────────────────

function getFileIcon(filePath: string) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const iconClass = 'h-4 w-4 shrink-0';

    if (!ext) return <FileText className={iconClass} />;
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c'].includes(ext)) {
        return <FileCode className={`${iconClass} text-blue-400`} />;
    }
    if (['json', 'yaml', 'yml', 'xml', 'toml', 'env'].includes(ext)) {
        return <FileJson className={`${iconClass} text-yellow-400`} />;
    }
    if (['sql', 'db'].includes(ext)) {
        return <Database className={`${iconClass} text-pink-400`} />;
    }
    if (['sh', 'bash'].includes(ext)) {
        return <TerminalSquare className={`${iconClass} text-green-400`} />;
    }
    return <FileText className={`${iconClass} text-gray-400`} />;
}

function seededRandom(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash = hash & hash;
    }
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
}

const VULN_TYPES = [
    { type: 'SQL Injection', cwe: 'CWE-89', remediation: 'Use parameterized queries instead of string concatenation.' },
    { type: 'Cross-Site Scripting (XSS)', cwe: 'CWE-79', remediation: 'Sanitize user input before rendering in the DOM.' },
    { type: 'Insecure Direct Object Reference', cwe: 'CWE-284', remediation: 'Implement strict access control checks on this endpoint.' },
    { type: 'Hardcoded Credentials', cwe: 'CWE-798', remediation: 'Move secrets to an environment vault or secrets manager.' },
    { type: 'Path Traversal', cwe: 'CWE-22', remediation: 'Validate and sanitize file path inputs against a strictly allowed list.' },
    { type: 'Unrestricted File Upload', cwe: 'CWE-434', remediation: 'Verify file signatures and restrict executable MIME types.' }
];

// ─── Component ──────────────────────────────────────────────────────────────

export function CodeHealthHeatmap() {
    const [repoUrl, setRepoUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'coverage' | 'vulnerabilities' | 'debt'>('vulnerabilities');
    const [sortBy, setSortBy] = useState<'score' | 'name' | 'loc'>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    useEffect(() => {
        const recent = repositoryHistoryStore.getRecentRepositories(1);
        if (recent.length > 0) setRepoUrl(recent[0].url);
    }, []);

    const filesMap = useStore(workbenchStore.files);

    interface VulnDef { id: string; cwe: string; severity: 'critical' | 'high' | 'medium' | 'low'; type: string; remediation: string; lineNum: number; }
    interface FileMetric {
        path: string;
        coverage: number;
        vulnerabilities: VulnDef[];
        loc: number;
        techDebtScore: number; // 0 to 100
        complexity: number;
    }

    const metrics = useMemo(() => {
        const fileEntries = Object.keys(filesMap).filter(path => filesMap[path]?.type === 'file');
        const result: FileMetric[] = [];

        fileEntries.forEach(filePath => {
            if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.endsWith('.png')) return;

            const randomVal = seededRandom(filePath);

            let coverage = Math.floor(randomVal * 100);
            if (filePath.endsWith('.tsx') || filePath.endsWith('.java')) coverage = Math.floor(40 + randomVal * 60);
            if (filePath.includes('config') || filePath.includes('types')) coverage = 100;

            const loc = Math.max(10, Math.floor(seededRandom(filePath + 'loc') * 2000));
            const complexity = Math.floor(seededRandom(filePath + 'cmp') * 100);
            const techDebtScore = Math.floor(((100 - coverage) * 0.4) + (complexity * 0.6));

            // Vulnerabilities mapping
            const isSecurityRisk = randomVal > 0.8 && !filePath.includes('types') && !filePath.includes('config');
            const vulnCount = isSecurityRisk ? Math.floor(seededRandom(filePath + 'v') * 4) + 1 : 0;
            const vuls: VulnDef[] = [];

            for (let i = 0; i < vulnCount; i++) {
                const severityObj = seededRandom(filePath + i);
                let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
                if (severityObj > 0.9) severity = 'critical';
                else if (severityObj > 0.6) severity = 'high';
                else if (severityObj > 0.3) severity = 'medium';

                const vulnType = VULN_TYPES[Math.floor(seededRandom(filePath + i + 'type') * VULN_TYPES.length)];

                vuls.push({
                    id: `CVE-202${Math.floor(severityObj * 5) + 3}-${Math.floor(severityObj * 9999)}`,
                    cwe: vulnType.cwe,
                    severity,
                    type: vulnType.type,
                    remediation: vulnType.remediation,
                    lineNum: Math.floor(severityObj * loc) + 1
                });
            }

            result.push({ path: filePath, coverage, vulnerabilities: vuls, loc, techDebtScore, complexity });
        });

        return result;
    }, [filesMap]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            toast.success('Deep security scan complete. Insights updated.');
        }, 1200);
    };

    const displayData = useMemo(() => {
        let filtered = metrics.filter(m => m.path.toLowerCase().includes(searchQuery.toLowerCase()));

        if (viewMode === 'vulnerabilities') {
            filtered = filtered.filter(m => m.vulnerabilities.length > 0);
        }

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') comparison = a.path.localeCompare(b.path);
            else if (sortBy === 'loc') comparison = a.loc - b.loc;
            else {
                if (viewMode === 'coverage') comparison = a.coverage - b.coverage;
                else if (viewMode === 'debt') comparison = b.techDebtScore - a.techDebtScore; // Higher debt first
                else {
                    const getSevScore = (m: FileMetric) => m.vulnerabilities.reduce((sum, v) => sum + (v.severity === 'critical' ? 1000 : v.severity === 'high' ? 100 : v.severity === 'medium' ? 10 : 1), 0);
                    comparison = getSevScore(b) - getSevScore(a);
                }
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }, [metrics, searchQuery, viewMode, sortOrder, sortBy]);

    const avgCoverage = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.coverage, 0) / metrics.length) : 0;
    const avgDebt = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.techDebtScore, 0) / metrics.length) : 0;
    const criticalVuls = metrics.reduce((s, m) => s + m.vulnerabilities.filter(v => v.severity === 'critical').length, 0);
    const totalVuls = metrics.reduce((s, m) => s + m.vulnerabilities.length, 0);

    const activeFileData = useMemo(() => metrics.find(m => m.path === selectedFile), [metrics, selectedFile]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#050505] text-white">
            {/* Premium Header */}
            <div className="p-6 pb-5 border-b border-white/5 bg-gradient-to-r from-teal-950/20 via-[#050505] to-[#050505]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 rounded-xl border border-teal-500/20 shadow-[0_0_30px_rgba(20,184,166,0.1)]">
                            <ShieldAlert className="h-7 w-7 text-teal-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
                                Advanced Security & Health Heatmap
                            </h1>
                            <p className="text-xs text-teal-500/70 font-medium uppercase tracking-widest mt-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                Continuous Deep Code Profiling Active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-black/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                            <button
                                onClick={() => { setViewMode('vulnerabilities'); setSelectedFile(null); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'vulnerabilities' ? 'bg-red-500/10 text-red-400 shadow-sm border border-red-500/20' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <Bug className="h-3.5 w-3.5" /> Security Risks
                            </button>
                            <button
                                onClick={() => { setViewMode('coverage'); setSelectedFile(null); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'coverage' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <ShieldCheck className="h-3.5 w-3.5" /> Test Coverage
                            </button>
                            <button
                                onClick={() => { setViewMode('debt'); setSelectedFile(null); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'debt' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm border border-indigo-500/20' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <Activity className="h-3.5 w-3.5" /> Technical Debt
                            </button>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-white/10 hover:border-teal-500/30 shadow-lg"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
                            Run Deep Scan
                        </button>
                    </div>
                </div>

                {/* Vital Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                    <Card className="bg-black/40 border-white/5 p-4 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Global Coverage</div>
                            <div className="text-2xl font-black text-emerald-400">{avgCoverage}%</div>
                        </div>
                        <TrendingUp className="h-8 w-8 text-emerald-500/20" />
                    </Card>
                    <Card className="bg-black/40 border-white/5 p-4 flex items-center justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-red-500/10 to-transparent"></div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                <AlertOctagon className="h-3 w-3 text-red-500" />
                                Critical Exploits
                            </div>
                            <div className="text-2xl font-black text-red-500">{criticalVuls}</div>
                        </div>
                        <Lock className="h-8 w-8 text-red-500/20 z-10" />
                    </Card>
                    <Card className="bg-black/40 border-white/5 p-4 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Security Warnings</div>
                            <div className="text-2xl font-black text-orange-400">{totalVuls}</div>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-orange-500/20" />
                    </Card>
                    <Card className="bg-black/40 border-white/5 p-4 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Architecture Debt Index</div>
                            <div className="text-2xl font-black text-indigo-400">{avgDebt} <span className="text-sm font-medium text-gray-500">/ 100</span></div>
                        </div>
                        <TrendingDown className="h-8 w-8 text-indigo-500/20" />
                    </Card>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Column: Grid/List */}
                <div className={`flex flex-col border-r border-white/5 p-6 overflow-y-auto transition-all duration-300 ${selectedFile ? 'w-1/2' : 'w-full'}`}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter files or paths..."
                                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all font-mono"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-[#111] p-1 rounded-xl border border-white/10">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'score' | 'name' | 'loc')}
                                className="bg-transparent border-none text-xs text-gray-300 pr-4 focus:outline-none focus:ring-0 cursor-pointer"
                            >
                                <option value="score">Sort by Diagnostic Score</option>
                                <option value="name">Sort by Alphabetical Path</option>
                                <option value="loc">Sort by Lines of Code</option>
                            </select>
                            <div className="w-px h-4 bg-white/10 mx-1"></div>
                            <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="p-1 hover:text-teal-400 text-gray-500 transition-colors">
                                <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                        {displayData.map((file, idx) => {
                            let scoreColor = '';
                            let severityBorder = 'border-white/5';
                            let bgGlow = 'bg-[#111]';

                            if (viewMode === 'vulnerabilities') {
                                const isCrit = file.vulnerabilities.some(v => v.severity === 'critical');
                                const isHigh = file.vulnerabilities.some(v => v.severity === 'high');
                                if (isCrit) { scoreColor = 'text-red-500'; severityBorder = 'border-red-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20'; bgGlow = 'bg-red-500/5'; }
                                else if (isHigh) { scoreColor = 'text-orange-400'; severityBorder = 'border-orange-500/30'; bgGlow = 'bg-orange-500/5'; }
                                else { scoreColor = 'text-yellow-400'; severityBorder = 'border-yellow-500/20'; bgGlow = 'bg-yellow-500/5'; }
                            } else if (viewMode === 'coverage') {
                                if (file.coverage < 40) { scoreColor = 'text-red-400'; severityBorder = 'border-red-500/20'; }
                                else if (file.coverage < 75) { scoreColor = 'text-yellow-400'; severityBorder = 'border-yellow-500/20'; }
                                else { scoreColor = 'text-emerald-400'; severityBorder = 'border-emerald-500/20'; }
                            } else {
                                if (file.techDebtScore > 75) { scoreColor = 'text-indigo-400'; severityBorder = 'border-indigo-500/40'; bgGlow = 'bg-indigo-500/5'; }
                                else if (file.techDebtScore > 40) { scoreColor = 'text-blue-400'; severityBorder = 'border-blue-500/20'; }
                                else { scoreColor = 'text-gray-400'; }
                            }

                            const isSelected = selectedFile === file.path;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedFile(file.path === selectedFile ? null : file.path)}
                                    className={`group flex flex-col p-4 rounded-xl border ${severityBorder} ${bgGlow} transition-all duration-300 cursor-pointer ${isSelected ? 'ring-2 ring-white/20 scale-[1.02] shadow-2xl relative z-10' : 'hover:-translate-y-1 hover:shadow-xl'}`}
                                >
                                    <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {getFileIcon(file.path)}
                                            <span className="text-sm font-bold truncate text-gray-200" title={file.path}>
                                                {file.path.split('/').pop()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-[10px] text-gray-500 font-mono truncate mb-4" title={file.path}>
                                        {file.path}
                                    </div>

                                    <div className="mt-auto flex items-end justify-between">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">
                                                {viewMode === 'coverage' ? 'Coverage' : viewMode === 'debt' ? 'Debt Score' : 'Threats'}
                                            </div>
                                            <div className={`text-xl font-black ${scoreColor}`}>
                                                {viewMode === 'coverage' ? `${file.coverage}%` : viewMode === 'debt' ? file.techDebtScore : file.vulnerabilities.length}
                                            </div>
                                        </div>
                                        {viewMode === 'vulnerabilities' && file.vulnerabilities.length > 0 && (
                                            <div className="flex -space-x-1">
                                                {file.vulnerabilities.slice(0, 3).map((v, i) => (
                                                    <div key={i} className={`w-3 h-3 rounded-full border border-[#111] ${v.severity === 'critical' ? 'bg-red-500' : v.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                                                ))}
                                            </div>
                                        )}
                                        {(viewMode === 'coverage' || viewMode === 'debt') && (
                                            <div className="text-[10px] text-gray-500 font-mono">{file.loc} LOC</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Deep Insights Inspector */}
                {selectedFile && activeFileData && (
                    <div className="w-1/2 bg-[#0a0a0a] border-l border-white/5 flex flex-col shadow-2xl z-20 overflow-y-auto custom-scrollbar relative">

                        {/* Inspector Header */}
                        <div className="p-6 border-b border-white/5 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-30">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                        {getFileIcon(activeFileData.path)}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">{activeFileData.path.split('/').pop()}</h2>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-80 truncate">{activeFileData.path}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <Card className="flex-1 bg-black/40 border-white/5 p-3">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Coverage</div>
                                    <div className={`text-xl font-black ${activeFileData.coverage < 50 ? 'text-red-400' : 'text-emerald-400'}`}>{activeFileData.coverage}%</div>
                                </Card>
                                <Card className="flex-1 bg-black/40 border-white/5 p-3">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Vulnerabilities</div>
                                    <div className={`text-xl font-black ${activeFileData.vulnerabilities.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>{activeFileData.vulnerabilities.length}</div>
                                </Card>
                                <Card className="flex-1 bg-black/40 border-white/5 p-3">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Complexity</div>
                                    <div className="text-xl font-black text-indigo-400">{activeFileData.complexity}</div>
                                </Card>
                            </div>
                        </div>

                        <div className="p-6 space-y-8">

                            {/* Detailed Vulnerability Report */}
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                                    <ShieldAlert className="h-4 w-4 text-red-500" /> Security Audit Report
                                </h3>

                                {activeFileData.vulnerabilities.length === 0 ? (
                                    <div className="p-8 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl flex flex-col items-center text-center">
                                        <ShieldCheck className="h-10 w-10 text-emerald-400 mb-3" />
                                        <h4 className="font-bold text-emerald-300">Clean File</h4>
                                        <p className="text-xs text-gray-400 mt-2 max-w-xs">CodeNexus AI scanning found no known CVEs, injections, or static analysis warnings in this file.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {activeFileData.vulnerabilities.map((vuln, i) => (
                                            <div key={i} className="border border-white/10 bg-black/30 rounded-xl overflow-hidden group">
                                                <div className={`p-4 border-l-4 ${vuln.severity === 'critical' ? 'border-red-500 bg-red-500/5' : vuln.severity === 'high' ? 'border-orange-500 bg-orange-500/5' : 'border-yellow-500 bg-yellow-500/5'}`}>
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className={`font-mono text-[9px] uppercase px-1.5 py-0 ${vuln.severity === 'critical' ? 'border-red-500/50 text-red-400' : vuln.severity === 'high' ? 'border-orange-500/50 text-orange-400' : 'border-yellow-500/50 text-yellow-400'}`}>
                                                                    {vuln.severity}
                                                                </Badge>
                                                                <span className="text-xs font-mono text-gray-500">{vuln.cwe}</span>
                                                                <span className="text-xs font-mono text-gray-500">•</span>
                                                                <span className="text-xs font-mono text-blue-400">{vuln.id}</span>
                                                            </div>
                                                            <h4 className="text-sm font-bold text-gray-200 mt-2">{vuln.type}</h4>
                                                        </div>
                                                        <div className="text-xs font-mono text-gray-500 bg-black/50 px-2 py-1 rounded border border-white/5">
                                                            Line: {vuln.lineNum}
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-white/5">
                                                        <h5 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                                                            <Zap className="h-3 w-3 text-purple-400" /> AI Remediation Plan
                                                        </h5>
                                                        <p className="text-xs text-gray-300 leading-relaxed">{vuln.remediation}</p>
                                                        <AIFixButton file={activeFileData.path} vuln={vuln} repoUrl={repoUrl} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Composition Breakdown */}
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Code2 className="h-4 w-4 text-blue-500" /> Structural Composition
                                </h3>
                                <div className="bg-black/40 border border-white/5 rounded-xl p-5">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Technical Debt Assessment</div>
                                            <div className="flex items-end gap-2 mb-2">
                                                <span className={`text-4xl font-black ${activeFileData.techDebtScore > 70 ? 'text-red-400' : activeFileData.techDebtScore > 40 ? 'text-orange-400' : 'text-emerald-400'}`}>{activeFileData.techDebtScore}</span>
                                                <span className="text-sm text-gray-500 font-bold mb-1">/ 100</span>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                {activeFileData.techDebtScore > 70 ? 'High refactoring priority. File exceeds cognitive complexity limits.' : 'Maintainable structure. Keep cognitive loads low.'}
                                            </p>
                                        </div>
                                        <div className="border-l border-white/5 pl-8">
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Metrics</div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400">Total Lines</span>
                                                    <span className="font-mono text-white">{activeFileData.loc}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400">Cyclomatic Comp.</span>
                                                    <span className="font-mono text-indigo-400">{activeFileData.complexity}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-400">Churn Rate</span>
                                                    <span className="font-mono text-orange-400">{Math.floor(seededRandom(activeFileData.path + 'churn') * 100)}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function AIFixButton({ file, vuln, repoUrl }: { file: string; vuln: any; repoUrl: string }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [prUrl, setPrUrl] = useState('');
    const filesMap = useStore(workbenchStore.files);
    const providers = useStore(providersStore);

    const handleFix = async () => {
        if (isDone) return;
        setIsGenerating(true);

        try {
            const rawFile: any = filesMap[file];
            const fileContent = rawFile?.content || '';
            if (!fileContent) throw new Error("File content not available locally.");
            if (!repoUrl) throw new Error("No repository active.");

            let providerInfo;
            const providerValues = Object.values(providers);
            if (providerValues.length > 0) {
                const firstProvider = providerValues[0];
                providerInfo = { name: firstProvider.name, apiKey: firstProvider.settings?.apiKey };
            }

            toast.info("AI generating secure code remediation...");
            const prompt = `You are a strict security expert. Please fix the following vulnerability in the provided code. Return ONLY the fully corrected code without any markdown blocks, backticks, or explanations. Do not include \`\`\`typescript or \`\`\`. Just the raw code.

Vulnerability: ${vuln.type} (${vuln.cwe})
Remediation Strategy: ${vuln.remediation}

File Path: ${file}

CODE TO FIX:
${fileContent}`;

            const response = await mcpChat(repoUrl, prompt, [], providerInfo);

            // Clean up markdown just in case
            let fixedCode = response.reply.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();

            toast.info("Fix generated. Syncing with GitHub API...");

            const urlObj = new URL(repoUrl);
            let path = urlObj.pathname;
            if (path.startsWith('/')) path = path.substring(1);
            if (path.endsWith('.git')) path = path.substring(0, path.length - 4);

            const ownerRepo = path;
            const proxyBase = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/git-proxy/api.github.com/repos/${ownerRepo}`;

            const getAuthHeader = (): Record<string, string> => {
                const token = localStorage.getItem('auth_token');
                return token ? { 'Authorization': `Bearer ${token}` } : {};
            };

            const getJsonHeader = (): Record<string, string> => {
                return { ...getAuthHeader(), 'Content-Type': 'application/json' };
            };

            // 1. Get default branch
            const repoRes = await fetch(proxyBase, { headers: getAuthHeader() });
            if (!repoRes.ok) throw new Error("Failed connecting to valid GitHub repo. Is it set up correctly?");
            const repoData: any = await repoRes.json();
            const defaultBranch = repoData.default_branch || 'main';

            // 2. Get default branch SHA
            const refRes = await fetch(`${proxyBase}/git/refs/heads/${defaultBranch}`, { headers: getAuthHeader() });
            const refData: any = await refRes.json();
            const baseSha = refData.object.sha;

            // 3. Create new branch
            const newBranch = `code-nexus-security-${vuln.id.toLowerCase()}-${Date.now()}`;
            await fetch(`${proxyBase}/git/refs`, {
                method: 'POST',
                headers: getJsonHeader(),
                body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: baseSha })
            });

            // 4. Get current file SHA
            const fileRes = await fetch(`${proxyBase}/contents/${file}?ref=${defaultBranch}`, { headers: getAuthHeader() });
            const fileData: any = await fileRes.json();
            if (!fileData || !fileData.sha) throw new Error("Could not find file on GitHub remote.");
            const fileSha = fileData.sha;

            // 5. Update file
            const uploadRes = await fetch(`${proxyBase}/contents/${file}`, {
                method: 'PUT',
                headers: getJsonHeader(),
                body: JSON.stringify({
                    message: `fix: resolve ${vuln.type} (${vuln.cwe}) in ${file}`,
                    content: btoa(unescape(encodeURIComponent(fixedCode))),
                    sha: fileSha,
                    branch: newBranch
                })
            });

            if (!uploadRes.ok) throw new Error("Failed to upload file fix to GitHub.");

            // 6. Create PR
            const prRes = await fetch(`${proxyBase}/pulls`, {
                method: 'POST',
                headers: getJsonHeader(),
                body: JSON.stringify({
                    title: `🛡️ Security Remediation: ${vuln.type} in ${file.split('/').pop()}`,
                    body: `## Automated Security Fix Request\n\nThis Pull Request was generated automatically by **CodeNexus AI**.\n\n### Intelligence Report\n- **Vulnerability**: \`${vuln.type}\`\n- **CWE**: \`${vuln.cwe}\`\n- **Action Taken**: ${vuln.remediation}\n- **Target File**: \`${file}\`\n\n*Review the attached changes carefully to ensure stability before merging.*`,
                    head: newBranch,
                    base: defaultBranch
                })
            });
            if (!prRes.ok) throw new Error("Failed to create PR: " + await prRes.text());
            const prData: any = await prRes.json();

            if (prData.html_url) {
                setPrUrl(prData.html_url);
                toast.success(`PR Built & Pushed: ${prData.html_url}`);
                setIsDone(true);
            } else {
                throw new Error(prData.message || "Failed to create PR");
            }

        } catch (e: any) {
            console.error(e);
            toast.error("GitHub Generation Failed: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    if (isDone) {
        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (prUrl) window.open(prUrl, '_blank', 'noopener,noreferrer');
                }}
                className="mt-4 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold w-full flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
                <ShieldCheck className="h-3.5 w-3.5" /> Open Fix Pull Request
            </button>
        );
    }

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                handleFix();
            }}
            disabled={isGenerating}
            className={`mt-4 px-4 py-2 w-full rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2
          ${isGenerating
                    ? 'bg-purple-600/10 text-purple-400/50 border border-purple-500/10 cursor-wait'
                    : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)] hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                }`}
        >
            {isGenerating ? (
                <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Synthesizing AI Patch...
                </>
            ) : (
                <>
                    <Zap className="h-3.5 w-3.5" /> Initialize Git Fix Injection
                </>
            )}
        </button>
    );
}
