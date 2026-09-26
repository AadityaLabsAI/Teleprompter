import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Clock3, Download, FileText, FolderOpen, Moon, Play, ShieldCheck, Sun, Trash2, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { APP_CONFIG } from '../config';

interface EditorProps {
  script: string;
  setScript: (s: string) => void;
  wpm: number;
  setWpm: (w: number) => void;
  onPlay: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export function Editor({ script, setScript, wpm, setWpm, onPlay, theme, setTheme }: EditorProps) {
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
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="teleqen-app studio-shell pulse-shell min-h-[100dvh] w-full bg-[#FAFAFA] px-0 text-slate-900 sm:px-0">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col">
        <header className="studio-header pulse-header relative sticky top-0 z-30 flex flex-col gap-4 border-b border-gray-100 bg-[#FAFAFA]/95 px-6 pb-3 pt-6 pr-14 backdrop-blur-md sm:mb-0 sm:pb-3 sm:pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/teleqen-mark.svg" alt="Teleqen" className="brand-mark studio-brand h-9 w-9 shrink-0 rounded-xl sm:h-10 sm:w-10" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-display studio-title text-xl font-black tracking-tighter text-slate-900 sm:text-[22px]">{APP_CONFIG.appName}</h1>
                <span className="studio-badge rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-gray-400 shadow-sm">Studio</span>
              </div>
              <p className="studio-tagline mt-0.5 text-[9px] font-bold uppercase tracking-[.2em] text-gray-400 sm:text-[10px]">{APP_CONFIG.appTagline}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="theme-toggle pulse-theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="studio-actions pulse-header-actions flex w-full items-center gap-2 sm:w-auto">
            
            <div className="studio-device-badge hidden items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-gray-400 shadow-sm md:flex"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" /> On-device</div>
            <label className="studio-action-button flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-xs font-bold text-gray-500 shadow-sm transition hover:border-gray-200 hover:bg-gray-50 hover:text-slate-900 sm:flex-none"><Upload className="h-4 w-4" /> Import<input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={handleImport} /></label>
            <button onClick={handleSave} disabled={!script} className="studio-action-button flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-xs font-bold text-gray-500 shadow-sm transition hover:border-gray-200 hover:bg-gray-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"><Download className="h-4 w-4" /> {saved ? 'Saved' : 'Export'}</button>
            <button onClick={onPlay} disabled={!script.trim()} className="studio-start-button group flex flex-[1.2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-indigo-200/40 transition hover:-translate-y-px hover:brightness-[1.03] disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40 sm:flex-none sm:px-5"><Play className="h-3.5 w-3.5 fill-current transition-transform group-hover:scale-110" /> <span>Start reading</span></button>
          </div>
        </header>

        <section className="editor-card studio-editor-card pulse-card mx-6 mb-8 mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] sm:rounded-[2.5rem]" aria-label="Script editor">
          <div className="studio-editor-header pulse-card-header border-b border-gray-100 bg-white">
            <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="studio-script-row flex min-w-0 items-center gap-2.5"><FolderOpen className="h-4 w-4 shrink-0 text-white/30" /><input value={fileName} onChange={(e) => { setFileName(e.target.value); setSaved(false); }} aria-label="Script name" className="studio-script-name min-w-0 w-full max-w-sm bg-transparent text-sm font-semibold tracking-tight text-white outline-none placeholder:text-white/20" placeholder="Script name" /><span className="studio-local-badge hidden rounded-full bg-emerald-400/8 px-2 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-emerald-300/60 sm:inline-flex">Local</span></div>
              <div className="studio-stats flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-[.12em] text-gray-400"><span className="studio-stat inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {wordCount.toLocaleString()} words</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {estimatedMin}m {String(estimatedSec).padStart(2, '0')}s</span><span>{characterCount.toLocaleString()} chars</span></div>
            </div>
            <div className="studio-pace-row flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:px-6"><div className="studio-pace-meta flex items-center justify-between sm:justify-start sm:gap-3"><span className="studio-section-label text-[9px] font-bold uppercase tracking-[.18em] text-white/30">Reading pace</span><output className="studio-wpm rounded-md bg-white/[.05] px-2.5 py-1.5 text-[10px] font-bold text-white/65 sm:order-3">{wpm} WPM</output></div><input aria-label="Words per minute" type="range" min="30" max="400" step="5" value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="studio-range w-full accent-white sm:max-w-xs" /><button onClick={handleClear} disabled={!script} className="studio-clear inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/25 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-20 sm:ml-auto"><Trash2 className="h-3.5 w-3.5" /> Clear</button></div>
          </div>

          <div className="studio-writing-area pulse-writing-area relative flex-1 bg-white">
            {!script && <div className="studio-empty-state pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center px-6 sm:top-12"><div className="max-w-md text-center"><div className="studio-empty-icon mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.035]"><img src="/teleqen-mark.svg" alt="" className="h-6 w-6 rounded-md opacity-60" /></div><p className="studio-empty-title text-sm font-semibold text-white/55">Start with your script</p><p className="studio-empty-copy mt-1 text-xs leading-5 text-white/25">Paste a short intro or a full-length video script. Everything is saved locally on this device.</p></div></div>}
            <textarea value={script} onChange={(e) => { setScript(e.target.value); setSaved(false); }} aria-label="Script text" placeholder={APP_CONFIG.appDescription} spellCheck className="studio-textarea h-full min-h-[55vh] w-full resize-none bg-transparent p-6 text-[1.03rem] leading-8 text-slate-800 outline-none placeholder:text-gray-300 outline-none sm:p-9 sm:text-[1.16rem] sm:leading-9 lg:p-12 lg:text-[1.25rem] lg:leading-10" />
          </div>
          <div className="studio-footer flex flex-wrap items-center justify-between gap-2 border-t border-white/[.05] px-4 py-3 text-[9px] font-semibold uppercase tracking-[.14em] text-white/20 sm:px-6"><span>Private by design · Stored on this device</span><span className="hidden sm:inline">Ctrl / ⌘ + Enter · Start reading</span></div>
        </section>
      </div>
    </motion.main>
  );
}
