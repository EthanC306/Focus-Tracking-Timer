const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const SCOPES = 'user-read-playback-state user-modify-playback-state'

function getRedirectUri() {
  return window.location.origin + window.location.pathname
}

function generateCodeVerifier() {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function getTokens() {
  return {
    accessToken: localStorage.getItem('sp_access_token'),
    refreshToken: localStorage.getItem('sp_refresh_token'),
    expiresAt: Number(localStorage.getItem('sp_expires_at') || 0),
  }
}

function saveTokens(accessToken, refreshToken, expiresIn) {
  localStorage.setItem('sp_access_token', accessToken)
  if (refreshToken) localStorage.setItem('sp_refresh_token', refreshToken)
  localStorage.setItem('sp_expires_at', Date.now() + expiresIn * 1000)
}

function clearTokens() {
  localStorage.removeItem('sp_access_token')
  localStorage.removeItem('sp_refresh_token')
  localStorage.removeItem('sp_expires_at')
}

export async function login() {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('sp_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = 'https://accounts.spotify.com/authorize?' + params
}

export async function handleCallback(code) {
  const verifier = sessionStorage.getItem('sp_verifier')
  if (!verifier) throw new Error('No code verifier found')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error('Token exchange failed')
  const data = await res.json()
  saveTokens(data.access_token, data.refresh_token, data.expires_in)
  sessionStorage.removeItem('sp_verifier')
}

async function refreshAccessToken() {
  const { refreshToken } = getTokens()
  if (!refreshToken) { clearTokens(); return null }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })
  if (!res.ok) { clearTokens(); return null }
  const data = await res.json()
  saveTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in)
  return data.access_token
}

async function getValidToken() {
  const { accessToken, expiresAt } = getTokens()
  if (!accessToken) return null
  if (Date.now() > expiresAt - 60_000) return refreshAccessToken()
  return accessToken
}

export function isAuthenticated() {
  return !!localStorage.getItem('sp_access_token')
}

export function disconnect() {
  clearTokens()
}

async function spotifyFetch(path, options = {}) {
  const token = await getValidToken()
  if (!token) return { status: 401 }

  const res = await fetch('https://api.spotify.com/v1' + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...options.headers },
  })
  return res
}

export async function getPlayback() {
  const res = await spotifyFetch('/me/player')
  if (res.status === 204 || res.status === 401) return null
  if (!res.ok) return null
  return res.json()
}

export async function play() {
  await spotifyFetch('/me/player/play', { method: 'PUT' })
}

export async function pause() {
  await spotifyFetch('/me/player/pause', { method: 'PUT' })
}

export async function next() {
  await spotifyFetch('/me/player/next', { method: 'POST' })
}

export async function previous() {
  await spotifyFetch('/me/player/previous', { method: 'POST' })
}

export async function setVolume(percent) {
  await spotifyFetch('/me/player/volume?volume_percent=' + Math.round(percent), { method: 'PUT' })
}