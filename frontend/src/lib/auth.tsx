"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "./api";
import type { User, AuthTokens } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = api.getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      api.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const tokens = await api.post<AuthTokens>("/api/auth/login", { email, password });
    api.setTokens(tokens.access_token, tokens.refresh_token);
    await fetchUser();
  };

  const register = async (email: string, password: string, displayName: string) => {
    await api.post("/api/auth/register", {
      email,
      password,
      display_name: displayName,
    });
    await login(email, password);
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
