# Spotify Playback Modal — Design Spec
Date: 2026-05-25

## Overview

When the user clicks the music pill in the bottom-left nav bar, a centered modal opens showing Spotify playback controls. The integration uses the Spotify Web API with PKCE OAuth — no backend required, works entirely client-side.

## Prerequisites

- Spotify Premium account (required for playback control)
- Spotify Developer app registered at developer.spotify.com
- Client ID stored in `.env` as `VITE_SPOTIFY_CLIENT_ID`
- Redirect URIs registered in Spotify Dashboard:
  - `http://localhost:5173` (local dev)
  - `https://ethanc306.github.io/Focus-Tracking-Timer/` (production)

## Architecture

### New Files
- `src/useSpotify.js` — custom hook managing auth state, token storage, and all Spotify API calls
- `src/SpotifyModal.jsx` — centered modal component for playback UI

### Modified Files
- `src/App.jsx` — wire music pill `onClick` to open modal state; detect and handle OAuth callback (`?code=`) on mount
- `src/App.css` — modal overlay and modal container styles

## Auth Flow

1. User clicks music pill → modal opens
2. No token in `localStorage` → modal shows "Connect Spotify" button
3. User clicks button → browser redirects to Spotify PKCE auth URL with scopes: `user-read-playback-state user-modify-playback-state`
4. Spotify redirects back to app with `?code=...` in URL
5. On mount, `App.jsx` detects `code` param → calls `useSpotify` to exchange code for access + refresh tokens
6. Tokens stored in `localStorage`; `?code=` param removed from URL via `history.replaceState`
7. On subsequent opens, token is loaded from `localStorage` — no re-login needed
8. Access token expires after ~1 hour; refresh token is used automatically to get a new one

### Redirect URI
Determined dynamically at runtime:
```js
const REDIRECT_URI = window.location.origin + window.location.pathname
```
Resolves correctly for both localhost and GitHub Pages without hardcoding.

## Modal UI

**Unauthenticated state:**
- "Connect Spotify" button centered in modal

**Authenticated state:**
- Album art thumbnail (from Spotify API)
- Track name + artist name
- Read-only progress bar (updates every 1 second via polling)
- Controls: ⏮ Previous · ⏸/▶ Play/Pause · ⏭ Next
- Volume slider
- "Disconnect" link (clears tokens from localStorage)
- Close button (X) in top-right corner; clicking backdrop also dismisses

**No active playback state:**
- Message: "Nothing playing — start Spotify on any device first"

## Spotify API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Get current playback | GET | `/v1/me/player` |
| Resume playback | PUT | `/v1/me/player/play` |
| Pause playback | PUT | `/v1/me/player/pause` |
| Skip to next | POST | `/v1/me/player/next` |
| Skip to previous | POST | `/v1/me/player/previous` |
| Set volume | PUT | `/v1/me/player/volume` |
| Refresh token | POST | `https://accounts.spotify.com/api/token` |

## Data Flow

```
music pill click
  → setMusicOpen(true)
  → SpotifyModal renders
  → useSpotify checks localStorage for token
    → token missing: show Connect button
    → token present: GET /v1/me/player every 1s
      → update now-playing state
  → user clicks control button
    → PUT/POST to Spotify API
    → re-fetch playback state immediately
```

## Error Handling

- 401 from API → attempt token refresh; if refresh fails, clear tokens and show Connect button
- 204 from GET /v1/me/player → no active device; show "Nothing playing" message
- Network error → show inline error, retry on next poll interval

## Styling

- Modal uses existing app color theme
- Backdrop: semi-transparent dark overlay (`rgba(0,0,0,0.6)`)
- Modal card: centered, rounded corners, consistent with existing app card styles
- Spotify green (`#1db954`) used for progress bar fill and active states