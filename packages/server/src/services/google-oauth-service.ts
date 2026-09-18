import { randomBytes } from 'node:crypto'
import { getGoogleClientConfig, PORT } from '../config.js'
import {
  clearGoogleConnection,
  consumeOAuthState,
  getGoogleConnection,
  saveGoogleConnection,
  saveOAuthState,
} from './google-connection-store.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export const GOOGLE_READONLY_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
]

export function getGoogleRedirectUri(): string {
  return `http://127.0.0.1:${PORT}/api/briefing/oauth/callback`
}

export function isGoogleOAuthConfigured(): boolean {
  const config = getGoogleClientConfig()
  return Boolean(config?.clientId && config?.clientSecret)
}

export function createOAuthState(): string {
  const state = randomBytes(24).toString('hex')
  saveOAuthState(state)
  return state
}

export function buildGoogleAuthUrl(state: string): string {
  const config = getGoogleClientConfig()
  if (!config?.clientId || !config?.clientSecret) {
    throw new Error('Google OAuth is not configured')
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_READONLY_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

function expiresAtFromSeconds(expiresIn?: number): string | null {
  if (!expiresIn) return null
  return new Date(Date.now() + expiresIn * 1000).toISOString()
}

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const config = getGoogleClientConfig()
  if (!config?.clientId || !config?.clientSecret) {
    throw new Error('Google OAuth is not configured')
  }

  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed: ${text}`)
  }

  return res.json() as Promise<TokenResponse>
}

export async function exchangeAuthorizationCode(code: string): Promise<void> {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: getGoogleRedirectUri(),
  })

  const tokens = await exchangeToken(body)
  const email = await fetchGoogleUserEmail(tokens.access_token)

  saveGoogleConnection({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: expiresAtFromSeconds(tokens.expires_in),
    email,
  })
}

export async function refreshGoogleAccessToken(): Promise<string> {
  const connection = getGoogleConnection()
  if (!connection?.refresh_token) {
    throw new Error('Google refresh token is missing')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
  })

  const tokens = await exchangeToken(body)

  saveGoogleConnection({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? connection.refresh_token,
    expiresAt: expiresAtFromSeconds(tokens.expires_in),
    email: connection.email,
  })

  return tokens.access_token
}

export async function getValidGoogleAccessToken(): Promise<string | null> {
  const connection = getGoogleConnection()
  if (!connection) return null

  if (!connection.expires_at) {
    return connection.access_token
  }

  const expiresAt = new Date(connection.expires_at).getTime()
  if (expiresAt > Date.now() + 60_000) {
    return connection.access_token
  }

  if (!connection.refresh_token) {
    return null
  }

  return refreshGoogleAccessToken()
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    return null
  }

  const data = (await res.json()) as { email?: string }
  return data.email ?? null
}

export function validateOAuthCallback(state: string): boolean {
  return consumeOAuthState(state)
}

export async function disconnectGoogleWorkspace(): Promise<void> {
  const connection = getGoogleConnection()
  if (connection?.access_token) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(connection.access_token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
    }
  }
  clearGoogleConnection()
}

export function isGoogleConnectionExpired(): boolean {
  const connection = getGoogleConnection()
  if (!connection) return false
  if (!connection.expires_at) return false
  if (connection.refresh_token) return false
  return new Date(connection.expires_at).getTime() <= Date.now()
}
