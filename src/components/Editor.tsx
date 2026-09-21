import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Clock3, Download, FileText, FolderOpen, Play, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { APP_CONFIG } from '../config';

interface EditorProps {
  script: string;
  setScript: (s: string) => void;
  wpm: number;
  setWpm: (w: number) => void;
  onPlay: () => void;
}

export function Editor({ script, setScript, wpm, setWpm, onPlay }: EditorProps) {
  const [saved, setSaved] = useState(false);
  const [fileName, setFileName] = useState('My Script');

  const wordCount = useMemo(() => script.trim() ? script.trim().split(/\s+/u).length : 0, [script]);
  const characterCount = script.length;
  const estimatedSeconds = Math.max(0, Math.round((wordCount / Math.max(1, wpm)) * 60));
  const estimatedMin = Math.floor(estimatedSeconds / 60);
  const estimatedSec = estimatedSeconds % 60;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && script.trim()) {
        event.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [onPlay, script]);

  const handleSave = () => {
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName.trim() || 'script'}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md');
    if (!allowed) return;
    const reader = new FileReader();
    reader.onload = () => {
      setScript(String(reader.result ?? ''));
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'Imported Script');
      setSaved(false);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleClear = () => {
    if (!script || window.confirm('Clear this script? Your local saved data will remain in this browser.')) {
      setScript('');
      setSaved(false);
    }
  };

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="min-h-screen w-full bg-[#070707] px-3 py-3 text-white sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1680px] flex-col sm:min-h-[calc(100vh-3rem)]">
        <header className="mb-4 flex flex-col gap-4 border-b border-white/[.07] pb-4 sm:mb-6 sm:pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/teleqen-mark.svg" alt="Teleqen" className="h-10 w-10 shrink-0 rounded-[13px] shadow-lg sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-xl font-semibold tracking-[-.035em] text-white sm:text-[22px]">{APP_CONFIG.appName}</h1>
                <span className="rounded-full border border-white/10 bg-white/[.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.16em] text-white/35">Studio</span>
              </div>
              <p className="mt-0.5 text-xs font-medium tracking-wide text-white/38 sm:text-sm">{APP_CONFIG.appTagline}</p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/35 md:flex"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" /> On-device</div>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[.09] bg-white/[.035] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-white/15 hover:bg-white/[.07] hover:text-white sm:flex-none"><Upload className="h-4 w-4" /> Import<input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={handleImport} /></label>
            <button onClick={handleSave} disabled={!script} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[.09] bg-white/[.035] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-white/15 hover:bg-white/[.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25 sm:flex-none"><Download className="h-4 w-4" /> {saved ? 'Saved' : 'Export'}</button>
            <button onClick={onPlay} disabled={!script.trim()} className="group flex flex-[1.2] items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:-translate-y-px hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 sm:flex-none sm:px-5"><Play className="h-3.5 w-3.5 fill-current transition-transform group-hover:scale-110" /> <span>Start reading</span></button>
          </div>
        </header>

        <section className="editor-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl" aria-label="Script editor">
          <div className="border-b border-white/[.06] bg-white/[.018]">
            <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2.5"><FolderOpen className="h-4 w-4 shrink-0 text-white/30" /><input value={fileName} onChange={(e) => { setFileName(e.target.value); setSaved(false); }} aria-label="Script name" className="min-w-0 w-full max-w-sm bg-transparent text-sm font-semibold tracking-tight text-white outline-none placeholder:text-white/20" placeholder="Script name" /><span className="hidden rounded-full bg-emerald-400/8 px-2 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-emerald-300/60 sm:inline-flex">Local</span></div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white/30"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {wordCount.toLocaleString()} words</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {estimatedMin}m {String(estimatedSec).padStart(2, '0')}s</span><span>{characterCount.toLocaleString()} chars</span></div>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/[.05] px-3 py-3 sm:flex-row sm:items-center sm:px-4"><div className="flex items-center justify-between sm:justify-start sm:gap-3"><span className="text-[9px] font-bold uppercase tracking-[.18em] text-white/30">Reading pace</span><output className="rounded-md bg-white/[.05] px-2.5 py-1.5 text-[10px] font-bold text-white/65 sm:order-3">{wpm} WPM</output></div><input aria-label="Words per minute" type="range" min="30" max="400" step="5" value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="w-full accent-white sm:max-w-xs" /><button onClick={handleClear} disabled={!script} className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/25 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-20 sm:ml-auto"><Trash2 className="h-3.5 w-3.5" /> Clear</button></div>
          </div>

          <div className="relative flex-1 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.025),transparent_35%)]">
            {!script && <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center px-6 sm:top-12"><div className="max-w-md text-center"><div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.035]"><img src="/teleqen-mark.svg" alt="" className="h-6 w-6 rounded-md opacity-60" /></div><p className="text-sm font-semibold text-white/55">Start with your script</p><p className="mt-1 text-xs leading-5 text-white/25">Paste a short intro or a full-length video script. Everything is saved locally on this device.</p></div></div>}
            <textarea value={script} onChange={(e) => { setScript(e.target.value); setSaved(false); }} aria-label="Script text" placeholder={APP_CONFIG.appDescription} spellCheck className="h-full min-h-[55vh] w-full resize-none bg-transparent p-5 text-[1.03rem] leading-8 text-white/85 outline-none placeholder:text-white/[.17] sm:p-8 sm:text-[1.16rem] sm:leading-9 lg:p-12 lg:text-[1.25rem] lg:leading-10" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.05] px-4 py-3 text-[9px] font-semibold uppercase tracking-[.14em] text-white/20 sm:px-6"><span>Private by design · Stored on this device</span><span className="hidden sm:inline">Ctrl / ⌘ + Enter · Start reading</span></div>
        </section>
      </div>
    </motion.main>
  );
}
