/**
 * Self-hosted Monaco: bundled by Vite instead of @monaco-editor/react's default CDN loader,
 * so the editor works offline and doesn't depend on a third-party host.
 * Imported only by the (lazy-loaded) practice page.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

monaco.editor.defineTheme('code-duel', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0c0c0f', // between zinc-950 and zinc-900
    'editor.lineHighlightBackground': '#18181b',
    'editorLineNumber.foreground': '#52525b',
    'editorGutter.background': '#0c0c0f',
  },
});

loader.config({ monaco });

export { monaco };
