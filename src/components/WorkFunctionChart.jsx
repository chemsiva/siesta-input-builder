import React, { useState, useRef, useMemo } from 'react';

export function WorkFunctionChart({
  potData,
  title = 'Electrostatic Potential Profile & Work Function (Φ)',
  onVacRangeChange = null,
}) {
  const containerRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const width = 860;
  const height = 420;
  const margin = { top: 35, right: 35, bottom: 50, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  if (!potData || !potData.z || potData.z.length === 0) {
    return null;
  }

  const {
    z,
    vPlanar,
    zMin,
    zMax,
    minV,
    maxV,
    vacZMin,
    vacZMax,
    vVacuum,
    eFermi,
    workFunction,
    isDipolar,
    vVacTop,
    vVacBottom,
    deltaV_dipole,
    phiTop,
    phiBottom,
  } = potData;

  const nPoints = z.length;

  // Compute Y-axis bounds (include EF and V_vac with margin)
  const yLow = Math.min(minV, eFermi) * 1.08;
  const yHigh = Math.max(maxV, vVacuum) + Math.abs(vVacuum - eFermi) * 0.15 + 1.0;

  // Coordinate transforms
  const getX = (val) => {
    if (zMax === zMin) return margin.left;
    return margin.left + ((val - zMin) / (zMax - zMin)) * plotW;
  };

  const getY = (val) => {
    if (yHigh === yLow) return margin.top + plotH / 2;
    return margin.top + plotH - ((val - yLow) / (yHigh - yLow)) * plotH;
  };

  const efY = getY(eFermi);
  const vVacY = getY(vVacuum);
  const vacXStart = getX(vacZMin);
  const vacXEnd = getX(vacZMax);

  // Generate SVG path for V_bar(z) curve
  const potPath = useMemo(() => {
    let d = '';
    for (let i = 0; i < nPoints; i++) {
      const x = getX(z[i]);
      const y = getY(vPlanar[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [z, vPlanar, yLow, yHigh]);

  // Mouse hover
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < margin.left || svgX > margin.left + plotW) {
      setHoverIdx(null);
      return;
    }

    const ratio = (svgX - margin.left) / plotW;
    const targetZ = zMin + ratio * (zMax - zMin);

    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < nPoints; i++) {
      const diff = Math.abs(z[i] - targetZ);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }
    setHoverIdx(bestIdx);
  };

  // Export .DAT file
  const handleExportDAT = () => {
    const rows = ['# z(Angstrom)\tV_planar(eV)\tV_rel_EF(eV)'];
    for (let i = 0; i < nPoints; i++) {
      rows.push(`${z[i].toFixed(4)}\t${vPlanar[i].toFixed(6)}\t${(vPlanar[i] - eFermi).toFixed(6)}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'potential_profile.dat';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Ticks
  const xTicks = useMemo(() => {
    const count = 8;
    const step = (zMax - zMin) / (count - 1);
    const ticks = [];
    for (let i = 0; i < count; i++) ticks.push(zMin + i * step);
    return ticks;
  }, [zMin, zMax]);

  const yTicks = useMemo(() => {
    const count = 7;
    const step = (yHigh - yLow) / (count - 1);
    const ticks = [];
    for (let i = 0; i < count; i++) ticks.push(yLow + i * step);
    return ticks;
  }, [yLow, yHigh]);

  return (
    <div className="work-function-chart" style={{ marginTop: '0.8rem' }}>
      {/* Metric Highlights Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.6rem',
        marginBottom: '0.8rem',
      }}>
        {/* Work Function Phi */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Work Function (Φ = V_vac − E_F)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
            {workFunction.toFixed(3)} <small style={{ fontSize: '0.8rem' }}>eV</small>
          </div>
        </div>

        {/* Vacuum Level */}
        <div style={{
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Vacuum Level (V_vac)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
            {vVacuum.toFixed(3)} <small style={{ fontSize: '0.75rem' }}>eV</small>
          </div>
        </div>

        {/* Fermi Energy */}
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Fermi Energy (E_F)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
            {eFermi.toFixed(3)} <small style={{ fontSize: '0.75rem' }}>eV</small>
          </div>
        </div>

        {/* Asymmetric / Dipolar info */}
        {isDipolar ? (
          <div style={{
            background: 'rgba(167, 139, 250, 0.1)',
            border: '1px solid rgba(167, 139, 250, 0.3)',
            borderRadius: '6px',
            padding: '0.5rem 0.7rem',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Dipole Step (ΔV_dipole)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>
              {deltaV_dipole.toFixed(3)} eV <small style={{ fontSize: '0.72rem' }}>(Φ_top: {phiTop.toFixed(2)} | Φ_bot: {phiBottom.toFixed(2)})</small>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.5rem 0.7rem',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Slab Symmetry</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)', marginTop: '0.2rem' }}>
              ✓ Symmetric (No dipole step)
            </div>
          </div>
        )}
      </div>

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong style={{ fontSize: '0.92rem', color: 'var(--fg)' }}>{title}</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Vacuum window: [{vacZMin.toFixed(1)}, {vacZMax.toFixed(1)}] Å
          </span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExportDAT}
          title="Download 2-column DAT profile">
          📥 Download .DAT Profile
        </button>
      </div>

      {/* SVG Canvas Mount */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{
          width: '100%',
          position: 'relative',
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          cursor: 'crosshair',
        }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {xTicks.map(val => (
            <line
              key={`x-grid-${val}`}
              x1={getX(val)}
              y1={margin.top}
              x2={getX(val)}
              y2={margin.top + plotH}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2,2"
            />
          ))}

          {yTicks.map(val => (
            <line
              key={`y-grid-${val}`}
              x1={margin.left}
              y1={getY(val)}
              x2={margin.left + plotW}
              y2={getY(val)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2,2"
            />
          ))}

          {/* Vacuum Region Shaded Vertical Window */}
          <rect
            x={vacXStart}
            y={margin.top}
            width={Math.max(1, vacXEnd - vacXStart)}
            height={plotH}
            fill="#34d399"
            opacity="0.08"
          />

          {/* Work Function Energy Barrier Shaded Band between EF and V_vac */}
          <rect
            x={margin.left}
            y={Math.min(vVacY, efY)}
            width={plotW}
            height={Math.abs(efY - vVacY)}
            fill="#38bdf8"
            opacity="0.12"
          />

          {/* Fermi Level Horizontal Line (EF) */}
          <g>
            <line
              x1={margin.left}
              y1={efY}
              x2={margin.left + plotW}
              y2={efY}
              stroke="#fbbf24"
              strokeWidth="1.8"
              strokeDasharray="5,3"
            />
            <rect
              x={margin.left + 8}
              y={efY - 18}
              width="60"
              height="16"
              rx="3"
              fill="rgba(251, 191, 36, 0.25)"
              stroke="#fbbf24"
            />
            <text
              x={margin.left + 38}
              y={efY - 6}
              textAnchor="middle"
              fontSize="10"
              fill="#fbbf24"
              fontWeight="bold">
              E_F ({eFermi.toFixed(2)} eV)
            </text>
          </g>

          {/* Vacuum Level Horizontal Line (V_vac) */}
          <g>
            <line
              x1={margin.left}
              y1={vVacY}
              x2={margin.left + plotW}
              y2={vVacY}
              stroke="#34d399"
              strokeWidth="2"
              strokeDasharray="5,3"
            />
            <rect
              x={margin.left + plotW - 110}
              y={vVacY - 18}
              width="100"
              height="16"
              rx="3"
              fill="rgba(52, 211, 153, 0.25)"
              stroke="#34d399"
            />
            <text
              x={margin.left + plotW - 60}
              y={vVacY - 6}
              textAnchor="middle"
              fontSize="10"
              fill="#34d399"
              fontWeight="bold">
              V_vac ({vVacuum.toFixed(2)} eV)
            </text>
          </g>

          {/* Work Function Double-Headed Arrow Bracket */}
          <g>
            <line
              x1={margin.left + plotW / 2}
              y1={efY}
              x2={margin.left + plotW / 2}
              y2={vVacY}
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <circle cx={margin.left + plotW / 2} cy={efY} r="3" fill="#38bdf8" />
            <circle cx={margin.left + plotW / 2} cy={vVacY} r="3" fill="#38bdf8" />
            <rect
              x={margin.left + plotW / 2 + 10}
              y={(efY + vVacY) / 2 - 12}
              width="86"
              height="22"
              rx="4"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#38bdf8"
            />
            <text
              x={margin.left + plotW / 2 + 53}
              y={(efY + vVacY) / 2 + 3}
              textAnchor="middle"
              fontSize="11"
              fill="#38bdf8"
              fontWeight="bold">
              Φ = {workFunction.toFixed(2)} eV
            </text>
          </g>

          {/* Potential Curve V_bar(z) */}
          <path d={potPath} fill="none" stroke="#e2e8f0" strokeWidth="2.2" />

          {/* Hover crosshair */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={getX(z[hoverIdx])}
                y1={margin.top}
                x2={getX(z[hoverIdx])}
                y2={margin.top + plotH}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle
                cx={getX(z[hoverIdx])}
                cy={getY(vPlanar[hoverIdx])}
                r="4.5"
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Axes Box */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
          />

          {/* X Axis Ticks */}
          {xTicks.map(val => (
            <g key={`tick-x-${val}`}>
              <line
                x1={getX(val)}
                y1={margin.top + plotH}
                x2={getX(val)}
                y2={margin.top + plotH + 5}
                stroke="var(--border)"
              />
              <text
                x={getX(val)}
                y={margin.top + plotH + 18}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted)">
                {val.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Y Axis Ticks */}
          {yTicks.map(val => (
            <g key={`tick-y-${val}`}>
              <line
                x1={margin.left - 5}
                y1={getY(val)}
                x2={margin.left}
                y2={getY(val)}
                stroke="var(--border)"
              />
              <text
                x={margin.left - 8}
                y={getY(val) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted)">
                {val.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Axis Titles */}
          <text
            x={margin.left + plotW / 2}
            y={height - 12}
            textAnchor="middle"
            fontSize="12"
            fill="var(--fg)"
            fontWeight="500">
            z Coordinate along Surface Normal (Å)
          </text>

          <text
            x={-(margin.top + plotH / 2)}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fill="var(--fg)"
            fontWeight="500"
            transform="rotate(-90)">
            Electrostatic Potential V̄(z) [eV]
          </text>
        </svg>

        {/* Hover Tooltip */}
        {hoverIdx !== null && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.45rem 0.75rem',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <div style={{ color: 'var(--fg)', fontWeight: 'bold', marginBottom: '0.2rem' }}>
              z = {z[hoverIdx].toFixed(3)} Å
            </div>
            <div style={{ color: '#e2e8f0' }}>
              V̄(z) = {vPlanar[hoverIdx].toFixed(4)} eV
            </div>
            <div style={{ color: '#38bdf8' }}>
              Rel to E_F = {(vPlanar[hoverIdx] - eFermi).toFixed(4)} eV
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
