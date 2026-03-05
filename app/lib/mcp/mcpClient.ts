/**
 * mcpClient.ts — API client for the MCP server endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  filePath: string;
  chunkIndex: number;
  content: string;
}

export interface McpSearchResponse {
  query: string;
  results: SearchResult[];
  totalMatches: number;
}

export interface McpWikiResponse {
  repoUrl: string;
  content: string | Record<string, string>;
  format: string;
}

export interface McpModuleResponse {
  module: string;
  description: string;
  format: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function mcpSemanticSearch(repoUrl: string, query: string, topK = 5): Promise<McpSearchResponse> {
  const res = await fetch(`${BASE_URL}/api/mcp/tools/search?repoUrl=${encodeURIComponent(repoUrl)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, topK }),
  });

  if (!res.ok) {
    throw new Error(`MCP search failed: ${res.status}`);
  }

  return res.json();
}

export async function mcpGetWiki(
  repoUrl: string,
  providerInfo?: { name: string; model?: string; apiKey?: string; baseUrl?: string }
): Promise<McpWikiResponse> {
  const res = await fetch(`${BASE_URL}/api/mcp/tools/wiki?repoUrl=${encodeURIComponent(repoUrl)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ provider: providerInfo }),
  });

  if (!res.ok) {
    // Try to get the backend's error message
    let detail = `${res.status}`;
    try {
      const errBody = await res.json() as any;
      detail = errBody.message || errBody.error || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  return res.json();
}

export async function mcpDescribeModule(
  repoUrl: string,
  modulePath: string,
  providerInfo?: { name: string; model?: string; apiKey?: string; baseUrl?: string }
): Promise<McpModuleResponse> {
  const res = await fetch(`${BASE_URL}/api/mcp/tools/describe?repoUrl=${encodeURIComponent(repoUrl)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ module: modulePath, provider: providerInfo }),
  });

  if (!res.ok) {
    throw new Error(`MCP describe failed: ${res.status}`);
  }

  return res.json();
}

export async function mcpGetDeps(repoUrl: string, filePath?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/mcp/tools/deps?repoUrl=${encodeURIComponent(repoUrl)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ filePath: filePath || '' }),
  });

  if (!res.ok) {
    throw new Error(`MCP deps failed: ${res.status}`);
  }

  return res.json();
}

export interface McpChatResponse {
  reply: string;
  model: string;
  contextFiles?: number;
  contextDeps?: number;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export async function mcpChat(
  repoUrl: string,
  message: string,
  history: ChatHistoryItem[] = [],
  providerInfo?: {
    name: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  },
): Promise<McpChatResponse> {
  const res = await fetch(`${BASE_URL}/api/mcp/tools/chat?repoUrl=${encodeURIComponent(repoUrl)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, history, provider: providerInfo }),
  });

  if (!res.ok) {
    throw new Error(`MCP chat failed: ${res.status}`);
  }

  return res.json();
}
