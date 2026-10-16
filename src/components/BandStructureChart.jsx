import React, { useState, useRef, useMemo } from 'react';
import { parseBands, analyzeBandStructure, generateDemoBandStructure } from '../parser/bandsParser.js';

export function BandStructureChart({ initialBands = null }) {
  const fileInputRef = useRef(null);

  const [bandsData, setBandsData] = useState(() => initialBands || generateDemoBandStructure('silicon'));
  const [eMin, setEMin] = useState('-6.0');
  const [eMax, setEMax] = useState('6.0');
  const [shiftEf, setShiftEf] = useState(true);
  const [hoverK, setHoverK] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle .bands file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg(`Loading ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseBands(text);
        parsed.title = file.name.replace(/\.[^/.]+$/, '');
        setBandsData(parsed);
        setStatusMsg(`✓ Loaded ${parsed.nband} bands across ${parsed.nk} k-points from ${file.name}`);
      } catch (err) {
        setErrorMsg(`Failed to parse .bands file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Demo presets
  const handleLoadDemo = (key) => {
    const demo = generateDemoBandStructure(key);
    setBandsData(demo);
    setStatusMsg(`✓ Loaded demo band structure: ${demo.title}`);
  };

  // Band analysis (VBM, CBM, Gap)
  const analysis = useMemo(() => {
    if (!bandsData) return null;
    return analyzeBandStructure(bandsData);
  }, [bandsData]);

  // Chart dimensions
  const width = 860;
  const height = 440;
  const margin = { top: 35, right: 35, bottom: 45, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const eminVal = parseFloat(eMin) || -6.0;
  const emaxVal = parseFloat(eMax) || 6.0;

  const kmin = bandsData?.kmin ?? 0;
  const kmax = bandsData?.kmax ?? 1;
  const ef = shiftEf ? (bandsData?.ef ?? 0) : 0;

  const getX = (kVal) => margin.left + ((kVal - kmin) / (kmax - kmin || 1)) * plotW;
  const getY = (eVal) => {
    const shiftedE = eVal - ef;
    return margin.top + plotH - ((shiftedE - eminVal) / (emaxVal - eminVal || 1)) * plotH;
  };

  // Generate SVG path for a single band dispersion curve
  const createBandPath = (energies) => {
    if (!energies || energies.length === 0 || !bandsData?.kDist) return '';
    let d = '';
    const kArr = bandsData.kDist;
    for (let i = 0; i < kArr.length; i++) {
      const x = getX(kArr[i]);
      const y = getY(energies[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  return (
    <div className="band-structure-visualizer" style={{ marginTop: '0.5rem' }}>
      {/* Visualizer Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
        padding: '0.6rem 0.8rem',
        background: 'var(--surface2)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        marginBottom: '0.8rem',
      }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
            📁 Upload .bands File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bands,.out,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Demos:</span>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('silicon')} title="Bulk Silicon Indirect Gap (1.12 eV)">
            💎 Silicon (Indirect)
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('fapbi3')} title="FAPbI3 Perovskite Direct Gap at R (1.55 eV)">
            ☀️ FAPbI₃ (Direct at R)
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('graphene')} title="Graphene Semimetal Dirac Cone at K">
            🧪 Graphene (Dirac Cone)
          </button>
        </div>

        {/* Energy Range Controls */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Energy (eV):</span>
          <input
            type="number"
            step="1.0"
            className="input mono"
            style={{ width: '60px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
            value={eMin}
            onChange={e => setEMin(e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>to</span>
          <input
            type="number"
            step="1.0"
            className="input mono"
            style={{ width: '60px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
            value={eMax}
            onChange={e => setEMax(e.target.value)}
          />
          <label className="toggle" style={{ fontSize: '0.75rem', marginLeft: '0.3rem' }}>
            <input type="checkbox" checked={shiftEf} onChange={e => setShiftEf(e.target.checked)} />
            <span className="toggle-label">E − E_F = 0</span>
          </label>
        </div>
      </div>

      {statusMsg && <div style={{ color: 'var(--success, #10b981)', marginBottom: '0.5rem', fontSize: '0.78rem' }}>{statusMsg}</div>}
      {errorMsg && <div style={{ color: 'var(--error, #ef4444)', marginBottom: '0.5rem', fontSize: '0.78rem' }}>{errorMsg}</div>}

      {/* Main SVG Band Structure Plot */}
      <div style={{
        background: '#0f172a',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        padding: '1rem',
        position: 'relative',
      }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * width;
            if (svgX >= margin.left && svgX <= margin.left + plotW) {
              const kVal = kmin + ((svgX - margin.left) / plotW) * (kmax - kmin);
              setHoverK(parseFloat(kVal.toFixed(3)));
            }
          }}
          onMouseLeave={() => setHoverK(null)}>

          {/* Shaded Valence Band Region (E <= 0) */}
          <rect
            x={margin.left}
            y={getY(ef)}
            width={plotW}
            height={Math.max(0, margin.top + plotH - getY(ef))}
            fill="rgba(51, 65, 85, 0.20)"
          />

          {/* High-Symmetry K-Point Ticks & Vertical Lines */}
          {bandsData?.ticks?.map((t, idx) => {
            const x = getX(t.k);
            return (
              <g key={idx}>
                <line
                  x1={x} y1={margin.top}
                  x2={x} y2={margin.top + plotH}
                  stroke="rgba(148, 163, 184, 0.35)"
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={margin.top + plotH + 18}
                  fill="#e2e8f0"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="sans-serif"
                  textAnchor="middle">
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* Horizontal Fermi Level Line (E = 0) */}
          <line
            x1={margin.left} y1={getY(ef)}
            x2={margin.left + plotW} y2={getY(ef)}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="5,3"
          />
          <text
            x={margin.left + plotW - 6}
            y={getY(ef) - 6}
            fill="#ef4444"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="700"
            textAnchor="end">
            E_F = {bandsData?.ef?.toFixed(3)} eV
          </text>

          {/* Y-Axis Energy Grid Ticks */}
          {[-6, -4, -2, 0, 2, 4, 6].map(eVal => {
            if (eVal < eminVal || eVal > emaxVal) return null;
            const y = getY(ef + eVal);
            return (
              <g key={eVal}>
                <line
                  x1={margin.left} y1={y}
                  x2={margin.left + plotW} y2={y}
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeDasharray="2,2"
                />
                <text
                  x={margin.left - 8}
                  y={y + 3}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end">
                  {eVal > 0 ? `+${eVal}` : eVal}
                </text>
              </g>
            );
          })}

          {/* Band Dispersion Curves */}
          {bandsData?.bandsUp?.map((bEnergies, ib) => {
            const isValence = Math.max(...bEnergies) <= ef + 0.05;
            const strokeColor = isValence ? '#38bdf8' : '#fbbf24';
            const pathD = createBandPath(bEnergies);
            return (
              <path
                key={ib}
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.0"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            );
          })}

          {/* VBM and CBM Indicator Dots */}
          {analysis && !analysis.isMetal && (
            <g>
              {/* VBM Dot */}
              <circle
                cx={getX(analysis.vbmK)}
                cy={getY(analysis.vbm)}
                r="4.5"
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth="1.5"
              />
              {/* CBM Dot */}
              <circle
                cx={getX(analysis.cbmK)}
                cy={getY(analysis.cbm)}
                r="4.5"
                fill="#fbbf24"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Axes Borders */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="1.2"
          />

          {/* Axis Labels */}
          <text
            x={margin.left + plotW / 2}
            y={height - 8}
            fill="#e2e8f0"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle">
            Wavevector k (Brillouin Zone Path)
          </text>
          <text
            x={-height / 2}
            y={18}
            fill="#e2e8f0"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
            transform="rotate(-90)">
            {shiftEf ? 'Energy E − E_F (eV)' : 'Energy (eV)'}
          </text>

          {/* Hover Crosshair */}
          {hoverK !== null && (
            <line
              x1={getX(hoverK)} y1={margin.top}
              x2={getX(hoverK)} y2={margin.top + plotH}
              stroke="#ec4899"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
          )}
        </svg>

        {/* Hover Readout Tooltip */}
        {hoverK !== null && (
          <div style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.4rem 0.65rem',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{ color: '#ec4899', fontWeight: 700 }}>k-distance: {hoverK.toFixed(3)}</div>
          </div>
        )}
      </div>

      {/* Band Structure Analysis Card */}
      {analysis && (
        <div style={{
          marginTop: '0.8rem',
          padding: '0.8rem 1rem',
          background: 'var(--surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.6rem',
        }}>
          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Electronic Nature</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: analysis.isMetal ? '#f59e0b' : '#10b981' }}>
              {analysis.type}
            </div>
          </div>

          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Band Gap (E_g)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: analysis.isMetal ? '#f59e0b' : 'var(--accent)' }}>
              {analysis.isMetal ? '0.000 eV (Metallic)' : `${analysis.bandGap.toFixed(3)} eV (${analysis.isDirect ? 'Direct' : 'Indirect'})`}
            </div>
          </div>

          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>VBM Position</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
              {analysis.vbm.toFixed(3)} eV @ {analysis.vbmLabel}
            </div>
          </div>

          <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>CBM Position</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
              {analysis.cbm.toFixed(3)} eV @ {analysis.cbmLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BandStructureChart;
