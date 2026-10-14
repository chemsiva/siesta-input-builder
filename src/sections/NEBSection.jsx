import { useState, lazy, Suspense } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { parseCIF } from '../parser/cifParser.js';
import { parseFDF } from '../parser/fdfParser.js';
import { interpolateNEBPath } from '../utils/nebInterpolator.js';
import { generateNEBSuite } from '../utils/nebSuiteGenerator.js';
import { SectionHeader } from '../components/FieldRow';
import { CrystalViewer } from '../components/CrystalViewer.jsx';

export function NEBSection() {
  const currentStructure = useFDFStore(s => s.structure);
  const baseState = useFDFStore(s => s);
  const pseudoSettings = useFDFStore(s => s.pseudoSettings || {});
  const setPseudoSettings = useFDFStore(s => s.setPseudoSettings);

  const detectedFiles = pseudoSettings.detectedFiles || [];
  const pseudoDir = pseudoSettings.directory || '';
  const pseudoFmt = pseudoSettings.format || 'psf';
  const pseudoMode = pseudoSettings.pathMode || 'filename';
  const [initialStruct, setInitialStruct] = useState(currentStructure);
  const [initialName, setInitialName] = useState('Current Structure');
  const [finalStruct, setFinalStruct] = useState(null);
  const [finalName, setFinalName] = useState('None (Upload required)');

  const [numImages, setNumImages] = useState(7);
  const [climb, setClimb] = useState(true);
  const [springK, setSpringK] = useState(0.1);
  const [fmax, setFmax] = useState(0.05);
  const [optimizer, setOptimizer] = useState('BFGS');

  const [nebResult, setNebResult] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [show3D, setShow3D] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  // Helper to extract clean chemical element symbol (e.g. "Pb1" -> "Pb", "C1" -> "C")
  const cleanElement = (raw) => {
    if (!raw) return '';
    const s = String(raw).replace(/[\d\+\-_]/g, '').trim();
    if (s.length >= 2) {
      return s[0].toUpperCase() + s[1].toLowerCase();
    }
    if (s.length >= 1) {
      return s[0].toUpperCase();
    }
    return s;
  };

  // Helper to match pseudopotential for an element
  const matchPseudo = (sym) => {
    const cleanSym = cleanElement(sym);
    if (!cleanSym) return '';
    const ext = `.${pseudoFmt}`;
    let matched = '';
    if (detectedFiles && detectedFiles.length > 0) {
      const exact = detectedFiles.find(f => f.toLowerCase() === `${cleanSym.toLowerCase()}${ext}`);
      if (exact) matched = exact;
      else {
        const prefix = detectedFiles.find(f => {
          const lower = f.toLowerCase();
          return (lower === `${cleanSym.toLowerCase()}${ext}` ||
                  lower.startsWith(cleanSym.toLowerCase() + '.') ||
                  lower.startsWith(cleanSym.toLowerCase() + '_') ||
                  lower.startsWith(cleanSym.toLowerCase() + '-')) && lower.endsWith(ext);
        });
        if (prefix) matched = prefix;
      }
    }
    if (!matched) matched = `${cleanSym}${ext}`;
    if (pseudoMode === 'full' && pseudoDir.trim()) {
      matched = `${pseudoDir.trim().replace(/\/+$/, '')}/${matched}`;
    }
    return matched;
  };

  const handleScanFolder = (e) => {
    const files = Array.from(e.target.files || []);
    const validPseudos = files
      .map(f => f.name)
      .filter(n => n.endsWith('.psf') || n.endsWith('.psml') || n.endsWith('.vps') || n.endsWith('.UPF'));
    
    let folderPath = pseudoDir;
    if (files.length > 0 && files[0].webkitRelativePath) {
      const parts = files[0].webkitRelativePath.split('/');
      if (parts.length > 1) folderPath = parts[0];
    }

    setPseudoSettings({
      detectedFiles: validPseudos,
      directory: folderPath || pseudoDir,
    });
    e.target.value = '';
  };

  const autoMatchAllNEBSpecies = () => {
    if (initialStruct && initialStruct.species) {
      const updatedSp = initialStruct.species.map(sp => ({
        ...sp,
        psfile: matchPseudo(sp.label),
      }));
      setInitialStruct({ ...initialStruct, species: updatedSp });
    }
    if (finalStruct && finalStruct.species) {
      const updatedSp = finalStruct.species.map(sp => ({
        ...sp,
        psfile: matchPseudo(sp.label),
      }));
      setFinalStruct({ ...finalStruct, species: updatedSp });
    }
  };

  const allReactionSpecies = Array.from(new Set([
    ...(initialStruct?.species || []).map(sp => cleanElement(sp.label)),
    ...(finalStruct?.species || []).map(sp => cleanElement(sp.label)),
    ...(initialStruct?.atoms || []).map(a => cleanElement(a.element || a.label)),
    ...(finalStruct?.atoms || []).map(a => cleanElement(a.element || a.label)),
  ])).filter(Boolean);


  // File parsers for Initial / Final
  const handleLoadInitialFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      try {
        const parsed = file.name.endsWith('.cif') ? parseCIF(text) : parseFDF(text);
        setInitialStruct(parsed.structure);
        setInitialName(file.name);
        setNebResult(null);
        setErrorMsg('');
      } catch (err) {
        setErrorMsg(`Failed to parse Initial file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadFinalFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      try {
        const parsed = file.name.endsWith('.cif') ? parseCIF(text) : parseFDF(text);
        setFinalStruct(parsed.structure);
        setFinalName(file.name);
        setNebResult(null);
        setErrorMsg('');
      } catch (err) {
        setErrorMsg(`Failed to parse Final file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInterpolate = () => {
    setErrorMsg('');
    try {
      if (!initialStruct || !finalStruct) {
        throw new Error('Please specify both Initial and Final state structures.');
      }
      const res = interpolateNEBPath(initialStruct, finalStruct, numImages);
      setNebResult(res);
      setActiveImageIdx(0);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDownloadZip = async () => {
    if (!nebResult) return;
    setIsGeneratingZip(true);
    try {
      const zipBlob = await generateNEBSuite(baseState, nebResult, {
        climb,
        springK,
        fmax,
        optimizer,
        pseudoSettings,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `siesta_cineb_${baseState.system.SystemLabel || 'neb'}.zip`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('Error building CI-NEB ZIP: ' + err.message);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const activeStructure = nebResult ? nebResult.images[activeImageIdx]?.structure : initialStruct;

  return (
    <div className="section-pane">
      <SectionHeader title="Climbing Image NEB (CI-NEB)" />
      <p className="section-desc">
        Calculate minimum energy reaction pathways, transition states (TS), and activation energy barriers ($E_a$) in SIESTA.
      </p>

      {/* State Loaders */}
      <div className="slab-tools-grid" style={{ marginBottom: '1rem' }}>
        <div className="slab-tool-card">
          <div className="slab-tool-title">🟢 Initial State (Reactant)</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
            {initialName} ({initialStruct?.atoms?.length || 0} atoms)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setInitialStruct(currentStructure); setInitialName('Current Structure'); setNebResult(null); }}>
              Use Current
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              Upload .cif / .fdf
              <input type="file" accept=".cif,.fdf,.txt" style={{ display: 'none' }} onChange={handleLoadInitialFile} />
            </label>
          </div>
        </div>

        <div className="slab-tool-card">
          <div className="slab-tool-title">🔴 Final State (Product)</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
            {finalName} ({finalStruct?.atoms?.length || 0} atoms)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              Upload .cif / .fdf
              <input type="file" accept=".cif,.fdf,.txt" style={{ display: 'none' }} onChange={handleLoadFinalFile} />
            </label>
          </div>
        </div>
      </div>
      {/* CI-NEB Pseudopotential Setup & Verification */}
      <div className="subsection" style={{ marginBottom: '1rem' }}>
        <div className="subsection-title">
          📁 Pseudopotential Directory &amp; Verification for NEB
        </div>
        <p className="subsection-desc">
          NEB calculations require verified pseudopotentials for all images. Set your folder once to eliminate missing pseudopotential errors.
        </p>
        <div className="slab-tools-grid">
          <div className="slab-tool-card">
            <div className="slab-tool-title">Pseudopotential Folder / Path</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
              <input
                type="text"
                className="input mono"
                placeholder="e.g. /scratch/pseudos or ./pseudos"
                value={pseudoDir}
                onChange={e => setPseudoSettings({ directory: e.target.value })}
              />
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
            </div>
            {detectedFiles.length > 0 && (
              <div className="hint" style={{ color: 'var(--success)', marginTop: '0.3rem', fontWeight: 600 }}>
                ✓ Scanned {detectedFiles.length} pseudopotential files in folder!
              </div>
            )}
          </div>

          <div className="slab-tool-card">
            <div className="slab-tool-title">Preferences &amp; Auto-Link</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <select
                className="input select"
                style={{ width: '90px' }}
                value={pseudoFmt}
                onChange={e => setPseudoSettings({ format: e.target.value })}>
                <option value="psf">.psf (ASCII)</option>
                <option value="psml">.psml (XML)</option>
                <option value="vps">.vps (Binary)</option>
              </select>

              <select
                className="input select"
                style={{ width: '130px' }}
                value={pseudoMode}
                onChange={e => setPseudoSettings({ pathMode: e.target.value })}>
                <option value="filename">Filename only</option>
                <option value="full">Include full path</option>
              </select>

              <button
                className="btn btn-primary btn-sm"
                onClick={autoMatchAllNEBSpecies}
                title="Auto-match pseudopotentials for all elements in reaction">
                ⚡ Auto-Link All
              </button>
            </div>
            <span className="hint" style={{ marginTop: '0.3rem', display: 'block' }}>
              Sets <code>SIESTA_PS_PATH</code> and auto-symlinks pseudos in <code>cineb_siesta_driver.py</code>.
            </span>
          </div>
        </div>

        {allReactionSpecies.length > 0 && (
          <div style={{ marginTop: '0.8rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>
              Reaction Element Status:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {allReactionSpecies.map(sp => {
                const cleanSym = cleanElement(sp);
                const matchedFile = matchPseudo(cleanSym);
                const ext = `.${pseudoFmt}`;
                const isFound = detectedFiles.length === 0 || detectedFiles.some(f => {
                  const lower = f.toLowerCase();
                  return (lower === `${cleanSym.toLowerCase()}${ext}` ||
                          lower.startsWith(cleanSym.toLowerCase() + '.') ||
                          lower.startsWith(cleanSym.toLowerCase() + '_') ||
                          lower.startsWith(cleanSym.toLowerCase() + '-')) && lower.endsWith(ext);
                });
                return (
                  <span
                    key={sp}
                    className="legend-chip"
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: isFound ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                      border: `1px solid ${isFound ? 'var(--success)' : 'var(--warning)'}`,
                      color: isFound ? 'var(--success)' : 'var(--warning)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                    {isFound ? '✓' : '⚠️'} {cleanSym}: {matchedFile.split('/').pop()}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>


      {errorMsg && (
        <div className="sidebar-errors" style={{ marginBottom: '1rem' }}>
          <div className="error-header">⚠️ Configuration Error</div>
          <div>{errorMsg}</div>
        </div>
      )}

      {/* NEB Parameters */}
      <div className="subsection">
        <div className="subsection-title">CI-NEB Calculation Parameters</div>
        <div className="field-row-group">
          <div className="field-row">
            <span className="field-label">Number of Images:</span>
            <select
              className="input select"
              value={numImages}
              onChange={e => setNumImages(parseInt(e.target.value))}>
              <option value="5">5 images (quick)</option>
              <option value="7">7 images (standard)</option>
              <option value="9">9 images (recommended)</option>
              <option value="11">11 images (complex paths)</option>
            </select>
          </div>

          <div className="field-row">
            <span className="field-label">Spring Constant k (eV/Å):</span>
            <input
              type="number"
              step="0.05"
              className="input mono"
              value={springK}
              onChange={e => setSpringK(parseFloat(e.target.value) || 0.1)}
            />
          </div>
        </div>

        <div className="field-row-group">
          <div className="field-row">
            <span className="field-label">Optimizer:</span>
            <select
              className="input select"
              value={optimizer}
              onChange={e => setOptimizer(e.target.value)}>
              <option value="BFGS">BFGS (quasi-Newton)</option>
              <option value="FIRE">FIRE (Fast Inertial)</option>
            </select>
          </div>

          <div className="field-row">
            <span className="field-label">Force Tol fmax (eV/Å):</span>
            <input
              type="number"
              step="0.01"
              className="input mono"
              value={fmax}
              onChange={e => setFmax(parseFloat(e.target.value) || 0.05)}
            />
          </div>
        </div>

        <div className="field-row" style={{ marginTop: '0.4rem' }}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={climb}
              onChange={e => setClimb(e.target.checked)}
            />
            <span className="toggle-label">
              <strong>Climbing Image (CI-NEB)</strong> — Drives highest-energy image straight to the true transition state saddle point.
            </span>
          </label>
        </div>

        <div style={{ marginTop: '0.8rem' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '0.4rem 1.2rem', fontWeight: 600 }}
            onClick={handleInterpolate}>
            ⚡ Interpolate Reaction Pathway
          </button>
        </div>
      </div>

      {/* Pathway Interpolation Results */}
      {nebResult && (
        <div className="subsection">
          <div className="subsection-title">
            Pathway Preview: Image {activeImageIdx} of {numImages - 1}
            <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>
              Max Displacement: {nebResult.maxDisplacement} Å
            </span>
          </div>

          {/* Slider */}
          <div style={{ margin: '0.8rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              <span>Initial (Reactant)</span>
              <span>Transition State Region</span>
              <span>Final (Product)</span>
            </div>
            <input
              type="range"
              min="0"
              max={numImages - 1}
              step="1"
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              value={activeImageIdx}
              onChange={e => setActiveImageIdx(parseInt(e.target.value))}
            />
            <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '0.3rem' }}>
              {activeImageIdx === 0 && '🟢 Image 00: Initial State'}
              {activeImageIdx === numImages - 1 && `🔴 Image ${String(numImages - 1).padStart(2, '0')}: Final State`}
              {activeImageIdx > 0 && activeImageIdx < numImages - 1 && `🟡 Image ${String(activeImageIdx).padStart(2, '0')}: Intermediate Image (t = ${(activeImageIdx / (numImages - 1)).toFixed(2)})`}
            </div>
          </div>

          {/* 3D Visualizer Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.6rem 0' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Inspect 3D structure for Image {activeImageIdx}:
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShow3D(!show3D)}>
              {show3D ? '✕ Hide 3D View' : '👁️ View Image in 3D'}
            </button>
          </div>

          {show3D && activeStructure && (
            <CrystalViewer structure={activeStructure} />
          )}

          {/* Download NEB Suite Button */}
          <div style={{ marginTop: '1.2rem', padding: '0.8rem', background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.88rem' }}>📦 Download CI-NEB Suite</strong>
                <span className="hint">Includes all {numImages} .fdf files + ASE CI-NEB driver script + barrier plotter + run_cineb.sh</span>
              </div>
              <button
                className="btn btn-primary"
                disabled={isGeneratingZip}
                style={{ padding: '0.5rem 1.2rem', fontSize: '0.88rem', fontWeight: 'bold' }}
                onClick={handleDownloadZip}>
                {isGeneratingZip ? 'Generating Zip...' : '⬇ Download CI-NEB Suite (.zip)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Guide */}
      <div className="info-box" style={{ marginTop: '1rem' }}>
        <strong>How SIESTA CI-NEB Works:</strong>
        <p style={{ marginTop: '0.3rem' }}>
          1. <strong>Linear / Minimum-Image Interpolation:</strong> Generates initial trial coordinates along the reaction pathway, wrapping through periodic boundary conditions.<br />
          2. <strong>Climbing Image (CI):</strong> The highest-energy image feels inverted spring forces along the tangent, driving it to the saddle point without extra function calls.<br />
          3. <strong>Execution:</strong> Run <code>bash run_cineb.sh</code> on your workstation or HPC cluster. It uses ASE's <code>Siesta</code> calculator to optimize the band and saves the reaction barrier plot.
        </p>
      </div>
    </div>
  );
}
