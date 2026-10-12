/**
 * FDF Parser — converts .fdf text into a structured JS object
 * Handles: key value, %block...%endblock, # comments, case-insensitive labels
 */

export function parseFDF(text) {
  const lines = text.split(/\r?\n/);
  const result = {
    system: { SystemLabel: 'siesta', SystemName: '', NumberOfAtoms: '', NumberOfSpecies: '' },
    structure: {
      LatticeConstant: '1.0 Ang',
      LatticeVectors: [[1,0,0],[0,1,0],[0,0,1]],
      LatticeParameters: null,
      AtomicCoordinatesFormat: 'Fractional',
      species: [],
      atoms: [],
    },
    dft: { 'XC.functional': 'GGA', 'XC.authors': 'PBE', MeshCutoff: '300 Ry', Spin: 'none', 'Slab.DipoleCorrection': 'false' },
    basis: { 'PAO.BasisSize': 'DZP', 'PAO.BasisType': 'split', 'PAO.EnergyShift': '100 meV', 'PAO.SplitNorm': '0.15' },
    scf: {
      MaxSCFIterations: '200', 'DM.Tolerance': '1e-4', 'DM.MixingWeight': '0.25',
      'DM.NumberPulay': '8', 'SCF.MustConverge': 'true', ElectronicTemperature: '300 K',
      SolutionMethod: 'diagon', 'DM.UseSaveDM': 'false', 'SCF.Mixer.Method': 'pulay',
      'SCF.Mixer.Weight': '', 'SCF.Mixer.History': '', MinSCFIterations: '',
    },
    kpoints: { mode: 'mp', mp: [[8,0,0,0],[0,8,0,0],[0,0,8,0]], kgrid_cutoff: '', BandLines: [], BandLinesScale: 'pi/a' },
    output: {
      WriteMullikenPop: '0', WriteForces: 'false', WriteCoorStep: 'false',
      WriteCoorXmol: 'false', SaveRho: 'false', SaveDeltaRho: 'false',
      SaveElectrostaticPotential: 'false', SaveTotalPotential: 'false',
      LongOutput: 'false', SaveHS: 'false', WriteDM: 'true',
    },
    md: {
      'MD.TypeOfRun': 'CG', 'MD.NumCGsteps': '100', 'MD.MaxForceTol': '0.04 eV/Ang',
      'MD.MaxStressTol': '1.0 GPa', 'MD.VariableCell': 'false', 'MD.MaxDispl': '0.1 Ang',
      'MD.Steps': '1', 'MD.TargetPressure': '0.0 GPa', 'MD.UseSaveXV': 'false',
      'MD.InitialTemperature': '', 'MD.TargetTemperature': '',
    },
    dos: {
      enablePDOS: false,
      useEF: true,
      eMin: '-10.0',
      eMax: '10.0',
      peakWidth: '0.100',
      numPoints: '1000',
      energyUnits: 'eV',
      useCustomKgrid: false,
      pdosKgrid: [12, 12, 12],
      enableLDOS: false,
      ldosMin: '-2.0',
      ldosMax: '0.0',
      ldosUnits: 'eV',
      writeEigenvalues: false,
    },
  };

  // Normalize: strip comments, collapse whitespace
  const clean = (l) => l.replace(/#.*$/, '').trim();

  // Collect blocks first
  const blockMap = {};
  let inBlock = false, blockName = '', blockLines = [];
  const scalar = [];

  for (const rawLine of lines) {
    const l = clean(rawLine);
    if (!l) continue;
    if (/^%block\s+/i.test(l)) {
      inBlock = true;
      blockName = l.replace(/^%block\s+/i, '').split(/\s/)[0].toLowerCase();
      blockLines = [];
    } else if (/^%endblock/i.test(l)) {
      blockMap[blockName] = blockLines;
      inBlock = false; blockName = ''; blockLines = [];
    } else if (inBlock) {
      blockLines.push(l);
    } else {
      scalar.push(l);
    }
  }

  // Parse scalar key→value
  const kv = {};
  for (const l of scalar) {
    const m = l.match(/^(\S+)\s+(.*)/);
    if (m) kv[normalizeKey(m[1])] = m[2].trim();
    else { const k = l.match(/^(\S+)$/); if (k) kv[normalizeKey(k[1])] = 'true'; }
  }

  // Map scalars
  const g = (k) => kv[normalizeKey(k)];
  const setIfPresent = (obj, key, fdfKey) => { const v = g(fdfKey || key); if (v !== undefined) obj[key] = v; };

  // System
  ['SystemLabel','SystemName','NumberOfAtoms','NumberOfSpecies'].forEach(k => setIfPresent(result.system, k));

  // Structure scalars
  setIfPresent(result.structure, 'LatticeConstant');
  setIfPresent(result.structure, 'AtomicCoordinatesFormat');
  setIfPresent(result.structure, 'AtomicCoordinatesOrigin');
  setIfPresent(result.structure, 'AtomCoorFormatOut');

  // LatticeVectors block
  const lv = blockMap['latticevectors'];
  if (lv && lv.length >= 3) {
    result.structure.LatticeVectors = lv.slice(0,3).map(row =>
      row.trim().split(/\s+/).map(Number)
    );
  }

  // LatticeParameters block
  const lp = blockMap['latticeparameters'];
  if (lp && lp.length > 0) {
    const vals = lp[0].trim().split(/\s+/).map(Number);
    result.structure.LatticeParameters = vals;
    result.structure._useLatticeParameters = true;
  }

  // ChemicalSpeciesLabel block
  const csl = blockMap['chemicalspecieslabel'] || blockMap['chemical_species_label'];
  if (csl) {
    result.structure.species = csl.map(row => {
      const parts = row.trim().split(/\s+/);
      return { idx: parts[0], z: parts[1], label: parts[2] || '', psfile: parts[3] || '' };
    });
  }

  // AtomicCoordinatesAndAtomicSpecies block
  const ac = blockMap['atomiccoordinatesandatomicspecies'];
  if (ac) {
    result.structure.atoms = ac.map(row => {
      const parts = row.trim().split(/\s+/);
      return { x: parts[0]||'0', y: parts[1]||'0', z: parts[2]||'0', species: parts[3]||'1', label: parts[4]||'' };
    });
  }

  // DFT
  ['XC.functional','XC.authors','MeshCutoff','Spin',
   'NetCharge','SimulateDoping','Slab.DipoleCorrection','SlabDipoleDirection',
   'DFTD3','DFTD3.BJdamping','DFTD3.UseXCDefaults','DFTD3.Periodic',
   'DFTD3.2BodyCutOff','DFTD3.3BodyCutOff','DFTD3.CoordinationCutoff',
   'DFTD3.s6','DFTD3.rs6','DFTD3.s8','DFTD3.rs8','DFTD3.a1','DFTD3.a2','DFTD3.alpha',
   'MM.Grimme.D3','MM.Grimme.D3.Damping','MM.Grimme.D3.s6','MM.Grimme.D3.sr6','MM.Grimme.D3.s8',
  ].forEach(k => setIfPresent(result.dft, k));

  // ExternalElectricField block
  const efieldBlock = blockMap['externalelectricfield'];
  if (efieldBlock && efieldBlock.length > 0) {
    const tokens = efieldBlock[0].trim().split(/\s+/);
    result.dft['ExternalElectricField.enabled'] = true;
    if (tokens[0]) result.dft['ExternalElectricField.x'] = tokens[0];
    if (tokens[1]) result.dft['ExternalElectricField.y'] = tokens[1];
    if (tokens[2]) result.dft['ExternalElectricField.z'] = tokens[2];
    if (tokens[3]) result.dft['ExternalElectricField.units'] = tokens[3];
  }

  // Slab.DipoleCorrection blocks
  const originBlock = blockMap['slab.dipolecorrection.origin'];
  if (originBlock && originBlock.length > 0) {
    result.dft['Slab.DipoleCorrection.Origin'] = originBlock[0].trim();
  }
  const vacBlock = blockMap['slab.dipolecorrection.vacuum'];
  if (vacBlock) {
    vacBlock.forEach(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith('position')) result.dft['Slab.DipoleCorrection.Vacuum.position'] = trimmed.replace(/^position\s+/, '');
      if (trimmed.startsWith('tolerance')) result.dft['Slab.DipoleCorrection.Vacuum.tolerance'] = trimmed.replace(/^tolerance\s+/, '');
      if (trimmed.startsWith('direction')) result.dft['Slab.DipoleCorrection.Vacuum.direction'] = trimmed.replace(/^direction\s+/, '');
    });
  }
  // Compatibility mapping
  if (result.dft['DFTD3']) {
    result.dft['DFTD3'] = result.dft['DFTD3'].toLowerCase() === 'true' ? 'true' : 'false';
  } else if (result.dft['MM.Grimme.D3']) {
    result.dft['DFTD3'] = result.dft['MM.Grimme.D3'].toLowerCase() === 'true' ? 'true' : 'false';
  }
  // also try lowercase xc.functional
  if (!g('XC.functional') && g('xc.functional')) result.dft['XC.functional'] = g('xc.functional');
  if (!g('XC.authors') && g('xc.authors')) result.dft['XC.authors'] = g('xc.authors');

  // Basis
  ['PAO.BasisSize','PAO.BasisType','PAO.EnergyShift','PAO.SplitNorm',
   'PAO.SplitNormH','PAO.SplitTailNorm','PAO.SoftDefault','PAO.SoftInnerRadius',
   'PAO.SoftPotential','PAO.Polarization.NonPerturbative',
   'BasisPressure','Write.Graphviz','User.Basis','FilterCutoff'].forEach(k => setIfPresent(result.basis, k));

  // SCF
  ['MaxSCFIterations','DM.Tolerance','DM.MixingWeight','DM.NumberPulay',
   'SCF.MustConverge','ElectronicTemperature','SolutionMethod','DM.UseSaveDM',
   'SCF.Mixer.Method','SCF.Mixer.Weight','SCF.Mixer.History','MinSCFIterations'].forEach(k => setIfPresent(result.scf, k));
  // Aliases
  if (g('DM.MixingWeight') && !result.scf['SCF.Mixer.Weight']) {}
  if (g('solution-method')) result.scf.SolutionMethod = g('solution-method');

  // K-points
  const mpBlock = blockMap['kgrid_monkhorst_pack'];
  if (mpBlock && mpBlock.length >= 3) {
    result.kpoints.mode = 'mp';
    result.kpoints.mp = mpBlock.slice(0,3).map(row => row.trim().split(/\s+/).map(Number));
  }
  const kcut = g('kgrid_cutoff') || g('kgridcutoff');
  if (kcut) { result.kpoints.kgrid_cutoff = kcut; if (!mpBlock) result.kpoints.mode = 'cutoff'; }
  const bls = g('BandLinesScale'); if (bls) result.kpoints.BandLinesScale = bls;
  const blBlock = blockMap['bandlines'];
  if (blBlock) {
    result.kpoints.BandLines = blBlock.map(row => {
      const parts = row.trim().split(/\s+/);
      return [Number(parts[0]), Number(parts[1]), Number(parts[2]), Number(parts[3]), parts[4]||''];
    });
  }

  // Output
  ['WriteMullikenPop','WriteForces','WriteCoorStep','WriteCoorXmol',
   'WriteMDXmol','WriteMDhistory',
   'SaveRho','SaveDeltaRho','SaveElectrostaticPotential','SaveTotalPotential','LongOutput','SaveHS','WriteDM'].forEach(k => setIfPresent(result.output, k));

  // MD
  ['MD.TypeOfRun','MD.NumCGsteps','MD.MaxForceTol','MD.MaxStressTol','MD.VariableCell',
   'MD.MaxDispl','MD.Steps','MD.TargetPressure','MD.UseSaveXV','MD.InitialTemperature','MD.TargetTemperature',
   'FC.first','FC.last','FC.Displacement','BornCharge','FC.Save.dHS'].forEach(k => setIfPresent(result.md, k));

  // DOS / PDOS
  const pdosBlock = blockMap['projecteddensityofstates'];
  if (pdosBlock && pdosBlock.length > 0) {
    result.dos.enablePDOS = true;
    const tokens = pdosBlock[0].trim().split(/\s+/);
    if (tokens[0].toUpperCase() === 'EF') {
      result.dos.useEF = true;
      if (tokens[1]) result.dos.eMin = tokens[1];
      if (tokens[2]) result.dos.eMax = tokens[2];
      if (tokens[3]) result.dos.peakWidth = tokens[3];
      if (tokens[4]) result.dos.numPoints = tokens[4];
      if (tokens[5]) result.dos.energyUnits = tokens[5];
    } else {
      result.dos.useEF = false;
      if (tokens[0]) result.dos.eMin = tokens[0];
      if (tokens[1]) result.dos.eMax = tokens[1];
      if (tokens[2]) result.dos.peakWidth = tokens[2];
      if (tokens[3]) result.dos.numPoints = tokens[3];
      if (tokens[4]) result.dos.energyUnits = tokens[4];
    }
  }

  // PDOS k-grid
  const pdosK = g('PDOS.kgrid.MonkhorstPack') || g('PDOS.kgrid.Monkhorst_Pack');
  if (pdosK) {
    result.dos.useCustomKgrid = true;
    const nums = pdosK.replace(/[\[\]]/g, '').trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
    if (nums.length >= 3) result.dos.pdosKgrid = [nums[0], nums[1], nums[2]];
  } else {
    const pdosKBlock = blockMap['pdos.kgrid.monkhorstpack'] || blockMap['pdos.kgrid_monkhorst_pack'] || blockMap['pdos.kgrid.monkhorst_pack'];
    if (pdosKBlock && pdosKBlock.length >= 3) {
      result.dos.useCustomKgrid = true;
      result.dos.pdosKgrid = [
        Number(pdosKBlock[0].trim().split(/\s+/)[0]) || 12,
        Number(pdosKBlock[1].trim().split(/\s+/)[1]) || 12,
        Number(pdosKBlock[2].trim().split(/\s+/)[2]) || 12,
      ];
    }
  }

  // Local Density of States
  const ldosBlock = blockMap['localdensityofstates'];
  if (ldosBlock && ldosBlock.length > 0) {
    result.dos.enableLDOS = true;
    const tokens = ldosBlock[0].trim().split(/\s+/);
    if (tokens[0]) result.dos.ldosMin = tokens[0];
    if (tokens[1]) result.dos.ldosMax = tokens[1];
    if (tokens[2]) result.dos.ldosUnits = tokens[2];
  }

  if (g('WriteEigenvalues') === 'true' || g('WriteEigenvalues') === 'T') {
    result.dos.writeEigenvalues = true;
  }

  return result;
}

function normalizeKey(k) {
  return k.toLowerCase().replace(/[-_.]/g, '');
}
