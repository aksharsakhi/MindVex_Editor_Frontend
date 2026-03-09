import React, { useEffect, useState, useCallback } from 'react';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { URL_CONFIGURABLE_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { SiAmazon, SiGoogle, SiGithub, SiHuggingface, SiPerplexity, SiOpenai } from 'react-icons/si';
import { BsRobot, BsCloud } from 'react-icons/bs';
import { TbBrain, TbCloudComputing } from 'react-icons/tb';
import { BiCodeBlock, BiChip } from 'react-icons/bi';
import { FaCloud, FaBrain, FaKey } from 'react-icons/fa';
import { ExternalLink } from 'lucide-react';
import type { IconType } from 'react-icons';

// Add type for provider names to ensure type safety
type ProviderName =
  | 'AmazonBedrock'
  | 'Anthropic'
  | 'Cohere'
  | 'Deepseek'
  | 'Github'
  | 'Google'
  | 'Groq'
  | 'HuggingFace'
  | 'Hyperbolic'
  | 'Mistral'
  | 'OpenAI'
  | 'OpenRouter'
  | 'Perplexity'
  | 'Together'
  | 'XAI';

// Update the PROVIDER_ICONS type to use the ProviderName type
const PROVIDER_ICONS: Record<ProviderName, IconType> = {
  AmazonBedrock: SiAmazon,
  Anthropic: FaBrain,
  Cohere: BiChip,
  Deepseek: BiCodeBlock,
  Github: SiGithub,
  Google: SiGoogle,
  Groq: BsCloud,
  HuggingFace: SiHuggingface,
  Hyperbolic: TbCloudComputing,
  Mistral: TbBrain,
  OpenAI: SiOpenai,
  OpenRouter: FaCloud,
  Perplexity: SiPerplexity,
  Together: BsCloud,
  XAI: BsRobot,
};

// Update PROVIDER_DESCRIPTIONS to use the same type
const PROVIDER_DESCRIPTIONS: Partial<Record<ProviderName, string>> = {
  Anthropic: 'Access Claude and other Anthropic models',
  Github: 'Use OpenAI models hosted through GitHub infrastructure',
  OpenAI: 'Use GPT-4, GPT-3.5, and other OpenAI models',
};

const CloudProvidersTab = () => {
  const settings = useSettings();
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [filteredProviders, setFilteredProviders] = useState<IProviderConfig[]>([]);
  const [categoryEnabled, setCategoryEnabled] = useState<boolean>(false);

  // Load and filter providers
  useEffect(() => {
    const newFilteredProviders = Object.entries(settings.providers || {})
      .filter(([key]) => !['Ollama', 'LMStudio', 'OpenAILike'].includes(key))
      .map(([key, value]) => ({
        name: key,
        settings: value.settings,
        staticModels: value.staticModels || [],
        getDynamicModels: value.getDynamicModels,
        getApiKeyLink: value.getApiKeyLink,
        labelForGetApiKey: value.labelForGetApiKey,
        icon: value.icon,
      }));

    const sorted = newFilteredProviders.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredProviders(sorted);

    // Update category enabled state
    const allEnabled = newFilteredProviders.every((p) => p.settings.enabled);
    setCategoryEnabled(allEnabled);
  }, [settings.providers]);

  const handleToggleCategory = useCallback(
    (enabled: boolean) => {
      // Update all providers
      filteredProviders.forEach((provider) => {
        settings.updateProviderSettings(provider.name, { ...provider.settings, enabled });
      });

      setCategoryEnabled(enabled);
      toast.success(enabled ? 'All cloud providers enabled' : 'All cloud providers disabled');
    },
    [filteredProviders, settings],
  );

  const handleToggleProvider = useCallback(
    (provider: IProviderConfig, enabled: boolean) => {
      // Update the provider settings in the store
      settings.updateProviderSettings(provider.name, { ...provider.settings, enabled });

      if (enabled) {
        logStore.logProvider(`Provider ${provider.name} enabled`, { provider: provider.name });
        toast.success(`${provider.name} enabled`);
      } else {
        logStore.logProvider(`Provider ${provider.name} disabled`, { provider: provider.name });
        toast.success(`${provider.name} disabled`);
      }
    },
    [settings],
  );

  const handleUpdateBaseUrl = useCallback(
    (provider: IProviderConfig, baseUrl: string) => {
      const newBaseUrl: string | undefined = baseUrl.trim() || undefined;

      // Update the provider settings in the store
      settings.updateProviderSettings(provider.name, { ...provider.settings, baseUrl: newBaseUrl });

      logStore.logProvider(`Base URL updated for ${provider.name}`, {
        provider: provider.name,
        baseUrl: newBaseUrl,
      });
      toast.success(`${provider.name} base URL updated`);
      setEditingProvider(null);
    },
    [settings],
  );

  const handleUpdateApiKey = useCallback(
    (provider: IProviderConfig, apiKey: string) => {
      settings.updateProviderSettings(provider.name, { ...provider.settings, apiKey: apiKey.trim() || undefined });
      toast.success(`${provider.name} API key updated`);
    },
    [settings],
  );

  const handleUpdateModel = useCallback(
    (provider: IProviderConfig, modelName: string) => {
      settings.updateProviderSettings(provider.name, { ...provider.settings, selectedModel: modelName });
      toast.success(`${provider.name} model updated`);
    },
    [settings],
  );

  return (
    <div className="space-y-6">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between gap-4 mt-8 mb-4">
          <div className="flex items-center gap-2">
            <div
              className={classNames(
                'w-8 h-8 flex items-center justify-center rounded-lg',
                'bg-mindvex-elements-background-depth-3',
                'text-purple-500',
              )}
            >
              <TbCloudComputing className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-md font-medium text-mindvex-elements-textPrimary">Cloud Providers</h4>
              <p className="text-sm text-mindvex-elements-textSecondary">
                Connect to cloud-based AI models and services
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-mindvex-elements-textSecondary">Enable All Cloud</span>
            <Switch checked={categoryEnabled} onCheckedChange={handleToggleCategory} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProviders.map((provider, index) => (
            <motion.div
              key={provider.name}
              className={classNames(
                'rounded-lg border bg-mindvex-elements-background text-mindvex-elements-textPrimary shadow-sm',
                'bg-mindvex-elements-background-depth-2',
                'hover:bg-mindvex-elements-background-depth-3',
                'transition-all duration-200',
                'relative overflow-hidden group',
                'flex flex-col',
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="absolute top-0 right-0 p-2 flex gap-1">
                {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                  <motion.span
                    className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-500 font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Configurable
                  </motion.span>
                )}
              </div>

              <div className="flex items-start gap-4 p-4">
                <motion.div
                  className={classNames(
                    'w-10 h-10 flex items-center justify-center rounded-xl',
                    'bg-mindvex-elements-background-depth-3 group-hover:bg-mindvex-elements-background-depth-4',
                    'transition-all duration-200',
                    provider.settings.enabled ? 'text-purple-500' : 'text-mindvex-elements-textSecondary',
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <div className={classNames('w-6 h-6', 'transition-transform duration-200', 'group-hover:rotate-12')}>
                    {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                      className: 'w-full h-full',
                      'aria-label': `${provider.name} logo`,
                    })}
                  </div>
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-mindvex-elements-textPrimary group-hover:text-purple-500 transition-colors">
                        {provider.name}
                      </h4>
                      <p className="text-xs text-mindvex-elements-textSecondary mt-0.5">
                        {PROVIDER_DESCRIPTIONS[provider.name as keyof typeof PROVIDER_DESCRIPTIONS] ||
                          (URL_CONFIGURABLE_PROVIDERS.includes(provider.name)
                            ? 'Configure custom endpoint for this provider'
                            : 'Standard AI provider integration')}
                      </p>
                    </div>
                    <Switch
                      checked={provider.settings.enabled}
                      onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                    />
                  </div>

                  {provider.settings.enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 mt-4"
                    >
                      {/* API Key Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-mindvex-elements-textSecondary flex items-center gap-1">
                            <FaKey className="w-2.5 h-2.5" />
                            API Key
                          </label>
                          {provider.getApiKeyLink && (
                            <a
                              href={provider.getApiKeyLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-purple-500 hover:underline flex items-center gap-0.5"
                            >
                              {provider.labelForGetApiKey || 'Get Key'}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <input
                          type="password"
                          value={provider.settings.apiKey || ''}
                          onChange={(e) => handleUpdateApiKey(provider, e.target.value)}
                          placeholder={`Enter ${provider.name} API key`}
                          className={classNames(
                            'w-full px-3 py-1.5 rounded-lg text-sm',
                            'bg-mindvex-elements-background-depth-3 border border-mindvex-elements-borderColor',
                            'text-mindvex-elements-textPrimary placeholder-mindvex-elements-textTertiary',
                            'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                            'transition-all duration-200',
                          )}
                        />
                      </div>

                      {/* Model Selection */}
                      {provider.staticModels && provider.staticModels.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-mindvex-elements-textSecondary flex items-center gap-1">
                            <FaBrain className="w-2.5 h-2.5" />
                            Default Model
                          </label>
                          <select
                            value={provider.settings.selectedModel || provider.staticModels[0].name}
                            onChange={(e) => handleUpdateModel(provider, e.target.value)}
                            className={classNames(
                              'w-full px-3 py-1.5 rounded-lg text-sm appearance-none',
                              'bg-mindvex-elements-background-depth-3 border border-mindvex-elements-borderColor',
                              'text-mindvex-elements-textPrimary',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                              'transition-all duration-200',
                            )}
                          >
                            {provider.staticModels.map((model) => (
                              <option key={model.name} value={model.name}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Base URL Input (only for configurable providers) */}
                      {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-mindvex-elements-textSecondary flex items-center gap-1">
                            <div className="i-ph:link text-xs" />
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={provider.settings.baseUrl || ''}
                            onChange={(e) => handleUpdateBaseUrl(provider, e.currentTarget.value)}
                            placeholder={`Enter ${provider.name} base URL`}
                            className={classNames(
                              'w-full px-3 py-1.5 rounded-lg text-sm',
                              'bg-mindvex-elements-background-depth-3 border border-mindvex-elements-borderColor',
                              'text-mindvex-elements-textPrimary placeholder-mindvex-elements-textTertiary',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                              'transition-all duration-200',
                            )}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              <motion.div
                className="absolute inset-0 border-2 border-purple-500/0 rounded-lg pointer-events-none"
                animate={{
                  borderColor: provider.settings.enabled ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0)',
                  scale: provider.settings.enabled ? 1 : 0.98,
                }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CloudProvidersTab;
