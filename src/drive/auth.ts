import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { DISCOVERY, GOOGLE_IOS_CLIENT_ID, GOOGLE_REDIRECT_URI, SCOPES } from './config';

export type Account = { email: string; name?: string; picture?: string };

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  account: Account | null;
};

/** The signed-in Google account. Screens read this; drive/api.ts uses the tokens. */
export const useAuth = create<AuthState>()(() => ({ status: 'loading', account: null }));

const KEY = 'memora.google';
type Saved = { refreshToken: string; account: Account };

let refreshToken: string | null = null;
let access: { token: string; expiresAt: number } | null = null;

/** Thrown when Google no longer accepts the saved sign-in. */
export class SignedOutError extends Error {
  constructor() {
    super('Please sign in with Google again.');
  }
}

/** Google sign-in can't return to Expo Go; it needs the Memora development build. */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Called once at start-up: picks up a sign-in saved in the Keychain. */
export async function restoreSignIn() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      refreshToken = saved.refreshToken;
      useAuth.setState({ status: 'signedIn', account: saved.account });
      return;
    }
  } catch {
    // unreadable: treat as signed out
  }
  useAuth.setState({ status: 'signedOut', account: null });
}

/** Opens Google's sign-in sheet. Resolves true when signed in, false if cancelled. */
export async function signIn(): Promise<boolean> {
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    scopes: SCOPES,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    prompt: AuthSession.Prompt.SelectAccount,
  });
  const result = await request.promptAsync(DISCOVERY);
  if (result.type !== 'success') {
    if (result.type === 'error') throw new Error(result.error?.message ?? 'Google sign-in failed.');
    return false;
  }

  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_IOS_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      code: result.params.code,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    DISCOVERY,
  );
  if (!tokens.refreshToken) throw new Error('Google didn’t return a lasting sign-in. Please try again.');

  const granted = tokens.scope?.split(' ') ?? [];
  if (!granted.includes('https://www.googleapis.com/auth/drive')) {
    throw new Error('Memora needs access to Google Drive to share albums. Sign in again and tick the Drive box.');
  }

  access = { token: tokens.accessToken, expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000 };
  refreshToken = tokens.refreshToken;

  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const info = (await res.json()) as { email?: string; name?: string; picture?: string };
  if (!info.email) throw new Error('Couldn’t read your Google account.');
  const account: Account = { email: info.email.toLowerCase(), name: info.name, picture: info.picture };

  await SecureStore.setItemAsync(KEY, JSON.stringify({ refreshToken, account } satisfies Saved));
  useAuth.setState({ status: 'signedIn', account });
  return true;
}

export async function signOut() {
  const old = refreshToken;
  refreshToken = null;
  access = null;
  useAuth.setState({ status: 'signedOut', account: null });
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  if (old) AuthSession.revokeAsync({ token: old }, DISCOVERY).catch(() => {});
}

/** A valid access token, refreshed when it's within a minute of expiring. */
export async function getAccessToken(force = false): Promise<string> {
  if (!force && access && access.expiresAt - Date.now() > 60_000) return access.token;
  if (!refreshToken) throw new SignedOutError();
  try {
    const tokens = await AuthSession.refreshAsync({ clientId: GOOGLE_IOS_CLIENT_ID, refreshToken }, DISCOVERY);
    access = { token: tokens.accessToken, expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000 };
    return access.token;
  } catch (e) {
    // invalid_grant = revoked, or expired. In Google's Testing mode that happens after 7 days.
    if (String((e as Error)?.message ?? e).includes('invalid_grant')) {
      await signOut();
      throw new SignedOutError();
    }
    throw e;
  }
}

/** The current token for image requests (refreshed by the album loader beforehand). */
export const currentToken = () => access?.token ?? '';
