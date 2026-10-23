import { useState, useMemo } from 'react';
import { formatDuration } from '../parser/timesParser';

export function TimingAnalysisCard({ timesData, onClear }) {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState('prgTot'); // 'prgTot' | 'calls' | 'name' | 'prgTotFrac'
  const [sortAsc, setSortAsc] = useState(false);

  if (!timesData) return null;

  const {
    numNodes,
    busiestNode,
    refNode,
    wallTimeSec,
    wallTimeFormatted,
    calcTime,
    commTime,
    totTime,
    cpuTimeSumFormatted,
    cpuTimeNodeFormatted,
    routines,
  } = timesData;

  // Filter & sort routines
  const sortedRoutines = useMemo(() => {
    return (routines || [])
      .filter(r => !filterQuery || r.name.toLowerCase().includes(filterQuery.toLowerCase()))
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'prgTot') cmp = b.prgTot - a.prgTot;
        else if (sortBy === 'calls') cmp = b.calls - a.calls;
        else if (sortBy === 'prgTotFrac') cmp = b.prgTotFrac - a.prgTotFrac;
        else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        return sortAsc ? -cmp : cmp;
      });
  }, [routines, filterQuery, sortBy, sortAsc]);

  // Top consumers excluding 'siesta' and 'IterGeom'
  const topBreakdown = useMemo(() => {
    const total = routines.find(r => r.name.toLowerCase() === 'siesta')?.prgTot ||
                  routines.find(r => r.name.toLowerCase() === 'itergeom')?.prgTot ||
                  totTime?.myNode || 1;
    return routines
      .filter(r => !['siesta', 'itergeom'].includes(r.name.toLowerCase()))
      .sort((a, b) => b.prgTot - a.prgTot)
      .slice(0, 8)
      .map(r => ({
        ...r,
        pct: total > 0 ? (r.prgTot / total) * 100 : 0,
      }));
  }, [routines, totTime]);

  const parallelEfficiency = useMemo(() => {
    if (!calcTime?.avg || !calcTime?.myNode) return null;
    const eff = (calcTime.avg / calcTime.myNode) * 100;
    return eff.toFixed(1);
  }, [calcTime]);

  return (
    <div className="subsection" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <div className="subsection-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⏱️</span> Execution Timings, CPU &amp; Wall-Time Accounting (TIMES Report)
          </div>
          <span className="hint" style={{ fontSize: '0.74rem' }}>
            SIESTA Section 6.29: Parallel timer breakdown, total elapsed wall-clock time, node load-balancing, and per-routine profiling
          </span>
        </div>
        {onClear && (
          <button type="button" className="btn btn-xs btn-secondary" onClick={onClear} style={{ color: 'var(--error, #ef4444)' }}>
            ✕ Clear Timing
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {/* Wall Time */}
        <div className="slab-tool-card" style={{ padding: '0.65rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Wall-Clock Time</span>
            <span>⌛</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {wallTimeFormatted || (wallTimeSec ? `${wallTimeSec.toFixed(1)}s` : 'N/A')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {wallTimeSec ? `${wallTimeSec.toLocaleString()} seconds` : ''}
          </div>
        </div>

        {/* Total CPU Time across all nodes */}
        <div className="slab-tool-card" style={{ padding: '0.65rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Core CPU Time</span>
            <span>⚡</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--fg)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {cpuTimeSumFormatted || 'N/A'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            Sum over all {numNodes ?? '?'} MPI nodes
          </div>
        </div>

        {/* MPI Node Setup & Load Balancing */}
        <div className="slab-tool-card" style={{ padding: '0.65rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>MPI Nodes / Busiest</span>
            <span>🖥️</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {numNodes != null ? `${numNodes} Nodes` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            Busiest node: {busiestNode ?? refNode ?? 'Node-0'}
          </div>
        </div>

        {/* Load Balancing Ratio / Avg/Max */}
        <div className="slab-tool-card" style={{ padding: '0.65rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Load Balance (Avg/Max)</span>
            <span>⚖️</span>
          </div>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            fontFamily: 'monospace',
            marginTop: '0.2rem',
            color: (calcTime?.avgMax || 1) >= 0.9 ? 'var(--success, #10b981)' : '#f59e0b',
          }}>
            {calcTime?.avgMax != null ? `${(calcTime.avgMax * 100).toFixed(1)}%` : parallelEfficiency ? `${parallelEfficiency}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {calcTime?.avgMax != null && calcTime.avgMax >= 0.95 ? '✓ Excellent parallel balance' : 'Node skew / waiting time'}
          </div>
        </div>
      </div>

      {/* Routine Profiling Visual Bar Chart */}
      {topBreakdown.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.85rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--fg)', display: 'flex', justifyContent: 'space-between' }}>
            <span>📊 Top Computational Bottlenecks (Where CPU Time Was Spent)</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>% of total runtime</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {topBreakdown.map((r, i) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem' }}>
                <span style={{ width: '110px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--fg)' }}>
                  {r.name}
                </span>
                <div style={{ flex: 1, background: '#1e293b', height: '14px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(2, r.pct))}%`,
                      background: i === 0 ? 'var(--accent)' : i === 1 ? '#38bdf8' : i === 2 ? '#34d399' : i === 3 ? '#fbbf24' : '#a78bfa',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <span style={{ width: '60px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg)' }}>
                  {r.pct.toFixed(1)}%
                </span>
                <span style={{ width: '85px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--muted)', fontSize: '0.7rem' }}>
                  {formatDuration(r.prgTot)}
                </span>
                <span style={{ width: '70px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--muted)', fontSize: '0.68rem' }}>
                  {r.calls.toLocaleString()} calls
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routine Detail Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.85rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg)' }}>
            📋 Detailed Program Routine Timing Table ({sortedRoutines.length} routines)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Filter routine (e.g. IterSCF, diagon)..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="input"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', width: '210px' }}
            />
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => {
                const text = sortedRoutines.map(r =>
                  `${r.name.padEnd(16)} calls=${String(r.calls).padStart(7)}  time=${r.prgTot.toFixed(3)}s (${(r.prgTotFrac*100).toFixed(2)}%)`
                ).join('\n');
                navigator.clipboard.writeText(text);
              }}
              title="Copy table to clipboard">
              📋 Copy
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'monospace', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0b111e', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                <th style={{ padding: '0.4rem 0.6rem', cursor: 'pointer' }} onClick={() => { setSortBy('name'); setSortAsc(!sortAsc); }}>
                  Program Routine {sortBy === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => { setSortBy('calls'); setSortAsc(!sortAsc); }}>
                  Calls {sortBy === 'calls' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => { setSortBy('prgTot'); setSortAsc(!sortAsc); }}>
                  Total CPU Time {sortBy === 'prgTot' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => { setSortBy('prgTotFrac'); setSortAsc(!sortAsc); }}>
                  % of Total {sortBy === 'prgTotFrac' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>
                  Comm Time
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>
                  Load Bal (Avg/Max)
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRoutines.map((r, i) => (
                <tr
                  key={r.name + i}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                  <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600, color: 'var(--fg)' }}>
                    {r.name}
                  </td>
                  <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--muted)' }}>
                    {r.calls.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                    {r.prgTot.toFixed(3)}s ({formatDuration(r.prgTot)})
                  </td>
                  <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 600, color: r.prgTotFrac > 0.1 ? 'var(--warning, #f59e0b)' : 'var(--fg)' }}>
                    {(r.prgTotFrac * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--muted)' }}>
                    {r.prgCom.toFixed(3)}s
                  </td>
                  <td style={{
                    padding: '0.35rem 0.6rem',
                    textAlign: 'right',
                    color: r.nodAvgMax >= 0.95 ? 'var(--success, #10b981)' : r.nodAvgMax < 0.6 ? '#ef4444' : 'var(--fg)',
                  }}>
                    {r.nodAvgMax.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
