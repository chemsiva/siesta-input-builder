/**
 * Robust Parser for SIESTA .MDE (Molecular Dynamics & Relaxation history) files.
 * Handles:
 * - Standard 6-column SIESTA format: Step, T(K), E_KS(eV), E_tot(eV), Vol(A^3), P(kBar)
 * - Flexible 2, 3, 4, 5-column formats (e.g. constant volume NVE, non-periodic molecules)
 * - Fortran glued negative numbers without spaces (e.g. -40923.06220-40923.06220)
 * - Fortran double precision exponents (e.g. -4.0923D+04 -> -4.0923e+04)
 * - Multiple header repetitions from restarted MD runs (MD.UseSaveXV T)
 * - Comma-separated or whitespace-separated values
 */
export function parseMDE(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid MDE file content');
  }

  const lines = text.split(/\r?\n/);
  const steps = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Skip headers (whether prefixed with # or not)
    const lower = line.toLowerCase();
    if (lower.includes('step') && (lower.includes('t') || lower.includes('e_tot') || lower.includes('e_ks') || lower.includes('vol') || lower.includes('p'))) {
      continue;
    }

    if (line.startsWith('#') || line.startsWith('@') || line.startsWith('*') || line.startsWith('!')) {
      continue;
    }

    // 1. Convert Fortran D/d exponents to e (e.g. -4.0923D+04 -> -4.0923e+04)
    line = line.replace(/(\d)[dD]([+-]?\d+)/g, '$1e$2');

    // 2. Separate merged Fortran numbers (e.g. -40923.06220-40923.06220 -> -40923.06220 -40923.06220)
    line = line.replace(/(\d)([-+])/g, '$1 $2');

    // 3. Replace commas with spaces
    line = line.replace(/,/g, ' ');

    // Extract all numeric tokens
    const tokens = line.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

    if (tokens.length >= 2) {
      let step = 0, temp = 0, eKs = 0, eTot = 0, volume = 0, pressure = 0;

      if (tokens.length >= 6) {
        // Standard: step, temp, eKs, eTot, volume, pressure
        step = tokens[0];
        temp = tokens[1];
        eKs = tokens[2];
        eTot = tokens[3];
        volume = tokens[4];
        pressure = tokens[5];
      } else if (tokens.length === 5) {
        // step, temp, eKs, eTot, volume
        step = tokens[0];
        temp = tokens[1];
        eKs = tokens[2];
        eTot = tokens[3];
        volume = tokens[4];
      } else if (tokens.length === 4) {
        // step, temp, eKs, eTot
        step = tokens[0];
        temp = tokens[1];
        eKs = tokens[2];
        eTot = tokens[3];
      } else if (tokens.length === 3) {
        // step, eKs, eTot
        step = tokens[0];
        eKs = tokens[1];
        eTot = tokens[2];
      } else if (tokens.length === 2) {
        // step, eTot
        step = tokens[0];
        eTot = tokens[1];
        eKs = tokens[1];
      }

      steps.push({
        step: Math.round(step),
        temp: parseFloat(temp.toFixed(2)),
        eKs: parseFloat(eKs.toFixed(5)),
        eTot: parseFloat(eTot.toFixed(5)),
        volume: parseFloat(volume.toFixed(3)),
        pressure: parseFloat(pressure.toFixed(3)),
      });
    }
  }

  if (steps.length === 0) {
    throw new Error('No numeric MD/relaxation steps found in file. Ensure file contains numerical data columns (Step, Temp, Energy).');
  }

  // Summary statistics with safe fallbacks
  const eInitial = steps[0]?.eTot ?? 0;
  const eFinal = steps[steps.length - 1]?.eTot ?? 0;
  const deltaE = eFinal - eInitial;

  const validTemps = steps.map(s => s.temp).filter(t => !isNaN(t) && t !== 0);
  const tempAvg = validTemps.length > 0 ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : (steps[0]?.temp ?? 0);
  const tempVariance = validTemps.length > 0 ? validTemps.reduce((acc, t) => acc + (t - tempAvg) ** 2, 0) / validTemps.length : 0;
  const tempStd = Math.sqrt(tempVariance);

  const validPress = steps.map(s => s.pressure).filter(p => !isNaN(p) && p !== 0);
  const pressureAvg = validPress.length > 0 ? validPress.reduce((a, b) => a + b, 0) / validPress.length : (steps[0]?.pressure ?? 0);

  const vInitial = steps[0]?.volume ?? 0;
  const vFinal = steps[steps.length - 1]?.volume ?? 0;
  const deltaVolPercent = vInitial !== 0 ? ((vFinal - vInitial) / vInitial) * 100 : 0;

  return {
    steps,
    totalSteps: steps.length,
    summary: {
      eInitial: parseFloat(eInitial.toFixed(5)),
      eFinal: parseFloat(eFinal.toFixed(5)),
      deltaE: parseFloat(deltaE.toFixed(5)),
      tempAvg: parseFloat(tempAvg.toFixed(2)),
      tempStd: parseFloat(tempStd.toFixed(2)),
      pressureAvg: parseFloat(pressureAvg.toFixed(2)),
      vInitial: parseFloat(vInitial.toFixed(3)),
      vFinal: parseFloat(vFinal.toFixed(3)),
      deltaVolPercent: parseFloat(deltaVolPercent.toFixed(2)),
    },
  };
}
