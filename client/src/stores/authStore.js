import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// High-fidelity Mock Admin User for Auth-Free Mode
const mockAdmin = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'admin@amzlink.local',
  user_metadata: {
    name: 'System Administrator',
    display_name: 'System Administrator',
  },
};

export const useAuthStore = create((set) => ({
  user: mockAdmin,
  session: null,
  loading: false,
  isAuthenticated: true,

  initialize: () => {
    // Auth is completely bypassed for immediate, secure offline-first dashboard operation.
    // However, we attempt to bind to the active Supabase session in the background
    // to preserve sync functionality if a valid session exists.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        set({
          session,
          user: session.user,
          loading: false,
          isAuthenticated: true,
        });
      } else {
        set({
          session: null,
          user: mockAdmin,
          loading: false,
          isAuthenticated: true,
        });
      }
    }).catch(() => {
      // Graceful fallback when remote Supabase is unreachable
      set({
        session: null,
        user: mockAdmin,
        loading: false,
        isAuthenticated: true,
      });
    });

    // Quietly listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        set({
          session,
          user: session.user,
          loading: false,
          isAuthenticated: true,
        });
      } else {
        set({
          session: null,
          user: mockAdmin,
          loading: false,
          isAuthenticated: true,
        });
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  },

  login: async (email, password) => {
    // Mock login bypass
    set({ user: mockAdmin, isAuthenticated: true, loading: false });
  },

  register: async (email, password, name) => {
    // Mock registration bypass
    set({ user: mockAdmin, isAuthenticated: true, loading: false });
  },

  logout: async () => {
    // Mock logout bypass - we stay authenticated as admin
    set({ user: mockAdmin, isAuthenticated: true, loading: false });
  },
}));
