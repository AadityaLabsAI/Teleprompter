import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FlipHorizontal, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, Settings2, Target, Volume2, VolumeX, X } from 'lucide-react';
import { motion } from 'motion/react';

interface TeleprompterProps { script: string; wpm: number; onExit: () => void; }
const FONT_FAMILIES = [
  { label: 'Clean', value: 'DM Sans, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Classic', value: 'Georgia, serif' },
  { label: 'Creator', value: 'Manrope, ui-sans-serif, system-ui, sans-serif' },
];

export function Teleprompter({ script, wpm, onExit }: TeleprompterProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(72);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showFocusLine, setShowFocusLine] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showHUD, setShowHUD] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [lineHeight, setLineHeight] = useState(1.35);
  const [textWidth, setTextWidth] = useState(1100);
  const [countdown, setCountdown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const progressTimeRef = useRef(0);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = useMemo(() => script.trim() ? script.trim().split(/\s+/u).length : 0, [script]);

  const wakeHUD = () => {
    setShowHUD(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    if (isPlaying) hudTimeoutRef.current = setTimeout(() => setShowHUD(false), 2600);
  };

  useEffect(() => {
    const events = ['mousemove', 'touchstart', 'keydown'];
    events.forEach((event) => window.addEventListener(event, wakeHUD, { passive: true }));
    return () => {
      events.forEach((event) => window.removeEventListener(event, wakeHUD));
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (event.code === 'Space') { event.preventDefault(); setIsPlaying((value) => !value); }
      if (event.key.toLowerCase() === 'r') resetScroll();
      if (event.key.toLowerCase() === 'm') setIsFlipped((value) => !value);
      if (event.key.toLowerCase() === 's') setShowSettings((value) => !value);
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      if (event.key === '?') setShowShortcuts((value) => !value);
      if (event.key === 'ArrowUp') setSpeedMultiplier((value) => Math.min(5, +(value + 0.1).toFixed(1)));
      if (event.key === 'ArrowDown') setSpeedMultiplier((value) => Math.max(0.2, +(value - 0.1).toFixed(1)));
      if (event.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (countdown > 0) { setCountdown(0); return; }
        if (document.fullscreenElement) void document.exitFullscreen();
        else onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit, showSettings, showShortcuts, countdown]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

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
          setProgress(Math.min(100, (container.scrollTop / maxScroll) * 100));
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
    const timer = window.setTimeout(() => {
      if (countdown === 1) { setCountdown(0); setIsPlaying(true); }
      else setCountdown((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const togglePlay = () => {
    if (isPlaying) { setIsPlaying(false); return; }
    setCountdown(3);
    if (soundEnabled) {
      try {
        const ctx = new AudioContext();
        void ctx.resume();
        window.setTimeout(() => void ctx.close(), 150);
      } catch { /* audio is optional */ }
    }
  };

  const resetScroll = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setProgress(0);
    setIsPlaying(false);
    setCountdown(0);
    lastTimeRef.current = null;
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* unavailable */ }
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
      {showShortcuts && <div className="glass-panel fixed left-1/2 top-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Shortcuts</h2><button onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts"><X className="h-4 w-4" /></button></div><div className="space-y-2 text-sm text-white/65"><p><kbd>Space</kbd> Play / pause</p><p><kbd>↑ ↓</kbd> Adjust speed</p><p><kbd>R</kbd> Reset</p><p><kbd>M</kbd> Mirror</p><p><kbd>S</kbd> Style</p><p><kbd>F</kbd> Fullscreen</p><p><kbd>?</kbd> Shortcuts</p><p><kbd>Esc</kbd> Close / exit</p></div></div>}
      <div className={`fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 transition-all duration-300 sm:bottom-6 sm:w-auto ${showHUD ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'}`}>
        <div className="glass-panel rounded-[1.4rem] p-2 sm:rounded-full sm:p-2.5"><div className="flex flex-wrap items-center justify-center gap-1 sm:flex-nowrap sm:gap-2">
          <button onClick={togglePlay} aria-label={isPlaying ? 'Pause scrolling' : 'Start scrolling'} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_10px_35px_rgba(139,92,246,.25)] transition duration-200 hover:scale-105 hover:bg-violet-400 active:scale-95 sm:h-16 sm:w-16">{isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}</button>
          <div className="flex items-center gap-1 rounded-full bg-white/[.05] px-2 py-1.5"><button onClick={() => setSpeedMultiplier((v) => Math.max(.2, +(v - .1).toFixed(1)))} aria-label="Decrease speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><ArrowDown className="h-4 w-4" /></button><span className="min-w-12 text-center text-[10px] font-bold tabular-nums text-white/60"><Gauge className="mx-auto mb-0.5 h-4 w-4" />{speedMultiplier.toFixed(1)}×</span><button onClick={() => setSpeedMultiplier((v) => Math.min(5, +(v + .1).toFixed(1)))} aria-label="Increase speed" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><ArrowUp className="h-4 w-4" /></button></div>
          <button onClick={resetScroll} className="control-btn" aria-label="Reset script"><RotateCcw className="h-5 w-5" /><span>Reset</span></button>
          <button onClick={() => setIsFlipped((v) => !v)} className={`control-btn ${isFlipped ? 'active-control' : ''}`} aria-label="Toggle mirror"><FlipHorizontal className="h-5 w-5" /><span>Mirror</span></button>
          <button onClick={() => setShowFocusLine((v) => !v)} className={`control-btn ${showFocusLine ? 'active-control' : ''}`} aria-label="Toggle focus line"><Target className="h-5 w-5" /><span>Focus</span></button>
          <button onClick={() => setSoundEnabled((v) => !v)} className="control-btn" aria-label={soundEnabled ? 'Mute countdown' : 'Enable countdown sound'}>{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}<span>Sound</span></button>
          <button onClick={() => setShowSettings((v) => !v)} className={`control-btn ${showSettings ? 'active-control' : ''}`} aria-label="Open style settings"><Settings2 className="h-5 w-5" /><span>Style</span></button>
          <button onClick={toggleFullscreen} className="control-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}<span>Screen</span></button>
          <button onClick={() => setShowShortcuts((v) => !v)} className="control-btn" aria-label="Keyboard shortcuts"><span className="text-base leading-none">?</span><span>Keys</span></button>
          <button onClick={onExit} className="control-btn text-red-300/70 hover:bg-red-500/10 hover:text-red-200" aria-label="Exit teleprompter"><X className="h-5 w-5" /><span>Exit</span></button>
        </div></div>
      </div>
      {showSettings && <div className="glass-panel fixed bottom-24 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl p-4" role="dialog" aria-label="Display settings"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">Display</h2><button onClick={() => setShowSettings(false)} aria-label="Close settings"><X className="h-4 w-4 text-white/50" /></button></div><div className="space-y-4 text-xs text-white/60"><label className="block">Text size<input aria-label="Text size" type="range" min="32" max="140" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Text width<input aria-label="Text width" type="range" min="600" max="1800" step="50" value={textWidth} onChange={(e) => setTextWidth(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Line spacing<input aria-label="Line spacing" type="range" min="1.1" max="1.8" step=".05" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="range-clean mt-2 w-full" /></label><label className="block">Typeface<select aria-label="Typeface" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-white outline-none"><option value={FONT_FAMILIES[0].value}>Clean</option><option value={FONT_FAMILIES[1].value}>Classic</option><option value={FONT_FAMILIES[2].value}>Creator</option></select></label></div></div>}
    </motion.div>
  );
}
