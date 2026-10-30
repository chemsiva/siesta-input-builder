/**
 * Parser for SIESTA stdout (.out) output log files.
 * Extracts:
 * - System details & mesh parameters
 * - Final ground state & free energies
 * - Fermi energy (E_F)
 * - Maximum atomic force & stress tensor
 * - SCF iteration convergence history
 * - Final cell parameters & volume
 * - Execution timings & normal exit status
 */
export function parseSiestaOut(text) {
 if (!text || typeof text !== 'string') {
 throw new Error('Empty or invalid SIESTA output content');
 }

 const lines = text.split(/\r?\n/);
 const result = {
 systemLabel: '',
 numberOfAtoms: null,
 numberOfSpecies: null,
 meshCutoff: null,
 finalEnergyKS: null,
 finalEnergyTot: null,
 fermiEnergy: null,
 vacuumLevelMax: null, // dhscf: Vacuum level (max, mean) — first value
 vacuumLevelMean: null, // dhscf: Vacuum level (max, mean) — second value
 maxForce: null,
 stressTensorVoigt: null,
 cellVectors: null,
 cellVolume: null,
 cellAngles: null,
 normalExit: false,
 timing: {},
 scfCycles: [],
 };

 let currentGeomStep = 0;

 for (let i = 0; i < lines.length; i++) {
 const line = lines[i];

 // SystemLabel
 if (/System\s*Label/i.test(line) || /SystemLabel/i.test(line)) {
 const m = line.match(/(?:System\s*Label\s*:?|SystemLabel)\s*(\S+)/i);
 if (m && !result.systemLabel) result.systemLabel = m[1];
 }

 // Number of atoms
 if (/Number of atoms/i.test(line) || /NumberOfAtoms/i.test(line)) {
 const m = line.match(/(?:Number of atoms[^\n:=]*[:=]|NumberOfAtoms)\s*(\d+)/i);
 if (m && !result.numberOfAtoms) result.numberOfAtoms = parseInt(m[1], 10);
 }

 // Number of species
 if (/Number of species/i.test(line) || /NumberOfSpecies/i.test(line)) {
 const m = line.match(/(?:Number of species[^\n:=]*[:=]|NumberOfSpecies)\s*(\d+)/i);
 if (m && !result.numberOfSpecies) result.numberOfSpecies = parseInt(m[1], 10);
 }
 // Mesh cutoff used
 if (line.includes('Mesh cutoff (required, used) =')) {
 const m = line.match(/Mesh cutoff \(required, used\)\s*=\s*([\d\.]+)\s+([\d\.]+)/);
 if (m) result.meshCutoff = `${m[2]} Ry`;
 }

 // Geometry step tracker
 if (line.includes('new_DM -- step:')) {
 const m = line.match(/new_DM -- step:\s*(\d+)/);
 if (m) currentGeomStep = parseInt(m[1], 10);
 }

 // SCF line matching: "scf: 1 -41684.141333 -41866.376305 -41866.385575 24.910993 9.818400 23.962717"
 if (line.trim().startsWith('scf:')) {
 const tokens = line.trim().split(/\s+/);
 if (tokens.length >= 7) {
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

 // Fermi energy — handles "siesta: Fermi = -4.958", "Fermi energy = ", etc.
 if (/Fermi/i.test(line)) {
 const m = line.match(/(?:siesta:\s*Fermi|Fermi energy(?:\s*\(eV\))?|Fermi)\s*=\s*([-\d\.eE\+]+)/i);
 if (m) result.fermiEnergy = parseFloat(m[1]);
 }

 // Vacuum level — printed by dhscf every SCF cycle (e.g. "dhscf: Vacuum level (max, mean) = 0.973999 0.127217 eV")
 if (/Vacuum level/i.test(line)) {
 const m = line.match(/Vacuum level\s*\(max,\s*mean\)\s*=\s*([-\d\.eE\+]+)\s+([-\d\.eE\+]+)/i);
 if (m) {
 result.vacuumLevelMax = parseFloat(m[1]);
 result.vacuumLevelMean = parseFloat(m[2]);
 }
 }

 // E_KS
 if (line.includes('siesta: E_KS(eV) =')) {
 const m = line.match(/siesta:\s*E_KS\(eV\)\s*=\s*([-\d\.]+)/);
 if (m) result.finalEnergyKS = parseFloat(m[1]);
 }

 // Final total energy
 if (/siesta:\s*Total\s*=/i.test(line) || /siesta:\s*Final energy/i.test(line)) {
 const m = line.match(/siesta:\s*Total\s*=\s*([-\d\.]+)/);
 if (m) result.finalEnergyTot = parseFloat(m[1]);
 }
 // Max force
 if (line.includes('siesta: Max force =') || line.includes('Maximum force component =')) {
 const m = line.match(/(?:Max force\s*=|Maximum force component\s*=)\s*([-\d\.]+)/i);
 if (m) result.maxForce = parseFloat(m[1]);
 }

 // Stress tensor Voigt (kbar)
 if (line.includes('Stress tensor Voigt[x,y,z,yz,xz,xy] (kbar):')) {
 const parts = line.split(':');
 if (parts[1]) {
 const v = parts[1].trim().split(/\s+/).map(Number);
 if (v.length === 6) result.stressTensorVoigt = v;
 }
 }
 // Cell vectors (from outcell)
 if (line.includes('outcell: Unit cell vectors (Ang):')) {
 const v1 = lines[i + 1]?.trim().split(/\s+/).map(Number);
 const v2 = lines[i + 2]?.trim().split(/\s+/).map(Number);
 const v3 = lines[i + 3]?.trim().split(/\s+/).map(Number);
 if (v1 && v2 && v3 && v1.length === 3 && v2.length === 3 && v3.length === 3) {
 result.cellVectors = [v1, v2, v3];
 }
 }

 // Cell volume
 if (/Cell volume/i.test(line)) {
 const m = line.match(/(?:siesta|outcell):\s*Cell volume[^:=]*[:=]\s*([\d\.]+)/i);
 if (m) result.cellVolume = parseFloat(m[1]);
 }
 // Cell angles
 if (line.includes('outcell: Cell angles (23,13,12) (deg):')) {
 const parts = line.split(':');
 if (parts[1]) {
 const a = parts[1].trim().split(/\s+/).map(Number);
 if (a.length === 3) result.cellAngles = a;
 }
 }

 // Normal termination
 if (line.includes('Job completed') || line.includes('>> End of run:') || line.includes('0_NORMAL_EXIT')) {
 result.normalExit = true;
 }
 }

 // Fallbacks if not explicitly captured
 if (!result.finalEnergyTot && result.finalEnergyKS) {
 result.finalEnergyTot = result.finalEnergyKS;
 }
 if (!result.fermiEnergy && result.scfCycles.length > 0) {
 result.fermiEnergy = result.scfCycles[result.scfCycles.length - 1].ef;
 }

 return result;
}
