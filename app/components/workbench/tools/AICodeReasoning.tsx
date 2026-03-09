import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { BrainCircuit, Cpu, Zap, Network, GitMerge, FileWarning, Search, Code2, ServerCog, Blocks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { activeProviderStore, providersStore } from '~/lib/stores/settings';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { toast } from 'react-toastify';

interface ReasoningResult {
  detectedPatterns: {
    name: string;
    category: string;
    confidenceScore: string;
    description: string;
    implementingFiles: string[];
    codeSnippet: string;
  }[];
  antiPatterns: {
    severity: string;
    name: string;
    description: string;
    impact: string;
    affectedFiles: string[];
    remediationStrategy: string;
  }[];
  refactoringSuggestions: {
    targetFile: string;
    currentSmell: string;
    proposedArchitecture: string;
    effortLevel: string;
    stepByStepGuide: string[];
  }[];
  suggestedBoundaries: {
    serviceName: string;
    businessDomain: string;
    cohesiveModules: string[];
    externalDependencies: string[];
    isolationComplexity: string;
  }[];
  filesScanned: number;
}

export function AiCodeReasoning({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReasoningResult | null>(null);

  const providers = useStore(providersStore);
  const activeProviderName = useStore(activeProviderStore);
  const activeProvider = activeProviderName
    ? providers[activeProviderName]
    : Object.values(providers).find((p) => p.settings.enabled);
  const activeModel = activeProvider?.settings.selectedModel;

  const runAnalysis = async () => {
    if (!activeProvider) {
      toast.error('Please configure an AI provider in Settings first.');
      return;
    }

    const recentRepos = repositoryHistoryStore.getRecentRepositories(1);

    if (!recentRepos || recentRepos.length === 0) {
      toast.error('No active repository found.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://localhost:8080/api/mcp/reasoning/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: recentRepos[0].url,
          providerConfig: {
            name: activeProvider.name,
            model: activeModel,
            apiKey: activeProvider.settings.apiKey,
            baseUrl: activeProvider.settings.baseUrl,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analysis.');
      }

      const data = await response.json();
      setResult(data as ReasoningResult);
      toast.success('Deep reasoning analysis complete!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600/20 via-rose-500/20 to-purple-600/20 p-6 rounded-2xl border border-orange-500/30 backdrop-blur-xl shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Search className="w-5 h-5 text-gray-400" /> {/* Simulating back arrow */}
              </button>
            )}
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/40 shadow-inner group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent"></div>
              <BrainCircuit className="w-8 h-8 text-orange-400 group-hover:scale-110 group-hover:text-orange-300 transition-all duration-300 z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Deep Code Reasoning <Badge className="bg-orange-500 text-white border-none font-bold">BETA</Badge>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Advanced architectural intelligence using{' '}
                <span className="text-orange-300 font-bold">{activeProvider?.name}</span> •{' '}
                <span className="font-mono text-xs">{activeModel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg ${
              loading
                ? 'bg-orange-600/50 text-white/50 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-500 text-white hover:shadow-orange-500/25 active:scale-95'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing Graph...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" /> Engage Neural Engine
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2 mt-6 space-y-8">
        {!loading && !result && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
            <Cpu className="w-24 h-24 text-gray-600 stroke-[1]" />
            <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest">Engine Standby</h3>
            <p className="text-gray-500 max-w-md">
              Click "Engage Neural Engine" to initiate a deep architectural scan of your repository's AST dependency
              graph.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="relative">
              <BrainCircuit className="w-32 h-32 text-orange-500/50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-orange-400 font-black tracking-widest uppercase">Synthesizing Architecture</h3>
              <p className="text-gray-500 text-sm font-mono typewriter max-w-sm">
                Feeding multi-dimensional graph matrices into {activeProvider?.name} cortex...
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            {/* Anti Patterns & Hotspots (Critical First) */}
            <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl lg:col-span-2 relative overflow-hidden border-t-4 border-t-red-500">
              <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
                <FileWarning className="w-64 h-64 text-red-500" />
              </div>
              <CardHeader>
                <CardTitle className="text-red-400 uppercase tracking-widest font-black flex items-center gap-2">
                  <FileWarning className="w-5 h-5" /> Architectural Anti-Patterns Detected
                </CardTitle>
                <CardDescription>Critical flaws that degrade maintainability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.antiPatterns?.map((ap, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-red-500/20 p-5 rounded-xl block hover:bg-white/10 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-red-300 font-bold uppercase">{ap.name}</h4>
                        <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50">
                          {ap.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{ap.description}</p>

                      <div className="space-y-2 mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                          Affected Vectors
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ap.affectedFiles.map((f) => (
                            <span key={f} className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded text-gray-300">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                        <span className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                          <GitMerge className="w-3 h-3" /> Remediation
                        </span>
                        <p className="text-xs text-green-200/70">{ap.remediationStrategy}</p>
                      </div>
                    </div>
                  ))}
                  {(!result.antiPatterns || result.antiPatterns.length === 0) && (
                    <div className="col-span-2 text-center py-10 text-gray-500">
                      No major anti-patterns detected. Code is pristine.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Microservice Boundaries */}
            <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl border-t-4 border-t-blue-500">
              <CardHeader>
                <CardTitle className="text-blue-400 uppercase tracking-widest font-black flex items-center gap-2">
                  <ServerCog className="w-5 h-5" /> Microservice Boundaries
                </CardTitle>
                <CardDescription>AI-suggested domain-driven extraction targets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.suggestedBoundaries?.map((bound, i) => (
                  <div key={i} className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-blue-300 flex items-center gap-2">
                        <Blocks className="w-4 h-4" /> {bound.serviceName}
                      </h4>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">
                        Complexity: {bound.isolationComplexity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">
                      Domain: <span className="text-white">{bound.businessDomain}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">
                          Cohesive Modules
                        </span>
                        <ul className="text-xs text-gray-300 space-y-1 bg-black/30 p-2 rounded">
                          {bound.cohesiveModules.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">
                          External Coupling
                        </span>
                        <ul className="text-xs text-gray-400 space-y-1 bg-black/30 p-2 rounded">
                          {bound.externalDependencies.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Design Patterns Identified */}
            <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl border-t-4 border-t-purple-500">
              <CardHeader>
                <CardTitle className="text-purple-400 uppercase tracking-widest font-black flex items-center gap-2">
                  <Network className="w-5 h-5" /> Existing Design Patterns
                </CardTitle>
                <CardDescription>Recognized structural implementations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.detectedPatterns?.map((pat, i) => (
                  <div key={i} className="bg-purple-500/5 border border-purple-500/10 p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-purple-300">{pat.name}</h4>
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40">{pat.category}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{pat.description}</p>
                    <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-300">
                      <code>{pat.codeSnippet}</code>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Refactoring Suggestions */}
            <Card className="bg-mindvex-elements-background-depth-2 border-mindvex-elements-borderColor shadow-xl lg:col-span-2 border-t-4 border-t-green-500">
              <CardHeader>
                <CardTitle className="text-green-400 uppercase tracking-widest font-black flex items-center gap-2">
                  <Code2 className="w-5 h-5" /> Prescriptive Refactoring Actions
                </CardTitle>
                <CardDescription>Step-by-step logic upgrades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.refactoringSuggestions?.map((ref, i) => (
                    <div
                      key={i}
                      className="bg-green-500/5 border border-green-500/10 p-5 rounded-xl flex flex-col h-full"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="font-mono text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded truncate max-w-[70%]">
                          {ref.targetFile}
                        </span>
                        <Badge
                          className={`${
                            ref.effortLevel === 'HIGH'
                              ? 'bg-red-500/20 text-red-500 border-red-500/30'
                              : ref.effortLevel === 'MEDIUM'
                                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                                : 'bg-green-500/20 text-green-500 border-green-500/30'
                          }`}
                        >
                          {ref.effortLevel} EFFORT
                        </Badge>
                      </div>

                      <div className="mb-4 flex-1">
                        <div className="mb-2">
                          <span className="text-[10px] uppercase font-black text-gray-500 block">Current Smell</span>
                          <span className="text-sm text-gray-300">{ref.currentSmell}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-black text-green-500/50 block">
                            Target Architecture
                          </span>
                          <span className="text-sm font-bold text-green-400">{ref.proposedArchitecture}</span>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3">
                        <span className="text-[10px] uppercase font-black text-gray-500 block mb-2">
                          Execution Steps
                        </span>
                        <ul className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                          {ref.stepByStepGuide?.map((s, idx) => (
                            <li key={idx} className="truncate" title={s}>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
