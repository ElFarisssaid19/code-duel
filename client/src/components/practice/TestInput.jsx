import ValueBlock from '@/components/practice/ValueBlock.jsx';
import { formatValue } from '@/components/practice/params.js';

/** Function arguments, one per line, labelled with the parameter names when known. */
export default function TestInput({ input, params }) {
  return (
    <ValueBlock label="Input">
      {input.map((arg, i) => `${params[i] ?? `arg${i + 1}`} = ${formatValue(arg)}`).join('\n')}
    </ValueBlock>
  );
}
