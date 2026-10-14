import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

const ELEMENTS = [
  {z:1,sym:'H'},{z:2,sym:'He'},{z:3,sym:'Li'},{z:4,sym:'Be'},{z:5,sym:'B'},
  {z:6,sym:'C'},{z:7,sym:'N'},{z:8,sym:'O'},{z:9,sym:'F'},{z:10,sym:'Ne'},
  {z:11,sym:'Na'},{z:12,sym:'Mg'},{z:13,sym:'Al'},{z:14,sym:'Si'},{z:15,sym:'P'},
  {z:16,sym:'S'},{z:17,sym:'Cl'},{z:18,sym:'Ar'},{z:19,sym:'K'},{z:20,sym:'Ca'},
  {z:21,sym:'Sc'},{z:22,sym:'Ti'},{z:23,sym:'V'},{z:24,sym:'Cr'},{z:25,sym:'Mn'},
  {z:26,sym:'Fe'},{z:27,sym:'Co'},{z:28,sym:'Ni'},{z:29,sym:'Cu'},{z:30,sym:'Zn'},
  {z:31,sym:'Ga'},{z:32,sym:'Ge'},{z:33,sym:'As'},{z:34,sym:'Se'},{z:35,sym:'Br'},
  {z:36,sym:'Kr'},{z:37,sym:'Rb'},{z:38,sym:'Sr'},{z:39,sym:'Y'},{z:40,sym:'Zr'},
  {z:41,sym:'Nb'},{z:42,sym:'Mo'},{z:44,sym:'Ru'},{z:45,sym:'Rh'},{z:46,sym:'Pd'},
  {z:47,sym:'Ag'},{z:48,sym:'Cd'},{z:49,sym:'In'},{z:50,sym:'Sn'},{z:51,sym:'Sb'},
  {z:52,sym:'Te'},{z:53,sym:'I'},{z:55,sym:'Cs'},{z:56,sym:'Ba'},{z:57,sym:'La'},
  {z:58,sym:'Ce'},{z:72,sym:'Hf'},{z:73,sym:'Ta'},{z:74,sym:'W'},{z:75,sym:'Re'},
  {z:76,sym:'Os'},{z:77,sym:'Ir'},{z:78,sym:'Pt'},{z:79,sym:'Au'},{z:80,sym:'Hg'},
  {z:81,sym:'Tl'},{z:82,sym:'Pb'},{z:83,sym:'Bi'},
];

const BASIS_SIZES = ['SZ','SZP','DZ','DZP','DZDP','TZP','TZDP'];
const BASIS_TYPES = ['split','splitgauss','nodes','nonodes','filteret'];
const ENERGY_SHIFT_UNITS = ['meV', 'eV', 'Ry'];

export function SpeciesSection() {
  const structure = useFDFStore(s => s.structure);
  const basis = useFDFStore(s => s.basis);
  const pseudoSettings = useFDFStore(s => s.pseudoSettings || {});
  const setPseudoSettings = useFDFStore(s => s.setPseudoSettings);
  const autoAssignPseudopotentials = useFDFStore(s => s.autoAssignPseudopotentials);
  const setSection = useFDFStore(s => s.setSection);
  const setField = useFDFStore(s => s.setField);

  const species = structure.species || [];
  const detectedFiles = pseudoSettings.detectedFiles || [];

  // Parse PAO.EnergyShift number and unit (meV, eV, Ry)
  const rawES = (basis['PAO.EnergyShift'] || '100 meV').trim();
  const esMatch = rawES.match(/^([\d.eE+-]+)\s*(\w+)?$/);
  const esVal = esMatch ? esMatch[1] : (rawES.split(/\s+/)[0] || '100');
  let esUnit = esMatch && esMatch[2] ? esMatch[2] : 'meV';
  const matchedUnit = ENERGY_SHIFT_UNITS.find(u => u.toLowerCase() === esUnit.toLowerCase());
  if (matchedUnit) esUnit = matchedUnit;
  else esUnit = 'meV';
  const handleScanFolder = (e) => {
    const files = Array.from(e.target.files || []);
    const validPseudos = files
      .map(f => f.name)
      .filter(n => n.endsWith('.psf') || n.endsWith('.psml') || n.endsWith('.vps') || n.endsWith('.UPF'));
    
    let folderPath = pseudoSettings.directory || '';
    if (files.length > 0 && files[0].webkitRelativePath) {
      const parts = files[0].webkitRelativePath.split('/');
      if (parts.length > 1) {
        folderPath = parts[0];
      }
    }

    setPseudoSettings({
      detectedFiles: validPseudos,
      directory: folderPath || pseudoSettings.directory,
    });
    e.target.value = '';
  };


  const setSpecies = (i, key, val) => {
    const next = species.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    setSection('structure', { species: next });
  };

  const addSpecies = () => {
    const nextIdx = species.length + 1;
    setSection('structure', {
      species: [...species, { idx: String(nextIdx), z: '6', label: 'C', psfile: '' }]
    });
  };

  const removeSpecies = (i) => {
    const next = species.filter((_, idx) => idx !== i)
      .map((s, idx) => ({ ...s, idx: String(idx + 1) }));
    setSection('structure', { species: next });
  };

  return (
    <div className="section-pane">
      <SectionHeader title="Species & Basis Set" />

      {/* ── Pseudopotential Setup ─────────────────────────────────────────── */}
      <div className="subsection">
        <div className="subsection-title">
          📁 Pseudopotential Setup
        </div>
        <p className="subsection-desc">
          Your <code>.psf</code> / <code>.psml</code> files stay in their original directory —
          you do <strong>not</strong> need to copy them into your calculation folder.
          When you specify the path below, the builder automatically embeds the <strong>full absolute path</strong>
          directly into <code>%block ChemicalSpeciesLabel</code> in your <code>.fdf</code> file.
          SIESTA will automatically detect and load the pseudopotentials from that directory on launch!
        </p>

        {/* Step 1 — full server path */}
        <div className="slab-tool-card" style={{ marginBottom: '0.75rem' }}>
          <div className="slab-tool-title">
            Step 1 — Full server path to your pseudopotential folder
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="input mono"
              style={{ flex: 1 }}
              placeholder="/scratch/SIVAKUMAR/nc-sr-05_pbe_standard_psml/psf_outputs"
              value={pseudoSettings.pseudoPath || ''}
              onChange={e => setPseudoSettings({ pseudoPath: e.target.value })}
            />
          </div>
          {pseudoSettings.pseudoPath && pseudoSettings.pseudoPath.trim() && (
            <div className="hint" style={{ color: 'var(--success)', marginTop: '0.35rem', fontWeight: 600 }}>
              ✅ Full path embedded in FDF: <code style={{ fontSize: '0.8rem' }}>{pseudoSettings.pseudoPath.trim()}/[element].{pseudoSettings.format || 'psf'}</code>
            </div>
          )}
          <span className="hint" style={{ marginTop: '0.3rem', display: 'block' }}>
            When you download <code>.fdf</code> to any folder, SIESTA will automatically locate the pseudopotential files using this full path.
          </span>
        </div>

        {/* Step 2 — browser scan for filename auto-matching */}
        <div className="slab-tool-card">
          <div className="slab-tool-title">
            Step 2 — Scan your local copy of that folder to auto-match filenames
          </div>
          <p className="hint" style={{ margin: '0.3rem 0 0.5rem' }}>
            Browse the same pseudo folder from your browser. The builder reads only filenames
            (no file content is uploaded) and auto-fills each species row below.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input select"
              style={{ width: '100px' }}
              value={pseudoSettings.format || 'psf'}
              onChange={e => setPseudoSettings({ format: e.target.value })}>
              <option value="psf">.psf</option>
              <option value="psml">.psml</option>
              <option value="vps">.vps</option>
            </select>

            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📂 Scan Folder
              <input
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                style={{ display: 'none' }}
                onChange={handleScanFolder}
              />
            </label>

            <button
              className="btn btn-primary btn-sm"
              onClick={autoAssignPseudopotentials}
              title="Auto-match all species against scanned pseudo files">
              ⚡ Auto-Assign All
            </button>
          </div>

          {detectedFiles.length > 0 ? (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '0.3rem' }}>
                ✅ {detectedFiles.length} pseudo files scanned
                {pseudoSettings.directory ? ` from "${pseudoSettings.directory}"` : ''}:
              </div>
              <div style={{
                maxHeight: '80px', overflowY: 'auto', fontSize: '0.75rem',
                fontFamily: 'monospace', color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '0.3rem 0.5rem',
              }}>
                {detectedFiles.join('  ·  ')}
              </div>
            </div>
          ) : (
            <div className="hint" style={{ marginTop: '0.35rem' }}>
              No files scanned yet — click Scan Folder, then Auto-Assign All.
            </div>
          )}
        </div>
      </div>

      {/* ChemicalSpeciesLabel */}
      <div className="subsection">
        <div className="subsection-title">ChemicalSpeciesLabel <span className="required">required</span></div>
        <p className="subsection-desc">
          One row per species. Index must match the species column in the atom table.
          Label is used to find pseudopotential files (e.g. <code>Fe.psf</code>, <code>pbe/Fe.psml</code>).
        </p>
        <table className="atoms-table">
          <thead>
            <tr>
              <th>Idx</th>
              <th>Z (atomic number)</th>
              <th>Label</th>
              <th>Pseudopotential file <span className="opt">(optional)</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {species.map((sp, i) => (
              <tr key={i}>
                <td className="atom-idx">{sp.idx}</td>
                <td>
                  <select className="input select"
                    value={sp.z}
                    onChange={e => {
                      const el = ELEMENTS.find(el => el.z === parseInt(e.target.value));
                      setSpecies(i, 'z', e.target.value);
                      if (el && !sp.label) setSpecies(i, 'label', el.sym);
                    }}>
                    {ELEMENTS.map(el => (
                      <option key={el.z} value={el.z}>{el.z} — {el.sym}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="text" className="input mono" value={sp.label}
                    onChange={e => setSpecies(i, 'label', e.target.value)} placeholder="Fe" />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="text" className="input mono" value={sp.psfile}
                      onChange={e => setSpecies(i, 'psfile', e.target.value)}
                      placeholder="Fe.psf or pbe/Fe.psml" />
                    {detectedFiles.length > 0 && (
                      <span
                        title={detectedFiles.some(f => f.toLowerCase() === (sp.psfile || '').split('/').pop().toLowerCase())
                          ? 'Matched in scanned folder'
                          : 'File not detected in scanned folder'}
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                          background: detectedFiles.some(f => f.toLowerCase() === (sp.psfile || '').split('/').pop().toLowerCase())
                            ? 'rgba(52, 211, 153, 0.2)'
                            : 'rgba(251, 191, 36, 0.2)',
                          color: detectedFiles.some(f => f.toLowerCase() === (sp.psfile || '').split('/').pop().toLowerCase())
                            ? 'var(--success)'
                            : 'var(--warning)',
                        }}>
                        {detectedFiles.some(f => f.toLowerCase() === (sp.psfile || '').split('/').pop().toLowerCase())
                          ? '✓ Found'
                          : '⚠️ Missing'}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <button className="btn btn-danger-sm" onClick={() => removeSpecies(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-secondary" style={{marginTop:'0.5rem'}} onClick={addSpecies}>+ Add Species</button>
      </div>

      {/* Global basis parameters (Section 6.3) */}
      <div className="subsection">
        <div className="subsection-title">
          ⚛️ Global Basis Parameters (Section 6.3)
        </div>

        <div className="field-row-group">
          <FieldRow label="PAO.BasisSize" keyword="PAO.BasisSize">
            <SelectInput value={basis['PAO.BasisSize']}
              onChange={v => setField('basis','PAO.BasisSize', v)} options={BASIS_SIZES} />
          </FieldRow>

          <FieldRow label="PAO.BasisType" keyword="PAO.BasisType">
            <SelectInput value={basis['PAO.BasisType']}
              onChange={v => setField('basis','PAO.BasisType', v)} options={BASIS_TYPES} />
          </FieldRow>
        </div>

        {/* Section 6.3.3: Per-Species Basis Sizes (%block PAO.BasisSizes) */}
        <div style={{ margin: '0.6rem 0', padding: '0.6rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>
              🎯 Per-Species Basis Sizes (%block PAO.BasisSizes)
            </span>
            <label className="toggle">
              <input type="checkbox"
                checked={!!basis.usePerSpeciesBasisSizes}
                onChange={e => setField('basis', 'usePerSpeciesBasisSizes', e.target.checked)} />
              <span className="toggle-label">{basis.usePerSpeciesBasisSizes ? 'Custom Sizes Active' : 'Off (Use Global Size)'}</span>
            </label>
          </div>

          {basis.usePerSpeciesBasisSizes && (
            <div style={{ marginTop: '0.5rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                Specify custom basis sizes for each species (e.g. Si DZ, H DZP, O SZP):
              </p>
              {species.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {species.map(sp => (
                    <div key={sp.idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(15,23,42,0.4)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                      <strong style={{ fontSize: '0.82rem', width: '35px' }}>{sp.label}:</strong>
                      <SelectInput
                        value={basis.speciesBasisSizes?.[sp.label] || basis['PAO.BasisSize'] || 'DZP'}
                        onChange={v => {
                          const next = { ...(basis.speciesBasisSizes || {}), [sp.label]: v };
                          setField('basis', 'speciesBasisSizes', next);
                        }}
                        options={BASIS_SIZES}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hint">Define chemical species above to configure per-species basis sizes.</div>
              )}
            </div>
          )}
        </div>

        <div className="field-row-group">
          <FieldRow label="PAO.EnergyShift" keyword="PAO.EnergyShift">
            <div className="input-with-unit">
              <TextInput
                mono
                value={esVal}
                onChange={v => setField('basis', 'PAO.EnergyShift', `${v} ${esUnit}`)}
                placeholder="100"
              />
              <SelectInput
                value={esUnit}
                onChange={u => setField('basis', 'PAO.EnergyShift', `${esVal} ${u}`)}
                options={ENERGY_SHIFT_UNITS}
              />
            </div>
          </FieldRow>
          <FieldRow label="PAO.SplitNorm" keyword="PAO.SplitNorm">
            <TextInput mono value={basis['PAO.SplitNorm']}
              onChange={v => setField('basis','PAO.SplitNorm', v)} placeholder="0.15" />
          </FieldRow>
        </div>

        <div className="field-row-group">
          <FieldRow label="PAO.SplitNormH" keyword="PAO.SplitNormH">
            <TextInput mono value={basis['PAO.SplitNormH'] || ''}
              onChange={v => setField('basis','PAO.SplitNormH', v)} placeholder="0.45 (for Hydrogen)" />
          </FieldRow>

          <FieldRow label="BasisPressure" keyword="BasisPressure">
            <TextInput mono value={basis['BasisPressure'] || ''}
              onChange={v => setField('basis','BasisPressure', v)} placeholder="0.2 GPa (for basis enthalpy)" />
          </FieldRow>
        </div>

        {/* Section 6.3.5: Multiple-Zeta & Filteret Options */}
        <div style={{ margin: '0.6rem 0', padding: '0.6rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.4rem' }}>
            Multiple-Zeta Generation &amp; Tail Norm (Section 6.3.5)
          </div>

          <div className="field-row-group">
            <FieldRow label="PAO.SplitTailNorm" keyword="PAO.SplitTailNorm">
              <SelectInput
                value={basis['PAO.SplitTailNorm'] !== 'false' ? 'true' : 'false'}
                onChange={v => setField('basis', 'PAO.SplitTailNorm', v)}
                options={[
                  { value: 'true',  label: 'true  — Shorter higher-zeta cutoffs (recommended in v5)' },
                  { value: 'false', label: 'false — Longer cutoffs (legacy tail+parabola norm)' },
                ]} />
            </FieldRow>

            <FieldRow label="PAO.SplitValence.Legacy" keyword="PAO.SplitValence.Legacy">
              <label className="toggle">
                <input type="checkbox"
                  checked={basis['PAO.SplitValence.Legacy'] === 'true'}
                  onChange={e => setField('basis', 'PAO.SplitValence.Legacy', e.target.checked ? 'true' : 'false')} />
                <span className="toggle-label">Recover legacy v4 split-valence settings</span>
              </label>
            </FieldRow>
          </div>

          {basis['PAO.SplitValence.Legacy'] === 'true' && (
            <FieldRow label="PAO.FixSplitTable" keyword="PAO.FixSplitTable">
              <label className="toggle">
                <input type="checkbox"
                  checked={basis['PAO.FixSplitTable'] === 'true'}
                  onChange={e => setField('basis', 'PAO.FixSplitTable', e.target.checked ? 'true' : 'false')} />
                <span className="toggle-label">Apply damping function to tail (forces table to zero)</span>
              </label>
            </FieldRow>
          )}

          {basis['PAO.BasisType'] === 'filteret' && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(15,23,42,0.4)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem' }}>
                Filteret Basis Generation Parameters
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                <FieldRow label="PAO.EnergyCutoff" keyword="PAO.EnergyCutoff">
                  <TextInput mono placeholder="20 Ry" value={basis['PAO.EnergyCutoff'] || '20 Ry'} onChange={v => setField('basis', 'PAO.EnergyCutoff', v)} />
                </FieldRow>
                <FieldRow label="PAO.EnergyPolCutoff" keyword="PAO.EnergyPolCutoff">
                  <TextInput mono placeholder="20 Ry" value={basis['PAO.EnergyPolCutoff'] || '20 Ry'} onChange={v => setField('basis', 'PAO.EnergyPolCutoff', v)} />
                </FieldRow>
                <FieldRow label="PAO.ContractionCutoff" keyword="PAO.ContractionCutoff">
                  <TextInput mono placeholder="0" value={basis['PAO.ContractionCutoff'] || '0'} onChange={v => setField('basis', 'PAO.ContractionCutoff', v)} />
                </FieldRow>
              </div>
            </div>
          )}
        </div>

        {/* Section 6.3.6: Polarization-Orbital Options */}
        <div style={{ margin: '0.6rem 0', padding: '0.6rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.4rem' }}>
            Polarization Orbitals (Section 6.3.6)
          </div>

          <div className="field-row-group">
            <FieldRow label="PAO.Polarization.NonPerturbative" keyword="PAO.Polarization.NonPerturbative">
              <SelectInput
                value={basis['PAO.Polarization.NonPerturbative'] === 'true' ? 'true' : 'false'}
                onChange={v => setField('basis', 'PAO.Polarization.NonPerturbative', v)}
                options={[
                  { value: 'false', label: 'false — Perturbative (electric field, standard)' },
                  { value: 'true',  label: 'true  — Non-perturbative (explicit shells)' },
                ]} />
            </FieldRow>

            <FieldRow label="Rc-Expansion-Factor" keyword="PAO.Polarization.Rc-Expansion-Factor">
              <TextInput mono placeholder="1.0" value={basis['PAO.Polarization.Rc-Expansion-Factor'] || '1.0'}
                onChange={v => setField('basis', 'PAO.Polarization.Rc-Expansion-Factor', v)} />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow label="NonPerturbative.Fallback" keyword="PAO.Polarization.NonPerturbative.Fallback">
              <label className="toggle">
                <input type="checkbox"
                  checked={basis['PAO.Polarization.NonPerturbative.Fallback'] !== 'false'}
                  onChange={e => setField('basis', 'PAO.Polarization.NonPerturbative.Fallback', e.target.checked ? 'true' : 'false')} />
                <span className="toggle-label">Auto-fallback for node conflicts (e.g. Ge 3d)</span>
              </label>
            </FieldRow>

            <FieldRow label="Per-Species Polarization" keyword="PAO.Polarization.Scheme">
              <label className="toggle">
                <input type="checkbox"
                  checked={!!basis.usePerSpeciesPolarization}
                  onChange={e => setField('basis', 'usePerSpeciesPolarization', e.target.checked)} />
                <span className="toggle-label">%block PAO.Polarization.Scheme</span>
              </label>
            </FieldRow>
          </div>

          {basis.usePerSpeciesPolarization && species.length > 0 && (
            <div style={{ marginTop: '0.5rem', padding: '0.4rem', background: 'rgba(15,23,42,0.4)', borderRadius: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                {species.map(sp => (
                  <div key={sp.idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ fontSize: '0.82rem', width: '35px' }}>{sp.label}:</strong>
                    <SelectInput
                      value={basis.speciesPolarizationSchemes?.[sp.label] || 'perturbative'}
                      onChange={v => {
                        const next = { ...(basis.speciesPolarizationSchemes || {}), [sp.label]: v };
                        setField('basis', 'speciesPolarizationSchemes', next);
                      }}
                      options={[
                        { value: 'perturbative',     label: 'perturbative' },
                        { value: 'non-perturbative', label: 'non-perturbative' },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Soft-Confinement & Graphviz Options */}
        <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.4rem' }}>
            Confinement, Sparsity &amp; Legacy Options (Sections 6.3.4 – 6.3.7)
          </div>

          <div className="field-row-group">
            <FieldRow label="PAO.SoftDefault" keyword="PAO.SoftDefault">
              <label className="toggle">
                <input type="checkbox"
                  checked={basis['PAO.SoftDefault'] !== 'false'}
                  onChange={e => setField('basis','PAO.SoftDefault', e.target.checked ? 'true' : 'false')} />
                <span className="toggle-label">Soft confinement (recommended in v5)</span>
              </label>
            </FieldRow>

            <FieldRow label="Write.Graphviz" keyword="Write.Graphviz">
              <SelectInput
                value={basis['Write.Graphviz'] || 'none'}
                onChange={v => setField('basis','Write.Graphviz', v)}
                options={['none', 'atom', 'orbital', 'atom+orbital']} />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow label="PAO.SoftInnerRadius" keyword="PAO.SoftInnerRadius">
              <TextInput mono placeholder="0.9" value={basis['PAO.SoftInnerRadius'] || ''}
                onChange={v => setField('basis','PAO.SoftInnerRadius', v)} />
            </FieldRow>

            <FieldRow label="PAO.SoftPotential" keyword="PAO.SoftPotential">
              <TextInput mono placeholder="40 Ry" value={basis['PAO.SoftPotential'] || ''}
                onChange={v => setField('basis','PAO.SoftPotential', v)} />
            </FieldRow>
          </div>

          <FieldRow label="User.Basis" keyword="User.Basis">
            <label className="toggle">
              <input type="checkbox"
                checked={basis['User.Basis'] === 'true'}
                onChange={e => setField('basis','User.Basis', e.target.checked ? 'true' : 'false')} />
              <span className="toggle-label">Read basis orbitals from <code>.ion</code> / <code>.ion.nc</code> files</span>
            </label>
          </FieldRow>
        </div>

        <div className="info-box" style={{ marginTop: '0.6rem' }}>
          <strong>Basis size guide:</strong> SZ=minimal, DZ=double-zeta, DZP=DZ+polarization (recommended),
          TZP=triple-zeta+polarization. In SIESTA v5, default <code>PAO.EnergyShift</code> is 0.01 Ry (~136 meV),
          <code>PAO.SoftDefault true</code> is active by default, and <code>PAO.SplitNormH</code> defaults to 0.45.
        </div>
      </div>

      {/* Pseudopotential info */}
      <div className="info-box">
        <strong>Pseudopotential search order:</strong> SIESTA looks for <code>Label.psf</code> →
        <code>Label.vps</code> → <code>Label.psml</code> in the current directory, then in paths
        from <code>$SIESTA_PS_PATH</code>. PSML from&nbsp;
        <a href="https://www.pseudo-dojo.org" target="_blank" rel="noreferrer">Pseudo-Dojo</a> recommended for SIESTA 5.
      </div>
    </div>
  );
}
