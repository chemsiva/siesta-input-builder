/**
 * Parser and Analysis Engine for:
 * 1. 1D Planar Average Charge Density Difference (CDD) data
 * 2. Gaussian Cube (.cube) 3D volumetric grid files
 * 3. Numerical Integration of Cumulative Charge Transfer Delta Q(z)
 * 4. Interface Dipole Moment & Work Function Shift Delta Phi
 */

// Elementary constants
const E_CHARGE = 1.602176634e-19; // Coulomb
const EPSILON_0 = 8.8541878128e-12; // F/m = C/(V*m)
const DEBYE_PER_E_ANG = 4.80320427; // 1 e*Angstrom = 4.8032 Debye

/**
 * Parse 1D Planar Average file (.dat, .txt, .csv).
 * Supports 2-column (z, DeltaRho) or 3-column (z, DeltaRho, DeltaQ).
 */
export function parse1DPlanarData(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('File content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  const z = [];
  const deltaRho = [];
  const rawDeltaQ = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('@') || line.startsWith('!') || line.startsWith('%')) {
      continue;
    }

    const tokens = line.split(/[\s,;\t]+/).map(Number);
    if (tokens.length >= 2 && !isNaN(tokens[0]) && !isNaN(tokens[1])) {
      z.push(tokens[0]);
      deltaRho.push(tokens[1]);
      if (tokens.length >= 3 && !isNaN(tokens[2])) {
        rawDeltaQ.push(tokens[2]);
      }
    }
  }

  if (z.length < 3) {
    throw new Error('Found fewer than 3 numeric rows in planar average file.');
  }

  return analyzePlanarCDD(z, deltaRho, rawDeltaQ.length === z.length ? rawDeltaQ : null);
}

/**
 * Parse Gaussian Cube file (.cube) and compute planar average along z.
 */
export function parseCubeAndComputePlanar(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Cube file is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 7) {
    throw new Error('Cube file has insufficient header lines.');
  }

  // Line 3: natoms, origin (x, y, z) in Bohr
  const l3 = lines[2].trim().split(/\s+/).map(Number);
  const nAtoms = Math.abs(parseInt(l3[0], 10));
  const [origX, origY, origZ] = [l3[1], l3[2], l3[3]];

  // Lines 4-6: grid dimensions and voxel step vectors (Bohr)
  const l4 = lines[3].trim().split(/\s+/).map(Number);
  const l5 = lines[4].trim().split(/\s+/).map(Number);
  const l6 = lines[5].trim().split(/\s+/).map(Number);

  const [nx, vxX, vxY, vxZ] = [Math.abs(parseInt(l4[0], 10)), l4[1], l4[2], l4[3]];
  const [ny, vyX, vyY, vyZ] = [Math.abs(parseInt(l5[0], 10)), l5[1], l5[2], l5[3]];
  const [nz, vzX, vzY, vzZ] = [Math.abs(parseInt(l6[0], 10)), l6[1], l6[2], l6[3]];

  // Bohr to Angstrom conversion factor
  const BOHR_TO_ANG = 0.529177210903;

  // Grid start line (skip header + atoms)
  const dataStartLine = 6 + nAtoms;
  const gridVals = [];

  for (let i = dataStartLine; i < lines.length; i++) {
    const tokens = lines[i].trim().split(/\s+/);
    for (const t of tokens) {
      if (t.length > 0) gridVals.push(parseFloat(t));
    }
  }

  const totalPoints = nx * ny * nz;
  if (gridVals.length < totalPoints * 0.95) {
    throw new Error(`Incomplete cube grid data: expected ${totalPoints} points, parsed ${gridVals.length}.`);
  }

  // Gaussian cube order: for i=0..nx-1; for j=0..ny-1; for k=0..nz-1
  // Calculate planar average along z (k index)
  const z = new Float64Array(nz);
  const deltaRho = new Float64Array(nz);
  const stepZ_Ang = Math.sqrt(vzX * vzX + vzY * vzY + vzZ * vzZ) * BOHR_TO_ANG;
  const z0_Ang = origZ * BOHR_TO_ANG;

  for (let k = 0; k < nz; k++) {
    z[k] = z0_Ang + k * stepZ_Ang;
    let sum = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const idx = i * (ny * nz) + j * nz + k;
        sum += gridVals[idx] || 0;
      }
    }
    deltaRho[k] = sum / (nx * ny);
  }

  return analyzePlanarCDD(Array.from(z), Array.from(deltaRho));
}

/**
 * Perform comprehensive physical analysis on Planar Average CDD profiles.
 */
export function analyzePlanarCDD(z, deltaRho, existingDeltaQ = null, cellArea = 100.0) {
  const n = z.length;
  const deltaQ = new Float64Array(n);

  let maxAccum = -Infinity;
  let maxAccumZ = z[0];
  let maxDeplet = Infinity;
  let maxDepletZ = z[0];

  // 1. Identify extrema
  for (let i = 0; i < n; i++) {
    const val = deltaRho[i];
    if (val > maxAccum) {
      maxAccum = val;
      maxAccumZ = z[i];
    }
    if (val < maxDeplet) {
      maxDeplet = val;
      maxDepletZ = z[i];
    }
  }

  // 2. Numerical integration for Cumulative Charge Transfer Delta Q(z) = \int_0^z DeltaRho(z') dz'
  if (existingDeltaQ && existingDeltaQ.length === n) {
    for (let i = 0; i < n; i++) deltaQ[i] = existingDeltaQ[i];
  } else {
    deltaQ[0] = 0;
    for (let i = 1; i < n; i++) {
      const dz = z[i] - z[i - 1];
      const avgVal = (deltaRho[i] + deltaRho[i - 1]) * 0.5;
      deltaQ[i] = deltaQ[i - 1] + avgVal * dz;
    }
  }

  // 3. Find Interface Z: position where DeltaRho crosses zero between depletion and accumulation
  let zInterface = (maxAccumZ + maxDepletZ) * 0.5;
  const zMinExtrema = Math.min(maxAccumZ, maxDepletZ);
  const zMaxExtrema = Math.max(maxAccumZ, maxDepletZ);

  for (let i = 1; i < n; i++) {
    if (z[i] >= zMinExtrema && z[i] <= zMaxExtrema) {
      if ((deltaRho[i - 1] < 0 && deltaRho[i] >= 0) || (deltaRho[i - 1] > 0 && deltaRho[i] <= 0)) {
        // Linear interpolation for exact zero crossing
        const t = -deltaRho[i - 1] / (deltaRho[i] - deltaRho[i - 1]);
        zInterface = z[i - 1] + t * (z[i] - z[i - 1]);
        break;
      }
    }
  }

  // 4. Net Transferred Charge (Delta q) at interface
  let netChargeTransfer = 0;
  for (let i = 0; i < n; i++) {
    if (z[i] >= zInterface) {
      netChargeTransfer = deltaQ[i];
      break;
    }
  }

  // 5. Interface Dipole Moment Delta mu = \int z * DeltaRho(z) dz
  let dipoleMomentEAng = 0;
  for (let i = 1; i < n; i++) {
    const dz = z[i] - z[i - 1];
    const avgIntegrand = (z[i] * deltaRho[i] + z[i - 1] * deltaRho[i - 1]) * 0.5;
    dipoleMomentEAng += avgIntegrand * dz;
  }
  const dipoleDebye = dipoleMomentEAng * DEBYE_PER_E_ANG;

  // 6. Work Function Shift: Delta Phi = - (e * DeltaMu) / (epsilon_0 * Area)
  // In SI: (e * dipoleMoment [e*m]) / (epsilon_0 * Area [m^2])
  // Using eV: Delta Phi [eV] = - (1.602e-19 * dipoleMoment [m] / (epsilon_0 * Area [m^2]))
  // Converted from Angstrom: 1 e*Ang / (epsilon_0 * 1 Ang^2) = 180.951 eV
  const areaVal = Math.max(1.0, cellArea);
  const workFunctionShiftEV = -180.95126 * (dipoleMomentEAng / areaVal);

  return {
    z,
    deltaRho,
    deltaQ: Array.from(deltaQ),
    zMin: z[0],
    zMax: z[n - 1],
    maxAccum,
    maxAccumZ,
    maxDeplet,
    maxDepletZ,
    zInterface,
    netChargeTransfer,
    dipoleMomentEAng,
    dipoleDebye,
    workFunctionShiftEV,
  };
}

/**
 * Generate a realistic demo dataset representing molecular adsorption on a perovskite surface.
 */
export function generateDemoCDD() {
  const n = 300;
  const zMin = 0;
  const zMax = 32.0; // 32 Angstrom c-axis with vacuum
  const dz = (zMax - zMin) / (n - 1);

  const z = [];
  const deltaRho = [];

  // Surface at z = 16.0 A, Adsorbate at z = 19.5 A
  // Surface electron depletion around 16.5 A (width 1.2 A)
  // Interface accumulation around 18.2 A (width 1.0 A)
  // Adsorbate minor polarization around 20.0 A
  for (let i = 0; i < n; i++) {
    const zi = zMin + i * dz;
    z.push(zi);

    // Two Gaussian wavepackets simulating charge transfer across interface
    const depletion = -0.42 * Math.exp(-Math.pow((zi - 16.4) / 1.1, 2));
    const accumulation = 0.45 * Math.exp(-Math.pow((zi - 18.1) / 0.95, 2));
    const molPolarization = -0.08 * Math.exp(-Math.pow((zi - 20.2) / 0.8, 2)) +
                             0.05 * Math.exp(-Math.pow((zi - 21.2) / 0.7, 2));

    const val = depletion + accumulation + molPolarization;
    deltaRho.push(val);
  }

  return analyzePlanarCDD(z, deltaRho, null, 12.64 * 12.64);
}
