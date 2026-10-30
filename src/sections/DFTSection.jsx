import { useState } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

const XC_MAP = {
 GGA: ['PBE','PBEsol','RPBE','revPBE','PW91','BLYP'],
 HYB: ['HSE06','PBE0','B3LYP','HSE03','B3PW91','CAM-B3LYP'],
 LDA: ['CA','PW92'],
 VDW: ['VDW-DF','VDW-DF2','optB88','optPBE'],
 MGGA: ['SCAN','r2SCAN','MS2'],
};

const SPIN_OPTIONS = [
 { value: 'none', label: 'None (non-spin-polarized)' },
 { value: 'polarized', label: 'Collinear spin-polarized' },
 { value: 'non-collinear', label: 'Non-collinear (NC-DFT)' },
 { value: 'spin-orbit', label: 'Full Spin-Orbit (SOC)' },
 { value: 'Spin-Orbit+onsite', label: 'SOC + on-site approx.' },
];

const MESH_UNITS = ['Ry','eV','Hartree'];

export function DFTSection() {
 const dft = useFDFStore(s => s.dft);
 const structure = useFDFStore(s => s.structure);
 const setField = useFDFStore(s => s.setField);
 const set = (k, v) => setField('dft', k, v);

 const [showAdvancedD3, setShowAdvancedD3] = useState(false);

 const species = structure.species || [];
 const dfuList = dft.dfu || [];

 const updateDFU = (spLabel, field, val) => {
 const existing = dfuList.find(item => item.speciesLabel === spLabel);
 let next;
 if (existing) {
 next = dfuList.map(item => item.speciesLabel === spLabel ? { ...item, [field]: val } : item);
 } else {
 next = [...dfuList, { speciesLabel: spLabel, enabled: true, l: 2, n: '', U: 4.0, J: 0.0, [field]: val }];
 }
 set('dfu', next);
 };

 const func = dft['XC.functional'] || 'GGA';
 const authorOptions = XC_MAP[func] || ['PBE'];
 const xcAuthor = dft['XC.authors'] || 'PBE';

 const [mcVal, mcUnit] = (dft.MeshCutoff || '300 Ry').split(' ');

 const d3On = dft['DFTD3'] === 'true' || dft['d3.dispersion'] === 'true';
 const useXCDefaults = dft['DFTD3.UseXCDefaults'] !== 'false';
 const bjDamping = dft['DFTD3.BJdamping'] !== 'false';
 const dipoleOn = dft['Slab.DipoleCorrection'] === 'true';

 const handleD3Toggle = (checked) => {
 set('DFTD3', checked ? 'true' : 'false');
 set('d3.dispersion', checked ? 'true' : 'false');
 };

 return (
 <div className="section-pane">
 <SectionHeader title="DFT / Exchange-Correlation" />

 {/* ── XC Functional ── */}
 <div className="field-row-group">
 <FieldRow label="XC.functional" keyword="XC.functional">
 <SelectInput value={func}
 onChange={v => { set('XC.functional', v); set('XC.authors', (XC_MAP[v]||[])[0]||'PBE'); }}
 options={Object.keys(XC_MAP)} />
 </FieldRow>
 <FieldRow label="XC.authors" keyword="XC.authors">
 <SelectInput value={xcAuthor}
 onChange={v => set('XC.authors', v)} options={authorOptions} />
 </FieldRow>
 </div>

 {func === 'HYB' && (
 <div style={{ margin: '0.6rem 0 0.8rem', padding: '0.85rem', background: 'rgba(15, 23, 42, 0.65)', borderRadius: '8px', border: '1px solid var(--border)' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
 <span style={{ fontSize: '1.1rem' }}></span>
 <strong style={{ fontSize: '0.88rem', color: '#38bdf8' }}>
 Hybrid NAO2GTO Parameters (CPC 2026 Paper) — {xcAuthor}
 </strong>
 </div>
 <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: '1.45' }}>
 In SIESTA, exact exchange evaluation in the numerical atomic orbital (NAO) basis is accelerated by expanding each orbital into a linear combination of primitive Gaussian functions (NAO2GTO).
 This allows fast, variationally robust HSE06, PBE0, and B3LYP calculations.
 </p>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
 {/* Hybrid.NGauss */}
 <div>
 <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#34d399', display: 'block', marginBottom: '0.2rem' }}
 title="Number of primitive Gaussians per numerical atomic orbital (typical: 4 to 6). Higher provides higher variational accuracy.">
 <code>Hybrid.NGauss</code>
 <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginLeft: '4px' }}>(Gaussians / NAO)</span>
 </label>
 <TextInput
 mono
 placeholder="4"
 value={dft['Hybrid.NGauss'] || '4'}
 onChange={v => set('Hybrid.NGauss', v)}
 />
 <span style={{ fontSize: '0.71rem', color: 'var(--muted)', display: 'block', marginTop: '0.2rem' }}>
 Expansion size: <code>4</code> provides optimal balance of speed &amp; accuracy (CPC 2026 benchmark).
 </span>
 </div>

 {/* Hybrid.EpsGauss */}
 <div>
 <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#fbbf24', display: 'block', marginBottom: '0.2rem' }}
 title="Least-squares fitting tolerance for the NAO-to-Gaussian expansion.">
 <code>Hybrid.EpsGauss</code>
 <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginLeft: '4px' }}>(Fitting Tolerance)</span>
 </label>
 <TextInput
 mono
 placeholder="5.0e-3"
 value={dft['Hybrid.EpsGauss'] || '5.0e-3'}
 onChange={v => set('Hybrid.EpsGauss', v)}
 />
 <span style={{ fontSize: '0.71rem', color: 'var(--muted)', display: 'block', marginTop: '0.2rem' }}>
 Gaussian fitting residual error threshold (standard: <code>5.0e-3</code>).
 </span>
 </div>

 {/* Hybrid.ScreeningThreshold */}
 <div>
 <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#a78bfa', display: 'block', marginBottom: '0.2rem' }}
 title="Cauchy-Schwarz integral screening threshold for 4-center 2-electron integrals.">
 <code>Hybrid.ScreeningThreshold</code>
 <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginLeft: '4px' }}>(Integral Cutoff)</span>
 </label>
 <TextInput
 mono
 placeholder="1.0e-6"
 value={dft['Hybrid.ScreeningThreshold'] || '1.0e-6'}
 onChange={v => set('Hybrid.ScreeningThreshold', v)}
 />
 <span style={{ fontSize: '0.71rem', color: 'var(--muted)', display: 'block', marginTop: '0.2rem' }}>
 Cauchy-Schwarz threshold to drop negligible exchange pairs (standard: <code>1.0e-6</code>).
 </span>
 </div>
 </div>
 </div>
 )}
 {/* ── Advanced: Custom Hybrid Cocktail (%block XC.mix) ── */}
 <div style={{ margin: '0.6rem 0 1rem' }}>
 <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
 <input
 type="checkbox"
 checked={!!dft.useHybridXC}
 onChange={e => set('useHybridXC', e.target.checked)}
 />
 <span> Advanced: Custom Hybrid Cocktail / Mixing Weights (<code>%block XC.mix</code>)</span>
 </label>

 {dft.useHybridXC && (
 <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
 <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
 Mix custom fractions of exchange ($W_x$) and correlation ($W_c$) across LDA, GGA, and LibXC functionals into a single Hamiltonian.
 </p>

 {/* Presets */}
 <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 600 }}>Presets:</span>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={() => {
 set('xcMixRows', [
 { func: 'GGA', author: 'PBE', weightX: '0.75', weightC: '1.00' },
 { func: 'LDA', author: 'CA', weightX: '0.25', weightC: '0.00' },
 ]);
 }}>
 PBE0 (75% PBE + 25% EX)
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={() => {
 set('xcMixRows', [
 { func: 'GGA', author: 'LIBXC-00-HYB_GGA_XC_HSE06', weightX: '1.00', weightC: '1.00' },
 ]);
 }}>
 HSE06 (LibXC)
 </button>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={() => {
 set('xcMixRows', [
 { func: 'GGA', author: 'LIBXC-00-HYB_GGA_XC_B3LYP', weightX: '1.00', weightC: '1.00' },
 ]);
 }}>
 B3LYP (LibXC)
 </button>
 </div>

 {/* Table */}
 <table className="atoms-table" style={{ width: '100%', marginBottom: '0.5rem' }}>
 <thead>
 <tr>
 <th>Family</th>
 <th>Functional / Author</th>
 <th>Weight (Ex)</th>
 <th>Weight (Ec)</th>
 <th></th>
 </tr>
 </thead>
 <tbody>
 {(dft.xcMixRows || []).map((row, idx) => (
 <tr key={idx}>
 <td>
 <select
 className="input select"
 style={{ width: '85px', fontSize: '0.8rem' }}
 value={row.func || 'GGA'}
 onChange={e => {
 const next = [...(dft.xcMixRows || [])];
 next[idx] = { ...next[idx], func: e.target.value };
 set('xcMixRows', next);
 }}>
 <option value="GGA">GGA</option>
 <option value="LDA">LDA</option>
 <option value="MGGA">MGGA</option>
 <option value="VDW">VDW</option>
 </select>
 </td>
 <td>
 <input
 type="text"
 className="input mono"
 style={{ width: '100%', fontSize: '0.8rem' }}
 value={row.author || ''}
 placeholder="PBE or LIBXC-00-..."
 onChange={e => {
 const next = [...(dft.xcMixRows || [])];
 next[idx] = { ...next[idx], author: e.target.value };
 set('xcMixRows', next);
 }}
 />
 </td>
 <td>
 <input
 type="number"
 step="0.05"
 className="input mono"
 style={{ width: '70px', fontSize: '0.8rem' }}
 value={row.weightX ?? '1.0'}
 onChange={e => {
 const next = [...(dft.xcMixRows || [])];
 next[idx] = { ...next[idx], weightX: e.target.value };
 set('xcMixRows', next);
 }}
 />
 </td>
 <td>
 <input
 type="number"
 step="0.05"
 className="input mono"
 style={{ width: '70px', fontSize: '0.8rem' }}
 value={row.weightC ?? '1.0'}
 onChange={e => {
 const next = [...(dft.xcMixRows || [])];
 next[idx] = { ...next[idx], weightC: e.target.value };
 set('xcMixRows', next);
 }}
 />
 </td>
 <td>
 <button
 type="button"
 className="btn btn-secondary btn-xs"
 style={{ color: 'var(--error)' }}
 disabled={(dft.xcMixRows || []).length <= 1}
 onClick={() => {
 const next = (dft.xcMixRows || []).filter((_, i) => i !== idx);
 set('xcMixRows', next);
 }}>
 Clear
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>

 <button
 type="button"
 className="btn btn-secondary btn-xs"
 onClick={() => {
 const next = [...(dft.xcMixRows || []), { func: 'GGA', author: 'PBE', weightX: '1.00', weightC: '1.00' }];
 set('xcMixRows', next);
 }}>
 Add Component Row
 </button>
 </div>
 )}
 </div>
 <FieldRow label="MeshCutoff" keyword="MeshCutoff">
 <div className="input-with-unit">
 <TextInput mono value={mcVal}
 onChange={v => set('MeshCutoff', `${v} ${mcUnit||'Ry'}`)} placeholder="300" />
 <SelectInput value={mcUnit||'Ry'}
 onChange={u => set('MeshCutoff', `${mcVal} ${u}`)} options={MESH_UNITS} />
 </div>
 </FieldRow>

 <FieldRow label="Spin" keyword="Spin">
 <SelectInput value={dft.Spin || 'none'}
 onChange={v => set('Spin', v)} options={SPIN_OPTIONS} />
 </FieldRow>

 {(dft.Spin === 'spin-orbit' || dft.Spin === 'Spin-Orbit+onsite') && (
 <div className="info-box warning">
 Full SOC requires fully-relativistic PSML pseudopotentials (e.g. from ONCVPSP with "both" option or Pseudo-Dojo FR tables).
 </div>
 )}
 {(dft.Spin === 'polarized' || dft.Spin === 'non-collinear') && (
 <div className="info-box">
 Collinear spin: initialize spin on atoms via DM.InitSpin block (set in SCF section).
 </div>
 )}

 {/* ── Section 6.26: Grimme's DFT-D3 Dispersion Model ── */}
 <div className="subsection">
 <div className="subsection-title">
 Grimme’s DFT-D3 Dispersion Model
 <span className="opt" style={{ fontSize: '0.75rem' }}>DFTD3 (Section 6.26)</span>
 </div>
 <p className="subsection-desc">
 Adds Grimme’s semi-empirical D3 dispersion corrections to DFT (E_D3 = E_2body + E_3body).
 Essential for layered materials, molecular crystals, surface adsorption, and weak van der Waals interactions.
 </p>

 {/* Master Toggle */}
 <FieldRow label="DFTD3" keyword="DFTD3">
 <label className="toggle">
 <input type="checkbox"
 checked={d3On}
 onChange={e => handleD3Toggle(e.target.checked)} />
 <span className="toggle-label">
 {d3On ? ' DFTD3 Enabled' : 'Off'}
 </span>
 </label>
 </FieldRow>

 {d3On && (
 <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
 {/* Damping Scheme */}
 <FieldRow label="DFTD3.BJdamping" keyword="DFTD3.BJdamping">
 <SelectInput
 value={bjDamping ? 'true' : 'false'}
 onChange={v => set('DFTD3.BJdamping', v)}
 options={[
 { value: 'true', label: 'true — Becke-Johnson (BJ) damping (recommended)' },
 { value: 'false', label: 'false — Zero-damping variant (original D3(0))' },
 ]} />
 </FieldRow>

 {/* System Periodicity */}
 <FieldRow label="DFTD3.Periodic" keyword="DFTD3.Periodic">
 <SelectInput
 value={dft['DFTD3.Periodic'] || '[1 2 3]'}
 onChange={v => set('DFTD3.Periodic', v)}
 options={[
 { value: '[1 2 3]', label: '[1 2 3] — 3D Bulk (all 3 lattice vectors periodic)' },
 { value: '[1 2]', label: '[1 2] — 2D Slab / Surface (periodic in a1, a2; vacuum in a3)' },
 { value: '[1]', label: '[1] — 1D Nanowire / Polymer (periodic in a1)' },
 { value: '[ ]', label: '[ ] — 0D Molecule / Cluster (isolated)' },
 ]} />
 </FieldRow>
 <span className="hint" style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--muted)' }}>
 Enforces dispersion periodicity for non-orthogonal or slab cells. For slab calculations with vacuum along z, choose <code>[1 2]</code>.
 </span>

 {/* XC Defaults */}
 <FieldRow label="DFTD3.UseXCDefaults" keyword="DFTD3.UseXCDefaults">
 <label className="toggle">
 <input type="checkbox"
 checked={useXCDefaults}
 onChange={e => set('DFTD3.UseXCDefaults', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">
 {useXCDefaults ? ` Use built-in D3 parameters for ${xcAuthor}` : 'Custom user parameters'}
 </span>
 </label>
 </FieldRow>

 {useXCDefaults ? (
 <div className="hint" style={{ color: 'var(--success)', margin: '0.5rem 0' }}>
 SIESTA automatically loads calibrated D3 parameters for <strong>{xcAuthor}</strong> (covers PBE, PBESol, RevPBE, RPBE, LYP, BLYP, PBE0, HS6).
 </div>
 ) : (
 /* Custom D3 Parameters */
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg, #0f172a)', borderRadius: '4px', border: '1px dashed var(--border)' }}>
 <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent)' }}>
 Manual D3 Model Parameters (DFTD3.UseXCDefaults false):
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
 <FieldRow label="s6" keyword="DFTD3.s6">
 <TextInput mono placeholder="1.0" value={dft['DFTD3.s6'] || ''} onChange={v => set('DFTD3.s6', v)} />
 </FieldRow>
 <FieldRow label="rs6" keyword="DFTD3.rs6">
 <TextInput mono placeholder="1.0" value={dft['DFTD3.rs6'] || ''} onChange={v => set('DFTD3.rs6', v)} />
 </FieldRow>
 <FieldRow label="s8" keyword="DFTD3.s8">
 <TextInput mono placeholder="1.0" value={dft['DFTD3.s8'] || ''} onChange={v => set('DFTD3.s8', v)} />
 </FieldRow>
 <FieldRow label="rs8" keyword="DFTD3.rs8">
 <TextInput mono placeholder="1.0" value={dft['DFTD3.rs8'] || ''} onChange={v => set('DFTD3.rs8', v)} />
 </FieldRow>
 <FieldRow label="a1 (BJ)" keyword="DFTD3.a1">
 <TextInput mono placeholder="0.4" value={dft['DFTD3.a1'] || ''} onChange={v => set('DFTD3.a1', v)} />
 </FieldRow>
 <FieldRow label="a2 (BJ)" keyword="DFTD3.a2">
 <TextInput mono placeholder="5.0" value={dft['DFTD3.a2'] || ''} onChange={v => set('DFTD3.a2', v)} />
 </FieldRow>
 <FieldRow label="alpha" keyword="DFTD3.alpha">
 <TextInput mono placeholder="14.0" value={dft['DFTD3.alpha'] || ''} onChange={v => set('DFTD3.alpha', v)} />
 </FieldRow>
 </div>
 </div>
 )}

 {/* Cut-Offs Accordion */}
 <div style={{ marginTop: '0.75rem' }}>
 <button
 type="button"
 className="btn btn-sm btn-ghost"
 onClick={() => setShowAdvancedD3(!showAdvancedD3)}
 style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--muted)' }}>
 {showAdvancedD3 ? '▾ Hide Cut-Off Distances' : '▸ Advanced: Cut-Off Distances (2Body, 3Body, Coordination)'}
 </button>

 {showAdvancedD3 && (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.4rem' }}>
 <FieldRow label="DFTD3.2BodyCutOff" keyword="DFTD3.2BodyCutOff">
 <TextInput mono placeholder="60.0 bohr" value={dft['DFTD3.2BodyCutOff'] || ''} onChange={v => set('DFTD3.2BodyCutOff', v)} />
 </FieldRow>
 <FieldRow label="DFTD3.3BodyCutOff" keyword="DFTD3.3BodyCutOff">
 <TextInput mono placeholder="40.0 bohr" value={dft['DFTD3.3BodyCutOff'] || ''} onChange={v => set('DFTD3.3BodyCutOff', v)} />
 </FieldRow>
 <FieldRow label="DFTD3.CoordinationCutoff" keyword="DFTD3.CoordinationCutoff">
 <TextInput mono placeholder="10.0 bohr" value={dft['DFTD3.CoordinationCutoff'] || ''} onChange={v => set('DFTD3.CoordinationCutoff', v)} />
 </FieldRow>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* ── Section 6.23: Net Charge, Dipole Correction & Electric Fields ── */}
 <div className="subsection">
 <div className="subsection-title">
 Net Charge, Electric Fields &amp; Slab Dipole
 <span className="opt" style={{ fontSize: '0.75rem' }}>Section 6.23</span>
 </div>
 <p className="subsection-desc">
 Configure systems with net ionic charge, background doping, external electric fields,
 and slab dipole compensation for polar or asymmetric surfaces.
 </p>

 {/* Net Charge & Doping */}
 <div className="field-row-group">
 <FieldRow label="NetCharge" keyword="NetCharge">
 <div className="input-with-unit">
 <TextInput mono placeholder="0.0" value={dft.NetCharge || ''} onChange={v => set('NetCharge', v)} />
 <span className="unit-label" style={{ padding: '0 0.5rem', alignSelf: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>|e|</span>
 </div>
 </FieldRow>

 <FieldRow label="SimulateDoping" keyword="SimulateDoping">
 <label className="toggle">
 <input type="checkbox"
 checked={dft.SimulateDoping === 'true'}
 onChange={e => set('SimulateDoping', e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">Compensating background charge (doped slabs)</span>
 </label>
 </FieldRow>
 </div>

 {/* Slab Dipole Correction */}
 <div className="field-row-group">
 <FieldRow label="Slab.DipoleCorrection" keyword="Slab.DipoleCorrection">
 <SelectInput
 value={dft['Slab.DipoleCorrection'] || 'none'}
 onChange={v => set('Slab.DipoleCorrection', v)}
 options={[
 { value: 'none', label: 'none — No dipole correction (bulk or symmetric slab)' },
 { value: 'charge', label: 'charge — Calculate dipole from valence charge density δρ (standard)' },
 { value: 'vacuum', label: 'vacuum — Calculate field from potential derivative in vacuum' },
 ]} />
 </FieldRow>

 {dft['Slab.DipoleCorrection'] !== 'none' && (
 <FieldRow label="SlabDipoleDirection" keyword="SlabDipoleDirection">
 <SelectInput
 value={dft.SlabDipoleDirection || 'z'}
 onChange={v => set('SlabDipoleDirection', v)}
 options={[
 { value: 'z', label: 'z — along 3rd lattice vector (standard for slabs)' },
 { value: '+z', label: '+z — positive z-axis' },
 { value: '-z', label: '-z — negative z-axis' },
 { value: 'y', label: 'y — along 2nd lattice vector' },
 { value: 'x', label: 'x — along 1st lattice vector' },
 ]} />
 </FieldRow>
 )}
 </div>

 {(dft['Slab.DipoleCorrection'] === 'charge' || dft['Slab.DipoleCorrection'] === 'true') && (
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
 <FieldRow label="%block Slab.DipoleCorrection.Origin" keyword="Slab.DipoleCorrection.Origin">
 <TextInput mono placeholder="0.000 0.000 0.500 Ang (optional origin)"
 value={dft['Slab.DipoleCorrection.Origin'] || ''}
 onChange={v => set('Slab.DipoleCorrection.Origin', v)} />
 </FieldRow>
 <span className="hint" style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
 Specifies dipole origin. If omitted, SIESTA automatically uses the average center of mass of the atoms.
 </span>
 </div>
 )}

 {dft['Slab.DipoleCorrection'] === 'vacuum' && (
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
 <FieldRow label="position" keyword="Slab.DipoleCorrection.Vacuum">
 <TextInput mono placeholder="0.0 0.0 10.0 Ang" value={dft['Slab.DipoleCorrection.Vacuum.position'] || ''} onChange={v => set('Slab.DipoleCorrection.Vacuum.position', v)} />
 </FieldRow>
 <FieldRow label="tolerance" keyword="Slab.DipoleCorrection.Vacuum">
 <TextInput mono placeholder="0.001 eV/Ang/e" value={dft['Slab.DipoleCorrection.Vacuum.tolerance'] || ''} onChange={v => set('Slab.DipoleCorrection.Vacuum.tolerance', v)} />
 </FieldRow>
 <FieldRow label="direction" keyword="Slab.DipoleCorrection.Vacuum">
 <TextInput mono placeholder="0.0 0.0 1.0" value={dft['Slab.DipoleCorrection.Vacuum.direction'] || '0.000 0.000 1.000'} onChange={v => set('Slab.DipoleCorrection.Vacuum.direction', v)} />
 </FieldRow>
 </div>
 <span className="hint" style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
 Determines electric field at a point in the vacuum region where the potential derivative is flat.
 </span>
 </div>
 )}

 {/* External Electric Field Block */}
 <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
 <FieldRow label="ExternalElectricField" keyword="ExternalElectricField">
 <label className="toggle">
 <input type="checkbox"
 checked={!!dft['ExternalElectricField.enabled']}
 onChange={e => {
 set('ExternalElectricField.enabled', e.target.checked);
 if (e.target.checked && (!dft['Slab.DipoleCorrection'] || dft['Slab.DipoleCorrection'] === 'none')) {
 set('Slab.DipoleCorrection', 'charge');
 }
 }} />
 <span className="toggle-label">Apply external electric field</span>
 </label>
 </FieldRow>

 {dft['ExternalElectricField.enabled'] && (
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
 <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
 <FieldRow label="E_x" style={{ flex: 1 }}>
 <TextInput mono value={dft['ExternalElectricField.x'] || '0.000'} onChange={v => set('ExternalElectricField.x', v)} />
 </FieldRow>
 <FieldRow label="E_y" style={{ flex: 1 }}>
 <TextInput mono value={dft['ExternalElectricField.y'] || '0.000'} onChange={v => set('ExternalElectricField.y', v)} />
 </FieldRow>
 <FieldRow label="E_z" style={{ flex: 1 }}>
 <TextInput mono value={dft['ExternalElectricField.z'] || '0.500'} onChange={v => set('ExternalElectricField.z', v)} />
 </FieldRow>
 <FieldRow label="Units" style={{ width: '130px' }}>
 <SelectInput
 value={dft['ExternalElectricField.units'] || 'V/Ang'}
 onChange={v => set('ExternalElectricField.units', v)}
 options={['V/Ang', 'Ry/Bohr/e', 'eV/Ang/e']} />
 </FieldRow>
 </div>
 <span className="hint" style={{ display: 'block', color: 'var(--muted)', marginTop: '0.3rem' }}>
 Must be orthogonal to periodic slab directions (e.g. along $z$ for an $xy$ slab). Applying an electric field automatically activates <code>Slab.DipoleCorrection</code>.
 </span>
 </div>
 )}
 </div>

 {/* Geometry.Hartree & Geometry.Charge Blocks (Section 6.23) */}
 <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
 <div className="field-row-group">
 <FieldRow label="%block Geometry.Hartree" keyword="Geometry.Hartree">
 <label className="toggle">
 <input type="checkbox"
 checked={!!dft['Geometry.Hartree.enabled']}
 onChange={e => set('Geometry.Hartree.enabled', e.target.checked)} />
 <span className="toggle-label">Regions with changed Hartree potential (repulsion / attraction)</span>
 </label>
 </FieldRow>

 <FieldRow label="%block Geometry.Charge" keyword="Geometry.Charge">
 <label className="toggle">
 <input type="checkbox"
 checked={!!dft['Geometry.Charge.enabled']}
 onChange={e => set('Geometry.Charge.enabled', e.target.checked)} />
 <span className="toggle-label">Regions with spread charge (gate doping with charge neutrality)</span>
 </label>
 </FieldRow>
 </div>

 {dft['Geometry.Hartree.enabled'] && (
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
 <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '0.2rem' }}>
 %block Geometry.Hartree Lines (plane, square, box, coords/spheres):
 </label>
 <textarea
 className="input mono"
 rows={4}
 style={{ width: '100%', fontSize: '0.75rem', resize: 'vertical' }}
 placeholder={`plane 1. eV\ndelta\n1.0 1.0 1.0 Ang\n0.0 0.0 1.0`}
 value={dft['Geometry.Hartree.text'] || ''}
 onChange={e => set('Geometry.Hartree.text', e.target.value)}
 />
 <span className="hint" style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
 Section 6.23: 4 geometries allowed: infinite plane (delta, gauss, exp), bounded plane (square), box, or spheres.
 </span>
 </div>
 )}

 {dft['Geometry.Charge.enabled'] && (
 <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)' }}>
 <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '0.2rem' }}>
 %block Geometry.Charge Lines (electrons spread on geometry):
 </label>
 <textarea
 className="input mono"
 rows={4}
 style={{ width: '100%', fontSize: '0.75rem', resize: 'vertical' }}
 placeholder={`plane 0.5\ndelta\n1.0 1.0 1.0 Ang\n0.0 0.0 1.0`}
 value={dft['Geometry.Charge.text'] || ''}
 onChange={e => set('Geometry.Charge.text', e.target.value)}
 />
 <span className="hint" style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
 Section 6.23: Similar to Geometry.Hartree, input value is number of electrons, ensuring charge-neutrality.
 </span>
 </div>
 )}
 </div>
 </div>

 {/* ── DFT+U ── */}
 <div className="subsection">
 <div className="subsection-title">
 DFT+U (Hubbard U) — Correlated Electrons
 <span className="opt" style={{ fontSize: '0.75rem' }}>%block DFTU.Proj</span>
 </div>
 <p className="subsection-desc">
 Apply on-site Coulomb repulsion $U$ for localized $d$- or $f$-orbitals (transition metal oxides, rare-earths).
 </p>

 {species.length > 0 ? (
 <table className="atoms-table" style={{ marginTop: '0.5rem' }}>
 <thead>
 <tr>
 <th>Apply</th>
 <th>Species</th>
 <th>Shell (l)</th>
 <th>n (opt)</th>
 <th>U (eV)</th>
 <th>J (eV)</th>
 </tr>
 </thead>
 <tbody>
 {species.map(sp => {
 const item = dfuList.find(d => d.speciesLabel === sp.label) || { enabled: false, l: 2, n: '', U: 4.0, J: 0.0 };
 return (
 <tr key={sp.idx}>
 <td>
 <input type="checkbox" checked={!!item.enabled}
 onChange={e => updateDFU(sp.label, 'enabled', e.target.checked)} />
 </td>
 <td><strong>{sp.label}</strong> (Z={sp.z})</td>
 <td>
 <select className="input select" style={{ width: '80px' }}
 disabled={!item.enabled} value={item.l ?? 2}
 onChange={e => updateDFU(sp.label, 'l', parseInt(e.target.value))}>
 <option value="2">d (l=2)</option>
 <option value="3">f (l=3)</option>
 <option value="1">p (l=1)</option>
 </select>
 </td>
 <td>
 <input type="text" className="input mono" style={{ width: '50px' }}
 placeholder="3" disabled={!item.enabled} value={item.n ?? ''}
 onChange={e => updateDFU(sp.label, 'n', e.target.value)} />
 </td>
 <td>
 <input type="number" step="0.1" className="input mono" style={{ width: '70px' }}
 disabled={!item.enabled} value={item.U ?? 4.0}
 onChange={e => updateDFU(sp.label, 'U', e.target.value)} />
 </td>
 <td>
 <input type="number" step="0.1" className="input mono" style={{ width: '70px' }}
 disabled={!item.enabled} value={item.J ?? 0.0}
 onChange={e => updateDFU(sp.label, 'J', e.target.value)} />
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 ) : (
 <div className="hint">Define species in ChemicalSpeciesLabel to configure DFT+U.</div>
 )}
 </div>

 <div className="info-box">
 <strong>MeshCutoff guide:</strong> Controls fineness of the real-space grid for Hartree and XC.
 Start at 200–300 Ry; converge by doubling until total energy changes &lt;1 meV/atom.
 Higher cutoff = more memory and CPU. Typical production: 400–600 Ry for hard pseudopotentials.
 </div>
 </div>
 );
}
