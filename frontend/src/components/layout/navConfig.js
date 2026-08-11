import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Sparkles,
  ImagePlus,
  FileText,
  Images,
  Lightbulb,
  Layers,
  Clapperboard,
  Store,
  Package,
  Link2,
  QrCode,
  PlugZap,
  Send,
  BarChart3,
  Users,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/calendar', label: 'Content Calendar', icon: CalendarDays },
      { to: '/approvals', label: 'Approvals', icon: CheckSquare, badge: 'pending' },
    ],
  },
  {
    label: 'Create with AI',
    items: [
      { to: '/briefs', label: 'Creative Briefs', icon: FileText },
      // { to: '/assets', label: 'Asset Library', icon: Images },
    ],
  },
  {
    label: 'Brand',
    items: [
      { to: '/brands', label: 'Brands', icon: Store },
      { to: '/products', label: 'Products', icon: Package },

    ],
  },
  {
    label: 'Grow',
    items: [
      { to: '/team', label: 'Team', icon: Users, ownerOnly: true },
    ],
  },
];
