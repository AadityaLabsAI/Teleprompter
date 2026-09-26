import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Clock3, Download, FileText, FolderOpen, Moon, Play, ShieldCheck, Sun, Trash2, Upload, Sparkles } from 'lucide-react';
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
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && script.trim()) {
        event.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
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
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="teleqen-app studio-v2 min-h-[100dvh] w-full">
      <div className="studio-v2-frame">
        <header className="studio-v2-header">
          <div className="studio-v2-brand">
            <img src="/teleqen-mark.svg" alt="Teleqen" className="studio-v2-logo" />
            <div className="studio-v2-brand-copy">
              <div className="studio-v2-title-row">
                <h1>{APP_CONFIG.appName}</h1>
                <span>Studio</span>
              </div>
              <p>{APP_CONFIG.appTagline}</p>
            </div>
          </div>

          <div className="studio-v2-header-tools">
            <div className="studio-v2-privacy"><ShieldCheck size={15} /><span>Private & local</span></div>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="studio-v2-icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <label className="studio-v2-action secondary">
              <Upload size={15} /><span>Import</span>
              <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleImport} />
            </label>
            <button onClick={handleSave} disabled={!script} className="studio-v2-action secondary"><Download size={15} /><span>{saved ? 'Saved' : 'Export'}</span></button>
            <button onClick={onPlay} disabled={!script.trim()} className="studio-v2-action primary studio-start-button"><Play size={14} fill="currentColor" /><span>Start reading</span></button>
          </div>
        </header>

        <section className="studio-v2-card studio-editor-card" aria-label="Script editor">
          <div className="studio-v2-toolbar">
            <div className="studio-v2-file">
              <div className="studio-v2-file-icon"><FolderOpen size={16} /></div>
              <input value={fileName} onChange={(e) => { setFileName(e.target.value); setSaved(false); }} aria-label="Script name" placeholder="Script name" />
              <span className="studio-v2-local">LOCAL</span>
            </div>
            <div className="studio-v2-metrics">
              <span><FileText size={14} /> {wordCount.toLocaleString()} words</span>
              <span><Clock3 size={14} /> {estimatedMin}m {String(estimatedSec).padStart(2, '0')}s</span>
              <span>{characterCount.toLocaleString()} chars</span>
            </div>
          </div>

          <div className="studio-v2-pace">
            <div>
              <span className="studio-v2-eyebrow">Reading pace</span>
              <strong>{wpm} <small>WPM</small></strong>
            </div>
            <input aria-label="Words per minute" type="range" min="30" max="400" step="5" value={wpm} onChange={(e) => setWpm(Number(e.target.value))} />
            <div className="studio-v2-pace-hint">Adjust for your natural speaking rhythm</div>
            <button onClick={handleClear} disabled={!script} aria-label="Clear script" className="studio-v2-clear"><Trash2 size={15} /> Clear</button>
          </div>

          <div className="studio-v2-writing studio-writing-area">
            {!script && (
              <div className="studio-v2-empty">
                <div className="studio-v2-empty-icon"><Sparkles size={19} /></div>
                <h2>Write your next take</h2>
                <p>Paste your script here, or import a .txt / .md file. Your work stays on this device.</p>
              </div>
            )}
            <textarea
              value={script}
              onChange={(e) => { setScript(e.target.value); setSaved(false); }}
              aria-label="Script text"
              placeholder="Start writing or paste your script…"
              spellCheck
            />
          </div>

          <footer className="studio-v2-footer">
            <span>Autosaved locally in your browser</span>
            <span className="studio-v2-shortcut"><kbd>⌘</kbd><kbd>Enter</kbd> to start reading</span>
          </footer>
        </section>

        <div className="studio-v2-note"><span>Teleprompter</span><i /> Smooth reading • camera-ready • distraction free</div>
      </div>
    </motion.main>
  );
}
