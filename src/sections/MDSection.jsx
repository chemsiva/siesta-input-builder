import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

const MD_TYPES = [
  { value: 'CG',                  label: 'CG — Conjugate Gradient relaxation' },
  { value: 'FIRE',                label: 'FIRE — Fast Inertial Relaxation' },
  { value: 'Broyden',             label: 'Broyden — Broyden relaxation' },
  { value: 'Verlet',              label: 'Verlet — NVE molecular dynamics' },
  { value: 'Nose',                label: 'Nosé — NVT thermostat (canonical)' },
  { value: 'ParrinelloRahman',    label: 'Parrinello-Rahman — NPH barostat' },
  { value: 'NoseParrinelloRahman',label: 'Nosé+Parrinello-Rahman — NPT' },
  { value: 'Anneal',              label: 'Anneal — simulated annealing' },
  { value: 'FC',                  label: 'FC — force constants (phonons)' },
  { value: 'Forces',              label: 'Forces — single-point forces only' },
];

const FORCE_UNITS  = ['eV/Ang','Ry/Bohr'];
const STRESS_UNITS = ['GPa','kBar','eV/Ang**3'];
const DISPL_UNITS  = ['Ang','Bohr'];
const PRESS_UNITS  = ['GPa','kBar'];
const TEMP_UNITS   = ['K','eV'];

export function MDSection() {
  const md     = useFDFStore(s => s.md);
  const output = useFDFStore(s => s.output);
  const setField   = useFDFStore(s => s.setField);
  const setSection = useFDFStore(s => s.setSection);
  const set       = (k, v) => setField('md', k, v);
  const setOutput = (k, v) => setField('output', k, v);

  const mdType = md['MD.TypeOfRun'] || 'CG';
  const isRelax  = ['CG','FIRE','Broyden'].includes(mdType);
  const isMD     = ['Verlet','Nose','ParrinelloRahman','NoseParrinelloRahman','Anneal'].includes(mdType);

  const splitVal = (str, defUnit) => { const parts = (str||'').split(' '); return [parts[0]||'', parts[1]||defUnit]; };
  const [mfVal, mfUnit] = splitVal(md['MD.MaxForceTol'], 'eV/Ang');
  const [msVal, msUnit] = splitVal(md['MD.MaxStressTol'], 'GPa');
  const [mdVal, mdUnit] = splitVal(md['MD.MaxDispl'], 'Ang');
  const [mpVal, mpUnit] = splitVal(md['MD.TargetPressure'], 'GPa');
  const [itVal, itUnit] = splitVal(md['MD.InitialTemperature'], 'K');
  const [ttVal, ttUnit] = splitVal(md['MD.TargetTemperature'], 'K');

  return (
    <div className="section-pane">
      <SectionHeader title="MD / Geometry Relaxation" />

      <FieldRow label="MD.TypeOfRun" keyword="MD.TypeOfRun">
        <SelectInput value={mdType} onChange={v => set('MD.TypeOfRun', v)} options={MD_TYPES} />
      </FieldRow>

      {isRelax && (
        <>
          <div className="field-row-group">
            <FieldRow
              label={mdType === 'CG' ? 'MD.NumCGsteps' : 'MD.Steps (max iterations)'}
              keyword={mdType === 'CG' ? 'MD.NumCGsteps' : 'MD.Steps'}>
              <TextInput
                mono
                value={md['MD.NumCGsteps'] || md['MD.Steps'] || '100'}
                onChange={v => { set('MD.NumCGsteps', v); set('MD.Steps', v); }}
                placeholder="100"
              />
            </FieldRow>
            <FieldRow label="MD.MaxDispl" keyword="MD.MaxDispl">
              <div className="input-with-unit">
                <TextInput mono value={mdVal} onChange={v => set('MD.MaxDispl', `${v} ${mdUnit}`)} placeholder="0.1" />
                <SelectInput value={mdUnit} onChange={u => set('MD.MaxDispl', `${mdVal} ${u}`)} options={DISPL_UNITS} />
              </div>
            </FieldRow>
          </div>

          <FieldRow label="MD.MaxForceTol" keyword="MD.MaxForceTol">
            <div className="input-with-unit">
              <TextInput mono value={mfVal} onChange={v => set('MD.MaxForceTol', `${v} ${mfUnit}`)} placeholder="0.04" />
              <SelectInput value={mfUnit} onChange={u => set('MD.MaxForceTol', `${mfVal} ${u}`)} options={FORCE_UNITS} />
            </div>
          </FieldRow>

          <FieldRow label="MD.VariableCell" keyword="MD.VariableCell">
            <label className="toggle">
              <input type="checkbox"
                checked={md['MD.VariableCell'] === 'true'}
                onChange={e => set('MD.VariableCell', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">Allow cell shape/volume to relax (Section 7.2)</span>
            </label>
          </FieldRow>

          {md['MD.VariableCell'] === 'true' && (
            <>
              <div className="field-row-group">
                <FieldRow label="MD.MaxStressTol" keyword="MD.MaxStressTol">
                  <div className="input-with-unit">
                    <TextInput mono value={msVal} onChange={v => set('MD.MaxStressTol', `${v} ${msUnit}`)} placeholder="1.0" />
                    <SelectInput value={msUnit} onChange={u => set('MD.MaxStressTol', `${msVal} ${u}`)} options={STRESS_UNITS} />
                  </div>
                </FieldRow>
                <FieldRow label="Target.Pressure" keyword="Target.Pressure">
                  <div className="input-with-unit">
                    <TextInput mono value={mpVal} onChange={v => { set('Target.Pressure', `${v} ${mpUnit}`); set('MD.TargetPressure', `${v} ${mpUnit}`); }} placeholder="0.0" />
                    <SelectInput value={mpUnit} onChange={u => { set('Target.Pressure', `${mpVal} ${u}`); set('MD.TargetPressure', `${mpVal} ${u}`); }} options={PRESS_UNITS} />
                  </div>
                </FieldRow>
              </div>

              <FieldRow label="Constant.Volume" keyword="Constant.Volume">
                <label className="toggle">
                  <input type="checkbox"
                    checked={md['Constant.Volume'] === 'true'}
                    onChange={e => set('Constant.Volume', e.target.checked ? 'true' : 'false')} />
                  <span className="toggle-label">Keep cell volume constant (relax cell shape & atomic coords only)</span>
                </label>
              </FieldRow>

              {['Broyden', 'FIRE'].includes(mdType) && (
                <FieldRow label="MD.RelaxCellOnly" keyword="MD.RelaxCellOnly">
                  <label className="toggle">
                    <input type="checkbox"
                      checked={md['MD.RelaxCellOnly'] === 'true'}
                      onChange={e => set('MD.RelaxCellOnly', e.target.checked ? 'true' : 'false')} />
                    <span className="toggle-label">Relax cell only (rescale atomic coordinates, keeping fractional positions fixed)</span>
                  </label>
                </FieldRow>
              )}
            </>
          )}

          {/* Algorithm-Specific Blocks */}
          {mdType === 'Broyden' && (
            <div className="subsection" style={{ marginTop: '0.6rem' }}>
              <div className="subsection-title">Broyden Optimization Parameters (Section 7.2.2)</div>
              <div className="field-row-group">
                <FieldRow label="MD.Broyden.History.Steps" keyword="MD.Broyden.History.Steps">
                  <TextInput mono value={md['MD.Broyden.History.Steps'] || '5'} onChange={v => set('MD.Broyden.History.Steps', v)} placeholder="5" />
                </FieldRow>
                <FieldRow label="MD.Broyden.Initial.Inverse.Jacobian" keyword="MD.Broyden.Initial.Inverse.Jacobian">
                  <TextInput mono value={md['MD.Broyden.Initial.Inverse.Jacobian'] || '1.0'} onChange={v => set('MD.Broyden.Initial.Inverse.Jacobian', v)} placeholder="1.0" />
                </FieldRow>
              </div>
              <FieldRow label="MD.Broyden.Cycle.On.Maxit" keyword="MD.Broyden.Cycle.On.Maxit">
                <label className="toggle">
                  <input type="checkbox"
                    checked={md['MD.Broyden.Cycle.On.Maxit'] !== 'false'}
                    onChange={e => set('MD.Broyden.Cycle.On.Maxit', e.target.checked ? 'true' : 'false')} />
                  <span className="toggle-label">Shift history data sets on reaching max (default true)</span>
                </label>
              </FieldRow>
            </div>
          )}

          {mdType === 'FIRE' && (
            <div className="subsection" style={{ marginTop: '0.6rem' }}>
              <div className="subsection-title">FIRE Relaxation Parameters (Section 7.2.3)</div>
              <FieldRow label="MD.FIRE.TimeStep" keyword="MD.FIRE.TimeStep">
                <TextInput mono value={md['MD.FIRE.TimeStep'] || '1.0 fs'} onChange={v => set('MD.FIRE.TimeStep', v)} placeholder="1.0 fs" />
              </FieldRow>
            </div>
          )}

          {mdType === 'CG' && (
            <FieldRow label="MD.UseSaveCG" keyword="MD.UseSaveCG">
              <label className="toggle">
                <input type="checkbox"
                  checked={md['MD.UseSaveCG'] === 'true'}
                  onChange={e => set('MD.UseSaveCG', e.target.checked ? 'true' : 'false')} />
                <span className="toggle-label">Read conjugate-gradient history from SystemLabel.CG (continuation run)</span>
              </label>
            </FieldRow>
          )}
        </>
      )}

      {isMD && (
        <>
          <FieldRow label="MD.Steps" keyword="MD.Steps">
            <TextInput mono value={md['MD.Steps']} onChange={v => set('MD.Steps', v)} placeholder="1000" />
          </FieldRow>
          <div className="field-row-group">
            <FieldRow label="MD.InitialTemperature" keyword="MD.InitialTemperature">
              <div className="input-with-unit">
                <TextInput mono value={itVal} onChange={v => set('MD.InitialTemperature', `${v} ${itUnit}`)} placeholder="300" />
                <SelectInput value={itUnit} onChange={u => set('MD.InitialTemperature', `${itVal} ${u}`)} options={TEMP_UNITS} />
              </div>
            </FieldRow>
            <FieldRow label="MD.TargetTemperature" keyword="MD.TargetTemperature">
              <div className="input-with-unit">
                <TextInput mono value={ttVal} onChange={v => set('MD.TargetTemperature', `${v} ${ttUnit}`)} placeholder="300" />
                <SelectInput value={ttUnit} onChange={u => set('MD.TargetTemperature', `${ttVal} ${u}`)} options={TEMP_UNITS} />
              </div>
            </FieldRow>
          </div>
        </>
      )}

      <FieldRow label="MD.UseSaveXV" keyword="MD.UseSaveXV">
        <label className="toggle">
          <input type="checkbox"
            checked={md['MD.UseSaveXV'] === 'true'}
            onChange={e => set('MD.UseSaveXV', e.target.checked ? 'true' : 'false')} />
          <span className="toggle-label">Read coords+velocities from .XV file (restart)</span>
        </label>
      </FieldRow>
      {/* Trajectory & History Outputs (.ANI / .MDE) */}
      <div className="subsection">
        <div className="subsection-title">
          🎬 Trajectory &amp; History Outputs (.ANI &amp; .MDE)
        </div>
        <div className="field-row-group">
          <FieldRow label="WriteMDXmol (.ANI)" keyword="WriteMDXmol">
            <label className="toggle">
              <input type="checkbox"
                checked={output['WriteMDXmol'] === 'true'}
                onChange={e => setOutput('WriteMDXmol', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">Save coordinates to <code>SystemLabel.ANI</code> (for VMD/JMol/OVITO)</span>
            </label>
          </FieldRow>
          <FieldRow label="WriteMDhistory (.MDE / .MD)" keyword="WriteMDhistory">
            <label className="toggle">
              <input type="checkbox"
                checked={output['WriteMDhistory'] === 'true'}
                onChange={e => setOutput('WriteMDhistory', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">Save MD energies to <code>SystemLabel.MDE</code> &amp; velocities to <code>.MD</code></span>
            </label>
          </FieldRow>
        </div>
      </div>

      <div className="info-box">
        <strong>CG vs FIRE:</strong> CG is standard and robust. FIRE (Fast Inertial Relaxation Engine)
        is often faster for large systems (&gt;100 atoms). Broyden is good for cells where
        Pulay-stress is an issue. For variable-cell: tighten MD.MaxStressTol to 0.1–0.01 GPa.
      </div>
    </div>
  );
}
