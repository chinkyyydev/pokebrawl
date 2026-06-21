import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Minimal typing for Phantom's injected provider. We talk to it directly so we
// need no Solana libraries yet (those come when we move actual SOL).
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signMessage?: (msg: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
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
}

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const installed = !!getProvider();

  useEffect(() => {
    const p = getProvider();
    if (!p) return;

    // Reconnect silently if the user already approved this site before.
    p.connect({ onlyIfTrusted: true }).then(
      (res) => setAddress(res.publicKey.toString()),
      () => {},
    );

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

  return (
    <WalletCtx.Provider value={{ installed, address, connecting, connect, disconnect }}>
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
