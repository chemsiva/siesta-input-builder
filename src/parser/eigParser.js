/**
 * SIESTA .EIG and .KP Parser and Eig2DOS Calculator
 * Replicates the official SIESTA Util/Eig2DOS Fortran algorithm in pure JavaScript.
 */

/**
 * Parse SIESTA .EIG file content.
 * Format:
 * Line 1: Ef (Fermi energy in eV)
 * Line 2: nband, nspin, nk
 * Line 3+: For each k-point: ik, eigenvalues (nband * nspin_blocks)
 */
export function parseEIG(text) {
 if (!text || typeof text !== 'string') {
 throw new Error('EIG file is empty or invalid.');
 }

 const lines = text.trim().split(/\r?\n/);
 if (lines.length < 3) {
 throw new Error('EIG file has insufficient header lines.');
 }

 const ef = parseFloat(lines[0].trim());
 if (isNaN(ef)) {
 throw new Error('Failed to parse Fermi energy from line 1 of EIG file.');
 }

 const header2 = lines[1].trim().split(/\s+/).map(Number);
 if (header2.length < 3 || isNaN(header2[0])) {
 throw new Error('Failed to parse (nband, nspin, nk) from line 2 of EIG file.');
 }

 const [nband, nspin, nk] = header2;
 const nspinBlocks = nspin === 2 ? 2 : 1;

 // Extract all numeric tokens starting from line 2
 const eigenvalues = []; // [nk][nspinBlocks][nband]
 let lineIdx = 2;

 let minE = Infinity;
 let maxE = -Infinity;

 for (let ik = 0; ik < nk; ik++) {
 const tokens = [];
 while (tokens.length < 1 + nband * nspinBlocks && lineIdx < lines.length) {
 const parts = lines[lineIdx++].trim().split(/\s+/);
 for (const p of parts) {
 if (p.length > 0) tokens.push(parseFloat(p));
 }
 }

 if (tokens.length < 1 + nband * nspinBlocks) {
 break;
 }

 const kptEigs = [];
 let tokenPtr = 1; // skip ik index

 for (let is = 0; is < nspinBlocks; is++) {
 const spinEigs = new Float64Array(nband);
 for (let ib = 0; ib < nband; ib++) {
 const val = tokens[tokenPtr++];
 spinEigs[ib] = val;
 if (val < minE) minE = val;
 if (val > maxE) maxE = val;
 }
 kptEigs.push(spinEigs);
 }
 eigenvalues.push(kptEigs);
 }

 return {
 format: 'EIG',
 ef,
 nband,
 nspin,
 nk: eigenvalues.length,
 nspinBlocks,
 minE,
 maxE,
 eigenvalues,
 };
}

/**
 * Parse SIESTA .KP file content (optional k-point weights).
 */
export function parseKP(text) {
 if (!text) return null;
 const lines = text.trim().split(/\r?\n/);
 const nk = parseInt(lines[0].trim(), 10);
 if (isNaN(nk)) return null;

 const weights = new Float64Array(nk);
 let readCount = 0;
 for (let i = 1; i < lines.length && readCount < nk; i++) {
 const parts = lines[i].trim().split(/\s+/);
 if (parts.length >= 5) {
 // format: ik, kx, ky, kz, weight
 weights[readCount++] = parseFloat(parts[4]);
 }
 }

 return { nk: readCount, weights };
}

/**
 * Compute Total DOS from EIG data following SIESTA Eig2DOS.f90 logic.
 *
 * @param {Object} options
 * @param {Object} options.eigData - parsed EIG data
 * @param {Object} [options.kpData] - parsed KP data (weights)
 * @param {number} [options.emin=-6.0] - min energy in eV
 * @param {number} [options.emax=6.0] - max energy in eV
 * @param {number} [options.npts=1000] - number of energy points (-n)
 * @param {number} [options.smear=0.1] - broadening sigma in eV (-s)
 * @param {string} [options.broadening='gaussian'] - 'gaussian' or 'lorentzian' (-l)
 * @param {boolean} [options.shiftEf=true] - shift Fermi level to 0 eV (-f/-F)
 * @param {number} [options.minBand=1] - min band index (1-based, -b)
 * @param {number} [options.maxBand] - max band index (1-based, -B)
 */
export function computeEig2DOS({
 eigData,
 kpData = null,
 emin = -6.0,
 emax = 6.0,
 npts = 1000,
 smear = 0.1,
 broadening = 'gaussian',
 shiftEf = true,
 minBand = 1,
 maxBand = null,
}) {
 if (!eigData || !eigData.eigenvalues) {
 throw new Error('Invalid EIG data provided.');
 }

 const { ef, nband, nspin, nk, nspinBlocks, eigenvalues } = eigData;

 const bMin = Math.max(0, (minBand || 1) - 1);
 const bMax = Math.min(nband - 1, (maxBand || nband) - 1);

 const numPts = Math.max(2, parseInt(npts, 10) || 1000);
 const eMinVal = parseFloat(emin);
 const eMaxVal = parseFloat(emax);
 const sigma = Math.max(0.001, parseFloat(smear) || 0.1);
 const isLorentzian = broadening === 'lorentzian';

 const eIncr = (eMaxVal - eMinVal) / (numPts - 1);
 const energies = new Float64Array(numPts);
 for (let i = 0; i < numPts; i++) {
 energies[i] = eMinVal + i * eIncr;
 }

 const s2 = sigma * sigma;
 const cutoff = isLorentzian ? 20 * sigma : 4.5 * sigma; // truncation radius

 // Initialize DOS arrays for spin blocks
 // If nspinBlocks == 2, dosUp and dosDown
 const dosUp = new Float64Array(numPts);
 const dosDown = nspinBlocks === 2 ? new Float64Array(numPts) : null;

 for (let ikIdx = 0; ikIdx < nk; ikIdx++) {
 const weight = kpData && kpData.weights && kpData.weights[ikIdx]
 ? kpData.weights[ikIdx]
 : 1.0 / nk;

 // Spin 1 / Up
 const eigsSpin1 = eigenvalues[ikIdx][0];
 for (let ib = bMin; ib <= bMax; ib++) {
 let e = eigsSpin1[ib];
 if (shiftEf) e -= ef;

 if (e < eMinVal - cutoff || e > eMaxVal + cutoff) continue;

 const minIe = Math.max(0, Math.floor((e - cutoff - eMinVal) / eIncr));
 const maxIe = Math.min(numPts - 1, Math.ceil((e + cutoff - eMinVal) / eIncr));

 for (let ie = minIe; ie <= maxIe; ie++) {
 const x = energies[ie] - e;
 if (isLorentzian) {
 dosUp[ie] += weight * sigma / (s2 + x * x);
 } else {
 dosUp[ie] += weight * Math.exp(-(x * x) / s2);
 }
 }
 }

 // Spin 2 / Down (if spin-polarized)
 if (nspinBlocks === 2) {
 const eigsSpin2 = eigenvalues[ikIdx][1];
 for (let ib = bMin; ib <= bMax; ib++) {
 let e = eigsSpin2[ib];
 if (shiftEf) e -= ef;

 if (e < eMinVal - cutoff || e > eMaxVal + cutoff) continue;

 const minIe = Math.max(0, Math.floor((e - cutoff - eMinVal) / eIncr));
 const maxIe = Math.min(numPts - 1, Math.ceil((e + cutoff - eMinVal) / eIncr));

 for (let ie = minIe; ie <= maxIe; ie++) {
 const x = energies[ie] - e;
 if (isLorentzian) {
 dosDown[ie] += weight * sigma / (s2 + x * x);
 } else {
 dosDown[ie] += weight * Math.exp(-(x * x) / s2);
 }
 }
 }
 }
 }

 // Normalization factor
 const norm = isLorentzian ? Math.PI : Math.sqrt(Math.PI) * sigma;

 const totalDos = new Float64Array(numPts);
 for (let ie = 0; ie < numPts; ie++) {
 dosUp[ie] /= norm;
 if (nspinBlocks === 2) {
 dosDown[ie] /= norm;
 totalDos[ie] = dosUp[ie] + dosDown[ie];
 } else {
 // Non-polarized has multiplicity 2 for total DOS
 totalDos[ie] = nspin === 1 ? dosUp[ie] * 2 : dosUp[ie];
 }
 }

 return {
 energies: Array.from(energies),
 totalDos: Array.from(totalDos),
 dosUp: Array.from(dosUp),
 dosDown: dosDown ? Array.from(dosDown) : null,
 nspin,
 nspinBlocks,
 ef,
 shifted: shiftEf,
 emin: eMinVal,
 emax: eMaxVal,
 npts: numPts,
 smear: sigma,
 broadening,
 };
}
