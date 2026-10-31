// Gaussian Cube 3D Volumetric Orbital / Density Parser & Marching Cubes Isosurface Extractor
// Supports molecular orbitals (HOMO/LUMO with positive & negative phases) and electron densities.
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

const BOHR_TO_ANG = 0.529177210903;

const ELEMENT_SYMBOLS = {
  1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
  11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar',
  19: 'K', 20: 'Ca', 21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe',
  27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn', 31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se',
  35: 'Br', 36: 'Kr', 37: 'Rb', 38: 'Sr', 39: 'Y', 40: 'Zr', 41: 'Nb', 42: 'Mo',
  44: 'Ru', 45: 'Rh', 46: 'Pd', 47: 'Ag', 48: 'Cd', 49: 'In', 50: 'Sn', 51: 'Sb',
  52: 'Te', 53: 'I', 55: 'Cs', 56: 'Ba', 74: 'W', 78: 'Pt', 79: 'Au', 80: 'Hg',
  82: 'Pb', 83: 'Bi'
};

export function parseCubeFile(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Cube content is empty or invalid.');
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 7) {
    throw new Error('Invalid Cube file: Fewer than 7 header lines.');
  }

  const title = lines[0].trim() || 'Molecular Orbital';
  const subtitle = lines[1].trim() || 'Gaussian Cube Data';

  // Line 3: natoms, origin (x0, y0, z0)
  const l3 = lines[2].trim().split(/\s+/).map(Number);
  const nAtomsRaw = parseInt(l3[0], 10);
  const nAtoms = Math.abs(nAtomsRaw);
  const isOrbitalFile = nAtomsRaw < 0; // Negative natoms indicates molecular orbital in Gaussian convention

  const origin = [
    l3[1] * BOHR_TO_ANG,
    l3[2] * BOHR_TO_ANG,
    l3[3] * BOHR_TO_ANG,
  ];

  // Lines 4-6: grid steps
  const l4 = lines[3].trim().split(/\s+/).map(Number);
  const l5 = lines[4].trim().split(/\s+/).map(Number);
  const l6 = lines[5].trim().split(/\s+/).map(Number);

  const nx = parseInt(l4[0], 10);
  const ny = parseInt(l5[0], 10);
  const nz = parseInt(l6[0], 10);

  const vX = [l4[1] * BOHR_TO_ANG, l4[2] * BOHR_TO_ANG, l4[3] * BOHR_TO_ANG];
  const vY = [l5[1] * BOHR_TO_ANG, l5[2] * BOHR_TO_ANG, l5[3] * BOHR_TO_ANG];
  const vZ = [l6[1] * BOHR_TO_ANG, l6[2] * BOHR_TO_ANG, l6[3] * BOHR_TO_ANG];

  // Atom lines
  const atoms = [];
  let lineIdx = 6;
  for (let a = 0; a < nAtoms && lineIdx < lines.length; a++, lineIdx++) {
    const parts = lines[lineIdx].trim().split(/\s+/).map(Number);
    const zNum = Math.round(parts[0]);
    const sym = ELEMENT_SYMBOLS[zNum] || `Z${zNum}`;
    atoms.push({
      index: a + 1,
      atomicNumber: zNum,
      element: sym,
      charge: parts[1],
      x: parts[2] * BOHR_TO_ANG,
      y: parts[3] * BOHR_TO_ANG,
      z: parts[4] * BOHR_TO_ANG,
    });
  }

  // Skip molecular orbital header line if present (when nAtomsRaw < 0)
  let orbitalIndex = null;
  if (isOrbitalFile && lineIdx < lines.length) {
    const orbParts = lines[lineIdx].trim().split(/\s+/).map(Number);
    if (orbParts.length >= 2) {
      orbitalIndex = orbParts[1];
    }
    lineIdx++;
  }

  // Parse remaining floats into Float32Array
  const totalVoxels = nx * ny * nz;
  const grid = new Float32Array(totalVoxels);
  let vIdx = 0;

  for (; lineIdx < lines.length && vIdx < totalVoxels; lineIdx++) {
    const rawTokens = lines[lineIdx].trim().split(/\s+/);
    for (let t = 0; t < rawTokens.length && vIdx < totalVoxels; t++) {
      const val = parseFloat(rawTokens[t]);
      if (!isNaN(val)) {
        grid[vIdx++] = val;
      }
    }
  }

  // Evaluate min / max and orbital phase properties
  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < vIdx; i++) {
    const v = grid[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  // An orbital wavefunction has both significant positive and negative lobes
  const hasNegativePhase = minVal < -1e-4;
  const hasPositivePhase = maxVal > 1e-4;
  const isWavefunction = hasNegativePhase && hasPositivePhase;

  // Determine a clean default isovalue
  let defaultIsoval = 0.02;
  const absPeak = Math.max(Math.abs(minVal), Math.abs(maxVal));
  if (absPeak > 0) {
    defaultIsoval = Math.max(0.002, parseFloat((absPeak * 0.22).toFixed(3)));
  }

  return {
    title,
    subtitle,
    isWavefunction,
    orbitalIndex,
    origin,
    gridDims: [nx, ny, nz],
    voxelVectors: [vX, vY, vZ],
    atoms,
    grid,
    minVal,
    maxVal,
    defaultIsoval,
  };
}

/**
 * Fast Marching Cubes Isosurface Extractor
 * Extracts smooth triangles and central-difference normals for target isovalue and phase sign.
 * sign === 1: positive lobe (+isoval)
 * sign === -1: negative lobe (-isoval)
 */
export function extractIsosurface(cubeData, isovalue, sign = 1) {
  const { gridDims, origin, voxelVectors, grid } = cubeData;
  const [nx, ny, nz] = gridDims;
  const [vX, vY, vZ] = voxelVectors;
  const [ox, oy, oz] = origin;

  const targetIso = sign >= 0 ? isovalue : -isovalue;
  const isPositive = sign >= 0;

  const getIdx = (i, j, k) => (i * ny + j) * nz + k;

  // Central-difference gradient for smooth surface normal
  const getNormal = (i, j, k) => {
    const dx = (grid[getIdx(Math.min(nx - 1, i + 1), j, k)] - grid[getIdx(Math.max(0, i - 1), j, k)]) * 0.5;
    const dy = (grid[getIdx(i, Math.min(ny - 1, j + 1), k)] - grid[getIdx(i, Math.max(0, j - 1), k)]) * 0.5;
    const dz = (grid[getIdx(i, j, Math.min(nz - 1, k + 1))] - grid[getIdx(i, j, Math.max(0, k - 1))]) * 0.5;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    // For positive lobe, normal points outwards along negative gradient (-grad)
    const factor = isPositive ? -1 / len : 1 / len;
    return [dx * factor, dy * factor, dz * factor];
  };

  const getPos = (i, j, k) => [
    ox + i * vX[0] + j * vY[0] + k * vZ[0],
    oy + i * vX[1] + j * vY[1] + k * vZ[1],
    oz + i * vX[2] + j * vY[2] + k * vZ[2]
  ];

  const positions = [];
  const normals = [];

  // Corner relative offsets
  const cornerOffsets = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
  ];

  // Edge table vertex connections (12 edges)
  const edgeCorners = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let k = 0; k < nz - 1; k++) {
        const cVals = new Float32Array(8);
        for (let c = 0; c < 8; c++) {
          const ci = i + cornerOffsets[c][0];
          const cj = j + cornerOffsets[c][1];
          const ck = k + cornerOffsets[c][2];
          cVals[c] = grid[getIdx(ci, cj, ck)];
        }

        // Build cubeindex
        let cubeindex = 0;
        if (isPositive) {
          for (let c = 0; c < 8; c++) if (cVals[c] >= targetIso) cubeindex |= (1 << c);
        } else {
          for (let c = 0; c < 8; c++) if (cVals[c] <= targetIso) cubeindex |= (1 << c);
        }

        if (edgeTable[cubeindex] === 0) continue;

        // Interpolate vertices along the 12 edges
        const vertList = new Array(12);
        const normList = new Array(12);

        for (let e = 0; e < 12; e++) {
          if (edgeTable[cubeindex] & (1 << e)) {
            const [c1, c2] = edgeCorners[e];
            const val1 = cVals[c1];
            const val2 = cVals[c2];

            let mu = 0.5;
            if (Math.abs(val1 - val2) > 1e-6) {
              mu = (targetIso - val1) / (val2 - val1);
            }
            mu = Math.max(0, Math.min(1, mu));

            const p1 = getPos(i + cornerOffsets[c1][0], j + cornerOffsets[c1][1], k + cornerOffsets[c1][2]);
            const p2 = getPos(i + cornerOffsets[c2][0], j + cornerOffsets[c2][1], k + cornerOffsets[c2][2]);
            vertList[e] = [
              p1[0] + mu * (p2[0] - p1[0]),
              p1[1] + mu * (p2[1] - p1[1]),
              p1[2] + mu * (p2[2] - p1[2]),
            ];

            const n1 = getNormal(i + cornerOffsets[c1][0], j + cornerOffsets[c1][1], k + cornerOffsets[c1][2]);
            const n2 = getNormal(i + cornerOffsets[c2][0], j + cornerOffsets[c2][1], k + cornerOffsets[c2][2]);
            normList[e] = [
              n1[0] + mu * (n2[0] - n1[0]),
              n1[1] + mu * (n2[1] - n1[1]),
              n1[2] + mu * (n2[2] - n1[2]),
            ];
          }
        }

        // Emit triangles
        const offset = cubeindex << 4;
        for (let t = 0; triTable[offset + t] !== -1; t += 3) {
          const a = triTable[offset + t];
          const b = triTable[offset + t + 1];
          const c = triTable[offset + t + 2];

          positions.push(...vertList[a], ...vertList[b], ...vertList[c]);
          normals.push(...normList[a], ...normList[b], ...normList[c]);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    triangleCount: positions.length / 9,
  };
}

/**
 * Built-in Benchmark Demo Molecular Orbitals
 */
export function generateDemoOrbitalCube(type = 'benzene_homo') {
  if (type === 'benzene_homo') {
    return generateBenzeneHomo();
  }
  return generateWaterHomo();
}

function generateBenzeneHomo() {
  const rCC = 1.397; // C-C bond in Angstrom
  const rCH = 1.085; // C-H bond in Angstrom

  const atoms = [];
  // 6 Carbons in XY plane at z=0
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    atoms.push({
      index: i + 1,
      atomicNumber: 6,
      element: 'C',
      charge: 6,
      x: rCC * Math.cos(ang),
      y: rCC * Math.sin(ang),
      z: 0.0,
    });
  }
  // 6 Hydrogens
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    const rTot = rCC + rCH;
    atoms.push({
      index: i + 7,
      atomicNumber: 1,
      element: 'H',
      charge: 1,
      x: rTot * Math.cos(ang),
      y: rTot * Math.sin(ang),
      z: 0.0,
    });
  }

  const nx = 36, ny = 36, nz = 32;
  const boxX = 7.0, boxY = 7.0, boxZ = 6.0;
  const origin = [-boxX / 2, -boxY / 2, -boxZ / 2];
  const vX = [boxX / (nx - 1), 0, 0];
  const vY = [0, boxY / (ny - 1), 0];
  const vZ = [0, 0, boxZ / (nz - 1)];

  const total = nx * ny * nz;
  const grid = new Float32Array(total);

  // Benzene e1g / HOMO pi-orbital: linear combination of carbon 2pz orbitals with alternating phases
  // psi = sum_c (-1)^c * z * exp(-|r - Rc|^2 / (2 * sigma^2))
  const sigma = 0.75;
  const twoSigSq = 2 * sigma * sigma;

  for (let i = 0; i < nx; i++) {
    const x = origin[0] + i * vX[0];
    for (let j = 0; j < ny; j++) {
      const y = origin[1] + j * vY[1];
      for (let k = 0; k < nz; k++) {
        const z = origin[2] + k * vZ[2];

        let psi = 0;
        for (let c = 0; c < 6; c++) {
          const cX = atoms[c].x;
          const cY = atoms[c].y;
          const dx = x - cX;
          const dy = y - cY;
          const dz = z;
          const d2 = dx * dx + dy * dy + dz * dz;

          // Degenerate HOMO pi component: cos(2 * theta_c)
          const phase = Math.cos(2 * (c * Math.PI) / 3);
          const pZ = dz * Math.exp(-d2 / twoSigSq);
          psi += phase * pZ * 0.45;
        }

        grid[(i * ny + j) * nz + k] = psi;
      }
    }
  }

  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < total; i++) {
    if (grid[i] < minVal) minVal = grid[i];
    if (grid[i] > maxVal) maxVal = grid[i];
  }

  return {
    title: 'Benzene (C6H6) HOMO π-Orbital',
    subtitle: 'Generated for SIESTA Molecular Orbital Studio',
    isWavefunction: true,
    orbitalIndex: 15,
    origin,
    gridDims: [nx, ny, nz],
    voxelVectors: [vX, vY, vZ],
    atoms,
    grid,
    minVal,
    maxVal,
    defaultIsoval: 0.025,
  };
}

function generateWaterHomo() {
  const atoms = [
    { index: 1, atomicNumber: 8, element: 'O', charge: 8, x: 0.0, y: 0.0, z: 0.117 },
    { index: 2, atomicNumber: 1, element: 'H', charge: 1, x: 0.0, y: 0.757, z: -0.469 },
    { index: 3, atomicNumber: 1, element: 'H', charge: 1, x: 0.0, y: -0.757, z: -0.469 },
  ];

  const nx = 34, ny = 34, nz = 34;
  const box = 6.0;
  const origin = [-box / 2, -box / 2, -box / 2];
  const vX = [box / (nx - 1), 0, 0];
  const vY = [0, box / (ny - 1), 0];
  const vZ = [0, 0, box / (nz - 1)];

  const total = nx * ny * nz;
  const grid = new Float32Array(total);

  // Water 1b1 HOMO: non-bonding Oxygen 2px orbital perpendicular to H-O-H plane
  const sigma = 0.65;
  const twoSigSq = 2 * sigma * sigma;

  for (let i = 0; i < nx; i++) {
    const x = origin[0] + i * vX[0];
    for (let j = 0; j < ny; j++) {
      const y = origin[1] + j * vY[1];
      for (let k = 0; k < nz; k++) {
        const z = origin[2] + k * vZ[2];
        const dz = z - 0.117;
        const d2 = x * x + y * y + dz * dz;
        // px lobe along x
        const psi = x * Math.exp(-d2 / twoSigSq) * 0.55;
        grid[(i * ny + j) * nz + k] = psi;
      }
    }
  }

  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < total; i++) {
    if (grid[i] < minVal) minVal = grid[i];
    if (grid[i] > maxVal) maxVal = grid[i];
  }

  return {
    title: 'Water (H2O) 1b1 HOMO Orbital (Oxygen 2px Lone Pair)',
    subtitle: 'Generated for SIESTA Molecular Orbital Studio',
    isWavefunction: true,
    orbitalIndex: 5,
    origin,
    gridDims: [nx, ny, nz],
    voxelVectors: [vX, vY, vZ],
    atoms,
    grid,
    minVal,
    maxVal,
    defaultIsoval: 0.025,
  };
}
