import { useState } from 'react';
import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';
import { DOSPlotterSuite } from '../components/DOSPlotterSuite.jsx';
import { DOSComparisonStudio } from '../components/DOSComparisonStudio.jsx';
import { STMVisualizer } from '../components/STMVisualizer.jsx';

const ENERGY_UNITS = ['eV', 'Ry', 'Hartree'];

export function DOSSection() {
  const dos = useFDFStore(s => s.dos || {});
  const setField = useFDFStore(s => s.setField);
  const set = (k, v) => setField('dos', k, v);

  const [activeTab, setActiveTab] = useState('input'); // 'input' or 'plotter'

  const pdosK = dos.pdosKgrid || [12, 12, 12];
  const setPDOSK = (idx, val) => {
    const next = [...pdosK];
    next[idx] = parseInt(val) || 1;
    set('pdosKgrid', next);
  };

  const ldosK = dos.ldosKgrid || [12, 12, 12];
  const setLDOSK = (idx, val) => {
    const next = [...ldosK];
    next[idx] = parseInt(val) || 1;
    set('ldosKgrid', next);
  };
  return (
    <div className="section-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <SectionHeader title="Density of States (DOS / PDOS)" />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'input' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('input')}>
            ⚙️ FDF Input Settings
          </button>
          <button
            className={`btn ${activeTab === 'plotter' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('plotter')}>
            📈 Single-Dataset Visualizer
          </button>
          <button
            className={`btn ${activeTab === 'comparison' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('comparison')}>
            🔬 Multi-DOS Comparison
          </button>
          <button
            className={`btn ${activeTab === 'stm' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('stm')}>
            🔭 Simulated STM (simple-stm)
          </button>
        </div>
      </div>

      {activeTab === 'stm' ? (
        <STMVisualizer />
      ) : activeTab === 'comparison' ? (
        <DOSComparisonStudio />
      ) : activeTab === 'plotter' ? (
        <DOSPlotterSuite />
      ) : (
        <>
      <p className="section-desc">
        Calculate the Total Density of States (DOS) and Projected Density of States (PDOS) on pseudo-atomic orbitals.
      </p>

      {/* Main PDOS Toggle (Section 6.18.2) */}
      <div className="subsection">
        <div className="subsection-title">
          Partial &amp; Projected Density of States (Section 6.18.2)
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!dos.enablePDOS}
              onChange={e => set('enablePDOS', e.target.checked)}
            />
            <span className="toggle-label">
              {dos.enablePDOS ? '✓ Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
        <p className="subsection-desc">
          Generates <code>SystemLabel.DOS</code> (Total DOS: Energy, Spin-Up, Spin-Down) and{' '}
          <code>SystemLabel.PDOS</code> / <code>SystemLabel.PDOS.xml</code> (orbital-resolved PDOS).
          Broadening uses a Gaussian distribution: <code>f(E) = (1 / w√π) exp(-((E - ε)/w)²)</code> with peak width <code>w = σ√2</code>.
          Energies must be strictly ordered with lowest first (E<sub>min</sub> &lt; E<sub>max</sub>).
        </p>

        {dos.enablePDOS ? (
          <>
            <FieldRow label="Energy Reference" keyword="ProjectedDensityOfStates">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!dos.useEF}
                  onChange={e => set('useEF', e.target.checked)}
                />
                <span className="toggle-label">
                  Align to Fermi Level (prefix <code>EF</code>: E = 0 at E<sub>F</sub>)
                </span>
              </label>
            </FieldRow>

            <div className="field-row-group">
              <FieldRow label="E_min (minimum energy)">
                <TextInput
                  mono
                  value={dos.eMin ?? '-10.0'}
                  onChange={v => set('eMin', v)}
                  placeholder="-10.0"
                />
              </FieldRow>
              <FieldRow label="E_max (maximum energy)">
                <TextInput
                  mono
                  value={dos.eMax ?? '10.0'}
                  onChange={v => set('eMax', v)}
                  placeholder="10.0"
                />
              </FieldRow>
            </div>

            <div className="field-row-group">
              <FieldRow label="Peak Width (Gaussian w)">
                <TextInput
                  mono
                  value={dos.peakWidth ?? '0.100'}
                  onChange={v => set('peakWidth', v)}
                  placeholder="0.100"
                />
              </FieldRow>
              <FieldRow label="Number of Energy Points">
                <TextInput
                  mono
                  value={dos.numPoints ?? '1000'}
                  onChange={v => set('numPoints', v)}
                  placeholder="1000"
                />
              </FieldRow>
            </div>

            <FieldRow label="Energy Units">
              <SelectInput
                value={dos.energyUnits || 'eV'}
                onChange={v => set('energyUnits', v)}
                options={ENERGY_UNITS}
              />
            </FieldRow>

            {/* Custom k-grid for PDOS */}
            <div className="subsection" style={{ marginTop: '0.8rem' }}>
              <div className="subsection-title">
                PDOS k-Point Grid
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!dos.useCustomKgrid}
                    onChange={e => set('useCustomKgrid', e.target.checked)}
                  />
                  <span className="toggle-label">
                    Use dedicated denser k-grid for DOS
                  </span>
                </label>
              </div>

              {dos.useCustomKgrid ? (
                <>
                  <p className="subsection-desc">
                    <code>PDOS.kgrid.MonkhorstPack [kx ky kz]</code> — DOS curves require denser k-point sampling than SCF for smooth peaks.
                  </p>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <span className="field-label" style={{ minWidth: '100px' }}>Grid dimensions:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={pdosK[0]}
                        onChange={e => setPDOSK(0, e.target.value)}
                      />
                      <span>×</span>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={pdosK[1]}
                        onChange={e => setPDOSK(1, e.target.value)}
                      />
                      <span>×</span>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={pdosK[2]}
                        onChange={e => setPDOSK(2, e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="info-box">
                  Falls back to standard SCF k-grid. If SCF k-grid is coarse, enable a custom k-grid (e.g. 12×12×12) for smooth DOS.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="info-box">
            Enable Projected Density of States to compute total DOS and orbital-resolved (s, p, d, f) electronic contributions.
          </div>
        )}
      </div>

      {/* Eigenvalues output for Eig2DOS */}
      <div className="subsection">
        <div className="subsection-title">Total DOS via Eigenvalues (Eig2DOS utility)</div>
        <FieldRow label="WriteEigenvalues" keyword="WriteEigenvalues">
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!dos.writeEigenvalues}
              onChange={e => set('writeEigenvalues', e.target.checked)}
            />
            <span className="toggle-label">
              Save eigenvalues to <code>SystemLabel.EIG</code>
            </span>
          </label>
        </FieldRow>
        <div className="info-box">
          Writes raw Kohn-Sham eigenvalues for all SCF k-points to <code>SystemLabel.EIG</code>, which can be post-processed using SIESTA's <code>Eig2DOS</code> utility.
        </div>
      </div>

      {/* Local Density of States (LDOS) */}
      <div className="subsection">
        <div className="subsection-title">
          Local Density of States (LDOS / STM simulation)
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!dos.enableLDOS}
              onChange={e => set('enableLDOS', e.target.checked)}
            />
            <span className="toggle-label">
              {dos.enableLDOS ? '✓ Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {dos.enableLDOS && (
          <>
            <p className="subsection-desc">
              Integrates real-space wavefunctions over the energy window [E<sub>min</sub>, E<sub>max</sub>] at the DHSCF mesh.
              Stored in <code>SystemLabel.LDOS</code> (readable by <code>IORHO</code>, used for STM simulation via Tersoff-Hamann approximation in <code>Util/STM/simple-stm</code>).
              Produces <code>LDOS.grid.nc</code> if NetCDF is enabled. <em>Note: Not compatible with PEXSI.LDOS.</em>
            </p>

            <FieldRow label="Energy Reference" keyword="LocalDensityOfStates">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!dos.ldosUseEF}
                  onChange={e => set('ldosUseEF', e.target.checked)}
                />
                <span className="toggle-label">
                  Align to Fermi Level (prefix <code>EF</code>: e.g. <code>EF -3.50 0.00 eV</code> for occupied states down to -3.5 eV below E<sub>F</sub>)
                </span>
              </label>
            </FieldRow>

            <div className="field-row-group">
              <FieldRow label="LDOS E_min">
                <TextInput
                  mono
                  value={dos.ldosMin ?? '-3.50'}
                  onChange={v => set('ldosMin', v)}
                  placeholder="-3.50"
                />
              </FieldRow>
              <FieldRow label="LDOS E_max">
                <TextInput
                  mono
                  value={dos.ldosMax ?? '0.00'}
                  onChange={v => set('ldosMax', v)}
                  placeholder="0.00"
                />
              </FieldRow>
            </div>
            <FieldRow label="Energy Units">
              <SelectInput
                value={dos.ldosUnits || 'eV'}
                onChange={v => set('ldosUnits', v)}
                options={ENERGY_UNITS}
              />
            </FieldRow>

            {/* Dedicated LDOS k-grid */}
            <div className="subsection" style={{ marginTop: '0.8rem' }}>
              <div className="subsection-title">
                LDOS k-Point Grid (Section 6.18.3)
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!dos.useCustomLdosKgrid}
                    onChange={e => set('useCustomLdosKgrid', e.target.checked)}
                  />
                  <span className="toggle-label">
                    Use dedicated k-grid for LDOS
                  </span>
                </label>
              </div>

              {dos.useCustomLdosKgrid ? (
                <>
                  <p className="subsection-desc">
                    <code>%block LDOS.kgrid_Monkhorst_Pack</code> — fine-tunes k-point sampling for LDOS. SIESTA checks <code>LDOS.kgrid.?</code> → <code>DOS.kgrid.?</code> → default <code>kgrid_Monkhorst_Pack</code>.
                  </p>
                  <div className="field-row" style={{ alignItems: 'center' }}>
                    <span className="field-label" style={{ minWidth: '100px' }}>Grid dimensions:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={ldosK[0]}
                        onChange={e => setLDOSK(0, e.target.value)}
                      />
                      <span>×</span>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={ldosK[1]}
                        onChange={e => setLDOSK(1, e.target.value)}
                      />
                      <span>×</span>
                      <input
                        type="number"
                        min="1"
                        className="input mono"
                        style={{ width: '70px', textAlign: 'center' }}
                        value={ldosK[2]}
                        onChange={e => setLDOSK(2, e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="info-box">
                  Falls back to standard SCF k-grid (or DOS k-grid).
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Output Files Guide */}
      <div className="info-box">
        <strong>SIESTA Output Files:</strong>
        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', lineHeight: '1.6' }}>
          <li><code>SystemLabel.DOS</code> — Total Density of States: 3 columns (Energy, Spin-Up, Spin-Down).</li>
          <li><code>SystemLabel.PDOS</code> & <code>SystemLabel.PDOS.xml</code> — Projected DOS resolved by atom, orbital shell ($l$), and magnetic quantum number ($m$).</li>
          <li>Can be plotted with Python (matplotlib), <code>sisl</code>, or SIESTA utilities (<code>pdosxml</code>, <code>fmpdos</code>).</li>
        </ul>
      </div>
        </>
      )}
    </div>
  );
}
