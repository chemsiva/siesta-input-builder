import { useRef, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { CrystalViewer } from '../components/CrystalViewer.jsx';
import { addVacuumToStructure, centerSlabInCell, buildSupercell } from '../utils/slabBuilder';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, TextInput, SelectInput, SectionHeader } from '../components/FieldRow';

const COORD_FORMATS = [
 'Fractional',
 'NotScaledCartesianAng',
 'NotScaledCartesianBohr',
 'ScaledCartesian',
 'ScaledByLatticeVectors',
];

const LAT_UNITS = ['Ang', 'Bohr'];

export function StructureSection() {
 const structure = useFDFStore(s => s.structure);
 const setField = useFDFStore(s => s.setField);
 const setSection = useFDFStore(s => s.setSection);
 const loadFromCIF = useFDFStore(s => s.loadFromCIF);
 const cifInputRef = useRef();
 const [showViewer, setShowViewer] = useState(false); // default OFF per user requirement

 const setStr = (k, v) => setField('structure', k, v);
 const [vacuumThick, setVacuumThick] = useState('15.0');
 const [scNx, setScNx] = useState('2');
 const [scNy, setScNy] = useState('2');
 const [scNz, setScNz] = useState('1');

 const handleAddVacuum = () => {
 const updated = addVacuumToStructure(structure, parseFloat(vacuumThick) || 15.0);
 setSection('structure', updated);
 setField('dft', 'Slab.DipoleCorrection', 'true');
 };

 const handleCenterSlab = () => {
 const updated = centerSlabInCell(structure);
 setSection('structure', updated);
 };

 const handleBuildSupercell = () => {
 const nx = parseInt(scNx) || 1;
 const ny = parseInt(scNy) || 1;
 const nz = parseInt(scNz) || 1;
 const updated = buildSupercell(structure, nx, ny, nz);
 setSection('structure', updated);
 setField('system', 'NumberOfAtoms', String(updated.atoms.length));
 };

 // Lattice vectors
 const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
 const setLV = (row, col, val) => {
 const next = lv.map((r, i) => i === row ? r.map((c, j) => j === col ? val : c) : r);
 setField('structure', 'LatticeVectors', next);
 };

 // Atoms table
 const atoms = structure.atoms || [];
 const setAtom = (i, key, val) => {
 const next = atoms.map((a, idx) => idx === i ? { ...a, [key]: val } : a);
 setSection('structure', { atoms: next });
 };
 const addAtom = () => setSection('structure', { atoms: [...atoms, { x: '0', y: '0', z: '0', species: '1', label: '' }] });
 const removeAtom = (i) => setSection('structure', { atoms: atoms.filter((_, idx) => idx !== i) });

 const [lcVal, lcUnit] = (structure.LatticeConstant || '1.0 Ang').split(' ');

 return (
 <div className="section-pane">
 <SectionHeader title="Structure" />
 <div className="cif-banner">
 <div className="cif-banner-text">
 <strong> Import Crystal Structure from CIF</strong>
 <p>Load any CIF file (Materials Project, ICSD, COD). Automatically extracts lattice parameters, vectors, species, and atomic coordinates with symmetry expansion.</p>
 </div>
 <button className="btn btn-primary" onClick={() => cifInputRef.current.click()}>
 Choose .cif file
 </button>
 <input ref={cifInputRef} type="file" accept=".cif" style={{display:'none'}}
 onChange={e => {
 const f = e.target.files[0];
 if (f) {
 const reader = new FileReader();
 reader.onload = ev => {
 loadFromCIF(ev.target.result);
 setShowViewer(true);
 };
 reader.readAsText(f);
 e.target.value = '';
 }
 }} />
 </div>
 {/* 3D Crystal Structure Viewer Toggle (default OFF) */}
 <div className="viewer-toggle-bar">
 <div className="viewer-toggle-info">
 <span className="viewer-toggle-title"> 3D Crystal Structure Visualizer</span>
 <span className={`viewer-status-badge ${showViewer ? 'on' : 'off'}`}>
 {showViewer ? 'ON' : 'DEFAULT OFF'}
 </span>
 <span className="viewer-toggle-desc">
 {showViewer
 ? 'Interactive 3D view active (drag to rotate, scroll to zoom)'
 : 'Turn ON to inspect unit cell, atoms, and bonds in 3D'}
 </span>
 </div>
        <button
          className={`btn ${showViewer ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setShowViewer(!showViewer)}>
          {showViewer ? 'Close 3D View' : 'Turn ON 3D Viewer'}
        </button>
      </div>

 {showViewer && (
 <ErrorBoundary componentName="3D Crystal Visualizer">
 <CrystalViewer structure={structure} />
 </ErrorBoundary>
 )}
 {/* Slab & Vacuum Tools */}
 <div className="subsection">
 <div className="subsection-title">
 Slab &amp; Vacuum Tools (Surface Science)
 </div>
 <p className="subsection-desc">
 Construct surface slabs, adjust vacuum padding along the c/z-axis, center slabs, and build supercells.
 </p>
 <div className="slab-tools-grid">
 <div className="slab-tool-card">
 <div className="slab-tool-title">Vacuum Padding (Å)</div>
 <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
 <input
 type="number"
 step="any"
 className="input mono"
 style={{ width: '80px' }}
 value={vacuumThick}
 onChange={e => setVacuumThick(e.target.value)}
 />
 <button className="btn btn-secondary" onClick={handleAddVacuum} title="Add vacuum along z-axis">
 + Add Vacuum
 </button>
 <button className="btn btn-secondary" onClick={handleCenterSlab} title="Center slab in the unit cell">
 Center Slab
 </button>
 </div>
 <span className="hint" style={{ marginTop: '0.2rem', display: 'block' }}>
 Auto-enables <code>Slab.DipoleCorrection true</code>
 </span>
 </div>

 <div className="slab-tool-card">
 <div className="slab-tool-title">Supercell Expansion (Nx × Ny × Nz)</div>
 <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.3rem' }}>
 <input
 type="number"
 min="1"
 className="input mono"
 style={{ width: '50px', textAlign: 'center' }}
 value={scNx}
 onChange={e => setScNx(e.target.value)}
 />
 <span>×</span>
 <input
 type="number"
 min="1"
 className="input mono"
 style={{ width: '50px', textAlign: 'center' }}
 value={scNy}
 onChange={e => setScNy(e.target.value)}
 />
 <span>×</span>
 <input
 type="number"
 min="1"
 className="input mono"
 style={{ width: '50px', textAlign: 'center' }}
 value={scNz}
 onChange={e => setScNz(e.target.value)}
 />
 <button className="btn btn-secondary" onClick={handleBuildSupercell}>
 Build Supercell
 </button>
 </div>
 <span className="hint" style={{ marginTop: '0.2rem', display: 'block' }}>
 Replicates atoms and lattice vectors for defect/surface models
 </span>
 </div>
 </div>
 </div>




 {/* Lattice constant */}
 <FieldRow label="LatticeConstant" keyword="LatticeConstant">
 <div className="input-with-unit">
 <TextInput mono value={lcVal} onChange={v => setStr('LatticeConstant', `${v} ${lcUnit || 'Ang'}`)} placeholder="1.0" />
 <SelectInput value={lcUnit || 'Ang'} onChange={u => setStr('LatticeConstant', `${lcVal} ${u}`)} options={LAT_UNITS} />
 </div>
 </FieldRow>

 {/* Lattice vectors */}
 <div className="subsection">
 <div className="subsection-title">
 LatticeVectors (rows = a₁ a₂ a₃)
 <label className="lp-toggle">
 <input type="checkbox" checked={!!structure._useLatticeParameters}
 onChange={e => setSection('structure', { _useLatticeParameters: e.target.checked })} />
 &nbsp;Use LatticeParameters (a b c α β γ) instead
 </label>
 </div>

 {!structure._useLatticeParameters ? (
 <div className="lv-grid">
 {['a₁','a₂','a₃'].map((label, row) => (
 <div key={row} className="lv-row">
 <span className="lv-label">{label}</span>
 {[0,1,2].map(col => (
 <input key={col} type="number" step="any" className="input mono lv-cell"
 value={lv[row]?.[col] ?? 0}
 onChange={e => setLV(row, col, parseFloat(e.target.value) || 0)} />
 ))}
 </div>
 ))}
 </div>
 ) : (
 <div className="lp-grid">
 {['a','b','c','α','β','γ'].map((label, i) => (
 <div key={i} className="lp-cell">
 <span className="lp-cell-label">{label}</span>
 <input type="number" step="any" className="input mono"
 value={(structure.LatticeParameters || [1,1,1,90,90,90])[i] ?? ''}
 onChange={e => {
 const arr = [...(structure.LatticeParameters || [1,1,1,90,90,90])];
 arr[i] = parseFloat(e.target.value) || 0;
 setSection('structure', { LatticeParameters: arr });
 }} />
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Coordinates format */}
 {/* Section 6.4 Coordinates format & origin centering */}
 <div className="field-row-group">
 <FieldRow label="AtomicCoordinatesFormat" keyword="AtomicCoordinatesFormat">
 <SelectInput value={structure.AtomicCoordinatesFormat || 'Fractional'} onChange={v => setStr('AtomicCoordinatesFormat', v)} options={COORD_FORMATS} />
 </FieldRow>
 <FieldRow label="AtomCoorFormatOut" keyword="AtomCoorFormatOut">
 <SelectInput
 value={structure.AtomCoorFormatOut || ''}
 onChange={v => setStr('AtomCoorFormatOut', v)}
 options={[
 { value: '', label: 'Default (same as input format)' },
 { value: 'Fractional', label: 'Fractional (scaled by lattice vectors)' },
 { value: 'Ang', label: 'Ang (Cartesian Ångström)' },
 { value: 'Bohr', label: 'Bohr (Cartesian atomic units)' },
 { value: 'ScaledCartesian', label: 'ScaledCartesian (units of lattice constant)' },
 ]} />
 </FieldRow>
 </div>

 <FieldRow label="AtomicCoordinatesOrigin" keyword="AtomicCoordinatesOrigin">
 <SelectInput
 value={structure.AtomicCoordinatesOrigin || 'none'}
 onChange={v => setStr('AtomicCoordinatesOrigin', v)}
 options={[
 { value: 'none', label: 'none — No coordinate shift (original input positions)' },
 { value: 'COP', label: 'COP — Center of coordinates in middle of unit-cell' },
 { value: 'COM', label: 'COM — Center of mass in middle of unit-cell' },
 { value: 'MIN', label: 'MIN — Shift so minimum along each cartesian axis is 0' },
 { value: 'COP-Z', label: 'COP-Z — Center in z-direction only (recommended for slabs)' },
 { value: 'COM-Z', label: 'COM-Z — Center of mass in z-direction only' },
 { value: 'MIN-Z', label: 'MIN-Z — Minimum in z-direction is 0' },
 { value: 'COP-XY', label: 'COP-XY — Center in x-y plane only' },
 ]} />
 </FieldRow>

 {/* Atoms table */}
 <div className="subsection">
 <div className="subsection-title">
 AtomicCoordinatesAndAtomicSpecies
 <span className="atom-count">{atoms.length} atom{atoms.length !== 1 ? 's' : ''}</span>
 </div>
 <div className="atoms-table-wrap">
 <table className="atoms-table">
 <thead>
 <tr>
 <th>#</th><th>x</th><th>y</th><th>z</th>
 <th title="Species index from ChemicalSpeciesLabel">Sp.</th>
 <th>Label (opt)</th><th></th>
 </tr>
 </thead>
 <tbody>
 {atoms.map((a, i) => (
 <tr key={i}>
 <td className="atom-idx">{i+1}</td>
 {['x','y','z'].map(k => (
 <td key={k}>
 <input type="text" className="input mono atom-coord"
 value={a[k]} onChange={e => setAtom(i, k, e.target.value)} />
 </td>
 ))}
 <td>
 <input type="text" className="input mono atom-sp"
 value={a.species} onChange={e => setAtom(i, 'species', e.target.value)} />
 </td>
 <td>
 <input type="text" className="input atom-label"
 value={a.label} onChange={e => setAtom(i, 'label', e.target.value)} placeholder="Fe, O, …" />
 </td>
 <td>
 <button className="btn btn-danger-sm" onClick={() => removeAtom(i)}>Clear</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="table-actions">
 <button className="btn btn-secondary" onClick={addAtom}>+ Add Atom</button>
 <span className="hint">Paste: select a cell, Ctrl+V tab-separated rows (x y z species)</span>
 </div>
 </div>
 </div>
 );
}
