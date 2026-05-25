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
  const pendingRef = useRef(false)
  const volumeDebounceRef = useRef(null)

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
    if (pendingRef.current) return
    pendingRef.current = true
    try {
      if (playback?.is_playing) await pause()
      else await play()
      setPlayback(await getPlayback())
    } finally { pendingRef.current = false }
  }

  async function handleNext() {
    if (pendingRef.current) return
    pendingRef.current = true
    try { await next(); setPlayback(await getPlayback()) }
    finally { pendingRef.current = false }
  }

  async function handlePrev() {
    if (pendingRef.current) return
    pendingRef.current = true
    try { await previous(); setPlayback(await getPlayback()) }
    finally { pendingRef.current = false }
  }

  async function handleVolume(e) {
    const v = Number(e.target.value)
    setVolumeState(v)
    clearTimeout(volumeDebounceRef.current)
    volumeDebounceRef.current = setTimeout(() => setVolume(v), 180)
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
