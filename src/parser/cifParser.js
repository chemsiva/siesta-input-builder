/**
 * CIF (Crystallographic Information File) Parser for SIESTA Input Builder
 * 
 * Extracts:
 * - Lattice parameters (a, b, c, alpha, beta, gamma)
 * - Lattice vectors (converted to Ångström Cartesian 3x3)
 * - Atomic fractional coordinates
 * - Spacegroup symmetry expansion (if asymmetric unit with symops)
 * - Element symbols and atomic numbers Z
 * - ChemicalSpeciesLabel and atom list
 */

// Periodic table symbol -> Z mapping
const SYMBOL_TO_Z = {
 H: 1, He: 2, Li: 3, Be: 4, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10,
 Na: 11, Mg: 12, Al: 13, Si: 14, P: 15, S: 16, Cl: 17, Ar: 18,
 K: 19, Ca: 20, Sc: 21, Ti: 22, V: 23, Cr: 24, Mn: 25, Fe: 26, Co: 27, Ni: 28, Cu: 29, Zn: 30,
 Ga: 31, Ge: 32, As: 33, Se: 34, Br: 35, Kr: 36,
 Rb: 37, Sr: 38, Y: 39, Zr: 40, Nb: 41, Mo: 42, Tc: 43, Ru: 44, Rh: 45, Pd: 46, Ag: 47, Cd: 48,
 In: 49, Sn: 50, Sb: 51, Te: 52, I: 53, Xe: 54,
 Cs: 55, Ba: 56, La: 57, Ce: 58, Pr: 59, Nd: 60, Pm: 61, Sm: 62, Eu: 63, Gd: 64, Tb: 65, Dy: 66,
 Ho: 67, Er: 68, Tm: 69, Yb: 70, Lu: 71, Hf: 72, Ta: 73, W: 74, Re: 75, Os: 76, Ir: 77, Pt: 78,
 Au: 79, Hg: 80, Tl: 81, Pb: 82, Bi: 83, Po: 84, At: 85, Rn: 86,
 Fr: 87, Ra: 88, Ac: 89, Th: 90, Pa: 91, U: 92, Np: 93, Pu: 94
};

function cleanNumber(str) {
 if (!str) return 0;
 // Remove parenthesized uncertainties like 8.8379(11) -> 8.8379
 const s = str.replace(/\(.*?\)/g, '').trim();
 const v = parseFloat(s);
 return isNaN(v) ? 0 : v;
}

function cleanSymbol(raw) {
 if (!raw) return 'X';
 // Strip digits, quotes, +/- oxidation states: e.g. "Fe3+" -> "Fe", "Sn1" -> "Sn"
 let s = raw.replace(/['"\d\+\-]/g, '').trim();
 // Capitalize first letter, lowercase second
 if (s.length >= 2) {
 const candidate = s[0].toUpperCase() + s[1].toLowerCase();
 if (SYMBOL_TO_Z[candidate]) return candidate;
 }
 if (s.length >= 1) {
 const candidate = s[0].toUpperCase();
 if (SYMBOL_TO_Z[candidate]) return candidate;
 }
 return s;
}

/**
 * Convert cell parameters a, b, c, alpha, beta, gamma to 3x3 Cartesian lattice vectors
 */
export function cellToLatticeVectors(a, b, c, alphaDeg, betaDeg, gammaDeg) {
 const toRad = Math.PI / 180.0;
 const alpha = alphaDeg * toRad;
 const beta = betaDeg * toRad;
 const gamma = gammaDeg * toRad;

 const ax = a;
 const ay = 0.0;
 const az = 0.0;

 const bx = b * Math.cos(gamma);
 const by = b * Math.sin(gamma);
 const bz = 0.0;

 const cx = c * Math.cos(beta);
 const cy = (c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma))) / Math.sin(gamma);
 const czSq = Math.max(0, c * c - cx * cx - cy * cy);
 const cz = Math.sqrt(czSq);

 return [
 [ax, ay, az],
 [bx, by, bz],
 [cx, cy, cz],
 ];
}

/**
 * Parse symmetry operation string like '-x+1/2, y+1/2, -z'
 * Returns a function (x, y, z) => [newX, newY, newZ]
 */
function parseSymOp(opStr) {
 const parts = opStr.replace(/['"]/g, '').split(',').map(p => p.trim().toLowerCase());
 if (parts.length !== 3) return null;

 function evalCoord(expr, x, y, z) {
 let s = expr.replace(/\s+/g, '');
 s = s.replace(/(\d+)\/(\d+)/g, (_, num, den) => (parseFloat(num) / parseFloat(den)).toString());
 
 let val = 0;
 const regex = /([+-]?)([\d.]+|[xyz])/g;
 let match;
 while ((match = regex.exec(s)) !== null) {
 const sign = match[1] === '-' ? -1 : 1;
 const tok = match[2];
 if (tok === 'x') val += sign * x;
 else if (tok === 'y') val += sign * y;
 else if (tok === 'z') val += sign * z;
 else val += sign * parseFloat(tok);
 }
 return val;
 }

 return (x, y, z) => [
 evalCoord(parts[0], x, y, z),
 evalCoord(parts[1], x, y, z),
 evalCoord(parts[2], x, y, z),
 ];
}

/**
 * Main CIF parser
 */
export function parseCIF(cifText) {
 const lines = cifText.split(/\r?\n/);

 let systemName = 'siesta';
 let a = null, b = null, c = null;
 let alpha = null, beta = null, gamma = null;

 const symOps = [];
 const rawAtoms = [];

 let i = 0;
 while (i < lines.length) {
 let line = lines[i].trim();

 if (!line || line.startsWith('#')) {
 i++;
 continue;
 }

 // System name from data_ tag
 if (line.toLowerCase().startsWith('data_')) {
 const name = line.substring(5).trim();
 if (name) systemName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
 i++;
 continue;
 }

 // Single key-value pairs
 if (line.startsWith('_')) {
 const tokens = line.split(/\s+/);
 const key = tokens[0].toLowerCase();
 const val = tokens.slice(1).join(' ');

 if (key === '_cell_length_a') a = cleanNumber(val);
 else if (key === '_cell_length_b') b = cleanNumber(val);
 else if (key === '_cell_length_c') c = cleanNumber(val);
 else if (key === '_cell_angle_alpha') alpha = cleanNumber(val);
 else if (key === '_cell_angle_beta') beta = cleanNumber(val);
 else if (key === '_cell_angle_gamma') gamma = cleanNumber(val);
 else if (key === '_chemical_name_common' || key === '_chemical_formula_sum') {
 const cleanName = val.replace(/['"]/g, '').trim();
 if (cleanName && systemName === 'siesta') {
 systemName = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
 }
 }
 i++;
 continue;
 }

 // loop_ blocks
 if (line.toLowerCase() === 'loop_') {
 i++;
 const headers = [];
 while (i < lines.length) {
 const hLine = lines[i].trim();
 if (hLine.startsWith('_')) {
 headers.push(hLine.split(/\s+/)[0].toLowerCase());
 i++;
 } else {
 break;
 }
 }

 // Check if it's symmetry loop
 const isSymLoop = headers.some(h =>
 h === '_space_group_symop_operation_xyz' ||
 h === '_symmetry_equiv_pos_as_xyz'
 );

 // Check if it's strictly fractional coordinate loop (must have _atom_site_fract_x or _atom_site_cartn_x)
 const isAtomLoop = headers.some(h => h === '_atom_site_fract_x' || h === '_atom_site_cartn_x');

 // Read loop data rows
 while (i < lines.length) {
 const dLine = lines[i].trim();
 if (!dLine || dLine.startsWith('#')) {
 i++;
 continue;
 }
 if (dLine.toLowerCase() === 'loop_' || dLine.startsWith('_') || dLine.toLowerCase().startsWith('data_')) {
 break;
 }

 const tokens = [];
 const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
 let match;
 while ((match = regex.exec(dLine)) !== null) {
 tokens.push(match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[0]));
 }

 if (isSymLoop) {
 const symOpCol = headers.findIndex(h =>
 h === '_space_group_symop_operation_xyz' ||
 h === '_symmetry_equiv_pos_as_xyz'
 );
 if (symOpCol >= 0 && tokens[symOpCol]) {
 const fn = parseSymOp(tokens[symOpCol]);
 if (fn) symOps.push(fn);
 }
 } else if (isAtomLoop && tokens.length >= headers.length) {
 const typeCol = headers.findIndex(h => h === '_atom_site_type_symbol');
 const labelCol = headers.findIndex(h => h === '_atom_site_label');
 const xCol = headers.findIndex(h => h === '_atom_site_fract_x' || h === '_atom_site_cartn_x');
 const yCol = headers.findIndex(h => h === '_atom_site_fract_y' || h === '_atom_site_cartn_y');
 const zCol = headers.findIndex(h => h === '_atom_site_fract_z' || h === '_atom_site_cartn_z');

 const rawSymbol = typeCol >= 0 ? tokens[typeCol] : (labelCol >= 0 ? tokens[labelCol] : 'X');
 const element = cleanSymbol(rawSymbol);
 const label = labelCol >= 0 ? tokens[labelCol] : element;
 const x = xCol >= 0 ? cleanNumber(tokens[xCol]) : 0;
 const y = yCol >= 0 ? cleanNumber(tokens[yCol]) : 0;
 const z = zCol >= 0 ? cleanNumber(tokens[zCol]) : 0;

 rawAtoms.push({ element, label, x, y, z });
 }

 i++;
 }
 continue;
 }

 i++;
 }

 // Fallbacks if cell dimensions missing
 if (!a) a = 10.0;
 if (!b) b = a;
 if (!c) c = a;
 if (!alpha) alpha = 90.0;
 if (!beta) beta = 90.0;
 if (!gamma) gamma = 90.0;

 const latticeVectors = cellToLatticeVectors(a, b, c, alpha, beta, gamma);

 // Apply symmetry operations if present and not identity-only
 let expandedAtoms = [];
 if (symOps.length > 1 && rawAtoms.length > 0) {
 const wrappedMod = (v) => {
 let m = v % 1.0;
 if (m < -1e-5) m += 1.0;
 if (Math.abs(m - 1.0) < 1e-5 || Math.abs(m) < 1e-5) m = 0.0;
 return m;
 };

 for (const at of rawAtoms) {
 for (const op of symOps) {
 const [nx, ny, nz] = op(at.x, at.y, at.z);
 const wx = wrappedMod(nx);
 const wy = wrappedMod(ny);
 const wz = wrappedMod(nz);

 // Deduplicate: same element, within distance threshold
 const isDup = expandedAtoms.some(ea => {
 if (ea.element !== at.element) return false;
 const dx = Math.abs(ea.x - wx);
 const dy = Math.abs(ea.y - wy);
 const dz = Math.abs(ea.z - wz);
 const minDx = Math.min(dx, 1 - dx);
 const minDy = Math.min(dy, 1 - dy);
 const minDz = Math.min(dz, 1 - dz);
 return (minDx * minDx + minDy * minDy + minDz * minDz) < 1e-4; // ~0.01 fractional dist
 });

 if (!isDup) {
 expandedAtoms.push({
 element: at.element,
 label: `${at.element}${expandedAtoms.length + 1}`,
 x: wx,
 y: wy,
 z: wz,
 });
 }
 }
 }
 } else {
 expandedAtoms = rawAtoms;
 }

 // Build unique species map
 const uniqueElements = Array.from(new Set(expandedAtoms.map(a => a.element)));
 const speciesList = uniqueElements.map((elem, idx) => ({
 idx: String(idx + 1),
 z: String(SYMBOL_TO_Z[elem] || 1),
 label: elem,
 psfile: `${elem}.psf`,
 }));

 const elementToSpeciesIdx = {};
 speciesList.forEach(sp => { elementToSpeciesIdx[sp.label] = sp.idx; });

 const atomsList = expandedAtoms.map(a => ({
 x: a.x.toFixed(8),
 y: a.y.toFixed(8),
 z: a.z.toFixed(8),
 species: elementToSpeciesIdx[a.element] || '1',
 label: a.label || a.element,
 }));

 return {
 system: {
 SystemLabel: systemName.substring(0, 20) || 'siesta',
 SystemName: systemName,
 NumberOfAtoms: String(atomsList.length),
 NumberOfSpecies: String(speciesList.length),
 },
 structure: {
 LatticeConstant: '1.0 Ang',
 LatticeVectors: latticeVectors,
 LatticeParameters: [a, b, c, alpha, beta, gamma],
 _useLatticeParameters: false,
 AtomicCoordinatesFormat: 'Fractional',
 species: speciesList,
 atoms: atomsList,
 },
 };
}
