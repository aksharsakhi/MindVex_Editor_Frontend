import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

/**
 * Chrome DevTools tries to access this route
 * Return empty JSON to suppress the error
 */
export async function loader({ request: _request }: LoaderFunctionArgs) {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
