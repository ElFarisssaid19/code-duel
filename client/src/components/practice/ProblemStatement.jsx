import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import TestInput from '@/components/practice/TestInput.jsx';
import ValueBlock from '@/components/practice/ValueBlock.jsx';
import { formatValue } from '@/components/practice/params.js';
import { renderMarkdown } from '@/lib/markdown.js';

/** Title, difficulty, markdown statement and sample tests (practice and duels). */
export default function ProblemStatement({ problem, params }) {
  return (
    <div className="space-y-6 p-5 lg:p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">{problem.title}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <DifficultyBadge difficulty={problem.difficulty} />
          <span>Time limit: {problem.timeLimitMs} ms per test</span>
        </div>
      </div>

      {/* Sanitized with DOMPurify in renderMarkdown */}
      <div
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.description) }}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Sample tests</h2>
        {problem.samples.map((sample) => (
          <div
            key={sample.index}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <p className="text-xs font-medium text-zinc-400">Case {sample.index + 1}</p>
            <TestInput input={sample.input} params={params} />
            <ValueBlock label="Expected">{formatValue(sample.expected)}</ValueBlock>
          </div>
        ))}
      </section>
    </div>
  );
}
