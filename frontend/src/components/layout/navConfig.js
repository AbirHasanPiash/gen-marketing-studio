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
      { to: '/copy', label: 'Copy Studio', icon: Sparkles },
      { to: '/images', label: 'Image Studio', icon: ImagePlus },
      { to: '/briefs', label: 'Creative Briefs', icon: FileText },
      { to: '/assets', label: 'Asset Library', icon: Images },
      { to: '/campaigns', label: 'Campaign Ideas', icon: Lightbulb },
      { to: '/composite', label: 'Compositing', icon: Layers },
      { to: '/video', label: 'Video Studio', icon: Clapperboard },
    ],
  },
  {
    label: 'Brand',
    items: [
      { to: '/brands', label: 'Brands', icon: Store },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/linkbio', label: 'Link-in-Bio', icon: Link2 },
      { to: '/qr', label: 'QR Codes', icon: QrCode },
    ],
  },
  {
    label: 'Grow',
    items: [
      { to: '/connections', label: 'Connections', icon: PlugZap },
      { to: '/publishing', label: 'Publishing', icon: Send },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/team', label: 'Team', icon: Users, ownerOnly: true },
    ],
  },
];
