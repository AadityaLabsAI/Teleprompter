import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Editor } from './components/Editor';
import { Teleprompter } from './components/Teleprompter';
import { APP_CONFIG } from './config';

type AppMode = 'editor' | 'prompter';
type Theme = 'dark' | 'light';

export default function App() {
  const [script, setScript] = useLocalStorage('teleqen_script', '');
  const [wpm, setWpm] = useLocalStorage('teleqen_wpm', APP_CONFIG.defaultWPM);
  const [theme, setTheme] = useLocalStorage<Theme>('teleqen-theme', 'dark');
  const [mode, setMode] = useState<AppMode>('editor');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const themeColor = theme === 'light' ? '#f4f7fb' : '#07090d';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [theme]);

  const openPrompter = useCallback(() => {
    if (script.trim()) setMode('prompter');
  }, [script]);

  return (
    <AnimatePresence mode="wait">
      {mode === 'editor' ? (
        <Editor
          script={script}
          setScript={setScript}
          wpm={wpm}
          setWpm={setWpm}
          onPlay={openPrompter}
          theme={theme}
          setTheme={setTheme}
        />
      ) : (
        <Teleprompter script={script} wpm={wpm} onExit={() => setMode('editor')} theme={theme} />
      )}
    </AnimatePresence>
  );
}
