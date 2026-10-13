/**
 * Parser and Analysis Engine for:
 * 1. 1D Planar Average Electrostatic Potential Profiles V_bar(z)
 * 2. Vacuum Level (V_vac) Detection — correct plateau-finding algorithm
 * 3. Work Function: Φ = V_vac − E_Fermi
 * 4. Gaussian Cube (.cube) Potential Grid Slicing
 *
 * Physical definition:
 *   V_vac  = average of V̄(z) over the flattest, highest-potential region (vacuum gap)
 *   Φ      = V_vac − E_F
 *   For slab calcs: V̄(z) rises from ionic wells → flattens in vacuum → V_vac is the plateau value
 */

// ─── 1D text file parser ──────────────────────────────────────────────────────
export function parse1DPotentialData(text, ef = 0) {
  if (!text || typeof text !== 'string') {
    throw new Error('Potential file content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  const z = [];
  const vPlanar = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('@') ||
        line.startsWith('!') || line.startsWith('%')) continue;

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

// ─── Gaussian Cube parser ─────────────────────────────────────────────────────
export function parsePotentialCube(text, ef = 0) {
  if (!text || typeof text !== 'string') {
    throw new Error('Cube file content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 7) throw new Error('Cube file has insufficient header lines.');

  const l3 = lines[2].trim().split(/\s+/).map(Number);
  const nAtoms = Math.abs(parseInt(l3[0], 10));
  const origZ  = l3[3];

  const l4 = lines[3].trim().split(/\s+/).map(Number);
  const l5 = lines[4].trim().split(/\s+/).map(Number);
  const l6 = lines[5].trim().split(/\s+/).map(Number);

  const nx = Math.abs(parseInt(l4[0], 10));
  const ny = Math.abs(parseInt(l5[0], 10));
  const nz = Math.abs(parseInt(l6[0], 10));
  const [vzX, vzY, vzZ] = [l6[1], l6[2], l6[3]];

  const BOHR_TO_ANG = 0.529177210903;
  const stepZ_Ang = Math.sqrt(vzX * vzX + vzY * vzY + vzZ * vzZ) * BOHR_TO_ANG;
  const z0_Ang = origZ * BOHR_TO_ANG;

  const dataStartLine = 6 + nAtoms;
  const gridVals = [];

  for (let i = dataStartLine; i < lines.length; i++) {
    for (const t of lines[i].trim().split(/\s+/)) {
      if (t.length > 0) gridVals.push(parseFloat(t));
    }
  }

  const z = [];
  const vPlanar = [];

  for (let k = 0; k < nz; k++) {
    z.push(z0_Ang + k * stepZ_Ang);
    let sum = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        sum += gridVals[i * (ny * nz) + j * nz + k] || 0;
      }
    }
    // Cube potential in Hartree → convert to eV
    vPlanar.push((sum / (nx * ny)) * 27.211386245988);
  }

  return analyzeWorkFunction(z, vPlanar, ef);
}

// ─── Core analysis: vacuum detection + work function ─────────────────────────
/**
 * analyzeWorkFunction
 *
 * Vacuum plateau detection algorithm:
 *   1. Smooth V̄(z) with a 5-point running average to suppress numerical noise.
 *   2. Compute |dV/dz| gradient on the smoothed curve.
 *   3. For each sliding window of width W = max(5, 10% of N), score it as:
 *        score = mean(V) − λ·std(V)
 *      where λ = 20, heavily rewarding flat high-potential regions.
 *      (Pure gradient minimisation fails when slab wells have near-zero local gradients.)
 *   4. The window with the highest score IS the vacuum plateau.
 *   5. V_vac = mean of V̄(z) over that window.
 *
 * When userVacRange is supplied (user override), steps 3-4 are skipped.
 */
export function analyzeWorkFunction(z, vPlanar, eFermi = 0, userVacRange = null) {
  const n = z.length;
  const zMin = z[0];
  const zMax = z[n - 1];

  // Global min / max
  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < n; i++) {
    if (vPlanar[i] < minV) minV = vPlanar[i];
    if (vPlanar[i] > maxV) maxV = vPlanar[i];
  }

  // ── Step 1: 5-point running-average smooth ──────────────────────────────
  const vSmooth = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let d = -2; d <= 2; d++) {
      const j = i + d;
      if (j >= 0 && j < n) { sum += vPlanar[j]; cnt++; }
    }
    vSmooth[i] = sum / cnt;
  }

  // ── Step 2: determine vacuum window ────────────────────────────────────
  let vacZMin, vacZMax;

  if (userVacRange && userVacRange.length === 2 &&
      isFinite(userVacRange[0]) && isFinite(userVacRange[1]) &&
      userVacRange[1] > userVacRange[0]) {
    vacZMin = userVacRange[0];
    vacZMax = userVacRange[1];
  } else {
    // Sliding-window plateau search
    const W = Math.max(5, Math.floor(n * 0.10));
    let bestScore = -Infinity;
    let bestStart = Math.floor(n * 0.6); // fallback: upper 40%

    for (let i = 0; i <= n - W; i++) {
      // Window mean and std on the smoothed curve
      let sum = 0;
      for (let j = 0; j < W; j++) sum += vSmooth[i + j];
      const mean = sum / W;

      let varSum = 0;
      for (let j = 0; j < W; j++) varSum += Math.pow(vSmooth[i + j] - mean, 2);
      const std = Math.sqrt(varSum / W);

      // Score = high mean potential AND low variance (flat plateau)
      // Normalize mean to [0,1] so both terms are comparable
      const normMean = (mean - minV) / (maxV - minV + 1e-12);
      const score = normMean - 20.0 * std / (maxV - minV + 1e-12);

      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }

    vacZMin = z[bestStart];
    vacZMax = z[Math.min(bestStart + W - 1, n - 1)];
  }

  // ── Step 3: V_vac = mean of V̄(z) in the plateau window ────────────────
  let vVacSum = 0, vVacCount = 0;
  for (let i = 0; i < n; i++) {
    if (z[i] >= vacZMin && z[i] <= vacZMax) {
      vVacSum += vPlanar[i];
      vVacCount++;
    }
  }
  const vVacuum = vVacCount > 0 ? vVacSum / vVacCount : maxV;

  // ── Step 4: Dipolar detection (top vs bottom vacuum) ───────────────────
  const nEdge = Math.max(3, Math.floor(n * 0.10));
  let vBottomSum = 0, vTopSum = 0;
  for (let i = 0; i < nEdge; i++) {
    vBottomSum += vPlanar[i];
    vTopSum    += vPlanar[n - 1 - i];
  }
  const vVacBottom    = vBottomSum / nEdge;
  const vVacTop       = vTopSum    / nEdge;
  const deltaV_dipole = Math.abs(vVacTop - vVacBottom);
  const isDipolar     = deltaV_dipole > 0.05;

  // ── Step 5: Work function ──────────────────────────────────────────────
  const workFunction = vVacuum - eFermi;
  const phiTop    = vVacTop    - eFermi;
  const phiBottom = vVacBottom - eFermi;

  return {
    z, vPlanar,
    zMin, zMax,
    minV, maxV,
    vacZMin, vacZMax,
    vVacuum, eFermi,
    workFunction,
    isDipolar, vVacTop, vVacBottom, deltaV_dipole,
    phiTop, phiBottom,
  };
}

// ─── Demo potential (benchmark only, not auto-loaded) ─────────────────────────
/**
 * Generates a realistic perovskite slab + vacuum electrostatic potential.
 * Slab: z = 5–20 Å  |  Vacuum: z = 20–36 Å
 * E_F = −4.38 eV,  V_vac ≈ +0.52 eV  →  Φ ≈ 4.90 eV (typical halide perovskite)
 *
 * NOTE: This is only called when the user clicks "Load Demo". It is NOT
 * pre-loaded on section mount, so the Work Function tab starts empty.
 */
export function generateDemoPotential() {
  const n   = 360;
  const zMax = 36.0;
  const dz   = zMax / (n - 1);

  const eFermi     = -4.38;
  const vVacTarget =  0.52;

  // Atomic layer centres in the slab (Å)
  const layers = [6.3, 9.5, 12.6, 15.8, 18.9];

  const z       = [];
  const vPlanar = [];

  for (let i = 0; i < n; i++) {
    const zi = i * dz;
    z.push(zi);

    let pot = vVacTarget;

    if (zi < 21.0) {
      // Slab region: valence background + sharp ionic wells
      const env = 0.5 * (1 - Math.tanh((zi - 19.5) / 1.2)) *
                  0.5 * (1 + Math.tanh((zi -  5.5) / 1.2));
      const baseDrop = -16.5 * env;
      let layerOsc = 0;
      layers.forEach(lz => {
        layerOsc += -18.0 * Math.exp(-Math.pow((zi - lz) / 0.85, 2));
      });
      pot = vVacTarget + baseDrop + layerOsc;
    } else {
      // Vacuum: flat at vVacTarget with tiny exponential tail
      pot = vVacTarget - 0.05 * Math.exp(-(zi - 21.0) / 2.5);
    }

    vPlanar.push(pot);
  }

  // Explicitly tell the analyzer where the vacuum plateau is
  return analyzeWorkFunction(z, vPlanar, eFermi, [24.0, 34.0]);
}

/**
 * Construct a realistic potential profile directly from SIESTA .out values:
 * dhscf: Vacuum level (max, mean) = V_max V_mean eV and E_Fermi
 * This allows plotting the full electrostatic potential profile V̄(z) immediately
 * upon loading a SIESTA .out file, without needing a separate .dat or .cube grid file.
 */
export function generatePotentialFromOut(vVacMax, vVacMean, eFermi, activeMode = 'max') {
  const n = 280;
  const zMax = 32.0;
  const dz = zMax / (n - 1);

  const chosenVac = (activeMode === 'mean' && vVacMean != null) ? vVacMean : vVacMax;
  const z = [];
  const vPlanar = [];

  // Realistic perovskite/semiconductor slab between z = 4.0 and 19.0 A
  // Vacuum region between z = 19.0 and 32.0 A
  const slabLayers = [5.5, 8.5, 11.5, 14.5, 17.5];
  const slabDepth = eFermi - 16.0;

  for (let i = 0; i < n; i++) {
    const zi = i * dz;
    z.push(zi);

    let pot;
    if (zi < 19.0) {
      // Inside slab: valence envelope + periodic atomic core potentials
      const env = 0.5 * (1 - Math.tanh((zi - 18.0) / 1.1)) *
                  0.5 * (1 + Math.tanh((zi - 4.5) / 1.1));
      const baseDrop = (slabDepth - chosenVac) * env;
      let coreOsc = 0;
      slabLayers.forEach(lz => {
        coreOsc += -12.0 * Math.exp(-Math.pow((zi - lz) / 0.8, 2));
      });
      pot = chosenVac + baseDrop + coreOsc;
    } else {
      // In vacuum: smoothly levels off exactly to chosenVac
      const t = (zi - 19.0) / 2.5;
      pot = chosenVac - 0.08 * Math.exp(-t);
      if (zi >= 22.5) {
        pot = chosenVac;
      }
    }
    vPlanar.push(pot);
  }

  const vacZMin = 22.5;
  const vacZMax = 31.0;
  const workFunction = chosenVac - eFermi;
  const deltaV = vVacMean != null ? Math.abs(vVacMax - vVacMean) : 0;

  return {
    z,
    vPlanar,
    zMin: 0,
    zMax: 32.0,
    minV: Math.min(...vPlanar),
    maxV: Math.max(...vPlanar),
    vacZMin,
    vacZMax,
    vVacuum: chosenVac,
    vVacMax,
    vVacMean,
    eFermi,
    workFunction,
    isDipolar: deltaV > 0.05,
    vVacTop: vVacMax,
    vVacBottom: vVacMean != null ? vVacMean : vVacMax,
    deltaV_dipole: deltaV,
    phiTop: vVacMax - eFermi,
    phiBottom: (vVacMean != null ? vVacMean : vVacMax) - eFermi,
    fromOutFile: true,
  };
}
