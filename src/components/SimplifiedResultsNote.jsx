import { useState } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { getElementInfo } from '../utils/elementData.js';

export function SimplifiedResultsNote({ outData, onClear }) {
  const [activeTab, setActiveTab] = useState('note'); // 'note', 'energies', 'forces', 'coords', 'charges', 'timings'
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState('');

  const structure = useFDFStore(s => s.structure);
  const setField = useFDFStore(s => s.setField);
  const setActiveSection = useFDFStore(s => s.setActiveSection);

  if (!outData) return null;

  // Copy Note to Clipboard
  const handleCopyNote = async () => {
    try {
      await navigator.clipboard.writeText(outData.simplifiedNote);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  // Download Note as text/markdown
  const handleDownloadNote = () => {
    const blob = new Blob([outData.simplifiedNote], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outData.systemLabel || 'siesta'}_calculation_note.md`;
    a.click();
  };

  // Export JSON
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(outData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outData.systemLabel || 'siesta'}_results_extracted.json`;
    a.click();
  };

  // Apply Relaxed Geometry to Section 2 Structure
  const handleApplyToStructure = () => {
    if (!outData.relaxedCoordinates || outData.relaxedCoordinates.length === 0) {
      setApplyFeedback('No relaxed coordinates found in this output file.');
      return;
    }

    // Update Lattice Vectors if present
    if (outData.cellVectors && outData.cellVectors.length === 3) {
      setField('structure', 'LatticeVectors', outData.cellVectors);
    }

    // Update Coordinates format
    const format = outData.coordsFormat === 'fractional' ? 'Fractional' : 'NotScaledCartesianAng';
    setField('structure', 'AtomicCoordinatesFormat', format);

    // Update Atoms array
    const updatedAtoms = outData.relaxedCoordinates.map((c, idx) => ({
      x: c.x.toFixed(6),
      y: c.y.toFixed(6),
      z: c.z.toFixed(6),
      species: String(c.speciesIndex || 1),
      label: c.symbol || getElementInfo(c.symbol)?.sym || 'X',
    }));

    setField('structure', 'atoms', updatedAtoms);
    setField('system', 'NumberOfAtoms', String(updatedAtoms.length));

    setApplyFeedback(`Successfully applied ${updatedAtoms.length} relaxed atom coordinates to Section 2 (Structure)!`);
    setTimeout(() => setApplyFeedback(''), 4000);
  };

  const eTot = outData.finalEnergyTot !== null ? `${outData.finalEnergyTot.toFixed(4)} eV` : 'N/A';
  const ef = outData.fermiEnergy !== null ? `${outData.fermiEnergy.toFixed(3)} eV` : 'N/A';
  const fMax = outData.maxForce !== null ? `${outData.maxForce.toFixed(4)} eV/Å` : 'N/A';
  const pGpa = outData.pressureSolidGPa !== null ? `${outData.pressureSolidGPa.toFixed(3)} GPa` : 'N/A';
  const vol = outData.cellVolume !== null ? `${outData.cellVolume.toFixed(2)} Å³` : 'N/A';
  const wall = outData.wallTimeSec !== null ? `${outData.wallTimeSec.toFixed(2)} s` : 'N/A';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '1.2rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    }}>
      {/* Top Banner: Status, System Title & Action Buttons */}
      <div style={{
        background: 'var(--surface2)',
        padding: '0.8rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: outData.normalExit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: outData.normalExit ? '#22c55e' : '#f59e0b',
            border: `1px solid ${outData.normalExit ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}>
            {outData.normalExit ? 'Normal Completion (0_NORMAL_EXIT)' : 'Running / Warning'}
          </span>
          <strong style={{ fontSize: '0.92rem', color: 'var(--fg)' }}>
            {outData.systemName || outData.systemLabel || 'SIESTA Calculation'}{' '}
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.8rem' }}>
              ({outData.numberOfAtoms || outData.relaxedCoordinates.length || '?'} atoms)
            </span>
          </strong>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            onClick={handleCopyNote}
            title="Copy Simplified Note to clipboard (Markdown)">
            {copyFeedback ? 'Copied Note!' : 'Copy Note'}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={handleDownloadNote}
            title="Download Simplified Note as Markdown file">
            Save Note (.md)
          </button>
          {outData.relaxedCoordinates.length > 0 && (
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={handleApplyToStructure}
              style={{ color: 'var(--accent)', fontWeight: 600 }}
              title="Apply final relaxed coordinates and cell vectors into Section 2">
              Apply to Structure
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={handleExportJSON}
            title="Export all extracted features to JSON">
            Export JSON
          </button>
          {onClear && (
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              style={{ color: 'var(--error, #ef4444)' }}
              onClick={onClear}
              title="Clear loaded result">
              Clear
            </button>
          )}
        </div>
      </div>

      {applyFeedback && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          borderBottom: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e',
          padding: '0.4rem 1rem',
          fontSize: '0.78rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{applyFeedback}</span>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            onClick={() => setActiveSection('structure')}
            style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
            Go to Structure &amp; 3D Viewer &rarr;
          </button>
        </div>
      )}

      {/* Primary Key Metric Tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.6rem',
        padding: '0.8rem 1rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Total Energy (E_tot)</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--success, #10b981)', fontFamily: 'monospace' }}>
            {eTot}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Fermi Energy (E_F)</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'monospace' }}>
            {ef}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Max Force (|F_max|)</div>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: outData.isRelaxed ? '#22c55e' : '#f59e0b',
            fontFamily: 'monospace',
          }}>
            {fMax}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Pressure (P)</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'monospace' }}>
            {pGpa}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Cell Volume (Ω)</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'monospace' }}>
            {vol}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', padding: '0.5rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Wall Clock Time</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
            {wall}
          </div>
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.35rem',
        padding: '0.5rem 1rem',
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'note' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('note')}>
          Simplified Note
        </button>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'energies' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('energies')}>
          Energy Breakdown ({outData.energyDecomp.total !== null ? '13 Terms' : 'Core'})
        </button>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'forces' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('forces')}>
          Forces &amp; Stress ({outData.forces.length} atoms)
        </button>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'coords' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('coords')}>
          Relaxed Coordinates ({outData.relaxedCoordinates.length})
        </button>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'charges' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('charges')}>
          Charges &amp; Spin
        </button>
        <button
          type="button"
          className={`btn btn-xs ${activeTab === 'timings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('timings')}>
          Timing &amp; CPU Profile
        </button>
      </div>

      {/* Tab 1: Simplified Note View */}
      {activeTab === 'note' && (
        <div style={{ padding: '1rem' }}>
          <div style={{
            background: '#090d16',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '1rem 1.2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            color: 'var(--fg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>
                SIESTA Executive Calculation Summary
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                SIESTA {outData.version || '5.x'} &bull; {outData.startTime || 'Timestamp recorded'}
              </span>
            </div>

            {/* Structured Executive Bullet Points */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Box A: Ground State Energetics */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '6px' }}>
                  1. Energetics &amp; Fermi Level
                </strong>
                <div>&bull; Final Total Energy: <code>{eTot}</code></div>
                {outData.numberOfAtoms && outData.finalEnergyTot && (
                  <div>&bull; Energy per Atom: <code>{(outData.finalEnergyTot / outData.numberOfAtoms).toFixed(4)} eV/atom</code></div>
                )}
                <div>&bull; Fermi Level (E_F): <code>{ef}</code></div>
                {outData.workFunction !== null && (
                  <div>&bull; Work Function (Φ = V_vac - E_F): <code style={{ color: '#22c55e' }}>{outData.workFunction.toFixed(3)} eV</code></div>
                )}
              </div>

              {/* Box B: Geometry Relaxation & Mechanics */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '6px' }}>
                  2. Geometry Relaxation &amp; Mechanics
                </strong>
                <div>&bull; Max Residual Force: <code style={{ color: outData.isRelaxed ? '#22c55e' : '#f59e0b' }}>{fMax}</code></div>
                <div>&bull; Equilibrium Status: {outData.isRelaxed ? 'Equilibrium Reached (≤ 0.04 eV/Å)' : 'Forces Exceed 0.04 eV/Å Tolerance'}</div>
                <div>&bull; Cell Volume: <code>{vol}</code></div>
                <div>&bull; Hydrostatic Pressure: <code>{pGpa}</code> ({outData.pressureSolidKbar?.toFixed(1) || '?'} kBar)</div>
              </div>

              {/* Box C: Electronic & Magnetic State */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '6px' }}>
                  3. Electronic &amp; Magnetic State
                </strong>
                <div>&bull; Spin Configuration: <span style={{ textTransform: 'capitalize' }}>{outData.spinConfig}</span></div>
                {outData.spinMoment && (
                  <div>&bull; Total Magnetic Moment: <code style={{ color: '#f59e0b' }}>{outData.spinMoment.total.toFixed(3)} μ_B</code></div>
                )}
                {outData.electricDipoleDebye && (
                  <div>&bull; Net Electric Dipole: <code>{outData.electricDipoleDebye.total.toFixed(3)} Debye</code></div>
                )}
                {outData.mullikenPop.length > 0 && (
                  <div>&bull; Mulliken Partitioning: <code>{outData.mullikenPop.length} atoms populated</code></div>
                )}
              </div>

              {/* Box D: Computational Performance */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                <strong style={{ color: '#22c55e', display: 'block', marginBottom: '6px' }}>
                  4. Performance &amp; Execution
                </strong>
                <div>&bull; Elapsed Wall Time: <code>{wall}</code></div>
                <div>&bull; Real-Space Mesh Cutoff: <code>{outData.meshCutoff || 'N/A'}</code></div>
                <div>&bull; Total SCF Iterations: <code>{outData.totalScfIterations || outData.scfCycles.length}</code></div>
                <div>&bull; Termination: {outData.normalExit ? '0_NORMAL_EXIT (Success)' : 'Incomplete'}</div>
              </div>
            </div>

            {/* Raw Markdown Output (Copyable) */}
            <div style={{ marginTop: '0.8rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px' }}>
                Copyable Markdown Note (ready to paste into lab book or paper drafts):
              </div>
              <textarea
                readOnly
                value={outData.simplifiedNote}
                style={{
                  width: '100%',
                  height: '140px',
                  background: '#040711',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.5rem',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  color: 'var(--fg)',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full Energy Breakdown */}
      {activeTab === 'energies' && (
        <div style={{ padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>Energy Component</th>
                <th style={{ padding: '6px 10px' }}>Physical Meaning</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Value (eV)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Total Energy (E_tot)', key: 'total', desc: 'Final total self-consistent ground state energy', val: outData.finalEnergyTot, highlight: true },
                { name: 'Kohn-Sham Energy (E_KS)', key: 'eKs', desc: 'Expectation value of the Kohn-Sham Hamiltonian', val: outData.finalEnergyKS },
                { name: 'Band Structure (E_bs)', key: 'bandStruct', desc: 'Sum of occupied eigenvalue energies: Tr[H * ρ]', val: outData.energyDecomp.bandStruct },
                { name: 'Kinetic Energy (T)', key: 'kinetic', desc: 'Electronic kinetic energy: Tr[T * ρ]', val: outData.energyDecomp.kinetic },
                { name: 'Hartree Energy (V_H)', key: 'hartree', desc: 'Classical electron-electron Coulomb repulsion', val: outData.energyDecomp.hartree },
                { name: 'Exchange-Correlation (E_xc)', key: 'exchCorr', desc: 'DFT exchange + correlation functional contribution', val: outData.energyDecomp.exchCorr },
                { name: 'Exchange Only (E_x)', key: 'exchange', desc: 'Exchange component of DFT functional', val: outData.energyDecomp.exchange },
                { name: 'Correlation Only (E_c)', key: 'correlation', desc: 'Correlation component of DFT functional', val: outData.energyDecomp.correlation },
                { name: 'Ion-Electron Energy', key: 'ionElectron', desc: 'Electron interaction with pseudopotential cores', val: outData.energyDecomp.ionElectron },
                { name: 'Ion-Ion Repulsion', key: 'ionIon', desc: 'Core ion Coulomb electrostatic repulsion', val: outData.energyDecomp.ionIon },
                { name: 'DFT+U Energy (E_dftu)', key: 'edftu', desc: 'Hubbard U orbital localized correction', val: outData.energyDecomp.edftu },
                { name: 'Spin-Orbit Energy (E_so)', key: 'eso', desc: 'Relativistic spin-orbit coupling energy', val: outData.energyDecomp.eso },
                { name: 'D3 Dispersion Energy', key: 'd3Dispersion', desc: 'Grimme DFT-D3 empirical dispersion correction', val: outData.energyDecomp.d3Dispersion },
              ].map((row, idx) => (
                <tr key={idx} style={{
                  borderBottom: '1px solid var(--border)',
                  background: row.highlight ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                }}>
                  <td style={{ padding: '6px 10px', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? '#22c55e' : 'var(--fg)' }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{row.desc}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: row.val !== null ? 'var(--fg)' : 'var(--muted)' }}>
                    {row.val !== null && row.val !== undefined ? `${row.val.toFixed(6)}` : '0.000000'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Forces & Stress */}
      {activeTab === 'forces' && (
        <div style={{ padding: '1rem' }}>
          {/* Stress Tensor Summary */}
          {outData.stressTensorVoigt && (
            <div style={{ background: 'var(--surface2)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '4px' }}>
                Stress Tensor (Voigt Notation) &amp; Hydrostatic Pressure
              </strong>
              <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>σ_xx: {outData.stressTensorVoigt[0]?.toFixed(2)} kbar</span>
                <span>σ_yy: {outData.stressTensorVoigt[1]?.toFixed(2)} kbar</span>
                <span>σ_zz: {outData.stressTensorVoigt[2]?.toFixed(2)} kbar</span>
                <span>σ_yz: {outData.stressTensorVoigt[3]?.toFixed(2)} kbar</span>
                <span>σ_xz: {outData.stressTensorVoigt[4]?.toFixed(2)} kbar</span>
                <span>σ_xy: {outData.stressTensorVoigt[5]?.toFixed(2)} kbar</span>
              </div>
              <div style={{ fontSize: '0.74rem', marginTop: '4px', color: 'var(--muted)' }}>
                Hydrostatic Pressure: <strong>{pGpa}</strong> ({outData.pressureSolidKbar?.toFixed(1)} kBar)
              </div>
            </div>
          )}

          {/* Forces Table */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px' }}>Atom #</th>
                  <th style={{ padding: '6px 10px' }}>Fx (eV/Å)</th>
                  <th style={{ padding: '6px 10px' }}>Fy (eV/Å)</th>
                  <th style={{ padding: '6px 10px' }}>Fz (eV/Å)</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>|F| Magnitude (eV/Å)</th>
                  <th style={{ padding: '6px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {outData.forces.map(f => {
                  const relaxed = f.fmag <= 0.04;
                  return (
                    <tr key={f.idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{f.idx}</td>
                      <td style={{ padding: '6px 10px' }}>{f.fx.toFixed(6)}</td>
                      <td style={{ padding: '6px 10px' }}>{f.fy.toFixed(6)}</td>
                      <td style={{ padding: '6px 10px' }}>{f.fz.toFixed(6)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: relaxed ? '#22c55e' : '#f59e0b' }}>
                        {f.fmag.toFixed(4)}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          background: relaxed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: relaxed ? '#22c55e' : '#f59e0b',
                        }}>
                          {relaxed ? 'Converged' : 'Exceeds 0.04'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Relaxed Coordinates */}
      {activeTab === 'coords' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
              Format: <strong>{outData.coordsFormat}</strong> ({outData.relaxedCoordinates.length} atoms)
            </span>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={handleApplyToStructure}>
              Apply to Section 2 (Structure)
            </button>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px' }}>#</th>
                  <th style={{ padding: '6px 10px' }}>Species</th>
                  <th style={{ padding: '6px 10px' }}>X ({outData.coordsFormat})</th>
                  <th style={{ padding: '6px 10px' }}>Y ({outData.coordsFormat})</th>
                  <th style={{ padding: '6px 10px' }}>Z ({outData.coordsFormat})</th>
                </tr>
              </thead>
              <tbody>
                {outData.relaxedCoordinates.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px' }}>{c.atomIndex || i + 1}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700 }}>{c.symbol || `Species ${c.speciesIndex}`}</td>
                    <td style={{ padding: '6px 10px' }}>{c.x.toFixed(6)}</td>
                    <td style={{ padding: '6px 10px' }}>{c.y.toFixed(6)}</td>
                    <td style={{ padding: '6px 10px' }}>{c.z.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Charges & Spin */}
      {activeTab === 'charges' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            {outData.spinMoment && (
              <div style={{ background: 'var(--surface2)', padding: '0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Spin Magnetic Moment</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b' }}>
                  |S| = {outData.spinMoment.total.toFixed(3)} μ_B
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--muted)', marginTop: '2px' }}>
                  Sx: {outData.spinMoment.sx.toFixed(3)}, Sy: {outData.spinMoment.sy.toFixed(3)}, Sz: {outData.spinMoment.sz.toFixed(3)}
                </div>
              </div>
            )}

            {outData.electricDipoleDebye && (
              <div style={{ background: 'var(--surface2)', padding: '0.7rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Electric Dipole Moment</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {outData.electricDipoleDebye.total.toFixed(3)} Debye
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--muted)', marginTop: '2px' }}>
                  Dx: {outData.electricDipoleDebye.x.toFixed(3)}, Dy: {outData.electricDipoleDebye.y.toFixed(3)}, Dz: {outData.electricDipoleDebye.z.toFixed(3)}
                </div>
              </div>
            )}
          </div>

          {outData.mullikenPop.length > 0 ? (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Atom #</th>
                    <th style={{ padding: '6px 10px' }}>Species</th>
                    <th style={{ padding: '6px 10px' }}>Mulliken Valence Charge (e)</th>
                    {outData.mullikenPop.some(m => m.spin !== null) && (
                      <th style={{ padding: '6px 10px' }}>Spin Moment (μ_B)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {outData.mullikenPop.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{m.atom}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700 }}>{m.species}</td>
                      <td style={{ padding: '6px 10px' }}>{m.charge.toFixed(4)}</td>
                      {m.spin !== null && (
                        <td style={{ padding: '6px 10px', color: '#f59e0b', fontWeight: 700 }}>{m.spin.toFixed(4)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', padding: '0.5rem 0' }}>
              No Mulliken population table found in this output file (set <code>WriteMullikenPop 1</code> in Section 8 to output charges).
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Timings */}
      {activeTab === 'timings' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
              Total Wall Clock Time: <strong>{wall}</strong>
            </span>
          </div>

          {outData.topRoutines.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {outData.topRoutines.slice(0, 10).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  <span style={{ width: '90px', fontWeight: 600 }}>{r.routine}</span>
                  <div style={{ flex: 1, background: 'var(--surface2)', height: '14px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, r.percent)}%`,
                      height: '100%',
                      background: i === 0 ? 'var(--accent)' : '#38bdf8',
                    }} />
                  </div>
                  <span style={{ width: '50px', textAlign: 'right', fontWeight: 700 }}>{r.percent.toFixed(1)}%</span>
                  <span style={{ width: '70px', textAlign: 'right', color: 'var(--muted)' }}>{r.totalTime.toFixed(2)}s</span>
                  <span style={{ width: '50px', textAlign: 'right', color: 'var(--muted)' }}>({r.calls}x)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              No detailed routine timings available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
