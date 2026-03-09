/**
 * graphClient.ts — typed API client for the code knowledge graph endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

import { webcontainer } from '~/lib/webcontainer';
import { path as pathUtils } from '~/utils/path';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CyNodeData {
  id: string;
  label: string;
  filePath: string;
  language: string;
}

export interface CyEdgeData {
  id: string;
  source: string;
  target: string;
  type: string; // 'import' | 'reference'
  cycle: boolean;
}

export interface CyNode {
  data: CyNodeData;
}
export interface CyEdge {
  data: CyEdgeData;
}

export interface GraphResponse {
  nodes: CyNode[];
  edges: CyEdge[];
  cycles: string[];
  isFallback?: boolean;
}

export interface ReferenceResult {
  filePath: string;
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  symbol: string;
  roleFlags: number; // 1=definition, 2=reference
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  return {};
}

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(),
  };

  // Always set Content-Type for POST/PUT/PATCH requests
  if (method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  console.log('[graphClient.request]', { path, method, hasBody: !!body, bodyContent: body });

  const res = await fetch(`${BASE_URL}${path}`, config);

  if (res.status === 401) {
    throw new Error('Unauthorized: Please log in using GitHub first.');
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[graphClient.request] Error response:', errorText);
    throw new Error(`GraphAPI ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Trigger async graph build from SCIP data. Returns { jobId }. */
export async function buildGraph(repoUrl: string): Promise<{ jobId: number; status: string }> {
  return request(`/api/graph/build?repoUrl=${encodeURIComponent(repoUrl)}`, 'POST');
}

/**
 * Fetch dependency graph in Cytoscape.js format.
 * If rootFile is provided, returns only the transitive sub-tree rooted there.
 */
export async function getDependencies(repoUrl: string, rootFile?: string, depth = 20): Promise<GraphResponse> {
  const params = new URLSearchParams({ repoUrl, depth: String(depth) });

  if (rootFile) {
    params.set('rootFile', rootFile);
  }

  return request(`/api/graph/dependencies?${params}`);
}

/**
 * Generates a fallback graph from the WebContainer filesystem when SCIP data is missing.
 */
export async function getFallbackGraph(): Promise<GraphResponse> {
  const container = await webcontainer;
  const nodes: CyNode[] = [];
  const edges: CyEdge[] = [];
  const fileNameToPath = new Map<string, string>();

  async function walk(dir: string) {
    const entries = await container.fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = pathUtils.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.cache'].includes(entry.name)) {
          await walk(fullPath);
        }
      } else {
        const ext = pathUtils.extname(entry.name).slice(1);
        const language = getLanguageFromExtension(ext);

        if (language !== 'unknown') {
          nodes.push({
            data: {
              id: fullPath,
              label: entry.name,
              filePath: fullPath,
              language,
            },
          });

          // Register filename -> path map to assist resolving bare imports later
          fileNameToPath.set(entry.name, fullPath);
        }
      }
    }
  }

  await walk('/');

  // Second pass: read each file and try to resolve imports to other files we found
  for (const node of nodes) {
    const src = node.data.filePath;

    try {
      const content = (await container.fs.readFile(src, 'utf-8')) as string;

      const importTargets: string[] = [];

      // Match common import patterns (JS/TS and require)
      const fromRegex = /from\s+["'](.+?)["']/g;
      const importRegex = /import\s+(?:.+?\s+from\s+)?["'](.+?)["']/g;
      const requireRegex = /require\(\s*["'](.+?)["']\s*\)/g;
      const javaImportRegex = /import\s+([\w\.]+);/g;

      let m: RegExpExecArray | null;

      while ((m = fromRegex.exec(content))) {
        importTargets.push(m[1]);
      }

      while ((m = importRegex.exec(content))) {
        importTargets.push(m[1]);
      }

      while ((m = requireRegex.exec(content))) {
        importTargets.push(m[1]);
      }

      // Java imports: map package.Class to a basename.Class or Class.java
      while ((m = javaImportRegex.exec(content))) {
        const pkg = m[1];
        const parts = pkg.split('.');
        const className = parts[parts.length - 1];
        importTargets.push(className);
      }

      for (const target of importTargets) {
        let resolvedTarget: string | null = null;

        // Relative paths: resolve against src dir
        if (target.startsWith('./') || target.startsWith('../')) {
          const base = pathUtils.dirname(src);
          const candidate = pathUtils.join(base, target);

          // Try with common extensions
          const tryExt = ['', '.ts', '.tsx', '.js', '.jsx', '.java', '.py', '.json'];

          for (const ext of tryExt) {
            const p = candidate + ext;

            try {
              // try reading to confirm existence
              await container.fs.readFile(p, 'utf-8');
              resolvedTarget = p;
              break;
            } catch {
              // continue
            }
          }
        } else {
          // Bare imports or package-like imports: try to resolve by basename
          const last = target.split('/').pop() || target;

          // strip extensions if present
          const baseName = last.replace(/\.(ts|tsx|js|jsx|java|py)$/, '');

          // direct filename match
          if (fileNameToPath.has(last)) {
            resolvedTarget = fileNameToPath.get(last)!;
          } else if (fileNameToPath.has(baseName + '.ts')) {
            resolvedTarget = fileNameToPath.get(baseName + '.ts') || null;
          } else if (fileNameToPath.has(baseName + '.java')) {
            resolvedTarget = fileNameToPath.get(baseName + '.java') || null;
          } else if (fileNameToPath.has(baseName + '.js')) {
            resolvedTarget = fileNameToPath.get(baseName + '.js') || null;
          } else if (fileNameToPath.has(baseName)) {
            resolvedTarget = fileNameToPath.get(baseName) || null;
          }
        }

        if (resolvedTarget) {
          edges.push({
            data: {
              id: `${src}->${resolvedTarget}`,
              source: src,
              target: resolvedTarget,
              type: 'import',
              cycle: false,
            },
          });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return {
    nodes,
    edges,
    cycles: [],
    isFallback: true,
  };
}

/**
 * Filter graph nodes using semantic search on vector embeddings.
 */
export async function semanticFilter(
  repoUrl: string,
  query: string,
  topK: number = 10,
): Promise<{
  query: string;
  matchingNodes: string[];
  details: Array<{ filePath: string; nodeId: string; chunkIndex: number; preview: string }>;
  totalMatches: number;
  error?: string;
}> {
  const body = { query, topK };
  console.log('[semanticFilter] Request:', { repoUrl, body });

  return request(`/api/graph/semantic-filter?repoUrl=${encodeURIComponent(repoUrl)}`, 'POST', body);
}

/**
 * Get graph statistics including complexity metrics.
 */
export async function getGraphStats(repoUrl: string): Promise<{
  totalNodes: number;
  totalEdges: number;
  languages: Record<string, number>;
  hubs: Array<{ filePath: string; inDegree: number; outDegree: number; complexity: number; language: string }>;
  nodeStats: Record<
    string,
    { filePath: string; inDegree: number; outDegree: number; complexity: number; language: string }
  >;
  avgComplexity: number;
}> {
  return request(`/api/graph/stats?repoUrl=${encodeURIComponent(repoUrl)}`);
}
