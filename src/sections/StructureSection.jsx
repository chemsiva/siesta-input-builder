import { useRef, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { CrystalViewer } from '../components/CrystalViewer.jsx';
import { addVacuumToStructure, centerSlabInCell, buildSupercell } from '../utils/slabBuilder';
import { getBottomLayerIndices, getTopLayerIndices, getIndicesByZCutoff, getIndicesBySpecies, generateAseScript } from '../utils/constraintUtils';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, TextInput, SelectInput, SectionHeader } from '../components/FieldRow';
import { useMemo } from 'react';

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

  // Constraints state from store
  const constraints = useFDFStore(s => s.constraints || {});
  const setConstraintField = useFDFStore(s => s.setConstraintField);
  const toggleFixAtom = useFDFStore(s => s.toggleFixAtom);
  const setFixedAtoms = useFDFStore(s => s.setFixedAtoms);
  const clearConstraints = useFDFStore(s => s.clearConstraints);
  const fixedSet = useMemo(() => new Set(constraints.fixedAtomIndices || []), [constraints]);

  const [zCutoffInput, setZCutoffInput] = useState('10.0');
  const [selectedSpeciesToFix, setSelectedSpeciesToFix] = useState('');
  const [copyAseStatus, setCopyAseStatus] = useState('');

  const handleFixBottom1Layer = () => {
    const indices = getBottomLayerIndices(structure.atoms || [], 1);
    setFixedAtoms(indices);
  };

  const handleFixBottom2Layers = () => {
    const indices = getBottomLayerIndices(structure.atoms || [], 2);
    setFixedAtoms(indices);
  };

  const handleFixTopLayer = () => {
    const indices = getTopLayerIndices(structure.atoms || [], 1);
    setFixedAtoms(indices);
  };

  const handleInvertSelection = () => {
    const total = (structure.atoms || []).length;
    const inverted = [];
    for (let i = 1; i <= total; i++) {
      if (!fixedSet.has(i)) inverted.push(i);
    }
    setFixedAtoms(inverted);
  };

  const handleApplyZCutoff = () => {
    const indices = getIndicesByZCutoff(structure.atoms || [], zCutoffInput);
    setFixedAtoms(indices);
  };

  const handleApplySpeciesFix = () => {
    const target = selectedSpeciesToFix || structure.species?.[0]?.label;
    if (!target) return;
    const indices = getIndicesBySpecies(structure.atoms || [], target, structure.species || []);
    setFixedAtoms([...fixedSet, ...indices]);
  };

  const handleCopyAseScript = () => {
    const script = generateAseScript(structure.atoms || [], Array.from(fixedSet), constraints.directionMode || 'all');
    navigator.clipboard.writeText(script).then(() => {
      setCopyAseStatus('✓ Copied Python ASE FixAtoms script to clipboard!');
      setTimeout(() => setCopyAseStatus(''), 3000);
    });
  };
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
          <strong>💎 Import Crystal Structure from CIF</strong>
          <p>Load any CIF file (Materials Project, ICSD, COD). Automatically extracts lattice parameters, vectors, species, and atomic coordinates with symmetry expansion.</p>
        </div>
        <button className="btn btn-primary" onClick={() => cifInputRef.current.click()}>
          📁 Choose .cif file
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
          <span className="viewer-toggle-title">🌐 3D Crystal Structure Visualizer</span>
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
          onClick={() => setShowViewer(!showViewer)}
        >
          {showViewer ? '✕ Close 3D View' : '👁️ Turn ON 3D Viewer'}
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
          🛠️ Slab &amp; Vacuum Tools (Surface Science)
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
                ⬍ Center Slab
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ATOMIC & LAYER CONSTRAINTS (ASE GUI / %block Geometry.Constraints) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="subsection">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div className="subsection-title" style={{ margin: 0 }}>
            🔒 Atomic &amp; Layer Constraints (ASE GUI / %block Geometry.Constraints)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!constraints.enabled}
                onChange={e => setConstraintField('enabled', e.target.checked)}
              />
              <span className="toggle-label">
                {constraints.enabled ? '✓ Constraints ON' : 'Off'}
              </span>
            </label>
            {constraints.enabled && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: fixedSet.size > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--border)',
                color: fixedSet.size > 0 ? '#f59e0b' : 'var(--muted)',
                fontWeight: 700,
              }}>
                🔒 {fixedSet.size} / {atoms.length} Atoms Fixed
              </span>
            )}
          </div>
        </div>

        <p className="subsection-desc" style={{ marginTop: '0.3rem' }}>
          Fix substrate layers or selective coordinates during geometry relaxation (SIESTA <code>%block Geometry.Constraints</code> &amp; ASE <code>FixAtoms</code>).
          Fixed atoms are marked with 🔒 in the 3D viewer and coordinate table.
        </p>

        {constraints.enabled && (
          <div style={{ background: 'var(--surface)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {/* Quick Action Ribbon */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Quick Actions:</span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleFixBottom1Layer}
                title="Detect bottom layer by z-coordinate and fix all atoms in it">
                🔒 Fix Bottom 1 Layer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleFixBottom2Layers}
                title="Detect bottom 2 layers by z-coordinate and fix all atoms in them">
                🔒 Fix Bottom 2 Layers
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleFixTopLayer}
                title="Fix top layer">
                🔒 Fix Top Layer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleInvertSelection}
                title="Invert selection (make fixed atoms free, and free atoms fixed)">
                🔄 Invert
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                style={{ color: 'var(--error, #ef4444)' }}
                onClick={clearConstraints}
                title="Clear all constraints (free all atoms to relax)">
                🔓 Relax All (Clear)
              </button>
            </div>

            {/* Cutoff, Species & Direction Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
              {/* Fix by Z Cutoff */}
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Fix z &le;</span>
                <input
                  type="number"
                  step="0.5"
                  className="input mono"
                  style={{ width: '60px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
                  placeholder="10.0"
                  value={zCutoffInput}
                  onChange={e => setZCutoffInput(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Å</span>
                <button type="button" className="btn btn-secondary btn-xs" onClick={handleApplyZCutoff}>
                  Apply
                </button>
              </div>

              {/* Fix by Element */}
              {structure.species && structure.species.length > 0 && (
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Fix Element:</span>
                  <select
                    className="input select"
                    style={{ fontSize: '0.75rem', height: '26px' }}
                    value={selectedSpeciesToFix}
                    onChange={e => setSelectedSpeciesToFix(e.target.value)}>
                    {structure.species.map(sp => (
                      <option key={sp.idx} value={sp.label || sp.z}>{sp.label || `Z=${sp.z}`}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={handleApplySpeciesFix}>
                    Fix
                  </button>
                </div>
              )}

              {/* Direction Mode */}
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Fix Mode:</span>
                <select
                  className="input select"
                  style={{ fontSize: '0.75rem', height: '26px' }}
                  value={constraints.directionMode || 'all'}
                  onChange={e => setConstraintField('directionMode', e.target.value)}>
                  <option value="all">Fix X, Y, Z (All directions)</option>
                  <option value="z">Fix Z only (Allow in-plane XY)</option>
                  <option value="xy">Fix In-Plane XY (Allow Z)</option>
                </select>
              </div>

              {/* ASE Script Snippet Button */}
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleCopyAseScript}
                  title="Copy exact Python ASE FixAtoms script to clipboard">
                  📋 Copy ASE Python Script
                </button>
              </div>
            </div>

            {copyAseStatus && (
              <span style={{ fontSize: '0.72rem', color: 'var(--success, #10b981)', fontWeight: 600 }}>
                {copyAseStatus}
              </span>
            )}
          </div>
        )}
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
            { value: 'none',   label: 'none   — No coordinate shift (original input positions)' },
            { value: 'COP',    label: 'COP    — Center of coordinates in middle of unit-cell' },
            { value: 'COM',    label: 'COM    — Center of mass in middle of unit-cell' },
            { value: 'MIN',    label: 'MIN    — Shift so minimum along each cartesian axis is 0' },
            { value: 'COP-Z',  label: 'COP-Z  — Center in z-direction only (recommended for slabs)' },
            { value: 'COM-Z',  label: 'COM-Z  — Center of mass in z-direction only' },
            { value: 'MIN-Z',  label: 'MIN-Z  — Minimum in z-direction is 0' },
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
                <th>Label (opt)</th>
                <th title="Fix/Relax atom during geometry relaxation (ASE FixAtoms style)">Status</th>
                <th></th>
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
                    <button
                      type="button"
                      className="btn btn-xs"
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.1rem 0.35rem',
                        background: fixedSet.has(i + 1) ? '#f59e0b' : 'transparent',
                        border: `1px solid ${fixedSet.has(i + 1) ? '#f59e0b' : 'var(--border)'}`,
                        color: fixedSet.has(i + 1) ? '#000000' : 'var(--muted)',
                        fontWeight: 700,
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleFixAtom(i + 1)}
                      title={fixedSet.has(i + 1) ? 'Atom is FIXED (Click to free/relax)' : 'Atom is FREE (Click to fix)'}>
                      {fixedSet.has(i + 1) ? '🔒 Fixed' : 'Free'}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-danger-sm" onClick={() => removeAtom(i)}>✕</button>
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
