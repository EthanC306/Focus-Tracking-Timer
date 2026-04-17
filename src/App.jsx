import { useState, useEffect, useRef } from 'react'
import './App.css'

const THEMES = [
  { name: 'Rose Bloom',   bg1: '#e8a0c8', bg2: '#d94f8a', bg3: '#f08060', swatch: 'linear-gradient(135deg,#e8a0c8,#d94f8a,#f08060)' },
  { name: 'Ocean Drift',  bg1: '#5bc8f5', bg2: '#1e90ff', bg3: '#0a4f9e', swatch: 'linear-gradient(135deg,#5bc8f5,#1e90ff,#0a4f9e)' },
  { name: 'Forest Dusk',  bg1: '#a8e063', bg2: '#3daa5c', bg3: '#1b6b45', swatch: 'linear-gradient(135deg,#a8e063,#3daa5c,#1b6b45)' },
  { name: 'Amber Embers', bg1: '#ffd97d', bg2: '#e8824e', bg3: '#c0392b', swatch: 'linear-gradient(135deg,#ffd97d,#e8824e,#c0392b)' },
  { name: 'Midnight',     bg1: '#2e2255', bg2: '#4b3088', bg3: '#1a1230', swatch: 'linear-gradient(135deg,#2e2255,#4b3088,#1a1230)' },
  { name: 'Cotton Candy', bg1: '#ffb6e1', bg2: '#b39ddb', bg3: '#64b5f6', swatch: 'linear-gradient(135deg,#ffb6e1,#b39ddb,#64b5f6)' },
]

const MODES = {
  focus: { seconds: 25 * 60, label: 'Time to focus.',         emoji: '🎉', doneTitle: 'Session Complete!', doneSub: 'Great work. Take a well-earned break.' },
  short: { seconds: 5 * 60,  label: 'Short break — breathe.', emoji: '☕', doneTitle: 'Break over!',        doneSub: 'Ready to get back to it?' },
  long:  { seconds: 10 * 60, label: 'Long break — relax.',    emoji: '🌿', doneTitle: 'Long break done!',   doneSub: "Feeling refreshed? Let's go!" },
}

const QUOTES = [
  '"What lasts long won\'t come easy."',
  '"Deep work is a superpower."',
  '"One task. Full focus."',
  '"Progress over perfection."',
  '"The secret is to begin."',
  '"Discipline is the bridge between goals and accomplishment."',
]

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [mode, setMode] = useState('focus')
  const [remaining, setRemaining] = useState(MODES.focus.seconds)
  const [running, setRunning] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [themeIdx, setThemeIdx] = useState(0)
  const [userName, setUserName] = useState(localStorage.getItem('focusName') || 'Friend')
  const [themePanelOpen, setThemePanelOpen] = useState(false)
  const [namePanelOpen, setNamePanelOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [doneVisible, setDoneVisible] = useState(false)
  const [clockH, setClockH] = useState('--')
  const [clockM, setClockM] = useState('--')
  const [ampm, setAmpm] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  const intervalRef = useRef(null)
  const audioCtxRef = useRef(null)
  const soundRef = useRef(soundEnabled)
  const nameInputRef = useRef(null)

  useEffect(() => { soundRef.current = soundEnabled }, [soundEnabled])

  useEffect(() => {
    function tick() {
      const now = new Date()
      let h = now.getHours()
      const m = now.getMinutes()
      const ap = h >= 12 ? 'PM' : 'AM'
      h = h % 12 || 12
      setClockH(String(h).padStart(2, '0'))
      setClockM(String(m).padStart(2, '0'))
      setAmpm(ap)
      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      setDateStr(`${DAYS[now.getDay()]}, ${MONS[now.getMonth()]} ${now.getDate()}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (namePanelOpen) setTimeout(() => nameInputRef.current?.focus(), 60)
  }, [namePanelOpen])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  function getAudioCtx() {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    return audioCtxRef.current
  }

  function playDone() {
    if (!soundRef.current) return
    try {
      const ctx = getAudioCtx()
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        const t = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.3, t + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
        osc.start(t); osc.stop(t + 0.6)
      })
    } catch (e) {}
  }

  function playTick() {
    if (!soundRef.current) return
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; osc.type = 'square'
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05)
    } catch (e) {}
  }

  function startTimer() {
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 0) {
          clearInterval(intervalRef.current)
          setRunning(false)
          playDone()
          setDoneVisible(true)
          return 0
        }
        const next = prev - 1
        if (next % 60 === 0 || next <= 5) playTick()
        return next
      })
    }, 1000)
  }

  function stopTimer() {
    setRunning(false)
    clearInterval(intervalRef.current)
  }

  function resetTimer() {
    stopTimer()
    setRemaining(MODES[mode].seconds)
  }

  function skipTimer() {
    stopTimer()
    setRemaining(0)
    setDoneVisible(true)
  }

  function handleSetMode(m) {
    if (running) stopTimer()
    setMode(m)
    setRemaining(MODES[m].seconds)
  }

  function dismissDone() {
    setDoneVisible(false)
    stopTimer()
    setRemaining(MODES[mode].seconds)
  }

  function openNamePanel() {
    setNameInput(userName === 'Friend' ? '' : userName)
    setNamePanelOpen(true)
  }

  function saveName() {
    const val = nameInput.trim()
    if (val) {
      setUserName(val)
      localStorage.setItem('focusName', val)
    }
    setNamePanelOpen(false)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const modeData = MODES[mode]
  const theme = THEMES[themeIdx]
  const blobs = screen === 'home'
    ? { b1: '#0f0c29', b2: '#302b63', b3: '#24243e' }
    : { b1: theme.bg1, b2: theme.bg2, b3: theme.bg3 }

  return (
    <>
      <div className="mesh">
        <div className="mesh-blob blob1" style={{ background: blobs.b1 }} />
        <div className="mesh-blob blob2" style={{ background: blobs.b2 }} />
        <div className="mesh-blob blob3" style={{ background: blobs.b3 }} />
      </div>

      {/* Home Screen */}
      <div id="homeScreen" className={`screen${screen === 'home' ? ' active' : ''}`}>
        <header>
          <div className="home-date">{dateStr}</div>
        </header>
        <div className="home-center">
          <div className="home-greeting">
            Hello, <span className="name-text" onClick={openNamePanel}>{userName}</span>
          </div>
          <div className="home-clock">{clockH}:{clockM}</div>
          <div className="home-ampm">{ampm}</div>
          <div className="home-quote">{quote}</div>
          <div className="session-hint" onClick={() => setScreen('timer')}>
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
            Start a focus session
            <span className="hint-sub">· {fmt(remaining)}{running ? ' running' : ' ready'}</span>
          </div>
        </div>
      </div>

      {/* Timer Screen */}
      <div id="timerScreen" className={`screen${screen === 'timer' ? ' active' : ''}`}>
        <header>
          <div className="timer-quote">{quote}</div>
        </header>
        <div className="timer-center">
          <div className="mode-tabs">
            {[['focus', 'Focus'], ['short', 'Short Break'], ['long', 'Long Break']].map(([m, label]) => (
              <button key={m} className={`tab${mode === m ? ' active' : ''}`} onClick={() => handleSetMode(m)}>
                {label}
              </button>
            ))}
          </div>
          <div className="mode-label">{modeData.label}</div>
          <div className="timer-display">{fmt(remaining)}</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar" style={{ width: `${(remaining / modeData.seconds) * 100}%` }} />
          </div>
          <div className="controls">
            <button className="btn-icon" title="Reset" onClick={resetTimer}>
              <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
            </button>
            <button className="btn-main" onClick={() => running ? stopTimer() : startTimer()}>
              {running ? 'PAUSE' : 'START'}
            </button>
            <button className="btn-icon" title="Skip" onClick={skipTimer}>
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM18 6h-2v12h2V6z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Nav Bar */}
      <nav className="nav-bar" onClick={() => setThemePanelOpen(false)}>
        <div className="pill-group">
          <div className="pill" title="Tasks">
            <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" /></svg>
          </div>
          <div className="pill" title="Music">
            <svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" /></svg>
          </div>
          <div className="pill" title="Notes">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
          </div>
        </div>

        <div className="nav-tabs">
          <button className={`nav-tab${screen === 'home' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); setScreen('home') }}>
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
            Home
          </button>
          <button className={`nav-tab${screen === 'timer' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); setScreen('timer') }}>
            <svg viewBox="0 0 24 24"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>
            Timer
          </button>
        </div>

        <div className="pill-group">
          <div className={`pill${soundEnabled ? ' active-pill' : ''}`} title="Sound" onClick={e => { e.stopPropagation(); setSoundEnabled(p => !p) }}>
            <svg viewBox="0 0 24 24">
              {soundEnabled
                ? <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12z" />
                : <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.82 8.82 0 0 0 17.73 19l2 2L21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              }
            </svg>
          </div>
          <div className="pill active-pill" title="Theme" onClick={e => { e.stopPropagation(); setThemePanelOpen(p => !p) }}>
            <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg>
          </div>
          <div className="pill" title="Settings">
            <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.06 7.06 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-3.84a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L3.8 8.47a.489.489 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.489.489 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.27.41.49.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.489.489 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" /></svg>
          </div>
          <div className="pill" title="Fullscreen" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
          </div>
        </div>
      </nav>

      {/* Theme Panel */}
      <div className={`theme-panel${themePanelOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="theme-panel-title">Timer Theme</div>
        {THEMES.map((t, i) => (
          <div key={t.name} className={`theme-row${i === themeIdx ? ' selected' : ''}`} onClick={() => setThemeIdx(i)}>
            <div className="theme-swatch" style={{ background: t.swatch }} />
            <div className="theme-name">{t.name}</div>
          </div>
        ))}
      </div>

      {/* Done Overlay */}
      {doneVisible && (
        <div className="done-overlay show">
          <div className="done-card">
            <div className="done-emoji">{modeData.emoji}</div>
            <div className="done-title">{modeData.doneTitle}</div>
            <div className="done-sub">{modeData.doneSub}</div>
            <button className="done-btn" onClick={dismissDone}>Continue</button>
          </div>
        </div>
      )}

      {/* Name Panel */}
      <div className={`name-panel${namePanelOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="name-panel-title">What's your name?</div>
        <input
          ref={nameInputRef}
          className="name-panel-input"
          type="text"
          placeholder="Enter your name"
          maxLength={24}
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveName()
            if (e.key === 'Escape') setNamePanelOpen(false)
          }}
        />
        <button className="name-panel-save" onClick={saveName}>Save</button>
      </div>
    </>
  )
}
