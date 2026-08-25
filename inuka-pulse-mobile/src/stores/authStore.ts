import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY, login as apiLogin } from "../api/client";

export interface SessionUser {
  userId: number;
  name: string;
  email: string;
  role: string;
  token: string;
}

interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiLogin(email, password);
      const user: SessionUser = {
        userId: response.userId,
        name: response.name,
        email: response.email,
        role: response.role,
        token: response.token,
      };
      // Persist token securely on device
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      // Also store user info as JSON for session restore
      await SecureStore.setItemAsync("inuka_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      // Axios error with backend message
      const axiosMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
      set({ error: axiosMsg ?? message, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync("inuka_user");
    set({ user: null, isAuthenticated: false, error: null });
  },

  restoreSession: async () => {
    try {
      const userJson = await SecureStore.getItemAsync("inuka_user");
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (userJson && token) {
        const user: SessionUser = JSON.parse(userJson);
        set({ user, isAuthenticated: true });
      }
    } catch {
      // Corrupted storage — start fresh
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync("inuka_user");
    }
  },
}));
