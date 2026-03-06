import type { WebContainer } from '@webcontainer/api';
import { useCallback, useEffect, useState } from 'react';
import { webcontainer as webcontainerPromise } from '~/lib/webcontainer';
import { toast } from 'react-toastify';

export function useGit() {
  const [ready, setReady] = useState(false);
  const [webcontainer, setWebcontainer] = useState<WebContainer>();

  useEffect(() => {
    webcontainerPromise.then((container) => {
      setWebcontainer(container);
      setReady(true);
    });
  }, []);

  const gitClone = useCallback(
    async (url: string, retryCount = 0) => {
      if (!webcontainer || !ready) {
        throw new Error('Webcontainer not initialized. Please try again later.');
      }

      // Remove branch reference if present (we'll use default branch)
      const baseUrl = url.split('#')[0];

      try {
        // Add a small delay before retrying
        if (retryCount > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
          console.log(`Retrying clone (attempt ${retryCount + 1})...`);
        }

        console.log('[Clone] Using backend to clone repository:', baseUrl);

        // Use the backend endpoint to clone the repository
        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api';
        const token = localStorage.getItem('auth_token');

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/repositories/clone`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: baseUrl }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as any;

        if (!result.success) {
          throw new Error(result.message || 'Failed to clone repository');
        }

        console.log(`[Clone] Backend cloned ${Object.keys(result.files || {}).length} files`);

        // Write files to WebContainer
        const data: Record<string, { data: any; encoding?: string }> = {};

        for (const [relativePath, fileData] of Object.entries(result.files || {})) {
          const fileInfo = fileData as { content: string; encoding: string; binary: boolean };
          const fullPath = `${webcontainer.workdir}/${relativePath}`;

          try {
            // Ensure parent directory exists
            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) {
              const dirPath = pathParts.slice(0, -1).join('/');
              await webcontainer.fs.mkdir(dirPath, { recursive: true });
            }

            // Write file
            if (fileInfo.binary && fileInfo.encoding === 'base64') {
              // Decode base64 for binary files
              const binaryData = Uint8Array.from(atob(fileInfo.content), (c) => c.charCodeAt(0));
              await webcontainer.fs.writeFile(relativePath, binaryData);
              data[relativePath] = { data: binaryData, encoding: 'binary' };
            } else {
              // Write text files
              await webcontainer.fs.writeFile(relativePath, fileInfo.content);
              data[relativePath] = { data: fileInfo.content, encoding: 'utf-8' };
            }
          } catch (error) {
            console.warn(`[Clone] Failed to write file ${relativePath}:`, error);
          }
        }

        console.log('[Clone] Successfully loaded files into WebContainer');
        toast.success('Repository cloned successfully!');

        return { workdir: webcontainer.workdir, data };
      } catch (error) {
        console.error('[Clone] Error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide user-friendly error messages
        if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
          toast.error('Authentication failed. Please connect your GitHub account.');
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          toast.error('Repository not found. Please check the URL.');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          // Retry for network errors
          if (retryCount < 2) {
            return gitClone(url, retryCount + 1);
          }
          toast.error('Network error. Please check your connection and try again.');
        } else {
          toast.error(`Failed to clone repository: ${errorMessage}`);
        }

        throw error;
      }
    },
    [webcontainer, ready],
  );

  return { ready, gitClone };
}
