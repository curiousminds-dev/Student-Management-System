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
import { authService, MfaRequiredError } from "@/services";
import { DEMO_ACCOUNTS } from "@/lib/roles";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signingIn: boolean;
  login: (role: RoleKey) => Promise<void>;
  mfaRequired: boolean;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => void;
  can: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "ncs.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);

  useEffect(() => {
    void authService
      .me()
      .then((current) => {
        if (current) setUser(current);
        else {
          try {
            const raw = window.sessionStorage.getItem(STORAGE_KEY);
            if (raw) setUser(JSON.parse(raw) as User);
          } catch {
            /* ignore corrupt display cache */
          }
        }
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (role: RoleKey) => {
    setSigningIn(true);
    try {
      const account = DEMO_ACCOUNTS.find((a) => a.role === role)!;
      const next = await authService.login(role, account.name, account.email);
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setUser(next);
    } catch (error) {
      if (error instanceof MfaRequiredError) setMfaChallenge(error.challengeToken);
      else throw error;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const verifyMfa = useCallback(
    async (code: string) => {
      if (!mfaChallenge) return;
      setSigningIn(true);
      try {
        const next = await authService.verifyMfa(mfaChallenge, code);
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
        setMfaChallenge(null);
      } finally {
        setSigningIn(false);
      }
    },
    [mfaChallenge],
  );

  const logout = useCallback(() => {
    authService.logout();
    window.sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: PermissionKey) =>
      !!user &&
      (user.permissions.includes(permission) || (user.permissions as string[]).includes("*")),
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, signingIn, login, logout, can, mfaRequired: !!mfaChallenge, verifyMfa }),
    [user, ready, signingIn, login, logout, can, mfaChallenge, verifyMfa],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
