/**
 * High-Symmetry Band Path Generator for SIESTA
 * Standard crystallographic paths according to Setyawan & Curtarolo (AFLOW / Seekpath)
 */

export const BAND_PATH_PRESETS = {
 cubic: {
 label: 'Simple Cubic (sc)',
 description: 'Γ → X → M → Γ → R → X | M → R',
 path: [
 { npts: 1, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.5, ky: 0.0, kz: 0.0, label: 'X' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 { npts: 20, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 25, kx: 0.5, ky: 0.5, kz: 0.5, label: 'R' },
 { npts: 20, kx: 0.5, ky: 0.0, kz: 0.0, label: 'X' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.5, label: 'R' },
 ],
 },
 fcc: {
 label: 'Face-Centered Cubic (fcc)',
 description: 'Γ → X → W → K → Γ → L → U → W → L → K',
 path: [
 { npts: 1, kx: 0.000, ky: 0.000, kz: 0.000, label: '\\Gamma' },
 { npts: 25, kx: 0.500, ky: 0.000, kz: 0.500, label: 'X' },
 { npts: 15, kx: 0.500, ky: 0.250, kz: 0.750, label: 'W' },
 { npts: 15, kx: 0.375, ky: 0.375, kz: 0.750, label: 'K' },
 { npts: 25, kx: 0.000, ky: 0.000, kz: 0.000, label: '\\Gamma' },
 { npts: 20, kx: 0.500, ky: 0.500, kz: 0.500, label: 'L' },
 { npts: 15, kx: 0.625, ky: 0.250, kz: 0.625, label: 'U' },
 { npts: 15, kx: 0.500, ky: 0.250, kz: 0.750, label: 'W' },
 ],
 },
 bcc: {
 label: 'Body-Centered Cubic (bcc)',
 description: 'Γ → H → N → Γ → P → H | P → N',
 path: [
 { npts: 1, kx: 0.00, ky: 0.00, kz: 0.00, label: '\\Gamma' },
 { npts: 25, kx: 0.50, ky:-0.50, kz: 0.50, label: 'H' },
 { npts: 20, kx: 0.00, ky: 0.00, kz: 0.50, label: 'N' },
 { npts: 25, kx: 0.00, ky: 0.00, kz: 0.00, label: '\\Gamma' },
 { npts: 20, kx: 0.25, ky: 0.25, kz: 0.25, label: 'P' },
 { npts: 20, kx: 0.50, ky:-0.50, kz: 0.50, label: 'H' },
 ],
 },
 tetragonal: {
 label: 'Simple Tetragonal (tet)',
 description: 'Γ → X → M → Γ → Z → R → A → Z | X → R',
 path: [
 { npts: 1, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.5, ky: 0.0, kz: 0.0, label: 'X' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 { npts: 20, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.0, ky: 0.0, kz: 0.5, label: 'Z' },
 { npts: 20, kx: 0.5, ky: 0.0, kz: 0.5, label: 'R' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.5, label: 'A' },
 { npts: 20, kx: 0.0, ky: 0.0, kz: 0.5, label: 'Z' },
 ],
 },
 hexagonal: {
 label: 'Hexagonal / 2D (hex)',
 description: 'Γ → M → K → Γ → A → L → H → A',
 path: [
 { npts: 1, kx: 0.000, ky: 0.000, kz: 0.0, label: '\\Gamma' },
 { npts: 25, kx: 0.500, ky: 0.000, kz: 0.0, label: 'M' },
 { npts: 20, kx: 0.333, ky: 0.333, kz: 0.0, label: 'K' },
 { npts: 25, kx: 0.000, ky: 0.000, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.000, ky: 0.000, kz: 0.5, label: 'A' },
 { npts: 20, kx: 0.500, ky: 0.000, kz: 0.5, label: 'L' },
 { npts: 20, kx: 0.333, ky: 0.333, kz: 0.5, label: 'H' },
 ],
 },
 perovskite: {
 label: 'Cubic Perovskite (e.g. FAPbI3, SrTiO3)',
 description: 'R → Γ → X → M → Γ | R → M',
 path: [
 { npts: 1, kx: 0.5, ky: 0.5, kz: 0.5, label: 'R' },
 { npts: 25, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.5, ky: 0.0, kz: 0.0, label: 'X' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 { npts: 20, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.5, label: 'R' },
 { npts: 20, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 ],
 },
 slab2d: {
 label: '2D / Surface Slab (Square surface kz=0)',
 description: 'Γ → X → M → Γ',
 path: [
 { npts: 1, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 { npts: 25, kx: 0.5, ky: 0.0, kz: 0.0, label: 'X' },
 { npts: 25, kx: 0.5, ky: 0.5, kz: 0.0, label: 'M' },
 { npts: 25, kx: 0.0, ky: 0.0, kz: 0.0, label: '\\Gamma' },
 ],
 },
 slab_hex: {
 label: '2D / Surface Slab (Hexagonal surface kz=0)',
 description: 'Γ → K → M → Γ',
 path: [
 { npts: 1, kx: 0.000, ky: 0.000, kz: 0.0, label: '\\Gamma' },
 { npts: 25, kx: 0.333, ky: 0.333, kz: 0.0, label: 'K' },
 { npts: 20, kx: 0.500, ky: 0.000, kz: 0.0, label: 'M' },
 { npts: 25, kx: 0.000, ky: 0.000, kz: 0.0, label: '\\Gamma' },
 ],
 },
};

/**
 * Detect probable crystal system from lattice parameters
 */
export function detectCrystalSystem(lp) {
 if (!lp || lp.length < 6) return 'cubic';
 const [a, b, c, alpha, beta, gamma] = lp;

 const eq = (x, y, tol = 0.05) => Math.abs(x - y) < tol;
 const is90 = (ang) => eq(ang, 90, 1.0);
 const is120 = (ang) => eq(ang, 120, 1.0);

 if (eq(a, b) && eq(b, c) && is90(alpha) && is90(beta) && is90(gamma)) {
 return 'cubic';
 }
 if (eq(a, b) && !eq(b, c) && is90(alpha) && is90(beta) && is90(gamma)) {
 return 'tetragonal';
 }
 if (eq(a, b) && is90(alpha) && is90(beta) && is120(gamma)) {
 return 'hexagonal';
 }
 if (!eq(a, b) && !eq(b, c) && is90(alpha) && is90(beta) && is90(gamma)) {
 return 'cubic'; // orthorhombic fallback to cubic-like path
 }
 return 'cubic';
}
