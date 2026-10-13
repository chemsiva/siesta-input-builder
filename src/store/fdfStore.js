import { create } from 'zustand';
import { parseCIF } from '../parser/cifParser.js';
import { parseFDF } from '../parser/fdfParser.js';
import { serializeFDF } from '../parser/fdfSerializer.js';
import templates from '../data/templates.json';

const defaultState = {
  system:    { SystemLabel: 'siesta', SystemName: '', NumberOfAtoms: '', NumberOfSpecies: '' },
  structure: {
    LatticeConstant: '1.0 Ang',
    LatticeVectors: [[1,0,0],[0,1,0],[0,0,1]],
    LatticeParameters: null,
    _useLatticeParameters: false,
    AtomicCoordinatesFormat: 'Fractional',
    AtomicCoordinatesOrigin: 'none', // Section 6.4: 'none' | 'COP' | 'COM' | 'MIN' | 'COP-Z' | 'COM-Z' | 'MIN-Z'
    AtomCoorFormatOut: '',          // Section 6.4: '' | 'Fractional' | 'Ang' | 'Bohr'
    SuperCell: null,                // Section 6.4: 3x3 integer matrix or null
    species: [],
    atoms: [],
  },
  dft: {
    'XC.functional': 'GGA', 'XC.authors': 'PBE', MeshCutoff: '300 Ry', Spin: 'none',
    // Section 6.2: Hybrid & Mixed Functionals (%block XC.mix)
    useHybridXC: false,
    hybridPreset: 'pbe0',
    xcMixRows: [
      { func: 'GGA', author: 'PBE', weightX: '0.75', weightC: '1.00' },
      { func: 'LDA', author: 'CA',  weightX: '0.25', weightC: '0.00' },
    ],
    // Section 6.23: Net Charge, Dipole Correction & Electric Fields
    NetCharge: '',
    SimulateDoping: 'false',
    'Slab.DipoleCorrection': 'none', // 'none' | 'charge' | 'vacuum'
    SlabDipoleDirection: 'z',        // 'z' | '+z' | '-z' | 'x' | 'y'
    'ExternalElectricField.enabled': false,
    'ExternalElectricField.x': '0.000',
    'ExternalElectricField.y': '0.000',
    'ExternalElectricField.z': '0.500',
    'ExternalElectricField.units': 'V/Ang',
    'Slab.DipoleCorrection.Origin': '',
    'Slab.DipoleCorrection.Vacuum.position': '',
    'Slab.DipoleCorrection.Vacuum.tolerance': '',
    'Slab.DipoleCorrection.Vacuum.direction': '0.000 0.000 1.000',
    // Section 6.26: DFT-D3
    'DFTD3': 'false',
    'DFTD3.BJdamping': 'true',
    'DFTD3.UseXCDefaults': 'true',
    'DFTD3.Periodic': '[1 2 3]',
    'DFTD3.2BodyCutOff': '',
    'DFTD3.3BodyCutOff': '',
    'DFTD3.CoordinationCutoff': '',
    'DFTD3.s6': '',
    'DFTD3.rs6': '',
    'DFTD3.s8': '',
    'DFTD3.rs8': '',
    'DFTD3.a1': '',
    'DFTD3.a2': '',
    'DFTD3.alpha': '',
  },
  basis: {
    'PAO.BasisSize': 'DZP',
    'PAO.BasisType': 'split',
    'PAO.EnergyShift': '100 meV',
    'PAO.SplitNorm': '0.15',
    // Section 6.3.3 Basis Sizes & Per-Species
    usePerSpeciesBasisSizes: false,
    speciesBasisSizes: {},
    // Section 6.3.5 Multiple-Zeta Generation
    'PAO.SplitNormH': '',
    'PAO.SplitTailNorm': 'true',
    'PAO.SplitValence.Legacy': 'false',
    'PAO.FixSplitTable': 'false',
    'PAO.EnergyCutoff': '20 Ry',
    'PAO.EnergyPolCutoff': '20 Ry',
    'PAO.ContractionCutoff': '0',
    // Section 6.3.6 Polarization Options
    'PAO.Polarization.NonPerturbative': 'false',
    'PAO.Polarization.Rc-Expansion-Factor': '1.0',
    'PAO.Polarization.NonPerturbative.Fallback': 'true',
    usePerSpeciesPolarization: false,
    speciesPolarizationSchemes: {},
    // Confinement & Sparsity
    'PAO.SoftDefault': 'true',
    'PAO.SoftInnerRadius': '0.9',
    'PAO.SoftPotential': '40 Ry',
    'BasisPressure': '',
    'Write.Graphviz': 'none',
    'User.Basis': 'false',
    'FilterCutoff': '',
  },
  scf: {
    MaxSCFIterations: '200', 'DM.Tolerance': '1e-4', 'DM.MixingWeight': '0.25',
    'DM.NumberPulay': '8', 'SCF.MustConverge': 'true', ElectronicTemperature: '300 K',
    SolutionMethod: 'diagon', 'DM.UseSaveDM': 'false', 'SCF.Mixer.Method': 'pulay',
    'SCF.Mixer.Weight': '', 'SCF.Mixer.History': '', MinSCFIterations: '',
  },
  kpoints: { mode: 'mp', mp: [[8,0,0,0],[0,8,0,0],[0,0,8,0]], kgrid_cutoff: '', BandLines: [], BandLinesScale: 'pi/a' },
  output: {
    WriteMullikenPop: '0', WriteForces: 'false', WriteCoorStep: 'false',
    WriteCoorXmol: 'false', WriteMDXmol: 'false', WriteMDhistory: 'false',
    SaveRho: 'false', SaveDeltaRho: 'false',
    SaveElectrostaticPotential: 'false', SaveTotalPotential: 'false',
    LongOutput: 'false', SaveHS: 'false', WriteDM: 'true',
    // COOP / COHP
    'COOP.Write': 'false',
    'WFS.Energy.Min': '',
    'WFS.Energy.Max': '',
    'WFS.Band.Min': '',
    'WFS.Band.Max': '',
    // Optical
    OpticalCalculation: 'false',
    'Optical.Energy.Minimum': '0.0 eV',
    'Optical.Energy.Maximum': '20.0 eV',
    'Optical.Broaden': '0.1 eV',
    'Optical.Scissor': '0.0 eV',
    'Optical.NumberOfBands': '',
    'Optical.PolarizationType': 'polycrystal',
    'Optical.Vector': '1.0 0.0 0.0',
    'Optical.OffsetMesh': 'false',
    'Optical.Mesh': '5 5 5',
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
  pseudoSettings: {
    directory: '',       // browser-scanned folder name (read-only, from webkitRelativePath)
    pseudoPath: '',      // full server-side absolute path typed by user (used in SIESTA_PS_PATH)
    format: 'psf',
    detectedFiles: [],   // filenames discovered by folder scan
  },
  activeSection: 'system',
  validationErrors: [],
};

export const useFDFStore = create((set, get) => ({
  ...defaultState,

  setSection: (section, data) => set(state => {
    const next = { ...state, [section]: { ...state[section], ...data } };
    return next;
  }),

  setActiveSection: (s) => set({ activeSection: s }),

  setField: (section, key, value) => set(state => ({
    [section]: { ...state[section], [key]: value },
  })),

  loadFromText: (text) => {
    try {
      const parsed = parseFDF(text);
      set({ ...parsed, activeSection: get().activeSection, validationErrors: [] });
    } catch (e) {
      console.error('FDF parse error:', e);
    }
  },
  loadFromCIF: (cifText) => {
    try {
      const parsed = parseCIF(cifText);
      set(state => ({
        system: { ...state.system, ...parsed.system },
        structure: { ...state.structure, ...parsed.structure },
        activeSection: 'structure',
        validationErrors: [],
      }));
      get().autoAssignPseudopotentials();
    } catch (e) {
      console.error('CIF parse error:', e);
      alert('Failed to parse CIF file: ' + e.message);
    }
  },
  setPseudoSettings: (settings) => {
    set(state => ({
      pseudoSettings: { ...state.pseudoSettings, ...settings }
    }));
    get().autoAssignPseudopotentials();
  },

  autoAssignPseudopotentials: () => {
    const { structure, pseudoSettings } = get();
    const { pseudoPath, directory, format, detectedFiles } = pseudoSettings;
    if (!structure.species || structure.species.length === 0) return;

    const dir = (pseudoPath || directory || '').trim().replace(/\/+$/, '');

    const updatedSpecies = structure.species.map(sp => {
      const sym = (sp.label || '').trim();
      if (!sym) return sp;
      let matchedFile = `${sym}.${format || 'psf'}`;

      if (detectedFiles && detectedFiles.length > 0) {
        const ext = `.${format || 'psf'}`;
        // 1. exact match: Pb.psf
        const exact = detectedFiles.find(f => f.toLowerCase() === `${sym.toLowerCase()}${ext}`);
        if (exact) {
          matchedFile = exact;
        } else {
          // 2. prefix match: Pb_pbe.psf, Pb.pbe-dn.psml
          const prefix = detectedFiles.find(f => {
            const lower = f.toLowerCase();
            return (lower.startsWith(sym.toLowerCase() + '.') ||
                    lower.startsWith(sym.toLowerCase() + '_') ||
                    lower.startsWith(sym.toLowerCase() + '-')) && lower.endsWith(ext);
          });
          if (prefix) matchedFile = prefix;
        }
      }

      // If full directory path is provided, prepend it so FDF has the exact full path!
      const finalPath = dir ? `${dir}/${matchedFile}` : matchedFile;
      return { ...sp, psfile: finalPath };
    });

    set(state => ({
      structure: { ...state.structure, species: updatedSpecies },
    }));
  },

  loadTemplate: (templateKey) => {
    const t = templates[templateKey];
    if (!t) return;
    const vals = t.values;
    set(state => ({
      system:    { ...state.system,    ...vals.system },
      structure: { ...state.structure, ...vals.structure },
      dft:       { ...state.dft,       ...vals.dft },
      basis:     { ...state.basis,     ...vals.basis },
      scf:       { ...state.scf,       ...vals.scf },
      kpoints:   { ...state.kpoints,   ...vals.kpoints },
      output:    { ...state.output,    ...vals.output },
      md:        { ...state.md,        ...vals.md },
      dos:       vals.dos ? { ...state.dos, ...vals.dos } : state.dos,
      validationErrors: [],
    }));
  },

  getFDFText: () => serializeFDF(get()),

  validate: () => {
    const state = get();
    const errors = [];
    if (!state.system.SystemLabel?.trim()) errors.push('SystemLabel is required.');
    if (!state.structure.species?.length) errors.push('At least one species required in ChemicalSpeciesLabel.');
    if (!state.dft.MeshCutoff?.trim()) errors.push('MeshCutoff is required.');
    if (!state.dft['XC.functional']) errors.push('XC.functional is required.');
    if (!state.basis['PAO.BasisSize']) errors.push('PAO.BasisSize is required.');
    if (state.kpoints.mode === 'mp') {
      const mp = state.kpoints.mp;
      if (!mp || mp.length !== 3 || mp.some(row => row.some(v => isNaN(v)))) {
        errors.push('kgrid_Monkhorst_Pack must have 3 rows of 4 numbers.');
      }
    }
    set({ validationErrors: errors });
    return errors;
  },

  reset: () => set({ ...defaultState }),
}));
