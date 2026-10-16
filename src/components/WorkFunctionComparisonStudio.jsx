import React, { useState, useRef, useMemo } from 'react';
import { parseSiestaOut } from '../parser/outParser.js';
import { parse1DPotentialData, parsePotentialCube, analyzeWorkFunction } from '../parser/workFunctionParser.js';

const SURFACE_PALETTE = [
  '#38bdf8', // 1: Sky Blue (Clean Reference)
  '#10b981', // 2: Emerald Green (Ligand A - WF Reduction)
  '#ec4899', // 3: Rose Pink (Ligand B - WF Increase)
  '#f59e0b', // 4: Amber Orange
  '#8b5cf6', // 5: Violet Purple
  '#06b6d4', // 6: Cyan
];

/**
 * Helmholtz formula for surface normal dipole moment:
 *   ΔΦ = - e * μ_z / (ε_0 * A)
 *   μ_z (e·Å) = - (ε_0 / e) * A * ΔΦ
 *   μ_z (Debye) = μ_z (e·Å) * 4.803204
 */
export function calculateSurfaceDipole(deltaPhiEV, areaAngSq) {
  if (!isFinite(deltaPhiEV) || !isFinite(areaAngSq) || areaAngSq <= 0) {
    return { mu_eAng: 0, mu_Debye: 0 };
  }
  // (ε_0 / e) in e / (V · Å) = 0.00552635
  const eps0_over_e_Ang = 0.005526349;
  const mu_eAng = -eps0_over_e_Ang * areaAngSq * deltaPhiEV;
  const mu_Debye = mu_eAng * 4.803204;
  return {
    mu_eAng: parseFloat(mu_eAng.toFixed(4)),
    mu_Debye: parseFloat(mu_Debye.toFixed(3)),
  };
}

/**
 * Generate synthetic realistic potential profile
 */
function createSyntheticSurface(id, name, color, ef, vVac, slabEnd = 18.0, ligEnd = null, zMax = 34.0) {
  const n = 280;
  const dz = zMax / (n - 1);
  const z = [];
  const vPlanar = [];

  const slabLayers = [5.5, 8.5, 11.5, 14.5, 17.5];
  const slabDepth = ef - 16.0;

  for (let i = 0; i < n; i++) {
    const zi = i * dz;
    z.push(zi);

    let pot;
    if (zi <= slabEnd) {
      // Substrate slab region
      const env = 0.5 * (1 - Math.tanh((zi - (slabEnd - 0.5)) / 1.0)) *
                  0.5 * (1 + Math.tanh((zi - 4.5) / 1.0));
      const baseDrop = (slabDepth - vVac) * env;
      let coreOsc = 0;
      slabLayers.forEach(lz => {
        if (lz < slabEnd) coreOsc += -12.0 * Math.exp(-Math.pow((zi - lz) / 0.8, 2));
      });
      pot = vVac + baseDrop + coreOsc;
    } else if (ligEnd && zi <= ligEnd) {
      // Ligand layer with dipole step
      const t = (zi - slabEnd) / (ligEnd - slabEnd);
      const dipoleDrop = (vVac - (ef - 2.0)) * Math.sin(t * Math.PI) * 0.35;
      pot = vVac - (1 - t) * 0.5 - dipoleDrop;
    } else {
      // Vacuum plateau
      const vacStart = ligEnd || slabEnd;
      const t = (zi - vacStart) / 1.8;
      pot = vVac - 0.08 * Math.exp(-t);
      if (zi >= vacStart + 2.5) {
        pot = vVac;
      }
    }
    vPlanar.push(parseFloat(pot.toFixed(4)));
  }

  const phi = vVac - ef;
  return {
    id,
    name,
    color,
    visible: true,
    ef,
    vVac,
    phi: parseFloat(phi.toFixed(3)),
    z,
    vPlanar,
    slabEnd,
    ligEnd,
    zMax,
    vbmOffset: -0.15, // VBM relative to Ef
    cbmOffset: 1.45,  // CBM relative to Ef
  };
}

export const WORK_FUNCTION_PRESETS = {
  perovskite: {
    title: 'Perovskite Passivation: Clean FAPbI₃ vs PEA vs 4-F-PEA',
    desc: 'Alkylammonium ligand (PEA) creates an outward dipole reducing Φ by 0.55 eV (enhancing electron injection), while fluorinated 4-F-PEA introduces an electron-withdrawing dipole increasing Φ by 0.40 eV.',
    area: '160.0',
    surfaces: [
      createSyntheticSurface('s-clean', 'Clean FAPbI₃ (001) Slab', '#38bdf8', -4.35, 0.30, 18.0, null),
      createSyntheticSurface('s-pea', 'Passivated with PEA (Alkylamine)', '#10b981', -4.35, -0.25, 18.0, 23.0),
      createSyntheticSurface('s-fpea', 'Passivated with 4-F-PEA (Fluorinated)', '#ec4899', -4.35, 0.70, 18.0, 23.0),
    ],
  },
  fasni3: {
    title: 'Lead-Free FASnI₃ Interface: Clean Slab vs Ethylenediamine (EDA)',
    desc: 'Diamine passivation (EDA) binds coordinate bonds to surface Sn atoms, eliminating surface Sn vacancies and reducing the work function by 0.58 eV.',
    area: '158.0',
    surfaces: [
      createSyntheticSurface('sn-clean', 'Clean FASnI₃ Slab', '#38bdf8', -4.10, 0.30, 18.0, null),
      createSyntheticSurface('sn-eda', 'EDA Passivated FASnI₃', '#10b981', -4.10, -0.28, 18.0, 22.5),
    ],
  },
  sam: {
    title: 'Electrode Interface Engineering: Bare ITO vs 2PACz Carbazole SAM',
    desc: 'Self-assembled monolayer (2PACz) on transparent conductive oxide induces a strong positive surface dipole, increasing the work function from 4.80 eV to 5.45 eV for lossless hole extraction in inverted p-i-n perovskite solar cells.',
    area: '120.0',
    surfaces: [
      createSyntheticSurface('sam-bare', 'Bare ITO Electrode', '#38bdf8', -4.80, 0.00, 16.0, null),
      createSyntheticSurface('sam-2pacz', 'ITO + 2PACz Carbazole SAM', '#ec4899', -4.80, 0.65, 16.0, 21.0),
    ],
  },
};

export function WorkFunctionComparisonStudio() {
  const fileInputRef = useRef(null);

  // Active comparison surface states
  const [surfaces, setSurfaces] = useState(WORK_FUNCTION_PRESETS.perovskite.surfaces);
  const [activeMode, setActiveMode] = useState('overlay'); // 'overlay' | 'alignment' | 'diff' | 'table'
  const [surfaceArea, setSurfaceArea] = useState(WORK_FUNCTION_PRESETS.perovskite.area);
  const [hoverZ, setHoverZ] = useState(null);

  // Difference view selectors (Ref A vs Target B)
  const [diffRefId, setDiffRefId] = useState(surfaces[0]?.id || '');
  const [diffTargetId, setDiffTargetId] = useState(surfaces[1]?.id || '');

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Upload new surface potential (.out, .cube, or 1D .dat)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lower = file.name.toLowerCase();
        const sysName = file.name.replace(/\.[^/.]+$/, '');
        const color = SURFACE_PALETTE[surfaces.length % SURFACE_PALETTE.length];

        let newSurf = null;

        // Option A: SIESTA .out log file
        if (text.includes('dhscf:') || text.includes('siesta:') || lower.endsWith('.out') || lower.endsWith('.log')) {
          const parsed = parseSiestaOut(text);
          if (parsed.fermiEnergy === null) {
            throw new Error(`Could not find Fermi energy in ${file.name}. Ensure SCF converged.`);
          }
          const ef = parsed.fermiEnergy;
          const vVac = parsed.vacuumLevelMax !== null ? parsed.vacuumLevelMax : (parsed.vacuumLevelMean !== null ? parsed.vacuumLevelMean : 0);
          newSurf = createSyntheticSurface(`surf-${Date.now()}`, sysName, color, ef, vVac, 18.0, 22.0);
        } else if (lower.endsWith('.cube')) {
          const analyzed = parsePotentialCube(text, -4.35);
          newSurf = {
            id: `surf-${Date.now()}`,
            name: sysName,
            color,
            visible: true,
            ef: analyzed.eFermi,
            vVac: analyzed.vVacuum,
            phi: analyzed.workFunction,
            z: analyzed.z,
            vPlanar: analyzed.vPlanar,
            slabEnd: 18.0,
            ligEnd: 22.0,
            zMax: analyzed.zMax,
            vbmOffset: -0.15,
            cbmOffset: 1.45,
          };
        } else {
          // Option C: 1D potential data
          const analyzed = parse1DPotentialData(text, -4.35);
          newSurf = {
            id: `surf-${Date.now()}`,
            name: sysName,
            color,
            visible: true,
            ef: analyzed.eFermi,
            vVac: analyzed.vVacuum,
            phi: analyzed.workFunction,
            z: analyzed.z,
            vPlanar: analyzed.vPlanar,
            slabEnd: 18.0,
            ligEnd: 22.0,
            zMax: analyzed.zMax,
            vbmOffset: -0.15,
            cbmOffset: 1.45,
          };
        }

        setSurfaces(prev => [...prev, newSurf]);
        setStatusMsg(`✓ Added surface state: ${newSurf.name} (Φ = ${newSurf.phi.toFixed(3)} eV)`);
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Load Preset
  const handleLoadPreset = (key) => {
    const preset = WORK_FUNCTION_PRESETS[key];
    if (!preset) return;
    setSurfaces(preset.surfaces);
    setSurfaceArea(preset.area);
    setDiffRefId(preset.surfaces[0]?.id || '');
    setDiffTargetId(preset.surfaces[1]?.id || '');
    setStatusMsg(`✓ Loaded surface comparison preset: ${preset.title}`);
  };

  // Toggle Visibility
  const handleToggleVisibility = (id) => {
    setSurfaces(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  // Color change
  const handleColorChange = (id, newColor) => {
    setSurfaces(prev => prev.map(s => s.id === id ? { ...s, color: newColor } : s));
  };

  // Rename
  const handleRename = (id, newName) => {
    setSurfaces(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  // Remove
  const handleRemove = (id) => {
    setSurfaces(prev => prev.filter(s => s.id !== id));
  };

  const activeSurfaces = useMemo(() => surfaces.filter(s => s.visible), [surfaces]);
  const refSurface = surfaces[0] || null;

  // Global Z range across active surfaces
  const zMaxAll = useMemo(() => {
    return Math.max(25, ...surfaces.map(s => s.zMax || 32));
  }, [surfaces]);

  // Global Y bounds for potential profiles
  const { minV_all, maxV_all } = useMemo(() => {
    let minV = -10, maxV = 2;
    activeSurfaces.forEach(s => {
      s.vPlanar.forEach(v => {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      });
      if (s.ef < minV) minV = s.ef;
      if (s.vVac > maxV) maxV = s.vVac;
    });
    return { minV_all: minV * 1.05, maxV_all: maxV + 1.2 };
  }, [activeSurfaces]);

  // SVG Chart dimensions
  const width = 860;
  const height = 400;
  const margin = { top: 35, right: 35, bottom: 45, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const getX = (zVal) => margin.left + (zVal / zMaxAll) * plotW;
  const getY = (vVal) => margin.top + plotH - ((vVal - minV_all) / (maxV_all - minV_all)) * plotH;

  const createPath = (zArr, vArr) => {
    let d = '';
    for (let i = 0; i < zArr.length; i++) {
      const x = getX(zArr[i]);
      const y = getY(vArr[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  // Difference profile ΔV(z)
  const diffPotential = useMemo(() => {
    const sA = surfaces.find(s => s.id === diffRefId);
    const sB = surfaces.find(s => s.id === diffTargetId);
    if (!sA || !sB || !sA.z || !sB.z) return null;

    const n = Math.min(sA.z.length, sB.z.length);
    const zCommon = [];
    const diffV = [];
    let maxDiffAbs = 0.1;

    for (let i = 0; i < n; i++) {
      zCommon.push(sA.z[i]);
      const dV = sB.vPlanar[i] - sA.vPlanar[i];
      diffV.push(dV);
      if (Math.abs(dV) > maxDiffAbs) maxDiffAbs = Math.abs(dV);
    }

    return {
      z: zCommon,
      diffV,
      maxDiffAbs: maxDiffAbs * 1.15,
      nameA: sA.name,
      nameB: sB.name,
      deltaPhi: sB.phi - sA.phi,
      deltaV_vac: sB.vVac - sA.vVac,
    };
  }, [surfaces, diffRefId, diffTargetId]);

  // Export CSV Comparison
  const handleExportCSV = () => {
    let csv = 'Surface State,Vacuum Level V_vac (eV),Fermi Level E_F (eV),Work Function Phi (eV),Delta Phi Shift (eV),Surface Dipole (Debye),Surface Dipole (e*Ang),Interface Effect\n';
    const area = parseFloat(surfaceArea) || 160.0;
    const refPhi = refSurface?.phi ?? 0;

    surfaces.forEach((s, idx) => {
      const deltaPhi = idx > 0 ? (s.phi - refPhi) : 0;
      const dipole = idx > 0 ? calculateSurfaceDipole(deltaPhi, area) : { mu_eAng: 0, mu_Debye: 0 };
      const effect = idx === 0 ? 'Clean Reference' : (deltaPhi < 0 ? `Work Function Reduction (by ${Math.abs(deltaPhi).toFixed(3)} eV)` : `Work Function Increase (by ${deltaPhi.toFixed(3)} eV)`);
      csv += `"${s.name}",${s.vVac.toFixed(3)},${s.ef.toFixed(3)},${s.phi.toFixed(3)},${deltaPhi.toFixed(3)},${dipole.mu_Debye},${dipole.mu_eAng},"${effect}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'siesta_workfunction_comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workfunction-comparison-studio" style={{ marginTop: '0.5rem' }}>
      {/* Studio Header & View Switcher */}
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
        marginBottom: '1rem',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⚡ Multi-Surface Work Function &amp; Ligand Dipole Comparison Studio</span>
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
              {surfaces.length} Surface States
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Compare clean slab vs ligand-adsorbed surfaces: quantify work function reductions (ΔΦ), electrostatic potential steps, and molecular dipole moments (μ_z).
          </p>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeMode === 'overlay' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('overlay')}>
            📈 Overlaid Potential V̄(z)
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'alignment' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('alignment')}>
            📶 Energy Level Diagram
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'diff' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('diff')}>
            Δ Dipole Step (ΔV̄)
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('table')}>
            📋 Comparison Table
          </button>
        </div>
      </div>

      {/* Surface States Management Ribbon */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.8rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
              ➕ Add Surface State (.out, .cube, .dat)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".out,.log,.cube,.dat,.txt"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {/* Quick Demo Presets */}
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Scientific Presets:</span>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('perovskite')} title="FAPbI3 (001): Clean vs PEA vs 4-F-PEA">
              FAPbI₃ Passivation (PEA / 4-F-PEA)
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('fasni3')} title="FASnI3: Clean vs EDA Diamine">
              FASnI₃ Diamine Passivation
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('sam')} title="Electrode: Bare ITO vs 2PACz Carbazole SAM">
              Electrode SAM (2PACz)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Surface Area A:</span>
              <input
                type="number"
                step="5.0"
                className="input mono"
                style={{ width: '65px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
                value={surfaceArea}
                onChange={e => setSurfaceArea(e.target.value)}
                title="Unit cell surface area in Å² for Helmholtz dipole calculation"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Å²</span>
            </div>

            <button className="btn btn-secondary btn-xs" onClick={handleExportCSV} title="Export comparative metrics to CSV">
              📥 Export CSV
            </button>
            {surfaces.length > 0 && (
              <button className="btn btn-secondary btn-xs" style={{ color: 'var(--error, #ef4444)' }} onClick={() => setSurfaces([])}>
                ✕ Clear All
              </button>
            )}
          </div>
        </div>

        {/* Surface Cards List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
          {surfaces.map((s, idx) => {
            const isRef = idx === 0;
            const deltaPhi = !isRef && refSurface ? (s.phi - refSurface.phi) : 0;
            const dipole = !isRef && refSurface ? calculateSurfaceDipole(deltaPhi, parseFloat(surfaceArea) || 160.0) : null;

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  background: 'var(--surface2)',
                  border: `1px solid ${s.visible ? s.color : 'var(--border)'}`,
                  opacity: s.visible ? 1 : 0.5,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                  <input
                    type="color"
                    value={s.color}
                    onChange={e => handleColorChange(s.id, e.target.value)}
                    style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    title="Change surface color"
                  />
                  <input
                    className="input mono"
                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.35rem', height: '24px', flex: 1 }}
                    value={s.name}
                    onChange={e => handleRename(s.id, e.target.value)}
                    title="Click to rename"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, color: '#e2e8f0' }}>
                    Φ={s.phi.toFixed(2)} eV
                  </span>

                  {!isRef && (
                    <span style={{
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '0.1rem 0.3rem',
                      borderRadius: '3px',
                      background: deltaPhi < 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                      color: deltaPhi < 0 ? '#10b981' : '#ec4899',
                    }} title={`Surface normal dipole: ${dipole?.mu_Debye} Debye`}>
                      {deltaPhi < 0 ? '▼ ' : '▲ +'}{Math.abs(deltaPhi).toFixed(2)} eV
                    </span>
                  )}
                  {isRef && (
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'var(--accent)', color: '#fff' }}>
                      Clean Ref
                    </span>
                  )}

                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                    onClick={() => handleToggleVisibility(s.id)}
                    title={s.visible ? 'Hide profile' : 'Show profile'}>
                    {s.visible ? '👁️' : '🙈'}
                  </button>

                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--muted)', padding: '0 2px' }}
                    onClick={() => handleRemove(s.id)}
                    title="Remove surface">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {statusMsg && <div style={{ color: 'var(--success, #10b981)', marginTop: '0.5rem', fontSize: '0.78rem' }}>{statusMsg}</div>}
        {errorMsg && <div style={{ color: 'var(--error, #ef4444)', marginTop: '0.5rem', fontSize: '0.78rem' }}>{errorMsg}</div>}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 1: OVERLAID POTENTIAL PROFILES V̄(z)                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'overlay' && (
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
                const zVal = ((svgX - margin.left) / plotW) * zMaxAll;
                setHoverZ(parseFloat(zVal.toFixed(2)));
              }
            }}
            onMouseLeave={() => setHoverZ(null)}>

            {/* Shaded Regions: Slab, Ligand Interface, Vacuum Gap */}
            <rect
              x={margin.left}
              y={margin.top}
              width={Math.max(0, getX(18.0) - margin.left)}
              height={plotH}
              fill="rgba(51, 65, 85, 0.22)"
            />
            <text x={margin.left + (getX(18.0) - margin.left) / 2} y={margin.top + 18} fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle">
              Substrate Slab
            </text>

            <rect
              x={getX(18.0)}
              y={margin.top}
              width={Math.max(0, getX(23.0) - getX(18.0))}
              height={plotH}
              fill="rgba(245, 158, 11, 0.12)"
            />
            <text x={getX(20.5)} y={margin.top + 18} fill="#fbbf24" fontSize="10" fontWeight="600" textAnchor="middle">
              Ligand Interface
            </text>

            <text x={getX(28.0)} y={margin.top + 18} fill="#38bdf8" fontSize="11" fontWeight="600" textAnchor="middle">
              Vacuum Gap (Plateau)
            </text>

            {/* Grid ticks Z */}
            {[0, 5, 10, 15, 20, 25, 30].map(t => {
              if (t > zMaxAll) return null;
              const x = getX(t);
              return (
                <g key={t}>
                  <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.10)" strokeDasharray="2,2" />
                  <text x={x} y={margin.top + plotH + 18} fill="#94a3b8" fontSize="11" fontFamily="monospace" textAnchor="middle">
                    {t}
                  </text>
                </g>
              );
            })}

            {/* Grid ticks V */}
            {[-15, -10, -5, 0].map(vTick => {
              const y = getY(vTick);
              return (
                <g key={vTick}>
                  <line x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} stroke="rgba(148, 163, 184, 0.10)" strokeDasharray="2,2" />
                  <text x={margin.left - 8} y={y + 3} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                    {vTick} eV
                  </text>
                </g>
              );
            })}

            {/* Overlaid Potential Curves */}
            {activeSurfaces.map(s => {
              const d = createPath(s.z, s.vPlanar);
              const vacY = getY(s.vVac);
              const efY = getY(s.ef);

              return (
                <g key={s.id}>
                  {/* Potential profile line */}
                  <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" />

                  {/* Horizontal Vacuum Plateau Level */}
                  <line
                    x1={getX(22.0)}
                    y1={vacY}
                    x2={margin.left + plotW}
                    y2={vacY}
                    stroke={s.color}
                    strokeWidth="1.8"
                    strokeDasharray="4,3"
                  />
                  <text
                    x={margin.left + plotW - 4}
                    y={vacY - 5}
                    fill={s.color}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="700"
                    textAnchor="end">
                    {s.name.substring(0, 14)}: V_vac = {s.vVac.toFixed(2)} eV (Φ = {s.phi.toFixed(2)} eV)
                  </text>
                </g>
              );
            })}

            {/* Shared Fermi Level Reference Line */}
            {refSurface && (
              <g>
                <line
                  x1={margin.left}
                  y1={getY(refSurface.ef)}
                  x2={margin.left + plotW}
                  y2={getY(refSurface.ef)}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                />
                <text
                  x={margin.left + 8}
                  y={getY(refSurface.ef) - 6}
                  fill="#ef4444"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="700">
                  E_F = {refSurface.ef.toFixed(2)} eV
                </text>
              </g>
            )}

            {/* Work Function Reduction Double-Headed Arrow between Clean and First Passivated */}
            {surfaces[0] && surfaces[1] && (
              <g>
                {(() => {
                  const arrowX = getX(24.5);
                  const y1 = getY(surfaces[0].vVac);
                  const y2 = getY(surfaces[1].vVac);
                  const deltaPhi = surfaces[1].phi - surfaces[0].phi;
                  return (
                    <g>
                      <line x1={arrowX} y1={y1} x2={arrowX} y2={y2} stroke="#10b981" strokeWidth="2.0" markerEnd="url(#arrow)" />
                      <rect x={arrowX - 45} y={(y1 + y2) / 2 - 10} width="90" height="20" rx="3" fill="rgba(15, 23, 42, 0.9)" stroke="#10b981" strokeWidth="1" />
                      <text x={arrowX} y={(y1 + y2) / 2 + 4} fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">
                        ΔΦ = {deltaPhi.toFixed(2)} eV
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* Axes */}
            <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
            <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />

            <text x={margin.left + plotW / 2} y={height - 8} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle">
              Distance Normal to Surface z (Å)
            </text>
            <text x={-height / 2} y={18} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" transform="rotate(-90)">
              Electrostatic Potential V̄(z) (eV)
            </text>

            {/* Hover Crosshair */}
            {hoverZ !== null && (
              <line x1={getX(hoverZ)} y1={margin.top} x2={getX(hoverZ)} y2={margin.top + plotH} stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="3,3" />
            )}
          </svg>

          {/* Interactive Hover Readout */}
          {hoverZ !== null && (
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '80px',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.4rem 0.65rem',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 10,
            }}>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.2rem' }}>
                z = {hoverZ.toFixed(2)} Å
              </div>
              {activeSurfaces.map(s => {
                const idx = Math.min(s.z.length - 1, Math.max(0, Math.round((hoverZ / zMaxAll) * (s.z.length - 1))));
                const val = s.vPlanar[idx] ?? s.vVac;
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', color: s.color }}>
                    <span>{s.name.substring(0, 16)}:</span>
                    <strong>{val.toFixed(2)} eV</strong>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.8rem',
            justifyContent: 'center',
            marginTop: '0.8rem',
            paddingTop: '0.6rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
          }}>
            {activeSurfaces.map((s, idx) => {
              const deltaPhi = idx > 0 && refSurface ? (s.phi - refSurface.phi) : 0;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color }} />
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                    (Φ = {s.phi.toFixed(2)} eV{idx > 0 ? `, ΔΦ = ${deltaPhi > 0 ? '+' : ''}${deltaPhi.toFixed(2)} eV` : ''})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 2: ENERGY LEVEL & BAND ALIGNMENT DIAGRAM (BEFORE VS AFTER)   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'alignment' && (
        <div style={{
          background: '#0f172a',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          padding: '1.2rem',
        }}>
          <h4 style={{ margin: '0 0 0.8rem', color: '#e2e8f0', fontSize: '0.9rem', textAlign: 'center' }}>
            Energy Level Alignment &amp; Work Function Modification Schematic
          </h4>

          {/* SVG Diagram */}
          <svg viewBox="0 0 860 340" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Top Vacuum Level Line (0 eV) */}
            <line x1="60" y1="40" x2="800" y2="40" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="70" y="32" fill="#38bdf8" fontSize="12" fontWeight="700" fontFamily="monospace">
              E_vacuum = 0.00 eV (Absolute Vacuum Reference)
            </text>

            {/* Energy Level Columns for Each Surface State */}
            {surfaces.map((s, idx) => {
              const colW = 160;
              const gapX = (800 - 120 - surfaces.length * colW) / Math.max(1, surfaces.length - 1);
              const colX = 120 + idx * (colW + Math.max(20, gapX));

              // Map energy to Y coordinate (0 eV at Y = 40, -6 eV at Y = 300)
              const scaleE = (eVal) => 40 + Math.abs(eVal) * 42;

              const phiY = scaleE(-s.phi);
              const vbmY = scaleE(-s.phi + s.vbmOffset);
              const cbmY = scaleE(-s.phi + s.cbmOffset);

              const isRef = idx === 0;
              const deltaPhi = !isRef && refSurface ? (s.phi - refSurface.phi) : 0;

              return (
                <g key={s.id}>
                  {/* Column Background Tint */}
                  <rect
                    x={colX}
                    y={40}
                    width={colW}
                    height={280}
                    rx="6"
                    fill="rgba(30, 41, 59, 0.4)"
                    stroke={s.color}
                    strokeWidth="1.2"
                  />

                  {/* Header Title */}
                  <text x={colX + colW / 2} y={65} fill={s.color} fontSize="11" fontWeight="700" textAnchor="middle">
                    {s.name.substring(0, 18)}
                  </text>
                  <text x={colX + colW / 2} y={80} fill="var(--muted)" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {isRef ? '(Clean Reference)' : `ΔΦ = ${deltaPhi > 0 ? '+' : ''}${deltaPhi.toFixed(2)} eV`}
                  </text>

                  {/* Work Function Downward Arrow from Vacuum Level */}
                  <line x1={colX + 35} y1={40} x2={colX + 35} y2={phiY} stroke={s.color} strokeWidth="2" />
                  <polygon
                    points={`${colX + 35},${phiY} ${colX + 31},${phiY - 8} ${colX + 39},${phiY - 8}`}
                    fill={s.color}
                  />
                  <rect x={colX + 42} y={(40 + phiY) / 2 - 9} width="65" height="18" rx="3" fill="#0f172a" stroke={s.color} strokeWidth="1" />
                  <text x={colX + 74} y={(40 + phiY) / 2 + 4} fill={s.color} fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="middle">
                    Φ = {s.phi.toFixed(2)} eV
                  </text>

                  {/* Fermi Level E_F Line */}
                  <line x1={colX + 15} y1={phiY} x2={colX + colW - 15} y2={phiY} stroke="#ef4444" strokeWidth="2" strokeDasharray="4,2" />
                  <text x={colX + colW - 20} y={phiY - 4} fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">
                    E_F
                  </text>

                  {/* Conduction Band Minimum (CBM) Level */}
                  <line x1={colX + 25} y1={cbmY} x2={colX + colW - 25} y2={cbmY} stroke="#38bdf8" strokeWidth="2.5" />
                  <text x={colX + 28} y={cbmY - 5} fill="#38bdf8" fontSize="10" fontWeight="600">
                    CBM ({(-s.phi + s.cbmOffset).toFixed(2)} eV)
                  </text>

                  {/* Valence Band Maximum (VBM) Level */}
                  <line x1={colX + 25} y1={vbmY} x2={colX + colW - 25} y2={vbmY} stroke="#f59e0b" strokeWidth="2.5" />
                  <text x={colX + 28} y={vbmY + 14} fill="#f59e0b" fontSize="10" fontWeight="600">
                    VBM ({(-s.phi + s.vbmOffset).toFixed(2)} eV)
                  </text>

                  {/* Band Gap Shading */}
                  <rect
                    x={colX + 25}
                    y={cbmY}
                    width={colW - 50}
                    height={Math.max(0, vbmY - cbmY)}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeDasharray="2,2"
                  />
                  <text x={colX + colW / 2} y={(cbmY + vbmY) / 2 + 4} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                    E_g ≈ 1.60 eV
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Physical Interpretation Box */}
          <div className="info-box" style={{ marginTop: '0.8rem' }}>
            <strong>💡 Band Alignment &amp; Injection Barrier Interpretation:</strong>
            <ul style={{ paddingLeft: '1.2rem', margin: '0.3rem 0 0', lineHeight: '1.6' }}>
              <li><strong>Work Function Reduction (ΔΦ &lt; 0):</strong> The ligand surface dipole pushes the vacuum level down, lowering the work function $\Phi$ and reducing the barrier for electron extraction/injection into the electrode.</li>
              <li><strong>Work Function Increase (ΔΦ &gt; 0):</strong> Electron-withdrawing ligands (e.g. fluorinated groups) pull electron density away, raising the work function $\Phi$ to align with deep valence bands for hole extraction.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 3: DIFFERENCE POTENTIAL PROFILE (ΔV̄)                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'diff' && (
        <div style={{
          background: '#0f172a',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          padding: '1rem',
        }}>
          {/* Selectors for Reference vs Target */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--surface2)',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Reference Surface (A, Clean Slab):</span>
              <select
                className="input select"
                style={{ fontSize: '0.78rem', height: '28px' }}
                value={diffRefId}
                onChange={e => setDiffRefId(e.target.value)}>
                {surfaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <span style={{ fontWeight: 700, color: '#fbbf24' }}>➔ Subtract from ➔</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Passivated Surface (B):</span>
              <select
                className="input select"
                style={{ fontSize: '0.78rem', height: '28px' }}
                value={diffTargetId}
                onChange={e => setDiffTargetId(e.target.value)}>
                {surfaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
              ΔV̄(z) = V̄_passivated(z) − V̄_clean(z)
            </div>
          </div>

          {diffPotential && (
            <>
              <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Zero line */}
                <line
                  x1={margin.left}
                  y1={margin.top + plotH / 2}
                  x2={margin.left + plotW}
                  y2={margin.top + plotH / 2}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />

                {/* Shaded Ligand Dipole Layer */}
                <rect
                  x={getX(18.0)}
                  y={margin.top}
                  width={Math.max(0, getX(23.0) - getX(18.0))}
                  height={plotH}
                  fill="rgba(245, 158, 11, 0.15)"
                />
                <text x={getX(20.5)} y={margin.top + 20} fill="#fbbf24" fontSize="11" fontWeight="700" textAnchor="middle">
                  Surface Dipole Layer
                </text>

                {/* Grid ticks Z */}
                {[0, 5, 10, 15, 20, 25, 30].map(t => (
                  <text key={t} x={getX(t)} y={margin.top + plotH + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">
                    {t} Å
                  </text>
                ))}

                {/* Differential Potential Curve */}
                {(() => {
                  const getDY = (val) => margin.top + plotH / 2 - (val / diffPotential.maxDiffAbs) * (plotH / 2);
                  const pathD = createPath(diffPotential.z, diffPotential.diffV);
                  return (
                    <g>
                      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" />
                    </g>
                  );
                })()}

                {/* Y-axis labels */}
                <text x={margin.left - 8} y={margin.top + 10} fill="#10b981" fontSize="10" textAnchor="end">
                  +{diffPotential.maxDiffAbs.toFixed(2)} eV
                </text>
                <text x={margin.left - 8} y={margin.top + plotH / 2 + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                  0.00
                </text>
                <text x={margin.left - 8} y={margin.top + plotH} fill="#ef4444" fontSize="10" textAnchor="end">
                  −{diffPotential.maxDiffAbs.toFixed(2)} eV
                </text>

                <text x={margin.left + plotW / 2} y={height - 8} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle">
                  Distance Normal to Surface z (Å)
                </text>
                <text x={-height / 2} y={18} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" transform="rotate(-90)">
                  Differential Potential ΔV̄(z) (eV)
                </text>
              </svg>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.8rem', fontSize: '0.82rem' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>
                  Dipole Potential Step in Vacuum: ΔV_vac = {diffPotential.deltaV_vac.toFixed(3)} eV
                </span>
                <span style={{ color: diffPotential.deltaPhi < 0 ? '#10b981' : '#ec4899', fontWeight: 700 }}>
                  Work Function Modification: ΔΦ = {diffPotential.deltaPhi > 0 ? '+' : ''}{diffPotential.deltaPhi.toFixed(3)} eV
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 4: COMPREHENSIVE SURFACE COMPARISON TABLE                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'table' && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.6rem 0.8rem' }}>Surface State</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Status</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Vacuum Level V_vac</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Fermi Level E_F</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Work Function Φ</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>ΔΦ Shift</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Surface Dipole μ_z</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Interface Band Effect</th>
              </tr>
            </thead>
            <tbody>
              {surfaces.map((s, idx) => {
                const isRef = idx === 0;
                const deltaPhi = !isRef && refSurface ? (s.phi - refSurface.phi) : 0;
                const area = parseFloat(surfaceArea) || 160.0;
                const dipole = !isRef && refSurface ? calculateSurfaceDipole(deltaPhi, area) : null;
                const isReduction = deltaPhi < 0;

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color }} />
                      <strong>{s.name}</strong>
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: isRef ? 'var(--accent)' : 'var(--surface2)',
                        color: isRef ? '#fff' : 'var(--fg)',
                      }}>
                        {isRef ? 'Clean Reference' : 'Passivated Slab'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{s.vVac.toFixed(3)} eV</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{s.ef.toFixed(3)} eV</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', fontWeight: 700, color: s.color }}>
                      {s.phi.toFixed(3)} eV
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', fontWeight: 700, color: isRef ? 'var(--muted)' : (isReduction ? '#10b981' : '#ec4899') }}>
                      {isRef ? '—' : `${deltaPhi > 0 ? '+' : ''}${deltaPhi.toFixed(3)} eV`}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>
                      {isRef ? '—' : `${dipole?.mu_Debye} D (${dipole?.mu_eAng} e·Å)`}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      {isRef ? (
                        <span style={{ color: 'var(--muted)' }}>Baseline Substrate</span>
                      ) : (
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: isReduction ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                          color: isReduction ? '#10b981' : '#ec4899',
                        }}>
                          {isReduction ? 'WF Reduced (Boosts Electron Extraction)' : 'WF Increased (Boosts Hole Extraction)'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WorkFunctionComparisonStudio;
