import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

const SOLVERS = ['diagon','OMM','OrderN','PEXSI','ELSI'];
const MIXERS = ['pulay','linear','broyden'];

export function SCFSection() {
 const scf = useFDFStore(s => s.scf);
 const dft = useFDFStore(s => s.dft);
 const structure = useFDFStore(s => s.structure);
 const setSection = useFDFStore(s => s.setSection);
 const setField = useFDFStore(s => s.setField);
 const set = (k, v) => setField('scf', k, v);

 const [etVal, etUnit] = (scf.ElectronicTemperature || '300 K').split(' ');
 const etUnits = ['K','eV','meV','Ry'];

 // DM.InitSpin — stored as raw text block
 const spinBlock = scf._dmInitSpin || '';

 return (
 <div className="section-pane">
 <SectionHeader title="SCF Control" />

 <div className="field-row-group">
 <FieldRow label="MaxSCFIterations" keyword="MaxSCFIterations">
 <TextInput mono value={scf.MaxSCFIterations} onChange={v => set('MaxSCFIterations', v)} placeholder="200" />
 </FieldRow>
 <FieldRow label="MinSCFIterations" keyword="MinSCFIterations">
 <TextInput mono value={scf.MinSCFIterations} onChange={v => set('MinSCFIterations', v)} placeholder="0 (optional)" />
 </FieldRow>
 </div>

 <FieldRow label="DM.Tolerance" keyword="DM.Tolerance">
 <TextInput mono value={scf['DM.Tolerance']} onChange={v => set('DM.Tolerance', v)} placeholder="1e-4" />
 </FieldRow>

 <div className="subsection">
 <div className="subsection-title">Mixing</div>
 <div className="field-row-group">
 <FieldRow label="SCF.Mixer.Method" keyword="SCF.Mixer.Method">
 <SelectInput value={scf['SCF.Mixer.Method']||'pulay'}
 onChange={v => set('SCF.Mixer.Method', v)} options={MIXERS} />
 </FieldRow>
 <FieldRow label="DM.MixingWeight" keyword="DM.MixingWeight">
 <TextInput mono value={scf['DM.MixingWeight']} onChange={v => set('DM.MixingWeight', v)} placeholder="0.25" />
 </FieldRow>
 <FieldRow label="DM.NumberPulay" keyword="DM.NumberPulay">
 <TextInput mono value={scf['DM.NumberPulay']} onChange={v => set('DM.NumberPulay', v)} placeholder="8" />
 </FieldRow>
 </div>
 <div className="info-box">
 Pulay (DIIS) history 4–12 works for most systems. For difficult convergence (strongly
 correlated, metallic slabs): reduce MixingWeight (0.05–0.1) and increase Pulay history.
 </div>
 </div>

 <div className="field-row-group">
 <FieldRow label="ElectronicTemperature" keyword="ElectronicTemperature">
 <div className="input-with-unit">
 <TextInput mono value={etVal} onChange={v => set('ElectronicTemperature', `${v} ${etUnit||'K'}`)} placeholder="300" />
 <SelectInput value={etUnit||'K'} onChange={u => set('ElectronicTemperature', `${etVal} ${u}`)} options={etUnits} />
 </div>
 </FieldRow>
 <FieldRow label="SolutionMethod" keyword="SolutionMethod">
 <SelectInput value={scf.SolutionMethod||'diagon'} onChange={v => set('SolutionMethod', v)} options={SOLVERS} />
 </FieldRow>
 </div>

 <div className="field-row-group">
 <FieldRow label="SCF.MustConverge" keyword="SCF.MustConverge">
 <label className="toggle">
 <input type="checkbox"
 checked={scf['SCF.MustConverge'] === 'true' || scf['SCF.MustConverge'] === true}
 onChange={e => set('SCF.MustConverge', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">{scf['SCF.MustConverge'] === 'true' ? 'true (abort if not converged)' : 'false (warn only)'}</span>
 </label>
 </FieldRow>
 <FieldRow label="DM.UseSaveDM" keyword="DM.UseSaveDM">
 <label className="toggle">
 <input type="checkbox"
 checked={scf['DM.UseSaveDM'] === 'true'}
 onChange={e => set('DM.UseSaveDM', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">Read DM from file (restart)</span>
 </label>
 </FieldRow>
 </div>

 {/* DM.InitSpin block — shown only when spin is active */}
 {(dft.Spin && dft.Spin !== 'none') && (
 <div className="subsection">
 <div className="subsection-title">
 DM.InitSpin (Magnetic State Assistant)
 </div>
 <p className="subsection-desc">
 Set initial atomic magnetic moments $\mu_B$. Use presets below or edit lines: <code>atom_idx moment_μB [theta phi]</code>
 </p>
 <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
 <button
 className="btn btn-secondary btn-sm"
 onClick={() => {
 const lines = (structure.atoms || []).map((_, i) => `${i + 1} +3.00`);
 setSection('scf', { _dmInitSpin: lines.join('\n') });
 }}>
 FM (+3.0 μB)
 </button>
 <button
 className="btn btn-secondary btn-sm"
 onClick={() => {
 const lines = (structure.atoms || []).map((_, i) => `${i + 1} ${i % 2 === 0 ? '+3.00' : '-3.00'}`);
 setSection('scf', { _dmInitSpin: lines.join('\n') });
 }}>
 AFM (Alternating ±3.0 μB)
 </button>
 <button
 className="btn btn-secondary btn-sm"
 onClick={() => {
 const lines = (structure.atoms || []).map((_, i) => `${i + 1} +3.00 90.0 ${(i * 90) % 360}.0`);
 setSection('scf', { _dmInitSpin: lines.join('\n') });
 }}>
 Non-Collinear Spiral
 </button>
 <button
 className="btn btn-ghost btn-sm"
 onClick={() => setSection('scf', { _dmInitSpin: '' })}>
 Clear
 </button>
 </div>
 <textarea className="code-area" rows={Math.max(3, (structure.atoms||[]).length)}
 value={spinBlock}
 onChange={e => setSection('scf', { _dmInitSpin: e.target.value })}
 placeholder={`1 +2.0\n2 -2.0\n# or for NC:\n1 +2.0 90. 0.`}
 spellCheck={false} />
 <div className="info-box">
 Leave blank to omit the DM.InitSpin block. Signs: + = spin-up, − = spin-down.
 For non-collinear, all three numbers (moment, θ, φ) are required per atom.
 </div>
 </div>
 )}
 </div>
 );
}
