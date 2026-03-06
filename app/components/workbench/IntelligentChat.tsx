/**
 * IntelligentChat.tsx
 *
 * Enhanced Intelligent Chat tool with unified parser support
 * and parser-only vs LLM-enhanced modes.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { mcpChat, mcpGetWiki, mcpDescribeModule, mcpSemanticSearch, type ChatHistoryItem } from '~/lib/mcp/mcpClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore } from '~/lib/stores/settings';
import {
  getUnifiedParser,
  parseModeStore,
  ParseModeSelector,
  ParseModeStatus,
  type LLMAnalysis,
} from '~/lib/unifiedParser';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Brain, Zap, Info, RefreshCw, Download, Send, Trash2, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  enhancedAnalysis?: LLMAnalysis;
}

export function IntelligentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseMode = useStore(parseModeStore);

  useEffect(() => {
    const recent = repositoryHistoryStore.getRecentRepositories(1);

    if (recent.length > 0) {
      setRepoUrl(recent[0].url);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const providers = useStore(providersStore);

  const handleSend = async () => {
    if (!input.trim() || !repoUrl) {
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const query = input.toLowerCase();
      let enhancedAnalysis: LLMAnalysis | undefined;

      // ─── Provider & Model Selection ─────────────────────────────────────────────

      const enabledProviders = Object.values(providers).filter((p) => p.settings.enabled);
      const activeProvider = enabledProviders[0] || null;

      // Handle Parser-Only Mode (Keyword Search)
      if (parseMode.type === 'parser-only') {
        try {
          /*
           * Use semantic search endpoint but frame it as "Search Results"
           * In a real "Without AI" mode, this should be a literal string search,
           * but mcpSemanticSearch might be vector-based.
           * For now, we assume "Parser Only" means "No LLM Generation".
           * We will use a simple file search if available, or just fallback to mcpSemanticSearch (which might use embeddings but no generation).
           * Actually, let's use a simulated grep for now since we don't have a grep API readily available in mcpClient
           * other than mcpSemanticSearch.
           */

          /*
           * Better: If we have mcpSemanticSearch, use it to get snippets.
           * It uses embeddings (AI), but no Generation (LLM).
           * This fits "Without AI" (Generative AI) but "With Search".
           */

          const results = await mcpSemanticSearch(repoUrl, input, 5);

          let responseContent = `**Search Results for "${input}"**\n\n`;

          if (results.results.length === 0) {
            responseContent += 'No matches found.';
          } else {
            responseContent += results.results
              .map((r) => `**${r.filePath}**\n\`\`\`\n${r.content.trim()}\n\`\`\``)
              .join('\n\n');
          }

          setMessages((prev) => [...prev, { role: 'assistant', content: responseContent }]);
        } catch (e) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Search failed: ${(e as Error).message}` }]);
        } finally {
          setLoading(false);
        }
        return;
      }

      // If LLM-enhanced mode is on, perform an initial code analysis
      if (parseMode.type === 'llm-enhanced') {
        try {
          const unifiedParser = await getUnifiedParser();
          const quickAnalysis = await unifiedParser.parseCode(`// Context for query: ${input}`, 'javascript');
          enhancedAnalysis = quickAnalysis.llmAnalysis;
        } catch (e) {
          console.warn('Enhanced analysis failed, falling back to standard chat', e);
        }
      }

      if (query.startsWith('generate wiki') || query === 'wiki') {
        const wiki = await mcpGetWiki(repoUrl);
        const wikiContent = typeof wiki.content === 'string' ? wiki.content : JSON.stringify(wiki.content, null, 2);
        setMessages((prev) => [...prev, { role: 'assistant', content: wikiContent, enhancedAnalysis }]);
      } else if (query.startsWith('describe module')) {
        const moduleName = input.replace(/describe\s+module\s*/i, '').trim();
        const desc = await mcpDescribeModule(repoUrl, moduleName);
        setMessages((prev) => [...prev, { role: 'assistant', content: desc.description, enhancedAnalysis }]);
      } else {
        // AI chat via Selected Provider — primary mode
        const history: ChatHistoryItem[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const providerInfo = activeProvider
          ? {
            name: activeProvider.name,
            model:
              activeProvider.settings.selectedModel ||
              (activeProvider.staticModels && activeProvider.staticModels[0]?.name),
            apiKey: activeProvider.settings.apiKey,
            baseUrl: activeProvider.settings.baseUrl,
          }
          : undefined;

        const response = await mcpChat(repoUrl, input, history, providerInfo);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.reply,
            model: response.model,
            enhancedAnalysis,
          },
        ]);
      }
    } catch (error) {
      console.error('Chat failed:', error);
      toast.error('Failed to get AI response');
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
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-400" /> MindVex AI Chat
            </h2>
            <ParseModeStatus />
          </div>
          <ParseModeSelector compact />
        </div>
        <p className="text-xs text-gray-500">AI-powered code assistant — powered by Gemini 2.0 Flash</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-5xl mb-4">🧠</div>
            <h3 className="text-lg font-medium text-gray-400 mb-2">Ask anything about your code</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl text-sm w-full">
              {[
                'Explain the project architecture',
                'How does authentication work?',
                'Generate a wiki overview',
                'What are the main dependencies?',
                'Find potential improvements',
                'Explain recent changes',
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="text-left px-4 py-3 rounded-xl bg-[#111] border border-white/5 hover:border-orange-500/30 hover:bg-[#151515] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl px-5 py-3 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-orange-500/10 border border-orange-500/20 text-gray-200'
                    : 'bg-[#111] border border-white/5 text-gray-300'
                  }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.model && msg.role === 'assistant' && (
                  <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-600 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> {msg.model}
                  </div>
                )}
              </div>

              {msg.enhancedAnalysis && (
                <Card className="p-3 bg-blue-500/5 border-blue-500/10 text-[11px] w-full max-w-[400px]">
                  <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase tracking-wider">
                    <Brain className="h-3 w-3" />
                    Contextual AI Insights
                  </div>
                  <div className="text-gray-400 line-clamp-3 mb-2 italic">{msg.enhancedAnalysis.summary}</div>
                  <div className="flex flex-wrap gap-1">
                    {msg.enhancedAnalysis.recommendations.slice(0, 2).map((rec, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[9px] bg-blue-500/10 border-blue-500/20 text-blue-300"
                      >
                        {rec}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#111] border border-white/5 rounded-2xl px-5 py-3 text-sm text-gray-400">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                {parseMode.type === 'llm-enhanced' ? 'Performing deep code analysis...' : 'Thinking...'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 flex-shrink-0 bg-[#0d0d0d]">
        <div className="max-w-4xl mx-auto">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1 mx-auto text-[10px] text-gray-600 hover:text-red-400 mb-3 transition-colors uppercase font-bold tracking-widest"
            >
              <Trash2 className="h-2.5 w-2.5" /> Clear conversation
            </button>
          )}
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about project structure, patterns, or specific logic..."
              rows={1}
              className="w-full bg-[#151515] border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none pr-16"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 text-[10px] text-center text-gray-600 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Info className="h-2.5 w-2.5" /> Use SHIFT+ENTER for multiline
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" />{' '}
              {parseMode.type === 'llm-enhanced' ? 'Enhanced Context Enabled' : 'Standard Chat Mode'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
