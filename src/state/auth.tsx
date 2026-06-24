import { createContext, useContext, useState, type ReactNode } from 'react';
import { API_URL } from '../net/client';
import type { Profile } from './storage';

const TOKEN_KEY = 'pokemon1v1:token';

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsUsername?: boolean;
  profile?: Profile;
}

interface AuthState {
  token: string | null;
  username: string | null;
  signup: (opts: { username: string; password?: string; wallet?: string }) => Promise<AuthResult>;
  login: (username: string, password: string) => Promise<AuthResult>;
  walletLogin: (wallet: string) => Promise<AuthResult>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

/** Decode the (unverified — display only, the server independently verifies
 * on every request) username out of a JWT's payload. */
function decodeUsername(token: string): string | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.username === 'string' ? payload.username : null;
  } catch {
    return null;
  }
}

async function postJson(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server. Try again." } };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? decodeUsername(t) : null;
  });

  function applyToken(t: string) {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUsername(decodeUsername(t));
  }

  async function signup(opts: {
    username: string;
    password?: string;
    wallet?: string;
  }): Promise<AuthResult> {
    const { ok, data } = await postJson('/api/signup', opts);
    if (!ok) return { ok: false, error: (data.error as string) ?? 'Sign-up failed.' };
    applyToken(data.token as string);
    return { ok: true, profile: data.profile as Profile };
  }

  async function login(usernameInput: string, password: string): Promise<AuthResult> {
    const { ok, data } = await postJson('/api/login', { username: usernameInput, password });
    if (!ok) return { ok: false, error: (data.error as string) ?? 'Login failed.' };
    applyToken(data.token as string);
    return { ok: true, profile: data.profile as Profile };
  }

  async function walletLogin(wallet: string): Promise<AuthResult> {
    const { ok, data } = await postJson('/api/wallet-login', { wallet });
    if (!ok) return { ok: false, error: (data.error as string) ?? 'Wallet login failed.' };
    if (data.needsUsername) return { ok: true, needsUsername: true };
    applyToken(data.token as string);
    return { ok: true, profile: data.profile as Profile };
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUsername(null);
  }

  return (
    <AuthCtx.Provider value={{ token, username, signup, login, walletLogin, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
