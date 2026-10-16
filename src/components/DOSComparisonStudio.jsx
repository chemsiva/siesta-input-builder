import React, { useState, useRef, useMemo } from 'react';
import { parseEIG, computeEig2DOS } from '../parser/eigParser.js';
import { parsePDOS, computePDOSCurves } from '../parser/pdosParser.js';

// Scientific comparison color palette
const COMPARISON_PALETTE = [
  '#38bdf8', // 1: Sky Blue
  '#f59e0b', // 2: Amber Orange
  '#10b981', // 3: Emerald Green
  '#ec4899', // 4: Rose Pink
  '#8b5cf6', // 5: Violet Purple
  '#06b6d4', // 6: Cyan
  '#f97316', // 7: Bright Orange
];

/**
 * Estimate Band Gap, VBM, and CBM from (energies, dos) where E = 0 is Fermi level
 */
export function estimateBandGap(energies, dos, thresholdFrac = 0.03) {
  if (!energies || !dos || energies.length === 0 || dos.length === 0) {
    return { isMetal: false, gap: null, vbm: null, cbm: null };
  }

  const maxDos = Math.max(...dos);
  if (maxDos <= 0) {
    return { isMetal: false, gap: null, vbm: null, cbm: null };
  }
  const threshold = maxDos * thresholdFrac;

  // Find index of E = 0 (Fermi level)
  let efIdx = 0;
  let minAbsE = Infinity;
  for (let i = 0; i < energies.length; i++) {
    const absE = Math.abs(energies[i]);
    if (absE < minAbsE) {
      minAbsE = absE;
      efIdx = i;
    }
  }

  // Check if metallic at Fermi level
  if (dos[efIdx] > threshold * 1.5) {
    return { isMetal: true, gap: 0, vbm: 0, cbm: 0 };
  }

  // Find VBM: search backwards from efIdx
  let vbmIdx = -1;
  for (let i = efIdx; i >= 0; i--) {
    if (dos[i] > threshold) {
      vbmIdx = i;
      break;
    }
  }

  // Find CBM: search forwards from efIdx
  let cbmIdx = -1;
  for (let i = efIdx; i < energies.length; i++) {
    if (dos[i] > threshold) {
      cbmIdx = i;
      break;
    }
  }

  if (vbmIdx === -1 || cbmIdx === -1) {
    return { isMetal: false, gap: null, vbm: null, cbm: null };
  }

  const vbm = energies[vbmIdx];
  const cbm = energies[cbmIdx];
  const gap = Math.max(0, parseFloat((cbm - vbm).toFixed(3)));

  return { isMetal: false, gap, vbm, cbm };
}

/**
 * Linear interpolation helper for Difference DOS
 */
function interpolate(energies, values, e) {
  if (e <= energies[0]) return values[0];
  if (e >= energies[energies.length - 1]) return values[values.length - 1];
  let low = 0, high = energies.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (energies[mid] <= e) low = mid;
    else high = mid;
  }
  const t = (e - energies[low]) / (energies[high] - energies[low]);
  return values[low] * (1 - t) + values[high] * t;
}

/**
 * Parse raw 2-column or 3-column Total DOS file (.DOS / .dat)
 */
export function parseRawDOS(text) {
  const lines = text.trim().split(/\r?\n/);
  const energies = [];
  const dosUp = [];
  const dosDown = [];
  let isSpinPol = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/).map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      energies.push(parts[0]);
      dosUp.push(parts[1]);
      if (parts.length >= 3 && !isNaN(parts[2])) {
        isSpinPol = true;
        dosDown.push(parts[2]);
      }
    }
  }

  if (energies.length === 0) {
    throw new Error('No valid numeric columns found in DOS file.');
  }

  return {
    format: 'DOS',
    energies,
    totalDosUp: dosUp,
    totalDosDown: isSpinPol ? dosDown : null,
    isSpinPol,
  };
}

/**
 * Generate synthetic realistic comparison dataset
 */
function createSyntheticDataset(id, name, color, ef, vbm, cbm, peakOffsets = [], defectPeak = null) {
  const energies = [];
  const dos = [];
  for (let e = -6.0; e <= 6.0; e += 0.02) {
    const energy = parseFloat(e.toFixed(2));
    energies.push(energy);

    let val = 0.001;
    // Valence band
    if (energy <= vbm) {
      val += Math.exp(-((energy - (vbm - 1.2)) ** 2) / 0.8) * 12;
      val += Math.exp(-((energy - (vbm - 2.5)) ** 2) / 1.2) * 9;
      val += Math.exp(-((energy - (vbm - 4.0)) ** 2) / 1.5) * 6;
      peakOffsets.forEach(po => {
        if (po.isVB) val += Math.exp(-((energy - po.pos) ** 2) / (po.w || 0.5)) * (po.h || 4);
      });
    }
    // Conduction band
    if (energy >= cbm) {
      val += Math.exp(-((energy - (cbm + 1.2)) ** 2) / 0.8) * 11;
      val += Math.exp(-((energy - (cbm + 2.8)) ** 2) / 1.4) * 8;
      val += Math.exp(-((energy - (cbm + 4.2)) ** 2) / 1.6) * 5;
      peakOffsets.forEach(po => {
        if (!po.isVB) val += Math.exp(-((energy - po.pos) ** 2) / (po.w || 0.5)) * (po.h || 4);
      });
    }
    // Defect / dopant state
    if (defectPeak && Math.abs(energy - defectPeak.pos) < defectPeak.width * 2.5) {
      val += Math.exp(-((energy - defectPeak.pos) ** 2) / (defectPeak.width ** 2)) * defectPeak.height;
    }

    dos.push(parseFloat(val.toFixed(4)));
  }

  const gap = parseFloat((cbm - vbm).toFixed(3));
  let intVal = 0;
  for (let i = 0; i < energies.length; i++) {
    if (energies[i] <= 0) intVal += dos[i] * 0.02;
  }

  return {
    id,
    name,
    color,
    visible: true,
    format: 'PDOS',
    fermiEnergy: ef,
    energies,
    totalDosUp: dos,
    totalDosDown: null,
    isSpinPol: false,
    speciesList: ['FA', 'Metal', 'Halogen'],
    metrics: {
      gap,
      vbm,
      cbm,
      isMetal: false,
      integratedValence: parseFloat(intVal.toFixed(1)),
    },
  };
}

export const DEMO_COMPARISONS = {
  perovskite: {
    title: 'Perovskite Cation/Metal Substitution (FAPbI₃ vs FASnI₃ vs CsPbI₃)',
    desc: 'B-site substitution (Pb → Sn) narrows the optical band gap from 1.55 eV to 1.30 eV, while A-site substitution (FA → Cs) widens the gap to 1.73 eV.',
    datasets: [
      createSyntheticDataset('p-fapbi3', 'FAPbI₃ (Pristine Reference)', '#38bdf8', -3.51, -0.05, 1.50),
      createSyntheticDataset('p-fasni3', 'FASnI₃ (Sn-Substituted)', '#f59e0b', -3.85, -0.02, 1.28),
      createSyntheticDataset('p-cspbi3', 'CsPbI₃ (Cs-Substituted)', '#10b981', -3.62, -0.08, 1.65),
    ],
  },
  defect: {
    title: 'Defect State & In-Gap Trap Physics (Pristine vs V_I vs V_Pb)',
    desc: 'Anion vacancy (V_I) introduces a donor trap state near the conduction band edge, while cation vacancy (V_Pb) introduces shallow acceptor states at the valence band maximum.',
    datasets: [
      createSyntheticDataset('def-bulk', 'Pristine Bulk (Clean Gap)', '#38bdf8', -3.51, -0.05, 1.50),
      createSyntheticDataset('def-vi', 'Iodine Vacancy (V_I Donor State)', '#ec4899', -3.58, -0.05, 1.50, [], { pos: 1.15, width: 0.18, height: 3.8 }),
      createSyntheticDataset('def-vpb', 'Lead Vacancy (V_Pb Acceptor)', '#8b5cf6', -3.42, 0.08, 1.50, [], { pos: 0.05, width: 0.12, height: 2.9 }),
    ],
  },
  surface: {
    title: 'Surface Science & Adsorption (Clean Slab vs Ligand vs Adsorbed)',
    desc: 'Comparing the electronic states of an isolated molecule, clean substrate slab, and chemisorbed complex reveals hybrid bonding and anti-bonding orbitals.',
    datasets: [
      createSyntheticDataset('surf-slab', 'Clean Substrate Slab', '#38bdf8', -4.20, -0.10, 1.60),
      createSyntheticDataset('surf-lig', 'Isolated Ligand (HOMO-LUMO)', '#f59e0b', -5.10, -0.60, 2.80, [{ pos: -1.2, isVB: true, w: 0.2, h: 5 }, { pos: 2.2, isVB: false, w: 0.25, h: 4 }]),
      createSyntheticDataset('surf-sys', 'Adsorbed Complex (Hybridized)', '#10b981', -4.35, -0.04, 1.52, [{ pos: -0.85, isVB: true, w: 0.35, h: 7 }, { pos: 1.85, isVB: false, w: 0.4, h: 6 }]),
    ],
  },
  basis: {
    title: 'Basis Set Convergence (SZ vs DZ vs DZP vs TZP)',
    desc: 'Assessing convergence of electronic density of states as basis size increases from minimal Single-Zeta to Double-Zeta Polarized and Triple-Zeta.',
    datasets: [
      createSyntheticDataset('bas-sz', 'Single-Zeta (SZ)', '#ec4899', -3.30, -0.25, 1.85),
      createSyntheticDataset('bas-dz', 'Double-Zeta (DZ)', '#f59e0b', -3.45, -0.12, 1.62),
      createSyntheticDataset('bas-dzp', 'Double-Zeta Polarized (DZP)', '#38bdf8', -3.51, -0.05, 1.50),
      createSyntheticDataset('bas-tzp', 'Triple-Zeta Polarized (TZP)', '#10b981', -3.52, -0.04, 1.48),
    ],
  },
};

export function DOSComparisonStudio() {
  const fileInputRef = useRef(null);

  // Active comparison datasets (default initialized with Perovskite substitution demo)
  const [datasets, setDatasets] = useState(DEMO_COMPARISONS.perovskite.datasets);
  const [activeMode, setActiveMode] = useState('overlay'); // 'overlay' | 'stacked' | 'diff' | 'table'
  const [hoverEnergy, setHoverEnergy] = useState(null);

  // Range and filter controls
  const [eMin, setEMin] = useState('-5.0');
  const [eMax, setEMax] = useState('5.0');
  const [sharedEfAlign, setSharedEfAlign] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Difference DOS dataset selectors (Reference A vs Target B)
  const [diffRefId, setDiffRefId] = useState(datasets[0]?.id || '');
  const [diffTargetId, setDiffTargetId] = useState(datasets[1]?.id || '');

  // 1. Upload & Auto-Detect new dataset
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg(`Loading ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lowerName = file.name.toLowerCase();
        let newDs = null;
        const color = COMPARISON_PALETTE[datasets.length % COMPARISON_PALETTE.length];
        const sysName = file.name.replace(/\.[^/.]+$/, '');

        if (lowerName.endsWith('.pdos') || lowerName.endsWith('.pdos.xml') || text.includes('<pdos>')) {
          const parsed = parsePDOS(text);
          const computed = computePDOSCurves({
            pdosData: parsed,
            emin: parseFloat(eMin) || -6.0,
            emax: parseFloat(eMax) || 6.0,
            shiftEf: true,
          });
          const metrics = estimateBandGap(computed.energies, computed.total);
          newDs = {
            id: `ds-${Date.now()}`,
            name: sysName,
            color,
            visible: true,
            format: 'PDOS',
            fermiEnergy: parsed.ef,
            energies: computed.energies,
            totalDosUp: computed.total,
            totalDosDown: computed.totalDown,
            isSpinPol: !!computed.totalDown,
            speciesList: parsed.speciesList,
            metrics,
          };
        } else if (lowerName.endsWith('.eig')) {
          const parsed = parseEIG(text);
          const computed = computeEig2DOS({
            eigData: parsed,
            emin: parseFloat(eMin) || -6.0,
            emax: parseFloat(eMax) || 6.0,
            npts: 1000,
            smear: 0.100,
            broadening: 'gaussian',
            shiftEf: true,
          });
          const total = parsed.nspin === 2 ? computed.dosUp : computed.totalDos;
          const metrics = estimateBandGap(computed.energies, total);
          newDs = {
            id: `ds-${Date.now()}`,
            name: sysName,
            color,
            visible: true,
            format: 'EIG',
            fermiEnergy: parsed.ef,
            energies: computed.energies,
            totalDosUp: total,
            totalDosDown: parsed.nspin === 2 ? computed.dosDown : null,
            isSpinPol: parsed.nspin === 2,
            speciesList: [],
            metrics,
          };
        } else if (lowerName.endsWith('.dos') || lowerName.endsWith('.dat')) {
          const parsed = parseRawDOS(text);
          const metrics = estimateBandGap(parsed.energies, parsed.totalDosUp);
          newDs = {
            id: `ds-${Date.now()}`,
            name: sysName,
            color,
            visible: true,
            format: 'DOS',
            fermiEnergy: 0,
            energies: parsed.energies,
            totalDosUp: parsed.totalDosUp,
            totalDosDown: parsed.totalDosDown,
            isSpinPol: parsed.isSpinPol,
            speciesList: [],
            metrics,
          };
        } else {
          setErrorMsg(`Unrecognized file format for ${file.name}. Expected .PDOS, .DOS, or .EIG.`);
          return;
        }

        setDatasets(prev => [...prev, newDs]);
        setStatusMsg(`✓ Added ${newDs.name} (${newDs.format}) — Band Gap: ${newDs.metrics.gap ? newDs.metrics.gap + ' eV' : 'Metallic'}.`);
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Preset loader
  const handleLoadPreset = (key) => {
    const preset = DEMO_COMPARISONS[key];
    if (!preset) return;
    setDatasets(preset.datasets);
    setDiffRefId(preset.datasets[0]?.id || '');
    setDiffTargetId(preset.datasets[1]?.id || '');
    setStatusMsg(`✓ Loaded comparison preset: ${preset.title}`);
  };

  // Dataset removal
  const handleRemoveDataset = (id) => {
    setDatasets(prev => prev.filter(d => d.id !== id));
  };

  // Toggle dataset visibility
  const handleToggleVisibility = (id) => {
    setDatasets(prev => prev.map(d => d.id === id ? { ...d, visible: !d.visible } : d));
  };

  // Change dataset color
  const handleColorChange = (id, newColor) => {
    setDatasets(prev => prev.map(d => d.id === id ? { ...d, color: newColor } : d));
  };

  // Update dataset name
  const handleRename = (id, newName) => {
    setDatasets(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
  };

  // Active visible datasets
  const activeDatasets = useMemo(() => datasets.filter(d => d.visible), [datasets]);

  // Compute common energy bounds
  const eminVal = parseFloat(eMin) || -5.0;
  const emaxVal = parseFloat(eMax) || 5.0;

  // Max DOS height across active datasets
  const maxDosHeight = useMemo(() => {
    let max = 0.5;
    activeDatasets.forEach(ds => {
      const { energies, totalDosUp } = ds;
      for (let i = 0; i < energies.length; i++) {
        if (energies[i] >= eminVal && energies[i] <= emaxVal) {
          if (totalDosUp[i] > max) max = totalDosUp[i];
        }
      }
    });
    return max * 1.12;
  }, [activeDatasets, eminVal, emaxVal]);

  // Compute Difference DOS (Target - Ref)
  const diffData = useMemo(() => {
    const dsA = datasets.find(d => d.id === diffRefId);
    const dsB = datasets.find(d => d.id === diffTargetId);
    if (!dsA || !dsB) return null;

    const gridN = 500;
    const step = (emaxVal - eminVal) / (gridN - 1);
    const energies = [];
    const diff = [];
    let maxDiffAbs = 0.1;

    for (let i = 0; i < gridN; i++) {
      const e = eminVal + i * step;
      energies.push(e);
      const valA = interpolate(dsA.energies, dsA.totalDosUp, e);
      const valB = interpolate(dsB.energies, dsB.totalDosUp, e);
      const delta = valB - valA;
      diff.push(delta);
      if (Math.abs(delta) > maxDiffAbs) maxDiffAbs = Math.abs(delta);
    }

    return {
      energies,
      diff,
      maxDiffAbs: maxDiffAbs * 1.15,
      refName: dsA.name,
      targetName: dsB.name,
    };
  }, [datasets, diffRefId, diffTargetId, eminVal, emaxVal]);

  // Chart dimensions
  const width = 860;
  const height = 380;
  const margin = { top: 30, right: 35, bottom: 45, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const getX = (energy) => margin.left + ((energy - eminVal) / (emaxVal - eminVal)) * plotW;
  const getY = (val) => margin.top + plotH - (val / maxDosHeight) * plotH;
  const getDiffY = (val, maxAbs) => margin.top + plotH / 2 - (val / maxAbs) * (plotH / 2);

  // SVG path generator
  const createPath = (energies, values, getPointY) => {
    let d = '';
    let first = true;
    for (let i = 0; i < energies.length; i++) {
      const e = energies[i];
      if (e >= eminVal && e <= emaxVal) {
        const x = getX(e);
        const y = getPointY(values[i]);
        d += first ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        first = false;
      }
    }
    return d;
  };

  // Export CSV comparison table
  const handleExportCSV = () => {
    let csv = 'System Name,Format,Fermi Level (eV),VBM (eV),CBM (eV),Band Gap Eg (eV),Delta Eg (eV),State Type,Valence States\n';
    const refGap = datasets[0]?.metrics?.gap;
    datasets.forEach(d => {
      const m = d.metrics;
      const deltaGap = (m.gap !== null && refGap !== null) ? (m.gap - refGap).toFixed(3) : 'N/A';
      const type = m.isMetal ? 'Metallic' : (m.gap > 3.0 ? 'Insulator' : 'Semiconductor');
      csv += `"${d.name}",${d.format},${d.fermiEnergy.toFixed(3)},${m.vbm ?? 'N/A'},${m.cbm ?? 'N/A'},${m.gap ?? '0.000'},${deltaGap},${type},${m.integratedValence}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'siesta_dos_comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dos-comparison-studio" style={{ marginTop: '0.5rem' }}>
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
            <span>🔬 Multi-Dataset DOS &amp; PDOS Comparison Studio</span>
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
              {datasets.length} Datasets Active
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Compare multiple SIESTA calculations simultaneously: align band gaps, track peak shifts, and isolate defect in-gap states.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeMode === 'overlay' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('overlay')}>
            📊 Overlay
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'stacked' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('stacked')}>
            🥞 Stacked Subplots
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'diff' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('diff')}>
            Δ Difference DOS (ΔDOS)
          </button>
          <button
            className={`btn btn-sm ${activeMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveMode('table')}>
            📋 Metrics Table
          </button>
        </div>
      </div>

      {/* Dataset Management Ribbon */}
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
              ➕ Add Dataset (.PDOS, .DOS, .EIG)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdos,.dos,.eig,.dat,.xml"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {/* Quick Demo Presets */}
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Quick Demos:</span>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('perovskite')} title="FAPbI3 vs FASnI3 vs CsPbI3">
              Perovskite Substitution
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('defect')} title="Pristine vs Iodine Vacancy vs Lead Vacancy">
              Defect Physics (V_I / V_Pb)
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('surface')} title="Clean Slab vs Isolated Ligand vs Complex">
              Surface Adsorption
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleLoadPreset('basis')} title="SZ vs DZ vs DZP vs TZP">
              Basis Set Convergence
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-xs" onClick={handleExportCSV} title="Export comparative metrics to CSV">
              📥 Export CSV
            </button>
            {datasets.length > 0 && (
              <button className="btn btn-secondary btn-xs" style={{ color: 'var(--error, #ef4444)' }} onClick={() => setDatasets([])}>
                ✕ Clear All
              </button>
            )}
          </div>
        </div>

        {/* Dataset Cards List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
          {datasets.map((ds, idx) => (
            <div
              key={ds.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                background: 'var(--surface2)',
                border: `1px solid ${ds.visible ? ds.color : 'var(--border)'}`,
                opacity: ds.visible ? 1 : 0.5,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                {/* Color swatch */}
                <input
                  type="color"
                  value={ds.color}
                  onChange={e => handleColorChange(ds.id, e.target.value)}
                  style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  title="Change dataset color"
                />

                {/* Name */}
                <input
                  className="input mono"
                  style={{ fontSize: '0.75rem', padding: '0.15rem 0.35rem', height: '24px', flex: 1 }}
                  value={ds.name}
                  onChange={e => handleRename(ds.id, e.target.value)}
                  title="Click to rename dataset"
                />

                {/* Format badge */}
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'var(--border)', fontFamily: 'monospace' }}>
                  {ds.format}
                </span>
              </div>

              {/* Band Gap chip + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.4rem' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: ds.metrics.isMetal ? 'var(--warning, #f59e0b)' : 'var(--success, #10b981)',
                }}>
                  {ds.metrics.isMetal ? 'Metal' : `${ds.metrics.gap} eV`}
                </span>

                {/* Visibility Toggle */}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}
                  onClick={() => handleToggleVisibility(ds.id)}
                  title={ds.visible ? 'Hide curve' : 'Show curve'}>
                  {ds.visible ? '👁️' : '🙈'}
                </button>

                {/* Delete button */}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--muted)', padding: '0 2px' }}
                  onClick={() => handleRemoveDataset(ds.id)}
                  title="Remove dataset">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {statusMsg && <div style={{ color: 'var(--success, #10b981)', marginTop: '0.5rem', fontSize: '0.78rem' }}>{statusMsg}</div>}
        {errorMsg && <div style={{ color: 'var(--error, #ef4444)', marginTop: '0.5rem', fontSize: '0.78rem' }}>{errorMsg}</div>}
      </div>

      {/* Energy Range & Broadening Adjusters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem',
        marginBottom: '0.8rem',
        padding: '0.4rem 0.8rem',
        background: 'var(--surface2)',
        borderRadius: '6px',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Energy Range (E - E_F):</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input
              type="number"
              step="0.5"
              className="input mono"
              style={{ width: '65px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
              value={eMin}
              onChange={e => setEMin(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>to</span>
            <input
              type="number"
              step="0.5"
              className="input mono"
              style={{ width: '65px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
              value={eMax}
              onChange={e => setEMax(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>eV</span>
          </div>
        </div>

        <label className="toggle" style={{ fontSize: '0.75rem' }}>
          <input
            type="checkbox"
            checked={sharedEfAlign}
            onChange={e => setSharedEfAlign(e.target.checked)}
          />
          <span className="toggle-label">Align All to Fermi Level (E - E_F = 0)</span>
        </label>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 1: OVERLAY COMPARISON CHART                                   */}
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
                const frac = (svgX - margin.left) / plotW;
                const eVal = eminVal + frac * (emaxVal - eminVal);
                setHoverEnergy(parseFloat(eVal.toFixed(2)));
              }
            }}
            onMouseLeave={() => setHoverEnergy(null)}>

            {/* Valence Band Background Shading (E <= 0) */}
            <rect
              x={margin.left}
              y={margin.top}
              width={Math.max(0, getX(0) - margin.left)}
              height={plotH}
              fill="rgba(51, 65, 85, 0.25)"
            />

            {/* Grid Lines */}
            {[-4, -2, 0, 2, 4].map(eTick => {
              if (eTick < eminVal || eTick > emaxVal) return null;
              const x = getX(eTick);
              return (
                <g key={eTick}>
                  <line
                    x1={x} y1={margin.top}
                    x2={x} y2={margin.top + plotH}
                    stroke={eTick === 0 ? 'rgba(239, 68, 68, 0.65)' : 'rgba(148, 163, 184, 0.12)'}
                    strokeDasharray={eTick === 0 ? '4,3' : '2,2'}
                    strokeWidth={eTick === 0 ? 1.5 : 1}
                  />
                  <text
                    x={x}
                    y={margin.top + plotH + 18}
                    fill={eTick === 0 ? '#ef4444' : '#94a3b8'}
                    fontSize="11"
                    fontFamily="monospace"
                    textAnchor="middle">
                    {eTick === 0 ? 'E_F (0)' : eTick}
                  </text>
                </g>
              );
            })}

            {/* Y-axis ticks */}
            {[0, 0.25, 0.5, 0.75, 1.0].map(frac => {
              const val = maxDosHeight * frac;
              const y = getY(val);
              return (
                <g key={frac}>
                  <line
                    x1={margin.left} y1={y}
                    x2={margin.left + plotW} y2={y}
                    stroke="rgba(148, 163, 184, 0.10)"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={margin.left - 8}
                    y={y + 3}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end">
                    {val.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Axes Lines */}
            <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
            <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />

            {/* Axes Labels */}
            <text
              x={margin.left + plotW / 2}
              y={height - 10}
              fill="#e2e8f0"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle">
              Energy E − E_F (eV)
            </text>
            <text
              x={-height / 2}
              y={18}
              fill="#e2e8f0"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
              transform="rotate(-90)">
              Total DOS (states / eV)
            </text>

            {/* Overlaid Dataset Curves */}
            {activeDatasets.map((ds) => {
              const pathD = createPath(ds.energies, ds.totalDosUp, getY);
              return (
                <g key={ds.id}>
                  {/* Fill under curve */}
                  <path
                    d={`${pathD} L ${getX(Math.min(emaxVal, ds.energies[ds.energies.length - 1]))} ${getY(0)} L ${getX(Math.max(eminVal, ds.energies[0]))} ${getY(0)} Z`}
                    fill={ds.color}
                    opacity="0.10"
                  />
                  {/* Line curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={ds.color}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Hover Cursor Crosshair */}
            {hoverEnergy !== null && (
              <g>
                <line
                  x1={getX(hoverEnergy)} y1={margin.top}
                  x2={getX(hoverEnergy)} y2={margin.top + plotH}
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray="3,3"
                />
              </g>
            )}
          </svg>

          {/* Crosshair Tooltip with Simultaneous Multi-Dataset Readout */}
          {hoverEnergy !== null && (
            <div style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.4rem 0.65rem',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: '180px',
            }}>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '0.2rem' }}>
                E − E_F = {hoverEnergy.toFixed(2)} eV
              </div>
              {activeDatasets.map(ds => {
                const val = interpolate(ds.energies, ds.totalDosUp, hoverEnergy);
                return (
                  <div key={ds.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', color: ds.color }}>
                    <span>{ds.name.substring(0, 16)}:</span>
                    <strong>{val.toFixed(2)} states/eV</strong>
                  </div>
                );
              })}
            </div>
          )}

          {/* Interactive Legend */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.8rem',
            justifyContent: 'center',
            marginTop: '0.8rem',
            paddingTop: '0.6rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
          }}>
            {activeDatasets.map(ds => (
              <div key={ds.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: ds.color }} />
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{ds.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                  ({ds.metrics.isMetal ? 'Metal' : `E_g = ${ds.metrics.gap} eV`})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 2: STACKED SUBPLOTS                                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'stacked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {activeDatasets.map((ds, idx) => {
            const subH = 160;
            const subMargin = { top: 20, right: 25, bottom: 25, left: 60 };
            const subPlotW = width - subMargin.left - subMargin.right;
            const subPlotH = subH - subMargin.top - subMargin.bottom;

            const dsMax = Math.max(1.0, ...ds.totalDosUp.filter((_, i) => ds.energies[i] >= eminVal && ds.energies[i] <= emaxVal)) * 1.15;
            const subGetX = (e) => subMargin.left + ((e - eminVal) / (emaxVal - eminVal)) * subPlotW;
            const subGetY = (val) => subMargin.top + subPlotH - (val / dsMax) * subPlotH;
            const pathD = createPath(ds.energies, ds.totalDosUp, subGetY);

            return (
              <div
                key={ds.id}
                style={{
                  background: '#0f172a',
                  borderRadius: '6px',
                  border: `1px solid ${ds.color}`,
                  padding: '0.6rem',
                  position: 'relative',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', padding: '0 0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: ds.color }} />
                    <strong style={{ fontSize: '0.85rem', color: ds.color }}>Panel {idx + 1}: {ds.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                    Band Gap: <strong style={{ color: '#fff' }}>{ds.metrics.isMetal ? '0.000 eV (Metallic)' : `${ds.metrics.gap} eV`}</strong> | VBM: {ds.metrics.vbm ?? 'N/A'} eV | CBM: {ds.metrics.cbm ?? 'N/A'} eV
                  </div>
                </div>

                <svg viewBox={`0 0 ${width} ${subH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Valence band shading */}
                  <rect
                    x={subMargin.left}
                    y={subMargin.top}
                    width={Math.max(0, subGetX(0) - subMargin.left)}
                    height={subPlotH}
                    fill="rgba(51, 65, 85, 0.2)"
                  />
                  {/* Fermi line */}
                  <line
                    x1={subGetX(0)} y1={subMargin.top}
                    x2={subGetX(0)} y2={subMargin.top + subPlotH}
                    stroke="#ef4444"
                    strokeDasharray="4,3"
                    strokeWidth="1.5"
                  />
                  {/* Path */}
                  <path
                    d={`${pathD} L ${subGetX(emaxVal)} ${subGetY(0)} L ${subGetX(eminVal)} ${subGetY(0)} Z`}
                    fill={ds.color}
                    opacity="0.12"
                  />
                  <path d={pathD} fill="none" stroke={ds.color} strokeWidth="2.0" />
                  {/* Axes */}
                  <line x1={subMargin.left} y1={subMargin.top + subPlotH} x2={subMargin.left + subPlotW} y2={subMargin.top + subPlotH} stroke="rgba(148, 163, 184, 0.4)" />
                  <text x={subMargin.left - 6} y={subMargin.top + 10} fill="#94a3b8" fontSize="9" textAnchor="end">
                    {dsMax.toFixed(0)}
                  </text>
                  <text x={subMargin.left - 6} y={subMargin.top + subPlotH} fill="#94a3b8" fontSize="9" textAnchor="end">
                    0
                  </text>
                  {[-4, -2, 0, 2, 4].map(t => (
                    <text key={t} x={subGetX(t)} y={subMargin.top + subPlotH + 14} fill="#94a3b8" fontSize="9" textAnchor="middle">
                      {t}
                    </text>
                  ))}
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 3: DIFFERENCE DOS (ΔDOS)                                      */}
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
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Reference System (A):</span>
              <select
                className="input select"
                style={{ fontSize: '0.78rem', height: '28px' }}
                value={diffRefId}
                onChange={e => setDiffRefId(e.target.value)}>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <span style={{ fontWeight: 700, color: '#fbbf24' }}>➔ Subtract from ➔</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Target System (B):</span>
              <select
                className="input select"
                style={{ fontSize: '0.78rem', height: '28px' }}
                value={diffTargetId}
                onChange={e => setDiffTargetId(e.target.value)}>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
              ΔDOS(E) = DOS_B(E) − DOS_A(E)
            </div>
          </div>

          {diffData && (
            <>
              <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Zero line */}
                <line
                  x1={margin.left} y1={margin.top + plotH / 2}
                  x2={margin.left + plotW} y2={margin.top + plotH / 2}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />
                {/* Fermi line */}
                <line
                  x1={getX(0)} y1={margin.top}
                  x2={getX(0)} y2={margin.top + plotH}
                  stroke="#ef4444"
                  strokeDasharray="4,3"
                  strokeWidth="1.5"
                />

                {/* Grid ticks */}
                {[-4, -2, 0, 2, 4].map(t => (
                  <text key={t} x={getX(t)} y={margin.top + plotH + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">
                    {t === 0 ? 'E_F (0)' : t}
                  </text>
                ))}

                {/* Differential Curve */}
                {(() => {
                  const getDY = (val) => getDiffY(val, diffData.maxDiffAbs);
                  const pathD = createPath(diffData.energies, diffData.diff, getDY);
                  return (
                    <g>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.4"
                      />
                    </g>
                  );
                })()}

                {/* Y-axis labels */}
                <text x={margin.left - 8} y={margin.top + 10} fill="#10b981" fontSize="10" textAnchor="end">
                  +{diffData.maxDiffAbs.toFixed(1)}
                </text>
                <text x={margin.left - 8} y={margin.top + plotH / 2 + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                  0
                </text>
                <text x={margin.left - 8} y={margin.top + plotH} fill="#ef4444" fontSize="10" textAnchor="end">
                  −{diffData.maxDiffAbs.toFixed(1)}
                </text>

                <text x={margin.left + plotW / 2} y={height - 8} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle">
                  Energy E − E_F (eV)
                </text>
                <text x={-height / 2} y={18} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" transform="rotate(-90)">
                  ΔDOS (states / eV)
                </text>
              </svg>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.8rem', fontSize: '0.8rem' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>
                  ▲ Positive Region: States gained in {diffData.targetName} (e.g. defect/adsorbate induced)
                </span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  ▼ Negative Region: States depleted or shifted away from {diffData.refName}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE 4: COMPARATIVE METRICS TABLE                                 */}
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
                <th style={{ padding: '0.6rem 0.8rem' }}>System / Dataset</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Format</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Fermi Level E_F</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>VBM (eV)</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>CBM (eV)</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Band Gap E_g</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Shift ΔE_g</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Electronic State</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>Integrated Valence</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d, i) => {
                const m = d.metrics;
                const refGap = datasets[0]?.metrics?.gap;
                const deltaGap = (m.gap !== null && refGap !== null && i > 0) ? (m.gap - refGap) : 0;
                const isSemiconductor = !m.isMetal && m.gap > 0 && m.gap <= 3.5;
                const isInsulator = !m.isMetal && m.gap > 3.5;

                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: d.color }} />
                      <strong>{d.name}</strong>
                      {i === 0 && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'var(--accent)', color: '#fff' }}>Reference</span>}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{d.format}</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{d.fermiEnergy.toFixed(3)} eV</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{m.vbm !== null ? `${m.vbm.toFixed(2)} eV` : 'N/A'}</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>{m.cbm !== null ? `${m.cbm.toFixed(2)} eV` : 'N/A'}</td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', fontWeight: 700, color: m.isMetal ? 'var(--warning, #f59e0b)' : 'var(--success, #10b981)' }}>
                      {m.isMetal ? '0.000 eV' : `${m.gap.toFixed(3)} eV`}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', color: deltaGap > 0 ? '#38bdf8' : (deltaGap < 0 ? '#f59e0b' : 'var(--muted)') }}>
                      {i === 0 ? '—' : `${deltaGap > 0 ? '+' : ''}${deltaGap.toFixed(3)} eV`}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      <span style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: m.isMetal ? 'rgba(245, 158, 11, 0.15)' : (isInsulator ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                        color: m.isMetal ? '#f59e0b' : (isInsulator ? '#a78bfa' : '#10b981'),
                      }}>
                        {m.isMetal ? 'Metallic' : (isInsulator ? 'Wide-Gap Insulator' : 'Semiconductor')}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace' }}>
                      {m.integratedValence} e⁻
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

export default DOSComparisonStudio;
