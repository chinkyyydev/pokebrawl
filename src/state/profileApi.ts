// Client-only: fetch/push the logged-in account's Profile from the server.
// Kept separate from state/storage.ts (which the server also imports for
// createProfile/teamProblem) so that file never pulls in browser-only code
// (fetch URLs derived from import.meta.env) into the server bundle.
import { API_URL } from '../net/client';
import { repairProfileShape, type Profile } from './storage';

export async function fetchProfile(token: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const { profile } = await res.json();
    return profile ? repairProfileShape(profile as Profile) : null;
  } catch {
    return null;
  }
}

/** Best-effort/fire-and-forget, same trust level as the rest of the app's
 * client-driven persistence. */
export async function pushProfile(token: string, profile: Profile): Promise<void> {
  try {
    await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile }),
    });
  } catch {
    /* non-fatal — next save (or next load) will catch up */
  }
}
