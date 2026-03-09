import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logStore } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface NotificationDetails {
  type?: string;
  message?: string;
  currentVersion?: string;
  latestVersion?: string;
  branch?: string;
  updateUrl?: string;
}

type FilterType = 'all' | 'system' | 'error' | 'warning' | 'update' | 'info' | 'provider' | 'network';

const filterOptions: { id: FilterType; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All Notifications', icon: 'i-ph:bell', color: '#9333ea' },
  { id: 'system', label: 'System', icon: 'i-ph:gear', color: '#6b7280' },
  { id: 'update', label: 'Updates', icon: 'i-ph:arrow-circle-up', color: '#9333ea' },
  { id: 'error', label: 'Errors', icon: 'i-ph:warning-circle', color: '#ef4444' },
  { id: 'warning', label: 'Warnings', icon: 'i-ph:warning', color: '#f59e0b' },
  { id: 'info', label: 'Information', icon: 'i-ph:info', color: '#3b82f6' },
  { id: 'provider', label: 'Providers', icon: 'i-ph:robot', color: '#10b981' },
  { id: 'network', label: 'Network', icon: 'i-ph:wifi-high', color: '#6366f1' },
];

const NotificationsTab = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const logs = useStore(logStore.logs);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      logStore.logPerformanceMetric('NotificationsTab', 'mount-duration', duration);
    };
  }, []);

  const handleClearNotifications = () => {
    const count = Object.keys(logs).length;
    logStore.logInfo('Cleared notifications', {
      type: 'notification_clear',
      message: `Cleared ${count} notifications`,
      clearedCount: count,
      component: 'notifications',
    });
    logStore.clearLogs();
  };

  const handleUpdateAction = (updateUrl: string) => {
    window.open(updateUrl, '_blank');
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const filteredLogs = useMemo(() => {
    return Object.values(logs)
      .filter((log) => {
        if (filter === 'all') {
          return true;
        }

        if (filter === 'update') {
          return log.details?.type === 'update';
        }

        if (filter === 'system') {
          return log.category === 'system';
        }

        if (filter === 'provider') {
          return log.category === 'provider';
        }

        if (filter === 'network') {
          return log.category === 'network';
        }

        return log.level === filter;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, filter]);

  const stats = useMemo(() => {
    const all = Object.values(logs);
    return {
      total: all.length,
      errors: all.filter((l) => l.level === 'error').length,
      warnings: all.filter((l) => l.level === 'warning').length,
      info: all.filter((l) => l.level === 'info').length,
    };
  }, [logs]);

  const getNotificationStyle = (level: string, type?: string) => {
    if (type === 'update') {
      return {
        icon: 'i-ph:arrow-circle-up',
        color: 'text-purple-500 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-500/5',
        border: 'border-purple-200 dark:border-purple-500/20',
      };
    }

    switch (level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          color: 'text-red-500 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-500/5',
          border: 'border-red-200 dark:border-red-500/20',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          color: 'text-yellow-500 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-500/5',
          border: 'border-yellow-200 dark:border-yellow-500/20',
        };
      case 'info':
        return {
          icon: 'i-ph:info',
          color: 'text-blue-500 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-500/5',
          border: 'border-blue-200 dark:border-blue-500/20',
        };
      default:
        return {
          icon: 'i-ph:bell',
          color: 'text-gray-500 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-500/5',
          border: 'border-gray-200 dark:border-gray-500/20',
        };
    }
  };

  const renderNotificationDetails = (details: NotificationDetails) => {
    if (details.type === 'update') {
      return (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">{details.message}</p>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-500">
            {details.currentVersion && (
              <span>
                Current: <strong>{details.currentVersion}</strong>
              </span>
            )}
            {details.latestVersion && (
              <span>
                Latest: <strong>{details.latestVersion}</strong>
              </span>
            )}
            {details.branch && (
              <span>
                Branch: <strong>{details.branch}</strong>
              </span>
            )}
          </div>
          {details.updateUrl && (
            <button
              onClick={() => handleUpdateAction(details.updateUrl!)}
              className={classNames(
                'mt-1 inline-flex items-center gap-1.5 self-start',
                'rounded-lg px-3 py-1.5',
                'text-xs font-medium',
                'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                'hover:bg-purple-500/20',
                'transition-all duration-200',
              )}
            >
              <span className="i-ph:git-branch text-sm" />
              View Changes
            </button>
          )}
        </div>
      );
    }

    return details.message ? <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{details.message}</p> : null;
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Stats Bar */}
      <motion.div className="grid grid-cols-4 gap-3" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {[
          { label: 'Total', value: stats.total, icon: 'i-ph:bell', color: 'purple' },
          { label: 'Errors', value: stats.errors, icon: 'i-ph:warning-circle', color: 'red' },
          { label: 'Warnings', value: stats.warnings, icon: 'i-ph:warning', color: 'yellow' },
          { label: 'Info', value: stats.info, icon: 'i-ph:info', color: 'blue' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={classNames(
              'rounded-xl p-3 text-center',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            )}
          >
            <div className={classNames(stat.icon, `w-4 h-4 mx-auto mb-1 text-${stat.color}-500`)} />
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={classNames(
                'flex items-center gap-2',
                'rounded-lg px-3 py-2',
                'text-sm text-gray-900 dark:text-white',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:border-purple-300 dark:hover:border-purple-800/40',
                'transition-all duration-200',
              )}
            >
              <span
                className={classNames(
                  'text-base',
                  filterOptions.find((opt) => opt.id === filter)?.icon || 'i-ph:funnel',
                )}
                style={{ color: filterOptions.find((opt) => opt.id === filter)?.color }}
              />
              <span className="text-sm">{filterOptions.find((opt) => opt.id === filter)?.label || 'Filter'}</span>
              <span className="i-ph:caret-down text-sm text-gray-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={classNames(
                'min-w-[220px] rounded-xl shadow-xl py-1.5 z-[250]',
                'bg-white dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'animate-in fade-in-0 zoom-in-95',
              )}
              sideOffset={5}
              align="start"
              side="bottom"
            >
              {filterOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.id}
                  className={classNames(
                    'group flex items-center px-3 py-2 text-sm cursor-pointer transition-colors mx-1 rounded-lg',
                    filter === option.id
                      ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  )}
                  onClick={() => handleFilterChange(option.id)}
                >
                  <div className="mr-2.5 flex h-5 w-5 items-center justify-center">
                    <div className={classNames(option.icon, 'text-base')} style={{ color: option.color }} />
                  </div>
                  {option.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredLogs.length} notification{filteredLogs.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleClearNotifications}
            className={classNames(
              'group flex items-center gap-2',
              'rounded-lg px-3 py-2',
              'text-sm text-gray-900 dark:text-white',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'hover:border-red-300 dark:hover:border-red-800/40',
              'hover:text-red-600 dark:hover:text-red-400',
              'transition-all duration-200',
            )}
          >
            <span className="i-ph:trash text-base text-gray-400 group-hover:text-red-500 transition-colors" />
            Clear All
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="flex flex-col gap-2.5 pb-2">
        <AnimatePresence mode="popLayout">
          {filteredLogs.length === 0 ? (
            <motion.div
              key="empty-state"
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
                <span className="i-ph:bell-slash text-3xl text-gray-300 dark:text-gray-600" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Notifications</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filter === 'all'
                    ? "You're all caught up! Notifications will appear here as events occur."
                    : `No ${filterOptions.find((o) => o.id === filter)?.label.toLowerCase()} notifications found.`}
                </p>
              </div>
            </motion.div>
          ) : (
            filteredLogs.map((log, index) => {
              const style = getNotificationStyle(log.level, log.details?.type);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.03 }}
                  className={classNames(
                    'flex flex-col gap-1',
                    'rounded-xl p-4',
                    style.bg,
                    'border',
                    style.border,
                    'hover:shadow-sm',
                    'transition-all duration-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={classNames(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                          'bg-white/60 dark:bg-white/5',
                        )}
                      >
                        <span className={classNames('text-lg', style.icon, style.color)} />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                          {log.message}
                        </h3>
                        {log.details && renderNotificationDetails(log.details as NotificationDetails)}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={classNames(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                              log.level === 'error'
                                ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                                : log.level === 'warning'
                                  ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                  : 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            )}
                          >
                            {log.level}
                          </span>
                          {log.category && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {log.category}
                              {log.subCategory ? ` › ${log.subCategory}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <time className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </time>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationsTab;
