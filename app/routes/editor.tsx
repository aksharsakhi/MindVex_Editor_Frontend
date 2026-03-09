import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { workbenchStore } from '~/lib/stores/workbench';
import React from 'react';

export const meta: MetaFunction = () => {
  return [{ title: 'MindVex - Editor' }, { name: 'description', content: 'MindVex code editor workspace' }];
};

export const loader = () => json({});

export default function EditorPage() {
  return (
    <div className="flex flex-col h-full w-full bg-mindvex-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex-1 relative min-h-0">
          <ClientOnly fallback={<div>Loading editor...</div>}>
            {() => {
              const [, setShowWorkbench] = React.useState(false);

              React.useEffect(() => {
                // Subscribe to workbench state changes
                const unsubscribe = workbenchStore.showWorkbench.subscribe((value: boolean) => {
                  setShowWorkbench(value);
                });

                // Ensure workbench is shown when on editor page
                if (!workbenchStore.showWorkbench.get()) {
                  workbenchStore.showWorkbench.set(true);
                }

                // Load the saved workspace state if available
                workbenchStore.loadWorkspaceState();

                // Set documents to update the editor store
                workbenchStore.setDocuments(workbenchStore.files.get(), false);

                return unsubscribe;
              }, []);

              return (
                <div className="flex-1 h-full">
                  <Workbench chatStarted={false} isStreaming={false} standalone={true} />
                </div>
              );
            }}
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
