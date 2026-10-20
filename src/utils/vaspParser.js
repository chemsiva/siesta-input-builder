// VASP (POSCAR / CONTCAR) Parser and SIESTA FDF Converter
// Supports VASP 4 & VASP 5, Direct / Cartesian, and Selective Dynamics constraints (ASE GUI output).

export const ELEMENT_Z = {
  H:1, He:2, Li:3, Be:4, B:5, C:6, N:7, O:8, F:9, Ne:10,
  Na:11, Mg:12, Al:13, Si:14, P:15, S:16, Cl:17, Ar:18,
  K:19, Ca:20, Sc:21, Ti:22, V:23, Cr:24, Mn:25, Fe:26,
  Co:27, Ni:28, Cu:29, Zn:30, Ga:31, Ge:32, As:33, Se:34,
  Br:35, Kr:36, Rb:37, Sr:38, Y:39, Zr:40, Nb:41, Mo:42,
  Tc:43, Ru:44, Rh:45, Pd:46, Ag:47, Cd:48, In:49, Sn:50,
  Sb:51, Te:52, I:53, Xe:54, Cs:55, Ba:56, La:57, Ce:58,
  Pr:59, Nd:60, Pm:61, Sm:62, Eu:63, Gd:64, Tb:65, Dy:66,
  Ho:67, Er:68, Tm:69, Yb:70, Lu:71, Hf:72, Ta:73, W:74,
  Re:75, Os:76, Ir:77, Pt:78, Au:79, Hg:80, Tl:81, Pb:82,
  Bi:83, Po:84, At:85, Rn:86, Fr:87, Ra:88, Ac:89, Th:90,
  Pa:91, U:92, Np:93, Pu:94
};

export function parseVaspPoscar(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Please provide or paste a valid VASP POSCAR/CONTCAR string.');
  }

  const rawLines = text.trim().split(/\r?\n/);
  const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 7) {
    throw new Error('Invalid VASP file: Expected at least 7 non-empty lines.');
  }

  const title = lines[0] || 'VASP_Structure';
  const scale = parseFloat(lines[1]);
  if (isNaN(scale) || scale === 0) {
    throw new Error('Invalid lattice scaling factor on line 2 (must be a non-zero number).');
  }

  // Lines 2, 3, 4: Lattice vectors
  const lv = [];
  for (let i = 2; i <= 4; i++) {
    const parts = lines[i].split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) {
      throw new Error(`Invalid lattice vector on line ${i + 1}: "${lines[i]}"`);
    }
    // Multiply by scaling factor if positive
    const factor = scale > 0 ? scale : 1.0;
    lv.push([parts[0] * factor, parts[1] * factor, parts[2] * factor]);
  }

  let lineIdx = 5;
  let speciesNames = [];
  let speciesCounts = [];

  // Check if line 5 contains species symbols (VASP 5 format) or integers (VASP 4 format)
  const tok5 = lines[lineIdx].split(/\s+/);
  const isVasp5 = isNaN(parseInt(tok5[0], 10));

  if (isVasp5) {
    speciesNames = tok5;
    lineIdx++;
    if (lineIdx >= lines.length) throw new Error('Missing atom counts line in VASP POSCAR.');
    speciesCounts = lines[lineIdx].split(/\s+/).map(v => parseInt(v, 10));
    lineIdx++;
  } else {
    // VASP 4: atom counts on line 5, species names inferred or generic
    speciesCounts = tok5.map(v => parseInt(v, 10));
    lineIdx++;
    // Infer species names from title words if possible, else Sp1, Sp2...
    const titleWords = title.split(/[\s_-]+/).filter(w => ELEMENT_Z[w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()]);
    speciesNames = speciesCounts.map((_, idx) => titleWords[idx] || `Sp${idx + 1}`);
  }

  if (speciesCounts.some(isNaN) || speciesCounts.length === 0) {
    throw new Error('Failed to parse atom counts per species in VASP file.');
  }

  // Check for Selective Dynamics (line starts with 's' or 'S')
  let hasSelectiveDynamics = false;
  if (lineIdx < lines.length && lines[lineIdx].toLowerCase().startsWith('s')) {
    hasSelectiveDynamics = true;
    lineIdx++;
  }

  if (lineIdx >= lines.length) {
    throw new Error('Missing coordinate type line (Direct / Cartesian) in VASP POSCAR.');
  }

  // Coordinate type
  const coordTypeLine = lines[lineIdx].toLowerCase();
  const isDirect = coordTypeLine.startsWith('d'); // 'Direct' or 'Direct coordinates'
  const coordFormat = isDirect ? 'Fractional' : 'NotScaledCartesianAng';
  lineIdx++;

  const totalExpectedAtoms = speciesCounts.reduce((a, b) => a + b, 0);
  const atoms = [];
  const fixedConstraints = [];

  let currentSpeciesIdx = 0;
  let countInSpecies = 0;

  for (let aIdx = 0; aIdx < totalExpectedAtoms && lineIdx < lines.length; aIdx++, lineIdx++) {
    const tokens = lines[lineIdx].split(/\s+/);
    if (tokens.length < 3) break;

    const x = parseFloat(tokens[0]);
    const y = parseFloat(tokens[1]);
    const z = parseFloat(tokens[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) break;

    // Track species progression
    while (countInSpecies >= speciesCounts[currentSpeciesIdx] && currentSpeciesIdx < speciesNames.length - 1) {
      currentSpeciesIdx++;
      countInSpecies = 0;
    }
    const elemRaw = speciesNames[currentSpeciesIdx] || 'X';
    const elem = elemRaw.charAt(0).toUpperCase() + elemRaw.slice(1).toLowerCase();
    countInSpecies++;

    // Parse selective dynamics flags if present
    let fx = false; // true if constrained (Fixed)
    let fy = false;
    let fz = false;
    let flagsStr = '';

    if (hasSelectiveDynamics && tokens.length >= 6) {
      fx = tokens[3].toUpperCase().startsWith('F');
      fy = tokens[4].toUpperCase().startsWith('F');
      fz = tokens[5].toUpperCase().startsWith('F');
      flagsStr = `${tokens[3]} ${tokens[4]} ${tokens[5]}`;
    }

    const isConstrained = fx || fy || fz;
    if (isConstrained) {
      fixedConstraints.push({
        atomIdx: aIdx + 1,
        fx,
        fy,
        fz,
        isFullFixed: fx && fy && fz,
        isZOnly: fz && !fx && !fy,
        isXYOnly: fx && fy && !fz,
      });
    }

    atoms.push({
      idx: aIdx + 1,
      x: x.toFixed(8),
      y: y.toFixed(8),
      z: z.toFixed(8),
      species: String(currentSpeciesIdx + 1),
      element: elem,
      label: `${elem}${countInSpecies}`,
      isConstrained,
      flagsStr,
    });
  }

  return {
    title,
    scale,
    lv,
    speciesNames,
    speciesCounts,
    totalAtoms: atoms.length,
    hasSelectiveDynamics,
    isDirect,
    coordFormat,
    atoms,
    fixedConstraints,
  };
}

export function convertVaspToFdf(vaspParsed, options = {}) {
  const {
    title,
    lv,
    speciesNames,
    totalAtoms,
    coordFormat,
    atoms,
    fixedConstraints,
    hasSelectiveDynamics,
  } = vaspParsed;

  const meshCutoff = options.meshCutoff || '350 Ry';
  const xcFunc = options.xcFunc || 'GGA';
  const xcAuthor = options.xcAuthor || 'PBE';
  const label = (options.systemLabel || title).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 24) || 'siesta_calc';

  let fdf = `# ══════════════════════════════════════════════════════════════════════\n`;
  fdf += `# SIESTA 5.x Input File — Converted from VASP POSCAR (ASE GUI)\n`;
  fdf += `# System: ${title}\n`;
  fdf += `# Selective Dynamics: ${hasSelectiveDynamics ? 'Detected (' + fixedConstraints.length + ' constrained atoms)' : 'None (All atoms free)'}\n`;
  fdf += `# ══════════════════════════════════════════════════════════════════════\n\n`;

  fdf += `SystemLabel                  ${label}\n`;
  fdf += `SystemName                   ${title}\n`;
  fdf += `NumberOfAtoms                ${totalAtoms}\n`;
  fdf += `NumberOfSpecies              ${speciesNames.length}\n\n`;

  // %block ChemicalSpeciesLabel
  fdf += `%block ChemicalSpeciesLabel\n`;
  speciesNames.forEach((rawName, i) => {
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    const z = ELEMENT_Z[name] || (i + 1);
    fdf += `  ${String(i + 1).padStart(2)}  ${String(z).padStart(3)}  ${name.padEnd(4)}    ${name}.psf\n`;
  });
  fdf += `%endblock ChemicalSpeciesLabel\n\n`;

  // Lattice
  fdf += `# ── Lattice ─────────────────────────────────────────────\n`;
  fdf += `LatticeConstant              1.0 Ang\n`;
  fdf += `%block LatticeVectors\n`;
  lv.forEach(row => {
    fdf += `  ${row.map(v => v.toFixed(6).padStart(12)).join('  ')}\n`;
  });
  fdf += `%endblock LatticeVectors\n\n`;

  // Coordinates
  fdf += `AtomicCoordinatesFormat      ${coordFormat}\n`;
  fdf += `%block AtomicCoordinatesAndAtomicSpecies\n`;
  atoms.forEach(a => {
    const flagTag = a.flagsStr ? `  [${a.flagsStr}]` : (a.isConstrained ? '  [FIXED]' : '');
    fdf += `  ${a.x.padStart(14)}  ${a.y.padStart(14)}  ${a.z.padStart(14)}  ${a.species}   # ${a.label}${flagTag}\n`;
  });
  fdf += `%endblock AtomicCoordinatesAndAtomicSpecies\n\n`;

  // Constraints if present
  if (fixedConstraints && fixedConstraints.length > 0) {
    fdf += `# ── Constraints (Extracted from VASP Selective Dynamics) ────\n`;
    fdf += `%block Geometry.Constraints\n`;

    const fullFixed = fixedConstraints.filter(c => c.isFullFixed).map(c => c.atomIdx);
    const zOnly = fixedConstraints.filter(c => c.isZOnly).map(c => c.atomIdx);
    const xyOnly = fixedConstraints.filter(c => c.isXYOnly).map(c => c.atomIdx);

    // Full fixed in lines of up to 10 indices
    const chunkSize = 10;
    for (let i = 0; i < fullFixed.length; i += chunkSize) {
      const chunk = fullFixed.slice(i, i + chunkSize);
      fdf += `  atom ${chunk.join(' ')}\n`;
    }

    // Z-only
    zOnly.forEach(idx => {
      fdf += `  atom ${idx}  0.  0.  1.   # fix along Z\n`;
    });

    // XY-only
    xyOnly.forEach(idx => {
      fdf += `  atom ${idx}  1.  1.  0.   # fix in XY plane\n`;
    });

    fdf += `%endblock Geometry.Constraints\n\n`;
  }

  // Standard DFT & SCF block
  fdf += `# ── DFT / Exchange-Correlation ──────────────────────────\n`;
  fdf += `XC.functional                ${xcFunc}\n`;
  fdf += `XC.authors                   ${xcAuthor}\n`;
  fdf += `MeshCutoff                   ${meshCutoff}\n\n`;

  fdf += `# ── SCF Convergence ──────────────────────────────────────\n`;
  fdf += `MaxSCFIterations             150\n`;
  fdf += `DM.Tolerance                 1.0d-4\n`;
  fdf += `DM.MixingWeight              0.25\n`;
  fdf += `DM.NumberPulay               8\n`;
  fdf += `DM.UseSaveDM                 false\n\n`;

  fdf += `# ── Geometry Relaxation ─────────────────────────────────\n`;
  fdf += `MD.TypeOfRun                 CG\n`;
  fdf += `MD.NumCGsteps                200\n`;
  fdf += `MD.MaxForceTol               0.04 eV/Ang\n`;
  fdf += `MD.VariableCell              false\n`;

  return fdf;
}

// Built-in VASP Examples
export const VASP_DEMOS = {
  perovskite_slab: {
    name: 'CsPbI3 Slab (Selective Dynamics — 2 Bottom Layers Fixed)',
    poscar: `CsPbI3 (001) Slab with 2 Bottom Layers Constrained (ASE GUI)
1.0
12.600000 0.000000 0.000000
0.000000 12.600000 0.000000
0.000000 0.000000 36.000000
Cs Pb I
2 2 6
Selective dynamics
Direct
0.00000000 0.00000000 0.12000000 F F F
0.50000000 0.50000000 0.12000000 F F F
0.50000000 0.00000000 0.12000000 F F F
0.00000000 0.50000000 0.12000000 F F F
0.00000000 0.00000000 0.28000000 T T T
0.50000000 0.50000000 0.28000000 T T T
0.50000000 0.00000000 0.28000000 T T T
0.00000000 0.50000000 0.28000000 T T T
0.25000000 0.25000000 0.28000000 T T T
0.75000000 0.75000000 0.28000000 T T T
`,
  },
  tio2_surface: {
    name: 'TiO2 Anatase (101) Slab (Substrate Fixed, Surface Free)',
    poscar: `TiO2 Anatase (101) Slab
1.0
10.239000 0.000000 0.000000
0.000000 7.559000 0.000000
0.000000 0.000000 28.000000
Ti O
4 8
Selective dynamics
Direct
0.25000000 0.25000000 0.10000000 F F F
0.75000000 0.75000000 0.10000000 F F F
0.25000000 0.75000000 0.15000000 F F F
0.75000000 0.25000000 0.15000000 F F F
0.25000000 0.00000000 0.08000000 F F F
0.75000000 0.50000000 0.08000000 F F F
0.25000000 0.50000000 0.12000000 F F F
0.75000000 0.00000000 0.12000000 F F F
0.25000000 0.25000000 0.25000000 T T T
0.75000000 0.75000000 0.25000000 T T T
0.25000000 0.75000000 0.30000000 T T T
0.75000000 0.25000000 0.30000000 T T T
`,
  },
  graphene_monolayer: {
    name: 'Graphene Monolayer (Without Constraints)',
    poscar: `Graphene Monolayer
1.0
2.464000 0.000000 0.000000
-1.232000 2.133887 0.000000
0.000000 0.000000 15.000000
C
2
Direct
0.00000000 0.00000000 0.50000000
0.33333333 0.66666667 0.50000000
`,
  },
};
