/**
 * Atomic & Layer Constraints Utility Engine (ASE GUI & SIESTA %block Geometry.Constraints)
 * 
 * Supports:
 * - Automatic layer detection along z-axis (e.g. bottom 1, 2, or N layers fixed)
 * - Cutoff-based fixing (z < z_cutoff, e.g. substrate fixing)
 * - Species-based fixing (e.g. fix heavy metal framework, relax light adsorbates)
 * - Directional fixing: All (X, Y, Z), Z-only, or XY-only
 * - Generation of official SIESTA %block Geometry.Constraints
 * - Generation of standard Python ASE FixAtoms script
 */

/**
 * Group slab atoms into discrete layers along the z-axis based on distance threshold
 */
export function detectLayers(atoms, zThreshold = 0.8) {
  if (!atoms || atoms.length === 0) return [];

  const sorted = atoms.map((a, i) => ({
    originalIdx: i + 1,
    zVal: parseFloat(a.z) || 0,
    element: a.label?.replace(/[\d+_\-\s]/g, '') || a.species || 'X',
  })).sort((a, b) => a.zVal - b.zVal);

  const layers = [];
  sorted.forEach(a => {
    const layer = layers.find(l => Math.abs(l.avgZ - a.zVal) < zThreshold);
    if (layer) {
      layer.atoms.push(a);
      layer.avgZ = layer.atoms.reduce((sum, at) => sum + at.zVal, 0) / layer.atoms.length;
    } else {
      layers.push({ avgZ: a.zVal, atoms: [a] });
    }
  });

  return layers.sort((a, b) => a.avgZ - b.avgZ);
}

/**
 * Get 1-based atom indices for lowest N layers
 */
export function getBottomLayerIndices(atoms, numLayers = 1, zThreshold = 0.8) {
  const layers = detectLayers(atoms, zThreshold);
  const selected = layers.slice(0, numLayers);
  const indices = [];
  selected.forEach(l => l.atoms.forEach(a => indices.push(a.originalIdx)));
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * Get 1-based atom indices for top N layers
 */
export function getTopLayerIndices(atoms, numLayers = 1, zThreshold = 0.8) {
  const layers = detectLayers(atoms, zThreshold);
  const selected = layers.slice(Math.max(0, layers.length - numLayers));
  const indices = [];
  selected.forEach(l => l.atoms.forEach(a => indices.push(a.originalIdx)));
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * Get 1-based atom indices for all atoms below a given z cutoff
 */
export function getIndicesByZCutoff(atoms, zCutoff) {
  if (!atoms || isNaN(parseFloat(zCutoff))) return [];
  const zMax = parseFloat(zCutoff);
  const indices = [];
  atoms.forEach((a, i) => {
    const z = parseFloat(a.z) || 0;
    if (z <= zMax) indices.push(i + 1);
  });
  return indices;
}

/**
 * Get 1-based atom indices for atoms matching a given species label or index
 */
export function getIndicesBySpecies(atoms, speciesLabelOrIdx, speciesList = []) {
  if (!atoms || !speciesLabelOrIdx) return [];
  const target = String(speciesLabelOrIdx).toLowerCase().trim();

  // Find matching species index
  const spObj = speciesList.find(s =>
    String(s.idx) === target || String(s.label).toLowerCase() === target
  );
  const targetIdx = spObj ? String(spObj.idx) : target;

  const indices = [];
  atoms.forEach((a, i) => {
    const spMatch = String(a.species) === targetIdx;
    const labelMatch = a.label && a.label.replace(/[\d+_\-\s]/g, '').toLowerCase() === target;
    if (spMatch || labelMatch) indices.push(i + 1);
  });
  return indices;
}

/**
 * Generate Python ASE script snippet replicating the exact constraints
 */
export function generateAseScript(atoms, fixedIndices, directionMode = 'all') {
  const zeroIndexed = fixedIndices.map(i => i - 1).sort((a, b) => a - b);
  let code = `# Python Atomic Simulation Environment (ASE) Constraint Script\n`;
  code += `from ase import Atoms\n`;

  if (directionMode === 'all') {
    code += `from ase.constraints import FixAtoms\n\n`;
    code += `# Fix ${zeroIndexed.length} atoms (X, Y, Z coordinates fixed):\n`;
    code += `constraint = FixAtoms(indices=${JSON.stringify(zeroIndexed)})\n`;
    code += `atoms.set_constraint(constraint)\n`;
  } else if (directionMode === 'z') {
    code += `from ase.constraints import FixedPlane\n\n`;
    code += `# Fix Z-coordinate only (allow in-plane XY relaxation):\n`;
    code += `constraints = [FixedPlane(i, [0, 0, 1]) for i in ${JSON.stringify(zeroIndexed)}]\n`;
    code += `atoms.set_constraint(constraints)\n`;
  } else if (directionMode === 'xy') {
    code += `from ase.constraints import FixedLine\n\n`;
    code += `# Fix in-plane XY coordinates (allow Z relaxation only):\n`;
    code += `constraints = [FixedLine(i, [0, 0, 1]) for i in ${JSON.stringify(zeroIndexed)}]\n`;
    code += `atoms.set_constraint(constraints)\n`;
  }

  return code;
}
