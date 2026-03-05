import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Link } from '@remix-run/react';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { providersStore } from '~/lib/stores/settings';
import { Brain, Settings } from 'lucide-react';
import { useState } from 'react';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';

export function Header() {
  const chat = useStore(chatStore);
  const providers = useStore(providersStore);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isAIConfigured = Object.values(providers).some((p) => p.settings.enabled && p.settings.apiKey);

  return (
    <>
      <header
        className={classNames('flex items-center px-4 border-b h-[var(--header-height)] relative z-10', {
          'border-transparent': !chat.started,
          'border-mindvex-elements-borderColor': chat.started,
        })}
      >
        <div className="flex items-center gap-2 z-logo text-mindvex-elements-textPrimary cursor-pointer">
          <div className="i-ph:sidebar-simple-duotone text-xl" />
          <Link to="/" className="text-2xl font-semibold text-accent flex items-center">
            <span className="font-bold text-xl text-mindvex-elements-textPrimary">CodeNexus</span>
          </Link>
        </div>

        <div className="flex-1 flex justify-center items-center gap-4">
          {chat.started && (
            <span className="px-4 truncate text-mindvex-elements-textPrimary max-w-md">
              <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            </span>
          )}

          {!isAIConfigured && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
            >
              <Brain className="w-3 h-3" />
              AI Not Configured (Add API Key)
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-mindvex-elements-item-backgroundHover transition-colors text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </div>
      </header>

      <ControlPanel open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
