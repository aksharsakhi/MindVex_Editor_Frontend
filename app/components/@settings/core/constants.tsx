import type { TabType } from './types';
import { User, Settings, Bell, Star, Database, Cloud, Laptop, List, Palette, Keyboard } from 'lucide-react';

export const TAB_ICONS: Record<TabType, React.ComponentType<{ className?: string }>> = {
  profile: User,
  settings: Settings,
  notifications: Bell,
  features: Star,
  data: Database,
  'cloud-providers': Cloud,
  'local-providers': Laptop,
  'event-logs': List,
  appearance: Palette,
  shortcuts: Keyboard,
};

export const TAB_LABELS: Record<TabType, string> = {
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
  features: 'Features',
  data: 'Data Management',
  'cloud-providers': 'Cloud Providers',
  'local-providers': 'Local Providers',
  'event-logs': 'Event Logs',
  appearance: 'Appearance',
  shortcuts: 'Keyboard Shortcuts',
};

export const TAB_DESCRIPTIONS: Record<TabType, string> = {
  profile: 'Manage your profile and account settings',
  settings: 'Configure application preferences',
  notifications: 'View and manage your notifications',
  features: 'Explore new and upcoming features',
  data: 'Manage your data and storage',
  'cloud-providers': 'Configure cloud AI providers and models',
  'local-providers': 'Configure local AI providers and models',
  'event-logs': 'View system events and logs',
  appearance: 'Customize theme and visuals',
  shortcuts: 'View and customize keyboard shortcuts',
};

export const DEFAULT_TAB_CONFIG = [
  // User Window Tabs (Always visible by default)
  { id: 'features', visible: true, window: 'user' as const, order: 0 },
  { id: 'cloud-providers', visible: true, window: 'user' as const, order: 1 },
  { id: 'local-providers', visible: true, window: 'user' as const, order: 2 },
  { id: 'appearance', visible: true, window: 'user' as const, order: 3 },
  { id: 'data', visible: true, window: 'user' as const, order: 4 },
  { id: 'notifications', visible: true, window: 'user' as const, order: 5 },
  { id: 'shortcuts', visible: true, window: 'user' as const, order: 6 },
  { id: 'event-logs', visible: true, window: 'user' as const, order: 7 },
];
