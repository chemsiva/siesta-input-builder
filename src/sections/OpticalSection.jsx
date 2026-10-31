import { useState, useMemo } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

// ── Benchmark Optical Data Sets (Energy in eV vs EPSIMG ε2) ────────────────
const BENCHMARK_OPTICAL = {
  fapbi3: {
    title: 'FAPbI3 Perovskite (Direct Bandgap ~1.55 eV)',
    desc: 'Strong optical absorption onset at ~1.55 eV with sharp visible absorption coefficient α > 10⁵ cm⁻¹.',
    gapType: 'direct',
    rawEps2: [
      { e: 0.0, eps2: 0.00 }, { e: 0.5, eps2: 0.00 }, { e: 1.0, eps2: 0.00 },
      { e: 1.3, eps2: 0.00 }, { e: 1.4, eps2: 0.02 }, { e: 1.5, eps2: 0.25 },
      { e: 1.55, eps2: 0.85 }, { e: 1.6, eps2: 2.10 }, { e: 1.7, eps2: 4.60 },
      { e: 1.8, eps2: 7.20 }, { e: 2.0, eps2: 10.40 }, { e: 2.2, eps2: 12.80 },
      { e: 2.5, eps2: 15.20 }, { e: 2.8, eps2: 16.90 }, { e: 3.2, eps2: 14.80 },
      { e: 3.6, eps2: 12.10 }, { e: 4.0, eps2: 9.80 }, { e: 4.5, eps2: 7.20 },
      { e: 5.0, eps2: 5.10 }, { e: 6.0, eps2: 3.20 }, { e: 7.0, eps2: 1.80 },
      { e: 8.0, eps2: 0.90 }, { e: 9.0, eps2: 0.40 }, { e: 10.0, eps2: 0.15 },
    ],
  },
  silicon: {
    title: 'Bulk Silicon (Indirect Bandgap 1.12 eV, Direct E1/E2 Peaks)',
    desc: 'Weak phonon-assisted indirect absorption below 3.0 eV; strong direct transitions E1 (~3.4 eV) and E2 (~4.2 eV).',
    gapType: 'indirect',
    rawEps2: [
      { e: 0.0, eps2: 0.00 }, { e: 0.8, eps2: 0.00 }, { e: 1.1, eps2: 0.01 },
      { e: 1.5, eps2: 0.15 }, { e: 2.0, eps2: 0.65 }, { e: 2.5, eps2: 1.80 },
      { e: 3.0, eps2: 4.90 }, { e: 3.4, eps2: 22.40 }, { e: 3.8, eps2: 18.20 },
      { e: 4.2, eps2: 38.50 }, { e: 4.6, eps2: 26.10 }, { e: 5.0, eps2: 14.20 },
      { e: 5.5, eps2: 8.10 }, { e: 6.0, eps2: 4.80 }, { e: 7.0, eps2: 2.10 },
      { e: 8.0, eps2: 1.10 }, { e: 9.0, eps2: 0.50 }, { e: 10.0, eps2: 0.20 },
    ],
  },
  mos2: {
    title: 'Monolayer MoS2 (Direct 1.88 eV, Exciton A & B Peaks)',
    desc: '2D transition metal dichalcogenide featuring prominent A exciton (1.88 eV) and B exciton (2.05 eV) interband resonances.',
    gapType: 'direct',
    rawEps2: [
      { e: 0.0, eps2: 0.00 }, { e: 1.0, eps2: 0.00 }, { e: 1.5, eps2: 0.02 },
      { e: 1.7, eps2: 0.25 }, { e: 1.88, eps2: 14.80 }, { e: 1.95, eps2: 6.20 },
      { e: 2.05, eps2: 12.40 }, { e: 2.2, eps2: 5.80 }, { e: 2.5, eps2: 7.10 },
      { e: 2.8, eps2: 18.20 }, { e: 3.2, eps2: 11.50 }, { e: 3.8, eps2: 6.80 },
      { e: 4.5, eps2: 4.20 }, { e: 5.5, eps2: 2.40 }, { e: 7.0, eps2: 0.90 },
      { e: 8.5, eps2: 0.35 }, { e: 10.0, eps2: 0.10 },
    ],
  }
};

export function OpticalSection() {
  const output = useFDFStore(s => s.output || {});
  const setField = useFDFStore(s => s.setField);
  const setOutput = (k, v) => setField('output', k, v);

  // Tabs: 'params', 'studio', 'tauc', 'workflow'
  const [activeTab, setActiveTab] = useState('params');

  // Studio State
  const [selectedBenchmark, setSelectedBenchmark] = useState('fapbi3');
  const [customFileText, setCustomFileText] = useState('');
  const [spectrumMode, setSpectrumMode] = useState('dielectric'); // 'dielectric', 'alpha', 'refractive', 'refl_loss'
  const [taucMode, setTaucMode] = useState('direct'); // 'direct' (n=1/2), 'indirect' (n=2)
  const [taucFitMin, setTaucFitMin] = useState(1.6);
  const [taucFitMax, setTaucFitMax] = useState(2.4);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // 1-Click FDF Presets
  const applyPreset = (type) => {
    setOutput('OpticalCalculation', 'true');
    if (type === 'perovskite') {
      setOutput('Optical.Energy.Minimum', '0.0 eV');
      setOutput('Optical.Energy.Maximum', '6.0 eV');
      setOutput('Optical.Broaden', '0.05 eV');
      setOutput('Optical.Scissor', '0.0 eV');
      setOutput('Optical.PolarizationType', 'polycrystal');
      setOutput('Optical.Mesh', '8 8 8');
      setOutput('Optical.OffsetMesh', 'false');
    } else if (type === 'semiconductor') {
      setOutput('Optical.Energy.Minimum', '0.0 eV');
      setOutput('Optical.Energy.Maximum', '15.0 eV');
      setOutput('Optical.Broaden', '0.1 eV');
      setOutput('Optical.Scissor', '0.8 eV');
      setOutput('Optical.PolarizationType', 'polycrystal');
      setOutput('Optical.Mesh', '12 12 12');
      setOutput('Optical.OffsetMesh', 'false');
    } else if (type === 'inplane_2d') {
      setOutput('Optical.Energy.Minimum', '0.0 eV');
      setOutput('Optical.Energy.Maximum', '8.0 eV');
      setOutput('Optical.Broaden', '0.05 eV');
      setOutput('Optical.Scissor', '0.0 eV');
      setOutput('Optical.PolarizationType', 'polarized');
      setOutput('Optical.Vector', '1.0 0.0 0.0');
      setOutput('Optical.Mesh', '16 16 1');
      setOutput('Optical.OffsetMesh', 'false');
    } else if (type === 'outofplane') {
      setOutput('Optical.Energy.Minimum', '0.0 eV');
      setOutput('Optical.Energy.Maximum', '8.0 eV');
      setOutput('Optical.Broaden', '0.05 eV');
      setOutput('Optical.Scissor', '0.0 eV');
      setOutput('Optical.PolarizationType', 'polarized');
      setOutput('Optical.Vector', '0.0 0.0 1.0');
      setOutput('Optical.Mesh', '12 12 1');
      setOutput('Optical.OffsetMesh', 'false');
    } else if (type === 'clear') {
      setOutput('OpticalCalculation', 'false');
      setOutput('Optical.Energy.Minimum', '0.0 eV');
      setOutput('Optical.Energy.Maximum', '10.0 eV');
      setOutput('Optical.Broaden', '0.1 eV');
      setOutput('Optical.Scissor', '0.0 eV');
      setOutput('Optical.NumberOfBands', '');
      setOutput('Optical.PolarizationType', 'polycrystal');
      setOutput('Optical.Vector', '1.0 0.0 0.0');
      setOutput('Optical.Mesh', '5 5 5');
      setOutput('Optical.OffsetMesh', 'false');
    }
  };

  // Optical Spectrum Dataset & Kramers-Kronig Engine
  const opticalData = useMemo(() => {
    let raw = BENCHMARK_OPTICAL[selectedBenchmark]?.rawEps2 || [];

    // Parse uploaded text if provided
    if (customFileText.trim()) {
      const lines = customFileText.split('\n');
      const parsed = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) continue;
        const tokens = trimmed.split(/\s+/);
        if (tokens.length >= 2 && !isNaN(parseFloat(tokens[0])) && !isNaN(parseFloat(tokens[1]))) {
          parsed.push({
            e: parseFloat(tokens[0]),
            eps2: Math.max(0, parseFloat(tokens[1])),
          });
        }
      }
      if (parsed.length > 5) {
        raw = parsed;
      }
    }

    if (raw.length === 0) return { points: [], stats: {} };

    // Numerical Kramers-Kronig Transform: compute ε1(E) from ε2(E)
    // ε1(Ek) = 1 + (2/π) * P ∫ [E' * ε2(E') / (E'^2 - Ek^2)] dE'
    const N = raw.length;
    const points = [];

    for (let k = 0; k < N; k++) {
      const ek = raw[k].e;
      const eps2 = raw[k].eps2;

      let sum = 0;
      for (let i = 0; i < N; i++) {
        if (i === k) continue;
        const ei = raw[i].e;
        const de = (i === 0 ? raw[1].e - raw[0].e :
                    (i === N - 1 ? raw[N - 1].e - raw[N - 2].e :
                     (raw[i + 1].e - raw[i - 1].e) * 0.5));
        const denom = ei * ei - ek * ek;
        if (Math.abs(denom) > 1e-6) {
          sum += (ei * raw[i].eps2 / denom) * de;
        }
      }

      const eps1 = 1.0 + (2.0 / Math.PI) * sum;

      // Derived Optical Constants
      const mod = Math.hypot(eps1, eps2);
      const n = Math.sqrt(Math.max(0, (mod + eps1) / 2));
      const kExt = Math.sqrt(Math.max(0, (mod - eps1) / 2));

      // Absorption Coefficient α(E) = (4π * E * k * 1e4) / 1.23984 [cm^-1]
      const alpha = (4.0 * Math.PI * ek * kExt * 10000.0) / 1.23984193;

      // Reflectivity R = ((n-1)^2 + k^2) / ((n+1)^2 + k^2)
      const refl = ((n - 1) ** 2 + kExt ** 2) / ((n + 1) ** 2 + kExt ** 2);

      // Energy Loss Function L(E) = -Im(1/ε) = ε2 / (ε1^2 + ε2^2)
      const loss = mod > 1e-4 ? eps2 / (eps1 * eps1 + eps2 * eps2) : 0;

      // Tauc Quantities: (α * hν)^2 for direct, (α * hν)^0.5 for indirect
      const taucDirect = Math.pow(alpha * ek, 2);
      const taucIndirect = Math.sqrt(Math.max(0, alpha * ek));

      // Wavelength in nm: λ = 1239.84 / E
      const lambdaNm = ek > 0.05 ? parseFloat((1239.84193 / ek).toFixed(1)) : 9999;

      points.push({
        e: parseFloat(ek.toFixed(3)),
        lambda: lambdaNm,
        eps1: parseFloat(eps1.toFixed(3)),
        eps2: parseFloat(eps2.toFixed(3)),
        n: parseFloat(n.toFixed(3)),
        k: parseFloat(kExt.toFixed(3)),
        alpha: parseFloat(alpha.toFixed(1)),
        refl: parseFloat(refl.toFixed(4)),
        loss: parseFloat(loss.toFixed(3)),
        taucDirect,
        taucIndirect,
      });
    }

    // Key Physical Summary Statistics
    const staticEps1 = points[0]?.eps1 || 1.0;
    const staticN = points[0]?.n || 1.0;

    // Find Absorption Onset (where alpha exceeds 10^3 cm^-1)
    const onsetPt = points.find(p => p.alpha > 2000 && p.e > 0.2);
    const onsetEnergy = onsetPt ? onsetPt.e : 0;

    // Find Volume Plasmon Peak (max of loss function)
    let maxLoss = 0, plasmonEnergy = 0;
    points.forEach(p => {
      if (p.loss > maxLoss && p.e > 1.0) {
        maxLoss = p.loss;
        plasmonEnergy = p.e;
      }
    });

    return {
      points,
      stats: {
        staticEps1: staticEps1.toFixed(2),
        staticN: staticN.toFixed(2),
        onsetEnergy: onsetEnergy.toFixed(2),
        plasmonEnergy: plasmonEnergy.toFixed(2),
      }
    };
  }, [selectedBenchmark, customFileText]);

  // Linear Fit for Tauc Plot Extrapolation (E_g_opt)
  const taucFit = useMemo(() => {
    const pts = opticalData.points.filter(p => p.e >= taucFitMin && p.e <= taucFitMax);
    if (pts.length < 2) return { m: 0, c: 0, eg: 0, r2: 0 };

    const isDirect = taucMode === 'direct';
    const xs = pts.map(p => p.e);
    const ys = pts.map(p => isDirect ? p.taucDirect : p.taucIndirect);

    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const c = (sumY - m * sumX) / n;

    // Optical Bandgap Intercept: y = m * x + c = 0 => x = -c / m
    const eg = m !== 0 ? -c / m : 0;

    return {
      m,
      c,
      eg: parseFloat(Math.max(0, eg).toFixed(3)),
      fitPts: pts,
    };
  }, [opticalData, taucMode, taucFitMin, taucFitMax]);

  // Export CSV
  const handleExportCSV = () => {
    if (opticalData.points.length === 0) return;
    const header = 'Energy_eV,Wavelength_nm,Eps1_Real,Eps2_Imag,n_Refractive,k_Extinction,Alpha_cm-1,Reflectivity,Loss_Function\n';
    const rows = opticalData.points.map(p =>
      `${p.e},${p.lambda},${p.eps1},${p.eps2},${p.n},${p.k},${p.alpha},${p.refl},${p.loss}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optical_constants_${selectedBenchmark}.csv`;
    a.click();
  };

  return (
    <div className="section-pane">
      <SectionHeader
        title="15 Optical Properties &amp; UV-Vis Absorption Studio (Section 6.20)"
        desc="Calculate interband momentum dipole matrix elements and frequency-dependent dielectric functions in SIESTA. Execute Kramers-Kronig transforms to obtain real dielectric constant ε₁(ω), absorption coefficient α(ω), refractive index n(ω), and extract the direct optical bandgap using automated Tauc plot extrapolation."
      />

      {/* Top Navigation Mode Pills */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
        marginBottom: '1rem',
        padding: '0.5rem 0.8rem',
        background: 'var(--surface)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'params' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('params')}>
            FDF Optical Parameters (Section 6.20)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'studio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('studio')}>
            Interactive Optical Spectra &amp; UV-Vis Studio
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'tauc' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('tauc')}>
            Tauc Plot (Bandgap Extrapolation)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'workflow' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('workflow')}>
            CLI &amp; Execution Guide
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: FDF Section 6.20 Parameters & 1-Click Presets                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'params' && (
        <>
          {/* Quick Presets Ribbon */}
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.6rem 0.8rem',
            marginBottom: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg)' }}>
              1-Click Optical Presets:
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => applyPreset('perovskite')}
                title="Perovskite / Solar Cell UV-Vis absorption spectrum (0-6 eV, 8x8x8 mesh)">
                ☀️ Solar Cell / Perovskite UV-Vis
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('semiconductor')}
                title="Isotropic wide-range optical response (0-15 eV) with 0.8 eV scissor operator">
                🔬 Isotropic Semiconductor (Scissor)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('inplane_2d')}
                title="In-plane polarization Ex // x for 2D monolayers (MoS2, Graphene, Phosphorene)">
                ⚡ In-Plane Polarized (2D Material)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('outofplane')}
                title="Out-of-plane Ez // z polarization for anisotropic slabs and heterostructures">
                🔲 Out-of-Plane Polarized (Slab)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('clear')}
                title="Reset optical properties to defaults">
                🧼 Clear
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
            {/* Card 1: Optical Calculation Core Controls */}
            <div className="subsection" style={{ margin: 0 }}>
              <div className="subsection-title">Calculation Activation &amp; Spectral Range</div>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
                Computes interband momentum matrix elements and generates <code>SystemLabel.EPSIMG</code>.
              </p>

              <FieldRow
                label="OpticalCalculation"
                propKey="OpticalCalculation"
                hint="Enable calculation of the imaginary part of the dielectric function in SystemLabel.EPSIMG">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.OpticalCalculation === 'true'}
                    onChange={e => setOutput('OpticalCalculation', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.OpticalCalculation === 'true' ? 'True (Calculate)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="Optical.Energy.Minimum"
                propKey="Optical.Energy.Minimum"
                hint="Minimum energy of frequency spectrum (typically 0.0 eV or 0 Ry)">
                <TextInput
                  value={output['Optical.Energy.Minimum'] || '0.0 eV'}
                  onChange={v => setOutput('Optical.Energy.Minimum', v)}
                  placeholder="0.0 eV"
                />
              </FieldRow>

              <FieldRow
                label="Optical.Energy.Maximum"
                propKey="Optical.Energy.Maximum"
                hint="Maximum photon energy of frequency spectrum (e.g. 6.0 eV for solar, 15.0 eV for UV)">
                <TextInput
                  value={output['Optical.Energy.Maximum'] || '10.0 eV'}
                  onChange={v => setOutput('Optical.Energy.Maximum', v)}
                  placeholder="10.0 eV"
                />
              </FieldRow>

              <FieldRow
                label="Optical.Broaden"
                propKey="Optical.Broaden"
                hint="Gaussian broadening width applied to frequency values (e.g. 0.05 - 0.1 eV)">
                <TextInput
                  value={output['Optical.Broaden'] || '0.1 eV'}
                  onChange={v => setOutput('Optical.Broaden', v)}
                  placeholder="0.1 eV"
                />
              </FieldRow>

              <FieldRow
                label="Optical.NumberOfBands"
                propKey="Optical.NumberOfBands"
                hint="Total number of bands included in optical transitions. Leave empty for all available bands">
                <TextInput
                  value={output['Optical.NumberOfBands'] || ''}
                  onChange={v => setOutput('Optical.NumberOfBands', v)}
                  placeholder="All bands"
                />
              </FieldRow>
            </div>

            {/* Card 2: Scissor Correction, Polarization & Mesh */}
            <div className="subsection" style={{ margin: 0 }}>
              <div className="subsection-title">Scissor Operator &amp; Polarization</div>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
                Corrects standard DFT bandgap underestimation and selects polarization geometry.
              </p>

              <FieldRow
                label="Optical.Scissor"
                propKey="Optical.Scissor"
                hint="Rigid upward shift of unoccupied conduction bands to match experimental or GW bandgap">
                <TextInput
                  value={output['Optical.Scissor'] || '0.0 eV'}
                  onChange={v => setOutput('Optical.Scissor', v)}
                  placeholder="0.0 eV"
                />
              </FieldRow>

              <FieldRow
                label="Optical.PolarizationType"
                propKey="Optical.PolarizationType"
                hint="polycrystal (isotropic average), polarized (E-field along vector), unpolarized (light propagation along vector)">
                <SelectInput
                  value={output['Optical.PolarizationType'] || 'polycrystal'}
                  options={['polycrystal', 'polarized', 'unpolarized']}
                  onChange={v => setOutput('Optical.PolarizationType', v)}
                />
              </FieldRow>

              {(output['Optical.PolarizationType'] === 'polarized' || output['Optical.PolarizationType'] === 'unpolarized') && (
                <FieldRow
                  label="Optical.Vector (vx, vy, vz)"
                  propKey="Optical.Vector"
                  hint="Unit vector for electric field (polarized) or propagation direction (unpolarized)">
                  <TextInput
                    value={output['Optical.Vector'] || '1.0 0.0 0.0'}
                    onChange={v => setOutput('Optical.Vector', v)}
                    placeholder="1.0 0.0 0.0"
                  />
                </FieldRow>
              )}

              <FieldRow
                label="Optical.Mesh (Nk_x, Nk_y, Nk_z)"
                propKey="Optical.Mesh"
                hint="Integration k-mesh in Brillouin zone for optical properties. Denser meshes give smoother spectra">
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', width: '100%' }}>
                  <TextInput
                    value={output['Optical.Mesh'] || '5 5 5'}
                    onChange={v => setOutput('Optical.Mesh', v)}
                    placeholder="8 8 8"
                  />
                  <button type="button" className="btn btn-xs btn-secondary" onClick={() => setOutput('Optical.Mesh', '4 4 4')}>4³</button>
                  <button type="button" className="btn btn-xs btn-secondary" onClick={() => setOutput('Optical.Mesh', '8 8 8')}>8³</button>
                  <button type="button" className="btn btn-xs btn-secondary" onClick={() => setOutput('Optical.Mesh', '12 12 12')}>12³</button>
                </div>
              </FieldRow>

              <FieldRow
                label="Optical.OffsetMesh"
                propKey="Optical.OffsetMesh"
                hint="Offset mesh away from Gamma point for odd numbers of k-points">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output['Optical.OffsetMesh'] === 'true'}
                    onChange={e => setOutput('Optical.OffsetMesh', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output['Optical.OffsetMesh'] === 'true' ? 'True (Shifted)' : 'False'}</span>
                </label>
              </FieldRow>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Interactive Optical Spectra & UV-Vis Studio                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'studio' && (
        <div>
          {/* Preset Buttons & Custom File Upload */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
            marginBottom: '1rem',
            background: 'var(--surface2)',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Benchmarks:</span>
              <button
                type="button"
                className={`btn btn-xs ${selectedBenchmark === 'fapbi3' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setSelectedBenchmark('fapbi3'); setCustomFileText(''); }}>
                Perovskite (FAPbI3)
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedBenchmark === 'silicon' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setSelectedBenchmark('silicon'); setCustomFileText(''); }}>
                Bulk Silicon (Si)
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedBenchmark === 'mos2' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setSelectedBenchmark('mos2'); setCustomFileText(''); }}>
                Monolayer MoS2 (2D)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <label className="btn btn-xs btn-secondary" style={{ cursor: 'pointer' }}>
                Upload .EPSIMG
                <input
                  type="file"
                  accept=".EPSIMG,.epsimg,.dat,.txt"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => {
                      setCustomFileText(ev.target.result);
                      setSelectedBenchmark('custom');
                    };
                    r.readAsText(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={handleExportCSV}
                title="Download computed optical constants to CSV">
                Export CSV
              </button>
            </div>
          </div>

          {/* Physical Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.8rem',
            marginBottom: '1.2rem',
          }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Static Dielectric Constant</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b' }}>
                ε∞ = {opticalData.stats.staticEps1}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>Real part ε₁(0) at zero frequency</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Static Refractive Index</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                n₀ = {opticalData.stats.staticN}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>n(0) = √ε₁(0)</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Optical Absorption Onset</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#22c55e' }}>
                {opticalData.stats.onsetEnergy} eV
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>Threshold for interband transitions</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Volume Plasmon Resonance</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ef4444' }}>
                ℏω_p = {opticalData.stats.plasmonEnergy} eV
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>Peak in energy loss function L(ω)</div>
            </div>
          </div>

          {/* Spectrum View Mode Switcher */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '0.8rem',
            background: 'var(--surface2)',
            padding: '0.4rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--fg)', marginRight: '4px' }}>
              Spectrum Property:
            </span>
            <button
              type="button"
              className={`btn btn-xs ${spectrumMode === 'dielectric' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSpectrumMode('dielectric')}>
              Dielectric Function (ε₁ &amp; ε₂)
            </button>
            <button
              type="button"
              className={`btn btn-xs ${spectrumMode === 'alpha' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSpectrumMode('alpha')}>
              Absorption Coefficient α(ω) [cm⁻¹]
            </button>
            <button
              type="button"
              className={`btn btn-xs ${spectrumMode === 'refractive' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSpectrumMode('refractive')}>
              Refractive Index (n &amp; k)
            </button>
            <button
              type="button"
              className={`btn btn-xs ${spectrumMode === 'refl_loss' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSpectrumMode('refl_loss')}>
              Reflectivity R(ω) &amp; Loss L(ω)
            </button>
          </div>

          {/* Interactive SVG Plot Area */}
          <div style={{
            background: '#0f172a',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            position: 'relative',
          }}>
            {/* Header description */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--fg)' }}>
                {spectrumMode === 'dielectric' && 'Frequency-Dependent Dielectric Functions: ε₁(ω) [Kramers-Kronig] & ε₂(ω) [Interband]'}
                {spectrumMode === 'alpha' && 'Optical Absorption Spectrum α(ω) [cm⁻¹] & Solar AM1.5G Visible Band'}
                {spectrumMode === 'refractive' && 'Complex Refractive Index ñ(ω) = n(ω) + i k(ω)'}
                {spectrumMode === 'refl_loss' && 'Optical Normal-Incidence Reflectivity R(ω) & EELS Loss Function L(ω)'}
              </strong>
              <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                {opticalData.points.length} spectral energy points
              </span>
            </div>

            {/* SVG Renderer */}
            {(() => {
              const pts = opticalData.points;
              if (pts.length === 0) return <div>No data available.</div>;

              const svgW = 820;
              const svgH = 340;
              const margin = { top: 25, right: 40, bottom: 40, left: 65 };
              const plotW = svgW - margin.left - margin.right;
              const plotH = svgH - margin.top - margin.bottom;

              const eMin = pts[0].e;
              const eMax = pts[pts.length - 1].e;

              let y1Vals = [], y2Vals = [], y1Label = '', y2Label = '', y1Color = '#38bdf8', y2Color = '#f59e0b';
              if (spectrumMode === 'dielectric') {
                y1Vals = pts.map(p => p.eps2);
                y2Vals = pts.map(p => p.eps1);
                y1Label = 'ε₂(ω) [Imaginary]';
                y2Label = 'ε₁(ω) [Real KK]';
              } else if (spectrumMode === 'alpha') {
                y1Vals = pts.map(p => p.alpha);
                y1Label = 'α(ω) (cm⁻¹)';
                y1Color = '#38bdf8';
              } else if (spectrumMode === 'refractive') {
                y1Vals = pts.map(p => p.n);
                y2Vals = pts.map(p => p.k);
                y1Label = 'n(ω) [Refractive Index]';
                y2Label = 'k(ω) [Extinction]';
              } else if (spectrumMode === 'refl_loss') {
                y1Vals = pts.map(p => p.refl);
                y2Vals = pts.map(p => p.loss);
                y1Label = 'R(ω) [Reflectivity]';
                y2Label = 'L(ω) [Loss Function]';
              }

              const allY = [...y1Vals, ...y2Vals];
              const yMin = Math.min(0, Math.min(...allY));
              const yMax = Math.max(1, Math.max(...allY) * 1.08);

              const getX = e => margin.left + ((e - eMin) / (eMax - eMin)) * plotW;
              const getY = y => margin.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

              const yZero = getY(0);

              const pathY1 = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.e)} ${getY(y1Vals[i])}`, '');
              const pathY2 = y2Vals.length > 0 ? pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.e)} ${getY(y2Vals[i])}`, '') : '';

              // Visible light range on x-axis: 1.65 eV (750 nm) to 3.26 eV (380 nm)
              const visX1 = Math.max(margin.left, getX(1.65));
              const visX2 = Math.min(margin.left + plotW, getX(3.26));

              return (
                <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Solar Visible Spectrum Indicator Band (1.65 to 3.26 eV) */}
                  {visX2 > visX1 && (
                    <g>
                      <rect
                        x={visX1}
                        y={margin.top}
                        width={visX2 - visX1}
                        height={plotH}
                        fill="rgba(56, 189, 248, 0.05)"
                        stroke="rgba(56, 189, 248, 0.15)"
                        strokeDasharray="2 2"
                      />
                      <text
                        x={(visX1 + visX2) / 2}
                        y={margin.top + 16}
                        fill="rgba(148, 163, 184, 0.5)"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle">
                        AM1.5G Visible Band (380–750 nm)
                      </text>
                    </g>
                  )}

                  {/* Zero reference horizontal line */}
                  <line
                    x1={margin.left}
                    y1={yZero}
                    x2={margin.left + plotW}
                    y2={yZero}
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeDasharray="3 3"
                  />

                  {/* Y Axis */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
                  <text
                    x={margin.left - 48}
                    y={margin.top + plotH / 2}
                    fill={y1Color}
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                    transform={`rotate(-90 ${margin.left - 48} ${margin.top + plotH / 2})`}>
                    {y1Label}
                  </text>

                  {/* X Axis */}
                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
                  <text
                    x={margin.left + plotW / 2}
                    y={margin.top + plotH + 32}
                    fill="var(--muted)"
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle">
                    Photon Energy ℏω (eV)
                  </text>

                  {/* Curves */}
                  <path d={pathY1} fill="none" stroke={y1Color} strokeWidth="2.5" />
                  {pathY2 && <path d={pathY2} fill="none" stroke={y2Color} strokeWidth="2.2" strokeDasharray="4 3" />}

                  {/* Interactive Points */}
                  {pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={getX(p.e)}
                      cy={getY(y1Vals[i])}
                      r="3.5"
                      fill={y1Color}
                      stroke="#0f172a"
                      strokeWidth="1.2"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </svg>
              );
            })()}

            {/* Readout Chip */}
            {hoveredPoint && (
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(15, 23, 42, 0.94)',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: '6px',
                padding: '0.45rem 0.8rem',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                color: 'var(--fg)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '2px' }}>
                  ℏω = {hoveredPoint.e.toFixed(3)} eV (λ = {hoveredPoint.lambda} nm)
                </div>
                <div style={{ color: '#38bdf8' }}>ε₂(ω) = {hoveredPoint.eps2.toFixed(3)} | ε₁(ω) = {hoveredPoint.eps1.toFixed(3)}</div>
                <div style={{ color: '#22c55e' }}>α(ω) = {hoveredPoint.alpha.toExponential(2)} cm⁻¹</div>
                <div style={{ color: '#f59e0b' }}>n = {hoveredPoint.n.toFixed(3)} | k = {hoveredPoint.k.toFixed(3)} | R = {(hoveredPoint.refl * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: Tauc Plot (Optical Bandgap Extrapolation)                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tauc' && (
        <div>
          {/* Controls Ribbon */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.8rem',
            marginBottom: '1rem',
            background: 'var(--surface2)',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Transition Mode:</span>
              <button
                type="button"
                className={`btn btn-xs ${taucMode === 'direct' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTaucMode('direct')}>
                Direct: (α·hν)² [Perovskite, GaAs]
              </button>
              <button
                type="button"
                className={`btn btn-xs ${taucMode === 'indirect' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTaucMode('indirect')}>
                Indirect: (α·hν)¹/² [Silicon, TiO2]
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.74rem' }}>
              <span>Linear Fit Window (eV):</span>
              <input
                type="number"
                step="0.05"
                value={taucFitMin}
                onChange={e => setTaucFitMin(parseFloat(e.target.value) || 1.0)}
                style={{ width: '55px', padding: '1px 4px', fontSize: '0.72rem' }}
              />
              <span>to</span>
              <input
                type="number"
                step="0.05"
                value={taucFitMax}
                onChange={e => setTaucFitMax(parseFloat(e.target.value) || 2.5)}
                style={{ width: '55px', padding: '1px 4px', fontSize: '0.72rem' }}
              />
            </div>
          </div>

          {/* Extrapolated Bandgap Highlight Card */}
          <div style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            borderRadius: '6px',
            padding: '0.8rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                Extrapolated {taucMode === 'direct' ? 'Direct' : 'Indirect'} Optical Bandgap (Eg)
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22c55e' }}>
                Eg^{taucMode} = {taucFit.eg} eV
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--muted)', textAlign: 'right' }}>
              Linear Regression: y = {taucFit.m.toExponential(2)} · x + {taucFit.c.toExponential(2)}<br />
              Tangent Intercept at (α·hν)¹/ⁿ = 0
            </div>
          </div>

          {/* Tauc SVG Plot */}
          <div style={{
            background: '#0f172a',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            position: 'relative',
          }}>
            {(() => {
              const pts = opticalData.points;
              const isDirect = taucMode === 'direct';
              const svgW = 820;
              const svgH = 340;
              const margin = { top: 25, right: 40, bottom: 40, left: 75 };
              const plotW = svgW - margin.left - margin.right;
              const plotH = svgH - margin.top - margin.bottom;

              const eMin = pts[0].e;
              const eMax = pts[pts.length - 1].e;

              const yVals = pts.map(p => isDirect ? p.taucDirect : p.taucIndirect);
              const yMin = 0;
              const yMax = Math.max(1, Math.max(...yVals) * 1.05);

              const getX = e => margin.left + ((e - eMin) / (eMax - eMin)) * plotW;
              const getY = y => margin.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

              const pathTauc = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.e)} ${getY(yVals[i])}`, '');

              // Tangent extrapolation line from Eg to taucFitMax
              const tanX0 = getX(taucFit.eg);
              const tanY0 = getY(0);
              const tanX1 = getX(taucFitMax);
              const tanY1 = getY(taucFit.m * taucFitMax + taucFit.c);

              return (
                <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Axes */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
                  <text
                    x={margin.left - 52}
                    y={margin.top + plotH / 2}
                    fill="#38bdf8"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                    transform={`rotate(-90 ${margin.left - 52} ${margin.top + plotH / 2})`}>
                    {isDirect ? '(α·ℏω)² [(cm⁻¹·eV)²]' : '(α·ℏω)¹/² [(cm⁻¹·eV)¹/²]'}
                  </text>

                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" />
                  <text
                    x={margin.left + plotW / 2}
                    y={margin.top + plotH + 32}
                    fill="var(--muted)"
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle">
                    Photon Energy ℏω (eV)
                  </text>

                  {/* Tauc Curve */}
                  <path d={pathTauc} fill="none" stroke="#38bdf8" strokeWidth="2.2" />

                  {/* Tangent Extrapolation Line */}
                  <line
                    x1={tanX0}
                    y1={tanY0}
                    x2={tanX1}
                    y2={tanY1}
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                  />

                  {/* Eg Intercept Marker */}
                  <circle cx={tanX0} cy={tanY0} r="5" fill="#22c55e" stroke="#0f172a" strokeWidth="2" />
                  <text
                    x={tanX0}
                    y={tanY0 - 10}
                    fill="#22c55e"
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle">
                    Eg = {taucFit.eg} eV
                  </text>

                  {/* Data Points */}
                  {pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={getX(p.e)}
                      cy={getY(yVals[i])}
                      r="3"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: CLI & Execution Guide                                            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'workflow' && (
        <div className="subsection">
          <div className="subsection-title">
            SIESTA Optical Properties Execution Pipeline &amp; File Formats
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Reference guide for running optical frequency calculations and inspecting output matrices.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                1. Enable Section 6.20 in your input .fdf file
              </div>
              <pre style={{ background: '#090d16', padding: '0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#38bdf8' }}>
{`OpticalCalculation T
Optical.Energy.Minimum 0.0 eV
Optical.Energy.Maximum 6.0 eV
Optical.Broaden 0.05 eV
Optical.Scissor 0.0 eV
Optical.PolarizationType polycrystal
%block Optical.Mesh
  8 8 8
%endblock Optical.Mesh`}
              </pre>
            </div>

            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                2. Output File: SystemLabel.EPSIMG
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                SIESTA outputs <code>SystemLabel.EPSIMG</code> containing photon energy (eV) in the first column, followed by the Cartesian dielectric tensor components:
                <code style={{ display: 'block', background: '#090d16', padding: '0.4rem', marginTop: '4px', color: '#22c55e' }}>
                  # Energy(eV)    eps_xx    eps_yy    eps_zz    eps_xy    eps_xz    eps_yz
                </code>
                Upload this file into <strong>Tab 2 (Optical Studio)</strong> to automatically compute the real dielectric function ε₁(ω), refractive index n(ω), and absorption coefficient α(ω)!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
