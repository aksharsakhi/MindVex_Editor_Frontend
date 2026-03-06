import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { logStore, type LogEntry } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'react-toastify';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

const logLevelOptions: SelectOption[] = [
  { value: 'all', label: 'All Types', icon: 'i-ph:funnel', color: '#9333ea' },
  { value: 'provider', label: 'LLM', icon: 'i-ph:robot', color: '#10b981' },
  { value: 'api', label: 'API', icon: 'i-ph:cloud', color: '#3b82f6' },
  { value: 'error', label: 'Errors', icon: 'i-ph:warning-circle', color: '#ef4444' },
  { value: 'warning', label: 'Warnings', icon: 'i-ph:warning', color: '#f59e0b' },
  { value: 'info', label: 'Info', icon: 'i-ph:info', color: '#3b82f6' },
  { value: 'debug', label: 'Debug', icon: 'i-ph:bug', color: '#6b7280' },
];

// ── Log Entry Component ────────────────────────────────────────
interface LogEntryItemProps {
  log: LogEntry;
  isExpanded: boolean;
  use24Hour: boolean;
  showTimestamp: boolean;
}

const LogEntryItem = ({ log, isExpanded: forceExpanded, use24Hour, showTimestamp }: LogEntryItemProps) => {
  const [localExpanded, setLocalExpanded] = useState(forceExpanded);

  useEffect(() => {
    setLocalExpanded(forceExpanded);
  }, [forceExpanded]);

  const timestamp = useMemo(() => {
    const date = new Date(log.timestamp);
    return date.toLocaleTimeString('en-US', { hour12: !use24Hour });
  }, [log.timestamp, use24Hour]);

  const style = useMemo(() => {
    if (log.category === 'provider') {
      return {
        icon: 'i-ph:robot',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/5',
        border: 'border-emerald-200 dark:border-emerald-500/20',
        badge: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400',
      };
    }
    if (log.category === 'api') {
      return {
        icon: 'i-ph:cloud',
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/5',
        border: 'border-blue-200 dark:border-blue-500/20',
        badge: 'text-blue-600 bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400',
      };
    }
    switch (log.level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          color: 'text-red-500 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-500/5',
          border: 'border-red-200 dark:border-red-500/20',
          badge: 'text-red-600 bg-red-100 dark:bg-red-500/10 dark:text-red-400',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          color: 'text-yellow-500 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-500/5',
          border: 'border-yellow-200 dark:border-yellow-500/20',
          badge: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400',
        };
      case 'debug':
        return {
          icon: 'i-ph:bug',
          color: 'text-gray-500 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-500/5',
          border: 'border-gray-200 dark:border-gray-500/20',
          badge: 'text-gray-600 bg-gray-100 dark:bg-gray-500/10 dark:text-gray-400',
        };
      default:
        return {
          icon: 'i-ph:info',
          color: 'text-blue-500 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-500/5',
          border: 'border-blue-200 dark:border-blue-500/20',
          badge: 'text-blue-600 bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400',
        };
    }
  }, [log.level, log.category]);

  const renderDetails = (details: any) => {
    if (log.category === 'provider') {
      return (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {details.model && <span>Model: <strong>{details.model}</strong></span>}
            {details.totalTokens && <><span>•</span><span>Tokens: {details.totalTokens}</span></>}
            {details.duration && <><span>•</span><span>{details.duration}ms</span></>}
          </div>
          {details.prompt && (
            <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-[#141414] rounded-lg p-3 whitespace-pre-wrap border border-[#E5E5E5] dark:border-[#1A1A1A] max-h-32 overflow-auto">
              {details.prompt}
            </pre>
          )}
        </div>
      );
    }
    if (log.category === 'api') {
      return (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {details.method && (
              <span className={details.method === 'GET' ? 'text-green-500 font-mono font-bold' : 'text-blue-500 font-mono font-bold'}>
                {details.method}
              </span>
            )}
            {details.statusCode && <><span>•</span><span>Status: {details.statusCode}</span></>}
            {details.duration && <><span>•</span><span>{details.duration}ms</span></>}
          </div>
          {details.url && (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all bg-white dark:bg-[#141414] rounded-lg px-3 py-2 border border-[#E5E5E5] dark:border-[#1A1A1A]">
              {details.url}
            </div>
          )}
        </div>
      );
    }
    return (
      <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-[#141414] rounded-lg p-3 whitespace-pre-wrap border border-[#E5E5E5] dark:border-[#1A1A1A] max-h-40 overflow-auto mt-2">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        'flex flex-col rounded-xl p-4',
        style.bg,
        'border',
        style.border,
        'hover:shadow-sm',
        'transition-all duration-200',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={classNames('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', 'bg-white/60 dark:bg-white/5')}>
            <span className={classNames('text-base', style.icon, style.color)} />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{log.message}</div>
            {log.details && (
              <>
                <button
                  onClick={() => setLocalExpanded(!localExpanded)}
                  className="text-[11px] text-purple-500 hover:text-purple-600 dark:hover:text-purple-300 transition-colors self-start flex items-center gap-1"
                >
                  <span className={classNames('text-xs transition-transform', localExpanded ? 'i-ph:caret-down' : 'i-ph:caret-right')} />
                  {localExpanded ? 'Hide' : 'Show'} Details
                </button>
                <AnimatePresence>
                  {localExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {renderDetails(log.details)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={classNames('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide', style.badge)}>
                {log.level}
              </span>
              {log.category && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {log.category}{log.subCategory ? ` › ${log.subCategory}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        {showTimestamp && (
          <time className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-1">{timestamp}</time>
        )}
      </div>
    </motion.div>
  );
};

// ── Export Helpers ──────────────────────────────────────────────
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ── Main Component ─────────────────────────────────────────────
export function EventLogsTab() {
  const logs = useStore(logStore.logs);
  const [selectedLevel, setSelectedLevel] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [use24Hour, setUse24Hour] = useState(false);
  const [autoExpand, setAutoExpand] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredLogs = useMemo(() => {
    const allLogs = Object.values(logs);
    return allLogs
      .filter((log) => {
        if (selectedLevel !== 'all') {
          const matchesType = log.category === selectedLevel || log.level === selectedLevel;
          if (!matchesType) return false;
        }
        if (searchQuery) {
          return (log.message || '').toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, selectedLevel, searchQuery]);

  const stats = useMemo(() => {
    const allLogs = Object.values(logs);
    return {
      total: allLogs.length,
      errors: allLogs.filter((l) => l.level === 'error').length,
      warnings: allLogs.filter((l) => l.level === 'warning').length,
      providers: allLogs.filter((l) => l.category === 'provider').length,
      api: allLogs.filter((l) => l.category === 'api').length,
    };
  }, [logs]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await logStore.refreshLogs();
      toast.success('Logs refreshed');
    } catch {
      toast.error('Failed to refresh logs');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, []);

  const handleClearLogs = useCallback(() => {
    logStore.clearLogs();
    toast.success('All logs cleared');
  }, []);

  const selectedLevelOption = logLevelOptions.find((opt) => opt.value === selectedLevel);

  // Export functions
  const exportAsJSON = useCallback(() => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        totalLogs: filteredLogs.length,
        filters: { level: selectedLevel, searchQuery },
        logs: filteredLogs,
      };
      downloadFile(JSON.stringify(data, null, 2), `mindvex-logs-${Date.now()}.json`, 'application/json');
      toast.success('Logs exported as JSON');
    } catch { toast.error('Failed to export logs'); }
  }, [filteredLogs, selectedLevel, searchQuery]);

  const exportAsCSV = useCallback(() => {
    try {
      const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Details'];
      const rows = filteredLogs.map((log) => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category || '',
        log.message,
        log.details ? JSON.stringify(log.details) : '',
      ]);
      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      downloadFile(csvContent, `mindvex-logs-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
      toast.success('Logs exported as CSV');
    } catch { toast.error('Failed to export logs'); }
  }, [filteredLogs]);

  const exportAsText = useCallback(() => {
    try {
      const text = filteredLogs
        .map((log) => {
          let line = `[${new Date(log.timestamp).toLocaleString()}] ${log.level.toUpperCase()}: ${log.message}`;
          if (log.category) line += ` (${log.category})`;
          if (log.details) line += `\n  Details: ${JSON.stringify(log.details)}`;
          return line;
        })
        .join('\n' + '─'.repeat(80) + '\n');
      downloadFile(text, `mindvex-logs-${Date.now()}.txt`, 'text/plain');
      toast.success('Logs exported as text');
    } catch { toast.error('Failed to export logs'); }
  }, [filteredLogs]);

  const exportFormats = [
    { id: 'json', label: 'JSON', desc: 'Structured data file', icon: 'i-ph:file-js', handler: exportAsJSON },
    { id: 'csv', label: 'CSV', desc: 'Spreadsheet compatible', icon: 'i-ph:file-csv', handler: exportAsCSV },
    { id: 'txt', label: 'Text', desc: 'Plain text file', icon: 'i-ph:file-text', handler: exportAsText },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-5 gap-2.5"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {[
          { label: 'Total', value: stats.total, icon: 'i-ph:list-bullets', color: 'purple' },
          { label: 'Errors', value: stats.errors, icon: 'i-ph:warning-circle', color: 'red' },
          { label: 'Warnings', value: stats.warnings, icon: 'i-ph:warning', color: 'yellow' },
          { label: 'LLM', value: stats.providers, icon: 'i-ph:robot', color: 'emerald' },
          { label: 'API', value: stats.api, icon: 'i-ph:cloud', color: 'blue' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={classNames(
              'rounded-xl p-3 text-center',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            )}
          >
            <div className={classNames(stat.icon, `w-3.5 h-3.5 mx-auto mb-1 text-${stat.color}-500`)} />
            <div className="text-base font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {/* Level Filter */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={classNames(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:border-purple-300 dark:hover:border-purple-800/40',
                'text-gray-900 dark:text-white transition-all duration-200',
              )}>
                <span className={classNames('text-base', selectedLevelOption?.icon || 'i-ph:funnel')} style={{ color: selectedLevelOption?.color }} />
                <span>{selectedLevelOption?.label || 'All Types'}</span>
                <span className="i-ph:caret-down text-sm text-gray-400" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={classNames(
                  'min-w-[200px] rounded-xl shadow-xl py-1.5 z-[250]',
                  'bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]',
                  'animate-in fade-in-0 zoom-in-95',
                )}
                sideOffset={5} align="start"
              >
                {logLevelOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className={classNames(
                      'group flex items-center px-3 py-2 text-sm cursor-pointer transition-colors mx-1 rounded-lg',
                      selectedLevel === option.value
                        ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                    onClick={() => setSelectedLevel(option.value)}
                  >
                    <div className="mr-2.5 flex h-5 w-5 items-center justify-center">
                      <div className={classNames(option.icon || '', 'text-base')} style={{ color: option.color }} />
                    </div>
                    {option.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={classNames(
                'w-52 px-3 py-2 pl-8 rounded-lg text-sm',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'text-gray-900 dark:text-white placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300',
                'transition-all duration-200',
              )}
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
              <div className="i-ph:magnifying-glass text-sm text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle controls */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
              <span>Time</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={use24Hour} onCheckedChange={setUse24Hour} />
              <span>24h</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={autoExpand} onCheckedChange={setAutoExpand} />
              <span>Expand</span>
            </label>
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

          {/* Action Buttons */}
          <button
            onClick={handleRefresh}
            className={classNames(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'hover:border-purple-300 dark:hover:border-purple-800/40',
              'text-gray-900 dark:text-white transition-all duration-200',
            )}
          >
            <span className={classNames('i-ph:arrows-clockwise text-sm text-gray-400', isRefreshing && 'animate-spin')} />
            Refresh
          </button>

          {/* Export Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={classNames(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:border-purple-300 dark:hover:border-purple-800/40',
                'text-gray-900 dark:text-white transition-all duration-200',
              )}>
                <span className="i-ph:download text-sm text-gray-400" />
                Export
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={classNames(
                  'min-w-[200px] rounded-xl shadow-xl py-1.5 z-[250]',
                  'bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]',
                  'animate-in fade-in-0 zoom-in-95',
                )}
                sideOffset={5} align="end"
              >
                {exportFormats.map((fmt) => (
                  <DropdownMenu.Item
                    key={fmt.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer mx-1 rounded-lg transition-colors"
                    onClick={fmt.handler}
                  >
                    <div className={classNames(fmt.icon, 'w-4 h-4')} />
                    <div>
                      <div className="font-medium">{fmt.label}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">{fmt.desc}</div>
                    </div>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            onClick={handleClearLogs}
            className={classNames(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'hover:border-red-300 dark:hover:border-red-800/40 hover:text-red-600',
              'text-gray-900 dark:text-white transition-all duration-200',
            )}
          >
            <span className="i-ph:trash text-sm text-gray-400" />
            Clear
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="flex flex-col gap-2 pb-2">
        <AnimatePresence mode="popLayout">
          {filteredLogs.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={classNames(
                'flex flex-col items-center justify-center gap-4',
                'rounded-xl p-12 text-center',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <span className="i-ph:clipboard-text text-3xl text-gray-300 dark:text-gray-600" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Logs Found</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? `No results for "${searchQuery}". Try a different search term.`
                    : 'Event logs will appear here as you interact with the application.'}
                </p>
              </div>
            </motion.div>
          ) : (
            filteredLogs.map((log) => (
              <LogEntryItem
                key={log.id}
                log={log}
                isExpanded={autoExpand}
                use24Hour={use24Hour}
                showTimestamp={showTimestamps}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
