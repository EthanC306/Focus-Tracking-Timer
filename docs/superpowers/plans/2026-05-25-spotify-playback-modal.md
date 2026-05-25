# Spotify Playback Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centered Spotify playback modal that opens when the music pill is clicked, using PKCE OAuth and the Spotify Web API.

**Architecture:** A `useSpotify` hook owns all auth and API logic; `SpotifyModal` is a pure UI component that consumes it. App.jsx detects the OAuth callback on mount, stores tokens in localStorage, and passes modal open state down. No backend required.

**Tech Stack:** React 19, Vite, Spotify Web API (REST), PKCE OAuth (Web Crypto API)

> **Note:** This project has no test setup (no vitest/jest). Tasks skip TDD and go straight to implementation + manual verification.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/useSpotify.js` | Create | PKCE auth, token storage, all Spotify API calls |
| `src/SpotifyModal.jsx` | Create | Modal UI — connect button, playback controls |
| `src/App.css` | Modify | Spotify overlay + modal card styles |
| `src/App.jsx` | Modify | musicOpen state, pill onClick, OAuth callback on mount, render SpotifyModal |

---

### Task 1: Create `src/useSpotify.js` — PKCE auth utilities

**Files:**
- Create: `src/useSpotify.js`

- [ ] **Step 1: Create the file with PKCE helper functions and constants**

```js
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
```

- [ ] **Step 2: Add the `login` function that redirects to Spotify**

Append to the same file:

```js
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
```

- [ ] **Step 3: Add `handleCallback` and `refreshAccessToken`**

Append to the same file:

```js
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
```

- [ ] **Step 4: Add `getValidToken` and `disconnect`**

Append to the same file:

```js
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
```

- [ ] **Step 5: Add Spotify API call functions**

Append to the same file:

```js
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
```

- [ ] **Step 6: Verify the file has no syntax errors**

Run from the project root: `node --input-type=module < src/useSpotify.js 2>&1 | head -10`

Expected: no output (file is valid ES module syntax). Ignore "import.meta" errors — those are Vite-only and fine.

- [ ] **Step 7: Commit**

```bash
git add src/useSpotify.js
git commit -m "feat: add Spotify PKCE auth and playback API utilities"
```

---

### Task 2: Create `src/SpotifyModal.jsx` — playback UI

**Files:**
- Create: `src/SpotifyModal.jsx`

- [ ] **Step 1: Create the component skeleton**

```jsx
import { useState, useEffect, useRef } from 'react'
import {
  login, disconnect, isAuthenticated,
  getPlayback, play, pause, next, previous, setVolume
} from './useSpotify'

export default function SpotifyModal({ onClose }) {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [playback, setPlayback] = useState(null)
  const [volume, setVolumeState] = useState(50)
  const pollRef = useRef(null)

  // poll playback state every second when open and authed
  useEffect(() => {
    if (!authed) return
    async function poll() {
      const data = await getPlayback()
      setPlayback(data)
      if (data?.device?.volume_percent != null)
        setVolumeState(data.device.volume_percent)
    }
    poll()
    pollRef.current = setInterval(poll, 1000)
    return () => clearInterval(pollRef.current)
  }, [authed])

  async function handlePlay() {
    if (playback?.is_playing) await pause()
    else await play()
    const data = await getPlayback()
    setPlayback(data)
  }

  async function handleNext() { await next(); const d = await getPlayback(); setPlayback(d) }
  async function handlePrev() { await previous(); const d = await getPlayback(); setPlayback(d) }

  async function handleVolume(e) {
    const v = Number(e.target.value)
    setVolumeState(v)
    await setVolume(v)
  }

  function handleDisconnect() {
    disconnect()
    setAuthed(false)
    setPlayback(null)
  }

  const track = playback?.item
  const progress = track ? (playback.progress_ms / track.duration_ms) * 100 : 0
  const albumArt = track?.album?.images?.[1]?.url

  return (
    <div className="spotify-overlay" onClick={onClose}>
      <div className="spotify-modal" onClick={e => e.stopPropagation()}>
        <button className="spotify-close" onClick={onClose}>✕</button>

        {!authed ? (
          <div className="spotify-connect">
            <div className="spotify-logo">🎵</div>
            <div className="spotify-connect-title">Connect Spotify</div>
            <p className="spotify-connect-sub">Sign in to control your Spotify playback</p>
            <button className="spotify-connect-btn" onClick={login}>Connect</button>
          </div>
        ) : !track ? (
          <div className="spotify-connect">
            <div className="spotify-logo">🎵</div>
            <div className="spotify-connect-title">Nothing playing</div>
            <p className="spotify-connect-sub">Start Spotify on any device first</p>
            <button className="spotify-disconnect" onClick={handleDisconnect}>Disconnect</button>
          </div>
        ) : (
          <div className="spotify-player">
            {albumArt && <img className="spotify-art" src={albumArt} alt="album art" />}
            <div className="spotify-track">{track.name}</div>
            <div className="spotify-artist">{track.artists.map(a => a.name).join(', ')}</div>

            <div className="spotify-progress-wrap">
              <div className="spotify-progress-bar" style={{ width: progress + '%' }} />
            </div>

            <div className="spotify-controls">
              <button className="spotify-btn" onClick={handlePrev} title="Previous">
                <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
              </button>
              <button className="spotify-btn spotify-btn-main" onClick={handlePlay} title={playback.is_playing ? 'Pause' : 'Play'}>
                {playback.is_playing
                  ? <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                }
              </button>
              <button className="spotify-btn" onClick={handleNext} title="Next">
                <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
              </button>
            </div>

            <div className="spotify-volume-row">
              <svg viewBox="0 0 24 24" className="spotify-vol-icon"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12z"/></svg>
              <input
                type="range" min="0" max="100" value={volume}
                className="spotify-volume" onChange={handleVolume}
              />
            </div>

            <button className="spotify-disconnect" onClick={handleDisconnect}>Disconnect</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/SpotifyModal.jsx
git commit -m "feat: add SpotifyModal playback UI component"
```

---

### Task 3: Add Spotify modal styles to `src/App.css`

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Append Spotify styles to the end of `src/App.css`**

```css
/* ── spotify modal ── */
.spotify-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
  animation: fadeIn 0.25s ease;
}
.spotify-modal {
  position: relative;
  background: rgba(12,8,28,0.95); border: 1px solid rgba(255,255,255,0.13);
  border-radius: 24px; padding: 36px 40px;
  backdrop-filter: blur(32px); min-width: 300px; max-width: 340px; width: 90vw;
  text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.6);
}
.spotify-close {
  position: absolute; top: 14px; right: 16px;
  background: none; border: none; color: rgba(255,255,255,0.4);
  font-size: 16px; cursor: pointer; padding: 4px 8px;
  transition: color 0.2s;
}
.spotify-close:hover { color: #fff; }

/* connect / empty states */
.spotify-connect { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.spotify-logo { font-size: 40px; }
.spotify-connect-title { font-size: 20px; font-weight: 800; color: #fff; }
.spotify-connect-sub { font-size: 13px; color: rgba(255,255,255,0.45); font-weight: 700; margin: 0; }
.spotify-connect-btn {
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: #000; background: #1db954; border: none;
  border-radius: 99px; padding: 12px 36px; cursor: pointer;
  margin-top: 8px; transition: background 0.2s;
}
.spotify-connect-btn:hover { background: #1ed760; }

/* player */
.spotify-player { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.spotify-art {
  width: 140px; height: 140px; border-radius: 12px;
  object-fit: cover; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  margin-bottom: 4px;
}
.spotify-track { font-size: 17px; font-weight: 800; color: #fff; line-height: 1.3; }
.spotify-artist { font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 700; }

.spotify-progress-wrap {
  width: 100%; height: 3px; background: rgba(255,255,255,0.18);
  border-radius: 99px; overflow: hidden; margin: 4px 0;
}
.spotify-progress-bar { height: 100%; background: #1db954; border-radius: 99px; transition: width 0.5s linear; }

.spotify-controls { display: flex; align-items: center; gap: 16px; margin: 4px 0; }
.spotify-btn {
  background: none; border: none; color: rgba(255,255,255,0.7);
  cursor: pointer; padding: 6px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, transform 0.15s;
}
.spotify-btn:hover { color: #fff; transform: scale(1.1); }
.spotify-btn svg { width: 22px; height: 22px; fill: currentColor; }
.spotify-btn-main {
  width: 52px; height: 52px;
  background: #1db954; color: #000; border-radius: 50%;
}
.spotify-btn-main:hover { background: #1ed760; color: #000; transform: scale(1.08); }
.spotify-btn-main svg { width: 26px; height: 26px; }

.spotify-volume-row {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 0 4px;
}
.spotify-vol-icon { width: 16px; height: 16px; fill: rgba(255,255,255,0.4); flex-shrink: 0; }
.spotify-volume {
  flex: 1; -webkit-appearance: none; height: 3px;
  background: rgba(255,255,255,0.2); border-radius: 99px; outline: none;
  accent-color: #1db954;
}
.spotify-disconnect {
  background: none; border: none; color: rgba(255,255,255,0.28);
  font-size: 11px; font-weight: 700; cursor: pointer;
  text-decoration: underline; padding: 0; margin-top: 4px;
  transition: color 0.2s; font-family: 'Syne', sans-serif;
}
.spotify-disconnect:hover { color: rgba(255,255,255,0.6); }
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: add Spotify modal styles"
```

---

### Task 4: Wire up `src/App.jsx` — state, OAuth callback, render modal

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the import at the top of `src/App.jsx`**

After the existing import lines (around line 2), add:

```jsx
import SpotifyModal from './SpotifyModal'
import { handleCallback } from './useSpotify'
```

- [ ] **Step 2: Add `musicOpen` state inside the `App` component**

After the existing `useState` calls (around line 43), add:

```jsx
const [musicOpen, setMusicOpen] = useState(false)
```

- [ ] **Step 3: Add OAuth callback detection via `useEffect`**

After the existing `useEffect` calls (around line 80), add:

```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return
  history.replaceState({}, '', window.location.pathname)
  handleCallback(code).then(() => setMusicOpen(true)).catch(console.error)
}, [])
```

- [ ] **Step 4: Add `onClick` to the music pill**

Find this line in App.jsx (around line 255):

```jsx
<div className="pill" title="Music">
```

Replace it with:

```jsx
<div className="pill" title="Music" onClick={e => { e.stopPropagation(); setMusicOpen(true) }}>
```

- [ ] **Step 5: Render `SpotifyModal` in the JSX return**

Find the `{/* Name Panel */}` block near the end of the return (around line 319). Just before the closing `</>`, add:

```jsx
{/* Spotify Modal */}
{musicOpen && <SpotifyModal onClose={() => setMusicOpen(false)} />}
```

- [ ] **Step 6: Start the dev server and verify manually**

Run: `npm run dev`

Checklist:
- [ ] Clicking the music pill opens the modal
- [ ] Modal shows "Connect Spotify" button
- [ ] Clicking Connect redirects to Spotify login
- [ ] After login, Spotify redirects back and modal opens automatically showing playback controls
- [ ] Play/pause, next, previous buttons work
- [ ] Volume slider adjusts Spotify volume
- [ ] Clicking the backdrop or ✕ closes the modal
- [ ] Disconnect clears tokens and shows Connect button again
- [ ] Refreshing the page while authenticated still shows controls (tokens persist in localStorage)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire Spotify modal into app — pill click + OAuth callback"
```

---

## Deployment Note

Before deploying to GitHub Pages, ensure both redirect URIs are registered in your Spotify Developer Dashboard:
1. `http://localhost:5173`
2. `https://ethanc306.github.io/Focus-Tracking-Timer/`

Then run `npm run deploy` as usual.