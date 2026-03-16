import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type HouseholdMember = {
  id: string;
  name: string;
  pin: string | null;
};

type AuthContextType = {
  currentUser: HouseholdMember | null;
  login: (member: HouseholdMember) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = "homebase_current_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<HouseholdMember | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [currentUser]);

  const login = (member: HouseholdMember) => setCurrentUser(member);
  const logout = () => setCurrentUser(null);

  return (
    <AuthContext.Provider
      value={{ currentUser, login, logout, isAuthenticated: !!currentUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
