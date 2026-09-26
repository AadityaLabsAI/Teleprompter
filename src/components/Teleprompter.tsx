import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FlipHorizontal, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, Settings2, Target, Volume2, VolumeX, Video, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { VideoOverlay } from './VideoOverlay';

interface TeleprompterProps {
  script: string;
  wpm: number;
  onExit: () => void;
  theme?: 'dark' | 'light';
}

const FONT_FAMILIES = [
  { label: 'Clean', value: 'DM Sans, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Classic', value: 'Georgia, serif' },
  { label: 'Creator', value: 'Manrope, ui-sans-serif, system-ui, sans-serif' },
];

export function Teleprompter({ script, wpm, onExit }: TeleprompterProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fontSize, setFontSize] = useLocalStorage('teleqen-font-size', 72);
  const [isFlipped, setIsFlipped] = useLocalStorage('teleqen-mirror', false);
  const [showFocusLine, setShowFocusLine] = useLocalStorage('teleqen-focus-line', true);
  const [speedMultiplier, setSpeedMultiplier] = useLocalStorage('teleqen-speed', 1);
  const [fontFamily, setFontFamily] = useLocalStorage('teleqen-font-family', FONT_FAMILIES[0].value);
  const [lineHeight, setLineHeight] = useLocalStorage('teleqen-line-height', 1.35);
  const [textWidth, setTextWidth] = useLocalStorage('teleqen-text-width', 1100);
  const [soundEnabled, setSoundEnabled] = useLocalStorage('teleqen-sound', true);
  const [showHUD, setShowHUD] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const progressTimeRef = useRef(0);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const wakeHUD = () => {
    setShowHUD(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    if (isPlaying) hudTimeoutRef.current = setTimeout(() => setShowHUD(false), 2400);
  };

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ['mousemove', 'touchstart', 'keydown'];
    events.forEach((event) => window.addEventListener(event, wakeHUD, { passive: true }));
    return () => {
      events.forEach((event) => window.removeEventListener(event, wakeHUD));
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, [isPlaying]);

  const resetScroll = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    progressRef.current = 0;
    setProgress(0);
    setIsPlaying(false);
    setCountdown(0);
    lastTimeRef.current = null;
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* optional */ }
  };

  const beep = (frequency: number, duration = 100) => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.035;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
      osc.addEventListener('ended', () => void ctx.close());
    } catch { /* optional */ }
  };

  const acquireWakeLock = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wakeLockRef.current) wakeLockRef.current = await nav.wakeLock.request('screen');
    } catch { /* optional */ }
  };

  const releaseWakeLock = async () => {
    try { if (wakeLockRef.current) await wakeLockRef.current.release(); } catch { /* optional */ }
    wakeLockRef.current = null;
  };

  const exitPrompter = () => {
    setIsPlaying(false);
    setCountdown(0);
    void releaseWakeLock();
    onExit();
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName ?? '') || target?.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); setIsPlaying((v) => !v); }
      if (event.key === 'ArrowUp') setSpeedMultiplier((v) => Math.min(5, +(v + .1).toFixed(1)));
      if (event.key === 'ArrowDown') setSpeedMultiplier((v) => Math.max(.2, +(v - .1).toFixed(1)));
      if (event.key.toLowerCase() === 'r') resetScroll();
      if (event.key.toLowerCase() === 'm') setIsFlipped((v) => !v);
      if (event.key.toLowerCase() === 's') setShowSettings((v) => !v);
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      if (event.key === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (countdown > 0) setCountdown(0);
        else if (document.fullscreenElement) void document.exitFullscreen();
        else exitPrompter();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [countdown, showSettings, setIsFlipped, setSpeedMultiplier]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => { progressRef.current = progress; }, [progress]);

  useEffect(() => {
    if (!isPlaying || countdown > 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastTimeRef.current = null;
      return;
    }
    const scroll = (time: number) => {
      const container = containerRef.current;
      if (container && lastTimeRef.current !== null) {
        const delta = Math.min(80, time - lastTimeRef.current);
        const pixelsPerSecond = (wpm / 150) * (fontSize / 72) * 95 * speedMultiplier;
        container.scrollTop += (pixelsPerSecond * delta) / 1000;
        const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
        if (time - progressTimeRef.current > 100) {
          progressTimeRef.current = time;
          const next = Math.min(100, (container.scrollTop / maxScroll) * 100);
          progressRef.current = next;
          setProgress(next);
        }
        if (container.scrollTop >= maxScroll - 2) setIsPlaying(false);
      }
      lastTimeRef.current = time;
      animationRef.current = requestAnimationFrame(scroll);
    };
    animationRef.current = requestAnimationFrame(scroll);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); animationRef.current = null; };
  }, [isPlaying, countdown, wpm, fontSize, speedMultiplier]);

  useEffect(() => {
    if (countdown <= 0) return;
    beep(countdown === 1 ? 880 : 660);
    const timer = window.setTimeout(() => {
      if (countdown === 1) { setCountdown(0); setIsPlaying(true); void acquireWakeLock(); }
      else setCountdown((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible' && isPlaying) void acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPlaying]);

  useEffect(() => { if (!isPlaying) void releaseWakeLock(); }, [isPlaying]);
  useEffect(() => () => { void releaseWakeLock(); }, []);

  const togglePlay = () => {
    if (isPlaying) setIsPlaying(false);
    else if (countdown > 0) setCountdown(0);
    else setCountdown(3);
  };

  const handleScriptTap = () => {
    if (countdown > 0) return;
    if (isPlaying) setIsPlaying(false);
    else setCountdown(3);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} className="prompter-v2 fixed inset-0 z-50 flex flex-col" onClick={wakeHUD}>
      <div className="prompter-v2-progress"><span style={{ width: `${progress}%` }} /></div>

      <header className="prompter-v2-header">
        <button type="button" onClick={exitPrompter} className="prompter-v2-brand" aria-label="Back to editor">
          <img src="/teleqen-mark.svg" alt="Teleqen" />
          <span>TELEQEN</span>
        </button>
        <div className="prompter-v2-status">
          <span className={isPlaying ? 'live' : ''}><i />{isPlaying ? 'Reading' : 'Ready'}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="prompter-v2-top-actions">
          <button onClick={() => setShowSettings((v) => !v)} aria-label="Open display settings" className={showSettings ? 'active' : ''}><Settings2 size={17} /></button>
          <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}</button>
          <button onClick={exitPrompter} aria-label="Exit teleprompter"><X size={17} /></button>
        </div>
      </header>

      {showFocusLine && <div className="prompter-v2-focus" aria-hidden="true"><span /></div>}

      <div ref={containerRef} onClick={handleScriptTap} className="prompter-v2-script" style={{ transform: isFlipped ? 'scaleX(-1)' : undefined }} aria-label="Teleprompter script">
        <article style={{ maxWidth: `${textWidth}px`, fontFamily, lineHeight }}>
          <div className="prompter-v2-top-space" />
          {script.split('\n').map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 12)}`} style={{ fontSize: `clamp(32px, ${fontSize / 10}vw, ${fontSize}px)` }}>{paragraph || '\u00A0'}</p>
          ))}
          <div className="prompter-v2-end-space" aria-hidden="true" />
        </article>
      </div>

      {countdown > 0 && (
        <button type="button" aria-label="Cancel countdown" onClick={() => setCountdown(0)} className="prompter-v2-countdown">
          <span>{countdown}</span><small>Get ready</small>
        </button>
      )}

      <div className={`prompter-v2-hud ${showHUD ? 'visible' : ''}`}>
        <div className="prompter-v2-controls">
          <button onClick={togglePlay} aria-label={isPlaying ? 'Pause scrolling' : 'Start scrolling'} className="prompter-v2-play">{isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
          <div className="prompter-v2-speed">
            <button onClick={() => setSpeedMultiplier((v) => Math.max(.2, +(v - .1).toFixed(1)))} aria-label="Decrease speed"><ArrowDown size={14} /></button>
            <span><Gauge size={14} /><b>{speedMultiplier.toFixed(1)}×</b></span>
            <button onClick={() => setSpeedMultiplier((v) => Math.min(5, +(v + .1).toFixed(1)))} aria-label="Increase speed"><ArrowUp size={14} /></button>
          </div>
          <button onClick={resetScroll} className="prompter-v2-control" aria-label="Reset script"><RotateCcw size={17} /><small>Reset</small></button>
          <button onClick={() => setIsFlipped((v) => !v)} className={`prompter-v2-control ${isFlipped ? 'selected' : ''}`} aria-label="Toggle mirror"><FlipHorizontal size={17} /><small>Mirror</small></button>
          <button onClick={() => setShowFocusLine((v) => !v)} className={`prompter-v2-control ${showFocusLine ? 'selected' : ''}`} aria-label="Toggle focus line"><Target size={17} /><small>Focus</small></button>
          <button onClick={() => setShowCamera((v) => !v)} className={`prompter-v2-control ${showCamera ? 'selected' : ''}`} aria-label="Toggle camera preview"><Video size={17} /><small>Camera</small></button>
          <button onClick={() => setSoundEnabled((v) => !v)} className={`prompter-v2-control ${soundEnabled ? 'selected' : ''}`} aria-label={soundEnabled ? 'Mute countdown' : 'Enable countdown sound'}><span className="prompter-v2-icon">{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</span><small>Sound</small></button>
          <button onClick={() => setShowSettings((v) => !v)} className={`prompter-v2-control ${showSettings ? 'selected' : ''}`} aria-label="Toggle display settings"><Settings2 size={17} /><small>Style</small></button>
        </div>
      </div>

      {showCamera && <VideoOverlay onClose={() => setShowCamera(false)} />}

      {showSettings && (
        <div className="prompter-v2-settings" role="dialog" aria-label="Display settings">
          <div className="prompter-v2-settings-head">
            <div><span>DISPLAY</span><h2>Reading style</h2><p>Make the page feel natural on camera.</p></div>
            <button onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={17} /></button>
          </div>
          <label>Text size <output>{fontSize}px</output><input aria-label="Text size" type="range" min="32" max="140" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></label>
          <label>Text width <output>{textWidth}px</output><input aria-label="Text width" type="range" min="600" max="1800" step="50" value={textWidth} onChange={(e) => setTextWidth(Number(e.target.value))} /></label>
          <label>Line spacing <output>{lineHeight.toFixed(2)}</output><input aria-label="Line spacing" type="range" min="1.1" max="1.8" step=".05" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} /></label>
          <label>Typeface<select aria-label="Typeface" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}><option value={FONT_FAMILIES[0].value}>Clean</option><option value={FONT_FAMILIES[1].value}>Classic</option><option value={FONT_FAMILIES[2].value}>Creator</option></select></label>
          <div className="prompter-v2-setting-grid">
            <button onClick={() => setShowFocusLine((v) => !v)} className={showFocusLine ? 'on' : ''}><span>Focus line</span><b>{showFocusLine ? 'On' : 'Off'}</b></button>
            <button onClick={() => setSoundEnabled((v) => !v)} className={soundEnabled ? 'on' : ''}><span>Countdown sound</span><b>{soundEnabled ? 'On' : 'Off'}</b></button>
          </div>
          <p className="prompter-v2-tip">Space pauses. ↑ / ↓ changes speed. R resets. F toggles fullscreen.</p>
        </div>
      )}
    </motion.div>
  );
}
