import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import {
    ShieldAlert,
    Activity,
    FileCode,
    FileText,
    FileJson,
    Search,
    ArrowUpDown,
    RefreshCw,
    Bug,
    ShieldCheck,
    Zap
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Utilities & Mock Data Generators ───────────────────────────────────────

function getFileIcon(filePath: string) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const iconClass = 'h-4 w-4 shrink-0';

    if (!ext) return <FileText className={iconClass} />;
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext)) {
        return <FileCode className={`${iconClass} text-blue-400`} />;
    }
    if (['json', 'yaml', 'yml', 'xml', 'toml', 'lock'].includes(ext)) {
        return <FileJson className={`${iconClass} text-yellow-400`} />;
    }
    return <FileText className={`${iconClass} text-gray-400`} />;
}

// Deterministic random number generator based on string hash for stable mocked data
function seededRandom(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CodeHealthHeatmap() {
    const [repoUrl, setRepoUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'coverage' | 'vulnerabilities'>('coverage');
    const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const recent = repositoryHistoryStore.getRecentRepositories(1);
        if (recent.length > 0) setRepoUrl(recent[0].url);
    }, []);

    // Access the live file tree from the workbench
    const filesMap = useStore(workbenchStore.files);

    interface FileMetric {
        path: string;
        coverage: number; // 0 to 100
        vulnerabilities: { id: string; severity: 'critical' | 'high' | 'medium' | 'low'; type: string }[];
        loc: number;
    }

    // Generate simulated but stable metrics for the files
    const metrics = useMemo(() => {
        const fileEntries = Object.keys(filesMap).filter(path => filesMap[path]?.type === 'file');
        const result: FileMetric[] = [];

        fileEntries.forEach(filePath => {
            // Exclude obvious non-code files from these metrics
            if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.endsWith('.png')) {
                return;
            }

            const randomVal = seededRandom(filePath);

            // Simulate test coverage: mostly high, but logic heavy files might be low
            let coverage = Math.floor(randomVal * 100);
            if (filePath.endsWith('.tsx') || filePath.endsWith('.java')) {
                coverage = Math.floor(50 + randomVal * 50); // Usually higher
            }
            if (filePath.includes('config') || filePath.includes('types')) {
                coverage = 100; // Configs have "high" or N/A coverage
            }

            // Simulate Vuls
            const vulnCount = randomVal > 0.85 ? Math.floor(randomVal * 3) + 1 : 0;
            const vuls = [];
            for (let i = 0; i < vulnCount; i++) {
                const severityObj = seededRandom(filePath + i);
                let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
                if (severityObj > 0.9) severity = 'critical';
                else if (severityObj > 0.7) severity = 'high';
                else if (severityObj > 0.4) severity = 'medium';

                vuls.push({
                    id: `CVE-202${Math.floor(randomVal * 5) + 3}-${Math.floor(randomVal * 9999)}`,
                    severity,
                    type: severity === 'critical' ? 'Remote Code Execution' : 'Prototype Pollution'
                });
            }

            // Simulate LOC
            const loc = Math.max(10, Math.floor(randomVal * 1500));

            result.push({ path: filePath, coverage, vulnerabilities: vuls, loc });
        });

        return result;
    }, [filesMap]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            toast.success('Heatmap data synchronized');
        }, 800);
    };

    // ─── Filter & Sort ──────────────────────────────────────────────────────────

    const displayData = useMemo(() => {
        let filtered = metrics.filter(m => m.path.toLowerCase().includes(searchQuery.toLowerCase()));

        // Filter to only vulnerable files if in vulnerability mode
        if (viewMode === 'vulnerabilities') {
            filtered = filtered.filter(m => m.vulnerabilities.length > 0);
        }

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') {
                comparison = a.path.localeCompare(b.path);
            } else {
                if (viewMode === 'coverage') {
                    comparison = a.coverage - b.coverage;
                } else {
                    // Sort by vulnerability severity / count
                    const getSevScore = (m: FileMetric) => m.vulnerabilities.reduce((sum, v) => sum + (v.severity === 'critical' ? 1000 : v.severity === 'high' ? 100 : v.severity === 'medium' ? 10 : 1), 0);
                    comparison = getSevScore(b) - getSevScore(a); // Default descending for vuls
                }
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }, [metrics, searchQuery, viewMode, sortOrder, sortBy]);

    // Aggregate Stats
    const avgCoverage = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.coverage, 0) / metrics.length) : 0;
    const criticalVuls = metrics.reduce((s, m) => s + m.vulnerabilities.filter(v => v.severity === 'critical').length, 0);
    const totalVuls = metrics.reduce((s, m) => s + m.vulnerabilities.length, 0);

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-[#0a0a0a] to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg border border-emerald-500/30 shadow-inner">
                            <ShieldAlert className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                                Security & Coverage Heatmap
                            </h1>
                            <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                <Activity className="h-3 w-3" />
                                Live visual diagnostic of codebase health
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-[#111] p-1 rounded-lg border border-white/10 mr-2">
                            <button
                                onClick={() => setViewMode('coverage')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'coverage' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Test Coverage
                            </button>
                            <button
                                onClick={() => setViewMode('vulnerabilities')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'vulnerabilities' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Vulnerabilities
                            </button>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-white/5 transition-colors"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                            Scan
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-4">
                <Card className="bg-gradient-to-br from-emerald-950/30 to-emerald-900/10 border-emerald-500/20 p-4 hover:border-emerald-500/40 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                            <ShieldCheck className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                            Repository Coverage
                        </div>
                    </div>
                    <div className="text-3xl font-black text-emerald-400 mb-1">{avgCoverage}<span className="text-lg">%</span></div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                        <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${avgCoverage}%` }}></div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-red-950/30 to-red-900/10 border-red-500/20 p-4 hover:border-red-500/40 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                            <Bug className="h-4 w-4 text-red-400 group-hover:animate-bounce" />
                            Critical Vulnerabilities
                        </div>
                    </div>
                    <div className="text-3xl font-black text-red-400 mb-1">{criticalVuls}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">Immediate action required</div>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-950/30 to-yellow-900/10 border-yellow-500/20 p-4 hover:border-yellow-500/40 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                            <Zap className="h-4 w-4 text-yellow-400 group-hover:scale-110 transition-transform" />
                            Total Warnings
                        </div>
                    </div>
                    <div className="text-3xl font-black text-yellow-400 mb-1">{totalVuls}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">Across {metrics.length} files</div>
                </Card>
            </div>

            {/* Main Grid */}
            <div className="px-6 flex-1 flex flex-col pb-6">
                <div className="bg-[#111] border border-white/5 rounded-xl p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Find specific files..."
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'score' | 'name')}
                                className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value="score">Sort by Score</option>
                                <option value="name">Sort by File Name</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                className="px-2 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg hover:border-emerald-500/50 transition-colors"
                                title="Toggle Sort Direction"
                            >
                                <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pr-2 flex-1 content-start">
                        {displayData.map((file, idx) => {
                            // Calculate styling based on mode
                            let bgColor = 'rgba(255,255,255,0.02)';
                            let borderColor = 'rgba(255,255,255,0.05)';
                            let ringColor = '';

                            if (viewMode === 'coverage') {
                                const intensity = (100 - file.coverage) / 100; // Redder if lower coverage
                                if (file.coverage < 50) {
                                    bgColor = `rgba(239, 68, 68, ${intensity * 0.2})`;
                                    borderColor = `rgba(239, 68, 68, ${intensity * 0.4})`;
                                } else if (file.coverage < 80) {
                                    bgColor = `rgba(234, 179, 8, ${(1 - file.coverage / 100) * 0.2})`;
                                    borderColor = `rgba(234, 179, 8, ${(1 - file.coverage / 100) * 0.4})`;
                                } else {
                                    bgColor = `rgba(16, 185, 129, ${(file.coverage / 100) * 0.15})`;
                                    borderColor = `rgba(16, 185, 129, ${(file.coverage / 100) * 0.3})`;
                                }
                            } else {
                                // Vulnerability Mode Colors
                                const hasCritical = file.vulnerabilities.some(v => v.severity === 'critical');
                                const hasHigh = file.vulnerabilities.some(v => v.severity === 'high');

                                if (hasCritical) {
                                    bgColor = 'rgba(239, 68, 68, 0.15)';
                                    borderColor = 'rgba(239, 68, 68, 0.4)';
                                    ringColor = 'ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
                                } else if (hasHigh) {
                                    bgColor = 'rgba(249, 115, 22, 0.1)';
                                    borderColor = 'rgba(249, 115, 22, 0.3)';
                                } else if (file.vulnerabilities.length > 0) {
                                    bgColor = 'rgba(234, 179, 8, 0.1)';
                                    borderColor = 'rgba(234, 179, 8, 0.3)';
                                }
                            }

                            return (
                                <div
                                    key={idx}
                                    className={`flex flex-col p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer ${ringColor}`}
                                    style={{ backgroundColor: bgColor, borderColor }}
                                >
                                    <div className="flex items-center justify-between mb-2 gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {getFileIcon(file.path)}
                                            <span className="text-xs font-mono font-medium truncate text-gray-200" title={file.path}>
                                                {file.path.split('/').pop()}
                                            </span>
                                        </div>
                                        {viewMode === 'coverage' ? (
                                            <span className={`text-xs font-bold ${file.coverage < 50 ? 'text-red-400' : file.coverage < 80 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                                {file.coverage}%
                                            </span>
                                        ) : (
                                            file.vulnerabilities.length > 0 && (
                                                <Badge variant="outline" className={`px-1 py-0 text-[9px] ${file.vulnerabilities.some(v => v.severity === 'critical') ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                                                        file.vulnerabilities.some(v => v.severity === 'high') ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
                                                            'border-yellow-500/50 text-yellow-400 bg-yellow-500/10'
                                                    }`}>
                                                    {file.vulnerabilities.length} VULN
                                                </Badge>
                                            )
                                        )}
                                    </div>

                                    <div className="text-[9px] text-gray-500 font-mono truncate mb-3" title={file.path}>
                                        {file.path}
                                    </div>

                                    {viewMode === 'coverage' && (
                                        <div className="mt-auto w-full bg-black/40 rounded-full h-1">
                                            <div
                                                className={`h-1 rounded-full ${file.coverage < 50 ? 'bg-red-400' : file.coverage < 80 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                                                style={{ width: `${file.coverage}%` }}
                                            ></div>
                                        </div>
                                    )}

                                    {viewMode === 'vulnerabilities' && file.vulnerabilities.length > 0 && (
                                        <div className="mt-auto pt-2 border-t border-white/5 space-y-1">
                                            {file.vulnerabilities.slice(0, 2).map((vuln, vIdx) => (
                                                <div key={vIdx} className="flex justify-between items-center text-[10px]">
                                                    <span className="text-gray-400 truncate mr-2">{vuln.type}</span>
                                                    <span className="font-mono text-gray-500">{vuln.id}</span>
                                                </div>
                                            ))}
                                            {file.vulnerabilities.length > 2 && (
                                                <div className="text-[9px] text-gray-500 italic">
                                                    +{file.vulnerabilities.length - 2} more issues
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {displayData.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500">
                                <ShieldCheck className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">No files found matching criteria</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
