import { create } from 'zustand';

const applyTheme = (theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
};

const initialTheme = () => {
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useUI = create((set, get) => ({
  theme: initialTheme(),
  sidebarOpen: false, // mobile drawer
  activeBrandId: localStorage.getItem('activeBrandId') || null,

  toggleTheme() {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },

  setSidebar(open) {
    set({ sidebarOpen: open });
  },

  setActiveBrand(id) {
    if (id) localStorage.setItem('activeBrandId', id);
    else localStorage.removeItem('activeBrandId');
    set({ activeBrandId: id });
  },
}));
