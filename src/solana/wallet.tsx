import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Transaction } from '@solana/web3.js';

// Minimal typing for Phantom's injected provider. We talk to it directly
// rather than through a wallet-adapter abstraction.
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signMessage?: (msg: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
  on: (event: string, handler: (args: unknown) => void) => void;
  removeListener?: (event: string, handler: (args: unknown) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

function getProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const p = window.phantom?.solana ?? window.solana;
  return p?.isPhantom ? p : null;
}

interface WalletState {
  installed: boolean;
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Sign + send a transaction via Phantom. Throws if no wallet is connected. */
  signAndSendTransaction: (tx: Transaction) => Promise<string>;
}

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const installed = !!getProvider();

  useEffect(() => {
    const p = getProvider();
    if (!p) return;

    // We intentionally do NOT auto-connect on load — Phantom is only ever
    // contacted when the user explicitly clicks "Connect". We just listen so
    // the UI stays in sync if they connect/disconnect/switch accounts.
    const sync = () => {
      const pk = getProvider()?.publicKey;
      setAddress(pk ? pk.toString() : null);
    };
    p.on('connect', sync);
    p.on('disconnect', () => setAddress(null));
    p.on('accountChanged', sync);
    return () => {
      p.removeListener?.('connect', sync);
      p.removeListener?.('accountChanged', sync);
    };
  }, []);

  async function connect() {
    const p = getProvider();
    if (!p) {
      window.open('https://phantom.app/', '_blank', 'noopener');
      return;
    }
    setConnecting(true);
    try {
      const res = await p.connect();
      setAddress(res.publicKey.toString());
    } catch {
      // user rejected the connection
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await getProvider()?.disconnect().catch(() => {});
    setAddress(null);
  }

  async function signAndSendTransaction(tx: Transaction): Promise<string> {
    const p = getProvider();
    if (!p?.signAndSendTransaction) throw new Error('Connect a wallet first.');
    const { signature } = await p.signAndSendTransaction(tx);
    return signature;
  }

  return (
    <WalletCtx.Provider
      value={{ installed, address, connecting, connect, disconnect, signAndSendTransaction }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within <WalletProvider>');
  return ctx;
}

/** "9xQe…A1b2" — short display form of a wallet address. */
export function shortAddress(a: string): string {
  return a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
