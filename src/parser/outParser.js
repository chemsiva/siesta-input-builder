/**
 * Comprehensive Parser & Feature Extractor for SIESTA stdout (.out / .log) files.
 * Extracts:
 * - Runtime info, version, parallel mode, timestamps
 * - Ground state total energy & full energy decomposition (Hartree, XC, kinetic, etc.)
 * - Fermi energy (E_F), vacuum levels, and work function
 * - SCF convergence history & geometry step counts
 * - Maximum atomic force & force convergence vs tolerance
 * - Hydrostatic pressure & stress tensor components
 * - Final unit cell vectors, lattice parameters & cell volume
 * - Final relaxed atomic coordinates
 * - Electric dipole moment (Debye & a.u.)
 * - Spin magnetic moment (total & components)
 * - Mulliken atomic charges and spin population
 * - Elapsed wall time & CPU routine execution breakdown
 * - Publication-ready Simplified Executive Note generator
 */

export function parseSiestaOut(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid SIESTA output content');
  }

  const lines = text.split(/\r?\n/);
  const result = {
    // Header & Runtime
    version: '',
    startTime: '',
    endTime: '',
    architecture: '',
    compiler: '',
    parallelMode: 'Serial',
    systemName: '',
    systemLabel: '',
    numberOfAtoms: null,
    numberOfSpecies: null,
    speciesList: [],
    meshCutoff: null,
    xcFunctional: '',
    xcAuthors: '',

    // Energetics
    finalEnergyTot: null,
    finalEnergyKS: null,
    freeEnergy: null,
    fermiEnergy: null,
    vacuumLevelMax: null,
    vacuumLevelMean: null,
    workFunction: null,
    energyDecomp: {
      bandStruct: null,
      kinetic: null,
      hartree: null,
      edftu: null,
      eso: null,
      extField: null,
      exchange: null,
      correlation: null,
      exchCorr: null,
      ionElectron: null,
      ionIon: null,
      d3Dispersion: null,
      total: null,
    },

    // Forces, Mechanics & Stress
    maxForce: null,
    isRelaxed: false,
    forces: [],
    pressureSolidKbar: null,
    pressureSolidGPa: null,
    pressureMolKbar: null,
    stressTensorVoigt: null,
    stressTensorMatrix: null,

    // Cell & Geometry
    cellVectors: null,
    cellVolume: null,
    cellAngles: null,
    relaxedCoordinates: [],
    coordsFormat: 'fractional',

    // Electronic & Magnetic
    spinConfig: 'none',
    spinMoment: null, // { sx, sy, sz, total }
    electricDipoleDebye: null, // { x, y, z, total }
    electricDipoleAU: null,
    mullikenPop: [],

    // Convergence & Execution
    normalExit: false,
    scfConverged: true,
    totalGeomSteps: 0,
    totalScfIterations: 0,
    wallTimeSec: null,
    cpuTimeSec: null,
    topRoutines: [],
    scfCycles: [],

    // Auto-generated Simplified Executive Note
    simplifiedNote: '',
  };

  let currentGeomStep = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Version & Runtime Header
    if (/Siesta\s*Version\s*:/i.test(line)) {
      const m = line.match(/Siesta\s*Version\s*:\s*([^\n\r]+)/i);
      if (m && !result.version) result.version = m[1].trim();
    }
    if (/Architecture\s*:/i.test(line)) {
      const m = line.match(/Architecture\s*:\s*([^\n\r]+)/i);
      if (m && !result.architecture && m[1].trim() !== '----') result.architecture = m[1].trim();
    }
    if (/Compiler version\s*:/i.test(line)) {
      const m = line.match(/Compiler version\s*:\s*([^\n\r]+)/i);
      if (m && !result.compiler) result.compiler = m[1].trim();
    }
    if (line.includes('Running in serial mode')) {
      result.parallelMode = 'Serial';
    } else if (/Running on\s*(\d+)\s*nodes/i.test(line)) {
      const m = line.match(/Running on\s*(\d+)\s*nodes/i);
      if (m) result.parallelMode = `MPI (${m[1]} nodes)`;
    } else if (line.includes('MPI version') || line.includes('PARALLEL')) {
      result.parallelMode = 'Parallel MPI';
    }

    if (line.includes('>> Start of run:')) {
      const m = line.match(/>>\s*Start of run:\s*([^\n\r]+)/i);
      if (m) result.startTime = m[1].trim();
    }
    if (line.includes('>> End of run:')) {
      const m = line.match(/>>\s*End of run:\s*([^\n\r]+)/i);
      if (m) result.endTime = m[1].trim();
    }

    // 2. System Identifiers & Species
    if (/reinit:\s*System\s*Name\s*:/i.test(line)) {
      const m = line.match(/System\s*Name\s*:\s*([^\n\r]+)/i);
      if (m && !result.systemName) result.systemName = m[1].trim();
    }
    if (/reinit:\s*System\s*Label\s*:/i.test(line) || /SystemLabel/i.test(line)) {
      const m = line.match(/(?:System\s*Label\s*:?|SystemLabel)\s*(\S+)/i);
      if (m && !result.systemLabel) result.systemLabel = m[1].trim();
    }

    if (/Number of atoms/i.test(line) || /NumberOfAtoms/i.test(line)) {
      const m = line.match(/(?:Number of atoms[^\n:=]*[:=]|NumberOfAtoms)\s*(\d+)/i);
      if (m && !result.numberOfAtoms) result.numberOfAtoms = parseInt(m[1], 10);
    }
    if (/Number of species/i.test(line) || /NumberOfSpecies/i.test(line)) {
      const m = line.match(/(?:Number of species[^\n:=]*[:=]|NumberOfSpecies)\s*(\d+)/i);
      if (m && !result.numberOfSpecies) result.numberOfSpecies = parseInt(m[1], 10);
    }

    // Species details: "Species number: 1 Atomic number: 12 Label: Mg"
    if (line.includes('Species number:') && line.includes('Atomic number:')) {
      const m = line.match(/Species number:\s*(\d+)\s*Atomic number:\s*(\d+)\s*Label:\s*(\S+)/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!result.speciesList.some(s => s.number === num)) {
          result.speciesList.push({
            number: num,
            atomicNumber: parseInt(m[2], 10),
            label: m[3].trim(),
          });
        }
      }
    }

    // Mesh cutoff used
    if (line.includes('Mesh cutoff (required, used) =')) {
      const m = line.match(/Mesh cutoff \(required, used\)\s*=\s*([\d\.]+)\s+([\d\.]+)/);
      if (m) result.meshCutoff = `${parseFloat(m[2]).toFixed(1)} Ry`;
    }

    // Spin configuration
    if (/redata:\s*Spin configuration\s*=/i.test(line)) {
      const m = line.match(/Spin configuration\s*=\s*(\S+)/i);
      if (m) result.spinConfig = m[1].trim().toLowerCase();
    }

    // Geometry Step Tracker
    if (line.includes('new_DM -- step:') || line.includes('siesta: Geometry step =')) {
      const m = line.match(/(?:new_DM -- step:|Geometry step\s*=)\s*(\d+)/i);
      if (m) {
        currentGeomStep = parseInt(m[1], 10);
        if (currentGeomStep > result.totalGeomSteps) {
          result.totalGeomSteps = currentGeomStep;
        }
      }
    }

    // SCF line matching: "scf: 1 -41684.141333 -41866.376305 ..."
    if (line.trim().startsWith('scf:')) {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length >= 7) {
        result.totalScfIterations += 1;
        result.scfCycles.push({
          geomStep: currentGeomStep,
          iscf: parseInt(tokens[1], 10),
          eHarris: parseFloat(tokens[2]),
          eKs: parseFloat(tokens[3]),
          freeEng: parseFloat(tokens[4]),
          dDmax: parseFloat(tokens[5]),
          ef: parseFloat(tokens[6]),
          dHmax: tokens[7] ? parseFloat(tokens[7]) : null,
        });
      }
    }

    if (line.includes('SCF did not converge') || line.includes('SCF_NOT_CONV')) {
      result.scfConverged = false;
    }

    // Fermi Energy
    if (/Fermi/i.test(line)) {
      const m = line.match(/(?:siesta:\s*Fermi|Fermi energy(?:\s*\(eV\))?|Fermi)\s*=\s*([-\d\.eE\+]+)/i);
      if (m) result.fermiEnergy = parseFloat(m[1]);
    }

    // Vacuum Level (from dhscf)
    if (/Vacuum level/i.test(line)) {
      const m = line.match(/Vacuum level\s*\(max,\s*mean\)\s*=\s*([-\d\.eE\+]+)\s+([-\d\.eE\+]+)/i);
      if (m) {
        result.vacuumLevelMax = parseFloat(m[1]);
        result.vacuumLevelMean = parseFloat(m[2]);
      }
    }

    // Kohn-Sham Energy
    if (line.includes('siesta: E_KS(eV) =')) {
      const m = line.match(/siesta:\s*E_KS\(eV\)\s*=\s*([-\d\.]+)/);
      if (m) result.finalEnergyKS = parseFloat(m[1]);
    }

    // Final total energy
    if (/siesta:\s*Total\s*=/i.test(line) || /siesta:\s*Final energy/i.test(line)) {
      const m = line.match(/siesta:\s*Total\s*=\s*([-\d\.]+)/);
      if (m) result.finalEnergyTot = parseFloat(m[1]);
    }

    // Free Energy (Free)E+ p_basis*V_orbitals
    if (line.includes('(Free)E+') || line.includes('siesta: FreeEng =')) {
      const m = line.match(/(?:\(Free\)E\+[^=]*=|FreeEng\s*=)\s*([-\d\.]+)/);
      if (m) result.freeEnergy = parseFloat(m[1]);
    }

    // Max Force
    if (line.includes('siesta: Max force =') || line.includes('Maximum force component =') || line.includes('siesta: max force =')) {
      const m = line.match(/(?:Max force\s*=|Maximum force component\s*=)\s*([-\d\.]+)/i);
      if (m) result.maxForce = parseFloat(m[1]);
    }

    // Relaxation verdict
    if (line.includes('Coordinates relaxed to tolerance') || line.includes('Geometry optimization: converged') || line.includes('Relaxed atomic coordinates')) {
      result.isRelaxed = true;
    }

    // Hydrostatic Pressure (Solid & Molecule in kBar)
    if (/siesta:\s*Pressure\s*\(static\):/i.test(line)) {
      // Look forward up to 5 lines for kBar line
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const kbarMatch = lines[j].match(/([-\d\.]+)\s+([-\d\.]+)\s+kBar/i);
        if (kbarMatch) {
          result.pressureSolidKbar = parseFloat(kbarMatch[1]);
          result.pressureSolidGPa = parseFloat((result.pressureSolidKbar * 0.1).toFixed(4));
          result.pressureMolKbar = parseFloat(kbarMatch[2]);
          break;
        }
      }
    }

    // Stress Tensor Voigt[x,y,z,yz,xz,xy] (kbar)
    if (line.includes('Stress tensor Voigt[x,y,z,yz,xz,xy] (kbar):')) {
      const parts = line.split(':');
      if (parts[1]) {
        const v = parts[1].trim().split(/\s+/).map(Number);
        if (v.length === 6) {
          result.stressTensorVoigt = v;
          result.stressTensorMatrix = [
            [v[0], v[5], v[4]],
            [v[5], v[1], v[3]],
            [v[4], v[3], v[2]],
          ];
        }
      }
    }

    // Cell Vectors (from outcell)
    if (line.includes('outcell: Unit cell vectors (Ang):')) {
      const v1 = lines[i + 1]?.trim().split(/\s+/).map(Number);
      const v2 = lines[i + 2]?.trim().split(/\s+/).map(Number);
      const v3 = lines[i + 3]?.trim().split(/\s+/).map(Number);
      if (v1 && v2 && v3 && v1.length === 3 && v2.length === 3 && v3.length === 3) {
        result.cellVectors = [v1, v2, v3];
      }
    }

    // Cell Volume
    if (/Cell volume/i.test(line)) {
      const m = line.match(/(?:siesta|outcell):\s*Cell volume[^:=]*[:=]\s*([\d\.]+)/i);
      if (m) result.cellVolume = parseFloat(m[1]);
    }

    // Cell Angles
    if (line.includes('outcell: Cell angles (23,13,12) (deg):')) {
      const parts = line.split(':');
      if (parts[1]) {
        const a = parts[1].trim().split(/\s+/).map(Number);
        if (a.length === 3) result.cellAngles = a;
      }
    }

    // Electric Dipole (Debye & a.u.)
    if (line.includes('siesta: Electric dipole (Debye) =')) {
      const m = line.match(/Electric dipole\s*\(Debye\)\s*=\s*([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)/i);
      if (m) {
        const dx = parseFloat(m[1]), dy = parseFloat(m[2]), dz = parseFloat(m[3]);
        result.electricDipoleDebye = {
          x: dx, y: dy, z: dz,
          total: parseFloat(Math.hypot(dx, dy, dz).toFixed(3)),
        };
      }
    }
    if (line.includes('siesta: Electric dipole (a.u.) =')) {
      const m = line.match(/Electric dipole\s*\(a\.u\.\)\s*=\s*([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)/i);
      if (m) {
        const dx = parseFloat(m[1]), dy = parseFloat(m[2]), dz = parseFloat(m[3]);
        result.electricDipoleAU = {
          x: dx, y: dy, z: dz,
          total: parseFloat(Math.hypot(dx, dy, dz).toFixed(3)),
        };
      }
    }

    // Spin Magnetic Moment
    if (line.includes('spin moment: {S}') && line.includes('|S| =')) {
      const m = line.match(/spin moment:\s*\{S\}\s*,\s*\|S\|\s*=\s*\{\s*([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)\s*\}\s+([-\d\.]+)/i);
      if (m) {
        result.spinMoment = {
          sx: parseFloat(m[1]),
          sy: parseFloat(m[2]),
          sz: parseFloat(m[3]),
          total: parseFloat(m[4]),
        };
      }
    }

    // Timing
    if (line.includes('timer: Elapsed wall time (sec) =')) {
      const m = line.match(/timer:\s*Elapsed wall time\s*\(sec\)\s*=\s*([-\d\.]+)/i);
      if (m) result.wallTimeSec = parseFloat(m[1]);
    }
    if (line.includes('timer: CPU execution times (sec):')) {
      // Collect routines
      for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
        const rLine = lines[j];
        if (!rLine.trim() || rLine.includes('>> End of run')) break;
        const rm = rLine.match(/^\s*([A-Za-z0-9_@-]+)\s+(\d+)\s+([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)/);
        if (rm && rm[1] !== 'Routine') {
          result.topRoutines.push({
            routine: rm[1],
            calls: parseInt(rm[2], 10),
            timePerCall: parseFloat(rm[3]),
            totalTime: parseFloat(rm[4]),
            percent: parseFloat(rm[5]),
          });
        }
      }
    }

    // Normal termination
    if (line.includes('Job completed') || line.includes('>> End of run:') || line.includes('0_NORMAL_EXIT')) {
      result.normalExit = true;
    }
  }

  // 3. Extract Energy Decomposition Block (from final occurrence)
  const lastFinalEnergy = text.lastIndexOf('siesta: Final energy (eV):');
  if (lastFinalEnergy !== -1) {
    const block = text.slice(lastFinalEnergy, lastFinalEnergy + 900);
    const map = {
      'Band Struct.': 'bandStruct',
      'Kinetic': 'kinetic',
      'Hartree': 'hartree',
      'Edftu': 'edftu',
      'Eso': 'eso',
      'Ext. field': 'extField',
      'Exch.': 'exchange',
      'Corr.': 'correlation',
      'Exch.-corr.': 'exchCorr',
      'Ion-electron': 'ionElectron',
      'Ion-ion': 'ionIon',
      'D3 dispersion': 'd3Dispersion',
      'Total': 'total',
    };
    for (const [key, prop] of Object.entries(map)) {
      const reg = new RegExp(`siesta:\\s*${key.replace('.', '\\.')}\\s*=\\s*([-\\d\\.]+)`, 'i');
      const m = block.match(reg);
      if (m) result.energyDecomp[prop] = parseFloat(m[1]);
    }
  }

  // 4. Extract Final Atomic Forces Table (from final occurrence)
  const lastForceIdx = text.lastIndexOf('siesta: Atomic forces (eV/Ang):');
  if (lastForceIdx !== -1) {
    const block = text.slice(lastForceIdx, lastForceIdx + 2500);
    const blockLines = block.split('\n');
    const parsedForces = [];
    for (const l of blockLines) {
      if (l.includes('Tot') || l.includes('Stress tensor')) break;
      const m = l.match(/siesta:\s+(\d+)\s+([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)/);
      if (m) {
        const idx = parseInt(m[1], 10);
        const fx = parseFloat(m[2]), fy = parseFloat(m[3]), fz = parseFloat(m[4]);
        parsedForces.push({
          idx,
          fx, fy, fz,
          fmag: parseFloat(Math.hypot(fx, fy, fz).toFixed(4)),
        });
      }
    }
    if (parsedForces.length > 0) {
      result.forces = parsedForces;
      if (result.maxForce === null) {
        result.maxForce = Math.max(...parsedForces.map(f => f.fmag));
      }
    }
  }

  // 5. Extract Final Coordinates (from outcoor)
  const coorMatch = text.match(/outcoor:\s*(?:Final\s*\(unrelaxed\)|Relaxed|Final)\s*atomic coordinates\s*\((fractional|ang)\):\s*([\s\S]*?)(?:siesta:|$)/i);
  if (coorMatch) {
    result.coordsFormat = coorMatch[1].toLowerCase();
    const rows = coorMatch[2].trim().split('\n');
    const parsedCoords = [];
    rows.forEach(r => {
      const tokens = r.trim().split(/\s+/);
      if (tokens.length >= 4 && !isNaN(parseFloat(tokens[0]))) {
        parsedCoords.push({
          x: parseFloat(tokens[0]),
          y: parseFloat(tokens[1]),
          z: parseFloat(tokens[2]),
          speciesIndex: tokens[3] ? parseInt(tokens[3], 10) : 1,
          atomIndex: tokens[4] ? parseInt(tokens[4], 10) : parsedCoords.length + 1,
          symbol: tokens[5] || '',
        });
      }
    });
    result.relaxedCoordinates = parsedCoords;
  }

  // 6. Extract Mulliken Population (from final occurrence)
  const lastMullikenIdx = text.lastIndexOf('mulliken: Atomic and Orbital Populations:');
  if (lastMullikenIdx !== -1) {
    const block = text.slice(lastMullikenIdx);
    const mLines = block.split('\n');
    let curSpecies = '';
    const mPop = [];
    for (const line of mLines) {
      if (line.includes('Species:')) {
        curSpecies = line.split(':')[1].trim();
      }
      const m = line.match(/^\s*(\d+)\s+Total\s+([-\d\.]+)(?:\s+([-\d\.]+))?/i);
      if (m) {
        mPop.push({
          atom: parseInt(m[1], 10),
          species: curSpecies,
          charge: parseFloat(m[2]),
          spin: m[3] ? parseFloat(m[3]) : null,
        });
      }
    }
    result.mullikenPop = mPop;
  }

  // Fallbacks & Secondary Calculations
  if (result.finalEnergyTot === null && result.energyDecomp.total !== null) {
    result.finalEnergyTot = result.energyDecomp.total;
  }
  if (result.finalEnergyTot === null && result.finalEnergyKS !== null) {
    result.finalEnergyTot = result.finalEnergyKS;
  }
  if (result.fermiEnergy === null && result.scfCycles.length > 0) {
    result.fermiEnergy = result.scfCycles[result.scfCycles.length - 1].ef;
  }
  if (result.vacuumLevelMax !== null && result.fermiEnergy !== null) {
    result.workFunction = parseFloat((result.vacuumLevelMax - result.fermiEnergy).toFixed(3));
  }
  if (result.maxForce !== null && result.maxForce < 0.04) {
    result.isRelaxed = true;
  }

  // 7. Generate Simplified Executive Note
  result.simplifiedNote = generateSimplifiedNote(result);

  return result;
}

/**
 * Generates a clean, publication-ready Markdown & text Executive Summary Note.
 */
export function generateSimplifiedNote(res) {
  const sys = res.systemName || res.systemLabel || 'System';
  const label = res.systemLabel || 'siesta';
  const atoms = res.numberOfAtoms || (res.relaxedCoordinates ? res.relaxedCoordinates.length : '?');
  const species = res.numberOfSpecies || (res.speciesList ? res.speciesList.length : '?');
  const dateStr = res.startTime ? res.startTime.split(/\s+/)[0] : 'N/A';

  const statusEmoji = res.normalExit ? '✅' : '⚠️';
  const statusText = res.normalExit ? 'Completed Normally (0_NORMAL_EXIT)' : 'Running / Incomplete / Warning';

  const eTot = res.finalEnergyTot !== null ? `${res.finalEnergyTot.toFixed(4)} eV` : 'N/A';
  const ePerAtom = res.finalEnergyTot !== null && res.numberOfAtoms ? `${(res.finalEnergyTot / res.numberOfAtoms).toFixed(4)} eV/atom` : 'N/A';
  const ef = res.fermiEnergy !== null ? `${res.fermiEnergy.toFixed(3)} eV` : 'N/A';

  // Force & Relaxation Note
  let forceNote = 'Single-point SCF calculation';
  if (res.totalGeomSteps > 0 || res.maxForce !== null) {
    if (res.isRelaxed || (res.maxForce !== null && res.maxForce <= 0.04)) {
      forceNote = `✅ Equilibrium reached! Maximum residual force |F_max| = ${res.maxForce?.toFixed(4)} eV/Å (≤ 0.04 eV/Å tolerance)`;
    } else {
      forceNote = `⚠️ Ongoing relaxation. Current |F_max| = ${res.maxForce?.toFixed(4)} eV/Å across ${res.totalGeomSteps} geometry steps`;
    }
  }

  // Pressure & Stress Note
  const pressNote = res.pressureSolidGPa !== null ? `${res.pressureSolidGPa.toFixed(3)} GPa (${res.pressureSolidKbar?.toFixed(1)} kBar)` : 'N/A';
  const volNote = res.cellVolume !== null ? `${res.cellVolume.toFixed(2)} Å³` : 'N/A';

  // Spin & Dipole Note
  let spinNote = 'Non-spin-polarized';
  if (res.spinConfig !== 'none' || res.spinMoment) {
    spinNote = `Total magnetic moment μ = ${res.spinMoment?.total?.toFixed(3) || '0.000'} μ_B`;
  }
  const dipoleNote = res.electricDipoleDebye ? `${res.electricDipoleDebye.total.toFixed(3)} Debye` : 'None detected';

  // Wall time
  const timeNote = res.wallTimeSec !== null ? `${res.wallTimeSec.toFixed(2)} seconds` : 'N/A';

  return `### 📝 SIESTA Calculation Summary & Simplified Note
**System:** ${sys} (\`${label}\`) | **Atoms:** ${atoms} | **Species:** ${species}
**Run Status:** ${statusEmoji} ${statusText} | **Engine:** SIESTA ${res.version || '5.x'} (${res.parallelMode})
**Execution Date:** ${dateStr} | **Wall Time:** ${timeNote}

---

#### 1. Ground-State Energetics & Fermi Level
- **Final Total Energy ($E_{\\text{tot}}$):** \`${eTot}\` (\`${ePerAtom}\`)
- **Fermi Energy ($E_F$):** \`${ef}\`${res.workFunction !== null ? ` | **Work Function (Φ):** \`${res.workFunction.toFixed(3)} eV\`` : ''}
${res.energyDecomp.exchange !== null ? `- **Exchange-Correlation ($E_{\\text{xc}}$):** \`${res.energyDecomp.exchCorr?.toFixed(2)} eV\` | **Hartree Potential:** \`${res.energyDecomp.hartree?.toFixed(2)} eV\`` : ''}

#### 2. Geometry Relaxation & Mechanical State
- **Equilibrium Status:** ${forceNote}
- **Cell Volume:** \`${volNote}\` | **Hydrostatic Pressure:** \`${pressNote}\`

#### 3. Electronic & Magnetic State
- **Spin Configuration:** ${spinNote}
- **Electric Dipole Moment:** \`${dipoleNote}\`
${res.mullikenPop.length > 0 ? `- **Mulliken Charges:** ${res.mullikenPop.length} atoms resolved with net population partitioning` : ''}

#### 4. Computational Performance
- **Mesh Cutoff Used:** \`${res.meshCutoff || 'N/A'}\` | **Total SCF Iterations:** \`${res.totalScfIterations}\`
- **SCF Convergence:** ${res.scfConverged ? '✅ Converged' : '⚠️ SCF tolerance not reached in limit'}
${res.topRoutines.length > 0 ? `- **Top CPU Routine:** \`${res.topRoutines[0].routine}\` (${res.topRoutines[0].percent}% of runtime)` : ''}
`;
}
