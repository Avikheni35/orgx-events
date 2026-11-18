import { create } from 'zustand';
import type { AuthUser } from '../types';
import { setApiToken } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setAccessToken: (token: string) => void;
  setInitialized: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,
  setAuth: (user, accessToken) => { setApiToken(accessToken); set({ user, accessToken, isAuthenticated: true, isInitializing: false }); },
  setAccessToken: (accessToken) => { setApiToken(accessToken); set({ accessToken }); },
  setInitialized: () => set({ isInitializing: false }),
  logout: () => { setApiToken(null); set({ user: null, accessToken: null, isAuthenticated: false }); },
}));
