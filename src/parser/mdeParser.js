/**
 * Parser for SIESTA .MDE (Molecular Dynamics / Relaxation history) files.
 * Format:
 * # Step T (K) E_KS (eV) E_tot (eV) Vol (A^3) P (kBar)
 * 0 0.00 -40923.06220 -40923.06220 965.603 -1501.262
 */
export function parseMDE(text) {
 if (!text || typeof text !== 'string') {
 throw new Error('Empty or invalid MDE content');
 }

 const lines = text.split(/\r?\n/);
 const steps = [];

 for (const rawLine of lines) {
 const line = rawLine.trim();
 if (!line || line.startsWith('#')) continue;

 const tokens = line.split(/\s+/);
 if (tokens.length >= 6) {
 const step = parseInt(tokens[0], 10);
 const temp = parseFloat(tokens[1]);
 const eKs = parseFloat(tokens[2]);
 const eTot = parseFloat(tokens[3]);
 const volume = parseFloat(tokens[4]);
 const pressure = parseFloat(tokens[5]);

 if (!isNaN(step) && !isNaN(eTot)) {
 steps.push({ step, temp, eKs, eTot, volume, pressure });
 }
 }
 }

 if (steps.length === 0) {
 throw new Error('No valid numeric steps found in .MDE file');
 }

 const eInitial = steps[0].eTot;
 const eFinal = steps[steps.length - 1].eTot;
 const deltaE = eFinal - eInitial;

 const temps = steps.map(s => s.temp);
 const tempAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
 const tempVariance = temps.reduce((acc, t) => acc + (t - tempAvg) ** 2, 0) / temps.length;
 const tempStd = Math.sqrt(tempVariance);

 const pressures = steps.map(s => s.pressure);
 const pressureAvg = pressures.reduce((a, b) => a + b, 0) / pressures.length;

 const vInitial = steps[0].volume;
 const vFinal = steps[steps.length - 1].volume;
 const deltaVolPercent = vInitial !== 0 ? ((vFinal - vInitial) / vInitial) * 100 : 0;

 return {
 steps,
 totalSteps: steps.length,
 summary: {
 eInitial,
 eFinal,
 deltaE,
 tempAvg,
 tempStd,
 pressureAvg,
 vInitial,
 vFinal,
 deltaVolPercent,
 },
 };
}
