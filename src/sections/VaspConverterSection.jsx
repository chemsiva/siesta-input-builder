import { useState, useMemo, useRef } from 'react';
import { SectionHeader } from '../components/FieldRow';
import { useFDFStore } from '../store/fdfStore';
import { parseVaspPoscar, convertVaspToFdf, VASP_DEMOS, ELEMENT_Z } from '../utils/vaspParser';

export function VaspConverterSection() {
  const setSection = useFDFStore(s => s.setSection);
  const setActiveSection = useFDFStore(s => s.setActiveSection);

  const [vaspText, setVaspText] = useState(VASP_DEMOS.perovskite_slab.poscar);
  const [meshCutoff, setMeshCutoff] = useState('350 Ry');
  const [xcFunc, setXcFunc] = useState('GGA');
  const [xcAuthor, setXcAuthor] = useState('PBE');
  const [customLabel, setCustomLabel] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState('');
  const fileInputRef = useRef(null);

  // Section 7.7 Constraint Controls
  const [constraintSyntax, setConstraintSyntax] = useState('bracket'); // 'bracket' | 'from_to' | 'list'
  const [constrainCellC, setConstrainCellC] = useState(false);
  const [constrainCellA, setConstrainCellA] = useState(false);
  const [constrainCellB, setConstrainCellB] = useState(false);
  const [cellAngle, setCellAngle] = useState('none');
  const [stressXX, setStressXX] = useState(false);
  const [stressYY, setStressYY] = useState(false);
  const [stressZZ, setStressZZ] = useState(false);
  const [stressXY, setStressXY] = useState(false);
  const [customZ, setCustomZ] = useState([]); // array of Z numbers e.g. [6]
  const [rigidStr, setRigidStr] = useState('');

  // Parse VASP POSCAR
  const { vaspParsed, parseError } = useMemo(() => {
    if (!vaspText || !vaspText.trim()) {
      return { vaspParsed: null, parseError: 'Enter or paste a VASP POSCAR/CONTCAR file to convert.' };
    }
    try {
      const parsed = parseVaspPoscar(vaspText);
      return { vaspParsed: parsed, parseError: null };
    } catch (err) {
      return { vaspParsed: null, parseError: err.message };
    }
  }, [vaspText]);

  // Build cell vectors array
  const cellVectors = useMemo(() => {
    const arr = [];
    if (constrainCellA) arr.push('A');
    if (constrainCellB) arr.push('B');
    if (constrainCellC) arr.push('C');
    return arr;
  }, [constrainCellA, constrainCellB, constrainCellC]);

  // Build stress array
  const stressArray = useMemo(() => {
    const s = [];
    if (stressXX) s.push('XX');
    if (stressYY) s.push('YY');
    if (stressZZ) s.push('ZZ');
    if (stressXY) s.push('XY');
    return s;
  }, [stressXX, stressYY, stressZZ, stressXY]);

  // Convert to FDF string with Section 7.7 options
  const fdfOutput = useMemo(() => {
    if (!vaspParsed) return '';
    try {
      return convertVaspToFdf(vaspParsed, {
        meshCutoff,
        xcFunc,
        xcAuthor,
        systemLabel: customLabel || undefined,
        constraintSyntax,
        cellVectors,
        cellAngle,
        stress: stressArray,
        fixedZ: customZ,
        rigidMolecules: rigidStr,
      });
    } catch (err) {
      return `# Conversion error: ${err.message}`;
    }
  }, [vaspParsed, meshCutoff, xcFunc, xcAuthor, customLabel, constraintSyntax, cellVectors, cellAngle, stressArray, customZ, rigidStr]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setVaspText(event.target.result);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Copy .fdf to clipboard
  const handleCopy = () => {
    if (!fdfOutput) return;
    navigator.clipboard.writeText(fdfOutput).then(() => {
      setCopyStatus('Copied to clipboard!');
      setTimeout(() => setCopyStatus(''), 2500);
    });
  };

  // Download .fdf file
  const handleDownload = () => {
    if (!fdfOutput) return;
    const filename = `${(customLabel || (vaspParsed && vaspParsed.title) || 'siesta_calc')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .substring(0, 20)}.fdf`;
    const blob = new Blob([fdfOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load into active workspace
  const handleLoadIntoWorkspace = () => {
    if (!vaspParsed) return;
    try {
      const cleanLabel = (customLabel || vaspParsed.title)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .substring(0, 20) || 'siesta_calc';
      setSection('system', {
        SystemLabel: cleanLabel,
        SystemName: vaspParsed.title,
        NumberOfAtoms: String(vaspParsed.totalAtoms),
        NumberOfSpecies: String(vaspParsed.speciesNames.length),
      });

      const speciesList = vaspParsed.speciesNames.map((name, i) => {
        const cleanName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        const z = ELEMENT_Z[cleanName] || (i + 1);
        return {
          idx: i + 1,
          z,
          label: cleanName,
          psfFile: `${cleanName}.psf`,
        };
      });
      setSection('species', { species: speciesList });

      const atomsList = vaspParsed.atoms.map((a, i) => ({
        idx: i + 1,
        x: a.x,
        y: a.y,
        z: a.z,
        species: a.species,
        label: a.label,
      }));

      setSection('structure', {
        LatticeConstant: '1.0 Ang',
        LatticeVectors: vaspParsed.lv,
        AtomicCoordinatesFormat: vaspParsed.coordFormat,
        atoms: atomsList,
      });

      setSection('dft', {
        'XC.functional': xcFunc,
        'XC.authors': xcAuthor,
        MeshCutoff: meshCutoff,
      });

      setLoadStatus('Successfully loaded into active workspace! Switching to Structure...');
      setTimeout(() => {
        setLoadStatus('');
        setActiveSection('structure');
      }, 1200);
    } catch (err) {
      alert(`Error loading into workspace: ${err.message}`);
    }
  };

  return (
    <div className="section-pane vasp-converter-pane">
      <SectionHeader
        title="VASP to SIESTA Converter"
        desc="Dedicated converter for VASP POSCAR / CONTCAR structures (including ASE GUI Selective Dynamics constraints). Converts VASP formats directly into production-ready SIESTA .fdf input with full Section 7.7 %block Geometry.Constraints support."
      />

      {/* Top Banner & Quick Demos */}
      <div className="cif-banner" style={{ marginBottom: '1rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div>
            <strong style={{ color: 'var(--accent)' }}>⚡ Quick Load VASP Demos:</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
              Test Selective Dynamics (constrained atoms) or pristine structures
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => {
                setVaspText(VASP_DEMOS.perovskite_slab.poscar);
                setConstrainCellC(true);
              }}
            >
              🔒 CsPbI3 Slab (Selective Dynamics)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => {
                setVaspText(VASP_DEMOS.tio2_surface.poscar);
                setConstrainCellC(true);
              }}
            >
              🔒 TiO2 (101) Surface (Fixed Substrate)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => {
                setVaspText(VASP_DEMOS.graphene_monolayer.poscar);
                setConstrainCellC(false);
              }}
            >
              🔓 Graphene (No Constraints)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".vasp,POSCAR*,CONTCAR*,*.txt"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              📂 Upload POSCAR / .vasp
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: VASP Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--fg)' }}>
              📥 VASP Input (POSCAR / CONTCAR)
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setVaspText('')}
              title="Clear input"
            >
              Clear
            </button>
          </div>

          <textarea
            className="input"
            rows={20}
            value={vaspText}
            onChange={(e) => setVaspText(e.target.value)}
            placeholder={`Paste VASP POSCAR/CONTCAR here...\n\nExample:\nCsPbI3 slab with fixed bottom\n1.0\n12.60 0.00 0.00\n0.00 12.60 0.00\n0.00 0.00 35.00\nCs Pb I\n2 2 6\nSelective dynamics\nDirect\n0.0 0.0 0.1 F F F\n...`}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              lineHeight: '1.45',
              whiteSpace: 'pre',
              overflowX: 'auto',
              background: '#0d1117',
              color: '#c9d1d9',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}
          />

          {/* VASP Analysis Cards */}
          {parseError ? (
            <div className="error-item" style={{ padding: '0.6rem 0.8rem', fontSize: '0.82rem' }}>
              ⚠️ {parseError}
            </div>
          ) : vaspParsed ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>System Title:</span>
                <strong style={{ color: 'var(--fg)' }}>{vaspParsed.title}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>Total Atoms / Species:</span>
                <span style={{ color: 'var(--fg)', fontFamily: 'monospace' }}>
                  {vaspParsed.totalAtoms} atoms ({vaspParsed.speciesNames.map((s, idx) => `${s}: ${vaspParsed.speciesCounts[idx] || 0}`).join(', ')})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>Coordinate Format:</span>
                <span className="badge badge-secondary" style={{ fontFamily: 'monospace' }}>
                  {vaspParsed.isDirect ? 'Direct (Fractional)' : 'Cartesian (Å)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>Selective Dynamics:</span>
                {vaspParsed.hasSelectiveDynamics && vaspParsed.fixedConstraints.length > 0 ? (
                  <span style={{
                    color: '#f59e0b',
                    fontWeight: 'bold',
                    background: 'rgba(245, 158, 11, 0.15)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}>
                    🔒 {vaspParsed.fixedConstraints.length} / {vaspParsed.totalAtoms} Atoms Constrained
                  </span>
                ) : (
                  <span style={{
                    color: 'var(--success, #10b981)',
                    fontWeight: 'bold',
                    background: 'rgba(16, 185, 129, 0.12)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    🔓 No Constraints (Free)
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {/* Section 7.7 General Constraints Controls */}
          {vaspParsed && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              fontSize: '0.78rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
                <strong style={{ color: 'var(--accent)' }}>📐 SIESTA Section 7.7 Constraint Options:</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>%block Geometry.Constraints</span>
              </div>

              {/* Syntax Style */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--muted)', width: '130px' }}>Atom Syntax:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="syntax"
                    value="bracket"
                    checked={constraintSyntax === 'bracket'}
                    onChange={() => setConstraintSyntax('bracket')}
                  />
                  <span>atom [1 -- 4]</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="syntax"
                    value="from_to"
                    checked={constraintSyntax === 'from_to'}
                    onChange={() => setConstraintSyntax('from_to')}
                  />
                  <span>atom from 1 to 4</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="syntax"
                    value="list"
                    checked={constraintSyntax === 'list'}
                    onChange={() => setConstraintSyntax('list')}
                  />
                  <span>atom 1 2 3 4</span>
                </label>
              </div>

              {/* Cell Vector Constraints */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--muted)', width: '130px' }}>cell-vector:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={constrainCellA} onChange={e => setConstrainCellA(e.target.checked)} />
                  <span>A</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={constrainCellB} onChange={e => setConstrainCellB(e.target.checked)} />
                  <span>B</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: '#f59e0b', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={constrainCellC} onChange={e => setConstrainCellC(e.target.checked)} />
                  <span>C (Freeze Vacuum/Z)</span>
                </label>
              </div>

              {/* Stress Constraints */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--muted)', width: '130px' }}>stress:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stressXX} onChange={e => setStressXX(e.target.checked)} />
                  <span>XX (1)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stressYY} onChange={e => setStressYY(e.target.checked)} />
                  <span>YY (2)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stressZZ} onChange={e => setStressZZ(e.target.checked)} />
                  <span>ZZ (3)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={stressXY} onChange={e => setStressXY(e.target.checked)} />
                  <span>XY (6)</span>
                </label>
              </div>

              {/* Freeze by Element / Atomic number Z */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--muted)', width: '130px' }}>Freeze by Z:</span>
                {vaspParsed.speciesNames.map((sp, idx) => {
                  const zVal = ELEMENT_Z[sp.charAt(0).toUpperCase() + sp.slice(1).toLowerCase()] || (idx + 1);
                  const isChecked = customZ.includes(zVal);
                  return (
                    <label key={sp} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) setCustomZ([...customZ, zVal]);
                          else setCustomZ(customZ.filter(x => x !== zVal));
                        }}
                      />
                      <span>Z {zVal} ({sp})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIESTA .fdf Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--fg)' }}>
              📄 Generated SIESTA .fdf
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleCopy}
                disabled={!fdfOutput}
                title="Copy generated .fdf to clipboard"
              >
                📋 {copyStatus || 'Copy .fdf'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleDownload}
                disabled={!fdfOutput}
                title="Download .fdf file"
              >
                💾 Download .fdf
              </button>
              <button
                type="button"
                className="btn btn-success btn-xs"
                onClick={handleLoadIntoWorkspace}
                disabled={!vaspParsed}
                title="Load this structure directly into the visualizer and active calculation setup"
              >
                🚀 Load to Workspace
              </button>
            </div>
          </div>

          {/* Quick Options Ribbon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: 'var(--surface)',
            padding: '0.4rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
            flexWrap: 'wrap',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: 'var(--muted)' }}>XC:</span>
              <select
                className="input"
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                value={xcFunc}
                onChange={e => setXcFunc(e.target.value)}
              >
                <option value="GGA">GGA</option>
                <option value="LDA">LDA</option>
                <option value="VDW">VDW</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: 'var(--muted)' }}>Authors:</span>
              <select
                className="input"
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                value={xcAuthor}
                onChange={e => setXcAuthor(e.target.value)}
              >
                <option value="PBE">PBE</option>
                <option value="PBEsol">PBEsol</option>
                <option value="CA">CA (Ceperley-Alder)</option>
                <option value="revPBE">revPBE</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: 'var(--muted)' }}>MeshCutoff:</span>
              <input
                className="input mono"
                type="text"
                style={{ width: '80px', fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                value={meshCutoff}
                onChange={e => setMeshCutoff(e.target.value)}
                placeholder="350 Ry"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: 'var(--muted)' }}>SystemLabel:</span>
              <input
                className="input mono"
                type="text"
                style={{ width: '100px', fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="auto"
              />
            </label>
          </div>

          {loadStatus && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: 'var(--success, #10b981)',
              padding: '0.4rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: '500',
            }}>
              ✓ {loadStatus}
            </div>
          )}

          {/* FDF Code Viewer */}
          <pre
            style={{
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              lineHeight: '1.45',
              height: '520px',
              overflowY: 'auto',
              background: '#0a0d13',
              color: '#e6edf3',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              margin: 0,
            }}
          >
            {fdfOutput || '# No output yet. Paste a valid VASP structure on the left.'}
          </pre>
        </div>

      </div>
    </div>
  );
}
