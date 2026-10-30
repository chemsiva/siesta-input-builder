/**
 * CI-NEB (Climbing Image Nudged Elastic Band) Path Interpolator for SIESTA
 * Computes linear interpolation with periodic minimum-image convention
 */

export function interpolateNEBPath(initialStructure, finalStructure, numImages = 7) {
 if (!initialStructure || !finalStructure) {
 throw new Error('Both Initial and Final structures are required.');
 }

 const atomsA = initialStructure.atoms || [];
 const atomsB = finalStructure.atoms || [];

 if (atomsA.length === 0 || atomsB.length === 0) {
 throw new Error('Structures must contain atoms.');
 }

 if (atomsA.length !== atomsB.length) {
 throw new Error(`Atom count mismatch: Initial has ${atomsA.length} atoms, Final has ${atomsB.length} atoms. NEB requires exact 1-to-1 atom mapping.`);
 }

 const format = initialStructure.AtomicCoordinatesFormat || 'Fractional';
 const isFrac = format === 'Fractional';

 // Lattice vectors (average if slightly different)
 const lvA = initialStructure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
 const lvB = finalStructure.LatticeVectors || lvA;

 const images = [];

 for (let k = 0; k < numImages; k++) {
 const t = numImages === 1 ? 0 : k / (numImages - 1);

 // Interpolate lattice vectors
 const lvK = [
 [lvA[0][0]*(1-t) + lvB[0][0]*t, lvA[0][1]*(1-t) + lvB[0][1]*t, lvA[0][2]*(1-t) + lvB[0][2]*t],
 [lvA[1][0]*(1-t) + lvB[1][0]*t, lvA[1][1]*(1-t) + lvB[1][1]*t, lvA[1][2]*(1-t) + lvB[1][2]*t],
 [lvA[2][0]*(1-t) + lvB[2][0]*t, lvA[2][1]*(1-t) + lvB[2][1]*t, lvA[2][2]*(1-t) + lvB[2][2]*t],
 ];

 const atomsK = atomsA.map((atomA, idx) => {
 const atomB = atomsB[idx];
 const ax = parseFloat(atomA.x) || 0;
 const ay = parseFloat(atomA.y) || 0;
 const az = parseFloat(atomA.z) || 0;

 const bx = parseFloat(atomB.x) || 0;
 const by = parseFloat(atomB.y) || 0;
 const bz = parseFloat(atomB.z) || 0;

 let dx = bx - ax;
 let dy = by - ay;
 let dz = bz - az;

 // Minimum image convention for fractional coordinates
 if (isFrac) {
 if (dx > 0.5) dx -= 1.0;
 if (dx < -0.5) dx += 1.0;
 if (dy > 0.5) dy -= 1.0;
 if (dy < -0.5) dy += 1.0;
 if (dz > 0.5) dz -= 1.0;
 if (dz < -0.5) dz += 1.0;
 }

 let x = ax + t * dx;
 let y = ay + t * dy;
 let z = az + t * dz;

 if (isFrac) {
 while (x < 0) x += 1.0;
 while (x >= 1.0) x -= 1.0;
 while (y < 0) y += 1.0;
 while (y >= 1.0) y -= 1.0;
 while (z < 0) z += 1.0;
 while (z >= 1.0) z -= 1.0;
 }

 return {
 ...atomA,
 x: x.toFixed(8),
 y: y.toFixed(8),
 z: z.toFixed(8),
 };
 });

 images.push({
 imageIndex: k,
 t: parseFloat(t.toFixed(4)),
 isEndpoint: k === 0 || k === numImages - 1,
 structure: {
 ...initialStructure,
 LatticeVectors: lvK,
 atoms: atomsK,
 },
 });
 }

 // Calculate maximum atomic displacement along path
 let maxDisplacement = 0;
 for (let i = 0; i < atomsA.length; i++) {
 const ax = parseFloat(atomsA[i].x) || 0;
 const ay = parseFloat(atomsA[i].y) || 0;
 const az = parseFloat(atomsA[i].z) || 0;
 const bx = parseFloat(atomsB[i].x) || 0;
 const by = parseFloat(atomsB[i].y) || 0;
 const bz = parseFloat(atomsB[i].z) || 0;
 const dist = Math.sqrt((bx - ax)**2 + (by - ay)**2 + (bz - az)**2);
 if (dist > maxDisplacement) maxDisplacement = dist;
 }

 return {
 numImages,
 maxDisplacement: parseFloat(maxDisplacement.toFixed(4)),
 images,
 };
}
