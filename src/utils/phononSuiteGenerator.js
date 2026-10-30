import JSZip from 'jszip';
import { serializeFDF } from '../parser/fdfSerializer.js';
import { buildSupercell } from './slabBuilder.js';

/**
 * Generate a complete, ready-to-run Phonon Analysis Suite for SIESTA
 */
export async function generatePhononSuite(baseState, options = {}) {
 const {
 supercellDim = [2, 2, 2],
 displacement = '0.04 Bohr',
 bornCharge = true,
 saveDHS = false,
 } = options;

 const zip = new JSZip();
 const sysLabel = baseState.system.SystemLabel || 'phonon';
 const folder = zip.folder(`siesta_phonon_${sysLabel}`);

 const [nx, ny, nz] = supercellDim;

 // 1. Build supercell structure
 const superStructure = buildSupercell(baseState.structure, nx, ny, nz);
 const totalAtoms = superStructure.atoms ? superStructure.atoms.length : 1;

 // 2. Supercell FC FDF
 const fcState = {
 ...baseState,
 system: {
 ...baseState.system,
 SystemLabel: `${sysLabel}_supercell_FC`,
 SystemName: `${baseState.system.SystemName || 'System'} ${nx}x${ny}x${nz} Phonon Supercell`,
 NumberOfAtoms: String(totalAtoms),
 },
 structure: superStructure,
 md: {
 ...baseState.md,
 'MD.TypeOfRun': 'FC',
 'FC.first': '1',
 'FC.last': String(totalAtoms),
 'FC.Displacement': displacement,
 'BornCharge': bornCharge ? 'true' : 'false',
 'FC.Save.dHS': saveDHS ? 'true' : 'false',
 },
 };
 folder.file('supercell_fc.fdf', serializeFDF(fcState));

 // 3. VIBRA input file (vibra.fdf)
 const vibraFdf = `SystemName ${sysLabel} Phonon Dispersion with VIBRA
SystemLabel ${sysLabel}_vibra
NumberOfAtoms ${baseState.structure.atoms ? baseState.structure.atoms.length : 1}
NumberOfSpecies ${baseState.structure.species ? baseState.structure.species.length : 1}

AtomicCoordinatesFormat Fractional
%block AtomicCoordinatesAndAtomicSpecies
${(baseState.structure.atoms || []).map(a => ` ${a.x} ${a.y} ${a.z} ${a.species}`).join('\n')}
%endblock AtomicCoordinatesAndAtomicSpecies

SuperCell_1 ${nx} 0 0
SuperCell_2 0 ${ny} 0
SuperCell_3 0 0 ${nz}

BandLinesScale pi/a
%block BandLines
 1 0.000 0.000 0.000 \\Gamma
25 0.500 0.000 0.000 X
20 0.500 0.500 0.000 M
25 0.000 0.000 0.000 \\Gamma
20 0.500 0.500 0.500 R
%endblock BandLines

Eigenvectors .true.
`;
 folder.file('vibra.fdf', vibraFdf);

 // 4. Python Phonon Analysis & Plotter Script
 const pyPlotter = `#!/usr/bin/env python3
"""
SIESTA Phonon Analysis & Dispersion Plotter
Reads SIESTA Force Constants (SystemLabel.FC) or VIBRA output
"""

import os, sys, glob
import numpy as np
import matplotlib.pyplot as plt

print("=================================================================")
print(" SIESTA Phonon Dispersion & Vibrational Modes Analysis")
print("=================================================================")

fc_files = glob.glob("*.FC")
bands_files = glob.glob("*.bands") + glob.glob("*.bands.phonons")

if bands_files:
 # Plot existing phonon band structure
 bfile = bands_files[0]
 print(f"Reading phonon dispersion from {bfile}...")
 try:
 data = np.loadtxt(bfile)
 plt.figure(figsize=(7, 5))
 plt.plot(data[:, 0], data[:, 1:], color='#0284c7', lw=1.5)
 plt.title('SIESTA Phonon Dispersion')
 plt.xlabel('Wave vector q')
 plt.ylabel('Frequency (cm⁻¹ / meV)')
 plt.axhline(0, color='gray', ls='--', lw=0.8)
 plt.grid(True, alpha=0.3)
 plt.tight_layout()
 plt.savefig('phonon_dispersion.png', dpi=200)
 print(" Saved plot to phonon_dispersion.png")
 except Exception as e:
 print(f"Plot error: {e}")
elif fc_files:
 fc_file = fc_files[0]
 print(f"Found Force Constants matrix: {fc_file}")
 print("Run VIBRA ('vibra < vibra.fdf > vibra.out') or Phonopy to diagonalize dynamical matrix.")
else:
 print("No .FC or .bands files found yet. Run 'bash run_phonon.sh' first.")
`;
 folder.file('plot_phonon_dispersion.py', pyPlotter);

 // 5. Bash Runner Script
 const shRunner = `#!/usr/bin/env bash
# SIESTA Phonon Suite Runner
# Usage: ./run_phonon.sh [num_cores]

NPROCS=\${1:-4}
echo "=========================================================="
echo " Running SIESTA Force Constants calculation on $NPROCS cores"
echo "=========================================================="

FDF="supercell_fc.fdf"
OUT="supercell_fc.out"

echo "Running SIESTA for force constants matrix..."
mpirun -np "$NPROCS" siesta < "$FDF" > "$OUT" 2>&1

if [ -f "${sysLabel}_supercell_FC.FC" ]; then
 echo " Successfully generated ${sysLabel}_supercell_FC.FC matrix!"
 # Copy FC file for vibra
 cp "${sysLabel}_supercell_FC.FC" "${sysLabel}_vibra.FC" 2>/dev/null || true
 
 # Check if vibra is installed
 if command -v vibra &> /dev/null; then
 echo "Running VIBRA to compute phonon dispersion..."
 vibra < vibra.fdf > vibra.out
 fi

 python3 plot_phonon_dispersion.py
else
 echo "Check $OUT for calculation status."
fi
`;
 folder.file('run_phonon.sh', shRunner);

 // 6. Documentation
 const readme = `SIESTA Phonon Analysis Suite
=========================================================
System: ${sysLabel}
Supercell: ${nx} x ${ny} x ${nz} (${totalAtoms} atoms)
Displacement: ${displacement}
Born Effective Charges: ${bornCharge ? 'Enabled' : 'Disabled'}

How to Run:
1. Make sure pseudopotentials (*.psf) are in this directory.
2. Execute:
 bash run_phonon.sh 4
3. Analyze results:
 - supercell_fc.FC contains the force-constant matrix.
 - Run python3 plot_phonon_dispersion.py to view vibrational bands.
`;
 folder.file('README_PHONON.txt', readme);

 return await zip.generateAsync({ type: 'blob' });
}
