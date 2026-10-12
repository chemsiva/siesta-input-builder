import { useState, useRef } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { SectionHeader } from '../components/FieldRow';
import { parseMDE } from '../parser/mdeParser.js';
import { parseANI } from '../parser/aniParser.js';
import { parseSiestaOut } from '../parser/outParser.js';
import { ConvergenceChart } from '../components/ConvergenceChart.jsx';
import { TrajectoryViewer } from '../components/TrajectoryViewer.jsx';
import { DOSPlotterSuite } from '../components/DOSPlotterSuite.jsx';
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

export function OutputSection() {
  const output = useFDFStore(s => s.output);
  const structure = useFDFStore(s => s.structure);
  const setField = useFDFStore(s => s.setField);
  const set = (k, v) => setField('output', k, v);

  // Mode: 'flags' (configure FDF keywords) vs 'viewer' (upload & analyze .out, .MDE, .ANI)
  const [activeTab, setActiveTab] = useState('flags');

  // Uploaded and parsed data states
  const [outData, setOutData] = useState(null);
  const [mdeData, setMdeData] = useState(null);
  const [aniData, setAniData] = useState(null);

  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const outInputRef = useRef(null);
  const mdeInputRef = useRef(null);
  const aniInputRef = useRef(null);

  // File loading handlers
  const handleLoadOut = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
              📊 General Output &amp; Populations
            </div>
            <div className="output-flags-grid">
              {GENERAL_FLAGS.map(renderFlag)}
            </div>
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
            <div className="subsection-title">
              📈 Density of States (DOS) & Projected DOS (PDOS) Visualizer
            </div>
            <DOSPlotterSuite />
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
