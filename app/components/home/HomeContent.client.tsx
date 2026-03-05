import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Link } from '@remix-run/react';
import { toast } from 'react-toastify';
import {
  Github,
  FolderOpen,
  Code2,
  Clock,
  GitBranch,
  Trash2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';

import { useGit } from '~/lib/hooks/useGit';
import { repositoryHistoryStore, type RepositoryHistoryItem } from '~/lib/stores/repositoryHistory';
import { importFilesToWorkbench } from '~/utils/directFileImport';
import { importGitRepoToWorkbench } from '~/utils/workbenchImport';
import { workbenchStore } from '~/lib/stores/workbench';
import { refreshGraph } from '~/lib/stores/graphCacheStore';
import { classNames } from '~/utils/classNames';
import { ImportRepoModal } from './ImportRepoModal';
import { MyGitHubReposModal } from './MyGitHubReposModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractRepoName(url: string): string {
  return (
    url
      .split('/')
      .pop()
      ?.replace(/\.git$/, '') || 'repository'
  );
}

function formatTimeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

  if (diff < 60) {
    return 'Just now';
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }

  if (diff < 604800) {
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RepoRowProps {
  repo: RepositoryHistoryItem;
  onOpen: (repo: RepositoryHistoryItem) => void;
  onRemove: (id: string) => void;
  isOpening: boolean;
}

function RepoRow({ repo, onOpen, onRemove, isOpening }: RepoRowProps) {
  return (
    <div
      className={classNames(
        'group flex items-center justify-between gap-3',
        'px-4 py-3 rounded-xl',
        'bg-mindvex-elements-background-depth-2',
        'border border-mindvex-elements-borderColor',
        'hover:border-mindvex-elements-borderColorActive hover:bg-mindvex-elements-background-depth-3',
        'transition-all duration-200 cursor-pointer',
      )}
      onClick={() => !isOpening && onOpen(repo)}
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
        <GitBranch className="w-4 h-4 text-green-500" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mindvex-elements-textPrimary truncate">{repo.name}</p>
        <p className="text-xs text-mindvex-elements-textTertiary truncate">{repo.url}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-mindvex-elements-textSecondary">
          <span>{formatTimeAgo(repo.timestamp)}</span>
          {repo.branch && (
            <>
              <span>·</span>
              <span className="truncate">{repo.branch}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isOpening ? (
          <Loader2 className="w-4 h-4 animate-spin text-mindvex-elements-textSecondary" />
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(repo.url.replace(/\.git$/, ''), '_blank');
              }}
              className="p-1.5 rounded-md hover:bg-mindvex-elements-background-depth-4 text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary transition-colors"
              title="Open in GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(repo.id);
              }}
              className="p-1.5 rounded-md hover:bg-red-500/10 text-mindvex-elements-textSecondary hover:text-red-500 transition-colors"
              title="Remove from history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HomeContent() {
  const { ready: gitReady, gitClone } = useGit();
  const historyMap = useStore(repositoryHistoryStore.repositoryHistory);
  const isHistoryLoading = useStore(repositoryHistoryStore.isLoading);

  const [githubUrl, setGithubUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isFolderImporting, setIsFolderImporting] = useState(false);
  const [openingRepoId, setOpeningRepoId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  // Initialize history store (fetches from backend if authenticated)
  useEffect(() => {
    repositoryHistoryStore.initialize();
  }, []);

  const recentRepos = repositoryHistoryStore.getRecentRepositories(showAllHistory ? 50 : 6);
  const allRepos = repositoryHistoryStore.getAllRepositories();
  const hasMore = allRepos.length > 6;

  // ── Clone from GitHub ──────────────────────────────────────────────────────
  const handleClone = async () => {
    const url = githubUrl.trim();

    if (!url) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    if (!gitReady) {
      toast.error('Git engine not ready yet, please wait a moment and try again');
      return;
    }

    setIsCloning(true);

    try {
      const name = extractRepoName(url);
      await importGitRepoToWorkbench(url, gitClone);
      await repositoryHistoryStore.addRepository(url, name);

      // Pre-compute the knowledge graph in the background
      refreshGraph(url);

      setGithubUrl('');
      toast.success(`Cloned "${name}" successfully`);
    } catch (error) {
      console.error('Clone failed:', error);

      // importGitRepoToWorkbench already shows a toast on failure
    } finally {
      setIsCloning(false);
    }
  };

  const handleCloneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleClone();
    }
  };

  // ── Local folder import ────────────────────────────────────────────────────
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    setIsFolderImporting(true);

    try {
      await importFilesToWorkbench(files);
    } catch (error) {
      console.error('Folder import failed:', error);
      toast.error('Failed to import folder');
    } finally {
      setIsFolderImporting(false);
      e.target.value = '';
    }
  };

  // ── History open ───────────────────────────────────────────────────────────
  const handleOpenRepo = async (repo: RepositoryHistoryItem) => {
    if (!gitReady) {
      toast.error('Git engine not ready yet, please wait a moment and try again');
      return;
    }

    setOpeningRepoId(repo.id);

    try {
      await importGitRepoToWorkbench(repo.url, gitClone);
      await repositoryHistoryStore.addRepository(repo.url, repo.name, repo.description, repo.branch, repo.commitHash);

      // Pre-compute the knowledge graph in the background
      refreshGraph(repo.url);

      toast.success(`Opened "${repo.name}"`);
    } catch (error) {
      console.error('Failed to open repo:', error);
    } finally {
      setOpeningRepoId(null);
    }
  };

  const handleRemoveRepo = async (id: string) => {
    try {
      await repositoryHistoryStore.removeRepository(id);
      toast.success('Removed from history');
    } catch (error) {
      console.error('Remove failed:', error);
      toast.error('Failed to remove repository');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all repository history?')) {
      return;
    }

    try {
      await repositoryHistoryStore.clearHistory();
      toast.success('History cleared');
    } catch {
      toast.error('Failed to clear history');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-start h-full overflow-y-auto px-6 pt-14 pb-10">
      <div className="w-full max-w-3xl">
        {/* ── Hero heading ──────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-mindvex-elements-textTertiary tracking-widest uppercase mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Development Platform
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-mindvex-elements-textPrimary mb-3">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              CodeNexus
            </span>
          </h1>
          <p className="text-base text-mindvex-elements-textSecondary max-w-md mx-auto">
            Clone repos, import local projects, and explore your codebase with intelligence.
          </p>
        </div>

        {/* ── Top row: 3 Cards Grid ───────────────────────── */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          {/* Card 1: Chat with Your Code */}
          <button
            onClick={() => (window.location.href = '/editor')}
            className={classNames(
              'relative flex flex-col items-center justify-center text-center rounded-2xl overflow-hidden',
              'border border-white/[0.08] bg-[#1a1a1a]',
              'hover:bg-[#222222] transition-colors p-8 min-h-[160px]',
            )}
          >
            <div className="w-8 h-8 mb-3 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Chat with Your Code</h3>
            <p className="text-[13px] text-gray-400 max-w-[220px]">Discuss, analyze, and get help with your codebase</p>
          </button>

          {/* Card 2: Import Folder */}
          <div
            className={classNames(
              'relative flex flex-col items-center justify-center text-center rounded-2xl overflow-hidden',
              'border border-white/[0.08] bg-[#1a1a1a]',
              'p-8 min-h-[160px]',
            )}
          >
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"

              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderChange}
            />
            <div className="w-8 h-8 mb-3 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Import Folder</h3>
            <p className="text-[13px] text-gray-400 max-w-[220px] mb-4">Import a folder to work with</p>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isFolderImporting}
              className="px-4 py-2 rounded-md bg-[#252525] hover:bg-[#333333] border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isFolderImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
              Import Folder
            </button>
          </div>

          {/* Card 3: Clone Repository */}
          <div
            className={classNames(
              'relative flex flex-col items-center justify-center text-center rounded-2xl overflow-hidden',
              'border border-white/[0.08] bg-[#1a1a1a]',
              'p-8 min-h-[160px]',
            )}
          >
            <div className="w-8 h-8 mb-3 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="url(#gradient-alien)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <defs>
                  <linearGradient id="gradient-alien" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Clone Repository</h3>
            <p className="text-[13px] text-gray-400 max-w-[220px] mb-4">Clone a repo from GitHub</p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 rounded-md bg-[#252525] hover:bg-[#333333] border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
            >
              Clone a repo
              <Github className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ImportRepoModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSelectUrl={() => {
            setIsImportModalOpen(false);

            const url = prompt('Enter a public GitHub repository URL');

            if (url) {
              setGithubUrl(url);

              // Small timeout to allow state to settle before cloning
              setTimeout(() => {
                const btn = document.getElementById('hidden-clone-btn');

                if (btn) {
                  btn.click();
                }
              }, 100);
            }
          }}
          onSelectGithub={() => {
            setIsImportModalOpen(false);
            setIsGitHubModalOpen(true);
          }}
        />

        <MyGitHubReposModal
          isOpen={isGitHubModalOpen}
          onClose={() => setIsGitHubModalOpen(false)}
          onClone={(url) => {
            setIsGitHubModalOpen(false);
            setGithubUrl(url);
            setTimeout(() => {
              const btn = document.getElementById('hidden-clone-btn');

              if (btn) {
                btn.click();
              }
            }, 100);
          }}
        />

        {/* Hidden button to trigger the original clone logic */}
        <button id="hidden-clone-btn" className="hidden" onClick={handleClone}></button>

        {/* ── Recent Repositories ────────────────────────────────────────────── */}
        {(isHistoryLoading || allRepos.length > 0) && (
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-mindvex-elements-textSecondary" />
                </div>
                <h2 className="text-sm font-semibold text-mindvex-elements-textPrimary">Recent Repositories</h2>
                {allRepos.length > 0 && (
                  <span className="text-[10px] text-mindvex-elements-textTertiary bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5 tabular-nums">
                    {allRepos.length}
                  </span>
                )}
              </div>
              {allRepos.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-[10px] text-mindvex-elements-textTertiary hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            {isHistoryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-mindvex-elements-textTertiary" />
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
                  {recentRepos.map((repo) => (
                    <RepoRow
                      key={repo.id}
                      repo={repo}
                      onOpen={handleOpenRepo}
                      onRemove={handleRemoveRepo}
                      isOpening={openingRepoId === repo.id}
                    />
                  ))}
                </div>

                {hasMore && (
                  <button
                    onClick={() => setShowAllHistory((v) => !v)}
                    className="mt-3 w-full text-[11px] text-mindvex-elements-textTertiary hover:text-mindvex-elements-textSecondary transition-colors py-2"
                  >
                    {showAllHistory ? '↑ Show less' : `↓ Show ${allRepos.length - 6} more`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
