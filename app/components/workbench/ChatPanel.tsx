import React, { useState, useRef, useEffect, useMemo } from 'react';
import { mcpChat, mcpGetWiki, mcpDescribeModule, type ChatHistoryItem } from '~/lib/mcp/mcpClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore, updateProviderSettings, activeProviderStore, setActiveProvider } from '~/lib/stores/settings';
import { workbenchStore } from '~/lib/stores/workbench';
import { useStore } from '@nanostores/react';
import { Dropdown, DropdownItem } from '~/components/ui/Dropdown';
import { Button } from '~/components/ui/Button';
import { ChevronDown, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

/**
 * ChatPanel — Gemini AI-powered chatbot embedded in the code editor sidebar.
 * Uses the /api/mcp/tools/chat endpoint for conversational AI with codebase context.
 * Falls back to wiki/module tools for specific commands.
 */
export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const providers = useStore(providersStore);
  const selectedProviderName = useStore(activeProviderStore);

  const enabledProviders = useMemo(() => {
    return Object.values(providers).filter((p) => p.settings.enabled);
  }, [providers]);

  // Set default provider if none selected
  useEffect(() => {
    if (!selectedProviderName && enabledProviders.length > 0) {
      setActiveProvider(enabledProviders[0].name);
    } else if (selectedProviderName && !enabledProviders.find((p) => p.name === selectedProviderName)) {
      // If selected provider is disabled, switch to another
      if (enabledProviders.length > 0) {
        setActiveProvider(enabledProviders[0].name);
      } else {
        setActiveProvider(null);
      }
    }
  }, [enabledProviders, selectedProviderName]);

  const activeProvider = useMemo(() => {
    return enabledProviders.find((p) => p.name === selectedProviderName) || enabledProviders[0] || null;
  }, [enabledProviders, selectedProviderName]);

  const activeModel = useMemo(() => {
    if (!activeProvider) {
      return null;
    }

    return (
      activeProvider.settings.selectedModel || (activeProvider.staticModels && activeProvider.staticModels[0]?.name)
    );
  }, [activeProvider]);

  useEffect(() => {
    const recent = repositoryHistoryStore.getRecentRepositories(1);

    if (recent.length > 0) {
      setRepoUrl(recent[0].url);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input?.trim() || !repoUrl) {
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const query = input?.toLowerCase() || '';

      const providerInfo = activeProvider
        ? {
            name: activeProvider.name,
            model: activeModel || undefined,
            apiKey: activeProvider.settings.apiKey,
            baseUrl: activeProvider.settings.baseUrl,
          }
        : undefined;

      if (query.includes('wiki') || query.startsWith('generate wiki')) {
        // Wiki generation via dedicated endpoint
        const wiki = await mcpGetWiki(repoUrl, providerInfo);

        if (wiki.format === 'multiple-files' && typeof wiki.content === 'object') {
          let msg = `Generated documentation files:\n`;

          for (const [filename, fileContent] of Object.entries(wiki.content)) {
            try {
              await workbenchStore.createFile(`/${filename}`, fileContent as string);
              msg += `- ${filename}\n`;
            } catch {
              msg += `- ${filename} (Failed)\n`;
            }
          }

          const allFiles = workbenchStore.files.get();
          workbenchStore.setDocuments(allFiles, false);
          setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: typeof wiki.content === 'string' ? wiki.content : 'Generated successfully.' },
          ]);
        }
      } else if (query.startsWith('describe module')) {
        // Module description via dedicated endpoint
        const moduleName = input.replace(/describe\s+module\s*/i, '').trim();
        const desc = await mcpDescribeModule(repoUrl, moduleName, providerInfo);
        setMessages((prev) => [...prev, { role: 'assistant', content: desc.description }]);
      } else {
        // AI chat via Selected Provider
        const history: ChatHistoryItem[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await mcpChat(repoUrl, input, history, providerInfo);
        setMessages((prev) => [...prev, { role: 'assistant', content: response.reply, model: response.model }]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-mindvex-elements-background-depth-1 border-l border-mindvex-elements-borderColor">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-mindvex-elements-borderColor bg-mindvex-elements-background-depth-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mindvex-elements-textSecondary" />
          <span className="text-xs font-semibold text-mindvex-elements-textPrimary tracking-wide uppercase mr-2">
            MindVex AI
          </span>

          {/* Provider Selector */}
          <Dropdown
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 border border-mindvex-elements-borderColor bg-mindvex-elements-background-depth-1"
              >
                {activeProvider ? activeProvider.name : 'No Provider'}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            }
          >
            {enabledProviders.map((p) => (
              <DropdownItem key={p.name} onSelect={() => setActiveProvider(p.name)}>
                {p.name}
              </DropdownItem>
            ))}
            {enabledProviders.length === 0 && (
              <div className="px-2 py-1 text-xs text-mindvex-elements-textSecondary">No enabled providers</div>
            )}
          </Dropdown>

          {/* Model Selector */}
          {activeProvider && activeProvider.staticModels.length > 0 && (
            <Dropdown
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 border border-mindvex-elements-borderColor bg-mindvex-elements-background-depth-1 max-w-[120px] justify-between"
                >
                  <span className="truncate">{activeModel || 'Model'}</span>
                  <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                </Button>
              }
            >
              {activeProvider.staticModels.map((m) => (
                <DropdownItem
                  key={m.name}
                  onSelect={() => updateProviderSettings(activeProvider.name, { selectedModel: m.name })}
                  className={activeModel === m.name ? 'bg-mindvex-elements-selection-background' : ''}
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{m.label}</span>
                    <span className="text-[9px] text-mindvex-elements-textTertiary">{m.name}</span>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>
        <span className="text-[9px] text-mindvex-elements-textTertiary bg-mindvex-elements-background-depth-3 px-1.5 py-0.5 rounded-full">
          Gemini 2.0
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 modern-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="text-3xl mb-3">🧠</div>
            <p className="text-xs text-mindvex-elements-textSecondary font-medium mb-1">MindVex AI Assistant</p>
            <p className="text-[10px] text-mindvex-elements-textTertiary mb-4">Ask anything about your codebase</p>
            <div className="space-y-1.5 w-full">
              {[
                'Explain the project architecture',
                'How does authentication work?',
                'What are the main modules?',
                'Find potential bugs in the code',
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-mindvex-elements-background-depth-2 border border-mindvex-elements-borderColor hover:border-orange-500/30 text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-orange-500/15 border border-orange-500/20 text-mindvex-elements-textPrimary'
                  : 'bg-mindvex-elements-background-depth-2 border border-mindvex-elements-borderColor text-mindvex-elements-textSecondary'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.model && msg.role === 'assistant' && (
                <div className="mt-1.5 text-[9px] text-mindvex-elements-textTertiary opacity-60">⚡ {msg.model}</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-mindvex-elements-background-depth-2 border border-mindvex-elements-borderColor rounded-lg px-3 py-2 text-xs text-mindvex-elements-textTertiary">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-mindvex-elements-borderColor flex-shrink-0">
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="w-full text-[10px] text-mindvex-elements-textTertiary hover:text-orange-400 mb-1.5 transition-colors"
          >
            Clear chat
          </button>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            className="flex-1 bg-mindvex-elements-background-depth-2 border border-mindvex-elements-borderColor rounded-lg px-3 py-2 text-xs text-mindvex-elements-textPrimary placeholder-mindvex-elements-textTertiary focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-40 transition-all flex-shrink-0"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
