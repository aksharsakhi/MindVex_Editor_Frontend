import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

type OS = 'mac' | 'windows';

const SHORTCUT_CATEGORIES = [
  {
    title: 'General',
    shortcuts: [
      { id: 'command-palette', label: 'Command Palette', mac: ['⌘', 'K'], win: ['Ctrl', 'K'] },
      { id: 'settings', label: 'Open Settings', mac: ['⌘', ','], win: ['Ctrl', ','] },
      { id: 'close', label: 'Close Panel / Escape', mac: ['Esc'], win: ['Esc'] },
      { id: 'clear', label: 'Clear Chat', mac: ['⌘', 'L'], win: ['Ctrl', 'L'] },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { id: 'save', label: 'Save File', mac: ['⌘', 'S'], win: ['Ctrl', 'S'] },
      { id: 'find', label: 'Find', mac: ['⌘', 'F'], win: ['Ctrl', 'F'] },
      { id: 'replace', label: 'Replace', mac: ['⌘', '⌥', 'F'], win: ['Ctrl', 'H'] },
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', mac: ['⌘', 'B'], win: ['Ctrl', 'B'] },
      { id: 'toggle-terminal', label: 'Toggle Terminal', mac: ['⌘', '`'], win: ['Ctrl', '`'] },
    ],
  },
  {
    title: 'AI Assistance',
    shortcuts: [
      { id: 'inline-chat', label: 'Inline AI Edit', mac: ['⌘', 'I'], win: ['Ctrl', 'I'] },
      { id: 'accept-suggestion', label: 'Accept AI Suggestion', mac: ['Tab'], win: ['Tab'] },
      { id: 'reject-suggestion', label: 'Reject AI Suggestion', mac: ['Esc'], win: ['Esc'] },
      { id: 'explain-code', label: 'Explain Selected Code', mac: ['⌘', 'E'], win: ['Ctrl', 'E'] },
    ],
  },
];

export default function ShortcutsTab() {
  const [os, setOs] = React.useState<OS>('windows');

  React.useEffect(() => {
    // Detect OS for correct shortcut display
    if (typeof window !== 'undefined') {
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      setOs(isMac ? 'mac' : 'windows');
    }
  }, []);

  const kbdClass = classNames(
    'inline-flex items-center justify-center',
    'min-w-[24px] h-6 px-1.5 rounded-md text-[11px] font-mono font-medium shadow-sm',
    'bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300',
    'border border-gray-200 dark:border-gray-700',
    'border-b-2', // To give it a key-like depth
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* OS Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={classNames(
          'flex items-center justify-between p-4 rounded-xl',
          'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/5 dark:to-indigo-500/5',
          'border border-purple-200/50 dark:border-purple-500/10',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:keyboard text-purple-500 w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Work faster with keyboard bindings. Displaying shortcuts for {os === 'mac' ? 'macOS' : 'Windows/Linux'}.
            </p>
          </div>
        </div>

        <div className="flex bg-[#E5E5E5] dark:bg-[#1A1A1A] p-1 rounded-lg">
          <button
            onClick={() => setOs('mac')}
            className={classNames(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5',
              os === 'mac'
                ? 'bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            <div className="i-ph:apple-logo text-[14px]" />
            macOS
          </button>
          <button
            onClick={() => setOs('windows')}
            className={classNames(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5',
              os === 'windows'
                ? 'bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            <div className="i-ph:windows-logo text-[14px]" />
            Windows
          </button>
        </div>
      </motion.div>

      {/* Shortcut Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SHORTCUT_CATEGORIES.map((category, catIndex) => (
          <motion.div
            key={category.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.1 }}
            className="flex flex-col gap-3"
          >
            <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-1">
              {category.title}
            </h4>
            <div
              className={classNames(
                'rounded-xl overflow-hidden',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              )}
            >
              {category.shortcuts.map((shortcut, index) => {
                const keys = os === 'mac' ? shortcut.mac : shortcut.win;
                return (
                  <div
                    key={shortcut.id}
                    className={classNames(
                      'flex items-center justify-between p-3',
                      index !== category.shortcuts.length - 1 && 'border-b border-[#E5E5E5] dark:border-[#1A1A1A]',
                    )}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((key, i) => (
                        <kbd key={i} className={kbdClass}>
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
