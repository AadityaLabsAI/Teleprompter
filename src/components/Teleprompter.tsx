import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, FlipHorizontal, Gauge, Maximize, Minimize, Mic, MicOff,
  Pause, Play, RotateCcw, Settings2, Target, Volume2, VolumeX, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface TeleprompterProps { script: string; wpm: number; onExit: () => void; }

interface SpeechResultEvent extends Event {
  results: {
    length: number;
    [index: number]: { [index: number]: { transcript: string } };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const FONT_FAMILIES = [
  { label: 'Clean', value: 'DM Sans, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Classic', value: 'Georgia, serif' },
  { label: 'Creator', value: 'Manrope, ui-sans-serif, system-ui, sans-serif' },
];

const normalizeWords = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}'’-]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);

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
  const [voiceEnabled, setVoiceEnabled] = useLocalStorage('teleqen-voice-follow', false);
  const [shortcutsEnabled, setShortcutsEnabled] = useLocalStorage('teleqen-shortcuts', true);
  const [showHUD, setShowHUD] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const progressRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const progressTimeRef = useRef(0);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const scriptWords = useMemo(() => normalizeWords(script), [script]);
  const wordCount = scriptWords.length;

  const wakeHUD = () => {
    setShowHUD(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    if (isPlaying) hudTimeoutRef.current = setTimeout(() => setShowHUD(false), 2600);
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
    } catch { /* fullscreen may be unavailable */ }
  };

  const exitPrompter = () => {
    setIsPlaying(false);
    setCountdown(0);
    stopVoice();
    void releaseWakeLock();
    onExit();
  };

  const beep = (frequency: number, duration = 100) => {
    if (!soundEnabled) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.035;
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration / 1000);
      oscillator.addEventListener('ended', () => void ctx.close());
    } catch { /* audio is optional */ }
  };

  const acquireWakeLock = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wakeLockRef.current) wakeLockRef.current = await nav.wakeLock.request('screen');
    } catch { /* wake lock is optional */ }
  };

  const releaseWakeLock = async () => {
    try { if (wakeLockRef.current) await wakeLockRef.current.release(); } catch { /* noop */ }
    wakeLockRef.current = null;
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  };

  const startVoice = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus('Voice follow is not supported in this browser.');
      setVoiceEnabled(false);
      return;
    }
    stopVoice();
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-IN';
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1];
      const heard = latest?.[0]?.transcript ?? '';
      if (!heard || !scriptWords.length) return;
      const heardWords = normalizeWords(heard);
      const tail = heardWords.slice(-10);
      let bestIndex = -1;
      let bestScore = 0;
      const current = Math.floor((progressRef.current / 100) * scriptWords.length);
      const start = Math.max(0, current - 12);
      const end = Math.min(scriptWords.length, current + 90);
      for (let i = start; i < end; i += 1) {
        let score = 0;
        for (let j = 0; j < tail.length && i + j < scriptWords.length; j += 1) {
          if (tail[j] === scriptWords[i + j]) score += 1;
          else if (tail[j]?.startsWith(scriptWords[i + j]?.slice(0, Math.max(3, scriptWords[i + j].length - 2)))) score += 0.5;
        }
        if (score > bestScore) { bestScore = score; bestIndex = i; }
      }
      if (bestIndex >= 0 && bestScore >= Math.min(2, tail.length)) {
        const container = containerRef.current;
        if (container) {
          const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
          const target = Math.max(0, (bestIndex / Math.max(1, scriptWords.length - 1)) * maxScroll);
          container.scrollTo({ top: target, behavior: 'smooth' });
          const nextProgress = Math.min(100, (bestIndex / Math.max(1, scriptWords.length - 1)) * 100);
          progressRef.current = nextProgress;
          setProgress(nextProgress);
        }
      }
    };
    recognition.onerror = () => setVoiceStatus('Microphone or speech recognition stopped.');
    recognition.onend = () => {
      setVoiceListening(false);
      if (voiceEnabled) setVoiceStatus('Voice follow paused.');
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceListening(true);
      setVoiceStatus('Listening…');
    } catch {
      setVoiceStatus('Could not start microphone access.');
    }
  };

  useEffect(() => {
    if (voiceEnabled) startVoice();
    else stopVoice();
    return () => stopVoice();
  }, [voiceEnabled]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (!shortcutsEnabled) return;
      if (event.code === 'Space') { event.preventDefault(); setIsPlaying((value) => !value); }
      if (event.key === 'ArrowUp') setSpeedMultiplier((value) => Math.min(5, +(value + 0.1).toFixed(1)));
      if (event.key === 'ArrowDown') setSpeedMultiplier((value) => Math.max(0.2, +(value - 0.1).toFixed(1)));
      if (event.key.toLowerCase() === 'r') resetScroll();
      if (event.key.toLowerCase() === 'm') setIsFlipped((value) => !value);
      if (event.key.toLowerCase() === 's') setShowSettings((value) => !value);
      if (event.key.toLowerCase() === 'v') setVoiceEnabled((value) => !value);
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      if (event.key === '?') setShowShortcuts((value) => !value);
      if (event.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (countdown > 0) { setCountdown(0); return; }
        if (document.fullscreenElement) void document.exitFullscreen();
        else exitPrompter();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit, showSettings, showShortcuts, countdown, shortcutsEnabled, setIsFlipped, setShowSettings, setVoiceEnabled, setSpeedMultiplier]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    if (!isPlaying || countdown > 0 || voiceListening) {
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
          const nextProgress = Math.min(100, (container.scrollTop / maxScroll) * 100);
          progressRef.current = nextProgress;
          setProgress(nextProgress);
        }
        if (container.scrollTop >= maxScroll - 2) setIsPlaying(false);
      }
      lastTimeRef.current = time;
      animationRef.current = requestAnimationFrame(scroll);
    };
    animationRef.current = requestAnimationFrame(scroll);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); animationRef.current = null; };
  }, [isPlaying, countdown, voiceListening, wpm, fontSize, speedMultiplier]);

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

  useEffect(() => {
    if (!isPlaying) void releaseWakeLock();
  }, [isPlaying]);

  useEffect(() => () => { void releaseWakeLock(); stopVoice(); }, []);

  const togglePlay = () => {
    if (isPlaying) { setIsPlaying(false); return; }
    setCountdown(3);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} className="fixed inset-0 z-50 flex flex-col bg-[#050506] text-white" onClick={wakeHUD}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-white/5"><div className="h-full bg-violet-400 transition-[width] duration-150" style={{ width: `${progress}%` }} /></div>
      <div className="pointer-events-none fixed left-5 top-5 z-40 hidden items-center gap-2 sm:flex"><img src="/teleqen-mark.svg" alt="Teleqen" className="h-8 w-8 rounded-[10px] opacity-90" /><span className="text-[10px] font-bold uppercase tracking-[.22em] text-white/30">Teleqen</span></div>
      {showFocusLine && <div className="pointer-events-none fixed inset-x-0 top-[34%] z-20 h-16 -translate-y-1/2"><div className="h-full w-full border-y border-violet-300/15 bg-gradient-to-r from-transparent via-violet-400/[.045] to-transparent" /></div>}
      <div ref={containerRef} className="smooth-scroll-container flex-1 overflow-y-auto px-4 py-[30vh] sm:px-8 lg:px-16 xl:px-24" style={{ transform: isFlipped ? 'scaleX(-1)' : undefined }} aria-label="Teleprompter script">
        <article className="mx-auto" style={{ maxWidth: `${textWidth}px`, fontFamily, lineHeight }}>
          {script.split('\n').map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`} className="mb-[.8em] whitespace-pre-wrap break-words text-center font-semibold tracking-[.008em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.85)]" style={{ fontSize: `clamp(32px, ${fontSize / 10}vw, ${fontSize}px)` }}>{paragraph || '\u00A0'}</p>)}
          <div className="h-[65vh]" aria-hidden="true" />
        </article>
      </div>
      {countdown > 0 && <button type="button" aria-label="Cancel countdown" onClick={() => setCountdown(0)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 backdrop-blur-[3px]"><span className="font-display text-[clamp(6rem,20vw,16rem)] font-extrabold tabular-nums text-white">{countdown}</span></button>}
      {voiceStatus && <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white/65 backdrop-blur">{voiceStatus}</div>}
      {showShortcuts && <div className="glass-panel fixed left-1/2 top-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Shortcuts</h2><button onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts"><X className="h-4 w-4" /></button></div><div className="space-y-2 text-sm text-white/65"><p><kbd>Space</kbd> Play / pause</p><p><kbd>↑ ↓</kbd> Adjust speed</p><p><kbd>R</kbd> Reset</p><p><kbd>M</kbd> Mirror</p><p><kbd>V</kbd> Voice follow</p><p><kbd>S</kbd> Style</p><p><kbd>F</kbd> Fullscreen</p><p><kbd>?</kbd> Shortcuts</p><p><kbd>Esc</kbd> Close / exit</p></div><p className="mt-4 text-[11px] text-white/35">Single-key shortcuts can be disabled below.</p></div>}
      <div className={`fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] -translate-x-1/2 transition-all duration-300 sm:bottom-6 sm:w-auto ${showHUD ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'}`}>
        <div className="glass-panel rounded-[1.4rem] p-2 sm:rounded-full sm:p-2.5"><div className="hud-scroll flex max-w-full flex-nowrap items-center justify-start gap-1 overflow-x-auto sm:justify-center sm:gap-2">
          <button onClick={togglePlay} aria-label={isPlaying ? 'Pause scrolling' : 'Start scrolling'} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_10px_35px_rgba(139,92,246,.25)] transition duration-200 hover:scale-105 hover:bg-violet-400 active:scale-95 sm:h-16 sm:w-16">{isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}</button>
          <div className="flex items-center gap-1 rounded-full bg-white/[.05] px-2 py-1.5"><button onClick={() => setSpeedMultiplier((v) => Math.max(.2, +(v - .1).toFixed(1)))} aria-label="Decrease speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><ArrowDown className="h-4 w-4" /></button><span className="min-w-12 text-center text-[10px] font-bold tabular-nums text-white/60"><Gauge className="mx-auto mb-0.5 h-4 w-4" />{speedMultiplier.toFixed(1)}×</span><button onClick={() => setSpeedMultiplier((v) => Math.min(5, +(v + .1).toFixed(1)))} aria-label="Increase speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><ArrowUp className="h-4 w-4" /></button></div>
          <button onClick={resetScroll} className="control-btn" aria-label="Reset script"><RotateCcw className="h-5 w-5" /><span>Reset</span></button>
          <button onClick={() => setIsFlipped((v) => !v)} className={`control-btn ${isFlipped ? 'active-control' : ''}`} aria-label="Toggle mirror"><FlipHorizontal className="h-5 w-5" /><span>Mirror</span></button>
          <button onClick={() => setShowFocusLine((v) => !v)} className={`control-btn ${showFocusLine ? 'active-control' : ''}`} aria-label="Toggle focus line"><Target className="h-5 w-5" /><span>Focus</span></button>
          <button onClick={() => setVoiceEnabled((v) => !v)} className={`control-btn ${voiceEnabled ? 'active-control' : ''}`} aria-label={voiceEnabled ? 'Disable voice follow' : 'Enable voice follow'}>{voiceEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}<span>Voice</span></button>
          <button onClick={() => setSoundEnabled((v) => !v)} className={`control-btn ${soundEnabled ? '' : 'text-white/30'}`} aria-label={soundEnabled ? 'Mute countdown' : 'Enable countdown sound'}>{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}<span>Sound</span></button>
          <button onClick={() => setShowSettings((v) => !v)} className={`control-btn ${showSettings ? 'active-control' : ''}`} aria-label="Open style settings"><Settings2 className="h-5 w-5" /><span>Style</span></button>
          <button onClick={toggleFullscreen} className="control-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}<span>Screen</span></button>
          <button onClick={() => setShowShortcuts((v) => !v)} className="control-btn" aria-label="Keyboard shortcuts"><span className="text-base leading-none">?</span><span>Keys</span></button>
          <button onClick={exitPrompter} className="control-btn text-red-300/70 hover:bg-red-500/10 hover:text-red-200" aria-label="Exit teleprompter"><X className="h-5 w-5" /><span>Exit</span></button>
        </div></div>
      </div>
      {showSettings && <div className="glass-panel fixed bottom-24 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl p-4" role="dialog" aria-label="Display settings"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">Display</h2><button onClick={() => setShowSettings(false)} aria-label="Close settings"><X className="h-4 w-4 text-white/50" /></button></div><div className="space-y-4 text-xs text-white/60"><label className="block">Text size<input aria-label="Text size" type="range" min="32" max="140" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Text width<input aria-label="Text width" type="range" min="600" max="1800" step="50" value={textWidth} onChange={(e) => setTextWidth(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Line spacing<input aria-label="Line spacing" type="range" min="1.1" max="1.8" step=".05" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Typeface<select aria-label="Typeface" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-white outline-none"><option value={FONT_FAMILIES[0].value}>Clean</option><option value={FONT_FAMILIES[1].value}>Classic</option><option value={FONT_FAMILIES[2].value}>Creator</option></select></label><label className="flex items-center justify-between gap-4"><span>Single-key shortcuts</span><input type="checkbox" checked={shortcutsEnabled} onChange={(e) => setShortcutsEnabled(e.target.checked)} aria-label="Enable single-key shortcuts" /></label></div></div>}
    </motion.div>
  );
}
