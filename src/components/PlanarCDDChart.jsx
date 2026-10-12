import React, { useState, useRef, useMemo } from 'react';

export function PlanarCDDChart({
  cddData,
  title = 'Planar Average Charge Density Difference Δρ̄(z)',
  slabZ = null,
  adsorbateZ = null,
  onInterfaceChange = null,
}) {
  const containerRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [showDeltaQ, setShowDeltaQ] = useState(true);

  const width = 860;
  const height = 420;
  const margin = { top: 35, right: 65, bottom: 50, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  if (!cddData || !cddData.z || cddData.z.length === 0) {
    return null;
  }

  const {
    z,
    deltaRho,
    deltaQ,
    zMin,
    zMax,
    maxAccum,
    maxAccumZ,
    maxDeplet,
    maxDepletZ,
    zInterface,
    netChargeTransfer,
    dipoleDebye,
    workFunctionShiftEV,
  } = cddData;

  const nPoints = z.length;

  // Compute DeltaRho limits (symmetric or padded)
  const maxAbsRho = Math.max(Math.abs(maxAccum), Math.abs(maxDeplet)) * 1.15 || 0.1;
  const yRhoMin = -maxAbsRho;
  const yRhoMax = maxAbsRho;

  // Compute DeltaQ limits
  const maxAbsQ = Math.max(...deltaQ.map(v => Math.abs(v))) * 1.15 || 0.1;
  const yQMin = -maxAbsQ;
  const yQMax = maxAbsQ;

  // Coordinate transforms
  const getX = (val) => {
    if (zMax === zMin) return margin.left;
    return margin.left + ((val - zMin) / (zMax - zMin)) * plotW;
  };

  const getRhoY = (val) => {
    return margin.top + plotH - ((val - yRhoMin) / (yRhoMax - yRhoMin)) * plotH;
  };

  const getQY = (val) => {
    return margin.top + plotH - ((val - yQMin) / (yQMax - yQMin)) * plotH;
  };

  const zeroY = getRhoY(0);

  // Generate SVG path for DeltaRho curve
  const rhoPath = useMemo(() => {
    let d = '';
    for (let i = 0; i < nPoints; i++) {
      const x = getX(z[i]);
      const y = getRhoY(deltaRho[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [z, deltaRho]);

  // Generate SVG area for accumulation (> 0)
  const accumArea = useMemo(() => {
    let d = `M ${getX(z[0]).toFixed(1)} ${zeroY.toFixed(1)}`;
    for (let i = 0; i < nPoints; i++) {
      const x = getX(z[i]);
      const val = Math.max(0, deltaRho[i]);
      const y = getRhoY(val);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${getX(z[nPoints - 1]).toFixed(1)} ${zeroY.toFixed(1)} Z`;
    return d;
  }, [z, deltaRho]);

  // Generate SVG area for depletion (< 0)
  const depletArea = useMemo(() => {
    let d = `M ${getX(z[0]).toFixed(1)} ${zeroY.toFixed(1)}`;
    for (let i = 0; i < nPoints; i++) {
      const x = getX(z[i]);
      const val = Math.min(0, deltaRho[i]);
      const y = getRhoY(val);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${getX(z[nPoints - 1]).toFixed(1)} ${zeroY.toFixed(1)} Z`;
    return d;
  }, [z, deltaRho]);

  // Generate SVG path for DeltaQ curve
  const qPath = useMemo(() => {
    if (!showDeltaQ || !deltaQ) return '';
    let d = '';
    for (let i = 0; i < nPoints; i++) {
      const x = getX(z[i]);
      const y = getQY(deltaQ[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [z, deltaQ, showDeltaQ]);

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
    const rows = ['# z(Angstrom)\tDeltaRho(e/A)\tDeltaQ(e)'];
    for (let i = 0; i < nPoints; i++) {
      rows.push(`${z[i].toFixed(4)}\t${deltaRho[i].toFixed(6)}\t${deltaQ[i].toFixed(6)}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planar_cdd_profile.dat';
    a.click();
    URL.revokeObjectURL(url);
  };

  // X ticks
  const xTicks = useMemo(() => {
    const count = 8;
    const step = (zMax - zMin) / (count - 1);
    const ticks = [];
    for (let i = 0; i < count; i++) ticks.push(zMin + i * step);
    return ticks;
  }, [zMin, zMax]);

  // Y Rho ticks (left)
  const yRhoTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    const step = (yRhoMax - yRhoMin) / (count - 1);
    for (let i = 0; i < count; i++) ticks.push(yRhoMin + i * step);
    return ticks;
  }, [yRhoMin, yRhoMax]);

  // Y Q ticks (right)
  const yQTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    const step = (yQMax - yQMin) / (count - 1);
    for (let i = 0; i < count; i++) ticks.push(yQMin + i * step);
    return ticks;
  }, [yQMin, yQMax]);

  return (
    <div className="planar-cdd-chart" style={{ marginTop: '0.8rem' }}>
      {/* Metrics Highlights Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.6rem',
        marginBottom: '0.8rem',
      }}>
        <div style={{
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Peak Accumulation (+Δρ̄)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#38bdf8', fontFamily: 'monospace' }}>
            +{maxAccum.toFixed(4)} <small style={{ fontSize: '0.72rem' }}>e/Å at z={maxAccumZ.toFixed(2)} Å</small>
          </div>
        </div>

        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Peak Depletion (−Δρ̄)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f87171', fontFamily: 'monospace' }}>
            {maxDeplet.toFixed(4)} <small style={{ fontSize: '0.72rem' }}>e/Å at z={maxDepletZ.toFixed(2)} Å</small>
          </div>
        </div>

        <div style={{
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Net Transferred Charge (Δq)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>
            {netChargeTransfer.toFixed(4)} e
          </div>
        </div>

        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '6px',
          padding: '0.5rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Interface Dipole (Δμ)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fbbf24', fontFamily: 'monospace' }}>
            {dipoleDebye.toFixed(2)} D <small style={{ fontSize: '0.72rem' }}>(ΔΦ ≈ {workFunctionShiftEV.toFixed(2)} eV)</small>
          </div>
        </div>
      </div>

      {/* Controls & Export Bar */}
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
          <label className="toggle" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDeltaQ}
              onChange={e => setShowDeltaQ(e.target.checked)}
            />
            <span className="toggle-label" style={{ fontSize: '0.75rem', color: '#34d399' }}>
              Show Cumulative Charge Transfer ΔQ(z)
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportDAT}
            title="Download profile as 3-column DAT file">
            📥 Download .DAT Profile
          </button>
        </div>
      </div>

      {/* SVG Canvas Mount */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{
          width: '100%',
          position: 'relative',
          background: 'rgba(15, 23, 42, 0.8)',
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

          {yRhoTicks.map(val => (
            <line
              key={`y-grid-${val}`}
              x1={margin.left}
              y1={getRhoY(val)}
              x2={margin.left + plotW}
              y2={getRhoY(val)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2,2"
            />
          ))}

          {/* Zero baseline */}
          <line
            x1={margin.left}
            y1={zeroY}
            x2={margin.left + plotW}
            y2={zeroY}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />

          {/* Interface Position Marker */}
          {zInterface && (
            <g>
              <line
                x1={getX(zInterface)}
                y1={margin.top}
                x2={getX(zInterface)}
                y2={margin.top + plotH}
                stroke="var(--warning, #fbbf24)"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <rect
                x={getX(zInterface) - 28}
                y={margin.top - 20}
                width="56"
                height="18"
                rx="3"
                fill="rgba(251, 191, 36, 0.25)"
                stroke="var(--warning, #fbbf24)"
              />
              <text
                x={getX(zInterface)}
                y={margin.top - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--warning, #fbbf24)"
                fontWeight="bold">
                Interface
              </text>
            </g>
          )}

          {/* Shaded Areas */}
          {/* Blue Accumulation Area */}
          <path d={accumArea} fill="#38bdf8" opacity="0.22" />
          {/* Red Depletion Area */}
          <path d={depletArea} fill="#f87171" opacity="0.22" />

          {/* Solid DeltaRho line */}
          <path d={rhoPath} fill="none" stroke="#38bdf8" strokeWidth="2" />

          {/* Dashed DeltaQ line on secondary axis */}
          {showDeltaQ && qPath && (
            <path
              d={qPath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeDasharray="5,3"
            />
          )}

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
                cy={getRhoY(deltaRho[hoverIdx])}
                r="4"
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth="1.5"
              />
              {showDeltaQ && (
                <circle
                  cx={getX(z[hoverIdx])}
                  cy={getQY(deltaQ[hoverIdx])}
                  r="4"
                  fill="#34d399"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              )}
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

          {/* Left Y Axis Ticks (DeltaRho) */}
          {yRhoTicks.map(val => (
            <g key={`tick-y-rho-${val}`}>
              <line
                x1={margin.left - 5}
                y1={getRhoY(val)}
                x2={margin.left}
                y2={getRhoY(val)}
                stroke="var(--border)"
              />
              <text
                x={margin.left - 8}
                y={getRhoY(val) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#38bdf8">
                {val.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Right Y Axis Ticks (DeltaQ) */}
          {showDeltaQ && yQTicks.map(val => (
            <g key={`tick-y-q-${val}`}>
              <line
                x1={margin.left + plotW}
                y1={getQY(val)}
                x2={margin.left + plotW + 5}
                y2={getQY(val)}
                stroke="var(--border)"
              />
              <text
                x={margin.left + plotW + 8}
                y={getQY(val) + 4}
                textAnchor="start"
                fontSize="11"
                fill="#34d399">
                {val.toFixed(2)}
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
            fill="#38bdf8"
            fontWeight="500"
            transform="rotate(-90)">
            Δρ̄(z) [e / Å] (Planar CDD)
          </text>

          {showDeltaQ && (
            <text
              x={margin.top + plotH / 2}
              y={-(width - 16)}
              textAnchor="middle"
              fontSize="12"
              fill="#34d399"
              fontWeight="500"
              transform="rotate(90)">
              ΔQ(z) [e] (Cumulative Transfer)
            </text>
          )}
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
            <div style={{ color: '#38bdf8' }}>
              Δρ̄(z) = {deltaRho[hoverIdx].toFixed(5)} e/Å
              {deltaRho[hoverIdx] > 0 ? ' (Accumulation)' : ' (Depletion)'}
            </div>
            {showDeltaQ && (
              <div style={{ color: '#34d399' }}>
                ΔQ(z) = {deltaQ[hoverIdx].toFixed(5)} e
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
