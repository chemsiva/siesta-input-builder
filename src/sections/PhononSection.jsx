import { useState } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';
import { BAND_PATH_PRESETS, detectCrystalSystem } from '../utils/bandPathGenerator.js';
import { generatePhononSuite } from '../utils/phononSuiteGenerator.js';

export function PhononSection() {
  const baseState = useFDFStore(s => s);
  const structure = useFDFStore(s => s.structure);
  const md = useFDFStore(s => s.md);
  const setField = useFDFStore(s => s.setField);
  const setSection = useFDFStore(s => s.setSection);

  const totalAtoms = structure.atoms ? structure.atoms.length : 1;

  const [fcMethod, setFcMethod] = useState('fc'); // 'fc' | 'phonopy' | 'gamma'
  const [fcDisplVal, setFcDisplVal] = useState('0.04');
  const [fcDisplUnit, setFcDisplUnit] = useState('Bohr');
  const [fcFirst, setFcFirst] = useState('1');
  const [fcLast, setFcLast] = useState(String(totalAtoms));
  const [bornCharge, setBornCharge] = useState(false);
  const [saveDHS, setSaveDHS] = useState(false);

  const [scNx, setScNx] = useState('2');
  const [scNy, setScNy] = useState('2');
  const [scNz, setScNz] = useState('2');

  const [phononPathKey, setPhononPathKey] = useState(detectCrystalSystem(structure.LatticeParameters));
  const [isZipping, setIsZipping] = useState(false);

  const handleApplyToFDF = () => {
    setSection('md', {
      'MD.TypeOfRun': 'FC',
      'FC.first': fcFirst,
      'FC.last': fcLast,
      'FC.Displacement': `${fcDisplVal} ${fcDisplUnit}`,
      'BornCharge': bornCharge ? 'true' : 'false',
      'FC.Save.dHS': saveDHS ? 'true' : 'false',
    });
    alert('✓ Applied Force Constants settings to FDF! Check the live preview pane.');
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zipBlob = await generatePhononSuite(baseState, {
        supercellDim: [parseInt(scNx) || 2, parseInt(scNy) || 2, parseInt(scNz) || 2],
        displacement: `${fcDisplVal} ${fcDisplUnit}`,
        bornCharge,
        saveDHS,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `siesta_phonon_${baseState.system.SystemLabel || 'phonon'}.zip`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('Error generating phonon suite: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="section-pane">
      <SectionHeader title="Phonon Analysis & Vibrations" />
      <p className="section-desc">
        Calculate the force-constant matrix, dynamical matrix, phonon dispersion curves, and vibrational frequencies in SIESTA.
      </p>

      {/* Method Selector Tabs */}
      <div className="kmode-tabs" style={{ marginBottom: '1rem' }}>
        <button
          className={`kmode-tab ${fcMethod === 'fc' ? 'active' : ''}`}
          onClick={() => setFcMethod('fc')}>
          SIESTA Native FC (VIBRA)
        </button>
        <button
          className={`kmode-tab ${fcMethod === 'phonopy' ? 'active' : ''}`}
          onClick={() => setFcMethod('phonopy')}>
          Phonopy + SIESTA Workflow
        </button>
        <button
          className={`kmode-tab ${fcMethod === 'gamma' ? 'active' : ''}`}
          onClick={() => {
            setFcMethod('gamma');
            setFcFirst('1');
            setFcLast(String(totalAtoms));
          }}>
          Γ-Point Vibrations (Molecules)
        </button>
      </div>

      {/* Parameters Panel */}
      <div className="subsection">
        <div className="subsection-title">
          Force Constants Parameters (MD.TypeOfRun FC)
          <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>
            {totalAtoms} atoms in cell
          </span>
        </div>

        <FieldRow label="FC.Displacement" keyword="FC.Displacement">
          <div className="input-with-unit">
            <TextInput
              mono
              value={fcDisplVal}
              onChange={setFcDisplVal}
              placeholder="0.04"
            />
            <SelectInput
              value={fcDisplUnit}
              onChange={setFcDisplUnit}
              options={['Bohr', 'Ang']}
            />
          </div>
        </FieldRow>

        <div className="field-row-group">
          <FieldRow label="FC.first (start atom index)">
            <TextInput
              mono
              value={fcFirst}
              onChange={setFcFirst}
              placeholder="1"
            />
          </FieldRow>
          <FieldRow label="FC.last (end atom index)">
            <TextInput
              mono
              value={fcLast}
              onChange={setFcLast}
              placeholder={String(totalAtoms)}
            />
          </FieldRow>
        </div>

        <div className="field-row-group">
          <FieldRow label="BornCharge">
            <label className="toggle">
              <input
                type="checkbox"
                checked={bornCharge}
                onChange={e => setBornCharge(e.target.checked)}
              />
              <span className="toggle-label">
                Compute Born Effective Charges (LO-TO splitting)
              </span>
            </label>
          </FieldRow>

          <FieldRow label="FC.Save.dHS">
            <label className="toggle">
              <input
                type="checkbox"
                checked={saveDHS}
                onChange={e => setSaveDHS(e.target.checked)}
              />
              <span className="toggle-label">
                Save dH/dR &amp; dS/dR (for electron-phonon coupling)
              </span>
            </label>
          </FieldRow>
        </div>

        {/* Supercell configuration for Phonons */}
        <div className="slab-tools-grid" style={{ marginTop: '0.8rem' }}>
          <div className="slab-tool-card">
            <div className="slab-tool-title">Phonon Supercell Dimensions (Nx × Ny × Nz)</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.4rem' }}>
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
              <span className="hint">
                = {totalAtoms * (parseInt(scNx)||1) * (parseInt(scNy)||1) * (parseInt(scNz)||1)} atoms in supercell
              </span>
            </div>
            <span className="hint" style={{ marginTop: '0.3rem', display: 'block' }}>
              Supercell ensures force constants decay to zero at boundaries.
            </span>
          </div>

          <div className="slab-tool-card">
            <div className="slab-tool-title">Phonon Dispersion Band Path</div>
            <div style={{ marginTop: '0.4rem' }}>
              <select
                className="input select"
                value={phononPathKey}
                onChange={e => setPhononPathKey(e.target.value)}>
                {Object.entries(BAND_PATH_PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>
            <span className="hint" style={{ marginTop: '0.3rem', display: 'block' }}>
              High-symmetry q-vector path for VIBRA / Phonopy dispersion curves.
            </span>
          </div>
        </div>

        {/* Actions bar */}
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleApplyToFDF}>
            ⚡ Apply FC Settings to Current .fdf
          </button>
          <button
            className="btn btn-secondary"
            disabled={isZipping}
            onClick={handleDownloadZip}>
            {isZipping ? 'Generating...' : '📦 Download Phonon Suite (.zip)'}
          </button>
        </div>
      </div>

      {/* Information Guide */}
      <div className="info-box" style={{ marginTop: '1rem' }}>
        <strong>SIESTA Phonon Output Files:</strong>
        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', lineHeight: '1.6' }}>
          <li><code>SystemLabel.FC</code> — Force-constant matrix in eV/Å² for all displaced atoms.</li>
          <li><code>SystemLabel.BC</code> — Born effective charge tensor (when <code>BornCharge true</code> is enabled).</li>
          <li><code>dHSdR.nc</code> — NetCDF file with derivatives of Hamiltonian and overlap matrices for electron-phonon coupling.</li>
          <li>Post-processing: Use SIESTA's native <strong>VIBRA</strong> package (<code>Util/Vibra/vibra</code>) or <strong>Phonopy</strong> (<code>phonopy --siesta</code>).</li>
        </ul>
      </div>
    </div>
  );
}
