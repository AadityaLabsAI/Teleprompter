import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, FlipHorizontal, Gauge, Maximize, Minimize, Video,
  Pause, Play, RotateCcw, Settings2, Target, Volume2, VolumeX, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { VideoOverlay } from './VideoOverlay';

interface TeleprompterProps {
  script: string;
  wpm: number;
  onExit: () => void;
  theme?: 'dark' | 'light';
  key?: string;
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
    } catch { /* browser may deny fullscreen */ }
  };

  const beep = (frequency: number, duration = 100) => {
    if (!soundEnabled) return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock && !wakeLockRef.current) {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      }
    } catch { /* wake lock is optional */ }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) await wakeLockRef.current.release();
    } catch { /* noop */ }
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
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      if (event.code === 'Space') {
        event.preventDefault();
        setIsPlaying((value) => !value);
      }
      if (event.key === 'ArrowUp') setSpeedMultiplier((value) => Math.min(5, +(value + 0.1).toFixed(1)));
      if (event.key === 'ArrowDown') setSpeedMultiplier((value) => Math.max(0.2, +(value - 0.1).toFixed(1)));
      if (event.key.toLowerCase() === 'r') resetScroll();
      if (event.key.toLowerCase() === 'm') setIsFlipped((value) => !value);
      if (event.key.toLowerCase() === 's') setShowSettings((value) => !value);
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();

      if (event.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (countdown > 0) {
          setCountdown(0);
          return;
        }
        if (document.fullscreenElement) void document.exitFullscreen();
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

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

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
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [isPlaying, countdown, wpm, fontSize, speedMultiplier]);

  useEffect(() => {
    if (countdown <= 0) return;
    beep(countdown === 1 ? 880 : 660);
    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        setCountdown(0);
        setIsPlaying(true);
        void acquireWakeLock();
      } else {
        setCountdown((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isPlaying) void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) void releaseWakeLock();
  }, [isPlaying]);

  useEffect(() => () => { void releaseWakeLock(); }, []);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (countdown > 0) {
      setCountdown(0);
      return;
    }
    setCountdown(3);
  };

  const handleScriptTap = () => {
    if (countdown > 0) return;
    if (isPlaying) setIsPlaying(false);
    else setCountdown(3);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="teleqen-prompter fixed inset-0 z-50 flex flex-col text-white"
      onClick={wakeHUD}
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-white/5">
        <div className="prompter-progress h-full transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <div className="pointer-events-none fixed left-5 top-5 z-40 hidden items-center gap-2 sm:flex">
        <img src="/teleqen-mark.svg" alt="Teleqen" className="prompter-brand h-8 w-8 rounded-[10px] opacity-90" />
        <span className="text-[10px] font-bold uppercase tracking-[.22em] text-white/30">Teleqen</span>
      </div>

      {showFocusLine && (
        <div className="pointer-events-none fixed inset-x-0 top-[34%] z-20 h-16 -translate-y-1/2">
          <div className="prompter-focus h-full w-full border-y bg-gradient-to-r from-transparent to-transparent" />
        </div>
      )}

      <div
        ref={containerRef}
        onClick={handleScriptTap}
        className="prompter-script smooth-scroll-container flex-1 cursor-pointer overflow-y-auto px-4 py-[30vh] sm:px-8 lg:px-16 xl:px-24"
        style={{ transform: isFlipped ? 'scaleX(-1)' : undefined }}
        aria-label="Teleprompter script"
      >
        <article className="mx-auto" style={{ maxWidth: `${textWidth}px`, fontFamily, lineHeight }}>
          {script.split('\n').map((paragraph, index) => (
            <p
              key={`${index}-${paragraph.slice(0, 12)}`}
              className="mb-[.8em] whitespace-pre-wrap break-words text-center font-semibold tracking-[.008em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.85)]"
              style={{ fontSize: `clamp(32px, ${fontSize / 10}vw, ${fontSize}px)` }}
            >
              {paragraph || '\u00A0'}
            </p>
          ))}
          <div className="h-[65vh]" aria-hidden="true" />
        </article>
      </div>

      {countdown > 0 && (
        <button
          type="button"
          aria-label="Cancel countdown"
          onClick={() => setCountdown(0)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 backdrop-blur-[3px]"
        >
          <span className="font-display text-[clamp(6rem,20vw,16rem)] font-extrabold tabular-nums text-white">{countdown}</span>
        </button>
      )}

      <div className={`teleqen-hud fixed left-1/2 z-50 w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] -translate-x-1/2 transition-all duration-300 sm:bottom-6 sm:w-auto ${showHUD ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'}`}>
        <div className="prompter-glass glass-panel rounded-[1.4rem] p-1.5 sm:rounded-full sm:p-2.5">
          <div className="hud-scroll flex max-w-full flex-nowrap items-center justify-start gap-0.5 overflow-x-auto sm:justify-center sm:gap-2">
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause scrolling' : 'Start scrolling'}
              className="prompter-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_35px_rgba(139,92,246,.25)] transition duration-200 hover:scale-105 active:scale-95 sm:h-16 sm:w-16"
            >
              {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
            </button>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[.05] px-1.5 py-1.5">
              <button onClick={() => setSpeedMultiplier((v) => Math.max(.2, +(v - .1).toFixed(1)))} aria-label="Decrease speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
                <ArrowDown className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-[10px] font-bold tabular-nums text-white/60">
                <Gauge className="mx-auto mb-0.5 h-4 w-4" />{speedMultiplier.toFixed(1)}×
              </span>
              <button onClick={() => setSpeedMultiplier((v) => Math.min(5, +(v + .1).toFixed(1)))} aria-label="Increase speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white">
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>

            <button onClick={resetScroll} className="control-btn" aria-label="Reset script"><RotateCcw className="h-5 w-5" /><span>Reset</span></button>
            <button onClick={() => setIsFlipped((v) => !v)} className={`control-btn ${isFlipped ? 'active-control' : ''}`} aria-label="Toggle mirror"><FlipHorizontal className="h-5 w-5" /><span>Mirror</span></button>
            <button onClick={() => setShowFocusLine((v) => !v)} className={`control-btn hidden sm:flex ${showFocusLine ? 'active-control' : ''}`} aria-label="Toggle focus line"><Target className="h-5 w-5" /><span>Focus</span></button>
            <button onClick={() => setShowCamera((v) => !v)} className={`control-btn ${showCamera ? 'active-control' : ''}`} aria-label="Toggle camera preview"><Video className="h-5 w-5" /><span>Video</span></button>
            <button onClick={() => setSoundEnabled((v) => !v)} className={`control-btn hidden sm:flex ${soundEnabled ? '' : 'text-white/30'}`} aria-label={soundEnabled ? 'Mute countdown' : 'Enable countdown sound'}>{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}<span>Sound</span></button>
            <button onClick={() => setShowSettings((v) => !v)} className={`control-btn ${showSettings ? 'active-control' : ''}`} aria-label="Open display settings"><Settings2 className="h-5 w-5" /><span>Style</span></button>
            <button onClick={toggleFullscreen} className="control-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}<span>Screen</span></button>
            <button onClick={exitPrompter} className="control-btn text-red-300/70 hover:bg-red-500/10 hover:text-red-200" aria-label="Exit teleprompter"><X className="h-5 w-5" /><span>Exit</span></button>
          </div>
        </div>
      </div>

      {showCamera && <VideoOverlay onClose={() => setShowCamera(false)} />}\n\n      {showSettings && (
        <div className="teleqen-settings prompter-glass glass-panel fixed left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl p-4" role="dialog" aria-label="Display settings">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Display</h2>
              <p className="mt-0.5 text-[10px] text-white/30">Tune the reading experience</p>
            </div>
            <button onClick={() => setShowSettings(false)} aria-label="Close settings"><X className="h-4 w-4 text-white/50" /></button>
          </div>
          <div className="space-y-4 text-xs text-white/60">
            <label className="block">Text size<output className="float-right text-white/35">{fontSize}px</output><input aria-label="Text size" type="range" min="32" max="140" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="range-clean mt-2 w-full" /></label>
            <label className="block">Text width<output className="float-right text-white/35">{textWidth}px</output><input aria-label="Text width" type="range" min="600" max="1800" step="50" value={textWidth} onChange={(e) => setTextWidth(Number(e.target.value))} className="range-clean mt-2 w-full" /></label>
            <label className="block">Line spacing<output className="float-right text-white/35">{lineHeight.toFixed(2)}</output><input aria-label="Line spacing" type="range" min="1.1" max="1.8" step=".05" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="range-clean mt-2 w-full" /></label>
            <label className="block">Typeface<select aria-label="Typeface" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-white outline-none"><option value={FONT_FAMILIES[0].value}>Clean</option><option value={FONT_FAMILIES[1].value}>Classic</option><option value={FONT_FAMILIES[2].value}>Creator</option></select></label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setShowFocusLine((v) => !v)} className={`rounded-xl border p-3 text-left ${showFocusLine ? 'active-control border-violet-400/20' : 'border-white/10 bg-white/[.03]'}`}><span className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Focus line</span><span className="mt-1 block text-xs font-semibold text-white/70">{showFocusLine ? 'On' : 'Off'}</span></button>
              <button type="button" onClick={() => setSoundEnabled((v) => !v)} className={`rounded-xl border p-3 text-left ${soundEnabled ? 'active-control border-violet-400/20' : 'border-white/10 bg-white/[.03]'}`}><span className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Countdown sound</span><span className="mt-1 block text-xs font-semibold text-white/70">{soundEnabled ? 'On' : 'Off'}</span></button>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-[10px] leading-5 text-white/35">
              <span className="font-semibold text-white/55">Tip:</span> Tap the script to pause or start. Controls fade away while you read.
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
