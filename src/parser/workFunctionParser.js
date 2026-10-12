/**
 * Parser and Analysis Engine for:
 * 1. 1D Planar Average Electrostatic Potential Profiles V_bar(z)
 * 2. Vacuum Level (V_vac) Detection (Symmetric & Dipolar/Asymmetric)
 * 3. Work Function Calculation: Phi = V_vac - E_Fermi
 * 4. Gaussian Cube (.cube) Potential Grid Slicing
 */

/**
 * Parse 1D Planar Electrostatic Potential file (.dat, .txt, .csv, Macroave).
 * Format:
 * Column 1: z coordinate (Angstrom)
 * Column 2: V_planar (eV)
 */
export function parse1DPotentialData(text, ef = 0) {
  if (!text || typeof text !== 'string') {
    throw new Error('Potential file content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  const z = [];
  const vPlanar = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('@') || line.startsWith('!') || line.startsWith('%')) {
      continue;
    }

    const tokens = line.split(/[\s,;\t]+/).map(Number);
    if (tokens.length >= 2 && !isNaN(tokens[0]) && !isNaN(tokens[1])) {
      z.push(tokens[0]);
      vPlanar.push(tokens[1]);
    }
  }

  if (z.length < 5) {
    throw new Error('Found fewer than 5 numeric points in electrostatic potential file.');
  }

  return analyzeWorkFunction(z, vPlanar, ef);
}

/**
 * Parse Gaussian Cube file (.cube) of electrostatic potential (e.g. from grid2cube .VH)
 * and calculate planar average along z.
 */
export function parsePotentialCube(text, ef = 0) {
  if (!text || typeof text !== 'string') {
    throw new Error('Cube file content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 7) {
    throw new Error('Cube file has insufficient header lines.');
  }

  const l3 = lines[2].trim().split(/\s+/).map(Number);
  const nAtoms = Math.abs(parseInt(l3[0], 10));
  const origZ = l3[3];

  const l4 = lines[3].trim().split(/\s+/).map(Number);
  const l5 = lines[4].trim().split(/\s+/).map(Number);
  const l6 = lines[5].trim().split(/\s+/).map(Number);

  const [nx] = [Math.abs(parseInt(l4[0], 10))];
  const [ny] = [Math.abs(parseInt(l5[0], 10))];
  const [nz, vzX, vzY, vzZ] = [Math.abs(parseInt(l6[0], 10)), l6[1], l6[2], l6[3]];

  const BOHR_TO_ANG = 0.529177210903;
  const stepZ_Ang = Math.sqrt(vzX * vzX + vzY * vzY + vzZ * vzZ) * BOHR_TO_ANG;
  const z0_Ang = origZ * BOHR_TO_ANG;

  const dataStartLine = 6 + nAtoms;
  const gridVals = [];

  for (let i = dataStartLine; i < lines.length; i++) {
    const tokens = lines[i].trim().split(/\s+/);
    for (const t of tokens) {
      if (t.length > 0) gridVals.push(parseFloat(t));
    }
  }

  const z = new Float64Array(nz);
  const vPlanar = new Float64Array(nz);

  for (let k = 0; k < nz; k++) {
    z[k] = z0_Ang + k * stepZ_Ang;
    let sum = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const idx = i * (ny * nz) + j * nz + k;
        sum += gridVals[idx] || 0;
      }
    }
    // Convert Hartree to eV if in atomic units (1 Hartree = 27.211386 eV)
    // Cube potential from DFT is typically in Hartree
    const avgHartree = sum / (nx * ny);
    vPlanar[k] = avgHartree * 27.211386245988;
  }

  return analyzeWorkFunction(Array.from(z), Array.from(vPlanar), ef);
}

/**
 * Analyze Electrostatic Potential profile to extract Vacuum Level(s) and Work Function.
 */
export function analyzeWorkFunction(z, vPlanar, eFermi = 0, userVacRange = null) {
  const n = z.length;
  const zMin = z[0];
  const zMax = z[n - 1];

  let minV = Infinity;
  let maxV = -Infinity;
  let minV_z = z[0];
  let maxV_z = z[0];

  for (let i = 0; i < n; i++) {
    const val = vPlanar[i];
    if (val < minV) { minV = val; minV_z = z[i]; }
    if (val > maxV) { maxV = val; maxV_z = z[i]; }
  }

  // 1. Calculate gradient magnitude |dV/dz|
  const grad = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const dz = z[i + 1] - z[i - 1];
    grad[i] = Math.abs((vPlanar[i + 1] - vPlanar[i - 1]) / dz);
  }
  grad[0] = grad[1];
  grad[n - 1] = grad[n - 2];

  // 2. Identify vacuum region:
  // Vacuum region is typically in the upper half or edges where V is highest and |dV/dz| is lowest
  let vacZMin, vacZMax;
  if (userVacRange && userVacRange.length === 2) {
    vacZMin = userVacRange[0];
    vacZMax = userVacRange[1];
  } else {
    // Auto-detect: find window of 15% width with minimum average gradient and high potential
    const windowSize = Math.max(3, Math.floor(n * 0.15));
    let bestStart = Math.floor(n * 0.7); // default towards end
    let minScore = Infinity;

    for (let i = Math.floor(n * 0.1); i <= n - windowSize - 1; i++) {
      let gradSum = 0;
      let potSum = 0;
      for (let j = 0; j < windowSize; j++) {
        gradSum += grad[i + j];
        potSum += vPlanar[i + j];
      }
      const avgGrad = gradSum / windowSize;
      const avgPot = potSum / windowSize;

      // Score prioritizes low gradient and high potential (vacuum is far above nuclear wells)
      const score = avgGrad - 0.05 * (avgPot - minV) / (maxV - minV || 1);
      if (score < minScore) {
        minScore = score;
        bestStart = i;
      }
    }

    vacZMin = z[bestStart];
    vacZMax = z[bestStart + windowSize - 1];
  }

  // 3. Compute V_vacuum within the plateau window
  let vVacSum = 0;
  let vVacCount = 0;
  for (let i = 0; i < n; i++) {
    if (z[i] >= vacZMin && z[i] <= vacZMax) {
      vVacSum += vPlanar[i];
      vVacCount++;
    }
  }

  const vVacuum = vVacCount > 0 ? vVacSum / vVacCount : maxV;

  // 4. Check for asymmetric / dipolar vacuum levels (Top vs Bottom of cell)
  // Check first 15% (bottom vacuum) and last 15% (top vacuum)
  const nEdge = Math.max(3, Math.floor(n * 0.12));
  let vBottomSum = 0, vTopSum = 0;
  for (let i = 0; i < nEdge; i++) {
    vBottomSum += vPlanar[i];
    vTopSum += vPlanar[n - 1 - i];
  }
  const vVacBottom = vBottomSum / nEdge;
  const vVacTop = vTopSum / nEdge;
  const deltaV_dipole = Math.abs(vVacTop - vVacBottom);
  const isDipolar = deltaV_dipole > 0.05; // potential step > 50 meV indicates polar slab

  // 5. Compute Work Function Phi = V_vac - E_Fermi
  const workFunction = vVacuum - eFermi;
  const phiTop = vVacTop - eFermi;
  const phiBottom = vVacBottom - eFermi;

  return {
    z,
    vPlanar,
    zMin,
    zMax,
    minV,
    maxV,
    minV_z,
    maxV_z,
    vacZMin,
    vacZMax,
    vVacuum,
    eFermi,
    workFunction,
    isDipolar,
    vVacTop,
    vVacBottom,
    deltaV_dipole,
    phiTop,
    phiBottom,
  };
}

/**
 * Generate a realistic demo electrostatic potential profile of a perovskite slab with vacuum.
 * Slab between z = 5.0 and 20.0 A; Vacuum between 20.0 and 36.0 A.
 * EF = -4.38 eV, V_vac = 0.52 eV -> Phi = 4.90 eV.
 */
export function generateDemoPotential() {
  const n = 360;
  const zMin = 0;
  const zMax = 36.0;
  const dz = (zMax - zMin) / (n - 1);

  const z = [];
  const vPlanar = [];
  const eFermi = -4.38; // typical perovskite valence band/Fermi level
  const vVacTarget = 0.52; // vacuum level

  // Atomic layer positions in slab (Angstrom)
  const layers = [6.3, 9.5, 12.6, 15.8, 18.9];

  for (let i = 0; i < n; i++) {
    const zi = zMin + i * dz;
    z.push(zi);

    let pot = vVacTarget;

    // Inside the slab (z = 4.5 to 20.5 A), potential drops into nuclear/ionic wells
    if (zi < 21.0) {
      // Base valence background in slab
      const slabEnvelope = 0.5 * (1 - Math.tanh((zi - 19.5) / 1.2)) * 0.5 * (1 + Math.tanh((zi - 5.5) / 1.2));
      const baseDrop = -16.5 * slabEnvelope;

      // Atomic layer deep oscillating wells
      let layerOsc = 0;
      layers.forEach(lz => {
        layerOsc += -18.0 * Math.exp(-Math.pow((zi - lz) / 0.85, 2));
      });

      pot = vVacTarget + baseDrop + layerOsc;
    } else {
      // In vacuum: smoothly levels off to vVacTarget with minor dipole tail
      const tail = -0.05 * Math.exp(-(zi - 21.0) / 2.5);
      pot = vVacTarget + tail;
    }

    vPlanar.push(pot);
  }

  return analyzeWorkFunction(z, vPlanar, eFermi, [26.0, 34.0]);
}
