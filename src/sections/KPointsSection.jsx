import { useFDFStore } from '../store/fdfStore';
import { BAND_PATH_PRESETS, detectCrystalSystem } from '../utils/bandPathGenerator';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';
import { BandStructureChart } from '../components/BandStructureChart.jsx';
import { useState } from 'react';

const BAND_SCALE = ['pi/a', 'ReciprocalLatticeVectors'];

export function KPointsSection() {
  const kpoints = useFDFStore(s => s.kpoints);
  const structure = useFDFStore(s => s.structure);
  const setSection = useFDFStore(s => s.setSection);
  const set = (k, v) => setSection('kpoints', { [k]: v });
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'visualizer'
  const mp = kpoints.mp || [[8,0,0,0],[0,8,0,0],[0,0,8,0]];
  const setMP = (row, col, val) => {
    const next = mp.map((r, i) => i === row ? r.map((c, j) => j === col ? (parseFloat(val)||0) : c) : r);
    set('mp', next);
  };

  const bandLines = kpoints.BandLines || [];
  const setBandLine = (i, col, val) => {
    const next = bandLines.map((bl, idx) => {
      if (idx !== i) return bl;
      const copy = [...bl];
      copy[col] = col < 4 ? (parseFloat(val)||0) : val;
      return copy;
    });
    set('BandLines', next);
  };
  const addBandLine = () => set('BandLines', [...bandLines, [20, 0, 0, 0, 'Γ']]);
  const removeBandLine = (i) => set('BandLines', bandLines.filter((_, idx) => idx !== i));

  return (
    <div className="section-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <SectionHeader title="K-Point Sampling & Band Structure (Section 6.16)" />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('settings')}>
            ⚙️ K-Point &amp; BandLines Settings
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'visualizer' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('visualizer')}>
            📈 Electronic Band Structure Plotter (.bands)
          </button>
        </div>
      </div>

      {activeTab === 'visualizer' ? (
        <BandStructureChart />
      ) : (
        <>
      {/* Mode selector */}
      <div className="kmode-tabs">
        {['mp','cutoff','none'].map(m => (
          <button key={m}
            className={`kmode-tab ${kpoints.mode === m ? 'active' : ''}`}
            onClick={() => set('mode', m)}>
            {m === 'mp' ? 'Monkhorst-Pack Grid'
              : m === 'cutoff' ? 'kgrid_cutoff'
              : 'Gamma only (Γ)'}
          </button>
        ))}
      </div>

      {kpoints.mode === 'mp' && (
        <div className="subsection">
          <div className="subsection-title">kgrid_Monkhorst_Pack</div>
          <p className="subsection-desc">
            3×4 matrix: each row is <code>n₁ n₂ n₃ shift</code>.
            Diagonal = grid size; off-diagonal = 0 for standard cubic. Shift = 0 or 0.5.
          </p>
          <div className="mp-grid">
            <div className="mp-header">
              <span></span><span>n₁</span><span>n₂</span><span>n₃</span><span>shift</span>
            </div>
            {['k₁','k₂','k₃'].map((label, row) => (
              <div key={row} className="mp-row">
                <span className="mp-label">{label}</span>
                {[0,1,2,3].map(col => (
                  <input key={col} type="number" step="1" min="0"
                    className="input mono mp-cell"
                    value={mp[row]?.[col] ?? 0}
                    onChange={e => setMP(row, col, e.target.value)} />
                ))}
              </div>
            ))}
          </div>
          <div className="info-box">
            For insulators: 4×4×4 to 8×8×8 is typical. For metals: 12×12×12+.
            For slabs: set the vacuum direction to 1 (e.g. <code>4 4 1</code>).
          </div>
        </div>
      )}

      {kpoints.mode === 'cutoff' && (
        <div className="subsection">
          <FieldRow label="kgrid_cutoff" keyword="kgrid_cutoff">
            <TextInput mono value={kpoints.kgrid_cutoff}
              onChange={v => set('kgrid_cutoff', v)} placeholder="7.0 Ang" />
          </FieldRow>
          <div className="info-box">
            SIESTA auto-generates an MP grid dense enough that the real-space k-point
            representation has a cutoff ≥ this value. Simpler than specifying the grid manually.
          </div>
        </div>
      )}

      {kpoints.mode === 'none' && (
        <div className="info-box">
          No k-point sampling block will be written — SIESTA defaults to Γ-only.
          Suitable for molecules in a large box.
        </div>
      )}

      {/* Band lines */}
      <div className="subsection">
        <div className="subsection-title">
          BandLines
          <span className="opt" style={{marginLeft:'0.5rem'}}>(optional — band structure path)</span>
        </div>
        {/* High-symmetry path generator banner */}
        <div className="bandpath-generator-box">
          <div className="bandpath-header">
            <strong>⚡ Auto-Generate High-Symmetry Band Path</strong>
            <span className="hint">Standard crystallographic paths (AFLOW / Seekpath)</span>
          </div>
          <div className="bandpath-controls">
            <select
              id="bandpath-select"
              className="input select"
              defaultValue={detectCrystalSystem(structure.LatticeParameters)}
              style={{ flex: 1, minWidth: '220px' }}>
              {Object.entries(BAND_PATH_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label} — {p.description}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => {
                const sel = document.getElementById('bandpath-select').value;
                const preset = BAND_PATH_PRESETS[sel];
                if (preset) {
                  const lines = preset.path.map(pt => [pt.npts, pt.kx, pt.ky, pt.kz, pt.label]);
                  set('BandLines', lines);
                  set('BandLinesScale', 'ReciprocalLatticeVectors');
                }
              }}>
              Apply Path
            </button>
            {bandLines.length > 0 && (
              <button className="btn btn-ghost" onClick={() => set('BandLines', [])} title="Clear band lines">
                Clear
              </button>
            )}
          </div>
        </div>


        <FieldRow label="BandLinesScale" keyword="BandLinesScale">
          <SelectInput value={kpoints.BandLinesScale || 'pi/a'}
            onChange={v => set('BandLinesScale', v)} options={BAND_SCALE} />
        </FieldRow>

        {bandLines.length > 0 && (
          <table className="atoms-table" style={{marginTop:'0.5rem'}}>
            <thead>
              <tr><th>Npts</th><th>kx</th><th>ky</th><th>kz</th><th>Label</th><th></th></tr>
            </thead>
            <tbody>
              {bandLines.map((bl, i) => (
                <tr key={i}>
                  <td><input type="number" className="input mono atom-sp" value={bl[0]}
                    onChange={e => setBandLine(i, 0, e.target.value)} /></td>
                  {[1,2,3].map(c => (
                    <td key={c}><input type="number" step="any" className="input mono atom-coord"
                      value={bl[c]} onChange={e => setBandLine(i, c, e.target.value)} /></td>
                  ))}
                  <td><input type="text" className="input atom-label" value={bl[4]||''}
                    onChange={e => setBandLine(i, 4, e.target.value)} placeholder="Γ X M" /></td>
                  <td><button className="btn btn-danger-sm" onClick={() => removeBandLine(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="table-actions" style={{marginTop:'0.4rem'}}>
          <button className="btn btn-secondary" onClick={addBandLine}>+ Add k-point segment</button>
        </div>
        <div className="info-box" style={{marginTop:'0.5rem'}}>
          First row: Npts=1, coordinates of starting point. Subsequent rows: Npts = points
          along segment FROM previous point TO this one. Use <code>\Gamma</code> for Γ label.
        </div>
        {/* Output Options for Bands (Section 6.16 & 6.16.2) */}
        <div className="subsection" style={{ marginTop: '1rem' }}>
          <div className="subsection-title">Band Output &amp; Wavefunctions (Section 6.16)</div>
          <div className="field-row-group">
            <FieldRow label="WriteKbands" keyword="WriteKbands">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={kpoints['WriteKbands'] === 'true'}
                  onChange={e => set('WriteKbands', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">Write k-vectors to stdout</span>
              </label>
            </FieldRow>

            <FieldRow label="WriteBands" keyword="WriteBands">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={kpoints['WriteBands'] === 'true'}
                  onChange={e => set('WriteBands', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">Write band eigenvalues to stdout</span>
              </label>
            </FieldRow>
          </div>

          {/* WFS for Bands */}
          <FieldRow label="WFS.Write.For.Bands" keyword="WFS.Write.For.Bands">
            <label className="toggle">
              <input
                type="checkbox"
                checked={kpoints['WFS.Write.For.Bands'] === 'true'}
                onChange={e => set('WFS.Write.For.Bands', e.target.checked ? 'true' : 'false')}
              />
              <span className="toggle-label">Save wavefunctions to SystemLabel.WFSX (for "fatbands" orbital plots)</span>
            </label>
          </FieldRow>

          {kpoints['WFS.Write.For.Bands'] === 'true' && (
            <div className="field-row-group" style={{ marginTop: '0.4rem' }}>
              <FieldRow label="WFS.Band.Min" keyword="WFS.Band.Min">
                <TextInput
                  mono
                  value={kpoints['WFS.Band.Min'] || '1'}
                  onChange={v => set('WFS.Band.Min', v)}
                  placeholder="1"
                />
              </FieldRow>
              <FieldRow label="WFS.Band.Max" keyword="WFS.Band.Max">
                <TextInput
                  mono
                  value={kpoints['WFS.Band.Max'] || ''}
                  onChange={v => set('WFS.Band.Max', v)}
                  placeholder="all orbitals (default)"
                />
              </FieldRow>
            </div>
          )}
          <div className="info-box" style={{ marginTop: '0.5rem' }}>
            Wavefunctions written to <code>SystemLabel.WFSX</code> can be processed with <code>Util/COOP/fat</code> to generate publication-grade fatbands plots resolved by atomic orbital contributions.
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
