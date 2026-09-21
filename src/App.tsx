import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Editor } from './components/Editor';
import { Teleprompter } from './components/Teleprompter';
import { APP_CONFIG } from './config';

export default function App() {
  const [script, setScript] = useLocalStorage('teleqen_script', '');
  const [wpm, setWpm] = useLocalStorage('teleqen_wpm', APP_CONFIG.defaultWPM);
  const [mode, setMode] = useState<'editor' | 'prompter'>('editor');

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
        />
      ) : (
        <Teleprompter
          script={script}
          wpm={wpm}
          onExit={() => setMode('editor')}
        />
      )}
    </AnimatePresence>
  );
}
