/**
 * Slab & Vacuum Builder Tools for SIESTA
 */

/**
 * Add vacuum along the c / z lattice vector (in Ångström)
 */
export function addVacuumToStructure(structure, vacuumAngstrom = 15.0) {
  const lv = structure.LatticeVectors ? structure.LatticeVectors.map(r => [...r]) : [[1,0,0],[0,1,0],[0,0,1]];
  const format = structure.AtomicCoordinatesFormat || 'Fractional';
  const atoms = (structure.atoms || []).map(a => ({ ...a }));

  // c vector length
  const cz = lv[2];
  const oldLen = Math.sqrt(cz[0]*cz[0] + cz[1]*cz[1] + cz[2]*cz[2]);
  if (oldLen <= 0) return structure;

  const newLen = oldLen + parseFloat(vacuumAngstrom);
  const ratio = newLen / oldLen;

  // Scale c vector
  lv[2][0] *= ratio;
  lv[2][1] *= ratio;
  lv[2][2] *= ratio;

  // If fractional, scale atom fractional z coordinates so Cartesian positions remain unchanged
  if (format === 'Fractional') {
    atoms.forEach(a => {
      const oldZ = parseFloat(a.z) || 0;
      a.z = (oldZ / ratio).toFixed(8);
    });
  }

  // Update lattice parameters if present
  let newLP = null;
  if (structure.LatticeParameters) {
    newLP = [...structure.LatticeParameters];
    newLP[2] = (parseFloat(newLP[2]) || oldLen) + parseFloat(vacuumAngstrom);
  }

  return {
    ...structure,
    LatticeVectors: lv,
    LatticeParameters: newLP,
    atoms: atoms,
  };
}

/**
 * Center slab along the z-axis (shifts centroid to z = 0.5)
 */
export function centerSlabInCell(structure) {
  const format = structure.AtomicCoordinatesFormat || 'Fractional';
  const atoms = (structure.atoms || []).map(a => ({ ...a }));
  if (atoms.length === 0) return structure;

  if (format === 'Fractional') {
    const zVals = atoms.map(a => parseFloat(a.z) || 0);
    const minZ = Math.min(...zVals);
    const maxZ = Math.max(...zVals);
    const midZ = (minZ + maxZ) / 2.0;
    const shift = 0.5 - midZ;

    atoms.forEach(a => {
      let nz = (parseFloat(a.z) || 0) + shift;
      while (nz < 0) nz += 1.0;
      while (nz >= 1.0) nz -= 1.0;
      a.z = nz.toFixed(8);
    });
  } else {
    // Cartesian
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const cz = lv[2];
    const cellZ = Math.sqrt(cz[0]*cz[0] + cz[1]*cz[1] + cz[2]*cz[2]);
    const zVals = atoms.map(a => parseFloat(a.z) || 0);
    const minZ = Math.min(...zVals);
    const maxZ = Math.max(...zVals);
    const midZ = (minZ + maxZ) / 2.0;
    const shift = (cellZ / 2.0) - midZ;

    atoms.forEach(a => {
      a.z = ((parseFloat(a.z) || 0) + shift).toFixed(8);
    });
  }

  return {
    ...structure,
    atoms: atoms,
  };
}

/**
 * Expand unit cell to nx * ny * nz supercell
 */
export function buildSupercell(structure, nx = 2, ny = 2, nz = 1) {
  const lv = structure.LatticeVectors ? structure.LatticeVectors.map(r => [...r]) : [[1,0,0],[0,1,0],[0,0,1]];
  const format = structure.AtomicCoordinatesFormat || 'Fractional';
  const baseAtoms = structure.atoms || [];
  if (baseAtoms.length === 0) return structure;

  const newLV = [
    [lv[0][0] * nx, lv[0][1] * nx, lv[0][2] * nx],
    [lv[1][0] * ny, lv[1][1] * ny, lv[1][2] * ny],
    [lv[2][0] * nz, lv[2][1] * nz, lv[2][2] * nz],
  ];

  const newAtoms = [];
  let atomId = 1;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        baseAtoms.forEach(a => {
          let x, y, z;
          if (format === 'Fractional') {
            x = (((parseFloat(a.x) || 0) + ix) / nx).toFixed(8);
            y = (((parseFloat(a.y) || 0) + iy) / ny).toFixed(8);
            z = (((parseFloat(a.z) || 0) + iz) / nz).toFixed(8);
          } else {
            // Cartesian
            x = ((parseFloat(a.x) || 0) + ix * lv[0][0] + iy * lv[1][0] + iz * lv[2][0]).toFixed(8);
            y = ((parseFloat(a.y) || 0) + ix * lv[0][1] + iy * lv[1][1] + iz * lv[2][1]).toFixed(8);
            z = ((parseFloat(a.z) || 0) + ix * lv[0][2] + iy * lv[1][2] + iz * lv[2][2]).toFixed(8);
          }

          newAtoms.push({
            ...a,
            x, y, z,
            label: a.label ? `${a.label.replace(/\d+/g, '')}${atomId}` : '',
          });
          atomId++;
        });
      }
    }
  }

  let newLP = null;
  if (structure.LatticeParameters) {
    newLP = [...structure.LatticeParameters];
    newLP[0] = (parseFloat(newLP[0]) * nx);
    newLP[1] = (parseFloat(newLP[1]) * ny);
    newLP[2] = (parseFloat(newLP[2]) * nz);
  }

  return {
    ...structure,
    LatticeVectors: newLV,
    LatticeParameters: newLP,
    atoms: newAtoms,
  };
}
