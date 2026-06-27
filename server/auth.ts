import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';
const TOKEN_TTL = '30d';
export const MAX_ACCOUNTS_PER_IP = 4;

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,12}$/;

export function usernameError(username: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Username must be 3-12 characters: letters, numbers, underscore only.';
  }
  return null;
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  accountId: number;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload | null {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/** Bearer-token auth for the HTTP profile endpoints. */
export function authFromHeader(req: IncomingMessage): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return verifyToken(header.slice('Bearer '.length));
}

/** Admin-only endpoints (the wagering kill-switch, status) — a single shared
 * secret via ADMIN_SECRET, never the session/JWT system. Constant-time
 * compare so the check itself can't leak the secret via response timing. */
export function isAdminRequest(req: IncomingMessage): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false; // admin endpoints are off entirely until set
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const provided = header.slice('Bearer '.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(adminSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Real client IP behind Render's reverse proxy, falling back to the socket. */
export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = first?.split(',')[0]?.trim();
  return ip || req.socket.remoteAddress || 'unknown';
}
