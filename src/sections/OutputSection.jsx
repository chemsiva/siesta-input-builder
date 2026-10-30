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
import { STMVisualizer } from '../components/STMVisualizer.jsx';
import { BandStructureChart } from '../components/BandStructureChart.jsx';
import { WorkFunctionChart } from '../components/WorkFunctionChart.jsx';
import { WorkFunctionComparisonStudio } from '../components/WorkFunctionComparisonStudio.jsx';
import { parse1DPotentialData, parsePotentialCube, generatePotentialFromOut, generateDemoPotential } from '../parser/workFunctionParser.js';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { parseTimesFile } from '../parser/timesParser.js';
import { TimingAnalysisCard } from '../components/TimingAnalysisCard.jsx';

const TRAJ_FLAGS = [
 { key: 'WriteMDXmol', type: 'bool', label: 'WriteMDXmol (.ANI)', fileExt: '.ANI',
 help: 'Accumulate coordinates into SystemLabel.ANI (XYZ trajectory format for VMD, JMol, XCrySDen, OVITO)' },
 { key: 'WriteMDhistory', type: 'bool', label: 'WriteMDhistory (.MDE / .MD)', fileExt: '.MDE + .MD',
 help: 'Accumulate MD thermodynamic history into SystemLabel.MDE (temperatures, kinetic/potential/total energy, volume, pressure) and coordinates/velocities into SystemLabel.MD' },
 { key: 'WriteCoorXmol', type: 'bool', label: 'WriteCoorXmol (.xyz)', fileExt: '.xyz',
 help: 'Atomic coordinates in XMOL/XYZ format at the end of the calculation' },
 { key: 'WriteCoorStep', type: 'bool', label: 'WriteCoorStep', fileExt: 'stdout',
 help: 'Print atomic coordinates at each geometry/MD step in the output file' },
];

const GRID_FLAGS = [
 { key: 'SaveRho', type: 'bool', label: 'SaveRho (.RHO)', fileExt: '.RHO',
 help: 'Valence electron charge density on the real-space grid' },
 { key: 'SaveDeltaRho', type: 'bool', label: 'SaveDeltaRho (.DRHO)', fileExt: '.DRHO',
 help: 'Charge density difference Δρ (total − atomic sum) on the grid' },
 { key: 'SaveElectrostaticPotential', type: 'bool', label: 'SaveElectrostaticPotential (.VH)', fileExt: '.VH',
 help: 'Electrostatic (Hartree + ionic) potential on the grid' },
 { key: 'SaveTotalPotential', type: 'bool', label: 'SaveTotalPotential (.VT)', fileExt: '.VT',
 help: 'Total Kohn-Sham effective potential on the grid' },
 { key: 'SaveHS', type: 'bool', label: 'SaveHS (.HSX)', fileExt: '.HSX',
 help: 'Save Hamiltonian and overlap matrices to SystemLabel.HSX' },
];

const GENERAL_FLAGS = [
 { key: 'WriteDM', type: 'bool', label: 'WriteDM (.DM)', fileExt: '.DM',
 help: 'Write density matrix to SystemLabel.DM (needed for SCF restarts)' },
 { key: 'WriteForces', type: 'bool', label: 'WriteForces', fileExt: 'stdout',
 help: 'Print atomic forces to stdout at each step' },
 { key: 'WriteMullikenPop', type: 'select', options: ['0','1','2','3'],
 label: 'WriteMullikenPop', fileExt: 'stdout',
 help: '0=none, 1=per-atom charges, 2=per-orbital charges, 3=full density matrix overlap' },
 { key: 'LongOutput', type: 'bool', label: 'LongOutput', fileExt: 'stdout',
 help: 'Verbose output log: coordinates, forces, eigenvalues, and k-points' },
];
const DEMO_ANI_TEXT = `3
Frame 1 - H2O relaxation
O 0.000000 0.000000 0.117400
H 0.000000 0.757000 -0.469600
H 0.000000 -0.757000 -0.469600
3
Frame 2 - H2O relaxation
O 0.000000 0.000000 0.119200
H 0.000000 0.762000 -0.472000
H 0.000000 -0.762000 -0.472000
3
Frame 3 - H2O relaxation
O 0.000000 0.000000 0.121500
H 0.000000 0.766000 -0.474000
H 0.000000 -0.766000 -0.474000
3
Frame 4 - H2O relaxation
O 0.000000 0.000000 0.122800
H 0.000000 0.768000 -0.475000
H 0.000000 -0.768000 -0.475000
3
Frame 5 - H2O relaxation
O 0.000000 0.000000 0.123500
H 0.000000 0.769500 -0.475500
H 0.000000 -0.769500 -0.475500
`;

const DEMO_MDE_TEXT = `# Step T (K) E_KS (eV) E_tot (eV) Vol (A^3) P (kBar)
 0 0.00 -468.21000 -468.21000 125.000 12.450
 1 0.00 -468.28500 -468.28500 125.000 8.320
 2 0.00 -468.34200 -468.34200 125.000 4.150
 3 0.00 -468.38000 -468.38000 125.000 1.820
 4 0.00 -468.40500 -468.40500 125.000 0.450
 5 0.00 -468.41800 -468.41800 125.000 0.080
 6 0.00 -468.42200 -468.42200 125.000 0.010
`;

const DEMO_OUT_TEXT = `Executable : siesta
Version : 5.4.2
reinit: System Label: h2o_relax
reinit: System Name: Water Molecule Relaxation
Species number: 1 Atomic number: 8 Label: O
Species number: 2 Atomic number: 1 Label: H
initatomlists: Number of atoms, orbitals, and projectors: 3 23 20
InitMesh: Mesh cutoff (required, used) = 250.000 254.210 Ry
outcell: Unit cell vectors (Ang):
 10.000000 0.000000 0.000000
 0.000000 10.000000 0.000000
 0.000000 0.000000 10.000000
outcell: Cell volume (Ang**3) : 1000.0000
new_DM -- step: 1
scf: 1 -465.123400 -468.102300 -468.102300 0.052100 -5.120000 0.082100
scf: 2 -467.892100 -468.351200 -468.351200 0.018200 -5.125000 0.024300
scf: 3 -468.398000 -468.415000 -468.415000 0.004100 -5.128000 0.005200
scf: 4 -468.421500 -468.422000 -468.422000 0.000210 -5.128500 0.000320
siesta: Total = -468.422030
siesta: Fermi = -5.128500
siesta: Max force = 0.004210
siesta: Cell volume = 1000.000000 Ang**3
dhscf: Vacuum level (max, mean) = 0.892311 0.851461 eV
Job completed
`;
export function OutputSection() {
 const output = useFDFStore(s => s.output);
 const structure = useFDFStore(s => s.structure);
 const setField = useFDFStore(s => s.setField);
 const set = (k, v) => setField('output', k, v);

 // Mode: 'flags' (configure FDF keywords) vs 'viewer' (upload & analyze .out, .MDE, .ANI)
 const [activeTab, setActiveTab] = useState('flags');
 const [dosViewMode, setDosViewMode] = useState('bands'); // 'bands' | 'single' | 'compare' | 'stm'
 const [wfViewMode, setWfViewMode] = useState('profile'); // 'profile' | 'compare'
 const [potData, setPotData] = useState(() => generateDemoPotential());
 const potInputRef = useRef(null);

 // Uploaded and parsed data states
 const [outData, setOutData] = useState(null);
 const [mdeData, setMdeData] = useState(null);
 const [aniData, setAniData] = useState(null);
 const [timesData, setTimesData] = useState(null);
 const [loadingMsg, setLoadingMsg] = useState('');
 const [errorMsg, setErrorMsg] = useState('');

 const outInputRef = useRef(null);
 const mdeInputRef = useRef(null);
 const aniInputRef = useRef(null);
 const timesInputRef = useRef(null);
 const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB safety limit

 // File loading handlers
 const handleLoadOut = (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (file.size > MAX_FILE_SIZE) {
 setErrorMsg(` File exceeds 100 MB security limit (${file.name}).`);
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
 if (parsed.vacuumLevelMax !== null && parsed.fermiEnergy !== null) {
 setPotData(generatePotentialFromOut(parsed.vacuumLevelMax, parsed.vacuumLevelMean, parsed.fermiEnergy));
 }
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
 setErrorMsg(` File exceeds 100 MB security limit (${file.name}).`);
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
 setErrorMsg(` File exceeds 100 MB security limit (${file.name}).`);
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
 };

 const handleLoadTimes = (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (file.size > MAX_FILE_SIZE) {
 setErrorMsg(` File exceeds 100 MB security limit (${file.name}).`);
 e.target.value = '';
 return;
 }
 setLoadingMsg(`Parsing ${file.name}...`);
 setErrorMsg('');
 const reader = new FileReader();
 reader.onload = (ev) => {
 try {
 const parsed = parseTimesFile(ev.target.result);
 setTimesData(parsed);
 setLoadingMsg('');
 } catch (err) {
 setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
 setLoadingMsg('');
 }
 };
 reader.readAsText(file);
 e.target.value = '';
 };

 const DEMO_TIMES_TEXT = `timer: Number of nodes = 36
timer: Busiest calculating node was node = 7
timer: Times refer to node = 7
timer: Total elapsed wall-clock time (sec) = 51285.704
timer: CPU times (sec):
Calc: Sum, Avge, myNode, Avg/Max = 2204903.137 61247.309 61531.597 0.995
Comm: Sum, Avge, myNode, Avg/Max = 0.000 0.000 0.000 NaN
Tot: Sum, Avge, myNode, Avg/Max = 2204903.137 61247.309 61531.597 0.995
Program times printed if > 0.000E+00 of total

Program Calls Prg.com Prg.com Prg.tot Prg.tot Nod.avg
 /Tot.com /Tot.tot/Nod.max
siesta 1 0.000 0.0000 61531.597 1.0000 0.995
Setup 1 0.000 0.0000 1.386 0.0000 0.995
bands 1 0.000 0.0000 0.000 0.0000 0.655
IterGeom 1858 0.000 0.0000 61490.694 0.9993 0.995
geom_init 1858 0.000 0.0000 8070.904 0.1312 1.000
Setup_H0 1858 0.000 0.0000 5908.349 0.0960 0.999
DHSCF_Init 1858 0.000 0.0000 5875.073 0.0955 0.995
DHSCF2 1858 0.000 0.0000 5656.081 0.0919 0.995
POISON 24220 0.000 0.0000 3313.643 0.0539 0.955
setup_H 20503 0.000 0.0000 21394.417 0.3477 0.998
DHSCF 22362 0.000 0.0000 25397.732 0.4128 0.972
DHSCF3 22362 0.000 0.0000 23239.052 0.3777 1.000
rhoofd 22362 0.000 0.0000 3891.919 0.0633 0.898
XC 22362 0.000 0.0000 8930.102 0.1451 0.948
vmat 22361 0.000 0.0000 3402.346 0.0553 0.881
IterSCF 18645 0.000 0.0000 40178.041 0.6530 0.984
compute_dm 18645 0.000 0.0000 20005.640 0.3251 0.989
diagon 18645 0.000 0.0000 19962.859 0.3244 0.989
r-eigvec 18645 0.000 0.0000 16286.522 0.2647 0.987
rdiag 18645 0.000 0.0000 16263.224 0.2643 0.987
rdiag3 18645 0.000 0.0000 12745.190 0.2071 0.984
r-buildD 18645 0.000 0.0000 3642.466 0.0592 0.990
PostSCF 1858 0.000 0.0000 11778.647 0.1914 0.995
FINAL_HF 1858 0.000 0.0000 11778.626 0.1914 0.995`;

 const handleLoadDemoTimes = () => {
 try {
 const parsed = parseTimesFile(DEMO_TIMES_TEXT);
 setTimesData(parsed);
 setErrorMsg('');
 } catch (e) {
 setErrorMsg(e.message);
 }
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
 handleLoadDemoTimes();
 };

 const handleClearAll = () => {
 setOutData(null);
 setMdeData(null);
 setAniData(null);
 setTimesData(null);
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
 try {
 const parsed = parseSiestaOut(ev.target.result);
 setOutData(parsed);
 if (parsed.vacuumLevelMax !== null && parsed.fermiEnergy !== null) {
 setPotData(generatePotentialFromOut(parsed.vacuumLevelMax, parsed.vacuumLevelMean, parsed.fermiEnergy));
 }
 } catch (err) { setErrorMsg(err.message); }
 };
 reader.readAsText(file);
 } else if (name.endsWith('.cube')) {
 reader.onload = (ev) => {
 try { setPotData(parsePotentialCube(ev.target.result, outData?.fermiEnergy || -4.35)); } catch (err) { setErrorMsg(err.message); }
 };
 reader.readAsText(file);
 } else if (name.endsWith('.dat') || (name.includes('pot') && name.endsWith('.txt'))) {
 reader.onload = (ev) => {
 try { setPotData(parse1DPotentialData(ev.target.result, outData?.fermiEnergy || -4.35)); } catch (err) { setErrorMsg(err.message); }
 };
 reader.readAsText(file);
 } else if (name.endsWith('.times') || name.includes('times')) {
 reader.onload = (ev) => {
 try { setTimesData(parseTimesFile(ev.target.result)); } catch (err) { setErrorMsg(err.message); }
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
 {output[f.key] === 'true' ? ' on' : 'off'}
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
 FDF Output Flags
 </button>
 <button
 className={`btn ${activeTab === 'viewer' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setActiveTab('viewer')}
 style={{ position: 'relative' }}>
 Results Analysis & Viewer (.out, .MDE, .ANI, .EIG, .PDOS)
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
 {/* MODE 1: FDF OUTPUT FLAGS CONFIGURATION */}
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
 Trajectory &amp; Animation Files (.ANI, .MDE, .MD, .xyz)
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
 Charge Densities &amp; Potentials (.RHO, .DRHO, .VH, .VT, .HSX)
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
 General Output & Populations
 </div>
 <div className="output-flags-grid">
 {GENERAL_FLAGS.map(renderFlag)}
 </div>
 </div>

 {/* ── COOP / COHP ──────────────────────────────────────────────── */}
 <div className="subsection">
 <div className="subsection-title">
 COOP / COHP — Crystal-Orbital Overlap & Hamilton Populations
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
 <span className="toggle-label">{output['COOP.Write'] === 'true' ? ' on' : 'off'}</span>
 </label>
 </div>
 </div>

 {/* Energy/Band range filters — only shown when COOP.Write is on */}
 {output['COOP.Write'] === 'true' && (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
 {[
 { key: 'WFS.Energy.Min', label: 'WFS.Energy.Min', placeholder: 'e.g. -10.0 eV', help: 'Lowest wavefunction eigenvalue written to .fullBZ.WFSX (default −∞). Include units: eV, Ry, Ha.' },
 { key: 'WFS.Energy.Max', label: 'WFS.Energy.Max', placeholder: 'e.g. 5.0 eV', help: 'Highest wavefunction eigenvalue written to .fullBZ.WFSX (default +∞). Include units.' },
 { key: 'WFS.Band.Min', label: 'WFS.Band.Min', placeholder: 'e.g. 1', help: 'First band index to write (integer; alternative to energy range).' },
 { key: 'WFS.Band.Max', label: 'WFS.Band.Max', placeholder: 'e.g. 60', help: 'Last band index to write (integer; must be ≤ number of basis functions).' },
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
 Optical Properties — Dielectric Function ε(ω)
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
 <span className="toggle-label">{output['OpticalCalculation'] === 'true' ? ' on' : 'off'}</span>
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
 { key: 'Optical.Broaden', label: 'Optical.Broaden (Gaussian σ)', placeholder: '0.1 eV', help: 'Gaussian broadening applied to frequency spectrum. Include units.' },
 { key: 'Optical.Scissor', label: 'Optical.Scissor (Δ_gap)', placeholder: '0.0 eV', help: 'Rigid shift of unoccupied states to correct DFT band-gap underestimation. Include units.' },
 { key: 'Optical.NumberOfBands', label: 'Optical.NumberOfBands', placeholder: 'all (default)', help: 'Number of bands included (must exceed # occupied bands; default = all).' },
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
 {output['Optical.OffsetMesh'] === 'true' ? ' offset (avoid Γ)' : 'off (include Γ)'}
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

 {/* ── Section 6.29: Memory, CPU-time, and Wall time Accounting ─── */}
 <div className="subsection">
 <div className="subsection-title">
 Section 6.29 Memory, CPU-time &amp; Wall-time Accounting
 </div>
 <p className="subsection-desc">
 Control parallel execution timers, memory profiling (<code>SystemLabel.alloc</code>),
 detailed timer reports (<code>SystemLabel.times</code>), and queuing wall-time limit enforcement.
 </p>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
 {/* AllocReportLevel */}
 <div className="flag-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
 <div className="flag-label"><code>AllocReportLevel</code></div>
 <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'monospace' }}>
 .alloc
 </span>
 </div>
 <div className="flag-help" style={{ marginBottom: '0.4rem' }}>
 Memory allocation report level in <code>SystemLabel.alloc</code> (0=none, 1=total peak, 2=detailed at end, 3=every peak, 4=every alloc/dealloc).
 </div>
 <select
 className="input select"
 value={output['AllocReportLevel'] || '0'}
 onChange={e => set('AllocReportLevel', e.target.value)}>
 <option value="0">0 — No report at all (default)</option>
 <option value="1">1 — Total memory peak only</option>
 <option value="2">2 — Detailed report at normal termination</option>
 <option value="3">3 — Detailed report at every new peak</option>
 <option value="4">4 — Every individual allocation/deallocation</option>
 </select>
 </div>

 {/* AllocReportThreshold */}
 <div className="flag-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
 <div className="flag-label"><code>AllocReportThreshold</code></div>
 <div className="flag-help" style={{ marginBottom: '0.4rem' }}>
 Minimum array size in bytes individually reported in detailed allocation reports (levels 2 and 3).
 </div>
 <input
 className="input mono"
 placeholder="e.g. 1000000 (1 MB) or 0."
 value={output['AllocReportThreshold'] || ''}
 onChange={e => set('AllocReportThreshold', e.target.value)}
 />
 </div>

 {/* TimerReportThreshold */}
 <div className="flag-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
 <div className="flag-label"><code>TimerReportThreshold</code></div>
 <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'monospace' }}>
 .times
 </span>
 </div>
 <div className="flag-help" style={{ marginBottom: '0.4rem' }}>
 Minimum fraction of total CPU time of subroutines printed in <code>SystemLabel.times</code> (e.g. 0.000 for all, 0.01 for &gt;1%).
 </div>
 <input
 className="input mono"
 placeholder="e.g. 0.000 or 0.001"
 value={output['TimerReportThreshold'] || ''}
 onChange={e => set('TimerReportThreshold', e.target.value)}
 />
 </div>

 {/* MaxWalltime */}
 <div className="flag-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
 <div className="flag-label"><code>MaxWalltime</code></div>
 <div className="flag-help" style={{ marginBottom: '0.4rem' }}>
 Wall-clock time ceiling for cluster queue limits before clean emergency abort (e.g. <code>24 hours</code>, <code>86400 s</code>, <code>2 days</code>).
 </div>
 <input
 className="input mono"
 placeholder="e.g. 24 hours, 7200 s, 2 days"
 value={output['MaxWalltime'] || ''}
 onChange={e => set('MaxWalltime', e.target.value)}
 />
 </div>

 {/* MaxWalltime.Slack */}
 <div className="flag-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
 <div className="flag-label"><code>MaxWalltime.Slack</code></div>
 <div className="flag-help" style={{ marginBottom: '0.4rem' }}>
 Safety slack buffer left for clean emergency shutdown before walltime expires (default: 5 s).
 </div>
 <input
 className="input mono"
 placeholder="5 s (default)"
 value={output['MaxWalltime.Slack'] || ''}
 onChange={e => set('MaxWalltime.Slack', e.target.value)}
 />
 </div>
 </div>

 {/* Boolean accounting toggles */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
 <div className="flag-card">
 <div>
 <div className="flag-label"><code>UseParallelTimer</code></div>
 <div className="flag-help">Perform timings in parallel across MPI nodes (writes SystemLabel.times).</div>
 </div>
 <label className="toggle">
 <input type="checkbox"
 checked={output['UseParallelTimer'] !== 'false'}
 onChange={e => set('UseParallelTimer', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">{output['UseParallelTimer'] !== 'false' ? ' on (default)' : 'off'}</span>
 </label>
 </div>

 <div className="flag-card">
 <div>
 <div className="flag-label"><code>UseTreeTimer</code></div>
 <div className="flag-help">Wall-time tree timer on master node aware of call hierarchy; writes time.json.</div>
 </div>
 <label className="toggle">
 <input type="checkbox"
 checked={output['UseTreeTimer'] === 'true'}
 onChange={e => set('UseTreeTimer', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">{output['UseTreeTimer'] === 'true' ? ' on' : 'off (default)'}</span>
 </label>
 </div>

 <div className="flag-card">
 <div>
 <div className="flag-label"><code>TimingSplitScfSteps</code></div>
 <div className="flag-help">Record individual SCF iteration timings separately (used with tree timer).</div>
 </div>
 <label className="toggle">
 <input type="checkbox"
 checked={output['TimingSplitScfSteps'] === 'true'}
 onChange={e => set('TimingSplitScfSteps', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">{output['TimingSplitScfSteps'] === 'true' ? ' on' : 'off (default)'}</span>
 </label>
 </div>
 </div>
 </div>
 </>
 )}

 {/* ═══════════════════════════════════════════════════════════════════ */}
 {/* MODE 2: RESULTS ANALYSIS & VISUALIZATION WORKSPACE */}
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
 Drag &amp; Drop <code>.out</code>, <code>.times / TIMES</code>, <code>.MDE</code>, or <code>.ANI</code> files here
 </div>
 <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
 or click below to upload individually:
 </div>

 <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
 {/* .out upload */}
 <button
 className={`btn btn-sm ${outData ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => outInputRef.current?.click()}>
 {outData ? ' .out Loaded' : ' Upload .out log'}
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
 {mdeData ? ' .MDE Loaded' : ' Upload .MDE History'}
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
 {aniData ? ' .ANI Loaded' : ' Upload .ANI Trajectory'}
 </button>
 <input
 ref={aniInputRef}
 type="file"
 accept=".ANI,.ani,.xyz"
 style={{ display: 'none' }}
 onChange={handleLoadANI}
 />
 {/* .times / TIMES upload */}
 <button
 className={`btn btn-sm ${timesData ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => timesInputRef.current?.click()}>
 {timesData ? ' TIMES Loaded' : ' Upload TIMES / .times'}
 </button>
 <input
 ref={timesInputRef}
 type="file"
 accept=".times,TIMES,times,*.txt"
 style={{ display: 'none' }}
 onChange={handleLoadTimes}
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
 Quick Demos:
 </span>
 <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadAllDemo}>
 Load All Samples (.out + TIMES + .MDE + .ANI)
 </button>
 <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoTimes}>
 Demo TIMES
 </button>
 <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoANI}>
 Demo .ANI
 </button>
 <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoMDE}>
 Demo .MDE
 </button>
 <button type="button" className="btn btn-sm btn-secondary" onClick={handleLoadDemoOut}>
 Demo .out
 </button>
 {(outData || mdeData || aniData || timesData) && (
 <button type="button" className="btn btn-sm btn-secondary" style={{ color: 'var(--error, #ef4444)' }} onClick={handleClearAll}>
 Clear Reset
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
 Extracted Features from Calculation Log (.out)
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
 {outData.normalExit ? ' Completed Normally' : 'Running / Incomplete'}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Interactive Convergence Charts (.MDE or .out SCF) */}
 {(mdeData || (outData && outData.scfCycles.length > 0)) && (
 <div className="subsection">
 <div className="subsection-title">
 Convergence &amp; Thermodynamic Curves
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
 3D Trajectory Animation Player (.ANI)
 </div>
 <ErrorBoundary>
 <TrajectoryViewer
 aniData={aniData}
 cellVectors={outData?.cellVectors || structure?.LatticeVectors}
 />
 </ErrorBoundary>
 </div>
 )}

 {/* Section 6.29 Execution Timings & Work Accounting (TIMES) */}
 {timesData && (
 <ErrorBoundary>
 <TimingAnalysisCard
 timesData={timesData}
 onClear={() => setTimesData(null)}
 />
 </ErrorBoundary>
 )}
 <div className="subsection" style={{ marginTop: '1.5rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
 <div className="subsection-title" style={{ margin: 0 }}>
 Electronic Band Structure &amp; DOS Suite
 </div>
 <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
 <button
 type="button"
 className={`btn btn-xs ${dosViewMode === 'bands' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setDosViewMode('bands')}>
 Band Structure (.bands)
 </button>
 <button
 type="button"
 className={`btn btn-xs ${dosViewMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setDosViewMode('single')}>
 Single DOS
 </button>
 <button
 type="button"
 className={`btn btn-xs ${dosViewMode === 'compare' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setDosViewMode('compare')}>
 Multi-DOS Comparison
 </button>
 <button
 type="button"
 className={`btn btn-xs ${dosViewMode === 'stm' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setDosViewMode('stm')}>
 Simulated STM
 </button>
 </div>
 </div>
 {dosViewMode === 'bands' ? (
 <BandStructureChart />
 ) : dosViewMode === 'stm' ? (
 <STMVisualizer />
 ) : dosViewMode === 'compare' ? (
 <DOSComparisonStudio />
 ) : (
 <DOSPlotterSuite />
 )}
 </div>

 {/* ═══════════════════════════════════════════════════════════════════ */}
 {/* 5. ELECTROSTATIC POTENTIAL, VACUUM LEVEL & WORK FUNCTION (MACROAVE) */}
 {/* ═══════════════════════════════════════════════════════════════════ */}
 <div className="subsection" style={{ marginTop: '1.5rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
 <div>
 <div className="subsection-title" style={{ margin: 0 }}>
 Electrostatic Potential &amp; Vacuum Level / Work Function (Macroave)
 </div>
 <span className="hint" style={{ fontSize: '0.74rem' }}>
 Planar average potential profile V̄(z), vacuum level V_vac, and work function Φ = V_vac − E_F (SIESTA Util/Macroave &amp; grid2cube)
 </span>
 </div>
 <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
 <button
 type="button"
 className={`btn btn-xs ${wfViewMode === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setWfViewMode('profile')}>
 Potential Profile V̄(z)
 </button>
 <button
 type="button"
 className={`btn btn-xs ${wfViewMode === 'compare' ? 'btn-primary' : 'btn-secondary'}`}
 onClick={() => setWfViewMode('compare')}>
 Multi-Surface Comparison
 </button>
 <button
 type="button"
 className="btn btn-primary btn-xs"
 onClick={() => potInputRef.current?.click()}
 title="Upload 1D planar potential (.dat from Macroave) or 3D Gaussian Cube (.cube from grid2cube SystemLabel.VH)">
 Upload Macroave .dat / .cube
 </button>
 <input
 ref={potInputRef}
 type="file"
 accept=".dat,.cube,.txt,.out"
 style={{ display: 'none' }}
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const reader = new FileReader();
 reader.onload = (evt) => {
 try {
 const text = evt.target.result;
 const lower = file.name.toLowerCase();
 let analyzed;
 const efVal = outData?.fermiEnergy || -4.35;
 if (lower.endsWith('.cube')) {
 analyzed = parsePotentialCube(text, efVal);
 } else if (text.includes('dhscf:') || text.includes('siesta:') || lower.endsWith('.out')) {
 const parsed = parseSiestaOut(text);
 if (parsed.vacuumLevelMax != null && parsed.fermiEnergy != null) {
 analyzed = generatePotentialFromOut(parsed.vacuumLevelMax, parsed.vacuumLevelMean, parsed.fermiEnergy);
 }
 } else {
 analyzed = parse1DPotentialData(text, efVal);
 }
 if (analyzed) setPotData(analyzed);
 } catch (err) {
 setErrorMsg(`Failed to parse potential file: ${err.message}`);
 }
 };
 reader.readAsText(file);
 e.target.value = '';
 }}
 />
 </div>
 </div>

 {wfViewMode === 'compare' ? (
 <WorkFunctionComparisonStudio />
 ) : (
 <>
 {potData ? (
 <WorkFunctionChart
 potData={potData}
 title="Electrostatic Potential Profile V̄(z) & Vacuum Barrier (Φ = V_vac − E_F)"
 />
 ) : (
 <div className="info-box" style={{ marginTop: '0.5rem' }}>
 Upload a 1D planar average potential file (<code>.dat</code> from Macroave or <code>average_z.m</code>), a 3D Gaussian Cube (<code>.cube</code> from <code>grid2cube SystemLabel.VH</code>), or load a SIESTA <code>.out</code> log to plot the electrostatic potential profile and determine the work function Φ.
 </div>
 )}
 </>
 )}

 {/* Official Macroave & grid2cube Terminal Commands Drawer */}
 <div style={{
 marginTop: '0.8rem',
 padding: '0.65rem 0.85rem',
 background: 'var(--surface)',
 borderRadius: '8px',
 border: '1px solid var(--border)',
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
 <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
 <span></span> Official SIESTA Potential &amp; Work Function Utilities (Util/Macroave &amp; Util/Grid)
 </div>
 <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
 Macroave &amp; grid2cube Supported
 </span>
 </div>
 <p style={{ margin: '0.3rem 0', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: '1.5' }}>
 To compute planar averages from real-space potential grids (<code>SaveElectrostaticPotential true</code> → <code>SystemLabel.VH</code>), run either Macroave or convert to Gaussian Cube:
 </p>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.4rem', marginTop: '0.3rem' }}>
                <code style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', background: '#090d16', borderRadius: '4px', color: '#e2e8f0', display: 'block' }}>
                  # 1. Macroave planar average:<br />
                  macroave &lt; macroave.in
                </code>
                <code style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', background: '#090d16', borderRadius: '4px', color: '#e2e8f0', display: 'block' }}>
                  # 2. Gaussian Cube conversion:<br />
                  grid2cube SystemLabel.VH
                </code>
                </div>
              </div>
            </div>
            {/* Hint if nothing uploaded yet */}
 {!outData && !mdeData && !aniData && (
 <div className="info-box" style={{ marginTop: '1rem' }}>
 <strong>Quick Start:</strong> Drag and drop your <code>.out</code>, <code>.MDE</code>, or <code>.ANI</code> files into the dashed box above.
 The viewer will automatically plot energy convergence, temperature/pressure fluctuations, and display the 3D atomic movie!
 </div>
 )}
 </div>
 )}
 </div>
 );
}
