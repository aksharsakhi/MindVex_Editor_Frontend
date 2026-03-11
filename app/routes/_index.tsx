import { json, type MetaFunction } from '@remix-run/cloudflare';
import React from 'react';
import { useSearchParams } from '@remix-run/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { HomeContent } from '~/components/home/HomeContent.client';

export const meta: MetaFunction = () => {
  return [
    { title: 'CodeNexus' },
    { name: 'description', content: 'CodeNexus: Your comprehensive development platform' },
  ];
};

export const loader = () => json({});

import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/authStore';
import { LoginModal } from '~/components/auth/LoginModal';

/**
 * Landing page component for MindVex
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  const auth = useStore(authStore);
  const [searchParams, setSearchParams] = useSearchParams();
  const showLoginParam = searchParams.get('showLogin') === 'true';

  // Clear the showLogin param after reading it
  React.useEffect(() => {
    if (showLoginParam) {
      setSearchParams((prev) => {
        prev.delete('showLogin');
        return prev;
      });
    }
  }, [showLoginParam, setSearchParams]);

  return (
    <div className="flex flex-col h-full w-full bg-mindvex-elements-background-depth-1">
      <BackgroundRays />
      <Header />

      <div className="flex flex-1 overflow-hidden relative">
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <ClientOnly>
          {() => {
            const [showWorkbench, setShowWorkbench] = React.useState(false);

            React.useEffect(() => {
              const unsubscribe = workbenchStore.showWorkbench.subscribe((value: boolean) => {
                setShowWorkbench(value);
              });
              return unsubscribe;
            }, []);

            /*
             * Reset workbench visibility when arriving at the home page so
             * navigating back from /editor never leaves an empty tab bar
             * visible over the MindVex header.
             */
            React.useEffect(() => {
              workbenchStore.showWorkbench.set(false);
            }, []);

            return (
              <div className="flex-1 relative min-h-0">
                {!showWorkbench && <HomeContent />}

                {/* Workbench — fills entire area when shown */}
                <Workbench chatStarted={true} isStreaming={false} />

                {/* Login Modal - auto-open if showLogin param present or user not authenticated */}
                {!auth.isLoading && <LoginModal isOpen={!auth.isAuthenticated || showLoginParam} />}
              </div>
            );
          }}
        </ClientOnly>
      </div>
    </div>
  );
}
