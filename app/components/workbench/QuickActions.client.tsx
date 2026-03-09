import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import {
  graphCacheLoading,
  graphCacheError,
  loadExistingGraph,
  refreshGraph,
  graphCacheStatus,
} from '~/lib/stores/graphCacheStore';

// Tool Pages
import { KnowledgeGraphPage } from './tools/KnowledgeGraphPage';
import { ArchitecturePage } from './tools/ArchitecturePage';
import { RealTimeGraphPage } from './tools/RealTimeGraphPage';
import { ImpactAnalysisPage } from './tools/ImpactAnalysisPage';
import { CycleDetectionPage } from './tools/CycleDetectionPage';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { EvolutionaryBlame } from './EvolutionaryBlame';
import { IntelligentChat } from './IntelligentChat';
import { LivingWiki } from './LivingWiki';
import { CodeHealthHeatmap } from './CodeHealthHeatmap';
import { AiCodeReasoning } from './tools/AICodeReasoning';

interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const quickActions: QuickActionItem[] = [
  {
    id: 'kg-construction',
    title: 'Knowledge Graph Construction',
    description: 'Build knowledge graphs from your codebase using AST parsing',
    icon: '🧠',
    color: 'yellow',
  },
  {
    id: 'architecture-graph',
    title: 'Architecture / Dependency Graph',
    description: 'Visualize your code architecture and dependencies',
    icon: '📊',
    color: 'red',
  },
  {
    id: 'realtime-graph',
    title: 'Real-Time Graph Update',
    description: 'Update knowledge graphs in real-time as code changes',
    icon: '🔄',
    color: 'cyan',
  },
  {
    id: 'impact-analysis',
    title: 'Change Impact Analysis',
    description: 'Analyze the impact of code changes using knowledge graphs',
    icon: '🔬',
    color: 'pink',
  },
  {
    id: 'cycle-detection',
    title: 'Cycle Detection (Architectural Anomaly)',
    description: 'Detect architectural anomalies and dependency cycles',
    icon: '❌',
    color: 'teal',
  },
  {
    id: 'analytics-dashboard',
    title: 'Code Analytics & Hotspots',
    description: 'Visualize code churn, hotspot files, and rework trends',
    icon: '📊',
    color: 'orange',
  },
  {
    id: 'evolutionary-blame',
    title: 'Evolutionary Blame',
    description: 'Age-colored git blame with AI-powered churn analysis',
    icon: '🕵️',
    color: 'violet',
  },
  {
    id: 'intelligent-chat',
    title: 'Code Intelligence Chat',
    description: 'Ask questions about your codebase using semantic graph search',
    icon: '🤖',
    color: 'blue',
  },
  {
    id: 'living-wiki',
    title: 'Living Wiki & Documentation',
    description: 'AI-generated project docs that stay in sync with your code',
    icon: '📚',
    color: 'green',
  },
  {
    id: 'code-health-heatmap',
    title: 'Security & Coverage Heatmap',
    description: 'Live diagnostic of simulated test coverage and security vulnerabilities',
    icon: '🛡️',
    color: 'emerald',
  },
  {
    id: 'ai-code-reasoning',
    title: 'AI Code Reasoning Engine',
    description: 'Deep architectural intelligence: detects patterns, smells, and service boundaries',
    icon: '🧠',
    color: 'orange',
  },
];

export function QuickActions() {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string>('');

  // Store subscriptions
  const isLoading = useStore(graphCacheLoading);
  const error = useStore(graphCacheError);
  const status = useStore(graphCacheStatus);

  // Auto-detect current repo on mount
  useEffect(() => {
    const recentRepos = repositoryHistoryStore.getRecentRepositories(1);

    if (recentRepos.length > 0) {
      const url = recentRepos[0].url;
      setRepoUrl(url);

      // Try to load existing graph data or trigger a background build
      loadExistingGraph(url);
    }
  }, []);

  const handleActionClick = (actionId: string) => {
    setActiveToolId(actionId);
  };

  useEffect(() => {
    const handleOpenTool = (e: any) => {
      if (e.detail?.toolId) {
        setActiveToolId(e.detail.toolId);
      }
    };

    window.addEventListener('open-tool', handleOpenTool);

    return () => window.removeEventListener('open-tool', handleOpenTool);
  }, []);

  const handleBackToMenu = () => {
    setActiveToolId(null);
    workbenchStore.currentView.set('dashboard');
  };

  const handleRefreshGraph = () => {
    if (repoUrl && !isLoading) {
      refreshGraph(repoUrl, true); // force=true to bypass cache and trigger rebuild
    }
  };

  // Render the currently selected tool page
  const renderToolPage = () => {
    switch (activeToolId) {
      case 'kg-construction':
        return <KnowledgeGraphPage onBack={handleBackToMenu} />;
      case 'architecture-graph':
        return <ArchitecturePage onBack={handleBackToMenu} />;
      case 'realtime-graph':
        return <RealTimeGraphPage onBack={handleBackToMenu} repoUrl={repoUrl} />;
      case 'impact-analysis':
        return <ImpactAnalysisPage onBack={handleBackToMenu} />;
      case 'cycle-detection':
        return <CycleDetectionPage onBack={handleBackToMenu} />;
      case 'analytics-dashboard':
        return <AnalyticsDashboard />;
      case 'evolutionary-blame':
        return <EvolutionaryBlame />;
      case 'intelligent-chat':
        return <IntelligentChat />;
      case 'living-wiki':
        return <LivingWiki />;
      case 'code-health-heatmap':
        return <CodeHealthHeatmap />;
      case 'ai-code-reasoning':
        return <AiCodeReasoning onBack={handleBackToMenu} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 overflow-hidden w-full flex flex-col">
      <div className={`mx-auto h-full flex flex-col w-full ${activeToolId ? 'max-w-full' : 'max-w-6xl'}`}>
        <div className="mb-8 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              if (activeToolId) {
                handleBackToMenu();
              } else {
                workbenchStore.currentView.set('dashboard');
              }
            }}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {status === 'building' && (
                <span className="text-xs text-yellow-400 animate-pulse">Building graph...</span>
              )}
              {status === 'polling' && (
                <span className="text-xs text-blue-400 animate-pulse">Waiting for dependencies...</span>
              )}
              {status === 'ready' && <span className="text-xs text-green-400">Graph Ready</span>}
              {status === 'error' && <span className="text-xs text-red-400">Build Failed</span>}

              <button
                onClick={handleRefreshGraph}
                disabled={!repoUrl || isLoading}
                className="text-gray-300 hover:text-orange-400 p-1 rounded transition-colors disabled:opacity-50"
                title="Force refresh graph data"
              >
                <div className={`i-ph:arrows-clockwise ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <span className="text-sm text-gray-400">Target Repository:</span>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500 w-64"
                onBlur={() => {
                  if (repoUrl) {
                    loadExistingGraph(repoUrl);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {!activeToolId && (
          <>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              Knowledge Graph & Analysis Tools
            </h1>
            <p className="text-gray-400 mt-2 mb-8">
              Advanced codebase analysis powered by SCIP and your backend architecture. Pre-computed for instant
              results.
            </p>
          </>
        )}

        {error && !activeToolId && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">{error}</div>
        )}

        {/* Tool Content */}
        <div className="flex-1 min-h-0 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 rounded-xl flex items-center justify-center">
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-xl shadow-black/50 flex flex-col items-center gap-4">
                <div className="i-ph:spinner animate-spin text-4xl text-blue-500" />
                <div className="text-center">
                  <div className="font-bold text-gray-200 text-lg">Analyzing Repository</div>
                  <div className="text-sm text-gray-400 mt-1">Extracting ASTs and resolving dependencies...</div>
                </div>
              </div>
            </div>
          )}

          {activeToolId ? (
            renderToolPage()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action.id)}
                  className="group relative bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-left hover:bg-gray-700/50 hover:border-blue-500/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
                >
                  <div
                    className={`absolute top-0 right-0 w-24 h-24 bg-${action.color}-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500`}
                  />

                  <div className="flex flex-col h-full relative z-10">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 w-fit">
                      {action.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6 flex-1">{action.description}</p>
                    <div className="flex items-center text-blue-400 text-sm font-semibold">
                      Open Tool
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
