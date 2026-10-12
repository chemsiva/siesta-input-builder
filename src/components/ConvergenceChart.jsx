import { useState } from 'react';

/**
 * Interactive SVG Convergence & Thermodynamic Chart.
 * Supports:
 * - Total Energy (E_tot / E_KS)
 * - Temperature (K)
 * - Pressure (kBar / GPa)
 * - Cell Volume (Å³)
 * - Hover crosshair with exact readout
 */
export function ConvergenceChart({ mdeData, scfData }) {
  const [activeMetric, setActiveMetric] = useState('energy');
  const [hoverIndex, setHoverIndex] = useState(null);

  const hasMDE = mdeData && mdeData.steps && mdeData.steps.length > 0;
  const hasSCF = scfData && scfData.length > 0;

  if (!hasMDE && !hasSCF) {
    return (
      <div className="hint" style={{ padding: '2rem', textAlign: 'center' }}>
        No convergence data available. Upload an .MDE file or .out log to view graphs.
      </div>
    );
  }

  // Determine series to plot
  let series = [];
  let yLabel = '';
  let unit = '';
  let color = 'var(--accent, #6366f1)';

  if (activeMetric === 'energy' && hasMDE) {
    series = mdeData.steps.map(s => ({ x: s.step, y: s.eTot }));
    yLabel = 'Total Energy (E_tot)';
    unit = 'eV';
    color = '#10b981'; // Green
  } else if (activeMetric === 'energy_rel' && hasMDE) {
    const e0 = mdeData.steps[0].eTot;
    series = mdeData.steps.map(s => ({ x: s.step, y: s.eTot - e0 }));
    yLabel = 'Relative Energy (ΔE)';
    unit = 'eV';
    color = '#06b6d4'; // Cyan
  } else if (activeMetric === 'temp' && hasMDE) {
    series = mdeData.steps.map(s => ({ x: s.step, y: s.temp }));
    yLabel = 'Temperature';
    unit = 'K';
    color = '#f59e0b'; // Amber
  } else if (activeMetric === 'pressure' && hasMDE) {
    series = mdeData.steps.map(s => ({ x: s.step, y: s.pressure }));
    yLabel = 'Pressure';
    unit = 'kBar';
    color = '#ec4899'; // Pink
  } else if (activeMetric === 'volume' && hasMDE) {
    series = mdeData.steps.map(s => ({ x: s.step, y: s.volume }));
    yLabel = 'Cell Volume';
    unit = 'Å³';
    color = '#8b5cf6'; // Purple
  } else if (activeMetric === 'scf_dh' && hasSCF) {
    series = scfData.map((s, idx) => ({ x: idx + 1, y: s.dHmax ?? s.dDmax ?? 0 }));
    yLabel = 'Max Hamiltonian Change (dHmax)';
    unit = 'eV';
    color = '#f97316'; // Orange
  }

  if (series.length === 0) return null;

  // Chart dimensions
  const width = 640;
  const height = 260;
  const padL = 65;
  const padR = 25;
  const padT = 25;
  const padB = 35;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yVals = series.map(d => d.y);
  const minY = Math.min(...yVals);
  const maxY = Math.max(...yVals);
  const ySpan = maxY - minY === 0 ? 1 : maxY - minY;
  const yMinPadded = minY - ySpan * 0.05;
  const yMaxPadded = maxY + ySpan * 0.05;

  const xVals = series.map(d => d.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const xSpan = maxX - minX === 0 ? 1 : maxX - minX;

  const getX = (val) => padL + ((val - minX) / xSpan) * plotW;
  const getY = (val) => padT + (1 - (val - yMinPadded) / (yMaxPadded - yMinPadded)) * plotH;

  const pointsStr = series.map(d => `${getX(d.x).toFixed(1)},${getY(d.y).toFixed(1)}`).join(' ');

  // Y-axis grid ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map(frac => {
    const val = yMinPadded + frac * (yMaxPadded - yMinPadded);
    const yPos = getY(val);
    return { val, yPos };
  });

  const activePoint = hoverIndex !== null && series[hoverIndex] ? series[hoverIndex] : null;

  return (
    <div className="convergence-chart-container" style={{ marginTop: '0.5rem' }}>
      {/* Metric Selector Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {hasMDE && (
          <>
            <button
              className={`btn btn-sm ${activeMetric === 'energy' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveMetric('energy'); setHoverIndex(null); }}>
              ⚡ E_tot
            </button>
            <button
              className={`btn btn-sm ${activeMetric === 'energy_rel' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveMetric('energy_rel'); setHoverIndex(null); }}>
              📉 ΔE (Relative)
            </button>
            <button
              className={`btn btn-sm ${activeMetric === 'temp' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveMetric('temp'); setHoverIndex(null); }}>
              🌡️ Temperature
            </button>
            <button
              className={`btn btn-sm ${activeMetric === 'pressure' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveMetric('pressure'); setHoverIndex(null); }}>
              💨 Pressure
            </button>
            <button
              className={`btn btn-sm ${activeMetric === 'volume' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveMetric('volume'); setHoverIndex(null); }}>
              📦 Volume
            </button>
          </>
        )}
        {hasSCF && (
          <button
            className={`btn btn-sm ${activeMetric === 'scf_dh' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveMetric('scf_dh'); setHoverIndex(null); }}>
            🔄 SCF Convergence
          </button>
        )}
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: 'var(--surface, #1e293b)', borderRadius: '6px', border: '1px solid var(--border)' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: '480px', display: 'block' }}
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (width / rect.width);
            if (mouseX >= padL && mouseX <= width - padR) {
              const xFrac = (mouseX - padL) / plotW;
              const approxIdx = Math.round(xFrac * (series.length - 1));
              const clamped = Math.max(0, Math.min(series.length - 1, approxIdx));
              setHoverIndex(clamped);
            }
          }}>
          {/* Horizontal Gridlines & Y-labels */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padL}
                y1={t.yPos}
                x2={width - padR}
                y2={t.yPos}
                stroke="var(--border)"
                strokeDasharray="3 3"
                opacity="0.4"
              />
              <text
                x={padL - 8}
                y={t.yPos + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted, #94a3b8)"
                fontFamily="monospace">
                {t.val.toFixed(Math.abs(t.val) < 1 ? 4 : (Math.abs(t.val) < 100 ? 2 : 1))}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="var(--border)" strokeWidth="1" />
          <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="var(--border)" strokeWidth="1" />

          {/* Axis Labels */}
          <text
            x={padL + plotW / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--muted)"
            fontFamily="monospace">
            Step / Iteration
          </text>
          <text
            x={12}
            y={padT + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${padT + plotH / 2})`}
            fontSize="10"
            fill="var(--muted)"
            fontFamily="monospace">
            {yLabel} ({unit})
          </text>

          {/* Main Data Line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pointsStr}
          />

          {/* Interactive Hover Crosshair */}
          {activePoint && (
            <g>
              <line
                x1={getX(activePoint.x)}
                y1={padT}
                x2={getX(activePoint.x)}
                y2={height - padB}
                stroke="var(--fg, #fff)"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <circle
                cx={getX(activePoint.x)}
                cy={getY(activePoint.y)}
                r="4.5"
                fill={color}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Readout Badge */}
        {activePoint && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: 'var(--fg)',
            pointerEvents: 'none',
          }}>
            <strong>Step {activePoint.x}:</strong> {activePoint.y.toFixed(5)} {unit}
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      {hasMDE && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.6rem' }}>
          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Initial Energy</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
              {mdeData.summary.eInitial.toFixed(2)} eV
            </div>
          </div>
          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Final Energy</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
              {mdeData.summary.eFinal.toFixed(2)} eV
            </div>
          </div>
          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>ΔE (Relaxation)</div>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: mdeData.summary.deltaE < 0 ? 'var(--success, #10b981)' : 'var(--warning)',
            }}>
              {mdeData.summary.deltaE > 0 ? '+' : ''}{mdeData.summary.deltaE.toFixed(4)} eV
            </div>
          </div>
          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Volume Change</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
              {mdeData.summary.deltaVolPercent > 0 ? '+' : ''}{mdeData.summary.deltaVolPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
