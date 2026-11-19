import { useEffect } from 'react';

/**
 * Ctrl/Cmd+Enter → run, Ctrl/Cmd+Shift+Enter → submit, when the focus is outside the editor
 * (the Monaco editor registers its own commands).
 */
export function useRunShortcuts(run, submit) {
  useEffect(() => {
    function onKeyDown(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      if (event.target.closest?.('.monaco-editor')) return;
      event.preventDefault();
      if (event.shiftKey) submit();
      else run();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run, submit]);
}
