import React, { useState, useRef, useMemo } from 'react';
import { exportSvg, exportPng, exportTiff } from '../utils/imageExport.js';

export function WorkFunctionChart({
 potData,
 title = 'Electrostatic Potential Profile & Work Function (Φ)',
 onVacRangeChange = null,
}) {
 const containerRef = useRef(null);
 const [hoverIdx, setHoverIdx] = useState(null);
 // Indication toggles
 const [showVacLine, setShowVacLine] = useState(true);
 const [showEfLine, setShowEfLine] = useState(true);
 const [showMeanLine, setShowMeanLine] = useState(true);
 const [showPhiArrow, setShowPhiArrow] = useState(true);
 const [showLineText, setShowLineText] = useState(false); // default: ZERO text on lines for 100% clean curve!
 const [showShading, setShowShading] = useState(true);

 // Big, spacious graph viewport
 const width = 960;
 const height = 520;
 const margin = { top: 35, right: 35, bottom: 55, left: 70 };
 const plotW = width - margin.left - margin.right;
 const plotH = height - margin.top - margin.bottom;

 const z = potData?.z || [];
 const vPlanar = potData?.vPlanar || [];
 const zMin = potData?.zMin ?? 0;
 const zMax = potData?.zMax ?? 1;
 const minV = potData?.minV ?? 0;
 const maxV = potData?.maxV ?? 1;
 const vacZMin = potData?.vacZMin ?? 0;
 const vacZMax = potData?.vacZMax ?? 1;
 const vVacuum = potData?.vVacuum ?? 0;
 const eFermi = potData?.eFermi ?? 0;
 const workFunction = potData?.workFunction ?? 0;
 const isDipolar = potData?.isDipolar ?? false;
 const deltaV_dipole = potData?.deltaV_dipole ?? 0;
 const phiTop = potData?.phiTop ?? 0;
 const phiBottom = potData?.phiBottom ?? 0;

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
 // Export image formats (SVG, PNG 300 DPI, TIFF 300 DPI)
 const handleExportSVG = () => {
 const svgEl = containerRef.current?.querySelector('svg');
 if (!svgEl) return;
 exportSvg(svgEl, 'work_function_potential.svg');
 };

 const handleExportPNG = (bg = 'dark') => {
 const svgEl = containerRef.current?.querySelector('svg');
 if (!svgEl) return;
 exportPng(svgEl, width, height, `work_function_potential_${bg === 'white' ? 'white_' : ''}300dpi.png`, 3, bg);
 };

 const handleExportTIFF = (bg = 'white') => {
 const svgEl = containerRef.current?.querySelector('svg');
 if (!svgEl) return;
 exportTiff(svgEl, width, height, 'work_function_potential_300dpi.tif', 2.5, bg);
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

 if (!potData || !potData.z || potData.z.length === 0) {
 return null;
 }

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
 Symmetric (No dipole step)
 </div>
 </div>
 )}
 </div>

 {/* ── 1. SEPARATED LINE-BY-LINE LEVEL BREAKDOWN (OUTSIDE THE GRAPH) ── */}
 <div style={{
 background: 'rgba(15, 23, 42, 0.85)',
 border: '1px solid var(--border)',
 borderRadius: '8px',
 padding: '0.75rem 1rem',
 marginBottom: '0.6rem',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexWrap: 'wrap',
 gap: '0.8rem',
 }}>
 <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
 {/* Green Vacuum */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
 <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#34d399', borderRadius: '2px' }} />
 <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>V_vac (Vacuum):</span>
 <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace', color: '#34d399' }}>{vVacuum.toFixed(3)} eV</strong>
 </div>

 {/* Purple Mean Vacuum (if available) */}
 {potData.vVacMean != null && Math.abs(potData.vVacMean - vVacuum) > 0.02 && (
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
 <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#a78bfa', borderRadius: '2px' }} />
 <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600 }}>V_mean (Mean):</span>
 <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace', color: '#a78bfa' }}>{potData.vVacMean.toFixed(3)} eV</strong>
 </div>
 )}

 {/* Yellow Fermi Level */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
 <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#fbbf24', borderRadius: '2px' }} />
 <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>E_F (Fermi):</span>
 <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace', color: '#fbbf24' }}>{eFermi.toFixed(3)} eV</strong>
 </div>

 {/* Blue Work Function */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
 <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#38bdf8', borderRadius: '2px' }} />
 <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>Φ (Work Function):</span>
 <strong style={{ fontSize: '1.05rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800 }}>{workFunction.toFixed(3)} eV</strong>
 </div>
 </div>

 {/* Export Buttons: SVG, PNG (Dark/White 300 DPI), TIFF (300 DPI), DAT */}
 <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 600 }}>
 Download:
 </span>
 <button
 className="btn btn-primary btn-xs"
 onClick={handleExportSVG}
 title="Download vector SVG format (Inkscape, Illustrator, publications)">
 SVG
 </button>
 <button
 className="btn btn-secondary btn-xs"
 onClick={() => handleExportPNG('dark')}
 title="Download high-resolution 300 DPI PNG (dark theme)">
 PNG (Dark)
 </button>
 <button
 className="btn btn-secondary btn-xs"
 onClick={() => handleExportPNG('white')}
 title="Download publication-grade 300 DPI PNG (white paper background for manuscripts)">
 PNG (White)
 </button>
 <button
 className="btn btn-secondary btn-xs"
 onClick={() => handleExportTIFF('white')}
 title="Download 300 DPI TIFF (.tif) for journal submissions (Elsevier, Nature, ACS, Wiley)">
 TIFF (.tif)
 </button>
 <button
 className="btn btn-secondary btn-xs"
 onClick={handleExportDAT}
 title="Download 2-column DAT profile for OriginLab / Python">
 .DAT
 </button>
 </div>
 </div>

 {/* ── 2. INDICATION TOGGLES TOOLBAR (TURN ON/OFF ANY LINE OR TEXT) ── */}
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 flexWrap: 'wrap',
 gap: '0.5rem',
 marginBottom: '0.6rem',
 padding: '0.4rem 0.6rem',
 background: 'rgba(30, 41, 59, 0.45)',
 borderRadius: '6px',
 border: '1px solid rgba(255, 255, 255, 0.08)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '0.74rem', color: 'var(--muted)', marginRight: '0.2rem', fontWeight: 600 }}>
 Toggles:
 </span>

 <button
 type="button"
 className={`btn btn-xs ${showVacLine ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowVacLine(v => !v)}>
 V_vac Line: {showVacLine ? 'ON' : 'OFF'}
 </button>

 <button
 type="button"
 className={`btn btn-xs ${showEfLine ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowEfLine(v => !v)}>
 E_F Line: {showEfLine ? 'ON' : 'OFF'}
 </button>

 <button
 type="button"
 className={`btn btn-xs ${showPhiArrow ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowPhiArrow(v => !v)}>
 Φ Arrow: {showPhiArrow ? 'ON' : 'OFF'}
 </button>

 {potData.vVacMean != null && Math.abs(potData.vVacMean - vVacuum) > 0.02 && (
 <button
 type="button"
 className={`btn btn-xs ${showMeanLine ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowMeanLine(v => !v)}>
 V_mean Line: {showMeanLine ? 'ON' : 'OFF'}
 </button>
 )}

 <button
 type="button"
 className={`btn btn-xs ${showLineText ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowLineText(v => !v)}
 title="Toggle text tags directly on the lines">
 Text on Lines: {showLineText ? 'ON' : 'OFF (Clean)'}
 </button>

 <button
 type="button"
 className={`btn btn-xs ${showShading ? 'btn-primary' : 'btn-secondary'}`}
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => setShowShading(v => !v)}
 title="Toggle shaded background zones">
 Shaded Zones: {showShading ? 'ON' : 'OFF'}
 </button>
 </div>

 <div style={{ display: 'flex', gap: '0.35rem' }}>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => {
 setShowVacLine(false);
 setShowEfLine(false);
 setShowPhiArrow(false);
 setShowMeanLine(false);
 setShowLineText(false);
 setShowShading(false);
 }}>
 Clean Curve Only
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
 onClick={() => {
 setShowVacLine(true);
 setShowEfLine(true);
 setShowPhiArrow(true);
 setShowMeanLine(true);
 setShowLineText(false);
 setShowShading(true);
 }}>
                Reset View
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
 {showShading && (
 <rect
 x={vacXStart}
 y={margin.top}
 width={Math.max(1, vacXEnd - vacXStart)}
 height={plotH}
 fill="#34d399"
 opacity="0.08"
 />
 )}

 {/* Work Function Energy Barrier Shaded Band between EF and V_vac */}
 {showShading && (
 <rect
 x={margin.left}
 y={Math.min(vVacY, efY)}
 width={plotW}
 height={Math.abs(efY - vVacY)}
 fill="#38bdf8"
 opacity="0.10"
 />
 )}

 {/* 1. Yellow Fermi Level Line (EF) */}
 {showEfLine && (
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
 {showLineText && (
 <text
 x={margin.left + 6}
 y={efY - 4}
 fontSize="9.5"
 fill="#fbbf24"
 fontFamily="monospace"
 fontWeight="bold">
 E_F ({eFermi.toFixed(2)} eV)
 </text>
 )}
 </g>
 )}

 {/* 2. Green Vacuum Level Line (V_vac) */}
 {showVacLine && (
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
 {showLineText && (
 <text
 x={margin.left + 6}
 y={vVacY - 4}
 fontSize="9.5"
 fill="#34d399"
 fontFamily="monospace"
 fontWeight="bold">
 V_vac ({vVacuum.toFixed(2)} eV)
 </text>
 )}
 </g>
 )}

 {/* 3. Purple Mean Vacuum Line (V_mean) — if available */}
 {showMeanLine && potData.vVacMean != null && Math.abs(potData.vVacMean - vVacuum) > 0.02 && (
 <g>
 <line
 x1={margin.left}
 y1={getY(potData.vVacMean)}
 x2={margin.left + plotW}
 y2={getY(potData.vVacMean)}
 stroke="#a78bfa"
 strokeWidth="1.4"
 strokeDasharray="3,3"
 />
 {showLineText && (
 <text
 x={margin.left + 6}
 y={getY(potData.vVacMean) - 4}
 fontSize="9"
 fill="#a78bfa"
 fontFamily="monospace"
 fontWeight="bold">
 V_mean ({potData.vVacMean.toFixed(2)} eV)
 </text>
 )}
 </g>
 )}

 {/* 4. Blue Work Function Dimension Arrow (Φ = V_vac − EF) */}
 {showPhiArrow && (
 <g>
 <line
 x1={margin.left + 35}
 y1={efY}
 x2={margin.left + 35}
 y2={vVacY}
 stroke="#38bdf8"
 strokeWidth="2"
 />
 <circle cx={margin.left + 35} cy={efY} r="3" fill="#38bdf8" />
 <circle cx={margin.left + 35} cy={vVacY} r="3" fill="#38bdf8" />
 {showLineText && (
 <text
 x={margin.left + 42}
 y={(efY + vVacY) / 2 + 3}
 fontSize="10"
 fill="#38bdf8"
 fontWeight="bold">
 Φ = {workFunction.toFixed(2)} eV
 </text>
 )}
 </g>
 )}

          {/* Potential Curve V_bar(z) */}
          <path d={potPath} fill="none" stroke="#38bdf8" strokeWidth="2.4" />

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
