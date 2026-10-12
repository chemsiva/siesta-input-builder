/**
 * SIESTA .PDOS and .PDOS.xml Parser and Orbital Aggregator
 * Compliant with SIESTA Util/pdosxml schema and output.
 */

export const L_LABELS = {
  0: 's',
  1: 'p',
  2: 'd',
  3: 'f',
};

/**
 * Parse SIESTA .PDOS XML file content.
 */
export function parsePDOS(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('PDOS file is empty or invalid.');
  }

  // 1. Basic tags
  const nspinMatch = text.match(/<nspin>\s*(\d+)/i);
  const nspin = parseInt(nspinMatch ? nspinMatch[1] : '1', 10);

  const norbMatch = text.match(/<norbitals>\s*(\d+)/i);
  const norbitals = parseInt(norbMatch ? norbMatch[1] : '0', 10);

  const efMatch = text.match(/<fermi_energy[^>]*>\s*([^\s<]+)/i);
  const ef = efMatch ? parseFloat(efMatch[1]) : 0.0;

  // 2. Energy values
  const evStart = text.indexOf('<energy_values');
  const evEnd = text.indexOf('</energy_values>');
  if (evStart === -1 || evEnd === -1) {
    throw new Error('Could not find <energy_values> block in PDOS file.');
  }

  const evBody = text.substring(evStart, evEnd);
  const cleanEv = evBody.replace(/<[^>]+>/g, ' ').trim();
  const energies = [];
  const evTokens = cleanEv.split(/\s+/);
  for (let i = 0; i < evTokens.length; i++) {
    const val = parseFloat(evTokens[i]);
    if (!isNaN(val)) energies.push(val);
  }

  const nEnergies = energies.length;
  if (nEnergies === 0) {
    throw new Error('No energy points parsed in PDOS file.');
  }

  // 3. Orbitals
  const orbitals = [];
  const speciesSet = new Set();
  const lSet = new Set();
  const atomSet = new Set();

  const orbRegex = /<orbital\s+([^>]+)>([\s\S]*?)<\/orbital>/gi;
  let match;

  while ((match = orbRegex.exec(text)) !== null) {
    const attrStr = match[1];
    const body = match[2];

    const getAttr = (name) => {
      const r = new RegExp(`${name}="\\s*([^"]+?)\\s*"`, 'i');
      const res = attrStr.match(r);
      return res ? res[1].trim() : '';
    };

    const index = parseInt(getAttr('index'), 10) || (orbitals.length + 1);
    const atom_index = parseInt(getAttr('atom_index'), 10) || 1;
    const species = getAttr('species') || 'X';
    const n = parseInt(getAttr('n'), 10) || 1;
    const l = parseInt(getAttr('l'), 10) || 0;
    const m = parseInt(getAttr('m'), 10) || 0;
    const z = parseInt(getAttr('z'), 10) || 1;

    speciesSet.add(species);
    lSet.add(l);
    atomSet.add(atom_index);

    const dataStart = body.indexOf('<data>');
    const dataEnd = body.indexOf('</data>');
    let values = [];
    if (dataStart !== -1 && dataEnd !== -1) {
      const dataStr = body.substring(dataStart + 6, dataEnd).trim();
      const tokens = dataStr.split(/\s+/);
      values = new Float64Array(tokens.length);
      for (let i = 0; i < tokens.length; i++) {
        values[i] = parseFloat(tokens[i]) || 0;
      }
    }

    orbitals.push({
      index,
      atom_index,
      species,
      n,
      l,
      m,
      z,
      values,
    });
  }

  return {
    format: 'PDOS',
    nspin,
    norbitals: orbitals.length || norbitals,
    ef,
    nEnergies,
    energies,
    minEnergy: energies[0],
    maxEnergy: energies[energies.length - 1],
    speciesList: Array.from(speciesSet).sort(),
    lList: Array.from(lSet).sort((a, b) => a - b),
    atomList: Array.from(atomSet).sort((a, b) => a - b),
    orbitals,
  };
}

/**
 * Filter and compute aggregated PDOS curves.
 *
 * @param {Object} options
 * @param {Object} options.pdosData
 * @param {number} [options.emin]
 * @param {number} [options.emax]
 * @param {boolean} [options.shiftEf=true]
 * @param {string[]} [options.selectedSpecies] - filter by species
 * @param {number[]} [options.selectedL] - filter by l (0=s, 1=p, 2=d, 3=f)
 * @param {number[]} [options.selectedAtoms] - filter by atom index
 */
export function computePDOSCurves({
  pdosData,
  emin = -6.0,
  emax = 6.0,
  shiftEf = true,
  selectedSpecies = null, // null means all
  selectedL = null,       // null means all
  selectedAtoms = null,   // null means all
}) {
  if (!pdosData || !pdosData.orbitals) {
    throw new Error('Invalid PDOS data.');
  }

  const { nspin, ef, nEnergies, energies, orbitals, speciesList } = pdosData;

  // Energy indices within range
  const eMinVal = parseFloat(emin);
  const eMaxVal = parseFloat(emax);

  const idxs = [];
  for (let i = 0; i < nEnergies; i++) {
    const energy = shiftEf ? energies[i] - ef : energies[i];
    if (energy >= eMinVal && energy <= eMaxVal) {
      idxs.push(i);
    }
  }

  const filteredEnergies = idxs.map(i => (shiftEf ? energies[i] - ef : energies[i]));
  const nFiltered = filteredEnergies.length;

  const activeSpecies = new Set(selectedSpecies || speciesList);
  const activeL = selectedL ? new Set(selectedL) : null;
  const activeAtoms = selectedAtoms ? new Set(selectedAtoms) : null;

  // Initialize aggregated curves
  const totalCurve = new Float64Array(nFiltered);
  const speciesCurves = {};
  speciesList.forEach(sp => {
    speciesCurves[sp] = new Float64Array(nFiltered);
  });

  const lCurves = {
    s: new Float64Array(nFiltered),
    p: new Float64Array(nFiltered),
    d: new Float64Array(nFiltered),
    f: new Float64Array(nFiltered),
  };

  // If spin-polarized: separate spin-up and spin-down
  const isSpinPol = nspin === 2;
  const totalDown = isSpinPol ? new Float64Array(nFiltered) : null;
  const speciesDown = isSpinPol ? {} : null;
  if (isSpinPol) {
    speciesList.forEach(sp => {
      speciesDown[sp] = new Float64Array(nFiltered);
    });
  }

  for (let orb of orbitals) {
    // Check filters
    if (activeSpecies && !activeSpecies.has(orb.species)) continue;
    if (activeL && !activeL.has(orb.l)) continue;
    if (activeAtoms && !activeAtoms.has(orb.atom_index)) continue;

    const vals = orb.values;
    const lKey = L_LABELS[orb.l] || 'other';

    for (let k = 0; k < nFiltered; k++) {
      const origIdx = idxs[k];
      if (isSpinPol) {
        // Values array has 2 * nEnergies: up = 2*i, down = 2*i + 1
        const up = vals[origIdx * 2] || 0;
        const down = vals[origIdx * 2 + 1] || 0;

        totalCurve[k] += up;
        totalDown[k] += down;

        if (speciesCurves[orb.species]) speciesCurves[orb.species][k] += up;
        if (speciesDown[orb.species]) speciesDown[orb.species][k] += down;

        if (lCurves[lKey]) lCurves[lKey][k] += up;
      } else {
        const val = vals[origIdx] || 0;
        totalCurve[k] += val;
        if (speciesCurves[orb.species]) speciesCurves[orb.species][k] += val;
        if (lCurves[lKey]) lCurves[lKey][k] += val;
      }
    }
  }

  return {
    energies: filteredEnergies,
    total: Array.from(totalCurve),
    totalDown: totalDown ? Array.from(totalDown) : null,
    bySpecies: Object.fromEntries(
      Object.entries(speciesCurves).map(([k, v]) => [k, Array.from(v)])
    ),
    bySpeciesDown: speciesDown
      ? Object.fromEntries(Object.entries(speciesDown).map(([k, v]) => [k, Array.from(v)]))
      : null,
    byL: Object.fromEntries(
      Object.entries(lCurves).map(([k, v]) => [k, Array.from(v)])
    ),
    ef,
    shifted: shiftEf,
    nspin,
  };
}
