import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

// Safe database initialization
function useSafeDatabase() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initDB = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import to avoid crashes if module has issues
        const { openDatabase } = await import('~/lib/persistence/db');
        const database = await openDatabase();

        if (!cancelled) {
          setDb(database || null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.warn('Database init failed (non-critical):', msg);
          setError(msg);
          setIsLoading(false);
        }
      }
    };

    initDB();

    return () => {
      cancelled = true;
    };
  }, []);

  return { db, isLoading, error };
}

interface ChatSummary {
  id: string;
  title: string;
  messageCount: number;
  lastUpdated: string;
}

// ── Action Card Component ──────────────────────────────────────
function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
  isLoading,
  disabled,
  variant = 'default',
}: {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  const isDisabled = isLoading || disabled;
  return (
    <motion.div
      className={classNames(
        'rounded-xl overflow-hidden',
        'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        'border border-[#E5E5E5] dark:border-[#1A1A1A]',
        'hover:shadow-md hover:shadow-purple-500/5',
        'transition-all duration-200',
      )}
      whileHover={{ y: -2 }}
    >
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={classNames(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              variant === 'danger'
                ? 'bg-red-50 dark:bg-red-500/10'
                : 'bg-purple-50 dark:bg-purple-500/10',
            )}
          >
            <div
              className={classNames(
                icon,
                'w-4.5 h-4.5',
                variant === 'danger'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-purple-600 dark:text-purple-400',
              )}
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{title}</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="mt-auto pt-3">
          <button
            onClick={onClick}
            disabled={isDisabled}
            className={classNames(
              'w-full rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              'flex items-center justify-center gap-2',
              isDisabled
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : variant === 'danger'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-200 dark:border-red-500/20'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-200 dark:border-purple-500/20',
            )}
          >
            {isLoading ? (
              <>
                <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                Processing...
              </>
            ) : (
              buttonLabel
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div
      className={classNames(
        'rounded-xl p-4',
        'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        'border border-[#E5E5E5] dark:border-[#1A1A1A]',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center', `bg-${color}-50 dark:bg-${color}-500/10`)}>
          <div className={classNames(icon, `w-5 h-5 text-${color}-500`)} />
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main DataTab ───────────────────────────────────────────────
export function DataTab() {
  const { db, isLoading: dbLoading, error: dbError } = useSafeDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Storage stats
  const [storageUsed, setStorageUsed] = useState('0 KB');
  const [settingsCount, setSettingsCount] = useState(0);

  // Load chat summaries
  useEffect(() => {
    if (db) {
      import('~/lib/persistence/chats').then(({ getAllChats }) => {
        getAllChats(db)
          .then((chats) => {
            const summaries: ChatSummary[] = chats.map((chat: any) => ({
              id: chat.id,
              title: chat.title || chat.description || `Chat ${chat.id.slice(0, 8)}`,
              messageCount: chat.messages?.length || 0,
              lastUpdated: new Date(chat.updatedAt || Date.parse(chat.timestamp)).toLocaleDateString(),
            }));
            setChatSummaries(summaries);
          })
          .catch((err) => {
            console.warn('Failed to load chats:', err);
          });
      });
    }
  }, [db]);

  // Calculate storage
  useEffect(() => {
    try {
      let totalSize = 0;
      let count = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) totalSize += value.length * 2; // UTF-16
          if (key.startsWith('mindvex_')) count++;
        }
      }

      if (totalSize < 1024) {
        setStorageUsed(`${totalSize} B`);
      } else if (totalSize < 1024 * 1024) {
        setStorageUsed(`${(totalSize / 1024).toFixed(1)} KB`);
      } else {
        setStorageUsed(`${(totalSize / (1024 * 1024)).toFixed(1)} MB`);
      }
      setSettingsCount(count);
    } catch {
      setStorageUsed('Unknown');
    }
  }, []);

  // Handlers
  const handleExportAllSettings = useCallback(() => {
    setIsExporting(true);
    try {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            data[key] = JSON.parse(localStorage.getItem(key) || '');
          } catch {
            data[key] = localStorage.getItem(key);
          }
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindvex-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Settings exported successfully');
    } catch (err) {
      toast.error('Failed to export settings');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportSettings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        let importedCount = 0;
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          importedCount++;
        }
        toast.success(`Imported ${importedCount} settings. Reloading...`);
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast.error('Invalid settings file');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleExportChats = useCallback(async () => {
    if (!db) {
      toast.error('Database not available');
      return;
    }
    setIsExporting(true);
    try {
      const { getAllChats } = await import('~/lib/persistence/chats');
      const chats = await getAllChats(db);
      if (chats.length === 0) {
        toast.warning('No chats to export');
        return;
      }
      const blob = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindvex-chats-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${chats.length} chats`);
    } catch (err) {
      toast.error('Failed to export chats');
    } finally {
      setIsExporting(false);
    }
  }, [db]);

  const handleResetSettings = useCallback(() => {
    setIsResetting(true);
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('mindvex_')) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      setShowResetConfirm(false);
      toast.success(`Cleared ${keys.length} settings. Reloading...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setIsResetting(false);
    }
  }, []);

  const handleDeleteAllChats = useCallback(async () => {
    if (!db) return;
    setIsResetting(true);
    try {
      // Clear all object stores
      const storeNames = Array.from(db.objectStoreNames);
      for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
      }
      setChatSummaries([]);
      setShowDeleteConfirm(false);
      toast.success('All chats deleted');
    } catch {
      toast.error('Failed to delete chats');
    } finally {
      setIsResetting(false);
    }
  }, [db]);

  const totalMessages = chatSummaries.reduce((sum, c) => sum + c.messageCount, 0);

  return (
    <div className="flex flex-col gap-8 pb-4">
      {/* Hidden File Inputs */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
      <input ref={apiKeyFileInputRef} type="file" accept=".json" className="hidden" />
      <input ref={chatFileInputRef} type="file" accept=".json" className="hidden" />

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={classNames(
              'w-[400px] rounded-2xl p-6',
              'bg-white dark:bg-[#141414]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'shadow-2xl',
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <div className="i-ph:warning-circle w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset All Settings?</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This will reset all your MindVex settings to their default values. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSettings}
                disabled={isResetting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Reset Settings'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Chats Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={classNames(
              'w-[400px] rounded-2xl p-6',
              'bg-white dark:bg-[#141414]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'shadow-2xl',
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <div className="i-ph:trash w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete All Chats?</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This will permanently delete all {chatSummaries.length} chats and {totalMessages} messages. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllChats}
                disabled={isResetting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Deleting...' : 'Delete All Chats'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Storage Stats */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-3"
      >
        <StatCard icon="i-ph:hard-drive" label="Storage Used" value={storageUsed} color="purple" />
        <StatCard icon="i-ph:gear" label="Settings" value={settingsCount} color="blue" />
        <StatCard icon="i-ph:chats" label="Chats" value={chatSummaries.length} color="emerald" />
        <StatCard icon="i-ph:chat-text" label="Messages" value={totalMessages} color="pink" />
      </motion.div>

      {/* Database Status */}
      {dbError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={classNames(
            'rounded-xl p-4',
            'bg-yellow-50 dark:bg-yellow-500/5',
            'border border-yellow-200 dark:border-yellow-500/20',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="i-ph:warning w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              Chat database unavailable: {dbError}. Chat operations will be limited.
            </span>
          </div>
        </motion.div>
      )}

      {/* Chats Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <div className="i-ph:chats w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Chat Data</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Export, import, or delete your chat history</p>
          </div>
        </div>

        {dbLoading ? (
          <div className="flex items-center justify-center p-8 rounded-xl bg-[#FAFAFA] dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="i-ph:spinner-gap-bold animate-spin w-5 h-5 mr-2 text-purple-500" />
            <span className="text-sm text-gray-500">Loading chat database...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionCard
              icon="i-ph:download-simple"
              title="Export All Chats"
              description="Save all chats as JSON"
              buttonLabel={chatSummaries.length === 0 ? 'No Chats' : `Export ${chatSummaries.length} Chats`}
              onClick={handleExportChats}
              isLoading={isExporting}
              disabled={chatSummaries.length === 0 || !db}
            />
            <ActionCard
              icon="i-ph:upload-simple"
              title="Import Chats"
              description="Load chats from JSON file"
              buttonLabel="Import Chats"
              onClick={() => chatFileInputRef.current?.click()}
              isLoading={isImporting}
              disabled={!db}
            />
            <ActionCard
              icon="i-ph:trash"
              title="Delete All Chats"
              description="Remove all chat history"
              buttonLabel="Delete All"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={chatSummaries.length === 0 || !db}
              variant="danger"
            />
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <div className="i-ph:gear w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Application Settings</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Backup and restore your configuration</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            icon="i-ph:download-simple"
            title="Export Settings"
            description="Backup all settings to file"
            buttonLabel="Export Settings"
            onClick={handleExportAllSettings}
            isLoading={isExporting}
          />
          <ActionCard
            icon="i-ph:upload-simple"
            title="Import Settings"
            description="Restore settings from backup"
            buttonLabel="Import Settings"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isImporting}
          />
          <ActionCard
            icon="i-ph:arrow-counter-clockwise"
            title="Reset Settings"
            description="Restore all to defaults"
            buttonLabel="Reset All"
            onClick={() => setShowResetConfirm(true)}
            variant="danger"
          />
        </div>
      </div>

      {/* API Keys Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <div className="i-ph:key w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">API Keys</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Manage your API key configurations</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            icon="i-ph:file-text"
            title="Download Template"
            description="Get the API keys template"
            buttonLabel="Download"
            onClick={() => {
              const template = {
                _info: 'MindVex API Keys Template',
                OpenAI: '',
                Anthropic: '',
                Google: '',
                Groq: '',
                Mistral: '',
                Deepseek: '',
                XAI: '',
              };
              const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'mindvex-api-keys-template.json';
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Template downloaded');
            }}
          />
          <ActionCard
            icon="i-ph:upload-simple"
            title="Import API Keys"
            description="Load keys from JSON file"
            buttonLabel="Import Keys"
            onClick={() => apiKeyFileInputRef.current?.click()}
          />
        </div>
      </div>
    </div>
  );
}
