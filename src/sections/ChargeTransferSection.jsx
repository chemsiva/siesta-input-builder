import { useState, useMemo, useRef } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';
import { OrbitalVisualizer3D } from '../components/OrbitalVisualizer3D.jsx';
import { getElementInfo } from '../utils/elementData.js';

// Benchmark Demostration Datasets for Bader ACF.dat
const DEMO_ACF_DATA = {
  perovskite: {
    title: 'CsPbI3 Perovskite (Cubic Unit Cell)',
    desc: 'Strong ionic charge transfer from Cs and Pb cations to Iodide anions.',
    raw: `    #         X           Y           Z        CHARGE      MIN DIST   ATOMIC VOL
 --------------------------------------------------------------------------------
    1     0.000000    0.000000    0.000000    8.082500     1.724500    32.450000   Cs
    2     3.140000    3.140000    3.140000   12.541000     1.412000    24.120000   Pb
    3     3.140000    3.140000    0.000000    7.792200     1.583000    28.640000   I
    4     3.140000    0.000000    3.140000    7.792100     1.583000    28.640000   I
    5     0.000000    3.140000    3.140000    7.792200     1.583000    28.640000   I
 --------------------------------------------------------------------------------
   VACUUM CHARGE:               0.0000
   VACUUM VOLUME:               0.0000
   NUMBER OF ELECTRONS:        44.0000`,
    zValenceMap: { Cs: 9, Pb: 14, I: 7 }, // Typical valence in pseudopotentials
  },
  water: {
    title: 'Water Molecule (H2O Gas Phase)',
    desc: 'Polar covalent bond: Oxygen pulls valence electron density from Hydrogen atoms.',
    raw: `    #         X           Y           Z        CHARGE      MIN DIST   ATOMIC VOL
 --------------------------------------------------------------------------------
    1     0.000000    0.000000    0.117400    7.241500     1.025000    16.850000   O
    2     0.000000    0.757000   -0.469600    0.379200     0.684000     3.240000   H
    3     0.000000   -0.757000   -0.469600    0.379300     0.684000     3.240000   H
 --------------------------------------------------------------------------------
   VACUUM CHARGE:               0.0000
   VACUUM VOLUME:               0.0000
   NUMBER OF ELECTRONS:         8.0000`,
    zValenceMap: { O: 6, H: 1 },
  },
  graphene: {
    title: 'Graphene / Pyridine Adsorption Interface',
    desc: 'Charge transfer and interfacial polarization between adsorbate and carbon lattice.',
    raw: `    #         X           Y           Z        CHARGE      MIN DIST   ATOMIC VOL
 --------------------------------------------------------------------------------
    1     0.000000    0.000000    3.250000    5.124000     1.010000    12.400000   N
    2     1.140000    0.720000    3.250000    3.842000     0.980000    11.800000   C
    3    -1.140000    0.720000    3.250000    3.841000     0.980000    11.800000   C
    4     1.140000    2.120000    3.250000    4.025000     0.990000    12.100000   C
    5    -1.140000    2.120000    3.250000    4.026000     0.990000    12.100000   C
    6     0.000000    2.820000    3.250000    3.945000     0.990000    12.000000   C
    7     0.000000    0.000000    0.000000    4.032000     1.050000    13.200000   C
    8     1.230000    0.710000    0.000000    4.028000     1.050000    13.150000   C
    9    -1.230000    0.710000    0.000000    4.029000     1.050000    13.150000   C
   10     1.230000    2.130000    0.000000    4.035000     1.050000    13.200000   C
 --------------------------------------------------------------------------------
   VACUUM CHARGE:               0.0000
   VACUUM VOLUME:               0.0000
   NUMBER OF ELECTRONS:        41.0000`,
    zValenceMap: { N: 5, C: 4, H: 1 },
  }
};

// Benchmark Planar Average Charge Density Difference Δρ(z)
const DEMO_PLANAR_DATA = {
  perovskite_het: {
    title: 'Perovskite Heterojunction (CsPbI3 / FAPbI3)',
    desc: 'Planar average electron accumulation and depletion across the cation-exchanged interface.',
    points: [
      { z: 0.0, drho: 0.000, dq: 0.000 },
      { z: 2.0, drho: 0.002, dq: 0.001 },
      { z: 4.0, drho: -0.015, dq: -0.012 },
      { z: 6.0, drho: -0.048, dq: -0.075 },
      { z: 8.0, drho: -0.125, dq: -0.245 },
      { z: 10.0, drho: 0.085, dq: -0.285 },
      { z: 12.0, drho: 0.285, dq: 0.085 },
      { z: 14.0, drho: 0.165, dq: 0.485 },
      { z: 16.0, drho: -0.065, dq: 0.585 },
      { z: 18.0, drho: -0.025, dq: 0.495 },
      { z: 20.0, drho: 0.008, dq: 0.480 },
      { z: 22.0, drho: 0.000, dq: 0.480 },
    ]
  },
  metal_adsorption: {
    title: 'Pyridine Adsorption on Au(111) Surface',
    desc: 'Push-back (pillow) effect: electron density depleted from vacuum and shifted toward metal.',
    points: [
      { z: 0.0, drho: 0.000, dq: 0.000 },
      { z: 3.0, drho: 0.012, dq: 0.015 },
      { z: 6.0, drho: -0.035, dq: -0.020 },
      { z: 9.0, drho: 0.185, dq: 0.150 },
      { z: 12.0, drho: -0.245, dq: 0.090 },
      { z: 15.0, drho: -0.080, dq: -0.240 },
      { z: 18.0, drho: 0.025, dq: -0.295 },
      { z: 21.0, drho: 0.000, dq: -0.295 },
    ]
  }
};

export function ChargeTransferSection() {
  const output = useFDFStore(s => s.output || {});
  const setField = useFDFStore(s => s.setField);
  const setOutput = (k, v) => setField('output', k, v);

  // Tab Navigation: 'grid', 'bader_table', 'planar', 'viewer3d', 'workflow'
  const [activeTab, setActiveTab] = useState('grid');

  // Bader Analysis State
  const [rawAcfText, setRawAcfText] = useState(DEMO_ACF_DATA.perovskite.raw);
  const [selectedDemo, setSelectedDemo] = useState('perovskite');
  const [valenceOverrides, setValenceOverrides] = useState(DEMO_ACF_DATA.perovskite.zValenceMap);
  const [hoveredAtom, setHoveredAtom] = useState(null);

  // Planar Average State
  const [planarPreset, setPlanarPreset] = useState('perovskite_het');
  const [hoveredZPoint, setHoveredZPoint] = useState(null);

  // Parse ACF.dat Text
  const parsedBader = useMemo(() => {
    if (!rawAcfText) return { atoms: [], totalElectrons: 0, netDipole: 0, speciesSummary: {} };

    const lines = rawAcfText.split('\n');
    const atoms = [];
    let totalElectrons = 0;

    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;

      if (trimmed.toUpperCase().includes('NUMBER OF ELECTRONS:')) {
        const parts = trimmed.split(':');
        if (parts[1]) totalElectrons = parseFloat(parts[1]) || 0;
        continue;
      }

      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 6 && !isNaN(parseInt(tokens[0], 10))) {
        const idx = parseInt(tokens[0], 10);
        const x = parseFloat(tokens[1]);
        const y = parseFloat(tokens[2]);
        const z = parseFloat(tokens[3]);
        const qBader = parseFloat(tokens[4]);
        const minDist = parseFloat(tokens[5]);
        const vol = parseFloat(tokens[6]) || 0;
        const sym = tokens[7] || (idx === 1 ? 'Cs' : idx === 2 ? 'Pb' : 'I');

        // Estimate default Z_valence if not overridden
        let zVal = valenceOverrides[sym];
        if (zVal === undefined) {
          const el = getElementInfo(sym);
          zVal = el?.sym === 'H' ? 1 : el?.sym === 'O' ? 6 : el?.sym === 'C' ? 4 : el?.sym === 'N' ? 5 : el?.sym === 'Pb' ? 14 : el?.sym === 'I' ? 7 : 4;
        }

        const deltaQ = parseFloat((zVal - qBader).toFixed(4)); // > 0: lost e- (oxidized), < 0: gained e- (reduced)

        atoms.push({
          idx,
          x, y, z,
          charge: qBader,
          minDist,
          vol,
          sym,
          zVal,
          deltaQ,
        });
      }
    }

    if (totalElectrons === 0 && atoms.length > 0) {
      totalElectrons = atoms.reduce((acc, a) => acc + a.charge, 0);
    }

    // Species Summary
    const speciesSummary = {};
    atoms.forEach(a => {
      if (!speciesSummary[a.sym]) {
        speciesSummary[a.sym] = { count: 0, totalDeltaQ: 0, avgDeltaQ: 0, totalVol: 0 };
      }
      speciesSummary[a.sym].count += 1;
      speciesSummary[a.sym].totalDeltaQ += a.deltaQ;
      speciesSummary[a.sym].totalVol += a.vol;
    });
    Object.keys(speciesSummary).forEach(s => {
      speciesSummary[s].avgDeltaQ = parseFloat((speciesSummary[s].totalDeltaQ / speciesSummary[s].count).toFixed(3));
      speciesSummary[s].totalDeltaQ = parseFloat(speciesSummary[s].totalDeltaQ.toFixed(3));
    });

    // Interfacial Dipole Estimate μ_z = sum(ΔQ_i * z_i) (in e*Å and Debye)
    let dipoleZ = 0;
    atoms.forEach(a => {
      dipoleZ += a.deltaQ * a.z;
    });
    const dipoleDebye = parseFloat((dipoleZ * 4.803204).toFixed(3)); // 1 e*Å = 4.8032 Debye

    return {
      atoms,
      totalElectrons: parseFloat(totalElectrons.toFixed(3)),
      dipoleZ: parseFloat(dipoleZ.toFixed(3)),
      dipoleDebye,
      speciesSummary,
    };
  }, [rawAcfText, valenceOverrides]);

  // Handle Preset Loading
  const loadDemoACF = (key) => {
    const demo = DEMO_ACF_DATA[key];
    if (!demo) return;
    setSelectedDemo(key);
    setRawAcfText(demo.raw);
    setValenceOverrides(demo.zValenceMap);
  };

  // Quick Preset Handlers for FDF Real-Space Grid Flags
  const applyPreset = (preset) => {
    if (preset === 'standard') {
      setOutput('SaveRho', 'true');
      setOutput('SaveDeltaRho', 'true');
    } else if (preset === 'bader') {
      setOutput('SaveRho', 'true');
      setOutput('SaveBaderCharge', 'true');
      setOutput('bader-core-radius-standard', '1.3 Bohr');
      setOutput('bader-core-radius-hydrogen', '0.4 Bohr');
    } else if (preset === 'potentials') {
      setOutput('SaveElectrostaticPotential', 'true');
      setOutput('SaveTotalPotential', 'true');
    } else if (preset === 'fast_analysis') {
      setOutput('AnalyzeChargeDensityOnly', 'true');
      setOutput('WriteMullikenPop', '1');
      setOutput('SaveRho', 'true');
    } else if (preset === 'clear') {
      [
        'SaveRho', 'SaveDeltaRho', 'SaveRhoXC',
        'SaveElectrostaticPotential', 'SaveNeutralAtomPotential', 'SaveTotalPotential',
        'SaveIonicCharge', 'SaveTotalCharge',
        'SaveBaderCharge', 'AnalyzeChargeDensityOnly'
      ].forEach(k => setOutput(k, 'false'));
    }
  };

  // Export CSV Table
  const handleExportCSV = () => {
    if (parsedBader.atoms.length === 0) return;
    const header = 'Atom,Element,X,Y,Z,Z_Valence,Q_Bader,Delta_Q,Min_Dist,Atomic_Vol\n';
    const rows = parsedBader.atoms.map(a =>
      `${a.idx},${a.sym},${a.x},${a.y},${a.z},${a.zVal},${a.charge},${a.deltaQ},${a.minDist},${a.vol}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bader_charge_transfer_${selectedDemo}.csv`;
    link.click();
  };

  return (
    <div className="section-pane">
      <SectionHeader
        title="14 Charge Transfer &amp; Grid Densities Analysis (Section 6.24)"
        desc="Configure real-space charge densities (ρ, δρ), potentials (VH, VT), and Henkelman Bader charge partitioning. Quantify net charge transfer ΔQ, planar average charge displacement Δρ(z), and 3D charge redistribution isosurfaces."
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
            className={`btn btn-sm ${activeTab === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('grid')}>
            FDF Real-Space Grid Flags
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'bader_table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('bader_table')}>
            Bader Charge Transfer Studio (ACF.dat)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'planar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('planar')}>
            Planar Average Δρ(z) &amp; ΔQ(z)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'viewer3d' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('viewer3d')}>
            3D Charge Difference Δρ(r) Viewer
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'workflow' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('workflow')}>
            Bader CLI Workflow Guide
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: FDF Real-Space Grid Flags (Section 6.24)                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'grid' && (
        <>
          {/* Quick Preset Actions */}
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
              1-Click Grid Presets:
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('standard')}
                title="SaveRho + SaveDeltaRho for standard charge density differences">
                ⚡ Charge Densities (RHO + DRHO)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => applyPreset('bader')}
                title="SaveRho + SaveBaderCharge with model core radii for Henkelman Bader analysis">
                🔬 Henkelman Bader Package
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('potentials')}
                title="SaveElectrostaticPotential + SaveTotalPotential for vacuum level and work function">
                ⚡ Work Function (VH + VT)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('fast_analysis')}
                title="AnalyzeChargeDensityOnly without full diagonalization">
                🔄 Fast Post-SCF (AnalyzeOnly)
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => applyPreset('clear')}
                title="Turn off all real-space grid output flags">
                🧼 Clear All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
            {/* Card 1: Charge Densities on Real-Space Grid */}
            <div className="subsection" style={{ margin: 0 }}>
              <div className="subsection-title">Charge Densities on Real-Space Mesh</div>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
                Evaluated on the discrete real-space mesh used by DHSCF. Written to binary or netCDF files.
              </p>

              <FieldRow
                label="SaveRho (.RHO)"
                propKey="SaveRho"
                hint="Valence pseudocharge density on real-space mesh (SystemLabel.RHO or Rho.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveRho === 'true'}
                    onChange={e => setOutput('SaveRho', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveRho === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveDeltaRho (.DRHO)"
                propKey="SaveDeltaRho"
                hint="Deformation density δρ(r) = ρ(r) − ρ_atm(r) (SystemLabel.DRHO or DeltaRho.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveDeltaRho === 'true'}
                    onChange={e => setOutput('SaveDeltaRho', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveDeltaRho === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveRhoXC (.RHOXC)"
                propKey="SaveRhoXC"
                hint="Valence density including non-local core corrections for XC energy (SystemLabel.RHOXC or RhoXC.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveRhoXC === 'true'}
                    onChange={e => setOutput('SaveRhoXC', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveRhoXC === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveIonicCharge (.IOCH)"
                propKey="SaveIonicCharge"
                hint="Soft diffuse ionic charge density on mesh. Convention: electrons positive, ions negative (SystemLabel.IOCH)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveIonicCharge === 'true'}
                    onChange={e => setOutput('SaveIonicCharge', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveIonicCharge === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveTotalCharge (.TOCH)"
                propKey="SaveTotalCharge"
                hint="Total charge density (ionic + electronic) on mesh (SystemLabel.TOCH or TotalCharge.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveTotalCharge === 'true'}
                    onChange={e => setOutput('SaveTotalCharge', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveTotalCharge === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>
            </div>

            {/* Card 2: Electrostatic & Effective Potentials */}
            <div className="subsection" style={{ margin: 0 }}>
              <div className="subsection-title">Electrostatic &amp; Effective Potentials</div>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
                Potentials on DHSCF mesh. Side effect: prints vacuum level in output for work function determination.
              </p>

              <FieldRow
                label="SaveElectrostaticPotential (.VH)"
                propKey="SaveElectrostaticPotential"
                hint="Total electrostatic potential (Hartree + local pseudopotential) on mesh (SystemLabel.VH)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveElectrostaticPotential === 'true'}
                    onChange={e => setOutput('SaveElectrostaticPotential', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveElectrostaticPotential === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveTotalPotential (.VT)"
                propKey="SaveTotalPotential"
                hint="Valence total effective local potential (VH + VXC + Vlocal). Prints vacuum level in stdout (SystemLabel.VT)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveTotalPotential === 'true'}
                    onChange={e => setOutput('SaveTotalPotential', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveTotalPotential === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveNeutralAtomPotential (.VNA)"
                propKey="SaveNeutralAtomPotential"
                hint="Neutral-atom potential written at start of SCF cycle (SystemLabel.VNA or Vna.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveNeutralAtomPotential === 'true'}
                    onChange={e => setOutput('SaveNeutralAtomPotential', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveNeutralAtomPotential === 'true' ? 'True (Save)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="SaveGridFunc.Format"
                propKey="SaveGridFunc.Format"
                hint="binary (unformatted machine-dependent) or ascii text. ASCII files are significantly larger.">
                <SelectInput
                  value={output['SaveGridFunc.Format'] || 'binary'}
                  options={['binary', 'ascii']}
                  onChange={v => setOutput('SaveGridFunc.Format', v)}
                />
              </FieldRow>

              <FieldRow
                label="AnalyzeChargeDensityOnly"
                propKey="AnalyzeChargeDensityOnly"
                hint="Compute partial charges (Hirshfeld, Voronoi, Bader) from input DM and stop without diagonalization">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.AnalyzeChargeDensityOnly === 'true'}
                    onChange={e => setOutput('AnalyzeChargeDensityOnly', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.AnalyzeChargeDensityOnly === 'true' ? 'True (Analyze Only)' : 'False'}</span>
                </label>
              </FieldRow>
            </div>
          </div>

          {/* Card 3: Henkelman Bader Analysis Grid Block */}
          <div className="subsection" style={{ marginTop: '1.2rem' }}>
            <div className="subsection-title">
              Henkelman Bader Charge Partitioning Grid Options
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
              The Henkelman Bader algorithm requires atomic core charge maxima that are not naturally present in pseudopotential calculations. SIESTA adds generalized Gaussian model core charges to the valence density when <code>SaveBaderCharge</code> is enabled.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
              <FieldRow
                label="SaveBaderCharge (.BADER)"
                propKey="SaveBaderCharge"
                hint="Save valence charge + generalized Gaussian core charges (SystemLabel.BADER or BaderCharge.grid.nc)">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={output.SaveBaderCharge === 'true'}
                    onChange={e => setOutput('SaveBaderCharge', e.target.checked ? 'true' : 'false')}
                  />
                  <span className="toggle-label">{output.SaveBaderCharge === 'true' ? 'True (Enabled)' : 'False'}</span>
                </label>
              </FieldRow>

              <FieldRow
                label="bader-core-radius-standard"
                propKey="bader-core-radius-standard"
                hint="Confinement radius for model core charges on standard atoms (default 1.0 - 1.3 Bohr)">
                <TextInput
                  value={output['bader-core-radius-standard'] || '1.3 Bohr'}
                  onChange={v => setOutput('bader-core-radius-standard', v)}
                  placeholder="1.3 Bohr"
                />
              </FieldRow>

              <FieldRow
                label="bader-core-radius-hydrogen"
                propKey="bader-core-radius-hydrogen"
                hint="Confinement radius for artificial 1-electron core on hydrogen atoms (default 0.4 - 0.6 Bohr)">
                <TextInput
                  value={output['bader-core-radius-hydrogen'] || '0.4 Bohr'}
                  onChange={v => setOutput('bader-core-radius-hydrogen', v)}
                  placeholder="0.4 Bohr"
                />
              </FieldRow>
            </div>

            <div style={{
              marginTop: '0.8rem',
              padding: '0.6rem 0.8rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '6px',
              fontSize: '0.74rem',
              lineHeight: 1.5,
              color: 'var(--fg)',
            }}>
              <strong>Recommendation from SIESTA Documentation:</strong> When using <code>SaveBaderCharge</code>, use a moderately high <code>MeshCutoff</code> (300–500 Ry) to accurately represent localized Gaussian core charges. Convert with <code>grid2cube</code> and execute:
              <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '0.35rem 0.6rem', marginTop: '4px', borderRadius: '4px', color: '#38bdf8' }}>
                bader SystemLabel.RHO.cube -ref SystemLabel.BADER.cube
              </code>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Bader Charge Transfer Studio (ACF.dat Analyzer)                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bader_table' && (
        <div>
          {/* Preset Buttons & Upload */}
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
                className={`btn btn-xs ${selectedDemo === 'perovskite' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => loadDemoACF('perovskite')}>
                Perovskite (CsPbI3)
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedDemo === 'water' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => loadDemoACF('water')}>
                Water Molecule (H2O)
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedDemo === 'graphene' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => loadDemoACF('graphene')}>
                Pyridine / Graphene Interface
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <label className="btn btn-xs btn-secondary" style={{ cursor: 'pointer' }}>
                Upload ACF.dat
                <input
                  type="file"
                  accept=".dat,.txt"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = ev => {
                      setRawAcfText(ev.target.result);
                      setSelectedDemo('uploaded');
                    };
                    r.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={handleExportCSV}
                title="Export analyzed Bader charge table to CSV">
                Export CSV
              </button>
            </div>
          </div>

          {/* Key Metrics Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.8rem',
            marginBottom: '1.2rem',
          }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Total Bader Electrons</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {parsedBader.totalElectrons} e
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>Integrated over zero-flux basins</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Interfacial Dipole (μ_z)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                {parsedBader.dipoleDebye} D
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>
                {parsedBader.dipoleZ} e·Å along z-axis
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Species Net Transfer</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '4px' }}>
                {Object.entries(parsedBader.speciesSummary).map(([s, data]) => (
                  <span key={s} style={{
                    fontSize: '0.7rem',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: data.avgDeltaQ > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: data.avgDeltaQ > 0 ? '#ef4444' : '#22c55e',
                    fontWeight: 600,
                  }}>
                    {s}: {data.avgDeltaQ > 0 ? `+${data.avgDeltaQ}` : data.avgDeltaQ} e
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '4px' }}>Mean ΔQ per atom</div>
            </div>
          </div>

          {/* Interactive Atomic Charge Table */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1.2rem',
          }}>
            <div style={{ padding: '0.6rem 0.8rem', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.82rem' }}>Atomic Charge Transfer &amp; Population Partitioning</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {parsedBader.atoms.length} atoms analyzed
              </span>
            </div>
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>#</th>
                    <th style={{ padding: '6px 10px' }}>Elem</th>
                    <th style={{ padding: '6px 10px' }}>Position (X, Y, Z) Å</th>
                    <th style={{ padding: '6px 10px' }}>Z_val</th>
                    <th style={{ padding: '6px 10px' }}>Q_Bader (e)</th>
                    <th style={{ padding: '6px 10px' }}>Net ΔQ (e)</th>
                    <th style={{ padding: '6px 10px' }}>Status</th>
                    <th style={{ padding: '6px 10px' }}>Min Dist (Å)</th>
                    <th style={{ padding: '6px 10px' }}>Vol (Å³)</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedBader.atoms.map(a => {
                    const isOxidized = a.deltaQ > 0;
                    return (
                      <tr
                        key={a.idx}
                        onMouseEnter={() => setHoveredAtom(a.idx)}
                        onMouseLeave={() => setHoveredAtom(null)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: hoveredAtom === a.idx ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        }}>
                        <td style={{ padding: '6px 10px' }}>{a.idx}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>
                          <span style={{
                            color: '#' + (getElementInfo(a.sym)?.color || 0xffffff).toString(16).padStart(6, '0')
                          }}>
                            {a.sym}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>
                          {a.x.toFixed(3)}, {a.y.toFixed(3)}, {a.z.toFixed(3)}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="number"
                            step="1"
                            value={a.zVal}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setValenceOverrides(prev => ({ ...prev, [a.sym]: val }));
                            }}
                            style={{
                              width: '45px',
                              padding: '1px 3px',
                              fontSize: '0.72rem',
                              background: 'var(--surface2)',
                              border: '1px solid var(--border)',
                              borderRadius: '3px',
                              color: 'var(--fg)',
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>{a.charge.toFixed(3)}</td>
                        <td style={{
                          padding: '6px 10px',
                          fontWeight: 700,
                          color: isOxidized ? '#ef4444' : '#22c55e',
                        }}>
                          {isOxidized ? `+${a.deltaQ.toFixed(3)}` : a.deltaQ.toFixed(3)}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            background: isOxidized ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isOxidized ? '#ef4444' : '#22c55e',
                          }}>
                            {isOxidized ? 'Depleted (Lost e⁻)' : 'Accumulated (Gained e⁻)'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{a.minDist.toFixed(3)}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{a.vol.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: Planar Average Charge Displacement Δρ(z) & ΔQ(z)                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planar' && (
        <div>
          {/* Preset Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem',
            background: 'var(--surface2)',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Interface Model:</span>
              <button
                type="button"
                className={`btn btn-xs ${planarPreset === 'perovskite_het' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPlanarPreset('perovskite_het')}>
                Perovskite Heterojunction
              </button>
              <button
                type="button"
                className={`btn btn-xs ${planarPreset === 'metal_adsorption' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPlanarPreset('metal_adsorption')}>
                Pyridine on Metal (Push-Back)
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {DEMO_PLANAR_DATA[planarPreset]?.desc}
            </span>
          </div>

          {/* Interactive SVG Dual-Axis Chart */}
          <div style={{
            background: '#0f172a',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--fg)' }}>
                Planar Average Charge Density Difference Δρ̄(z) &amp; Cumulative Transfer ΔQ(z)
              </strong>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>― Δρ̄(z) [e/Å] (Left)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>- - ΔQ(z) [e] (Right)</span>
              </div>
            </div>

            {/* SVG Plot */}
            {(() => {
              const pts = DEMO_PLANAR_DATA[planarPreset]?.points || [];
              const svgW = 820;
              const svgH = 340;
              const margin = { top: 25, right: 60, bottom: 40, left: 60 };
              const plotW = svgW - margin.left - margin.right;
              const plotH = svgH - margin.top - margin.bottom;

              const zMin = Math.min(...pts.map(p => p.z));
              const zMax = Math.max(...pts.map(p => p.z));

              const drhoVals = pts.map(p => p.drho);
              const drhoMin = Math.min(...drhoVals, -0.3);
              const drhoMax = Math.max(...drhoVals, 0.3);

              const dqVals = pts.map(p => p.dq);
              const dqMin = Math.min(...dqVals, -0.4);
              const dqMax = Math.max(...dqVals, 0.6);

              const getX = z => margin.left + ((z - zMin) / (zMax - zMin)) * plotW;
              const getYRho = d => margin.top + (1 - (d - drhoMin) / (drhoMax - drhoMin)) * plotH;
              const getYDq = q => margin.top + (1 - (q - dqMin) / (dqMax - dqMin)) * plotH;

              const zeroYRho = getYRho(0);

              // Path strings
              const rhoPath = pts.reduce((acc, p, i) =>
                `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.z)} ${getYRho(p.drho)}`, '');

              const dqPath = pts.reduce((acc, p, i) =>
                `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.z)} ${getYDq(p.dq)}`, '');

              return (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Zero reference line */}
                  <line
                    x1={margin.left}
                    y1={zeroYRho}
                    x2={margin.left + plotW}
                    y2={zeroYRho}
                    stroke="rgba(148, 163, 184, 0.3)"
                    strokeDasharray="4 4"
                    strokeWidth="1.2"
                  />

                  {/* Shaded accumulation & depletion zones */}
                  <path
                    d={`${rhoPath} L ${getX(zMax)} ${zeroYRho} L ${getX(zMin)} ${zeroYRho} Z`}
                    fill="rgba(56, 189, 248, 0.12)"
                  />

                  {/* Left Axis: Δρ̄(z) */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" />
                  <text x={margin.left - 45} y={margin.top + plotH / 2} fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle" transform={`rotate(-90 ${margin.left - 45} ${margin.top + plotH / 2})`}>
                    Δρ̄(z) (e/Å)
                  </text>

                  {/* Right Axis: ΔQ(z) */}
                  <line x1={margin.left + plotW} y1={margin.top} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" />
                  <text x={margin.left + plotW + 45} y={margin.top + plotH / 2} fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="middle" transform={`rotate(90 ${margin.left + plotW + 45} ${margin.top + plotH / 2})`}>
                    ΔQ(z) (e)
                  </text>

                  {/* Bottom Axis: z (Å) */}
                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" />
                  <text x={margin.left + plotW / 2} y={margin.top + plotH + 30} fill="var(--muted)" fontSize="11" fontWeight="600" textAnchor="middle">
                    z Coordinate along Interface Normal (Å)
                  </text>

                  {/* Curves */}
                  <path d={rhoPath} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                  <path d={dqPath} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="5 4" />

                  {/* Data Points */}
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={getX(p.z)}
                        cy={getYRho(p.drho)}
                        r="4"
                        fill="#38bdf8"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredZPoint(p)}
                        onMouseLeave={() => setHoveredZPoint(null)}
                        style={{ cursor: 'pointer' }}
                      />
                      <circle
                        cx={getX(p.z)}
                        cy={getYDq(p.dq)}
                        r="3.5"
                        fill="#f59e0b"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredZPoint(p)}
                        onMouseLeave={() => setHoveredZPoint(null)}
                        style={{ cursor: 'pointer' }}
                      />
                    </g>
                  ))}
                </svg>
              );
            })()}

            {/* Readout Chip */}
            {hoveredZPoint && (
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '6px',
                padding: '0.4rem 0.7rem',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                color: 'var(--fg)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div>z = {hoveredZPoint.z.toFixed(2)} Å</div>
                <div style={{ color: '#38bdf8' }}>Δρ̄(z) = {hoveredZPoint.drho.toFixed(4)} e/Å</div>
                <div style={{ color: '#f59e0b' }}>ΔQ(z) = {hoveredZPoint.dq.toFixed(4)} e</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: 3D Charge Difference Δρ(r) Viewer                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'viewer3d' && (
        <div>
          <OrbitalVisualizer3D />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: Bader Workflow & CLI Guide                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'workflow' && (
        <div className="subsection">
          <div className="subsection-title">
            Step-by-Step Terminal Execution Pipeline: SIESTA → grid2cube → Henkelman Bader
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Follow these 4 verified steps to compute atomic Bader charges and electron transfer from your SIESTA calculation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {/* Step 1 */}
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                Step 1: Enable Grid Output Flags in your SIESTA FDF Input
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '6px' }}>
                Add the following options to your input .fdf file (or click the <strong>Henkelman Bader Package</strong> preset in Tab 1):
              </div>
              <pre style={{ background: '#090d16', padding: '0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#38bdf8' }}>
{`MeshCutoff 350.0 Ry
SaveRho T
SaveBaderCharge T
bader-core-radius-standard 1.3 Bohr
bader-core-radius-hydrogen 0.4 Bohr`}
              </pre>
            </div>

            {/* Step 2 */}
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                Step 2: Convert Binary Mesh Files to Gaussian Cube Format
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '6px' }}>
                Use the official SIESTA utility <code>Util/Grid/grid2cube</code> to convert <code>SystemLabel.RHO</code> and <code>SystemLabel.BADER</code> into readable 3D volumetric cubes:
              </div>
              <pre style={{ background: '#090d16', padding: '0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#22c55e' }}>
{`grid2cube SystemLabel.RHO
grid2cube SystemLabel.BADER`}
              </pre>
            </div>

            {/* Step 3 */}
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                Step 3: Execute Henkelman Bader Analysis
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '6px' }}>
                Run the Henkelman Bader executable with <code>-ref</code> pointing to the model core density:
              </div>
              <pre style={{ background: '#090d16', padding: '0.5rem', borderRadius: '4px', fontSize: '0.72rem', color: '#f59e0b' }}>
{`bader SystemLabel.RHO.cube -ref SystemLabel.BADER.cube`}
              </pre>
            </div>

            {/* Step 4 */}
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '4px' }}>
                Step 4: Inspect Output Files
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                • <code>ACF.dat</code>: Atomic coordinates, calculated Bader charges $Q_i$, distance to zero-flux boundary, and atomic volume $\Omega_i$. Upload this file directly into <strong>Tab 2 (Bader Studio)</strong> to automatically calculate net charge transfer $\Delta Q_i$!<br/>
                • <code>AVF.dat</code>: Atomic volumes of the Bader basins.<br/>
                • <code>BCF.dat</code>: Bader charge flux between neighboring basins.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
