import { getValidGoogleAccessToken } from './google-oauth-service.js'

export async function googleApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getValidGoogleAccessToken()
  if (!accessToken) {
    throw new Error('Google Workspace is not connected')
  }

  const url = path.startsWith('https://') ? path : `https://www.googleapis.com${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google API ${res.status}: ${text.slice(0, 240)}`)
  }

  return res
}
