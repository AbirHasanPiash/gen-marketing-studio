import { CalendarDays, Store } from 'lucide-react';

export const NAV_GROUPS = [
  {
    label: 'Content',
    items: [{ to: '/calendar', label: 'Content Calendar', icon: CalendarDays }],
  },
  {
    label: 'Brand',
    items: [{ to: '/brands', label: 'Brands', icon: Store }],
  },
];
