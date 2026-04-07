'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import {
  formatApiError,
  getAuthMe,
  logoutAuth,
  requestAuthChallenge,
  setApiAuthToken,
  updateAuthProfile,
  verifyAuthChallenge,
} from '@/lib/api';
import type { UserRole } from '@/types';

type AuthStatus = 'disconnected' | 'restoring' | 'signing' | 'authenticated' | 'error';

interface AuthUser {
  wallet: string;
  role: UserRole;
  roles: UserRole[];
  displayName?: string;
  sessionExpiresAt: string;
}

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  wallet: string | null;
  user: AuthUser | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
}

const AUTH_TOKEN_KEY = 'factora-auth-token';
const AUTH_WALLET_KEY = 'factora-auth-wallet';

const AuthContext = createContext<AuthContextValue>({
  status: 'disconnected',
  isAuthenticated: false,
  wallet: null,
  user: null,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  saveDisplayName: async () => {},
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function normalizeRoles(roles: UserRole[] | undefined, role: UserRole): UserRole[] {
  if (roles && roles.length > 0) {
    return roles;
  }
  return role !== 'unknown' ? [role] : [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;
  const [status, setStatus] = useState<AuthStatus>('disconnected');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearLocalAuth = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_WALLET_KEY);
    setApiAuthToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const me = await getAuthMe();
    setUser({
      wallet: me.wallet,
      role: me.role,
      roles: normalizeRoles(me.roles as UserRole[] | undefined, me.role),
      displayName: me.displayName ?? undefined,
      sessionExpiresAt: me.sessionExpiresAt,
    });
    setStatus('authenticated');
    setError(null);
  }, []);

  const signIn = useCallback(async () => {
    if (!connectedWallet || !publicKey) {
      throw new Error('Wallet is not connected');
    }
    if (!signMessage) {
      throw new Error('This wallet does not support message signing');
    }

    setStatus('signing');
    setError(null);

    try {
      const challenge = await requestAuthChallenge(connectedWallet);
      const signatureBytes = await signMessage(new TextEncoder().encode(challenge.message));
      const session = await verifyAuthChallenge({
        wallet: connectedWallet,
        nonce: challenge.nonce,
        signature: bytesToBase64(signatureBytes),
      });

      window.localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      window.localStorage.setItem(AUTH_WALLET_KEY, session.wallet);
      setApiAuthToken(session.token);
      setUser({
        wallet: session.wallet,
        role: session.role,
        roles: normalizeRoles(session.roles as UserRole[] | undefined, session.role),
        displayName: session.displayName ?? undefined,
        sessionExpiresAt: session.expiresAt,
      });
      setStatus('authenticated');
      setError(null);
    } catch (authError) {
      clearLocalAuth();
      setStatus('error');
      const message = formatApiError(authError);
      setError(message);
      throw new Error(message);
    }
  }, [clearLocalAuth, connectedWallet, publicKey, signMessage]);

  const signOut = useCallback(async () => {
    try {
      await logoutAuth();
    } catch {
      // ignore remote logout failures during local sign-out
    } finally {
      clearLocalAuth();
      setStatus('disconnected');
      setError(null);
      try {
        await disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
  }, [clearLocalAuth, disconnect]);

  const saveDisplayName = useCallback(async (displayName: string) => {
    const me = await updateAuthProfile(displayName);
    setUser({
      wallet: me.wallet,
      role: me.role,
      roles: normalizeRoles(me.roles as UserRole[] | undefined, me.role),
      displayName: me.displayName ?? undefined,
      sessionExpiresAt: me.sessionExpiresAt,
    });
  }, []);

  useEffect(() => {
    if (!connected || !connectedWallet) {
      clearLocalAuth();
      setStatus('disconnected');
      setError(null);
      return;
    }

    let cancelled = false;

    const restoreOrSign = async () => {
      const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
      const storedWallet = window.localStorage.getItem(AUTH_WALLET_KEY);

      if (storedToken && storedWallet === connectedWallet) {
        setApiAuthToken(storedToken);
        setStatus('restoring');
        try {
          await refreshProfile();
          if (!cancelled) {
            toast.success('Wallet session restored');
          }
          return;
        } catch {
          clearLocalAuth();
        }
      }

      if (cancelled) return;

      try {
        await signIn();
        if (!cancelled) {
          toast.success('Wallet connected and authenticated');
        }
      } catch (authError) {
        if (!cancelled) {
          toast.error(authError instanceof Error ? authError.message : 'Wallet sign-in failed');
        }
      }
    };

    void restoreOrSign();

    return () => {
      cancelled = true;
    };
  }, [clearLocalAuth, connected, connectedWallet, refreshProfile, signIn]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    isAuthenticated: status === 'authenticated' && !!user,
    wallet: user?.wallet ?? connectedWallet,
    user,
    error,
    signIn,
    signOut,
    refreshProfile,
    saveDisplayName,
  }), [connectedWallet, error, refreshProfile, signIn, signOut, status, user, saveDisplayName]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
