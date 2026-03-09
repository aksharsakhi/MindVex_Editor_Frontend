/**
 * aiClient.ts
 *
 * AI client for LLM analysis of code and AST data.
 * Integrates with the existing AI providers in the app via MCP.
 */

import { mcpChat, type ChatHistoryItem } from '~/lib/mcp/mcpClient';
import { repositoryHistoryStore } from '~/lib/stores/repositoryHistory';
import { providersStore } from '~/lib/stores/settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIClientOptions {
  model?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'gpt-4o-mini';

// ─── AI Client Implementation ──────────────────────────────────────────────────

export class AIClient {
  private _defaultModel: string;

  constructor(defaultModel: string = DEFAULT_MODEL) {
    this._defaultModel = defaultModel;
  }

  /**
   * Generate text using AI via MCP Chat
   */
  async generate(options: AIClientOptions): Promise<AIResponse> {
    const { prompt, system } = options;

    try {
      const recent = repositoryHistoryStore.getRecentRepositories(1);
      const repoUrl = recent.length > 0 ? recent[0].url : '';

      if (!repoUrl) {
        throw new Error('No active repository found for AI analysis');
      }

      // ─── Provider & Model Selection ─────────────────────────────────────────────

      const providers = providersStore.get();
      const enabledProviders = Object.values(providers).filter((p) => p.settings.enabled);
      const activeProvider = enabledProviders[0] || null;

      if (!activeProvider) {
        throw new Error('No AI provider enabled in settings');
      }

      const providerName = activeProvider.name;
      const model =
        options.model ||
        activeProvider.settings.selectedModel ||
        (activeProvider.staticModels && activeProvider.staticModels[0]?.name);
      const apiKey = activeProvider.settings.apiKey;
      const baseUrl = activeProvider.settings.baseUrl;

      // ─── Local Analysis (Ollama / LM Studio) ────────────────────────────────────

      if (providerName === 'Ollama') {
        const url = `${baseUrl || 'http://127.0.0.1:11434'}/api/generate`;
        const res = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            model: model || 'llama3',
            prompt: system ? `${system}\n\n${prompt}` : prompt,
            stream: false,
          }),
        });

        if (!res.ok) {
          throw new Error(`Ollama generation failed: ${res.status}`);
        }

        const data = (await res.json()) as { response: string };

        return { text: data.response };
      }

      if (providerName === 'LMStudio') {
        const url = `${baseUrl || 'http://localhost:1234'}/v1/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'model-identifier',
            messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
            stream: false,
          }),
        });

        if (!res.ok) {
          throw new Error(`LM Studio generation failed: ${res.status}`);
        }

        const data = (await res.json()) as { choices: { message: { content: string } }[] };

        return { text: data.choices[0].message.content };
      }

      // ─── Backend Analysis (Cloud Providers) ─────────────────────────────────────

      // Combine system and prompt for MCP chat
      const message = system ? `${system}\n\n${prompt}` : prompt;
      const history: ChatHistoryItem[] = [];

      const result = await mcpChat(repoUrl, message, history, {
        name: providerName,
        model,
        apiKey,
        baseUrl,
      });

      console.log('FULL AI RESPONSE:', JSON.stringify(result, null, 2));

      return {
        text: result.reply,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error('AI generation failed:', error);
      throw new Error(`AI analysis failed: ${error}`);
    }
  }

  /**
   * Analyze code with AI
   */
  async analyzeCode(code: string, context: string, options?: Partial<AIClientOptions>): Promise<AIResponse> {
    const prompt = `Analyze the following code and provide insights:

${context}

Code to analyze:
\`\`\`
${code}
\`\`\`

Please provide:
1. A brief summary of what the code does
2. Key architectural patterns or design principles used
3. Potential issues or code smells
4. Suggestions for improvement
5. Code quality assessment

Format your response as structured analysis.`;

    return this.generate({
      ...options,
      prompt,
    });
  }
}
