import React, { useState, useRef, useMemo } from 'react';
import { parseEIG, parseKP, computeEig2DOS } from '../parser/eigParser.js';
import { parsePDOS, computePDOSCurves } from '../parser/pdosParser.js';
import { DOSChart, PALETTE } from './DOSChart.jsx';

/**
 * Auto-detect file format from text content and filename.
 */
function detectFormat(name, text) {
  const lowerName = name.toLowerCase();
  const trimmed = text.trim();

  if (lowerName.endsWith('.pdos') || lowerName.endsWith('.pdos.xml') || trimmed.includes('<pdos>')) {
    return 'PDOS';
  }

  if (lowerName.endsWith('.kp')) {
    return 'KP';
  }

  // Check EIG signature: line 1 has 1 float, line 2 has 3 integers (nband, nspin, nk)
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2) {
    const l1 = parseFloat(lines[0].trim());
    const l2Parts = lines[1].trim().split(/\s+/);
    if (!isNaN(l1) && l2Parts.length >= 3 && !isNaN(parseInt(l2Parts[0], 10))) {
      return 'EIG';
    }
  }

  if (lowerName.endsWith('.eig')) {
    return 'EIG';
  }

  if (lowerName.endsWith('.dos') || lowerName.endsWith('.dat')) {
    return 'DOS_RAW';
  }

  return 'UNKNOWN';
}

export function DOSPlotterSuite() {
  const fileInputRef = useRef(null);
  const kpInputRef = useRef(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [rawText, setRawText] = useState('');
  const [kpData, setKpData] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Parsed intermediate data
  const [parsedEig, setParsedEig] = useState(null);
  const [parsedPdos, setParsedPdos] = useState(null);

  // Eig2DOS / PDOS Parameters
  const [emin, setEmin] = useState('-6.0');
  const [emax, setEmax] = useState('6.0');
  const [npts, setNpts] = useState('1000');
  const [smear, setSmear] = useState('0.100');
  const [broadening, setBroadening] = useState('gaussian');
  const [shiftEf, setShiftEf] = useState(true);
  const [minBand, setMinBand] = useState('1');
  const [maxBand, setMaxBand] = useState('');

  // PDOS filters
  const [selectedSpecies, setSelectedSpecies] = useState({});
  const [selectedL, setSelectedL] = useState({ s: true, p: true, d: true, f: true });
  const [includeTotalPdos, setIncludeTotalPdos] = useState(true);

  // Plot state
  const [plotResult, setPlotResult] = useState(null);

  // 1. Handle file upload & format auto-detection
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg(`Reading ${file.name}...`);
    setPlotResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        setUploadedFile(file);
        setRawText(text);

        const format = detectFormat(file.name, text);
        setDetectedFormat(format);

        if (format === 'EIG') {
          const eig = parseEIG(text);
          setParsedEig(eig);
          setParsedPdos(null);
          setMaxBand(String(eig.nband));
          setStatusMsg(`✓ Auto-detected SIESTA Eigenvalues (.EIG): ${eig.nk} k-points, ${eig.nband} bands, Ef = ${eig.ef.toFixed(4)} eV.`);
        } else if (format === 'PDOS') {
          const pdos = parsePDOS(text);
          setParsedPdos(pdos);
          setParsedEig(null);

          // Initialize species toggles
          const initSp = {};
          pdos.speciesList.forEach(sp => { initSp[sp] = true; });
          setSelectedSpecies(initSp);

          setStatusMsg(`✓ Auto-detected SIESTA Projected DOS (.PDOS): ${pdos.norbitals} orbitals, species [${pdos.speciesList.join(', ')}], Ef = ${pdos.ef.toFixed(4)} eV.`);
        } else if (format === 'KP') {
          const kp = parseKP(text);
          setKpData(kp);
          setStatusMsg(`✓ Loaded ${kp.nk} k-point weights from ${file.name}.`);
        } else {
          setErrorMsg(`Unrecognized format for ${file.name}. Please upload a .EIG, .PDOS, or .PDOS.xml file.`);
        }
      } catch (err) {
        setErrorMsg(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Optional KP file upload
  const handleKpUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const kp = parseKP(evt.target.result);
        setKpData(kp);
        setStatusMsg(`✓ Applied ${kp.nk} k-point weights from ${file.name}`);
      } catch (err) {
        setErrorMsg(`Failed to parse KP file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // 2. Compute DOS / PDOS Graph
  const handleCalculatePlot = () => {
    setErrorMsg('');

    try {
      if (detectedFormat === 'EIG' && parsedEig) {
        const res = computeEig2DOS({
          eigData: parsedEig,
          kpData,
          emin: parseFloat(emin),
          emax: parseFloat(emax),
          npts: parseInt(npts, 10),
          smear: parseFloat(smear),
          broadening,
          shiftEf,
          minBand: parseInt(minBand, 10) || 1,
          maxBand: parseInt(maxBand, 10) || parsedEig.nband,
        });

        const seriesList = [];
        if (res.nspin === 2) {
          seriesList.push({
            name: 'Total DOS (↑ Spin Up)',
            color: PALETTE[0],
            dataUp: res.dosUp,
            dataDown: res.dosDown,
          });
        } else {
          seriesList.push({
            name: 'Total DOS',
            color: PALETTE[0],
            dataUp: res.totalDos,
          });
        }

        setPlotResult({
          type: 'EIG',
          title: `Total Density of States (Eig2DOS)`,
          energies: res.energies,
          series: seriesList,
          fermiEnergy: res.ef,
          isShifted: res.shifted,
          isSpinPol: res.nspin === 2,
        });
      } else if (detectedFormat === 'PDOS' && parsedPdos) {
        const activeSpList = Object.entries(selectedSpecies)
          .filter(([, v]) => v)
          .map(([k]) => k);

        const lMap = { s: 0, p: 1, d: 2, f: 3 };
        const activeLList = Object.entries(selectedL)
          .filter(([, v]) => v)
          .map(([k]) => lMap[k])
          .filter(v => v !== undefined);

        const res = computePDOSCurves({
          pdosData: parsedPdos,
          emin: parseFloat(emin),
          emax: parseFloat(emax),
          shiftEf,
          selectedSpecies: activeSpList.length > 0 ? activeSpList : null,
          selectedL: activeLList.length > 0 ? activeLList : null,
        });

        const seriesList = [];
        let colorIdx = 0;

        if (includeTotalPdos) {
          seriesList.push({
            name: 'Total PDOS',
            color: PALETTE[0],
            dataUp: res.total,
            dataDown: res.totalDown,
          });
          colorIdx++;
        }

        // Add curves for each active species
        activeSpList.forEach((sp) => {
          if (res.bySpecies[sp]) {
            seriesList.push({
              name: `${sp} (All orbitals)`,
              color: PALETTE[colorIdx % PALETTE.length],
              dataUp: res.bySpecies[sp],
              dataDown: res.bySpeciesDown ? res.bySpeciesDown[sp] : null,
            });
            colorIdx++;
          }
        });

        // Add curves for active l
        Object.keys(selectedL).forEach((lKey) => {
          if (selectedL[lKey] && res.byL[lKey] && Math.max(...res.byL[lKey]) > 0.0001) {
            seriesList.push({
              name: `L = ${lKey} orbitals`,
              color: PALETTE[colorIdx % PALETTE.length],
              dataUp: res.byL[lKey],
            });
            colorIdx++;
          }
        });

        setPlotResult({
          type: 'PDOS',
          title: `Projected Density of States (PDOS)`,
          energies: res.energies,
          series: seriesList,
          fermiEnergy: res.ef,
          isShifted: res.shifted,
          isSpinPol: res.nspin === 2,
        });
      }
    } catch (err) {
      setErrorMsg(`Plot computation failed: ${err.message}`);
    }
  };

  return (
    <div className="dos-plotter-suite" style={{ marginTop: '1rem' }}>
      {/* Upload & Auto-Detection Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📂</span> DOS / PDOS File Upload & Auto-Detection
            </h3>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
              Upload your calculation output: <strong>.EIG</strong> (Total DOS via Eig2DOS), <strong>.PDOS</strong> / <strong>.PDOS.xml</strong> (Projected DOS), or optional <strong>.KP</strong> (k-weights).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".EIG,.eig,.PDOS,.pdos,.PDOS.xml,.pdos.xml,.dos,.dat"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              title="Upload .EIG or .PDOS file">
              📁 Choose .EIG or .PDOS File
            </button>

            {detectedFormat === 'EIG' && (
              <>
                <input
                  ref={kpInputRef}
                  type="file"
                  accept=".KP,.kp"
                  style={{ display: 'none' }}
                  onChange={handleKpUpload}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => kpInputRef.current?.click()}
                  title="Upload optional .KP file for k-point weights">
                  {kpData ? '✓ KP Weights Loaded' : '📎 Add .KP File'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status / Detection Badge */}
        {statusMsg && (
          <div style={{
            marginTop: '0.8rem',
            padding: '0.5rem 0.8rem',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--success, #10b981)',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: 'var(--success, #10b981)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>⚡</span>
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: '0.8rem',
            padding: '0.5rem 0.8rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--error, #ef4444)',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: 'var(--error, #ef4444)',
          }}>
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      {/* Parameter Configuration Dialog / Card (Eig2DOS options) */}
      {(parsedEig || parsedPdos) && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--accent, #38bdf8)',
          borderRadius: '8px',
          padding: '1.1rem',
          marginBottom: '1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.9rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.6rem',
          }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚙️</span> Choose Calculation & Plot Parameters ({detectedFormat === 'EIG' ? 'Eig2DOS Keywords' : 'PDOS Decomposition'})
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              Fermi Energy E<sub>F</sub> = {(parsedEig ? parsedEig.ef : parsedPdos.ef).toFixed(4)} eV
            </span>
          </div>

          {/* Grid of parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem' }}>
            {/* Energy Window */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                Energy Window (E_min to E_max, eV)
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.5"
                  className="input-text"
                  style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  value={emin}
                  onChange={e => setEmin(e.target.value)}
                  placeholder="-6.0"
                />
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>to</span>
                <input
                  type="number"
                  step="0.5"
                  className="input-text"
                  style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  value={emax}
                  onChange={e => setEmax(e.target.value)}
                  placeholder="6.0"
                />
              </div>
            </div>

            {/* Points count -n */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                Number of Energy Points (-n)
              </label>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="100"
                  className="input-text"
                  style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                  value={npts}
                  onChange={e => setNpts(e.target.value)}
                  placeholder="1000"
                />
                {['500', '1000', '2000'].map(val => (
                  <button
                    key={val}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => setNpts(val)}>
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Peak Width / Smearing -s (only for EIG) */}
            {detectedFormat === 'EIG' && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Broadening / Smearing (-s, eV)
                </label>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.02"
                    className="input-text"
                    style={{ width: '85px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    value={smear}
                    onChange={e => setSmear(e.target.value)}
                    placeholder="0.100"
                  />
                  <select
                    className="input-select"
                    style={{ padding: '0.3rem 0.4rem', fontSize: '0.78rem' }}
                    value={broadening}
                    onChange={e => setBroadening(e.target.value)}>
                    <option value="gaussian">Gaussian</option>
                    <option value="lorentzian">Lorentzian (-l)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Band selection (only for EIG) */}
            {detectedFormat === 'EIG' && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Band Range (-b min to -B max)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="input-text"
                    style={{ width: '70px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    value={minBand}
                    onChange={e => setMinBand(e.target.value)}
                    placeholder="1"
                  />
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>to</span>
                  <input
                    type="number"
                    className="input-text"
                    style={{ width: '70px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    value={maxBand}
                    onChange={e => setMaxBand(e.target.value)}
                    placeholder={String(parsedEig?.nband || '')}
                  />
                </div>
              </div>
            )}

            {/* Fermi Level Alignment Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.4rem' }}>
              <label className="toggle" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={shiftEf}
                  onChange={e => setShiftEf(e.target.checked)}
                />
                <span className="toggle-label" style={{ fontSize: '0.8rem' }}>
                  Shift E<sub>F</sub> to 0.0 eV (<code>-f</code> / <code>-F</code>)
                </span>
              </label>
            </div>
          </div>

          {/* PDOS specific decomposition filters */}
          {detectedFormat === 'PDOS' && parsedPdos && (
            <div style={{ marginTop: '0.9rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginRight: '0.6rem' }}>
                  Filter by Chemical Species:
                </span>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {parsedPdos.speciesList.map(sp => (
                    <label
                      key={sp}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.45rem',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}>
                      <input
                        type="checkbox"
                        checked={!!selectedSpecies[sp]}
                        onChange={e => setSelectedSpecies({ ...selectedSpecies, [sp]: e.target.checked })}
                      />
                      <strong>{sp}</strong>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginRight: '0.6rem' }}>
                    Angular Momentum (l):
                  </span>
                  {['s', 'p', 'd', 'f'].map(lKey => (
                    <label
                      key={lKey}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        marginRight: '0.5rem',
                        cursor: 'pointer',
                      }}>
                      <input
                        type="checkbox"
                        checked={!!selectedL[lKey]}
                        onChange={e => setSelectedL({ ...selectedL, [lKey]: e.target.checked })}
                      />
                      <span>{lKey}</span>
                    </label>
                  ))}
                </div>

                <label className="toggle" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeTotalPdos}
                    onChange={e => setIncludeTotalPdos(e.target.checked)}
                  />
                  <span className="toggle-label" style={{ fontSize: '0.78rem' }}>
                    Overlay Total PDOS
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Action button */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem', fontWeight: 600 }}
              onClick={handleCalculatePlot}>
              {plotResult ? '🔄 Update Plot with Parameters' : '🚀 Generate DOS / PDOS Plot'}
            </button>
          </div>
        </div>
      )}

      {/* Render Chart when available */}
      {plotResult && (
        <DOSChart
          title={plotResult.title}
          energies={plotResult.energies}
          series={plotResult.series}
          fermiEnergy={plotResult.fermiEnergy}
          isShifted={plotResult.isShifted}
          isSpinPol={plotResult.isSpinPol}
        />
      )}
    </div>
  );
}
