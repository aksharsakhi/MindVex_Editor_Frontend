import type { ServerBuild } from '@remix-run/cloudflare';
import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Proxy API requests to the backend (bypass CORS and network issues)
  if (url.pathname.startsWith('/api/')) {
    // Get backend URL from environment variables
    // - In production (Cloudflare Pages): uses VITE_BACKEND_URL from wrangler.toml
    // - In development: falls back to localhost:8080/api
    // IMPORTANT: Backend URL should end with /api (e.g., http://localhost:8080/api)
    const backendUrl = context.env.VITE_BACKEND_URL || 'http://127.0.0.1:8080/api';

    // Strip '/api' prefix from the pathname since backend URL already includes it
    // Example: /api/users/me/github-token → /users/me/github-token
    const apiPath = url.pathname.replace(/^\/api/, '');

    // Construct the full target URL using string concatenation
    // Example: http://localhost:8080/api + /users/me/github-token = http://localhost:8080/api/users/me/github-token
    const targetUrlString = backendUrl + apiPath + url.search;

    // Create a new request with the same method, headers, and body
    const proxyRequest = new Request(targetUrlString, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });

    // Forward the request
    try {
      const response = await fetch(proxyRequest);

      // Create a new response to ensure proper headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (e) {
      console.error('Backend proxy error:', e);
      return new Response(`Backend proxy error: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
    }
  }

  // @ts-ignore - Build server is generated at build time
  const serverBuild = (await import('../build/server')) as unknown as ServerBuild;

  const handler = createPagesFunctionHandler({
    build: serverBuild,
  });

  return handler(context);
};
