import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type HouseholdMember = {
  id: string;
  name: string;
  pin?: string;
};

type AuthContextType = {
  currentUser: HouseholdMember | null;
  login: (memberId: string, pin: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = "homebase_current_user";
const MEMBERS_KEY = "homebase_members";

function loadMembers(): HouseholdMember[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
  } catch {
    return [];
  }
}

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

  const login = (memberId: string, pin: string): boolean => {
    const members = loadMembers();
    const member = members.find((m) => m.id === memberId);
    if (!member) return false;
    if (member.pin && member.pin !== pin) return false;
    if (!member.pin && pin !== "") return false;
    setCurrentUser(member);
    return true;
  };

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
