import { useMemo } from 'react';
import { useFDFStore } from '../store/fdfStore';

export function LivePreview() {
  const state = useFDFStore(s => s);
  const text = useMemo(() => {
    try { return state.getFDFText(); } catch { return '# Error generating preview'; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.system, state.structure, state.dft, state.basis,
    state.scf, state.kpoints, state.output, state.md
  ]);

  const lines = text.split('\n');

  return (
    <div className="preview-pane">
      <div className="preview-header">
        <span className="preview-title">📄 Live .fdf Preview</span>
        <span className="preview-lines">{lines.length} lines</span>
      </div>
      <pre className="preview-content">
        {lines.map((l, i) => (
          <div key={i} className={`preview-line ${l.startsWith('#') ? 'comment' : l.startsWith('%') ? 'block-kw' : ''}`}>
            <span className="line-no">{i+1}</span>
            <span className="line-text">{l}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
