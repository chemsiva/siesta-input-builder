/**
 * FDF Serializer — converts the store state object back to a .fdf string
 */

const pad = (k, v, w = 28) => `${k.padEnd(w)} ${v}`;
const line = (k, v, w = 28) => v !== '' && v !== undefined && v !== null ? pad(k, v, w) : null;
const bool = (v) => (v === true || v === 'true' || v === 'T' || v === 't' || v === 'yes') ? 'true' : 'false';

export function serializeFDF(state) {
  const { system, structure, dft, basis, scf, kpoints, output, md, dos } = state;
  const pseudoDir = (state.pseudoSettings && state.pseudoSettings.pseudoPath
    ? state.pseudoSettings.pseudoPath
    : (state.pseudoSettings && state.pseudoSettings.directory ? state.pseudoSettings.directory : '')
  ).trim().replace(/\/+$/, '');
  const sections = [];

  // ── System ─────────────────────────────────────────────────────────────────
  sections.push(sec('System', [
    line('SystemLabel',      system.SystemLabel),
    line('SystemName',       system.SystemName),
    line('NumberOfAtoms',    system.NumberOfAtoms),
    line('NumberOfSpecies',  system.NumberOfSpecies),
  ]));

  // ── Species ──────────────────────────────────────────────────────────────
  // SIESTA supports 4th column for pseudopotential file or full absolute path!
  // e.g.:  1  82  Pb  /scratch/pseudos/Pb.psf
  // Note: libfdf has a hard limit of 132 chars per line in Fortran. If full path fits
  // (<= 115 chars), we embed it directly; if longer, we keep filename and rely on SIESTA_PS_PATH.
  if (structure.species && structure.species.length > 0) {
    const rows = structure.species.map(s => {
      let psSpec = (s.psfile || '').trim();
      let fullCandidate = psSpec;
      if (pseudoDir && psSpec && !psSpec.includes('/')) {
        fullCandidate = `${pseudoDir}/${psSpec}`;
      } else if (pseudoDir && !psSpec) {
        fullCandidate = `${pseudoDir}/${s.label}.${state.pseudoSettings?.format || 'psf'}`;
      }

      const baseLine = `  ${s.idx.toString().padStart(2)}  ${s.z.toString().padStart(3)}  ${s.label.padEnd(4)}`;
      let psPart = '';
      if (fullCandidate && (baseLine.length + 4 + fullCandidate.length) <= 115) {
        psPart = `    ${fullCandidate}`;
      } else if (fullCandidate) {
        const fnameOnly = fullCandidate.split('/').pop();
        psPart = `    ${fnameOnly}`;
      }
      return `${baseLine}${psPart}`;
    });
    sections.push(block('ChemicalSpeciesLabel', rows));
  }

  // ── Lattice ───────────────────────────────────────────────────────────────
  const latLines = [`# ── Lattice ─────────────────────────────────────────────`];
  latLines.push(pad('LatticeConstant', structure.LatticeConstant || '1.0 Ang'));
  if (structure._useLatticeParameters && structure.LatticeParameters) {
    latLines.push(block('LatticeParameters', [structure.LatticeParameters.map(v => v.toString().padStart(10)).join(' ')]));
  } else {
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    latLines.push(block('LatticeVectors', lv.map(row =>
      row.map(v => Number(v).toFixed(6).padStart(12)).join('')
    )));
  }

  sections.push(latLines.join('\n'));

  // ── Atomic coordinates (Section 6.4) ──────────────────────────────────────
  const coordLines = [];
  coordLines.push(pad('AtomicCoordinatesFormat', structure.AtomicCoordinatesFormat || 'Fractional'));
  if (structure.AtomicCoordinatesOrigin && structure.AtomicCoordinatesOrigin !== 'none') {
    coordLines.push(pad('AtomicCoordinatesOrigin', structure.AtomicCoordinatesOrigin));
  }
  if (structure.AtomCoorFormatOut) {
    coordLines.push(pad('AtomCoorFormatOut', structure.AtomCoorFormatOut));
  }
  if (structure.SuperCell && structure.SuperCell.length === 3) {
    coordLines.push(block('SuperCell', structure.SuperCell.map(row => `  ${row.join('  ')}`)));
  }
  if (structure.atoms && structure.atoms.length > 0) {
    const rows = structure.atoms.map(a =>
      `  ${Number(a.x).toFixed(8).padStart(14)}  ${Number(a.y).toFixed(8).padStart(14)}  ${Number(a.z).toFixed(8).padStart(14)}  ${a.species}${a.label ? '   # '+a.label : ''}`
    );
    coordLines.push(block('AtomicCoordinatesAndAtomicSpecies', rows));
  } else {
    coordLines.push('%block AtomicCoordinatesAndAtomicSpecies\n%endblock AtomicCoordinatesAndAtomicSpecies');
  }
  sections.push(coordLines.join('\n'));

  // ── XC / DFT ──────────────────────────────────────────────────────────────
  const d3Lines = [];
  if (bool(dft['DFTD3']) === 'true' || bool(dft['d3.dispersion']) === 'true') {
    d3Lines.push(line('DFTD3', 'true'));
    d3Lines.push(line('DFTD3.BJdamping', bool(dft['DFTD3.BJdamping']) !== 'false' ? 'true' : 'false'));
    d3Lines.push(line('DFTD3.UseXCDefaults', bool(dft['DFTD3.UseXCDefaults']) !== 'false' ? 'true' : 'false'));
    if (dft['DFTD3.Periodic']) d3Lines.push(line('DFTD3.Periodic', dft['DFTD3.Periodic']));
    if (dft['DFTD3.2BodyCutOff']) d3Lines.push(line('DFTD3.2BodyCutOff', dft['DFTD3.2BodyCutOff']));
    if (dft['DFTD3.3BodyCutOff']) d3Lines.push(line('DFTD3.3BodyCutOff', dft['DFTD3.3BodyCutOff']));
    if (dft['DFTD3.CoordinationCutoff']) d3Lines.push(line('DFTD3.CoordinationCutoff', dft['DFTD3.CoordinationCutoff']));
    if (bool(dft['DFTD3.UseXCDefaults']) === 'false') {
      if (dft['DFTD3.s6']) d3Lines.push(line('DFTD3.s6', dft['DFTD3.s6']));
      if (dft['DFTD3.rs6']) d3Lines.push(line('DFTD3.rs6', dft['DFTD3.rs6']));
      if (dft['DFTD3.s8']) d3Lines.push(line('DFTD3.s8', dft['DFTD3.s8']));
      if (dft['DFTD3.rs8']) d3Lines.push(line('DFTD3.rs8', dft['DFTD3.rs8']));
      if (dft['DFTD3.a1']) d3Lines.push(line('DFTD3.a1', dft['DFTD3.a1']));
      if (dft['DFTD3.a2']) d3Lines.push(line('DFTD3.a2', dft['DFTD3.a2']));
      if (dft['DFTD3.alpha']) d3Lines.push(line('DFTD3.alpha', dft['DFTD3.alpha']));
    }
  }
  // ── Section 6.23: Net Charge, Dipole Correction & Electric Field ───────────
  const chargeDipoleLines = [];
  if (dft.NetCharge && dft.NetCharge.trim() && dft.NetCharge.trim() !== '0') {
    chargeDipoleLines.push(line('NetCharge', dft.NetCharge.trim()));
  }
  if (bool(dft.SimulateDoping) === 'true') {
    chargeDipoleLines.push(line('SimulateDoping', 'true'));
  }
  const dipoleMode = dft['Slab.DipoleCorrection'];
  if (dipoleMode === 'charge' || dipoleMode === 'true') {
    chargeDipoleLines.push(line('Slab.DipoleCorrection', 'charge'));
    chargeDipoleLines.push(line('SlabDipoleDirection', dft.SlabDipoleDirection || 'z'));
  } else if (dipoleMode === 'vacuum') {
    chargeDipoleLines.push(line('Slab.DipoleCorrection', 'vacuum'));
    chargeDipoleLines.push(line('SlabDipoleDirection', dft.SlabDipoleDirection || 'z'));
  }

  if (dft.useHybridXC && dft.xcMixRows && dft.xcMixRows.length > 0) {
    const xcLines = [
      `# Hybrid / Mixed Functional enabled (%block XC.mix)`,
      line('MeshCutoff',      dft.MeshCutoff),
      line('Spin',            dft.Spin && dft.Spin !== 'none' ? dft.Spin : null),
      ...d3Lines,
      ...chargeDipoleLines,
    ];
    sections.push(sec('Exchange-Correlation', xcLines));

    // %block XC.mix
    const mixLines = [`  ${dft.xcMixRows.length}`];
    dft.xcMixRows.forEach(row => {
      mixLines.push(`  ${row.func || 'GGA'} ${row.author || 'PBE'} ${row.weightX ?? '1.0'} ${row.weightC ?? '1.0'}`);
    });
    sections.push(block('XC.mix', mixLines));
  } else {
    const isHyb = dft['XC.functional'] === 'HYB';
    const xcLines = [
      line('XC.functional',   dft['XC.functional']),
      line('XC.authors',      dft['XC.authors']),
      line('MeshCutoff',      dft.MeshCutoff),
      line('Spin',            dft.Spin && dft.Spin !== 'none' ? dft.Spin : null),
      ...d3Lines,
      ...chargeDipoleLines,
    ];

    if (isHyb) {
      xcLines.push('');
      xcLines.push('# Hybrid NAO2GTO Parameters (CPC 2026 paper)');
      if (dft['Hybrid.NGauss']) xcLines.push(line('Hybrid.NGauss', dft['Hybrid.NGauss']));
      if (dft['Hybrid.EpsGauss']) xcLines.push(line('Hybrid.EpsGauss', dft['Hybrid.EpsGauss']));
      if (dft['Hybrid.ScreeningThreshold']) xcLines.push(line('Hybrid.ScreeningThreshold', dft['Hybrid.ScreeningThreshold']));
    }

    sections.push(sec(`Exchange-Correlation${isHyb ? ` (${dft['XC.authors'] || 'HSE06'} Hybrid)` : ''}`, xcLines));
  }

  // External Electric Field block
  if (dft['ExternalElectricField.enabled'] === true || dft['ExternalElectricField.enabled'] === 'true') {
    const ex = dft['ExternalElectricField.x'] || '0.000';
    const ey = dft['ExternalElectricField.y'] || '0.000';
    const ez = dft['ExternalElectricField.z'] || '0.000';
    const eu = dft['ExternalElectricField.units'] || 'V/Ang';
    sections.push(block('ExternalElectricField', [`  ${ex}  ${ey}  ${ez}  ${eu}`]));
  }

  // Slab.DipoleCorrection.Origin block (charge mode)
  if ((dipoleMode === 'charge' || dipoleMode === 'true') && dft['Slab.DipoleCorrection.Origin']?.trim()) {
    sections.push(block('Slab.DipoleCorrection.Origin', [`  ${dft['Slab.DipoleCorrection.Origin'].trim()}`]));
  }

  // Slab.DipoleCorrection.Vacuum block (vacuum mode)
  if (dipoleMode === 'vacuum') {
    const vacRows = [];
    if (dft['Slab.DipoleCorrection.Vacuum.position']?.trim()) {
      vacRows.push(`  position ${dft['Slab.DipoleCorrection.Vacuum.position'].trim()}`);
    }
    if (dft['Slab.DipoleCorrection.Vacuum.tolerance']?.trim()) {
      vacRows.push(`  tolerance ${dft['Slab.DipoleCorrection.Vacuum.tolerance'].trim()}`);
    }
    if (dft['Slab.DipoleCorrection.Vacuum.direction']?.trim()) {
      vacRows.push(`  direction ${dft['Slab.DipoleCorrection.Vacuum.direction'].trim()}`);
    }
    if (vacRows.length > 0) {
      sections.push(block('Slab.DipoleCorrection.Vacuum', vacRows));
    }
  }
  // ── DFT+U ────────────────────────────────────────────────────────────────
  if (dft.dfu && dft.dfu.length > 0) {
    const dfuRows = [];
    dft.dfu.forEach(item => {
      if (item.enabled) {
        dfuRows.push(`  ${item.speciesLabel}  1`);
        const nTag = item.n ? `n=${item.n} ` : '';
        dfuRows.push(`    ${nTag}${item.l || 2}`);
        dfuRows.push(`      ${parseFloat(item.U || 0).toFixed(2)}  ${parseFloat(item.J || 0).toFixed(2)}`);
        dfuRows.push(`      0.00`);
      }
    });
    if (dfuRows.length > 0) {
      sections.push(block('DFTU.Proj', dfuRows));
    }
  }


  // ── Basis Set (Section 6.3) ───────────────────────────────────────────────
  const basisLines = [
    line('PAO.BasisSize',   basis['PAO.BasisSize']),
    line('PAO.BasisType',   basis['PAO.BasisType']),
    line('PAO.EnergyShift', basis['PAO.EnergyShift']),
    basis['PAO.SplitNorm'] ? line('PAO.SplitNorm', basis['PAO.SplitNorm']) : null,
    basis['PAO.SplitNormH'] ? line('PAO.SplitNormH', basis['PAO.SplitNormH']) : null,
    basis['PAO.SplitTailNorm'] === 'false' ? line('PAO.SplitTailNorm', 'false') : null,
    bool(basis['PAO.SplitValence.Legacy']) === 'true' ? line('PAO.SplitValence.Legacy', 'true') : null,
    bool(basis['PAO.FixSplitTable']) === 'true' ? line('PAO.FixSplitTable', 'true') : null,
    // Filteret multiple-zeta generation (when PAO.BasisType is filteret)
    basis['PAO.BasisType'] === 'filteret' && basis['PAO.EnergyCutoff'] ? line('PAO.EnergyCutoff', basis['PAO.EnergyCutoff']) : null,
    basis['PAO.BasisType'] === 'filteret' && basis['PAO.EnergyPolCutoff'] ? line('PAO.EnergyPolCutoff', basis['PAO.EnergyPolCutoff']) : null,
    basis['PAO.BasisType'] === 'filteret' && basis['PAO.ContractionCutoff'] ? line('PAO.ContractionCutoff', basis['PAO.ContractionCutoff']) : null,
    // Confinement
    basis['PAO.SoftDefault'] !== 'false' && basis['PAO.SoftDefault'] ? line('PAO.SoftDefault', 'true') : null,
    basis['PAO.SoftInnerRadius'] ? line('PAO.SoftInnerRadius', basis['PAO.SoftInnerRadius']) : null,
    basis['PAO.SoftPotential'] ? line('PAO.SoftPotential', basis['PAO.SoftPotential']) : null,
    basis['BasisPressure'] ? line('BasisPressure', basis['BasisPressure']) : null,
    // Polarization (Section 6.3.6)
    bool(basis['PAO.Polarization.NonPerturbative']) === 'true' ? line('PAO.Polarization.NonPerturbative', 'true') : null,
    basis['PAO.Polarization.Rc-Expansion-Factor'] && basis['PAO.Polarization.Rc-Expansion-Factor'] !== '1.0' ? line('PAO.Polarization.Rc-Expansion-Factor', basis['PAO.Polarization.Rc-Expansion-Factor']) : null,
    basis['PAO.Polarization.NonPerturbative.Fallback'] === 'false' ? line('PAO.Polarization.NonPerturbative.Fallback', 'false') : null,
    basis['Write.Graphviz'] && basis['Write.Graphviz'] !== 'none' ? line('Write.Graphviz', basis['Write.Graphviz']) : null,
    bool(basis['User.Basis']) === 'true' ? line('User.Basis', 'true') : null,
    basis['FilterCutoff'] ? line('FilterCutoff', basis['FilterCutoff']) : null,
  ];
  sections.push(sec('Basis Set', basisLines));

  // %block PAO.BasisSizes (Section 6.3.3)
  if (basis.usePerSpeciesBasisSizes && basis.speciesBasisSizes && Object.keys(basis.speciesBasisSizes).length > 0) {
    const sizeRows = Object.entries(basis.speciesBasisSizes).map(([sp, sz]) => `  ${sp}  ${sz}`);
    sections.push(block('PAO.BasisSizes', sizeRows));
  }

  // %block PAO.Polarization.Scheme (Section 6.3.6)
  if (basis.usePerSpeciesPolarization && basis.speciesPolarizationSchemes && Object.keys(basis.speciesPolarizationSchemes).length > 0) {
    const polRows = Object.entries(basis.speciesPolarizationSchemes).map(([sp, sch]) => `  ${sp}  ${sch}`);
    sections.push(block('PAO.Polarization.Scheme', polRows));
  }

  // ── SCF ───────────────────────────────────────────────────────────────────
  sections.push(sec('SCF', [
    line('MaxSCFIterations',     scf.MaxSCFIterations),
    scf.MinSCFIterations ? line('MinSCFIterations', scf.MinSCFIterations) : null,
    line('DM.Tolerance',         scf['DM.Tolerance']),
    line('DM.MixingWeight',      scf['DM.MixingWeight']),
    line('DM.NumberPulay',       scf['DM.NumberPulay']),
    scf['SCF.Mixer.Method'] && scf['SCF.Mixer.Method'] !== 'pulay' ? line('SCF.Mixer.Method', scf['SCF.Mixer.Method']) : null,
    scf['SCF.Mixer.Weight'] ? line('SCF.Mixer.Weight', scf['SCF.Mixer.Weight']) : null,
    scf['SCF.Mixer.History'] ? line('SCF.Mixer.History', scf['SCF.Mixer.History']) : null,
    line('SCF.MustConverge',     scf['SCF.MustConverge']),
    line('ElectronicTemperature',scf.ElectronicTemperature),
    line('SolutionMethod',       scf.SolutionMethod),
    line('DM.UseSaveDM',         scf['DM.UseSaveDM']),
  ]));
  // ── Initial Spin Moments ──────────────────────────────────────────────────
  if (scf._dmInitSpin && scf._dmInitSpin.trim()) {
    const spinRows = scf._dmInitSpin.trim().split(/\r?\n/).map(l => `  ${l.trim()}`).filter(l => l.trim().length > 0);
    if (spinRows.length > 0) {
      sections.push(block('DM.InitSpin', spinRows));
    }
  }


  // ── K-points ──────────────────────────────────────────────────────────────
  const kLines = [`# ── K-Points ─────────────────────────────────────────────`];
  if (kpoints.mode === 'mp' && kpoints.mp && kpoints.mp.length === 3) {
    const rows = kpoints.mp.map(row =>
      row.map((v, i) => i < 3 ? String(v).padStart(4) : String(v).padStart(6)).join(' ')
    );
    kLines.push(block('kgrid_Monkhorst_Pack', rows));
  } else if (kpoints.mode === 'cutoff' && kpoints.kgrid_cutoff) {
    kLines.push(pad('kgrid_cutoff', kpoints.kgrid_cutoff));
  }
  if (kpoints.BandLines && kpoints.BandLines.length > 0) {
    kLines.push(pad('BandLinesScale', kpoints.BandLinesScale || 'pi/a'));
    const blRows = kpoints.BandLines.map(b =>
      `${String(b[0]).padStart(3)}  ${Number(b[1]).toFixed(4).padStart(8)}  ${Number(b[2]).toFixed(4).padStart(8)}  ${Number(b[3]).toFixed(4).padStart(8)}  ${b[4]||''}`
    );
    kLines.push(block('BandLines', blRows));
  }
  sections.push(kLines.join('\n'));

  // ── Output flags ──────────────────────────────────────────────────────────
  const outFlags = [
    'WriteMullikenPop','WriteForces','WriteCoorStep','WriteCoorXmol',
    'WriteMDXmol','WriteMDhistory',
    'SaveRho','SaveDeltaRho','SaveElectrostaticPotential','SaveTotalPotential',
    'LongOutput','SaveHS','WriteDM',
  ];
  sections.push(sec('Output', outFlags.map(k => {
    const v = output[k];
    if (v === undefined || v === '' || v === null) return null;
    if (v === 'false' || v === 'F' || v === false) return null;
    return line(k, v);
  })));

  // ── COOP / COHP ───────────────────────────────────────────────────────────
  if (output['COOP.Write'] === 'true') {
    const coopLines = [`# ── COOP / COHP (Crystal-Orbital Overlap/Hamilton Populations) ─`];
    coopLines.push(line('COOP.Write', 'true'));
    if (output['WFS.Energy.Min']) coopLines.push(line('WFS.Energy.Min', output['WFS.Energy.Min']));
    if (output['WFS.Energy.Max']) coopLines.push(line('WFS.Energy.Max', output['WFS.Energy.Max']));
    if (output['WFS.Band.Min'])   coopLines.push(line('WFS.Band.Min',   output['WFS.Band.Min']));
    if (output['WFS.Band.Max'])   coopLines.push(line('WFS.Band.Max',   output['WFS.Band.Max']));
    sections.push(coopLines.join('\n'));
  }

  // ── Optical Properties ────────────────────────────────────────────────────
  if (output['OpticalCalculation'] === 'true') {
    const optLines = [`# ── Optical Properties ─────────────────────────────────────────`];
    optLines.push(line('OpticalCalculation', 'true'));
    if (output['Optical.Energy.Minimum']) optLines.push(line('Optical.Energy.Minimum', output['Optical.Energy.Minimum']));
    if (output['Optical.Energy.Maximum']) optLines.push(line('Optical.Energy.Maximum', output['Optical.Energy.Maximum']));
    if (output['Optical.Broaden'])        optLines.push(line('Optical.Broaden',        output['Optical.Broaden']));
    if (output['Optical.Scissor'])        optLines.push(line('Optical.Scissor',        output['Optical.Scissor']));
    if (output['Optical.NumberOfBands'])  optLines.push(line('Optical.NumberOfBands',  output['Optical.NumberOfBands']));
    optLines.push(line('Optical.PolarizationType', output['Optical.PolarizationType'] || 'polycrystal'));
    if (output['Optical.OffsetMesh'] === 'true') optLines.push(line('Optical.OffsetMesh', 'true'));
    // Mesh block
    const meshVals = (output['Optical.Mesh'] || '5 5 5').trim().split(/\s+/);
    optLines.push(`%block Optical.Mesh\n  ${meshVals.join(' ')}\n%endblock Optical.Mesh`);
    // Vector block (only needed for polarized/unpolarized)
    const polType = output['Optical.PolarizationType'] || 'polycrystal';
    if (polType === 'polarized' || polType === 'unpolarized') {
      const vec = (output['Optical.Vector'] || '1.0 0.0 0.0').trim().split(/\s+/);
      optLines.push(`%block Optical.Vector\n  ${vec.join(' ')}\n%endblock Optical.Vector`);
    }
    sections.push(optLines.join('\n'));
  }

  // ── MD / Relaxation ───────────────────────────────────────────────────────
  const mdLines = [`# ── MD / Relaxation ─────────────────────────────────────`];
  mdLines.push(line('MD.TypeOfRun',        md['MD.TypeOfRun']));
  if (md['MD.TypeOfRun'] === 'CG') {
    mdLines.push(line('MD.NumCGsteps',     md['MD.NumCGsteps']));
    mdLines.push(line('MD.MaxForceTol',    md['MD.MaxForceTol']));
    mdLines.push(line('MD.MaxDispl',       md['MD.MaxDispl']));
    if (bool(md['MD.VariableCell']) === 'true') {
      mdLines.push(line('MD.VariableCell', 'true'));
      mdLines.push(line('MD.MaxStressTol', md['MD.MaxStressTol']));
      mdLines.push(line('MD.TargetPressure', md['MD.TargetPressure']));
    }
  } else if (['Verlet','Nose','ParrinelloRahman','NoseParrinelloRahman','Anneal'].includes(md['MD.TypeOfRun'])) {
    mdLines.push(line('MD.Steps',               md['MD.Steps']));
    if (md['MD.InitialTemperature']) mdLines.push(line('MD.InitialTemperature', md['MD.InitialTemperature']));
    if (md['MD.TargetTemperature'])  mdLines.push(line('MD.TargetTemperature',  md['MD.TargetTemperature']));
  } else if (md['MD.TypeOfRun'] === 'FC') {
    mdLines.push(line('FC.first',        md['FC.first'] || '1'));
    mdLines.push(line('FC.last',         md['FC.last'] || (structure.atoms && structure.atoms.length ? String(structure.atoms.length) : '1')));
    mdLines.push(line('FC.Displacement', md['FC.Displacement'] || '0.04 Bohr'));
    if (bool(md['BornCharge']) === 'true') mdLines.push(line('BornCharge', 'true'));
    if (bool(md['FC.Save.dHS']) === 'true') mdLines.push(line('FC.Save.dHS', 'true'));
  }
  if (bool(md['MD.UseSaveXV']) === 'true') mdLines.push(line('MD.UseSaveXV', 'true'));
  sections.push(mdLines.filter(Boolean).join('\n'));
  // ── DOS & PDOS ────────────────────────────────────────────────────────────
  if (dos && (dos.enablePDOS || dos.enableLDOS || dos.writeEigenvalues)) {
    const dosLines = [`# ── Density of States (DOS / PDOS) ───────────────────────`];
    if (dos.enablePDOS) {
      const efPrefix = dos.useEF ? 'EF ' : '';
      const pdosRow = `  ${efPrefix}${dos.eMin}  ${dos.eMax}  ${dos.peakWidth}  ${dos.numPoints}  ${dos.energyUnits || 'eV'}`;
      dosLines.push(block('ProjectedDensityOfStates', [pdosRow]));
      if (dos.useCustomKgrid && dos.pdosKgrid && dos.pdosKgrid.length === 3) {
        dosLines.push(block('PDOS.kgrid_Monkhorst_Pack', [
          `  ${dos.pdosKgrid[0]}   0   0   0.0`,
          `   0  ${dos.pdosKgrid[1]}   0   0.0`,
          `   0   0  ${dos.pdosKgrid[2]}   0.0`,
        ]));
      }
    }
    if (dos.enableLDOS) {
      const efPrefix = dos.ldosUseEF ? 'EF ' : '';
      const ldosRow = `  ${efPrefix}${dos.ldosMin ?? '-3.50'}  ${dos.ldosMax ?? '0.00'}  ${dos.ldosUnits || 'eV'}`;
      dosLines.push(block('LocalDensityOfStates', [ldosRow]));
      if (dos.useCustomLdosKgrid && dos.ldosKgrid && dos.ldosKgrid.length === 3) {
        dosLines.push(block('LDOS.kgrid_Monkhorst_Pack', [
          `  ${dos.ldosKgrid[0]}   0   0   0.0`,
          `   0  ${dos.ldosKgrid[1]}   0   0.0`,
          `   0   0  ${dos.ldosKgrid[2]}   0.0`,
        ]));
      }
    }
    if (dos.writeEigenvalues) {
      dosLines.push(line('WriteEigenvalues', 'true'));
    }
    sections.push(dosLines.join('\n'));
  }


  const psPathLine = pseudoDir
    ? `# SIESTA_PS_PATH: ${pseudoDir}\n# To run: export SIESTA_PS_PATH="${pseudoDir}" && mpirun -np 4 siesta < ${system.SystemLabel || 'siesta'}.fdf | tee ${system.SystemLabel || 'siesta'}.out\n#`
    : '';
  return `# ══════════════════════════════════════════════════════════════════════\n# SIESTA 5.x Input File — generated by SIESTA Input Builder\n${psPathLine ? psPathLine + '\n' : ''}# ══════════════════════════════════════════════════════════════════════\n\n` +
    sections.filter(Boolean).join('\n\n') + '\n';
}

function sec(title, items) {
  const body = items.filter(Boolean).join('\n');
  if (!body.trim()) return null;
  return `# ── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}\n${body}`;
}

function block(name, rows) {
  return `%block ${name}\n${rows.join('\n')}\n%endblock ${name}`;
}
