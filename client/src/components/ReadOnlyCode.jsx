import Editor from '@monaco-editor/react';
import Spinner from '@/components/Spinner.jsx';
import '@/lib/monaco.js';

/** Read-only Monaco editor (match details). */
export default function ReadOnlyCode({ code, language, path }) {
  return (
    <Editor
      path={path}
      language={language}
      value={code}
      theme="code-duel"
      loading={<Spinner className="size-6 text-emerald-400" />}
      options={{
        readOnly: true,
        domReadOnly: true,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 10, bottom: 10 },
        renderLineHighlight: 'none',
      }}
    />
  );
}
