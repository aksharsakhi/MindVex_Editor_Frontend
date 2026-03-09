import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { initAuth } from '~/lib/stores/authStore';

/**
 * Catch-all OAuth callback route
 * Handles redirects from backend OAuth flow at /auth/oauth2/callback/github?token=...
 * (and any other OAuth provider callback paths)
 */
export default function AuthOauth2Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize auth - this will pick up the token from URL params
    initAuth();

    // Give it a moment to process, then redirect to home
    const timer = setTimeout(() => {
      navigate('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-bolt-elements-background-depth-1">
      <div className="text-center">
        <div className="i-svg-spinners:90-ring-with-bg text-4xl text-bolt-elements-textPrimary mb-4" />
        <p className="text-bolt-elements-textPrimary">Completing sign in...</p>
      </div>
    </div>
  );
}
