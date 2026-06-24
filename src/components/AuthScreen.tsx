import { useState } from 'react';
import { useAuth } from '../state/auth';
import type { Profile } from '../state/storage';
import { DialogBox } from './DialogBox';

const MAX_NAME = 12;

/**
 * Free-to-play sign-up/login (username + password), or — when `wallet` is
 * set — a one-time "claim a username" step for a connected Phantom wallet
 * that has no account yet (no password needed; the wallet IS the credential).
 * Usernames are unique across both paths (enforced server-side).
 */
export function AuthScreen({
  wallet,
  onAuthed,
}: {
  wallet?: string;
  onAuthed: (profile: Profile, isNewAccount: boolean) => void;
}) {
  const { signup, login } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = wallet
      ? await signup({ username, wallet })
      : mode === 'signup'
        ? await signup({ username, password })
        : await login(username, password);
    setBusy(false);
    if (!result.ok || !result.profile) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    onAuthed(result.profile, mode === 'signup' || !!wallet);
  }

  const usernameValid = /^[a-zA-Z0-9_]{3,12}$/.test(username);
  const passwordValid = wallet || password.length >= 8;
  const canSubmit = usernameValid && passwordValid && !busy;

  return (
    <div className="scene create-scene">
      <DialogBox speaker="PROF. OAK">
        {wallet
          ? "Your wallet doesn't have a trainer name yet — claim one to begin!"
          : 'Sign up or log in to start (or continue) your POKéMON journey!'}
      </DialogBox>

      <div className="auth-form">
        {!wallet && (
          <div className="mode-toggle">
            <button className={mode === 'signup' ? 'sel' : ''} onClick={() => setMode('signup')}>
              SIGN UP
            </button>
            <button className={mode === 'login' ? 'sel' : ''} onClick={() => setMode('login')}>
              LOG IN
            </button>
          </div>
        )}

        <label className="field">
          USERNAME
          <input
            className="retro-input"
            maxLength={MAX_NAME}
            value={username}
            placeholder="3-12 letters/numbers/_"
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </label>

        {!wallet && (
          <label className="field">
            PASSWORD
            <input
              className="retro-input"
              type="password"
              value={password}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'PASSWORD'}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            />
          </label>
        )}

        {error && <p className="desc error">{error}</p>}

        <button className="press-start" disabled={!canSubmit} onClick={submit}>
          {busy ? 'PLEASE WAIT…' : wallet ? 'CLAIM NAME ▶' : mode === 'signup' ? 'SIGN UP ▶' : 'LOG IN ▶'}
        </button>
      </div>
    </div>
  );
}
