import React, { useState, useRef, useMemo } from 'react';
import { exportSvg, exportPng, exportTiff } from '../utils/imageExport.js';
const PALETTE = [
 '#38bdf8', // sky-400 (Total)
 '#f87171', // red-400 (Species 1)
 '#fbbf24', // amber-400 (Species 2)
 '#34d399', // emerald-400 (Species 3)
 '#a78bfa', // violet-400 (Species 4)
 '#f472b6', // pink-400 (Species 5)
 '#2dd4bf', // teal-400 (Species 6)
 '#fb923c', // orange-400 (Species 7)
 '#818cf8', // indigo-400 (Species 8)
];

/**
 * High-performance Interactive SVG Plotter for DOS & PDOS
 */
export function DOSChart({
 title = 'Density of States',
 energies = [],
 series = [], // Array of { name, color, dataUp: number[], dataDown?: number[] }
 fermiEnergy = 0,
 isShifted = true,
 isSpinPol = false,
 xLabel = 'Energy (eV)',
 yLabel = 'DOS (states / eV)',
}) {
 const containerRef = useRef(null);
 const svgRef = useRef(null);
 const [hoverIndex, setHoverIndex] = useState(null);
 const [hiddenSeries, setHiddenSeries] = useState({});
 const [plotTheme, setPlotTheme] = useState('white'); // 'white' | 'dark'

 const width = 860;
 const height = 400;
 const margin = { top: 30, right: 30, bottom: 50, left: 65 };
 const plotW = width - margin.left - margin.right;
 const plotH = height - margin.top - margin.bottom;

 const nPoints = energies.length;

 // Determine active series
 const activeSeries = useMemo(() => {
 return series.filter(s => !hiddenSeries[s.name]);
 }, [series, hiddenSeries]);

 // Compute energy min and max
 const eMin = energies.length > 0 ? energies[0] : -6;
 const eMax = energies.length > 0 ? energies[energies.length - 1] : 6;

 // Compute DOS y-limits
 const { maxDosUp, maxDosDown } = useMemo(() => {
 let mUp = 0;
 let mDown = 0;

 activeSeries.forEach(s => {
 if (s.dataUp) {
 for (let i = 0; i < s.dataUp.length; i++) {
 if (s.dataUp[i] > mUp) mUp = s.dataUp[i];
 }
 }
 if (s.dataDown) {
 for (let i = 0; i < s.dataDown.length; i++) {
 if (s.dataDown[i] > mDown) mDown = s.dataDown[i];
 }
 }
 });

 return {
 maxDosUp: Math.max(0.1, mUp * 1.08),
 maxDosDown: isSpinPol ? Math.max(0.1, mDown * 1.08) : 0,
 };
 }, [activeSeries, isSpinPol]);

 const yMin = isSpinPol ? -maxDosDown : 0;
 const yMax = maxDosUp;

 // Coordinate transforms
 const getX = (energy) => {
 if (eMax === eMin) return margin.left;
 return margin.left + ((energy - eMin) / (eMax - eMin)) * plotW;
 };

 const getY = (val) => {
 if (yMax === yMin) return margin.top + plotH / 2;
 return margin.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
 };

 // Zero-DOS baseline Y coordinate
 const zeroY = getY(0);

 // Generate SVG path for a curve
 const generatePath = (data, factor = 1) => {
 if (!data || data.length === 0) return '';
 let d = '';
 const step = Math.max(1, Math.floor(data.length / 800)); // subsample if too dense
 for (let i = 0; i < data.length; i += step) {
 const x = getX(energies[i]);
 const y = getY(data[i] * factor);
 d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
 }
 return d;
 };

 // Generate SVG closed area polygon for fill
 const generateArea = (data, factor = 1) => {
 if (!data || data.length === 0) return '';
 const step = Math.max(1, Math.floor(data.length / 800));
 let d = `M ${getX(energies[0]).toFixed(1)} ${zeroY.toFixed(1)}`;
 for (let i = 0; i < data.length; i += step) {
 const x = getX(energies[i]);
 const y = getY(data[i] * factor);
 d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
 }
 const lastX = getX(energies[data.length - 1]);
 d += ` L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} Z`;
 return d;
 };

 // Fermi Level line X coordinate
 const efTarget = isShifted ? 0 : fermiEnergy;
 const efX = getX(efTarget);
 const showEfLine = efTarget >= eMin && efTarget <= eMax;

 // Mouse hover handler
 const handleMouseMove = (e) => {
 if (!containerRef.current || nPoints === 0) return;
 const rect = containerRef.current.getBoundingClientRect();
 const mouseX = e.clientX - rect.left;
 const svgX = (mouseX / rect.width) * width;

 if (svgX < margin.left || svgX > margin.left + plotW) {
 setHoverIndex(null);
 return;
 }

 const ratio = (svgX - margin.left) / plotW;
 const energy = eMin + ratio * (eMax - eMin);

 // Find closest energy index
 let bestIdx = 0;
 let minDiff = Infinity;
 for (let i = 0; i < nPoints; i++) {
 const diff = Math.abs(energies[i] - energy);
 if (diff < minDiff) {
 minDiff = diff;
 bestIdx = i;
 }
 }
 setHoverIndex(bestIdx);
 };

 const handleMouseLeave = () => {
 setHoverIndex(null);
 };

 // Toggle series visibility
 const toggleSeries = (name) => {
 setHiddenSeries(prev => ({ ...prev, [name]: !prev[name] }));
 };

 // Export data as .DAT / .CSV
 // Export data as formatted .DAT file
 const handleExportDAT = () => {
 if (energies.length === 0) return;
 let text = `# ==============================================================================\n`;
 text += `# SIESTA Density of States Data File (.dat)\n`;
 text += `# Title: ${title}\n`;
 text += `# Fermi Energy (E_F): ${fermiEnergy.toFixed(4)} eV (${isShifted ? 'Shifted: E - E_F = 0' : 'Absolute Energies'})\n`;
 text += `# Spin Polarized: ${isSpinPol ? 'Yes (Spin Up & Spin Down)' : 'No'}\n`;
 text += `# Number of Energy Points: ${nPoints}\n`;
 text += `# Energy Range: ${eMin.toFixed(4)} to ${eMax.toFixed(4)} eV\n`;
 text += `# Columns:\n`;
 text += `# Col 1: Energy (eV)\n`;
 let colIdx = 2;
 series.forEach(s => {
 text += `# Col ${colIdx++}: ${s.name} (states/eV)\n`;
 });
 if (isSpinPol) {
 series.forEach(s => {
 text += `# Col ${colIdx++}: ${s.name} [Spin Down] (states/eV)\n`;
 });
 }
 text += `#\n`;
 text += `# Gnuplot Command:\n`;
 text += `# plot for [col=2:${colIdx - 1}] 'dos.dat' using 1:col with lines lw 2 title columnhead\n`;
 text += `# ==============================================================================\n`;

 const headers = ['# Energy_eV', ...series.map(s => `"${s.name}"`)];
 if (isSpinPol) {
 headers.push(...series.map(s => `"${s.name}_Down"`));
 }
 text += `${headers.join('\t')}\n`;

 for (let i = 0; i < nPoints; i++) {
 const cols = [energies[i].toFixed(6)];
 series.forEach(s => {
 cols.push((s.dataUp ? s.dataUp[i] : 0).toFixed(6));
 });
 if (isSpinPol) {
 series.forEach(s => {
 cols.push((s.dataDown ? s.dataDown[i] : 0).toFixed(6));
 });
 }
 text += `${cols.join('\t')}\n`;
 }

 const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dos.dat`;
 a.click();
 URL.revokeObjectURL(url);
 };

 // Export image formats (SVG, PNG 300 DPI, TIFF 300 DPI)
 const handleExportSVG = () => {
 if (!svgRef.current) return;
 exportSvg(svgRef.current, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dos.svg`);
 };

 const handleExportPNG = async () => {
 if (!svgRef.current) return;
 await exportPng(svgRef.current, width, height, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dos_300dpi.png`, 3.5, plotTheme);
 };

 const handleExportTIFF = async () => {
 if (!svgRef.current) return;
 await exportTiff(svgRef.current, width, height, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dos_300dpi.tif`, 2.8, plotTheme);
 };

 // Generate nice tick marks for axes
 const xTicks = useMemo(() => {
 const ticks = [];
 const count = 7;
 const step = (eMax - eMin) / (count - 1);
 for (let i = 0; i < count; i++) {
 ticks.push(eMin + i * step);
 }
 return ticks;
 }, [eMin, eMax]);

 const yTicks = useMemo(() => {
 const ticks = [];
 const count = 6;
 const step = (yMax - yMin) / (count - 1);
 for (let i = 0; i < count; i++) {
 ticks.push(yMin + i * step);
 }
 return ticks;
 }, [yMin, yMax]);

 return (
 <div className="dos-chart-wrapper" style={{ marginTop: '0.8rem' }}>
 {/* Chart Header Bar */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginBottom: '0.5rem',
 flexWrap: 'wrap',
 gap: '0.5rem',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
 <strong style={{ fontSize: '0.95rem', color: 'var(--fg)' }}>{title}</strong>
 {isShifted && (
 <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
 E<sub>F</sub> aligned at 0 eV
 </span>
 )}
 {isSpinPol && (
 <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
 Spin Polarized (↑ Up / ↓ Down)
 </span>
 )}
 </div>

 <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
 {/* Theme switcher */}
 <button
 type="button"
 className={`btn btn-xs ${plotTheme === 'white' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setPlotTheme('white')}
 title="Publication White background">
 White
 </button>
 <button
 type="button"
 className={`btn btn-xs ${plotTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setPlotTheme('dark')}
 title="Dark screen background">
 Dark
 </button>

 {/* Export suite */}
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={handleExportDAT}
 title="Download tabulated .dat data file with Gnuplot script">
 Download .dat Data
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={handleExportSVG}
 title="Download vector SVG figure">
 SVG Vector
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={handleExportPNG}
 title="Download publication-grade 300 DPI PNG">
 PNG (300 DPI)
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={handleExportTIFF}
 title="Download 300 DPI TIFF figure for journal submission">
 TIFF (300 DPI)
 </button>
 </div>
 </div>

 {/* Interactive Legend Bar */}
 <div style={{
 display: 'flex',
 flexWrap: 'wrap',
 gap: '0.4rem',
 marginBottom: '0.6rem',
 background: 'rgba(15, 23, 42, 0.4)',
 padding: '0.4rem 0.6rem',
 borderRadius: '6px',
 border: '1px solid var(--border)',
 }}>
 <span style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center', marginRight: '0.2rem' }}>
 Toggle Curves:
 </span>
 {series.map(s => {
 const isHidden = !!hiddenSeries[s.name];
 return (
 <button
 key={s.name}
 type="button"
 onClick={() => toggleSeries(s.name)}
 style={{
 display: 'inline-flex',
 alignItems: 'center',
 gap: '0.35rem',
 fontSize: '0.75rem',
 padding: '0.2rem 0.5rem',
 borderRadius: '4px',
 border: `1px solid ${isHidden ? 'var(--border)' : s.color}`,
 background: isHidden ? 'transparent' : `${s.color}22`,
 color: isHidden ? 'var(--muted)' : 'var(--fg)',
 cursor: 'pointer',
 opacity: isHidden ? 0.5 : 1,
 }}
 title={`Click to ${isHidden ? 'show' : 'hide'} ${s.name}`}>
 <span style={{
 display: 'inline-block',
 width: '10px',
 height: '10px',
 borderRadius: '2px',
 background: isHidden ? 'var(--muted)' : s.color,
 }} />
 <span>{s.name}</span>
 </button>
 );
 })}
 </div>

 {/* SVG Canvas Mount */}
 <div
 ref={containerRef}
 onMouseMove={handleMouseMove}
 onMouseLeave={handleMouseLeave}
 style={{
 width: '100%',
 position: 'relative',
 background: 'rgba(15, 23, 42, 0.75)',
 borderRadius: '8px',
 border: '1px solid var(--border)',
 overflow: 'hidden',
 cursor: 'crosshair',
 }}>
 <svg
 ref={svgRef}
 viewBox={`0 0 ${width} ${height}`}
 style={{ width: '100%', height: 'auto', display: 'block', background: plotTheme === 'white' ? '#ffffff' : '#0f172a' }}>
 <defs>
 <clipPath id="dos-plot-clip">
 <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
 </clipPath>
 </defs>
 <rect x="0" y="0" width={width} height={height} fill={plotTheme === 'white' ? '#ffffff' : '#0f172a'} />
 {xTicks.map(val => {
 const x = getX(val);
 return (
 <line
 key={`grid-x-${val}`}
 x1={x}
 y1={margin.top}
 x2={x}
 y2={margin.top + plotH}
 stroke="rgba(255,255,255,0.06)"
 strokeDasharray="2,2"
 />
 );
 })}

 {yTicks.map(val => {
 const y = getY(val);
 return (
 <line
 key={`grid-y-${val}`}
 x1={margin.left}
 y1={y}
 x2={margin.left + plotW}
 y2={y}
 stroke="rgba(255,255,255,0.06)"
 strokeDasharray="2,2"
 />
 );
 })}

 {/* Zero baseline for Spin Down / Zero DOS */}
 <line
 x1={margin.left}
 y1={zeroY}
 x2={margin.left + plotW}
 y2={zeroY}
 stroke="rgba(255,255,255,0.3)"
 strokeWidth="1"
 />

 {/* Fermi Energy guideline */}
 {showEfLine && (
 <g>
 <line
 x1={efX}
 y1={margin.top}
 x2={efX}
 y2={margin.top + plotH}
 stroke="var(--accent, #38bdf8)"
 strokeWidth="1.5"
 strokeDasharray="4,4"
 />
 <rect
 x={efX - 22}
 y={margin.top - 20}
 width="44"
 height="18"
 rx="3"
 fill="rgba(56, 189, 248, 0.25)"
 stroke="var(--accent, #38bdf8)"
 />
 <text
 x={efX}
 y={margin.top - 8}
 textAnchor="middle"
 fontSize="10"
 fill="var(--accent, #38bdf8)"
 fontWeight="bold">
 E_F
 </text>
 </g>
 )}

 {/* Plot curves and filled areas */}
 {activeSeries.map(s => {
 return (
 <g key={`series-${s.name}`}>
 {/* Spin Up Area */}
 {s.dataUp && (
 <path
 d={generateArea(s.dataUp, 1)}
 fill={s.color}
 opacity="0.16"
 />
 )}
 {/* Spin Up Line */}
 {s.dataUp && (
 <path
 d={generatePath(s.dataUp, 1)}
 fill="none"
 stroke={s.color}
 strokeWidth="1.8"
 />
 )}

 {/* Spin Down Area (negative Y) */}
 {isSpinPol && s.dataDown && (
 <path
 d={generateArea(s.dataDown, -1)}
 fill={s.color}
 opacity="0.16"
 />
 )}
 {/* Spin Down Line */}
 {isSpinPol && s.dataDown && (
 <path
 d={generatePath(s.dataDown, -1)}
 fill="none"
 stroke={s.color}
 strokeWidth="1.8"
 strokeDasharray="5,2"
 />
 )}
 </g>
 );
 })}

 {/* Mouse Crosshair line */}
 {hoverIndex !== null && (
 <g>
 <line
 x1={getX(energies[hoverIndex])}
 y1={margin.top}
 x2={getX(energies[hoverIndex])}
 y2={margin.top + plotH}
 stroke="var(--warning, #fbbf24)"
 strokeWidth="1"
 strokeDasharray="3,3"
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

 {/* X Axis Ticks and Labels */}
 {xTicks.map(val => {
 const x = getX(val);
 return (
 <g key={`tick-x-${val}`}>
 <line
 x1={x}
 y1={margin.top + plotH}
 x2={x}
 y2={margin.top + plotH + 5}
 stroke="var(--border)"
 />
 <text
 x={x}
 y={margin.top + plotH + 18}
 textAnchor="middle"
 fontSize="11"
 fill="var(--muted)">
 {val.toFixed(1)}
 </text>
 </g>
 );
 })}

 {/* Y Axis Ticks and Labels */}
 {yTicks.map(val => {
 const y = getY(val);
 return (
 <g key={`tick-y-${val}`}>
 <line
 x1={margin.left - 5}
 y1={y}
 x2={margin.left}
 y2={y}
 stroke="var(--border)"
 />
 <text
 x={margin.left - 8}
 y={y + 4}
 textAnchor="end"
 fontSize="11"
 fill="var(--muted)">
 {val.toFixed(1)}
 </text>
 </g>
 );
 })}

 {/* Axis Titles */}
 <text
 x={margin.left + plotW / 2}
 y={height - 12}
 textAnchor="middle"
 fontSize="12"
 fill="var(--fg)"
 fontWeight="500">
 {xLabel}
 </text>

 <text
 x={-(margin.top + plotH / 2)}
 y={18}
 textAnchor="middle"
 fontSize="12"
 fill="var(--fg)"
 fontWeight="500"
 transform="rotate(-90)">
 {yLabel}
 </text>
 </svg>

 {/* Floating Tooltip */}
 {hoverIndex !== null && (
 <div style={{
 position: 'absolute',
 top: '12px',
 right: '12px',
 background: 'rgba(15, 23, 42, 0.92)',
 border: '1px solid var(--border)',
 borderRadius: '6px',
 padding: '0.45rem 0.75rem',
 fontSize: '0.75rem',
 fontFamily: 'monospace',
 pointerEvents: 'none',
 zIndex: 20,
 boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
 }}>
 <div style={{ color: 'var(--warning)', fontWeight: 'bold', marginBottom: '0.2rem' }}>
 E = {energies[hoverIndex].toFixed(3)} eV
 </div>
 {activeSeries.map(s => {
 const valUp = s.dataUp ? s.dataUp[hoverIndex] : 0;
 const valDown = s.dataDown ? s.dataDown[hoverIndex] : null;
 return (
 <div key={`tooltip-${s.name}`} style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between' }}>
 <span style={{ color: s.color }}>{s.name}:</span>
 <span>
 {valUp.toFixed(3)}
 {isSpinPol && valDown !== null ? ` (↓ ${valDown.toFixed(3)})` : ''}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}

export { PALETTE };
