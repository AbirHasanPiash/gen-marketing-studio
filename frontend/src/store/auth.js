import { create } from 'zustand';
import { post, get, setToken, getToken } from '../lib/api';

export const useAuth = create((set, getState) => ({
  user: null,
  loading: true, // true until the initial /me check resolves
  authError: null,

  isOwner: () => getState().user?.role === 'OWNER',

  async bootstrap() {
    if (!getToken()) {
      set({ loading: false });
      return;
    }
    try {
      const { user } = await get('/auth/me');
      set({ user, loading: false });
    } catch {
      setToken(null);
      set({ user: null, loading: false });
    }
  },

  async login(email, password) {
    set({ authError: null });
    const { token, user } = await post('/auth/login', { email, password });
    setToken(token);
    set({ user });
    return user;
  },

  async register(payload) {
    set({ authError: null });
    const { token, user } = await post('/auth/register', payload);
    setToken(token);
    set({ user });
    return user;
  },

  logout() {
    setToken(null);
    set({ user: null });
  },
}));
