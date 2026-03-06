import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';

interface FeatureToggle {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  beta?: boolean;
  experimental?: boolean;
  tooltip?: string;
}

const FeatureCard = memo(
  ({
    feature,
    index,
    onToggle,
  }: {
    feature: FeatureToggle;
    index: number;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      key={feature.id}
      layoutId={feature.id}
      className={classNames(
        'relative group cursor-pointer',
        'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        'border border-[#E5E5E5] dark:border-[#1A1A1A]',
        'hover:border-purple-300 dark:hover:border-purple-800/40',
        'hover:shadow-lg hover:shadow-purple-500/5',
        'transition-all duration-200',
        'rounded-xl overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={classNames(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                'bg-purple-50 dark:bg-purple-500/10',
                feature.enabled ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500',
                'transition-colors duration-200',
              )}
            >
              <div className={classNames(feature.icon, 'w-5 h-5')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">{feature.title}</h4>
                {feature.beta && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">
                    Beta
                  </span>
                )}
                {feature.experimental && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wide">
                    Experimental
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          </div>
          <div className="pt-1">
            <Switch checked={feature.enabled} onCheckedChange={(checked) => onToggle(feature.id, checked)} />
          </div>
        </div>
        {feature.tooltip && (
          <div className="mt-3 ml-[52px] text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <div className="i-ph:info w-3 h-3" />
            {feature.tooltip}
          </div>
        )}
      </div>
      {/* Active indicator bar */}
      <div
        className={classNames(
          'h-0.5 w-full transition-all duration-300',
          feature.enabled
            ? 'bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-400'
            : 'bg-transparent',
        )}
      />
    </motion.div>
  ),
);

const FeatureSection = memo(
  ({
    title,
    features,
    icon,
    description,
    onToggleFeature,
    badge,
  }: {
    title: string;
    features: FeatureToggle[];
    icon: string;
    description: string;
    onToggleFeature: (id: string, enabled: boolean) => void;
    badge?: string;
  }) => {
    const enabledCount = features.filter((f) => f.enabled).length;
    return (
      <motion.div
        layout
        className="flex flex-col gap-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={classNames(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-purple-100 dark:bg-purple-500/15',
              )}
            >
              <div className={classNames(icon, 'text-xl text-purple-600 dark:text-purple-400')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
                {badge && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
            {enabledCount}/{features.length} active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} onToggle={onToggleFeature} />
          ))}
        </div>
      </motion.div>
    );
  },
);

export default function FeaturesTab() {
  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setPromptId,
    promptId,
  } = useSettings();

  // Enable features by default on first load
  React.useEffect(() => {
    if (isLatestBranch === undefined) enableLatestBranch(false);
    if (contextOptimizationEnabled === undefined) enableContextOptimization(true);
    if (autoSelectTemplate === undefined) setAutoSelectTemplate(true);
    if (promptId === undefined) setPromptId('default');
    if (eventLogs === undefined) setEventLogs(true);
  }, []);

  const handleToggleFeature = useCallback(
    (id: string, enabled: boolean) => {
      switch (id) {
        case 'latestBranch':
          enableLatestBranch(enabled);
          toast.success(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
          break;
        case 'autoSelectTemplate':
          setAutoSelectTemplate(enabled);
          toast.success(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
          break;
        case 'contextOptimization':
          enableContextOptimization(enabled);
          toast.success(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
          break;
        case 'eventLogs':
          setEventLogs(enabled);
          toast.success(`Event logging ${enabled ? 'enabled' : 'disabled'}`);
          break;
        default:
          break;
      }
    },
    [enableLatestBranch, setAutoSelectTemplate, enableContextOptimization, setEventLogs],
  );

  const features = {
    stable: [
      {
        id: 'contextOptimization',
        title: 'Context Optimization',
        description: 'Intelligently optimizes context windows for better AI responses with less token usage',
        icon: 'i-ph:brain',
        enabled: contextOptimizationEnabled,
        tooltip: 'Reduces token usage by 30-50% while maintaining response quality',
      },
      {
        id: 'autoSelectTemplate',
        title: 'Auto Select Template',
        description: 'Automatically selects the most appropriate starter template based on your project type',
        icon: 'i-ph:selection',
        enabled: autoSelectTemplate,
        tooltip: 'Uses AI to detect project type and suggest the optimal template',
      },
      {
        id: 'eventLogs',
        title: 'Event Logging',
        description: 'Records detailed logs of system events, API calls, and user actions for debugging',
        icon: 'i-ph:list-bullets',
        enabled: eventLogs,
        tooltip: 'Logs are stored locally and can be exported from the Event Logs tab',
      },
      {
        id: 'latestBranch',
        title: 'Main Branch Updates',
        description: 'Get the latest features and bug fixes from the main development branch',
        icon: 'i-ph:git-branch',
        enabled: isLatestBranch,
        tooltip: 'May include breaking changes — recommended for developers only',
      },
    ],
    beta: [] as FeatureToggle[],
  };

  return (
    <div className="flex flex-col gap-8 pb-4">
      {/* Status Banner */}
      <motion.div
        className={classNames(
          'rounded-xl p-4',
          'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/5 dark:to-indigo-500/5',
          'border border-purple-200/50 dark:border-purple-500/10',
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:sparkle text-purple-500 w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {features.stable.filter((f) => f.enabled).length} of {features.stable.length} core features active
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              All features can be toggled without restarting the application
            </p>
          </div>
        </div>
      </motion.div>

      <FeatureSection
        title="Core Features"
        features={features.stable}
        icon="i-ph:check-circle"
        description="Essential features enabled by default for optimal performance"
        onToggleFeature={handleToggleFeature}
      />

      {features.beta.length > 0 && (
        <FeatureSection
          title="Beta Features"
          features={features.beta}
          icon="i-ph:test-tube"
          description="New features ready for testing but may have rough edges"
          onToggleFeature={handleToggleFeature}
          badge="PREVIEW"
        />
      )}

      {/* Prompt Library Section */}
      <motion.div
        layout
        className={classNames(
          'rounded-xl overflow-hidden',
          'border border-[#E5E5E5] dark:border-[#1A1A1A]',
          'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div
              className={classNames(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-purple-50 dark:bg-purple-500/10',
                'text-purple-600 dark:text-purple-400',
              )}
            >
              <div className="i-ph:book w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Prompt Library</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Choose a system prompt template for AI conversations
              </p>
            </div>
            <select
              value={promptId}
              onChange={(e) => {
                setPromptId(e.target.value);
                toast.success('Prompt template updated');
              }}
              className={classNames(
                'px-3 py-2 rounded-lg text-sm min-w-[200px]',
                'bg-white dark:bg-[#141414]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'text-gray-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                'hover:border-purple-300 dark:hover:border-purple-800/40',
                'transition-all duration-200',
              )}
            >
              {PromptLibrary.getList().map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
