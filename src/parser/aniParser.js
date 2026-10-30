/**
 * Parser for SIESTA .ANI (multi-frame XMOL / XYZ trajectory) files.
 * Format:
 * [natoms]
 * [comment line / blank]
 * Symbol X Y Z
 * ...
 */
export function parseANI(text) {
 if (!text || typeof text !== 'string') {
 throw new Error('Empty or invalid ANI content');
 }

 const lines = text.split(/\r?\n/);
 const frames = [];
 let i = 0;
 const nLines = lines.length;

 while (i < nLines) {
 // Skip empty lines between frames
 while (i < nLines && lines[i].trim() === '') {
 i++;
 }
 if (i >= nLines) break;

 const natomsStr = lines[i].trim();
 const natoms = parseInt(natomsStr, 10);
 if (isNaN(natoms) || natoms <= 0) {
 i++;
 continue;
 }

 i++; // Move past natoms
 const comment = i < nLines ? lines[i].trim() : '';
 i++; // Move past comment line

 const atoms = [];
 for (let a = 0; a < natoms && i < nLines; a++, i++) {
 const line = lines[i].trim();
 if (!line) continue;
 const tokens = line.split(/\s+/);
 if (tokens.length >= 4) {
 atoms.push({
 symbol: tokens[0],
 x: parseFloat(tokens[1]),
 y: parseFloat(tokens[2]),
 z: parseFloat(tokens[3]),
 });
 }
 }

 if (atoms.length > 0) {
 frames.push({
 frameIndex: frames.length,
 numAtoms: atoms.length,
 comment,
 atoms,
 });
 }
 }

 if (frames.length === 0) {
 throw new Error('No valid frames found in .ANI file');
 }

 // Determine unique species
 const speciesSet = new Set();
 frames[0].atoms.forEach(a => speciesSet.add(a.symbol));

 return {
 frames,
 numFrames: frames.length,
 numAtoms: frames[0].numAtoms,
 species: Array.from(speciesSet),
 };
}
