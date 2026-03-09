import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

type ThemeMode = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large';
type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'cyan';

const ACCENT_COLORS: { id: AccentColor; label: string; value: string; ring: string }[] = [
  { id: 'purple', label: 'Purple', value: '#9333ea', ring: 'ring-purple-500' },
  { id: 'blue', label: 'Blue', value: '#3b82f6', ring: 'ring-blue-500' },
  { id: 'green', label: 'Green', value: '#10b981', ring: 'ring-emerald-500' },
  { id: 'orange', label: 'Orange', value: '#f97316', ring: 'ring-orange-500' },
  { id: 'pink', label: 'Pink', value: '#ec4899', ring: 'ring-pink-500' },
  { id: 'cyan', label: 'Cyan', value: '#06b6d4', ring: 'ring-cyan-500' },
];

export default function AppearanceTab() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [accentColor, setAccentColor] = useState<AccentColor>('purple');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  // Load saved preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mindvex_appearance');

      if (saved) {
        const data = JSON.parse(saved);

        if (data.theme) {
          setTheme(data.theme);
        }

        if (data.fontSize) {
          setFontSize(data.fontSize);
        }

        if (data.accentColor) {
          setAccentColor(data.accentColor);
        }

        if (data.animationsEnabled !== undefined) {
          setAnimationsEnabled(data.animationsEnabled);
        }

        if (data.compactMode !== undefined) {
          setCompactMode(data.compactMode);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save preferences
  const savePrefs = useCallback(
    (
      updates: Partial<{
        theme: ThemeMode;
        fontSize: FontSize;
        accentColor: AccentColor;
        animationsEnabled: boolean;
        compactMode: boolean;
      }>,
    ) => {
      const newPrefs = {
        theme,
        fontSize,
        accentColor,
        animationsEnabled,
        compactMode,
        ...updates,
      };
      localStorage.setItem('mindvex_appearance', JSON.stringify(newPrefs));
    },
    [theme, fontSize, accentColor, animationsEnabled, compactMode],
  );

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    savePrefs({ theme: newTheme });

    // Apply theme
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    }

    toast.success(`Theme set to ${newTheme}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Theme Selection */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:sun-dim w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Theme</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Choose your preferred color scheme</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light' as ThemeMode, label: 'Light', icon: 'i-ph:sun', desc: 'Bright interface' },
            { id: 'dark' as ThemeMode, label: 'Dark', icon: 'i-ph:moon', desc: 'Easy on the eyes' },
            { id: 'system' as ThemeMode, label: 'System', icon: 'i-ph:desktop', desc: 'Match OS setting' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleThemeChange(item.id)}
              className={classNames(
                'rounded-xl p-4 text-left transition-all duration-200',
                'border',
                theme === item.id
                  ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 ring-2 ring-purple-500/20'
                  : 'bg-[#FAFAFA] dark:bg-[#0A0A0A] border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-200 dark:hover:border-purple-800/30',
              )}
            >
              <div
                className={classNames(
                  item.icon,
                  'w-6 h-6 mb-2',
                  theme === item.id ? 'text-purple-500' : 'text-gray-400',
                )}
              />
              <div
                className={classNames(
                  'text-sm font-medium',
                  theme === item.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white',
                )}
              >
                {item.label}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Accent Color */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:palette w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Accent Color</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Choose your primary brand color</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => {
                setAccentColor(color.id);
                savePrefs({ accentColor: color.id });
                toast.success(`Accent color set to ${color.label}`);
              }}
              className={classNames(
                'w-10 h-10 rounded-full transition-all duration-200',
                accentColor === color.id
                  ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0A0A0A] scale-110'
                  : 'hover:scale-105',
                accentColor === color.id ? color.ring : '',
              )}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
        </div>
      </motion.div>

      {/* Font Size */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:text-aa w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Editor Font Size</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Adjust the code editor text size</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'small' as FontSize, label: 'Small', size: '12px' },
            { id: 'medium' as FontSize, label: 'Medium', size: '14px' },
            { id: 'large' as FontSize, label: 'Large', size: '16px' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setFontSize(item.id);
                savePrefs({ fontSize: item.id });
                toast.success(`Font size set to ${item.label}`);
              }}
              className={classNames(
                'rounded-xl p-3 text-center transition-all duration-200 border',
                fontSize === item.id
                  ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30'
                  : 'bg-[#FAFAFA] dark:bg-[#0A0A0A] border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-200',
              )}
            >
              <span
                className={classNames(
                  'font-mono',
                  fontSize === item.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300',
                )}
                style={{ fontSize: item.size }}
              >
                Aa
              </span>
              <div
                className={classNames(
                  'text-xs mt-1',
                  fontSize === item.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500',
                )}
              >
                {item.label} ({item.size})
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Display Options */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <div className="i-ph:sliders-horizontal w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Display Options</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Fine-tune the interface behavior</p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            {
              label: 'Animations',
              description: 'Enable smooth transitions and micro-animations',
              icon: 'i-ph:sparkle',
              checked: animationsEnabled,
              onChange: (v: boolean) => {
                setAnimationsEnabled(v);
                savePrefs({ animationsEnabled: v });
                toast.success(`Animations ${v ? 'enabled' : 'disabled'}`);
              },
            },
            {
              label: 'Compact Mode',
              description: 'Reduce spacing for more content on screen',
              icon: 'i-ph:arrows-in',
              checked: compactMode,
              onChange: (v: boolean) => {
                setCompactMode(v);
                savePrefs({ compactMode: v });
                toast.success(`Compact mode ${v ? 'enabled' : 'disabled'}`);
              },
            },
          ].map((item) => (
            <div
              key={item.label}
              className={classNames(
                'flex items-center justify-between p-4 rounded-xl',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:border-purple-200 dark:hover:border-purple-800/30',
                'transition-all duration-200',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={classNames(item.icon, 'w-4 h-4 text-gray-400')} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{item.description}</div>
                </div>
              </div>
              <button
                onClick={() => item.onChange(!item.checked)}
                className={classNames(
                  'relative w-11 h-6 rounded-full transition-colors duration-200',
                  item.checked ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600',
                )}
              >
                <div
                  className={classNames(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    item.checked ? 'translate-x-[22px]' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
