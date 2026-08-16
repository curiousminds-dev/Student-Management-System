import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PermissionKey, RoleKey, User } from "@/types";
import { authService } from "@/services";
import { DEMO_ACCOUNTS } from "@/lib/roles";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signingIn: boolean;
  login: (role: RoleKey) => Promise<void>;
  logout: () => void;
  can: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "ncs.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as User);
    } catch {
      /* ignore corrupt session */
    }
    setReady(true);
  }, []);

  const login = useCallback(async (role: RoleKey) => {
    setSigningIn(true);
    try {
      const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;
      const next = await authService.login(role, account.name, account.email);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setUser(next);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: PermissionKey) =>
      !!user &&
      (user.permissions.includes(permission) || (user.permissions as string[]).includes("*")),
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, signingIn, login, logout, can }),
    [user, ready, signingIn, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
