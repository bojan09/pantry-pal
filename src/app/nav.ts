import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  Home,
  Layers,
  MoreHorizontal,
  Refrigerator,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/pantry', label: 'My Pantry', icon: Refrigerator },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/planner', label: 'Meal Planner', icon: CalendarDays },
  { to: '/shopping', label: 'Shopping List', icon: ShoppingCart },
  { to: '/expiring', label: 'Expiring Soon', icon: Clock },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/collections', label: 'Collections', icon: Layers },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const BOTTOM_NAV: NavItem[] = [
  NAV[0],
  { ...NAV[1], label: 'Pantry' },
  NAV[2],
  { ...NAV[3], label: 'Planner' },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

/** Pages reached from the mobile "More" tab. */
export const MORE_ITEMS: NavItem[] = NAV.filter((n) =>
  ['/shopping', '/expiring', '/analytics', '/collections', '/settings'].includes(n.to),
);
