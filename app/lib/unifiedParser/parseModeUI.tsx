import React from 'react';
import { useStore } from '@nanostores/react';
import {
  parseModeStore,
  toggleParseMode,
  isParserOnlyMode,
  isLLMEnhancedMode,
  getCurrentModel,
  updateModel,
  getAvailableModels,
  setLLMEnhancedMode,
  setParserOnlyMode,
  DEFAULT_CONFIG,
} from './parseModeStore';
import { Switch } from '~/components/ui/Switch';
import { Button } from '~/components/ui/Button';
import { Dropdown, DropdownItem } from '~/components/ui/Dropdown';
import { Brain, Zap, Info } from 'lucide-react';
import { providersStore } from '~/lib/stores/settings';

interface ParseModeToggleProps {
  showLabels?: boolean;
  className?: string;
}

interface ParseModeSelectorProps {
  compact?: boolean;
  showModelSelector?: boolean;
  className?: string;
}

interface ParseModeConfigProps {
  className?: string;
}

export function ParseModeToggle({ showLabels = true, className = '' }: ParseModeToggleProps) {
  const isParserOnly = isParserOnlyMode();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Switch checked={!isParserOnly} onCheckedChange={() => toggleParseMode()} />
      {showLabels && <span className="text-sm font-medium">{isParserOnly ? 'Parser Only' : 'LLM Enhanced'}</span>}
    </div>
  );
}

export function ParseModeSelector({
  compact = false,
  showModelSelector = true,
  className = '',
}: ParseModeSelectorProps) {
  const providers = useStore(providersStore);

  const isLLMMode = isLLMEnhancedMode();
  const currentModel = getCurrentModel();

  const enabledProvider = Object.values(providers).find((p) => p.settings.enabled);
  const availableModels = enabledProvider
    ? enabledProvider.staticModels?.map((m) => m.name) || DEFAULT_CONFIG.availableModels
    : DEFAULT_CONFIG.availableModels;

  const handleModelChange = (model: string) => {
    updateModel(model);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ParseModeToggle showLabels={!compact} />
      {isLLMMode && showModelSelector && currentModel && (
        <Dropdown
          trigger={
            <Button variant="outline" size={compact ? 'sm' : 'default'} className="gap-2">
              <Brain className="h-4 w-4" />
              {!compact && <span>{currentModel}</span>}
            </Button>
          }
          align="end"
        >
          <div className="py-1">
            {availableModels.map((model) => (
              <DropdownItem
                key={model}
                onSelect={() => handleModelChange(model)}
                className={currentModel === model ? 'bg-mindvex-elements-background-depth-3' : ''}
              >
                <div className="flex items-center gap-2 w-full">
                  <Brain className="h-4 w-4" />
                  <span>{model}</span>
                  {currentModel === model && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-mindvex-elements-item-contentAccent" />
                  )}
                </div>
              </DropdownItem>
            ))}
          </div>
        </Dropdown>
      )}
    </div>
  );
}

export function ParseModeStatus() {
  const parseMode = useStore(parseModeStore);
  const providers = useStore(providersStore);

  const isParserOnly = parseMode.type === 'parser-only';

  const enabledProvider = Object.values(providers).find((p) => p.settings.enabled);
  const providerName = enabledProvider?.name || 'Local';
  const modelName = parseMode.type === 'llm-enhanced' ? parseMode.model : 'AST Only';

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded bg-mindvex-elements-background-depth-3 border border-mindvex-elements-borderColor text-[10px] font-medium text-mindvex-elements-textSecondary">
      {isParserOnly ? (
        <>
          <Zap className="h-3 w-3 text-yellow-500" />
          <span>Local AST Parser</span>
        </>
      ) : (
        <>
          <Brain className="h-3 w-3 text-purple-500" />
          <span>
            AI Enhanced ({providerName}: {modelName})
          </span>
        </>
      )}
    </div>
  );
}

export function ParseModeConfig({ className = '' }: ParseModeConfigProps) {
  const parseMode = useStore(parseModeStore);
  const availableModels = getAvailableModels();
  const currentModel = getCurrentModel();

  const handleModeChange = (mode: 'parser-only' | 'llm-enhanced') => {
    if (mode === 'parser-only') {
      setParserOnlyMode();
    } else {
      setLLMEnhancedMode();
    }
  };

  const handleModelChange = (model: string) => {
    updateModel(model);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={parseMode.type === 'parser-only' ? 'default' : 'outline'}
            onClick={() => handleModeChange('parser-only')}
            className="justify-start gap-2"
          >
            <Zap className="h-4 w-4" />
            Parser Only
          </Button>
          <Button
            variant={parseMode.type === 'llm-enhanced' ? 'default' : 'outline'}
            onClick={() => handleModeChange('llm-enhanced')}
            className="justify-start gap-2"
          >
            <Brain className="h-4 w-4" />
            LLM Enhanced
          </Button>
        </div>
      </div>

      {parseMode.type === 'llm-enhanced' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Model Selection</label>
          <div className="grid grid-cols-1 gap-1">
            {availableModels.map((model) => (
              <Button
                key={model}
                variant={currentModel === model ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleModelChange(model)}
                className="justify-start gap-2"
              >
                <Brain className="h-3 w-3" />
                {model}
                {currentModel === model && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-mindvex-elements-item-contentAccent" />
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg bg-mindvex-elements-background-depth-1 border border-mindvex-elements-borderColor flex gap-3">
        <Info className="h-4 w-4 text-mindvex-elements-textTertiary shrink-0 mt-0.5" />
        <p className="text-xs text-mindvex-elements-textSecondary">
          {parseMode.type === 'parser-only'
            ? 'Local parsing uses Tree-sitter for instant AST-based analysis. No data leaves your machine.'
            : 'LLM mode sends AST metadata to the selected model for deeper semantic insights, pattern recognition, and architectural analysis.'}
        </p>
      </div>
    </div>
  );
}

export function ParseModeQuickActions() {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => setParserOnlyMode()} title="Switch to Local Parser">
        <Zap className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setLLMEnhancedMode()} title="Switch to AI Enhanced">
        <Brain className="h-4 w-4" />
      </Button>
    </div>
  );
}
