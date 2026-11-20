import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import Spinner from '@/components/ui/Spinner.jsx';
import { monaco } from '@/lib/monaco.js';

/**
 * Monaco editor. Ctrl/Cmd+Enter → onRun, Ctrl/Cmd+Shift+Enter → onSubmit. The handlers are
 * read through refs so the editor commands always call the latest ones.
 */
export default function CodeEditor({ path, language, value, onChange, onRun, onSubmit }) {
  const handlers = useRef({ onRun, onSubmit });
  useEffect(() => {
    handlers.current = { onRun, onSubmit };
  }, [onRun, onSubmit]);

  function handleMount(editor) {
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => handlers.current.onRun());
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter, () =>
      handlers.current.onSubmit(),
    );
    editor.focus();
    // Automation hook for scripts/docs (dev builds only; stripped from production).
    if (import.meta.env.DEV) window.__codeDuelEditor = editor;
  }

  return (
    <Editor
      path={path}
      language={language}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount}
      theme="code-duel"
      loading={<Spinner className="size-6 text-emerald-400" />}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: language === 'python' ? 4 : 2,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'all',
        smoothScrolling: true,
      }}
    />
  );
}
