import React, { useState, useRef, useMemo } from 'react';

/**
 * Standard Presets for Band Alignment Diagrams
 */
export const BAND_PRESETS = [
  {
    id: 'user_screenshot',
    name: '📸 Lead-Free Double Perovskites (From Attached Image)',
    description: 'Device architecture: FTO / TiO2 / Cs2TiBr6, Cs2TiI2Br4, Cs2ScAgI6, Cs2TiI6, Cs2AgBiBr6, Cs2PdBr6 / CuSbS2 / Pt / Ir',
    layers: [
      { name: 'FTO', type: 'electrode', cbm: -3.50, vbm: -7.50, fermi: -4.40, color: '#9ba37e' },
      { name: 'TiO₂', type: 'etl', cbm: -3.36, vbm: -7.56, fermi: -4.20, color: '#0284c7' },
      { name: 'Cs₂TiBr₆', type: 'absorber', cbm: -1.60, vbm: -6.07, fermi: -3.83, color: '#d946ef' },
      { name: 'Cs₂TiI₂Br₄', type: 'absorber', cbm: -1.38, vbm: -5.38, fermi: -3.38, color: '#e879f9' },
      { name: 'Cs₂ScAgI₆', type: 'absorber', cbm: -1.55, vbm: -5.74, fermi: -3.65, color: '#c084fc' },
      { name: 'Cs₂TiI₆', type: 'absorber', cbm: -1.65, vbm: -5.55, fermi: -3.60, color: '#d946ef' },
      { name: 'Cs₂AgBiBr₆', type: 'absorber', cbm: -2.05, vbm: -6.24, fermi: -4.15, color: '#c084fc' },
      { name: 'Cs₂PdBr₆', type: 'absorber', cbm: -1.70, vbm: -5.90, fermi: -3.80, color: '#e879f9' },
      { name: 'CuSbS₂', type: 'htl', cbm: -1.58, vbm: -5.78, fermi: -4.80, color: '#d4b996' },
      { name: 'Pt', type: 'metal', cbm: -3.35, vbm: -5.65, fermi: -5.65, isMetal: true, color: '#dc2626' },
      { name: 'Ir', type: 'metal', cbm: -3.00, vbm: -5.27, fermi: -5.27, isMetal: true, color: '#b91c1c' },
    ],
  },
  {
    id: 'fapbi3_solar_cell',
    name: '☀️ Standard Perovskite Solar Cell (FAPbI₃ / SnO₂ / Spiro)',
    description: 'FTO / SnO2 (ETL) / FAPbI3 (Absorber) / Spiro-OMeTAD (HTL) / Au (Electrode)',
    layers: [
      { name: 'FTO', type: 'electrode', cbm: -4.00, vbm: -7.60, fermi: -4.40, color: '#9ba37e' },
      { name: 'SnO₂', type: 'etl', cbm: -4.10, vbm: -7.80, fermi: -4.30, color: '#0ea5e9' },
      { name: 'FAPbI₃', type: 'absorber', cbm: -3.95, vbm: -5.45, fermi: -4.70, color: '#ec4899' },
      { name: 'Spiro-OMeTAD', type: 'htl', cbm: -2.05, vbm: -5.15, fermi: -5.00, color: '#f59e0b' },
      { name: 'Au', type: 'metal', cbm: -3.20, vbm: -5.10, fermi: -5.10, isMetal: true, color: '#eab308' },
    ],
  },
  {
    id: 'type2_heterojunction',
    name: '🔬 Type-II Staggered Heterojunction (MoS₂ / WS₂)',
    description: 'Ideal for spatial charge separation of photogenerated electrons and holes',
    layers: [
      { name: 'MoS₂', type: 'absorber', cbm: -4.25, vbm: -6.15, fermi: -4.80, color: '#38bdf8' },
      { name: 'WS₂', type: 'absorber', cbm: -3.90, vbm: -5.75, fermi: -4.60, color: '#818cf8' },
    ],
  },
  {
    id: 'water_splitting',
    name: '💧 Photocatalytic Water Splitting (TiO₂ / g-C₃N₄ / BiVO₄)',
    description: 'Shows band positions with respect to H+/H2 (-4.44 eV) and O2/H2O (-5.67 eV) redox potentials',
    layers: [
      { name: 'g-C₃N₄', type: 'absorber', cbm: -3.32, vbm: -6.02, fermi: -4.30, color: '#a855f7' },
      { name: 'TiO₂', type: 'absorber', cbm: -4.20, vbm: -7.40, fermi: -4.50, color: '#0ea5e9' },
      { name: 'BiVO₄', type: 'absorber', cbm: -3.85, vbm: -6.25, fermi: -4.60, color: '#f59e0b' },
    ],
  },
];

export function BandAlignmentChart({
  layers = [],
  title = 'Energy Band Alignment Diagram',
  showCarrierArrows = true,
  showRedoxPotentials = false,
  energyScale = 'vacuum',
  render3D = true,
}) {
  const containerRef = useRef(null);
  const [hoverLayer, setHoverLayer] = useState(null);

  // Scaled dimensions so everything fits in one view without scrolling
  const width = 960;
  const height = 480;
  const margin = { top: 60, right: 35, bottom: 55, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Energy bounds: 0.0 down to -9.0 eV (matches literature)
  const eMin = -9.0;
  const eMax = 0.0;

  // Coordinate transforms
  const getY = (energy) => {
    return margin.top + ((eMax - energy) / (eMax - eMin)) * plotH;
  };

  // Block positions along X
  const numLayers = layers.length;
  const colW = numLayers > 0 ? Math.max(40, Math.min(64, (plotW - (numLayers + 1) * 10) / numLayers)) : 55;
  const totalColsW = numLayers * colW;
  const gap = numLayers > 1 ? (plotW - totalColsW) / (numLayers + 1) : 20;

  const getBlockX = (index) => {
    return margin.left + gap + index * (colW + gap);
  };

  // Water redox lines vs vacuum (pH = 0)
  const eH2_vac = -4.44;
  const eO2_vac = -5.67;

  // Export SVG file
  const handleExportSVG = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'band_alignment_diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV Data
  const handleExportCSV = () => {
    const headers = ['Layer_Name', 'Type', 'CBM_eV', 'VBM_eV', 'Bandgap_eV', 'Fermi_eV', 'WorkFunction_eV'];
    const rows = [headers.join(',')];
    layers.forEach(l => {
      const eg = l.isMetal ? 0 : Math.abs(l.cbm - l.vbm);
      const wf = l.fermi ? Math.abs(l.fermi) : Math.abs(l.vbm);
      rows.push(`"${l.name}","${l.type || 'layer'}",${l.cbm.toFixed(3)},${l.vbm.toFixed(3)},${eg.toFixed(3)},${(l.fermi || 0).toFixed(3)},${wf.toFixed(3)}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'band_alignment_levels.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate energy ticks from 0.0 to -9.0 eV in 0.5 steps
  const energyTicks = useMemo(() => {
    const ticks = [];
    for (let e = 0.0; e >= -9.0; e -= 0.5) {
      ticks.push(Number(e.toFixed(1)));
    }
    return ticks;
  }, []);

  return (
    <div className="band-alignment-wrapper" style={{ marginTop: '0.8rem' }}>
      {/* Top Header & Export Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.6rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--fg)' }}>{title}</strong>
          <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
            Vacuum Scale (E_vac = 0.0 eV)
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {numLayers} layers plotted
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            title="Download band levels as CSV spreadsheet">
            📊 Export CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportSVG}
            title="Download publication-quality vector SVG image">
            📥 Download SVG Diagram
          </button>
        </div>
      </div>

      {/* SVG Canvas Mount */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Defs */}
          <defs>
            <filter id="blockShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="2.5" dy="3" stdDeviation="2.5" floodOpacity="0.45" />
            </filter>
            {/* Arrow marker for electrons (yellow) */}
            <marker id="arrowElectron" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#eab308" />
            </marker>
            {/* Arrow marker for holes (green) */}
            <marker id="arrowHole" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
            </marker>
          </defs>

          {/* Energy Y-Axis Grid Lines */}
          {energyTicks.map(val => {
            const y = getY(val);
            const isZero = Math.abs(val) < 0.001;
            return (
              <g key={`y-grid-${val}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + plotW}
                  y2={y}
                  stroke={isZero ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isZero ? 1.4 : 0.75}
                  strokeDasharray={isZero ? 'none' : '2,2'}
                />
                {/* Tick mark */}
                <line
                  x1={margin.left - 5}
                  y1={y}
                  x2={margin.left}
                  y2={y}
                  stroke="var(--border)"
                />
                {/* Tick label */}
                <text
                  x={margin.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  fill={isZero ? '#38bdf8' : 'var(--muted)'}
                  fontWeight={isZero ? 'bold' : 'normal'}>
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Optional Redox Potentials */}
          {showRedoxPotentials && (
            <g>
              <line
                x1={margin.left}
                y1={getY(eH2_vac)}
                x2={margin.left + plotW}
                y2={getY(eH2_vac)}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="4,3"
              />
              <text
                x={margin.left + plotW - 6}
                y={getY(eH2_vac) - 4}
                textAnchor="end"
                fontSize="9"
                fill="#38bdf8"
                fontWeight="bold">
                H⁺/H₂ (−4.44 eV)
              </text>
              <line
                x1={margin.left}
                y1={getY(eO2_vac)}
                x2={margin.left + plotW}
                y2={getY(eO2_vac)}
                stroke="#f43f5e"
                strokeWidth="1.2"
                strokeDasharray="4,3"
              />
              <text
                x={margin.left + plotW - 6}
                y={getY(eO2_vac) - 4}
                textAnchor="end"
                fontSize="9"
                fill="#f43f5e"
                fontWeight="bold">
                O₂/H₂O (−5.67 eV)
              </text>
            </g>
          )}

          {/* Render Material Layer Blocks */}
          {layers.map((layer, idx) => {
            const bx = getBlockX(idx);
            const topY = getY(layer.cbm);
            const botY = getY(layer.vbm);
            const blockH = Math.max(8, botY - topY);
            const d3Offset = render3D ? 8 : 0;

            const isHovered = hoverLayer === layer.name;

            return (
              <g
                key={`layer-${layer.name}-${idx}`}
                onMouseEnter={() => setHoverLayer(layer.name)}
                onMouseLeave={() => setHoverLayer(null)}
                style={{ cursor: 'pointer' }}>
                {/* 3D Right Bevel */}
                {render3D && (
                  <path
                    d={`M ${bx + colW} ${topY} L ${bx + colW + d3Offset} ${topY - d3Offset} L ${bx + colW + d3Offset} ${botY - d3Offset} L ${bx + colW} ${botY} Z`}
                    fill={layer.color}
                    filter="brightness(0.68)"
                    opacity="0.95"
                  />
                )}

                {/* 3D Top Bevel */}
                {render3D && (
                  <path
                    d={`M ${bx} ${topY} L ${bx + d3Offset} ${topY - d3Offset} L ${bx + colW + d3Offset} ${topY - d3Offset} L ${bx + colW} ${topY} Z`}
                    fill={layer.color}
                    filter="brightness(1.2)"
                    opacity="0.95"
                  />
                )}

                {/* Main Front Face */}
                <rect
                  x={bx}
                  y={topY}
                  width={colW}
                  height={blockH}
                  rx={2}
                  fill={layer.color}
                  stroke={isHovered ? '#ffffff' : 'rgba(0,0,0,0.35)'}
                  strokeWidth={isHovered ? 2 : 1}
                  filter="url(#blockShadow)"
                  opacity={isHovered ? 1 : 0.95}
                />

                {/* Top Number (CBM) */}
                <text
                  x={bx + colW / 2}
                  y={topY - (render3D ? d3Offset + 4 : 5)}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  fill="var(--fg)"
                  fontWeight="bold">
                  {layer.cbm.toFixed(2)}
                </text>

                {/* Bottom Number (VBM) */}
                <text
                  x={bx + colW / 2}
                  y={botY + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  fill="var(--fg)"
                  fontWeight="bold">
                  {layer.vbm.toFixed(2)}
                </text>

                {/* Inside Block Material Name */}
                <text
                  x={bx + colW / 2}
                  y={topY + blockH / 2 + 4}
                  textAnchor="middle"
                  fontSize={colW < 55 ? '10' : '11.5'}
                  fill="#ffffff"
                  fontWeight="bold"
                  transform={
                    layer.name.length > 6
                      ? `rotate(-90 ${bx + colW / 2} ${topY + blockH / 2})`
                      : undefined
                  }
                  style={{
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    pointerEvents: 'none',
                  }}>
                  {layer.name}
                </text>
              </g>
            );
          })}

          {/* Carrier Transfer Pathways Matching Reference Image */}
          {showCarrierArrows && numLayers >= 4 && (
            <g>
              {/* 1. Hole Extraction Pathways (Green Bracket & Curved Arrows on Top) */}
              {(() => {
                const absStartIdx = layers.findIndex(l => l.type === 'absorber');
                const absEndIdx = layers.findLastIndex(l => l.type === 'absorber');
                const htlIdx = layers.findIndex(l => l.type === 'htl');
                const ptIdx = layers.findIndex(l => l.name === 'Pt');
                const irIdx = layers.findIndex(l => l.name === 'Ir');

                if (absStartIdx >= 0 && absEndIdx >= absStartIdx) {
                  const x1 = getBlockX(absStartIdx) - 2;
                  const x2 = getBlockX(absEndIdx) + colW + 2;
                  const bracketY = getY(-0.65); // Just above the highest CBM

                  return (
                    <g>
                      {/* Green bracket enclosing all absorber layers */}
                      <path
                        d={`M ${x1} ${bracketY + 12} L ${x1} ${bracketY} L ${x2} ${bracketY} L ${x2} ${bracketY + 12}`}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2.4"
                      />
                      {/* h+ label */}
                      <text
                        x={x2 - 25}
                        y={bracketY - 5}
                        fontSize="12"
                        fontWeight="bold"
                        fill="#22c55e">
                        h⁺
                      </text>

                      {/* Curved arrow: Absorber -> CuSbS2 (HTL) */}
                      {htlIdx >= 0 && (
                        <path
                          d={`M ${x2 - 10} ${bracketY - 2} Q ${x2 + 20} ${bracketY - 20}, ${getBlockX(htlIdx) + colW / 2} ${getY(layers[htlIdx].cbm) - 15}`}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2.4"
                          markerEnd="url(#arrowHole)"
                        />
                      )}

                      {/* Curved arrow: CuSbS2 -> Pt */}
                      {htlIdx >= 0 && ptIdx >= 0 && (
                        <path
                          d={`M ${getBlockX(htlIdx) + colW / 2 + 5} ${getY(layers[htlIdx].cbm) - 18} Q ${getBlockX(ptIdx)} ${getY(layers[htlIdx].cbm) - 35}, ${getBlockX(ptIdx) + colW / 2} ${getY(layers[ptIdx].cbm) - 15}`}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2.4"
                          markerEnd="url(#arrowHole)"
                        />
                      )}

                      {/* Curved arrow: Pt -> Ir */}
                      {ptIdx >= 0 && irIdx >= 0 && (
                        <path
                          d={`M ${getBlockX(ptIdx) + colW / 2 + 5} ${getY(layers[ptIdx].cbm) - 18} Q ${getBlockX(irIdx)} ${getY(layers[ptIdx].cbm) - 35}, ${getBlockX(irIdx) + colW / 2} ${getY(layers[irIdx].cbm) - 15}`}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2.4"
                          markerEnd="url(#arrowHole)"
                        />
                      )}
                    </g>
                  );
                }
                return null;
              })()}

              {/* 2. Electron Extraction Pathways (Yellow Bracket & Curved Arrows on Bottom) */}
              {(() => {
                const etlIdx = layers.findIndex(l => l.type === 'etl');
                const ftoIdx = layers.findIndex(l => l.type === 'electrode');
                const absStartIdx = layers.findIndex(l => l.type === 'absorber');
                const absEndIdx = layers.findLastIndex(l => l.type === 'absorber');

                if (absStartIdx >= 0 && absEndIdx >= absStartIdx) {
                  const x1 = getBlockX(absStartIdx) - 2;
                  const x2 = getBlockX(absEndIdx) + colW + 2;
                  const bracketY = getY(-6.7); // Just below lowest absorber VBM

                  return (
                    <g>
                      {/* Yellow bracket under all absorber layers */}
                      <path
                        d={`M ${x1} ${bracketY - 12} L ${x1} ${bracketY} L ${x2} ${bracketY} L ${x2} ${bracketY - 12}`}
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="2.4"
                      />
                      {/* e- label */}
                      <text
                        x={x1 + 35}
                        y={bracketY + 16}
                        fontSize="12"
                        fontWeight="bold"
                        fill="#eab308">
                        e⁻
                      </text>

                      {/* Curved arrow: Absorber -> TiO2 (ETL) */}
                      {etlIdx >= 0 && (
                        <path
                          d={`M ${x1 + 10} ${bracketY + 18} Q ${getBlockX(etlIdx) + colW + 10} ${bracketY + 38}, ${getBlockX(etlIdx) + colW / 2 + 5} ${getY(layers[etlIdx].vbm) + 8}`}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="2.4"
                          markerEnd="url(#arrowElectron)"
                        />
                      )}

                      {/* Curved arrow: TiO2 -> FTO */}
                      {etlIdx >= 0 && ftoIdx >= 0 && (
                        <path
                          d={`M ${getBlockX(etlIdx) + colW / 2 - 5} ${getY(layers[etlIdx].vbm) + 20} Q ${getBlockX(etlIdx) - 10} ${getY(layers[etlIdx].vbm) + 40}, ${getBlockX(ftoIdx) + colW / 2} ${getY(layers[ftoIdx].vbm) + 8}`}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="2.4"
                          markerEnd="url(#arrowElectron)"
                        />
                      )}
                    </g>
                  );
                }
                return null;
              })()}
            </g>
          )}

          {/* Left Y-Axis Spine */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + plotH}
            stroke="var(--border)"
            strokeWidth="1.5"
          />

          {/* Y-Axis Title */}
          <text
            x={-(margin.top + plotH / 2)}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="var(--fg)"
            transform="rotate(-90)">
            Energy (eV)
          </text>

          {/* Figure Label (b) like screenshot */}
          <text
            x={15}
            y={32}
            fontSize="18"
            fontWeight="bold"
            fill="var(--fg)">
            (b)
          </text>
        </svg>

        {/* Hover Tooltip */}
        {hoverLayer && (() => {
          const l = layers.find(x => x.name === hoverLayer);
          if (!l) return null;
          const eg = Math.abs(l.cbm - l.vbm);
          return (
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1px solid ${l.color}`,
              borderRadius: '6px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontWeight: 'bold', color: l.color, marginBottom: '0.2rem', fontSize: '0.85rem' }}>
                {l.name} ({l.type?.toUpperCase() || 'LAYER'})
              </div>
              <div>CBM / LUMO: <strong>{l.cbm.toFixed(2)} eV</strong></div>
              <div>VBM / HOMO: <strong>{l.vbm.toFixed(2)} eV</strong></div>
              <div>Bandgap E_g: <strong>{eg.toFixed(2)} eV</strong></div>
              {l.fermi && <div>Fermi E_F: <strong>{l.fermi.toFixed(2)} eV</strong></div>}
              <div>Work Function Φ: <strong>{Math.abs(l.fermi || l.vbm).toFixed(2)} eV</strong></div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
