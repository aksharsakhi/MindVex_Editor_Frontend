import { atom, map, type MapStore } from 'nanostores';
import { repositoryHistoryApi, isBackendAuthenticated, type BackendRepositoryHistoryItem } from '~/lib/api/backendApi';

export interface RepositoryHistoryItem {
  /** Local client-side id */
  id: string;

  /** Backend DB id — present when the user is authenticated and the record was synced */
  backendId?: number;
  url: string;
  name: string;
  description: string;
  timestamp: string;
  branch?: string;
  commitHash?: string;
}

function backendItemToLocal(item: BackendRepositoryHistoryItem): RepositoryHistoryItem {
  return {
    id: `repo_backend_${item.id}`,
    backendId: item.id,
    url: item.url,
    name: item.name,
    description: item.description || '',
    timestamp: item.lastAccessedAt || item.createdAt,
    branch: item.branch,
    commitHash: item.commitHash,
  };
}

const MAX_LOCAL_REPOSITORIES = 50;

class RepositoryHistoryStore {
  private _repositoryHistory: MapStore<Record<string, RepositoryHistoryItem>> = map({});
  private _isLoading = atom(false);
  private _isInitialized = false;

  repositoryHistory = this._repositoryHistory;
  isLoading = this._isLoading;

  constructor() {
    // Load repository history from localStorage on initialization
    this._loadFromStorage();
  }

  /**
   * Initialize the store.
   * If authenticated, fetches history from the backend and merges it with local storage.
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    this._isInitialized = true;

    if (isBackendAuthenticated()) {
      this._isLoading.set(true);

      try {
        const backendItems = await repositoryHistoryApi.getAll(50);
        const currentHistory = this._repositoryHistory.get();
        const merged: Record<string, RepositoryHistoryItem> = { ...currentHistory };

        for (const item of backendItems) {
          const local = backendItemToLocal(item);

          // Remove any local entry with the same URL to avoid duplicates
          for (const [key, val] of Object.entries(merged)) {
            if (val.url === item.url) {
              delete merged[key];
            }
          }

          merged[local.id] = local;
        }

        this._repositoryHistory.set(merged);
        this._saveToStorage();
      } catch (error) {
        console.error('Failed to load repository history from backend:', error);
      } finally {
        this._isLoading.set(false);
      }
    }
  }

  private _loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mindvex_repository_history');

      if (stored) {
        try {
          const items: RepositoryHistoryItem[] = JSON.parse(stored);
          const historyMap: Record<string, RepositoryHistoryItem> = {};

          items.forEach((item) => {
            historyMap[item.id] = item;
          });

          this._repositoryHistory.set(historyMap);
        } catch (error) {
          console.error('Failed to load repository history from storage:', error);
        }
      }
    }
  }

  private _saveToStorage() {
    if (typeof window !== 'undefined') {
      const items = Object.values(this._repositoryHistory.get());
      localStorage.setItem('mindvex_repository_history', JSON.stringify(items));
    }
  }

  private _enforceMaxLimit() {
    const currentHistory = this._repositoryHistory.get();
    const items = Object.values(currentHistory).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    if (items.length > MAX_LOCAL_REPOSITORIES) {
      const itemsToRemove = items.slice(MAX_LOCAL_REPOSITORIES);
      const newHistory = { ...currentHistory };

      itemsToRemove.forEach((item) => {
        delete newHistory[item.id];
      });

      this._repositoryHistory.set(newHistory);
    }
  }

  async addRepository(repoUrl: string, repoName: string, description?: string, branch?: string, commitHash?: string) {
    const currentHistory = this._repositoryHistory.get();
    const existingRepo = Object.values(currentHistory).find((item) => item.url === repoUrl);
    const updatedDescription = description || existingRepo?.description || `Repository: ${repoName}`;
    const updatedTimestamp = new Date().toISOString();

    // ── Backend sync ─────────────────────────────────────────────────────────
    let backendId: number | undefined = existingRepo?.backendId;

    if (isBackendAuthenticated()) {
      try {
        const backendItem = await repositoryHistoryApi.add({
          url: repoUrl,
          name: repoName,
          description: updatedDescription,
          branch,
          commitHash,
        });
        backendId = backendItem.id;
      } catch (error) {
        console.error('Failed to sync repository add with backend:', error);
      }
    }

    // ── Local update ──────────────────────────────────────────────────────────
    if (existingRepo) {
      const updatedItem: RepositoryHistoryItem = {
        ...existingRepo,
        backendId: backendId ?? existingRepo.backendId,
        timestamp: updatedTimestamp,
        description: updatedDescription,
        branch: branch || existingRepo.branch,
        commitHash: commitHash || existingRepo.commitHash,
      };
      this._repositoryHistory.set({ ...currentHistory, [existingRepo.id]: updatedItem });
      this._saveToStorage();

      return updatedItem;
    }

    const id = backendId
      ? `repo_backend_${backendId}`
      : `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newItem: RepositoryHistoryItem = {
      id,
      backendId,
      url: repoUrl,
      name: repoName,
      description: updatedDescription,
      timestamp: updatedTimestamp,
      branch,
      commitHash,
    };

    this._repositoryHistory.set({ ...currentHistory, [id]: newItem });
    this._enforceMaxLimit();
    this._saveToStorage();

    return newItem;
  }

  async removeRepository(id: string) {
    const currentHistory = this._repositoryHistory.get();
    const item = currentHistory[id];

    if (item?.backendId && isBackendAuthenticated()) {
      try {
        await repositoryHistoryApi.remove(item.backendId);
      } catch (error) {
        console.error('Failed to remove repository from backend:', error);
      }
    }

    const newHistory = { ...currentHistory };
    delete newHistory[id];
    this._repositoryHistory.set(newHistory);
    this._saveToStorage();
  }

  async clearHistory() {
    if (isBackendAuthenticated()) {
      try {
        await repositoryHistoryApi.clearAll();
      } catch (error) {
        console.error('Failed to clear history from backend:', error);
      }
    }

    this._repositoryHistory.set({});
    this._saveToStorage();
  }

  getRepository(id: string): RepositoryHistoryItem | undefined {
    return this._repositoryHistory.get()[id];
  }

  getAllRepositories(): RepositoryHistoryItem[] {
    return Object.values(this._repositoryHistory.get()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getRecentRepositories(limit: number = 10): RepositoryHistoryItem[] {
    return this.getAllRepositories().slice(0, limit);
  }
}

export const repositoryHistoryStore = new RepositoryHistoryStore();
