import { useState, useRef } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { SectionHeader } from '../components/FieldRow';
import { parseMDE } from '../parser/mdeParser.js';
import { parseANI } from '../parser/aniParser.js';
import { parseSiestaOut } from '../parser/outParser.js';
import { ConvergenceChart } from '../components/ConvergenceChart.jsx';
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx';
import { DOSPlotterSuite } from '../components/DOSPlotterSuite.jsx';
import { DOSComparisonStudio } from '../components/DOSComparisonStudio.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
const TRAJ_FLAGS = [
  { key: 'WriteMDXmol',      type: 'bool', label: 'WriteMDXmol (.ANI)', fileExt: '.ANI',
    help: 'Accumulate coordinates into SystemLabel.ANI (XYZ trajectory format for VMD, JMol, XCrySDen, OVITO)' },
  { key: 'WriteMDhistory',   type: 'bool', label: 'WriteMDhistory (.MDE / .MD)', fileExt: '.MDE + .MD',
    help: 'Accumulate MD thermodynamic history into SystemLabel.MDE (temperatures, kinetic/potential/total energy, volume, pressure) and coordinates/velocities into SystemLabel.MD' },
  { key: 'WriteCoorXmol',    type: 'bool', label: 'WriteCoorXmol (.xyz)', fileExt: '.xyz',
    help: 'Atomic coordinates in XMOL/XYZ format at the end of the calculation' },
  { key: 'WriteCoorStep',    type: 'bool', label: 'WriteCoorStep', fileExt: 'stdout',
    help: 'Print atomic coordinates at each geometry/MD step in the output file' },
];

const GRID_FLAGS = [
  { key: 'SaveRho',          type: 'bool', label: 'SaveRho (.RHO)', fileExt: '.RHO',
    help: 'Valence electron charge density on the real-space grid' },
  { key: 'SaveDeltaRho',     type: 'bool', label: 'SaveDeltaRho (.DRHO)', fileExt: '.DRHO',
    help: 'Charge density difference Δρ (total − atomic sum) on the grid' },
  { key: 'SaveElectrostaticPotential', type: 'bool', label: 'SaveElectrostaticPotential (.VH)', fileExt: '.VH',
    help: 'Electrostatic (Hartree + ionic) potential on the grid' },
  { key: 'SaveTotalPotential',         type: 'bool', label: 'SaveTotalPotential (.VT)', fileExt: '.VT',
    help: 'Total Kohn-Sham effective potential on the grid' },
  { key: 'SaveHS',           type: 'bool', label: 'SaveHS (.HSX)', fileExt: '.HSX',
    help: 'Save Hamiltonian and overlap matrices to SystemLabel.HSX' },
];

const GENERAL_FLAGS = [
  { key: 'WriteDM',          type: 'bool', label: 'WriteDM (.DM)', fileExt: '.DM',
    help: 'Write density matrix to SystemLabel.DM (needed for SCF restarts)' },
  { key: 'WriteForces',      type: 'bool', label: 'WriteForces', fileExt: 'stdout',
    help: 'Print atomic forces to stdout at each step' },
  { key: 'WriteMullikenPop', type: 'select', options: ['0','1','2','3'],
    label: 'WriteMullikenPop', fileExt: 'stdout',
    help: '0=none, 1=per-atom charges, 2=per-orbital charges, 3=full density matrix overlap' },
  { key: 'LongOutput',       type: 'bool', label: 'LongOutput', fileExt: 'stdout',
    help: 'Verbose output log: coordinates, forces, eigenvalues, and k-points' },
];
const DEMO_ANI_TEXT = `3
Frame 1 - H2O relaxation
O   0.000000   0.000000   0.117400
H   0.000000   0.757000  -0.469600
H   0.000000  -0.757000  -0.469600
3
Frame 2 - H2O relaxation
O   0.000000   0.000000   0.119200
H   0.000000   0.762000  -0.472000
H   0.000000  -0.762000  -0.472000
3
Frame 3 - H2O relaxation
O   0.000000   0.000000   0.121500
H   0.000000   0.766000  -0.474000
H   0.000000  -0.766000  -0.474000
3
Frame 4 - H2O relaxation
O   0.000000   0.000000   0.122800
H   0.000000   0.768000  -0.475000
H   0.000000  -0.768000  -0.475000
3
Frame 5 - H2O relaxation
O   0.000000   0.000000   0.123500
H   0.000000   0.769500  -0.475500
H   0.000000  -0.769500  -0.475500
`;

const DEMO_MDE_TEXT = `# Step     T (K)     E_KS (eV)    E_tot (eV)   Vol (A^3)    P (kBar)
     0      0.00   -468.21000   -468.21000     125.000      12.450
     1      0.00   -468.28500   -468.28500     125.000       8.320
     2      0.00   -468.34200   -468.34200     125.000       4.150
     3      0.00   -468.38000   -468.38000     125.000       1.820
     4      0.00   -468.40500   -468.40500     125.000       0.450
     5      0.00   -468.41800   -468.41800     125.000       0.080
     6      0.00   -468.42200   -468.42200     125.000       0.010
`;

const DEMO_OUT_TEXT = `Executable      : siesta
Version         : 5.4.2
reinit: System Label: h2o_relax
reinit: System Name: Water Molecule Relaxation
Species number:   1 Atomic number:    8 Label: O
Species number:   2 Atomic number:    1 Label: H
initatomlists: Number of atoms, orbitals, and projectors:      3     23     20
InitMesh: Mesh cutoff (required, used) =   250.000   254.210 Ry
outcell: Unit cell vectors (Ang):
       10.000000    0.000000    0.000000
        0.000000   10.000000    0.000000
        0.000000    0.000000   10.000000
outcell: Cell volume (Ang**3) :   1000.0000
new_DM -- step:    1
scf:    1    -465.123400    -468.102300    -468.102300   0.052100  -5.120000   0.082100
scf:    2    -467.892100    -468.351200    -468.351200   0.018200  -5.125000   0.024300
scf:    3    -468.398000    -468.415000    -468.415000   0.004100  -5.128000   0.005200
scf:    4    -468.421500    -468.422000    -468.422000   0.000210  -5.128500   0.000320
siesta:         Total =    -468.422030
siesta:         Fermi =      -5.128500
siesta: Max force =           0.004210
siesta: Cell volume =      1000.000000 Ang**3
Job completed
`;
export function OutputSection() {
  const output = useFDFStore(s => s.output);
  const structure = useFDFStore(s => s.structure);
  const setField = useFDFStore(s => s.setField);
  const set = (k, v) => setField('output', k, v);

  // Mode: 'flags' (configure FDF keywords) vs 'viewer' (upload & analyze .out, .MDE, .ANI)
  const [activeTab, setActiveTab] = useState('flags');
  const [dosViewMode, setDosViewMode] = useState('single'); // 'single' | 'compare'
  // Uploaded and parsed data states
  const [outData, setOutData] = useState(null);
  const [mdeData, setMdeData] = useState(null);
  const [aniData, setAniData] = useState(null);

  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const outInputRef = useRef(null);
  const mdeInputRef = useRef(null);
  const aniInputRef = useRef(null);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB safety limit

  // File loading handlers
  const handleLoadOut = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`⚠️ File exceeds 100 MB security limit (${file.name}).`);
      e.target.value = '';
      return;
    }
    setLoadingMsg(`Parsing ${file.name}...`);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseSiestaOut(ev.target.result);
        setOutData(parsed);
        setLoadingMsg('');
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
        setLoadingMsg('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadMDE = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`⚠️ File exceeds 100 MB security limit (${file.name}).`);
      e.target.value = '';
      return;
    }
    setLoadingMsg(`Parsing ${file.name}...`);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseMDE(ev.target.result);
        setMdeData(parsed);
        setLoadingMsg('');
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
        setLoadingMsg('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadANI = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`⚠️ File exceeds 100 MB security limit (${file.name}).`);
      e.target.value = '';
      return;
    }
    setLoadingMsg(`Parsing ${file.name}...`);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseANI(ev.target.result);
        setAniData(parsed);
        setLoadingMsg('');
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
        setLoadingMsg('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const handleLoadDemoANI = () => {
    try {
      const parsed = parseANI(DEMO_ANI_TEXT);
      setAniData(parsed);
      setErrorMsg('');
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleLoadDemoMDE = () => {
    try {
      const parsed = parseMDE(DEMO_MDE_TEXT);
      setMdeData(parsed);
      setErrorMsg('');
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleLoadDemoOut = () => {
    try {
      const parsed = parseSiestaOut(DEMO_OUT_TEXT);
      setOutData(parsed);
      setErrorMsg('');
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleLoadAllDemo = () => {
    handleLoadDemoANI();
    handleLoadDemoMDE();
    handleLoadDemoOut();
  };

  const handleClearAll = () => {
    setOutData(null);
    setMdeData(null);
    setAniData(null);
    setErrorMsg('');
    setLoadingMsg('');
  };

  // Drag and drop for multi-file upload
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const name = file.name.toLowerCase();
      const reader = new FileReader();
      if (name.endsWith('.mde')) {
        reader.onload = (ev) => {
          try { setMdeData(parseMDE(ev.target.result)); } catch (err) { setErrorMsg(err.message); }
        };
        reader.readAsText(file);
      } else if (name.endsWith('.ani') || name.endsWith('.xyz')) {
        reader.onload = (ev) => {
          try { setAniData(parseANI(ev.target.result)); } catch (err) { setErrorMsg(err.message); }
        };
        reader.readAsText(file);
      } else if (name.endsWith('.out') || name.endsWith('.log')) {
        reader.onload = (ev) => {
          try { setOutData(parseSiestaOut(ev.target.result)); } catch (err) { setErrorMsg(err.message); }
        };
        reader.readAsText(file);
      }
    });
  };

  const renderFlag = (f) => (
    <div key={f.key} className="flag-card" title={f.help}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flag-label"><code>{f.label}</code></div>
        {f.fileExt && (
          <span style={{
            fontSize: '0.68rem',
            padding: '0.1rem 0.35rem',
            borderRadius: '3px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--accent)',
            fontFamily: 'monospace',
            fontWeight: 600,
          }}>
            {f.fileExt}
          </span>
        )}
      </div>
      <div className="flag-help">{f.help}</div>
      <div className="flag-control">
        {f.type === 'select' ? (
          <select className="input select"
            value={output[f.key] ?? '0'}
            onChange={e => set(f.key, e.target.value)}>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <label className="toggle">
            <input type="checkbox"
              checked={output[f.key] === 'true' || output[f.key] === true}
              onChange={e => set(f.key, e.target.checked ? 'true' : 'false')} />
            <span className="toggle-label">
              {output[f.key] === 'true' ? '✓ on' : 'off'}
            </span>
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="section-pane">
      <SectionHeader title="Output Section" />

      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '2px solid var(--border)',
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
      }}>
        <button
          className={`btn ${activeTab === 'flags' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('flags')}>
          ⚙️ FDF Output Flags
        </button>
        <button
          className={`btn ${activeTab === 'viewer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('viewer')}
          style={{ position: 'relative' }}>
          📊 Results Analysis & Viewer (.out, .MDE, .ANI, .EIG, .PDOS)
          {(mdeData || aniData || outData) && (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--success, #10b981)',
              display: 'inline-block',
              marginLeft: '6px',
            }} />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODE 1: FDF OUTPUT FLAGS CONFIGURATION                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'flags' && (
        <>
          <p className="section-desc">
            Configure output files to be produced by SIESTA in your <code>.fdf</code> file.
            All flags default to <code>false</code> (except <code>WriteDM true</code> for restarts).
          </p>

          {/* Trajectories & Animations */}
          <div className="subsection">
            <div className="subsection-title">
              🎬 Trajectory &amp; Animation Files (.ANI, .MDE, .MD, .xyz)
            </div>
            <p className="subsection-desc">
              Essential for molecular dynamics and geometry relaxation movies.
              <strong>.ANI</strong> is formatted for direct loading into <strong>VMD, JMol, XCrySDen, OVITO</strong>.
              <strong>.MDE</strong> stores time evolution of temperature, pressure, total energy, and kinetic energy.
            </p>
            <div className="output-flags-grid">
              {TRAJ_FLAGS.map(renderFlag)}
            </div>
          </div>

          {/* Charge Densities & Potentials */}
          <div className="subsection">
            <div className="subsection-title">
              🌐 Charge Densities &amp; Potentials (.RHO, .DRHO, .VH, .VT, .HSX)
            </div>
            <p className="subsection-desc">
              Valence electron densities and Kohn-Sham potentials evaluated on the real-space grid (can be converted to .cube via <code>rho2cube</code> or <code>macroave</code>).
            </p>
            <div className="output-flags-grid">
              {GRID_FLAGS.map(renderFlag)}
            </div>
          </div>

          {/* General & Analysis */}
          <div className="subsection">
            <div className="subsection-title">
              📊 General Output & Populations
            </div>
            <div className="output-flags-grid">
              {GENERAL_FLAGS.map(renderFlag)}
            </div>
          </div>

          {/* ── COOP / COHP ──────────────────────────────────────────────── */}
          <div className="subsection">
            <div className="subsection-title">
              🔗 COOP / COHP — Crystal-Orbital Overlap & Hamilton Populations
            </div>
            <p className="subsection-desc">
              Activating <code>COOP.Write</code> instructs SIESTA to write{' '}
              <code>SystemLabel.fullBZ.WFSX</code> (packed wavefunction, single precision) and{' '}
              <code>SystemLabel.HSX</code> (Hamiltonian, overlap, X-matrix), processed by{' '}
              <code>Util/COOP/mprop</code> to produce COOP/COHP curves and projected DOS.
              Optionally narrow the wavefunction energy/band range to reduce file size.
            </p>

            {/* Master toggle */}
            <div className="flag-card" title="Write .fullBZ.WFSX and .HSX files for COOP/COHP post-processing">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flag-label"><code>COOP.Write</code></div>
                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>
                  .fullBZ.WFSX + .HSX
                </span>
              </div>
              <div className="flag-help">
                Generates packed wavefunction and H/S/X matrix files for COOP/COHP analysis via <code>Util/COOP/mprop</code>.
                Reference: Hughbanks & Hoffmann, JACS 1983; Dronskowski & Blöchl, J.Phys.Chem 1993.
              </div>
              <div className="flag-control">
                <label className="toggle">
                  <input type="checkbox"
                    checked={output['COOP.Write'] === 'true'}
                    onChange={e => set('COOP.Write', e.target.checked ? 'true' : 'false')} />
                  <span className="toggle-label">{output['COOP.Write'] === 'true' ? '✓ on' : 'off'}</span>
                </label>
              </div>
            </div>

            {/* Energy/Band range filters — only shown when COOP.Write is on */}
            {output['COOP.Write'] === 'true' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
                {[
                  { key: 'WFS.Energy.Min', label: 'WFS.Energy.Min', placeholder: 'e.g. -10.0 eV', help: 'Lowest wavefunction eigenvalue written to .fullBZ.WFSX (default −∞). Include units: eV, Ry, Ha.' },
                  { key: 'WFS.Energy.Max', label: 'WFS.Energy.Max', placeholder: 'e.g. 5.0 eV',  help: 'Highest wavefunction eigenvalue written to .fullBZ.WFSX (default +∞). Include units.' },
                  { key: 'WFS.Band.Min',   label: 'WFS.Band.Min',   placeholder: 'e.g. 1',        help: 'First band index to write (integer; alternative to energy range).' },
                  { key: 'WFS.Band.Max',   label: 'WFS.Band.Max',   placeholder: 'e.g. 60',       help: 'Last band index to write (integer; must be ≤ number of basis functions).' },
                ].map(({ key, label, placeholder, help }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }} title={help}>
                      {label}
                      <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: 'var(--accent)' }}>ℹ</span>
                    </label>
                    <input
                      className="input"
                      placeholder={placeholder}
                      value={output[key] || ''}
                      onChange={e => set(key, e.target.value)}
                      title={help}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Optical Properties ───────────────────────────────────────── */}
          <div className="subsection">
            <div className="subsection-title">
              🌈 Optical Properties — Dielectric Function ε(ω)
            </div>
            <p className="subsection-desc">
              Computes the imaginary part of the dielectric function via dipolar transition matrix elements
              between KS eigenstates (molecules: position operator; solids: momentum formulation + non-local
              pseudopotential corrections). Output: <code>SystemLabel.EPSIMG</code>.
              Use <code>Optical.Scissor</code> to correct the DFT band-gap underestimation with a rigid shift.
            </p>

            {/* Master toggle */}
            <div className="flag-card" title="Enable optical dielectric function calculation">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flag-label"><code>OpticalCalculation</code></div>
                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>
                  .EPSIMG
                </span>
              </div>
              <div className="flag-help">
                Calculates imaginary part of ε(ω) and writes <code>SystemLabel.EPSIMG</code>.
              </div>
              <div className="flag-control">
                <label className="toggle">
                  <input type="checkbox"
                    checked={output['OpticalCalculation'] === 'true'}
                    onChange={e => set('OpticalCalculation', e.target.checked ? 'true' : 'false')} />
                  <span className="toggle-label">{output['OpticalCalculation'] === 'true' ? '✓ on' : 'off'}</span>
                </label>
              </div>
            </div>

            {output['OpticalCalculation'] === 'true' && (
              <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>

                {/* Energy range row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0.6rem' }}>
                  {[
                    { key: 'Optical.Energy.Minimum', label: 'Optical.Energy.Minimum', placeholder: '0.0 eV', help: 'Minimum photon energy for the ε(ω) spectrum. Include units (eV, Ry, Ha).' },
                    { key: 'Optical.Energy.Maximum', label: 'Optical.Energy.Maximum', placeholder: '20.0 eV', help: 'Maximum photon energy for the ε(ω) spectrum. Include units.' },
                    { key: 'Optical.Broaden',        label: 'Optical.Broaden (Gaussian σ)', placeholder: '0.1 eV', help: 'Gaussian broadening applied to frequency spectrum. Include units.' },
                    { key: 'Optical.Scissor',        label: 'Optical.Scissor (Δ_gap)',      placeholder: '0.0 eV', help: 'Rigid shift of unoccupied states to correct DFT band-gap underestimation. Include units.' },
                    { key: 'Optical.NumberOfBands',  label: 'Optical.NumberOfBands',         placeholder: 'all (default)', help: 'Number of bands included (must exceed # occupied bands; default = all).' },
                  ].map(({ key, label, placeholder, help }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }} title={help}>
                        {label}
                        <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: 'var(--accent)' }}>ℹ</span>
                      </label>
                      <input
                        className="input"
                        placeholder={placeholder}
                        value={output[key] || ''}
                        onChange={e => set(key, e.target.value)}
                        title={help}
                      />
                    </div>
                  ))}
                </div>

                {/* BZ mesh row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}
                      title="3 integers: Brillouin-zone mesh for optical integration (e.g. 5 5 5)">
                      Optical.Mesh (Nx Ny Nz)
                      <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: 'var(--accent)' }}>ℹ</span>
                    </label>
                    <input
                      className="input"
                      placeholder="5 5 5"
                      value={output['Optical.Mesh'] || ''}
                      onChange={e => set('Optical.Mesh', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}
                      title="Offset mesh away from Γ for odd mesh sizes">
                      Optical.OffsetMesh
                    </label>
                    <label className="toggle">
                      <input type="checkbox"
                        checked={output['Optical.OffsetMesh'] === 'true'}
                        onChange={e => set('Optical.OffsetMesh', e.target.checked ? 'true' : 'false')} />
                      <span className="toggle-label">
                        {output['Optical.OffsetMesh'] === 'true' ? '✓ offset (avoid Γ)' : 'off (include Γ)'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Polarization type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}
                      title="polycrystal: isotropic average. polarized: apply E-field along Optical.Vector. unpolarized: light propagates along Optical.Vector.">
                      Optical.PolarizationType
                    </label>
                    <select className="input select"
                      value={output['Optical.PolarizationType'] || 'polycrystal'}
                      onChange={e => set('Optical.PolarizationType', e.target.value)}>
                      <option value="polycrystal">polycrystal — isotropic average</option>
                      <option value="polarized">polarized — E-field along vector</option>
                      <option value="unpolarized">unpolarized — light propagates along vector</option>
                    </select>
                  </div>

                  {/* Vector input — only meaningful for polarized / unpolarized */}
                  {(output['Optical.PolarizationType'] === 'polarized' ||
                    output['Optical.PolarizationType'] === 'unpolarized') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace' }}
                        title="Direction vector for E-field (polarized) or light propagation (unpolarized): 3 floats, e.g. 1.0 0.0 0.0">
                        Optical.Vector (x y z)
                      </label>
                      <input
                        className="input"
                        placeholder="1.0 0.0 0.0"
                        value={output['Optical.Vector'] || ''}
                        onChange={e => set('Optical.Vector', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODE 2: RESULTS ANALYSIS & VISUALIZATION WORKSPACE                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'viewer' && (
        <div>
          <p className="section-desc">
            Upload your calculation results to inspect convergence curves, extract energies and forces, and play the 3D trajectory animation!
          </p>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '8px',
              padding: '1.25rem',
              textAlign: 'center',
              background: 'var(--surface)',
              marginBottom: '1rem',
            }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>
              📂 Drag &amp; Drop <code>.out</code>, <code>.MDE</code>, or <code>.ANI</code> files here
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
              or click below to upload individually:
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* .out upload */}
              <button
                className={`btn btn-sm ${outData ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => outInputRef.current?.click()}>
                {outData ? '✓ .out Loaded' : '📄 Upload .out log'}
              </button>
              <input
                ref={outInputRef}
                type="file"
                accept=".out,.log,.txt"
                style={{ display: 'none' }}
                onChange={handleLoadOut}
              />

              {/* .MDE upload */}
              <button
                className={`btn btn-sm ${mdeData ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => mdeInputRef.current?.click()}>
                {mdeData ? '✓ .MDE Loaded' : '📈 Upload .MDE History'}
              </button>
              <input
                ref={mdeInputRef}
                type="file"
                accept=".MDE,.mde,.txt"
                style={{ display: 'none' }}
                onChange={handleLoadMDE}
              />

              {/* .ANI upload */}
              <button
                className={`btn btn-sm ${aniData ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => aniInputRef.current?.click()}>
                {aniData ? '✓ .ANI Loaded' : '🎬 Upload .ANI Trajectory'}
              </button>
              <input
                ref={aniInputRef}
                type="file"
                accept=".ANI,.ani,.xyz"
                style={{ display: 'none' }}
                onChange={handleLoadANI}
              />
            </div>

            {/* 1-Click Demo Buttons */}
            <div style={{
              marginTop: '0.8rem',
              paddingTop: '0.6rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '0.4rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                ✨ Quick Demos:
              </span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadAllDemo}>
                🌟 Load All Samples (.out + .MDE + .ANI)
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoANI}>
                🎬 Demo .ANI
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoMDE}>
                📈 Demo .MDE
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoOut}>
                📄 Demo .out
              </button>
              {(outData || mdeData || aniData) && (
                <button type="button" className="btn btn-sm btn-secondary" style={{ color: 'var(--error, #ef4444)' }} onClick={handleClearAll}>
                  ✕ Reset
                </button>
              )}
            </div>

            {loadingMsg && <div style={{ color: 'var(--accent)', marginTop: '0.5rem', fontSize: '0.8rem' }}>{loadingMsg}</div>}
            {errorMsg && <div style={{ color: 'var(--error, #ef4444)', marginTop: '0.5rem', fontSize: '0.8rem' }}>{errorMsg}</div>}
          </div>

          {/* Extracted Features from .out File */}
          {outData && (
            <div className="subsection">
              <div className="subsection-title">
                📋 Extracted Features from Calculation Log (.out)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>System / Formula</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {outData.systemLabel || 'siesta'} ({outData.numberOfAtoms ?? '?'} atoms)
                  </div>
                </div>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Final Total Energy</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--success, #10b981)' }}>
                    {outData.finalEnergyTot ? `${outData.finalEnergyTot.toFixed(4)} eV` : 'N/A'}
                  </div>
                </div>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Fermi Energy (E_F)</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {outData.fermiEnergy ? `${outData.fermiEnergy.toFixed(4)} eV` : 'N/A'}
                  </div>
                </div>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Mesh Cutoff Used</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {outData.meshCutoff || 'N/A'}
                  </div>
                </div>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Cell Volume</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                    {outData.cellVolume ? `${outData.cellVolume.toFixed(2)} Å³` : 'N/A'}
                  </div>
                </div>
                <div className="slab-tool-card" style={{ padding: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Exit Status</div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: outData.normalExit ? 'var(--success, #10b981)' : 'var(--warning)',
                  }}>
                    {outData.normalExit ? '✓ Completed Normally' : 'Running / Incomplete'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Convergence Charts (.MDE or .out SCF) */}
          {(mdeData || (outData && outData.scfCycles.length > 0)) && (
            <div className="subsection">
              <div className="subsection-title">
                📈 Convergence &amp; Thermodynamic Curves
              </div>
              <ConvergenceChart
                mdeData={mdeData}
                scfData={outData?.scfCycles}
              />
            </div>
          )}

          {/* 3D Trajectory Player (.ANI) */}
          {aniData && (
            <div className="subsection">
              <div className="subsection-title">
                🎬 3D Trajectory Animation Player (.ANI)
              </div>
              <ErrorBoundary>
                <TrajectoryViewer
                  aniData={aniData}
                  cellVectors={outData?.cellVectors || structure?.LatticeVectors}
                />
              </ErrorBoundary>
            </div>
          )}
          {/* DOS & PDOS Electronic Structure Analysis Suite */}
          <div className="subsection" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <div className="subsection-title" style={{ margin: 0 }}>
                📈 Density of States (DOS) &amp; Projected DOS (PDOS) Suite
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className={`btn btn-xs ${dosViewMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDosViewMode('single')}>
                  Single Dataset
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${dosViewMode === 'compare' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDosViewMode('compare')}>
                  🔬 Multi-DOS Comparison
                </button>
              </div>
            </div>
            {dosViewMode === 'single' ? <DOSPlotterSuite /> : <DOSComparisonStudio />}
          </div>

          {/* Hint if nothing uploaded yet */}
          {!outData && !mdeData && !aniData && (
            <div className="info-box" style={{ marginTop: '1rem' }}>
              💡 <strong>Quick Start:</strong> Drag and drop your <code>.out</code>, <code>.MDE</code>, or <code>.ANI</code> files into the dashed box above.
              The viewer will automatically plot energy convergence, temperature/pressure fluctuations, and display the 3D atomic movie!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
