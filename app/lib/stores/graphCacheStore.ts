/**
 * graphCacheStore.ts
 *
 * Pre-computes and caches the knowledge-graph data for the current repository.
 * All 6 tool pages read from this shared cache so results are instant.
 */
import { atom } from 'nanostores';
import { buildGraph, getDependencies, getFallbackGraph, type GraphResponse } from '~/lib/graph/graphClient';

// ─── State ───────────────────────────────────────────────────────────────────

export const graphCache = atom<GraphResponse | null>(null);
export const graphCacheLoading = atom<boolean>(false);
export const graphCacheError = atom<string | null>(null);
export const graphCacheRepoUrl = atom<string | null>(null);
export const graphCacheStatus = atom<'idle' | 'building' | 'polling' | 'ready' | 'error'>('idle');

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Kick off a graph build for the given repo and poll until the dependency
 * graph is available.  If a cache already exists for the same repoUrl it is
 * returned immediately unless force=true.
 */
export async function refreshGraph(repoUrl: string, force: boolean = false): Promise<void> {
  // Already cached for this repo (skip if force=true)
  if (!force && graphCacheRepoUrl.get() === repoUrl && graphCache.get() !== null) {
    return;
  }

  graphCacheRepoUrl.set(repoUrl);
  graphCacheLoading.set(true);
  graphCacheError.set(null);
  graphCacheStatus.set('building');

  try {
    // 1. Trigger the backend build job
    await buildGraph(repoUrl);
    graphCacheStatus.set('polling');

    // 2. Poll until the dependency graph is populated OR the job finishes
    const MAX_ATTEMPTS = 6;
    const POLL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sleep(POLL_MS);

      try {
        const data = await getDependencies(repoUrl);

        if (data && data.nodes && data.nodes.length > 0) {
          // We have real data — cache it and mark ready
          graphCache.set(data);
          graphCacheStatus.set('ready');
          graphCacheLoading.set(false);

          return;
        }
      } catch {
        // Not ready yet — keep polling
      }
    }

    /*
     * Polling finished without finding nodes.
     * Use fallback graph from local filesystem.
     */
    try {
      const data = await getFallbackGraph();
      graphCache.set(data);
      graphCacheStatus.set('ready');
    } catch {
      graphCacheError.set('Could not fetch graph data from backend or generate fallback.');
      graphCacheStatus.set('error');
    }
  } catch (err: any) {
    graphCacheError.set(err.message || 'Failed to build graph.');
    graphCacheStatus.set('error');
  } finally {
    graphCacheLoading.set(false);
  }
}

/**
 * Try to load existing graph data without triggering a new build.
 * Useful when the graph was built in a previous session.
 */
export async function loadExistingGraph(repoUrl: string): Promise<void> {
  if (graphCacheRepoUrl.get() === repoUrl && graphCache.get() !== null) {
    return;
  }

  graphCacheRepoUrl.set(repoUrl);
  graphCacheLoading.set(true);
  graphCacheError.set(null);
  graphCacheStatus.set('polling');

  try {
    const data = await getDependencies(repoUrl);

    // Accept whatever we get — even empty data is valid
    graphCache.set(data);
    graphCacheStatus.set('ready');
  } catch {
    // No existing graph — trigger full build
    graphCacheLoading.set(false);
    await refreshGraph(repoUrl);

    return;
  }

  graphCacheLoading.set(false);
}

/** Force-clear the cache (e.g. when switching repos). */
export function clearGraphCache(): void {
  graphCache.set(null);
  graphCacheRepoUrl.set(null);
  graphCacheLoading.set(false);
  graphCacheError.set(null);
  graphCacheStatus.set('idle');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
