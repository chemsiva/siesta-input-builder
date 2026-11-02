import { useFDFStore } from '../store/fdfStore';
import { FieldRow, SelectInput, TextInput, SectionHeader } from '../components/FieldRow';

const SOLVERS = ['diagon', 'OMM', 'OrderN', 'PEXSI', 'ELSI', 'CheSS'];
const MIXERS = ['pulay', 'linear', 'broyden'];
const DIAG_ALGORITHMS = [
  'divide-and-conquer',
  'MRRR',
  'expert',
  'noexpert',
  'ELPA-1stage',
  'ELPA-2stage',
];
const OCC_FUNCTIONS = ['FD', 'MP', 'Cold'];

export function SCFSection() {
  const scf = useFDFStore(s => s.scf);
  const dft = useFDFStore(s => s.dft);
  const structure = useFDFStore(s => s.structure);
  const setSection = useFDFStore(s => s.setSection);
  const setField = useFDFStore(s => s.setField);
  const set = (k, v) => setField('scf', k, v);

  const [etVal, etUnit] = (scf.ElectronicTemperature || '300 K').split(' ');
  const etUnits = ['K', 'eV', 'meV', 'Ry'];

  // DM.InitSpin — stored as raw text block
  const spinBlock = scf._dmInitSpin || '';

  // 1-Click Presets for Section 6.12 Solvers
  const applySolverPreset = (type) => {
    if (type === 'standard') {
      set('SolutionMethod', 'diagon');
      set('Diag.Algorithm', 'divide-and-conquer');
      set('Diag.ParallelOverK', 'false');
      set('Diag.Use2D', 'true');
      set('NumberOfEigenStates', '');
      set('OccupationFunction', 'FD');
    } else if (type === 'metal_dense_k') {
      set('SolutionMethod', 'diagon');
      set('Diag.Algorithm', 'divide-and-conquer');
      set('Diag.ParallelOverK', 'true');
      set('OccupationFunction', 'MP');
      set('OccupationMPOrder', '1');
      set('ElectronicTemperature', '0.1 eV');
    } else if (type === 'elpa_subspace') {
      set('SolutionMethod', 'diagon');
      set('Diag.Algorithm', 'ELPA-2stage');
      set('Diag.Use2D', 'true');
      set('NumberOfEigenStates', '-4'); // 4 states above Fermi level
      set('Diag.ParallelOverK', 'false');
    } else if (type === 'omm_md') {
      set('SolutionMethod', 'OMM');
      set('OMM.UseCholesky', 'true');
      set('OMM.Use2D', 'true');
      set('OMM.Precon', '-1');
      set('OMM.Diagon', '3');
      set('ON.eta', '2.0 eV');
    } else if (type === 'ordern') {
      set('SolutionMethod', 'OrderN');
      set('ON.functional', 'Kim');
      set('ON.RcLWF', '9.5 Bohr');
      set('ON.eta', '0.0 eV');
      set('ON.MaxNumIter', '1000');
    }
  };

  const solutionMethod = scf.SolutionMethod || 'diagon';

  return (
    <div className="section-pane">
      <SectionHeader
        title="5 SCF Control &amp; Electronic Structure Solvers (Section 6.12)"
        desc="Choose electronic structure solution methods (Standard Diagonalization, Orbital Minimization OMM, Linear-Scaling Order-N, ELSI, PEXSI), ScaLAPACK 2D parallelization, eigenvalue subsets, and electronic smearing functions (Fermi-Dirac, Methfessel-Paxton, Cold smearing)."
      />

      {/* 1-Click Solver Presets Ribbon */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.6rem 0.8rem',
        marginBottom: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg)' }}>
          1-Click Solver Presets:
        </span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-xs ${solutionMethod === 'diagon' && scf['Diag.ParallelOverK'] !== 'true' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => applySolverPreset('standard')}
            title="Standard ScaLAPACK Divide-and-Conquer diagonalization (robust for all systems)">
            ⚡ Standard Diagonalization
          </button>
          <button
            type="button"
            className={`btn btn-xs ${scf['Diag.ParallelOverK'] === 'true' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => applySolverPreset('metal_dense_k')}
            title="Parallelize over k-points + Methfessel-Paxton smearing for metals with dense k-grids">
            🏎️ Fast Metal / Dense K (ParallelOverK)
          </button>
          <button
            type="button"
            className={`btn btn-xs ${scf['Diag.Algorithm']?.includes('ELPA') ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => applySolverPreset('elpa_subspace')}
            title="High-performance ELPA 2-stage solver with eigenvalue subspace reduction">
            🚀 High-Performance ELPA (Subspace)
          </button>
          <button
            type="button"
            className={`btn btn-xs ${solutionMethod === 'OMM' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => applySolverPreset('omm_md')}
            title="Orbital Minimization Method for fast molecular dynamics restarts">
            🧬 Orbital Minimization (OMM)
          </button>
          <button
            type="button"
            className={`btn btn-xs ${solutionMethod === 'OrderN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => applySolverPreset('ordern')}
            title="Order-N linear scaling method with localized wavefunctions (LWFs)">
            📐 Linear-Scaling Order-N
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6.12: Solution Method & Electronic Smearing                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="subsection">
        <div className="subsection-title">
          Electronic Structure Solver &amp; Smearing (Section 6.12 &amp; 6.12.3)
        </div>

        <div className="field-row-group">
          <FieldRow
            label="SolutionMethod"
            propKey="SolutionMethod"
            hint="diagon: standard ScaLAPACK diagonalization | OMM: Orbital Minimization | OrderN: linear scaling | PEXSI / ELSI">
            <SelectInput
              value={solutionMethod}
              onChange={v => set('SolutionMethod', v)}
              options={SOLVERS}
            />
          </FieldRow>

          <FieldRow
            label="OccupationFunction"
            propKey="OccupationFunction"
            hint="FD: Fermi-Dirac | MP: Methfessel-Paxton (accelerates k-point convergence for metals) | Cold: Marzari-Vanderbilt">
            <SelectInput
              value={scf.OccupationFunction || 'FD'}
              onChange={v => set('OccupationFunction', v)}
              options={OCC_FUNCTIONS}
            />
          </FieldRow>
        </div>

        <div className="field-row-group">
          <FieldRow
            label="ElectronicTemperature"
            propKey="ElectronicTemperature"
            hint="Fermi smearing width. Use ~25 meV (300 K) for typical runs, larger values for difficult metals">
            <div className="input-with-unit">
              <TextInput
                mono
                value={etVal}
                onChange={v => set('ElectronicTemperature', `${v} ${etUnit || 'K'}`)}
                placeholder="300"
              />
              <SelectInput
                value={etUnit || 'K'}
                onChange={u => set('ElectronicTemperature', `${etVal} ${u}`)}
                options={etUnits}
              />
            </div>
          </FieldRow>

          {scf.OccupationFunction === 'MP' && (
            <FieldRow
              label="OccupationMPOrder"
              propKey="OccupationMPOrder"
              hint="Order of Hermite-Gauss polynomial expansion for Methfessel-Paxton scheme (default 1)">
              <TextInput
                mono
                value={scf.OccupationMPOrder || '1'}
                onChange={v => set('OccupationMPOrder', v)}
                placeholder="1"
              />
            </FieldRow>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6.12.1: Diagonalization & ScaLAPACK 2D Parallelization           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {solutionMethod === 'diagon' && (
        <div className="subsection">
          <div className="subsection-title">
            Diagonalization &amp; ScaLAPACK 2D Options (Section 6.12.1)
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
            Control eigensolver algorithms, eigenvalue subset calculations, and parallel 2D matrix distribution.
          </p>

          <div className="field-row-group">
            <FieldRow
              label="Diag.Algorithm"
              propKey="Diag.Algorithm"
              hint="divide-and-conquer (standard), MRRR (fastest), expert (subspace), ELPA-1stage, ELPA-2stage (scalable)">
              <SelectInput
                value={scf['Diag.Algorithm'] || 'divide-and-conquer'}
                onChange={v => set('Diag.Algorithm', v)}
                options={DIAG_ALGORITHMS}
              />
            </FieldRow>

            <FieldRow
              label="NumberOfEigenStates"
              propKey="NumberOfEigenStates"
              hint="Reduce calculated eigenstates to accelerate diagonalization. Positive = total states; negative (e.g. -2) = states above Fermi level">
              <TextInput
                mono
                value={scf.NumberOfEigenStates || ''}
                onChange={v => set('NumberOfEigenStates', v)}
                placeholder="All orbitals (or e.g. -4)"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="Diag.ParallelOverK"
              propKey="Diag.ParallelOverK"
              hint="Parallelize over k-points rather than orbitals. Near-perfect scaling when k-points >> processors (ideal for metals)">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['Diag.ParallelOverK'] === 'true'}
                  onChange={e => set('Diag.ParallelOverK', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['Diag.ParallelOverK'] === 'true' ? 'True (Parallel over K)' : 'False (Over Orbitals)'}</span>
              </label>
            </FieldRow>

            <FieldRow
              label="Diag.Use2D"
              propKey="Diag.Use2D"
              hint="2D data decomposition for ScaLAPACK. Superior parallel scaling on modern clusters (default true)">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['Diag.Use2D'] !== 'false'}
                  onChange={e => set('Diag.Use2D', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['Diag.Use2D'] !== 'false' ? 'True (2D Grid)' : 'False (1D Grid)'}</span>
              </label>
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="Diag.ProcessorY"
              propKey="Diag.ProcessorY"
              hint="Number of processors along rows in 2D ScaLAPACK distribution (default lowest multiple of cores below √N)">
              <TextInput
                mono
                value={scf['Diag.ProcessorY'] || ''}
                onChange={v => set('Diag.ProcessorY', v)}
                placeholder="Auto (~√N)"
              />
            </FieldRow>

            <FieldRow
              label="Diag.BlockSize"
              propKey="Diag.BlockSize"
              hint="Block size used for 2D distribution in ScaLAPACK calls (e.g. 32 or 64)">
              <TextInput
                mono
                value={scf['Diag.BlockSize'] || ''}
                onChange={v => set('Diag.BlockSize', v)}
                placeholder="Default (BlockSize)"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="Diag.WFS.Cache"
              propKey="Diag.WFS.Cache"
              hint="none (standard 2-pass) or cdf (caches wavefunctions to NetCDF file WFS.nc in one pass)">
              <SelectInput
                value={scf['Diag.WFS.Cache'] || 'none'}
                onChange={v => set('Diag.WFS.Cache', v)}
                options={['none', 'cdf']}
              />
            </FieldRow>

            <FieldRow
              label="Diag.ELPA.GPU"
              propKey="Diag.ELPA.GPU"
              hint="Enable GPU acceleration for the ELPA library (requires GPU-enabled ELPA build)">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['Diag.ELPA.GPU'] === 'true'}
                  onChange={e => set('Diag.ELPA.GPU', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['Diag.ELPA.GPU'] === 'true' ? 'True (GPU Enabled)' : 'False'}</span>
              </label>
            </FieldRow>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6.12.4: Orbital Minimization Method (OMM)                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {solutionMethod === 'OMM' && (
        <div className="subsection">
          <div className="subsection-title">
            Orbital Minimization Method (OMM) Controls (Section 6.12.4)
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
            OMM directly minimizes the energy over trial orbitals and reuses solutions between MD steps, speeding up trajectory simulations.
          </p>

          <div className="field-row-group">
            <FieldRow
              label="OMM.Precon"
              propKey="OMM.Precon"
              hint="Number of SCF steps to apply overlap/kinetic preconditioning (-1 = always applied, essential for convergence)">
              <TextInput
                mono
                value={scf['OMM.Precon'] || '-1'}
                onChange={v => set('OMM.Precon', v)}
                placeholder="-1"
              />
            </FieldRow>

            <FieldRow
              label="OMM.Diagon"
              propKey="OMM.Diagon"
              hint="Number of initial SCF steps to use standard diagonalization before switching to OMM (e.g. 2–5 steps)">
              <TextInput
                mono
                value={scf['OMM.Diagon'] || '0'}
                onChange={v => set('OMM.Diagon', v)}
                placeholder="0"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="ON.eta (Fermi Level Shift)"
              propKey="ON.eta"
              hint="Energy shift applied to eigenspectrum. Must be higher than the HOMO level for stable OMM convergence">
              <TextInput
                mono
                value={scf['ON.eta'] || '0.0 eV'}
                onChange={v => set('ON.eta', v)}
                placeholder="2.0 eV"
              />
            </FieldRow>

            <FieldRow
              label="OMM.RelTol"
              propKey="OMM.RelTol"
              hint="Relative tolerance in the conjugate gradients minimization of Kohn-Sham band energy (default 1e-9)">
              <TextInput
                mono
                value={scf['OMM.RelTol'] || '1e-9'}
                onChange={v => set('OMM.RelTol', v)}
                placeholder="1e-9"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="OMM.UseCholesky"
              propKey="OMM.UseCholesky"
              hint="Perform Cholesky factorization of generalized eigenvalue problem (default true)">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['OMM.UseCholesky'] !== 'false'}
                  onChange={e => set('OMM.UseCholesky', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['OMM.UseCholesky'] !== 'false' ? 'True' : 'False'}</span>
              </label>
            </FieldRow>

            <FieldRow
              label="OMM.Eigenvalues"
              propKey="OMM.Eigenvalues"
              hint="Perform diagonalization at the end of each MD step to obtain Kohn-Sham eigenvalues">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['OMM.Eigenvalues'] === 'true'}
                  onChange={e => set('OMM.Eigenvalues', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['OMM.Eigenvalues'] === 'true' ? 'True' : 'False'}</span>
              </label>
            </FieldRow>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6.12.5: Order(N) Linear Scaling Solver                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {solutionMethod === 'OrderN' && (
        <div className="subsection">
          <div className="subsection-title">
            Order-N Linear Scaling Solver (Section 6.12.5)
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
            Linear scaling $O(N)$ method based on localized wave functions (LWFs). Suitable for large, insulating systems with an energy gap.
          </p>

          <div className="field-row-group">
            <FieldRow
              label="ON.functional"
              propKey="ON.functional"
              hint="Order-N functional: Kim (Kim, Mauri & Galli), Ordejon-Mauri, or files">
              <SelectInput
                value={scf['ON.functional'] || 'Kim'}
                onChange={v => set('ON.functional', v)}
                options={['Kim', 'Ordejon-Mauri', 'files']}
              />
            </FieldRow>

            <FieldRow
              label="ON.RcLWF"
              propKey="ON.RcLWF"
              hint="Localization radius for Localized Wave Functions (LWFs). Default 9.5 Bohr">
              <TextInput
                mono
                value={scf['ON.RcLWF'] || '9.5 Bohr'}
                onChange={v => set('ON.RcLWF', v)}
                placeholder="9.5 Bohr"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="ON.eta (Energy Gap Parameter)"
              propKey="ON.eta"
              hint="Fermi level parameter of Kim et al. Must lie within the energy gap to obtain correct electron count">
              <TextInput
                mono
                value={scf['ON.eta'] || '0.0 eV'}
                onChange={v => set('ON.eta', v)}
                placeholder="0.0 eV"
              />
            </FieldRow>

            <FieldRow
              label="ON.MaxNumIter"
              propKey="ON.MaxNumIter"
              hint="Maximum conjugate gradient minimization iterations per SCF cycle (default 1000)">
              <TextInput
                mono
                value={scf['ON.MaxNumIter'] || '1000'}
                onChange={v => set('ON.MaxNumIter', v)}
                placeholder="1000"
              />
            </FieldRow>
          </div>

          <div className="field-row-group">
            <FieldRow
              label="ON.ChemicalPotential"
              propKey="ON.ChemicalPotential"
              hint="Calculate order-N estimate of Chemical Potential via Chebyshev projection (serial only)">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['ON.ChemicalPotential'] === 'true'}
                  onChange={e => set('ON.ChemicalPotential', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['ON.ChemicalPotential'] === 'true' ? 'True' : 'False'}</span>
              </label>
            </FieldRow>

            <FieldRow
              label="ON.UseSaveLWF"
              propKey="ON.UseSaveLWF"
              hint="Read localized wave functions from SystemLabel.LWF for restart">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={scf['ON.UseSaveLWF'] === 'true'}
                  onChange={e => set('ON.UseSaveLWF', e.target.checked ? 'true' : 'false')}
                />
                <span className="toggle-label">{scf['ON.UseSaveLWF'] === 'true' ? 'True' : 'False'}</span>
              </label>
            </FieldRow>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SCF Convergence, Tolerances & Mixing                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="subsection">
        <div className="subsection-title">Density Matrix Convergence &amp; Mixing</div>

        <div className="field-row-group">
          <FieldRow label="MaxSCFIterations" propKey="MaxSCFIterations" hint="Maximum number of SCF iterations before stopping">
            <TextInput mono value={scf.MaxSCFIterations} onChange={v => set('MaxSCFIterations', v)} placeholder="200" />
          </FieldRow>
          <FieldRow label="MinSCFIterations" propKey="MinSCFIterations" hint="Minimum number of SCF iterations before convergence can be declared">
            <TextInput mono value={scf.MinSCFIterations} onChange={v => set('MinSCFIterations', v)} placeholder="0 (optional)" />
          </FieldRow>
        </div>

        <FieldRow label="DM.Tolerance" propKey="DM.Tolerance" hint="Convergence criterion for maximum change in Density Matrix elements">
          <TextInput mono value={scf['DM.Tolerance']} onChange={v => set('DM.Tolerance', v)} placeholder="1e-4" />
        </FieldRow>

        <div className="field-row-group">
          <FieldRow label="SCF.Mixer.Method" propKey="SCF.Mixer.Method" hint="Density matrix mixing algorithm (Pulay DIIS is standard and best for most systems)">
            <SelectInput
              value={scf['SCF.Mixer.Method'] || 'pulay'}
              onChange={v => set('SCF.Mixer.Method', v)}
              options={MIXERS}
            />
          </FieldRow>
          <FieldRow label="DM.MixingWeight" propKey="DM.MixingWeight" hint="Fraction of new density matrix mixed into linear combination (0.05 to 0.3)">
            <TextInput mono value={scf['DM.MixingWeight']} onChange={v => set('DM.MixingWeight', v)} placeholder="0.25" />
          </FieldRow>
          <FieldRow label="DM.NumberPulay" propKey="DM.NumberPulay" hint="Number of previous density matrices retained in Pulay DIIS history (4–12 typical)">
            <TextInput mono value={scf['DM.NumberPulay']} onChange={v => set('DM.NumberPulay', v)} placeholder="8" />
          </FieldRow>
        </div>

        <div className="field-row-group">
          <FieldRow label="SCF.MustConverge" propKey="SCF.MustConverge" hint="If true, SIESTA terminates with an error if SCF does not converge within MaxSCFIterations">
            <label className="toggle">
              <input
                type="checkbox"
                checked={scf['SCF.MustConverge'] === 'true' || scf['SCF.MustConverge'] === true}
                onChange={e => set('SCF.MustConverge', e.target.checked ? 'true' : 'false')}
              />
              <span className="toggle-label">{scf['SCF.MustConverge'] === 'true' ? 'True (Abort if not converged)' : 'False (Warn only)'}</span>
            </label>
          </FieldRow>
          <FieldRow label="DM.UseSaveDM" propKey="DM.UseSaveDM" hint="Read existing density matrix from SystemLabel.DM to restart calculation">
            <label className="toggle">
              <input
                type="checkbox"
                checked={scf['DM.UseSaveDM'] === 'true'}
                onChange={e => set('DM.UseSaveDM', e.target.checked ? 'true' : 'false')}
              />
              <span className="toggle-label">{scf['DM.UseSaveDM'] === 'true' ? 'True (Read from file)' : 'False (New DM)'}</span>
            </label>
          </FieldRow>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DM.InitSpin — Magnetic State Assistant                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
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
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const lines = (structure.atoms || []).map((_, i) => `${i + 1} +3.00`);
                setSection('scf', { _dmInitSpin: lines.join('\n') });
              }}>
              FM (+3.0 μB)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const lines = (structure.atoms || []).map((_, i) => `${i + 1} ${i % 2 === 0 ? '+3.00' : '-3.00'}`);
                setSection('scf', { _dmInitSpin: lines.join('\n') });
              }}>
              AFM (Alternating ±3.0 μB)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const lines = (structure.atoms || []).map((_, i) => `${i + 1} +3.00 90.0 ${(i * 90) % 360}.0`);
                setSection('scf', { _dmInitSpin: lines.join('\n') });
              }}>
              Non-Collinear Spiral
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSection('scf', { _dmInitSpin: '' })}>
              Clear
            </button>
          </div>
          <textarea
            className="code-area"
            rows={Math.max(3, (structure.atoms || []).length)}
            value={spinBlock}
            onChange={e => setSection('scf', { _dmInitSpin: e.target.value })}
            placeholder={`1 +2.0\n2 -2.0\n# or for NC:\n1 +2.0 90. 0.`}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
