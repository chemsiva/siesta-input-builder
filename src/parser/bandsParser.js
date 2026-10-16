/**
 * SIESTA .bands File Parser and Electronic Dispersion Analysis Engine
 * Complies with Section 6.16 of the SIESTA 5.4.2 User Guide.
 */

/**
 * Parse SIESTA .bands file content.
 *
 * Format:
 * Line 1: FermiEnergy (eV)
 * Line 2: kmin, kmax (range along k-lines path)
 * Line 3: Emin, Emax (global eigenvalue range)
 * Line 4: NumberOfBands, NumberOfSpins (1 or 2), NumberOfkPoints
 * Line 5+: For each k-point:
 *          k_dist, ((ek(iband, ispin), iband=1..NumberOfBands), ispin=1..NumberOfSpins)
 * Followed by:
 * NumberOfkLines (ticks)
 * For each tick: k_dist, 'TickLabel'
 */
export function parseBands(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid .bands file content');
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 5) {
    throw new Error('File has insufficient lines for SIESTA .bands format');
  }

  const ef = parseFloat(lines[0].trim());
  if (isNaN(ef)) throw new Error('Failed to parse Fermi energy from line 1');

  const [kmin, kmax] = lines[1].trim().split(/\s+/).map(Number);
  const [emin, emax] = lines[2].trim().split(/\s+/).map(Number);
  const [nband, nspin, nk] = lines[3].trim().split(/\s+/).map(Number);

  const kDist = [];
  const bandsUp = Array.from({ length: nband }, () => []);
  const bandsDown = nspin === 2 ? Array.from({ length: nband }, () => []) : null;

  let lineIdx = 4;
  for (let ik = 0; ik < nk && lineIdx < lines.length; ik++) {
    const tokens = [];
    while (tokens.length < 1 + nband * nspin && lineIdx < lines.length) {
      const parts = lines[lineIdx++].trim().split(/\s+/);
      for (const p of parts) {
        if (p.length > 0) tokens.push(parseFloat(p));
      }
    }
    if (tokens.length < 1 + nband * nspin) break;

    kDist.push(tokens[0]);

    let ptr = 1;
    // Spin up
    for (let ib = 0; ib < nband; ib++) {
      bandsUp[ib].push(tokens[ptr++]);
    }
    // Spin down
    if (nspin === 2) {
      for (let ib = 0; ib < nband; ib++) {
        bandsDown[ib].push(tokens[ptr++]);
      }
    }
  }

  // Ticks at end of file
  const ticks = [];
  if (lineIdx < lines.length) {
    const numTicks = parseInt(lines[lineIdx++].trim(), 10);
    if (!isNaN(numTicks)) {
      for (let it = 0; it < numTicks && lineIdx < lines.length; it++) {
        const line = lines[lineIdx++].trim();
        const m = line.match(/^([-\d\.]+)\s+['"]?([^'"]+)['"]?/);
        if (m) {
          const rawLabel = m[2].trim();
          const cleanLabel = rawLabel
            .replace(/^\\/, '')
            .replace(/gamma/i, 'Γ')
            .replace(/delta/i, 'Δ')
            .replace(/lambda/i, 'Λ')
            .replace(/sigma/i, 'Σ');

          ticks.push({
            k: parseFloat(m[1]),
            label: cleanLabel,
            rawLabel,
          });
        }
      }
    }
  }

  return {
    ef,
    kmin,
    kmax,
    emin,
    emax,
    nband,
    nspin,
    nk: kDist.length,
    kDist,
    bandsUp,
    bandsDown,
    ticks,
  };
}

/**
 * Analyze band structure: detect VBM, CBM, direct/indirect band gap, and Fermi crossings
 */
export function analyzeBandStructure(parsed) {
  const { ef, nband, nk, kDist, bandsUp, ticks } = parsed;

  let vbm = -Infinity;
  let vbmK = 0;
  let vbmBand = 0;

  let cbm = Infinity;
  let cbmK = 0;
  let cbmBand = 0;

  let hasCrossings = false;

  for (let ib = 0; ib < nband; ib++) {
    const energies = bandsUp[ib];
    let crosses = false;

    for (let ik = 0; ik < nk; ik++) {
      const e = energies[ik];
      if (e <= ef) {
        if (e > vbm) {
          vbm = e;
          vbmK = kDist[ik];
          vbmBand = ib + 1;
        }
      } else {
        if (e < cbm) {
          cbm = e;
          cbmK = kDist[ik];
          cbmBand = ib + 1;
        }
      }

      if (ik > 0) {
        const prevE = energies[ik - 1];
        if ((prevE - ef) * (e - ef) < 0) {
          crosses = true;
        }
      }
    }

    if (crosses) hasCrossings = true;
  }

  const isMetal = hasCrossings || vbm >= cbm;
  const bandGap = isMetal ? 0 : parseFloat(Math.max(0, cbm - vbm).toFixed(3));
  const isDirect = !isMetal && Math.abs(vbmK - cbmK) < 0.05;

  // Closest tick to VBM and CBM
  const findTickLabel = (kVal) => {
    if (!ticks || ticks.length === 0) return '';
    let closest = ticks[0];
    let minD = Math.abs(ticks[0].k - kVal);
    ticks.forEach(t => {
      const d = Math.abs(t.k - kVal);
      if (d < minD) { minD = d; closest = t; }
    });
    return minD < 0.08 ? closest.label : `k=${kVal.toFixed(2)}`;
  };

  return {
    isMetal,
    bandGap,
    isDirect,
    vbm: parseFloat(vbm.toFixed(3)),
    vbmK,
    vbmBand,
    vbmLabel: findTickLabel(vbmK),
    cbm: parseFloat(cbm.toFixed(3)),
    cbmK,
    cbmBand,
    cbmLabel: findTickLabel(cbmK),
    type: isMetal ? 'Metallic' : (isDirect ? 'Direct Band Gap Semiconductor' : 'Indirect Band Gap Semiconductor'),
  };
}

/**
 * Generate synthetic band structures for 1-click demos
 */
export function generateDemoBandStructure(presetKey = 'silicon') {
  if (presetKey === 'graphene') {
    // Graphene: Dirac cone at K point
    const nk = 60;
    const kDist = [];
    const bandsUp = [[], [], [], [], [], []];
    const ticks = [
      { k: 0.0, label: 'Γ' },
      { k: 0.78, label: 'M' },
      { k: 1.23, label: 'K' },
      { k: 2.13, label: 'Γ' },
    ];

    for (let i = 0; i < nk; i++) {
      const k = (i / (nk - 1)) * 2.13;
      kDist.push(k);

      // Dirac dispersion near K (1.23)
      const dk = Math.abs(k - 1.23);
      bandsUp[0].push(-18.0 + 3 * Math.cos(k * 2));
      bandsUp[1].push(-12.0 + 4 * Math.cos(k * 2));
      bandsUp[2].push(-6.5 * dk - 0.05 * (k - 1.23) ** 2); // Pi valence
      bandsUp[3].push(+6.5 * dk + 0.05 * (k - 1.23) ** 2); // Pi* conduction
      bandsUp[4].push(8.5 + 2 * Math.cos(k * 2));
      bandsUp[5].push(14.0 + 3 * Math.sin(k * 2));
    }

    return {
      title: 'Graphene (Dirac Cone Semimetal)',
      ef: 0.0,
      kmin: 0.0,
      kmax: 2.13,
      emin: -20.0,
      emax: 18.0,
      nband: 6,
      nspin: 1,
      nk,
      kDist,
      bandsUp,
      bandsDown: null,
      ticks,
    };
  }

  if (presetKey === 'fapbi3') {
    // FAPbI3 Perovskite: Direct gap at R point (~1.55 eV)
    const nk = 80;
    const kDist = [];
    const bandsUp = Array.from({ length: 8 }, () => []);
    const ticks = [
      { k: 0.0, label: 'Γ' },
      { k: 0.85, label: 'X' },
      { k: 1.45, label: 'M' },
      { k: 2.20, label: 'Γ' },
      { k: 3.10, label: 'R' },
      { k: 3.95, label: 'X' },
    ];

    for (let i = 0; i < nk; i++) {
      const k = (i / (nk - 1)) * 3.95;
      kDist.push(k);

      const dR = Math.abs(k - 3.10);
      // Valence bands (I 5p + Pb 6s) peaking at R
      bandsUp[0].push(-5.5 + 0.5 * Math.cos(k * 2));
      bandsUp[1].push(-3.8 + 0.8 * Math.cos(k * 2));
      bandsUp[2].push(-2.1 + 0.6 * Math.sin(k * 2));
      bandsUp[3].push(-0.05 - 1.8 * (dR ** 2)); // VBM at R

      // Conduction bands (Pb 6p) dipping at R (gap ~ 1.55 eV)
      bandsUp[4].push(1.50 + 2.2 * (dR ** 2)); // CBM at R
      bandsUp[5].push(2.8 + 0.8 * Math.cos(k * 2));
      bandsUp[6].push(4.1 + 0.6 * Math.sin(k * 2));
      bandsUp[7].push(5.8 + 1.1 * Math.cos(k * 2));
    }

    return {
      title: 'Bulk FAPbI₃ Perovskite (Direct Gap at R)',
      ef: 0.0,
      kmin: 0.0,
      kmax: 3.95,
      emin: -6.0,
      emax: 6.5,
      nband: 8,
      nspin: 1,
      nk,
      kDist,
      bandsUp,
      bandsDown: null,
      ticks,
    };
  }

  // Default: Bulk Diamond Silicon (Indirect gap 1.12 eV, VBM at Gamma, CBM along Delta)
  const nk = 70;
  const kDist = [];
  const bandsUp = Array.from({ length: 8 }, () => []);
  const ticks = [
    { k: 0.0, label: 'L' },
    { k: 0.86, label: 'Γ' },
    { k: 1.86, label: 'X' },
    { k: 2.45, label: 'U,K' },
    { k: 3.25, label: 'Γ' },
  ];

  for (let i = 0; i < nk; i++) {
    const k = (i / (nk - 1)) * 3.25;
    kDist.push(k);

    const dG = Math.abs(k - 0.86);
    const dX = Math.abs(k - 1.86);
    const dDelta = Math.abs(k - 1.65); // CBM at 85% Gamma-X

    // 4 Valence bands peaking at Gamma (0.86)
    bandsUp[0].push(-12.5 + 1.2 * Math.cos(k * 2));
    bandsUp[1].push(-7.2 + 2.1 * Math.cos(k * 2));
    bandsUp[2].push(-0.02 - 2.5 * (dG ** 2)); // Light hole
    bandsUp[3].push(0.00 - 1.6 * (dG ** 2));  // Heavy hole (VBM at Gamma)

    // 4 Conduction bands dipping along Delta (1.65)
    bandsUp[4].push(1.12 + 2.8 * (dDelta ** 2)); // CBM along Delta
    bandsUp[5].push(1.85 + 2.0 * (dX ** 2));
    bandsUp[6].push(3.2 + 0.8 * Math.cos(k * 2));
    bandsUp[7].push(4.5 + 1.1 * Math.sin(k * 2));
  }

  return {
    title: 'Bulk Silicon (Indirect Band Gap 1.12 eV)',
    ef: 0.0,
    kmin: 0.0,
    kmax: 3.25,
    emin: -14.0,
    emax: 6.0,
    nband: 8,
    nspin: 1,
    nk,
    kDist,
    bandsUp,
    bandsDown: null,
    ticks,
  };
}
