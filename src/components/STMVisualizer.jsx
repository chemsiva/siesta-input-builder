import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useFDFStore } from '../store/fdfStore';
import { ELEMENT_DATA } from '../utils/elementData.js';

// Scientific Colormaps
const COLORMAPS = {
  copper: {
    label: 'Copper / Gold (Standard STM)',
    fn: (t) => [
      Math.min(255, Math.floor(t * 1.5 * 255)),
      Math.min(255, Math.floor(t * 0.95 * 255)),
      Math.min(255, Math.floor(t * 0.45 * 255)),
    ],
  },
  viridis: {
    label: 'Viridis',
    fn: (t) => {
      const c = [
        [68, 1, 84],
        [59, 82, 139],
        [33, 145, 140],
        [94, 201, 98],
        [253, 231, 37],
      ];
      const idx = Math.min(3, Math.floor(t * 4));
      const f = t * 4 - idx;
      const c1 = c[idx];
      const c2 = c[idx + 1];
      return [
        Math.floor(c1[0] + (c2[0] - c1[0]) * f),
        Math.floor(c1[1] + (c2[1] - c1[1]) * f),
        Math.floor(c1[2] + (c2[2] - c1[2]) * f),
      ];
    },
  },
  inferno: {
    label: 'Inferno',
    fn: (t) => {
      const c = [
        [0, 0, 4],
        [87, 16, 110],
        [187, 55, 84],
        [249, 142, 9],
        [252, 255, 164],
      ];
      const idx = Math.min(3, Math.floor(t * 4));
      const f = t * 4 - idx;
      const c1 = c[idx];
      const c2 = c[idx + 1];
      return [
        Math.floor(c1[0] + (c2[0] - c1[0]) * f),
        Math.floor(c1[1] + (c2[1] - c1[1]) * f),
        Math.floor(c1[2] + (c2[2] - c1[2]) * f),
      ];
    },
  },
  grayscale: {
    label: 'Grayscale (Topographic)',
    fn: (t) => {
      const v = Math.floor(t * 255);
      return [v, v, v];
    },
  },
};

// Preset demo surfaces for STM simulations
const STM_DEMO_PRESETS = {
  perovskite: {
    title: 'FAPbI₃ (001) Perovskite Surface',
    desc: 'Shows bias-dependent contrast inversion: negative bias images occupied I 5p surface states, positive bias images unoccupied Pb 6p states.',
    bias: -1.5,
    tipHeight: 2.8,
    isoval: 0.04,
    lv: [[12.6, 0, 0], [0, 12.6, 0], [0, 0, 30.0]],
    atoms: [
      { element: 'Pb', x: 0.0, y: 0.0, z: 12.0 },
      { element: 'Pb', x: 6.3, y: 0.0, z: 12.0 },
      { element: 'Pb', x: 0.0, y: 6.3, z: 12.0 },
      { element: 'Pb', x: 6.3, y: 6.3, z: 12.0 },
      { element: 'I',  x: 3.15, y: 0.0, z: 12.6 },
      { element: 'I',  x: 0.0, y: 3.15, z: 12.6 },
      { element: 'I',  x: 6.3, y: 3.15, z: 12.6 },
      { element: 'I',  x: 3.15, y: 6.3, z: 12.6 },
      { element: 'N',  x: 3.15, y: 3.15, z: 13.2 },
      { element: 'C',  x: 3.15, y: 3.75, z: 13.2 },
    ],
  },
  graphene: {
    title: 'Graphene Monolayer (Atomic Honeycomb)',
    desc: 'Simulates atomic-resolution STM of the sp² honeycomb lattice with sub-Ångström triangular sublattice contrast.',
    bias: 0.8,
    tipHeight: 2.2,
    isoval: 0.06,
    lv: [[7.38, 0, 0], [0, 8.52, 0], [0, 0, 20.0]],
    atoms: [
      { element: 'C', x: 0.0, y: 0.0, z: 10.0 },
      { element: 'C', x: 1.23, y: 0.71, z: 10.0 },
      { element: 'C', x: 1.23, y: 2.13, z: 10.0 },
      { element: 'C', x: 0.0, y: 2.84, z: 10.0 },
      { element: 'C', x: 2.46, y: 0.0, z: 10.0 },
      { element: 'C', x: 3.69, y: 0.71, z: 10.0 },
      { element: 'C', x: 3.69, y: 2.13, z: 10.0 },
      { element: 'C', x: 2.46, y: 2.84, z: 10.0 },
      { element: 'C', x: 0.0, y: 4.26, z: 10.0 },
      { element: 'C', x: 1.23, y: 4.97, z: 10.0 },
      { element: 'C', x: 2.46, y: 4.26, z: 10.0 },
      { element: 'C', x: 3.69, y: 4.97, z: 10.0 },
    ],
  },
  defect: {
    title: 'Perovskite Surface Iodine Vacancy (V_I)',
    desc: 'Iodine atom missing from the surface layer: displays a localized dark topographic depression and electronic charge accumulation.',
    bias: 1.2,
    tipHeight: 2.5,
    isoval: 0.05,
    lv: [[12.6, 0, 0], [0, 12.6, 0], [0, 0, 30.0]],
    atoms: [
      { element: 'Pb', x: 0.0, y: 0.0, z: 12.0 },
      { element: 'Pb', x: 6.3, y: 0.0, z: 12.0 },
      { element: 'Pb', x: 0.0, y: 6.3, z: 12.0 },
      { element: 'Pb', x: 6.3, y: 6.3, z: 12.0 },
      // Iodine at (3.15, 0.0) is missing (V_I defect)
      { element: 'I',  x: 0.0, y: 3.15, z: 12.6 },
      { element: 'I',  x: 6.3, y: 3.15, z: 12.6 },
      { element: 'I',  x: 3.15, y: 6.3, z: 12.6 },
    ],
  },
};

export function STMVisualizer() {
  const currentStructure = useFDFStore(s => s.structure);
  const fileInputRef = useRef(null);
  const canvas2dRef = useRef(null);
  const mount3dRef = useRef(null);

  // Simulation Controls (matching plstm parameters)
  const [stmMode, setStmMode] = useState('constant-current'); // 'constant-current' (-i) or 'constant-height' (-z)
  const [biasVoltage, setBiasVoltage] = useState('-1.5');     // Sample bias in V
  const [tipHeight, setTipHeight] = useState('2.8');          // Tip height z_0 in Å (-z)
  const [currentSetpoint, setCurrentSetpoint] = useState('0.04'); // Current isovalue (-i)
  const [colormapKey, setColormapKey] = useState('copper');
  const [showAtomsOverlay, setShowAtomsOverlay] = useState(true);
  const [supercellRepeat, setSupercellRepeat] = useState(2); // 1x, 2x, 3x
  const [view3D, setView3D] = useState(false);
  const [lineCutY, setLineCutY] = useState(0.5); // Fractional Y position (0 to 1)

  // Dataset state
  const [activePreset, setActivePreset] = useState('perovskite');
  const [customAtoms, setCustomAtoms] = useState(null);
  const [customLV, setCustomLV] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Loaded FAPbI₃ (001) perovskite surface STM simulation.');
  const [errorMsg, setErrorMsg] = useState('');

  // Active atoms and lattice vectors
  const { atoms, lv } = useMemo(() => {
    if (customAtoms && customLV) {
      return { atoms: customAtoms, lv: customLV };
    }
    const preset = STM_DEMO_PRESETS[activePreset] || STM_DEMO_PRESETS.perovskite;
    return { atoms: preset.atoms, lv: preset.lv };
  }, [customAtoms, customLV, activePreset]);

  // Compute 2D Tersoff-Hamann STM Grid
  const stmGrid = useMemo(() => {
    if (!atoms || atoms.length === 0) return null;

    const baseAx = lv[0][0];
    const baseAy = lv[1][1];
    const repeat = supercellRepeat;
    const ax = baseAx * repeat;
    const ay = baseAy * repeat;

    const nx = 100;
    const ny = 100;
    const dx = ax / nx;
    const dy = ay / ny;

    const bias = parseFloat(biasVoltage) || -1.5;
    const tipH = parseFloat(tipHeight) || 2.8;
    const isoval = parseFloat(currentSetpoint) || 0.04;
    const kappa = 1.05; // ~0.512 * sqrt(4.5 eV) ~ 1.05 A^-1

    // Replicate atoms across supercell
    const repAtoms = [];
    for (let rx = 0; rx < repeat; rx++) {
      for (let ry = 0; ry < repeat; ry++) {
        atoms.forEach(a => {
          repAtoms.push({
            ...a,
            x: a.x + rx * baseAx,
            y: a.y + ry * baseAy,
          });
        });
      }
    }

    const maxZ = Math.max(...repAtoms.map(a => a.z));
    const grid = Array.from({ length: ny }, () => new Float32Array(nx));

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let iy = 0; iy < ny; iy++) {
      const y = iy * dy;
      for (let ix = 0; ix < nx; ix++) {
        const x = ix * dx;

        let ldos = 0;
        repAtoms.forEach(a => {
          // Periodic distance within bounding box
          let rx = Math.abs((x - a.x) % ax);
          if (rx > ax / 2) rx = ax - rx;
          let ry = Math.abs((y - a.y) % ay);
          if (ry > ay / 2) ry = ay - ry;

          const distSq = rx * rx + ry * ry;
          if (distSq > 16.0) return; // cutoff at 4 A radius

          // Bias-dependent orbital weighting (Tersoff-Hamann)
          let weight = 1.0;
          if (bias < 0) {
            // Occupied valence states (halogens I, anions O, S have high weight)
            if (['I', 'O', 'S', 'Cl', 'Br'].includes(a.element)) weight = 3.2;
            if (['N', 'C'].includes(a.element)) weight = 2.0;
          } else {
            // Unoccupied conduction states (cations Pb, Sn, Ti have high weight)
            if (['Pb', 'Sn', 'Ti', 'Si'].includes(a.element)) weight = 3.2;
          }

          const zDiff = (maxZ + tipH) - a.z;
          const decay = Math.exp(-2 * kappa * Math.max(0, zDiff));
          ldos += weight * Math.exp(-distSq / (2 * 0.65 * 0.65)) * decay;
        });

        if (stmMode === 'constant-current') {
          // Constant-Current: Apparent height z(x,y) in Angstrom
          const zApparent = maxZ + tipH + (1 / (2 * kappa)) * Math.log(Math.max(1e-7, ldos) / isoval);
          grid[iy][ix] = zApparent;
          if (zApparent < minVal) minVal = zApparent;
          if (zApparent > maxVal) maxVal = zApparent;
        } else {
          // Constant-Height: Tunneling current I(x,y) in arbitrary units
          grid[iy][ix] = ldos * 100;
          if (ldos * 100 < minVal) minVal = ldos * 100;
          if (ldos * 100 > maxVal) maxVal = ldos * 100;
        }
      }
    }

    return {
      nx, ny, ax, ay, grid, minVal, maxVal,
      corrugation: maxVal - minVal,
      repAtoms,
    };
  }, [atoms, lv, stmMode, biasVoltage, tipHeight, currentSetpoint, supercellRepeat]);

  // Render 2D Topography Canvas
  useEffect(() => {
    if (view3D) return;
    const canvas = canvas2dRef.current;
    if (!canvas || !stmGrid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { nx, ny, grid, minVal, maxVal, ax, ay, repAtoms } = stmGrid;
    const w = canvas.width;
    const h = canvas.height;

    const imgData = ctx.createImageData(nx, ny);
    const cm = COLORMAPS[colormapKey] || COLORMAPS.copper;
    const span = maxVal - minVal || 1e-5;

    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const val = grid[iy][ix];
        const norm = Math.max(0, Math.min(1, (val - minVal) / span));
        const [r, g, b] = cm.fn(norm);
        const idx = (iy * nx + ix) * 4;
        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
      }
    }

    // Render scaled image smoothly
    createImageBitmap(imgData).then(bmp => {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bmp, 0, 0, w, h);

      // Line Cut Indicator
      const cutY_px = lineCutY * h;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, cutY_px);
      ctx.lineTo(w, cutY_px);
      ctx.stroke();
      ctx.setLineDash([]);

      // Atom Positions Overlay
      if (showAtomsOverlay) {
        repAtoms.forEach(a => {
          const px = (a.x / ax) * w;
          const py = (a.y / ay) * h;
          const info = ELEMENT_DATA[a.element] || { color: 0xffffff };
          const hex = '#' + info.color.toString(16).padStart(6, '0');

          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = hex;
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.0;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(a.element, px, py);
        });
      }
    });
  }, [stmGrid, colormapKey, showAtomsOverlay, view3D, lineCutY]);

  // 1D Line Cut Profile along lineCutY
  const lineProfile = useMemo(() => {
    if (!stmGrid) return null;
    const { nx, ny, grid, ax } = stmGrid;
    const iy = Math.min(ny - 1, Math.max(0, Math.floor(lineCutY * ny)));
    const row = grid[iy];
    const xVals = [];
    const yVals = [];
    for (let ix = 0; ix < nx; ix++) {
      xVals.push(parseFloat(((ix / nx) * ax).toFixed(2)));
      yVals.push(parseFloat(row[ix].toFixed(3)));
    }
    const minP = Math.min(...yVals);
    const maxP = Math.max(...yVals);
    return { xVals, yVals, minP, maxP, corrugation: maxP - minP };
  }, [stmGrid, lineCutY]);

  // Load from current Section 2 structure
  const handleLoadFromCurrentStructure = () => {
    if (!currentStructure?.atoms || currentStructure.atoms.length === 0) {
      setErrorMsg('No atoms found in Section ② Structure. Load a CIF or enter atoms first.');
      return;
    }
    const cartAtoms = currentStructure.atoms.map((a, i) => ({
      element: a.label?.replace(/\d+/g, '') || a.species || 'Si',
      x: parseFloat(a.x) || 0,
      y: parseFloat(a.y) || 0,
      z: parseFloat(a.z) || 0,
    }));
    setCustomAtoms(cartAtoms);
    setCustomLV(currentStructure.LatticeVectors || [[10, 0, 0], [0, 10, 0], [0, 0, 25]]);
    setStatusMsg(`✓ Loaded ${cartAtoms.length} atoms from Section ② Structure for STM simulation.`);
  };

  return (
    <div className="stm-visualizer-container" style={{ marginTop: '0.5rem' }}>
      {/* Studio Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.8rem',
        padding: '0.8rem',
        background: 'var(--surface2)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        marginBottom: '0.8rem',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔬 Simulated STM &amp; LDOS Visualizer (Tersoff-Hamann Approximation)</span>
            <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
              SIESTA Util/STM/simple-stm
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Simulates experimental Scanning Tunneling Microscopy (STM) topography images z(x,y) and current maps I(x,y) from SIESTA Local Density of States (%block LocalDensityOfStates).
          </p>
        </div>

        {/* Preset Selectors */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Presets:</span>
          <button className="btn btn-secondary btn-xs" onClick={() => { setActivePreset('perovskite'); setCustomAtoms(null); }}>
            FAPbI₃ (001) Perovskite
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => { setActivePreset('graphene'); setCustomAtoms(null); }}>
            Graphene Honeycomb
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => { setActivePreset('defect'); setCustomAtoms(null); }}>
            I-Vacancy (V_I) Defect
          </button>
          <button className="btn btn-primary btn-xs" onClick={handleLoadFromCurrentStructure} title="Simulate STM from structure in Section 2">
            Import from Section ②
          </button>
        </div>
      </div>

      {statusMsg && <div style={{ color: 'var(--success, #10b981)', marginBottom: '0.6rem', fontSize: '0.78rem' }}>{statusMsg}</div>}
      {errorMsg && <div style={{ color: 'var(--error, #ef4444)', marginBottom: '0.6rem', fontSize: '0.78rem' }}>{errorMsg}</div>}

      {/* Main Grid: Left Controls & Right Topography Map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>

        {/* Left: Experimental Controls (matching plstm flags) */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.7rem',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--fg)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
            ⚙️ STM Operational Parameters (plstm)
          </div>

          {/* Mode Selector: Constant-Current vs Constant-Height */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
              Imaging Mode (plstm -i vs -z):
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${stmMode === 'constant-current' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '0.75rem' }}
                onClick={() => setStmMode('constant-current')}
                title="Constant-Current Mode (-i): Apparent height z(x,y) isosurface (standard experimental STM)">
                Constant-Current z(x,y)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${stmMode === 'constant-height' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '0.75rem' }}
                onClick={() => setStmMode('constant-height')}
                title="Constant-Height Mode (-z): Tunneling current I(x,y) at fixed tip height">
                Constant-Height I(x,y)
              </button>
            </div>
          </div>

          {/* Bias Voltage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Sample Bias Voltage (V_bias):</span>
              <strong style={{ color: parseFloat(biasVoltage) < 0 ? '#38bdf8' : '#fbbf24', fontFamily: 'monospace' }}>
                {parseFloat(biasVoltage) > 0 ? '+' : ''}{parseFloat(biasVoltage).toFixed(2)} V ({parseFloat(biasVoltage) < 0 ? 'Occupied States / VB' : 'Unoccupied States / CB'})
              </strong>
            </div>
            <input
              type="range"
              min="-3.0"
              max="3.0"
              step="0.1"
              value={biasVoltage}
              onChange={e => setBiasVoltage(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          {/* Tip Height or Setpoint */}
          {stmMode === 'constant-height' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Tip Height z_tip (-z flag):</span>
                <strong style={{ fontFamily: 'monospace' }}>{tipHeight} Å above surface</strong>
              </div>
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.1"
                value={tipHeight}
                onChange={e => setTipHeight(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Current Setpoint I_set (-i flag):</span>
                <strong style={{ fontFamily: 'monospace' }}>{currentSetpoint}</strong>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.20"
                step="0.01"
                value={currentSetpoint}
                onChange={e => setCurrentSetpoint(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* Colormap & Display Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Colormap:</label>
              <select
                className="input select"
                style={{ fontSize: '0.75rem', height: '28px' }}
                value={colormapKey}
                onChange={e => setColormapKey(e.target.value)}>
                {Object.entries(COLORMAPS).map(([k, cm]) => (
                  <option key={k} value={k}>{cm.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Supercell Scan Area:</label>
              <select
                className="input select"
                style={{ fontSize: '0.75rem', height: '28px' }}
                value={supercellRepeat}
                onChange={e => setSupercellRepeat(parseInt(e.target.value, 10))}>
                <option value={1}>1 × 1 (Single Cell)</option>
                <option value={2}>2 × 2 (Wide Scan)</option>
                <option value={3}>3 × 3 (Large Area)</option>
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.2rem' }}>
            <label className="toggle" style={{ fontSize: '0.75rem' }}>
              <input
                type="checkbox"
                checked={showAtomsOverlay}
                onChange={e => setShowAtomsOverlay(e.target.checked)}
              />
              <span className="toggle-label">Overlay Surface Atoms</span>
            </label>
          </div>

          {/* Official plstm Command Box */}
          <div style={{
            background: '#090d16',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            padding: '0.6rem',
            marginTop: '0.4rem',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, marginBottom: '0.2rem' }}>
              💻 Official SIESTA Utility Command (Util/STM/simple-stm/plstm):
            </div>
            <code style={{ fontSize: '0.7rem', color: '#e2e8f0', display: 'block', wordBreak: 'break-all' }}>
              {stmMode === 'constant-current'
                ? `plstm -i ${currentSetpoint} -s q SystemLabel.LDOS`
                : `plstm -z ${tipHeight} -s q SystemLabel.LDOS`}
            </code>
          </div>
        </div>

        {/* Right: Simulated 2D Topography & Cross-Section Profile */}
        <div style={{
          background: '#0f172a',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          padding: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.6rem',
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>
              Simulated Topography Map ({stmGrid ? `${stmGrid.ax.toFixed(1)} × ${stmGrid.ay.toFixed(1)} Å` : ''})
            </div>
            {stmGrid && (
              <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
                Corrugation Δz = {stmGrid.corrugation.toFixed(3)} Å
              </span>
            )}
          </div>

          {/* 2D Canvas */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px', aspectRatio: '1/1' }}>
            <canvas
              ref={canvas2dRef}
              width={380}
              height={380}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          </div>

          {/* 1D Line Cut Profile Control */}
          <div style={{ width: '100%', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              <span>Line Cut Profile (red dashed line):</span>
              <span>Y = {(lineCutY * (stmGrid?.ay || 12.6)).toFixed(2)} Å</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={lineCutY}
              onChange={e => setLineCutY(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
            />
          </div>

          {/* 1D Line Cut Cross-Section Graph */}
          {lineProfile && (
            <div style={{
              width: '100%',
              background: '#090d16',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              padding: '0.4rem 0.6rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                <span>1D Corrugation Profile along X-cut:</span>
                <strong style={{ color: '#38bdf8' }}>Δz = {lineProfile.corrugation.toFixed(3)} Å</strong>
              </div>

              {/* Mini SVG Profile */}
              <svg viewBox="0 0 340 70" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {(() => {
                  const pW = 320;
                  const pH = 50;
                  const padL = 10;
                  const padT = 10;
                  const span = lineProfile.maxP - lineProfile.minP || 0.1;
                  let d = '';
                  lineProfile.yVals.forEach((y, i) => {
                    const px = padL + (i / (lineProfile.yVals.length - 1)) * pW;
                    const py = padT + pH - ((y - lineProfile.minP) / span) * pH;
                    d += i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
                  });
                  return (
                    <g>
                      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="2.0" />
                      <line x1={padL} y1={padT + pH} x2={padL + pW} y2={padT + pH} stroke="rgba(148,163,184,0.3)" />
                    </g>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default STMVisualizer;
