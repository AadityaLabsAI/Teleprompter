import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, Moon, Play, ShieldCheck, Sparkles, Sun, Video, WandSparkles } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Editor } from './components/Editor';
import { Teleprompter } from './components/Teleprompter';
import { APP_CONFIG } from './config';

type AppMode = 'landing' | 'editor' | 'prompter';
type Theme = 'dark' | 'light';

function Landing({ onStart, theme, setTheme }: { onStart: () => void; theme: Theme; setTheme: (theme: Theme) => void }) {
  return (
    <motion.main className="teleqen-landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45 }}>
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />
      <header className="landing-nav">
        <div className="landing-brand">
          <img src="/teleqen-mark.svg" alt="Teleqen" />
          <div><strong>Teleqen</strong><span>Your words. Your flow.</span></div>
        </div>
        <div className="landing-nav-actions">
          <button className="theme-switch" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button className="landing-ghost" onClick={onStart}>Open Studio <ArrowRight size={16} /></button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={14} /> PRIVATE CREATOR STUDIO</div>
          <h1>Read naturally.<br /><span>Create confidently.</span></h1>
          <p>A focused teleprompter built for creators who want smooth scrolling, camera confidence and a premium studio experience — without sending scripts to the cloud.</p>
          <div className="hero-actions">
            <button className="landing-primary" onClick={onStart}><Play size={17} fill="currentColor" /> Start creating <ArrowRight size={17} /></button>
            <div className="hero-trust"><ShieldCheck size={16} /> Local-first · No account required</div>
          </div>
        </div>
        <motion.div className="hero-device" initial={{ y: 30, opacity: 0, rotate: 1 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ duration: .8, delay: .1 }}>
          <div className="device-glow" />
          <div className="device-top"><span /><span /><span /></div>
          <div className="device-screen">
            <div className="device-header"><span>Teleqen</span><Video size={14} /></div>
            <div className="device-focus" />
            <div className="device-lines"><i /><i /><i /><i /><i /></div>
            <div className="device-controls"><b><Play size={14} fill="currentColor" /></b><span>1.0×</span><span>Mirror</span><span>Style</span></div>
          </div>
        </motion.div>
      </section>

      <section className="landing-features">
        {[
          [Video, 'Camera companion', 'A movable live camera preview keeps your eye-line and framing visible while you read.'],
          [WandSparkles, 'Studio-grade flow', 'Smooth motion, focus guidance, countdowns and responsive controls designed around performance.'],
          [ShieldCheck, 'Private by design', 'Scripts and preferences stay in your browser. No login is needed to start creating.'],
        ].map(([Icon, title, text]) => {
          const FeatureIcon = Icon as typeof Video;
          return <article key={title as string}><div className="feature-icon"><FeatureIcon size={19} /></div><h2>{title as string}</h2><p>{text as string}</p><div className="feature-check"><Check size={13} /> Built for creators</div></article>;
        })}
      </section>

      <footer className="landing-footer"><span>Teleqen</span><span>Made for scripts, rehearsals and real cameras.</span><button onClick={onStart}>Enter Studio <ArrowRight size={14} /></button></footer>
    </motion.main>
  );
}

export default function App() {
  const [script, setScript] = useLocalStorage('teleqen_script', '');
  const [wpm, setWpm] = useLocalStorage('teleqen_wpm', APP_CONFIG.defaultWPM);
  const [theme, setTheme] = useLocalStorage<Theme>('teleqen-theme', 'dark');
  const [mode, setMode] = useState<AppMode>('landing');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const openPrompter = useCallback(() => {
    if (script.trim()) setMode('prompter');
  }, [script]);

  return (
    <AnimatePresence mode="wait">
      {mode === 'landing' && <Landing onStart={() => setMode('editor')} theme={theme} setTheme={setTheme} />}
      {mode === 'editor' && (
        <Editor script={script} setScript={setScript} wpm={wpm} setWpm={setWpm} onPlay={openPrompter} theme={theme} setTheme={setTheme} onHome={() => setMode('landing')} />
      )}
      {mode === 'prompter' && <Teleprompter script={script} wpm={wpm} onExit={() => setMode('editor')} theme={theme} />}
    </AnimatePresence>
  );
}
